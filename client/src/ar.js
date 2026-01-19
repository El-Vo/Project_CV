import { pipeline, env, RawImage } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.0';

env.allowLocalModels = false;

let estimator;
let video, canvas, ctx;
let isRunning = false;
let depthData = null;

// Persistent offscreen canvas for frame capture
const offscreenCanvas = document.createElement('canvas');
const offscreenCtx = offscreenCanvas.getContext('2d', { willReadFrequently: true });

const distanceEl = document.getElementById('distance');

async function init() {
    video = document.getElementById('webcam');
    canvas = document.getElementById('depth-canvas');
    if (canvas) ctx = canvas.getContext('2d');

    try {
        // Initialize the pipeline
        estimator = await pipeline('depth-estimation', 'onnx-community/depth-anything-v2-small', {
            device: 'webgpu', 
        });
        
        // Start camera automatically after model is ready
        startCamera();
    } catch (err) {
        console.error("Initialization error:", err);
        
        // Try fallback to WASM if WebGPU fails explicitly
        if (err.message.includes('WebGPU')) {
            try {
                estimator = await pipeline('depth-estimation', 'onnx-community/depth-anything-v2-small', {
                    device: 'wasm',
                });
                startCamera();
            } catch (wasmErr) {
                console.error('Critical initialization error:', wasmErr);
            }
        }
    }
}

async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
        });
        video.srcObject = stream;
        
        video.onloadedmetadata = () => {
            isRunning = true;
            renderLoop();
        };
    } catch (err) {
        console.error("Camera error:", err);
    }
}

async function renderLoop() {
    if (!isRunning || !estimator) return;

    try {
        // Ensure video is ready
        if (video.readyState < 2) {
            requestAnimationFrame(renderLoop);
            return;
        }

        // Current display aspect ratio of the window (since #webcam is 100vw/100vh with cover)
        const displayAR = window.innerWidth / window.innerHeight;
        
        // Target resolution for depth estimation (keeping it small for performance)
        const targetBase = 160;
        let targetWidth, targetHeight;
        
        if (displayAR > 1) { // Landscape
            targetWidth = targetBase;
            targetHeight = Math.floor(targetBase / displayAR);
        } else { // Portrait
            targetHeight = targetBase;
            targetWidth = Math.floor(targetBase * displayAR);
        }

        if (offscreenCanvas.width !== targetWidth || offscreenCanvas.height !== targetHeight) {
            offscreenCanvas.width = targetWidth;
            offscreenCanvas.height = targetHeight;
        }

        // Calculate source rectangle for object-fit: cover
        const videoAR = video.videoWidth / video.videoHeight;
        let sx, sy, sw, sh;

        if (videoAR > displayAR) {
            // Video is wider than display - crop horizontal
            sw = video.videoHeight * displayAR;
            sh = video.videoHeight;
            sx = (video.videoWidth - sw) / 2;
            sy = 0;
        } else {
            // Video is taller than display - crop vertical
            sw = video.videoWidth;
            sh = video.videoWidth / displayAR;
            sx = 0;
            sy = (video.videoHeight - sh) / 2;
        }
        
        offscreenCtx.drawImage(video, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);

        const rawImage = await RawImage.fromCanvas(offscreenCanvas);

        const output = await estimator(rawImage);
        
        const depthImage = output.depth;
        depthData = depthImage.data; 
        const { width, height } = depthImage;

        if (canvas) {
            const visualCanvas = await depthImage.toCanvas();
            if (canvas.width !== visualCanvas.width || canvas.height !== visualCanvas.height) {
                canvas.width = visualCanvas.width;
                canvas.height = visualCanvas.height;
            }
            ctx.drawImage(visualCanvas, 0, 0);
        }

        updateDistance_DA(width, height);

    } catch (err) {
        console.error("Inference error:", err);
    }

    // Optimization: requestAnimationFrame should be outside the try-catch to keep loop running
    requestAnimationFrame(renderLoop);
}

function updateDistance_DA(width, height) {
    if (!depthData || !distanceEl) return;

    // Calculate the center index
    const midY = Math.floor(height / 2);
    const midX = Math.floor(width / 2);
    const idx = midY * width + midX;
    
    const rawValue = depthData[idx];
    
    // Show raw relative depth for consistency (Higher is closer in Depth Anything V2)
    distanceEl.innerText = rawValue.toFixed(3);
}

// Start initialization
init();
