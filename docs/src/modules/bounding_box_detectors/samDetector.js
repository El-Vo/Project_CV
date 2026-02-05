import { CanvasManager2d } from "../display/CanvasManager2d.js";
import { Detector } from "./detector.js";
import { getBoundingBoxFromCoordAPI } from "../api.js";

export class SAMDetection extends Detector {
  constructor(canvas) {
    super();
    this.canvasManager = new CanvasManager2d(canvas);
    this.canvasManager.canvas.style.pointerEvents = "auto"; // Enable clicks
    this.canvasManager.canvas.style.zIndex = "15"; // Ensure it's above the video but below controls
    this.initiateCenterDot();
  }

  initiateCenterDot() {
    this.canvasManager.drawCenteredBox();
  }

  async detectObject(image_jpg_blob) {
    let [x, y] = this.canvasManager.getCenterCoordinatesOfCanvas();
    const response = await getBoundingBoxFromCoordAPI(x, y, image_jpg_blob);
    if (!response.ok) return null;
    const data = await response.json();
    this.objectDetected = data.detection;
  }
}
