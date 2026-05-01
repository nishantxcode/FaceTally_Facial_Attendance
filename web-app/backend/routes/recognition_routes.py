from flask import Blueprint, request, jsonify
from database import get_db_connection
from auth import token_required
import cv2
import numpy as np
import base64
import pickle
import os
from config import Config
from face_model import extract_face_vector, get_cascade, load_face_model, predict_face
from time_utils import current_time_ist_string, format_time_ampm, today_ist_string

recognition_bp = Blueprint('recognition', __name__)

# Global model references (loaded once at startup)
face_cascade = None
embedding_model = None
liveness_model = None
recognizer = None
label_encoder = None
staff_details = None
web_face_model = None

def init_models():
    """Initialize ML models. Called at app startup."""
    global face_cascade, recognizer, label_encoder, staff_details, web_face_model
    
    try:
        # Load face cascade from app models if present, otherwise use OpenCV's bundled cascade.
        face_cascade = get_cascade()
        print("[MODEL] Face cascade loaded")

        # Load the web-trained fallback model built from web-app/backend/dataset.
        web_face_model = load_face_model()
        if web_face_model:
            print(f"[MODEL] Web face model loaded ({len(web_face_model['samples'])} samples)")
        
        # Load recognizer
        recognizer_path = os.path.join(Config.MODEL_DIR, 'recognizer.pickle')
        if os.path.exists(recognizer_path):
            recognizer = pickle.loads(open(recognizer_path, "rb").read())
            print("[MODEL] Recognizer loaded")
        
        # Load embeddings for label encoder
        embeddings_path = os.path.join(Config.MODEL_DIR, 'embeddings.pickle')
        if os.path.exists(embeddings_path):
            data = pickle.loads(open(embeddings_path, "rb").read())
            from sklearn.preprocessing import LabelEncoder
            label_encoder = LabelEncoder()
            label_encoder.fit(data['ids'])
            print("[MODEL] Label encoder loaded")
        
        # Load staff details from dataset directory
        staff_details = {}
        dataset_dir = Config.DATASET_DIR
        if os.path.exists(dataset_dir):
            for folder in os.listdir(dataset_dir):
                parts = folder.rsplit('_', 1)
                if len(parts) == 2:
                    name, sid = parts
                    try:
                        staff_details[name] = int(sid)
                    except ValueError:
                        pass
            print(f"[MODEL] Staff details loaded: {len(staff_details)} entries")
        
        # Try loading ONNX model for embeddings (lighter than TensorFlow)
        try:
            import onnxruntime as ort
            onnx_path = os.path.join(Config.MODEL_DIR, 'facenet.onnx')
            if os.path.exists(onnx_path):
                embedding_model_session = ort.InferenceSession(onnx_path)
                print("[MODEL] ONNX FaceNet model loaded")
        except ImportError:
            print("[MODEL] ONNX Runtime not available, will try TensorFlow")
        except Exception as e:
            print(f"[MODEL] ONNX model load error: {e}")
        
        print("[MODEL] All available models initialized")
        return True
        
    except Exception as e:
        print(f"[MODEL] Error initializing models: {e}")
        return False

def decode_base64_image(base64_string):
    """Decode a base64 image string to a numpy array."""
    if ',' in base64_string:
        base64_string = base64_string.split(',')[1]
    
    img_bytes = base64.b64decode(base64_string)
    nparr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    return img

def get_key_by_value(val, dictionary):
    """Get dictionary key by value."""
    for key, value in dictionary.items():
        if val == value:
            return key
    return None

