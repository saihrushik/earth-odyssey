export const runtime = "nodejs";

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
