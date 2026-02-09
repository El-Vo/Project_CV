import { getPersonalObjectLabels } from "./modules/api.js";
import { UIFeedback } from "./modules/uiFeedback.js";
import { TextToSpeech } from "./modules/tts.js";

export class DetectPersonalizedSelect {
  constructor() {
    this.container = document.getElementById("object-list-container");
    this.init();
  }

  async init() {
    TextToSpeech.speak("Select a personal item to detect");
    const labels = await getPersonalObjectLabels();
    this.renderList(labels);
  }

  renderList(labels) {
    this.container.innerHTML = "";

    if (!labels || labels.length === 0) {
      this.container.innerHTML =
        '<p class="text-center">No items found in database.</p>';
      return;
    }

    labels.forEach((label) => {
      const btn = document.createElement("button");
      btn.className =
        "btn btn-secondary btn-lg d-flex align-items-center justify-content-center flex-fill w-100";
      btn.style.minHeight = "0"; // Allow buttons to shrink if many exist
      btn.innerHTML = `<span>${label}</span>`;

      let selectConfirmMode = false;
      let resetTimeout = null;

      btn.addEventListener("click", async () => {
        UIFeedback.playClick();

        if (!selectConfirmMode) {
          // Reset all other buttons first
          Array.from(this.container.querySelectorAll("button")).forEach((b) => {
            b.classList.remove("btn-primary");
            b.classList.add("btn-secondary");
            // If we wanted to reset the innerHTML too, we'd need to store the labels or parse them
            // But for simplicity, we just change the current one
          });

          selectConfirmMode = true;
          btn.innerHTML = `<span>Tap again to select ${label}</span>`;
          btn.classList.remove("btn-secondary");
          btn.classList.add("btn-primary");
          TextToSpeech.speak(`Tap again to select ${label}`);

          // Reset if not clicked again within 5 seconds
          if (resetTimeout) clearTimeout(resetTimeout);
          resetTimeout = setTimeout(() => {
            selectConfirmMode = false;
            btn.innerHTML = `<span>${label}</span>`;
            btn.classList.remove("btn-primary");
            btn.classList.add("btn-secondary");
          }, 5000);
        } else {
          if (resetTimeout) clearTimeout(resetTimeout);
          TextToSpeech.speak(`Searching for ${label}`);
          localStorage.setItem("selectedTargetLabel", label);
          window.location.href = "detect_personalized.html";
        }
      });

      this.container.appendChild(btn);
    });
  }
}
