import { pipeline, env, RawImage } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.0';

env.allowLocalModels = false;

export class DepthEstimator {
    constructor(modelId) {
        this.modelId = modelId;
        this.estimator = null;
    }

    async init() {
        try {
            this.estimator = await pipeline('depth-estimation', this.modelId, {
                device: 'webgpu',
            });
            console.log("Depth Anything V2 loaded on WebGPU");
        } catch (err) {
            console.warn("WebGPU failed, falling back to WASM:", err);
            this.estimator = await pipeline('depth-estimation', this.modelId, {
                device: 'wasm',
            });
        }
    }

    async predict(canvas) {
        if (!this.estimator) return null;
        const rawImage = await RawImage.fromCanvas(canvas);
        const output = await this.estimator(rawImage);
        return output.depth;
    }
}
