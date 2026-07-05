"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

// ============================================================ scroll helper
function sceneProgress(el: HTMLDivElement | null) {
  if (!el) return 0;
  const r = el.getBoundingClientRect();
  const vh = window.innerHeight;
  const total = r.height - vh;
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, -r.top / total));
}

// ============================================================ SCENE 1: HERO
function HeroScene() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subRef = useRef<HTMLDivElement>(null);
  const cueRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.z = 6;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    // wireframe core
    const icoGeo = new THREE.IcosahedronGeometry(1.7, 1);
    const icoMat = new THREE.MeshBasicMaterial({ color: 0x8b6bff, wireframe: true, transparent: true, opacity: 0.9 });
    const ico = new THREE.Mesh(icoGeo, icoMat);
    scene.add(ico);

    const ico2 = new THREE.Mesh(
      new THREE.IcosahedronGeometry(2.4, 0),
      new THREE.MeshBasicMaterial({ color: 0x4c3bbf, wireframe: true, transparent: true, opacity: 0.28 })
    );
    scene.add(ico2);

    // particle field
    const N = 1400;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const r = 3.4 + Math.random() * 4.5;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
      pos[i * 3 + 2] = r * Math.cos(ph);
    }
    const ptsGeo = new THREE.BufferGeometry();
    ptsGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const ptsMat = new THREE.PointsMaterial({ color: 0xb9a3ff, size: 0.02, transparent: true, opacity: 0.75 });
    const pts = new THREE.Points(ptsGeo, ptsMat);
    scene.add(pts);

    const resize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    resize();
    window.addEventListener("resize", resize);

    let raf: number, t = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const p = sceneProgress(wrapRef.current);
      t += 0.0026;

      ico.rotation.x = t * 0.7 + p * 2.2;
      ico.rotation.y = t + p * 3.4;
      const s = 1 + p * 1.5;
      ico.scale.set(s, s, s);
      ico2.rotation.y = -t * 0.5 - p * 1.4;
      ico2.rotation.z = t * 0.3;
      pts.rotation.y = t * 0.18 + p * 0.9;
      camera.position.z = 6 - p * 2.4;
      icoMat.opacity = 0.9 * (1 - p * 0.75);
      ptsMat.opacity = 0.75 * (1 - p * 0.55);

      // DOM scrub
      if (titleRef.current) {
        titleRef.current.style.transform = `translateY(${p * -90}px) scale(${1 - p * 0.12})`;
        titleRef.current.style.opacity = String(1 - p * 1.5);
      }
      if (subRef.current) {
        subRef.current.style.transform = `translateY(${p * -50}px)`;
        subRef.current.style.opacity = String(1 - p * 2.2);
      }
      if (cueRef.current) cueRef.current.style.opacity = String(1 - p * 4);

      renderer.render(scene, camera);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      icoGeo.dispose(); icoMat.dispose(); ptsGeo.dispose(); ptsMat.dispose();
      ico2.geometry.dispose(); (ico2.material as THREE.Material).dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div ref={wrapRef} className="scene" style={{ height: "300vh" }}>
      <div className="pin">
        <div ref={mountRef} className="webgl" />
        <div className="hero-copy">
          <div ref={subRef} className="kicker">SAI HRUSHIK KOPPULA — AI/ML ENGINEER</div>
          <h1 ref={titleRef} className="hero-title">
            Intelligence,<br /><span className="ghost">engineered.</span>
          </h1>
          <div ref={cueRef} className="cue">scroll to begin ↓</div>
        </div>
      </div>
    </div>
  );
}

// ==================================================== SCENE 2: WORD SCRUB
const STATEMENT = "I build AI systems that plan, act, and ship — agents, backends, and products people actually use.".split(" ");

function StatementScene() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    let raf: number;
    const n = STATEMENT.length;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const p = sceneProgress(wrapRef.current);
      wordRefs.current.forEach((el, i) => {
        if (!el) return;
        const o = Math.min(1, Math.max(0, p * (n + 3) - i));
        el.style.opacity = String(0.1 + 0.9 * o);
        el.style.transform = `translateY(${(1 - o) * 14}px)`;
      });
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div ref={wrapRef} className="scene" style={{ height: "260vh" }}>
      <div className="pin center">
        <div className="chapter">01 — THESIS</div>
        <p className="statement">
          {STATEMENT.map((w, i) => (
            <span key={i} ref={(el) => { wordRefs.current[i] = el; }} className="word">{w}&nbsp;</span>
          ))}
        </p>
      </div>
    </div>
  );
}

