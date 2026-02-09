# CV Project MVP

Minimal local prototype for open-vocabulary object finding using YOLO-World.

## Features

- **Open-Vocabulary Detection**: Detect anything by typing a prompt, powered by `yolov8s-world.pt`.
- **Hybrid Support**: Works with webcams, video streams, or static images.
- **On-Frame Guidance**: Provides real-time feedback (left/center/right and near/medium/far) for the best match.
- **Web Interface**: Modern browser-based UI for mobile and desktop testing.

## Setup

1. **Environment (Optional)**: Highly recommended to use a virtual environment (`venv` or `conda`).
2. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```
3. **Model Weights**: Ensure the `yolov8s-world.pt` file is present in the `models/` folder.

## Project Structure

- `models/`: Contains YOLO-World weights.
- `server/`: Backend logic.
  - `api/`: FastAPI application for object detection.
  - `utils/`: Vision utility functions and the `ObjectDetector` class.
- `scripts/`: Helper scripts (e.g., for running the CLI MVP).
- `docs/`: Web frontend prototype (HTML/JS).

## Usage

### Web App MVP (Browser Interface)

For the interactive browser interface with real-time overlay:

1. **Start the Backend**:
   Run the FastAPI server with development mode enabled:

   ```bash
   fastapi dev server/api.py
   ```

   The API provides the detection endpoints.

2. **Host the Frontend**:
   Open a new terminal and serve the static `docs` folder:

   ```bash
   python -m http.server --directory docs 8081
   ```

3. **Open in Browser**:
   Navigate to `http://127.0.0.1:8081` to use the app.

### Remote Testing on Android (Chrome)

To test the application on an Android device with full camera access (requires a "Secure Context"), it is recommended to use **USB Port Forwarding**:

1.  **Preparation**:
    - Enable **USB Debugging** on your Android device (Settings > About Phone > Tap 'Build Number' 7 times > Developer Options).
    - Connect your device to your computer via USB.
2.  **Start Services**: Ensure both the backend (Port 8000) and frontend (Port 8081) are running on your computer.
3.  **Chrome Port Forwarding**:
    - Open `chrome://inspect/#devices` in Chrome on your computer.
    - Click **Port forwarding...**.
    - Add rules:
      - `8081` -> `127.0.0.1:8081`
      - `8000` -> `127.0.0.1:8000`
    - Check **Enable port forwarding** and click **Done**.
4.  **Access**: Open Chrome on your Android device and navigate to `http://127.0.0.1:8081`.
