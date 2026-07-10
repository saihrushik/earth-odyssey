/**
 * Embedding provider.
 *
 * With OPENAI_API_KEY set, uses OpenAI `text-embedding-3-small` (overridable
 * via OPENAI_EMBED_MODEL / EMBED_DIM — Atlas index dimensions must match).
 * Without it, falls back to a deterministic local hashing embedder
 * (character-trigram TF vectors hashed into a fixed dimension) so the
 * whole RAG pipeline works offline. Both are L2-normalized so vector
 * stores can rank by plain dot product / cosine.
 */

const LOCAL_DIM = 384;
const OPENAI_BATCH = 128;

export interface Embedder {
  name: string;
  dim: number;
  embed(texts: string[]): Promise<number[][]>;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function localEmbedOne(text: string): number[] {
  const v = new Array<number>(LOCAL_DIM).fill(0);
  const words = tokenize(text);
  for (const w of words) {
    // Whole-word feature plus character trigrams for fuzziness.
    const grams = [w];
    const padded = `^${w}$`;
    for (let i = 0; i + 3 <= padded.length; i++) grams.push(padded.slice(i, i + 3));
    for (const g of grams) {
      const h = hashStr(g);
      const sign = (h & 1) === 0 ? 1 : -1;
      v[h % LOCAL_DIM] += sign * (g === w ? 2 : 1);
    }
  }
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}

const localEmbedder: Embedder = {
  name: `local-hash-${LOCAL_DIM}`,
  dim: LOCAL_DIM,
  async embed(texts) {
    return texts.map(localEmbedOne);
  },
};

function makeOpenAIEmbedder(apiKey: string): Embedder {
  const model = process.env.OPENAI_EMBED_MODEL ?? "text-embedding-3-small";
  const dim = Number(process.env.EMBED_DIM ?? 1536);

  async function embedBatch(texts: string[]): Promise<number[][]> {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, input: texts, dimensions: dim }),
    });
    if (!res.ok) throw new Error(`Embedding request failed: ${res.status} ${await res.text()}`);
    const json = (await res.json()) as { data: { index: number; embedding: number[] }[] };
    return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
  }

  return {
    name: `openai/${model}@${dim}`,
    dim,
    async embed(texts) {
      const out: number[][] = [];
      for (let i = 0; i < texts.length; i += OPENAI_BATCH) {
        out.push(...(await embedBatch(texts.slice(i, i + OPENAI_BATCH))));
      }
      return out;
    },
  };
}

export function getEmbedder(): Embedder {
  const key = process.env.OPENAI_API_KEY;
  return key ? makeOpenAIEmbedder(key) : localEmbedder;
}

export { tokenize };
