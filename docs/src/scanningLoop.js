import { SAMDetection } from "./modules/bounding_box_detectors/samDetector.js";
import { Detector } from "./modules/bounding_box_detectors/detector.js";
import { FeatureTracker } from "./modules/display/tracking.js";
import { CONFIG } from "./modules/config.js";
import { PersonalObjectPicture } from "./modules/personalObjectPicture.js";
import { CameraHandler } from "./modules/camera.js";

export class ScanningLoop {
  #lastTrackingTimestamp = 0;
  #isTracking = false;
  #objectLabel = "scanned_object";

  detectionCanvas = document.getElementById("detection-canvas");
  webcam = document.getElementById("webcam");
  captureCanvas = document.getElementById("capture-canvas");
  submitBtn = document.getElementById("submit-name-button");
  nameInput = document.getElementById("object-name-input");
  startTrackingBtn = document.getElementById("start-tracking-button");

  constructor() {
    this.camera = new CameraHandler(this.webcam, this.captureCanvas);
    this.camera.start().then(() => {
      this.updateCanvasDimensions();
    });
    this.tracker = new FeatureTracker(this.detectionCanvas);
    this.detector = new SAMDetection(this.detectionCanvas);
    this.savePersonalizedPicture = new PersonalObjectPicture();

    this.initializeUI();
  }

  initializeUI() {
    this.submitBtn.addEventListener("click", () => {
      const name = this.nameInput.value.trim();
      if (name) {
        this.#objectLabel = name;
        document.getElementById("display-object-name").innerText = name;
        document.getElementById("enter-scan-name").classList.add("d-none");
        document.getElementById("scan-take-photos").classList.remove("d-none");
      }
    });

    this.startTrackingBtn.addEventListener("click", () => {
      this.analyzeTap();
    });

    this.detectionCanvas.addEventListener("click", () => this.analyzeTap());
  }

  loop() {
    //Object detection is not initiated through automated recurring search,
    //But through tapping the screen. Thus, it is not called during the loop iteration.
    //Object tracking step
    if (
      performance.now() >
      this.#lastTrackingTimestamp + 1000 / CONFIG.TRACKER_FPS_TARGET
    ) {
      this.updateTracking();
      this.#lastTrackingTimestamp = performance.now();
    }
  }

  async analyzeTap() {
    const imgBlob = await this.camera.takePictureResized();
    if (!imgBlob) {
      console.warn("Could not take picture: Blob is null");
      return;
    }

    if (!this.#isTracking) {
      console.log("Tap detected, initialising bounding box");
      this.detector.detectObject(imgBlob);
    } else {
      console.log("Tap detected while tracking, saving object picture");
      //Building detection object
      let detection = Detector.getDefaultBoundingBox();
      detection.box = this.tracker.currentBox;
      detection.label = this.#objectLabel;
      this.savePersonalizedPicture.saveToDatabase(detection, imgBlob);
      //Vibrate
    }
  }

  updateTracking() {
    let detection = this.detector.getCurrentDetection();

    if (detection != null && detection.box) {
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
        this.tracker.clearCanvas();
      } else {
        // Scale back up from resized coordinates to full picture coordinates
        detection.box = this.camera.scaleBoundingBoxFromResized(detection.box);

        detection.box = this.camera.translateBoundingBoxToWindowScaling(
          detection.box,
        );
        detection.label = this.#objectLabel;
        this.tracker.drawDetection(detection);
      }
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
    this.detector.initiateCenterDot();
  }
}
