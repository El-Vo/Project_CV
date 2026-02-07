import { CONFIG } from "./modules/config.js";
import { CameraHandler } from "./modules/camera.js";
import { FeatureTracker } from "./modules/display/tracking.js";
import { DepthEstimator } from "./modules/depth.js";
import { ParkingSensor } from "./modules/audio.js";
import { DepthUIController } from "./modules/display/depthUI.js";
import { Detector } from "./modules/bounding_box_detectors/detector.js";

export class DetectionLoop {
  _lastDetectionTimestamp = 0;
  _lastTrackingTimestamp = 0;
  _countOfSuccessfulTrackingiterations = 0;
  _lastDepthEstimationTimestamp = 0;
  _isDetecting = false;
  _isTracking = false;
  _isDepthEstimating = false;
  _CurrentBoundingBox = null;
  _objectLabel = null;
  _currentAvgDepth = 0;
  _lastDetectionArea = 0;
  _lastDetectionDepth = 0;
  _lastVotedDetection = null;

  depthCanvas = document.getElementById("depth-canvas");
  detectionCanvas = document.getElementById("detection-canvas");
  webcam = document.getElementById("webcam");
  captureCanvas = document.getElementById("capture-canvas");

  constructor() {
    this.camera = new CameraHandler(this.webcam, this.captureCanvas);
    this.camera.start().then(() => {
      this.updateCanvasDimensions();
    });

    this.tracker = new FeatureTracker(this.detectionCanvas);
    this._maxTrackingIterations = 2 * CONFIG.TRACKER_FPS_TARGET;

    if (this.depthCanvas) {
      this.depth = new DepthEstimator(CONFIG.DEPTH_MODEL);
      this.depth.init();
      this.depthUI = new DepthUIController(this.depthCanvas);
      this.sensor = new ParkingSensor();
      this.sensor.init();
    }

    window.addEventListener("resize", () => {
      this.updateCanvasDimensions();
    });
  }

  loop() {
    requestAnimationFrame(() => this.loop());
  }

  async updateObjectDetection() {
    this._isDetecting = true;
    try {
      const imgBlob = await this.camera.takePictureResized();
      if (!imgBlob) {
        console.warn("Could not take picture: Blob is null");
        return;
      }
      await this.detector.detectObject(imgBlob);
    } catch (err) {
      console.error("Detection error:", err);
    } finally {
      this._isDetecting = false;
    }
  }

  updateTracking() {
    let detection = this.detector.getCurrentDetection();

    if (detection && detection.box && detection !== this._lastVotedDetection) {
      this._isTracking = this.tracker.init(
        this.camera.takePictureResized(false),
        detection.box,
      );
    }

    if (this._isTracking) {
      // Use resized picture for tracking to match initialization
      detection = this.tracker.track(this.camera.takePictureResized(false));
      if (detection == null) {
        this._isTracking = false;
        this._countOfSuccessfulTrackingiterations = 0;
        this.tracker.clearCanvas();
        if (this.depthUI) {
          this.depthUI.clearCanvas();
        }
      } else {
        // Scale back up from resized coordinates to full picture coordinates
        detection.box = this.camera.scaleBoundingBoxFromResized(detection.box);

        this._CurrentBoundingBox = detection.box;

        detection.box = this.camera.translateBoundingBoxToWindowScaling(
          detection.box,
        );

        if (this._objectLabel) {
          detection.label = this._objectLabel;
        }

        this.tracker.drawRectangle(detection.box);

        this._countOfSuccessfulTrackingiterations++;
      }
    }
  }

  updateSensor() {
    if (!this.sensor) return;

    if (this._isTracking) {
      this.sensor.start();

      const detection = this.detector.getCurrentDetection();
      if (
        detection &&
        detection.box &&
        detection !== this._lastVotedDetection
      ) {
        this.voteOnSensorStage(detection.box);
        this._lastVotedDetection = detection;
      }
    } else {
      this.sensor.stop();
    }
  }

  async updateDepth() {
    if (!this.depth || !this.depthUI) return;
    this._isDepthEstimating = true;
    try {
      const depthPrediction = await this.depth.predict(
        this.camera.takePicture(false),
      );

      this.depthUI.setDepthPrediction(depthPrediction);
      this.depthUI.updateDepthCanvas();
      //Scale objectPosition based on raw camera input to depth map resoulution
      const obj_depth = this.depthUI.updateDepthOfObject(
        this._CurrentBoundingBox,
        this.depth,
      );
      this._currentAvgDepth = obj_depth;
      // if (this.sensor) this.sensor.update(obj_depth);
    } catch (err) {
      console.error("Depth estimation error:", err);
    } finally {
      this._isDepthEstimating = false;
    }
  }

  updateCanvasDimensions() {
    this.camera.updateVisibleRegion();
    this.camera.setDimensionsAndPosition(
      this.camera.visibleRegion.width,
      this.camera.visibleRegion.height,
    );
    this.tracker.setDimensionsAndPosition(
      window.innerWidth,
      window.innerHeight,
    );
  }

  voteOnSensorStage(newBox) {
    if (!this.sensor || !newBox) return;

    // Calculate area of new box (format: [x1, y1, x2, y2])
    const [x1, y1, x2, y2] = newBox;
    const w = x2 - x1;
    const h = y2 - y1;
    const currentArea = w * h;
    const currentDepth = this._currentAvgDepth; // Uses the latest available depth

    // First run initialization
    if (this._lastDetectionArea === 0) {
      this._lastDetectionArea = currentArea;
      this._lastDetectionDepth = currentDepth;
      return;
    }

    // Logic for Increasing Stage (Closer)
    // Area increased by >10% AND Depth value increased by >25
    if (
      currentArea >= this._lastDetectionArea * 1.0 &&
      currentDepth >= this._lastDetectionDepth + 15
    ) {
      this.sensor.increaseStage();
      console.log("increasing stage of parking sensor");
    }
    // Logic for Decreasing Stage (Farther)
    // Area decreased by >10% (current <= last * 0.9) AND Depth value decreased by >25
    else if (
      currentArea <= this._lastDetectionArea * 1.0 &&
      currentDepth <= this._lastDetectionDepth - 15
    ) {
      this.sensor.decreaseStage();
      console.log("decreasing stage of parking sensor");
    } else {
      const dArea = currentArea - this._lastDetectionArea;
      const dDepth = currentDepth - this._lastDetectionDepth;
      const reason =
        dArea >= 0
          ? `Area grew (d=${dArea.toFixed(0)}) but Depth (d=${dDepth.toFixed(2)}) < 15`
          : `Area shrank (d=${dArea.toFixed(0)}) but Depth (d=${dDepth.toFixed(2)}) > -15`;
      console.log(`Vote lost: ${reason}`);
    }

    // Update references
    this._lastDetectionArea = currentArea;
    this._lastDetectionDepth = currentDepth;
  }
}
