import { getCurrentWeather } from "@/server/tools/weather";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return Response.json({ error: "lat/lng query params required" }, { status: 400 });
  }
  try {
    return Response.json(await getCurrentWeather(lat, lng));
  } catch {
    return Response.json({ error: "weather unavailable" }, { status: 502 });
  }
}
