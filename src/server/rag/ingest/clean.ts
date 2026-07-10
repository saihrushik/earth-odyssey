/** Text cleaning stage of the ingestion pipeline. */

export function cleanText(raw: string): string {
  return (
    raw
      // Markdown/HTML noise.
      .replace(/<[^>]+>/g, " ")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/[*_`~]{1,3}/g, "")
      // Wikipedia-style citation markers, e.g. [12] [note 3].
      .replace(/\[(?:\d+|note \d+|citation needed)\]/gi, "")
      // Collapse whitespace but preserve paragraph breaks.
      .replace(/\r/g, "")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}
