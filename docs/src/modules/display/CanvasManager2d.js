export class CanvasManager2d {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = this.canvas.getContext("2d", {
      willReadFrequently: true,
    });
    this.percent = 0.02;
    this.minSize = 1;
    this.maxSize = 120;
  }

  clearCanvas() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawDetection(det) {
    if (!det) return;
    this.clearCanvas(this.ctx, this.canvas);

    let [x1, y1, x2, y2] = det.box;
    this.drawRectangle([x1, y1, x2, y2]);

    this.ctx.fillStyle = "#32c8ff";
    const label = `${det.label} (${Math.round(det.score * 100)}%)`;
    this.ctx.font = "bold 18px Arial";
    this.ctx.fillRect(x1, y1 - 25, this.ctx.measureText(label).width + 10, 25);
    this.ctx.fillStyle = "black";
    this.ctx.fillText(label, x1 + 5, y1 - 7);
  }

  drawRectangle([x1, y1, x2, y2]) {
    this.clearCanvas(this.ctx, this.canvas);
    this.ctx.strokeStyle = "#32c8ff";
    this.ctx.lineWidth = 4;
    this.ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
  }

  drawCenteredBox() {
    const cw = this.canvas.width || this.canvas.clientWidth || 0;
    const size = Math.max(
      this.minSize,
      Math.min(this.maxSize, Math.round(cw * this.percent)),
    );
    let [cx, cy] = this.getCenterCoordinatesOfCanvas();
    const x1 = cx - Math.round(size / 2);
    const y1 = cy - Math.round(size / 2);
    const x2 = x1 + size;
    const y2 = y1 + size;
    this.drawRectangle([x1, y1, x2, y2]);
    return [x1, y1, x2, y2];
  }

  setDimensionsAndPosition(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.style.position = "absolute";
    this.canvas.style.top = "0";
    this.canvas.style.left = "0";
  }

  getCenterCoordinatesOfCanvas() {
    const cw = this.canvas.width || this.canvas.clientWidth || 0;
    const ch = this.canvas.height || this.canvas.clientHeight || 0;
    const cx = Math.round(cw / 2);
    const cy = Math.round(ch / 2);
    return [cx, cy];
  }
}
