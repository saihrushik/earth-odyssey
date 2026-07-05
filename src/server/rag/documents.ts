import { DESTINATIONS } from "@/features/odyssey/data/destinations";

export interface KnowledgeDoc {
  id: string;
  title: string;
  /** Set when the doc describes one specific destination. */
  destinationId?: string;
  text: string;
  tags: string[];
}

/**
 * The knowledge base the copilot retrieves from.
 * Destination docs are derived from the canonical dataset (three facets each),
 * plus a set of general travel guides.
 */
export function buildKnowledgeBase(): KnowledgeDoc[] {
  const docs: KnowledgeDoc[] = [];

  for (const d of DESTINATIONS) {
    docs.push({
      id: `${d.id}:overview`,
      destinationId: d.id,
      title: `${d.name} — overview`,
      tags: d.tags,
      text: `${d.name} (${d.country}, ${d.region}). ${d.tagline}. ${d.history} Notable facts: ${d.facts.join(" ")} ${d.unesco ? "It is a UNESCO World Heritage site." : ""}`,
    });
    docs.push({
      id: `${d.id}:practical`,
      destinationId: d.id,
      title: `${d.name} — practical guide`,
      tags: [...d.tags, "visa", "budget", "season", "safety", "transport"],
      text: `Practical guide for ${d.name}, ${d.country}. Best season: ${d.bestSeason}. Daily budget in USD: backpacker $${d.budgetPerDay.backpacker}, mid-range $${d.budgetPerDay.midrange}, luxury $${d.budgetPerDay.luxury}. Suggested trip length: ${d.tripDays}. Visa: ${d.visa} Language: ${d.language}. Currency: ${d.currencyName} (${d.currency}). Safety: ${d.safety} Getting there and around: ${d.transport}`,
    });
    docs.push({
      id: `${d.id}:experience`,
      destinationId: d.id,
      title: `${d.name} — experiences, food and hidden gems`,
      tags: [...d.tags, "food", "attractions", "hidden gems"],
      text: `What to do in ${d.name}: ${d.attractions.join("; ")}. Local food to try: ${d.food.join("; ")}. Hidden gems: ${d.hiddenGems.join("; ")}. Nearby: ${d.nearby.join("; ")}. Travel styles it suits: ${d.tags.join(", ")}.`,
    });
  }

  docs.push(
    {
      id: "guide:aurora",
      title: "How to see the Northern Lights",
      tags: ["aurora", "winter", "photography", "arctic"],
      text: "Seeing the aurora borealis reliably means going above 65°N between September and late March, escaping light pollution, and staying at least 3–4 nights to ride out cloudy skies. The auroral oval favors Tromsø in Norway, Abisko in Sweden, Icelandic winters and Finnish Lapland. Watch the Kp-index and cloud cover rather than fixed schedules; peak displays often come in bursts around local midnight. For photography use a tripod, a fast wide lens, ISO 1600–3200 and 2–8 second exposures.",
    },
    {
      id: "guide:budget",
      title: "Budget travel strategy",
      tags: ["budget", "backpacking", "cheap"],
      text: "Stretching a travel budget: pick destinations where daily costs are low (Southeast Asia, India, Türkiye), travel in shoulder season, book flights 1–3 months out midweek, use local transport and street food, and mix dorms or guesthouses with the occasional private room. A $2,500 budget covers roughly 3 weeks in Bali or Cappadocia including flights, 2 weeks in Peru, or about 1 week in Switzerland or Norway. The Maldives works on a budget only via local-island guesthouses and public ferries.",
    },
    {
      id: "guide:luxury",
      title: "Luxury travel playbook",
      tags: ["luxury", "honeymoon", "romantic", "relaxation"],
      text: "For high-end trips, overwater villas in the Maldives and Bora Bora set the global benchmark; Santorini caldera suites, Swiss five-star alpine resorts and Venice palazzo hotels follow. Book 6–9 months ahead for peak season, use resort seaplane transfers, and favor half-board dining plans at remote resorts where restaurants are captive. Shoulder months (May, September–October) buy the same rooms at 30–40% less.",
    },
    {
      id: "guide:family",
      title: "Traveling with kids",
      tags: ["family", "kids"],
      text: "Family-friendly picks: Switzerland (trains, playground-grade hiking, safety), Banff and Yellowstone (wildlife, easy boardwalk trails), Kyoto (deer parks nearby, hands-on culture), and Grand Canyon rim walks. Keep driving legs under 3 hours, plan one anchor activity per day, and prefer apartments or family rooms. Altitude destinations like Machu Picchu need acclimatization days for children too.",
    },
    {
      id: "guide:photography",
      title: "Photography destinations and timing",
      tags: ["photography", "sunrise", "golden hour"],
      text: "Photographers chase light: Cappadocia's hundred-balloon dawns, Santorini's blue-hour domes, Kyoto's torii tunnels at first light, Iceland's midnight-sun waterfalls, aurora over Tromsø, and the Taj Mahal at sunrise from Mehtab Bagh. Arrive an hour before golden hour, scout the day prior, and shoot popular icons at opening time to avoid crowds.",
    },
    {
      id: "guide:packing",
      title: "Packing essentials by climate",
      tags: ["packing", "gear"],
      text: "Arctic winter trips (Tromsø, Iceland) need layered merino, a windproof shell, insulated boots and hand warmers. Desert sites (Petra, Grand Canyon) need sun hats, 3–4 liters of water capacity and breathable long sleeves. Tropics (Bali, Maldives, Bora Bora) need reef-safe sunscreen, quick-dry clothing and a dry bag. Alpine hiking (Swiss Alps, Banff, Machu Picchu) needs broken-in boots, rain shell and altitude medication where relevant.",
    },
    {
      id: "guide:solo",
      title: "Solo travel",
      tags: ["solo", "safety", "backpacking"],
      text: "Great first solo destinations: Japan (Kyoto) for safety and transit, Iceland for easy self-driving, Bali for social hostels and coworking cafés, and Jordan (Petra) for welcoming culture with organized transport. Share live location with someone at home, keep digital copies of documents, and arrive in new cities before dark.",
    },
    {
      id: "guide:food",
      title: "Food-first travel",
      tags: ["food", "cuisine", "street food"],
      text: "For eating as the itinerary: Kyoto's kaiseki and market culture, Venice's cicchetti bars, Santorini's volcanic-soil produce and Assyrtiko wine, Türkiye's Anatolian table in Cappadocia, and Bali's warung scene. Book one signature meal per city ahead, then follow markets and lunch crowds for the rest.",
    },
    {
      id: "guide:anime",
      title: "Anime and film pilgrimage spots",
      tags: ["anime", "film", "japan"],
      text: "Anime pilgrimages center on Japan: Mount Fuji and Lake Kawaguchiko backdrops appear across countless series; Kyoto's Fushimi Inari gates feature in Inari Kon Kon; and Tokyo suburbs host Your Name's staircases. Petra and Venice draw film pilgrims for Indiana Jones, and Cappadocia's balloon fields star in every travel montage.",
    },
    {
      id: "guide:crowds",
      title: "Avoiding crowds",
      tags: ["crowdsfree", "hidden", "quiet"],
      text: "To dodge crowds: go at opening time or the last entry slot, pick shoulder season, and swap icons for equivalents — Hjørundfjord instead of Geiranger, Jinshanling instead of Badaling on the Great Wall, Pyrgos instead of Oia on Santorini, local Maldivian islands instead of resort atolls, and the Westfjords over Iceland's Golden Circle.",
    },
  );

  return docs;
}