@recognition_bp.route('/recognize', methods=['POST'])
@token_required
def recognize_face(current_user):
    """Receive a webcam frame and recognize the face."""
    global face_cascade, recognizer, label_encoder, staff_details, web_face_model
    
    if face_cascade is None:
        try:
            face_cascade = get_cascade()
        except Exception as e:
            return jsonify({'error': f'Face detector not loaded: {str(e)}'}), 503

    if recognizer is None:
        web_face_model = load_face_model()

    if recognizer is None and web_face_model is None:
        return jsonify({'error': 'Face model is not trained yet. Capture and save student photos first.'}), 503
    
    data = request.get_json()
    if not data or not data.get('image'):
        return jsonify({'error': 'No image provided'}), 400
    
    try:
        # Decode the image
        frame = decode_base64_image(data['image'])
        if frame is None:
            return jsonify({'error': 'Could not decode image'}), 400
        
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, 1.3, 5)
        
        if len(faces) == 0:
            return jsonify({
                'detected': False,
                'message': 'No face detected'
            }), 200
        
        results = []
        for (x, y, w, h) in faces:
            face_region = frame[max(0, y-5):y+h+5, max(0, x-5):x+w+5]
            
            if face_region.size == 0:
                continue
            
            if recognizer is None and web_face_model is not None:
                vector = extract_face_vector(face_region, face_cascade)
                prediction = predict_face(vector, web_face_model)
                confidence = round(prediction.confidence * 100, 1)

                if prediction.student_id is not None:
                    results.append({
                        'name': prediction.name,
                        'id': prediction.student_id,
                        'confidence': confidence,
                        'bbox': {'x': int(x), 'y': int(y), 'w': int(w), 'h': int(h)}
                    })
                else:
                    results.append({
                        'name': 'Unknown',
                        'id': None,
                        'confidence': confidence,
                        'bbox': {'x': int(x), 'y': int(y), 'w': int(w), 'h': int(h)}
                    })
                continue

            resized_face = cv2.resize(face_region, (160, 160))
            
            # Normalize
            face_pixel = resized_face.astype('float32')
            mean, std = face_pixel.mean(), face_pixel.std()
            face_pixel = (face_pixel - mean) / std
            
            # Try ONNX inference first, fall back to basic
            try:
                import onnxruntime as ort
                onnx_path = os.path.join(Config.MODEL_DIR, 'facenet.onnx')
                if os.path.exists(onnx_path):
                    session = ort.InferenceSession(onnx_path)
                    input_name = session.get_inputs()[0].name
                    sample = np.expand_dims(face_pixel, axis=0)
                    embedding = session.run(None, {input_name: sample})[0]
                else:
                    raise ImportError("ONNX model not found")
            except (ImportError, Exception):
                # Fall back to TensorFlow if ONNX not available
                try:
                    from tensorflow.keras.models import load_model
                    h5_path = os.path.join(Config.MODEL_DIR, 'facenet_keras.h5')
                    if os.path.exists(h5_path):
                        model = load_model(h5_path)
                        sample = np.expand_dims(face_pixel, axis=0)
                        embedding = model.predict(sample)
                    else:
                        return jsonify({'error': 'No face embedding model available'}), 503
                except Exception as e:
                    return jsonify({'error': f'Model inference error: {str(e)}'}), 500
            
            embedding = embedding.reshape(1, -1)
            
            # Classify
            preds = recognizer.predict_proba(embedding)[0]
            p = np.argmax(preds)
            proba = float(preds[p])
            predicted_id = label_encoder.classes_[p]
            name = get_key_by_value(predicted_id, staff_details)
            
            if proba >= 0.6 and name:
                results.append({
                    'name': name,
                    'id': int(predicted_id),
                    'confidence': round(proba * 100, 1),
                    'bbox': {'x': int(x), 'y': int(y), 'w': int(w), 'h': int(h)}
                })
            else:
                results.append({
                    'name': 'Unknown',
                    'id': None,
                    'confidence': round(proba * 100, 1),
                    'bbox': {'x': int(x), 'y': int(y), 'w': int(w), 'h': int(h)}
                })
        
        return jsonify({
            'detected': True,
            'faces_count': len(results),
            'results': results
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@recognition_bp.route('/mark-from-recognition', methods=['POST'])
@token_required
def mark_from_recognition(current_user):
    """Mark attendance after successful face recognition."""
    data = request.get_json()
    
    if not data.get('student_id') or not data.get('name'):
        return jsonify({'error': 'Student ID and name are required'}), 400
    
    date = today_ist_string()
    time_val = current_time_ist_string()
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Check if already marked
            cur.execute(
                "SELECT * FROM report WHERE id = %s AND date = %s",
                (data['student_id'], date)
            )
            if cur.fetchone():
                return jsonify({
                    'error': f"Attendance already marked for {data['name']} today",
                    'already_marked': True
                }), 409
            
            cur.execute(
                "INSERT INTO report (id, name, date, time, status) VALUES (%s, %s, %s, %s, %s)",
                (data['student_id'], data['name'], date, time_val, 'Present')
            )
            conn.commit()
            
            return jsonify({
                'message': f"Attendance marked for {data['name']}",
                'student_id': data['student_id'],
                'name': data['name'],
                'date': date,
                'time': format_time_ampm(time_val)
            }), 201
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@recognition_bp.route('/model-status', methods=['GET'])
@token_required
def model_status(current_user):
    """Check the status of loaded models."""
    cascade_path = os.path.join(Config.MODEL_DIR, 'haarcascade_frontalface_default.xml')
    recognizer_path = os.path.join(Config.MODEL_DIR, 'recognizer.pickle')
    embeddings_path = os.path.join(Config.MODEL_DIR, 'embeddings.pickle')
    onnx_path = os.path.join(Config.MODEL_DIR, 'facenet.onnx')
    h5_path = os.path.join(Config.MODEL_DIR, 'facenet_keras.h5')
    web_model = load_face_model()
    
    return jsonify({
        'face_cascade': os.path.exists(cascade_path),
        'recognizer': os.path.exists(recognizer_path),
        'embeddings': os.path.exists(embeddings_path),
        'facenet_onnx': os.path.exists(onnx_path),
        'facenet_h5': os.path.exists(h5_path),
        'web_face_model': web_model is not None,
        'web_face_samples': len(web_model['samples']) if web_model else 0,
        'web_face_students': len(set(web_model['labels'])) if web_model else 0,
        'staff_loaded': len(staff_details) if staff_details else 0
    }), 200
