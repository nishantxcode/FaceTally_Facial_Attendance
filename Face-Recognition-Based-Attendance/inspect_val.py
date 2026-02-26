import h5py
import json

try:
    with h5py.File('models/facenet_keras.h5', 'r') as f:
        config_str = f.attrs.get('model_config')
        if isinstance(config_str, bytes):
            config_str = config_str.decode('utf-8')
        config = json.loads(config_str)
        
        for layer in config['config']['layers']:
            if layer['class_name'] == 'Lambda':
                print(f"Layer: {layer['config']['name']}")
                fn = layer['config'].get('function')
                print(f"Function type: {type(fn)}")
                print(f"Function content: {fn}")
                break # Just see one
except Exception as e:
    print(f"Error: {e}")
