"""Earth Odyssey Python RAG backend.

    cd backend
    python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
    .venv/bin/python -m app.rag.ingest          # populate ChromaDB (once)
    .venv/bin/uvicorn app.main:app --port 8000  # serve

The Next.js frontend proxies /api/copilot here when COPILOT_BACKEND_URL is set.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

# Secrets: backend/.env first, then the repo root .env.local (never committed).
_BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(_BACKEND_DIR / ".env")
load_dotenv(_BACKEND_DIR.parent / ".env.local")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from . import copilot, llm
from .rag import store

app = FastAPI(title="Earth Odyssey Copilot API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # locked down in practice by the Next.js proxy
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatMessage(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str


class CopilotRequest(BaseModel):
    messages: list[ChatMessage]
    context: dict[str, Any] | None = None


@app.get("/api/health")
async def health() -> dict[str, Any]:
    if llm.claude_available():
        active = f"claude ({llm.claude_model()})"
    else:
        active = "composer-fallback (set ANTHROPIC_API_KEY in backend/.env for Claude answers)"
    return {
        "ok": True,
        "vectorDb": "chromadb",
        "chunks": store.count(),
        "llm": active,
    }


@app.post("/api/copilot")
async def copilot_route(req: CopilotRequest) -> StreamingResponse:
    messages = [m.model_dump() for m in req.messages]

    async def ndjson():
        try:
            async for event in copilot.run_copilot(messages, req.context):
                yield json.dumps(event, ensure_ascii=False) + "\n"
        except Exception as err:  # noqa: BLE001
            yield json.dumps({"type": "error", "message": str(err)}) + "\n"
            yield json.dumps({"type": "done"}) + "\n"

    return StreamingResponse(ndjson(), media_type="application/x-ndjson")
