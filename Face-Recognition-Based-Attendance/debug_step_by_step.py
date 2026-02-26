
# DEBUG SCRIPT
import sys
print("Step 1: Imports starting")
try:
    from tkinter import *
    print("tkinter imported")
    import cv2
    print("cv2 imported")
    import os
    from tkinter.ttk import Combobox, Treeview, Scrollbar, Progressbar
    from PIL import Image, ImageTk
    print("PIL imported")
    import pymysql
    import csv
    from tkinter import messagebox , Message
    import db_config
    import numpy as np
    from os import listdir
    from tkinter import simpledialog
    import time
    import random
    import pandas as pd
    from tkinter import filedialog
    import gtts
    from gtts import gTTS
    print("gtts imported")
    from extract_embeddings import Extract_Embeddings
    print("Extract_Embeddings imported")
    import pickle
    print("pickle imported")
    from training import Training
    print("Training imported")
    import os
    from datetime import datetime
    from statistics import mode
    from mark_attendance import Mark_Attendance
    print("Mark_Attendance imported")
    import sys
    import webbrowser
    import re
    import shutil
    from apscheduler.schedulers.background import BackgroundScheduler
    import event_scheduler
    import json
    from tensorflow.keras.preprocessing.image import img_to_array
    from tensorflow.keras.models import model_from_json
    import tensorflow as tf
    print("tensorflow imported")
except Exception as e:
    print(f"CRASH DURING IMPORTS: {e}")
    sys.exit(1)

print("Step 2: Initialization")
try:
    root_dir = os.getcwd()

    print("Initializing Extract_Embeddings...")
    embedding_obj = Extract_Embeddings(model_path = 'models/facenet_keras.h5')
    embedding_model = embedding_obj.load_model()
    print("Embeddings model loaded")

    print("Loading Face Cascade...")
    face_cascade = cv2.CascadeClassifier("models/haarcascade_frontalface_default.xml")
    
    print("Loading Liveness Model...")
    json_path = 'antispoofing_models/finalyearproject_antispoofing_model_mobilenet.json'
    weights_path = 'antispoofing_models/finalyearproject_antispoofing_model_74-0.986316.h5'
    
    with open(json_path,'r') as f:
        loaded_model_json = f.read()
    liveness_model = model_from_json(loaded_model_json)
    liveness_model.load_weights(weights_path)
    print("Liveness Model loaded")
    
except Exception as e:
    print(f"CRASH DURING INITIALIZATION: {e}")
    sys.exit(1)

print("Step 3: GUI Init")
try:
    print("Initializing Tk...")
    # NOTE: This might fail if no display, but on user's windows machine it should work
    face = Tk()
    print("Tk initialized")
    face.destroy()
    print("Tk destroyed")
except Exception as e:
    print(f"CRASH DURING GUI INIT: {e}")
    sys.exit(1)

print("DEBUG SCRIPT FINISHED SUCCESSFULLY")
