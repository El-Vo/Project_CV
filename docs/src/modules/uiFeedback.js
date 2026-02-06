export class UIFeedback {
  static audioCtx = null;

  static initAudio() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.audioCtx.state === "suspended") {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  static playClick() {
    this.audioFeedback();
    this.hapticFeedback();
  }

  static hapticFeedback() {
    if ("vibrate" in navigator) {
      navigator.vibrate(50);
    }
  }

  static audioFeedback() {
    try {
      const ctx = this.initAudio();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      const now = ctx.currentTime;
      const duration = 0.15; // Kürzerer, prägnanterer Ton

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, now); // A5 Note für einen klaren Ton

      // Knacken verhindern durch sanftes Ein/Ausblenden (Attack/Release)
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.2, now + 0.01); // Schneller Anstieg
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration); // Sanftes Ausklingen

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.start(now);
      oscillator.stop(now + duration + 0.05);
    } catch (e) {
      console.error("Audio feedback failed:", e);
    }
  }
}
