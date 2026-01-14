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
        
        guidance = ''
        if results.boxes is not None and len(results.boxes) > 0:
            boxes = results.boxes.xyxy.cpu().numpy()
            scores = results.boxes.conf.cpu().numpy()
            cls_ids = results.boxes.cls.cpu().numpy()
            names = results.names

            # Process all detections
            for i in range(len(boxes)):
                box = boxes[i].tolist()  # Converts to list of Python floats
                score = float(scores[i])
                cls_id = int(cls_ids[i])
                
                label = names.get(cls_id, prompt) if isinstance(names, dict) else prompt
                
                detections.append({
                    'label': str(label),
                    'confidence': score,
                    'box': [float(x) for x in box],  # Extra safety
                    'guidance': ''
                })

            # Top box guidance
            idx = pick_top_box(boxes, scores)
            if idx is not None:
                dist = classify_distance(boxes[idx], frame.shape)
                direction = classify_direction(boxes[idx], frame.shape)
                guidance = f'{direction}, {dist}'
                detections[idx]['guidance'] = guidance

        return {
            'status': 'success',
            'prompt': str(prompt),
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

@app.get('/ar.html')
async def serve_ar():
    ar_path = os.path.join(client_path, 'public', 'ar.html')
    if ar_path and os.path.exists(ar_path):
        return FileResponse(ar_path)
    return {'error': 'AR file not found'}
