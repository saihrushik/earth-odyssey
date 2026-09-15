"use client";

import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import gsap from "gsap";
import { latLngToVector3 } from "../lib/geo";
import { beginPinch, endPinch } from "../lib/pinch";
import { useOdyssey } from "../store/useOdyssey";

const MIN_DIST = 1.35;
const MAX_DIST = 7;

/**
 * Owns all camera motion:
 *  - free orbit/drag via OrbitControls (zoom disabled there — see pinch handler below)
 *  - manual two-finger pinch-to-zoom (kept out of OrbitControls so desktop's
 *    wheel-to-step-destination gesture never fights a built-in wheel-zoom)
 *  - cinematic GSAP flights whenever the store publishes a camera intent
 *  - slow automatic rotation while idle
 */
export function CameraRig() {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const tweenRef = useRef<gsap.core.Tween | null>(null);

  const cameraIntent = useOdyssey((s) => s.cameraIntent);
  const started = useOdyssey((s) => s.started);
  const activePanel = useOdyssey((s) => s.activeDestinationId);
  const reducedMotion = useOdyssey((s) => s.reducedMotion);
  const step = useOdyssey((s) => s.step);

  // ---- Cinematic flights -------------------------------------------------
  useEffect(() => {
    if (!cameraIntent) return;
    const { lat, lng, distance } = cameraIntent;

    tweenRef.current?.kill();

    const from = new THREE.Spherical().setFromVector3(camera.position);
    const to = new THREE.Spherical().setFromVector3(
      latLngToVector3(lat, lng, THREE.MathUtils.clamp(distance, MIN_DIST, MAX_DIST)),
    );
    // Take the short way around.
    while (to.theta - from.theta > Math.PI) to.theta -= Math.PI * 2;
    while (to.theta - from.theta < -Math.PI) to.theta += Math.PI * 2;

    if (reducedMotion) {
      camera.position.setFromSpherical(to);
      camera.lookAt(0, 0, 0);
      return;
    }

    // Pull back mid-flight proportionally to how far we travel.
    const travel = Math.abs(to.theta - from.theta) + Math.abs(to.phi - from.phi);
    const bump = Math.min(travel * 0.35, 1.2);

    const proxy = { t: 0 };
    const spherical = new THREE.Spherical();
    tweenRef.current = gsap.to(proxy, {
      t: 1,
      duration: 1.6 + Math.min(travel * 0.45, 1.4),
      ease: "power2.inOut",
      onUpdate: () => {
        const t = proxy.t;
        spherical.set(
          THREE.MathUtils.lerp(from.radius, to.radius, t) + Math.sin(Math.PI * t) * bump,
          THREE.MathUtils.lerp(from.phi, to.phi, t),
          THREE.MathUtils.lerp(from.theta, to.theta, t),
        );
        camera.position.setFromSpherical(spherical);
        camera.lookAt(0, 0, 0);
      },
    });

    return () => void tweenRef.current?.kill();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraIntent?.seq]);

  // ---- Wheel = fly to the next / previous destination ---------------------
  useEffect(() => {
    const el = gl.domElement;
    let acc = 0;
    let lastFire = 0;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (!useOdyssey.getState().started) return;
      const now = performance.now();
      if (now - lastFire < 1200) return; // one destination per gesture
      acc += e.deltaY;
      if (Math.abs(acc) > 60) {
        step(acc > 0 ? 1 : -1);
        acc = 0;
        lastFire = now;
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [gl, step]);

  // ---- Pinch = zoom in / out (touch devices) -----------------------------
  useEffect(() => {
    const el = gl.domElement;
    const spherical = new THREE.Spherical();
    let startGap = 0;
    let startRadius = 0;

    const gapOf = (t: TouchList) =>
      Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      tweenRef.current?.kill(); // a pinch takes over from any in-progress flight
      beginPinch(); // so lifting off doesn't read as a tap on the globe
      startGap = gapOf(e.touches);
      startRadius = camera.position.length();
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || startGap === 0) return;
      e.preventDefault(); // stop the browser zooming the page instead
      const gap = gapOf(e.touches);
      if (gap === 0) return;
      // Fingers apart → smaller radius → closer to the planet.
      spherical.setFromVector3(camera.position);
      spherical.radius = THREE.MathUtils.clamp(startRadius * (startGap / gap), MIN_DIST, MAX_DIST);
      camera.position.setFromSpherical(spherical);
      camera.lookAt(0, 0, 0);
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2 && startGap !== 0) {
        startGap = 0;
        endPinch();
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [gl, camera]);

  // A user drag takes over from any in-progress flight.
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const onStart = () => tweenRef.current?.kill();
    controls.addEventListener("start", onStart);
    return () => controls.removeEventListener("start", onStart);
  }, []);

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={false}
      enableZoom={false}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.45}
      minDistance={MIN_DIST}
      maxDistance={MAX_DIST}
      autoRotate={started && !activePanel && !reducedMotion}
      autoRotateSpeed={0.25}
      makeDefault
    />
  );
}
