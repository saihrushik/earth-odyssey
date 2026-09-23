# Earth Odyssey

**[earth-odyssey.vercel.app](https://earth-odyssey.vercel.app)** — a cinematic 3D Earth with a
RAG-powered AI travel copilot. Search or click anywhere on the globe and get grounded travel
intel: live weather, real photos, and a Claude-written briefing with citations.

The Earth *is* the homepage. No scrolling sections — the wheel flies the camera between
destinations, and the copilot drives the globe as it answers.

---

## Architecture

```
                         BROWSER
       React Three Fiber globe · custom GLSL shaders · zustand store
                              │
                     NDJSON event stream
                    (deltas · globe actions · citations)
                              │
        ┌─────────────────────┴─────────────────────┐
        │                                           │
  Next.js route handler                     FastAPI service
  src/server/  (serverless, Vercel)         backend/  (Docker, local)
        │                                           │
        └─────────────────┬─────────────────────────┘
                          │   identical pipeline, two runtimes
                          ▼
        ┌─────────────────────────────────────────┐
        │  1. intent analysis + expert routing     │  supervisor
        │  2. history-aware query condensing       │
        │  3. query rewrite / synonym expansion    │
        │  4. embed  (bge-small · ONNX · CPU)      │
        │  5. vector search  top-15                │  ChromaDB / in-memory
        │  6. hybrid re-rank → top-5               │  cosine + length-normalized lexical
        │  7. live tools: weather, flights, stays  │  Open-Meteo · Frankfurter
        │  8. prompt assembly → Claude (streaming) │
        └─────────────────────────────────────────┘
                          │
                   globe actions ──► flyTo · highlight · aurora
```

**Vector store is swappable** behind a two-method interface (`upsert` / `search`):
ChromaDB (Python), an in-memory index built from a committed snapshot (serverless),
and a MongoDB Atlas `$vectorSearch` implementation.

---

## Results

Measured, not estimated. Reproduce with the commands in each row.

### Retrieval quality — 64 labelled questions, `backend/eval_retrieval.py`

| pipeline | hit@1 | recall@5 | MRR@5 |
|---|---|---|---|
| A · raw vector search | 0.83 | 0.98 | 0.89 |
| B · + query rewriting | 0.83 | 0.98 | 0.89 |
| **C · + hybrid re-ranking (production)** | **0.89** | **1.00** | **0.94** |

Every labelled question finds its answer in the top 5. By category (C): fact 0.95 hit@1,
practical 0.94, recommendation 0.89, experience 0.86, faq 0.80, hard 0.67.

### Latency — 12 end-to-end runs (retrieval + live tools + model), `backend/bench.py --stream`

| | time-to-first-token p50 | p95 | full response p50 |
|---|---|---|---|
| Claude Opus 4.8 | 2.05s | 3.29s | 7.25s |
| Claude Haiku 4.5 | 0.80s | 1.15s | 4.46s |

Retrieval alone (50 runs): **p50 7.9 ms · p95 10.8 ms** over 116 chunks.

---

## Run it

```bash
npm install
cp .env.example .env.local        # add ANTHROPIC_API_KEY for AI answers
npm run dev                       # http://localhost:3000
```

That's the whole app — the globe, the copilot, and retrieval all run from the Next.js
process. Without an API key it falls back to a deterministic composer, so it still works.

<details>
<summary><b>Optional: the Python backend</b> (FastAPI + ChromaDB, for local/self-hosted)</summary>

```bash
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python -m app.rag.ingest          # build the vector DB
.venv/bin/uvicorn app.main:app --port 8000
```

Then set `COPILOT_BACKEND_URL=http://localhost:8000` in `.env.local`. The Next.js route
proxies to it and falls back to its own engine if the service is down.

Or with Docker, from the repo root:

```bash
docker build -f backend/Dockerfile -t earth-odyssey-backend .
docker run -p 8000:8000 --env-file backend/.env earth-odyssey-backend
```
</details>

<details>
<summary><b>Optional: evaluate and benchmark</b></summary>

```bash
cd backend
.venv/bin/python eval_retrieval.py --show-misses      # retrieval quality (free, no API key)
.venv/bin/python eval_retrieval.py --min-recall 0.95  # CI gate: exits 1 on regression
.venv/bin/python bench.py --stream                    # latency (calls the Claude API)
```
</details>

CI runs typecheck, lint, build, and the retrieval eval on every push — a change that makes
retrieval worse **fails the build** rather than shipping. See `.github/workflows/ci.yml`.

---

## What broke, and how it got fixed

Three bugs worth keeping, because each was found by measurement rather than by reading code.

### 1. Re-ranking was making results worse

The eval's whole point was to prove the pipeline earned its complexity. It proved the
opposite: the "full" path scored **hit@1 0.75 vs 0.83 for plain vector search**. Re-ranking
was a liability.

The lexical half scored documents by *what fraction of the query's tokens they contain* —
with no length normalization. Wikipedia chunks average 557 words, the curated docs 90. Long
documents match more query tokens by luck. Walking one failing query through by hand,
`santorini:overview` had the third-best *semantic* score and still lost to a 668-word
Wikipedia chunk purely on length.

Fixed by scaling overlap by `refLen / (refLen + docLen)` — BM25's length normalization, with
the reference length taken from the candidate set so neither runtime needs corpus statistics.
**hit@1 0.75 → 0.89.**

### 2. Query expansions were firing on each other's output

One eval question still failed: *"Where can I watch wolves in winter?"* returned aurora docs.
The rewriter appends synonyms in a loop, testing the query **as it grew** — so the
northern-lights rule appended `"winter"`, and the winter rule then fired on that injected
word, producing `... aurora borealis arctic winter winter arctic skiing`. Every seasonal
question got dragged toward the Arctic.

Rules now match the original query only, and the winter rule was narrowed to actual snow
sports. Aurora questions were never protected by it — they have their own rule — and stayed
at ranks #1/#2/#1 through the change. **recall@5 0.98 → 1.00, no misses left.**

### 3. Switching to a cheaper model silently disabled the AI

Benchmarking Haiku gave a suspiciously good result: first-token and last-token timestamps
were *identical* on all 12 runs. That isn't a fast stream — it's not a stream at all.

The request hardcoded `thinking: {type: "adaptive"}` and `output_config.effort`, which only
exist on the 4.6-generation models and newer. On Haiku 4.5 every call returned
`400 adaptive thinking is not supported on this model` — and a catch-all swallowed it, so the
app quietly answered from the template composer. No error, no crash; the chatbot just got
dumber. The obvious cost optimization would have silently switched the AI off in production.

Tuning parameters are now attached only to models that accept them, and the fallback logs
what it caught instead of hiding it.

---

## Stack

TypeScript · Next.js · React Three Fiber / Three.js / GLSL · zustand · Framer Motion · GSAP ·
Python · FastAPI · ChromaDB · fastembed (BAAI/bge-small-en-v1.5) · Claude API · MongoDB Atlas
Vector Search · Docker · GitHub Actions · Vercel

Keyless live data: Open-Meteo (weather), Frankfurter (currency), Nominatim (geocoding),
Wikipedia (place intel and photos).

## Controls

Drag to orbit · wheel or arrow keys to fly between destinations · pinch to zoom · click
anywhere for place intel · `/` opens the copilot · Esc closes panels. Honors
`prefers-reduced-motion`, and auto-detects low-memory devices to drop resolution and
post-processing.
