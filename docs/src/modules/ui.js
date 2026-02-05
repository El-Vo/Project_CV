import { CONFIG } from "./config.js";

export class UI {
  static promptInput = document.getElementById("promptInput");
  static modeToggleBtn = document.getElementById("modeToggleBtn");
  static toggleDetBtn = document.getElementById("toggleDetBtn");
  static distanceEl = document.getElementById("distance");
  static controlsBottom = document.getElementById("controls-bottom");
  static depthEl = document.getElementById("depth-fps");
  static detEl = document.getElementById("det-fps");
  static usedBackend = document.getElementById("backend-info");

  static isScanningMode = false;

  static {
    if (this.modeToggleBtn) {
      this.modeToggleBtn.addEventListener("click", () => {
        this.toggleMode();
      });
    }
    this.updateModeUI();
  }

  static toggleMode() {
    this.isScanningMode = !this.isScanningMode;
    this.updateModeUI();
  }

  static updateModeUI() {
    if (this.isScanningMode) {
      if (this.modeToggleBtn) {
        this.modeToggleBtn.classList.add("scanning");
        this.modeToggleBtn.innerText = "Scanning Mode";
      }
      this.promptInput.style.display = "none";
    } else {
      if (this.modeToggleBtn) {
        this.modeToggleBtn.classList.remove("scanning");
        this.modeToggleBtn.innerText = "Detection Mode";
      }
      this.promptInput.style.display = "block";
    }
  }

  static setLocalMode(mode = CONFIG.LOCAL_MODE) {
    this.promptInput.style.display = mode ? "none" : "flex";
    this.controlsBottom.style.display = mode ? "none" : "flex";
  }

  static getTextPrompt() {
    return this.promptInput.value.trim();
  }
}
