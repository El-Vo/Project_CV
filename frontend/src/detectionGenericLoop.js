import { CONFIG } from "./modules/config.js";
import { UI } from "./modules/ui.js";
import { RemoteGenericDetection } from "./modules/bounding_box_detectors/remoteGenericDetection.js";
import { DetectionLoop } from "./detectionLoop.js";
import { TextToSpeech } from "./modules/tts.js";
import { PerformanceMetrics } from "./modules/performanceMetrics.js";

export class DetectionGenericLoop extends DetectionLoop {
  constructor() {
    super();
    this.detector = new RemoteGenericDetection();
    this.metrics = new PerformanceMetrics();
    TextToSpeech.speak("Starting object search.");
  }

  loop() {
    const prompt = UI.getTextPrompt();
    if (prompt !== "") {
      this.metrics.startSearch(prompt);
    }

    // Object detection step
    if (
      !this._isDetecting &&
      prompt != "" &&
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

    if (!this._isTracking) {
      this.depthUI.clearCanvas();
    }

    //Sensor update step
    this.updateSensor();

    //Clear bounding boxes if no text input is given and stop audio
    if (UI.getTextPrompt() == "") {
      this.tracker.clearCanvas();
      if (this.sensor) this.sensor.stop();
      this.depthUI.clearCanvas();
    }

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
