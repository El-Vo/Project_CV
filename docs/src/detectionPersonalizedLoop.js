import { CONFIG } from "./modules/config.js";
import { RemotePersonalizedDetection } from "./modules/bounding_box_detectors/remotePersonalizedDetection.js";
import { DetectionLoop } from "./detectionLoop.js";

export class DetectionPersonalizedLoop extends DetectionLoop {
  constructor() {
    super();
    this.detector = new RemotePersonalizedDetection();
  }

  loop() {
    // Object detection step
    if (
      !this._isDetecting &&
      !this._isTracking &&
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

    requestAnimationFrame(() => this.loop());
  }
}
