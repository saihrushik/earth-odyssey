/**
 * Trip-planning data: curated stays, entry fees, gateway airports and origin
 * hubs. Prices are typical nightly rates in USD (indicative, not live quotes).
 */

export interface Stay {
  name: string;
  tier: "budget" | "mid" | "luxury";
  pricePerNight: number;
  note?: string;
}

export const STAYS: Record<string, Stay[]> = {
  "taj-mahal": [
    { name: "Zostel Agra", tier: "budget", pricePerNight: 15 },
    { name: "Crystal Sarovar Premiere", tier: "mid", pricePerNight: 90 },
    { name: "The Oberoi Amarvilas", tier: "luxury", pricePerNight: 650, note: "every room faces the Taj" },
  ],
  "great-wall": [
    { name: "Beijing Downtown Backpackers", tier: "budget", pricePerNight: 20 },
    { name: "Brickyard Retreat at Mutianyu", tier: "mid", pricePerNight: 140, note: "wall views from the terrace" },
    { name: "Commune by the Great Wall", tier: "luxury", pricePerNight: 300 },
  ],
  "machu-picchu": [
    { name: "Supertramp Hostel, Aguas Calientes", tier: "budget", pricePerNight: 25 },
    { name: "Tierra Viva Machu Picchu", tier: "mid", pricePerNight: 120 },
    { name: "Sanctuary Lodge, A Belmond Hotel", tier: "luxury", pricePerNight: 1200, note: "beside the citadel gate" },
  ],
  "swiss-alps": [
    { name: "Zermatt Youth Hostel", tier: "budget", pricePerNight: 60 },
    { name: "Hotel Bella Vista, Zermatt", tier: "mid", pricePerNight: 220 },
    { name: "The Omnia, Zermatt", tier: "luxury", pricePerNight: 800 },
  ],
  bali: [
    { name: "Puri Garden Hostel, Ubud", tier: "budget", pricePerNight: 18 },
    { name: "Alaya Resort Ubud", tier: "mid", pricePerNight: 140 },
    { name: "Four Seasons Resort Bali at Sayan", tier: "luxury", pricePerNight: 950 },
  ],
  banff: [
    { name: "HI Banff Alpine Centre", tier: "budget", pricePerNight: 45 },
    { name: "Moose Hotel & Suites", tier: "mid", pricePerNight: 250 },
    { name: "Fairmont Banff Springs", tier: "luxury", pricePerNight: 550, note: "the 'Castle in the Rockies'" },
  ],
  yellowstone: [
    { name: "Madison Campground", tier: "budget", pricePerNight: 30 },
    { name: "Old Faithful Inn", tier: "mid", pricePerNight: 280, note: "book ~13 months ahead" },
    { name: "Lake Yellowstone Hotel", tier: "luxury", pricePerNight: 450 },
  ],
  iceland: [
    { name: "Kex Hostel, Reykjavík", tier: "budget", pricePerNight: 50 },
    { name: "Fosshotel Glacier Lagoon", tier: "mid", pricePerNight: 260 },
    { name: "The Retreat at Blue Lagoon", tier: "luxury", pricePerNight: 1400 },
  ],
  santorini: [
    { name: "Caveland Hostel", tier: "budget", pricePerNight: 45, note: "a converted winery" },
    { name: "Keti Hotel, Fira", tier: "mid", pricePerNight: 180, note: "caldera-view cave rooms" },
    { name: "Katikies, Oia", tier: "luxury", pricePerNight: 900 },
  ],
  petra: [
    { name: "Rocky Mountain Hotel", tier: "budget", pricePerNight: 35 },
    { name: "Petra Moon Hotel", tier: "mid", pricePerNight: 110 },
    { name: "Mövenpick Resort Petra", tier: "luxury", pricePerNight: 220, note: "30 steps from the gate" },
  ],
  venice: [
    { name: "Generator Venice", tier: "budget", pricePerNight: 40 },
    { name: "Hotel Antiche Figure", tier: "mid", pricePerNight: 250, note: "on the Grand Canal" },
    { name: "Aman Venice", tier: "luxury", pricePerNight: 1600 },
  ],
  kyoto: [
    { name: "Piece Hostel Sanjo", tier: "budget", pricePerNight: 35 },
    { name: "Hotel Kanra Kyoto", tier: "mid", pricePerNight: 250 },
    { name: "The Ritz-Carlton Kyoto", tier: "luxury", pricePerNight: 1100, note: "on the Kamogawa river" },
  ],
  maldives: [
    { name: "Thoddoo island guesthouses", tier: "budget", pricePerNight: 60, note: "local island, public ferry" },
    { name: "Kandima Maldives", tier: "mid", pricePerNight: 450 },
    { name: "Soneva Fushi", tier: "luxury", pricePerNight: 2500 },
  ],
  "mount-fuji": [
    { name: "K's House Fuji View", tier: "budget", pricePerNight: 30 },
    { name: "Kozantei Ubuya, Kawaguchiko", tier: "mid", pricePerNight: 300, note: "lake-and-Fuji view ryokan" },
    { name: "Hoshinoya Fuji", tier: "luxury", pricePerNight: 700, note: "glamping cabins facing the peak" },
  ],
  "northern-lights": [
    { name: "Tromsø Activities Hostel", tier: "budget", pricePerNight: 55 },
    { name: "Smarthotel Tromsø", tier: "mid", pricePerNight: 130 },
    { name: "Malangen Resort", tier: "luxury", pricePerNight: 350, note: "aurora camp outside the city lights" },
  ],
  "norwegian-fjords": [
    { name: "Flåm Camping & Hostel", tier: "budget", pricePerNight: 60 },
    { name: "Hotel Union Geiranger", tier: "mid", pricePerNight: 280 },
    { name: "Juvet Landscape Hotel", tier: "luxury", pricePerNight: 450, note: "the Ex Machina hotel" },
  ],
  cappadocia: [
    { name: "Nomad Cave Hostel, Göreme", tier: "budget", pricePerNight: 20 },
    { name: "Sultan Cave Suites", tier: "mid", pricePerNight: 180, note: "the famous balloon-view rooftop" },
    { name: "Museum Hotel", tier: "luxury", pricePerNight: 600, note: "Relais & Châteaux cave palace" },
  ],
  "grand-canyon": [
    { name: "Mather Campground", tier: "budget", pricePerNight: 30 },
    { name: "Yavapai Lodge", tier: "mid", pricePerNight: 220 },
    { name: "El Tovar Hotel", tier: "luxury", pricePerNight: 350, note: "1905 lodge on the rim" },
  ],
  "bora-bora": [
    { name: "Village Temanuata", tier: "budget", pricePerNight: 180, note: "beach bungalows, local-run" },
    { name: "Maitai Polynesia", tier: "mid", pricePerNight: 350 },
    { name: "Four Seasons Resort Bora Bora", tier: "luxury", pricePerNight: 2200, note: "overwater villas" },
  ],
};

