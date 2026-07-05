import { destinationById } from "@/features/odyssey/data/destinations";
import { haversineKm } from "@/features/odyssey/lib/geo";

/** Current local time at an IANA timezone, formatted for prose. */
export function localTimeAt(timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date());
}

/** Great-circle distance between two known destinations, in km. */
export function distanceBetween(destA: string, destB: string): number | null {
  const a = destinationById(destA);
  const b = destinationById(destB);
  if (!a || !b) return null;
  return Math.round(haversineKm(a.lat, a.lng, b.lat, b.lng));
}
