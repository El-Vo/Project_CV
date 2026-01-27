from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
import cv2
import numpy as np
import io
from PIL import Image
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

@app.post('/detect')
async def detect_object(prompt: str = Form(...), file: UploadFile = File(...)):
    