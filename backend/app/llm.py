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
