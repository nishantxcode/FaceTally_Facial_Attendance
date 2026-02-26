from keras_facenet import FaceNet
import numpy as np

try:
    print("Loading FaceNet...")
    embedder = FaceNet() # This will download weights if needed
    print("FaceNet loaded.")
    
    img = np.random.randint(0, 255, (160, 160, 3)).astype('uint8')
    embeddings = embedder.embeddings([img])
    print(f"Embedding shape: {embeddings.shape}")
    
    # Check if we can access the underlying Keras model directly if needed
    print(f"Underlying model input shape: {embedder.model.input_shape}")
    print(f"Underlying model output shape: {embedder.model.output_shape}")

except Exception as e:
    print(f"Error: {e}")
