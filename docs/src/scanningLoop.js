import { SAMDetection } from "./modules/bounding_box_detectors/samDetector.js";
import { Detector } from "./modules/bounding_box_detectors/detector.js";
import { CONFIG } from "./modules/config.js";
import { PersonalObjectPicture } from "./modules/personalObjectPicture.js";
import { DetectionLoop } from "./detectionLoop.js";
import { TextToSpeech } from "./modules/tts.js";
import { LabelValidator } from "./modules/labelValidator.js";

export class ScanningLoop extends DetectionLoop {
  submitBtn = document.getElementById("submit-name-button");
  nameInput = document.getElementById("object-name-input");
  startTrackingBtn = document.getElementById("start-tracking-button");
  _photoCount = 0;

  constructor() {
    super();
    this.detector = new SAMDetection(this.detectionCanvas);
    this.savePersonalizedPicture = new PersonalObjectPicture();
    this._objectLabel = "scanned_object";
    this._maxTrackingIterations = Infinity;

    this.initializeUI();

    TextToSpeech.speak("Starting scan for personal objects");
  }

  initializeUI() {
    this.submitBtn.addEventListener("click", async () => {
      const name = this.nameInput.value.trim();
      if (name) {
        const exists = await LabelValidator.labelExists(name);
        if (exists) {
          alert(
            `The object "${name}" already exists. Please choose a different name.`,
          );
          TextToSpeech.speak(
            "This name is already taken. Please choose another one.",
          );
          return;
        }

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

  updateTracking() {
    const wasTracking = this._isTracking;
    super.updateTracking();
    if (!wasTracking && this._isTracking) {
      this.updateUIForTracking();
    }
  }

  updateUIForTracking() {
    this.startTrackingBtn.innerText = "Take Photo";
    const instructions = document.getElementById("scan-instructions");
    if (instructions) {
      instructions.innerText =
        "Move around the object and take photos from different perspectives.";
    }
    const countContainer = document.getElementById("photo-count-container");
    if (countContainer) {
      countContainer.classList.remove("d-none");
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

      this._photoCount++;
      const countDisplay = document.getElementById("photo-count");
      if (countDisplay) {
        countDisplay.innerText = this._photoCount;
      }
      //Vibrate
    }
  }

  updateCanvasDimensions() {
    super.updateCanvasDimensions();
    this.detector.initiateCenterDot();
  }
}
