# Server / API Helpers

This server provides only the API for object detection.

## API Endpoints
- `POST /detect`: Accepts an image and a prompt and returns the detection results.

## Execution
```bash
uvicorn server.api.app:app --host 0.0.0.0 --port 8000 --reload
```
