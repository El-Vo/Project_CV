from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import cv2
import numpy as np
import io
from PIL import Image
from ..utils.detector import ObjectDetector
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

detector = ObjectDetector(model_path='models/yolov8s-world.pt')

base_path = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
client_path = os.path.join(base_path, 'client')

@app.post('/detect')
async def detect_object(prompt: str = Form(...), file: UploadFile = File(...)):
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert('RGB')
        frame = np.array(image)
        frame = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)

        detector.set_prompt(prompt)
        results = detector.model.predict(frame, conf=0.25, max_det=5, verbose=False)[0]
        
        detections = []
        from ..utils.vision import pick_top_box, classify_distance, classify_direction
        
        boxes = results.boxes.xyxy.cpu().numpy() if results.boxes is not None else None
        scores = results.boxes.conf.cpu().numpy() if results.boxes is not None else None
        cls_ids = results.boxes.cls.cpu().numpy() if results.boxes is not None else None
        names = results.names

        idx = pick_top_box(boxes, scores) if boxes is not None else None
        
        guidance = ''
        if idx is not None:
            box = boxes[idx]
            score = float(scores[idx])
            cls_id = int(cls_ids[idx]) if cls_ids is not None else -1
            
            if isinstance(names, dict):
                label = names.get(cls_id, prompt)
            elif isinstance(names, list) and cls_id < len(names):
                label = names[cls_id]
            else:
                label = prompt
            
            dist = classify_distance(box, frame.shape)
            direction = classify_direction(box, frame.shape)
            guidance = f'{direction}, {dist}'
            
            detections.append({
                'label': label,
                'confidence': score,
                'box': box.tolist(),
                'guidance': guidance
            })

        return {
            'status': 'success',
            'prompt': prompt,
            'detections': detections,
            'guidance': guidance
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {'status': 'error', 'message': str(e)}

app.mount('/client', StaticFiles(directory=client_path), name='client')

@app.get('/')
async def serve_home():
    index_path = os.path.join(client_path, 'public', 'index.html')
    if index_path and os.path.exists(index_path):
        return FileResponse(index_path)
    return {'error': 'Index file not found'}
