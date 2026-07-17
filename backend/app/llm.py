"""LLM generation engines.

Two options, best available wins:
  1. Claude (Anthropic API) — set ANTHROPIC_API_KEY in backend/.env.
     Far stronger world knowledge and instruction-following than the local
     model; still grounded by the same retrieved context + live facts.
  2. Ollama (local, no API keys) — https://ollama.com with a model pulled:
     ollama pull llama3.2:3b
"""

from __future__ import annotations

import json
import os
from collections.abc import AsyncGenerator

import httpx
from anthropic import AsyncAnthropic

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.2:3b")


# ── Claude (Anthropic API) ───────────────────────────────────────────────────

def claude_model() -> str:
    return os.environ.get("CLAUDE_MODEL", "claude-opus-4-8")


def claude_available() -> bool:
    return bool(os.environ.get("ANTHROPIC_API_KEY"))


async def stream_claude(system: str, messages: list[dict[str, str]]) -> AsyncGenerator[str, None]:
    """Stream a Claude response grounded by the system prompt's context."""
    client = AsyncAnthropic()  # reads ANTHROPIC_API_KEY from env
    async with client.messages.stream(
        model=claude_model(),
        max_tokens=2048,
        # Adaptive thinking + low effort: snappy chat answers, deeper
        # reasoning only when the question actually needs it.
        thinking={"type": "adaptive"},
        output_config={"effort": "low"},
        system=system,
        messages=messages,
    ) as stream:
        async for text in stream.text_stream:
            yield text


async def is_available() -> bool:
    try:
        async with httpx.AsyncClient(timeout=1.5) as client:
            res = await client.get(f"{OLLAMA_URL}/api/tags")
            if res.status_code != 200:
                return False
            models = [m.get("name", "") for m in res.json().get("models", [])]
            return any(m.startswith(OLLAMA_MODEL.split(":")[0]) for m in models)
    except Exception:  # noqa: BLE001
        return False


async def stream_chat(system: str, messages: list[dict[str, str]]) -> AsyncGenerator[str, None]:
    """Stream response tokens from the local model."""
    payload = {
        "model": OLLAMA_MODEL,
        "messages": [{"role": "system", "content": system}, *messages],
        "stream": True,
        "options": {"temperature": 0.6, "num_predict": 500},
    }
    async with httpx.AsyncClient(timeout=180) as client:
        async with client.stream("POST", f"{OLLAMA_URL}/api/chat", json=payload) as res:
            res.raise_for_status()
            async for line in res.aiter_lines():
                if not line.strip():
                    continue
                try:
                    event = json.loads(line)
                except json.JSONDecodeError:
                    continue
                token = event.get("message", {}).get("content", "")
                if token:
                    yield token
                if event.get("done"):
                    return
