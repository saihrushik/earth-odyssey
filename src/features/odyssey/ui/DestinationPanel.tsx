"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { destinationById } from "../data/destinations";
import { chapterById } from "../data/chapters";
import { useOdyssey } from "../store/useOdyssey";
import type { Destination } from "../data/types";

interface LiveWeather {
  temperatureC: number;
  windKmh: number;
  description: string;
  isDay: boolean;
}

function useLiveWeather(dest: Destination | null) {
  const [weather, setWeather] = useState<LiveWeather | null>(null);
  useEffect(() => {
    setWeather(null);
    if (!dest) return;
    const ctrl = new AbortController();
    fetch(`/api/weather?lat=${dest.lat}&lng=${dest.lng}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setWeather(data))
      .catch(() => {});
    return () => ctrl.abort();
  }, [dest]);
  return weather;
}

function useLocalTime(timezone: string | undefined) {
  const [time, setTime] = useState("");
  useEffect(() => {
    if (!timezone) return;
    const tick = () =>
      setTime(
        new Intl.DateTimeFormat("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: timezone,
        }).format(new Date()),
      );
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [timezone]);
  return time;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h3 className="mb-2 text-[10px] font-medium tracking-[0.3em] text-sky-200/50 uppercase">{title}</h3>
      {children}
    </section>
  );
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 border-b border-white/5 py-2 text-[13px] last:border-0">
      <span className="w-24 shrink-0 text-sky-200/45">{label}</span>
      <span className="text-sky-50/90">{value}</span>
    </div>
  );
}

export function DestinationPanel() {
  const activeId = useOdyssey((s) => s.activeDestinationId);
  const closePanel = useOdyssey((s) => s.closePanel);
  const setCopilotOpen = useOdyssey((s) => s.setCopilotOpen);

  const dest = activeId ? (destinationById(activeId) ?? null) : null;
  const weather = useLiveWeather(dest);
  const localTime = useLocalTime(dest?.timezone);
  const accent = chapterById(dest?.chapters[0] ?? "wonders")?.accent ?? "#7fd4ff";

  return (
    <AnimatePresence>
      {dest && (
        <motion.aside
          key={dest.id}
          initial={{ x: 480, opacity: 0 }}
          animate={{ x: 0, opacity: 1, transition: { type: "spring", stiffness: 240, damping: 30 } }}
          exit={{ x: 480, opacity: 0, transition: { duration: 0.35 } }}
          className="ody-glass ody-scroll absolute top-4 right-4 bottom-4 z-20 w-[min(430px,92vw)] overflow-y-auto rounded-3xl"
          aria-label={`${dest.name} details`}
        >
          {/* Postcard header */}
          <div
            className="relative flex h-44 flex-col justify-end overflow-hidden rounded-t-3xl p-6"
            style={{
              background: `
                radial-gradient(140% 120% at 85% -20%, ${accent}55, transparent 55%),
                radial-gradient(120% 130% at 0% 110%, ${accent}33, transparent 60%),
                linear-gradient(165deg, #0c1630 0%, #060a18 100%)`,
            }}
          >
            <button
              onClick={closePanel}
              aria-label="Close destination panel"
              className="absolute top-4 right-4 grid h-8 w-8 place-items-center rounded-full bg-white/8 text-white/70 backdrop-blur transition-colors hover:bg-white/15 hover:text-white"
            >
              ✕
            </button>
            <div className="text-[10px] tracking-[0.35em] text-white/45 uppercase">
              {dest.region} · {dest.lat.toFixed(2)}°, {dest.lng.toFixed(2)}°
            </div>
            <h2 className="mt-1 text-3xl font-light tracking-wide text-white">{dest.name}</h2>
            <p className="mt-1 text-[13px] text-sky-100/60 italic">{dest.tagline}</p>
          </div>

          <div className="p-6 pt-4">
            {/* Live strip */}
            <div className="flex flex-wrap items-center gap-2">
              {dest.unesco && <span className="ody-chip" style={{ borderColor: `${accent}66`, color: accent }}>◈ UNESCO</span>}
              {localTime && <span className="ody-chip">🕐 {localTime} local</span>}
              {weather ? (
                <span className="ody-chip">
                  {weather.isDay ? "☀" : "☾"} {Math.round(weather.temperatureC)}°C · {weather.description}
                </span>
              ) : (
                <span className="ody-chip opacity-50">fetching live weather…</span>
              )}
            </div>

            <Section title="The story">
              <p className="text-[13.5px] leading-relaxed text-sky-50/80">{dest.history}</p>
            </Section>

            <Section title="Worth knowing">
              <ul className="space-y-1.5">
                {dest.facts.map((f) => (
                  <li key={f} className="flex gap-2 text-[13px] leading-snug text-sky-50/75">
                    <span style={{ color: accent }}>◦</span>
                    {f}
                  </li>
                ))}
              </ul>
            </Section>

            <Section title="Plan it">
              <FactRow label="Best season" value={dest.bestSeason} />
              <FactRow
                label="Budget / day"
                value={`$${dest.budgetPerDay.backpacker} backpacker · $${dest.budgetPerDay.midrange} mid · $${dest.budgetPerDay.luxury} luxury`}
              />
              <FactRow label="Suggested" value={dest.tripDays} />
              <FactRow label="Visa" value={dest.visa} />
              <FactRow label="Language" value={dest.language} />
              <FactRow label="Currency" value={`${dest.currencyName} (${dest.currency})`} />
              <FactRow label="Safety" value={dest.safety} />
              <FactRow label="Getting there" value={dest.transport} />
            </Section>

            <Section title="Top attractions">
              <div className="flex flex-wrap gap-1.5">
                {dest.attractions.map((a) => (
                  <span key={a} className="ody-chip">{a}</span>
                ))}
              </div>
            </Section>

            <Section title="Eat & drink">
              <div className="flex flex-wrap gap-1.5">
                {dest.food.map((f) => (
                  <span key={f} className="ody-chip">{f}</span>
                ))}
              </div>
            </Section>

            <Section title="Hidden gems">
              <ul className="space-y-1.5">
                {dest.hiddenGems.map((g) => (
                  <li key={g} className="flex gap-2 text-[13px] text-sky-50/75">
                    <span style={{ color: accent }}>✦</span>
                    {g}
                  </li>
                ))}
              </ul>
            </Section>

            <Section title="Pair it with">
              <div className="flex flex-wrap gap-1.5">
                {dest.nearby.map((n) => (
                  <span key={n} className="ody-chip">{n}</span>
                ))}
              </div>
            </Section>

            <button
              onClick={() => setCopilotOpen(true)}
              className="mt-8 w-full rounded-2xl border border-cyan-300/25 bg-cyan-400/10 py-3.5 text-xs tracking-[0.2em] text-cyan-100 uppercase transition-all hover:bg-cyan-400/20"
            >
              ✦ Ask the copilot about {dest.name}
            </button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
