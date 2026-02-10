export class Detector {
  objectDetected = null;

  getCurrentDetection() {
    return this.objectDetected;
  }

  static getDefaultBoundingBox() {
    return {
      box: [0, 0, 1, 1],
      score: 1,
      label: "Manual",
    };
  }
}
