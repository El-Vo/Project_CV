export const CONFIG = {
    API_URL: 'http://localhost:8000/detect',
    DEPTH_MODEL: 'onnx-community/depth-anything-v2-small',
    DEPTH_WIDTH: 168,
    DEPTH_HEIGHT: 168,
    DEPTH_FPS: 15,
    DETECTION_FPS: 5,
    DETECTION_MAX_WIDTH: 224,
    DETECTION_MAX_HEIGHT: 224,
    AUDIO_BEEP_FREQ: 800,
    AUDIO_MIN_DELAY: 100,
    AUDIO_MAX_DELAY: 1000,
    TRACKER_SEARCH_RANGE: 60, // Grösserer Suchbereich für schnellere Bewegungen
    TRACKER_SENSITIVITY: 200 // Deutlich toleranter für Lichtveränderungen
};
