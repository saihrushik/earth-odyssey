"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Sparkles } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";

/** Right-half outline of the bat emblem (bottom-center → top-center). */
const HALF: [number, number][] = [
  [0.0, -1.0], // bottom point (tail)
  [0.45, -0.52],
  [0.72, -0.82], // scallop 1
  [0.98, -0.42],
  [1.38, -0.68], // scallop 2
  [1.62, -0.28],
  [2.12, -0.42], // outer scallop
  [2.38, 0.04], // wing tip
  [1.78, 0.22],
  [1.5, 0.6], // wing top
  [1.05, 0.32], // shoulder valley
  [0.62, 0.46], // shoulder
  [0.42, 0.26], // neck
  [0.3, 0.8], // ear tip
  [0.12, 0.4], // between ears
  [0.0, 0.5], // head top center
];

function makeBatGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(HALF[0][0], HALF[0][1]);
  for (let i = 1; i < HALF.length; i++) shape.lineTo(HALF[i][0], HALF[i][1]);
  // Mirror back down the left side (skip shared top + bottom points).
  for (let i = HALF.length - 2; i >= 1; i--) shape.lineTo(-HALF[i][0], HALF[i][1]);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.34,
    bevelEnabled: true,
    bevelThickness: 0.12,
    bevelSize: 0.09,
    bevelSegments: 6,
    curveSegments: 24,
  });
  geo.center();
  return geo;
}

function BatEmblem() {
  const geometry = useMemo(makeBatGeometry, []);
  const spin = useRef<THREE.Mesh>(null);
  const tilt = useRef<THREE.Group>(null);

  useFrame((state) => {
    // Gentle left-right turn so it always reads as a bat while showing depth.
    if (spin.current)
      spin.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.55;
    if (tilt.current) {
      // Parallax toward the cursor.
      const tx = -state.pointer.y * 0.28;
      const ty = state.pointer.x * 0.4;
      tilt.current.rotation.x += (tx - tilt.current.rotation.x) * 0.05;
      tilt.current.rotation.y += (ty - tilt.current.rotation.y) * 0.05;
    }
  });

  return (
    <group ref={tilt}>
      <Float speed={1.4} rotationIntensity={0.15} floatIntensity={0.5}>
        <mesh ref={spin} geometry={geometry} castShadow>
          <meshStandardMaterial
            color="#0b0b0d"
            metalness={0.85}
            roughness={0.25}
            emissive="#e11d2a"
            emissiveIntensity={0.55}
          />
        </mesh>
      </Float>
    </group>
  );
}

export default function BatScene() {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0, 5.4], fov: 45 }}
      gl={{ antialias: true, alpha: true }}
      style={{ pointerEvents: "none" }}
    >
      <fog attach="fog" args={["#060607", 5, 12]} />
      <ambientLight intensity={0.35} />
      <pointLight position={[4, 3, 5]} intensity={120} color="#ff2b3c" distance={20} />
      <pointLight position={[-5, -2, 3]} intensity={60} color="#8f0f17" distance={20} />
      <spotLight
        position={[0, 6, 4]}
        angle={0.5}
        penumbra={1}
        intensity={90}
        color="#ffffff"
      />

      <BatEmblem />

      <Sparkles
        count={70}
        scale={[10, 6, 4]}
        size={3}
        speed={0.4}
        opacity={0.6}
        color="#ff2b3c"
      />

      <EffectComposer>
        <Bloom
          intensity={1.1}
          luminanceThreshold={0.2}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
        <Vignette eskil={false} offset={0.25} darkness={0.85} />
      </EffectComposer>
    </Canvas>
  );
}
