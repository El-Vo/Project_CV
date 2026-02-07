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

export const detectPersonalizedObjectAPI = (image_blob, label) => {
  const formData = new FormData();
  formData.append("file", image_blob, "frame.jpg");
  formData.append("label", label);

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

export const getPersonalObjectLabels = async () => {
  try {
    const response = await fetch(
      `${CONFIG.API_URL}/get_personal_object_labels`,
    );
    if (!response.ok) return [];
    const data = await response.json();
    return data.labels || [];
  } catch (error) {
    console.error("Error fetching labels:", error);
    return [];
  }
};

export const deletePersonalObjectAPI = async (label) => {
  try {
    const formData = new FormData();
    formData.append("label", label);

    const response = await fetch(`${CONFIG.API_URL}/delete_personal_object`, {
      method: "POST",
      body: formData,
    });
    return await response.json();
  } catch (error) {
    console.error("Error deleting label:", error);
    return { success: false };
  }
};
