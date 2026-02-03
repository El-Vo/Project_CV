export class Detector {
  objectDetected = null;

  getCurrentBoundingBox() {
    const x = this.objectDetected;
    this.objectDetected = null;
    return x;
  }
}
