export class Rectangle {
  constructor(height, width) {
    this.height = height;
    this.width = width;
  }

  clearCanvas(ctx, canvas) {
        if (ctx && canvas) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    drawDetection(ctx, canvas, det, sw, sh) {
        if (!ctx || !canvas || !det) return;
        this.clearCanvas(ctx, canvas);

        const [x1, y1, x2, y2] = det.box;
        const scaleX = canvas.width / sw;
        const scaleY = canvas.height / sh;

        const rx = x1 * scaleX;
        const ry = y1 * scaleY;
        const rw = (x2 - x1) * scaleX;
        const rh = (y2 - y1) * scaleY;

        ctx.strokeStyle = '#32c8ff';
        ctx.lineWidth = 4;
        ctx.strokeRect(rx, ry, rw, rh);
        
        ctx.fillStyle = '#32c8ff';
        const label = `${det.label} (${Math.round(det.confidence * 100)}%)`;
        ctx.font = 'bold 18px Arial';
        ctx.fillRect(rx, ry - 25, ctx.measureText(label).width + 10, 25);
        ctx.fillStyle = 'black';
        ctx.fillText(label, rx + 5, ry - 7);
    }

    updateFPS(depthFPS, detFPS) {
        const depthEl = document.getElementById('depth-fps');
        const detEl = document.getElementById('det-fps');
        if (depthEl) depthEl.innerText = depthFPS.toFixed(1);
        if (detEl) detEl.innerText = detFPS.toFixed(1);
    }
}
