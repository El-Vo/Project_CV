import { CONFIG } from "./config.js";

export class ParkingSensor {
  constructor() {
    this.audioCtx = null;
    this.beepInterval = null;
    this.active = false;
    this.currentDistance = 0;
  }

  init() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.audioCtx.state === "suspended") {
      this.audioCtx.resume();
    }
  }

  start() {
    if (this.active) return;
    this.active = true;
    this.loop();
  }

  stop() {
    this.active = false;
    if (this.beepInterval) {
      clearTimeout(this.beepInterval);
      this.beepInterval = null;
    }
  }

  update(distance) {
    this.currentDistance = distance;
  }

  loop() {
    if (!this.active) return;

    if (this.currentDistance > 0) {
      this.playBeep();
    }

    let delay = CONFIG.AUDIO_MAX_DELAY;
    // Scale distance (assuming 0-255 range) to delay range
    // 255 (Near) -> Min Delay (Fast)
    // 0 (Far) -> Max Delay (Slow)
    const normalized = Math.max(0, Math.min(255, this.currentDistance)) / 255;
    delay =
      CONFIG.AUDIO_MAX_DELAY -
      normalized * (CONFIG.AUDIO_MAX_DELAY - CONFIG.AUDIO_MIN_DELAY);

    this.beepInterval = setTimeout(() => this.loop(), delay);
  }

  playBeep() {
    if (!this.audioCtx) return;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(
      CONFIG.AUDIO_BEEP_FREQ,
      this.audioCtx.currentTime,
    );

    gain.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.01,
      this.audioCtx.currentTime + 0.1,
    );

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start();
    osc.stop(this.audioCtx.currentTime + 0.1);
  }
}
