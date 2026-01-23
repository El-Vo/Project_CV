import { CONFIG } from './config.js';

export async function detectObjects(canvas, prompt) {
    return new Promise((resolve) => {
        canvas.toBlob(async (blob) => {
            if (!blob) return resolve(null);
            
            const formData = new FormData();
            formData.append('file', blob, 'frame.jpg');
            formData.append('prompt', prompt);

            try {
                const response = await fetch(CONFIG.API_URL, { method: 'POST', body: formData });
                const data = await response.json();
                resolve(data);
            } catch (err) {
                console.error("Detection API error:", err);
                resolve(null);
            }
        }, 'image/jpeg', 0.7);
    });
}
