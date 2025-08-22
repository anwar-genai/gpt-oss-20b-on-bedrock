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


