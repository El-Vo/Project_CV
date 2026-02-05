import { Detector } from "./detector.js";
import { CanvasManager2d } from "../display/CanvasManager2d.js";

export class TapDetection extends Detector {
  constructor(canvas) {
    super();
    this.canvasManager = new CanvasManager2d(canvas);
    this.handleTap = (e) => this.getDetectionFromTap(e);
    this.canvasManager.canvas.addEventListener("click", this.handleTap);
    this.canvasManager.canvas.style.pointerEvents = "auto"; // Enable clicks
    this.canvasManager.canvas.style.zIndex = "15"; // Ensure it's above the video but below controls
  }

  getDetectionFromTap(event) {
    console.log("Tap detected, X: " + event.clientX + " Y: " + event.clientY);

    this.objectDetected = Detector.getDefaultBoundingBox();
    this.objectDetected.box = this.calculateTapBoxCoordinates(
      event.clientX,
      event.clientY,
    );

    this.canvasManager.drawDetection(this.objectDetected);
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
}
