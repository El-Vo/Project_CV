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
- `client/`: Web frontend prototype (HTML/JS).

## Usage

### 1. Command Line MVP (OpenCV Window)
Use the helper script for a quick local validation:
- **Webcam**: 
  ```bash
  python scripts/run_mvp.py --prompt "red candle" --source 0
  ```
- **Image**:
  ```bash
  python scripts/run_mvp.py --prompt "wine bottle" --source Test_images/table.JPG
  ```

### 2. Web App MVP (Browser Interface)
For the interactive browser interface with real-time overlay:

1. **Start the Backend**:
   ```bash
   uvicorn server.api.app:app --host 0.0.0.0 --port 8000 --reload
   ```
2. **Open in Browser**:
   Navigate to `http://localhost:8000`.

3. **Mobile Testing (Android)**:
   If you are developing on a laptop and have an Android device connected via USB:
   ```bash
   adb reverse tcp:8000 tcp:8000
   ```
   Then open `http://localhost:8000` in the Chrome browser on your phone.

## Performance Tuning
- **Latency**: Reduce `--display-width` in the detector or capture resolution to speed up inference on weak GPUs/CPUs.
- **Stability**: The web app includes a movement threshold to pause processing when the object is stable, saving battery and CPU.
- **FPS**: Lower the camera resolution and `--max-det` if you experience low frame rates.

## Notes
- Guidance is based on simple bounding box heuristics (area and center-x).
- For custom prompts, the model might take a second to re-initialize classes on the first frame.
