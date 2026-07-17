export const runtime = "nodejs";

/** Forward geocoding via Open-Meteo (keyless). ?q=Hyderabad → candidates. */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim();
  if (!q) return Response.json({ results: [] });

  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=en&format=json`,
      { signal: AbortSignal.timeout(6000) },
    );
    if (!res.ok) throw new Error(String(res.status));
    const json = (await res.json()) as {
      results?: {
        name: string;
        latitude: number;
        longitude: number;
        country?: string;
        admin1?: string;
        population?: number;
      }[];
    };
    return Response.json({
      results: (json.results ?? []).map((r) => ({
        name: r.name,
        lat: r.latitude,
        lng: r.longitude,
        country: r.country,
        region: r.admin1,
      })),
    });
  } catch {
    return Response.json({ results: [], error: "geocoding unavailable" }, { status: 502 });
  }
}
