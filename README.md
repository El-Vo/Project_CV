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

### Web App MVP (Browser Interface)

For the interactive browser interface with real-time overlay:

1. **Start the Backend**:
   ```bash
   uvicorn server.api.app:app --host 0.0.0.0 --port 8000 --reload
   ```
2. **Open in Browser**:
   Navigate to `http://localhost:8000`.

## Notes

- For custom prompts, the model might take a second to re-initialize classes on the first frame.
