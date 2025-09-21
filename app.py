from flask import Flask, request, jsonify, send_from_directory, Response
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from bedrock_core import send_message_to_bedrock, get_bedrock_client, stream_message_to_bedrock

app = Flask(__name__, static_folder="web", static_url_path="")
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///chatanwar.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db = SQLAlchemy(app)


class Chat(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    chat_id = db.Column(db.Integer, db.ForeignKey('chat.id'), nullable=False, index=True)
    role = db.Column(db.String(20), nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


# Initialize DB and Bedrock client once
bedrock = None
try:
    with app.app_context():
        db.create_all()
    bedrock = get_bedrock_client()
    app.logger.info("Connected to AWS Bedrock runtime")
except Exception as e:
    app.logger.error(f"Failed to initialize Bedrock client: {e}")
    bedrock = None


@app.get("/")
def serve_index():
    return send_from_directory(app.static_folder, "index.html")


@app.post("/api/chat")
def api_chat():
    if bedrock is None:
        return jsonify({"error": "Bedrock client not initialized"}), 500

    try:
        payload = request.get_json(force=True, silent=False) or {}
        messages = payload.get("messages")
        max_tokens = int(payload.get("max_tokens", 4000))
        
        # Debug: log what we're receiving
        app.logger.info(f"Received messages: {messages}")
        app.logger.info(f"Max tokens: {max_tokens}")

        if not isinstance(messages, list) or not messages:
            return jsonify({"error": "'messages' must be a non-empty list"}), 400

        text = send_message_to_bedrock(bedrock, messages, max_tokens=max_tokens)
        return jsonify({"text": text})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.post("/api/chat/stream")
def api_chat_stream():
    if bedrock is None:
        return Response("event: error\ndata: Bedrock client not initialized\n\n", mimetype="text/event-stream")

    try:
        payload = request.get_json(force=True, silent=False) or {}
        max_tokens = int(payload.get("max_tokens", 4000))

        chat_id = payload.get("chat_id")
        content = payload.get("content")
        messages = payload.get("messages")

        # Branch: DB-backed streaming if chat_id + content provided
        if chat_id and isinstance(content, str):
            try:
                chat = Chat.query.get(int(chat_id))
            except Exception:
                chat = None
            if chat is None:
                return Response("event: error\ndata: chat not found\n\n", mimetype="text/event-stream")

            # Build conversation from DB history + new user message
            history = Message.query.filter_by(chat_id=chat.id).order_by(Message.created_at.asc()).all()
            convo = [{"role": "system", "content": "You are a helpful assistant. Always format responses in Markdown with clear headings, paragraphs, numbered/bulleted lists, and tables when appropriate. Do not include hidden reasoning. Do not use HTML tags; use pure Markdown only. When approaching token limits, conclude your response naturally with a summary or next steps rather than cutting off mid-sentence."}]
            for m in history:
                convo.append({"role": m.role, "content": m.content})
            convo.append({"role": "user", "content": content})

            # Persist user message now
            try:
                db.session.add(Message(chat_id=chat.id, role="user", content=content))
                db.session.commit()
            except Exception:
                db.session.rollback()

            def generate_db():
                full_text = []
                try:
                    for chunk in stream_message_to_bedrock(bedrock, convo, max_tokens=max_tokens):
                        full_text.append(chunk)
                        yield f"data: {chunk}\n\n"
                    # Save assistant message
                    try:
                        db.session.add(Message(chat_id=chat.id, role="assistant", content="".join(full_text)))
                        db.session.commit()
                    except Exception:
                        db.session.rollback()
                    yield "event: done\ndata: end\n\n"
                except Exception as e:
                    yield f"event: error\ndata: {str(e)}\n\n"

            return Response(generate_db(), mimetype="text/event-stream")

        # Fallback: stateless streaming using provided message array
        if not isinstance(messages, list) or not messages:
            return Response("event: error\ndata: invalid messages\n\n", mimetype="text/event-stream")
        
        # Debug: log what we're receiving for streaming
        app.logger.info(f"Streaming messages: {messages}")
        app.logger.info(f"Streaming max_tokens: {max_tokens}")

        def generate_stateless():
            try:
                for chunk in stream_message_to_bedrock(bedrock, messages, max_tokens=max_tokens):
                    yield f"data: {chunk}\n\n"
                yield "event: done\ndata: end\n\n"
            except Exception as e:
                yield f"event: error\ndata: {str(e)}\n\n"

        return Response(generate_stateless(), mimetype="text/event-stream")
    except Exception as e:
        return Response(f"event: error\ndata: {str(e)}\n\n", mimetype="text/event-stream")


@app.post("/api/chats")
def create_chat():
    payload = request.get_json(force=True, silent=True) or {}
    title = payload.get("title") or "New chat"
    chat = Chat(title=title)
    db.session.add(chat)
    db.session.commit()
    return jsonify({"id": chat.id, "title": chat.title, "createdAt": chat.created_at.isoformat()})


@app.get("/api/chats")
def list_chats():
    rows = Chat.query.order_by(Chat.created_at.desc()).all()
    return jsonify([{"id": c.id, "title": c.title, "createdAt": c.created_at.isoformat()} for c in rows])


@app.get("/api/chats/<int:chat_id>/messages")
def list_messages(chat_id: int):
    rows = Message.query.filter_by(chat_id=chat_id).order_by(Message.created_at.asc()).all()
    return jsonify([{"role": m.role, "content": m.content, "createdAt": m.created_at.isoformat()} for m in rows])


if __name__ == "__main__":
    # Run development server
    app.run(host="0.0.0.0", port=5000, debug=True)


