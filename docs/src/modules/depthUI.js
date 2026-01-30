import { CanvasManager2d } from "./CanvasManager2d.js";
import { UI } from "./ui.js";

export class DepthUIController extends CanvasManager2d {
  constructor(canvas) {
    super(canvas);
    this.depthPrediction = null;
  }

  setDepthPrediction(depthPrediction) {
    this.depthPrediction = depthPrediction;
  }

  updateDepthCanvas() {
    if (this.depthPrediction == null) {
      return;
    }

    // Draw visual depth map
    const visualCanvas = this.depthPrediction.toCanvas();
    if (
      this.canvas.width !== visualCanvas.width ||
      this.canvas.height !== visualCanvas.height
    ) {
      this.canvas.width = visualCanvas.width;
      this.canvas.height = visualCanvas.height;
    }
    this.ctx.drawImage(visualCanvas, 0, 0);
  }

  updateDepthOfObject(objectPosition) {
    if (this.depthPrediction == null || objectPosition == null) {
      return;
    }

    // Extract depth data and dimensions
    const { width, height, data } = this.depthPrediction;

    // Calculate index in depth map
    const tx = Math.floor(objectPosition.x);
    const ty = Math.floor(objectPosition.y);
    const idx = Math.max(0, Math.min(width * height - 1, ty * width + tx));

    // Get depth value
    const val = data[idx];

    // Update UI
    if (UI.distanceEl) {
      UI.distanceEl.innerText = val ? val.toFixed(3) : "--";
    }

    return val;
  }
}
