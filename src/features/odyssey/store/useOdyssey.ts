"use client";

import { create } from "zustand";
import { CHAPTERS } from "../data/chapters";
import { DESTINATIONS, destinationById, destinationsForChapter } from "../data/destinations";
import type { ChapterId } from "../data/types";

/** A one-shot camera flight request, consumed by the CameraRig. */
export interface CameraIntent {
  seq: number;
  lat: number;
  lng: number;
  distance: number;
}

/** Globe-control actions emitted by the AI copilot. */
export type CopilotAction =
  | { kind: "flyTo"; destinationId: string }
  | { kind: "highlight"; destinationIds: string[] }
  | { kind: "aurora"; active: boolean }
  | { kind: "chapter"; chapterId: ChapterId };

interface OdysseyState {
  started: boolean;
  chapterId: ChapterId;
  /** Destination whose glass panel is open. */
  activeDestinationId: string | null;
  /** Destination the camera is (or was last) flying to. */
  focusedDestinationId: string | null;
  /** Pins glowing because the AI pointed at them. */
  highlightedIds: string[];
  auroraActive: boolean;
  nightSide: boolean;
  soundOn: boolean;
  /** Flat, illustrated globe look vs. photoreal textures. */
  visualStyle: "stylized" | "realistic";
  /** Reduced GPU load: lower DPR, no post-processing, fewer particles. */
  perfMode: boolean;
  copilotOpen: boolean;
  cameraIntent: CameraIntent | null;
  reducedMotion: boolean;

  begin: () => void;
  setChapter: (id: ChapterId, fly?: boolean) => void;
  openDestination: (id: string) => void;
  closePanel: () => void;
  flyToDestination: (id: string, openPanel?: boolean) => void;
  /** Wheel / arrow-key navigation: step to the next or previous destination. */
  step: (dir: 1 | -1) => void;
  setHighlights: (ids: string[]) => void;
  setAurora: (active: boolean) => void;
  toggleNightSide: () => void;
  toggleSound: () => void;
  toggleVisualStyle: () => void;
  setPerfMode: (on: boolean) => void;
  setCopilotOpen: (open: boolean) => void;
  setReducedMotion: (v: boolean) => void;
  applyCopilotActions: (actions: CopilotAction[]) => void;
}

let intentSeq = 0;

const flightIntent = (lat: number, lng: number, distance: number): CameraIntent => ({
  seq: ++intentSeq,
  lat,
  lng,
  distance,
});

export const useOdyssey = create<OdysseyState>((set, get) => ({
  started: false,
  chapterId: "wonders",
  activeDestinationId: null,
  focusedDestinationId: null,
  highlightedIds: [],
  auroraActive: false,
  nightSide: false,
  soundOn: false,
  visualStyle: "stylized",
  perfMode: true,
  copilotOpen: false,
  cameraIntent: null,
  reducedMotion: false,

  begin: () => {
    const first = destinationsForChapter(get().chapterId)[0];
    set({
      started: true,
      focusedDestinationId: first?.id ?? null,
      cameraIntent: first ? flightIntent(first.lat, first.lng, 2.8) : null,
    });
  },

  setChapter: (id, fly = true) => {
    const chapter = CHAPTERS.find((c) => c.id === id);
    const first = destinationsForChapter(id)[0];
    set({ chapterId: id, activeDestinationId: null });
    if (fly && chapter && first) {
      set({
        focusedDestinationId: first.id,
        cameraIntent: flightIntent(first.lat, first.lng, chapter.cameraDistance),
      });
    }
  },

  openDestination: (id) => set({ activeDestinationId: id }),

  closePanel: () => set({ activeDestinationId: null }),

  flyToDestination: (id, openPanel = true) => {
    const dest = destinationById(id);
    if (!dest) return;
    // Keep the chapter rail in sync when the AI flies somewhere off-chapter.
    const { chapterId } = get();
    const nextChapter = dest.chapters.includes(chapterId) ? chapterId : dest.chapters[0];
    set({
      chapterId: nextChapter,
      focusedDestinationId: id,
      cameraIntent: flightIntent(dest.lat, dest.lng, 2.2),
      ...(openPanel ? { activeDestinationId: id } : {}),
    });
  },

  step: (dir) => {
    const { chapterId, focusedDestinationId } = get();
    const list = destinationsForChapter(chapterId);
    if (list.length === 0) return;
    const idx = list.findIndex((d) => d.id === focusedDestinationId);
    const next = idx + dir;

    if (next >= list.length || next < 0) {
      // Roll over into the neighboring chapter.
      const ci = CHAPTERS.findIndex((c) => c.id === chapterId);
      const nc = CHAPTERS[(ci + dir + CHAPTERS.length) % CHAPTERS.length];
      const target = dir === 1 ? destinationsForChapter(nc.id)[0] : destinationsForChapter(nc.id).at(-1);
      set({ chapterId: nc.id, activeDestinationId: null });
      if (target) {
        set({
          focusedDestinationId: target.id,
          cameraIntent: flightIntent(target.lat, target.lng, nc.cameraDistance),
        });
      }
      return;
    }

    const dest = list[next < 0 ? list.length - 1 : next];
    const chapter = CHAPTERS.find((c) => c.id === chapterId)!;
    set({
      focusedDestinationId: dest.id,
      activeDestinationId: null,
      cameraIntent: flightIntent(dest.lat, dest.lng, chapter.cameraDistance),
    });
  },

  setHighlights: (ids) =>
    set({ highlightedIds: ids.filter((id) => DESTINATIONS.some((d) => d.id === id)) }),

  setAurora: (active) => set({ auroraActive: active }),
  toggleNightSide: () => set((s) => ({ nightSide: !s.nightSide })),
  toggleSound: () => set((s) => ({ soundOn: !s.soundOn })),
  toggleVisualStyle: () =>
    set((s) => ({ visualStyle: s.visualStyle === "stylized" ? "realistic" : "stylized" })),
  setPerfMode: (on) => set({ perfMode: on }),
  setCopilotOpen: (open) => set({ copilotOpen: open }),
  setReducedMotion: (v) => set({ reducedMotion: v }),

  applyCopilotActions: (actions) => {
    const s = get();
    for (const action of actions) {
      switch (action.kind) {
        case "flyTo":
          s.flyToDestination(action.destinationId, false);
          break;
        case "highlight":
          s.setHighlights(action.destinationIds);
          break;
        case "aurora":
          s.setAurora(action.active);
          break;
        case "chapter":
          s.setChapter(action.chapterId);
          break;
      }
    }
  },
}));
