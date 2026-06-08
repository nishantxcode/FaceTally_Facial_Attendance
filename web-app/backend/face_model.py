import os
import pickle
from dataclasses import dataclass

import cv2
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

from config import Config


MODEL_FILENAME = "web_face_model.pickle"
MODEL_STORE_KEY = "web_face_model"
FACE_SIZE = (100, 100)
MIN_CONFIDENCE = 0.55


@dataclass
class FacePrediction:
    name: str
    student_id: int | None
    confidence: float


def _model_path():
    return os.path.join(Config.MODEL_DIR, MODEL_FILENAME)


def _save_model_to_db(model):
    try:
        from database import get_db_connection

        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    REPLACE INTO face_model_store (model_key, model_data)
                    VALUES (%s, %s)
                    """,
                    (MODEL_STORE_KEY, pickle.dumps(model)),
                )
            conn.commit()
        finally:
            conn.close()
    except Exception as e:
        print(f"[MODEL] Could not persist web face model to DB: {e}", flush=True)


def _delete_model_from_db():
    try:
        from database import get_db_connection

        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM face_model_store WHERE model_key = %s",
                    (MODEL_STORE_KEY,),
                )
            conn.commit()
        finally:
            conn.close()
    except Exception as e:
        print(f"[MODEL] Could not delete web face model from DB: {e}", flush=True)


def _load_model_from_db():
    try:
        from database import get_db_connection

        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT model_data FROM face_model_store WHERE model_key = %s",
                    (MODEL_STORE_KEY,),
                )
                row = cur.fetchone()
                if not row:
                    return None
                return pickle.loads(row["model_data"])
        finally:
            conn.close()
    except Exception as e:
        print(f"[MODEL] Could not load web face model from DB: {e}", flush=True)
        return None


def has_db_face_model():
    return _load_model_from_db() is not None


def get_cascade():
    cascade_path = os.path.join(Config.MODEL_DIR, "haarcascade_frontalface_default.xml")
    if not os.path.exists(cascade_path):
        cascade_path = os.path.join(cv2.data.haarcascades, "haarcascade_frontalface_default.xml")

    cascade = cv2.CascadeClassifier(cascade_path)
    if cascade.empty():
        raise RuntimeError("Could not load OpenCV Haar cascade for face detection")
    return cascade


def _parse_student_folder(folder_name):
    name, sep, student_id = folder_name.rpartition("_")
    if not sep or not name or not student_id.isdigit():
        return None
    return name, int(student_id)


def _largest_face(faces):
    return max(faces, key=lambda face: face[2] * face[3])


def extract_face_vector(image, cascade=None):
    if image is None:
        return None

    cascade = cascade or get_cascade()
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    faces = cascade.detectMultiScale(gray, scaleFactor=1.2, minNeighbors=5, minSize=(45, 45))

    if len(faces) > 0:
        x, y, w, h = _largest_face(faces)
        pad = max(8, int(0.08 * max(w, h)))
        y1, y2 = max(0, y - pad), min(gray.shape[0], y + h + pad)
        x1, x2 = max(0, x - pad), min(gray.shape[1], x + w + pad)
        gray = gray[y1:y2, x1:x2]

    if gray.size == 0:
        return None

    face = cv2.resize(gray, FACE_SIZE)
    face = cv2.equalizeHist(face)
    vector = face.astype("float32").flatten()
    norm = np.linalg.norm(vector)
    if norm == 0:
        return None
    return vector / norm


def train_face_model():
    os.makedirs(Config.MODEL_DIR, exist_ok=True)
    os.makedirs(Config.DATASET_DIR, exist_ok=True)

    cascade = get_cascade()
    samples = []
    labels = []
    names = {}
    skipped = 0

    for folder in os.listdir(Config.DATASET_DIR):
        parsed = _parse_student_folder(folder)
        if parsed is None:
            continue

        name, student_id = parsed
        folder_path = os.path.join(Config.DATASET_DIR, folder)
        if not os.path.isdir(folder_path):
            continue

        names[student_id] = name
        for filename in os.listdir(folder_path):
            if not filename.lower().endswith((".jpg", ".jpeg", ".png")):
                continue

            image = cv2.imread(os.path.join(folder_path, filename))
            vector = extract_face_vector(image, cascade)
            if vector is None:
                skipped += 1
                continue

            samples.append(vector)
            labels.append(student_id)

    if not samples:
        stale_model = _model_path()
        if os.path.exists(stale_model):
            os.remove(stale_model)
        _delete_model_from_db()
        return {
            "trained": False,
            "message": "No usable face photos found",
            "samples": 0,
            "students": 0,
            "skipped": skipped,
        }

    model = {
        "samples": np.vstack(samples),
        "labels": np.array(labels),
        "names": names,
        "face_size": FACE_SIZE,
        "min_confidence": MIN_CONFIDENCE,
    }

    with open(_model_path(), "wb") as model_file:
        pickle.dump(model, model_file)
    _save_model_to_db(model)

    return {
        "trained": True,
        "message": "Face model trained successfully",
        "samples": len(samples),
        "students": len(set(labels)),
        "skipped": skipped,
    }


def load_face_model():
    path = _model_path()
    if not os.path.exists(path):
        model = _load_model_from_db()
        if model is None:
            return None

        os.makedirs(Config.MODEL_DIR, exist_ok=True)
        try:
            with open(path, "wb") as model_file:
                pickle.dump(model, model_file)
        except Exception as e:
            print(f"[MODEL] Could not cache DB web face model on disk: {e}", flush=True)
        return model

    with open(path, "rb") as model_file:
        return pickle.load(model_file)


def predict_face(vector, model):
    if vector is None or model is None:
        return FacePrediction("Unknown", None, 0.0)

    similarities = cosine_similarity(vector.reshape(1, -1), model["samples"])[0]
    best_index = int(np.argmax(similarities))
    best_score = float(similarities[best_index])
    student_id = int(model["labels"][best_index])
    threshold = float(model.get("min_confidence", MIN_CONFIDENCE))

    if best_score < threshold:
        return FacePrediction("Unknown", None, best_score)

    return FacePrediction(model["names"].get(student_id, "Unknown"), student_id, best_score)
