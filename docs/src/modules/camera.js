export class CameraHandler {
    constructor(videoElement) {
        this.video = videoElement;
        this.stream = null;
        this.visibleRegion = { x: 0, y: 0, width: 0, height: 0 };

        // Update visible region on window resize
        window.addEventListener('resize', () => this.updateVisibleRegion());
    }

    updateVisibleRegion() {
        if (!this.video || this.video.videoWidth === 0) return;

        const videoWidth = this.video.videoWidth;
        const videoHeight = this.video.videoHeight;
        const containerWidth = this.video.clientWidth;
        const containerHeight = this.video.clientHeight;

        if (containerWidth === 0 || containerHeight === 0) return;

        const videoAspect = videoWidth / videoHeight;
        const containerAspect = containerWidth / containerHeight;

        let visibleWidth, visibleHeight, x, y;

        if (containerAspect > videoAspect) {
            // Container is wider than video (scaled by width, cropped height)
            visibleWidth = videoWidth;
            visibleHeight = videoWidth / containerAspect;
            x = 0;
            y = (videoHeight - visibleHeight) / 2;
        } else {
            // Container is taller than video (scaled by height, cropped width)
            visibleHeight = videoHeight;
            visibleWidth = videoHeight * containerAspect;
            y = 0;
            x = (videoWidth - visibleWidth) / 2;
        }

        this.visibleRegion = {
            x: Math.max(0, x),
            y: Math.max(0, y),
            width: Math.min(videoWidth, visibleWidth),
            height: Math.min(videoHeight, visibleHeight)
        };
        
        console.debug("Camera visible region updated:", this.visibleRegion);
    }

    async start() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            });
            this.video.srcObject = this.stream;
            
            return new Promise((resolve) => {
                this.video.onloadedmetadata = () => {
                    this.updateVisibleRegion();
                    resolve(true);
                };
            });
        } catch (err) {
            console.error("Camera error:", err);
            return false;
        }
    }
}
