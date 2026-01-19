const video = document.getElementById('webcam');
const overlay = document.getElementById('overlay');
const captureCanvas = document.getElementById('captureCanvas');
const promptInput = document.getElementById('promptInput');
const toggleCamBtn = document.getElementById('toggleCamBtn');
const toggleDetBtn = document.getElementById('toggleDetBtn');
const guidanceText = document.getElementById('guidanceText');

let isCameraRunning = false;
let isDetectionRunning = false;
let stream = null;
const API_URL = 'http://localhost:8000/detect';

// Buffer for the last 5 bounding boxes
let boxHistory = [];
const MAX_HISTORY = 5;
const MOVEMENT_THRESHOLD = 15; // Pixels of average center movement

async function startCamera() {
    console.log("Attempting to start camera...");
    try {
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "environment" } 
        });
        video.srcObject = stream;
        video.onloadedmetadata = () => {
            video.play().catch(e => console.error("Video play failed:", e));
            isCameraRunning = true;
            toggleCamBtn.innerText = 'Stop camera';
            toggleDetBtn.disabled = false;
            
            overlay.width = video.videoWidth;
            overlay.height = video.videoHeight;
            captureCanvas.width = video.videoWidth;
            captureCanvas.height = video.videoHeight;
            
            processLoop();
        };
    } catch (err) {
        console.error("Error accessing webcam:", err);
        guidanceText.innerText = `Error: ${err.name} - ${err.message}`;
        if (location.protocol === 'file:') {
            guidanceText.innerText += " (Local files block browser functions. Use a web server!)";
        }
        alert("Camera could not be started. See console for details.");
    }
}

function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
    isCameraRunning = false;
    isDetectionRunning = false;
    toggleCamBtn.innerText = 'Start camera';
    toggleDetBtn.innerText = 'Start detection';
    toggleDetBtn.disabled = true;
    guidanceText.innerText = 'Camera stopped.';
    clearOverlay();
}

function clearOverlay() {
    const ctx = overlay.getContext('2d');
    ctx.clearRect(0, 0, overlay.width, overlay.height);
}

function drawOverlay(detections) {
    clearOverlay();
    if (!detections || detections.length === 0) return;

    const ctx = overlay.getContext('2d');
    detections.forEach(det => {
        const [x1, y1, x2, y2] = det.box;
        ctx.strokeStyle = '#32c8ff';
        ctx.lineWidth = 4;
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
        
        ctx.fillStyle = '#32c8ff';
        const label = `${det.label} (${Math.round(det.confidence * 100)}%)`;
        ctx.font = 'bold 18px Arial';
        const textWidth = ctx.measureText(label).width;
        ctx.fillRect(x1, y1 - 25, textWidth + 10, 25);
        ctx.fillStyle = 'black';
        ctx.fillText(label, x1 + 5, y1 - 7);
    });
}

function isMoving(newBox) {
    if (!newBox) return true;
    
    const center = {
        x: (newBox[0] + newBox[2]) / 2,
        y: (newBox[1] + newBox[3]) / 2
    };
    
    boxHistory.push(center);
    if (boxHistory.length > MAX_HISTORY) boxHistory.shift();
    
    if (boxHistory.length < MAX_HISTORY) return true;
    
    // Calculate average distance from the current center to previous centers
    let totalDist = 0;
    for (let i = 0; i < boxHistory.length - 1; i++) {
        const d = Math.sqrt(Math.pow(center.x - boxHistory[i].x, 2) + Math.pow(center.y - boxHistory[i].y, 2));
        totalDist += d;
    }
    const avgDist = totalDist / (boxHistory.length - 1);
    console.log("Average movement:", avgDist.toFixed(2));
    
    return avgDist > MOVEMENT_THRESHOLD;
}

async function processLoop() {
    if (!isCameraRunning) return;

    const prompt = promptInput.value.trim();
    
    // Condition 2: Pause if prompt is empty
    if (isDetectionRunning && !prompt) {
        guidanceText.innerText = "Pausing (no prompt)";
        setTimeout(processLoop, 500);
        return;
    }

    if (isDetectionRunning && video.readyState === video.HAVE_ENOUGH_DATA) {
        const ctx = captureCanvas.getContext('2d');
        ctx.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);
        
        captureCanvas.toBlob(async (blob) => {
            if (blob && isDetectionRunning) {
                const formData = new FormData();
                formData.append('file', blob, 'frame.jpg');
                formData.append('prompt', prompt);

                try {
                    const response = await fetch(API_URL, { method: 'POST', body: formData });
                    const data = await response.json();

                    if (data.status === 'success') {
                        drawOverlay(data.detections);
                        
                        const topBox = data.detections.length > 0 ? data.detections[0].box : null;
                        
                        // Condition 3: Check movement
                        if (topBox && !isMoving(topBox)) {
                            guidanceText.innerText = "Paused (object stable)";
                            // In a real app we might wait longer, here we keep looping but skip API until moved?
                            // To know if it moved, we'd need another detection. 
                            // Workaround: We wait longer (2 seconds) if stable
                            setTimeout(processLoop, 2000); 
                            return;
                        }
                        
                        guidanceText.innerText = data.guidance || `Searching for: ${prompt}`;
                    }
                } catch (err) {
                    console.error("API error:", err);
                }
            }
            if (isCameraRunning) setTimeout(processLoop, 150);
        }, 'image/jpeg', 0.7);
    } else {
        if (isCameraRunning) requestAnimationFrame(processLoop);
    }
}

toggleCamBtn.addEventListener('click', () => {
    if (isCameraRunning) stopCamera(); else startCamera();
});

toggleDetBtn.addEventListener('click', () => {
    isDetectionRunning = !isDetectionRunning;
    toggleDetBtn.innerText = isDetectionRunning ? 'Stop detection' : 'Start detection';
    if (isDetectionRunning) {
        boxHistory = []; // Reset history
        guidanceText.innerText = 'Detection started...';
    } else {
        clearOverlay();
        guidanceText.innerText = 'Detection paused.';
    }
});
