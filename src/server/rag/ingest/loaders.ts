import { promises as fs } from "node:fs";
import path from "node:path";
import { cleanText } from "./clean";
import { chunkText } from "./chunk";
import type { KnowledgeDoc } from "../documents";

/**
 * Document loaders for the ingestion pipeline. Sources:
 *  - the `knowledge-base/` folder (.md, .txt, .json travel guides, FAQs, blogs)
 *  - Wikipedia articles (plain-text extracts via the REST API)
 * Every source runs through clean → chunk before embedding.
 */

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function toChunkedDocs(sourceId: string, title: string, body: string, tags: string[]): KnowledgeDoc[] {
  const chunks = chunkText(cleanText(body));
  return chunks.map((text, i) => ({
    id: chunks.length > 1 ? `${sourceId}#${i + 1}` : sourceId,
    title: chunks.length > 1 ? `${title} (part ${i + 1})` : title,
    text,
    tags,
  }));
}

/** Load .md / .txt / .json documents from the knowledge-base folder. */
export async function loadKnowledgeFolder(dir: string): Promise<KnowledgeDoc[]> {
  let entries: string[] = [];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return []; // folder is optional
  }

  const docs: KnowledgeDoc[] = [];
  for (const file of entries.sort()) {
    const ext = path.extname(file).toLowerCase();
    if (![".md", ".txt", ".json"].includes(ext)) continue;
    const raw = await fs.readFile(path.join(dir, file), "utf8");
    const base = slugify(path.basename(file, ext));

    if (ext === ".json") {
      // JSON docs: single object or array of { title, text, tags?, destinationId? }.
      try {
        const parsed = JSON.parse(raw) as
          | { title: string; text: string; tags?: string[]; destinationId?: string }
          | { title: string; text: string; tags?: string[]; destinationId?: string }[];
        const items = Array.isArray(parsed) ? parsed : [parsed];
        items.forEach((item, idx) => {
          if (!item?.title || !item?.text) return;
          for (const d of toChunkedDocs(`kb:${base}-${idx}`, item.title, item.text, item.tags ?? ["knowledge-base"])) {
            docs.push(item.destinationId ? { ...d, destinationId: item.destinationId } : d);
          }
        });
      } catch {
        console.warn(`[ingest] skipping invalid JSON: ${file}`);
      }
      continue;
    }

    // Markdown/txt: first heading (or filename) is the title.
    const headingMatch = raw.match(/^#\s+(.+)$/m);
    const title = headingMatch?.[1].trim() ?? base.replace(/-/g, " ");
    docs.push(...toChunkedDocs(`kb:${base}`, title, raw, ["knowledge-base"]));
  }
  return docs;
}

/** Fetch plain-text extracts of Wikipedia articles and chunk them. */
export async function loadWikipedia(titles: string[]): Promise<KnowledgeDoc[]> {
  const docs: KnowledgeDoc[] = [];
  for (const title of titles) {
    const url =
      "https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&format=json&origin=*&redirects=1&titles=" +
      encodeURIComponent(title);
    try {
      const res = await fetch(url, { headers: { "user-agent": "earth-odyssey-ingest/1.0" } });
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as { query?: { pages?: Record<string, { title?: string; extract?: string }> } };
      const page = Object.values(json.query?.pages ?? {})[0];
      if (!page?.extract) {
        console.warn(`[ingest] no Wikipedia extract for "${title}"`);
        continue;
      }
      docs.push(...toChunkedDocs(`wiki:${slugify(page.title ?? title)}`, `${page.title ?? title} (Wikipedia)`, page.extract, ["wikipedia"]));
    } catch (err) {
      console.warn(`[ingest] Wikipedia fetch failed for "${title}": ${err instanceof Error ? err.message : err}`);
    }
  }
  return docs;
}
