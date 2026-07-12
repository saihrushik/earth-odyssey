"""Document ingestion pipeline (Python port).

    loaders (knowledge-base/, Wikipedia) → cleaning → 500–1000-token chunking
    → local embeddings → ChromaDB

Run from backend/:
    python -m app.rag.ingest
    python -m app.rag.ingest --wikipedia "Machu Picchu,Petra"
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

import httpx

from . import documents, embeddings, store

KNOWLEDGE_DIR = Path(__file__).resolve().parents[3] / "knowledge-base"

CHARS_PER_TOKEN = 4
MIN_CHARS = 500 * CHARS_PER_TOKEN
MAX_CHARS = 1000 * CHARS_PER_TOKEN
OVERLAP_CHARS = 80 * CHARS_PER_TOKEN


def clean_text(raw: str) -> str:
    s = re.sub(r"<[^>]+>", " ", raw)
    s = re.sub(r"!\[[^\]]*\]\([^)]*\)", " ", s)
    s = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", s)
    s = re.sub(r"^#{1,6}\s+", "", s, flags=re.M)
    s = re.sub(r"[*_`~]{1,3}", "", s)
    s = re.sub(r"\[(?:\d+|note \d+|citation needed)\]", "", s, flags=re.I)
    s = s.replace("\r", "")
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


def _split_units(text: str) -> list[str]:
    units: list[str] = []
    for p in text.split("\n\n"):
        p = p.strip()
        if not p:
            continue
        if len(p) <= MAX_CHARS:
            units.append(p)
            continue
        current = ""
        for sentence in re.split(r"(?<=[.!?])\s+", p):
            if current and len(current) + len(sentence) > MAX_CHARS:
                units.append(current.strip())
                current = ""
            current += (" " if current else "") + sentence
        if current.strip():
            units.append(current.strip())
    return units


def chunk_text(text: str) -> list[str]:
    text = text.strip()
    if len(text) <= MAX_CHARS:
        return [text] if text else []
    chunks: list[str] = []
    current = ""
    for unit in _split_units(text):
        if current and len(current) + len(unit) + 2 > MAX_CHARS:
            chunks.append(current)
            tail = current[-OVERLAP_CHARS:]
            current = re.sub(r"^\S*\s", "", tail) + "\n\n"
        current += ("" if not current or current.endswith("\n\n") else "\n\n") + unit
    current = current.strip()
    if current:
        if chunks and len(current) < MIN_CHARS / 2 and len(chunks[-1]) + len(current) <= MAX_CHARS * 1.2:
            chunks[-1] += "\n\n" + current
        else:
            chunks.append(current)
    return chunks


def _slugify(s: str) -> str:
    return re.sub(r"^-|-$", "", re.sub(r"[^a-z0-9]+", "-", s.lower()))


def _chunked_docs(source_id: str, title: str, body: str, tags: list[str]) -> list[dict[str, Any]]:
    chunks = chunk_text(clean_text(body))
    many = len(chunks) > 1
    return [
        {
            "id": f"{source_id}#{i + 1}" if many else source_id,
            "title": f"{title} (part {i + 1})" if many else title,
            "text": text,
            "tags": tags,
        }
        for i, text in enumerate(chunks)
    ]


def load_knowledge_folder(directory: Path = KNOWLEDGE_DIR) -> list[dict[str, Any]]:
    if not directory.is_dir():
        return []
    docs: list[dict[str, Any]] = []
    for path in sorted(directory.iterdir()):
        ext = path.suffix.lower()
        if ext not in {".md", ".txt", ".json"}:
            continue
        raw = path.read_text(encoding="utf-8")
        base = _slugify(path.stem)
        if ext == ".json":
            try:
                items = json.loads(raw)
                items = items if isinstance(items, list) else [items]
            except json.JSONDecodeError:
                print(f"[ingest] skipping invalid JSON: {path.name}", file=sys.stderr)
                continue
            for idx, item in enumerate(items):
                if not item.get("title") or not item.get("text"):
                    continue
                for d in _chunked_docs(f"kb:{base}-{idx}", item["title"], item["text"], item.get("tags", ["knowledge-base"])):
                    if item.get("destinationId"):
                        d["destinationId"] = item["destinationId"]
                    docs.append(d)
            continue
        heading = re.search(r"^#\s+(.+)$", raw, flags=re.M)
        title = heading.group(1).strip() if heading else base.replace("-", " ")
        docs.extend(_chunked_docs(f"kb:{base}", title, raw, ["knowledge-base"]))
    return docs


def load_wikipedia(titles: list[str]) -> list[dict[str, Any]]:
    docs: list[dict[str, Any]] = []
    for title in titles:
        try:
            res = httpx.get(
                "https://en.wikipedia.org/w/api.php",
                params={
                    "action": "query",
                    "prop": "extracts",
                    "explaintext": 1,
                    "format": "json",
                    "redirects": 1,
                    "titles": title,
                },
                headers={"user-agent": "EarthOdysseyIngest/1.0 (educational project; https://earth-odyssey.vercel.app)"},
                timeout=30,
            )
            res.raise_for_status()
            pages = res.json().get("query", {}).get("pages", {})
            page = next(iter(pages.values()), {})
            extract = page.get("extract")
            if not extract:
                print(f"[ingest] no Wikipedia extract for '{title}'", file=sys.stderr)
                continue
            page_title = page.get("title", title)
            docs.extend(_chunked_docs(f"wiki:{_slugify(page_title)}", f"{page_title} (Wikipedia)", extract, ["wikipedia"]))
        except Exception as err:  # noqa: BLE001 — one bad article shouldn't kill the run
            print(f"[ingest] Wikipedia fetch failed for '{title}': {err}", file=sys.stderr)
    return docs


def run(wikipedia_titles: list[str] | None = None) -> int:
    built_in = documents.build_knowledge_base()
    folder = load_knowledge_folder()
    wiki = load_wikipedia(wikipedia_titles) if wikipedia_titles else []
    docs = built_in + folder + wiki
    print(f"[ingest] documents: {len(built_in)} built-in, {len(folder)} knowledge-base, {len(wiki)} wikipedia → {len(docs)} chunks")

    vectors = embeddings.embed_texts([f"{d['title']}. {d['text']}" for d in docs])
    print(f"[ingest] embedded {len(vectors)} chunks ({embeddings.DIM} dims, {embeddings.EMBEDDER_NAME})")

    store.upsert(docs, vectors)
    print(f"[ingest] ChromaDB collection '{store.COLLECTION}' now holds {store.count()} chunks at {store.PERSIST_DIR}")
    return len(docs)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Earth Odyssey ingestion pipeline")
    parser.add_argument("--wikipedia", default="", help="comma-separated article titles")
    args = parser.parse_args()
    titles = [t.strip() for t in args.wikipedia.split(",") if t.strip()]
    run(titles or None)
