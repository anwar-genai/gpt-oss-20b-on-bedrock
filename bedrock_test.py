from bedrock_core import get_bedrock_client, send_message_to_bedrock

"""
Terminal-based chat client for AWS Bedrock using shared core functions.
"""

def main():
    print("=== AWS Bedrock Interactive Chat ===")
    print("Type 'quit', 'exit', or 'bye' to end the conversation")
    print("=" * 50)
    
    # Initialize Bedrock client
    try:
        bedrock = get_bedrock_client()
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
