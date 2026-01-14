from fastapi import FastAPI, UploadFile, File
import cv2
import numpy as np
import io
from PIL import Image
from ..utils.detector import ObjectDetector

app = FastAPI()
detector = ObjectDetector(model_path="models/yolov8s-world.pt")

@app.get("/")
async def root():
    return {"message": "Project CV API is running"}

@app.post("/detect")
async def detect_object(prompt: str, file: UploadFile = File(...)):
    # Read image
    contents = await file.read()
    image = Image.open(io.BytesIO(contents)).convert("RGB")
    frame = np.array(image)
    frame = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)

    detector.set_prompt(prompt)
    processed_frame = detector.process_frame(frame)
    
    # In a real app, we would return coordinates or a processed image
    # For now, let's just return a placeholder message
    return {"status": "success", "prompt": prompt, "message": "Object detection processed"}
