# Earth Odyssey — Python RAG Backend

A fully self-contained RAG chatbot backend: **no API keys, no external AI services**.
When a question comes in, it goes straight to the local vector database and a local LLM.

```
question + history
  → intent analysis                 app/supervisor.py
  → condensed query → embedding     app/rag/embeddings.py   (fastembed · bge-small · 384d · CPU)
  → vector search                   app/rag/store.py        (ChromaDB, persistent, on disk)
  → top-5 chunks re-ranked          app/rag/retriever.py
  → live facts prefetch             app/tools.py            (Open-Meteo weather, flight estimator, stays)
  → generation                      app/llm.py              (Ollama · llama3.2:3b, local)
       └─ deterministic composer fallback when Ollama isn't running
  → NDJSON stream: globe actions, text deltas, citations
```

## Run it

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

# 1. Populate the vector DB (re-run whenever knowledge-base/ changes)
.venv/bin/python -m app.rag.ingest
.venv/bin/python -m app.rag.ingest --wikipedia "Machu Picchu,Petra"

# 2. Local LLM (optional but recommended — real generation, still no keys)
brew install ollama && ollama serve &
ollama pull llama3.2:3b

# 3. Serve
.venv/bin/uvicorn app.main:app --port 8000
```

Point the frontend at it in `.env.local` (repo root): `COPILOT_BACKEND_URL=http://localhost:8000`,
then `npm run dev`. The Next.js `/api/copilot` route proxies here and falls back to the
built-in TypeScript engine if this server is down.

- `GET  /api/health` — chunk count, which LLM is active
- `POST /api/copilot` — `{messages, context?}` → NDJSON event stream

## Notes

- **Embeddings** are real semantic vectors (BAAI/bge-small-en-v1.5 via ONNX), computed on
  your CPU. First run downloads the ~80 MB model to the local cache.
- **ChromaDB** persists under `backend/chroma-data/` — a genuine vector database (HNSW
  nearest-neighbor search over cosine space), embedded in-process like SQLite.
- **The dataset** is exported from the TypeScript source of truth:
  `npx tsx scripts/export-data.ts` regenerates `data/travel-data.json`.
- **Hosting**: this stack runs anywhere Python runs (a $5 VPS, Railway, your Mac). It cannot
  run on Vercel serverless (Ollama needs a persistent process), which is why the deployed
  site keeps the TS engine unless COPILOT_BACKEND_URL points at a hosted instance.
