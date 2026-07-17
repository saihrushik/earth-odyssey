# Earth Odyssey — Python RAG Backend

RAG chatbot backend: retrieval and embeddings run locally; generation is **Claude**
(Anthropic API). Without a key it degrades to a deterministic composer.

```
question + history
  → intent analysis                 app/supervisor.py
  → condensed query → embedding     app/rag/embeddings.py   (fastembed · bge-small · 384d · CPU)
  → vector search                   app/rag/store.py        (ChromaDB, persistent, on disk)
  → top-5 chunks re-ranked          app/rag/retriever.py
  → live facts prefetch             app/tools.py            (Open-Meteo weather, flight estimator, stays)
  → generation                      app/llm.py              (Claude · claude-opus-4-8)
       └─ deterministic composer fallback when no ANTHROPIC_API_KEY is set
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

# 2. Claude key (backend/.env is gitignored — never commit it)
echo 'ANTHROPIC_API_KEY=sk-ant-...' > .env
# optional: CLAUDE_MODEL=claude-haiku-4-5 for cheaper chat

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
  run on Vercel serverless as-is (ChromaDB needs persistent disk), which is why the deployed
  site keeps the TS engine unless COPILOT_BACKEND_URL points at a hosted instance.
