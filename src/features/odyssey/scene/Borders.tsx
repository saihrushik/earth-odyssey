"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { Html } from "@react-three/drei";
import { latLngToVector3 } from "../lib/geo";
import { useOdyssey } from "../store/useOdyssey";
import { EARTH_RADIUS } from "./Earth";
import rawBorders from "../data/borders.json";
import rawCities from "../data/cities.json";

/**
 * Map-style orientation layer: country outlines and major city dots.
 *
 * Both sit a hair above the surface so the globe itself depth-occludes the
 * far side — no back-face bleed-through, no per-frame work. Borders arrive as
 * flat [lng, lat, lng, lat, …] rings and are flattened into ONE LineSegments
 * geometry (10.5k points, one draw call); cities are ONE instanced Points.
 */

// Just off the surface: high enough to clear z-fighting, low enough to stay glued.
const BORDER_R = EARTH_RADIUS * 1.0015;
const CITY_R = EARTH_RADIUS * 1.004;

type City = { n: string; r: number; c: string; lat: number; lng: number };

const BORDER_RINGS = rawBorders as number[][];
const CITIES = rawCities as City[];

/** Country outlines as one merged line soup. */
function BorderLines({ color, opacity }: { color: string; opacity: number }) {
  const geometry = useMemo(() => {
    // Two vertices per segment; a ring of n points yields n-1 segments.
    const verts: number[] = [];
    for (const ring of BORDER_RINGS) {
      for (let i = 0; i + 3 < ring.length; i += 2) {
        latLngToVector3(ring[i + 1], ring[i], BORDER_R).toArray(verts, verts.length);
        latLngToVector3(ring[i + 3], ring[i + 2], BORDER_R).toArray(verts, verts.length);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    return geo;
  }, []);

  return (
    <lineSegments geometry={geometry} renderOrder={2}>
      {/* Normal blending, not additive: additive vanishes over bright daylight
          terrain and blows out over the night side. A flat overlay reads on both. */}
      <lineBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
    </lineSegments>
  );
}

/** Major city dots — the "you are here" anchors that make pinning readable. */
function CityDots({ color, maxRank }: { color: string; maxRank: number }) {
  const geometry = useMemo(() => {
    const verts: number[] = [];
    for (const c of CITIES) {
      if (c.r > maxRank) continue;
      latLngToVector3(c.lat, c.lng, CITY_R).toArray(verts, verts.length);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    return geo;
  }, [maxRank]);

  return (
    <points geometry={geometry} renderOrder={3}>
      <pointsMaterial
        color={color}
        size={0.013}
        sizeAttenuation
        transparent
        opacity={0.85}
        depthWrite={false}
      />
    </points>
  );
}

/**
 * Labels for the handful of world-capital-tier cities. Rendered as DOM so they
 * stay crisp; `occlude` lets the globe hide the ones on the far side.
 */
function CityLabels() {
  const top = useMemo(() => CITIES.filter((c) => c.r === 0).slice(0, 28), []);
  return (
    <>
      {top.map((c) => (
        <Html
          key={`${c.n}-${c.lat}`}
          position={latLngToVector3(c.lat, c.lng, CITY_R)}
          center
          occlude="blending"
          zIndexRange={[5, 0]}
          style={{ pointerEvents: "none" }}
        >
          <span
            className="whitespace-nowrap text-[9px] tracking-[0.12em] text-sky-100/55 uppercase"
            style={{ textShadow: "0 1px 6px rgba(0,0,0,0.9)" }}
          >
            {c.n}
          </span>
        </Html>
      ))}
    </>
  );
}

export function Borders() {
  const on = useOdyssey((s) => s.bordersOn);
  const stylized = useOdyssey((s) => s.visualStyle === "stylized");
  const perf = useOdyssey((s) => s.perfMode);

  if (!on) return null;

  // The illustrated globe is flat and pale — borders need to be darker and
  // firmer there; on the photoreal earth a cool glow reads better.
  const lineColor = stylized ? "#1e5f8a" : "#cfe9ff";
  const lineOpacity = stylized ? 0.7 : 0.55;

  return (
    <group>
      <BorderLines color={lineColor} opacity={lineOpacity} />
      <CityDots color={stylized ? "#12406b" : "#ffffff"} maxRank={perf ? 1 : 3} />
      {/* DOM labels are the only per-frame cost here — skipped on low-power. */}
      {!perf && <CityLabels />}
    </group>
  );
}
