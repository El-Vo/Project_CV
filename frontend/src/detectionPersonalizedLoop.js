import { CONFIG } from "./modules/config.js";
import { RemotePersonalizedDetection } from "./modules/bounding_box_detectors/remotePersonalizedDetection.js";
import { DetectionLoop } from "./detectionLoop.js";
import { TextToSpeech } from "./modules/tts.js";
import { PerformanceMetrics } from "./modules/performanceMetrics.js";

export class DetectionPersonalizedLoop extends DetectionLoop {
  constructor() {
    super();
    this.detector = new RemotePersonalizedDetection();
    this.metrics = new PerformanceMetrics();

    this._targetLabel = localStorage.getItem("selectedTargetLabel");

    if (this._targetLabel) {
      TextToSpeech.speak(`Starting search for ${this._targetLabel}.`);
      this.metrics.startSearch(this._targetLabel);
    } else {
      TextToSpeech.speak(
        "No label identified, please select a valid label from the menu before.",
      );
    }
  }

  async updateObjectDetection() {
    this._isDetecting = true;
    try {
      const imgBlob = await this.camera.takePictureResized();
      if (!imgBlob) {
        console.warn("Could not take picture: Blob is null");
        return;
      }
      await this.detector.detectObject(imgBlob, this._targetLabel);
    } catch (err) {
      console.error("Detection error:", err);
    } finally {
      this._isDetecting = false;
    }
  }

  loop() {
    // Object detection step
    if (
      !this._isDetecting &&
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

    if (!this._isTracking) {
      this.depthUI.clearCanvas();
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

    this.updateMetricsUI();
    requestAnimationFrame(() => this.loop());
  }

  updateTracking() {
    const wasTracking = this._isTracking;
    super.updateTracking();

    if (!wasTracking && this._isTracking) {
      this.metrics.objectDetected();
    } else if (wasTracking && !this._isTracking) {
      if (this.metrics.sessionState.isGuiding) {
        this.metrics.guidanceAborted();
      } else {
        // Object lost (e.g. after successful completion) -> Restart search for next run
        this.metrics.startSearch(this._targetLabel);
      }
    }
  }

  updateSensor() {
    super.updateSensor();
    if (this.sensor && this.sensor.currentStage === 5) {
      this.metrics.guidanceCompleted();
    }
  }

  updateMetricsUI() {
    const el = document.getElementById("metrics-display");
    if (el) el.innerHTML = this.metrics.getMetricsDisplay();
  }
}
