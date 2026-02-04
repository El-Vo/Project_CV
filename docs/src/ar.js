import { CONFIG } from "./modules/config.js";
import { CameraHandler } from "./modules/camera.js";
import { DepthEstimator } from "./modules/depth.js";
import { ParkingSensor } from "./modules/audio.js";
import { UI } from "./modules/ui.js";
import { RemoteGenericDetection } from "./modules/bounding_box_detectors/remoteGenericDetection.js";
import { RemotePersonalizedDetection } from "./modules/bounding_box_detectors/remotePersonalizedDetection.js";
import { FeatureTracker } from "./modules/display/tracking.js";
import { TapDetection } from "./modules/bounding_box_detectors/tapDetection.js";
import { DepthUIController } from "./modules/display/depthUI.js";
import { DetectionLoop } from "./detectionLoop.js";
import { ScanningLoop } from "./scanningLoop.js";

export class AR {
  webcam = document.getElementById("webcam");
  captureCanvas = document.getElementById("capture-canvas");

  constructor() {
    this.camera = new CameraHandler(this.webcam, this.captureCanvas);
    this.camera.start().then(() => {
      this.updateCanvasDimensions();
    });

    this.detectionLoop = new DetectionLoop();

    this.scanningLoop = new ScanningLoop();

    // Update visible region on window resize
    window.addEventListener("resize", () => {
      this.updateCanvasDimensions();
    });
  }

  loop() {
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
