import { CONFIG } from "./modules/config.js";
import { CameraHandler } from "./modules/camera.js";
import { DepthEstimator } from "./modules/depth.js";
import { ParkingSensor } from "./modules/audio.js";
import { UI } from "./modules/ui.js";
import { RemoteDetection } from "./modules/remoteDetection.js";
import { FeatureTracker } from "./modules/tracking.js";
import { TapDetection } from "./modules/tapDetection.js";

// Handlers & State
const depth = new DepthEstimator(CONFIG.DEPTH_MODEL);

// FPS Tracking
let lastDepthTime = performance.now();
let depthFPS = 0;
let lastUIPdateTime = 0;

export class AR {
  #lastDetectionTimestamp = 0;
  #lastTrackingTimestamp = 0;
  #countOfSuccessfulTrackingiterations = 0;
  #isDetecting = false;
  #isTracking = false;

  webcam = document.getElementById("webcam");
  depthCanvas = document.getElementById("depth-canvas");
  captureCanvas = document.getElementById("capture-canvas");
  detectionCanvas = document.getElementById("detection-canvas");

  constructor() {
    this.camera = new CameraHandler(this.webcam, this.captureCanvas);
    this.camera.start().then(() => {
      this.updateCanvasDimensions();
    });

    if (CONFIG.LOCAL_MODE) {
      this.detector = new TapDetection(this.detectionCanvas);
      UI.setLocalMode(true);
    } else {
      this.detector = new RemoteDetection();
    }

    this.tracker = new FeatureTracker(this.detectionCanvas);

    // Update visible region on window resize
    window.addEventListener("resize", () => {
      this.updateCanvasDimensions();
    });
  }

  loop() {
    // Object detection step
    if (
      !this.#isDetecting &&
      !this.#isTracking &&
      !CONFIG.LOCAL_MODE &&
      UI.getTextPrompt() != "" &&
      performance.now() >
        this.#lastDetectionTimestamp + 1000 / CONFIG.DETECTION_FPS_TARGET
    ) {
      this.updateObjectDetection();
      this.#lastDetectionTimestamp = performance.now();
    }

    //Object tracking step
    if (
      performance.now() >
      this.#lastTrackingTimestamp + 1000 / CONFIG.TRACKER_FPS_TARGET
    ) {
      this.updateTracking();
      this.#lastTrackingTimestamp = performance.now();
    }

    //Clear bounding boxes if no text input is given
    if (UI.getTextPrompt() == "") {
      this.tracker.clearCanvas();
    }

    requestAnimationFrame(() => this.loop());
  }

  async updateObjectDetection() {
    this.#isDetecting = true;
    try {
      const imgBlob = await this.camera.takePictureResized();
      await this.detector.detectObject(imgBlob);
    } catch (err) {
      console.error("Detection error:", err);
    } finally {
      this.#isDetecting = false;
    }
  }

  updateTracking() {
    let detection = this.detector.getCurrentBoundingBox();

    if (detection != null && detection.box) {
      // Since local mode gets bounding boxes based on the detection canvas
      // and not from the picture itself, we must account for that
      if (CONFIG.LOCAL_MODE) {
        detection.box = this.camera.translateBoundingBoxToPictureScaling(
          detection.box,
        );
        // Scale to resized coordinates for tracking
        detection.box = this.camera.scaleBoundingBoxToResized(detection.box);
      }

      this.#isTracking = this.tracker.init(
        this.camera.takePictureResized(false),
        detection.box,
      );
    }

    if (this.#isTracking) {
      // Use resized picture for tracking to match initialization
      detection = this.tracker.track(this.camera.takePictureResized(false));
      if (detection == null) {
        this.#isTracking = false;
        this.#countOfSuccessfulTrackingiterations = 0;
        this.tracker.clearCanvas();
      } else {
        // Scale back up from resized coordinates to full picture coordinates
        detection.box = this.camera.scaleBoundingBoxFromResized(detection.box);

        detection.box = this.camera.translateBoundingBoxToWindowScaling(
          detection.box,
        );

        this.tracker.drawDetection(detection);

        this.#countOfSuccessfulTrackingiterations++;
      }
    }

