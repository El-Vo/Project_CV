import { CONFIG } from "./config.js";
export class TextToSpeech {
  static _initialized = false;

  static async getBestVoice(lang = "en-US") {
    let voices = window.speechSynthesis.getVoices();

    // If voices are not loaded, wait for them
    if (voices.length === 0) {
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, 1000);
        window.speechSynthesis.addEventListener(
          "voiceschanged",
          () => {
            clearTimeout(timer);
            resolve();
          },
          { once: true },
        );
      });
      voices = window.speechSynthesis.getVoices();
    }

    if (voices.length === 0) return null;

    // Voice Priorities:
    return (
      voices.find((v) => v.name === "Google US English") ||
      voices.find((v) => v.name.includes("Eddy")) ||
      voices.find((v) => v.name.includes("Samantha")) ||
      voices.find(
        (v) => v.lang.includes(lang.split("-")[0]) && v.localService === false,
      ) ||
      voices.find((v) => v.lang.includes(lang.split("-")[0])) ||
      null
    );
  }

  static async speak(text, lang = "en-US") {
    if (!window.speechSynthesis || CONFIG.ENABLE_TTS) {
      console.warn(
        "Speech Synthesis not supported in this browser or turned off by configuration.",
      );
      return;
    }

    const bestVoice = await this.getBestVoice(lang);

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    if (bestVoice) {
      utterance.voice = bestVoice;
    }

    utterance.lang = lang;
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  }
}
