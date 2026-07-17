"use client";

import { motion } from "framer-motion";
import { useOdyssey } from "../store/useOdyssey";
import { useAmbientAudio } from "../hooks/useAmbientAudio";
import { SearchBar } from "./SearchBar";

function HudButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={onClick}
      className={`ody-glass grid h-10 w-10 place-items-center rounded-full text-sm transition-all hover:scale-105 ${
        active ? "border-sky-300/50 text-sky-200" : "text-sky-100/60"
      }`}
    >
      {children}
    </button>
  );
}

export function HUD() {
  const started = useOdyssey((s) => s.started);
  const soundOn = useOdyssey((s) => s.soundOn);
  const nightSide = useOdyssey((s) => s.nightSide);
  const auroraActive = useOdyssey((s) => s.auroraActive);
  const stylized = useOdyssey((s) => s.visualStyle === "stylized");
  const perfMode = useOdyssey((s) => s.perfMode);
  const toggleVisualStyle = useOdyssey((s) => s.toggleVisualStyle);
  const setPerfMode = useOdyssey((s) => s.setPerfMode);
  const copilotOpen = useOdyssey((s) => s.copilotOpen);
  const toggleSound = useOdyssey((s) => s.toggleSound);
  const toggleNightSide = useOdyssey((s) => s.toggleNightSide);
  const setAurora = useOdyssey((s) => s.setAurora);
  const setCopilotOpen = useOdyssey((s) => s.setCopilotOpen);

  useAmbientAudio(soundOn && started);

  if (!started) return null;

  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0, transition: { delay: 0.8, duration: 0.9 } }}
      className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between p-5"
    >
      <div className="pointer-events-auto select-none">
        <span className="text-sm font-light tracking-[0.4em] text-white/90">EARTH ODYSSEY</span>
        <span className="mt-0.5 block text-[10px] tracking-[0.28em] text-sky-200/40 uppercase">
          AI travel discovery
        </span>
      </div>

      <SearchBar />

      <div className="pointer-events-auto flex items-center gap-2.5">
        <HudButton label={soundOn ? "Mute ambient sound" : "Play ambient sound"} active={soundOn} onClick={toggleSound}>
          {soundOn ? "♪" : "∅"}
        </HudButton>
        <HudButton label="Toggle day / night" active={nightSide} onClick={toggleNightSide}>
          {nightSide ? "☾" : "☀"}
        </HudButton>
        <HudButton label="Toggle aurora" active={auroraActive} onClick={() => setAurora(!auroraActive)}>
          ᨒ
        </HudButton>
        <HudButton
          label={stylized ? "Switch to realistic globe" : "Switch to illustrated globe"}
          active={stylized}
          onClick={toggleVisualStyle}
        >
          ✎
        </HudButton>
        <HudButton
          label={perfMode ? "Performance mode on (battery-friendly)" : "Quality mode on"}
          active={perfMode}
          onClick={() => setPerfMode(!perfMode)}
        >
          ⚡
        </HudButton>
        <button
          onClick={() => setCopilotOpen(!copilotOpen)}
          aria-pressed={copilotOpen}
          className={`ody-glass flex h-10 items-center gap-2 rounded-full px-4 text-xs tracking-[0.15em] uppercase transition-all hover:scale-[1.03] ${
            copilotOpen ? "border-cyan-300/50 text-cyan-100" : "text-sky-100/75"
          }`}
        >
          <span
            className="h-2 w-2 rounded-full bg-cyan-300"
            style={{ boxShadow: "0 0 10px 2px rgba(94,234,212,0.8)", animation: "ody-pulse 2.4s ease-in-out infinite" }}
          />
          Copilot
        </button>
      </div>
    </motion.header>
  );
}
