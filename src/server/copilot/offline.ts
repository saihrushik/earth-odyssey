import { DESTINATIONS, destinationById } from "@/features/odyssey/data/destinations";
import { ENTRY_FEES } from "@/features/odyssey/data/travel";
import type { Destination } from "@/features/odyssey/data/types";
import { retrieve } from "../rag/retriever";
import { getCurrentWeather, getForecast, type DailyForecast } from "../tools/weather";
import { getFlightQuote, findOriginHub, type FlightQuote } from "../tools/flights";
import { getStays, formatStays } from "../tools/hotels";
import { localTimeAt } from "../tools/geoTools";
import { analyzeIntents, scoreDestinations, selectExperts, type Intents } from "../agents/supervisor";
import type { ChatMessage, CopilotEvent, GlobeAction } from "./protocol";

/**
 * Deterministic copilot engine — used when no OPENAI_API_KEY is configured.
 * Runs the same RAG retrieval and live tools as the LLM path, then composes
 * the answer from the supervisor's intent analysis instead of a model.
 */

export interface CopilotContext {
  focusedDestinationId?: string;
}

const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T | null> =>
  Promise.race([p, new Promise<null>((res) => setTimeout(() => res(null), ms))]).catch(() => null);

function fmtDateRange(departISO?: string, returnISO?: string): string {
  if (!departISO) return "flexible dates";
  const fmt = (isoStr: string) =>
    new Date(isoStr + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return returnISO ? `${fmt(departISO)} – ${fmt(returnISO)}` : fmt(departISO);
}

function flightLine(q: FlightQuote): string {
  const label = q.live ? "live quotes" : "estimated";
  const airlines = q.airlines.length ? ` · ${q.airlines.slice(0, 3).join(" / ")}` : "";
  return `✈ Flights ${q.origin} (${q.originCode}) → ${q.destinationCity} (${q.destinationCode}): $${q.priceLowUSD}–$${q.priceHighUSD} round trip (${label}, ${fmtDateRange(q.departDate, q.returnDate)})${airlines}`;
}

function forecastLine(dest: Destination, fc: DailyForecast[] | null, intents: Intents): string {
  if (fc && fc.length) {
    const maxs = fc.map((d) => d.maxC);
    const mins = fc.map((d) => d.minC);
    const wet = fc.filter((d) => d.precipChancePct >= 45).length;
    const rain = wet === 0 ? "little rain expected" : `${wet}/${fc.length} days with likely rain`;
    return `☀ Forecast for your dates: ${Math.round(Math.min(...mins))}–${Math.round(Math.max(...maxs))}°C, mostly ${fc[Math.floor(fc.length / 2)].description}, ${rain}.`;
  }
  if (intents.dates) {
    return `☀ Your dates are beyond the 16-day forecast window — seasonally, plan around: ${dest.bestSeason}.`;
  }
  return `☀ Best season: ${dest.bestSeason}.`;
}

/** Full trip block (flights + weather + stays) for a recommendation. */
async function tripBlock(dest: Destination, intents: Intents, originQuery: string): Promise<string[]> {
  const origin = findOriginHub(originQuery);
  const [flight, stays, forecast] = await Promise.all([
    withTimeout(getFlightQuote(dest.id, origin, intents.dates?.departISO, intents.dates?.returnISO), 5000),
    withTimeout(getStays(dest.id), 4000),
    intents.dates
      ? withTimeout(getForecast(dest.lat, dest.lng, intents.dates.departISO, intents.dates.returnISO), 4000)
      : Promise.resolve(null),
  ]);

  const lines: string[] = [];
  if (flight) {
    lines.push(flightLine(flight) + (origin ? "" : " — assuming New York; tell me your departure city for better numbers"));
  }
  lines.push(forecastLine(dest, forecast, intents));
  if (stays && stays.length) lines.push(`🏨 Stays: ${formatStays(stays)}`);
  return lines;
}

/** Direct answer about one specific destination — no discovery list. */
async function answerDirectQuestion(dest: Destination, intents: Intents, query: string): Promise<string> {
  const parts: string[] = [];

  if (intents.wantsBestTime) {
    parts.push(`Best time for **${dest.name}**: ${dest.bestSeason}. Suggested length: ${dest.tripDays}.`);
  }
  if (intents.wantsEntryFee && ENTRY_FEES[dest.id]) {
    parts.push(`🎟 Entry: ${ENTRY_FEES[dest.id]}.`);
  }
  if (intents.wantsFlights || (intents.dates && !intents.wantsBestTime)) {
    const origin = findOriginHub(query);
    const flight = await withTimeout(
      getFlightQuote(dest.id, origin, intents.dates?.departISO, intents.dates?.returnISO),
      5000,
    );
    if (flight)
      parts.push(flightLine(flight) + (origin ? "" : " — assuming New York; tell me your departure city for better numbers"));
  }
  if (intents.wantsStays) {
    const stays = await withTimeout(getStays(dest.id), 4000);
    if (stays?.length) parts.push(`🏨 Stays in ${dest.name}: ${formatStays(stays)}`);
  }
  if (intents.wantsVisa) parts.push(`🛂 Visa: ${dest.visa}`);
  if (intents.wantsSafety) parts.push(`🛡 Safety: ${dest.safety}`);
  if (intents.wantsFood) parts.push(`🍜 Eat: ${dest.food.slice(0, 4).join(", ")}.`);
  if (intents.wantsWeather) {
    const fc = intents.dates
      ? await withTimeout(getForecast(dest.lat, dest.lng, intents.dates.departISO, intents.dates.returnISO), 4000)
      : null;
    if (fc) {
      parts.push(forecastLine(dest, fc, intents));
    } else {
      const w = await withTimeout(getCurrentWeather(dest.lat, dest.lng), 3000);
      if (w)
        parts.push(
          `☀ Right now: ${Math.round(w.temperatureC)}°C, ${w.description} (${localTimeAt(dest.timezone)} local). ${forecastLine(dest, null, intents)}`,
        );
      else parts.push(forecastLine(dest, null, intents));
    }
  }
  if (parts.length === 0) {
    parts.push(
      `**${dest.name}** — ${dest.tagline}. Best time: ${dest.bestSeason}.${ENTRY_FEES[dest.id] ? ` 🎟 Entry: ${ENTRY_FEES[dest.id]}.` : ""} Ask me about flights, stays, visas or weather.`,
    );
  }
  return parts.join("\n\n");
}

function reasonFor(dest: Destination, intents: Intents): string {
  const wanted = new Set(intents.tags);
  const hits = dest.tags.filter((t) => wanted.has(t)).slice(0, 3);
  if (hits.length) return `${dest.tagline.toLowerCase()} — a match on ${hits.join(", ")}`;
  return dest.tagline.toLowerCase();
}

function budgetLine(dest: Destination, intents: Intents): string | null {
  if (intents.budgetUSD === undefined) return null;
  const days = intents.days ?? 7;
  const daily = Math.round(intents.budgetUSD / days);
  const tier =
    daily >= dest.budgetPerDay.luxury
      ? "luxury"
      : daily >= dest.budgetPerDay.midrange
        ? "comfortable mid-range"
        : daily >= dest.budgetPerDay.backpacker
          ? "backpacker-style"
          : null;
  if (!tier)
    return `Heads up: $${intents.budgetUSD} over ${days} days (~$${daily}/day) is below typical ${dest.name} costs — consider fewer days or a cheaper base.`;
  return `💰 Your $${intents.budgetUSD} over ${days} days is ~$${daily}/day — ${tier} territory in ${dest.name} (backpacker $${dest.budgetPerDay.backpacker} · mid $${dest.budgetPerDay.midrange} · luxury $${dest.budgetPerDay.luxury}).`;
}

async function* streamText(text: string): AsyncGenerator<CopilotEvent> {
  const chunks = text.match(/\S+\s*/g) ?? [text];
  for (let i = 0; i < chunks.length; i += 3) {
    yield { type: "delta", text: chunks.slice(i, i + 3).join("") };
    await new Promise((r) => setTimeout(r, 18));
  }
}

export async function* runOfflineCopilot(
  messages: ChatMessage[],
  context: CopilotContext = {},
): AsyncGenerator<CopilotEvent> {
  const query = messages.filter((m) => m.role === "user").at(-1)?.content ?? "";
  const intents = analyzeIntents(query);
  const experts = selectExperts(intents);

  yield { type: "meta", engine: "odyssey-offline", experts };

  // ---- Direct question about one place: answer it, don't re-list places. --
  const subjectId = intents.mentionedDestIds[0] ?? context.focusedDestinationId;
  const subject = subjectId ? destinationById(subjectId) : undefined;
  const discovery = /\b(show|find|recommend|suggest|places|destinations|ideas|where (should|can) i go)\b/.test(
    query.toLowerCase(),
  );
  const specificAsk =
    intents.wantsBestTime || intents.wantsEntryFee || intents.wantsFlights || intents.wantsStays || intents.wantsVisa;
  const isDirect = subject && !discovery && (intents.directQuestion || specificAsk);

  if (isDirect && subject) {
    yield {
      type: "actions",
      actions: [
        { kind: "flyTo", destinationId: subject.id },
        { kind: "highlight", destinationIds: [subject.id] },
      ],
    };
    yield* streamText(await answerDirectQuestion(subject, intents, query));
    yield { type: "done" };
    return;
  }

  // ---- Discovery: RAG retrieval + intent scoring. --------------------------
  const { docs } = await retrieve(query, 6);
  const retrievedDestIds = [...new Set(docs.map((d) => d.doc.destinationId).filter((x): x is string => !!x))];

  let picks = scoreDestinations(intents, retrievedDestIds).slice(0, 4);
  if (picks.length === 0) picks = retrievedDestIds.slice(0, 3);
  if (picks.length === 0) picks = DESTINATIONS.slice(0, 3).map((d) => d.id);

  const actions: GlobeAction[] = [
    { kind: "highlight", destinationIds: picks },
    { kind: "flyTo", destinationId: picks[0] },
  ];
  if (intents.wantsAurora) actions.push({ kind: "aurora", active: true });
  yield { type: "actions", actions };

  const top = destinationById(picks[0])!;
  const parts: string[] = [];

  parts.push(
    intents.wantsAurora
      ? `For aurora hunting, I'm taking you north — **${top.name}** is your best bet.`
      : picks.length > 1
        ? `I found ${picks.length} places that fit — flying you to **${top.name}** first.`
        : `One place stands out: **${top.name}**.`,
  );

  for (const id of picks.slice(0, 3)) {
    const d = destinationById(id)!;
    parts.push(`**${d.name}**, ${d.country} — ${reasonFor(d, intents)}. Best time: ${d.bestSeason}. Plan ${d.tripDays}.`);
  }

  const bl = budgetLine(top, intents);
  if (bl) parts.push(bl);

  // Trip snapshot (flights + weather + stays) for the headline pick.
  parts.push(`— Trip snapshot for **${top.name}** —`);
  parts.push(...(await tripBlock(top, intents, query)));

  if (intents.wantsVisa) parts.push(`🛂 Visa for ${top.name}: ${top.visa}`);
  if (intents.wantsPacking) {
    const packDoc = docs.find((d) => d.doc.id === "guide:packing");
    if (packDoc) parts.push(packDoc.doc.text.split(". ").slice(0, 2).join(". ") + ".");
  }

  parts.push(
    `The matching pins are glowing on the globe — click one, or ask for an itinerary, exact dates, or a different departure city.`,
  );

  yield* streamText(parts.join("\n\n"));
  yield { type: "citations", citations: docs.slice(0, 4).map((d) => ({ id: d.doc.id, title: d.doc.title })) };
  yield { type: "done" };
}
