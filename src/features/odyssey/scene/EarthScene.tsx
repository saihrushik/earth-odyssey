"use client";

import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { Earth, INITIAL_SUN_DIR, updateSunDir } from "./Earth";
import { Atmosphere } from "./Atmosphere";
import { Moon } from "./Moon";
import { SpaceField } from "./SpaceField";
import { Satellites } from "./Satellites";
import { Aurora } from "./Aurora";
import { Hotspots } from "./Hotspots";
import { GlobePicker } from "./GlobePicker";
import { CameraRig } from "./CameraRig";
import { chapterById } from "../data/chapters";
import { useOdyssey } from "../store/useOdyssey";

/** Eases the space backdrop toward the active chapter's tint. */
function ChapterMood() {
  const scene = useThree((s) => s.scene);
  const chapterId = useOdyssey((s) => s.chapterId);
  const target = useRef(new THREE.Color("#05060f"));

  useFrame((_, delta) => {
    target.current.set(chapterById(chapterId)?.spaceTint ?? "#05060f");
    if (!(scene.background instanceof THREE.Color)) scene.background = new THREE.Color("#05060f");
    (scene.background as THREE.Color).lerp(target.current, Math.min(delta * 1.2, 1));
  });
  return null;
}

/**
 * Directional light that follows the sun (lights clouds & moon). This is the
 * single writer that advances the sun vector each frame — keep it that way,
 * a second writer makes the lighting strobe.
 */
function SunLight({ sun }: { sun: THREE.Vector3 }) {
  const ref = useRef<THREE.DirectionalLight>(null);
  useFrame(({ camera }, delta) => {
    updateSunDir(sun, camera.position, delta);
    ref.current?.position.copy(sun).multiplyScalar(10);
  });
  return <directionalLight ref={ref} intensity={2.2} />;
}

export function EarthScene() {
  // Per-Canvas sun direction. Never module-level: React StrictMode, HMR or a
  // second canvas would create competing frame loops fighting over it.
  const sun = useMemo(() => INITIAL_SUN_DIR.clone(), []);
  const perf = useOdyssey((s) => s.perfMode);
  return (
    <Canvas
      key={perf ? "perf" : "quality"} // dpr/postprocessing changes need a fresh context
      dpr={perf ? [1, 1.25] : [1, 2]}
      camera={{ position: [0, 0.6, 4.6], fov: 42, near: 0.1, far: 200 }}
      gl={{ antialias: true, powerPreference: perf ? "low-power" : "high-performance" }}
      style={{ position: "absolute", inset: 0 }}
    >
      <ChapterMood />
      <ambientLight intensity={0.25} />
      <SunLight sun={sun} />

      <Suspense fallback={null}>
        <SpaceField sun={sun} perf={perf} />
        <Earth sun={sun} perf={perf} />
        <Atmosphere sun={sun} />
        <Aurora />
        <Moon />
        <Satellites />
        <Hotspots />
        <GlobePicker />
      </Suspense>

      <CameraRig />

      {/* Post-processing doubles GPU cost — skipped in performance mode. */}
      {!perf && (
        <EffectComposer>
          <Bloom intensity={0.75} luminanceThreshold={0.25} luminanceSmoothing={0.7} mipmapBlur />
          <Vignette eskil={false} offset={0.18} darkness={0.72} />
        </EffectComposer>
      )}
    </Canvas>
  );
}
