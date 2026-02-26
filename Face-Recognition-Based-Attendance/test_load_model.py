import tensorflow as tf
from tensorflow.keras.models import load_model, Model
import os

print("Testing model load...")
try:
    model = load_model('models/facenet_keras.h5', compile=False)
    print("Model loaded with compile=False!")
except Exception as e:
    print(f"Failed with compile=False: {e}")

try:
    model = load_model('models/facenet_keras.h5', custom_objects={})
    print("Model loaded with empty custom_objects!")
except Exception as e:
    print(f"Failed with empty custom_objects: {e}")
