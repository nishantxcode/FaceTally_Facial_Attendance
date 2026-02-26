import h5py
import json

try:
    f = h5py.File('models/facenet_keras.h5', 'r')
    print("Keys:", list(f.keys()))
    if 'model_config' in f.attrs:
        config_str = f.attrs.get('model_config')
        if isinstance(config_str, bytes):
            config_str = config_str.decode('utf-8')
        config = json.loads(config_str)
        print("Model Config Loaded!")
        print("Layers:", len(config['config']['layers']))
        # Checking for Lambda layers
        for layer in config['config']['layers']:
            if layer['class_name'] == 'Lambda':
                print(f"Found Lambda layer: {layer['config']['name']}")
                # print(layer['config']) # Print config to see if it has 'function'
    else:
        print("No model_config found in attributes.")
except Exception as e:
    print(f"Error inspecting H5: {e}")
