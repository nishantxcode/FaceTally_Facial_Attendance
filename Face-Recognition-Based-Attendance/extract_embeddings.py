import cv2
import os
import numpy as np
from tensorflow.keras.models import load_model
import pickle


rootdir = os.getcwd()

from keras_facenet import FaceNet

class Extract_Embeddings():

	def __init__(self,model_path):
		self.model_path = model_path		
		self.dataset_dir = os.path.join(rootdir,'dataset')
		self.embedder = FaceNet()

	def load_model(self):
		return self.embedder.model

	def check_pretrained_file(self,embeddings_model):
		self.embeddings_model = embeddings_model
		data = pickle.loads(open(embeddings_model, "rb").read())
		names = np.array(data["names"])
		unique_names = np.unique(names).tolist()
		return [data,unique_names]

	def get_staff_details(self):
		print(f"Scanning dataset directory: {self.dataset_dir}")
		if not os.path.exists(self.dataset_dir):
			print(f"Dataset directory not found!")
			return {}
			
		details = os.listdir(self.dataset_dir)
		staff_details = {}
		for item in details:
			if "_" in item:
				name = item.split("_")[0]
				id = item.split("_")[1]
				staff_details[name] = id
			else:
				print(f"Skipping invalid folder name: {item}")
		print(f"Found staff: {staff_details}")
		return staff_details

	def get_remaining_names(self,dictionaries,unique_names):
		self.dictionaries = dictionaries
		self.unique_names = unique_names
		remaining_names = np.setdiff1d(list(dictionaries.keys()),unique_names).tolist()
		return remaining_names

	def get_all_face_pixels(self,dictionaries):
		image_ids = []
		image_paths = []
		image_arrays = []
		names = []
		face_ids = []
		print("Starting to load face pixels...")
		for category in list(dictionaries.keys()):
			folder_name = category + "_" + dictionaries[category]
			path = os.path.join(self.dataset_dir, folder_name)
			print(f"Processing folder: {folder_name}")
			
			if not os.path.exists(path):
				print(f"Folder not found: {path}")
				continue
				
			for img in os.listdir(path):
				img_path = os.path.join(path,img)
				try:
					img_array = cv2.imread(img_path)
					if img_array is None:
						print(f"Failed to load image: {img_path}")
						continue
					
					# Resize to 160x160 for FaceNet
					img_array = cv2.resize(img_array, (160, 160))
					
					image_paths.append(img_path)
					image_ids.append(img)
					image_arrays.append(img_array)
					names.append(category)
					face_ids.append(dictionaries[category])
				except Exception as e:
					print(f"Error processing {img_path}: {e}")
					
		print(f"Loaded {len(image_arrays)} images.")
		return [image_ids,image_paths,image_arrays,names,face_ids]


	def get_remaining_face_pixels(self,dictionaries,remaining_names):
		self.dictionaries = dictionaries
		self.remaining_names = remaining_names
		image_ids = []
		image_paths = []
		image_arrays = []
		names = []
		face_ids = []
		
		print(f"Processing remaining names: {remaining_names}")
		if len(remaining_names) != 0:	
			for category in list(remaining_names):
				folder_name = category + "_" + dictionaries[category]
				path = os.path.join(self.dataset_dir, folder_name)
				print(f"Processing folder: {folder_name}")
				
				if not os.path.exists(path):
					continue
					
				for img in os.listdir(path):
					img_path = os.path.join(path,img)
					try:
						img_array = cv2.imread(img_path)
						if img_array is None:
							continue
						
						# Resize to 160x160
						img_array = cv2.resize(img_array, (160, 160))
						
						image_paths.append(img_path)
						image_ids.append(img)
						image_arrays.append(img_array)
						names.append(category)
						face_ids.append(dictionaries[category])
					except Exception as e:
						print(f"Error: {e}")
						
			return [image_ids,image_paths,image_arrays,names,face_ids]
		else:
			return None

	def normalize_pixels(self,imagearrays):
		self.imagearrays = imagearrays
		print("Normalizing pixels...")
		if self.imagearrays is None or (isinstance(self.imagearrays, list) and len(self.imagearrays) == 0):
			print("No images to normalize!")
			return np.array([])
			
		try:
			face_pixels = np.array(self.imagearrays)
			print(f"Face pixels shape: {face_pixels.shape}")
			face_pixels = face_pixels.astype('float32')
			mean, std = face_pixels.mean(), face_pixels.std()
			face_pixels = (face_pixels - mean) / std
			print("Normalization complete.")
			return face_pixels
		except Exception as e:
			print(f"Normalization failed: {e}")
			return np.array([])






				
