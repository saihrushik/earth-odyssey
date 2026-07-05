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

src/server/                    # backend-for-frontend (Next.js route handlers)
  rag/                         #   knowledge base → embeddings → in-memory vector store →
                               #   query rewriter → retriever → re-ranker → citations
  agents/                      #   supervisor: intent analysis + expert selection + destination scoring
  copilot/                     #   engine (LLM / offline), NDJSON event protocol
  tools/                       #   live APIs: Open-Meteo weather, Frankfurter FX, timezone, distance
  prompts/                     #   system prompt with expert personas + destination catalog

src/app/api/copilot/route.ts   # POST — streams NDJSON CopilotEvents (deltas, globe actions, citations)
src/app/api/weather/route.ts   # GET  — live weather for the destination panel
```

## The AI ↔ 3D contract

The copilot streams `actions` events (`flyTo`, `highlight`, `aurora`, `chapter`) that the
client applies to the zustand store; the camera rig, hotspots and aurora shader react to it.
"Show me the Northern Lights" → aurora ignites, matching pins glow, camera flies to Tromsø.

## Engines

- **With `OPENAI_API_KEY`**: GPT (default `gpt-4.1`, override with `OPENAI_MODEL`) with
  streaming tool-calling — `search_knowledge` (RAG), `get_weather`, `convert_currency`,
  `distance_between`, `control_globe`. Embeddings use `text-embedding-3-large`.
- **Without a key**: a deterministic offline engine runs the *same* retrieval, scoring and
  live weather tools, composing answers from the supervisor's intent analysis. The whole
  experience works with zero configuration.

The vector store is in-process behind a two-method `VectorStore` interface — swap in
Qdrant/Pinecone by implementing `upsert`/`search`.

## Controls

Drag to orbit · wheel/arrows to fly between destinations · pinch to zoom · Enter opens the
focused destination · `/` opens the copilot · Esc closes panels. Honors
`prefers-reduced-motion` (instant jumps, no auto-rotation).
