from ultralytics import YOLOWorld
import numpy as np
from PIL import Image


class ObjectDetector:
    def __init__(self, model_path: str):
        self.model = YOLOWorld(model_path)

    def predict(self, image: Image.Image, prompt: str):
        """
        Detects objects in the image based on the prompt using YOLO-World.

        Args:
            image: PIL Image object.
            prompt: Comma-separated list of object classes to detect.

        Returns:
            Dictionary with bounding box coordinates and confidence scores of the most confident object.
        """
        # Set classes based on the prompt
        if prompt:
            classes = [cls.strip() for cls in prompt.split(",")]
            self.model.set_classes(classes)

        # Run inference
        results = self.model.predict(image)

        detection = {}
        max_confidence = 0
        for result in results:
            boxes = result.boxes
            print(result.boxes)
            for box in boxes:
                # Get coordinates
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                confidence = box.conf[0].item()
                cls_id = int(box.cls[0].item())
                label = result.names[cls_id]

                if confidence > max_confidence:
                    detection = {
                        "box": [x1, y1, x2, y2],
                        "score": float(confidence),
                        "label": label,
                    }
                    max_confidence = confidence

        return detection
