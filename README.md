# Earth Odyssey

A cinematic, AI-powered 3D travel discovery experience. The Earth **is** the homepage:
no scrolling sections — the mouse wheel flies the camera between destinations, and an
AI Travel Copilot (RAG + live tools) controls the globe.

## Architecture

```
src/features/odyssey/          # frontend feature
  data/                        #   destinations (19), chapters (8), types — single source of truth
  scene/                       #   R3F: Earth (day/night shader), clouds, atmosphere, moon,
                               #   starfield + meteors, satellites/ISS, aurora, hotspots, camera rig
  ui/                          #   glass panels: intro, HUD, chapter rail, destination panel, copilot
  store/useOdyssey.ts          #   zustand store — the contract between AI, UI and the 3D scene
  hooks/                       #   useCopilot (NDJSON stream consumer), useAmbientAudio (WebAudio)

src/server/                    # backend-for-frontend (Next.js route handlers = the chatbot backend API)
  rag/                         #   documents → embeddings (text-embedding-3-small) →
                               #   MongoDB Atlas Vector Search (or in-memory fallback) →
                               #   query rewriter → retriever → re-ranker → citations
  rag/ingest/                  #   ingestion pipeline: loaders (knowledge-base/, Wikipedia, JSON)
                               #   → cleaning → 500–1000-token chunking → embeddings → Atlas
  agents/                      #   supervisor: intent analysis + expert selection + destination scoring
  copilot/                     #   engine (LLM / offline), NDJSON event protocol
  tools/                       #   live APIs: Open-Meteo weather, Frankfurter FX, timezone, distance
  prompts/                     #   system prompt with expert personas + destination catalog

src/app/api/copilot/route.ts   # POST — streams NDJSON CopilotEvents (deltas, globe actions, citations)
src/app/api/weather/route.ts   # GET  — live weather for the destination panel
```

## RAG runtime flow

```
user question + chat history
  → condensed retrieval query      (retriever.ts · condenseQuery)
  → embedding                      (text-embedding-3-small · local-hash fallback)
  → vector search                  (MongoDB Atlas $vectorSearch · in-memory fallback)
  → top-5 chunks, re-ranked
  → prompt construction            (system + retrieved context + history + question)
  → GPT-4.1                        (streaming; tools for live data + globe control)
  → answer with citations
```

**Ingestion** (runs only when adding or updating knowledge): `npm run ingest` loads the
built-in destination docs plus everything in `knowledge-base/` (.md / .txt / .json guides,
blogs, FAQs) and optional Wikipedia articles
(`npm run ingest -- --wikipedia "Machu Picchu,Petra"`), cleans and chunks them
(500–1000 tokens with overlap), embeds, upserts to Atlas when `MONGODB_URI` is set, and
always refreshes `src/server/rag/index-snapshot.json` so keyless deployments retrieve from
the same corpus. Atlas setup (cluster + `vector_index` definition) is documented in
`src/server/rag/mongoVectorStore.ts`; all env vars in `.env.example`.

## The AI ↔ 3D contract

The copilot streams `actions` events (`flyTo`, `highlight`, `aurora`, `chapter`) that the
client applies to the zustand store; the camera rig, hotspots and aurora shader react to it.
"Show me the Northern Lights" → aurora ignites, matching pins glow, camera flies to Tromsø.

## Engines

- **With `OPENAI_API_KEY`**: retrieve-then-generate RAG on GPT (default `gpt-4.1`) — top-5
  retrieved chunks are placed in the prompt, with streaming tool-calling for live data:
  `search_knowledge`, `get_weather`, `get_forecast`, `get_flights`, `get_stays`,
  `convert_currency`, `distance_between`, `control_globe`. Embeddings use
  `text-embedding-3-small` (`OPENAI_EMBED_MODEL`/`EMBED_DIM` to override).
- **Without a key**: a deterministic offline engine runs the *same* retrieval, scoring and
  live weather tools, composing answers from the supervisor's intent analysis. The whole
  experience works with zero configuration.

Trip data: flights are live Amadeus quotes when `AMADEUS_CLIENT_ID/SECRET` are set, otherwise
clearly-labelled estimates from distance + seasonality; stays are a curated shortlist of real
properties (Google Places ratings when `GOOGLE_MAPS_API_KEY` is set); weather uses Open-Meteo
current conditions and 16-day forecasts for parsed travel dates, no key needed.

The vector store sits behind a two-method `VectorStore` interface with two implementations:
`MongoAtlasVectorStore` (`$vectorSearch`, enabled by `MONGODB_URI`) and `InMemoryVectorStore`
(cosine over the ingested snapshot). Atlas failures fall back to memory transparently.

## Controls

Drag to orbit · wheel/arrows to fly between destinations · pinch to zoom · Enter opens the
focused destination · `/` opens the copilot · Esc closes panels. Honors
`prefers-reduced-motion` (instant jumps, no auto-rotation).

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
npm run ingest   # rebuild the RAG index (add docs to knowledge-base/ first)
```

Copy `.env.example` to `.env.local` and fill in keys to enable GPT-4.1, Atlas Vector Search,
Amadeus flight quotes and Google Places ratings — everything degrades gracefully without them.
