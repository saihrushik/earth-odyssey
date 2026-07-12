"""Local LLM generation via Ollama — no API keys, runs entirely on this machine.

Requires the Ollama app/daemon (https://ollama.com) with a small model pulled:
    ollama pull llama3.2:3b
"""

from __future__ import annotations

import json
import os
from collections.abc import AsyncGenerator

import httpx

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.2:3b")


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
