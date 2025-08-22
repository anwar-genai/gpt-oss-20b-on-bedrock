# ChatAnwar – Developer Notes

This doc is for your personal reference. It captures what we built, why, and how to run/debug.

## What we built

- Flask backend (`app.py`)
  - `POST /api/chat` – non-streaming JSON
  - `POST /api/chat/stream` – SSE streaming (`data: <text>` … then `event: done`)
  - Serves the static UI from `web/`
- Bedrock core (`bedrock_core.py`)
  - `get_bedrock_client()` – region from `AWS_REGION`/`AWS_DEFAULT_REGION`, default `us-west-2`
  - `send_message_to_bedrock()` – normal call with response normalization
  - `stream_message_to_bedrock()` – uses `invoke_model_with_response_stream`, falls back to chunked non-streaming
- Web UI (`web/`)
  - `index.html` – layout, themes (dark/light/solar), sidebar, sticky input
  - `app.js` – streaming fetch, lightweight Markdown renderer, Enter submit, Shift+Enter newline, auto-resize, Copy button
  - Chat history in localStorage with titles and active chat persistence

## Why these choices

- SSE is simpler than websockets and good for one-way token streams
- LocalStorage avoids DB; easy persistence for personal use
- Custom markdown keeps dependencies minimal while rendering headings/lists/code/tables/links/bold/italic safely

## Run locally

```bash
pip install -r requirements.txt
python app.py
# open http://localhost:5000
```

AWS credentials must allow `bedrock:InvokeModel` and the model `openai.gpt-oss-20b-1:0` in your region.

## Debugging

- Backend streaming: watch logs from `api_chat_stream`
- If streaming not supported, fallback simulates streaming by slicing the full response
- UI issues: ensure `#chat-list` exists; theme vars control input/bg/border colors

## State & persistence

- `localStorage.chats` – map of `{ id, title, messages, createdAt }`
- `localStorage.currentChatId` – last open chat
- Titles derive from first user message (first 40 chars)

## Project layout

```
app.py                # Flask server (API + static)
bedrock_core.py       # Bedrock helpers (stream + non-stream)
web/index.html        # UI
web/app.js            # Logic (streaming, markdown, history, themes)
requirements.txt      # Flask + boto3
README.md             # Public readme
README_DEV.md         # This file
```

## Next steps (ideas)

- Delete/rename chats; timestamps in sidebar
- Parameter controls (model, temperature, tokens) in UI
- Export/import local chat history (JSON)
- Server-side persistence (SQLite) behind simple endpoints
- Better markdown support (blockquote, images if needed)

## Production notes

Use a WSGI server behind a reverse proxy; enable keep-alive for SSE:
```bash
gunicorn -w 2 -b 0.0.0.0:5000 app:app
```
Attach IAM role or env vars for AWS credentials.


