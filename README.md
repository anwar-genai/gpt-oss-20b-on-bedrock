# ChatAnwar (AWS Bedrock web chat)

ChatAnwar is a lightweight web app and API for chatting with AWS Bedrock models. It includes a modern browser UI (streaming responses, Markdown rendering, themes, and chat history) backed by a small Flask server.

## Features

- 🤖 **Web Chat UI**: Live streaming responses, Markdown (headings, lists, code, tables)
- 🎨 **Themes**: Dark, Light, and Solar themes with persistence
- 🗂️ **Chat History**: Local, persistent sidebar with quick switching
- ⌨️ **UX**: Enter to send, Shift+Enter for newline, auto-resizing input
- 📋 **Actions**: Copy assistant message content
- 🔌 **API**: Simple `/api/chat` and `/api/chat/stream` endpoints

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

### Web App (recommended)

1. Start the server
   ```bash
   python app.py
   ```

2. Open `http://localhost:5000`
   - Type your message and press Enter
   - Watch responses stream in real-time
   - Use the sidebar to switch chats; click New chat to start fresh

### Web Frontend (Flask)

1. **Start the web server**
   ```bash
   python app.py
   ```

2. **Open the chat UI**
   - Visit `http://localhost:5000` in your browser
   - Type your message and press Send

3. **API endpoints**
   - `POST /api/chat`
   - Body:
     ```json
     { "messages": [{"role":"system","content":"..."}, {"role":"user","content":"..."}], "max_tokens": 300 }
     ```
   - Response:
     ```json
     { "text": "assistant response" }
     ```
   - `POST /api/chat/stream` (Server-Sent Events)
     - Streams `data: <token>` lines and ends with `event: done`.

### CLI (optional)

For a terminal chat client, run:
```bash
python bedrock_test.py
```

## Configuration

### Model Settings

Defaults:

- **Model**: `openai.gpt-oss-20b-1:0`
- **Region**: `us-west-2` (or from `AWS_REGION`/`AWS_DEFAULT_REGION`)
- **Max Tokens**: 300
- **Temperature**: 0.7

To modify these settings, edit `send_message_to_bedrock()` in `bedrock_core.py`:

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

By default, the region is taken from `AWS_REGION` or `AWS_DEFAULT_REGION`. To hardcode or change the default, edit `get_bedrock_client()` in `bedrock_core.py`.

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
├── README.md            # Public documentation (this file)
├── README_DEV.md        # Developer notes (internal)
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
