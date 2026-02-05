import { SAMDetection } from "./modules/bounding_box_detectors/samDetector.js";
import { Detector } from "./modules/bounding_box_detectors/detector.js";
import { CONFIG } from "./modules/config.js";
import { PersonalObjectPicture } from "./modules/personalObjectPicture.js";
import { DetectionLoop } from "./detectionLoop.js";

export class ScanningLoop extends DetectionLoop {
  submitBtn = document.getElementById("submit-name-button");
  nameInput = document.getElementById("object-name-input");
  startTrackingBtn = document.getElementById("start-tracking-button");

  constructor() {
    super();
    this.detector = new SAMDetection(this.detectionCanvas);
    this.savePersonalizedPicture = new PersonalObjectPicture();
    this._objectLabel = "scanned_object";
    this._maxTrackingIterations = Infinity;

    this.initializeUI();
  }

  initializeUI() {
    this.submitBtn.addEventListener("click", () => {
      const name = this.nameInput.value.trim();
      if (name) {
        this._objectLabel = name;
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
      this._lastTrackingTimestamp + 1000 / CONFIG.TRACKER_FPS_TARGET
    ) {
      this.updateTracking();
      this._lastTrackingTimestamp = performance.now();
    }
  }

  async analyzeTap() {
    const imgBlob = await this.camera.takePictureResized();
    if (!imgBlob) {
      console.warn("Could not take picture: Blob is null");
      return;
    }

    if (!this._isTracking) {
      console.log("Tap detected, initialising bounding box");
      this.detector.detectObject(imgBlob);
    } else {
      console.log("Tap detected while tracking, saving object picture");
      //Building detection object
      let detection = Detector.getDefaultBoundingBox();
      detection.box = this.tracker.currentBox;
      detection.label = this._objectLabel;
      this.savePersonalizedPicture.saveToDatabase(detection, imgBlob);
      //Vibrate
    }
  }

  updateCanvasDimensions() {
    super.updateCanvasDimensions();
    this.detector.initiateCenterDot();
  }
}
