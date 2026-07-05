"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

const ORBIT_RADIUS = 6.5;
const ORBIT_TILT = 0.18;

export function Moon() {
  const pivot = useRef<THREE.Group>(null);
  const moon = useRef<THREE.Mesh>(null);
  const map = useTexture("/odyssey/textures/moon_1024.jpg");
  map.colorSpace = THREE.SRGBColorSpace;

  useFrame((_, delta) => {
    if (pivot.current) pivot.current.rotation.y += delta * 0.02;
    if (moon.current) moon.current.rotation.y += delta * 0.005;
  });

  return (
    <group rotation-x={ORBIT_TILT} ref={pivot}>
      <mesh ref={moon} position={[ORBIT_RADIUS, 0, 0]}>
        <sphereGeometry args={[0.27, 48, 48]} />
        <meshStandardMaterial map={map} roughness={1} />
      </mesh>
    </group>
  );
}
