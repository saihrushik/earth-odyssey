"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useOdyssey } from "../store/useOdyssey";

interface WikiImage {
  title: string;
  url: string;
}

interface Weather {
  temperatureC: number;
  description: string;
}

/** Minimal **bold** renderer for the streamed text. */
function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i} className="font-semibold text-sky-100">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

/** Real photos near the pin, via Wikipedia geosearch (keyless, CORS-open). */
async function fetchImages(lat: number, lng: number): Promise<WikiImage[]> {
  const params = new URLSearchParams({
    action: "query",
    generator: "geosearch",
    ggscoord: `${lat}|${lng}`,
    ggsradius: "10000",
    ggslimit: "8",
    prop: "pageimages",
    piprop: "thumbnail",
    pithumbsize: "480",
    format: "json",
    origin: "*",
  });
  const res = await fetch(`https://en.wikipedia.org/w/api.php?${params}`);
  const pages = ((await res.json()).query?.pages ?? {}) as Record<
    string,
    { title?: string; thumbnail?: { source: string }; index?: number }
  >;
  return Object.values(pages)
    .sort((a, b) => (a.index ?? 9) - (b.index ?? 9))
    .filter((p) => p.thumbnail?.source)
    .slice(0, 4)
    .map((p) => ({ title: p.title ?? "", url: p.thumbnail!.source }));
}

export function PlacePanel() {
  const pin = useOdyssey((s) => s.customPin);
  const clear = useOdyssey((s) => s.clearCustomPin);
  const [images, setImages] = useState<WikiImage[]>([]);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const key = pin ? `${pin.lat.toFixed(3)},${pin.lng.toFixed(3)}` : null;
  const located = pin !== null && pin.name !== "Locating…";

  useEffect(() => {
    if (!pin || !located) return;
    let cancelled = false;
    setImages([]);
    setWeather(null);
    setText("");
    setBusy(true);

    fetchImages(pin.lat, pin.lng)
      .then((imgs) => !cancelled && setImages(imgs))
      .catch(() => {});
    fetch(`/api/weather?lat=${pin.lat}&lng=${pin.lng}`)
      .then((r) => r.json())
      .then((w: Weather) => !cancelled && typeof w.temperatureC === "number" && setWeather(w))
      .catch(() => {});

    (async () => {
      try {
        const res = await fetch("/api/place", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(pin),
        });
        if (!res.body) throw new Error("no stream");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done || cancelled) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            try {
              const event = JSON.parse(line) as { type: string; text?: string };
              if (event.type === "delta" && event.text && !cancelled) {
                setText((t) => t + event.text);
              }
            } catch {
              /* partial line */
            }
          }
        }
      } catch {
        if (!cancelled) setText("Couldn't load place details — try again in a moment.");
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, located]);

  return (
    <AnimatePresence>
      {pin && (
        <motion.aside
          key="place-panel"
          initial={{ x: 60, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 60, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 30 }}
          className="ody-glass ody-scroll absolute top-20 right-5 bottom-24 z-30 w-[min(92vw,380px)] overflow-y-auto rounded-2xl"
          aria-label={`About ${pin.name}`}
        >
          <div className="sticky top-0 z-10 flex items-start justify-between gap-3 bg-gradient-to-b from-[#0b1224f2] to-[#0b1224b0] px-5 pt-4 pb-3 backdrop-blur-md">
            <div>
              <h2 className="text-lg font-medium text-white">{pin.name}</h2>
              <p className="text-[11px] tracking-[0.14em] text-amber-200/70 uppercase">
                {[pin.region, pin.country].filter(Boolean).join(" · ") ||
                  `${pin.lat.toFixed(2)}°, ${pin.lng.toFixed(2)}°`}
              </p>
            </div>
            <button
              onClick={clear}
              aria-label="Close place panel"
              className="ody-chip cursor-pointer transition hover:border-sky-200/40"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4 px-5 pb-6">
            <div className="flex flex-wrap gap-2">
              <span className="ody-chip">📍 {pin.lat.toFixed(3)}, {pin.lng.toFixed(3)}</span>
              {weather && (
                <span className="ody-chip">
                  ☀ {Math.round(weather.temperatureC)}°C · {weather.description}
                </span>
              )}
            </div>

            {images.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {images.map((img) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={img.url}
                    src={img.url}
                    alt={img.title}
                    title={img.title}
                    loading="lazy"
                    className="h-24 w-full rounded-lg border border-sky-200/10 object-cover"
                  />
                ))}
              </div>
            )}

            <div className="text-[13.5px] leading-relaxed whitespace-pre-wrap text-sky-100/85">
              {!located ? (
                "Locating…"
              ) : text ? (
                <RichText text={text} />
              ) : busy ? (
                "Gathering local intel…"
              ) : null}
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
