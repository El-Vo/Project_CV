# Frontend Component - Documentation

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Pages and Views](#pages-and-views)
4. [Core Modules](#core-modules)
5. [Detection Systems](#detection-systems)
6. [Installation and Setup](#installation-and-setup)
7. [Usage](#usage)
8. [Technical Details](#technical-details)
9. [Development and Extension](#development-and-extension)

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

This frontend application is designed as a mobile-first Progressive Web App (PWA) that communicates with the FastAPI backend for object detection. It's optimized for smartphone cameras and provides an accessible interface for individuals with visual impairments.

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
5. Repeat from different angles (3-5 recommended)
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

## Installation and Setup

### Prerequisites

- Modern web browser with:
  - ES6 module support
  - WebRTC camera access
  - Web Audio API
  - Optional: WebGPU for faster depth estimation
- Backend server running (see `/server/README.md`)
- HTTPS or localhost (required for camera access)

---

### Installation

#### Option 1: Static File Server (Development)

```bash
# From project root
cd frontend

# Python 3
python -m http.server 8080

# Node.js
npx http-server -p 8080

# PHP
php -S localhost:8080
```

Visit: `http://localhost:8080`

---

#### Option 2: Bootstrap Studio (Recommended for Development)

The project includes a Bootstrap Studio design file:

```
frontend/bs_studio/Project_CV.bsdesign
```

1. Open in [Bootstrap Studio](https://bootstrapstudio.io/)
2. Edit visually
3. Preview with built-in server
4. Export to `/frontend` directory

---

#### Option 3: Production Deployment

```bash
# Simple static hosting (Netlify, Vercel, GitHub Pages)
# Just upload the frontend folder contents

# Nginx configuration example
server {
    listen 80;
    server_name yourapp.com;

    location / {
        root /path/to/frontend;
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests to backend
    location /api/ {
        proxy_pass http://localhost:8000/;
    }
}
```

---

### Configuration

Edit `src/modules/config.js`:

```javascript
export const CONFIG = {
  // Backend URL
  API_URL: "http://127.0.0.1:8000", // Change for production

  // Performance tuning
  DETECTION_FPS_TARGET: 2, // How often to call detection API
  TRACKER_FPS_TARGET: 60, // Optical flow tracking framerate
  DEPTH_FPS_TARGET: 10, // Depth estimation frequency

  // Image processing
  DETECTION_SHORT_SIDE_PX: 480, // Downscale frames to this size
  DEPTH_WIDTH: 112, // Depth model input size

  // Tracking sensitivity
  TRACKER_SEARCH_RANGE: 60,
  TRACKER_SENSITIVITY: 200,

  // Audio feedback
  AUDIO_BEEP_FREQ: 800, // Hz
  AUDIO_MIN_DELAY: 100, // ms (close)
  AUDIO_MAX_DELAY: 1000, // ms (far)

  // Accessibility
  ENABLE_TTS: true,
};
```

---

### Dependencies

#### External CDN Libraries

Loaded via HTML `<script>` tags:

```html
<!-- Bootstrap 5 -->
<link
  href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.6/dist/css/bootstrap.min.css"
/>
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.6/dist/js/bootstrap.bundle.min.js"></script>

<!-- OpenCV.js (for feature tracking) -->
<script src="https://docs.opencv.org/4.9.0/opencv.js"></script>
```

#### ES6 Modules (from CDN)

```javascript
// Transformers.js (depth estimation)
import { pipeline } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.0";
```

**No NPM or build step required** - all dependencies loaded at runtime.

---

### First Run Checklist

1. **Start Backend Server**: `uvicorn server.api:app --reload`
2. **Update API_URL**: Set correct backend URL in `config.js`
3. **Allow Camera Access**: Browser will prompt for permission
4. **Wait for Model Loading**: First run downloads depth estimation model (~30MB)
5. **Test Generic Detection**: Search for simple objects like "phone" or "bottle"

---

## Usage

### Example 1: Generic Object Search Flow

```javascript
// User navigates to detect_generic.html
// Page loads DetectionGenericLoop

const loop = new DetectionGenericLoop();

// User types "keys" in search box
UI.getTextPrompt(); // returns "keys"

// Loop automatically:
loop.updateObjectDetection(); // Every 500ms (2 FPS)
// → camera.takePictureResized()
// → detectGenericObjectAPI("keys", image_blob)
// → Backend runs YOLO-World
// → Returns { box: [x,y,w,h], label: "keys", score: 0.89 }

loop.updateTracking(); // Every ~16ms (60 FPS)
// → tracker.track(camera_canvas)
// → Maintains box position with optical flow

loop.updateDepth(); // Every 100ms (10 FPS)
// → depthEstimator.predict(camera_canvas)
// → Samples depth at box center
// → sensor.update(distance_score)
// → Plays beep based on distance
```

---

### Example 2: Scanning a Personal Object

```javascript
// User navigates to scan.html
const scanLoop = new ScanningLoop();

// Phase 1: Name entry
// User types "my_wallet" and clicks submit
scanLoop._objectLabel = "my_wallet";

// Phase 2: Capture
// User taps screen when object is centered
scanLoop.analyzeTap();
// → camera.takePictureResized()
// → detector.detectObject(image_blob)  // SAMDetection
// → getBoundingBoxFromCoordAPI(x, y, image_blob)
// → Backend SAM2 returns bounding box
// → Tracking begins

// User moves around object and taps again
scanLoop.analyzeTap(); // While tracking
// → Captures current box position
// → saveToFaissAPI(box, "my_wallet", image_blob)
// → Backend: SAM2 segments → DINOv2 features → FAISS stores

// Repeat 3-5 times from different angles
```

---

### Example 3: Finding a Personal Object

```javascript
// User selects object from list in detect_personalized_select.html
// Redirected to: detect_personalized.html?label=my_wallet

const loop = new DetectionPersonalizedLoop();
loop.targetLabel = "my_wallet";

// Loop runs detection every 500ms
loop.updateObjectDetection();
// → detectPersonalizedObjectAPI(image_blob, "my_wallet")
// → Backend: FastSAM segments → DINOv2 extracts features
// → FAISS searches for "my_wallet" matches
// → Returns best match: { box, label: "my_wallet", score: 0.84 }

// When found:
TextToSpeech.speak("my_wallet detected");
// Tracking and audio guidance begin
```

---

### Example 4: Depth-Based Guidance

```javascript
// During any detection mode:

// 1. Object detected and tracked
loop.updateDepth();
// Get bounding box center
const [x1, y1, x2, y2] = tracker.currentBox;
const centerX = (x1 + x2) / 2;
const centerY = (y1 + y2) / 2;

// Get depth at center
const depthMap = await depthEstimator.predict(canvas);
const depthX = depthEstimator.scaleRawCameraToDepthX(centerX);
const depthY = depthEstimator.scaleRawCameraToDepthY(centerY);
const depthValue = depthMap.data[depthY * depthMap.width + depthX];

// Convert to distance score (0 = far, 1 = close)
const distanceScore = 1.0 - depthValue / 255;

// Update audio feedback
sensor.update(distanceScore);
// Plays beep with delay: 1000ms * (1 - distanceScore)
// Close objects (distanceScore ≈ 1) → 100ms delay (rapid beeps)
// Far objects (distanceScore ≈ 0) → 1000ms delay (slow beeps)
```

---

## Technical Details

### Multi-Loop Architecture

The application uses `requestAnimationFrame` for smooth animation and separate timers for different tasks:

```javascript
loop() {
  const now = performance.now();

  // Detection: 2 FPS (expensive API calls)
  if (now > this._lastDetectionTimestamp + 500) {
    this.updateObjectDetection();
    this._lastDetectionTimestamp = now;
  }

  // Tracking: 60 FPS (lightweight optical flow)
  if (now > this._lastTrackingTimestamp + 16.67) {
    this.updateTracking();
    this._lastTrackingTimestamp = now;
  }

  // Depth: 10 FPS (moderate GPU load)
  if (now > this._lastDepthEstimationTimestamp + 100) {
    this.updateDepth();
    this._lastDepthEstimationTimestamp = now;
  }

  requestAnimationFrame(() => this.loop());
}
```

**Benefits**:

- Smooth tracking even with slow detection
- Reduced API costs (2 FPS vs continuous)
- Responsive UI (60 FPS canvas updates)

---

### Coordinate System Transformations

**Challenge**: Five different coordinate systems must be reconciled.

```
User Tap (CSS pixels)
    ↓ translateWindowToVisibleRegion()
Visible Region (cropped camera coordinates)
    ↓ visibleRegion offset
Full Camera Frame (raw camera resolution)
    ↓ getResizeScaleFactor()
Resized API Frame (480px short side)
    ↓ scaleBoundingBoxToResized()
Backend Detection (coordinates in resized frame)
    ↓ scaleBoundingBoxFromResized()
Back to Full Camera Frame
    ↓ translateBoundingBoxToWindowScaling()
Display Canvas (CSS pixels for drawing)
```

**Implementation**:
The `CameraHandler` class maintains scaling factors and provides transformation methods to convert between all coordinate systems.

---

### Depth Estimation Details

#### Model Choice

**Depth-Anything-v2-Small**:

- **Size**: ~30MB ONNX
- **Input**: 518x518 (we use 112x112 for speed)
- **Output**: Relative depth map (not metric distance)
- **Training**: Self-supervised on massive unlabeled datasets

**Why Relative Depth is Sufficient**:

- We only need to know "closer" vs "farther"
- Audio guidance uses normalized distance (0-1)
- Absolute metric distance (e.g., "2.3 meters") is not required

#### Backend Fallback Strategy

```javascript
// Try best backend first
try {
  estimator = await pipeline("depth-estimation", modelId, { device: "webgpu" });
} catch {
  try {
    estimator = await pipeline("depth-estimation", modelId, {
      device: "webnn",
    });
  } catch {
    estimator = await pipeline("depth-estimation", modelId, { device: "wasm" });
  }
}
```

**Performance Comparison** (112x112 input):

| Backend | Desktop Latency | Mobile Latency | Availability       |
| ------- | --------------- | -------------- | ------------------ |
| WebGPU  | 20-30ms         | 40-60ms        | Modern Chrome/Edge |
| WebNN   | 30-50ms         | 50-100ms       | Experimental       |
| WASM    | 150-300ms       | 300-500ms      | Universal          |

---

### Optical Flow Tracking

#### Why Lucas-Kanade?

**Alternatives Considered**:

1. **CSRT/KCF Trackers**: Slower, require C++ compiled OpenCV
2. **MeanShift**: Poor with rotation/scale changes
3. **Deep Learning Trackers**: Too heavy for browser

**Lucas-Kanade Benefits**:

- Fast (~5ms for 50 points)
- Available in OpenCV.js
- Robust with median filtering

#### Tracking Pipeline

```javascript
// 1. Find features in initial box
cv.goodFeaturesToTrack(grayFrame, corners, 50, 0.01, 5);

// 2. Track features to next frame
cv.calcOpticalFlowPyrLK(prevGray, nextGray, prevPoints, nextPoints);

// 3. Filter invalid points
validPoints = points.filter((p) => status[i] === 1 && inBounds(p));

// 4. Calculate median movement (robust to outliers)
dx_median = median(validPoints.map((p) => p.x - prev.x));
dy_median = median(validPoints.map((p) => p.y - prev.y));

// 5. Shift bounding box
box.x += dx_median;
box.y += dy_median;
```

**Tracking Loss Handling**:

- If < 5 points remain: Return `null`, trigger new detection
- If box center exits frame: Return `null`
- Else: Continue tracking with remaining points

---

### Performance Optimization Strategies

#### 1. Image Downscaling

```javascript
// Original camera feed: 1920x1080 (2MP)
// Resized for API: 853x480 (0.4MP)
// Bandwidth: ~50KB vs ~200KB JPEG
// API latency: ~200ms vs ~600ms
```

#### 2. Lazy Model Loading

```javascript
// Depth estimator only initialized when detection mode starts
// Not loaded on main menu or scanning page
if (needsDepthGuidance) {
  await depthEstimator.init(); // Deferred loading
}
```

#### 3. Canvas Reuse

```javascript
// Single canvas element reused for all captures
// Avoids creating/destroying canvas elements
this.canvas.width = targetWidth; // Resize instead of recreate
this.canvas.height = targetHeight;
```

#### 4. Adaptive FPS

```javascript
// Lower FPS on slow devices
if (lastFrameTime > 100) {
  // Frame took >100ms
  CONFIG.DETECTION_FPS_TARGET = Math.max(1, CONFIG.DETECTION_FPS_TARGET - 0.5);
}
```

---

### Web Audio API Audio Feedback

```javascript
// Create audio context
const audioCtx = new AudioContext();

// Generate beep
const oscillator = audioCtx.createOscillator();
oscillator.type = "sine";
oscillator.frequency.value = 800; // Hz

const gainNode = audioCtx.createGain();
gainNode.gain.value = 0.3; // Volume

oscillator.connect(gainNode);
gainNode.connect(audioCtx.destination);

oscillator.start();
oscillator.stop(audioCtx.currentTime + 0.1); // 100ms beep
```

**Why Web Audio API over `<audio>` tag**:

- Lower latency (~10ms vs ~50-200ms)
- Precise timing control
- Can synthesize tones (no audio file needed)
- No loading/buffering delays

---

### Accessibility Features

#### 1. Screen Reader Support

```html
<button aria-label="Start object detection">
  <span aria-hidden="true">🔍</span>
</button>
```

#### 2. High Contrast Bounding Boxes

```javascript
ctx.strokeStyle = "#00FF00"; // Bright green
ctx.lineWidth = 4; // Thick borders
ctx.setLineDash([10, 5]); // Dashed for visibility against any background
```

#### 3. Audio-First Navigation

- Every mode transition announces via TTS
- Detection results spoken aloud
- Guidance stages verbalized ("You're getting closer")

#### 4. Large Touch Targets

```css
.btn-lg {
  min-height: 60px; /* Easy to tap */
  font-size: 1.5rem; /* Readable */
}
```

---

## Development and Extension

### Adding a New Detection Page

```javascript
// 1. Create HTML: my_new_mode.html
// 2. Create controller: src/myNewModeLoop.js

import { DetectionLoop } from "./detectionLoop.js";

export class MyNewModeLoop extends DetectionLoop {
  constructor() {
    super();
    this.detector = new MyCustomDetector();
  }

  loop() {
    // Custom detection logic
    if (this.shouldDetect()) {
      this.updateObjectDetection();
    }

    // Reuse base tracking and depth
    this.updateTracking();
    this.updateDepth();

    requestAnimationFrame(() => this.loop());
  }
}

// 3. In HTML:
// <script type="module">
//   import { MyNewModeLoop } from "./src/myNewModeLoop.js";
//   new MyNewModeLoop();
// </script>
```

---

### Creating a Custom Detector

```javascript
// src/modules/bounding_box_detectors/myDetector.js

import { Detector } from "./detector.js";
import { CONFIG } from "../config.js";

export class MyCustomDetector extends Detector {
  async detectObject(image_blob) {
    // Call custom API endpoint
    const response = await fetch(`${CONFIG.API_URL}/my_endpoint`, {
      method: "POST",
      body: createFormData(image_blob),
    });

    const result = await response.json();

    // Cache result
    this._setCurrentDetection({
      box: result.bounding_box,
      label: result.class_name,
      score: result.confidence,
    });

    return this.getCurrentDetection();
  }
}
```

---

### Customizing Audio Feedback

```javascript
// In modules/audio.js

// Change beep frequency
CONFIG.AUDIO_BEEP_FREQ = 1000; // Higher pitch

// Adjust distance mapping
const delay =
  CONFIG.AUDIO_MAX_DELAY -
  distanceScore ** 2 * (CONFIG.AUDIO_MAX_DELAY - CONFIG.AUDIO_MIN_DELAY);
// Exponential: Closer objects get disproportionately faster beeps
```

---

### Modifying Depth Estimation

```javascript
// Use different Transformers.js model
const estimator = new DepthEstimator("Intel/dpt-large");

// Increase resolution (slower but more accurate)
CONFIG.DEPTH_WIDTH = 224;
CONFIG.DEPTH_HEIGHT = 224;

// Disable depth estimation entirely
loop.updateDepth = () => {}; // No-op
```

---

### Custom TTS Voices

```javascript
// In modules/tts.js

static speak(text) {
  const utterance = new SpeechSynthesisUtterance(text);

  // Select specific voice
  const voices = speechSynthesis.getVoices();
  utterance.voice = voices.find(v => v.name === "Google UK English Female");

  // Adjust speed
  utterance.rate = 1.2;  // 20% faster

  speechSynthesis.speak(utterance);
}
```

---

### Debugging Tips

#### 1. Enable Verbose Logging

```javascript
// In loop controller
loop() {
  console.log("Frame:", performance.now());
  console.log("Tracking:", this._isTracking);
  console.log("Detection:", this.detector.getCurrentDetection());
  // ...
}
```

#### 2. Visualize Depth Map

```javascript
// In modules/display/depthUI.js
drawDepthMap(depthTensor) {
  const imageData = this.ctx.createImageData(depthTensor.width, depthTensor.height);
  for (let i = 0; i < depthTensor.data.length; i++) {
    const depth = depthTensor.data[i];
    imageData.data[i * 4] = depth;      // R
    imageData.data[i * 4 + 1] = depth;  // G
    imageData.data[i * 4 + 2] = depth;  // B
    imageData.data[i * 4 + 3] = 255;    // A
  }
  this.ctx.putImageData(imageData, 0, 0);
}
```

#### 3. Performance Profiling

```javascript
// In modules/performanceMetrics.js
const start = performance.now();
await this.detector.detectObject(image);
const elapsed = performance.now() - start;
console.log(`Detection: ${elapsed.toFixed(1)}ms`);
```

#### 4. Test Without Camera

```javascript
// Use static image instead of live stream
const testImage = await fetch("/test.jpg").then((r) => r.blob());
detector.detectObject(testImage);
```

---

### Common Pitfalls

#### 1. CORS Issues with Backend

**Problem**: `fetch()` fails with CORS error.

**Solution**: Ensure backend has correct CORS headers:

```python
# In server/api.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080"],  # Add your frontend URL
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

#### 2. Camera Not Starting on HTTPS

**Problem**: `getUserMedia()` requires secure context.

**Solution**:

- Localhost is exempt (always works)
- For other domains, use HTTPS
- Use ngrok for testing: `ngrok http 8080`

---

#### 3. OpenCV.js Not Loading

**Problem**: `cv is not defined` error.

**Solution**:

```html
<!-- Load OpenCV.js BEFORE your module scripts -->
<script src="https://docs.opencv.org/4.9.0/opencv.js" async></script>
<script>
  window.addEventListener("load", () => {
    cv["onRuntimeInitialized"] = () => {
      // Now safe to use OpenCV
      import("./src/detectionLoop.js");
    };
  });
</script>
```

---

#### 4. Bounding Box Misalignment

**Problem**: Detection box doesn't match visible object.

**Diagnosis**:

```javascript
// Check if visible region is updating
camera.updateVisibleRegion();
console.log(camera.visibleRegion); // Should match CSS display area
```

**Fix**: Call `updateVisibleRegion()` on window resize:

```javascript
window.addEventListener("resize", () => {
  camera.updateVisibleRegion();
});
```

---

### Testing Checklist

- [ ] **Desktop Chrome**: WebGPU depth estimation
- [ ] **Mobile Safari**: WASM fallback, camera works
- [ ] **Mobile Chrome**: Check audio beeps work
- [ ] **Firefox**: OpenCV.js compatibility
- [ ] **No camera device**: Graceful error message
- [ ] **Backend offline**: Network error handling
- [ ] **Slow connection**: Loading indicators shown
- [ ] **Screen rotation**: Canvas resizes correctly
- [ ] **Low light**: Detection still functions
- [ ] **Busy background**: Tracking doesn't drift

---

## Further Resources

- [Web APIs for Camera Access](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- [OpenCV.js Documentation](https://docs.opencv.org/4.9.0/d5/d10/tutorial_js_root.html)
- [Transformers.js GitHub](https://github.com/xenova/transformers.js)
- [Bootstrap 5 Docs](https://getbootstrap.com/docs/5.3/)
- [Web Audio API Guide](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [FAISS Documentation](https://github.com/facebookresearch/faiss/wiki) (backend reference)

---

## License & Attribution

This frontend uses the following open-source libraries:

- **Bootstrap 5** (MIT License)
- **OpenCV.js** (Apache 2.0)
- **Transformers.js** (Apache 2.0)
- **Depth-Anything-v2** (Apache 2.0)

Frontend code is part of Project_CV and follows the same license as the backend server component.
