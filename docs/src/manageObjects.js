import {
  getPersonalObjectLabels,
  deletePersonalObjectAPI,
} from "./modules/api.js";
import { UIFeedback } from "./modules/uiFeedback.js";
import { TextToSpeech } from "./modules/tts.js";

export class ManageObjects {
  constructor() {
    this.container = document.getElementById("object-list-container");
    this.init();
  }

  async init() {
    TextToSpeech.speak("Manage Personal Items");
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

      let deleteConfirmMode = false;
      let resetTimeout = null;

      btn.addEventListener("click", async () => {
        UIFeedback.playClick();

        if (!deleteConfirmMode) {
          deleteConfirmMode = true;
          btn.innerHTML = `<span>Tap again to delete personal item ${label}</span>`;
          btn.classList.remove("btn-secondary");
          btn.classList.add("btn-danger");
          TextToSpeech.speak(`Tap again to delete personal item ${label}`);
        } else {
          // Clear timeout if clicked within 5s
          if (resetTimeout) clearTimeout(resetTimeout);

          TextToSpeech.speak(`Deleting ${label}`);
          const result = await deletePersonalObjectAPI(label);
          if (result && result.success) {
            TextToSpeech.speak(`Successfully deleted ${label}`);
            this.init(); // Refresh list
          } else {
            TextToSpeech.speak(`Failed to delete ${label}`);
            // Reset UI state
            deleteConfirmMode = false;
            btn.innerHTML = `<span>${label}</span>`;
            btn.classList.remove("btn-danger");
            btn.classList.add("btn-secondary");
          }
        }
      });

      this.container.appendChild(btn);
    });
  }
}
