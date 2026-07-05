"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { EARTH_RADIUS } from "./Earth";

const VERT = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main() {
    vNormal = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uSunDir;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main() {
    // Rendered on the back faces of an inflated sphere: glow strongest at the limb.
    vec3 n = normalize(vNormal);
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float intensity = pow(0.62 - dot(n, viewDir), 3.5);
    float sun = max(dot(n, uSunDir), 0.0) * 0.85 + 0.15;
    vec3 col = mix(vec3(0.1, 0.3, 0.9), vec3(0.35, 0.65, 1.0), sun);
    gl_FragColor = vec4(col, 1.0) * intensity * sun * 1.4;
  }
`;

/** Soft blue halo hugging the planet's limb. */
export function Atmosphere({ sun }: { sun: THREE.Vector3 }) {
  // Shares this Canvas's live sun vector, so the glow follows the terminator.
  const uniforms = useMemo(() => ({ uSunDir: { value: sun } }), [sun]);
  return (
    <mesh scale={1.15}>
      <sphereGeometry args={[EARTH_RADIUS, 64, 64]} />
      <shaderMaterial
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
        blending={THREE.AdditiveBlending}
        side={THREE.BackSide}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}
