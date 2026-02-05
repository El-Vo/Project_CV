import { saveToFaissAPI } from "./api";

export class PersonalObjectPicture {
  async saveToDatabase(detection, image_jpg_blob) {
    const response = await saveToFaissAPI(
      detection.box,
      detection.label,
      image_jpg_blob,
    );
    if (!response.ok) return false;
    const data = await response.json();
    return data.success;
  }
}
