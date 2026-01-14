from pathlib import Path
from ultralytics import YOLOWorld
import numpy as np
from .vision import pick_top_box, annotate, classify_distance, classify_direction, resize_keep_aspect
import cv2

class ObjectDetector:
    def __init__(self, model_path: str = "models/yolov8s-world.pt"):
        self.model_path = model_path
        self.model = YOLOWorld(model_path)
        self.current_prompt = None

    def set_prompt(self, prompt: str):
        if prompt != self.current_prompt:
            self.model.set_classes([prompt])
            self.current_prompt = prompt

    def predict(self, frame: np.ndarray, conf: float = 0.25, max_det: int = 5):
        results = self.model.predict(frame, conf=conf, max_det=max_det, verbose=False)
        return results[0]

    def process_frame(self, frame: np.ndarray, conf: float = 0.25, max_det: int = 5, display_width: int = 960):
        frame = resize_keep_aspect(frame, target_width=display_width)
        result = self.predict(frame, conf=conf, max_det=max_det)

        boxes = result.boxes.xyxy.cpu().numpy() if result.boxes is not None else None
        scores = result.boxes.conf.cpu().numpy() if result.boxes is not None else None
        names = result.names if result.names else {}
        cls_ids = result.boxes.cls.cpu().numpy() if result.boxes is not None else None

        idx = pick_top_box(boxes, scores) if boxes is not None else None
        if idx is not None:
            box = boxes[idx]
            score = float(scores[idx])
            cls_id = int(cls_ids[idx]) if cls_ids is not None else -1
            label = names.get(cls_id, self.current_prompt)
            annotate(frame, box, label, score)
            
            dist = classify_distance(box, frame.shape)
            direction = classify_direction(box, frame.shape)
            guidance = f"Guidance: {direction}, {dist}"
            cv2.putText(frame, guidance, (12, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (50, 200, 255), 2)
        else:
            cv2.putText(frame, "No detection", (12, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)

        return frame
