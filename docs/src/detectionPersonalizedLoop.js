import { CONFIG } from "./modules/config.js";
import { DepthEstimator } from "./modules/depth.js";
import { ParkingSensor } from "./modules/audio.js";
import { UI } from "./modules/ui.js";
import { CameraHandler } from "./modules/camera.js";
import { RemotePersonalizedDetection } from "./modules/bounding_box_detectors/remotePersonalizedDetection.js";
import { FeatureTracker } from "./modules/display/tracking.js";
import { DepthUIController } from "./modules/display/depthUI.js";

export class DetectionPersonalizedLoop {
  #lastDetectionTimestamp = 0;
  #lastTrackingTimestamp = 0;
  #countOfSuccessfulTrackingiterations = 0;
  #lastDepthEstimationTimestamp = 0;
  #isDetecting = false;
  #isTracking = false;
  #isDepthEstimating = false;
  #CurrentObjectCenter = { x: 0, y: 0 };

  depthCanvas = document.getElementById("depth-canvas");
  detectionCanvas = document.getElementById("detection-canvas");
  webcam = document.getElementById("webcam");
  captureCanvas = document.getElementById("capture-canvas");

  constructor() {
    this.camera = new CameraHandler(this.webcam, this.captureCanvas);
    this.camera.start().then(() => {
      this.updateCanvasDimensions();
    });

    this.detector = new RemotePersonalizedDetection();
    this.tracker = new FeatureTracker(this.detectionCanvas);
    this.depth = new DepthEstimator(CONFIG.DEPTH_MODEL);
    this.depth.init();
    this.depthUI = new DepthUIController(this.depthCanvas);
    this.sensor = new ParkingSensor();
    this.sensor.init();

    window.addEventListener("resize", () => {
      this.updateCanvasDimensions();
    });
  }

  loop() {
    // Object detection step
    if (
      !this.#isDetecting &&
      !this.#isTracking &&
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

    //Depth estimation step
    if (
      this.#isTracking &&
      !this.#isDepthEstimating &&
      performance.now() >
        this.#lastDepthEstimationTimestamp + 1000 / CONFIG.DEPTH_FPS_TARGET
    ) {
      this.updateDepth();
      this.#lastDepthEstimationTimestamp = performance.now();
    }

    /*     //Clear bounding boxes if no text input is given and stop audio
    if (!this.#isTracking) {
      this.tracker.clearCanvas();
      this.sensor.stop();
    } */

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
    let detection = this.detector.getCurrentDetection();

    if (detection != null && detection.box) {
      this.#isTracking = this.tracker.init(
        this.camera.takePictureResized(false),
        detection.box,
      );
      this.sensor.start();
    }

    if (this.#isTracking) {
      // Use resized picture for tracking to match initialization
      detection = this.tracker.track(this.camera.takePictureResized(false));
      if (detection == null) {
        this.#isTracking = false;
        this.#countOfSuccessfulTrackingiterations = 0;
        this.tracker.clearCanvas();
        this.sensor.stop();
      } else {
        // Scale back up from resized coordinates to full picture coordinates
        detection.box = this.camera.scaleBoundingBoxFromResized(detection.box);

        this.updateObjectCenter(detection.box);

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

  updateObjectCenter(box) {
    let [x1, y1, x2, y2] = box;
    this.#CurrentObjectCenter = {
      x: (x2 - x1) / 2,
      y: (y2 - y1) / 2,
    };
  }

  async updateDepth() {
    this.#isDepthEstimating = true;
    try {
      const depthPrediction = await this.depth.predict(
        this.camera.takePicture(false),
      );

      this.depthUI.setDepthPrediction(depthPrediction);
      this.depthUI.updateDepthCanvas();
      //Scale objectPosition based on raw camera input to depth map resoulution
      const depthObjectCenter = {
        x: this.depth.scaleRawCameraToDepthX(this.#CurrentObjectCenter.x),
        y: this.depth.scaleRawCameraToDepthY(this.#CurrentObjectCenter.y),
      };
      const obj_depth = this.depthUI.updateDepthOfObject(depthObjectCenter);
      this.sensor.update(obj_depth);
    } catch (err) {
      console.error("Depth estimation error:", err);
    } finally {
      this.#isDepthEstimating = false;
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
}
