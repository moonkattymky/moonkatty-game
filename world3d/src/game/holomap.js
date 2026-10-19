// Holographic 3D world map (concept 09b1aaa3, "variant B"): the cat raises its paw, the gold wrist device projects a tilted
// cyan hologram of the real terrain of the current region. Modal: while open the world is not updated/rendered (main.js).
// Shows: holo terrain (cyan contour edges, scanlines, flicker, translucency), miniature base, crystals, holo pins with icons +
// labels, orange cat marker (position + heading), quest target (yellow beam + dotted gold path), robots with progress rings,
// fog of war (persisted, dim + flickering), undiscovered caches as hints, bottom quest card with GO, zoom / rotate / close.
import { mergeGeometries } from '../../vendor/three/jsm/utils/BufferGeometryUtils.js';
import * as THREE from 'three';

const FOG_N = 32;
// cyan line-art pin icons (concept 09b1aaa3), keyed by the emoji index.js sends
const sv = (b) => `<svg viewBox="0 0 32 32" fill="none" stroke="#9fefff" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round">${b}</svg>`;
const ICONS = { '💎': sv('<path d="M16 3l5 9-5 17-5-17z"/><path d="M11 12h10"/><path d="M8 10l3 9 3 7M24 10l-3 9-3 7" opacity=".7"/>'), '🏠': sv('<path d="M5 22a11 11 0 0 1 22 0z"/><path d="M3 22h26M10 22v4h12v-4M16 11V6M14 6h4"/>'), '⚡': sv('<circle cx="16" cy="16" r="12" opacity=".6"/><path d="M17 6l-7 11h6l-1 9 7-12h-6z"/>'),
  '📡': sv('<path d="M16 14v14M11 28h10M13 20l3-6 3 6"/><path d="M10.5 9.5a8 8 0 0 1 11 0M7.5 6.5a12 12 0 0 1 17 0" opacity=".85"/><circle cx="16" cy="13" r="1.6"/>'), '⛰️': sv('<path d="M3 26l9-14 5 7 3-4 9 11z"/><path d="M10 15l2 2 2-2" opacity=".7"/>'), '🚀': sv('<path d="M16 3c4 4 5 10 3 17h-6c-2-7-1-13 3-17z"/><path d="M13 20l-4 5h5M19 20l4 5h-5M16 23v5"/><circle cx="16" cy="11" r="2"/>'),
  '🛬': sv('<ellipse cx="16" cy="22" rx="12" ry="5"/><ellipse cx="16" cy="22" rx="6" ry="2.4" opacity=".7"/><path d="M16 4v10M12 10l4 4 4-4"/>'), '🌀': sv('<path d="M3 26c0-10 6-17 13-17s13 7 13 17"/><path d="M9 26c0-6 3-10 7-10s7 4 7 10" opacity=".8"/><path d="M1 26h30"/>'), '❔': sv('<path d="M11.5 12a4.5 4.5 0 1 1 6.5 4c-1.4.8-2 1.6-2 3.2"/><circle cx="16" cy="24" r="1.2"/>'),
  '🕳️': sv('<ellipse cx="16" cy="18" rx="13" ry="6"/><ellipse cx="16" cy="18" rx="7" ry="3" opacity=".8"/><path d="M5 15c2-4 5-6 11-6s9 2 11 6" opacity=".6"/>') };
const CSS = `
#mk-map-ui{position:fixed;inset:0;z-index:6;pointer-events:none;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;display:none}
#mk-map-ui.on{display:block}
body.mk-mapopen #mk-root,body.mk-mapopen #joy,body.mk-mapopen #jump,body.mk-mapopen #views,body.mk-mapopen .hud{display:none!important}
#mk-map-ui .pe{pointer-events:auto}
#mk-map-cv{position:absolute;inset:0;width:100%;height:100%;pointer-events:auto;touch-action:none}
.mkm-pin{position:absolute;left:0;top:0;transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;gap:4px;padding:7px 9px 5px;min-width:58px;border-radius:6px;border:1.5px solid rgba(120,225,255,.95);background:linear-gradient(180deg,rgba(40,120,190,.42),rgba(8,34,80,.62));box-shadow:0 0 14px rgba(80,200,255,.7),inset 0 0 14px rgba(110,220,255,.3);backdrop-filter:blur(1.5px);color:#e6fbff;font-size:10px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;white-space:nowrap;text-shadow:0 0 6px rgba(110,220,255,.8)}
.mkm-pin .i{font-size:20px;line-height:1;filter:drop-shadow(0 0 5px rgba(110,220,255,.95))}.mkm-pin .i svg{width:30px;height:30px;display:block}.mkm-pin.h .i svg{width:16px;height:16px}
.mkm-pin:after{content:'';position:absolute;left:50%;bottom:-7px;width:2px;height:7px;background:rgba(120,225,255,.9);transform:translateX(-50%)}
.mkm-pin.q{border-color:#ffd25a;box-shadow:0 0 14px rgba(255,200,80,.8);color:#fff3cf}
.mkm-pin.f{opacity:.78;border-style:dashed}
#mkm-stalks{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible}
.mkm-pin:after{display:none}
.mkm-pin.h{opacity:.55;border-style:dashed;min-width:0;padding:3px 6px}
.mkm-pin.h .i{font-size:14px}
.mkm-bot{position:absolute;left:0;top:0;width:30px;height:30px;transform:translate(-50%,-50%)}
.mkm-bot svg{position:absolute;inset:0}
.mkm-bot b{position:absolute;inset:5px;border-radius:50%;background:radial-gradient(circle,#123a66,#081a36);display:flex;align-items:center;justify-content:center;font-size:12px}
.mkm-cat{position:absolute;left:0;top:0;transform:translate(-50%,-160%);font-size:10px;font-weight:900;color:#ffb35a;text-shadow:0 0 6px #000;white-space:nowrap}
#mkm-card{position:absolute;left:50%;bottom:max(18px,max(env(safe-area-inset-bottom),var(--tg-inset-bottom,0px)));transform:translateX(-50%);display:flex;align-items:center;gap:16px;padding:10px 12px 10px 20px;border-radius:6px;border:1.5px solid #d9a640;background:linear-gradient(180deg,rgba(14,22,44,.82),rgba(4,9,22,.9));backdrop-filter:blur(4px);box-shadow:0 0 0 1px rgba(255,220,140,.25) inset,0 0 16px rgba(217,166,64,.45),0 6px 24px rgba(0,0,0,.6);color:#e6fbff;max-width:92vw}
#mkm-card .t{font-size:15px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:min(52vw,420px);color:#dff7ff;text-shadow:0 0 8px rgba(110,220,255,.7)}
#mkm-card .t small{display:block;font-size:10px;letter-spacing:.04em;color:#9fe6ff;font-weight:600;text-transform:none;margin-top:3px;overflow:hidden;text-overflow:ellipsis;opacity:.8}
#mkm-card .t b{color:#9fe6ff;font-weight:700;margin-right:.35em}
#mkm-go{white-space:nowrap;flex:none;border:1.5px solid #8a5c12;border-radius:7px;padding:9px 16px;background:linear-gradient(180deg,#f6d987,#C8912A);color:#2a1a04;font-weight:900;font-size:14px;letter-spacing:.06em;box-shadow:0 0 10px rgba(255,200,80,.6)}
#mkm-x{position:absolute;right:max(14px,max(env(safe-area-inset-right),var(--tg-inset-right,0px)));top:max(14px,max(env(safe-area-inset-top),var(--tg-inset-top,0px)));width:42px;height:42px;border-radius:50%;border:1.5px solid rgba(110,220,255,.9);background:rgba(6,20,46,.8);color:#cff6ff;font-size:24px;line-height:38px;text-align:center;box-shadow:0 0 10px rgba(80,200,255,.6)}
#mkm-zoom{position:absolute;right:max(14px,max(env(safe-area-inset-right),var(--tg-inset-right,0px)));top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:8px}
@media (orientation:portrait){#mkm-zoom{top:auto;bottom:calc(112px + max(env(safe-area-inset-bottom),var(--tg-inset-bottom,0px)));transform:none;flex-direction:row}} .mkm-pin.c>span:not(.i){display:none}.mkm-pin.c{min-width:0;padding:3px 4px}
#mkm-zoom button{width:40px;height:40px;border-radius:10px;border:1.5px solid rgba(110,220,255,.9);background:rgba(6,20,46,.8);color:#cff6ff;font-size:22px;font-weight:800}
@media (max-width:560px){.mkm-pin{padding:4px 6px 3px;min-width:40px;font-size:8px;gap:2px;letter-spacing:.04em}.mkm-pin .i svg{width:20px;height:20px}.mkm-pin.h .i svg{width:12px;height:12px}.mkm-bot{width:24px;height:24px}}
#mkm-title{position:absolute;left:50%;top:max(14px,max(env(safe-area-inset-top),var(--tg-inset-top,0px)));transform:translateX(-50%);font-size:11px;letter-spacing:.3em;color:#9fe6ff;font-weight:800;text-shadow:0 0 8px rgba(110,220,255,.9);text-transform:uppercase}
`;

