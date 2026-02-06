import { CONFIG } from "./config.js";

export class ParkingSensor {
  constructor() {
    this.audioCtx = null;
    this.beepTimer = null;
    this.active = false;
    this.currentStage = 2; // Always start at stage 2

    // For Stage 5 (Continuous)
    this.continuousOsc = null;
    this.continuousGain = null;
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
    this.currentStage = 2; // Reset to stage 2 on start
    this.loop();
  }

  stop() {
    this.active = false;
    this.stopContinuous();
    if (this.beepTimer) {
      clearTimeout(this.beepTimer);
      this.beepTimer = null;
    }
  }

  increaseStage() {
    if (this.currentStage < 5) {
      this.currentStage++;
    }
  }

  decreaseStage() {
    if (this.currentStage > 1) {
      this.currentStage--;
    }
  }

  loop() {
    if (!this.active) return;

    if (this.beepTimer) clearTimeout(this.beepTimer);

    if (this.currentStage === 5) {
      this.startContinuous();
      // Check again shortly to adjust if stage changes
      this.beepTimer = setTimeout(() => this.loop(), 100);
    } else {
      this.stopContinuous();

      this.playBeep();

      // Delays for Stages 1-4
      let delay = 1200; // Stage 1
      if (this.currentStage === 2) delay = 800;
      else if (this.currentStage === 3) delay = 400;
      else if (this.currentStage === 4) delay = 150;

      this.beepTimer = setTimeout(() => this.loop(), delay);
    }
  }

  startContinuous() {
    if (this.continuousOsc) return;
    if (!this.audioCtx) return;

    this.continuousOsc = this.audioCtx.createOscillator();
    this.continuousGain = this.audioCtx.createGain();

    this.continuousOsc.type = "sine";
    this.continuousOsc.frequency.setValueAtTime(
      CONFIG.AUDIO_BEEP_FREQ,
      this.audioCtx.currentTime,
    );

    this.continuousGain.gain.setValueAtTime(0.1, this.audioCtx.currentTime);

    this.continuousOsc.connect(this.continuousGain);
    this.continuousGain.connect(this.audioCtx.destination);
    this.continuousOsc.start();
  }

  stopContinuous() {
    if (this.continuousOsc) {
      try {
        // Ramp down quickly to avoid clicking
        const now = this.audioCtx.currentTime;
        this.continuousGain.gain.setTargetAtTime(0, now, 0.05);
        this.continuousOsc.stop(now + 0.1);
      } catch (e) {
        // Ignore errors if already stopped
      }
      this.continuousOsc = null;
      this.continuousGain = null;
    }
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
