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

export const getBoundingBoxFromCoordAPI = (x, y, image_blob) => {
  const formData = new FormData();
  formData.append("file", image_blob, "frame.jpg");
  formData.append("x", x);
  formData.append("y", y);

  return fetch(CONFIG.API_URL + CONFIG.GET_BBOX_PATH, {
    method: "POST",
    body: formData,
  });
};

export const saveToFaissAPI = (bbox, label, image_blob) => {
  const formData = new FormData();
  formData.append("file", image_blob, "frame.jpg");
  formData.append("bbox", JSON.stringify(bbox));
  formData.append("label", label);

  return fetch(CONFIG.API_URL + CONFIG.SAVE_TO_FAISS_PATH, {
    method: "POST",
    body: formData,
  });
};
