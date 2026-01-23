import { CONFIG } from './modules/config.js';
import { CameraHandler } from './modules/camera.js';
import { DepthEstimator } from './modules/depth.js';
import { ParkingSensor } from './modules/audio.js';
import { UI } from './modules/ui.js';
import { detectObjects } from './modules/detection.js';
import { FeatureTracker } from './modules/tracking.js';

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
const tracker = new FeatureTracker();

let isRunning = false;
let isDetectionRunning = false;
let isTrackingActive = false;
let currentObjectCenter = null;
let currentDepthData = null;

// FPS Tracking
let lastDepthTime = performance.now();
let lastDetTime = performance.now();
let depthFPS = 0;
let detFPS = 0;
let lastUIPdateTime = 0;

// Contexts
const depthCtx = depthCanvas?.getContext('2d');
const detCtx = detCanvas?.getContext('2d');
const captureCtx = captureCanvas?.getContext('2d');

async function init() {
    // Setup UI listeners
    toggleDetBtn?.addEventListener('click', toggleDetection);
    window.addEventListener('resize', () => resizeDetectionOverlay());

    // Initialize services
    const cameraOk = await camera.start();
    if (!cameraOk) return;

    await depth.init();
    
    // Improved OpenCV loading check
    if (typeof cv !== 'undefined') {
        if (cv.Mat) {
            console.log("OpenCV.js already ready");
        } else {
            cv.onRuntimeInitialized = () => {
                console.log("OpenCV.js is ready via onRuntimeInitialized");
            };
        }
    }

    isRunning = true;
    resizeDetectionOverlay();
    
    console.log("App initialized, starting loops...");
    
    // Start Loops
    renderLoop();
    detectionLoop();
    trackingLoop();
}

function resizeDetectionOverlay() {
    if (detCanvas) {
        detCanvas.width = window.innerWidth;
        detCanvas.height = window.innerHeight;
        console.log(`Detection overlay resized to: ${detCanvas.width}x${detCanvas.height}`);
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
        isTrackingActive = false;
        detFPS = 0;
        UI.clearCanvas(detCtx, detCanvas);
        UI.updateCrosshair(crosshairEl, null);
    }
}

async function detectionLoop() {
    if (!isRunning) return setTimeout(detectionLoop, 100);

    if (isDetectionRunning && videoEl.readyState >= 2) {
        const prompt = promptInput?.value.trim();
        if (!prompt) return setTimeout(detectionLoop, 500);

        const region = camera.visibleRegion;
        captureCanvas.width = region.width;
        captureCanvas.height = region.height;
        captureCtx.drawImage(
            videoEl, 
            region.x, region.y, region.width, region.height,
            0, 0, region.width, region.height
        );

        const data = await detectObjects(captureCanvas, prompt);

        // Update detection FPS
        const now = performance.now();
        detFPS = 1000 / (now - lastDetTime);
        lastDetTime = now;

        if (data?.status === 'success' && data.detections?.length > 0) {
            const topDet = data.detections[0];
            const [x1, y1, x2, y2] = topDet.box;
            
            // Initialize/Re-initialize tracker with coordinates relative to the visible region
            console.log("Initializing/Refreshing tracker with box:", topDet.box);
            if (tracker.init(videoEl, topDet.box, region)) {
                isTrackingActive = true;
                console.log("Tracking activated/refreshed");
            }

            currentObjectCenter = {
                x: ((x1 + x2) / 2) / region.width,
                y: ((y1 + y2) / 2) / region.height
            };

            UI.drawDetection(detCtx, detCanvas, topDet, region.width, region.height);
        } else if (!isTrackingActive) {
            // Only clear if we aren't tracking (otherwise tracker might still be valid)
            currentObjectCenter = null;
            UI.clearCanvas(detCtx, detCanvas);
        }
        
        // If tracking is active, wait 2 seconds before checking again (refresh mode)
        // If not tracking, use standard FPS to find an object quickly
        const nextDelay = isTrackingActive ? 2000 : (1000 / CONFIG.DETECTION_FPS);
        setTimeout(detectionLoop, nextDelay);
    } else {
        setTimeout(detectionLoop, 100);
    }
}

async function trackingLoop() {
    if (!isRunning) return requestAnimationFrame(trackingLoop);

    if (isTrackingActive && videoEl.readyState >= 2) {
        const now = performance.now();
        const region = camera.visibleRegion;

        const trackResult = tracker.track(videoEl, region);
        
        if (trackResult) {
            const [x1, y1, x2, y2] = trackResult.box;
            
            currentObjectCenter = {
                x: (x1 + x2) / 2 / region.width,
                y: (y1 + y2) / 2 / region.height
            };

            UI.drawDetection(detCtx, detCanvas, {
                label: 'Tracking...',
                confidence: trackResult.confidence,
                box: [x1, y1, x2, y2]
            }, region.width, region.height);

            detFPS = 1000 / (now - lastDetTime);
            lastDetTime = now;
        } else {
            isTrackingActive = false;
            currentObjectCenter = null;
            UI.clearCanvas(detCtx, detCanvas);
        }
    }

    requestAnimationFrame(trackingLoop);
}

async function renderLoop() {
    if (!isRunning) return;

    try {
        if (videoEl.readyState < 2) return requestAnimationFrame(renderLoop);

        const now = performance.now();

        // Optimization: Only run depth if object detected
        if (!currentObjectCenter) {
            UI.clearCanvas(depthCtx, depthCanvas);
            UI.updateCrosshair(crosshairEl, null);
            if (distanceEl) distanceEl.innerText = "--";
            sensor.update(0, false);
            return requestAnimationFrame(renderLoop);
        }

        // 2. Depth Logic
        const interval = 1000 / CONFIG.DEPTH_FPS;
        if (now - lastDepthTime >= interval) {
            const depthPrediction = await depth.predict(videoEl, camera.visibleRegion);
            if (depthPrediction) {
                // Update depth FPS
                depthFPS = 1000 / (now - lastDepthTime);
                lastDepthTime = now;

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
                if (currentObjectCenter) {
                    const tx = Math.floor(currentObjectCenter.x * width);
                    const ty = Math.floor(currentObjectCenter.y * height);
                    const idx = Math.max(0, Math.min(width * height - 1, ty * width + tx));
                    const val = currentDepthData[idx];

                    if (distanceEl) distanceEl.innerText = val.toFixed(3);
                    sensor.update(val, true);
                    UI.updateCrosshair(crosshairEl, currentObjectCenter);
                } else {
                    sensor.update(0, false);
                }
            }
        }

        // Periodically update UI stats
        if (now - lastUIPdateTime > 500) {
            UI.updateFPS(depthFPS, detFPS);
            lastUIPdateTime = now;
        }

    } catch (err) {
        console.error("Render loop error:", err);
    }

    requestAnimationFrame(renderLoop);
}

// Global entry point
init();
