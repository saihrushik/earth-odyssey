import Anthropic from "@anthropic-ai/sdk";
import { DESTINATIONS, destinationById } from "@/features/odyssey/data/destinations";
import { ENTRY_FEES } from "@/features/odyssey/data/travel";
import type { Destination } from "@/features/odyssey/data/types";
import { condenseQuery, retrieve } from "../rag/retriever";
import { getCurrentWeather, getForecast } from "../tools/weather";
import { getFlightQuote, findOriginHub } from "../tools/flights";
import { getStays, formatStays } from "../tools/hotels";
import { analyzeIntents, scoreDestinations, selectExperts, type Intents } from "../agents/supervisor";
import type { CopilotContext } from "./offline";
import type { ChatMessage, CopilotEvent, GlobeAction } from "./protocol";

/**
 * Claude copilot engine — retrieve-then-generate, serverless-friendly.
 * Same flow as the Python backend: intents → retrieval → globe actions →
 * live facts → Claude streams the grounded answer. Runs wherever the
 * Next.js app runs (Vercel included) with just ANTHROPIC_API_KEY set.
 */

const claudeModel = () => process.env.CLAUDE_MODEL ?? "claude-opus-4-8";

export const claudeAvailable = () => Boolean(process.env.ANTHROPIC_API_KEY);

const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T | null> =>
  Promise.race([p, new Promise<null>((res) => setTimeout(() => res(null), ms))]).catch(() => null);

/** Live + structured facts for the top pick, as labelled lines. */
async function gatherFacts(dest: Destination, intents: Intents, query: string): Promise<string[]> {
  const facts = [`Best season: ${dest.bestSeason}`, `Suggested trip length: ${dest.tripDays}`];
  if (ENTRY_FEES[dest.id]) facts.push(`Entry fee: ${ENTRY_FEES[dest.id]}`);

  const origin = findOriginHub(query);
  const [quote, stays] = await Promise.all([
    withTimeout(getFlightQuote(dest.id, origin, intents.dates?.departISO, intents.dates?.returnISO), 5000),
    withTimeout(getStays(dest.id), 4000),
  ]);
  if (quote) {
    const note = origin ? "" : " (assuming New York — ask with 'from <city>' for better numbers)";
    facts.push(
      `Flights (${quote.live ? "live" : "estimated"}): ${quote.origin} (${quote.originCode}) → ${quote.destinationCity} (${quote.destinationCode}) $${quote.priceLowUSD}–$${quote.priceHighUSD} round trip · ${quote.airlines.slice(0, 3).join(" / ")}${note}`,
    );
  }
  if (intents.dates) {
    const fc = await withTimeout(getForecast(dest.lat, dest.lng, intents.dates.departISO, intents.dates.returnISO), 4000);
    if (fc && fc.length) {
      const lows = Math.min(...fc.map((d) => d.minC));
      const highs = Math.max(...fc.map((d) => d.maxC));
      const wet = fc.filter((d) => d.precipChancePct >= 45).length;
      facts.push(`Forecast for the dates: ${Math.round(lows)}–${Math.round(highs)}°C, ${wet}/${fc.length} days with likely rain`);
    } else {
      facts.push("Dates are beyond the 16-day forecast — use the best season above");
    }
  } else if (intents.wantsWeather) {
    const w = await withTimeout(getCurrentWeather(dest.lat, dest.lng), 3000);
    if (w) facts.push(`Right now: ${Math.round(w.temperatureC)}°C, ${w.description}`);
  }
  if (stays && stays.length) facts.push(`Stays: ${formatStays(stays)}`);
  if (intents.wantsVisa) facts.push(`Visa: ${dest.visa}`);
  if (intents.wantsSafety) facts.push(`Safety: ${dest.safety}`);
  if (intents.wantsFood) facts.push(`Food to try: ${dest.food.slice(0, 4).join(", ")}`);
  return facts;
}

/** Destination the conversation is already about — parsed from the last assistant reply. */
function referencedDestId(messages: ChatMessage[]): string | undefined {
  const lastAssistant = messages.filter((m) => m.role === "assistant").at(-1)?.content ?? "";
  for (const m of lastAssistant.matchAll(/\*\*([^*]+)\*\*/g)) {
    const name = m[1].toLowerCase();
    const hit = DESTINATIONS.find(
      (d) => name.includes(d.name.toLowerCase()) || d.name.toLowerCase().includes(name),
    );
    if (hit) return hit.id;
  }
  return undefined;
}

