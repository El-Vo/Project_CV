# Client

Browser-first UI for camera-based open-vocabulary guidance.

## Lokale Ausführung
Um den Client lokal auszuführen, starte einen Webserver im `client`-Ordner:

```bash
cd client
python3 -m http.server 3000
```
Dann öffne `http://localhost:3000/public/index.html` im Browser.

## Folders
- `public/`: Statische Dateien (`index.html`, `style.css`, etc.).
- `src/`: UI-Logik ([main.js](../src/main.js), [ar.js](../src/ar.js)).
- `assets/`: Schriftarten, Formen, Mock-Daten.
