from flask import Flask, request, jsonify, send_from_directory
from bedrock_core import send_message_to_bedrock, get_bedrock_client

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


if __name__ == "__main__":
    # Run development server
    app.run(host="0.0.0.0", port=5000, debug=True)


