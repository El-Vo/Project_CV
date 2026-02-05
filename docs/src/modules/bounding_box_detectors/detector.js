export class Detector {
  objectDetected = null;

  getCurrentDetection() {
    const x = this.objectDetected;
    this.objectDetected = null;
    return x;
  }

  static getDefaultBoundingBox() {
    return {
      box: [0, 0, 1, 1],
      score: 1,
      label: "Manual",
    };
  }
}
