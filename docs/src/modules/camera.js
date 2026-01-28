import { CanvasManager2d } from "./CanvasManager2d.js";

export class CameraHandler extends CanvasManager2d {
  constructor(videoElement, canvas) {
    super(canvas);
    this.video = videoElement;
    this.streaming = null;
    this.visibleRegion = { x: 0, y: 0, width: 0, height: 0 };
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
      height: Math.min(videoHeight, visibleHeight),
    };

    console.debug("Camera visible region updated:", this.visibleRegion);
    return this.visibleRegion;
  }

  async start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      this.video.srcObject = stream;
      return this.video.play();
    } catch (err) {
      console.error(`An error occurred: ${err}`);
    }
  }

  takePicture() {
    this.ctx.drawImage(
      this.video,
      this.visibleRegion.x,
      this.visibleRegion.y,
      this.visibleRegion.width,
      this.visibleRegion.height,
    );
    return this.canvas.toBlob();
  }
}
