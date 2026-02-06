import { CONFIG } from "./modules/config.js";
import { UI } from "./modules/ui.js";
import { RemoteGenericDetection } from "./modules/bounding_box_detectors/remoteGenericDetection.js";
import { DetectionLoop } from "./detectionLoop.js";
import { TextToSpeech } from "./modules/tts.js";

export class DetectionGenericLoop extends DetectionLoop {
  constructor() {
    super();
    this.detector = new RemoteGenericDetection();
    TextToSpeech.speak("Starting object search.");
  }

  loop() {
    // Object detection step
    if (
      !this._isDetecting &&
      UI.getTextPrompt() != "" &&
      performance.now() >
        this._lastDetectionTimestamp + 1000 / CONFIG.DETECTION_FPS_TARGET
    ) {
      this.updateObjectDetection();
      this._lastDetectionTimestamp = performance.now();
    }

    //Object tracking step
    if (
      performance.now() >
      this._lastTrackingTimestamp + 1000 / CONFIG.TRACKER_FPS_TARGET
    ) {
      this.updateTracking();
      this._lastTrackingTimestamp = performance.now();
    }

    //Depth estimation step
    if (
      this._isTracking &&
      !this._isDepthEstimating &&
      performance.now() >
        this._lastDepthEstimationTimestamp + 1000 / CONFIG.DEPTH_FPS_TARGET
    ) {
      this.updateDepth();
      this._lastDepthEstimationTimestamp = performance.now();
    }

    //Sensor update step
    this.updateSensor();

    //Clear bounding boxes if no text input is given and stop audio
    if (UI.getTextPrompt() == "") {
      this.tracker.clearCanvas();
      if (this.sensor) this.sensor.stop();
    }

    requestAnimationFrame(() => this.loop());
  }
}
