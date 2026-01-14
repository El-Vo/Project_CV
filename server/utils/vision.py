import cv2
import numpy as np
from typing import Tuple, Optional

def classify_distance(box: np.ndarray, frame_shape: Tuple[int, int, int]) -> str:
    h, w = frame_shape[:2]
    area = (box[2] - box[0]) * (box[3] - box[1])
    ratio = area / float(h * w)
    if ratio > 0.12:
        return "near"
    if ratio > 0.05:
        return "medium"
    return "far"

def classify_direction(box: np.ndarray, frame_shape: Tuple[int, int, int]) -> str:
    h, w = frame_shape[:2]
    cx = (box[0] + box[2]) / 2.0
    if cx < w * 0.4:
        return "left"
    if cx > w * 0.6:
        return "right"
    return "center"

def annotate(frame: np.ndarray, box: np.ndarray, label: str, score: float) -> None:
    x1, y1, x2, y2 = map(int, box)
    cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
    text = f"{label} {score:.2f}"
    cv2.putText(frame, text, (x1, max(y1 - 8, 12)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

def resize_keep_aspect(frame: np.ndarray, target_width: int) -> np.ndarray:
    h, w = frame.shape[:2]
    if w <= target_width:
        return frame
    scale = target_width / float(w)
    new_size = (target_width, int(h * scale))
    return cv2.resize(frame, new_size, interpolation=cv2.INTER_AREA)

def pick_top_box(boxes: np.ndarray, scores: np.ndarray) -> Optional[int]:
    if boxes is None or len(boxes) == 0:
        return None
    return int(np.argmax(scores))