/** Headline entry / permit cost for the signature sight (approximate). */
export const ENTRY_FEES: Record<string, string> = {
  "taj-mahal": "₹1,300 (~$15) for foreign visitors incl. mausoleum; closed Fridays",
  "great-wall": "Mutianyu ¥45 (~$6) entry + ~$17 cable car / toboggan",
  "machu-picchu": "~$45 (S/152) foreigner entry, timed circuits; Huayna Picchu extra ~$20 — book weeks ahead",
  "swiss-alps": "Trails free; Jungfraujoch railway ~$230 return (Swiss Travel Pass discounts)",
  bali: "Temples ~$3–7 each (Uluwatu ~$5, Tirta Empul ~$5); Besakih ~$10",
  banff: "Parks Canada pass ~CA$11 (~$8) per person/day",
  yellowstone: "$35 per vehicle, valid 7 days",
  iceland: "Natural sites free; Blue Lagoon from ~$70, Jökulsárlón boat ~$45",
  santorini: "Akrotiri excavations ~€12; Ancient Thera ~€6",
  petra: "1-day JD50 (~$70); the ~$100 Jordan Pass bundles it with the country visa",
  venice: "Day-tripper access fee €5–10 on peak dates; St Mark's from €3, Doge's Palace ~€30",
  kyoto: "Temples ~¥400–800 ($3–6) each; Fushimi Inari is free",
  maldives: "No entry fees — budget for seaplane/speedboat transfers ($100–450 return)",
  "mount-fuji": "Yoshida trail climbing fee ¥4,000 (~$27), booked online in season",
  "northern-lights": "The sky is free; guided aurora chases run ~$120–180 per night",
  "norwegian-fjords": "Fjords free; Geiranger/Nærøyfjord ferry cruises ~$40–60",
  cappadocia: "Göreme Open-Air Museum ~$14; balloon flights $200–300 at dawn",
  "grand-canyon": "$35 per vehicle, valid 7 days",
  "bora-bora": "No entry fees; lagoon day tours ~$120–150",
};

/** Gateway airport for flight estimates. */
export const GATEWAY_AIRPORTS: Record<string, { code: string; city: string }> = {
  "taj-mahal": { code: "DEL", city: "Delhi" },
  "great-wall": { code: "PEK", city: "Beijing" },
  "machu-picchu": { code: "CUZ", city: "Cusco" },
  "swiss-alps": { code: "ZRH", city: "Zurich" },
  bali: { code: "DPS", city: "Denpasar" },
  banff: { code: "YYC", city: "Calgary" },
  yellowstone: { code: "BZN", city: "Bozeman" },
  iceland: { code: "KEF", city: "Reykjavík" },
  santorini: { code: "JTR", city: "Santorini" },
  petra: { code: "AMM", city: "Amman" },
  venice: { code: "VCE", city: "Venice" },
  kyoto: { code: "KIX", city: "Osaka" },
  maldives: { code: "MLE", city: "Malé" },
  "mount-fuji": { code: "HND", city: "Tokyo" },
  "northern-lights": { code: "TOS", city: "Tromsø" },
  "norwegian-fjords": { code: "BGO", city: "Bergen" },
  cappadocia: { code: "NAV", city: "Nevşehir" },
  "grand-canyon": { code: "LAS", city: "Las Vegas" },
  "bora-bora": { code: "BOB", city: "Bora Bora (via Papeete)" },
};

