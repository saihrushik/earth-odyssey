import type { KnowledgeDoc } from "./documents";

export interface ScoredDoc {
  doc: KnowledgeDoc;
  score: number;
}

/**
 * Minimal vector store contract so the in-process store can be swapped for
 * Qdrant/Pinecone by implementing the same two methods.
 */
export interface VectorStore {
  upsert(docs: KnowledgeDoc[], vectors: number[][]): Promise<void>;
  search(vector: number[], topK: number): Promise<ScoredDoc[]>;
}

export class InMemoryVectorStore implements VectorStore {
  private docs: KnowledgeDoc[] = [];
  private vectors: number[][] = [];

  async upsert(docs: KnowledgeDoc[], vectors: number[][]): Promise<void> {
    if (docs.length !== vectors.length) throw new Error("docs/vectors length mismatch");
    this.docs = docs;
    this.vectors = vectors;
  }

  async search(vector: number[], topK: number): Promise<ScoredDoc[]> {
    const scored = this.docs.map((doc, i) => {
      const v = this.vectors[i];
      let dot = 0;
      for (let j = 0; j < v.length; j++) dot += v[j] * vector[j];
      return { doc, score: dot }; // vectors are normalized → dot == cosine
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }
}
