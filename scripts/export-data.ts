/**
 * Export the TypeScript travel dataset to JSON so the Python backend
 * (backend/) shares the exact same source of truth.
 *
 *   npx tsx scripts/export-data.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { DESTINATIONS } from "../src/features/odyssey/data/destinations";
import { CHAPTERS } from "../src/features/odyssey/data/chapters";
import {
  STAYS,
  ENTRY_FEES,
  GATEWAY_AIRPORTS,
  ORIGIN_HUBS,
  REGIONAL_AIRLINES,
} from "../src/features/odyssey/data/travel";

const out = {
  generatedAt: new Date().toISOString(),
  destinations: DESTINATIONS,
  chapters: CHAPTERS,
  stays: STAYS,
  entryFees: ENTRY_FEES,
  gatewayAirports: GATEWAY_AIRPORTS,
  originHubs: ORIGIN_HUBS,
  regionalAirlines: REGIONAL_AIRLINES,
};

const dest = path.join(__dirname, "..", "backend", "data", "travel-data.json");
mkdirSync(path.dirname(dest), { recursive: true });
writeFileSync(dest, JSON.stringify(out, null, 1));
console.log(`[export] wrote ${dest} (${DESTINATIONS.length} destinations)`);
