import { CONFIG } from "./config.js";

export class UI {
  static promptInput = document.getElementById("promptInput");
  static toggleDetBtn = document.getElementById("toggleDetBtn");
  static distanceEl = document.getElementById("distance");
  static controlsBottom = document.getElementById("controls-bottom");
  static depthEl = document.getElementById("depth-fps");
  static detEl = document.getElementById("det-fps");
  static usedBackend = document.getElementById("backend-info");

  static setLocalMode(mode = CONFIG.LOCAL_MODE) {
    this.promptInput.style.display = mode ? "none" : "flex";
    this.controlsBottom.style.display = mode ? "none" : "flex";
  }

  static getTextPrompt() {
    return this.promptInput.value.trim();
  }
}