    if (
      this.#countOfSuccessfulTrackingiterations >
      2 * CONFIG.TRACKER_FPS_TARGET
    ) {
      this.#isTracking = false;
      this.#countOfSuccessfulTrackingiterations = 0;
    }
  }

  updateCanvasDimensions() {
    const visibleRegion = this.camera.updateVisibleRegion();
    this.camera.setDimensionsAndPosition(
      this.camera.visibleRegion.width,
      this.camera.visibleRegion.height,
    );
    this.tracker.setDimensionsAndPosition(
      window.innerWidth,
      window.innerHeight,
    );
  }
}
async function init() {
  // Start Loops immediately to allow UI updates/tracking
  renderLoop();
  trackingLoop();

  // Initialize services
  const cameraOk = await camera.start();
  if (!cameraOk) return;

  isRunning = true;
  console.log("Basic services ready, loading depth model...");

  depth.init();

  console.log("App initialization sequence complete.");
}

async function trackingLoop() {
  if (!isRunning) return requestAnimationFrame(trackingLoop);

  try {
    if (isTrackingActive && webcam.readyState >= 2) {
      const now = performance.now();
      const region = camera.visibleRegion;

      const trackResult = tracker.track(webcam, region);

      if (trackResult) {
        const [x1, y1, x2, y2] = trackResult.box;

        currentObjectCenter = {
          x: (x1 + x2) / 2 / region.width,
          y: (y1 + y2) / 2 / region.height,
        };

        UI.drawDetection(
          detCtx,
          detCanvas,
          {
            label: "Tracking...",
            confidence: trackResult.confidence,
            box: [x1, y1, x2, y2],
          },
          region.width,
          region.height,
        );

        detFPS = 1000 / (now - lastDetTime);
        lastDetTime = now;
      } else {
        console.log("Tracker lost object");
        isTrackingActive = false;
        currentObjectCenter = null;
        UI.clearCanvas(detCtx, detCanvas);
      }
    }
  } catch (err) {
    console.error("Tracking loop error:", err);
  }

  requestAnimationFrame(trackingLoop);
}

async function renderLoop() {
  if (!isRunning) return requestAnimationFrame(renderLoop);

  try {
    if (webcam.readyState < 2) return requestAnimationFrame(renderLoop);

    const now = performance.now();

    // Optimization: Only run depth if object detected
    if (!currentObjectCenter) {
      UI.clearCanvas(depthCtx, depthCanvas);
      if (distanceEl) distanceEl.innerText = "--";
      sensor.update(0, false);
      return requestAnimationFrame(renderLoop);
    }

    // 2. Depth Logic
    const interval = 1000 / CONFIG.DEPTH_FPS_TARGET;
    if (now - lastDepthTime >= interval) {
      const depthPrediction = await depth.predict(webcam, camera.visibleRegion);
      if (depthPrediction) {
        // Update depth FPS
        depthFPS = 1000 / (now - lastDepthTime);
        lastDepthTime = now;

        currentDepthData = depthPrediction.data;
        const { width, height } = depthPrediction;

        // Draw visual depth map
        if (depthCanvas && depthPrediction.toCanvas) {
          const visualCanvas = await depthPrediction.toCanvas();
          if (
            depthCanvas.width !== visualCanvas.width ||
            depthCanvas.height !== visualCanvas.height
          ) {
            depthCanvas.width = visualCanvas.width;
            depthCanvas.height = visualCanvas.height;
          }
          depthCtx.drawImage(visualCanvas, 0, 0);
        }

        // Update distance and sensor
        if (currentObjectCenter) {
          const tx = Math.floor(currentObjectCenter.x * width);
          const ty = Math.floor(currentObjectCenter.y * height);
          const idx = Math.max(
            0,
            Math.min(width * height - 1, ty * width + tx),
          );
          const val = currentDepthData[idx];

          if (distanceEl) distanceEl.innerText = val.toFixed(3);
          sensor.update(val, true);
        } else {
          sensor.update(0, false);
        }
      }
    }

    // Periodically update UI stats
    if (now - lastUIPdateTime > 500) {
      UI.updateFPS(depthFPS, detFPS);
      lastUIPdateTime = now;
    }
  } catch (err) {
    console.error("Render loop error:", err);
  }

  requestAnimationFrame(renderLoop);
}

const main = new AR();
main.loop();
