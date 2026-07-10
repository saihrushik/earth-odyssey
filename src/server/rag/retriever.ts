import { buildKnowledgeBase, type KnowledgeDoc } from "./documents";
import { getEmbedder, tokenize } from "./embeddings";
import { InMemoryVectorStore, type ScoredDoc, type VectorStore } from "./vectorStore";
import { MongoAtlasVectorStore, getMongoUri } from "./mongoVectorStore";
import type { ChatMessage } from "../copilot/protocol";
import rawSnapshot from "./index-snapshot.json";

export interface RetrievalResult {
  docs: ScoredDoc[];
  rewrittenQuery: string;
  /** Which store actually served the query. */
  source: "atlas" | "memory";
}

interface IndexSnapshot {
  embedderName: string;
  entries: { doc: KnowledgeDoc; vector: number[] }[];
}

const SNAPSHOT = rawSnapshot as unknown as IndexSnapshot;

interface RagIndex {
  store: VectorStore;
  embedderName: string;
}

/** Survives dev hot-reloads; keyed by embedder so switching providers reindexes. */
const globalCache = globalThis as unknown as {
  __odysseyRag?: Promise<RagIndex>;
  __odysseyMongoStore?: MongoAtlasVectorStore;
};

/**
 * In-memory index. Prefers the ingested snapshot (written by `npm run ingest`,
 * includes knowledge-base folder + Wikipedia docs); falls back to embedding
 * the built-in dataset docs on the fly.
 */
async function buildMemoryIndex(): Promise<RagIndex> {
  const embedder = getEmbedder();
  const store = new InMemoryVectorStore();

  if (SNAPSHOT.embedderName === embedder.name && SNAPSHOT.entries.length > 0) {
    await store.upsert(
      SNAPSHOT.entries.map((e) => e.doc),
      SNAPSHOT.entries.map((e) => e.vector),
    );
  } else {
    const docs = buildKnowledgeBase();
    const vectors = await embedder.embed(docs.map((d) => `${d.title}. ${d.text}`));
    await store.upsert(docs, vectors);
  }
  return { store, embedderName: embedder.name };
}

async function getMemoryIndex(): Promise<RagIndex> {
  if (!globalCache.__odysseyRag) {
    globalCache.__odysseyRag = buildMemoryIndex().catch((err) => {
      globalCache.__odysseyRag = undefined; // allow retry on transient failure
      throw err;
    });
  }
  return globalCache.__odysseyRag;
}

function getAtlasStore(): MongoAtlasVectorStore | null {
  const uri = getMongoUri();
  if (!uri) return null;
  if (!globalCache.__odysseyMongoStore) {
    globalCache.__odysseyMongoStore = new MongoAtlasVectorStore(uri, getEmbedder().name);
  }
  return globalCache.__odysseyMongoStore;
}

/**
 * Light query rewriting: strip chat filler and expand a few travel synonyms so
 * short conversational queries retrieve better.
 */
export function rewriteQuery(query: string): string {
  let q = query.toLowerCase().replace(/\b(please|can you|could you|show me|i want to|i want|i'd like|tell me about|what about)\b/g, " ");
  const expansions: [RegExp, string][] = [
    [/\bnorthern lights?\b/, " aurora borealis arctic winter "],
    [/\bcheap|affordable|low budget\b/, " budget backpacking "],
    [/\bhoneymoon\b/, " romantic luxury couples "],
    [/\bkids?|children|family\b/, " family "],
    [/\btrek(king)?|trail|walk\b/, " hiking "],
    [/\bbeach(es)?\b/, " beach island snorkeling "],
    [/\bsnow|winter\b/, " winter arctic skiing "],
    [/\bquiet|no crowds?|avoid crowds?|off the beaten\b/, " hidden gems crowdsfree quiet "],
    [/\bsunsets?|golden hour\b/, " sunset views golden hour "],
  ];
  for (const [re, add] of expansions) if (re.test(q)) q += add;
  return q.replace(/\s+/g, " ").trim() || query;
}

/**
 * Condense chat history + latest question into one retrieval query
 * (the "Conversation History + User Question" join in the RAG flow).
 */
export function condenseQuery(messages: ChatMessage[]): string {
  const lastUser = messages.filter((m) => m.role === "user").at(-1)?.content ?? "";
  const lastAssistant = messages.filter((m) => m.role === "assistant").at(-1)?.content ?? "";
  // Carry forward the destinations the conversation is already about.
  const mentioned = [...lastAssistant.matchAll(/\*\*([^*]+)\*\*/g)].map((m) => m[1]).slice(0, 3);
  const prevUser = messages.filter((m) => m.role === "user").slice(-2, -1)[0]?.content ?? "";
  const needsContext = /\b(it|there|that|those|this place|these)\b/i.test(lastUser) || lastUser.split(/\s+/).length <= 4;
  return [lastUser, needsContext ? mentioned.join(" ") : "", needsContext ? prevUser : ""].filter(Boolean).join(" ").slice(0, 500);
}

/** Blend vector similarity with lexical overlap — a simple, effective re-ranker. */
function rerank(query: string, candidates: ScoredDoc[], topK: number): ScoredDoc[] {
  const qTokens = new Set(tokenize(query));
  const rescored = candidates.map(({ doc, score }) => {
    const dTokens = new Set([...tokenize(doc.title), ...tokenize(doc.text), ...doc.tags.flatMap(tokenize)]);
    let overlap = 0;
    for (const t of qTokens) if (dTokens.has(t)) overlap++;
    const lexical = qTokens.size ? overlap / qTokens.size : 0;
    return { doc, score: 0.65 * score + 0.35 * lexical };
  });
  rescored.sort((a, b) => b.score - a.score);
  return rescored.slice(0, topK);
}

/**
 * Runtime retrieval: embed the (condensed) query, search Atlas Vector Search
 * when configured — falling back to the in-memory index if Atlas is empty or
 * unreachable — then re-rank and return the top-K chunks.
 */
export async function retrieve(query: string, topK = 5): Promise<RetrievalResult> {
  const rewritten = rewriteQuery(query);
  const [vector] = await getEmbedder().embed([rewritten]);

  const atlas = getAtlasStore();
  if (atlas) {
    try {
      const candidates = await atlas.search(vector, topK * 3);
      if (candidates.length > 0) {
        return { docs: rerank(rewritten, candidates, topK), rewrittenQuery: rewritten, source: "atlas" };
      }
      console.warn("[rag] Atlas returned no chunks (index empty? run `npm run ingest`) — falling back to memory");
    } catch (err) {
      console.warn(`[rag] Atlas search failed, falling back to memory: ${err instanceof Error ? err.message : err}`);
    }
  }

  const { store } = await getMemoryIndex();
  const candidates = await store.search(vector, topK * 3);
  return { docs: rerank(rewritten, candidates, topK), rewrittenQuery: rewritten, source: "memory" };
}

export type { KnowledgeDoc };
