"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { useOdyssey } from "../store/useOdyssey";

export const EARTH_RADIUS = 1;

/** Initial sun direction; each Canvas owns its own live vector (see EarthScene). */
export const INITIAL_SUN_DIR = new THREE.Vector3(-2.2, 0.9, 1.6).normalize();

const SUN_AZIMUTH_OFFSET = -0.85; // radians west of the camera
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const sunScratch = new THREE.Vector3();

/**
 * Advance a sun-direction vector so it lazily trails the camera with an
 * azimuth offset — the viewer always sees a cinematic terminator: day ahead,
 * city lights sliding into night behind. Must have exactly ONE caller per
 * vector per frame (a second writer makes the lighting strobe).
 */
export function updateSunDir(sun: THREE.Vector3, cameraPos: THREE.Vector3, delta: number) {
  sunScratch.copy(cameraPos).normalize();
  sunScratch.applyAxisAngle(Y_AXIS, SUN_AZIMUTH_OFFSET);
  sunScratch.y = THREE.MathUtils.clamp(sunScratch.y, -0.35, 0.55);
  sunScratch.normalize();
  // Frame-rate-independent easing; immune to delta spikes.
  const t = 1 - Math.exp(-0.9 * delta);
  sun.lerp(sunScratch, t).normalize();
}

const EARTH_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main() {
    vUv = uv;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const EARTH_FRAG = /* glsl */ `
  uniform sampler2D uDay;
  uniform sampler2D uNight;
  uniform sampler2D uOceanMask;
  uniform vec3 uSunDir;
  uniform vec3 uCameraPos;
  uniform float uNightBoost;
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPos;

  void main() {
    vec3 n = normalize(vNormal);
    vec3 viewDir = normalize(uCameraPos - vWorldPos);

    vec3 day = texture2D(uDay, vUv).rgb;
    vec3 night = texture2D(uNight, vUv).rgb;
    float ocean = texture2D(uOceanMask, vUv).r;

    float sunLit = dot(n, uSunDir);
    // Wide, soft terminator.
    float dayAmount = smoothstep(-0.12, 0.35, sunLit) * (1.0 - uNightBoost);

    // Animated ocean glint: jittered specular reflection of the sun.
    vec3 ripple = n + 0.015 * vec3(
      sin(vWorldPos.y * 90.0 + uTime * 1.4),
      sin(vWorldPos.x * 80.0 - uTime * 1.1),
      sin(vWorldPos.z * 85.0 + uTime * 1.7)
    );
    vec3 r = reflect(-uSunDir, normalize(ripple));
    float spec = pow(max(dot(r, viewDir), 0.0), 22.0) * ocean * dayAmount;

    vec3 dayCol = day * (0.35 + 0.85 * max(sunLit, 0.0)) + spec * vec3(1.0, 0.9, 0.7) * 0.6;
    vec3 nightCol = night * 1.6 + day * 0.02;

    vec3 col = mix(nightCol, dayCol, dayAmount);

    // Thin atmospheric rim tint on the limb.
    float rim = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);
    col += rim * vec3(0.25, 0.5, 1.0) * 0.35;

    gl_FragColor = vec4(col, 1.0);
  }
`;

export function Earth({ sun }: { sun: THREE.Vector3 }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);
  const nightSide = useOdyssey((s) => s.nightSide);

  const [day, night, clouds, ocean] = useTexture([
    "/odyssey/textures/earth_atmos_2048.jpg",
    "/odyssey/textures/earth_lights_2048.png",
    "/odyssey/textures/earth_clouds_1024.png",
    "/odyssey/textures/earth_specular_2048.jpg",
  ]);
  day.colorSpace = THREE.SRGBColorSpace;
  night.colorSpace = THREE.SRGBColorSpace;
  day.anisotropy = night.anisotropy = 8;

  const uniforms = useMemo(
    () => ({
      uDay: { value: day },
      uNight: { value: night },
      uOceanMask: { value: ocean },
      uSunDir: { value: sun }, // live reference owned by this Canvas

      uCameraPos: { value: new THREE.Vector3() },
      uNightBoost: { value: 0 },
      uTime: { value: 0 },
    }),
    [day, night, ocean, sun],
  );

  // The sun vector itself is advanced once per frame by <SunLight> in EarthScene.
  useFrame((state, delta) => {
    const u = matRef.current?.uniforms;
    if (u) {
      u.uTime.value = state.clock.elapsedTime;
      u.uCameraPos.value.copy(state.camera.position);
      u.uNightBoost.value = THREE.MathUtils.damp(u.uNightBoost.value, nightSide ? 1 : 0, 3, delta);
    }
    if (cloudsRef.current) {
      cloudsRef.current.rotation.y += delta * 0.008; // independent cloud drift
    }
  });

  return (
    <group>
      <mesh>
        <sphereGeometry args={[EARTH_RADIUS, 96, 96]} />
        <shaderMaterial
          ref={matRef}
          vertexShader={EARTH_VERT}
          fragmentShader={EARTH_FRAG}
          uniforms={uniforms}
        />
      </mesh>
      <mesh ref={cloudsRef}>
        <sphereGeometry args={[EARTH_RADIUS * 1.012, 64, 64]} />
        <meshLambertMaterial
          map={clouds}
          transparent
          opacity={nightSide ? 0.18 : 0.5}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
