from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
import io
from PIL import Image
from .detector import ObjectDetector

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

detector = ObjectDetector(model_path='models/yolov8s-world.pt')

@app.post('/detect')
async def detect_object(prompt: str = Form(...), file: UploadFile = File(...)):
    contents = await file.read()
    image = Image.open(io.BytesIO(contents))
    detection = detector.predict(image, prompt)
    return {"detection": detection}
