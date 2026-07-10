/**
 * Document ingestion pipeline (run when adding or updating knowledge):
 *
 *   sources (built-in docs, knowledge-base/ folder, Wikipedia)
 *     → loader → cleaning → chunking (500–1000 tokens) → embeddings
 *     → MongoDB Atlas Vector Search (when MONGODB_URI is set)
 *     → local index snapshot (always; serves keyless deployments)
 *
 * Usage:
 *   npm run ingest
 *   npm run ingest -- --wikipedia "Machu Picchu,Aurora"   # also pull Wikipedia articles
 *   npm run ingest -- --prune                             # drop chunks from other embedding models
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { buildKnowledgeBase, type KnowledgeDoc } from "../src/server/rag/documents";
import { getEmbedder } from "../src/server/rag/embeddings";
import { loadKnowledgeFolder, loadWikipedia } from "../src/server/rag/ingest/loaders";
import { MongoAtlasVectorStore, getMongoUri } from "../src/server/rag/mongoVectorStore";

const ROOT = path.resolve(__dirname, "..");
const SNAPSHOT_PATH = path.join(ROOT, "src/server/rag/index-snapshot.json");

function parseArgs(argv: string[]) {
  const wikiIdx = argv.indexOf("--wikipedia");
  return {
    wikipediaTitles: wikiIdx >= 0 && argv[wikiIdx + 1] ? argv[wikiIdx + 1].split(",").map((s) => s.trim()).filter(Boolean) : [],
    prune: argv.includes("--prune"),
  };
}

async function main() {
  const { wikipediaTitles, prune } = parseArgs(process.argv.slice(2));
  const embedder = getEmbedder();
  console.log(`[ingest] embedder: ${embedder.name}`);

  // 1. Load documents from every source.
  const builtIn = buildKnowledgeBase();
  const folder = await loadKnowledgeFolder(path.join(ROOT, "knowledge-base"));
  const wiki = wikipediaTitles.length ? await loadWikipedia(wikipediaTitles) : [];
  const docs: KnowledgeDoc[] = [...builtIn, ...folder, ...wiki];
  console.log(`[ingest] documents: ${builtIn.length} built-in, ${folder.length} knowledge-base, ${wiki.length} wikipedia → ${docs.length} chunks`);

  // 2. Embed.
  const vectors = await embedder.embed(docs.map((d) => `${d.title}. ${d.text}`));
  console.log(`[ingest] embedded ${vectors.length} chunks (${embedder.dim} dims)`);

  // 3. Upsert into Atlas when configured.
  const uri = getMongoUri();
  if (uri) {
    const store = new MongoAtlasVectorStore(uri, embedder.name);
    await store.upsert(docs, vectors);
    if (prune) console.log(`[ingest] pruned ${await store.pruneOtherEmbedders()} stale chunks`);
    console.log(`[ingest] Atlas now holds ${await store.count()} chunks for this embedder`);
  } else {
    console.log("[ingest] MONGODB_URI not set — skipping Atlas upsert");
  }

  // 4. Always refresh the local snapshot (used when Atlas/OpenAI are absent).
  const snapshot = {
    embedderName: embedder.name,
    generatedAt: new Date().toISOString(),
    entries: docs.map((doc, i) => ({
      doc,
      vector: vectors[i].map((x) => Math.round(x * 1e5) / 1e5),
    })),
  };
  await fs.writeFile(SNAPSHOT_PATH, JSON.stringify(snapshot));
  console.log(`[ingest] wrote snapshot: ${SNAPSHOT_PATH} (${snapshot.entries.length} chunks)`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[ingest] failed:", err);
  process.exit(1);
});
