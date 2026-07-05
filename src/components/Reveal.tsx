"use client";

import { useEffect, useRef, useState } from "react";
import { getScrollDirection } from "@/lib/scrollDirection";

type Props = {
  children: React.ReactNode;
  className?: string;
  /** Delay in ms before the element animates in. */
  delay?: number;
  /** "rotate" swings in from the right in 3D; "up" fades up. */
  variant?: "rotate" | "up";
};

/** Animates its children into view when scrolled into view. */
export default function Reveal({
  children,
  className = "",
  delay = 0,
  variant = "rotate",
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Comes in (from the right) whenever it enters view.
          setVisible(true);
        } else if (getScrollDirection() === "up") {
          // Scrolling up: let it swing back out the way it came.
          setVisible(false);
        }
      },
      { threshold: 0.12 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const base = variant === "rotate" ? "reveal-rotate" : "reveal";

  return (
    <div
      ref={ref}
      className={`${base} ${visible ? "is-visible" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
