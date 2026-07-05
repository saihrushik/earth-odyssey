"use client";

import { useEffect, useRef, useState } from "react";
import { navLinks, profile, socials } from "@/lib/data";

export default function OrbitHero() {
  const stageRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const pausedRef = useRef(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const speed = reduce ? 0 : 0.16; // radians / second
    const n = navLinks.length;
    let rot = -Math.PI / 2; // start first node at top
    let last = performance.now();
    let raf = 0;

    const place = () => {
      const stage = stageRef.current;
      const r = stage ? stage.offsetWidth * 0.46 : 200;
      nodeRefs.current.forEach((el, i) => {
        if (!el) return;
        const a = (i / n) * Math.PI * 2 + rot;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        el.style.transform = `translate(calc(-50% + ${x.toFixed(
          1
        )}px), calc(-50% + ${y.toFixed(1)}px))`;
      });
    };

    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (!pausedRef.current) rot += speed * dt;
      place();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <section
      id="top"
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-24"
    >
      {/* Tagline banner */}
      <div className="relative z-10 mb-8 text-center">
        <p className="inline-flex items-center gap-2 rounded-full border border-red/40 bg-red/5 px-4 py-1.5 font-mono text-xs text-red-bright box-glow-soft">
          <span className="h-1.5 w-1.5 animate-pulse-glow rounded-full bg-red-bright" />
          {profile.graduating} · Open to opportunities
        </p>
      </div>

      {/* Orbit stage */}
      <div
        ref={stageRef}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        className="orbit-stage relative z-10"
      >
        {/* Decorative rings */}
        <span className="orbit-ring" style={{ inset: "2%" }} />
        <span className="orbit-ring" style={{ inset: "26%" }} />

        {/* Center: your name, framed by a faint Batman silhouette */}
        <div className="orbit-core">
          <div className="orbit-core-bat">
            <BatHero />
          </div>
          <div className="orbit-core-name">
            <div>
              <h1 className="text-gradient text-glow text-2xl font-bold leading-tight tracking-tight sm:text-3xl md:text-4xl">
                {profile.name}
              </h1>
              <p className="mt-2 font-mono text-xs text-red-bright sm:text-sm">
                {profile.role}
              </p>
            </div>
          </div>
        </div>

        {/* Orbiting section nodes */}
        {navLinks.map((link, i) => (
          <a
            key={link.href}
            href={link.href}
            ref={(el) => {
              nodeRefs.current[i] = el;
            }}
            className="orbit-node group"
          >
            <span className="orbit-dot" />
            <span className="orbit-label">{link.label}</span>
          </a>
        ))}
      </div>

      {/* CTA buttons */}
      <div className="relative z-10 mt-10 flex flex-wrap items-center justify-center gap-4">
        <a
          href="#projects"
          className="rounded-lg bg-red px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-red-bright hover:box-glow"
        >
          View my work
        </a>
        <a
          href={socials.resume}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-border px-6 py-3 text-sm font-semibold text-foreground transition-all hover:border-red/60 hover:box-glow"
        >
          Download résumé ↓
        </a>
      </div>

      <p className="relative z-10 mt-6 font-mono text-xs text-muted-2">
        hover to pause · click a planet to explore
      </p>
    </section>
  );
}

/** Big heroic Batman that stands at the center of the orbit. */
function BatHero() {
  return (
    <svg
      viewBox="0 0 120 150"
      xmlns="http://www.w3.org/2000/svg"
      className="orbit-bat"
    >
      <defs>
        <filter id="oh-eye" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="1.8" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="oh-cape" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1b1b22" />
          <stop offset="100%" stopColor="#070709" />
        </linearGradient>
        <radialGradient id="oh-floor" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(225,29,42,0.5)" />
          <stop offset="100%" stopColor="rgba(225,29,42,0)" />
        </radialGradient>
      </defs>

      {/* Ground glow */}
      <ellipse cx="60" cy="139" rx="36" ry="7" fill="url(#oh-floor)" />

      {/* Cape spread wide, sharp + angular */}
      <path
        d="M60 38 C 26 46 19 88 12 134 L 33 108 L 38 132 L 49 110 L 60 136 L 71 110 L 82 132 L 87 108 L 108 134 C 101 88 94 46 60 38 Z"
        fill="url(#oh-cape)"
        stroke="rgba(225,29,42,0.4)"
        strokeWidth="1.2"
      />

      {/* Raised cape collar framing the cowl */}
      <path d="M50 50 C 42 46 39 33 43 24 L 52 47 Z" fill="#0a0a0d" />
      <path d="M70 50 C 78 46 81 33 77 24 L 68 47 Z" fill="#0a0a0d" />

      {/* Legs — planted, slightly apart */}
      <path d="M52 96 L47 132 L56 132 L59 98 Z" fill="#0a0a0c" />
      <path d="M68 96 L73 132 L64 132 L61 98 Z" fill="#0a0a0c" />

      {/* Body — broad shoulders, tapered waist */}
      <path
        d="M60 52 C 43 52 41 66 45 86 C 48 100 72 100 75 86 C 79 66 77 52 60 52 Z"
        fill="#0c0c0f"
        stroke="rgba(225,29,42,0.22)"
        strokeWidth="0.9"
      />

      {/* Red chest emblem */}
      <path
        d="M60 64 l4.5 -4 -1.4 5.4 5.4 -1.4 -4 4 4 4 -5.4 -1.4 1.4 5.4 -4.5 -4 -4.5 4 1.4 -5.4 -5.4 1.4 4 -4 -4 -4 5.4 1.4 -1.4 -5.4 z"
        fill="var(--red-bright)"
        opacity="0.9"
      />

      {/* Arms — muscular, fists clenched at sides */}
      <path d="M45 56 C 36 62 34 80 38 94 L 45 92 C 43 78 45 66 50 60 Z" fill="#0a0a0c" />
      <path d="M75 56 C 84 62 86 80 82 94 L 75 92 C 77 78 75 66 70 60 Z" fill="#0a0a0c" />
      <circle cx="40" cy="95" r="3.4" fill="#0c0c0f" />
      <circle cx="80" cy="95" r="3.4" fill="#0c0c0f" />

      {/* Angular cowl — tall sharp ears, defined jaw */}
      <path
        d="M49 46 L 45 17 L 55 41 C 57 38 63 38 65 41 L 75 17 L 71 46 C 71 55 67 60 60 60 C 53 60 49 55 49 46 Z"
        fill="#070709"
      />

      {/* Brow shadow — angry V */}
      <path
        d="M52 42 L60 47 L68 42 L66 45 L60 49 L54 45 Z"
        fill="#000"
        opacity="0.55"
      />

      {/* Narrow, slanted, menacing eyes */}
      <g filter="url(#oh-eye)" fill="var(--red-bright)">
        <path d="M52.5 43 L59 47 L58 49 L52.5 45.5 Z" />
        <path d="M67.5 43 L61 47 L62 49 L67.5 45.5 Z" />
      </g>
    </svg>
  );
}
