import cv2
import numpy as np
import torch
import os
import json
import faiss
from PIL import Image
from transformers import AutoImageProcessor, AutoModel
from sam2.build_sam import build_sam2
from sam2.sam2_image_predictor import SAM2ImagePredictor


class ObjectScanner:
    def __init__(self, device=None, db_folder="faiss_db"):
        self.device = (
            device if device else ("cuda" if torch.cuda.is_available() else "cpu")
        )
        self.db_folder = db_folder

        # 1. Initialize Models (SAM 2 + DINOv2)
        sam2_checkpoint = "models/sam2_t.pt"
        sam2_model = build_sam2(
            "configs/sam2/sam2_hiera_t.yaml",
            ckpt_path=sam2_checkpoint,
            device=self.device,
        )
        self.predictor = SAM2ImagePredictor(sam2_model)

        self.dino_processor = AutoImageProcessor.from_pretrained(
            "facebook/dinov2-small"
        )
        self.dino_model = AutoModel.from_pretrained("facebook/dinov2-small").to(
            self.device
        )

        # 2. Initialize or Load FAISS
        self.dimension = 384
        self.load_or_create_database()

    # Load existing FAISS database if it exists, otherwise create new one
    def load_or_create_database(self):
        """Load existing FAISS database if it exists, otherwise create new one"""
        index_path = os.path.join(self.db_folder, "index.faiss")
        map_path = os.path.join(self.db_folder, "map.json")

        if os.path.exists(index_path) and os.path.exists(map_path):
            # Load existing database
            self.index = faiss.read_index(index_path)
            with open(map_path, "r") as f:
                self.id_to_name = json.load(f)

            print(f"✓ Loaded existing database from {self.db_folder}")
            print(f"  - Total feature vectors: {self.index.ntotal}")

            summary = self.get_object_summary()
            print(f"  - Unique objects: {len(summary)}")

            # Show details for each object
            for obj, count in summary.items():
                print(f"    • '{obj}': {count} perspective{'s' if count != 1 else ''}")
        else:
            # Create new database
            self.index = faiss.IndexFlatL2(self.dimension)
            self.id_to_name = []
            print(f"✓ Created new empty database (will save to {self.db_folder})")

    def get_object_summary(self):
        """Returns a dictionary of unique objects and their perspective counts."""
        unique_objects = sorted(list(set(self.id_to_name)))
        return {obj: self.id_to_name.count(obj) for obj in unique_objects}

    # Function to save FAISS index and mapping in json
    def save_to_database(self):
        os.makedirs(self.db_folder, exist_ok=True)
        faiss.write_index(self.index, os.path.join(self.db_folder, "index.faiss"))
        with open(os.path.join(self.db_folder, "map.json"), "w") as f:
            json.dump(self.id_to_name, f, indent=4)

        print(f"✓ Database saved to {self.db_folder}")
        summary = self.get_object_summary()
        print(f"  - Total feature vectors: {self.index.ntotal}")
        print(f"  - Unique objects: {len(summary)}")
        for obj, count in summary.items():
            print(f"    • '{obj}': {count} perspective{'s' if count != 1 else ''}")

    def delete_object(self, label):
        """Removes all perspectives of an object from the database."""
        indices_to_keep = [i for i, name in enumerate(self.id_to_name) if name != label]

        if len(indices_to_keep) == len(self.id_to_name):
            print(f"⚠ Object '{label}' not found in database.")
            return False

        # Rebuild index to ensure consistency
        new_index = faiss.IndexFlatL2(self.dimension)
        if indices_to_keep:
            # Extract all vectors we want to keep
            vectors = []
            for i in indices_to_keep:
                vectors.append(self.index.reconstruct(i))
            vectors = np.array(vectors).astype("float32")
            new_index.add(vectors)

        self.index = new_index
        self.id_to_name = [self.id_to_name[i] for i in indices_to_keep]

        print(f"✓ Deleted all entries for object '{label}'")
        self.save_to_database()
        return True

    # Function to process frame, extract object and store features and object name in FAISS
    def process_and_store(self, frame, bbox, label):
        # Get Mask
        self.predictor.set_image(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        x, y, w, h = bbox

        # Use center point of bbox for SAM segmentation
        center_point = np.array([[x + w // 2, y + h // 2]])
        masks, _, _ = self.predictor.predict(
            point_coords=center_point, point_labels=np.array([1]), multimask_output=True
        )
        mask = masks[0].astype(bool)

        # Crop & White Background
        y_idx, x_idx = np.where(mask)
        if len(y_idx) == 0:
            return False
        obj_crop = frame[y_idx.min() : y_idx.max(), x_idx.min() : x_idx.max()].copy()
        mask_crop = mask[y_idx.min() : y_idx.max(), x_idx.min() : x_idx.max()]
        obj_crop[~mask_crop] = 255

        # Extract Vector
        inputs = self.dino_processor(
            images=Image.fromarray(cv2.cvtColor(obj_crop, cv2.COLOR_BGR2RGB)),
            return_tensors="pt",
        ).to(self.device)
        with torch.no_grad():
            outputs = self.dino_model(**inputs)
            feat = torch.nn.functional.normalize(
                outputs.last_hidden_state[:, 0, :], p=2, dim=-1
            )
            feat_np = feat.cpu().numpy().astype("float32")

        # STORE IN FAISS
        self.index.add(feat_np)
        self.id_to_name.append(label)
        return True

    def get_bounding_box_from_sam(
        self,
        frame,
        center_x,
        center_y,
        save_result=True,
        output_path="segmentation_result.png",
    ):
        """Use SAM to segment object at center point and derive bounding box.

        Args:
            frame: Input video frame (BGR)
            center_x: X coordinate of center point
            center_y: Y coordinate of center point
            save_result: Whether to save visualization (default: False)
            output_path: Path to save the result image (default: "segmentation_result.png")

        Returns:
            Tuple (x, y, w, h) or None if segmentation fails
        """
        self.predictor.set_image(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        pts = np.array([[center_x, center_y]])
        labels = np.array([1])
        masks, _, _ = self.predictor.predict(
            point_coords=pts, point_labels=labels, multimask_output=True
        )
        mask_bool = masks[0].astype(bool)

        # Derive bounding box from mask
        y_idx, x_idx = np.where(mask_bool)
        if len(y_idx) > 0 and len(x_idx) > 0:
            # Filter outliers: Keep only 90% of points closest to the centroid
            points = np.column_stack((x_idx, y_idx))
            centroid = points.mean(axis=0)
            distances = np.linalg.norm(points - centroid, axis=1)
            threshold = np.percentile(distances, 90)

            filtered_points = points[distances <= threshold]

            if len(filtered_points) > 0:
                x_min, y_min = filtered_points.min(axis=0)
                x_max, y_max = filtered_points.max(axis=0)
            else:
                x_min, x_max = x_idx.min(), x_idx.max()
                y_min, y_max = y_idx.min(), y_idx.max()

            bbox = [int(x_min), int(y_min), int(x_max - x_min), int(y_max - y_min)]

            # Save visualization if requested
            if save_result:
                display_frame = frame.copy()

                # Overlay the mask with semi-transparent green
                overlay = display_frame.copy()
                overlay[mask_bool] = [0, 255, 0]  # Green color (BGR)
                display_frame = cv2.addWeighted(display_frame, 0.7, overlay, 0.3, 0)

                # Draw bounding box
                cv2.rectangle(
                    display_frame, (x_min, y_min), (x_max, y_max), (0, 255, 0), 2
                )

                # Draw center point
                cv2.circle(display_frame, (center_x, center_y), 5, (255, 0, 0), -1)

                # Save the result
                cv2.imwrite(output_path, display_frame)
                print(f"✓ Segmentation result saved to {output_path}")

            return bbox

        return None

    # Function to run the scanning process
    def run_scanning(self):
        name = input("Enter object name to record: ")
        cap = cv2.VideoCapture(0)

        # Two-stage workflow variables
        tracker = None
        tracker_initialized = False

        window_name = "Recorder Mode"
        cv2.namedWindow(window_name)

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            display = frame.copy()
            h, w, _ = frame.shape
            key = cv2.waitKey(1) & 0xFF

            # STAGE 1: Not tracking - show red center point for object selection
            if not tracker_initialized:
                center_x, center_y = w // 2, h // 2

                # Draw red center point (instead of rectangle)
                cv2.circle(display, (center_x, center_y), 5, (0, 0, 255), -1)
                cv2.putText(
                    display,
                    "Center object on red dot, press SPACE to start tracking",
                    (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7,
                    (255, 255, 255),
                    2,
                )

                # Initialize tracker with SAM segmentation on first SPACE press
                if key == 32:  # SPACE
                    print("Initializing tracker with SAM segmentation...")
                    bbox = self.get_bounding_box_from_sam(frame, center_x, center_y)
                    if bbox:
                        # Initialize tracker with SAM-derived bbox
                        tracker = cv2.TrackerCSRT_create()
                        tracker.init(frame, bbox)
                        tracker_initialized = True
                        print(
                            "Tracker initialized! Press SPACE to capture views, ESC to exit."
                        )
                    else:
                        print("Could not detect object at center point. Try again.")

            # STAGE 2: Tracking - update tracker and allow captures
            else:
                success, bbox = tracker.update(frame)

                if success:
                    x, y, w_box, h_box = [int(v) for v in bbox]
                    cv2.rectangle(
                        display, (x, y), (x + w_box, y + h_box), (0, 255, 0), 2
                    )
                    cv2.putText(
                        display,
                        f"Tracking {name} - SPACE to capture, ESC to finish",
                        (10, 30),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.7,
                        (0, 255, 0),
                        2,
                    )

                    # Capture on SPACE press
                    if key == 32:  # SPACE to add to FAISS
                        display[:, :, :] = 255  # Flash effect
                        if self.process_and_store(frame, (x, y, w_box, h_box), name):
                            print(f"Added {name} perspective #{len(self.id_to_name)}")
                else:
                    # Tracker lost object - reset to stage 1
                    tracker_initialized = False
                    tracker = None
                    print("Tracker lost object. Press SPACE to reinitialize.")

            cv2.imshow(window_name, display)

            if key == 27:  # ESC
                break

        cap.release()
        cv2.destroyAllWindows()
        self.save_to_database()


if __name__ == "__main__":
    scanner = ObjectScanner()
    scanner.run_scanning()
