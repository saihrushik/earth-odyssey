"""Local semantic embeddings — no API keys.

fastembed runs BAAI/bge-small-en-v1.5 (384 dims) on CPU via ONNX: real
semantic vectors ("budget" ≈ "cheap" ≈ "affordable") with an ~80 MB model
downloaded once to the local cache on first use.
"""

from __future__ import annotations

from functools import lru_cache

from fastembed import TextEmbedding

MODEL_NAME = "BAAI/bge-small-en-v1.5"
EMBEDDER_NAME = f"fastembed/{MODEL_NAME}"
DIM = 384


@lru_cache(maxsize=1)
def _model() -> TextEmbedding:
    return TextEmbedding(model_name=MODEL_NAME)


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed documents (already L2-normalized by fastembed)."""
    return [v.tolist() for v in _model().embed(texts)]


def embed_query(query: str) -> list[float]:
    """Embed a search query (bge models use a query prefix for best recall)."""
    return next(iter(_model().query_embed(query))).tolist()
