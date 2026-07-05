"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A miniature Batman that grips the right-side pole and rides it with scroll:
 *  - scroll down  → he slides down the pole (cape streaming up) into the pit
 *  - scroll up    → he climbs hand-over-hand back up the pole
 *  - reach bottom → he stands guard over the Contact section
 *  - click a nav link / project / skill → he hops (jump animation)
 */
export default function BatmanGuide() {
  const [progress, setProgress] = useState(0); // 0 (top) → 1 (bottom)
  const [goingUp, setGoingUp] = useState(false);
  const [jumping, setJumping] = useState(false);
  const lastY = useRef(0);
  const upTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ticking = useRef(false);

  // Track scroll position + direction (rAF-throttled).
  useEffect(() => {
    const update = () => {
      const scrollable =
        document.documentElement.scrollHeight - window.innerHeight;
      const y = window.scrollY;
      setProgress(scrollable > 0 ? Math.min(1, Math.max(0, y / scrollable)) : 0);

      if (y < lastY.current - 2) {
        setGoingUp(true);
        if (upTimer.current) clearTimeout(upTimer.current);
        upTimer.current = setTimeout(() => setGoingUp(false), 450);
      }
      lastY.current = y;
      ticking.current = false;
    };

    const onScroll = () => {
      if (!ticking.current) {
        ticking.current = true;
        requestAnimationFrame(update);
      }
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (upTimer.current) clearTimeout(upTimer.current);
    };
  }, []);

  // Make him hop when a nav link, project card, or skill is clicked.
  useEffect(() => {
    const triggerJump = () => {
      setJumping(true);
      window.setTimeout(() => setJumping(false), 700);
    };

    const onClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest(
        'a[href^="#"], [data-batman-jump]'
      );
      if (!target) return;
      triggerJump();
      if (target.hasAttribute("data-batman-jump") && target.tagName !== "A") {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  const nearBottom = progress > 0.93;
  const topVh = nearBottom ? 80 : 6 + progress * 78;

  const mode = nearBottom ? "stand" : "ride";
  const animClass = jumping
    ? "bat-anim-jump"
    : nearBottom
      ? ""
      : goingUp
        ? "bat-anim-climb"
        : "bat-anim-slide";

  return (
    <div className="bat-rail hidden md:block" aria-hidden="true">
      <div className="bat-pole" />
      <div className="bat-pit" />

      <div className="bat-figure" style={{ top: `${topVh}vh` }}>
        <div className={animClass}>
          {/* Speed streaks while sliding (not climbing / standing). */}
          {!goingUp && !nearBottom && !jumping && (
            <>
              <span className="bat-streak" style={{ marginLeft: -6 }} />
              <span className="bat-streak" style={{ marginLeft: 6 }} />
            </>
          )}
          {mode === "stand" ? <BatStanding /> : <BatRiding />}
        </div>
      </div>
    </div>
  );
}

/** Batman gripping the pole — limbs are grouped so they can animate. */
function BatRiding() {
  return (
    <svg viewBox="0 0 60 84" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="bg-eye" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="1.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="bg-cape" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#19191f" />
          <stop offset="100%" stopColor="#070709" />
        </linearGradient>
      </defs>

      {/* Cape streaming UP behind him as he slides down */}
      <g className="bat-cape">
        <path
          d="M30 42 C 17 36 14 18 19 4 L 25 17 L 30 6 L 35 17 L 41 4 C 46 18 43 36 30 42 Z"
          fill="url(#bg-cape)"
          stroke="rgba(225,29,42,0.4)"
          strokeWidth="0.8"
        />
      </g>

      {/* Legs (behind body) */}
      <g className="bat-leg-l">
        <path d="M27 53 L23.5 79 L28 79 L30 54 Z" fill="#0a0a0c" />
      </g>
      <g className="bat-leg-r">
        <path d="M33 53 L36.5 79 L32 79 L30 54 Z" fill="#0a0a0c" />
      </g>

      {/* Torso + cowl + emblem + eyes */}
      <g>
        <path
          d="M30 33 C 22 33 21 43 23.5 53 C 26 61 34 61 36.5 53 C 39 43 38 33 30 33 Z"
          fill="#0b0b0d"
          stroke="rgba(225,29,42,0.22)"
          strokeWidth="0.7"
        />
        {/* Red chest emblem */}
        <path
          d="M30 42 l2.4 -2.2 -0.8 3 3 -0.8 -2.2 2.2 2.2 2.2 -3 -0.8 0.8 3 -2.4 -2.2 -2.4 2.2 0.8 -3 -3 0.8 2.2 -2.2 -2.2 -2.2 3 0.8 -0.8 -3 z"
          fill="var(--red-bright)"
          opacity="0.9"
        />
        {/* Cowl with ears */}
        <path
          d="M24 30 L 26 17 L 29 28 C 29.5 26 30.5 26 31 28 L 34 17 L 36 30 C 36 35 24 35 24 30 Z"
          fill="#08080a"
        />
        {/* Glowing eyes */}
        <g filter="url(#bg-eye)" fill="var(--red-bright)">
          <path d="M26.5 28 l3 -1 0 2.4 -3 1 z" />
          <path d="M33.5 28 l-3 -1 0 2.4 3 1 z" />
        </g>
      </g>

      {/* Arms reaching up to grip the pole at top-center */}
      <g className="bat-arm-l">
        <path
          d="M25 40 C 22 31 23 20 27 11 L 30 12 C 27.5 21 28 31 28.5 40 Z"
          fill="#0a0a0c"
        />
        <circle cx="28.5" cy="11.5" r="2.6" fill="#111" stroke="var(--red)" strokeWidth="0.7" />
      </g>
      <g className="bat-arm-r">
        <path
          d="M35 40 C 38 31 37 20 33 11 L 30 12 C 32.5 21 32 31 31.5 40 Z"
          fill="#0a0a0c"
        />
        <circle cx="31.5" cy="11.5" r="2.6" fill="#111" stroke="var(--red)" strokeWidth="0.7" />
      </g>
    </svg>
  );
}

/** Batman standing guard at the bottom — cape draped, arms down. */
function BatStanding() {
  return (
    <svg viewBox="0 0 60 84" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="bs-eye" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="1.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="bs-cape" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#19191f" />
          <stop offset="100%" stopColor="#070709" />
        </linearGradient>
      </defs>

      {/* Draped cape */}
      <path
        d="M30 24 C 13 30 11 54 10 78 L 20 66 L 24 78 L 30 68 L 36 78 L 40 66 L 50 78 C 49 54 47 30 30 24 Z"
        fill="url(#bs-cape)"
        stroke="rgba(225,29,42,0.4)"
        strokeWidth="0.9"
      />
      {/* Body */}
      <path
        d="M30 28 C 22 28 20 38 22 50 C 24 60 36 60 38 50 C 40 38 38 28 30 28 Z"
        fill="#0b0b0d"
      />
      {/* Red emblem */}
      <path
        d="M30 38 l2.6 -2.4 -0.9 3.2 3.2 -0.9 -2.4 2.4 2.4 2.4 -3.2 -0.9 0.9 3.2 -2.6 -2.4 -2.6 2.4 0.9 -3.2 -3.2 0.9 2.4 -2.4 -2.4 -2.4 3.2 0.9 -0.9 -3.2 z"
        fill="var(--red-bright)"
        opacity="0.9"
      />
      {/* Cowl */}
      <path
        d="M22 24 L 24 9 L 28 21 C 29 19 31 19 32 21 L 36 9 L 38 24 C 38 31 22 31 22 24 Z"
        fill="#08080a"
      />
      {/* Eyes */}
      <g filter="url(#bs-eye)" fill="var(--red-bright)">
        <path d="M26 22 l4 -1.4 0 3 -4 1.4 z" />
        <path d="M34 22 l-4 -1.4 0 3 4 1.4 z" />
      </g>
    </svg>
  );
}
