/**
 * Chunking stage: split cleaned text into 500–1000-token chunks
 * (≈4 chars/token) on paragraph → sentence boundaries, with overlap
 * so context isn't lost at chunk edges.
 */

const CHARS_PER_TOKEN = 4;
const MIN_TOKENS = 500;
const MAX_TOKENS = 1000;
const OVERLAP_TOKENS = 80;

const MIN_CHARS = MIN_TOKENS * CHARS_PER_TOKEN;
const MAX_CHARS = MAX_TOKENS * CHARS_PER_TOKEN;
const OVERLAP_CHARS = OVERLAP_TOKENS * CHARS_PER_TOKEN;

function splitUnits(text: string): string[] {
  // Paragraphs first; overly long paragraphs fall back to sentences.
  const paragraphs = text.split(/\n\n+/);
  const units: string[] = [];
  for (const p of paragraphs) {
    if (p.length <= MAX_CHARS) {
      if (p.trim()) units.push(p.trim());
    } else {
      let current = "";
      for (const s of p.split(/(?<=[.!?])\s+/)) {
        if (current.length + s.length > MAX_CHARS && current) {
          units.push(current.trim());
          current = "";
        }
        current += (current ? " " : "") + s;
      }
      if (current.trim()) units.push(current.trim());
    }
  }
  return units;
}

export function chunkText(text: string): string[] {
  if (text.length <= MAX_CHARS) return text.trim() ? [text.trim()] : [];

  const units = splitUnits(text);
  const chunks: string[] = [];
  let current = "";

  for (const unit of units) {
    if (current && current.length + unit.length + 2 > MAX_CHARS) {
      chunks.push(current);
      // Start the next chunk with a trailing slice of the previous one.
      current = current.slice(-OVERLAP_CHARS).replace(/^\S*\s/, "") + "\n\n";
    }
    current += (current && !current.endsWith("\n\n") ? "\n\n" : "") + unit;
  }
  if (current.trim()) {
    // Merge a runt final chunk into the previous one when possible.
    if (chunks.length > 0 && current.length < MIN_CHARS / 2 && chunks[chunks.length - 1].length + current.length <= MAX_CHARS * 1.2) {
      chunks[chunks.length - 1] += "\n\n" + current.trim();
    } else {
      chunks.push(current.trim());
    }
  }
  return chunks;
}
