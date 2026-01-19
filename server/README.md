# Server / API Helpers

Dieser Server stellt ausschließlich die API für die Objekterkennung bereit.

## API Endpunkte
- `POST /detect`: Nimmt ein Bild und einen Prompt entgegen und gibt die Erkennungsergebnisse zurück.

## Ausführung
```bash
uvicorn server.api.app:app --host 0.0.0.0 --port 8000 --reload
```
