import argparse
import sys
from pathlib import Path
import cv2
from typing import Tuple

# Add the project root to sys.path to allow importing from server
project_root = Path(__file__).resolve().parent.parent
sys.path.append(str(project_root))

from server.utils.detector import ObjectDetector

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Open-vocab object finder MVP")
    parser.add_argument(
        "--prompt",
        required=True,
        help="Object text prompt, e.g. 'red candle' or 'wine bottle'",
    )
    parser.add_argument(
        "--source",
        default="0",
        help="0 for webcam, or path to an image/video file",
    )
    parser.add_argument(
        "--model-path",
        default="models/yolov8s-world.pt",
        help="Path to the YOLO-World checkpoint",
    )
    parser.add_argument(
        "--conf",
        type=float,
        default=0.25,
        help="Confidence threshold",
    )
    parser.add_argument(
        "--max-det",
        type=int,
        default=5,
        help="Max detections per frame",
    )
    parser.add_argument(
        "--display-width",
        type=int,
        default=960,
        help="Resize display width for speed",
    )
    return parser.parse_args()

def to_source_handle(source: str) -> Tuple[cv2.VideoCapture, bool]:
    source_path = Path(source)
    if source_path.exists():
        is_live = source_path.suffix.lower() in {"", ".mp4", ".mov", ".avi", ".mkv"}
        return cv2.VideoCapture(str(source_path)), is_live
    try:
        cam_index = int(source)
        return cv2.VideoCapture(cam_index), True
    except ValueError:
        return cv2.VideoCapture(source), True

def main():
    args = parse_args()
    
    if not Path(args.model_path).exists():
        print(f"Model file not found at {args.model_path}.")
        sys.exit(1)

    detector = ObjectDetector(model_path=args.model_path)
    detector.set_prompt(args.prompt)
    
    source_path = Path(args.source)
    if source_path.exists() and source_path.suffix.lower() in {".jpg", ".jpeg", ".png", ".bmp"}:
        frame = cv2.imread(str(source_path))
        if frame is not None:
            processed = detector.process_frame(frame, conf=args.conf, max_det=args.max_det, display_width=args.display_width)
            cv2.imshow("MVP", processed)
            cv2.waitKey(0)
            cv2.destroyAllWindows()
    else:
        cap, _ = to_source_handle(args.source)
        if not cap.isOpened():
            print("Could not open video source.")
            return
        try:
            while True:
                ok, frame = cap.read()
                if not ok:
                    break
                processed = detector.process_frame(frame, conf=args.conf, max_det=args.max_det, display_width=args.display_width)
                cv2.imshow("MVP", processed)
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break
        finally:
            cap.release()
            cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
