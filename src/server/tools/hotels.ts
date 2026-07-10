import { STAYS, type Stay } from "@/features/odyssey/data/travel";
import { destinationById } from "@/features/odyssey/data/destinations";

/**
 * Stay recommendations: a curated shortlist per destination (real properties,
 * indicative nightly rates). When GOOGLE_MAPS_API_KEY is configured, results
 * are enriched with live Google Places ratings.
 */

export interface StayResult extends Stay {
  rating?: number;
  live: boolean;
}

async function enrichWithGooglePlaces(destId: string, stays: Stay[], apiKey: string): Promise<StayResult[]> {
  const dest = destinationById(destId);
  const out: StayResult[] = [];
  for (const stay of stays) {
    try {
      const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "places.rating",
        },
        body: JSON.stringify({ textQuery: `${stay.name} ${dest?.region ?? ""}`, maxResultCount: 1 }),
      });
      const json = res.ok ? ((await res.json()) as { places?: { rating?: number }[] }) : null;
      out.push({ ...stay, rating: json?.places?.[0]?.rating, live: true });
    } catch {
      out.push({ ...stay, live: false });
    }
  }
  return out;
}

export async function getStays(destId: string): Promise<StayResult[]> {
  const stays = STAYS[destId] ?? [];
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (key && stays.length) {
    try {
      return await enrichWithGooglePlaces(destId, stays, key);
    } catch {
      // fall through
    }
  }
  return stays.map((s) => ({ ...s, live: false }));
}

export function formatStays(stays: StayResult[]): string {
  return stays
    .map(
      (s) =>
        `${s.name} (${s.tier}, ~$${s.pricePerNight}/night${s.rating ? `, ★${s.rating}` : ""}${s.note ? ` — ${s.note}` : ""})`,
    )
    .join(" · ");
}
