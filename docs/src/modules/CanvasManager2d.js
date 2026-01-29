export class CanvasManager2d {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = this.canvas.getContext("2d", {
      willReadFrequently: true,
    });
  }

  clearCanvas() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawDetection(det) {
    if (!det) return;
    this.clearCanvas(this.ctx, this.canvas);

    let [x1, y1, x2, y2] = det.box;

    this.ctx.strokeStyle = "#32c8ff";
    this.ctx.lineWidth = 4;
    this.ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

    this.ctx.fillStyle = "#32c8ff";
    const label = `${det.label} (${Math.round(det.confidence * 100)}%)`;
    this.ctx.font = "bold 18px Arial";
    this.ctx.fillRect(x1, y1 - 25, this.ctx.measureText(label).width + 10, 25);
    this.ctx.fillStyle = "black";
    this.ctx.fillText(label, x1 + 5, y1 - 7);
  }

  setDimensionsAndPosition(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.style.position = "absolute";
    this.canvas.style.top = "0";
    this.canvas.style.left = "0";
  }
}
