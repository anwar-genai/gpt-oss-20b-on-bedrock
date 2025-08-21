import boto3
import json
import re

def clean_response_text(text):
    """Clean up the model response by removing reasoning blocks and artifacts."""
    if not text:
        return ""
    
    # Remove reasoning blocks if present
    cleaned = re.sub(r'<reasoning>.*?</reasoning>', '', text, flags=re.DOTALL)
    cleaned = cleaned.strip()
    
    return cleaned

def send_message_to_bedrock(bedrock_client, messages, max_tokens=300):
    """Send a message to Bedrock and return the response."""
    body = {
        "messages": messages,
        "max_completion_tokens": max_tokens,
        "temperature": 0.7
    }
    
    try:
        response = bedrock_client.invoke_model(
            modelId="openai.gpt-oss-20b-1:0",
            contentType="application/json",
            accept="application/json",
            body=json.dumps(body)
        )
        
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
        
        return clean_response_text(generated_text)
        
    except Exception as e:
        return f"Error: {str(e)}"

def main():
    print("=== AWS Bedrock Interactive Chat ===")
    print("Type 'quit', 'exit', or 'bye' to end the conversation")
    print("=" * 50)
    
    # Initialize Bedrock client
    try:
        bedrock = boto3.client(
            service_name="bedrock-runtime",
            region_name="us-west-2"
        )
        print("✓ Connected to AWS Bedrock")
    except Exception as e:
        print(f"✗ Failed to connect to AWS Bedrock: {e}")
        return
    
    # Initialize conversation with system message
    messages = [
        {"role": "system", "content": "You are a helpful assistant. Provide direct, clear answers without showing your reasoning process."}
    ]
    
    print("\nChat started! Ask me anything...")
    
    while True:
        try:
            # Get user input
            user_input = input("\nYou: ").strip()
            
            # Check for exit commands
            if user_input.lower() in ['quit', 'exit', 'bye', 'q']:
                print("Goodbye!")
                break
            
            if not user_input:
                continue
            
            # Add user message to conversation
            messages.append({"role": "user", "content": user_input})
            
            # Send to Bedrock and get response
            print("Assistant: ", end="", flush=True)
            response = send_message_to_bedrock(bedrock, messages)
            
            if response:
                print(response)
                # Add assistant response to conversation history
                messages.append({"role": "assistant", "content": response})
            else:
                print("Sorry, I couldn't generate a response.")
            
        except KeyboardInterrupt:
            print("\n\nChat interrupted. Goodbye!")
            break
        except Exception as e:
            print(f"\nError: {e}")
            continue

if __name__ == "__main__":
    main()
