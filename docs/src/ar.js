import { CameraHandler } from "./modules/camera.js";
import { DetectionGenericLoop } from "./detectionGenericLoop.js";
import { ScanningLoop } from "./scanningLoop.js";
import { UI } from "./modules/ui.js";

export class AR {
  webcam = document.getElementById("webcam");
  captureCanvas = document.getElementById("capture-canvas");

  constructor() {
    this.camera = new CameraHandler(this.webcam, this.captureCanvas);
    this.camera.start().then(() => {
      this.updateCanvasDimensions();
    });

    this.detectionLoop = new DetectionGenericLoop(this.camera);
    this.scanningLoop = new ScanningLoop(this.camera);

    // Update visible region on window resize
    window.addEventListener("resize", () => {
      this.updateCanvasDimensions();
    });
  }

  loop() {
    if (UI.isScanningMode) {
      this.scanningLoop.scanningLoopIteration();
    } else {
      this.detectionLoop.loop();
    }
    requestAnimationFrame(() => this.loop());
  }

  updateCanvasDimensions() {
    this.camera.updateVisibleRegion();
    this.camera.setDimensionsAndPosition(
      this.camera.visibleRegion.width,
      this.camera.visibleRegion.height,
    );
  }
}

const main = new AR();
main.loop();
