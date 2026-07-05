"use client";

import dynamic from "next/dynamic";

// WebGL can't render on the server, so load the scene client-side only.
const BatScene = dynamic(() => import("./three/BatScene"), { ssr: false });

export default function Hero3DBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 opacity-90">
      <BatScene />
    </div>
  );
}
