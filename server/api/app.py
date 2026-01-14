from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import cv2
import numpy as np
import io
import base64
from PIL import Image
from ..utils.detector import ObjectDetector
import os

app = FastAPI()

# Enable CORS for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

detector = ObjectDetector(model_path="models/yolov8s-world.pt")

# Serve static files from the client directory
# Note: In a production app, you'd use a better structure
base_path = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
client_path = os.path.join(base_path, "client")

@app.post("/detect")
async def detect_object(prompt: str = Form(...), file: UploadFile = File(...)):
    # Read image
    contents = await file.read()
    image = Image.open(io.BytesIO(contents)).convert("RGB")
    frame = np.array(image)
    frame = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)

    detector.set_prompt(prompt)
    
    # Custom detection logic to return both image and data
    results = detector.model.predict(frame, conf=0.25, max_det=5, verbose=False)[0]
    
    detections = []
    processed_frame = frame.copy()
    
    from ..utils.vision import pick_top_box, annotate, classify_distance, classify_direction
    
    boxes = results.boxes.xyxy.cpu().numpy() if results.boxes is not None else None
    scores = results.boxes.conf.cpu().numpy() if results.boxes is not None else None
    cls_ids = results.boxes.cls.cpu().numpy() if results.boxes is not None else None
    names = results.names if results.names else {}

    idx = pick_top_box(boxes, scores) if boxes is not None else None
    
    guidance = ""
    if idx is not None:
        box = boxes[idx]
        score = float(scores[idx])
        cls_id = int(cls_ids[idx]) if cls_ids is not None else -1
        label = names.get(cls_id, detector.current_prompt)
        
        # Annotate
        annotate(processed_frame, box, label, score)
        
        dist = classify_distance(box, processed_frame.shape)
        direction = classify_direction(box, processed_frame.shape)
        guidance = f"{direction}, {dist}"
        cv2.putText(processed_frame, f"Guidance: {guidance}", (12, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (50, 200, 255), 2)
        
        detections.append({
            "label": label,
            "confidence": score,
            "box": box.tolist(),
            "guidance": guidance
        })
    else:
        cv2.putText(processed_frame, "No detection", (12, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)

    # Encode processed image to base64
    _, buffer = cv2.imencode('.jpg', processed_frame)
    img_base64 = base64.b64encode(buffer).decode('utf-8')

    return {
        "status": "success",
        "prompt": prompt,
        "detections": detections,
        "image": f"data:image/jpeg;base64,{img_base64}",
        "guidance": guidance
    }

# Serve the client folder
app.mount("/client", StaticFiles(directory=client_path), name="client")

@app.get("/")
async def serve_home():
    return FileResponse(os.path.join(client_path, "public", "index.html"))
    # Read image
    contents = await file.read()
    image = Image.open(io.BytesIO(contents)).convert("RGB")
    frame = np.array(image)
    frame = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)

    detector.set_prompt(prompt)
    
    # Custom detection logic to return both image and data
    # We use detector.predict to get results, then process manually to extract data
    results = detector.model.predict(frame, conf=0.25, max_det=5, verbose=False)[0]
    
    detections = []
    processed_frame = frame.copy()
    
    from ..utils.vision import pick_top_box, annotate, classify_distance, classify_direction
    
    boxes = results.boxes.xyxy.cpu().numpy() if results.boxes is not None else None
    scores = results.boxes.conf.cpu().numpy() if results.boxes is not None else None
    cls_ids = results.boxes.cls.cpu().numpy() if results.boxes is not None else None
    names = results.names if results.names else {}

    idx = pick_top_box(boxes, scores) if boxes is not None else None
    
    guidance = ""
    if idx is not None:
        box = boxes[idx]
        score = float(scores[idx])
        cls_id = int(cls_ids[idx]) if cls_ids is not None else -1
        label = names.get(cls_id, detector.current_prompt)
        
        # Annotate
        annotate(processed_frame, box, label, score)
        
        dist = classify_distance(box, processed_frame.shape)
        direction = classify_direction(box, processed_frame.shape)
        guidance = f"{direction}, {dist}"
        cv2.putText(processed_frame, f"Guidance: {guidance}", (12, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (50, 200, 255), 2)
        
        detections.append({
            "label": label,
            "confidence": score,
            "box": box.tolist(),
            "guidance": guidance
        })
    else:
        cv2.putText(processed_frame, "No detection", (12, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)

    # Encode processed image to base64
    _, buffer = cv2.imencode('.jpg', processed_frame)
    img_base64 = base64.b64encode(buffer).decode('utf-8')

    return {
        "status": "success",
        "prompt": prompt,
        "detections": detections,
        "image": f"data:image/jpeg;base64,{img_base64}",
        "guidance": guidance
    }
