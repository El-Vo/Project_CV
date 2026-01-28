import { detectObjectAPI } from "./api.js";
import { CanvasManager2d } from "./CanvasManager2d.js";
import { CONFIG } from "./config.js";
import { UI } from "./ui.js";

export class Detection extends CanvasManager2d {
  #isDetectionRunning = false;
  #currentBoundingBox = null;
  #lastDetectionTimestamp = null;

  constructor(canvas, isDetectionRunning = false) {
    super(canvas);
    this.#isDetectionRunning = isDetectionRunning;
    this.handleTap = (e) => this.getDetectionFromTap(e);

    this.setLocalMode();
  }

  setLocalMode(mode = CONFIG.LOCAL_MODE) {
    if (!mode) {
      this.canvas.removeEventListener("click", this.handleTap);
      return;
    }

    this.canvas.style.pointerEvents = "auto"; // Enable clicks
    this.canvas.style.zIndex = "15"; // Ensure it's above the video but below controls
    this.#isDetectionRunning = true; // Always allow tap in local mode

    this.canvas.addEventListener("click", this.handleTap);
  }

  getDetectionFromTap(event) {
    console.log("Tap detected, X: " + event.clientX + " Y: " + event.clientY);

    this.#currentBoundingBox = this.calculateTapBoxCoordinates(
      event.clientX,
      event.clientY,
    );

    const detection = {
      box: this.#currentBoundingBox,
      confidence: 1,
      label: "Manual selection",
    };

    this.drawDetection(detection);
  }

  toggleDetection() {
    this.#isDetectionRunning = !this.#isDetectionRunning;

    if (!this.#isDetectionRunning) {
      this.clearCanvas();
    }
  }

  calculateTapBoxCoordinates(x, y) {
    const boxSize = 60;
    return [
      Math.max(0, x - boxSize / 2),
      Math.max(0, y - boxSize / 2),
      Math.min(this.canvas.width, x + boxSize / 2),
      Math.min(this.canvas.height, y + boxSize / 2),
    ];
  }

  detectObject() {
    return detectObjectAPI(UI.getTextPrompt(), this.canvas.toBlob());
  }

  getDetectionStatus() {
    return this.#isDetectionRunning;
  }

  getCurrentBoundingBox() {
    return this.#currentBoundingBox;
  }
}
