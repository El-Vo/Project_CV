import { detectPersonalizedObjectAPI } from "../api.js";
import { Detector } from "./detector.js";

export class RemotePersonalizedDetection extends Detector {
  constructor() {
    super();
  }

  async detectObject(image_jpg_blob, targetLabel) {
    const response = await detectPersonalizedObjectAPI(
      image_jpg_blob,
      targetLabel,
    );
    if (!response.ok) return null;
    const data = await response.json();
    this.objectDetected = data.detection;
  }
}
