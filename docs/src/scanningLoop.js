import { SAMDetection } from "./modules/bounding_box_detectors/samDetector";
import { Detector } from "./modules/bounding_box_detectors/detector";
import { FeatureTracker } from "./modules/display/tracking";
import { CONFIG } from "./modules/config";
import { PersonalObjectPicture } from "./modules/personalObjectPicture";

export class ScanningLoop {
  #lastTrackingTimestamp = 0;
  #isTracking = false;
  #objectLabel = "scanned_object";

  detectionCanvas = document.getElementById("detection-canvas");

  constructor(camera) {
    this.camera = camera;
    this.tracker = new FeatureTracker(this.detectionCanvas);
    this.detector = new SAMDetection(this.detectionCanvas);
    this.savePersonalizedPicture = new PersonalObjectPicture();
    this.detectionCanvas.addEventListener("click", this.analyzeTap);
  }

  scanningLoopIteration() {
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
    let detection = this.detector.getCurrentBoundingBox();

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

        this.updateObjectCenter(detection.box);

        detection.box = this.camera.translateBoundingBoxToWindowScaling(
          detection.box,
        );

        this.tracker.drawDetection(detection);
      }
    }
  }
}
