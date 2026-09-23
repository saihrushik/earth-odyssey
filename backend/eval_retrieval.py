"""Retrieval eval for Earth Odyssey's RAG pipeline.

Scores three configurations on eval/eval_set.json so you can see what each
pipeline stage is worth:

    A  raw      query → embed → ChromaDB top-5
    B  rewrite  query → rewrite/expand → embed → ChromaDB top-5
    C  full     query → rewrite → embed → top-15 → hybrid re-rank → top-5  (production path)

Metrics (a question is a "hit" if ANY of its relevant_doc_ids is retrieved):
    hit@1   – correct doc ranked first
    recall@5 – correct doc anywhere in the top 5
    MRR@5   – mean of 1/rank of the first correct doc (0 if missing)

Run from backend/ (after `python -m app.rag.ingest`):
    .venv/bin/python eval_retrieval.py
    .venv/bin/python eval_retrieval.py --k 3 --show-misses
"""

from __future__ import annotations

import argparse
import json
import statistics
import time
from collections import defaultdict
from pathlib import Path

from app.rag import embeddings, retriever, store

EVAL_PATH = Path(__file__).parent / "eval" / "eval_set.json"
RESULTS_PATH = Path(__file__).parent / "eval" / "results.json"


def rank_of_first_hit(ids: list[str], relevant: set[str]) -> int | None:
    for i, doc_id in enumerate(ids, start=1):
        if doc_id in relevant:
            return i
    return None


def run_config(name: str, q: str, k: int) -> list[str]:
    if name == "A_raw":
        return [d.id for d in store.search(embeddings.embed_query(q), k)]
    if name == "B_rewrite":
        return [d.id for d in store.search(embeddings.embed_query(retriever.rewrite_query(q)), k)]
    if name == "C_full":
        docs, _ = retriever.retrieve(q, k)
        return [d.id for d in docs]
    raise ValueError(name)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--k", type=int, default=5)
    ap.add_argument("--show-misses", action="store_true")
    # Regression gates for CI: the run exits non-zero if the production path
    # (C_full) drops below these, so a retrieval regression fails the build.
    ap.add_argument("--min-recall", type=float, default=None)
    ap.add_argument("--min-hit1", type=float, default=None)
    args = ap.parse_args()
    k = args.k

    if store.count() == 0:
        print("[eval] vector store empty; running ingestion first…")
        from app.rag import ingest
        ingest.run()

    items = json.loads(EVAL_PATH.read_text(encoding="utf-8"))

    # Sanity check: every labelled doc id must exist, or the eval is lying.
    all_ids = {i for it in items for i in it["relevant_doc_ids"]}
    found = set(store.collection().get(ids=sorted(all_ids))["ids"])
    missing = sorted(all_ids - found)
    if missing:
        raise SystemExit(f"[eval] labelled doc ids not in the store (re-ingest?): {missing}")

    retriever.retrieve("warmup", k)  # load the ONNX model before timing
    configs = ["A_raw", "B_rewrite", "C_full"]
    per_q: list[dict] = []
    latencies: dict[str, list[float]] = defaultdict(list)

    for it in items:
        rel = set(it["relevant_doc_ids"])
        row = {"id": it["id"], "question": it["question"], "category": it["category"], "relevant": sorted(rel)}
        for c in configs:
            t0 = time.perf_counter()
            ids = run_config(c, it["question"], k)
            latencies[c].append((time.perf_counter() - t0) * 1000)
            r = rank_of_first_hit(ids, rel)
            row[c] = {"rank": r, "retrieved": ids}
        per_q.append(row)

    def metrics(rows: list[dict], c: str) -> dict[str, float]:
        ranks = [r[c]["rank"] for r in rows]
        n = len(ranks)
        return {
            "hit@1": sum(1 for x in ranks if x == 1) / n,
            f"recall@{k}": sum(1 for x in ranks if x) / n,
            f"MRR@{k}": sum(1 / x for x in ranks if x) / n,
        }

    n = len(per_q)
    print(f"\nRETRIEVAL EVAL · {n} questions · top-{k} · corpus {store.count()} chunks · {embeddings.EMBEDDER_NAME}\n")
    print(f"{'config':<12}{'hit@1':>8}{f'recall@{k}':>11}{f'MRR@{k}':>9}{'p50 ms':>9}{'p95 ms':>9}")
    summary = {}
    for c in configs:
        m = metrics(per_q, c)
        lat = sorted(latencies[c])
        p50 = statistics.median(lat)
        p95 = lat[min(int(len(lat) * 0.95), len(lat) - 1)]
        summary[c] = {**m, "p50_ms": p50, "p95_ms": p95}
        print(f"{c:<12}{m['hit@1']:>8.2f}{m[f'recall@{k}']:>11.2f}{m[f'MRR@{k}']:>9.2f}{p50:>9.1f}{p95:>9.1f}")

    print(f"\nBy category (C_full):")
    cats = sorted({r["category"] for r in per_q})
    for cat in cats:
        rows = [r for r in per_q if r["category"] == cat]
        m = metrics(rows, "C_full")
        print(f"  {cat:<15} n={len(rows):<3} hit@1 {m['hit@1']:.2f}  recall@{k} {m[f'recall@{k}']:.2f}")

    a, c = summary["A_raw"][f"recall@{k}"], summary["C_full"][f"recall@{k}"]
    print(f"\nResume line → rewrite + re-ranking moved recall@{k} from {a:.2f} to {c:.2f} "
          f"(hit@1 {summary['A_raw']['hit@1']:.2f} → {summary['C_full']['hit@1']:.2f}) on {n} labelled questions.")

    misses = [r for r in per_q if r["C_full"]["rank"] is None]
    if args.show_misses and misses:
        print(f"\nMisses in C_full ({len(misses)}):")
        for r in misses:
            print(f"  {r['id']} {r['question']}\n      want {r['relevant']}\n      got  {r['C_full']['retrieved']}")

    RESULTS_PATH.write_text(json.dumps({"k": k, "n": n, "summary": summary, "questions": per_q}, indent=2, ensure_ascii=False))
    print(f"\nFull results → {RESULTS_PATH.relative_to(Path(__file__).parent)}")

    # CI gate: compare the production path against the floors, if given.
    prod = summary["C_full"]
    failures = []
    if args.min_recall is not None and prod[f"recall@{k}"] < args.min_recall:
        failures.append(f"recall@{k} {prod[f'recall@{k}']:.2f} < required {args.min_recall:.2f}")
    if args.min_hit1 is not None and prod["hit@1"] < args.min_hit1:
        failures.append(f"hit@1 {prod['hit@1']:.2f} < required {args.min_hit1:.2f}")
    if failures:
        raise SystemExit("\n[eval] RETRIEVAL REGRESSION\n  " + "\n  ".join(failures))
    if args.min_recall is not None or args.min_hit1 is not None:
        print("[eval] thresholds met")


if __name__ == "__main__":
    main()
