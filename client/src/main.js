const video = document.getElementById('webcam');
const canvas = document.getElementById('canvas');
const outputImg = document.getElementById('output');
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
            console.log("Kamera gestartet.");
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
}

async function processLoop() {
    if (!isRunning) return;

    // Adjust canvas size to video size if needed
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
    }

    const ctx = canvas.getContext('2d');
    if (ctx && video.readyState === video.HAVE_ENOUGH_DATA) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert canvas to blob
        canvas.toBlob(async (blob) => {
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
                        outputImg.src = data.image;
                        guidanceText.innerText = `Guidance: ${data.guidance || 'Nichts gefunden'}`;
                    }
                } catch (err) {
                    console.error("API error:", err);
                }
            }
            
            // Wait a bit before next frame to avoid overloading
            if (isRunning) {
                setTimeout(processLoop, 100); 
            }
        }, 'image/jpeg', 0.8);
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
