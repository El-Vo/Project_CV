const video = document.getElementById('webcam');
const overlay = document.getElementById('overlay');
const captureCanvas = document.getElementById('captureCanvas');
const promptInput = document.getElementById('promptInput');
const toggleBtn = document.getElementById('toggleBtn');
const guidanceText = document.getElementById('guidanceText');

let isRunning = false;
let stream = null;
const API_URL = '/detect';

async function startCamera() {
    console.log("Versuche Kamera zu starten...");
    try {
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: { ideal: 640 }, 
                height: { ideal: 480 },
                facingMode: "environment"
            } 
        });
        video.srcObject = stream;
        video.onloadedmetadata = () => {
            video.play().catch(e => console.error("Video play failed:", e));
            isRunning = true;
            toggleBtn.innerText = 'Stop Kamera';
            guidanceText.innerText = 'Suche nach: ' + promptInput.value;
            
            // Match overlay and capture canvas sizes to video
            overlay.width = video.videoWidth;
            overlay.height = video.videoHeight;
            captureCanvas.width = video.videoWidth;
            captureCanvas.height = video.videoHeight;
            
            processLoop();
        };
    } catch (err) {
        console.error("Error accessing webcam:", err);
        alert("Kamera konnte nicht gestartet werden: " + err.message);
    }
}

function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
    isRunning = false;
    toggleBtn.innerText = 'Start Kamera';
    guidanceText.innerText = 'Kamera gestoppt.';
    const ctx = overlay.getContext('2d');
    ctx.clearRect(0, 0, overlay.width, overlay.height);
}

function drawOverlay(detections) {
    const ctx = overlay.getContext('2d');
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    
    if (!detections || detections.length === 0) return;

    detections.forEach(det => {
        const [x1, y1, x2, y2] = det.box;
        const width = x2 - x1;
        const height = y2 - y1;

        // Draw bounding box
        ctx.strokeStyle = '#32c8ff';
        ctx.lineWidth = 4;
        ctx.strokeRect(x1, y1, width, height);

        // Draw label background
        ctx.fillStyle = '#32c8ff';
        const label = `${det.label} (${Math.round(det.confidence * 100)}%)`;
        ctx.font = 'bold 18px Arial';
        const textWidth = ctx.measureText(label).width;
        ctx.fillRect(x1, y1 - 25, textWidth + 10, 25);

        // Draw label text
        ctx.fillStyle = 'black';
        ctx.fillText(label, x1 + 5, y1 - 7);
    });
}

async function processLoop() {
    if (!isRunning) return;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        // Double check sizes
        if (overlay.width !== video.videoWidth || overlay.height !== video.videoHeight) {
            overlay.width = video.videoWidth;
            overlay.height = video.videoHeight;
            captureCanvas.width = video.videoWidth;
            captureCanvas.height = video.videoHeight;
            console.log(`Resized canvases to ${video.videoWidth}x${video.videoHeight}`);
        }

        const ctx = captureCanvas.getContext('2d');
        ctx.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);
        
        captureCanvas.toBlob(async (blob) => {
            if (blob && isRunning) {
                const formData = new FormData();
                formData.append('file', blob, 'frame.jpg');
                formData.append('prompt', promptInput.value);

                try {
                    const response = await fetch(API_URL, {
                        method: 'POST',
                        body: formData
                    });
                    const data = await response.json();

                    if (data.status === 'success') {
                        if (data.detections && data.detections.length > 0) {
                            console.log("Detections:", data.detections);
                        }
                        drawOverlay(data.detections);
                        guidanceText.innerText = data.guidance ? `Guidance: ${data.guidance}` : `Suche nach: ${promptInput.value}`;
                    }
                } catch (err) {
                    console.error("API error:", err);
                }
            }
            
            if (isRunning) {
                setTimeout(processLoop, 100); 
            }
        }, 'image/jpeg', 0.7);
    } else {
        if (isRunning) {
            requestAnimationFrame(processLoop);
        }
    }
}

toggleBtn.addEventListener('click', () => {
    if (isRunning) {
        stopCamera();
    } else {
        startCamera();
    }
});
