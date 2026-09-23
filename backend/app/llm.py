"""Claude generation via the Anthropic API.

Set ANTHROPIC_API_KEY in backend/.env. Without a key, the copilot falls back
to the deterministic composer (no LLM).
"""

from __future__ import annotations

import os
from collections.abc import AsyncGenerator

from anthropic import AsyncAnthropic


def claude_model() -> str:
    return os.environ.get("CLAUDE_MODEL", "claude-opus-4-8")


def claude_available() -> bool:
    return bool(os.environ.get("ANTHROPIC_API_KEY"))


# Adaptive thinking and output_config.effort arrived with the 4.6 generation.
# Older models (haiku-4-5, sonnet-4-5, …) reject both with a 400, so sending
# them unconditionally made every CLAUDE_MODEL downgrade fail silently into
# the composer fallback.
_ADAPTIVE_MODELS = ("opus-4-6", "opus-4-7", "opus-4-8", "sonnet-4-6", "sonnet-5", "fable-5", "mythos-5")


def supports_adaptive_thinking(model: str) -> bool:
    return any(tag in model for tag in _ADAPTIVE_MODELS)


async def stream_claude(system: str, messages: list[dict[str, str]]) -> AsyncGenerator[str, None]:
    """Stream a Claude response grounded by the system prompt's context."""
    model = claude_model()
    params: dict = {
        "model": model,
        "max_tokens": 2048,
        "system": system,
        "messages": messages,
    }
    if supports_adaptive_thinking(model):
        # Snappy chat answers, deeper reasoning only when the question needs it.
        params["thinking"] = {"type": "adaptive"}
        params["output_config"] = {"effort": "low"}

    client = AsyncAnthropic()  # reads ANTHROPIC_API_KEY from env
    async with client.messages.stream(**params) as stream:
        async for text in stream.text_stream:
            yield text
