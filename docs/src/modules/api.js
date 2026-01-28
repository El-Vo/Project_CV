export const detectObjectAPI = (image_blob, prompt) => {
  const formData = new FormData();
  formData.append("file", image_blob, "frame.jpg");
  formData.append("prompt", prompt);

  return fetch(CONFIG.API_URL, {
    method: "POST",
    body: formData,
  });
};
