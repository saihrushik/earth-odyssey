import { DESTINATIONS, destinationById } from "@/features/odyssey/data/destinations";
import { retrieve } from "../rag/retriever";
import { getCurrentWeather } from "../tools/weather";
import { localTimeAt } from "../tools/geoTools";
import { analyzeIntents, scoreDestinations, selectExperts, type Intents } from "../agents/supervisor";
import type { ChatMessage, CopilotEvent, GlobeAction } from "./protocol";

/**
 * Deterministic copilot engine — used when no OPENAI_API_KEY is configured.
 * Runs the same RAG retrieval and live tools as the LLM path, then composes
 * the answer from the supervisor's intent analysis instead of a model.
 */

const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T | null> =>
  Promise.race([p, new Promise<null>((res) => setTimeout(() => res(null), ms))]).catch(() => null);

function budgetLine(destId: string, intents: Intents): string | null {
  const d = destinationById(destId);
  if (!d || intents.budgetUSD === undefined) return null;
  const days = intents.days ?? 7;
  const daily = Math.round(intents.budgetUSD / days);
  const tier =
    daily >= d.budgetPerDay.luxury ? "luxury" : daily >= d.budgetPerDay.midrange ? "comfortable mid-range" : daily >= d.budgetPerDay.backpacker ? "backpacker-style" : null;
  if (!tier) return `Heads up: $${intents.budgetUSD} over ${days} days (~$${daily}/day) is below typical ${d.name} costs — consider fewer days or a cheaper base.`;
  return `Your $${intents.budgetUSD} over ${days} days is ~$${daily}/day — that's ${tier} territory in ${d.name} (backpacker $${d.budgetPerDay.backpacker} · mid $${d.budgetPerDay.midrange} · luxury $${d.budgetPerDay.luxury}).`;
}

function reasonFor(destId: string, intents: Intents): string {
  const d = destinationById(destId)!;
  const wanted = new Set(intents.tags);
  const hits = d.tags.filter((t) => wanted.has(t)).slice(0, 3);
  if (hits.length) return `${d.tagline.toLowerCase()} — a match on ${hits.join(", ")}`;
  return d.tagline.toLowerCase();
}

export async function* runOfflineCopilot(messages: ChatMessage[]): AsyncGenerator<CopilotEvent> {
  const query = messages.filter((m) => m.role === "user").at(-1)?.content ?? "";
  const intents = analyzeIntents(query);
  const experts = selectExperts(intents);

  yield { type: "meta", engine: "odyssey-offline", experts };

  // RAG retrieval feeds both ranking and citations.
  const { docs } = await retrieve(query, 6);
  const retrievedDestIds = [...new Set(docs.map((d) => d.doc.destinationId).filter((x): x is string => !!x))];

  let picks = scoreDestinations(intents, retrievedDestIds).slice(0, 4);
  if (picks.length === 0) picks = retrievedDestIds.slice(0, 3);
  if (picks.length === 0) picks = DESTINATIONS.slice(0, 3).map((d) => d.id);

  // Drive the globe before the prose lands — the world reacts first.
  const actions: GlobeAction[] = [{ kind: "highlight", destinationIds: picks }, { kind: "flyTo", destinationId: picks[0] }];
  if (intents.wantsAurora) actions.push({ kind: "aurora", active: true });
  yield { type: "actions", actions };

  const top = destinationById(picks[0])!;
  const parts: string[] = [];

  const openers: Record<string, string> = {
    aurora: `For aurora hunting, I'm taking you north — **${top.name}** is your best bet.`,
    default: picks.length > 1 ? `I found ${picks.length} places that fit — flying you to **${top.name}** first.` : `One place stands out: **${top.name}**.`,
  };
  parts.push(intents.wantsAurora ? openers.aurora : openers.default);

  for (const id of picks.slice(0, 3)) {
    const d = destinationById(id)!;
    parts.push(`**${d.name}**, ${d.country} — ${reasonFor(id, intents)}. Best time: ${d.bestSeason}. Plan ${d.tripDays}.`);
  }

  const bl = budgetLine(picks[0], intents);
  if (bl) parts.push(bl);

  if (intents.wantsVisa) parts.push(`Visa for ${top.name}: ${top.visa}`);
  if (intents.wantsSafety) parts.push(`Safety in ${top.name}: ${top.safety}`);
  if (intents.wantsFood) parts.push(`Eat this in ${top.name}: ${top.food.slice(0, 3).join(", ")}.`);
  if (intents.wantsPacking) {
    const packDoc = docs.find((d) => d.doc.id === "guide:packing");
    if (packDoc) parts.push(packDoc.doc.text.split(". ").slice(0, 2).join(". ") + ".");
  }

  // Live weather for the top pick — a real tool call, no key needed.
  const weather = await withTimeout(getCurrentWeather(top.lat, top.lng), 3000);
  if (weather) {
    parts.push(
      `Right now in ${top.name} it's ${Math.round(weather.temperatureC)}°C with ${weather.description} (${localTimeAt(top.timezone)} local).`,
    );
  }

  parts.push(`The matching pins are glowing on the globe — click one, or ask me to compare, budget, or build an itinerary.`);

  // Stream the composed answer in small chunks for the holographic feel.
  const text = parts.join("\n\n");
  const chunks = text.match(/\S+\s*/g) ?? [text];
  for (let i = 0; i < chunks.length; i += 3) {
    yield { type: "delta", text: chunks.slice(i, i + 3).join("") };
    await new Promise((r) => setTimeout(r, 24));
  }

  yield { type: "citations", citations: docs.slice(0, 4).map((d) => ({ id: d.doc.id, title: d.doc.title })) };
  yield { type: "done" };
}
