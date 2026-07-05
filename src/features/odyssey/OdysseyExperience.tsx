"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { IntroOverlay } from "./ui/IntroOverlay";
import { HUD } from "./ui/HUD";
import { ChapterRail } from "./ui/ChapterRail";
import { DestinationPanel } from "./ui/DestinationPanel";
import { CopilotPanel } from "./ui/CopilotPanel";
import { useOdyssey } from "./store/useOdyssey";

// WebGL only ever runs on the client.
const EarthScene = dynamic(() => import("./scene/EarthScene").then((m) => m.EarthScene), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center bg-[#05060f]">
      <span className="text-[11px] tracking-[0.4em] text-sky-200/50 uppercase">
        entering orbit…
      </span>
    </div>
  ),
});

export default function OdysseyExperience() {
  const setReducedMotion = useOdyssey((s) => s.setReducedMotion);

  // Honor prefers-reduced-motion: flights become jumps, auto-rotate stops.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [setReducedMotion]);

  // Keyboard navigation.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useOdyssey.getState();
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === "Escape") (e.target as HTMLElement).blur();
        return;
      }
      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
          if (s.started) s.step(1);
          break;
        case "ArrowLeft":
        case "ArrowUp":
          if (s.started) s.step(-1);
          break;
        case "Escape":
          if (s.activeDestinationId) s.closePanel();
          else if (s.copilotOpen) s.setCopilotOpen(false);
          break;
        case "Enter":
          if (!s.started) s.begin();
          else if (s.focusedDestinationId && !s.activeDestinationId) s.openDestination(s.focusedDestinationId);
          break;
        case "/":
          e.preventDefault();
          s.setCopilotOpen(true);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="ody-selection fixed inset-0 overflow-hidden bg-[#05060f] text-white">
      <EarthScene />
      <HUD />
      <ChapterRail />
      <DestinationPanel />
      <CopilotPanel />
      <IntroOverlay />
    </div>
  );
}
