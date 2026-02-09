import { TextToSpeech } from "./modules/tts.js";
import { UIFeedback } from "./modules/uiFeedback.js";

export class MainMenu {
  constructor() {
    this.init();
  }

  init() {
    // Call speak when the menu is initialized
    TextToSpeech.speak("Main Menu");

    // Add click listeners to all buttons/links
    const links = document.querySelectorAll("a.btn");
    links.forEach((link) => {
      link.addEventListener("click", () => UIFeedback.playClick());
    });
  }
}
