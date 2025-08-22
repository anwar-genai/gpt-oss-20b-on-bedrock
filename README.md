# AWS Bedrock Interactive Chat

An interactive terminal-based chat application that uses AWS Bedrock's GPT-OSS-20B model for natural language conversations.

## Features

- 🤖 **Interactive Chat Interface**: Real-time conversation with AI assistant
- 💬 **Conversation Memory**: Maintains context across multiple messages
- 🧹 **Clean Output**: Automatically removes reasoning artifacts from responses
- 🛡️ **Error Handling**: Robust error handling for network issues and API errors
- 🚪 **Easy Exit**: Multiple ways to exit the conversation
- ⚡ **Fast Response**: Direct integration with AWS Bedrock API

## Prerequisites

Before running this application, you need:

1. **AWS Account**: An active AWS account with access to Amazon Bedrock
2. **AWS Credentials**: Configured AWS credentials (access key and secret key)
3. **Bedrock Access**: Access to the `openai.gpt-oss-20b-1:0` model in your AWS region
4. **Python 3.7+**: Python 3.7 or higher installed on your system

## Installation

1. **Clone or download the project files**
   ```bash
   # If using git
   git clone <repository-url>
   cd awsBedrock
   ```

2. **Install required dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure AWS credentials**
   
   You can configure AWS credentials in several ways:
   
   **Option A: AWS CLI (Recommended)**
   ```bash
   aws configure
   ```
   
   **Option B: Environment variables**
   ```bash
   export AWS_ACCESS_KEY_ID=your_access_key
   export AWS_SECRET_ACCESS_KEY=your_secret_key
   export AWS_DEFAULT_REGION=us-west-2
   ```
   
   **Option C: AWS credentials file**
   Create `~/.aws/credentials` (Linux/Mac) or `%UserProfile%\.aws\credentials` (Windows):
   ```ini
   [default]
   aws_access_key_id = your_access_key
   aws_secret_access_key = your_secret_key
   ```

## Usage

### Basic Usage

1. **Start the interactive chat**
   ```bash
   python bedrock_test.py
   ```

2. **Wait for connection confirmation**
   ```
   === AWS Bedrock Interactive Chat ===
   Type 'quit', 'exit', or 'bye' to end the conversation
   ==================================================
   ✓ Connected to AWS Bedrock
   
   Chat started! Ask me anything...
   ```

3. **Start chatting!**
   ```
   You: What is AWS Bedrock?
   Assistant: AWS Bedrock is a fully managed service that offers a choice of high-performing foundation models from leading AI companies...
   ```

4. **Exit the conversation**
   ```
   You: quit
   Goodbye!
   ```

### Web Frontend (Flask)

1. **Start the web server**
   ```bash
   python app.py
   ```

2. **Open the chat UI**
   - Visit `http://localhost:5000` in your browser
   - Type your message and press Send

3. **API endpoint**
   - `POST /api/chat`
   - Body:
     ```json
     { "messages": [{"role":"system","content":"..."}, {"role":"user","content":"..."}], "max_tokens": 300 }
     ```
   - Response:
     ```json
     { "text": "assistant response" }
     ```

### Available Commands

- `quit` - Exit the chat
- `exit` - Exit the chat  
- `bye` - Exit the chat
- `q` - Exit the chat
- `Ctrl+C` - Interrupt and exit the chat

## Configuration

### Model Settings

The application uses the following default settings:

- **Model**: `openai.gpt-oss-20b-1:0`
- **Region**: `us-west-2`
- **Max Tokens**: 300
- **Temperature**: 0.7

To modify these settings, edit the `send_message_to_bedrock()` function in `bedrock_core.py`:

```python
def send_message_to_bedrock(bedrock_client, messages, max_tokens=300):
    body = {
        "messages": messages,
        "max_completion_tokens": max_tokens,  # Change this value
        "temperature": 0.7  # Change this value
    }
    # ...
```

### AWS Region

By default, the region is taken from `AWS_REGION` or `AWS_DEFAULT_REGION` environment variables. To hardcode or change the default, edit `get_bedrock_client()` in `bedrock_core.py`.

```python
from bedrock_core import get_bedrock_client
bedrock = get_bedrock_client()  # Uses AWS_REGION or AWS_DEFAULT_REGION
```

## Troubleshooting

### Common Issues

1. **"Failed to connect to AWS Bedrock"**
   - Verify your AWS credentials are correctly configured
   - Ensure you have access to Amazon Bedrock in your AWS account
   - Check that the specified region supports the GPT-OSS-20B model

2. **"Access Denied" errors**
   - Ensure your AWS user/role has the necessary permissions for Bedrock
   - Required permissions: `bedrock:InvokeModel`

3. **Model not available**
   - Verify the model `openai.gpt-oss-20b-1:0` is available in your region
   - Check the AWS Bedrock console for available models

4. **No response generated**
   - Check your internet connection
   - Verify AWS service status
   - Try reducing the `max_completion_tokens` value

### Debug Mode

To enable debug output, uncomment the debug lines in the code:

```python
# Uncomment below lines for debugging the response structure
print("=== Raw Response Structure ===")
print(json.dumps(result, indent=2))
print("\n" + "="*50 + "\n")
```

## Project Structure

```
awsBedrock/
├── app.py               # Flask server exposing /api/chat and serving web UI
├── bedrock_core.py      # Shared Bedrock client and helpers
├── bedrock_test.py      # Terminal chat client
├── bedrock_test_clean.py # Alternative version with enhanced text cleaning
├── web/                 # Frontend static files
│   ├── index.html
│   └── app.js
├── requirements.txt     # Python dependencies
├── README.md            # This documentation file
└── virt/                # Virtual environment directory (if used)
```

## API Reference

### Functions

#### `clean_response_text(text)`
Cleans up model responses by removing reasoning blocks and artifacts.

**Parameters:**
- `text` (str): Raw response text from the model

**Returns:**
- `str`: Cleaned response text

#### `send_message_to_bedrock(bedrock_client, messages, max_tokens=300)`
Sends a message to AWS Bedrock and returns the response.

**Parameters:**
- `bedrock_client`: Boto3 Bedrock client instance
- `messages` (list): List of message dictionaries with 'role' and 'content'
- `max_tokens` (int): Maximum number of tokens in the response

**Returns:**
- `str`: Generated response text or error message

## Security Considerations

- **Credentials**: Never commit AWS credentials to version control
- **Environment Variables**: Use environment variables for sensitive data
- **IAM Roles**: Use IAM roles with minimal required permissions
- **Network Security**: Ensure secure network connections when accessing AWS services

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is provided as-is for educational and development purposes.

## Support

For issues related to:
- **AWS Bedrock**: Check the [AWS Bedrock documentation](https://docs.aws.amazon.com/bedrock/)
- **Boto3**: Check the [Boto3 documentation](https://boto3.amazonaws.com/v1/documentation/api/latest/index.html)
- **This Application**: Open an issue in the project repository

## Changelog

### Version 1.0.0
- Initial release
- Interactive chat interface
- Conversation memory
- Error handling
- Clean response processing
