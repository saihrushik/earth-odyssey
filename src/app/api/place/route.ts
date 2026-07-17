import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
// Claude streaming can take 20s+ — raise Vercel's function limit.
export const maxDuration = 60;

interface PlaceBody {
  name?: string;
  lat?: number;
  lng?: number;
  country?: string;
  region?: string;
}

const WIKI_API = "https://en.wikipedia.org/w/api.php";

async function wikipediaIntro(lat: number, lng: number): Promise<string> {
  try {
    const params = new URLSearchParams({
      action: "query",
      generator: "geosearch",
      ggscoord: `${lat}|${lng}`,
      ggsradius: "10000",
      ggslimit: "2",
      prop: "extracts",
      exintro: "1",
      explaintext: "1",
      exlimit: "2",
      format: "json",
    });
    const res = await fetch(`${WIKI_API}?${params}`, {
      headers: { "user-agent": "EarthOdyssey/1.0 (educational project)" },
      signal: AbortSignal.timeout(6000),
    });
    const pages = ((await res.json()).query?.pages ?? {}) as Record<
      string,
      { title?: string; extract?: string; index?: number }
    >;
    const first = Object.values(pages).sort((a, b) => (a.index ?? 9) - (b.index ?? 9))[0];
    return first?.extract?.slice(0, 600) ?? "";
  } catch {
    return "";
  }
}

/** Place intel: proxy to the Python/Claude backend, Wikipedia fallback otherwise. */
export async function POST(request: Request) {
  let body: PlaceBody;
  try {
    body = (await request.json()) as PlaceBody;
    if (typeof body.lat !== "number" || typeof body.lng !== "number") throw new Error("bad");
  } catch {
    return Response.json({ error: "Body must be { name, lat, lng }" }, { status: 400 });
  }

  const backendUrl = process.env.COPILOT_BACKEND_URL;
  if (backendUrl) {
    try {
      const upstream = await fetch(`${backendUrl.replace(/\/$/, "")}/api/place`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60_000),
      });
      if (upstream.ok && upstream.body) {
        return new Response(upstream.body, {
          headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
        });
      }
    } catch {
      // fall through to the Wikipedia fallback
    }
  }

  // Claude directly in the route (Vercel-friendly) — same recipe as the
  // Python backend: nearby Wikipedia extracts ground the answer.
  if (process.env.ANTHROPIC_API_KEY) {
    const intro = await wikipediaIntro(body.lat, body.lng);
    const label = [body.name, body.region, body.country].filter(Boolean).join(", ");
    const client = new Anthropic();
    const claudeStream = client.messages.stream({
      model: process.env.CLAUDE_MODEL ?? "claude-opus-4-8",
      max_tokens: 1024,
      thinking: { type: "adaptive" },
      output_config: { effort: "low" },
      system: `You are the Earth Odyssey Travel Copilot. The user dropped a pin on **${label}** (${body.lat.toFixed(3)}, ${body.lng.toFixed(3)}).

Write, in under 180 words total:
1. Two-sentence intro — what this place is and why it's interesting.
2. "**Worth knowing**" — 2 short bullet facts.
3. "**Travel tips**" — 4 practical bullets (best time to go, getting there/around, one local must-do, one caution or etiquette note).

Rules: real places and facts only — prefer the reference material below; your own knowledge is fine for well-known context; if the pin is remote wilderness or open water, say so and describe the region instead. No invented prices or hotel names. Bold place names. No markdown headings (#) — plain paragraphs and "- " bullets only.

Reference material (nearby Wikipedia extracts):
${intro || "(none found — rely on your own knowledge, carefully)"}`,
      messages: [{ role: "user", content: `Tell me about ${label || "this place"}.` }],
    });

    const encoder = new TextEncoder();
    const ndjson = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const event of claudeStream) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              controller.enqueue(encoder.encode(JSON.stringify({ type: "delta", text: event.delta.text }) + "\n"));
            }
          }
        } catch {
          controller.enqueue(
            encoder.encode(JSON.stringify({ type: "delta", text: "Couldn't load place details — try again." }) + "\n"),
          );
        } finally {
          controller.enqueue(encoder.encode(JSON.stringify({ type: "done" }) + "\n"));
          controller.close();
        }
      },
    });
    return new Response(ndjson, {
      headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
    });
  }

  const intro = await wikipediaIntro(body.lat, body.lng);
  const text = [
    `**${body.name ?? "This place"}**${body.country ? `, ${body.country}` : ""}.`,
    intro || "No encyclopedia entry found near this point — it may be remote terrain or open water.",
    "**Travel tips**: check visa rules for your passport; carry some local cash; go early to beat crowds; verify opening days locally.",
  ].join("\n\n");
  const stream = `${JSON.stringify({ type: "delta", text })}\n${JSON.stringify({ type: "done" })}\n`;
  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
  });
}
