import { CONFIG } from "./config.js";

export const detectObjectAPI = (prompt, image_blob) => {
  const formData = new FormData();
  formData.append("file", image_blob, "frame.jpg");
  formData.append("prompt", prompt);

  return fetch(CONFIG.API_URL, {
    method: "POST",
    body: formData,
  });
};
