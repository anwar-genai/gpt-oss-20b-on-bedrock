import os
import json
import re
import boto3


def clean_response_text(text: str) -> str:
    """Clean up the model response by removing reasoning blocks and artifacts."""
    if not text:
        return ""

    cleaned = re.sub(r'<reasoning>.*?</reasoning>', '', text, flags=re.DOTALL)
    return cleaned.strip()


def get_bedrock_client():
    """Return a Bedrock runtime client using region from env or default."""
    region = (
        os.getenv("AWS_REGION")
        or os.getenv("AWS_DEFAULT_REGION")
        or "us-west-2"
    )
    return boto3.client(service_name="bedrock-runtime", region_name=region)


def send_message_to_bedrock(bedrock_client, messages, max_tokens: int = 300) -> str:
    """Send a message to Bedrock and return the cleaned response text."""
    body = {
        "messages": messages,
        "max_completion_tokens": max_tokens,
        "temperature": 0.7,
    }

    try:
        response = bedrock_client.invoke_model(
            modelId="openai.gpt-oss-20b-1:0",
            contentType="application/json",
            accept="application/json",
            body=json.dumps(body),
        )

        result = json.loads(response["body"].read())

        generated_text = ""

        if "choices" in result and len(result["choices"]) > 0:
            choice = result["choices"][0]
            if "message" in choice and "content" in choice["message"]:
                generated_text = choice["message"]["content"]
            elif "text" in choice:
                generated_text = choice["text"]
        elif "results" in result:
            for item in result["results"]:
                for c in item.get("content", []):
                    if "text" in c:
                        generated_text += c["text"]
        elif "response" in result:
            generated_text = result.get("response", "")
        else:
            if "content" in result:
                generated_text = result["content"]
            elif "text" in result:
                generated_text = result["text"]

        return clean_response_text(generated_text)

    except Exception as e:
        return f"Error: {str(e)}"


def stream_message_to_bedrock(bedrock_client, messages, max_tokens: int = 300):
    """Yield incremental text chunks from Bedrock using response streaming.

    This function attempts to be provider-agnostic by extracting any textual
    deltas present in streamed event payloads. If the model or account does not
    support streaming, it falls back to a single non-streaming response.
    """
    body = {
        "messages": messages,
        "max_completion_tokens": max_tokens,
        "temperature": 0.7,
        # Some providers require this hint; harmless for others
        "stream": True,
    }

    def extract_text(obj):
        # Try common streaming shapes
        # 1) OpenAI-style: { choices: [{ delta: { content: "..." } }] }
        try:
            choices = obj.get("choices")
            if choices:
                for choice in choices:
                    delta = choice.get("delta") or {}
                    if isinstance(delta, dict) and delta.get("content"):
                        yield delta.get("content")
                    # Some models might send {text: "..."}
                    if "text" in choice:
                        yield choice["text"]
        except Exception:
            pass

        # 2) Anthropic-style: { type: "content_block_delta", delta: { text: "..." } }
        delta = obj.get("delta")
        if isinstance(delta, dict) and delta.get("text"):
            yield delta.get("text")

        # 3) Generic fields often used by providers
        for key in ("text", "outputText", "output_text", "content"):
            val = obj.get(key)
            if isinstance(val, str) and val:
                yield val

        # 4) Nested content arrays
        content = obj.get("content")
        if isinstance(content, list):
            for c in content:
                if isinstance(c, dict) and "text" in c and isinstance(c["text"], str):
                    yield c["text"]

    # Attempt streaming first
    try:
        response = bedrock_client.invoke_model_with_response_stream(
            modelId="openai.gpt-oss-20b-1:0",
            contentType="application/json",
            accept="application/json",
            body=json.dumps(body),
        )

        for event in response.get("body", []):
            try:
                if "chunk" in event:
                    payload = json.loads(event["chunk"]["bytes"].decode("utf-8"))
                    for piece in extract_text(payload):
                        cleaned = clean_response_text(piece)
                        if cleaned:
                            yield cleaned
                elif "payloadPart" in event:  # safety for alt shapes
                    payload = json.loads(event["payloadPart"]["bytes"].decode("utf-8"))
                    for piece in extract_text(payload):
                        cleaned = clean_response_text(piece)
                        if cleaned:
                            yield cleaned
            except Exception:
                # Skip malformed chunks
                continue
        return
    except Exception:
        # Fall back to non-streaming if streaming unsupported
        text = send_message_to_bedrock(bedrock_client, messages, max_tokens=max_tokens)
        # Emit in small slices to simulate streaming
        for i in range(0, len(text), 40):
            yield text[i:i+40]



