# Frontend Component - Documentation

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Pages and Views](#pages-and-views)
4. [Core Modules](#core-modules)
5. [Detection Systems](#detection-systems)

---

## Overview

The frontend component provides an interactive web-based user interface for the Computer Vision Object Detection system. It enables users to search for objects in real-time using their device's camera, scan and store personal items, and receive audio-visual guidance to locate detected objects.

### Key Features

- **Generic Object Search**: Find any object using text prompts (e.g., "keys", "phone")
- **Personalized Object Detection**: Locate previously scanned personal items
- **Object Scanning**: Capture and store personal objects from multiple angles
- **Visual Tracking**: Real-time object tracking with OpenCV.js
- **Depth Guidance**: Audio-visual feedback based on estimated distance to object
- **Text-to-Speech**: Accessible voice guidance for visually impaired users
- **Object Management**: View and delete stored personal objects

### Project Context

This frontend application is designed as a mobile-first Web App that communicates with the FastAPI backend for object detection. It's optimized for smartphone cameras and provides an accessible interface for individuals with visual impairments.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   HTML Pages Layer                      │
│  index.html │ detect_generic.html │ scan.html │ etc.   │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│                  Loop Controllers                       │
│  DetectionGenericLoop │ DetectionPersonalizedLoop │    │
│         ScanningLoop  │  DetectPersonalizedSelect      │
└──────┬──────────┬─────────────┬────────────────────┬───┘
       │          │             │                    │
┌──────▼──────────▼─────────────▼────────────────────▼───┐
│                    Core Modules                         │
│  Camera │ API │ UI │ Audio │ TTS │ Depth │ Tracking    │
└──────┬──────────┬─────────────┬────────────────────┬───┘
       │          │             │                    │
┌──────▼──────────▼─────────────▼────────────────────▼───┐
│              Detection Strategies                       │
│  RemoteGenericDetection │ RemotePersonalizedDetection  │
│       SAMDetector │ TapDetection                       │
└──────┬──────────┬─────────────┬────────────────────┬───┘
       │          │             │                    │
┌──────▼──────────▼─────────────▼────────────────────▼───┐
│            External Services & Libraries                │
│  FastAPI Backend │ OpenCV.js │ Transformers.js │       │
│       Web Audio API │ Web Speech API                   │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

1. **User Input**: User selects mode (generic/personalized search or scan)
2. **Camera Capture**: CameraHandler captures video stream and extracts frames
3. **Detection Request**: Frame is sent to appropriate detector (local or remote)
4. **Tracking**: FeatureTracker maintains object position between detections
5. **Depth Estimation**: DepthEstimator calculates distance using Transformers.js
6. **Feedback**: Audio beeps and TTS guide user toward object
7. **Persistence** (Scan mode): Object features saved to backend FAISS database

---

## Pages and Views

### 1. `index.html` - Main Menu

**Purpose**: Landing page with navigation to all application features.

**Features**:

- Large, accessible buttons for each mode
- Responsive Bootstrap 5 layout
- Minimal JavaScript - primarily navigation

**Routes**:

- **Detect Generic Item** → `detect_generic.html`
- **Detect Personal Item** → `detect_personalized_select.html`
- **Scan Personal Item** → `scan.html`
- **Manage Personal Items** → `manage_objects.html`

---

### 2. `detect_generic.html` - Generic Object Search

**Purpose**: Real-time search for any object using text prompts.

**Controller**: `DetectionGenericLoop`

**User Flow**:

1. Enter object name in text input (e.g., "wallet")
2. Point camera at environment
3. System automatically detects and tracks object
4. Audio beeps guide user (higher pitch = closer)
5. Text-to-speech announces when object is found

**UI Elements**:

- Video preview
- Text input for search prompt
- Bounding box overlay (canvas)
- Depth visualization (optional)
- Performance metrics display

---

### 3. `detect_personalized_select.html` - Personal Object Selection

**Purpose**: Select which previously scanned object to search for.

**Controller**: `DetectPersonalizedSelect`

**User Flow**:

1. View list of stored personal objects
2. Select one to search for
3. Redirected to `detect_personalized.html` with label parameter

**Data Source**: Fetched from `/get_personal_object_labels` API

---

### 4. `detect_personalized.html` - Personal Object Search

**Purpose**: Locate a specific personal object that was previously scanned.

**Controller**: `DetectionPersonalizedLoop`

**User Flow**:

1. Page loads with target object label from URL parameter
2. Point camera at environment
3. System searches for matching object using FAISS database
4. Audio-visual guidance when object is detected
5. TTS announces object name when found

**Advantages over Generic**:

- Higher accuracy for known objects
- Works in varied lighting/angles
- No need to type search terms each time

---

### 5. `scan.html` - Object Scanning Workflow

**Purpose**: Multi-angle capture of personal objects for database storage.

**Controller**: `ScanningLoop`

**Two-Phase Workflow**:

**Phase 1: Name Entry**

- User enters unique name for object
- Validation against existing labels
- TTS confirmation

**Phase 2: Multi-Angle Capture**

1. User taps screen when object is centered in blue square
2. SAM (Segment Anything Model) segments object from background
3. Bounding box displayed and tracked
4. User taps again to capture current perspective
5. Repeat from different angles
6. Each perspective saved to FAISS database

**Technical Details**:

- Uses `SAMDetection` for tap-based segmentation
- Feature tracking maintains box between captures
- Photo counter displays number of angles captured

---

### 6. `manage_objects.html` - Object Database Management

**Purpose**: View and delete stored personal objects.

**Controller**: `ManageObjects`

**Features**:

- Display all stored objects with perspective counts
- Delete button for each object
- Confirmation dialog before deletion
- Automatic list refresh after deletion

**API Integration**:

- `GET /get_personal_object_labels` - Fetch objects
- `POST /delete_personal_object` - Remove object

---

## Core Modules

### 1. `modules/camera.js` - Camera Management

**Class**: `CameraHandler`

**Purpose**: Manages video stream capture, frame extraction, and coordinate transformations.

**Key Responsibilities**:

#### Video Stream Management

```javascript
async start()  // Request camera permission and start stream
```

- Requests rear camera (`facingMode: "environment"`)
- Returns promise that resolves when streaming begins

#### Visible Region Calculation

```javascript
updateVisibleRegion();
```

The camera feed is often cropped/scaled by CSS `object-fit: cover`. This method calculates which portion of the raw camera frame is actually visible to the user.

**Returns**:

```javascript
{
  x: 100,      // Left offset in camera coordinates
  y: 50,       // Top offset
  width: 1280, // Visible width
  height: 960  // Visible height
}
```

#### Coordinate Translation

**Problem**: Bounding boxes must be translated between three coordinate systems:

1. **Window coordinates** (CSS pixels, where user taps)
2. **Visible region coordinates** (portion of camera feed shown)
3. **Full camera coordinates** (raw camera frame)

**Methods**:

```javascript
translateVisibleRegionToWindowX(x);
translateBoundingBoxToWindowScaling(box);
scaleBoundingBoxToResized(box);
scaleBoundingBoxFromResized(box);
```

#### Frame Capture

```javascript
takePicture((return_blob = true)); // Full resolution
takePictureResized((return_blob = true)); // Downscaled for API
takeRawPicture((return_blob = true)); // Entire camera frame (including cropped area)
```

**Optimization**: `takePictureResized()` downscales to 480px on short side to reduce API latency.

---

### 2. `modules/api.js` - Backend Communication

**Purpose**: Centralized API client for all backend communication.

**Functions**:

#### Generic Detection

```javascript
detectGenericObjectAPI(prompt, image_blob);
```

Sends frame + text prompt to YOLO-World endpoint.

#### Personalized Detection

```javascript
detectPersonalizedObjectAPI(image_blob, label);
```

Searches for specific object in FAISS database.

#### Segmentation

```javascript
getBoundingBoxFromCoordAPI(x, y, image_blob);
```

Click/tap coordinates → SAM2 bounding box.

#### Database Operations

```javascript
saveToFaissAPI(bbox, label, image_blob);
getPersonalObjectLabels();
deletePersonalObjectAPI(label);
```

**Error Handling**: Uses `.catch()` for network failures, returns empty objects on error.

---

### 3. `modules/depth.js` - Depth Estimation

**Class**: `DepthEstimator`

**Purpose**: Estimates distance to objects using monocular depth estimation.

**Technology**:

- **Model**: `onnx-community/depth-anything-v2-small` (Hugging Face)
- **Library**: Transformers.js
- **Backends**: WebGPU (preferred) → WebNN → WASM (fallback)

**Workflow**:

#### Initialization

```javascript
await depthEstimator.init();
```

1. Auto-detects best available backend (GPU > NPU > CPU)
2. Downloads and caches ONNX model (~30MB)
3. Configures WASM settings for mobile stability

#### Prediction

```javascript
const depthMap = await depthEstimator.predict(canvas);
```

1. Resizes input to 112x112 (divisible by 14 for model compatibility)
2. Maintains aspect ratio
3. Returns depth tensor (higher values = farther)

**Performance**:

- WebGPU: ~30-50ms
- WASM (mobile): ~200-400ms

**Coordinate Scaling**:

```javascript
scaleRawCameraToDepthX(x);
scaleRawCameraToDepthY(y);
```

Maps camera coordinates → depth map coordinates for distance lookup.

---

### 4. `modules/display/tracking.js` - Visual Tracking

**Class**: `FeatureTracker`

**Purpose**: Maintains object bounding box between detection cycles using optical flow.

**Technology**: OpenCV.js Lucas-Kanade Optical Flow

**Algorithm**:

#### Initialization

```javascript
init(camera_canvas, box);
```

1. Extracts region inside bounding box
2. Finds 50 "good features to track" (corners)
3. Stores points + grayscale frame

#### Tracking Update

```javascript
track(camera_canvas);
```

1. Uses `calcOpticalFlowPyrLK` to find where features moved
2. Filters out lost/out-of-bounds points
3. Calculates median movement (robust against outliers)
4. Shifts bounding box by median offset
5. Returns updated detection or `null` if tracking lost

**Tracking Loss Conditions**:

- Fewer than 5 valid points remaining
- Box center moves outside frame
- OpenCV.js exception

**Confidence Score**: `validPoints / initialPoints` (1.0 = all features tracked)

---

### 5. `modules/audio.js` - Audio Feedback

**Purpose**: Generates proximity-based beep guidance using Web Audio API.

**How It Works**:

```javascript
AudioSensor.update(distanceScore); // 0.0 (far) to 1.0 (close)
```

1. **Distance → Delay**: Closer objects = faster beeps
   - Far: 1000ms delay
   - Close: 100ms delay
2. **Beep Generation**: 800Hz sine wave, 100ms duration
3. **Stage System**:
   - 5 stages from "far" to "reached"
   - TTS announcement when transitioning stages

**User Experience**:

- Hands-free guidance (eyes-free operation)
- Intuitive: faster beeps = warmer/closer

---

### 6. `modules/tts.js` - Text-to-Speech

**Class**: `TextToSpeech`

**Purpose**: Accessible voice announcements using Web Speech API.

**Usage**:

```javascript
TextToSpeech.speak("Object detected");
```

**Features**:

- Queue management (prevents overlapping speech)
- Configurable language (defaults to system language)
- Fallback when speech synthesis unavailable
- Enabled/disabled via `CONFIG.ENABLE_TTS`

**Accessibility**: Critical for visually impaired users navigating with audio guidance.

---

### 7. `modules/ui.js` - UI Utilities

**Class**: `UI`

**Purpose**: Helper functions for DOM manipulation and user interactions.

**Common Functions**:

```javascript
UI.getTextPrompt(); // Get search input value
UI.showFeedback(message, type); // Display toast notifications
UI.setButtonState(btn, loading); // Show/hide loading spinners
```

---

## Detection Systems

### Detection Strategy Pattern

All detectors implement a common interface:

```javascript
class Detector {
  async detectObject(image_blob) {
    // Returns: { box: [x1,y1,x2,y2], score: 0.95, label: "cat" }
  }

  getCurrentDetection() {
    // Returns last cached detection
  }
}
```

---

### 1. `RemoteGenericDetection` - YOLO-World API

**Purpose**: Zero-shot detection via backend YOLO-World model.

**Flow**:

1. Takes resized frame (480px)
2. Sends to `/detect` with text prompt
3. Backend returns highest-confidence detection
4. Caches result locally

**Latency**: ~200-500ms (network + inference)

---

### 2. `RemotePersonalizedDetection` - FAISS Matching

**Purpose**: Matches camera frame against stored personal objects.

**Flow**:

1. Takes resized frame
2. Sends to `/detect_personalized` with target label
3. Backend:
   - Segments all objects with FastSAM
   - Extracts DINOv2 features
   - Queries FAISS for matches
   - Returns best match above threshold
4. Caches result if found

**Latency**: ~400-800ms (more complex than generic)

---

### 3. `SAMDetector` - Local Segmentation Request

**Purpose**: User-initiated segmentation from tap coordinates.

**Flow**:

1. User taps screen (x, y coordinates captured)
2. Frame + coordinates sent to `/get_bounding_box_from_coord`
3. Backend SAM2 segments object at that point
4. Returns bounding box
5. Local tracking begins

**Use Case**: Scan mode, where user identifies object to capture.

---

### 4. `TapDetection` - Coordinate Handler

**Purpose**: Translates screen taps to camera coordinates.

**Challenges**:

- Touch points are in CSS pixels
- Camera frame has different resolution
- CSS `object-fit: cover` crops camera feed

**Solution**: Uses `CameraHandler` coordinate translation methods.

---