export interface OriginHub {
  id: string;
  city: string;
  code: string;
  lat: number;
  lng: number;
  aliases: string[];
}

export const ORIGIN_HUBS: OriginHub[] = [
  { id: "nyc", city: "New York", code: "JFK", lat: 40.64, lng: -73.78, aliases: ["new york", "nyc", "jfk", "newark"] },
  { id: "lax", city: "Los Angeles", code: "LAX", lat: 33.94, lng: -118.41, aliases: ["los angeles", "la ", "lax"] },
  { id: "sfo", city: "San Francisco", code: "SFO", lat: 37.62, lng: -122.38, aliases: ["san francisco", "sf ", "sfo", "bay area"] },
  { id: "chi", city: "Chicago", code: "ORD", lat: 41.97, lng: -87.9, aliases: ["chicago", "ord"] },
  { id: "dfw", city: "Dallas", code: "DFW", lat: 32.9, lng: -97.04, aliases: ["dallas", "dfw"] },
  { id: "sea", city: "Seattle", code: "SEA", lat: 47.45, lng: -122.31, aliases: ["seattle"] },
  { id: "mia", city: "Miami", code: "MIA", lat: 25.79, lng: -80.29, aliases: ["miami"] },
  { id: "yyz", city: "Toronto", code: "YYZ", lat: 43.68, lng: -79.63, aliases: ["toronto"] },
  { id: "lon", city: "London", code: "LHR", lat: 51.47, lng: -0.45, aliases: ["london", "heathrow"] },
  { id: "par", city: "Paris", code: "CDG", lat: 49.01, lng: 2.55, aliases: ["paris"] },
  { id: "fra", city: "Frankfurt", code: "FRA", lat: 50.04, lng: 8.56, aliases: ["frankfurt"] },
  { id: "ams", city: "Amsterdam", code: "AMS", lat: 52.31, lng: 4.76, aliases: ["amsterdam"] },
  { id: "dxb", city: "Dubai", code: "DXB", lat: 25.25, lng: 55.36, aliases: ["dubai"] },
  { id: "del", city: "Delhi", code: "DEL", lat: 28.57, lng: 77.1, aliases: ["delhi", "new delhi"] },
  { id: "bom", city: "Mumbai", code: "BOM", lat: 19.09, lng: 72.87, aliases: ["mumbai", "bombay"] },
  { id: "hyd", city: "Hyderabad", code: "HYD", lat: 17.24, lng: 78.43, aliases: ["hyderabad"] },
  { id: "blr", city: "Bengaluru", code: "BLR", lat: 13.2, lng: 77.71, aliases: ["bangalore", "bengaluru"] },
  { id: "sin", city: "Singapore", code: "SIN", lat: 1.36, lng: 103.99, aliases: ["singapore"] },
  { id: "tyo", city: "Tokyo", code: "HND", lat: 35.55, lng: 139.78, aliases: ["tokyo"] },
  { id: "syd", city: "Sydney", code: "SYD", lat: -33.95, lng: 151.18, aliases: ["sydney"] },
];

/** Airlines that plausibly serve each destination region, for estimate context. */
export const REGIONAL_AIRLINES: Record<string, string[]> = {
  "taj-mahal": ["Air India", "Emirates", "United"],
  "great-wall": ["Air China", "Cathay Pacific", "United"],
  "machu-picchu": ["LATAM", "Avianca", "Copa"],
  "swiss-alps": ["SWISS", "Lufthansa", "United"],
  bali: ["Singapore Airlines", "Garuda Indonesia", "Qatar Airways"],
  banff: ["Air Canada", "WestJet", "United"],
  yellowstone: ["Delta", "United", "Alaska"],
  iceland: ["Icelandair", "PLAY", "Delta"],
  santorini: ["Aegean", "Lufthansa", "Emirates via ATH"],
  petra: ["Royal Jordanian", "Turkish Airlines", "Emirates"],
  venice: ["ITA Airways", "Lufthansa", "Delta"],
  kyoto: ["ANA", "Japan Airlines", "United"],
  maldives: ["Qatar Airways", "Emirates", "IndiGo"],
  "mount-fuji": ["ANA", "Japan Airlines", "ZIPAIR"],
  "northern-lights": ["Norwegian", "SAS", "KLM via AMS"],
  "norwegian-fjords": ["Norwegian", "SAS", "KLM via AMS"],
  cappadocia: ["Turkish Airlines", "Pegasus", "AJet"],
  "grand-canyon": ["Southwest", "Delta", "United"],
  "bora-bora": ["Air Tahiti Nui", "French Bee", "Air France"],
};
