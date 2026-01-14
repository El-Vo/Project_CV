# CV Project MVP

Minimal local prototype for open-vocabulary object finding using YOLO-World.

## Features
- Open-vocab detection via the provided `yolov8s-world.pt` checkpoint.
- Works on webcam/video streams or single images.
- On-frame guidance: left/center/right + near/medium/far for the best match.

## Setup
1) Optional: Erstellen und Aktivieren einer virtuellen Umgebung.
2) Abhängigkeiten installieren:
   ```bash
   pip install -r requirements.txt
   ```
3) Das Modell befindet sich nun im Ordner `models/`.

## Projektstruktur
- `models/`: Enthält YOLO-World Gewichte (`yolov8s-world.pt`).
- `server/`: Backend-Logik.
  - `api/`: FastAPI App für Objekterkennung.
  - `utils/`: Vision-Hilfsfunktionen und Detektor-Klasse.
- `scripts/`: Hilfsskripte (z.B. zum Ausführen des MVP).
- `client/`: Web-Frontend Prototyp.

## Ausführungsbeispiele
- Webcam: 
  ```bash
  python scripts/run_mvp.py --prompt "red candle" --source 0
  ```
- Image:
  ```bash
  python scripts/run_mvp.py --prompt "wine bottle" --source Test_images/table.JPG
  ```
- Video file:
  ```bash
  python scripts/run_mvp.py --prompt "wine bottle" --source Test_images/video_wine_bottle.mp4
  ```

Die Steuerung bleibt gleich: `q` zum Beenden des Streams, beliebige Taste zum Schließen eines Bildfensters.

Controls: press `q` to quit a live stream window; any key closes an image window.

## Notes
- Reduce the `--display-width` to speed up inference on weak GPUs/CPUs.
- Guidance uses simple bbox size/location heuristics; fine-tune as needed.
- If you see slow FPS, try lowering the camera resolution and `--max-det`.
