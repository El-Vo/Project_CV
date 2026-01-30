import { detectObjectAPI } from "./api.js";
import { Detector } from "./detector.js";
import { UI } from "./ui.js";

export class RemoteDetection extends Detector {
  constructor() {
    super();
  }

  async detectObject(image_jpg_blob) {
    const response = await detectObjectAPI(UI.getTextPrompt(), image_jpg_blob);
    if (!response.ok) return null;
    const data = await response.json();
    this.objectDetected = data.detection;
  }
}
