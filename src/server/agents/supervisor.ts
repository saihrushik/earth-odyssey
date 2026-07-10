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
  | "flight-expert"
  | "hotel-expert"
  | "itinerary-generator";

export interface TravelDates {
  departISO: string;
  returnISO: string;
  explicit: boolean;
}

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
  wantsFlights: boolean;
  wantsStays: boolean;
  wantsBestTime: boolean;
  wantsEntryFee: boolean;
  /** A question about one specific place rather than a discovery request. */
  directQuestion: boolean;
  dates?: TravelDates;
}

const MONTHS = ["january","february","march","april","may","june","july","august","september","october","november","december"];

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Parse travel dates: "Dec 10-20", "in march", "next week", "2026-08-01". */
export function parseTravelDates(q: string, tripDays = 7): TravelDates | undefined {
  const now = new Date();

  const isoRange = q.match(/(\d{4}-\d{2}-\d{2})(?:\s*(?:to|-|until|through)\s*(\d{4}-\d{2}-\d{2}))?/);
  if (isoRange) {
    const dep = new Date(isoRange[1]);
    const ret = isoRange[2] ? new Date(isoRange[2]) : new Date(dep.getTime() + tripDays * 86_400_000);
    return { departISO: iso(dep), returnISO: iso(ret), explicit: true };
  }

  const monthIdx = MONTHS.findIndex((m) => new RegExp(`\\b${m.slice(0, 3)}[a-z]*\\b`).test(q));
  if (monthIdx >= 0) {
    // "december 10-20" / "10 december" / bare month
    const dayRange = q.match(new RegExp(`${MONTHS[monthIdx].slice(0, 3)}[a-z]*\\s+(\\d{1,2})(?:\\s*[-–to]+\\s*(\\d{1,2}))?`)) ??
      q.match(new RegExp(`(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*[-–to]+\\s*(\\d{1,2})(?:st|nd|rd|th)?)?\\s+${MONTHS[monthIdx].slice(0, 3)}[a-z]*`));
    const year = monthIdx < now.getMonth() || (monthIdx === now.getMonth() && now.getDate() > 25) ? now.getFullYear() + 1 : now.getFullYear();
    const startDay = dayRange ? parseInt(dayRange[1], 10) : 10;
    const dep = new Date(Date.UTC(year, monthIdx, startDay));
    const endDay = dayRange?.[2] ? parseInt(dayRange[2], 10) : startDay + tripDays;
    const ret = new Date(Date.UTC(year, monthIdx + (endDay < startDay ? 1 : 0), endDay));
    return { departISO: iso(dep), returnISO: iso(ret), explicit: !!dayRange };
  }

  if (/\bnext week\b/.test(q)) {
    const dep = new Date(now.getTime() + 7 * 86_400_000);
    return { departISO: iso(dep), returnISO: iso(new Date(dep.getTime() + tripDays * 86_400_000)), explicit: true };
  }
  if (/\bnext month\b/.test(q)) {
    const dep = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 10));
    return { departISO: iso(dep), returnISO: iso(new Date(dep.getTime() + tripDays * 86_400_000)), explicit: true };
  }
  if (/\b(this weekend|tomorrow)\b/.test(q)) {
    const dep = new Date(now.getTime() + (q.includes("tomorrow") ? 1 : 5 - now.getDay()) * 86_400_000);
    return { departISO: iso(dep), returnISO: iso(new Date(dep.getTime() + 3 * 86_400_000)), explicit: true };
  }
  return undefined;
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
  [/\bsunsets?\b|golden hour/, "sunset"],
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

  const wantsFlights = /\bflights?|fly|airfare|plane|airlines?\b/.test(q) || /\bticket (price|cost)s?\b.*\b(fly|flight|plane)\b/.test(q);
  const wantsEntryFee = /\b(entry|entrance|admission)\s*(fee|price|cost|ticket)|how much (is|does).*(entry|ticket|cost to (enter|visit))|ticket price/.test(q) && !wantsFlights;
  const wantsBestTime = /\bbest (time|season|month)\b|\bwhen (should|to|is the best)\b/.test(q);
  const wantsStays = /\bhotels?|stays?|hostels?|resorts?|accommodation|airbnb|where (to|should i) (stay|sleep)\b/.test(q);

  const discovery = /\b(show|find|recommend|suggest|places|destinations|where (should|can) i go|ideas)\b/.test(q);
  const directQuestion = mentionedDestIds.length > 0 && !discovery &&
    (wantsBestTime || wantsEntryFee || wantsFlights || wantsStays || /\bvisas?|safe|weather|food|how much|cost/.test(q));

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
    wantsFlights,
    wantsStays,
    wantsBestTime,
    wantsEntryFee,
    directQuestion,
    dates: parseTravelDates(q, days ?? 7),
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
  if (intents.wantsFlights || intents.dates) experts.push("flight-expert");
  if (intents.wantsStays) experts.push("hotel-expert");
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
