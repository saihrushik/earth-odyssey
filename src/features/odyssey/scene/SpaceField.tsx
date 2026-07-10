"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import * as THREE from "three";

/** Radial gradient sprite texture, generated once — used for the sun glow and meteor heads. */
function makeGlowTexture(inner: string, outer: string): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, inner);
  g.addColorStop(0.35, outer);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}


interface Meteor {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  cooldown: number;
}

/** Slow-drifting starfield, a distant sun glow, and occasional meteor streaks. */
export function SpaceField({ sun, perf }: { sun: THREE.Vector3; perf: boolean }) {
  const METEOR_COUNT = perf ? 2 : 5;
  const starsRef = useRef<THREE.Group>(null);
  const sunSpriteRef = useRef<THREE.Sprite>(null);
  const meteorRefs = useRef<(THREE.Mesh | null)[]>([]);

  const glowTex = useMemo(() => makeGlowTexture("rgba(255,255,255,1)", "rgba(255,225,180,0.5)"), []);
  const meteorTex = useMemo(() => makeGlowTexture("rgba(255,255,255,1)", "rgba(170,210,255,0.6)"), []);

  const meteors = useMemo<Meteor[]>(
    () =>
      Array.from({ length: METEOR_COUNT }, () => ({
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        life: 0,
        cooldown: 2 + Math.random() * 9,
      })),
    [METEOR_COUNT],
  );

  useFrame((_, delta) => {
    if (starsRef.current) starsRef.current.rotation.y += delta * 0.004;
    sunSpriteRef.current?.position.copy(sun).multiplyScalar(48);

    meteors.forEach((m, i) => {
      const mesh = meteorRefs.current[i];
      if (!mesh) return;
      if (!m.active) {
        m.cooldown -= delta;
        mesh.visible = false;
        if (m.cooldown <= 0) {
          // Spawn on a random point of a large sphere, streaking sideways.
          const dir = new THREE.Vector3().randomDirection();
          m.pos.copy(dir).multiplyScalar(22);
          const tangent = new THREE.Vector3().randomDirection().cross(dir).normalize();
          m.vel.copy(tangent).multiplyScalar(14 + Math.random() * 10);
          m.life = 1.4;
          m.active = true;
        }
        return;
      }
      m.life -= delta;
      m.pos.addScaledVector(m.vel, delta);
      mesh.visible = true;
      mesh.position.copy(m.pos);
      // Stretch the sprite along its velocity for a streak look.
      mesh.lookAt(m.pos.clone().add(m.vel));
      const fade = Math.max(Math.sin((1 - m.life / 1.4) * Math.PI), 0);
      mesh.scale.set(0.08, 0.08 + fade * 1.6, 0.08);
      (mesh.material as THREE.MeshBasicMaterial).opacity = fade * 0.9;
      if (m.life <= 0) {
        m.active = false;
        m.cooldown = 3 + Math.random() * 10;
      }
    });
  });

  return (
    <group>
      <group ref={starsRef}>
        <Stars
          radius={60}
          depth={40}
          count={perf ? 2400 : 6500}
          factor={3.2}
          saturation={0.15}
          fade
          speed={0.6}
        />
      </group>

      {/* Distant sun — bloom turns this into a soft flare. */}
      <sprite ref={sunSpriteRef} scale={7}>
        <spriteMaterial
          map={glowTex}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>

      {meteors.map((_, i) => (
        <mesh key={i} ref={(el) => void (meteorRefs.current[i] = el)} visible={false}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            map={meteorTex}
            transparent
            opacity={0}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}
