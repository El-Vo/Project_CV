# Server Component - Documentation

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Modules and Components](#modules-and-components)
4. [API Endpoints](#api-endpoints)
5. [Installation and Setup](#installation-and-setup)
6. [Usage](#usage)
7. [Technical Details](#technical-details)
8. [Development and Extension](#development-and-extension)

---

## Overview

The server component is the heart of object detection and management in this computer vision project. It provides a FastAPI-based REST API that orchestrates various object detection and segmentation models and makes them accessible via HTTP endpoints.

### Key Features

- **Generic Object Detection**: Detection of any objects based on textual prompts (YOLO-World)
- **Personalized Object Detection**: Detection of user-specifically trained objects using a FAISS vector database
- **Object Segmentation**: Precise segmentation of objects from coordinates (SAM2)
- **Object Management**: Saving, retrieving, and deleting personalized objects

### Project Context

This server component is typically consumed by a frontend application (e.g., React/Next.js) that sends images for processing and receives detection results. The architecture allows for a clear separation between UI logic and computer vision processing.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   FastAPI Server                    │
│                     (api.py)                        │
└──────────────┬──────────────┬──────────────┬────────┘
               │              │              │
    ┌──────────▼─────┐ ┌────▼────┐ ┌────────▼─────────┐
    │ ObjectDetector │ │ Scanner │ │ObjectRecognizer  │
    │  (detector.py) │ │         │ │(detector_pers..) │
    └────────┬───────┘ │         │ └────────┬─────────┘
             │         │         │          │
    ┌────────▼─────────▼─────────▼──────────▼─────────┐
    │          Models & Databases                      │
    │  - YOLO-World (yolov8s-world.pt)                │
    │  - SAM2 (sam2_t.pt)                             │
    │  - FastSAM (FastSAM-s.pt)                       │
    │  - DINOv2 (facebook/dinov2-small)               │
    │  - FAISS Vector Database                        │
    └─────────────────────────────────────────────────┘
```

### Data Flow

1. **Client** sends an HTTP request with an image and parameters
2. **API Layer** (api.py) receives the request and routes it to the appropriate component
3. **Detector/Scanner/Recognizer** processes the image with the corresponding ML model
4. **Response** is sent back as JSON

---

## Modules and Components

### 1. `api.py` - FastAPI Server

**Purpose**: Main entry point of the application, defines all HTTP endpoints, and orchestrates the various detector components.

**Main Components**:

- FastAPI app instance with CORS middleware
- Three singleton instances of the detector classes
- REST endpoints for all supported operations

**Special Features**:

- CORS is enabled for all origins (`allow_origins=["*"]`) - ideal for development
- Environment variable `KMP_DUPLICATE_LIB_OK` is set for PyTorch compatibility

---

### 2. `detector.py` - Generic Object Detection

**Purpose**: Zero-shot object detection based on textual descriptions.

**Technology**: YOLO-World (ultralytics)

**Core Functionality**:

```python
class ObjectDetector:
    def predict(self, image: Image.Image, prompt: str) -> dict
```

**How it works**:

1. Takes an image and a prompt (e.g., "cat, dog, person")
2. Dynamically sets YOLO-World classes based on the prompt
3. Performs inference
4. Returns the most confident object with a bounding box

**Return Format**:

```json
{
  "box": [x1, y1, x2, y2],
  "score": 0.95,
  "label": "cat"
}
```

**Use Case**: Ideal for ad-hoc searches for any objects without prior training.

---

### 3. `scanner.py` - Object Segmentation and Storage

**Purpose**: High-precision object segmentation, feature extraction, and storage in a FAISS database.

**Technologies**:

- **SAM2** (Segment Anything Model 2): State-of-the-art segmentation
- **DINOv2**: Self-supervised Vision Transformer for feature extraction
- **FAISS**: Facebook AI Similarity Search for efficient vector search

**Core Functionality**:

#### 3.1 Segmentation from Coordinates

```python
def get_bounding_box_from_sam(self, frame, center_x, center_y) -> list
```

- User clicks on an object (x, y coordinates)
- SAM2 segments the object at this position
- Return: Bounding box `[x, y, width, height]`
- Optional: Saves visualization with mask and box

**Outlier Filtering**: Uses only 90% of the points near the centroid to reduce noise.

#### 3.2 Feature extraction and Storage

```python
def process_and_store(self, frame, bbox, label) -> bool
```

1. Segments object in bounding box with SAM2
2. Isolates object on a white background
3. Extracts 384-dimensional feature vector with DINOv2
4. Saves in FAISS index with label mapping

#### 3.3 Database Management

```python
def save_to_database(self)
def load_or_create_database(self)
def delete_object(self, label) -> bool
```

**Database Structure**:

```
faiss_db/
├── index.faiss      # FAISS L2 index with feature vectors
└── map.json         # Array: [label1, label2, ...] (Index = FAISS ID)
```

**Important**: An object can have multiple feature vectors (different perspectives).

#### 3.4 Interactive Scanning (Command-line)

```python
def run_scanning(self)
```

Two-phase workflow for webcam-based scanning:

1. **Phase 1**: User centers the object on the red dot → press SPACE
2. **Phase 2**: CSRT tracker follows the object → press SPACE to save different perspectives

---

### 4. `detector_personalized.py` - Personalized Object Detection

**Purpose**: Detection of user-specifically saved objects in images.

**Technologies**:

- **FastSAM**: Fast segmentation of all objects in the image
- **DINOv2**: Feature extraction for comparison
- **FAISS**: Similarity search in the saved database

**Core Functionality**:

#### 4.1 Identification Cycle

```python
def run_identification_cycle(self, frame, target_label) -> dict
```

**Workflow**:

1. FastSAM segments **all** objects in the frame (→ list of masks)
2. For each mask:
   - Extract object with white background
   - Calculate DINOv2 feature vector
   - Search FAISS for top 10 most similar objects
   - Check if `target_label` is among them
3. Return the best match above the threshold

**Return Format**:

```json
{
  "label": "my_cup",
  "score": 0.87,
  "box": [100, 150, 200, 180]
}
```

#### 4.2 Similarity Calculation

```python
similarity = 1.0 / (1.0 + l2_distance)
```

- L2 distance is converted to a similarity score
- Threshold: `SIM_THRESHOLD = 0.6` (configurable)

**Tuning Parameters**:

- `SIM_THRESHOLD`: How certain must a detection be? (higher = stricter)
- `REID_INTERVAL`: Time between re-identification attempts

---

## API Endpoints

### `POST /detect`

Generic object detection with YOLO-World.

**Request**:

- `prompt` (Form): Comma-separated list of object classes (e.g., "cat, dog")
- `file` (File): Image (JPEG, PNG)

**Response**:

```json
{
  "detection": {
    "box": [x1, y1, x2, y2],
    "score": 0.95,
    "label": "cat"
  }
}
```

---

### `POST /detect_personalized`

Detection of personalized objects from FAISS database.

**Request**:

- `label` (Form): Name of the object to search for
- `file` (File): Image

**Response**:

```json
{
  "detection": {
    "label": "my_cup",
    "score": 0.87,
    "box": [x, y, w, h]
  }
}
```

**Note**: Returns `null` if no match is found above the threshold.

---

### `POST /get_bounding_box_from_coord`

Segments object at click coordinates and returns a bounding box.

**Request**:

- `x` (Form): X coordinate
- `y` (Form): Y coordinate
- `file` (File): Image

**Response**:

```json
{
  "bounding_box": [x1, y1, x2, y2]
}
```

**Usage**: User clicks on an object in the frontend → backend segments it → frontend displays the box

---

### `GET /get_personal_object_labels`

Returns a list of all saved objects with statistics.

**Response**:

```json
{
  "labels": ["cup", "book", "phone"],
  "summary": {
    "cup": 5,
    "book": 3,
    "phone": 7
  }
}
```

**Note**: Numbers represent the number of saved perspectives.

---

### `POST /save_to_faiss`

Saves an object to the FAISS database.

**Request**:

- `bbox` (Form): Bounding box as JSON string `"[x1,y1,x2,y2]"`
- `label` (Form): Name of the object
- `file` (File): Image

**Response**:

```json
{
  "success": true
}
```

**Side Effect**: Updates FAISS database and reloads it in the `personalized_detector`.

---

### `POST /delete_personal_object`

Deletes all perspectives of an object from the database.

**Request**:

- `label` (Form): Name of the object to be deleted

**Response**:

```json
{
  "success": true
}
```

---

## Installation and Setup

### Prerequisites

- Python 3.8+
- CUDA-capable GPU recommended (CPU works but is slower)
- ~4GB free storage for models

### Installation

1. **Install Dependencies**:

```bash
pip install -r requirements.txt
```

2. **Download Models**:

The following models are required:

```
models/
├── yolov8s-world.pt      # YOLO-World model
├── sam2_t.pt             # SAM2 Tiny checkpoint
└── FastSAM-s.pt          # FastSAM Small model

configs/
└── sam2/
    └── sam2_hiera_t.yaml # SAM2 configuration
```

**YOLO-World**: Automatically downloaded by ultralytics on first start
**SAM2**: Download from [SAM2 GitHub](https://github.com/facebookresearch/sam2)
**FastSAM**: Download from [FastSAM GitHub](https://github.com/CASIA-IVA-Lab/FastSAM)
**DINOv2**: Automatically downloaded from HuggingFace

3. **Initialize FAISS Database**:

An empty FAISS index is automatically created on first start:

```
faiss_db/
├── index.faiss    # Created on first save
└── map.json       # Created on first save
```

### Start Server

```bash
# Default (Port 8000)
uvicorn server.api:app

# With reload for development
uvicorn server.api:app --reload

# Custom port
uvicorn server.api:app --port 3001

# Accessible from outside
uvicorn server.api:app --host 0.0.0.0
```

Server then runs at: `http://localhost:8000`

Swagger documentation: `http://localhost:8000/docs`

---

## Usage

### Example 1: Generic Object Detection

```python
import requests
from PIL import Image

# Load image
with open("foto.jpg", "rb") as f:
    files = {"file": f}
    data = {"prompt": "cat, dog, person"}

    response = requests.post(
        "http://localhost:8000/detect",
        files=files,
        data=data
    )

result = response.json()
print(f"Found: {result['detection']['label']}")
print(f"Confidence: {result['detection']['score']}")
```

### Example 2: Segment and Save Object

```javascript
// Frontend (JavaScript/React)
async function saveObject(image, x, y, label) {
  // 1. Click coordinates → Bounding box
  const formData1 = new FormData();
  formData1.append("file", image);
  formData1.append("x", x);
  formData1.append("y", y);

  const bboxResponse = await fetch("/get_bounding_box_from_coord", {
    method: "POST",
    body: formData1,
  });
  const { bounding_box } = await bboxResponse.json();

  // 2. Save in FAISS
  const formData2 = new FormData();
  formData2.append("file", image);
  formData2.append("bbox", JSON.stringify(bounding_box));
  formData2.append("label", label);

  await fetch("/save_to_faiss", {
    method: "POST",
    body: formData2,
  });
}
```

### Example 3: Find Personalized Object

```python
# Search for a saved object
with open("scene.jpg", "rb") as f:
    files = {"file": f}
    data = {"label": "my_cup"}

    response = requests.post(
        "http://localhost:8000/detect_personalized",
        files=files,
        data=data
    )

result = response.json()
if result["detection"]:
    print(f"Found at: {result['detection']['box']}")
else:
    print("Not found")
```

---

## Technical Details

### Feature Extraction with DINOv2

DINOv2 is a self-supervised Vision Transformer model from Meta AI. It generates semantically rich, 384-dimensional feature vectors without specific training.

**Advantages**:

- Excellent generalization to unseen objects
- Robust to lighting and perspective
- No need for manual labeling

**Normalization**: All vectors are L2-normalized for consistent distance calculation.

### FAISS Index Type

The server uses `IndexFlatL2`:

- **Flat**: Exhaustive search (all vectors are compared)
- **L2**: Euclidean distance as metric

**Why not IndexIVF?**: For small databases (< 100k vectors), Flat is faster and more precise. For larger databases, an IVF index might be useful.

### SAM2 vs. FastSAM

| Aspect    | SAM2                       | FastSAM                |
| --------- | -------------------------- | ---------------------- |
| Speed     | Slow (~1-2s)               | Fast (~0.2s)           |
| Precision | Very high                  | Good                   |
| Input     | Prompt (Point/Box)         | Full screen            |
| Use Case  | Single-Object-Segmentation | Multi-Object-Detection |

**Design Decision**: SAM2 for user-initiated segmentation (click), FastSAM for automatic detection.

### Image Format Conversions

Pay attention to color space conversions:

- **PIL/Pillow**: RGB format
- **OpenCV**: BGR format
- **PyTorch/Transformers**: RGB format

The API handles these conversions automatically:

```python
# PIL → OpenCV
image_np = np.array(image_pil)
image_bgr = cv2.cvtColor(image_np, cv2.COLOR_RGB2BGR)

# OpenCV → PIL
image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
image_pil = Image.fromarray(image_rgb)
```

### Performance Considerations

**Bottlenecks**:

1. FastSAM Inference: ~200-500ms
2. DINOv2 Feature Extraction: ~50-100ms per object
3. FAISS Search: ~1-5ms (negligible)

**Optimizations**:

- Batch processing for multiple objects
- GPU usage (automatic if available)
- Image resizing to 640px for FastSAM (balance between speed and quality)

---

## Development and Extension

### Add New Endpoints

```python
# In api.py
@app.post("/my_new_endpoint")
async def my_function(file: UploadFile = File(...)):
    contents = await file.read()
    image = Image.open(io.BytesIO(contents))

    # Processing...
    result = generic_detector.predict(image, "my_prompt")

    return {"result": result}
```

### Adjust Detector Thresholds

```python
# In detector_personalized.py, __init__
self.SIM_THRESHOLD = 0.7  # Stricter (fewer false positives)
self.SIM_THRESHOLD = 0.5  # Looser (more detections)
```

### Alternative FAISS Indices

For large databases (> 100k objects):

```python
# In scanner.py, load_or_create_database()
# Instead of IndexFlatL2
self.index = faiss.IndexIVFFlat(
    faiss.IndexFlatL2(self.dimension),
    self.dimension,
    100  # nlist (number of clusters)
)
```

### Add Logging

```python
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# In functions
logger.info(f"Detected {len(masks)} objects")
```

### Testing

```python
# test_api.py
from fastapi.testclient import TestClient
from server.api import app

client = TestClient(app)

def test_detect():
    with open("test_image.jpg", "rb") as f:
        response = client.post(
            "/detect",
            files={"file": f},
            data={"prompt": "cat"}
        )
    assert response.status_code == 200
    assert "detection" in response.json()
```

### Common Pitfalls

1. **Not reloading FAISS index after updates**: Always call `_load_database()` after changes
2. **Confusing bounding box formats**: API uses a mix of `[x,y,w,h]` and `[x1,y1,x2,y2]` - always check!
3. **Forgetting RGB/BGR conversion**: Leads to wrong colors and worse detections
4. **Images too large**: Resizing to ~1000px recommended for better performance

---

## Further Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Ultralytics YOLO-World](https://docs.ultralytics.com/models/yolo-world/)
- [SAM2 Paper](https://arxiv.org/abs/2408.00714)
- [DINOv2 Paper](https://arxiv.org/abs/2304.07193)
- [FAISS Wiki](https://github.com/facebookresearch/faiss/wiki)

---

## License & Attribution

This project uses the following open-source models:

- YOLO-World (Ultralytics - AGPL-3.0)
- SAM2 (Meta AI - Apache 2.0)
- FastSAM (CASIA-IVA-Lab - MIT)
- DINOv2 (Meta AI - Apache 2.0)
