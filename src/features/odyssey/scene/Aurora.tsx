"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useOdyssey } from "../store/useOdyssey";

const VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  varying vec2 vUv;

  // Cheap value noise for the shimmering curtain folds.
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }

  void main() {
    float curtains =
      noise(vec2(vUv.x * 14.0 + uTime * 0.18, uTime * 0.07)) * 0.6 +
      noise(vec2(vUv.x * 41.0 - uTime * 0.28, uTime * 0.12)) * 0.4;
    // Fade toward top of the curtain and both edges.
    float vertical = smoothstep(0.0, 0.15, vUv.y) * (1.0 - smoothstep(0.35, 1.0, vUv.y));
    float a = curtains * vertical * uIntensity;
    vec3 green = vec3(0.15, 1.0, 0.45);
    vec3 purple = vec3(0.55, 0.25, 1.0);
    vec3 col = mix(green, purple, smoothstep(0.25, 0.95, vUv.y));
    gl_FragColor = vec4(col * a * 1.8, a);
  }
`;

/**
 * Aurora curtain — a truncated cone hovering over the polar circle.
 * Always faintly present in the north; blooms to full strength when activated.
 */
export function Aurora() {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const active = useOdyssey((s) => s.auroraActive);

  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uIntensity: { value: 0.12 } }), []);

  useFrame((state, delta) => {
    const u = matRef.current?.uniforms;
    if (!u) return;
    u.uTime.value = state.clock.elapsedTime;
    u.uIntensity.value = THREE.MathUtils.damp(u.uIntensity.value, active ? 0.95 : 0.12, 2, delta);
  });

  // Polar circle at ~68°N: ring radius ≈ cos(68°), height above surface.
  const ringR = Math.cos((68 * Math.PI) / 180) * 1.02;
  const y = Math.sin((68 * Math.PI) / 180) * 1.02;

  return (
    <mesh position={[0, y, 0]}>
      {/* openEnded cone: radiusTop slightly smaller for the curtain lean */}
      <cylinderGeometry args={[ringR * 0.82, ringR, 0.22, 96, 1, true]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
