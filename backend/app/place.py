"""Place intel for any point on Earth: Wikipedia grounding + Claude tips.

Powers the panel that opens when a user searches a place or clicks the globe.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from typing import Any

import httpx

from . import llm, tools

WIKI_API = "https://en.wikipedia.org/w/api.php"
_UA = {"user-agent": "EarthOdyssey/1.0 (educational project; https://earth-odyssey.vercel.app)"}


async def wikipedia_context(name: str, lat: float, lng: float) -> str:
    """Nearest Wikipedia article extracts around the point (grounding text)."""
    try:
        async with httpx.AsyncClient(timeout=8, headers=_UA) as client:
            res = await client.get(WIKI_API, params={
                "action": "query",
                "generator": "geosearch",
                "ggscoord": f"{lat}|{lng}",
                "ggsradius": 10000,
                "ggslimit": 4,
                "prop": "extracts",
                "exintro": 1,
                "explaintext": 1,
                "exlimit": 4,
                "format": "json",
            })
            res.raise_for_status()
            pages = (res.json().get("query") or {}).get("pages") or {}
            parts = []
            for p in sorted(pages.values(), key=lambda x: x.get("index", 99)):
                extract = (p.get("extract") or "").strip()
                if extract:
                    parts.append(f"{p.get('title', '')}: {extract[:700]}")
            return "\n\n".join(parts[:4])
    except Exception:  # noqa: BLE001 — grounding is best-effort
        return ""


def _fallback_text(name: str, country: str | None, wiki: str) -> str:
    parts = [f"**{name}**{f', {country}' if country else ''}."]
    if wiki:
        parts.append(wiki.split("\n\n")[0][:500])
    parts.append(
        "Travel tips: check visa rules for your passport before booking; carry some local "
        "cash; mornings beat crowds at any landmark; and confirm opening days locally — "
        "set ANTHROPIC_API_KEY for tailored tips."
    )
    return "\n\n".join(parts)


async def run_place(payload: dict[str, Any]) -> AsyncGenerator[dict[str, Any], None]:
    name = str(payload.get("name") or "This place")
    lat = float(payload.get("lat", 0))
    lng = float(payload.get("lng", 0))
    country = payload.get("country")
    region = payload.get("region")

    wiki = await wikipedia_context(name, lat, lng)
    weather = await tools.current_weather(lat, lng)
    weather_line = (
        f"Right now: {round(weather['temperatureC'])}°C, {weather['description']}" if weather else ""
    )

    if not llm.claude_available():
        yield {"type": "delta", "text": _fallback_text(name, country, wiki)}
        yield {"type": "done"}
        return

    place_label = ", ".join(str(x) for x in [name, region, country] if x)
    system = f"""You are the Earth Odyssey Travel Copilot. The user dropped a pin on **{place_label}** ({lat:.3f}, {lng:.3f}).

Write, in under 180 words total:
1. Two-sentence intro — what this place is and why it's interesting.
2. "**Worth knowing**" — 2 short bullet facts.
3. "**Travel tips**" — 4 practical bullets (best time to go, getting there/around, one local must-do, one caution or etiquette note).

Rules: real places and facts only — prefer the reference material below; your own knowledge is fine for well-known context; if the pin is remote wilderness or open water, say so and describe the region instead. No invented prices or hotel names. Bold place names. No markdown headings (#) — plain paragraphs and "- " bullets only.

{f"Live weather: {weather_line}" if weather_line else ""}

Reference material (nearby Wikipedia extracts):
{wiki or "(none found — rely on your own knowledge, carefully)"}"""

    try:
        async for token in llm.stream_claude(system, [{"role": "user", "content": f"Tell me about {place_label}."}]):
            yield {"type": "delta", "text": token}
    except Exception:  # noqa: BLE001
        yield {"type": "delta", "text": _fallback_text(name, country, wiki)}
    yield {"type": "done"}
