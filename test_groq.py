#!/usr/bin/env python3
"""Quick test that Groq API key from .env works."""
import os

# Load .env from project root or backend/
try:
    from dotenv import load_dotenv
    base = os.path.dirname(os.path.abspath(__file__))
    load_dotenv(os.path.join(base, ".env"))
    load_dotenv(os.path.join(base, "backend", ".env"))
except ImportError:
    pass  # no dotenv, rely on env already set

from groq import Groq

def main():
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        print("FAIL: GROQ_API_KEY not set. Add it to .env or export it.")
        return

    client = Groq()
    completion = client.chat.completions.create(
        model="meta-llama/llama-4-scout-17b-16e-instruct",
        messages=[{"role": "user", "content": "Reply with exactly: OK"}],
        max_completion_tokens=10,
    )
    reply = completion.choices[0].message.content or ""
    print("Worked! Model replied:", repr(reply.strip()))

if __name__ == "__main__":
    main()
