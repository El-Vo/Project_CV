import os

os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
import io
import json
import numpy as np
import cv2
from PIL import Image
from .detector import ObjectDetector
from .detector_personalized import ObjectRecognizer
from .scanner import ObjectScanner

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

generic_detector = ObjectDetector(model_path="models/yolov8s-world.pt")
personalized_detector = ObjectRecognizer()
object_scanner = ObjectScanner()


@app.post("/detect")
async def detect_generic_object(prompt: str = Form(...), file: UploadFile = File(...)):
    contents = await file.read()
    image = Image.open(io.BytesIO(contents))
    detection = generic_detector.predict(image, prompt)
    return {"detection": detection}


@app.post("/detect_personalized")
async def detect_personalized_object(file: UploadFile = File(...)):
    contents = await file.read()
    image_pil = Image.open(io.BytesIO(contents))

    # Convert PIL (RGB) to OpenCV (BGR)
    image_np = np.array(image_pil)
    image_bgr = cv2.cvtColor(image_np, cv2.COLOR_RGB2BGR)

    detection = personalized_detector.run_identification_cycle(image_bgr)
    return {"detection": detection}


@app.post("/get_bounding_box_from_coord")
async def get_bounding_box(
    x: int = Form(...), y: int = Form(...), file: UploadFile = File(...)
):
    contents = await file.read()
    image_pil = Image.open(io.BytesIO(contents))
    image_np = np.array(image_pil)
    image_bgr = cv2.cvtColor(image_np, cv2.COLOR_RGB2BGR)

    bounding_box = object_scanner.get_bounding_box_from_sam(image_bgr, x, y)
    return {"bounding_box": bounding_box}


@app.post("/save_to_faiss")
async def save_to_faiss(
    bbox: str = Form(...), label: str = Form(...), file: UploadFile = File(...)
):
    contents = await file.read()
    image_pil = Image.open(io.BytesIO(contents))
    image_np = np.array(image_pil)
    image_bgr = cv2.cvtColor(image_np, cv2.COLOR_RGB2BGR)

    # Convert bbox string to list [x, y, w, h]
    try:
        bbox_list = json.loads(bbox)
    except:
        bbox_list = [int(v) for v in bbox.split(",")]

    success = object_scanner.process_and_store(image_bgr, bbox_list, label)
    if success:
        object_scanner.save_to_database()

    return {"success": success}