// ================================================ SCENE 3: HORIZONTAL WORK
const WORK = [
  { n: "01", t: "LLM Agents", d: "Autonomous agents on the Anthropic API — planning, tool-use, multi-step reasoning. They finish tasks, not sentences.", tags: "Python · Anthropic API · Tool Use", g: "linear-gradient(135deg,#2b1e5e,#6d4dff)" },
  { n: "02", t: "Spendly", d: "Offline-first expense PWA that lives on the home screen and loads instantly. Quiet software, done right.", tags: "PWA · JavaScript · Offline", g: "linear-gradient(135deg,#101c4e,#3b6bff)" },
  { n: "03", t: "Job-Alert Bot", d: "Scrapes and scores openings across boards, dedupes, and pings Telegram. The job hunt, automated away.", tags: "Python · Scraping · Automation", g: "linear-gradient(135deg,#341156,#a04dff)" },
  { n: "04", t: "DTMF Robot", d: "Real-time signals into physical motion on a Raspberry Pi. First place, IT Fest — hardware meets software.", tags: "Raspberry Pi · Signal Processing", g: "linear-gradient(135deg,#0e2b46,#2fa8ff)" },
];

function WorkScene() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf: number;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const p = sceneProgress(wrapRef.current);
      const track = trackRef.current;
      if (track) {
        const max = track.scrollWidth - window.innerWidth;
        track.style.transform = `translate3d(${-p * max}px,0,0)`;
      }
      if (headRef.current) headRef.current.style.opacity = String(Math.min(1, p * 6));
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div ref={wrapRef} className="scene" style={{ height: "420vh" }}>
      <div className="pin work-pin">
        <div ref={headRef} className="chapter work-chap">02 — SELECTED WORK</div>
        <div ref={trackRef} className="track">
          <div className="card intro-card">
            <div className="intro-big">The<br />work<span className="accent">.</span></div>
            <div className="intro-hint">keep scrolling →</div>
          </div>
          {WORK.map((w) => (
            <a key={w.n} className="card" href="https://github.com/saihrushik" target="_blank" rel="noreferrer">
              <div className="card-glow" style={{ background: w.g }} />
              <div className="card-top"><span>{w.n}</span><span>↗</span></div>
              <div className="card-title">{w.t}</div>
              <p className="card-desc">{w.d}</p>
              <div className="card-tags">{w.tags}</div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

// ==================================================== SCENE 4: TRAJECTORY
const PATH = [
  { y: "2022", r: "Cloud Intern — AWS", d: "VPC & S3. Secure, scalable infrastructure, shipped." },
  { y: "2024–26", r: "M.S. CS — Montclair State", d: "AI/ML, LLMs, agents. GPA 3.6. Jersey City, NJ." },
  { y: "NEXT", r: "Your team", d: "AI/ML or SWE. Available May 2026. I reply fast." },
];

function PathScene() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    let raf: number;
    const n = PATH.length;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const p = sceneProgress(wrapRef.current);
      rowRefs.current.forEach((el, i) => {
        if (!el) return;
        const local = Math.min(1, Math.max(0, p * (n + 0.8) - i));
        el.style.opacity = String(0.08 + 0.92 * local);
        el.style.transform = `translateX(${(1 - local) * 60}px)`;
      });
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div ref={wrapRef} className="scene" style={{ height: "240vh" }}>
      <div className="pin center path-pin">
        <div className="chapter">03 — TRAJECTORY</div>
        <div className="path-list">
          {PATH.map((e, i) => (
            <div key={e.r} ref={(el) => { rowRefs.current[i] = el; }} className="path-row">
              <span className="path-y">{e.y}</span>
              <span className="path-r">{e.r}</span>
              <span className="path-d">{e.d}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ======================================================== SCENE 5: FINALE
function EndScene() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const bigRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let raf: number;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const p = sceneProgress(wrapRef.current);
      if (bigRef.current) {
        bigRef.current.style.transform = `scale(${0.82 + p * 0.18})`;
        bigRef.current.style.opacity = String(0.15 + p * 0.85);
      }
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div ref={wrapRef} className="scene" style={{ height: "180vh" }}>
      <div className="pin center end-pin">
        <h2 ref={bigRef} className="end-title">Let’s build<br /><span className="ghost">something.</span></h2>
        <div className="end-links">
          <a href="mailto:hrushiksai0@gmail.com">Email</a>
          <a href="https://github.com/saihrushik" target="_blank" rel="noreferrer">GitHub</a>
          <a href="https://www.linkedin.com/in/sai-hrushik-koppula" target="_blank" rel="noreferrer">LinkedIn</a>
        </div>
        <div className="fin">© 2026 Sai Hrushik Koppula — a scroll-driven film in five scenes</div>
      </div>
    </div>
  );
}

// ================================================================== APP
export default function CinematicPortfolio() {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf: number;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const doc = document.documentElement;
      const p = doc.scrollTop / (doc.scrollHeight - window.innerHeight || 1);
      if (barRef.current) barRef.current.style.transform = `scaleX(${p})`;
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="film">
      <style>{CSS}</style>
      <div className="timeline"><div ref={barRef} className="timeline-fill" /></div>
      <HeroScene />
      <StatementScene />
      <WorkScene />
      <PathScene />
      <EndScene />
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=JetBrains+Mono:wght@400;500&display=swap');
*{box-sizing:border-box;margin:0}
html{scroll-behavior:auto}
.film{background:#050408;color:#eceaf6;font-family:'Space Grotesk',system-ui,sans-serif;-webkit-font-smoothing:antialiased;overflow-x:clip}
.accent{color:#8b6bff}
.ghost{-webkit-text-stroke:1px rgba(236,234,246,.65);color:transparent}

.timeline{position:fixed;top:0;left:0;right:0;height:2px;z-index:50;background:rgba(255,255,255,.07)}
.timeline-fill{height:100%;background:linear-gradient(90deg,#8b6bff,#3b6bff);transform:scaleX(0);transform-origin:left}

.scene{position:relative}
.pin{position:sticky;top:0;height:100vh;overflow:hidden;display:flex;flex-direction:column;justify-content:center}
.pin.center{align-items:center;text-align:center;padding:0 6vw}

.webgl{position:absolute;inset:0}
.webgl canvas{width:100%!important;height:100%!important;display:block}
.hero-copy{position:relative;z-index:2;text-align:center;padding:0 5vw;pointer-events:none}
.kicker{font-family:'JetBrains Mono',monospace;font-size:clamp(10px,1.4vw,13px);letter-spacing:.28em;color:#9d8df0;margin-bottom:26px}
.hero-title{font-size:clamp(52px,11vw,140px);line-height:.96;font-weight:700;letter-spacing:-.02em}
.cue{position:absolute;bottom:-22vh;left:50%;transform:translateX(-50%);font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.22em;color:#8a86a0;animation:bob 2s ease-in-out infinite}
@keyframes bob{50%{transform:translate(-50%,8px)}}

.chapter{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.3em;color:#8b6bff;margin-bottom:34px}
.statement{font-size:clamp(26px,4.6vw,58px);line-height:1.25;font-weight:500;max-width:920px}
.word{display:inline-block;will-change:opacity,transform}

.work-pin{justify-content:center}
.work-chap{position:absolute;top:7vh;left:6vw;margin:0}
.track{display:flex;gap:26px;padding:0 6vw;will-change:transform;width:max-content;align-items:stretch}
.card{position:relative;width:min(76vw,460px);min-height:min(60vh,480px);border-radius:20px;padding:30px 28px;
  background:#0d0b16;border:1px solid rgba(255,255,255,.08);overflow:hidden;text-decoration:none;color:inherit;
  display:flex;flex-direction:column;flex-shrink:0;transition:border-color .3s}
.card:hover{border-color:rgba(139,107,255,.55)}
.card-glow{position:absolute;inset:-40%;opacity:.24;filter:blur(50px);transition:opacity .3s}
.card:hover .card-glow{opacity:.42}
.card-top{position:relative;display:flex;justify-content:space-between;font-family:'JetBrains Mono',monospace;font-size:12px;color:#9d8df0;letter-spacing:.14em}
.card-title{position:relative;font-size:clamp(30px,4.5vw,46px);font-weight:700;margin:auto 0 16px;letter-spacing:-.01em}
.card-desc{position:relative;font-size:15px;line-height:1.6;color:#a9a5bd;font-family:'Inter',system-ui,sans-serif;margin-bottom:20px}
.card-tags{position:relative;font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.08em;color:#8a86a0}
.intro-card{background:transparent;border:none;justify-content:center}
.intro-big{font-size:clamp(60px,10vw,120px);font-weight:700;line-height:.95}
.intro-hint{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.22em;color:#8a86a0;margin-top:26px}

.path-pin .path-list{display:flex;flex-direction:column;gap:0;width:min(880px,90vw);text-align:left}
.path-row{display:grid;grid-template-columns:110px 1fr;grid-template-rows:auto auto;gap:4px 26px;
  padding:26px 0;border-top:1px solid rgba(255,255,255,.09);will-change:opacity,transform}
.path-row:last-child{border-bottom:1px solid rgba(255,255,255,.09)}
.path-y{font-family:'JetBrains Mono',monospace;font-size:12px;color:#8b6bff;letter-spacing:.1em;grid-row:span 2;padding-top:6px}
.path-r{font-size:clamp(20px,3vw,30px);font-weight:600}
.path-d{font-size:14px;color:#a9a5bd;font-family:'Inter',system-ui,sans-serif}

.end-pin{gap:34px}
.end-title{font-size:clamp(54px,11vw,130px);line-height:.98;font-weight:700;letter-spacing:-.02em;will-change:transform,opacity}
.end-links{display:flex;gap:30px;flex-wrap:wrap;justify-content:center}
.end-links a{color:#eceaf6;text-decoration:none;font-family:'JetBrains Mono',monospace;font-size:13px;letter-spacing:.14em;
  border-bottom:1px solid #8b6bff;padding-bottom:4px;transition:color .2s}
.end-links a:hover{color:#8b6bff}
.fin{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.18em;color:#5f5b74}

@media(prefers-reduced-motion:reduce){
  .cue{animation:none}
}
`;
