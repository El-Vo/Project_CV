import {
  pipeline,
  env,
  RawImage,
} from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.0";
import { CONFIG } from "./config.js";
import { UI } from "./ui.js";

export class DepthEstimator {
  constructor(modelId) {
    this.modelId = modelId;
    this.estimator = null;
    //This canvas is not done by the CanvasManager2d because it is an offscreen-canvas
    this.canvas = null;
    this.ctx = null;
    this.rawCameraToDepthXFactor = 0;
    this.rawCameraToDepthYFactor = 0;
  }

  async init() {
    console.log("Initializing Depth Estimator...");

    // Initializing canvas early to avoid null-pointer errors in predict()
    this.canvas = new OffscreenCanvas(1, 1);
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });

    // 1. Force environment as early as possible
    env.allowLocalModels = false;

    // 2. Stable WASM settings for Mobile
    if (env.backends && env.backends.onnx) {
      env.backends.onnx.wasm.numThreads = 1;
      env.backends.onnx.wasm.proxy = false; // Main-thread execution for maximum stability
    }

    let usedBackend = "unknown";

    // Try backends in order: WebGPU (GPU) -> WebNN (NPU) -> WASM (CPU)
    try {
      console.log("Attempting WebGPU...");
      this.estimator = await pipeline("depth-estimation", this.modelId, {
        device: "webgpu",
      });
      usedBackend = "WebGPU";
    } catch (gpuErr) {
      console.log("WebGPU skipped/failed:", gpuErr.message || gpuErr);
      try {
        // WebNN Attempt (Experimental)
        console.log("Attempting WebNN...");
        this.estimator = await pipeline("depth-estimation", this.modelId, {
          device: "webnn",
          dtype: "fp32",
        });
        usedBackend = "WebNN";
      } catch (webnnErr) {
        console.log("WebNN skipped/failed:", webnnErr.message || webnnErr);
        try {
          console.log("Initializing WASM Fallback...");
          this.estimator = await pipeline("depth-estimation", this.modelId, {
            device: "wasm",
            dtype: "q8",
          });
          usedBackend = "WASM";
        } catch (wasmErr) {
          console.error(
            "Critical: Fallback failed:",
            wasmErr.message || wasmErr,
          );
        }
      }
    }

    if (this.estimator) {
      console.log(`Status: Depth Estimator Ready (${usedBackend}).`);

      // UI.usedBackend.innerText = usedBackend;
    }
  }

  async predict(input) {
    if (!this.estimator || !this.canvas) return null;

    let imageSource = input;

    // Determine source dimensions directly from the input
    let sx = 0;
    let sy = 0;
    let sw = imageSource.width;
    let sh = imageSource.height;

    // Calculate target dimensions maintaining aspect ratio
    let targetWidth = sw;
    let targetHeight = sh;
    const aspectRatio = sw / sh;

    if (sw > sh) {
      targetWidth = CONFIG.DEPTH_WIDTH;
      targetHeight = Math.round(targetWidth / aspectRatio);
    } else {
      targetHeight = CONFIG.DEPTH_HEIGHT;
      targetWidth = Math.round(targetHeight * aspectRatio);
    }

    // Ensure dimensions are divisible by 14
    targetWidth = Math.max(14, Math.round(targetWidth / 14) * 14);
    targetHeight = Math.max(14, Math.round(targetHeight / 14) * 14);

    // Sync internal canvas dimensions to target resolution
    if (
      this.canvas.width !== targetWidth ||
      this.canvas.height !== targetHeight
    ) {
      this.canvas.width = targetWidth;
      this.canvas.height = targetHeight;
    }

    // Draw the region of interest and rescale to target dimensions
    this.ctx.drawImage(
      imageSource,
      sx,
      sy,
      sw,
      sh,
      0,
      0,
      targetWidth,
      targetHeight,
    );

    //Update scaling factors for later conversions
    this.rawCameraToDepthXFactor = imageSource.width / targetWidth;
    this.rawCameraToDepthYFactor = imageSource.height / targetHeight;

    const rawImage = await RawImage.fromCanvas(this.canvas);

    const output = await this.estimator(rawImage);
    return output.depth;
  }

  scaleRawCameraToDepthX(RawCameraX) {
    return RawCameraX / this.rawCameraToDepthXFactor;
  }

  scaleRawCameraToDepthY(RawCameraY) {
    return RawCameraY / this.rawCameraToDepthYFactor;
  }
}