const holoVS = `varying vec3 vW; varying vec3 vL; varying float vH; varying float vF; varying vec3 vN; attribute float aH; attribute float aF; void main(){ vL = position; vH = aH; vF = aF; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const holoFS = `uniform float uT; uniform float uOpen; uniform sampler2D uFog; uniform float uR; uniform float uHK; uniform float uRW; uniform float uGam; uniform float uFR; uniform float uA; uniform float uR0;
varying vec3 vW; varying vec3 vL; varying float vH; varying float vF; varying vec3 vN;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
void main(){
  float m = pow(abs(vL.x / uR), 4.0) + pow(abs(vL.z / uR), 4.0); if (m > 1.0) discard;
  float rm = max(length(vL.xz), 1e-4); float rw = rm < uA * uR0 ? rm / uA : uRW * pow(rm / (0.97 * uR), 1.0 / uGam); vec2 wo = vL.xz / rm * rw; vec2 uv = wo / (2.0 * uFR) + 0.5;
  float fog = vF; uv = vL.xz / (2.0 * uR) + 0.5; /* v52: fog baked per vertex in world space (aF) */
  vec3 n = normalize(vN); float sl = 1.0 - abs(n.y);
  float shade = 0.22 + 1.0 * clamp(dot(n, normalize(vec3(-0.45, 0.75, 0.4))), 0.0, 1.0) + 0.12 * clamp(dot(n, normalize(vec3(0.6, 0.3, -0.5))), 0.0, 1.0);
  float hh = clamp(vH * uHK * 0.8 + 0.5, 0.0, 1.0);
  vec3 rock = mix(vec3(0.30, 0.24, 0.19), vec3(0.66, 0.57, 0.46), hh); rock = mix(rock, vec3(0.42, 0.40, 0.39), smoothstep(0.45, 0.9, sl) * 0.6); rock *= shade;
  float ct = abs(fract(vH * uHK * 9.0) - 0.5); float cl = 1.0 - smoothstep(0.0, 0.06 + fwidth(vH * uHK * 9.0) * 1.5, ct);
  float ridge = smoothstep(0.35, 0.85, sl);
  float scan = 0.93 + 0.07 * sin(gl_FragCoord.y * 1.4 + uT * 6.0);
  float flick = 0.96 + 0.04 * sin(uT * 23.0);
  vec3 cyan = vec3(0.25, 0.85, 1.0);
  float tx = vn(vL.xz * 1.6) * 0.5 + vn(vL.xz * 4.5) * 0.32 + vn(vL.xz * 9.0) * 0.18; rock *= 0.55 + 0.8 * tx; float cav = smoothstep(0.55, 0.25, tx); rock *= 1.0 - cav * 0.25;
  float fres = pow(1.0 - abs(dot(n, normalize(cameraPosition - vW))), 3.0);
  vec3 col = rock * vec3(0.96, 0.99, 1.04) * 1.25 + cyan * (cl * 0.035 + fres * 0.08);
  float edge = smoothstep(0.82, 1.0, m); col = mix(col, vec3(0.42, 0.72, 0.88), smoothstep(0.5, 0.97, m) * 0.5); col += cyan * edge * 1.6;
  float grid = (1.0 - smoothstep(0.0, 0.03, abs(fract(vL.x / uR * 6.0) - 0.5) - 0.47)) + (1.0 - smoothstep(0.0, 0.03, abs(fract(vL.z / uR * 6.0) - 0.5) - 0.47));
  col += cyan * grid * 0.0;
  float unk = 1.0 - fog; float noise = hash(floor(uv * 90.0) + floor(uT * 9.0));
  col = mix(col, col * 0.35 + vec3(0.30, 0.62, 0.78) * (0.35 + 0.25 * tx) + cyan * (0.04 * noise + cl * 0.12), unk * 0.8);
  float a = (1.0 - unk * 0.15) * uOpen;
  gl_FragColor = vec4(col * mix(1.0, scan * flick, unk), a);
}`;

function fogTex() { const d = new Uint8Array(FOG_N * FOG_N * 4); const t = new THREE.DataTexture(d, FOG_N, FOG_N, THREE.RGBAFormat); t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; return t; }

const PQ = (() => { const q = new URLSearchParams(location.search).get('q'); return q === 'low' ? 'low' : q === 'mobile' || (!q && (matchMedia('(pointer:coarse)').matches || Math.min(innerWidth, innerHeight) < 480)) ? 'mobile' : 'desktop'; })();
export function makeHoloMap({ renderer, t, onGo, world }) {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const ui = document.createElement('div'); ui.id = 'mk-map-ui';
  ui.innerHTML = `<canvas id="mk-map-cv"></canvas><svg id="mkm-stalks"></svg><div id="mkm-layer"></div><div id="mkm-title"></div><button id="mkm-x" class="pe" aria-label="close">×</button><div id="mkm-zoom" class="pe"><button data-z="1">+</button><button data-z="-1">−</button></div><div id="mkm-card" class="pe"><div class="t"></div><button id="mkm-go"></button></div>`;
  document.body.appendChild(ui); const $ = (s) => ui.querySelector(s); const layer = $('#mkm-layer');
  for (const ev of ['pointerdown', 'touchstart', 'wheel', 'keydown']) ui.addEventListener(ev, e => e.stopPropagation(), { passive: true });

  const scene = new THREE.Scene(); scene.background = new THREE.Color('#03060f');
  const cam = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
  scene.add(new THREE.HemisphereLight('#bfe6ff', '#1a2030', 1.4)); const dl = new THREE.DirectionalLight('#fff4dc', 2.2); dl.position.set(-6, 12, 8); scene.add(dl);
  { // starfield + earth
    const n = 900, p = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const u = Math.random() * 2 - 1, a = Math.random() * 6.283, r = 90; const s = Math.sqrt(1 - u * u); p[i * 3] = Math.cos(a) * s * r; p[i * 3 + 1] = Math.abs(u) * r * 0.9 + 4; p[i * 3 + 2] = Math.sin(a) * s * r; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: '#cfe6ff', size: 1.6, sizeAttenuation: false })));
    const earth = new THREE.Mesh(new THREE.SphereGeometry(7, 32, 20), new THREE.MeshStandardMaterial({ color: '#2a5aa8', emissive: '#0c2a66', roughness: 0.8 })); earth.position.set(14, 3.6, -32); scene.add(earth); scene.userData.earth = earth;
  }
  const W = 10; // map half-size in scene units
  const board = new THREE.Group(); scene.add(board);
  const fogT = fogTex();
  const U = { uT: { value: 0 }, uOpen: { value: 0 }, uFog: { value: fogT }, uR: { value: W }, uHK: { value: 1 }, uRW: { value: 150 }, uGam: { value: 0.55 }, uFR: { value: 90 }, uA: { value: 0.13 }, uR0: { value: 30 } };
  const hmat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: holoVS, fragmentShader: holoFS, transparent: true, depthWrite: true, side: THREE.DoubleSide, extensions: { derivatives: true } });
  let terr = null, built = null;
  // holo rim: glowing vertical ribbon around the superellipse edge + base plate glow
  const rimPts = []; for (let i = 0; i <= 128; i++) { const a = i / 128 * Math.PI * 2; const c = Math.cos(a), s = Math.sin(a); const k = Math.pow(Math.pow(Math.abs(c), 4) + Math.pow(Math.abs(s), 4), -0.25); rimPts.push(c * k * W, s * k * W); }
  const rimGeo = (() => { const P = [], A = []; for (let i = 0; i < rimPts.length / 2; i++) { const x = rimPts[i * 2], z = rimPts[i * 2 + 1]; const top = 0.35; P.push(x, -0.75, z, x, top, z); A.push(0, 1); } const idx = []; for (let i = 0; i < rimPts.length / 2 - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aV', new THREE.Float32BufferAttribute(A, 1)); g.setIndex(idx); return g; })();
  const rim = new THREE.Mesh(rimGeo, new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, vertexShader: `attribute float aV; varying float vV; void main(){ vV = aV; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`, fragmentShader: `uniform float uT; uniform float uOpen; varying float vV; void main(){ float a = 0.16 + (1.0 - vV) * 0.22 + exp(-vV * 30.0) * 0.6 + smoothstep(0.93, 1.0, vV) * 0.9; float sc = 0.8 + 0.2 * sin(gl_FragCoord.y * 1.4 - uT * 5.0); gl_FragColor = vec4(vec3(0.25, 0.8, 1.0) * a * sc * uOpen, 1.0); }` }));
  board.add(rim);
  { // v52b glowing cyan glass slab with a bevelled edge under the terrain
    const sh = new THREE.Shape(); for (let i = 0; i < rimPts.length / 2; i++) { const x = rimPts[i * 2] * 1.03, z = rimPts[i * 2 + 1] * 1.03; i ? sh.lineTo(x, -z) : sh.moveTo(x, -z); }
    const sg = new THREE.ExtrudeGeometry(sh, { depth: 0.32, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.16, bevelSegments: 2, curveSegments: 4 }).rotateX(-Math.PI / 2).translate(0, -1.2, 0);
    const slab = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ color: '#06263f', emissive: '#0a4f78', emissiveIntensity: 0.9, roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.62, depthWrite: false })); slab.renderOrder = 0; board.add(slab);
    const eg = new THREE.LineSegments(new THREE.EdgesGeometry(sg, 25), new THREE.LineBasicMaterial({ color: new THREE.Color(0.4, 1.3, 2.0), toneMapped: false, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })); board.add(eg);
    // vertical glass panels along the back arc
    const P = [], UV = [], idx = []; const NPAN = 9; for (let k = 0; k < NPAN; k++) { const a0 = Math.PI * (1.08 + k * 0.84 / NPAN), a1 = a0 + Math.PI * 0.84 / NPAN * 0.96; const pt = (a) => { const c = Math.cos(a), s_ = Math.sin(a); const kk = Math.pow(Math.pow(Math.abs(c), 4) + Math.pow(Math.abs(s_), 4), -0.25) * W * 1.04; return [c * kk, s_ * kk]; }; const [x0, z0] = pt(a0), [x1, z1] = pt(a1); const hgt = 4.3 + 1.3 * Math.sin(k / (NPAN - 1) * Math.PI); const b = P.length / 3; P.push(x0, -0.8, z0, x1, -0.8, z1, x1, hgt, z1, x0, hgt, z0); UV.push(0, 0, 1, 0, 1, 1, 0, 1); idx.push(b, b + 1, b + 2, b, b + 2, b + 3); }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); pg.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); pg.setIndex(idx);
    const pan = new THREE.Mesh(pg, new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, vertexShader: `varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`, fragmentShader: `uniform float uT; uniform float uOpen; varying vec2 vU; void main(){ vec2 e = min(vU, 1.0 - vU); float edge = 1.0 - smoothstep(0.0, 0.025, min(e.x * 0.6, e.y)); float top = smoothstep(0.96, 1.0, vU.y); float grid = (1.0 - smoothstep(0.0, 0.02, abs(fract(vU.y * 9.0) - 0.5) - 0.47)) * 0.25; float sc = 0.85 + 0.15 * sin(gl_FragCoord.y * 1.3 - uT * 4.0); float fr = 0.13 + (1.0 - vU.y) * 0.14 + grid * 0.05; vec3 c = mix(vec3(0.72, 1.08, 1.3), vec3(0.95, 1.15, 1.25), vU.y) * (1.15 + 0.08 * sc) + vec3(0.4, 1.2, 1.7) * (edge + top) * 1.2; float al = (fr + (edge + top) * 0.7) * uOpen; vec3 glow = vec3(0.08, 0.3, 0.45) * (0.45 + 0.55 * (1.0 - vU.y)) * uOpen; gl_FragColor = vec4(c * al + glow, al); }` })); pan.renderOrder = 5; board.add(pan); }
  const minis = new THREE.Group(); board.add(minis);
  // v52b map-only decor (concept): crystal clusters in field areas, green crystal pillars, dark cave openings, glowing impact crater + trail
  const decor = new THREE.Group(); board.add(decor);
  const dCry = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0).scale(0.45, 1.25, 0.45), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 0.8, 1.7), toneMapped: false, transparent: true, opacity: 0.9 }), 80); dCry.count = 0; decor.add(dCry);
  const dGrn = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.13, 1, 6).translate(0, 0.5, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 1.5, 0.9), toneMapped: false, transparent: true, opacity: 0.85 }), 16); dGrn.count = 0; decor.add(dGrn);
  const dCave = new THREE.InstancedMesh(new THREE.CircleGeometry(0.75, 18, 0, Math.PI).scale(1, 1.15, 1), new THREE.MeshBasicMaterial({ color: '#02050c' }), 4); dCave.count = 0; decor.add(dCave);
  const dCaveE = new THREE.InstancedMesh(new THREE.RingGeometry(0.75, 0.83, 18, 1, 0, Math.PI).scale(1, 1.15, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 1.0, 1.6), toneMapped: false, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }), 4); dCaveE.count = 0; decor.add(dCaveE);
  const poolTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(200,250,255,1)'); gr.addColorStop(0.35, 'rgba(90,210,255,.75)'); gr.addColorStop(1, 'rgba(40,140,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t_ = new THREE.CanvasTexture(c); return t_; })();
  const dPool = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: poolTex, color: new THREE.Color(0.6, 1.3, 1.8), toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), 24); dPool.count = 0; dPool.renderOrder = 3; decor.add(dPool);
  const trailM = new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexShader: `varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`, fragmentShader: `uniform float uT; uniform float uOpen; varying vec2 vU; void main(){ float w = 1.0 - abs(vU.y - 0.5) * 2.0; float pulse = 0.55 + 0.45 * smoothstep(0.7, 1.0, fract(vU.x * 0.35 - uT * 0.5)); gl_FragColor = vec4(vec3(0.3, 1.0, 1.6) * w * w * pulse * 1.5 * uOpen, 1.0); }` }); let trails = null;
  function buildTrails() { if (trails) { board.remove(trails); trails.geometry.dispose(); trails = null; } if (!data.base) return; const b = toMap(data.base.x, data.base.z, 0); const P = [], UV = [], I = []; const ends = pins.filter(p => !p.bot && !p.cat && p.kind !== 'hint').map(p => toMap(p.x, p.z, 0));
    for (const e of ends) { const dx = e.x - b.x, dz = e.z - b.z, L = Math.hypot(dx, dz); if (L < 1.2) continue; const nx = -dz / L, nz = dx / L, bend = L * 0.12; const NS = Math.max(8, Math.round(L * 4)); let acc = 0, px = b.x, pz = b.z;
      for (let i = 0; i <= NS; i++) { const u = i / NS, k = 4 * u * (1 - u) * bend; const x = b.x + dx * u + nx * k, z = b.z + dz * u + nz * k; acc += Math.hypot(x - px, z - pz); px = x; pz = z; const y = hAtM(x, z) + 0.08; const st = P.length / 3; P.push(x - nx * 0.11, y, z - nz * 0.11, x + nx * 0.11, y, z + nz * 0.11); UV.push(acc, 0, acc, 1); if (i) I.push(st - 2, st - 1, st, st - 1, st + 1, st); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setIndex(I); trails = new THREE.Mesh(g, trailM); trails.renderOrder = 6; board.add(trails); }
  const crater = new THREE.Group(); decor.add(crater);
  { const bowl = new THREE.Mesh(new THREE.CircleGeometry(1.25, 32).rotateX(-Math.PI / 2).scale(1, 1, 0.84), new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, vertexShader: `varying vec2 vP; void main(){ vP = position.xz / 1.25; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`, fragmentShader: `uniform float uT; uniform float uOpen; varying vec2 vP; void main(){ float r = length(vP); vec3 c = mix(vec3(0.03, 0.015, 0.01), vec3(0.35, 0.24, 0.16), smoothstep(0.35, 0.95, r)); c += vec3(1.4, 0.45, 0.06) * (1.0 - smoothstep(0.0, 0.55, length(vP - vec2(0.25, -0.1)))) * (0.75 + 0.25 * sin(uT * 3.0)); gl_FragColor = vec4(c, (1.0 - smoothstep(0.92, 1.0, r)) * uOpen); }` })); bowl.position.y = 0.06; bowl.renderOrder = 4; crater.add(bowl);
    const rimM = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.16, 6, 28).rotateX(Math.PI / 2).scale(1, 1, 0.84), new THREE.MeshStandardMaterial({ color: '#7a6450', roughness: 0.9, emissive: '#2a1406' })); crater.add(rimM); const cr = new THREE.Mesh(new THREE.RingGeometry(1.36, 1.46, 40).rotateX(-Math.PI / 2).scale(1, 1, 0.84), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 1.2, 1.9), toneMapped: false, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })); cr.position.y = 0.14; crater.add(cr);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(1.0, 24).rotateX(-Math.PI / 2).scale(1.1, 1, 0.9), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.55, 0.1), toneMapped: false, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })); glow.position.y = -0.18; crater.add(glow);
    const trail = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 3.2).translate(0, 1.6, 0), new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, vertexShader: `varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`, fragmentShader: `uniform float uT; uniform float uOpen; varying vec2 vU; void main(){ float w = 1.0 - abs(vU.x - 0.5) * 2.0; float a = pow(w, 2.0) * pow(1.0 - vU.y, 1.6) * (0.8 + 0.2 * sin(uT * 9.0 - vU.y * 20.0)); gl_FragColor = vec4(mix(vec3(2.2, 1.3, 0.35), vec3(1.6, 0.35, 0.05), vU.y) * a * uOpen, 1.0); }` })); trail.position.set(0.5, 0.1, 0); trail.rotation.set(0, -0.6, -0.55); crater.add(trail); }
  const DECOR = { field: [-6.2, -3.2], crater: [5.0, 3.4], caves: [[-4.6, -7.9], [-1.8, -8.8]], clusters: [[-6.2, -3.2, 14, 1.5], [-3.6, 1.9, 6, 0.8], [-7.2, 1.2, 5, 0.7], [2.4, -6.0, 5, 0.8], [6.8, -2.2, 6, 0.9], [-0.6, 4.6, 4, 0.6]] };
  const hAtM = (mx, mz) => { const [x, z] = toWorld(mx, mz); return hMap(data.groundAt(x, z)); };
  function buildDecor() { const M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(); let n = 0; const rnd = (i) => { const x = Math.sin(i * 127.1 + 31.7) * 43758.5453; return x - Math.floor(x); };
    for (const [cx_, cz_, cnt, rad] of DECOR.clusters) for (let i = 0; i < cnt && n < 80; i++) { const a = rnd(n) * 6.283, r = Math.sqrt(rnd(n + 7)) * rad; const x = cx_ + Math.cos(a) * r, z = cz_ + Math.sin(a) * r; const s_ = 0.16 + rnd(n + 3) * 0.22; e.set((rnd(n + 1) - 0.5) * 0.7, a, (rnd(n + 2) - 0.5) * 0.7); M.compose(v.set(x, hAtM(x, z) + s_ * 0.8, z), q.setFromEuler(e), sc.set(s_, s_, s_)); dCry.setMatrixAt(n++, M); }
    dCry.count = n; dCry.instanceMatrix.needsUpdate = true; let g = 0, c = 0; { let pn = 0; for (const [cx_, cz_, cnt, rad] of DECOR.clusters) for (let i = 0; i < Math.min(4, Math.ceil(cnt / 4)) && pn < 24; i++) { const a = rnd(pn + 40) * 6.283, r = rnd(pn + 50) * rad * 0.8; const x = cx_ + Math.cos(a) * r, z = cz_ + Math.sin(a) * r, s_ = 0.5 + rnd(pn + 60) * 0.5; M.compose(v.set(x, hAtM(x, z) + 0.06, z), q.identity(), sc.set(s_, 1, s_)); dPool.setMatrixAt(pn++, M); } dPool.count = pn; dPool.instanceMatrix.needsUpdate = true; }
    for (const [x0, z0] of DECOR.caves) { const y = hAtM(x0, z0); M.compose(v.set(x0, y + 0.05, z0 + 0.6), q.identity(), sc.set(1, 1, 1)); dCave.setMatrixAt(c, M); M.compose(v.set(x0, y + 0.05, z0 + 0.61), q.identity(), sc.set(1, 1, 1)); dCaveE.setMatrixAt(c++, M); for (let k = 0; k < 4; k++) { const x = x0 - 0.9 + k * 0.6 + (rnd(g) - 0.5) * 0.2, z = z0 + 0.9 + rnd(g + 5) * 0.4; const hh = 0.5 + rnd(g + 9) * 0.8; M.compose(v.set(x, hAtM(x, z), z), q.setFromEuler(e.set(0, rnd(g) * 3, (rnd(g + 2) - 0.5) * 0.25)), sc.set(1, hh, 1)); dGrn.setMatrixAt(g++, M); } }
    dCave.count = dCaveE.count = c; dGrn.count = g; for (const m of [dCave, dCaveE, dGrn]) m.instanceMatrix.needsUpdate = true;
    const [kx, kz] = DECOR.crater; crater.position.set(kx, hAtM(kx, kz) + 0.05, kz); }
  const ivory = new THREE.MeshStandardMaterial({ color: '#efe6d2', roughness: 0.5, metalness: 0.1, emissive: '#3a3020' }), gold = new THREE.MeshStandardMaterial({ color: '#d9a640', roughness: 0.35, metalness: 0.8, emissive: '#3a2400' });
  const crysM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.45, 0.85, 1.6), toneMapped: false });
  const crysI = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0).scale(0.5, 1.3, 0.5), crysM, 64); crysI.count = 0; board.add(crysI);
  // v52 robot minis: ivory body + cyan visor + cyan ground ring (concept robots with rings), instanced
  const botB = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 12, 8).scale(1, 1.15, 1), ivory, 12), botV = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 10, 6, 0, Math.PI * 2, 0, 1.2).rotateX(Math.PI / 2).scale(1.2, 0.8, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 1.2, 1.8), toneMapped: false }), 12), botR = new THREE.InstancedMesh(new THREE.RingGeometry(0.26, 0.36, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 1.0, 1.6), toneMapped: false, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }), 12);
  for (const m of [botB, botV, botR]) { m.count = 0; board.add(m); }
  // cat marker (orange arrow + glow), target beam + ring, dotted path
  const catM = new THREE.Group(); { const sh = new THREE.Shape(); sh.moveTo(0, 0.55); sh.lineTo(0.38, -0.35); sh.lineTo(0, -0.15); sh.lineTo(-0.38, -0.35); sh.closePath(); const g = new THREE.ExtrudeGeometry(sh, { depth: 0.08, bevelEnabled: false }).rotateX(-Math.PI / 2); const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.7, 0.15), toneMapped: false })); catM.add(m); { /* v52 mini cat token (concept): ivory suit body, orange head + ears, glass helmet */ const or = new THREE.MeshStandardMaterial({ color: '#f08a2c', roughness: 0.6, emissive: '#5a2006' }), su = new THREE.MeshStandardMaterial({ color: '#f1e8d6', roughness: 0.6, emissive: '#2a2418' }); const bd = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8).scale(1, 1.25, 0.9), su); bd.position.y = 0.26; catM.add(bd); const hd = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8), or); hd.position.y = 0.56; catM.add(hd); for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 6), or); e.position.set(sx * 0.08, 0.7, 0); catM.add(e); } const hl = new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 0.9, 1.2), transparent: true, opacity: 0.22, depthWrite: false })); hl.position.y = 0.58; catM.add(hl); } const d = new THREE.Mesh(new THREE.CircleGeometry(0.7, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 0.4, 0.05), transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false })); d.position.y = -0.02; catM.add(d); } board.add(catM);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.3, 3.2, 16, 1, true).translate(0, 1.6, 0), new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, vertexShader: `varying float vY; void main(){ vY = position.y / 3.2; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`, fragmentShader: `uniform float uT; uniform float uOpen; varying float vY; void main(){ float a = (1.0 - vY) * (0.75 + 0.25 * sin(uT * 6.0 - vY * 12.0)); gl_FragColor = vec4(vec3(2.0, 1.25, 0.3) * a * uOpen, 1.0); }` })); board.add(beam);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.55, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.05, 0.3), toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); board.add(ring);
  let tube = null; const tubeM = new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, vertexShader: `varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`, fragmentShader: `uniform float uT; uniform float uOpen; varying vec2 vU; void main(){ float d = fract(vU.x * 26.0 - uT * 1.6); float dash = smoothstep(0.0, 0.15, d) * (1.0 - smoothstep(0.45, 0.6, d)); gl_FragColor = vec4(vec3(1.9, 1.25, 0.35) * (0.35 + 1.1 * dash) * uOpen, 1.0); }` });
  const NP = 60; const pathG = new THREE.BufferGeometry(); pathG.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NP * 3), 3));
  const path = new THREE.Points(pathG, new THREE.PointsMaterial({ color: new THREE.Color(1.6, 1.15, 0.35), size: 0.22, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); board.add(path);
  // the wrist device: fluffy paw + gold bracelet with a cyan screen, projection cone toward the map
  const wrist = new THREE.Group(); scene.add(cam); cam.add(wrist);
  { // v52b OPEN paw (concept): forearm from bottom-left along +y, palm + spread fingers up toward the map, white sleeve w/ gold rings, big gold watch (face toward camera, +z) whose cyan screen projects the map
    const fluff = (g, amp = 0.05) => { const P = g.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i); const n = Math.sin(v.x * 23.1 + v.y * 17.3) * Math.sin(v.z * 19.7 - v.y * 11.1) * 0.5 + Math.sin(v.x * 41 + v.z * 37) * 0.5; v.multiplyScalar(1 + amp * n); P.setXYZ(i, v.x, v.y, v.z); } g.computeVertexNormals(); return g; };
    const fur = new THREE.MeshStandardMaterial({ color: '#f4ead6', roughness: 1, emissive: '#2a241a' }), suit = new THREE.MeshStandardMaterial({ color: '#ece4d3', roughness: 0.6, emissive: '#1e1a14' });
    const au = new THREE.MeshStandardMaterial({ color: '#e5b04a', roughness: 0.25, metalness: 0.6, emissive: '#4a3008' }), navy = new THREE.MeshStandardMaterial({ color: '#1a5ab0', roughness: 0.08, metalness: 0.4, emissive: '#0c3a7a' });
    const add = (g, m, x, y, z, rz = 0, rx = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.rotation.set(rx, 0, rz); wrist.add(o); return o; };
    add(fluff(new THREE.SphereGeometry(1, 26, 18).scale(1.05, 1.0, 0.55)), fur, 0, 1.05, 0);                       // palm (back of paw toward camera)
    for (let k = 0; k < 4; k++) { const a = -0.66 + k * 0.44, L = k === 1 || k === 2 ? 0.3 : 0.2; const x = Math.sin(a) * 1.02, y = 1.58 + Math.cos(a) * 0.32;   // spread fingers fanning upward
      add(fluff(new THREE.SphereGeometry(0.29, 18, 14).scale(1, 1 + L * 1.2, 0.9), 0.03), fur, x + Math.sin(a) * L * 0.5, y + Math.cos(a) * L * 0.5, 0.12, -a, -0.2);
      add(new THREE.SphereGeometry(0.15, 10, 8).scale(1, 0.8, 0.5), new THREE.MeshStandardMaterial({ color: '#f2b3a8', roughness: 0.8 }), x + Math.sin(a) * (L * 0.5 + 0.25), y + Math.cos(a) * (L * 0.5 + 0.25), -0.42, -a); }
    add(fluff(new THREE.SphereGeometry(0.33, 18, 14).scale(1, 1.4, 0.85), 0.04), fur, 1.1, 0.75, 0.05, -1.0);                       // thumb out to the side
    add(fluff(new THREE.SphereGeometry(1, 22, 14).scale(0.92, 0.55, 0.85), 0.07), fur, 0, 0.1, 0);                    // fluffy wrist cuff
    add(new THREE.CylinderGeometry(0.98, 1.06, 3.8, 24, 1, true), suit, 0, -2.2, 0);                                  // sleeve
    for (const y of [-1.25, -2.4]) add(new THREE.TorusGeometry(1.03, 0.075, 8, 32).rotateX(Math.PI / 2), au, 0, y, 0);
    add(new THREE.CylinderGeometry(0.95, 0.95, 0.6, 28, 1, true), au, 0, -0.45, 0);                                   // watch band
    add(new THREE.CylinderGeometry(0.82, 0.86, 0.34, 36).rotateX(Math.PI / 2), au, 0, -0.45, 0.98);                   // big watch body facing camera
    add(new THREE.TorusGeometry(0.78, 0.1, 10, 40), au, 0, -0.45, 1.16);
    add(new THREE.CircleGeometry(0.7, 36), navy, 0, -0.45, 1.16);
    add(new THREE.RingGeometry(0.46, 0.6, 44), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 1.1, 1.7), toneMapped: false }), 0, -0.45, 1.17);
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; add(new THREE.SphereGeometry(0.05, 8, 6), au, Math.cos(a) * 0.79, -0.45 + Math.sin(a) * 0.79, 1.24); }
    add(new THREE.CylinderGeometry(0.11, 0.11, 0.24, 10).rotateZ(Math.PI / 2), au, 0.98, -0.45, 0.98);
    const scr = new THREE.Mesh(new THREE.CircleGeometry(0.36, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 1.45, 2.0), toneMapped: false })); scr.position.set(0, -0.45, 1.18); wrist.add(scr); wrist.userData.scr = scr;
    // merge paw parts per material -> few draw calls
    { const by = new Map(); for (const o of [...wrist.children]) { if (o === scr || !o.isMesh) continue; o.updateMatrix(); let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); g.applyMatrix4(o.matrix); (by.get(o.material) || by.set(o.material, []).get(o.material)).push(g); wrist.remove(o); }
      for (const [m, gs] of by) wrist.add(new THREE.Mesh(mergeGeometries(gs), m)); } }
  const cone = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 32, 1, true), new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, vertexShader: `varying float vY; void main(){ vY = position.y + 0.5; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`, fragmentShader: `uniform float uOpen; uniform float uT; varying float vY; void main(){ gl_FragColor = vec4(vec3(0.2, 0.7, 1.0) * (0.025 + 0.16 * vY * vY + 0.42 * pow(vY, 4.0)) * (1.0 - 0.6 * smoothstep(0.9, 1.0, vY)) * uOpen * (0.85 + 0.15 * sin(uT * 9.0)), 1.0); }` })); cone.renderOrder = 30; scene.add(cone);

  // ---------- state ----------
  let openAt = 0, open = false, openK = 0, yaw = 0, zoom = 1, data = null, region = null, R = 140, cx = 0, cz = 0, S = W / 140, HK = 1, h0 = 0; const pins = [];
  // v52 fisheye: the centre (base, cat) is magnified, the crater walls far away are compressed into the map edge (concept framing)
  let RW = 150, R0 = 30, A = 0.13; const GAM = 0.55; const fwP = (r) => 0.97 * W * Math.pow(r / RW, GAM); /* linear (undistorted) core r<R0, power-law compression outside */ const fw = (r) => r < R0 ? A * r : fwP(r), iw = (rm) => rm < A * R0 ? rm / A : RW * Math.pow(rm / (0.97 * W), 1 / GAM);
  const toMap = (x, z, y) => { const dx = x - cx, dz = z - cz, r = Math.hypot(dx, dz) || 1e-4, k = fw(r) / r; return new THREE.Vector3(dx * k, y != null ? y : 0, dz * k); };
  const toWorld = (mx, mz) => { const rm = Math.hypot(mx, mz) || 1e-4, k = iw(rm) / rm; return [cx + mx * k, cz + mz * k]; };
  const localK = (x, z) => { const r = Math.max(4, Math.hypot(x - cx, z - cz)); return fw(r) / r; };
  const HMAX = 2.0; const hMap = h => HMAX * Math.tanh((h - h0) * A / HMAX); const hAt = (x, z) => hMap(data.groundAt(x, z));
  function buildTerrain() {
    if (terr) { board.remove(terr); terr.geometry.dispose(); }
    const N = PQ === 'low' ? 80 : PQ === 'mobile' ? 100 : 130, g = new THREE.PlaneGeometry(2 * W, 2 * W, N, N).rotateX(-Math.PI / 2); const P = g.attributes.position; const aH = new Float32Array(P.count);
    let mn = 1e9, mx = -1e9; const hs = [], wxz = new Float32Array(P.count * 2); for (let i = 0; i < P.count; i++) { const [x, z] = toWorld(P.getX(i), P.getZ(i)); wxz[i * 2] = x; wxz[i * 2 + 1] = z; const h = data.groundAt(x, z); hs.push(h); mn = Math.min(mn, h); mx = Math.max(mx, h); }
    { const so = hs.slice().sort((a, b) => a - b); h0 = so[Math.floor(so.length * 0.4)]; } for (let i = 0; i < P.count; i++) { const y = hMap(hs[i]); P.setY(i, y); aH[i] = y; }
    HK = 1 / (2 * HMAX); U.uHK.value = HK; g.setAttribute('aH', new THREE.BufferAttribute(aH, 1)); g.setAttribute('aF', new THREE.BufferAttribute(new Float32Array(P.count).fill(1), 1)); g.userData.wxz = wxz; g.computeVertexNormals();
    terr = new THREE.Mesh(g, hmat); terr.renderOrder = 1; board.add(terr); built = region;
  }
  function buildMinis() {
    while (minis.children.length) minis.remove(minis.children[0]);
    const b = data.base; if (!b) return;
    // v52: the REAL base (shared geometry subset + the game's own materials) as the miniature, uniform scale A = the map's linear core
    if (world && !minis.userData.real) { const out = []; for (const nm of ['merged_hull', 'merged_lattice']) { const src = world.getObjectByName(nm); if (!src) continue; const sg = sub(src.geometry, cx, cz, R0 * 1.05); if (sg) { const m = new THREE.Mesh(sg, src.material); m.name = 'map_' + nm; out.push(m); } } minis.userData.real = out; }
    if (minis.userData.real && minis.userData.real.length) { const gb = data.groundAt(b.x, b.z); for (const m of minis.userData.real) { m.scale.setScalar(A); m.position.set(-cx * A, hMap(gb) - gb * A, -cz * A); minis.add(m); } return; }
    const p = toMap(b.x, b.z, hAt(b.x, b.z)); const k = fw(14) / 0.85; void localK;
    const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(p.x + x * k, p.y + y * k, p.z + z * k); minis.add(m); return m; };
    add(new THREE.CylinderGeometry(0.62, 0.62, 0.22, 28), ivory, 0, 0.11, 0); add(new THREE.TorusGeometry(0.62, 0.035, 6, 28).rotateX(Math.PI / 2), gold, 0, 0.23, 0);
    add(new THREE.CircleGeometry(0.42, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 0.9, 0.35), toneMapped: false }), 0, 0.235, 0);
    for (const [x, z, r] of [[-1.0, -0.2, 0.32], [0.95, 0.15, 0.36], [0.2, -0.95, 0.3], [-0.35, 0.95, 0.28], [1.25, -0.8, 0.24]]) { add(new THREE.SphereGeometry(r, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), ivory, x, 0, z); add(new THREE.CylinderGeometry(r, r, 0.12, 18), ivory, x, 0.0, z); }
    add(new THREE.CylinderGeometry(0.09, 0.12, 1.1, 10), ivory, 0.15, 0.75, -0.55); add(new THREE.ConeGeometry(0.09, 0.32, 10), gold, 0.15, 1.46, -0.55);
    for (const [x, z] of [[-0.25, -0.75], [0.55, -0.7]]) { add(new THREE.CylinderGeometry(0.035, 0.05, 0.9, 6), ivory, x, 0.45, z); add(new THREE.ConeGeometry(0.04, 0.16, 6), gold, x, 0.98, z); }
    const dish = add(new THREE.SphereGeometry(0.28, 14, 6, 0, Math.PI * 2, 0, 1.0), ivory, -0.9, 0.55, -0.75); dish.rotation.x = 0.9;
  }
  function sub(g, x0, z0, rad) { const P = g.attributes.position, ix = g.index, n = ix ? ix.count : P.count, keep = []; const v = (i) => ix ? ix.getX(i) : i;
    for (let t = 0; t < n; t += 3) { const a = v(t), b_ = v(t + 1), c = v(t + 2); const x = (P.getX(a) + P.getX(b_) + P.getX(c)) / 3 - x0, z = (P.getZ(a) + P.getZ(b_) + P.getZ(c)) / 3 - z0; if (x * x + z * z < rad * rad) keep.push(a, b_, c); }
    if (!keep.length) return null; const o = new THREE.BufferGeometry(); for (const k of Object.keys(g.attributes)) o.setAttribute(k, g.attributes[k]); o.setIndex(keep); o.userData.tris = keep.length / 3; return o; }
  function pinEl(cls, html) { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; layer.appendChild(d); return d; }
  function rebuildPins() {
    layer.innerHTML = ''; pins.length = 0;
    for (const p of data.pins) pins.push({ ...p, y: hAt(p.x, p.z), el: pinEl('mkm-pin' + (p.kind === 'hint' ? ' h' : p.kind === 'quest' ? ' q' : ''), `<span class="i">${ICONS[p.icon] || p.icon}</span>${p.label ? `<span>${p.label}</span>` : ''}`), lift: p.kind === 'hint' ? 0.6 : 2.1 });
    for (const c of data.crew) { const el = pinEl('mkm-bot', `<svg viewBox="0 0 30 30"><circle cx="15" cy="15" r="13" fill="none" stroke="rgba(110,220,255,.3)" stroke-width="3"/><circle cx="15" cy="15" r="13" fill="none" stroke="#ffd25a" stroke-width="3" stroke-linecap="round" stroke-dasharray="81.7" stroke-dashoffset="${(81.7 * (1 - Math.max(0, c.prog))).toFixed(1)}" transform="rotate(-90 15 15)" ${c.prog < 0 ? 'opacity="0"' : ''}/></svg><b>🤖</b>`); pins.push({ x: c.x, z: c.z, y: hAt(c.x, c.z), el, lift: 0.5, bot: true }); }
    for (const [key, icon, mp_, cls] of [['map_cfield', '💎', DECOR.field, ' f'], ['map_crater', '🕳️', DECOR.crater, ' f']]) { const [wx, wz] = toWorld(mp_[0], mp_[1]); pins.push({ x: wx, z: wz, y: hAtM(mp_[0], mp_[1]), kind: 'decor', el: pinEl('mkm-pin' + cls, `<span class="i">${ICONS[icon]}</span><span>${t(key)}</span>`), lift: 2.6 }); }
    const ce = pinEl('mkm-cat', t('mapYou')); pins.push({ x: data.me.x, z: data.me.z, y: hAt(data.me.x, data.me.z), el: ce, lift: 0.4, cat: true });
    // lines from pins down to the terrain
    if (board.userData.lines) { board.remove(board.userData.lines); board.userData.lines.geometry.dispose(); }
    const L = []; for (const p of pins) { if (p.bot || p.cat || p.kind !== 'hint') continue; const q = toMap(p.x, p.z, p.y); L.push(q.x, q.y, q.z, q.x, q.y + p.lift, q.z); }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(L, 3)); const lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: new THREE.Color(0.4, 1.1, 1.6), toneMapped: false, transparent: true, opacity: 0.85 })); board.add(lines); board.userData.lines = lines;
  }
  function bakeFog() { if (!terr) return; const f = data.fog, n = FOG_N, rg = data.region, cell = 2 * rg.R / n, A_ = terr.geometry.attributes.aF, w = terr.geometry.userData.wxz; const at = (i, j) => (i < 0 || j < 0 || i >= n || j >= n) ? 1 : f[j * n + i];
    for (let k = 0; k < A_.count; k++) { const gx = (w[k * 2] - rg.x + rg.R) / cell - 0.5, gz = (w[k * 2 + 1] - rg.z + rg.R) / cell - 0.5; const i = Math.floor(gx), j = Math.floor(gz), u = gx - i, v = gz - j; A_.array[k] = (at(i, j) * (1 - u) + at(i + 1, j) * u) * (1 - v) + (at(i, j + 1) * (1 - u) + at(i + 1, j + 1) * u) * v; } A_.needsUpdate = true; }
  function updateFogTex() { bakeFog(); const f = data.fog; const d = fogT.image.data; for (let i = 0; i < FOG_N * FOG_N; i++) { const v = f[i] ? 255 : 0; d[i * 4] = v; d[i * 4 + 1] = v; d[i * 4 + 2] = v; d[i * 4 + 3] = 255; } fogT.needsUpdate = true; }
  function sync() {
    data = api.getData(); if (!data) return;
    if (data.region.key !== region || !terr) { region = data.region.key; R = data.region.R; cx = data.region.x; cz = data.region.z; if (data.base) { cx = data.base.x - 3; cz = data.base.z + 3; } /* v52: centre on the base (+ a bit toward the crew yard) */ S = W / R; RW = data.region.RW || Math.max(R * 1.6, 140); R0 = R / 2.2; A = fwP(R0) / R0; U.uRW.value = RW; U.uFR.value = R; U.uA.value = A; U.uR0.value = R0; buildTerrain(); buildMinis(); buildDecor(); }
    updateFogTex();
    if (world && !scene.userData.realEarth) { scene.userData.realEarth = true; const sk = world.getObjectByName('sky'); let src = null; if (sk) sk.traverse(o => { if (!src && o.isMesh && o.geometry && o.geometry.type === 'SphereGeometry' && o.geometry.parameters.radius === 1) src = o; }); if (src) { const e = scene.userData.earth; e.geometry = src.geometry; e.material = src.material; e.scale.setScalar(7); } } /* v52: the game's own textured Earth */
    const cs = data.crystals.slice(0, 21); const M = new THREE.Matrix4(); let ci = 0; cs.forEach((c, i) => { const b0 = toMap(c.x, c.z, hAt(c.x, c.z)); for (let k = 0; k < 3; k++) { const a = i * 2.4 + k * 2.1, o = k ? 0.22 : 0; const p = b0.clone().add(new THREE.Vector3(Math.cos(a) * o, 0, Math.sin(a) * o)); const s = (k ? 0.26 : 0.42) + 0.08 * ((i * 0.618) % 1); M.compose(p.setY(p.y + s * 0.9), new THREE.Quaternion().setFromEuler(new THREE.Euler(k ? 0.35 * Math.cos(a) : 0, a, k ? 0.35 * Math.sin(a) : 0)), new THREE.Vector3(s, s, s)); crysI.setMatrixAt(ci++, M); } }); crysI.count = ci; crysI.instanceMatrix.needsUpdate = true;
    { const M2 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1); const cr = data.crew.slice(0, 12); cr.forEach((c, i) => { const p = toMap(c.x, c.z, hAt(c.x, c.z)); q.setFromEuler(new THREE.Euler(0, (c.yaw || 0), 0)); M2.compose(p.clone().setY(p.y + 0.24), q, one); botB.setMatrixAt(i, M2); M2.compose(p.clone().setY(p.y + 0.3).add(new THREE.Vector3(Math.sin(c.yaw || 0) * 0.1, 0, Math.cos(c.yaw || 0) * 0.1)), q, one); botV.setMatrixAt(i, M2); M2.compose(p.clone().setY(p.y + 0.03), q, one); botR.setMatrixAt(i, M2); }); for (const m of [botB, botV, botR]) { m.count = cr.length; m.instanceMatrix.needsUpdate = true; } }
    const mp = toMap(data.me.x, data.me.z, hAt(data.me.x, data.me.z) + 0.12); catM.position.copy(mp); catM.rotation.y = data.me.yaw + Math.PI;
    const tg = data.target; beam.visible = ring.visible = !!tg; path.visible = false; if (tube) { board.remove(tube); tube.geometry.dispose(); tube = null; }
    if (tg) { const tp = toMap(tg.x, tg.z, hAt(tg.x, tg.z)); beam.position.copy(tp); ring.position.copy(tp).setY(tp.y + 0.05); const A = pathG.attributes.position; const mx = (mp.x + tp.x) / 2, mz = (mp.z + tp.z) / 2; const nx = -(tp.z - mp.z) * 0.18, nz = (tp.x - mp.x) * 0.18;
      for (let i = 0; i < NP; i++) { const u = i / (NP - 1); const x = (1 - u) * (1 - u) * mp.x + 2 * u * (1 - u) * (mx + nx) + u * u * tp.x, z = (1 - u) * (1 - u) * mp.z + 2 * u * (1 - u) * (mz + nz) + u * u * tp.z; const [wx, wz] = toWorld(x, z); A.setXYZ(i, x, hAt(wx, wz) + 0.32, z); } A.needsUpdate = true;
      const pts = []; for (let i = 0; i < NP; i++) pts.push(new THREE.Vector3().fromBufferAttribute(A, i)); tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 90, 0.11, 6, false), tubeM); tube.renderOrder = 20; board.add(tube); }
    rebuildPins(); buildTrails();
    $('#mkm-title').textContent = data.region.name; $('#mkm-card .t').innerHTML = `${data.quest ? `<b>${t('mapQ')}</b>${data.quest.title.replace(/^\S+\s/, '')}` : t('mapNoQuest')}${data.quest && data.quest.sub ? `<small>${data.quest.sub}</small>` : ''}`; $('#mkm-go').textContent = t('mapGo'); $('#mkm-go').style.display = tg ? '' : 'none';
    const cvs = renderer.domElement; void cvs;
  }
  // ---------- input ----------
  const cv = $('#mk-map-cv'); const ptrs = new Map(); let pinch0 = 0, z0 = 1;
  cv.addEventListener('pointerdown', e => { ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); cv.setPointerCapture(e.pointerId); if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); z0 = zoom; } });
  cv.addEventListener('pointermove', e => { const p = ptrs.get(e.pointerId); if (!p) return; if (ptrs.size === 1) { yaw -= (e.clientX - p.x) * 0.008; } p.x = e.clientX; p.y = e.clientY; if (ptrs.size === 2 && pinch0) { const [a, b] = [...ptrs.values()]; zoom = Math.min(2.6, Math.max(0.7, z0 * Math.hypot(a.x - b.x, a.y - b.y) / pinch0)); } });
  const up = e => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch0 = 0; }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', e => { zoom = Math.min(2.6, Math.max(0.7, zoom * (e.deltaY > 0 ? 0.9 : 1.1))); }, { passive: true });
  ui.querySelectorAll('#mkm-zoom button').forEach(b => b.addEventListener('click', () => { zoom = Math.min(2.6, Math.max(0.7, zoom * (b.dataset.z === '1' ? 1.25 : 0.8))); }));
  $('#mkm-x').addEventListener('click', () => api.close());
  $('#mkm-go').addEventListener('click', () => { api.close(); onGo && onGo(); });
  addEventListener('keydown', e => { if (open && (e.code === 'Escape' || e.code === 'KeyM')) api.close(); });

  const pv = new THREE.Vector3(); let T = 0;
  const api = {
    getData: null, get open() { return open; },
    show() { if (open) return; open = true; openK = 0; openAt = performance.now(); ui.classList.add('on'); document.body.classList.add('mk-mapopen'); yaw = 0; zoom = 1; sync(); },
    close() { if (!open) return; open = false; ui.classList.remove('on'); document.body.classList.remove('mk-mapopen'); api.onClose && api.onClose(); },
    toggle() { open ? api.close() : api.show(); },
    frame(dt) {
      T += dt; openK = Math.min(1, (performance.now() - openAt) / 450); U.uT.value = T; U.uOpen.value = openK < 1 ? openK * (0.6 + 0.4 * Math.sin(T * 60.0) * (1 - openK)) + openK * 0.4 : 1;
      const w = innerWidth, h = innerHeight; const pr = renderer.getPixelRatio(); const port = h > w;
      cam.aspect = w / h; cam.fov = port ? 62 : 42; cam.updateProjectionMatrix();
      const dist = (port ? Math.max(23.5, 40 * 0.462 / cam.aspect) : 17) / zoom, ox = port ? 0.0 : 1.9; cam.position.set(ox, dist * (port ? 0.85 : 0.4), dist * (port ? 0.53 : 0.92)); cam.lookAt(ox, port ? -1.6 : -1.0, port ? 1.6 : -0.4); // v61 portrait: whole slab fits the width (solved: |x_ndc|<=0.96 at 390x844)
      board.rotation.y = yaw; board.scale.setScalar(0.25 + 0.75 * (1 - Math.pow(1 - openK, 3))); board.position.y = 0;
      board.rotation.x = 0; board.rotation.z = 0;
      scene.userData.earth.rotation.y += dt * 0.03; scene.userData.earth.position.set(port ? 9 : 25, port ? 9 : -9, port ? -40 : -50);
      // wrist in the lower-left foreground, projection cone from the screen to the board
      wrist.position.set(port ? -0.75 : -1.9, port ? -1.9 : -1.25, -5.0); wrist.rotation.set(-0.75, 0.15, -0.8, 'YXZ'); wrist.scale.setScalar(port ? 0.34 : 0.4);
      cam.updateMatrixWorld(true); const s0 = wrist.userData.scr.getWorldPosition(new THREE.Vector3()); const s1 = new THREE.Vector3(0, 0, 0); const mid = s0.clone().add(s1).multiplyScalar(0.5); const len = s0.distanceTo(s1);
      cone.position.copy(mid); cone.scale.set(W * 0.26 * board.scale.x, len, W * 0.26 * board.scale.x); cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), s1.clone().sub(s0).normalize());
      catM.children[0].material.color.setScalar(1).setRGB(1.6, 0.7 + 0.2 * Math.sin(T * 5), 0.15);
      const path_ = pathG.attributes.position; void path_; path.material.size = 0.2 + 0.05 * Math.sin(T * 6);
      board.updateMatrixWorld(true);
      const prj = (x, z, y) => { pv.copy(toMap(x, z, y)); board.localToWorld(pv); pv.project(cam); return [(pv.x + 1) / 2 * w, (1 - pv.y) / 2 * h, pv.z < 1 && Math.abs(pv.x) < 1.15 && Math.abs(pv.y) < 1.15]; };
      const compact = w < 560 && zoom < 1.35; for (const p of pins) if (!p.bot && !p.cat && p.kind !== 'hint') p.el.classList.toggle('c', compact && p.kind !== 'quest' && p.icon !== '🏠');
      for (const p of pins) { const [gx, gy, gv] = prj(p.x, p.z, p.y); p.gx = gx; p.gy = gy; const [sx, sy] = prj(p.x, p.z, p.y + p.lift); p.sx = sx; p.sy = sy; p.vis = gv; p.el.style.display = gv && openK > 0.6 ? '' : 'none'; }
      { const placed = []; const sm = w < 560 ? 0.72 : 1; const bsp = data.base ? prj(data.base.x, data.base.z, hAt(data.base.x, data.base.z)) : null; const lab = pins.filter(p => p.vis && !p.bot && !p.cat).sort((a, b) => (a.kind === 'hint') - (b.kind === 'hint') || b.gy - a.gy);
        for (const p of lab) { const hint = p.kind === 'hint', bw = (p.el.offsetWidth || (hint ? 26 : 84) * sm) + (sm < 1 ? 8 : 0), bh = (p.el.offsetHeight || (hint ? 26 : 56) * sm) + (sm < 1 ? 6 : 0), stalk = p.gy - p.sy; let best = null;
          const C = hint ? [[0, 1], [0, 1.5], [-1, 1], [1, 1]] : [[0, 1], [0, 1.45], [-0.75, 1.2], [0.75, 1.2], [0, 1.9], [-1.0, 1.6], [1.0, 1.6], [0, 0.75], [-1.4, 1.1], [1.4, 1.1], [0, 2.4], [-1.2, 2.1], [1.2, 2.1], [-2.0, 1.0], [2.0, 1.0], [-2.0, 0.6], [2.0, 0.6], [-1.0, 0.55], [1.0, 0.55], [-2.6, 1.3], [2.6, 1.3], [-3.2, 1.0], [3.2, 1.0], [-2.2, 1.9], [2.2, 1.9]];
          let bs = 1e9; for (const [kx, kl] of C) { const x = Math.min(w - bw / 2 - 4, Math.max(bw / 2 + 4, p.gx + kx * (bw + 6))), y = p.gy - stalk * kl; if (y - bh < 30 || y > h - 70) continue; let ov = 0; for (const q of placed) { const ox = (bw + q.w) / 2 + 4 - Math.abs(q.x - x), oy = (bh + q.h) / 2 + 4 - Math.abs((q.y - q.h / 2) - (y - bh / 2)); if (ox > 0 && oy > 0) ov += ox * oy; } const db = bsp && sm === 1 && !hint ? Math.hypot(x - bsp[0], (y - bh / 2) - bsp[1]) : 999; const sc = ov * 10 + Math.abs(kx) * 8 + Math.abs(kl - 1) * 6 + Math.max(0, 230 - db) * 2.2; if (sc < bs) { bs = sc; best = [x, y]; } if (ov === 0 && kx === 0 && kl === 1 && db > 230) break; }
          if (!best) best = [p.sx, p.sy]; placed.push({ x: best[0], y: best[1], w: bw, h: bh }); p.sx = best[0]; p.sy = best[1]; } }
      for (const p of pins) if (p.vis) p.el.style.transform = `translate(${p.sx.toFixed(1)}px,${p.sy.toFixed(1)}px) translate(-50%,${p.bot ? '-50%' : '-100%'})`;
      { let svg = ''; for (const p of pins) { if (!p.vis || p.bot || p.cat || p.kind === 'hint' || openK < 0.6) continue; const q = p.kind === 'quest' ? '#ffd25a' : p.kind === 'decor' ? 'rgba(120,225,255,.55)' : 'rgba(120,225,255,.9)'; svg += `<line x1="${p.gx.toFixed(1)}" y1="${p.gy.toFixed(1)}" x2="${p.sx.toFixed(1)}" y2="${p.sy.toFixed(1)}" stroke="${q}" stroke-width="1.6" ${p.kind === 'decor' ? 'stroke-dasharray="4 3"' : ''}/><circle cx="${p.gx.toFixed(1)}" cy="${p.gy.toFixed(1)}" r="3.2" fill="${q}"/><circle cx="${p.gx.toFixed(1)}" cy="${p.gy.toFixed(1)}" r="7" fill="none" stroke="${q}" stroke-width="1" opacity=".6"/>`; } $('#mkm-stalks').innerHTML = svg; }
      const tm = renderer.toneMapping; renderer.toneMapping = THREE.ACESFilmicToneMapping; const ot = renderer.getRenderTarget(); renderer.setRenderTarget(null); renderer.render(scene, cam); renderer.setRenderTarget(ot); renderer.toneMapping = tm; void pr;
    },
    stats() { return renderer.info.render; },
    dbg() { const p = pins[0]; if (!p) return { n: 0, openK }; const q = toMap(p.x, p.z, p.y + p.lift); board.localToWorld(q); const w = q.clone(); q.project(cam); return { n: pins.length, openK, w: [w.x, w.y, w.z], ndc: [q.x, q.y, q.z], cam: cam.position.toArray(), disp: p.el.style.display }; },
  };
  return api;
}

// fog-of-war helpers (save: store.data.mapFog[region] = hex string of FOG_N*FOG_N bits)
export function fogGet(store, key) { const D = store.data; D.mapFog ||= {}; const s = D.mapFog[key] || ''; const a = new Uint8Array(FOG_N * FOG_N); for (let i = 0; i < s.length && i * 4 < a.length; i++) { const v = parseInt(s[i], 16); for (let b = 0; b < 4; b++) a[i * 4 + b] = (v >> b) & 1; } return a; }
export function fogSet(store, key, a) { let s = ''; for (let i = 0; i < a.length; i += 4) s += ((a[i] | (a[i + 1] << 1) | (a[i + 2] << 2) | (a[i + 3] << 3)) >>> 0).toString(16); store.data.mapFog ||= {}; store.data.mapFog[key] = s; }
export function fogReveal(a, region, x, z, rad) { const n = FOG_N; let ch = false; const cell = (2 * region.R) / n; const gx = (x - region.x + region.R) / cell, gz = (z - region.z + region.R) / cell; const rc = rad / cell; for (let j = Math.floor(gz - rc); j <= Math.ceil(gz + rc); j++) for (let i = Math.floor(gx - rc); i <= Math.ceil(gx + rc); i++) { if (i < 0 || j < 0 || i >= n || j >= n) continue; if (Math.hypot(i + 0.5 - gx, j + 0.5 - gz) > rc + 0.5) continue; const k = j * n + i; if (!a[k]) { a[k] = 1; ch = true; } } return ch; }
export const FOG_SIZE = FOG_N;
