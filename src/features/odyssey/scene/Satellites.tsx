"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface Orbit {
  radius: number;
  speed: number;
  inclination: number;
  phase: number;
  size: number;
  color: string;
}

/** The ISS plus a few smaller satellites on inclined circular orbits. */
const ORBITS: Orbit[] = [
  { radius: 1.18, speed: 0.55, inclination: 0.9, phase: 0, size: 0.016, color: "#ffffff" }, // ISS
  { radius: 1.32, speed: 0.32, inclination: 1.7, phase: 2.1, size: 0.009, color: "#9fd8ff" },
  { radius: 1.45, speed: 0.24, inclination: 0.4, phase: 4.4, size: 0.008, color: "#ffd9a0" },
  { radius: 1.6, speed: 0.18, inclination: 2.4, phase: 1.2, size: 0.008, color: "#c9c9ff" },
];

const X_AXIS = new THREE.Vector3(1, 0, 0);

export function Satellites() {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const scratch = useMemo(() => new THREE.Vector3(), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    ORBITS.forEach((o, i) => {
      const mesh = refs.current[i];
      if (!mesh) return;
      const angle = o.phase + t * o.speed;
      scratch.set(Math.cos(angle), 0, Math.sin(angle)).multiplyScalar(o.radius);
      scratch.applyAxisAngle(X_AXIS, o.inclination);
      mesh.position.copy(scratch);
    });
  });

  return (
    <group>
      {ORBITS.map((o, i) => (
        <mesh key={i} ref={(el) => void (refs.current[i] = el)}>
          <sphereGeometry args={[o.size, 8, 8]} />
          <meshBasicMaterial color={o.color} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}
