import boto3
import json
import re

try:
    # Bedrock client
    bedrock = boto3.client(
        service_name="bedrock-runtime",
        region_name="us-west-2"
    )

    # Chat request body - more explicit instructions to avoid reasoning output
    body = {
        "messages": [
            {"role": "system", "content": "You are a helpful assistant. Provide only the requested content without any reasoning, explanations, or meta-commentary."},
            {"role": "user", "content": "Write exactly two sentences explaining why AWS regions matter for businesses and applications."}
        ],
        "max_completion_tokens": 900,
        "temperature": 0.7
    }

    print("Sending request to Bedrock...")
    
    response = bedrock.invoke_model(
        modelId="openai.gpt-oss-20b-1:0",
        contentType="application/json",
        accept="application/json",
        body=json.dumps(body)
    )

    print("Response received, parsing...")
    
    result = json.loads(response["body"].read())

    # Parse the response based on the format
    generated_text = ""
    
    if "choices" in result and len(result["choices"]) > 0:
        # OpenAI-style response format
        choice = result["choices"][0]
        if "message" in choice and "content" in choice["message"]:
            generated_text = choice["message"]["content"]
        elif "text" in choice:
            generated_text = choice["text"]
    elif "results" in result:
        # Alternative format with 'results'
        for item in result["results"]:
            for c in item.get("content", []):
                if "text" in c:
                    generated_text += c["text"]
    elif "response" in result:
        generated_text = result.get("response", "")
    else:
        # Try to find any text content
        if "content" in result:
            generated_text = result["content"]
        elif "text" in result:
            generated_text = result["text"]

    # Clean up the output
    if generated_text:
        print(f"Debug - Raw text length: {len(generated_text)}")
        print(f"Debug - Raw text (first 200 chars): {generated_text[:200]}...")
        
        # Remove any reasoning blocks or meta-commentary
        cleaned = re.sub(r'<reasoning>.*?</reasoning>', '', generated_text, flags=re.DOTALL)
        cleaned = cleaned.strip()
        
        print(f"Debug - After reasoning removal: {cleaned[:200]}...")
        
        # Look for actual content after reasoning removal
        if cleaned:
            generated_text = cleaned
        else:
            # If cleaning removed everything, try to extract from original
            # Look for sentences that look like actual content
            sentences = re.findall(r'[A-Z][^<]*?[.!?](?:\s|$)', generated_text)
            if sentences:
                # Filter out sentences that look like reasoning
                content_sentences = [s for s in sentences if not any(word in s.lower() for word in ['we need', 'let\'s', 'so we should', 'reasoning'])]
                if content_sentences:
                    generated_text = ' '.join(content_sentences[:2]).strip()
                else:
                    generated_text = ' '.join(sentences[:2]).strip()
            else:
                # Last resort: just clean and use what we have
                generated_text = re.sub(r'<[^>]*>', '', generated_text).strip()

    print("\n=== GPT-OSS-20B Output ===")
    if generated_text:
        print(generated_text)
    else:
        print("No text generated")
        print("\nDebug - Full response structure:")
        print(json.dumps(result, indent=2))

except Exception as e:
    print(f"Error occurred: {e}")
    import traceback
    traceback.print_exc()
