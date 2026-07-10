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
  uniform float uStylized;
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

    vec3 realCol = mix(nightCol, dayCol, dayAmount);

    // ---- Stylized "illustrated" look -----------------------------------
    // Flat two-tone ocean with soft animated wave bands.
    float lat = n.y;
    vec3 oceanDeep = vec3(0.07, 0.26, 0.52);
    vec3 oceanLight = vec3(0.16, 0.47, 0.78);
    float waves = sin(vUv.y * 140.0 + uTime * 0.35) * sin(vUv.x * 90.0 - uTime * 0.22);
    vec3 tOcean = mix(oceanDeep, oceanLight, 0.5 + 0.4 * lat + 0.04 * waves);

    // Posterized, saturation-boosted land.
    vec3 land = day;
    float luma = dot(land, vec3(0.299, 0.587, 0.114));
    land = clamp(mix(vec3(luma), land, 1.9), 0.0, 1.0);   // saturate
    land = floor(land * 5.0) / 5.0 + 0.06;                 // posterize
    land = mix(land, vec3(0.32, 0.62, 0.36), 0.18);        // unify toward leafy green

    vec3 tSurface = mix(land, tOcean, smoothstep(0.35, 0.6, ocean));

    // Three-band toon terminator: day / warm dusk / deep-blue night.
    float band = smoothstep(-0.18, -0.02, sunLit);
    float dayBand = smoothstep(0.02, 0.22, sunLit);
    vec3 duskTint = vec3(1.0, 0.62, 0.42);
    vec3 tNight = tSurface * vec3(0.10, 0.13, 0.28);
    // City lights as posterized warm dots.
    float lightsMask = step(0.24, dot(night, vec3(1.0)) / 3.0);
    tNight += lightsMask * vec3(1.0, 0.83, 0.5) * 0.9;
    vec3 tDusk = mix(tNight, tSurface * duskTint, 0.75);
    vec3 tDay = tSurface * (0.92 + 0.18 * dayBand);
    float toonDay = (1.0 - uNightBoost);
    vec3 toonCol = mix(tNight, mix(tDusk, tDay, dayBand * toonDay), band * toonDay + (1.0 - toonDay) * 0.0);
    // Chunky pastel rim.
    float toonRim = smoothstep(0.55, 0.95, 1.0 - max(dot(n, viewDir), 0.0));
    toonCol += toonRim * mix(vec3(0.35, 0.75, 1.0), vec3(0.65, 0.55, 1.0), 0.5 + 0.5 * lat) * 0.5;
    // --------------------------------------------------------------------

    // Realistic rim.
    float rim = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);
    realCol += rim * vec3(0.25, 0.5, 1.0) * 0.35;

    vec3 col = mix(realCol, toonCol, uStylized);
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function Earth({ sun, perf }: { sun: THREE.Vector3; perf: boolean }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);
  const nightSide = useOdyssey((s) => s.nightSide);
  const stylized = useOdyssey((s) => s.visualStyle === "stylized");

  const [day, night, clouds, ocean] = useTexture([
    "/odyssey/textures/earth_atmos_2048.jpg",
    "/odyssey/textures/earth_lights_2048.png",
    "/odyssey/textures/earth_clouds_1024.png",
    "/odyssey/textures/earth_specular_2048.jpg",
  ]);
  day.colorSpace = THREE.SRGBColorSpace;
  night.colorSpace = THREE.SRGBColorSpace;
  day.anisotropy = night.anisotropy = perf ? 2 : 8;

  const uniforms = useMemo(
    () => ({
      uDay: { value: day },
      uNight: { value: night },
      uOceanMask: { value: ocean },
      uSunDir: { value: sun }, // live reference owned by this Canvas

      uCameraPos: { value: new THREE.Vector3() },
      uNightBoost: { value: 0 },
      uStylized: { value: 1 },
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
      u.uStylized.value = THREE.MathUtils.damp(u.uStylized.value, stylized ? 1 : 0, 4, delta);
    }
    if (cloudsRef.current) {
      cloudsRef.current.rotation.y += delta * 0.008; // independent cloud drift
    }
  });

  return (
    <group>
      <mesh>
        <sphereGeometry args={[EARTH_RADIUS, perf ? 48 : 96, perf ? 48 : 96]} />
        <shaderMaterial
          ref={matRef}
          vertexShader={EARTH_VERT}
          fragmentShader={EARTH_FRAG}
          uniforms={uniforms}
        />
      </mesh>
      <mesh ref={cloudsRef}>
        <sphereGeometry args={[EARTH_RADIUS * 1.012, perf ? 32 : 64, perf ? 32 : 64]} />
        <meshLambertMaterial
          map={clouds}
          transparent
          opacity={nightSide ? 0.18 : stylized ? 0.65 : 0.5}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
