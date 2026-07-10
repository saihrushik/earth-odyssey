import { MongoClient, type Collection, type Document } from "mongodb";
import type { KnowledgeDoc } from "./documents";
import type { ScoredDoc, VectorStore } from "./vectorStore";

/**
 * MongoDB Atlas Vector Search store.
 *
 * Enabled by setting MONGODB_URI (Atlas connection string). Documents are
 * ingested by `npm run ingest`; queries run through the `$vectorSearch`
 * aggregation stage against a search index named `vector_index`.
 *
 * One-time Atlas setup — create a Vector Search index on the collection
 * (db: MONGODB_DB, collection: MONGODB_COLLECTION) with this definition:
 *
 *   {
 *     "fields": [
 *       { "type": "vector", "path": "embedding", "numDimensions": <EMBED_DIM, default 1536>, "similarity": "cosine" },
 *       { "type": "filter", "path": "embedderName" }
 *     ]
 *   }
 */

const DB_NAME = process.env.MONGODB_DB ?? "earth_odyssey";
const COLLECTION = process.env.MONGODB_COLLECTION ?? "knowledge_chunks";
const INDEX_NAME = process.env.MONGODB_VECTOR_INDEX ?? "vector_index";

interface ChunkRecord extends Document {
  _id: string;
  title: string;
  destinationId?: string;
  text: string;
  tags: string[];
  embedding: number[];
  embedderName: string;
  ingestedAt: Date;
}

/** One client per process — survives dev hot-reloads and warm lambdas. */
const globalCache = globalThis as unknown as { __odysseyMongo?: MongoClient };

function getClient(uri: string): MongoClient {
  if (!globalCache.__odysseyMongo) {
    globalCache.__odysseyMongo = new MongoClient(uri, { maxPoolSize: 5 });
  }
  return globalCache.__odysseyMongo;
}

export class MongoAtlasVectorStore implements VectorStore {
  private collection: Collection<ChunkRecord>;

  constructor(
    uri: string,
    private embedderName: string,
  ) {
    this.collection = getClient(uri).db(DB_NAME).collection<ChunkRecord>(COLLECTION);
  }

  async upsert(docs: KnowledgeDoc[], vectors: number[][]): Promise<void> {
    if (docs.length !== vectors.length) throw new Error("docs/vectors length mismatch");
    const now = new Date();
    await this.collection.bulkWrite(
      docs.map((doc, i) => ({
        replaceOne: {
          filter: { _id: doc.id },
          replacement: {
            _id: doc.id,
            title: doc.title,
            destinationId: doc.destinationId,
            text: doc.text,
            tags: doc.tags,
            embedding: vectors[i],
            embedderName: this.embedderName,
            ingestedAt: now,
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );
  }

  /** Remove chunks embedded with a different model (stale after a model switch). */
  async pruneOtherEmbedders(): Promise<number> {
    const res = await this.collection.deleteMany({ embedderName: { $ne: this.embedderName } });
    return res.deletedCount;
  }

  async count(): Promise<number> {
    return this.collection.countDocuments({ embedderName: this.embedderName });
  }

  async search(vector: number[], topK: number): Promise<ScoredDoc[]> {
    const results = await this.collection
      .aggregate<ChunkRecord & { score: number }>([
        {
          $vectorSearch: {
            index: INDEX_NAME,
            path: "embedding",
            queryVector: vector,
            numCandidates: Math.max(topK * 15, 100),
            limit: topK,
            filter: { embedderName: this.embedderName },
          },
        },
        { $set: { score: { $meta: "vectorSearchScore" } } },
        { $unset: "embedding" },
      ])
      .toArray();

    return results.map((r) => ({
      doc: { id: r._id, title: r.title, destinationId: r.destinationId, text: r.text, tags: r.tags ?? [] },
      score: r.score,
    }));
  }
}

export function getMongoUri(): string | undefined {
  return process.env.MONGODB_URI || undefined;
}
