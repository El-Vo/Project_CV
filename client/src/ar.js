import { pipeline, env, RawImage } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.0';

env.allowLocalModels = false;

let estimator;
let video, canvas, ctx;
let detCanvas, detCtx, captureCanvas, captureCtx;
let promptInput, toggleDetBtn;

let isRunning = false;
let isDetectionRunning = false;
let depthData = null;
let currentObjectCenter = null; // {x, y} in relative coordinates (0.0 to 1.0)

const API_URL = 'http://localhost:8000/detect';

// Persistent offscreen canvas for frame capture
const offscreenCanvas = document.createElement('canvas');
const offscreenCtx = offscreenCanvas.getContext('2d', { willReadFrequently: true });

const distanceEl = document.getElementById('distance');

async function init() {
    video = document.getElementById('webcam');
    canvas = document.getElementById('depth-canvas');
    if (canvas) ctx = canvas.getContext('2d');

    detCanvas = document.getElementById('detection-overlay');
    if (detCanvas) detCtx = detCanvas.getContext('2d');

    captureCanvas = document.getElementById('captureCanvas');
    if (captureCanvas) captureCtx = captureCanvas.getContext('2d');

    promptInput = document.getElementById('promptInput');
    toggleDetBtn = document.getElementById('toggleDetBtn');

    if (toggleDetBtn) {
        toggleDetBtn.addEventListener('click', () => {
            isDetectionRunning = !isDetectionRunning;
            toggleDetBtn.innerText = isDetectionRunning ? 'Stop Detection' : 'Start Detection';
            if (!isDetectionRunning) {
                currentObjectCenter = null;
                clearDetectionOverlay();
            }
        });
    }

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
            resizeDetectionOverlay();
            renderLoop();
            processDetectionLoop();
        };
    } catch (err) {
        console.error("Camera error:", err);
    }
}

function resizeDetectionOverlay() {
    if (detCanvas) {
        detCanvas.width = window.innerWidth;
        detCanvas.height = window.innerHeight;
    }
}

function clearDetectionOverlay() {
    if (detCtx) {
        detCtx.clearRect(0, 0, detCanvas.width, detCanvas.height);
    }
}

window.addEventListener('resize', () => {
    resizeDetectionOverlay();
});

function getVideoCrop(targetBase) {
    const displayAR = window.innerWidth / window.innerHeight;
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

    let targetWidth, targetHeight;
    if (displayAR > 1) { // Landscape
        targetWidth = targetBase;
        targetHeight = Math.floor(targetBase / displayAR);
    } else { // Portrait
        targetHeight = targetBase;
        targetWidth = Math.floor(targetBase * displayAR);
    }

    return { sx, sy, sw, sh, targetWidth, targetHeight };
}

async function processDetectionLoop() {
    if (!isRunning) {
        setTimeout(processDetectionLoop, 100);
        return;
    }

    if (isDetectionRunning && video.readyState >= 2) {
        const prompt = promptInput.value.trim();
        if (!prompt) {
            setTimeout(processDetectionLoop, 500);
            return;
        }

        const { sx, sy, sw, sh, targetWidth: capWidth, targetHeight: capHeight } = getVideoCrop(640);

        // Prepare capture canvas
        captureCanvas.width = capWidth;
        captureCanvas.height = capHeight;
        
        captureCtx.drawImage(video, sx, sy, sw, sh, 0, 0, capWidth, capHeight);

        captureCanvas.toBlob(async (blob) => {
            if (blob && isDetectionRunning) {
                const formData = new FormData();
                formData.append('file', blob, 'frame.jpg');
                formData.append('prompt', prompt);

                try {
                    const response = await fetch(API_URL, { method: 'POST', body: formData });
                    const data = await response.json();

                    if (data.status === 'success' && data.detections && data.detections.length > 0) {
                        const topDet = data.detections[0];
                        const [x1, y1, x2, y2] = topDet.box;
                        
                        // Calculate center in relative units (0-1) of the capWidth/capHeight
                        currentObjectCenter = {
                            x: ((x1 + x2) / 2) / capWidth,
                            y: ((y1 + y2) / 2) / capHeight
                        };

                        drawDetectionBox(topDet, capWidth, capHeight);
                    } else {
                        currentObjectCenter = null;
                        clearDetectionOverlay();
                    }
                } catch (err) {
                    console.error("Detection API error:", err);
                }
            }
            setTimeout(processDetectionLoop, 200); // 5 FPS for detection
        }, 'image/jpeg', 0.7);
    } else {
        setTimeout(processDetectionLoop, 100);
    }
}

function drawDetectionBox(det, sw, sh) {
    if (!detCtx) return;
    clearDetectionOverlay();

    const [x1, y1, x2, y2] = det.box;
    
    // Scale from capture size to screen size
    const scaleX = detCanvas.width / sw;
    const scaleY = detCanvas.height / sh;

    const rx1 = x1 * scaleX;
    const ry1 = y1 * scaleY;
    const rw = (x2 - x1) * scaleX;
    const rh = (y2 - y1) * scaleY;

    detCtx.strokeStyle = '#32c8ff';
    detCtx.lineWidth = 4;
    detCtx.strokeRect(rx1, ry1, rw, rh);
    
    detCtx.fillStyle = '#32c8ff';
    const label = `${det.label} (${Math.round(det.confidence * 100)}%)`;
    detCtx.font = 'bold 18px Arial';
    detCtx.fillRect(rx1, ry1 - 25, detCtx.measureText(label).width + 10, 25);
    detCtx.fillStyle = 'black';
    detCtx.fillText(label, rx1 + 5, ry1 - 7);
}

async function renderLoop() {
    if (!isRunning || !estimator) return;

    try {
        // Ensure video is ready
        if (video.readyState < 2) {
            requestAnimationFrame(renderLoop);
            return;
        }

        // Only run depth estimation if an object has been detected
        if (!currentObjectCenter) {
            // If no object is detected, clear depth data/canvas or just wait
            if (canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
            distanceEl.innerText = "--";
            requestAnimationFrame(renderLoop);
            return;
        }

        const { sx, sy, sw, sh, targetWidth, targetHeight } = getVideoCrop(160);

        if (offscreenCanvas.width !== targetWidth || offscreenCanvas.height !== targetHeight) {
            offscreenCanvas.width = targetWidth;
            offscreenCanvas.height = targetHeight;
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
    if (!depthData || !distanceEl || !currentObjectCenter) return;

    // Use detected object center (relative 0.0 - 1.0)
    let targetX = Math.floor(currentObjectCenter.x * width);
    let targetY = Math.floor(currentObjectCenter.y * height);

    // Clamp values to stay within bounds
    targetX = Math.max(0, Math.min(width - 1, targetX));
    targetY = Math.max(0, Math.min(height - 1, targetY));

    const idx = targetY * width + targetX;
    const rawValue = depthData[idx];
    
    distanceEl.innerText = rawValue.toFixed(3);

    // Update crosshair position (now only red, as we only run when object is detected)
    const crosshair = document.getElementById('crosshair');
    if (crosshair) {
        crosshair.style.left = `${currentObjectCenter.x * 100}%`;
        crosshair.style.top = `${currentObjectCenter.y * 100}%`;
        crosshair.style.borderColor = '#ff3232'; // Red for following object
    }
}

// Start initialization
init();
