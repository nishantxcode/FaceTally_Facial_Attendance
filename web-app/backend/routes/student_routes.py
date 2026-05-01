from flask import Blueprint, request, jsonify
from database import get_db_connection
from auth import token_required
import os
import base64
import shutil
from config import Config
from face_model import load_face_model, train_face_model
from time_utils import format_time_ampm, today_ist_string

student_bp = Blueprint('students', __name__)


def train_and_reload_face_model():
    """Train the web face model and refresh the recognition route's in-memory copy."""
    result = train_face_model()
    try:
        from routes import recognition_routes
        recognition_routes.web_face_model = load_face_model()
    except Exception as e:
        print(f"Could not refresh in-memory face model: {e}")
    return result

@student_bp.route('', methods=['GET'])
@token_required
def get_students(current_user):
    """Get all students with optional search/filter."""
    search = request.args.get('search', '')
    department = request.args.get('department', '')
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 20))
    offset = (page - 1) * per_page
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Build query
            query = "SELECT * FROM attendance WHERE 1=1"
            params = []
            
            if search:
                query += " AND (fname LIKE %s OR email_address LIKE %s OR contact_no LIKE %s)"
                search_param = f"%{search}%"
                params.extend([search_param, search_param, search_param])
            
            if department:
                query += " AND department = %s"
                params.append(department)
            
            # Get total count
            count_query = query.replace("SELECT *", "SELECT COUNT(*) as total")
            cur.execute(count_query, params)
            total = cur.fetchone()['total']
            
            # Get paginated results
            query += " ORDER BY eid DESC LIMIT %s OFFSET %s"
            params.extend([per_page, offset])
            cur.execute(query, params)
            students = cur.fetchall()
            
            # Convert date objects to strings
            for s in students:
                if s.get('date_of_join'):
                    s['date_of_join'] = s['date_of_join'].strftime('%Y-%m-%d')
            
            return jsonify({
                'students': students,
                'total': total,
                'page': page,
                'per_page': per_page,
                'total_pages': (total + per_page - 1) // per_page
            }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@student_bp.route('/<int:student_id>', methods=['GET'])
@token_required
def get_student(current_user, student_id):
    """Get a single student by ID."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM attendance WHERE eid = %s", (student_id,))
            student = cur.fetchone()
            
            if student is None:
                return jsonify({'error': 'Student not found'}), 404
            
            if student.get('date_of_join'):
                student['date_of_join'] = student['date_of_join'].strftime('%Y-%m-%d')
            
            # Get attendance history
            cur.execute(
                "SELECT * FROM report WHERE id = %s ORDER BY date DESC LIMIT 30",
                (student_id,)
            )
            history = cur.fetchall()
            for h in history:
                if h.get('date'):
                    h['date'] = h['date'].strftime('%Y-%m-%d')
                if h.get('time'):
                    h['time'] = format_time_ampm(h['time'])
            
            student['attendance_history'] = history
            return jsonify(student), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@student_bp.route('', methods=['POST'])
@token_required
def add_student(current_user):
    """Add a new student."""
    data = request.get_json()
    
    required = ['department', 'fname', 'gender', 'contact_no', 'email_address']
    for field in required:
        if not data.get(field):
            return jsonify({'error': f'{field} is required'}), 400
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO attendance (department, fname, gender, contact_no, email_address, date_of_join)
                   VALUES (%s, %s, %s, %s, %s, %s)""",
                (
                    data['department'],
                    data['fname'],
                    data['gender'],
                    data['contact_no'],
                    data['email_address'],
                    today_ist_string()
                )
            )
            conn.commit()
            student_id = cur.lastrowid
            
            # Create dataset directory for face photos
            dataset_dir = os.path.join(Config.DATASET_DIR, f"{data['fname']}_{student_id}")
            os.makedirs(dataset_dir, exist_ok=True)
            
            return jsonify({
                'message': 'Student added successfully',
                'student_id': student_id
            }), 201
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@student_bp.route('/<int:student_id>', methods=['PUT'])
@token_required
def update_student(current_user, student_id):
    """Update student details."""
    data = request.get_json()
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Get current student data
            cur.execute("SELECT * FROM attendance WHERE eid = %s", (student_id,))
            student = cur.fetchone()
            if student is None:
                return jsonify({'error': 'Student not found'}), 404
            
            cur.execute(
                """UPDATE attendance 
                   SET department = %s, fname = %s, gender = %s, contact_no = %s, email_address = %s
                   WHERE eid = %s""",
                (
                    data.get('department', student['department']),
                    data.get('fname', student['fname']),
                    data.get('gender', student['gender']),
                    data.get('contact_no', student['contact_no']),
                    data.get('email_address', student['email_address']),
                    student_id
                )
            )
            conn.commit()
            
            # Rename dataset directory if name changed
            new_name = data.get('fname', student['fname'])
            if new_name != student['fname']:
                old_dir = os.path.join(Config.DATASET_DIR, f"{student['fname']}_{student_id}")
                new_dir = os.path.join(Config.DATASET_DIR, f"{new_name}_{student_id}")
                if os.path.exists(old_dir):
                    os.rename(old_dir, new_dir)
                    train_and_reload_face_model()
            
            return jsonify({'message': 'Student updated successfully'}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@student_bp.route('/<int:student_id>', methods=['DELETE'])
@token_required
def delete_student(current_user, student_id):
    """Delete a student and their face data."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM attendance WHERE eid = %s", (student_id,))
            student = cur.fetchone()
            if student is None:
                return jsonify({'error': 'Student not found'}), 404
            
            # Delete from database
            cur.execute("DELETE FROM attendance WHERE eid = %s", (student_id,))
            cur.execute("DELETE FROM report WHERE id = %s", (student_id,))
            conn.commit()
            
            # Delete face dataset
            dataset_path = os.path.join(Config.DATASET_DIR, f"{student['fname']}_{student_id}")
            if os.path.exists(dataset_path):
                shutil.rmtree(dataset_path)

            train_result = train_and_reload_face_model()
            
            return jsonify({
                'message': 'Student deleted successfully',
                'training': train_result
            }), 200
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@student_bp.route('/<int:student_id>/capture', methods=['POST'])
@token_required
def save_face_photos(current_user, student_id):
    """Save captured face photos for a student (base64 images from webcam)."""
    data = request.get_json()
    images = data.get('images', [])
    
    if not images:
        return jsonify({'error': 'No images provided'}), 400
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT fname FROM attendance WHERE eid = %s", (student_id,))
            student = cur.fetchone()
            if student is None:
                return jsonify({'error': 'Student not found'}), 404
            
            name = student['fname']
            dataset_dir = os.path.join(Config.DATASET_DIR, f"{name}_{student_id}")
            os.makedirs(dataset_dir, exist_ok=True)

            for filename in os.listdir(dataset_dir):
                if filename.lower().endswith(('.jpg', '.jpeg', '.png')):
                    os.remove(os.path.join(dataset_dir, filename))
            
            saved_count = 0
            for i, img_data in enumerate(images):
                try:
                    # Remove data URL prefix if present
                    if ',' in img_data:
                        img_data = img_data.split(',')[1]
                    
                    img_bytes = base64.b64decode(img_data)
                    filepath = os.path.join(dataset_dir, f"{name}{i+1}.jpg")
                    with open(filepath, 'wb') as f:
                        f.write(img_bytes)
                    saved_count += 1
                except Exception as e:
                    print(f"Error saving image {i}: {e}")

            if saved_count == 0:
                return jsonify({'error': 'No photos could be saved'}), 400

            train_result = train_and_reload_face_model()
            
            return jsonify({
                'message': f'{saved_count} photos saved successfully',
                'saved_count': saved_count,
                'training': train_result
            }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@student_bp.route('/train-faces', methods=['POST'])
@token_required
def train_faces(current_user):
    """Manually rebuild the web face model from the saved dataset."""
    try:
        result = train_and_reload_face_model()
        status = 200 if result.get('trained') else 400
        return jsonify(result), status
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@student_bp.route('/departments', methods=['GET'])
@token_required
def get_departments(current_user):
    """Get list of unique departments."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT DISTINCT department FROM attendance WHERE department IS NOT NULL")
            depts = [row['department'] for row in cur.fetchall()]
            return jsonify(depts), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()
