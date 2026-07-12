"""Intent analysis + expert selection + destination scoring (port of supervisor.ts)."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from . import data

MONTHS = ["january", "february", "march", "april", "may", "june",
          "july", "august", "september", "october", "november", "december"]

TAG_KEYWORDS: list[tuple[str, str]] = [
    (r"\bhik\w*|trek\w*|trail\w*|walk\w*\b", "hiking"),
    (r"\bbeach\w*|island\w*|snorkel\w*|lagoon\b", "beach"),
    (r"\baurora|northern lights?\b", "aurora"),
    (r"\bromantic|honeymoon|couple\w*|anniversary\b", "romantic"),
    (r"\bluxur\w*|villa|five.star|5.star|high.end\b", "luxury"),
    (r"\bfood\w*|eat\w*|cuisine|culinary|restaurant\w*|street food\b", "food"),
    (r"\bkids?\b|\bchild\w*|famil\w*\b", "family"),
    (r"\bphotograph\w*|photo\w*|instagram\b", "photography"),
    (r"\banime|ghibli|manga\b", "anime"),
    (r"\bcrowds?\b|\bquiet|hidden|offbeat|off the beaten\b", "crowdsfree"),
    (r"\bhistor\w*|ancient|ruins?|temple\w*|monument\w*|castle\w*\b", "history"),
    (r"\badventur\w*|adrenaline|thrill\w*\b", "adventure"),
    (r"\bsnow|winter|ski\w*\b", "winter"),
    (r"\bdiv(e|ing)|scuba\b", "diving"),
    (r"\bwine\b", "wine"),
    (r"\bcheap\w*|budget|backpack\w*|affordable\b", "budget-friendly"),
    (r"\bwaterfall\w*|glacier\w*|volcano\w*|geyser\w*\b", "nature"),
    (r"\bballoon\w*\b", "balloons"),
    (r"\bdesert\b", "desert"),
    (r"\bstargaz\w*|dark sky\b", "stargazing"),
    (r"\brelax\w*|unwind|slow travel\b", "relaxation"),
    (r"\bsunsets?\b|golden hour", "sunset"),
]

TAG_MATCHES: dict[str, list[str]] = {
    "history": ["history", "monument", "unesco", "architecture", "caves", "spiritual"],
    "nature": ["nature", "waterfalls", "glaciers", "geothermal", "wildlife"],
    "winter": ["winter", "arctic", "skiing", "aurora"],
    "beach": ["beach", "snorkeling", "diving", "surf", "relaxation"],
    "food": ["food", "wine", "cuisine"],
}


@dataclass
class TravelDates:
    depart_iso: str
    return_iso: str
    explicit: bool


@dataclass
class Intents:
    budget_usd: int | None = None
    days: int | None = None
    tags: list[str] = field(default_factory=list)
    mentioned_dest_ids: list[str] = field(default_factory=list)
    similar_to_id: str | None = None
    wants_weather: bool = False
    wants_aurora: bool = False
    wants_visa: bool = False
    wants_safety: bool = False
    wants_food: bool = False
    wants_packing: bool = False
    wants_flights: bool = False
    wants_stays: bool = False
    wants_best_time: bool = False
    wants_entry_fee: bool = False
    direct_question: bool = False
    dates: TravelDates | None = None


def _iso(d: datetime) -> str:
    return d.strftime("%Y-%m-%d")


def parse_travel_dates(q: str, trip_days: int = 7) -> TravelDates | None:
    now = datetime.now(timezone.utc)

    iso_range = re.search(r"(\d{4}-\d{2}-\d{2})(?:\s*(?:to|-|until|through)\s*(\d{4}-\d{2}-\d{2}))?", q)
    if iso_range:
        dep = datetime.fromisoformat(iso_range.group(1)).replace(tzinfo=timezone.utc)
        ret = (datetime.fromisoformat(iso_range.group(2)).replace(tzinfo=timezone.utc)
               if iso_range.group(2) else dep + timedelta(days=trip_days))
        return TravelDates(_iso(dep), _iso(ret), True)

    month_idx = next((i for i, m in enumerate(MONTHS) if re.search(rf"\b{m[:3]}[a-z]*\b", q)), -1)
    if month_idx >= 0:
        abbr = MONTHS[month_idx][:3]
        day_range = (re.search(rf"{abbr}[a-z]*\s+(\d{{1,2}})(?:\s*[-–to]+\s*(\d{{1,2}}))?", q)
                     or re.search(rf"(\d{{1,2}})(?:st|nd|rd|th)?(?:\s*[-–to]+\s*(\d{{1,2}})(?:st|nd|rd|th)?)?\s+{abbr}[a-z]*", q))
        year = now.year + 1 if (month_idx < now.month - 1 or (month_idx == now.month - 1 and now.day > 25)) else now.year
        start_day = int(day_range.group(1)) if day_range else 10
        end_day = int(day_range.group(2)) if day_range and day_range.group(2) else start_day + trip_days
        dep = datetime(year, month_idx + 1, min(start_day, 28), tzinfo=timezone.utc)
        ret_month = month_idx + 1 if end_day >= start_day else month_idx + 2
        ret = (datetime(year, ret_month, min(end_day, 28), tzinfo=timezone.utc)
               if ret_month <= 12 else dep + timedelta(days=trip_days))
        return TravelDates(_iso(dep), _iso(ret), bool(day_range))

    if re.search(r"\bnext week\b", q):
        dep = now + timedelta(days=7)
        return TravelDates(_iso(dep), _iso(dep + timedelta(days=trip_days)), True)
    if re.search(r"\bnext month\b", q):
        month = now.month % 12 + 1
        year = now.year + (1 if month == 1 else 0)
        dep = datetime(year, month, 10, tzinfo=timezone.utc)
        return TravelDates(_iso(dep), _iso(dep + timedelta(days=trip_days)), True)
    if re.search(r"\b(this weekend|tomorrow)\b", q):
        offset = 1 if "tomorrow" in q else max(5 - now.weekday(), 1)
        dep = now + timedelta(days=offset)
        return TravelDates(_iso(dep), _iso(dep + timedelta(days=3)), True)
    return None


def analyze_intents(query: str) -> Intents:
    q = query.lower()

    tags = []
    for pattern, tag in TAG_KEYWORDS:
        if re.search(pattern, q) and tag not in tags:
            tags.append(tag)

    budget_m = (re.search(r"\$\s?([\d,]{3,7})", q)
                or re.search(r"([\d,]{3,7})\s?(?:usd|dollars|bucks)", q)
                or re.search(r"budget (?:of |is )?([\d,]{3,7})", q))
    budget_usd = int(budget_m.group(1).replace(",", "")) if budget_m else None

    days_m = re.search(r"(\d{1,2})\s*(day|days|night|nights)", q)
    weeks_m = re.search(r"(\d{1,2})\s*(week|weeks)", q)
    days = int(days_m.group(1)) if days_m else (int(weeks_m.group(1)) * 7 if weeks_m else None)

    mentioned = []
    for d in data.destinations():
        names = [d["name"].lower()] + [s.strip() for s in d["name"].lower().split("—")]
        if any(len(n) > 3 and n in q for n in names) or d["country"].lower() in q:
            mentioned.append(d["id"])

    similar_to = None
    sim = re.search(r"(?:similar to|like|instead of)\s+([a-z\s]+?)(?:[.,?!]|$)", q)
    if sim:
        needle = sim.group(1).strip()
        for d in data.destinations():
            if needle in d["name"].lower() or needle in d["country"].lower() or d["country"].lower() in needle:
                similar_to = d["id"]
                break

    wants_flights = bool(re.search(r"\bflights?|fly|airfare|plane|airlines?\b", q)
                         or re.search(r"\bticket (price|cost)s?\b.*\b(fly|flight|plane)\b", q))
    wants_entry = bool(re.search(
        r"\b(entry|entrance|admission)\s*(fee|price|cost|ticket)|how much (is|does).*(entry|ticket|cost to (enter|visit))|ticket price", q,
    )) and not wants_flights
    wants_best_time = bool(re.search(r"\bbest (time|season|month)\b|\bwhen (should|to|is the best)\b", q))
    wants_stays = bool(re.search(r"\bhotels?|stays?|hostels?|resorts?|accommodation|airbnb|where (to|should i) (stay|sleep)\b", q))

    discovery = bool(re.search(r"\b(show|find|recommend|suggest|places|destinations|where (should|can) i go|ideas)\b", q))
    direct = bool(mentioned) and not discovery and (
        wants_best_time or wants_entry or wants_flights or wants_stays
        or bool(re.search(r"\bvisas?|safe|weather|food|how much|cost", q))
    )

    return Intents(
        budget_usd=budget_usd,
        days=days,
        tags=tags,
        mentioned_dest_ids=mentioned,
        similar_to_id=similar_to,
        wants_weather=bool(re.search(r"\bweather|temperature|cold|warm|hot|rain\w*|forecast\b", q)),
        wants_aurora=bool(re.search(r"\baurora|northern lights?\b", q)),
        wants_visa=bool(re.search(r"\bvisas?\b|entry requirement", q)),
        wants_safety=bool(re.search(r"\bsafe\w*|danger\w*\b", q)),
        wants_food=bool(re.search(r"\bfood\w*|eat\w*|cuisine|restaurant\w*\b", q)),
        wants_packing=bool(re.search(r"\bpack\w*|bring|gear|clothes\b", q)),
        wants_flights=wants_flights,
        wants_stays=wants_stays,
        wants_best_time=wants_best_time,
        wants_entry_fee=wants_entry,
        direct_question=direct,
        dates=parse_travel_dates(q, days or 7),
    )


def select_experts(intents: Intents) -> list[str]:
    experts = ["destination-expert"]
    if intents.budget_usd is not None or "budget-friendly" in intents.tags:
        experts.append("budget-planner")
    if intents.wants_weather or intents.wants_aurora:
        experts.append("weather-expert")
    if intents.wants_visa:
        experts.append("visa-expert")
    if intents.wants_safety:
        experts.append("safety-expert")
    if intents.wants_food:
        experts.append("food-expert")
    if intents.wants_packing:
        experts.append("packing-expert")
    if intents.wants_flights or intents.dates:
        experts.append("flight-expert")
    if intents.wants_stays:
        experts.append("hotel-expert")
    if intents.days is not None:
        experts.append("itinerary-generator")
    return experts


def score_destinations(intents: Intents, retrieved_dest_ids: list[str]) -> list[str]:
    want_tags = set(intents.tags)
    if intents.similar_to_id:
        src = data.destination_by_id(intents.similar_to_id)
        if src:
            want_tags.update(src["tags"])

    daily = (intents.budget_usd / intents.days
             if intents.budget_usd is not None and intents.days else None)

    scored: list[tuple[str, float]] = []
    for d in data.destinations():
        score = 0.0
        for t in want_tags:
            aliases = TAG_MATCHES.get(t, [t])
            if any(dt in aliases for dt in d["tags"]):
                score += 2
            if any(c in aliases for c in d["chapters"]):
                score += 1
        if d["id"] in intents.mentioned_dest_ids:
            score += 10
        if d["id"] in retrieved_dest_ids:
            score += 1.5
        if d["id"] == intents.similar_to_id:
            score -= 8
        b = d["budgetPerDay"]
        if daily is not None:
            if daily >= b["midrange"]:
                score += 1
            elif daily < b["backpacker"]:
                score -= 3
        elif intents.budget_usd is not None and intents.budget_usd <= 3000:
            if b["midrange"] <= 100:
                score += 1.5
            if b["midrange"] >= 250:
                score -= 2
        scored.append((d["id"], score))

    scored.sort(key=lambda x: x[1], reverse=True)
    return [dest_id for dest_id, s in scored if s > 0]
