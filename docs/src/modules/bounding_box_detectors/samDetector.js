import { CanvasManager2d } from "../display/CanvasManager2d.js";
import { Detector } from "../detector.js";

export class SAMDetection extends Detector,CanvasManager2d {
  constructor(canvas) {
    super(canvas);
    this.handleTap = (e) => this.startDetectionFromTap(e);
    this.canvas.addEventListener("click", this.handleTap);
    this.canvas.style.pointerEvents = "auto"; // Enable clicks
    this.canvas.style.zIndex = "15"; // Ensure it's above the video but below controls
    this.initiateRedDot();
  }

  initiateRedDot() {
  }

  getBoundingBoxFromSAM() {
    //API-Endpunkt, der Bild zu SAM schickt und Bounding Box einzeichnet
    //ausgehend von der Bildschirmmitte
  }

  startDetectionFromTap(event) {
    console.log("Tap detected, X: " + event.clientX + " Y: " + event.clientY);

    this.getBoundingBoxFromSAM();

  }
}
