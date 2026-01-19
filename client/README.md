# Client

Browser-first UI for camera-based open-vocabulary guidance.

## Local Execution
To run the client locally, start a web server in the `client` folder:

```bash
cd client
python3 -m http.server 3000
```
Then open `http://localhost:3000/public/index.html` in your browser.

## Folders
- `public/`: Static files (`index.html`, `style.css`, etc.).
- `src/`: UI logic ([main.js](../src/main.js), [ar.js](../src/ar.js)).
- `assets/`: Fonts, shapes, mock data.
