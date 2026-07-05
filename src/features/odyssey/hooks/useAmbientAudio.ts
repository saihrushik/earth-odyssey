"use client";

import { useEffect, useRef } from "react";

/**
 * Generative ambient soundtrack — two slowly-beating detuned drones through a
 * lowpass filter with a breathing LFO. No audio assets required, starts only
 * after a user gesture (the toggle), and stays deliberately quiet.
 */
export function useAmbientAudio(enabled: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);

  useEffect(() => {
    if (!enabled) {
      // Fade out but keep the context for cheap resume.
      const ctx = ctxRef.current;
      const gain = gainRef.current;
      if (ctx && gain) {
        gain.gain.cancelScheduledValues(ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.2);
      }
      return;
    }

    let ctx = ctxRef.current;
    if (!ctx) {
      ctx = new AudioContext();
      ctxRef.current = ctx;

      const master = ctx.createGain();
      master.gain.value = 0;
      gainRef.current = master;

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 320;
      filter.connect(master);
      master.connect(ctx.destination);

      // Deep space pad: root + slightly detuned fifth, an octave apart.
      const voices: [number, OscillatorType][] = [
        [55, "sine"],
        [55.35, "sine"],
        [82.5, "triangle"],
        [110.2, "sine"],
      ];
      for (const [freq, type] of voices) {
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.value = 0.25;
        osc.connect(g).connect(filter);
        osc.start();
      }

      // Slow "breathing" of the filter cutoff.
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.04;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 140;
      lfo.connect(lfoGain).connect(filter.frequency);
      lfo.start();
    }

    void ctx.resume();
    const gain = gainRef.current!;
    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 2.5);
  }, [enabled]);

  useEffect(
    () => () => {
      void ctxRef.current?.close();
      ctxRef.current = null;
    },
    [],
  );
}
