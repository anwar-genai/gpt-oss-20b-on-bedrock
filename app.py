from flask import Flask, request, jsonify, send_from_directory, Response
from bedrock_core import send_message_to_bedrock, get_bedrock_client, stream_message_to_bedrock

app = Flask(__name__, static_folder="web", static_url_path="")


# Initialize Bedrock client once
try:
    bedrock = get_bedrock_client()
    app.logger.info("Connected to AWS Bedrock runtime")
except Exception as e:
    bedrock = None
    app.logger.error(f"Failed to initialize Bedrock client: {e}")


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
        max_tokens = int(payload.get("max_tokens", 300))

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
        messages = payload.get("messages")
        max_tokens = int(payload.get("max_tokens", 300))
        if not isinstance(messages, list) or not messages:
            return Response("event: error\ndata: invalid messages\n\n", mimetype="text/event-stream")

        def generate():
            try:
                for chunk in stream_message_to_bedrock(bedrock, messages, max_tokens=max_tokens):
                    # SSE data line; client parses incrementally
                    yield f"data: {chunk}\n\n"
                yield "event: done\ndata: end\n\n"
            except Exception as e:
                yield f"event: error\ndata: {str(e)}\n\n"

        return Response(generate(), mimetype="text/event-stream")
    except Exception as e:
        return Response(f"event: error\ndata: {str(e)}\n\n", mimetype="text/event-stream")


if __name__ == "__main__":
    # Run development server
    app.run(host="0.0.0.0", port=5000, debug=True)


