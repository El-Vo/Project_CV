export class CameraHandler {
    constructor(videoElement) {
        this.video = videoElement;
        this.stream = null;
    }

    async start() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
            });
            this.video.srcObject = this.stream;
            
            return new Promise((resolve) => {
                this.video.onloadedmetadata = () => {
                    resolve(true);
                };
            });
        } catch (err) {
            console.error("Camera error:", err);
            return false;
        }
    }

    getCrop(targetBase) {
        const displayAR = window.innerWidth / window.innerHeight;
        const videoAR = this.video.videoWidth / this.video.videoHeight;
        let sx, sy, sw, sh;

        if (videoAR > displayAR) {
            sw = this.video.videoHeight * displayAR;
            sh = this.video.videoHeight;
            sx = (this.video.videoWidth - sw) / 2;
            sy = 0;
        } else {
            sw = this.video.videoWidth;
            sh = this.video.videoWidth / displayAR;
            sx = 0;
            sy = (this.video.videoHeight - sh) / 2;
        }

        let targetWidth, targetHeight;
        if (displayAR > 1) {
            targetWidth = targetBase;
            targetHeight = Math.floor(targetBase / displayAR);
        } else {
            targetHeight = targetBase;
            targetWidth = Math.floor(targetBase * displayAR);
        }

        return { sx, sy, sw, sh, targetWidth, targetHeight, displayAR };
    }
}
