"""Runtime retrieval: rewrite → embed → Chroma search → re-rank (port of retriever.ts)."""

from __future__ import annotations

import re

from . import embeddings, store

_EXPANSIONS: list[tuple[str, str]] = [
    (r"\bnorthern lights?\b", " aurora borealis arctic winter "),
    (r"\bcheap|affordable|low budget\b", " budget backpacking "),
    (r"\bhoneymoon\b", " romantic luxury couples "),
    (r"\bkids?|children|family\b", " family "),
    (r"\btrek(king)?|trail|walk\b", " hiking "),
    (r"\bbeach(es)?\b", " beach island snorkeling "),
    (r"\bsnow|winter\b", " winter arctic skiing "),
    (r"\bquiet|no crowds?|avoid crowds?|off the beaten\b", " hidden gems crowdsfree quiet "),
    (r"\bsunsets?|golden hour\b", " sunset views golden hour "),
]

_FILLER = r"\b(please|can you|could you|show me|i want to|i want|i'd like|tell me about|what about)\b"


def _tokenize(text: str) -> set[str]:
    return set(re.sub(r"[^a-z0-9\s]", " ", text.lower()).split())


def rewrite_query(query: str) -> str:
    q = re.sub(_FILLER, " ", query.lower())
    for pattern, extra in _EXPANSIONS:
        if re.search(pattern, q):
            q += extra
    return re.sub(r"\s+", " ", q).strip() or query


def condense_query(messages: list[dict[str, str]]) -> str:
    """History + question → one retrieval query (the diagram's join step)."""
    users = [m["content"] for m in messages if m["role"] == "user"]
    assistants = [m["content"] for m in messages if m["role"] == "assistant"]
    last_user = users[-1] if users else ""
    mentioned = re.findall(r"\*\*([^*]+)\*\*", assistants[-1])[:3] if assistants else []
    prev_user = users[-2] if len(users) > 1 else ""
    vague = bool(re.search(r"\b(it|there|that|those|this place|these)\b", last_user, re.I)) or len(last_user.split()) <= 4
    parts = [last_user, " ".join(mentioned) if vague else "", prev_user if vague else ""]
    return " ".join(p for p in parts if p)[:500]


def retrieve(query: str, top_k: int = 5) -> tuple[list[store.ScoredDoc], str]:
    rewritten = rewrite_query(query)
    vector = embeddings.embed_query(rewritten)
    candidates = store.search(vector, top_k * 3)

    q_tokens = _tokenize(rewritten)
    rescored: list[store.ScoredDoc] = []
    for c in candidates:
        d_tokens = _tokenize(c.title) | _tokenize(c.text) | {t for tag in c.tags for t in _tokenize(tag)}
        lexical = len(q_tokens & d_tokens) / len(q_tokens) if q_tokens else 0.0
        rescored.append(
            store.ScoredDoc(
                id=c.id, title=c.title, text=c.text, tags=c.tags,
                destination_id=c.destination_id, score=0.65 * c.score + 0.35 * lexical,
            )
        )
    rescored.sort(key=lambda d: d.score, reverse=True)
    return rescored[:top_k], rewritten