function systemPrompt(picks: Destination[], chunks: { doc: { title: string; text: string } }[], facts: string[], focusNote: string): string {
  const context = chunks.map((c, i) => `[${i + 1}] ${c.doc.title}\n${c.doc.text.slice(0, 900)}`).join("\n\n");
  const pickNames = picks.map((p) => `**${p.name}** (${p.country})`).join(", ");
  return `You are the Earth Odyssey Travel Copilot — a warm, precise travel expert beside a 3D globe. Answer in under 150 words. Bold destination names with **double asterisks**. No markdown headings — plain paragraphs and "- " bullets only.

GROUNDING RULES:
- Prefer the retrieved context and live facts below — they are authoritative for the 19 catalog destinations, prices, weather and stays.
- For places or questions the context doesn't cover, answer from your own knowledge of REAL places. Never fabricate a place, road, price or hotel — if you're not certain something exists, say so.
- Quote live prices/weather only from the facts below; for anything else money-related, give rough ranges and say they're approximate.
- If the request is about something outside the catalog, still answer helpfully, and mention which catalog destination the globe flew to as the nearest themed match.

Recommended destinations for this request (the globe is already highlighting them): ${pickNames}

Live facts for the top pick:
${facts.map((f) => `- ${f}`).join("\n")}

Retrieved context:
${context}${focusNote}`;
}

export async function* runClaudeCopilot(
  messages: ChatMessage[],
  context: CopilotContext = {},
): AsyncGenerator<CopilotEvent> {
  const query = messages.filter((m) => m.role === "user").at(-1)?.content ?? "";
  const intents = analyzeIntents(query);
  yield { type: "meta", engine: `claude/${claudeModel()}`, experts: selectExperts(intents) };

  const { docs } = await retrieve(condenseQuery(messages), 5);
  const retrievedIds = [...new Set(docs.map((d) => d.doc.destinationId).filter((x): x is string => !!x))];

  // Pick destinations: direct subject if the conversation has one, else score.
  const subjectId = intents.mentionedDestIds[0] ?? referencedDestId(messages) ?? context.focusedDestinationId;
  const subject = subjectId ? destinationById(subjectId) : undefined;
  const discovery = /\b(show|find|recommend|suggest|places|destinations|ideas|where (should|can) i go)\b/.test(query.toLowerCase());
  const specific =
    intents.wantsBestTime || intents.wantsEntryFee || intents.wantsFlights || intents.wantsStays || intents.wantsVisa;

  let picks: Destination[];
  if (subject && !discovery && (intents.directQuestion || specific)) {
    picks = [subject];
  } else {
    const ids = scoreDestinations(intents, retrievedIds).slice(0, 4);
    picks = (ids.length ? ids : retrievedIds.slice(0, 3))
      .map((id) => destinationById(id))
      .filter((d): d is Destination => !!d);
    if (picks.length === 0) picks = DESTINATIONS.slice(0, 3);
  }
  const top = picks[0];

  const actions: GlobeAction[] = [
    { kind: "highlight", destinationIds: picks.map((p) => p.id) },
    { kind: "flyTo", destinationId: top.id },
  ];
  if (intents.wantsAurora) actions.push({ kind: "aurora", active: true });
  yield { type: "actions", actions };

  const facts = await gatherFacts(top, intents, query);
  const focusNote = context.focusedDestinationId
    ? `\n\nThe user is currently looking at "${context.focusedDestinationId}" on the globe — unqualified questions refer to it.`
    : "";

  const client = new Anthropic();
  const stream = client.messages.stream({
    model: claudeModel(),
    max_tokens: 2048,
    thinking: { type: "adaptive" },
    output_config: { effort: "low" },
    system: systemPrompt(picks, docs, facts, focusNote),
    messages: messages.slice(-8).map((m) => ({ role: m.role, content: m.content })),
  });
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield { type: "delta", text: event.delta.text };
    }
  }

  yield {
    type: "citations",
    citations: docs.slice(0, 4).map((d) => ({ id: d.doc.id, title: d.doc.title })),
  };
  yield { type: "done" };
}
