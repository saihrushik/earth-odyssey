"use client";

import { motion } from "framer-motion";
import { CHAPTERS } from "../data/chapters";
import { destinationById, destinationsForChapter } from "../data/destinations";
import { useOdyssey } from "../store/useOdyssey";

/** Bottom navigator: cinematic chapters + current destination stepper. */
export function ChapterRail() {
  const started = useOdyssey((s) => s.started);
  const chapterId = useOdyssey((s) => s.chapterId);
  const focusedId = useOdyssey((s) => s.focusedDestinationId);
  const setChapter = useOdyssey((s) => s.setChapter);
  const step = useOdyssey((s) => s.step);

  if (!started) return null;

  const focused = focusedId ? destinationById(focusedId) : null;
  const chapterList = destinationsForChapter(chapterId);
  const idx = chapterList.findIndex((d) => d.id === focusedId);

  return (
    <motion.nav
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0, transition: { delay: 1.1, duration: 0.9 } }}
      className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-3 pb-5"
      aria-label="Travel chapters"
    >
      {/* Current destination stepper */}
      <div className="pointer-events-auto flex items-center gap-4">
        <button
          aria-label="Previous destination"
          onClick={() => step(-1)}
          className="ody-glass grid h-9 w-9 place-items-center rounded-full text-sky-100/70 transition-transform hover:scale-110"
        >
          ‹
        </button>
        <div className="min-w-44 text-center">
          <div className="text-sm font-light tracking-[0.2em] text-white uppercase">
            {focused?.name ?? "—"}
          </div>
          <div className="text-[10px] tracking-[0.3em] text-sky-200/50 uppercase">
            {focused ? `${focused.country} · ${idx + 1}/${chapterList.length}` : ""}
          </div>
        </div>
        <button
          aria-label="Next destination"
          onClick={() => step(1)}
          className="ody-glass grid h-9 w-9 place-items-center rounded-full text-sky-100/70 transition-transform hover:scale-110"
        >
          ›
        </button>
      </div>

      {/* Chapter pills */}
      <div className="pointer-events-auto ody-glass ody-noscroll flex max-w-[94vw] items-center gap-1 overflow-x-auto rounded-full px-2 py-1.5">
        {CHAPTERS.map((c) => {
          const active = c.id === chapterId;
          return (
            <button
              key={c.id}
              onClick={() => setChapter(c.id)}
              aria-current={active ? "true" : undefined}
              className={`rounded-full px-3.5 py-1.5 text-[11px] whitespace-nowrap tracking-[0.14em] uppercase transition-all ${
                active ? "text-slate-900" : "text-sky-100/60 hover:text-white"
              }`}
              style={active ? { background: c.accent, boxShadow: `0 0 18px ${c.accent}66` } : undefined}
            >
              {c.title}
            </button>
          );
        })}
      </div>
    </motion.nav>
  );
}
