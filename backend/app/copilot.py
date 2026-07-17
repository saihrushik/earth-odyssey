"""Copilot orchestrator — RAG + live tools + local LLM.

Flow per request:
    history + question → intents (supervisor) → vector retrieval (Chroma)
    → globe actions → live data prefetch (weather / flights / stays)
    → generation: local LLM via Ollama when available, deterministic
      composer otherwise → citations

Both generators receive the SAME retrieved chunks and live facts; the LLM
only phrases them. It is explicitly instructed not to invent data.
"""

from __future__ import annotations

import re
from collections.abc import AsyncGenerator
from typing import Any

from . import data, llm, supervisor, tools
from .rag import retriever
from .supervisor import Intents

Event = dict[str, Any]


def _referenced_dest_id(messages: list[dict[str, str]]) -> str | None:
    assistants = [m["content"] for m in messages if m["role"] == "assistant"]
    if not assistants:
        return None
    for m in re.finditer(r"\*\*([^*]+)\*\*", assistants[-1]):
        name = m.group(1).lower()
        for d in data.destinations():
            if name in d["name"].lower() or d["name"].lower() in name:
                return d["id"]
    return None


def _fmt_range(depart: str | None, ret: str | None) -> str:
    if not depart:
        return "flexible dates"
    return f"{depart} – {ret}" if ret else depart


async def _gather_facts(dest: dict[str, Any], intents: Intents, query: str) -> list[str]:
    """Live + structured facts for one destination, as labelled lines."""
    facts = [
        f"Best season: {dest['bestSeason']}",
        f"Suggested trip length: {dest['tripDays']}",
    ]
    fee = data.entry_fee(dest["id"])
    if fee:
        facts.append(f"Entry fee: {fee}")

    origin = tools.find_origin_hub(query)
    quote = tools.estimate_flight(
        dest["id"], origin,
        intents.dates.depart_iso if intents.dates else None,
        intents.dates.return_iso if intents.dates else None,
    )
    if quote:
        airlines = " / ".join(quote.airlines[:3])
        note = "" if origin else " (assuming New York — ask with 'from <city>' for better numbers)"
        facts.append(
            f"Flights (estimated): {quote.origin} ({quote.origin_code}) → {quote.destination_city} "
            f"({quote.destination_code}) ${quote.price_low_usd}–${quote.price_high_usd} round trip, "
            f"{_fmt_range(quote.depart_date, quote.return_date)} · {airlines}{note}"
        )

    if intents.dates:
        fc = await tools.forecast(dest["lat"], dest["lng"], intents.dates.depart_iso, intents.dates.return_iso)
        if fc:
            lows = min(d["minC"] for d in fc)
            highs = max(d["maxC"] for d in fc)
            wet = sum(1 for d in fc if d["precipChancePct"] >= 45)
            facts.append(f"Forecast for the dates: {round(lows)}–{round(highs)}°C, {wet}/{len(fc)} days with likely rain")
        else:
            facts.append("Dates are beyond the 16-day forecast — use the best season above")
    elif intents.wants_weather:
        w = await tools.current_weather(dest["lat"], dest["lng"])
        if w:
            facts.append(
                f"Right now: {round(w['temperatureC'])}°C, {w['description']} "
                f"({tools.local_time_at(dest['timezone'])} local)"
            )

    stays = tools.format_stays(dest["id"])
    if stays:
        facts.append(f"Stays: {stays}")
    if intents.wants_visa or intents.direct_question:
        facts.append(f"Visa: {dest['visa']}")
    if intents.wants_safety:
        facts.append(f"Safety: {dest['safety']}")
    if intents.wants_food:
        facts.append(f"Food to try: {', '.join(dest['food'][:4])}")
    return facts


def _compose(dest: dict[str, Any], picks: list[dict[str, Any]], facts: list[str], intents: Intents) -> str:
    """Deterministic fallback text when no local LLM is running."""
    parts: list[str] = []
    if len(picks) > 1:
        parts.append(f"I found {len(picks)} places that fit — flying you to **{dest['name']}** first.")
        for p in picks:
            hits = [t for t in p["tags"] if t in intents.tags][:3]
            reason = f" — a match on {', '.join(hits)}" if hits else ""
            parts.append(f"**{p['name']}**, {p['country']} — {p['tagline'].lower()}{reason}. Best time: {p['bestSeason']}.")
    else:
        parts.append(f"**{dest['name']}**, {dest['country']} — {dest['tagline'].lower()}.")
    parts.append(f"— Trip snapshot for **{dest['name']}** —")
    parts.extend(facts)
    parts.append("The matching pins are glowing on the globe — ask for an itinerary, exact dates, or a different departure city.")
    return "\n\n".join(parts)


