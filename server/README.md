# Server Component - Documentation

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Modules and Components](#modules-and-components)
4. [API Endpoints](#api-endpoints)

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
