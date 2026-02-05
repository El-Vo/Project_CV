import { CONFIG } from "./modules/config.js";
import { CameraHandler } from "./modules/camera.js";
import { FeatureTracker } from "./modules/display/tracking.js";
import { DepthEstimator } from "./modules/depth.js";
import { ParkingSensor } from "./modules/audio.js";
import { DepthUIController } from "./modules/display/depthUI.js";

export class DetectionLoop {
  _lastDetectionTimestamp = 0;
  _lastTrackingTimestamp = 0;
  _countOfSuccessfulTrackingiterations = 0;
  _lastDepthEstimationTimestamp = 0;
  _isDetecting = false;
  _isTracking = false;
  _isDepthEstimating = false;
  _CurrentObjectCenter = { x: 0, y: 0 };
  _objectLabel = null;

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
      const prompt = UI.getTextPrompt();
      TextToSpeech.speak(`Found ${prompt}`);
    }
  }

  updateTracking() {
    let detection = this.detector.getCurrentDetection();

    if (detection != null && detection.box) {
      this._isTracking = this.tracker.init(
        this.camera.takePictureResized(false),
        detection.box,
      );
      if (this.sensor) this.sensor.start();
    }

    if (this._isTracking) {
      // Use resized picture for tracking to match initialization
      detection = this.tracker.track(this.camera.takePictureResized(false));
      if (detection == null) {
        this._isTracking = false;
        this._countOfSuccessfulTrackingiterations = 0;
        this.tracker.clearCanvas();
        if (this.sensor) this.sensor.stop();
      } else {
        // Scale back up from resized coordinates to full picture coordinates
        detection.box = this.camera.scaleBoundingBoxFromResized(detection.box);

        this.updateObjectCenter(detection.box);

        detection.box = this.camera.translateBoundingBoxToWindowScaling(
          detection.box,
        );

        if (this._objectLabel) {
          detection.label = this._objectLabel;
        }

        this.tracker.drawDetection(detection);

        this._countOfSuccessfulTrackingiterations++;
      }
    }

    if (
      this._countOfSuccessfulTrackingiterations > this._maxTrackingIterations
    ) {
      this._isTracking = false;
      this._countOfSuccessfulTrackingiterations = 0;
      if (this.sensor) this.sensor.stop();
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
      const depthObjectCenter = {
        x: this.depth.scaleRawCameraToDepthX(this._CurrentObjectCenter.x),
        y: this.depth.scaleRawCameraToDepthY(this._CurrentObjectCenter.y),
      };
      const obj_depth = this.depthUI.updateDepthOfObject(depthObjectCenter);
      if (this.sensor) this.sensor.update(obj_depth);
    } catch (err) {
      console.error("Depth estimation error:", err);
    } finally {
      this._isDepthEstimating = false;
    }
  }

  updateObjectCenter(box) {
    let [x1, y1, x2, y2] = box;
    this._CurrentObjectCenter = {
      x: (x2 - x1) / 2,
      y: (y2 - y1) / 2,
    };
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
}
