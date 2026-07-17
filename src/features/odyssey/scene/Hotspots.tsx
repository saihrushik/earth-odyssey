"use client";

import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { DESTINATIONS } from "../data/destinations";
import { chapterById } from "../data/chapters";
import type { Destination } from "../data/types";
import { latLngToVector3 } from "../lib/geo";
import { useOdyssey } from "../store/useOdyssey";

const SURFACE = 1.008;

function Hotspot({ dest }: { dest: Destination }) {
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const dotMat = useRef<THREE.MeshBasicMaterial>(null);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null);
  const [hovered, setHovered] = useState(false);
  // Html labels live in the DOM, outside the WebGL visibility tree — track
  // whether this pin faces the camera so far-side labels actually unmount.
  const [facingCam, setFacingCam] = useState(false);
  const facingRef = useRef(false);

  const chapterId = useOdyssey((s) => s.chapterId);
  const focusedId = useOdyssey((s) => s.focusedDestinationId);
  const highlighted = useOdyssey((s) => s.highlightedIds.includes(dest.id));
  const flyTo = useOdyssey((s) => s.flyToDestination);

  const position = useMemo(() => latLngToVector3(dest.lat, dest.lng, SURFACE), [dest]);
  const normal = useMemo(() => position.clone().normalize(), [position]);
  const phase = useMemo(() => Math.random() * Math.PI * 2, []);

  const inChapter = dest.chapters.includes(chapterId);
  const focused = focusedId === dest.id;
  const accent = chapterById(chapterId)?.accent ?? "#7fd4ff";
  const color = highlighted ? "#8ffcff" : focused ? "#ffffff" : inChapter ? accent : "#7c8aa0";

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    // Fade out hotspots on the far side of the globe.
    const camDir = state.camera.position.clone().normalize();
    const facing = THREE.MathUtils.smoothstep(normal.dot(camDir), 0.05, 0.35);
    const emphasis = highlighted || focused ? 1 : inChapter ? 0.85 : 0.45;
    if (dotMat.current) dotMat.current.opacity = facing * emphasis;
    if (ringMat.current) ringMat.current.opacity = facing * emphasis * 0.7;
    if (ring.current) {
      const pulse = 1 + 0.35 * (0.5 + 0.5 * Math.sin(t * 2.2 + phase)) * (highlighted ? 1.8 : 1);
      ring.current.scale.setScalar(pulse);
    }
    if (group.current) group.current.visible = facing > 0.02;
    const facingNow = facing > 0.3;
    if (facingNow !== facingRef.current) {
      facingRef.current = facingNow;
      setFacingCam(facingNow);
    }
  });

  return (
    <group ref={group} position={position} onUpdate={(g) => g.lookAt(normal.clone().multiplyScalar(2))}>
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          flyTo(dest.id, true);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = "auto";
        }}
      >
        {/* generous invisible hit area */}
        <sphereGeometry args={[0.035, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <mesh>
        <circleGeometry args={[0.012, 24]} />
        <meshBasicMaterial ref={dotMat} color={color} transparent toneMapped={false} />
      </mesh>
      <mesh ref={ring}>
        <ringGeometry args={[0.02, 0.026, 32]} />
        <meshBasicMaterial
          ref={ringMat}
          color={color}
          transparent
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {facingCam && (hovered || focused || highlighted) && (
        <Html center position={[0, 0.045, 0]} style={{ pointerEvents: "none" }}>
          <div
            style={{
              whiteSpace: "nowrap",
              padding: "4px 10px",
              borderRadius: 999,
              fontSize: 11,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "rgba(235,245,255,0.95)",
              background: "rgba(8,14,26,0.55)",
              border: `1px solid ${color}55`,
              backdropFilter: "blur(8px)",
            }}
          >
            {dest.name}
          </div>
        </Html>
      )}
    </group>
  );
}

/** Gold marker for a searched / clicked place — replaces the catalog pins. */
function CustomPinMarker() {
  const pin = useOdyssey((s) => s.customPin);
  const ring = useRef<THREE.Mesh>(null);
  const position = useMemo(
    () => (pin ? latLngToVector3(pin.lat, pin.lng, SURFACE) : null),
    [pin],
  );

  useFrame((state) => {
    if (ring.current) {
      const pulse = 1 + 0.4 * (0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 2.6));
      ring.current.scale.setScalar(pulse);
    }
  });

  if (!pin || !position) return null;
  const normal = position.clone().normalize();
  return (
    <group position={position} onUpdate={(g) => g.lookAt(normal.clone().multiplyScalar(2))}>
      <mesh>
        <circleGeometry args={[0.014, 24]} />
        <meshBasicMaterial color="#ffd166" transparent toneMapped={false} />
      </mesh>
      <mesh ref={ring}>
        <ringGeometry args={[0.022, 0.03, 32]} />
        <meshBasicMaterial color="#ffd166" transparent toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <Html center position={[0, 0.05, 0]} style={{ pointerEvents: "none" }}>
        <div
          style={{
            whiteSpace: "nowrap",
            padding: "4px 10px",
            borderRadius: 999,
            fontSize: 11,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#fff7e6",
            background: "rgba(26,20,8,0.6)",
            border: "1px solid #ffd16688",
            backdropFilter: "blur(8px)",
          }}
        >
          {pin.name}
        </div>
      </Html>
    </group>
  );
}

export function Hotspots() {
  const hasCustomPin = useOdyssey((s) => s.customPin !== null);
  return (
    <group>
      {/* A dropped pin takes the stage alone — catalog pins come back on clear. */}
      {!hasCustomPin && DESTINATIONS.map((d) => <Hotspot key={d.id} dest={d} />)}
      <CustomPinMarker />
    </group>
  );
}