def _llm_system_prompt(picks: list[dict[str, Any]], chunks: list, facts: list[str], world_knowledge: bool) -> str:
    context = "\n\n".join(f"[{i + 1}] {c.title}\n{c.text[:900]}" for i, c in enumerate(chunks))
    pick_names = ", ".join(f"**{p['name']}** ({p['country']})" for p in picks)
    if world_knowledge:
        # Claude: strong factual recall — generative answers allowed, grounded first.
        rules = """GROUNDING RULES:
- Prefer the retrieved context and live facts below — they are authoritative for the 19 catalog destinations, prices, weather and stays.
- For places or questions the context doesn't cover (e.g. regional spots near a city), answer from your own knowledge of REAL places. Never fabricate a place, road, price or hotel — if you're not certain something exists, say so.
- Quote live prices/weather only from the facts below; for anything else money-related, give rough ranges and say they're approximate.
- If the request is about a region outside the catalog, still answer helpfully, and mention which catalog destination the globe flew to as the nearest themed match."""
    else:
        # Small local model: hallucinates without a hard leash.
        rules = "STRICT RULES: Use ONLY the retrieved context and live facts below. Never invent prices, dates, hotels or weather. If something isn't in the facts, say you don't have it."
    return f"""You are the Earth Odyssey Travel Copilot — a warm, precise travel expert beside a 3D globe. Answer in under 150 words. Bold destination names with **double asterisks**.

{rules}

Recommended destinations for this request (the globe is already highlighting them): {pick_names}

Live facts for the top pick:
{chr(10).join('- ' + f for f in facts)}

Retrieved context:
{context}"""


async def run_copilot(messages: list[dict[str, str]], context: dict[str, Any] | None = None) -> AsyncGenerator[Event, None]:
    context = context or {}
    query = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")
    intents = supervisor.analyze_intents(query)
    experts = supervisor.select_experts(intents)

    use_claude = llm.claude_available()
    use_ollama = (not use_claude) and await llm.is_available()
    if use_claude:
        engine = f"python-rag/{llm.claude_model()}"
    elif use_ollama:
        engine = f"python-rag/{llm.OLLAMA_MODEL}"
    else:
        engine = "python-rag/composer"
    yield {"type": "meta", "engine": engine, "experts": experts}

    # ---- Retrieval (history-aware) ------------------------------------------
    chunks, _ = retriever.retrieve(retriever.condense_query(messages), 5)
    retrieved_ids = list({c.destination_id for c in chunks if c.destination_id})

    # ---- Pick destinations ---------------------------------------------------
    subject_id = (intents.mentioned_dest_ids[0] if intents.mentioned_dest_ids else None) \
        or _referenced_dest_id(messages) or context.get("focusedDestinationId")
    discovery = bool(re.search(r"\b(show|find|recommend|suggest|places|destinations|ideas|where (should|can) i go)\b", query.lower()))
    specific = (intents.wants_best_time or intents.wants_entry_fee or intents.wants_flights
                or intents.wants_stays or intents.wants_visa)
    subject = data.destination_by_id(subject_id) if subject_id else None

    if subject and not discovery and (intents.direct_question or specific):
        picks = [subject]
    else:
        pick_ids = supervisor.score_destinations(intents, retrieved_ids)[:4] or retrieved_ids[:3]
        picks = [d for d in (data.destination_by_id(i) for i in pick_ids) if d] or data.destinations()[:3]

    top = picks[0]

    # ---- Drive the globe before the prose lands ------------------------------
    actions: list[dict[str, Any]] = [
        {"kind": "highlight", "destinationIds": [p["id"] for p in picks]},
        {"kind": "flyTo", "destinationId": top["id"]},
    ]
    if intents.wants_aurora:
        actions.append({"kind": "aurora", "active": True})
    yield {"type": "actions", "actions": actions}

    # ---- Live facts + generation ---------------------------------------------
    facts = await _gather_facts(top, intents, query)

    if use_claude or use_ollama:
        system = _llm_system_prompt(picks, chunks, facts, world_knowledge=use_claude)
        history = [{"role": m["role"], "content": m["content"]} for m in messages][-8:]
        try:
            generator = llm.stream_claude(system, history) if use_claude else llm.stream_chat(system, history)
            async for token in generator:
                yield {"type": "delta", "text": token}
        except Exception:  # noqa: BLE001 — fall back mid-flight if the LLM dies
            yield {"type": "delta", "text": "\n\n" + _compose(top, picks, facts, intents)}
    else:
        yield {"type": "delta", "text": _compose(top, picks, facts, intents)}

    yield {"type": "citations", "citations": [{"id": c.id, "title": c.title} for c in chunks[:4]]}
    yield {"type": "done"}
