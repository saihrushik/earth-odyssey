"""ChromaDB — a real, embedded, persistent vector database.

Vectors live on disk under backend/chroma-data/ (no server, no keys).
A vector DB is nothing mystical: storage for (id, vector, payload) triples
plus a fast nearest-neighbor search — Chroma gives us exactly that with
cosine similarity and persistence.
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

import chromadb

PERSIST_DIR = Path(__file__).resolve().parent.parent.parent / "chroma-data"
COLLECTION = "knowledge_chunks"


@dataclass
class ScoredDoc:
    id: str
    title: str
    text: str
    tags: list[str]
    destination_id: str | None
    score: float


@lru_cache(maxsize=1)
def _client() -> chromadb.ClientAPI:
    return chromadb.PersistentClient(path=str(PERSIST_DIR))


def collection() -> chromadb.Collection:
    return _client().get_or_create_collection(COLLECTION, metadata={"hnsw:space": "cosine"})


def upsert(docs: list[dict[str, Any]], vectors: list[list[float]]) -> None:
    if len(docs) != len(vectors):
        raise ValueError("docs/vectors length mismatch")
    collection().upsert(
        ids=[d["id"] for d in docs],
        embeddings=vectors,
        documents=[d["text"] for d in docs],
        metadatas=[
            {
                "title": d["title"],
                "tags": ",".join(d.get("tags", [])),
                "destinationId": d.get("destinationId") or "",
            }
            for d in docs
        ],
    )


def count() -> int:
    return collection().count()


def search(vector: list[float], top_k: int) -> list[ScoredDoc]:
    res = collection().query(query_embeddings=[vector], n_results=min(top_k, max(count(), 1)))
    out: list[ScoredDoc] = []
    for i, doc_id in enumerate(res["ids"][0]):
        meta = res["metadatas"][0][i]
        out.append(
            ScoredDoc(
                id=doc_id,
                title=str(meta.get("title", "")),
                text=res["documents"][0][i],
                tags=[t for t in str(meta.get("tags", "")).split(",") if t],
                destination_id=str(meta.get("destinationId") or "") or None,
                score=1.0 - res["distances"][0][i],  # cosine distance → similarity
            )
        )
    return out
