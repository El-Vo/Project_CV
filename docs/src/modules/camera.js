import { CanvasManager2d } from "./display/CanvasManager2d.js";
import { CONFIG } from "./config.js";

export class CameraHandler extends CanvasManager2d {
  constructor(videoElement, canvas) {
    super(canvas);
    this.video = videoElement;
    this.streaming = null;
    this.visibleRegion = { x: 0, y: 0, width: 0, height: 0 };
    this.visibleRegionToWindowXFactor = 0;
    this.visibleRegionToWindowsYFactor = 0;
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

    console.debug(
      "Camera visible region updated: " +
        this.visibleRegion.width.toFixed(0) +
        " x " +
        this.visibleRegion.height,
    );
    console.debug(
      "Container size: " + containerWidth + " x " + containerHeight,
    );

    //Update scaling factors for translation between window dimensions and visible region
    this.visibleRegionToWindowXFactor = visibleWidth / containerWidth;
    this.visibleRegionToWindowsYFactor = visibleHeight / containerHeight;
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

  translateVisibleRegionToWindowX(visibleRegionX) {
    return visibleRegionX / this.visibleRegionToWindowXFactor;
  }

  translateVisibleRegionToWindowY(visibleRegionY) {
    return visibleRegionY / this.visibleRegionToWindowsYFactor;
  }

  translateVisibleRegionToPictureX(visibleRegionX) {
    return visibleRegionX * this.visibleRegionToWindowXFactor;
  }

  translateVisibleRegionToPictureY(visibleRegionY) {
    return visibleRegionY * this.visibleRegionToWindowsYFactor;
  }

  translateBoundingBoxToWindowScaling(box) {
    let [x1, y1, x2, y2] = box;
    return [
      this.translateVisibleRegionToWindowX(x1),
      this.translateVisibleRegionToWindowY(y1),
      this.translateVisibleRegionToWindowX(x2),
      this.translateVisibleRegionToWindowY(y2),
    ];
  }

  translateBoundingBoxToPictureScaling(box) {
    let [x1, y1, x2, y2] = box;
    return [
      this.translateVisibleRegionToPictureX(x1),
      this.translateVisibleRegionToPictureY(y1),
      this.translateVisibleRegionToPictureX(x2),
      this.translateVisibleRegionToPictureY(y2),
    ];
  }

  getResizeScaleFactor(shortSideTarget = CONFIG.DETECTION_SHORT_SIDE_PX) {
    if (this.visibleRegion.width === 0 || this.visibleRegion.height === 0)
      return 1;
    const { width, height } = this.visibleRegion;
    const isPortrait = width < height;

    const targetWidth = isPortrait
      ? shortSideTarget
      : (width / height) * shortSideTarget;

    return targetWidth / width;
  }

  scaleBoundingBoxToResized(box) {
    const scale = this.getResizeScaleFactor();
    return box.map((c) => c * scale);
  }

  scaleBoundingBoxFromResized(box) {
    const scale = this.getResizeScaleFactor();
    if (scale === 0) return box;
    return box.map((c) => c / scale);
  }

  takePicture(return_blob = true) {
    if (
      this.canvas.width !== this.visibleRegion.width ||
      this.canvas.height !== this.visibleRegion.height
    ) {
      this.canvas.width = this.visibleRegion.width;
      this.canvas.height = this.visibleRegion.height;
    }

    this.ctx.drawImage(
      this.video,
      this.visibleRegion.x,
      this.visibleRegion.y,
      this.visibleRegion.width,
      this.visibleRegion.height,
      0,
      0,
      this.visibleRegion.width,
      this.visibleRegion.height,
    );

    if (return_blob) {
      return this.turnPictureCanvasToBlob();
    } else {
      return this.canvas;
    }
  }

  turnPictureCanvasToBlob() {
    return new Promise((resolve) => {
      this.canvas.toBlob(
        (blob) => {
          resolve(blob);
        },
        "image/jpeg",
        0.95,
      );
    });
  }

  takePictureResized(
    return_blob = true,
    shortSideTarget = CONFIG.DETECTION_SHORT_SIDE_PX,
  ) {
    const { width, height } = this.visibleRegion;
    const isPortrait = width < height;

    const targetWidth = isPortrait
      ? shortSideTarget
      : (width / height) * shortSideTarget;
    const targetHeight = isPortrait
      ? (height / width) * shortSideTarget
      : shortSideTarget;

    this.canvas.width = targetWidth;
    this.canvas.height = targetHeight;

    this.ctx.drawImage(
      this.video,
      this.visibleRegion.x,
      this.visibleRegion.y,
      this.visibleRegion.width,
      this.visibleRegion.height,
      0,
      0,
      targetWidth,
      targetHeight,
    );

    if (return_blob) {
      return this.turnPictureCanvasToBlob();
    } else {
      return this.canvas;
    }
  }
}
