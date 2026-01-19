import { CONFIG } from './modules/config.js';
import { CameraHandler } from './modules/camera.js';
import { DepthEstimator } from './modules/depth.js';
import { ParkingSensor } from './modules/audio.js';
import { UI } from './modules/ui.js';
import { detectObjects } from './modules/detection.js';

// DOM Elements
const videoEl = document.getElementById('webcam');
const depthCanvas = document.getElementById('depth-canvas');
const detCanvas = document.getElementById('detection-overlay');
const captureCanvas = document.getElementById('captureCanvas');
const crosshairEl = document.getElementById('crosshair');
const distanceEl = document.getElementById('distance');
const promptInput = document.getElementById('promptInput');
const toggleDetBtn = document.getElementById('toggleDetBtn');

// Handlers & State
const camera = new CameraHandler(videoEl);
const depth = new DepthEstimator(CONFIG.DEPTH_MODEL);
const sensor = new ParkingSensor();

let isRunning = false;
let isDetectionRunning = false;
let currentObjectCenter = null;
let currentDepthData = null;

// Contexts
const depthCtx = depthCanvas?.getContext('2d');
const detCtx = detCanvas?.getContext('2d');
const captureCtx = captureCanvas?.getContext('2d');
const offscreenCanvas = document.createElement('canvas');
const offscreenCtx = offscreenCanvas.getContext('2d', { willReadFrequently: true });

async function init() {
    // Setup UI listeners
    toggleDetBtn?.addEventListener('click', toggleDetection);
    window.addEventListener('resize', () => resizeDetectionOverlay());

    // Initialize services
    const cameraOk = await camera.start();
    if (!cameraOk) return;

    await depth.init();
    
    isRunning = true;
    resizeDetectionOverlay();
    
    // Start Loops
    renderLoop();
    detectionLoop();
}

function resizeDetectionOverlay() {
    if (detCanvas) {
        detCanvas.width = window.innerWidth;
        detCanvas.height = window.innerHeight;
    }
}

function toggleDetection() {
    isDetectionRunning = !isDetectionRunning;
    if (toggleDetBtn) {
        toggleDetBtn.innerText = isDetectionRunning ? 'Stop' : 'Start';
    }

    if (isDetectionRunning) {
        sensor.init();
        sensor.start();
    } else {
        sensor.stop();
        currentObjectCenter = null;
        UI.clearCanvas(detCtx, detCanvas);
        UI.updateCrosshair(crosshairEl, null);
    }
}

async function detectionLoop() {
    if (!isRunning) return setTimeout(detectionLoop, 100);

    if (isDetectionRunning && videoEl.readyState >= 2) {
        const prompt = promptInput?.value.trim();
        if (!prompt) return setTimeout(detectionLoop, 500);

        const { sx, sy, sw, sh, targetWidth, targetHeight } = camera.getCrop(CONFIG.DETECTION_RES);
        captureCanvas.width = targetWidth;
        captureCanvas.height = targetHeight;
        captureCtx.drawImage(videoEl, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);

        const data = await detectObjects(captureCanvas, prompt);

        if (data?.status === 'success' && data.detections?.length > 0) {
            const topDet = data.detections[0];
            const [x1, y1, x2, y2] = topDet.box;
            
            currentObjectCenter = {
                x: ((x1 + x2) / 2) / targetWidth,
                y: ((y1 + y2) / 2) / targetHeight
            };

            UI.drawDetection(detCtx, detCanvas, topDet, targetWidth, targetHeight);
        } else {
            currentObjectCenter = null;
            UI.clearCanvas(detCtx, detCanvas);
        }
        
        setTimeout(detectionLoop, 1000 / CONFIG.DETECTION_FPS);
    } else {
        setTimeout(detectionLoop, 100);
    }
}

async function renderLoop() {
    if (!isRunning) return;

    try {
        if (videoEl.readyState < 2) return requestAnimationFrame(renderLoop);

        // Optimization: Only run depth if object detected
        if (!currentObjectCenter) {
            UI.clearCanvas(depthCtx, depthCanvas);
            UI.updateCrosshair(crosshairEl, null);
            if (distanceEl) distanceEl.innerText = "--";
            sensor.update(0, false);
            return requestAnimationFrame(renderLoop);
        }

        const { sx, sy, sw, sh, targetWidth, targetHeight } = camera.getCrop(CONFIG.DEPTH_RES);
        offscreenCanvas.width = targetWidth;
        offscreenCanvas.height = targetHeight;
        offscreenCtx.drawImage(videoEl, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);

        const depthPrediction = await depth.predict(offscreenCanvas);
        if (depthPrediction) {
            currentDepthData = depthPrediction.data;
            const { width, height } = depthPrediction;
            
            // Draw visual depth map
            if (depthCanvas) {
                const visualCanvas = await depthPrediction.toCanvas();
                if (depthCanvas.width !== visualCanvas.width || depthCanvas.height !== visualCanvas.height) {
                    depthCanvas.width = visualCanvas.width;
                    depthCanvas.height = visualCanvas.height;
                }
                depthCtx.drawImage(visualCanvas, 0, 0);
            }

            // Update distance and sensor
            const tx = Math.floor(currentObjectCenter.x * width);
            const ty = Math.floor(currentObjectCenter.y * height);
            const idx = Math.max(0, Math.min(width * height - 1, ty * width + tx));
            const val = currentDepthData[idx];

            if (distanceEl) distanceEl.innerText = val.toFixed(3);
            sensor.update(val, true);
            UI.updateCrosshair(crosshairEl, currentObjectCenter);
        }

    } catch (err) {
        console.error("Render loop error:", err);
    }

    requestAnimationFrame(renderLoop);
}

// Global entry point
init();
