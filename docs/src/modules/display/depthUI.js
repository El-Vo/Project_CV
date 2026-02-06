import { CanvasManager2d } from "./CanvasManager2d.js";
import { UI } from "../ui.js";

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

  updateDepthOfObject(boundingBox, depthEstimator) {
    if (
      this.depthPrediction == null ||
      boundingBox == null ||
      depthEstimator == null
    ) {
      return;
    }

    // Extract depth data and dimensions
    const { width, height, data } = this.depthPrediction;
    const [x1, y1, x2, y2] = boundingBox;
    const numPoints = 10;
    let totalDepth = 0;
    let validPoints = 0;

    for (let i = 0; i < numPoints; i++) {
      // Random point within bounding box
      const randX = x1 + Math.random() * (x2 - x1);
      const randY = y1 + Math.random() * (y2 - y1);

      // Scale to depth map coordinates
      const tx = Math.floor(depthEstimator.scaleRawCameraToDepthX(randX));
      const ty = Math.floor(depthEstimator.scaleRawCameraToDepthY(randY));

      // Check bounds
      if (tx >= 0 && tx < width && ty >= 0 && ty < height) {
        const idx = ty * width + tx;
        const val = data[idx];
        if (val) {
          totalDepth += val;
          validPoints++;
        }
      }
    }

    const avgDepth = validPoints > 0 ? totalDepth / validPoints : 0;

    // Update UI
    if (UI.distanceEl) {
      UI.distanceEl.innerText = avgDepth ? avgDepth.toFixed(3) : "--";
    }

    return avgDepth;
  }
}
