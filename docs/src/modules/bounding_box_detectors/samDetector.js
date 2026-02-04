import { CanvasManager2d } from "../display/CanvasManager2d.js";
import { Detector } from "../detector.js";
import { getBoundingBoxFromCoordAPI } from "../api.js";

export class SAMDetection extends Detector {
  constructor(canvas) {
    super();
    this.canvasManager = new CanvasManager2d(canvas);
    this.handleTap = (e) => this.startDetectionFromTap(e);
    this.canvasManager.canvas.addEventListener("click", this.handleTap);
    this.canvasManager.canvas.style.pointerEvents = "auto"; // Enable clicks
    this.canvasManager.canvas.style.zIndex = "15"; // Ensure it's above the video but below controls
    this.initiateRedDot();
  }

  initiateRedDot() {
    this.canvasManager.drawCenteredBox();
  }

  startDetectionFromTap(event) {
    console.log("Tap detected, X: " + event.clientX + " Y: " + event.clientY);

    this.detectObject(x, y);
  }

  async detectObject(x, y, image_jpg_blob) {
    let [x, y] = this.canvasManager.getCenterCoordinatesOfCanvas();
    const response = await getBoundingBoxFromCoordAPI(
      UI.getTextPrompt(),
      image_jpg_blob,
    );
    if (!response.ok) return null;
    const data = await response.json();
    this.objectDetected = data.detection;
  }
}
