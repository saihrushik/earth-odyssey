import { DESTINATIONS } from "@/features/odyssey/data/destinations";

/**
 * The supervisor analyzes the user's request and decides which expert agents
 * participate in the answer. In LLM mode the selection shapes the system
 * prompt; in offline mode it drives the deterministic composer directly.
 */

export type ExpertId =
  | "destination-expert"
  | "budget-planner"
  | "weather-expert"
  | "visa-expert"
  | "safety-expert"
  | "food-expert"
  | "packing-expert"
  | "itinerary-generator";

export interface Intents {
  budgetUSD?: number;
  days?: number;
  tags: string[];
  mentionedDestIds: string[];
  similarToId?: string;
  wantsWeather: boolean;
  wantsAurora: boolean;
  wantsVisa: boolean;
  wantsSafety: boolean;
  wantsFood: boolean;
  wantsPacking: boolean;
}

const TAG_KEYWORDS: [RegExp, string][] = [
  [/\bhik\w*|trek\w*|trail\w*|walk\w*\b/, "hiking"],
  [/\bbeach\w*|island\w*|snorkel\w*|lagoon\b/, "beach"],
  [/\baurora|northern lights?\b/, "aurora"],
  [/\bromantic|honeymoon|couple\w*|anniversary\b/, "romantic"],
  [/\bluxur\w*|villa|five.star|5.star|high.end\b/, "luxury"],
  [/\bfood\w*|eat\w*|cuisine|culinary|restaurant\w*|street food\b/, "food"],
  [/\bkids?\b|\bchild\w*|famil\w*\b/, "family"],
  [/\bphotograph\w*|photo\w*|instagram\b/, "photography"],
  [/\banime|ghibli|manga\b/, "anime"],
  [/\bcrowds?\b|\bquiet|hidden|offbeat|off the beaten\b/, "crowdsfree"],
  [/\bhistor\w*|ancient|ruins?|temple\w*|monument\w*|castle\w*\b/, "history"],
  [/\badventur\w*|adrenaline|thrill\w*\b/, "adventure"],
  [/\bsnow|winter|ski\w*\b/, "winter"],
  [/\bdiv(e|ing)|scuba\b/, "diving"],
  [/\bwine\b/, "wine"],
  [/\bcheap\w*|budget|backpack\w*|affordable\b/, "budget-friendly"],
  [/\bwaterfall\w*|glacier\w*|volcano\w*|geyser\w*\b/, "nature"],
  [/\bballoon\w*\b/, "balloons"],
  [/\bdesert\b/, "desert"],
  [/\bstargaz\w*|dark sky\b/, "stargazing"],
  [/\brelax\w*|unwind|slow travel\b/, "relaxation"],
];

/** Tag aliases used when scoring destinations (dataset tags are richer than intents). */
const TAG_MATCHES: Record<string, string[]> = {
  history: ["history", "monument", "unesco", "architecture", "caves", "spiritual"],
  nature: ["nature", "waterfalls", "glaciers", "geothermal", "wildlife"],
  winter: ["winter", "arctic", "skiing", "aurora"],
  beach: ["beach", "snorkeling", "diving", "surf", "relaxation"],
  food: ["food", "wine", "cuisine"],
};

