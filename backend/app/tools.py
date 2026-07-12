"""Live travel tools: Open-Meteo weather/forecasts (keyless), flight estimator, stays."""

from __future__ import annotations

import math
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from zoneinfo import ZoneInfo

import httpx

from . import data

WMO = {
    0: "clear sky", 1: "mostly clear", 2: "partly cloudy", 3: "overcast",
    45: "fog", 48: "rime fog", 51: "light drizzle", 53: "drizzle", 55: "heavy drizzle",
    61: "light rain", 63: "rain", 65: "heavy rain", 66: "freezing rain", 67: "heavy freezing rain",
    71: "light snow", 73: "snow", 75: "heavy snow", 77: "snow grains",
    80: "light showers", 81: "showers", 82: "violent showers",
    85: "snow showers", 86: "heavy snow showers",
    95: "thunderstorm", 96: "thunderstorm with hail", 99: "severe thunderstorm with hail",
}


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    to_rad = math.radians
    d_lat = to_rad(lat2 - lat1)
    d_lng = to_rad(lng2 - lng1)
    a = math.sin(d_lat / 2) ** 2 + math.cos(to_rad(lat1)) * math.cos(to_rad(lat2)) * math.sin(d_lng / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(a))


async def current_weather(lat: float, lng: float) -> dict[str, Any] | None:
    try:
        async with httpx.AsyncClient(timeout=6) as client:
            res = await client.get(
                "https://api.open-meteo.com/v1/forecast",
                params={"latitude": lat, "longitude": lng,
                        "current": "temperature_2m,weather_code,wind_speed_10m,is_day"},
            )
            res.raise_for_status()
            c = res.json()["current"]
            return {
                "temperatureC": c["temperature_2m"],
                "windKmh": c["wind_speed_10m"],
                "description": WMO.get(c["weather_code"], "unknown conditions"),
                "isDay": c["is_day"] == 1,
            }
    except Exception:  # noqa: BLE001 — live tools degrade silently
        return None


async def forecast(lat: float, lng: float, start_iso: str, end_iso: str) -> list[dict[str, Any]] | None:
    """Daily forecast for a date range; None past Open-Meteo's 16-day horizon."""
    try:
        start = datetime.fromisoformat(start_iso).replace(tzinfo=timezone.utc)
        horizon = (start - datetime.now(timezone.utc)).days
        if horizon > 15 or horizon < -1:
            return None
        async with httpx.AsyncClient(timeout=6) as client:
            res = await client.get(
                "https://api.open-meteo.com/v1/forecast",
                params={"latitude": lat, "longitude": lng,
                        "daily": "temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code",
                        "start_date": start_iso, "end_date": min(end_iso, _plus_days(start_iso, 15))},
            )
            res.raise_for_status()
            d = res.json()["daily"]
            return [
                {"date": d["time"][i], "maxC": d["temperature_2m_max"][i], "minC": d["temperature_2m_min"][i],
                 "precipChancePct": d["precipitation_probability_max"][i] or 0,
                 "description": WMO.get(d["weather_code"][i], "mixed")}
                for i in range(len(d["time"]))
            ]
    except Exception:  # noqa: BLE001
        return None


def _plus_days(iso_str: str, days: int) -> str:
    from datetime import timedelta
    return (datetime.fromisoformat(iso_str) + timedelta(days=days)).strftime("%Y-%m-%d")


def local_time_at(tz_name: str) -> str:
    try:
        return datetime.now(ZoneInfo(tz_name)).strftime("%a %I:%M %p")
    except Exception:  # noqa: BLE001
        return ""


# ── Flights (estimator; live Amadeus quotes stay in the TS backend) ─────────

@dataclass
class FlightQuote:
    origin: str
    origin_code: str
    destination_city: str
    destination_code: str
    price_low_usd: int
    price_high_usd: int
    airlines: list[str]
    depart_date: str | None
    return_date: str | None
    live: bool = False


def find_origin_hub(query: str) -> dict[str, Any] | None:
    m = re.search(r"\bfrom\s+([a-z\s]+?)(?:[.,?!]|$| to | in | on )", f" {query.lower()} ")
    needle = m.group(1).strip() if m else None
    if not needle:
        return None
    for hub in data.origin_hubs():
        if any(needle in a.strip() or a.strip() in needle for a in hub["aliases"]):
            return hub
    return None


def _season_factor(month0: int) -> float:
    if month0 in (11, 6, 7):
        return 1.25
    if month0 in (5, 8):
        return 1.12
    if month0 in (0, 1):
        return 0.88
    return 1.0


def estimate_flight(dest_id: str, origin: dict[str, Any] | None,
                    depart: str | None = None, ret: str | None = None) -> FlightQuote | None:
    dest = data.destination_by_id(dest_id)
    gateway = data.gateway_airport(dest_id)
    if not dest or not gateway:
        return None
    hub = origin or data.origin_hubs()[0]  # default: New York

    km = haversine_km(hub["lat"], hub["lng"], dest["lat"], dest["lng"])
    base = max(140.0, min(90 + km * 0.075, 2100.0))
    month0 = (datetime.fromisoformat(depart).month - 1) if depart else datetime.now(timezone.utc).month - 1
    base *= _season_factor(month0)
    if dest_id in ("bora-bora", "maldives"):
        base *= 1.2

    return FlightQuote(
        origin=hub["city"], origin_code=hub["code"],
        destination_city=gateway["city"], destination_code=gateway["code"],
        price_low_usd=round(base * 0.85 / 10) * 10,
        price_high_usd=round(base * 1.2 / 10) * 10,
        airlines=data.regional_airlines(dest_id),
        depart_date=depart, return_date=ret,
    )


def format_stays(dest_id: str) -> str:
    stays = data.stays_for(dest_id)
    parts = []
    for s in stays:
        note = f" — {s['note']}" if s.get("note") else ""
        parts.append(f"{s['name']} ({s['tier']}, ~${s['pricePerNight']}/night{note})")
    return " · ".join(parts)
