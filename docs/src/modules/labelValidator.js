import { getPersonalObjectLabels } from "./api.js";

export class LabelValidator {
  static async labelExists(label) {
    try {
      const labels = await getPersonalObjectLabels();
      const searchLabel = label.toLowerCase();
      return labels.some(
        (existingLabel) => existingLabel.toLowerCase() === searchLabel,
      );
    } catch (error) {
      console.error("Error validating label:", error);
      return false;
    }
  }
}
