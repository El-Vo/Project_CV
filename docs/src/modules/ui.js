import { CONFIG } from "./config.js";

export class UI {
  static promptInput = document.getElementById("promptInput");
  static toggleDetBtn = document.getElementById("toggleDetBtn");
  static distanceEl = document.getElementById("distance");
  static controlsBottom = document.getElementById("controls-bottom");
  static depthEl = document.getElementById("depth-fps");
  static detEl = document.getElementById("det-fps");

  static setLocalMode(mode = CONFIG.LOCAL_MODE) {
    this.promptInput.style.display = mode ? "none" : "flex";
    this.controlsBottom.style.display = mode ? "none" : "flex";
    /* this.toggleDetBtn.style.display = mode ? "none" : "flex"; */
  }

  static toggleDetectionUI(isDetectionRunning) {
    this.toggleDetBtn.innerText = isDetectionRunning ? "Stop" : "Start";
  }

  static updateFPS(depthFPS, detFPS) {
    this.depthEl.innerText = depthFPS.toFixed(1);
    this.detEl.innerText = detFPS.toFixed(1);
  }

  static getTextPrompt() {
    return this.promptInput.value.trim();
  }
}
