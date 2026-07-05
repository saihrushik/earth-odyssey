/** Live weather via Open-Meteo — no API key required. */

const WMO: Record<number, string> = {
  0: "clear sky",
  1: "mostly clear",
  2: "partly cloudy",
  3: "overcast",
  45: "fog",
  48: "rime fog",
  51: "light drizzle",
  53: "drizzle",
  55: "heavy drizzle",
  61: "light rain",
  63: "rain",
  65: "heavy rain",
  66: "freezing rain",
  67: "heavy freezing rain",
  71: "light snow",
  73: "snow",
  75: "heavy snow",
  77: "snow grains",
  80: "light showers",
  81: "showers",
  82: "violent showers",
  85: "snow showers",
  86: "heavy snow showers",
  95: "thunderstorm",
  96: "thunderstorm with hail",
  99: "severe thunderstorm with hail",
};

export interface WeatherNow {
  temperatureC: number;
  windKmh: number;
  description: string;
  isDay: boolean;
}

export async function getCurrentWeather(lat: number, lng: number): Promise<WeatherNow> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lng));
  url.searchParams.set("current", "temperature_2m,weather_code,wind_speed_10m,is_day");
  const res = await fetch(url, { next: { revalidate: 600 } });
  if (!res.ok) throw new Error(`open-meteo failed: ${res.status}`);
  const json = (await res.json()) as {
    current: { temperature_2m: number; weather_code: number; wind_speed_10m: number; is_day: number };
  };
  return {
    temperatureC: json.current.temperature_2m,
    windKmh: json.current.wind_speed_10m,
    description: WMO[json.current.weather_code] ?? "unknown conditions",
    isDay: json.current.is_day === 1,
  };
}
