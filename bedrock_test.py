from bedrock_core import get_bedrock_client, send_message_to_bedrock
import re
import html as html_lib

try:
    from rich.console import Console
    from rich.markdown import Markdown
    from rich.panel import Panel
    from rich.align import Align
    RICH_AVAILABLE = True
except Exception:  # pragma: no cover
    RICH_AVAILABLE = False

"""
Terminal-based chat client for AWS Bedrock using shared core functions.
Enhanced to render messages like a chat, center output, auto-clear, and
sanitize HTML to Markdown to avoid raw tags in the terminal.
"""


def sanitize_to_markdown(text: str) -> str:
    """Convert common HTML into Markdown and strip remaining tags.

    This keeps output readable in terminals and avoids raw HTML tags.
    """
    if not isinstance(text, str):
        return ""

    result = html_lib.unescape(text)

    # Convert anchors to Markdown links
    def _anchor_to_md(match: re.Match) -> str:
        url = match.group(1) or ""
        label = match.group(2) or url
        return f"[{label}]({url})"

    result = re.sub(r"<a\s+[^>]*?href=\"([^\"]+)\"[^>]*>(.*?)</a>", _anchor_to_md, result, flags=re.IGNORECASE | re.DOTALL)

    # Replace common block/inline tags with Markdown/newlines
    replacements = [
        (r"<br\s*/?>", "\n"),
        (r"</p>", "\n\n"),
        (r"<p[^>]*>", ""),
        (r"</div>", "\n\n"),
        (r"<div[^>]*>", ""),
        (r"<li[^>]*>", "- "),
        (r"</li>", "\n"),
        (r"</?ul[^>]*>", ""),
        (r"</?ol[^>]*>", ""),
        (r"<strong[^>]*>", "**"),
        (r"</strong>", "**"),
        (r"<b[^>]*>", "**"),
        (r"</b>", "**"),
        (r"<em[^>]*>", "*"),
        (r"</em>", "*"),
        (r"<i[^>]*>", "*"),
        (r"</i>", "*"),
        (r"<code[^>]*>", "`"),
        (r"</code>", "`"),
        (r"<pre[^>]*>", "```\n"),
        (r"</pre>", "\n```"),
        (r"<h1[^>]*>", "# "),
        (r"</h1>", "\n\n"),
        (r"<h2[^>]*>", "## "),
        (r"</h2>", "\n\n"),
        (r"<h3[^>]*>", "### "),
        (r"</h3>", "\n\n"),
        (r"<h4[^>]*>", "#### "),
        (r"</h4>", "\n\n"),
    ]

    for pattern, repl in replacements:
        result = re.sub(pattern, repl, result, flags=re.IGNORECASE)

    # Strip any remaining tags
    result = re.sub(r"<[^>]+>", "", result)

    # Collapse excessive blank lines
    result = re.sub(r"\n{3,}", "\n\n", result).strip()
    return result


def render_conversation(console: "Console", messages: list) -> None:
    visible = [m for m in messages if m.get("role") in ("user", "assistant")]
    # Show only the last 10 turns to avoid excessive scrolling
    recent = visible[-10:]

    console.clear()
    console.rule("AWS Bedrock Chat")
    for m in recent:
        role = m.get("role")
        raw_content = m.get("content", "")
        content = sanitize_to_markdown(raw_content)
        if RICH_AVAILABLE:
            md = Markdown(content, code_theme="monokai", hyperlinks=True)
            title = "Assistant" if role == "assistant" else "You"
            border = "cyan" if role == "assistant" else "green"
            panel = Panel.fit(md, title=title, border_style=border)
            console.print(Align.center(panel))
        else:
            header = "Assistant:" if role == "assistant" else "You:"
            print(f"\n{header}\n{content}\n")


def main():
    console = Console() if RICH_AVAILABLE else None

    if RICH_AVAILABLE:
        console.rule("Connecting…")
    else:
        print("=== AWS Bedrock Interactive Chat ===")
        print("Type 'quit', 'exit', or 'bye' to end the conversation")
        print("=" * 50)

    try:
        bedrock = get_bedrock_client()
        if RICH_AVAILABLE:
            console.print(Align.center(Panel.fit("Connected to AWS Bedrock ✓", border_style="green")))
        else:
            print("✓ Connected to AWS Bedrock")
    except Exception as e:
        msg = f"✗ Failed to connect to AWS Bedrock: {e}"
        if RICH_AVAILABLE:
            console.print(Align.center(Panel.fit(msg, border_style="red")))
        else:
            print(msg)
        return

    messages = [
        {
            "role": "system",
            "content": (
                "You are a helpful assistant. Always format responses in Markdown with clear headings, "
                "paragraphs, numbered/bulleted lists, and tables when appropriate. Do not include hidden reasoning. "
                "Do not use HTML tags; use pure Markdown only."
            ),
        }
    ]

    if RICH_AVAILABLE:
        console.print(Align.center(Panel.fit("Chat started! Ask me anything…", border_style="blue")))
    else:
        print("\nChat started! Ask me anything...")

    while True:
        try:
            if RICH_AVAILABLE:
                render_conversation(console, messages)
                user_input = input("\nYou: ").strip()
            else:
                user_input = input("\nYou: ").strip()

            if user_input.lower() in ["quit", "exit", "bye", "q"]:
                if RICH_AVAILABLE:
                    console.print(Align.center(Panel.fit("Goodbye!", border_style="blue")))
                else:
                    print("Goodbye!")
                break

            if not user_input:
                continue

            messages.append({"role": "user", "content": user_input})

            if RICH_AVAILABLE:
                render_conversation(console, messages)
                console.print(Align.center(Panel.fit("Thinking…", border_style="yellow")))
            else:
                print("Assistant: ", end="", flush=True)

            response = send_message_to_bedrock(bedrock, messages)

            if response:
                sanitized = sanitize_to_markdown(response)
                messages.append({"role": "assistant", "content": sanitized})
                if RICH_AVAILABLE:
                    render_conversation(console, messages)
                else:
                    print(sanitized)
            else:
                error_msg = "Sorry, I couldn't generate a response."
                messages.append({"role": "assistant", "content": error_msg})
                if RICH_AVAILABLE:
                    render_conversation(console, messages)
                else:
                    print(error_msg)

        except KeyboardInterrupt:
            if RICH_AVAILABLE:
                console.print("\n")
                console.print(Align.center(Panel.fit("Chat interrupted. Goodbye!", border_style="blue")))
            else:
                print("\n\nChat interrupted. Goodbye!")
            break
        except Exception as e:
            err = f"Error: {e}"
            if RICH_AVAILABLE:
                console.print(Align.center(Panel.fit(err, border_style="red")))
            else:
                print(f"\n{err}")
            continue


if __name__ == "__main__":
    main()
