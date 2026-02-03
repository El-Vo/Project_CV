import { CONFIG } from "./config.js";

export const detectGenericObjectAPI = (prompt, image_blob) => {
  const formData = new FormData();
  formData.append("file", image_blob, "frame.jpg");
  formData.append("prompt", prompt);

  return fetch(CONFIG.API_URL + CONFIG.GENERIC_DETECTION_PATH, {
    method: "POST",
    body: formData,
  });
};

export const detectPersonalizedObjectAPI = (image_blob) => {
  const formData = new FormData();
  formData.append("file", image_blob, "frame.jpg");

  return fetch(CONFIG.API_URL + CONFIG.PERSONALIZED_DETECTION_PATH, {
    method: "POST",
    body: formData,
  }).catch((err) => {
    return {};
  });
};
