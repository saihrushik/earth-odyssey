import { buildKnowledgeBase, type KnowledgeDoc } from "./documents";
import { getEmbedder, tokenize } from "./embeddings";
import { InMemoryVectorStore, type ScoredDoc, type VectorStore } from "./vectorStore";

export interface RetrievalResult {
  docs: ScoredDoc[];
  rewrittenQuery: string;
}

interface RagIndex {
  store: VectorStore;
  embedderName: string;
}

/** Survives dev hot-reloads; keyed by embedder so switching providers reindexes. */
const globalCache = globalThis as unknown as { __odysseyRag?: Promise<RagIndex> };

async function buildIndex(): Promise<RagIndex> {
  const embedder = getEmbedder();
  const docs = buildKnowledgeBase();
  const vectors = await embedder.embed(docs.map((d) => `${d.title}. ${d.text}`));
  const store = new InMemoryVectorStore();
  await store.upsert(docs, vectors);
  return { store, embedderName: embedder.name };
}

async function getIndex(): Promise<RagIndex> {
  if (!globalCache.__odysseyRag) {
    globalCache.__odysseyRag = buildIndex().catch((err) => {
      globalCache.__odysseyRag = undefined; // allow retry on transient failure
      throw err;
    });
  }
  return globalCache.__odysseyRag;
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
  ];
  for (const [re, add] of expansions) if (re.test(q)) q += add;
  return q.replace(/\s+/g, " ").trim() || query;
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

export async function retrieve(query: string, topK = 6): Promise<RetrievalResult> {
  const { store } = await getIndex();
  const rewritten = rewriteQuery(query);
  const [vector] = await getEmbedder().embed([rewritten]);
  const candidates = await store.search(vector, topK * 3);
  return { docs: rerank(rewritten, candidates, topK), rewrittenQuery: rewritten };
}

export type { KnowledgeDoc };
