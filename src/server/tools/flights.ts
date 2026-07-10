import { destinationById } from "@/features/odyssey/data/destinations";
import { GATEWAY_AIRPORTS, ORIGIN_HUBS, REGIONAL_AIRLINES, type OriginHub } from "@/features/odyssey/data/travel";
import { haversineKm } from "@/features/odyssey/lib/geo";

/**
 * Flight pricing.
 *
 * With AMADEUS_CLIENT_ID / AMADEUS_CLIENT_SECRET configured, quotes come live
 * from the Amadeus Flight Offers API. Without keys, a transparent estimator
 * prices the route from great-circle distance and seasonality — always
 * labelled as an estimate, never passed off as live data.
 */

export interface FlightQuote {
  origin: string;
  originCode: string;
  destinationCity: string;
  destinationCode: string;
  priceLowUSD: number;
  priceHighUSD: number;
  airlines: string[];
  departDate?: string;
  returnDate?: string;
  live: boolean;
}

export function findOriginHub(query: string): OriginHub | null {
  const q = ` ${query.toLowerCase()} `;
  const m = q.match(/\bfrom\s+([a-z\s]+?)(?:[.,?!]|$| to | in | on )/);
  const needle = m?.[1]?.trim();
  if (!needle) return null;
  return (
    ORIGIN_HUBS.find((h) => h.aliases.some((a) => needle.includes(a.trim()) || a.trim().includes(needle))) ?? null
  );
}

const DEFAULT_ORIGIN = ORIGIN_HUBS[0]; // New York

function seasonFactor(month: number): number {
  // Global demand curve: northern summer + year-end holidays peak.
  if (month === 11 || month === 6 || month === 7) return 1.25;
  if (month === 5 || month === 8) return 1.12;
  if (month === 0 || month === 1) return 0.88;
  return 1.0;
}

export function estimateFlight(
  destId: string,
  origin: OriginHub | null,
  departDate?: string,
  returnDate?: string,
): FlightQuote | null {
  const dest = destinationById(destId);
  const gateway = GATEWAY_AIRPORTS[destId];
  if (!dest || !gateway) return null;
  const hub = origin ?? DEFAULT_ORIGIN;

  const km = haversineKm(hub.lat, hub.lng, dest.lat, dest.lng);
  let base = 90 + km * 0.075; // economy round-trip heuristic
  base = Math.max(140, Math.min(base, 2100));

  const month = departDate ? new Date(departDate).getMonth() : new Date().getMonth();
  base *= seasonFactor(month);
  // Remote leisure islands carry a premium (limited lift).
  if (destId === "bora-bora" || destId === "maldives") base *= 1.2;

  return {
    origin: hub.city,
    originCode: hub.code,
    destinationCity: gateway.city,
    destinationCode: gateway.code,
    priceLowUSD: Math.round((base * 0.85) / 10) * 10,
    priceHighUSD: Math.round((base * 1.2) / 10) * 10,
    airlines: REGIONAL_AIRLINES[destId] ?? [],
    departDate,
    returnDate,
    live: false,
  };
}

interface AmadeusToken {
  access_token: string;
  expires_at: number;
}
let amadeusToken: AmadeusToken | null = null;

async function getAmadeusToken(id: string, secret: string): Promise<string> {
  if (amadeusToken && amadeusToken.expires_at > Date.now() + 30_000) return amadeusToken.access_token;
  const res = await fetch("https://test.api.amadeus.com/v1/security/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: `grant_type=client_credentials&client_id=${encodeURIComponent(id)}&client_secret=${encodeURIComponent(secret)}`,
  });
  if (!res.ok) throw new Error(`amadeus auth failed: ${res.status}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  amadeusToken = { access_token: json.access_token, expires_at: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}

async function getLiveFlight(
  destId: string,
  origin: OriginHub,
  departDate: string,
  returnDate: string | undefined,
  clientId: string,
  clientSecret: string,
): Promise<FlightQuote | null> {
  const gateway = GATEWAY_AIRPORTS[destId];
  if (!gateway) return null;
  const token = await getAmadeusToken(clientId, clientSecret);
  const url = new URL("https://test.api.amadeus.com/v2/shopping/flight-offers");
  url.searchParams.set("originLocationCode", origin.code);
  url.searchParams.set("destinationLocationCode", gateway.code);
  url.searchParams.set("departureDate", departDate);
  if (returnDate) url.searchParams.set("returnDate", returnDate);
  url.searchParams.set("adults", "1");
  url.searchParams.set("currencyCode", "USD");
  url.searchParams.set("max", "10");
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`amadeus offers failed: ${res.status}`);
  const json = (await res.json()) as {
    data?: { price: { grandTotal: string }; validatingAirlineCodes?: string[] }[];
    dictionaries?: { carriers?: Record<string, string> };
  };
  const offers = json.data ?? [];
  if (offers.length === 0) return null;
  const prices = offers.map((o) => parseFloat(o.price.grandTotal)).sort((a, b) => a - b);
  const carriers = json.dictionaries?.carriers ?? {};
  const airlines = [
    ...new Set(offers.flatMap((o) => o.validatingAirlineCodes ?? []).map((c) => carriers[c] ?? c)),
  ].slice(0, 3);
  return {
    origin: origin.city,
    originCode: origin.code,
    destinationCity: gateway.city,
    destinationCode: gateway.code,
    priceLowUSD: Math.round(prices[0]),
    priceHighUSD: Math.round(prices[prices.length - 1]),
    airlines,
    departDate,
    returnDate,
    live: true,
  };
}

/** Live quote when keys + dates allow, estimator otherwise. Never throws. */
export async function getFlightQuote(
  destId: string,
  origin: OriginHub | null,
  departDate?: string,
  returnDate?: string,
): Promise<FlightQuote | null> {
  const id = process.env.AMADEUS_CLIENT_ID;
  const secret = process.env.AMADEUS_CLIENT_SECRET;
  if (id && secret && departDate) {
    try {
      const live = await getLiveFlight(destId, origin ?? DEFAULT_ORIGIN, departDate, returnDate, id, secret);
      if (live) return live;
    } catch {
      // fall through to the estimator
    }
  }
  return estimateFlight(destId, origin, departDate, returnDate);
}
