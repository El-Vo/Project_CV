import cv2
import numpy as np
import torch
import torch.nn.functional as F
import time
import json
import faiss
import os
from transformers import AutoImageProcessor, AutoModel
from PIL import Image
from ultralytics import FastSAM


# Initialize the Object Recognizer with FAISS database
class ObjectRecognizer:
    def __init__(self, db_folder="faiss_db", device=None):

        self.device = (
            device if device else ("cuda" if torch.cuda.is_available() else "cpu")
        )
        self.db_folder = db_folder

        print(f"Using device: {self.device}")

        # Initialize models
        print("Loading FastSAM model...")
        self.fastsam = FastSAM("FastSAM-s.pt")
        self.processor = AutoImageProcessor.from_pretrained("facebook/dinov2-small")
        self.dino_model = AutoModel.from_pretrained("facebook/dinov2-small").to(
            self.device
        )
        self.dino_model.eval()
        print("✓ Models loaded successfully")
        # Load FAISS database
        self._load_database()

        """
        # Tracking variables
        self.tracker = None
        self.tracking_active = False
        self.tracked_box = None
        self.tracked_object_name = None
        """

        # Re-identification settings
        self.SIM_THRESHOLD = 0.6  # similarity threshold for confident ID: Object accepted if avg similarity > threshold
        self.REID_INTERVAL = 2.0  # seconds between re-ID attempts
        self.last_reid_time = 0

    # Load FAISS database and object mappings: do in jscript?
    def _load_database(self):
        index_path = os.path.join(self.db_folder, "index.faiss")
        map_path = os.path.join(self.db_folder, "map.json")

        # Error handling if database does not exist, eventually do in jscript
        if not os.path.exists(index_path) or not os.path.exists(map_path):
            raise FileNotFoundError(
                f"FAISS database not found in {self.db_folder}. "
                "Please run ObjectScanner first to create the database."
            )

        # Load FAISS index
        self.index = faiss.read_index(index_path)

        # Load object name mappings
        with open(map_path, "r") as f:
            self.id_to_name = json.load(f)

        print(f"✓ Loaded database from {self.db_folder}")
        print(f"  - Total feature vectors: {self.index.ntotal}")
        unique_objects = set(self.id_to_name)
        print(f"  - Unique objects: {len(unique_objects)}")
        for obj in unique_objects:
            count = self.id_to_name.count(obj)
            print(f"    • '{obj}': {count} perspective{'s' if count != 1 else ''}")

    # Extract DINOv2 features from a cropped image
    def extract_dino_features(self, crop_image):
        # Convert BGR to RGB
        img_rgb = cv2.cvtColor(crop_image, cv2.COLOR_BGR2RGB)
        img_pil = Image.fromarray(img_rgb)

        # Process with DINOv2
        inputs = self.processor(images=img_pil, return_tensors="pt").to(self.device)
        with torch.no_grad():
            outputs = self.dino_model(**inputs)

        # Extract and normalize features
        feat = outputs.last_hidden_state[:, 0, :]
        feat = F.normalize(feat, dim=1)

        return feat.cpu().numpy().astype("float32")

    # Given a mask, extract object and identify using FAISS, return best match, avg score, bbox
    def identify_object(self, frame, mask):
        # Get bounding box from mask
        ys, xs = np.where(mask)
        if len(xs) == 0 or len(ys) == 0:
            return None

        x1, x2 = xs.min(), xs.max()
        y1, y2 = ys.min(), ys.max()
        w, h = x2 - x1, y2 - y1

        # Filter out small objects
        if w < 30 or h < 30:
            return None

        # Isolate object with white background
        mask_3d = np.repeat(mask[:, :, None], 3, axis=2)
        white_bg = np.ones_like(frame) * 255
        isolated = np.where(mask_3d, frame, white_bg).astype(np.uint8)
        crop = isolated[y1:y2, x1:x2]

        if crop.size == 0:
            return None

        # Extract features
        candidate_feat = self.extract_dino_features(crop)

        # Search FAISS for the closest neighbor
        distances, indices = self.index.search(candidate_feat, 1)

        # FAISS returns arrays, get the first values
        dist = distances[0][0]
        idx = indices[0][0]

        # Convert L2 distance to Similarity (0 to 1 scale)
        # L2 distance is the straight-line distance between vectors
        similarity = 1.0 / (1.0 + dist)

        # Return nothing if below threshold
        if similarity < self.SIM_THRESHOLD:
            return None

        # Return the match
        obj_name = self.id_to_name[idx]
        return {"label": obj_name, "score": similarity, "box": (x1, y1, w, h)}

    # Run FastSAM + FAISS identification on current frame, this cycle needs to be called periodically
    def run_identification_cycle(self, frame):
        print("\nRunning FastSAM + FAISS identification...")
        total_start = time.time()  # delete later

        # Run FastSAM to segment all objects in the frame
        t_fastsam = time.time()  # delete later
        results = self.fastsam(
            frame, device=self.device, imgsz=640, conf=0.4, iou=0.9, retina_masks=True
        )
        print(f"  FastSAM time: {time.time() - t_fastsam:.3f}s")  # delete later

        masks_obj = results[0].masks
        if masks_obj is None:
            print("  No masks found")
            return None

        masks_tensor = masks_obj.data
        print(f"  FastSAM masks found: {masks_tensor.shape[0]}")

        best_match = None  # closeest match across all masks
        best_score = 0  # highest score across all masks

        # Check each mask against the database
        for i in range(masks_tensor.shape[0]):
            mask = masks_tensor[i].detach().cpu().numpy().astype(bool)

            # Calls identify_object to check this mask
            result = self.identify_object(frame, mask)

            # Update the best match if the result is bigger than threshold and more confident than previous best
            if result and result["score"] > best_score:
                best_score = result["score"]
                best_match = result

        print(
            f"  Total identification time: {time.time() - total_start:.3f}s"
        )  # delete later

        # Final output check
        if best_match:  # if we found a match with sufficient score
            print(
                f"  Best match: '{best_match['label']}' (score={best_match['score']:.3f})"
            )
        else:  # otherwise no match found, run id cycle again later
            print(f"  No confident match found")

        return best_match

    # Webcam loop for recognition
    """
    def run_recognition(self):
        cap = cv2.VideoCapture(0)
        window_name = "Object Recognition"
        cv2.namedWindow(window_name)
        
        print("\n" + "="*60)
        print("OBJECT RECOGNITION MODE")
        print("="*60)
        print("The system will automatically identify and track objects")
        print("Press ESC to exit")
        print("="*60 + "\n")
        
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            
            current_time = time.time()
            display = frame.copy()
            
            # ===== TRACKING ACTIVE =====
            if self.tracking_active:
                success, self.tracked_box = self.tracker.update(frame)
                
                if success:
                    x, y, w, h = map(int, self.tracked_box)
                    cv2.rectangle(display, (x, y), (x + w, y + h), (0, 255, 0), 3)
                    
                    # Display object name
                    label = f"TRACKING: {self.tracked_object_name}"
                    cv2.putText(display, label, (x, y - 10),
                               cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
                else:
                    print("Tracking lost")
                    self.tracking_active = False
                    self.tracked_object_name = None
            
            # ===== RE-IDENTIFICATION =====
            if not self.tracking_active and (current_time - self.last_reid_time > self.REID_INTERVAL):
                self.last_reid_time = current_time
                
                # Run identification
                best_match = self.run_identification_cycle(frame)
                
                # Initialize tracker if confident match
                if best_match and best_match['score'] > self.SIM_THRESHOLD:
                    print(f"✓ TARGET IDENTIFIED: '{best_match['name']}'")
                    
                    self.tracker = cv2.legacy.TrackerCSRT_create()
                    self.tracker.init(frame, best_match['bbox'])
                    self.tracked_box = best_match['bbox']
                    self.tracking_active = True
                    self.tracked_object_name = best_match['name']
                else:
                    score = best_match['score'] if best_match else 0
                    print(f"✗ No confident match (threshold={self.SIM_THRESHOLD}, score={score:.3f})")
            
            # Display status
            if not self.tracking_active:
                cv2.putText(display, "SEARCHING...", (10, 30),
                           cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 0, 255), 2)
            
            cv2.imshow(window_name, display)
            
            key = cv2.waitKey(10) & 0xFF
            if key == 27:  # ESC
                break
        
        cap.release()
        cv2.destroyAllWindows()
        print("\nRecognition stopped")
        """


if __name__ == "__main__":
    recognizer = ObjectRecognizer(db_folder="faiss_db")
    # recognizer.run_recognition()
