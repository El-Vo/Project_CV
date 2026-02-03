import { Detector } from "./detector.js";

export class TapDetection extends Detector {
  constructor(canvas) {
    super();
    this.canvas = canvas;
    this.ctx = this.canvas.getContext("2d", {
      willReadFrequently: true,
    });
    this.handleTap = (e) => this.getDetectionFromTap(e);
    this.canvas.addEventListener("click", this.handleTap);
    this.canvas.style.pointerEvents = "auto"; // Enable clicks
    this.canvas.style.zIndex = "15"; // Ensure it's above the video but below controls
  }

  getDetectionFromTap(event) {
    console.log("Tap detected, X: " + event.clientX + " Y: " + event.clientY);

    this.objectDetected = {
      box: this.calculateTapBoxCoordinates(event.clientX, event.clientY),
      score: 1,
      label: "Manual",
    };

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    let [x1, y1, x2, y2] = this.objectDetected.box;

    this.ctx.strokeStyle = "#32c8ff";
    this.ctx.lineWidth = 4;
    this.ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

    this.ctx.fillStyle = "#32c8ff";
    const label = `${this.objectDetected.label} (${Math.round(this.objectDetected.score * 100)}%)`;
    this.ctx.font = "bold 18px Arial";
    this.ctx.fillRect(x1, y1 - 25, this.ctx.measureText(label).width + 10, 25);
    this.ctx.fillStyle = "black";
    this.ctx.fillText(label, x1 + 5, y1 - 7);
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
