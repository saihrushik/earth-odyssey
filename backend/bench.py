"""Benchmark RAG retrieval and end-to-end copilot streaming latency.

    .venv/bin/python bench.py            # retrieval only (free, local)
    .venv/bin/python bench.py --stream   # + streaming agent TTFT/total (hits Claude API)
"""

from __future__ import annotations

import argparse
import asyncio
import statistics
import time

from dotenv import load_dotenv

load_dotenv(".env")

from app.rag import retriever, store  # noqa: E402
from app.rag.embeddings import EMBEDDER_NAME  # noqa: E402
from app import copilot, data  # noqa: E402

QUERIES = [
    "suggest cities with amazing sunset views",
    "hiking without crowds",
    "best time to visit Kyoto",
    "budget backpacking in asia",
    "honeymoon overwater villas",
    "northern lights photography",
    "family trip with kids",
    "weekend spot near Hyderabad",
    "desert adventures",
    "wine and food destinations",
]


def pct(values: list[float], p: float) -> float:
    values = sorted(values)
    idx = min(int(len(values) * p / 100), len(values) - 1)
    return values[idx]


def bench_retrieval(rounds: int = 5) -> None:
    retriever.retrieve("warmup", 5)  # load ONNX model before timing
    times: list[float] = []
    for _ in range(rounds):
        for q in QUERIES:
            t0 = time.perf_counter()
            docs, _ = retriever.retrieve(q, 5)
            times.append((time.perf_counter() - t0) * 1000)
            assert docs
    n = len(times)
    print(f"RETRIEVAL (embed → ChromaDB search → re-rank), n={n}")
    print(f"  corpus: {store.count()} chunks · {len(data.destinations())} destinations · embedder {EMBEDDER_NAME}")
    print(f"  mean {statistics.mean(times):.1f} ms · p50 {pct(times, 50):.1f} ms · p95 {pct(times, 95):.1f} ms · max {max(times):.1f} ms")


async def bench_stream(runs: int = 12) -> None:
    ttft: list[float] = []
    total: list[float] = []
    for i in range(runs):
        q = QUERIES[i % len(QUERIES)]
        t0 = time.perf_counter()
        first: float | None = None
        async for event in copilot.run_copilot([{"role": "user", "content": q}]):
            if event["type"] == "delta" and first is None:
                first = time.perf_counter() - t0
        total.append(time.perf_counter() - t0)
        if first is not None:
            ttft.append(first)
        print(f"  run {i + 1}/{runs}: ttft {first:.2f}s total {total[-1]:.2f}s")
    print(f"STREAMING AGENT (retrieval + live tools + Claude), n={len(total)}")
    print(f"  time-to-first-token: p50 {pct(ttft, 50):.2f}s · p95 {pct(ttft, 95):.2f}s")
    print(f"  full response:       p50 {pct(total, 50):.2f}s · p95 {pct(total, 95):.2f}s")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--stream", action="store_true")
    args = parser.parse_args()
    bench_retrieval()
    if args.stream:
        asyncio.run(bench_stream())