export function analyzeIntents(query: string): Intents {
  const q = query.toLowerCase();

  const tags: string[] = [];
  for (const [re, tag] of TAG_KEYWORDS) if (re.test(q) && !tags.includes(tag)) tags.push(tag);

  // "$2500", "2500 dollars", "budget of 2500"
  const budgetMatch =
    q.match(/\$\s?([\d,]{3,7})/) ?? q.match(/([\d,]{3,7})\s?(?:usd|dollars|bucks)/) ?? q.match(/budget (?:of |is )?([\d,]{3,7})/);
  const budgetUSD = budgetMatch ? parseInt(budgetMatch[1].replace(/,/g, ""), 10) : undefined;

  const daysMatch = q.match(/(\d{1,2})\s*(day|days|night|nights)/);
  const weeksMatch = q.match(/(\d{1,2})\s*(week|weeks)/);
  const days = daysMatch ? parseInt(daysMatch[1], 10) : weeksMatch ? parseInt(weeksMatch[1], 10) * 7 : undefined;

  const mentionedDestIds = DESTINATIONS.filter((d) => {
    const names = [d.name.toLowerCase(), ...d.name.toLowerCase().split("—").map((s) => s.trim())];
    return names.some((n) => n.length > 3 && q.includes(n)) || q.includes(d.country.toLowerCase());
  }).map((d) => d.id);

  let similarToId: string | undefined;
  const sim = q.match(/(?:similar to|like|instead of)\s+([a-z\s]+?)(?:[.,?!]|$)/);
  if (sim) {
    const needle = sim[1].trim();
    similarToId = DESTINATIONS.find(
      (d) => d.name.toLowerCase().includes(needle) || d.country.toLowerCase().includes(needle) || needle.includes(d.country.toLowerCase()),
    )?.id;
  }

  return {
    budgetUSD,
    days,
    tags,
    mentionedDestIds,
    similarToId,
    wantsWeather: /\bweather|temperature|cold|warm|hot|rain\w*|forecast\b/.test(q),
    wantsAurora: /\baurora|northern lights?\b/.test(q),
    wantsVisa: /\bvisas?\b|entry requirement/.test(q),
    wantsSafety: /\bsafe\w*|danger\w*\b/.test(q),
    wantsFood: /\bfood\w*|eat\w*|cuisine|restaurant\w*\b/.test(q),
    wantsPacking: /\bpack\w*|bring|gear|clothes\b/.test(q),
  };
}

export function selectExperts(intents: Intents): ExpertId[] {
  const experts: ExpertId[] = ["destination-expert"];
  if (intents.budgetUSD !== undefined || intents.tags.includes("budget-friendly")) experts.push("budget-planner");
  if (intents.wantsWeather || intents.wantsAurora) experts.push("weather-expert");
  if (intents.wantsVisa) experts.push("visa-expert");
  if (intents.wantsSafety) experts.push("safety-expert");
  if (intents.wantsFood) experts.push("food-expert");
  if (intents.wantsPacking) experts.push("packing-expert");
  if (intents.days !== undefined) experts.push("itinerary-generator");
  return experts;
}

/** Rank destinations against the extracted intents (plus retrieval hits). */
export function scoreDestinations(intents: Intents, retrievedDestIds: string[]): string[] {
  const wantTags = new Set(intents.tags);
  if (intents.similarToId) {
    const src = DESTINATIONS.find((d) => d.id === intents.similarToId);
    src?.tags.forEach((t) => wantTags.add(t));
  }

  const dailySpend =
    intents.budgetUSD !== undefined && intents.days ? intents.budgetUSD / intents.days : undefined;

  const scored = DESTINATIONS.map((d) => {
    let score = 0;
    for (const t of wantTags) {
      const aliases = TAG_MATCHES[t] ?? [t];
      if (d.tags.some((dt) => aliases.includes(dt))) score += 2;
      if (d.chapters.some((c) => (aliases as string[]).includes(c))) score += 1;
    }
    if (intents.mentionedDestIds.includes(d.id)) score += 10;
    if (retrievedDestIds.includes(d.id)) score += 1.5;
    if (d.id === intents.similarToId) score -= 8; // "similar to X" should not answer with X
    if (dailySpend !== undefined) {
      if (dailySpend >= d.budgetPerDay.midrange) score += 1;
      else if (dailySpend < d.budgetPerDay.backpacker) score -= 3;
    } else if (intents.budgetUSD !== undefined && intents.budgetUSD <= 3000) {
      if (d.budgetPerDay.midrange <= 100) score += 1.5;
      if (d.budgetPerDay.midrange >= 250) score -= 2;
    }
    return { id: d.id, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.filter((s) => s.score > 0).map((s) => s.id);
}
