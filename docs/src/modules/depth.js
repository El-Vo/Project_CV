import { pipeline, env, RawImage } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.0';
import { CONFIG } from './config.js';

env.allowLocalModels = false;

export class DepthEstimator {
    constructor(modelId) {
        this.modelId = modelId;
        this.estimator = null;
        this.canvas = null;
        this.ctx = null;
    }

    async init() {
        console.log("Initializing Depth Estimator with model:", this.modelId);
        
        // Optimize for browser environment
        env.backends.onnx.wasm.numThreads = 1; // Prevent issues with missing COOP/COEP headers
        
        try {
            this.estimator = await pipeline('depth-estimation', this.modelId, {
                device: 'webgpu',
            });
            console.log("Depth Anything V2 loaded on WebGPU");
        } catch (err) {
            console.warn("WebGPU failed, falling back to WASM with quantization:", err);
            try {
                // Using q8 (8-bit quantization) is much more stable and faster for WASM
                this.estimator = await pipeline('depth-estimation', this.modelId, {
                    device: 'wasm',
                    dtype: 'q8', 
                });
                console.log("Depth Anything V2 loaded on WASM (q8)");
            } catch (wasmErr) {
                console.error("Critical: Depth estimation failed to load entirely:", wasmErr);
                this.estimator = null; 
            }
        } finally {
            // Ensure canvas is created even if estimator fails
            this.canvas = new OffscreenCanvas(1, 1);
            this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        }
    }

    async predict(videoElement, visibleRegion = null) {
        if (!this.estimator || !videoElement) return null;

        // Determine source rectangle (full video or visible region)
        let sx = 0;
        let sy = 0;
        let sw = videoElement.videoWidth || videoElement.width;
        let sh = videoElement.videoHeight || videoElement.height;

        if (visibleRegion && visibleRegion.width > 0 && visibleRegion.height > 0) {
            sx = visibleRegion.x;
            sy = visibleRegion.y;
            sw = visibleRegion.width;
            sh = visibleRegion.height;
        }

        // Calculate target dimensions maintaining aspect ratio
        // We use CONFIG.DEPTH_WIDTH/HEIGHT as maximum bounds
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
        if (this.canvas.width !== targetWidth || this.canvas.height !== targetHeight) {
            this.canvas.width = targetWidth;
            this.canvas.height = targetHeight;
        }

        // Draw the region of interest and rescale to target dimensions
        this.ctx.drawImage(videoElement, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);
        const rawImage = await RawImage.fromCanvas(this.canvas);
        
        const output = await this.estimator(rawImage);
        return output.depth;
    }
}
