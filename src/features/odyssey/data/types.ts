export type ChapterId =
  | "wonders"
  | "nature"
  | "luxury"
  | "adventure"
  | "hidden"
  | "history"
  | "festivals"
  | "food";

export interface Chapter {
  id: ChapterId;
  index: number;
  title: string;
  subtitle: string;
  /** Accent used for hotspots, particles and UI while the chapter is active. */
  accent: string;
  /** Space fog / skybox tint while the chapter is active. */
  spaceTint: string;
  /** Camera distance from globe center while browsing this chapter. */
  cameraDistance: number;
}

export interface BudgetPerDayUSD {
  backpacker: number;
  midrange: number;
  luxury: number;
}

export interface Destination {
  id: string;
  name: string;
  country: string;
  region: string;
  tagline: string;
  lat: number;
  lng: number;
  chapters: ChapterId[];
  unesco: boolean;
  bestSeason: string;
  budgetPerDay: BudgetPerDayUSD;
  visa: string;
  language: string;
  currency: string;
  currencyName: string;
  safety: string;
  history: string;
  facts: string[];
  attractions: string[];
  food: string[];
  transport: string;
  hiddenGems: string[];
  nearby: string[];
  tripDays: string;
  /** Free-form matching tags used by search, RAG and the copilot (e.g. hiking, aurora, romantic). */
  tags: string[];
  timezone: string;
  /** True for destinations not surfaced in chapter navigation until discovered. */
  hidden?: boolean;
}
