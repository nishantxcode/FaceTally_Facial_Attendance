import tensorflow as tf
from tensorflow.keras.models import model_from_json
import os
import json

root_dir = os.getcwd()
json_file_path = os.path.join(root_dir, 'antispoofing_models/finalyearproject_antispoofing_model_mobilenet.json')
weights_file_path = os.path.join(root_dir, 'antispoofing_models/finalyearproject_antispoofing_model_74-0.986316.h5')

print(f"Loading JSON from {json_file_path}...")
try:
    with open(json_file_path,'r') as json_file:
        loaded_model_json = json_file.read()
except Exception as e:
    print(f"Error reading JSON: {e}")
    exit(1)

print("Creating model from JSON...")
try:
    liveness_model = model_from_json(loaded_model_json)
except Exception as e:
    print(f"Error creating model from JSON: {e}")
    exit(1)

print(f"Loading weights from {weights_file_path}...")
try:
    liveness_model.load_weights(weights_file_path)
except Exception as e:
    print(f"Error loading weights: {e}")
    exit(1)

print("Liveness Model loaded successfully")
