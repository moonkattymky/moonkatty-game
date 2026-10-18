// Holographic 3D world map (concept 09b1aaa3, "variant B"): the cat raises its paw, the gold wrist device projects a tilted
// cyan hologram of the real terrain of the current region. Modal: while open the world is not updated/rendered (main.js).
// Shows: holo terrain (cyan contour edges, scanlines, flicker, translucency), miniature base, crystals, holo pins with icons +
// labels, orange cat marker (position + heading), quest target (yellow beam + dotted gold path), robots with progress rings,
// fog of war (persisted, dim + flickering), undiscovered caches as hints, bottom quest card with GO, zoom / rotate / close.
import * as THREE from 'three';

const FOG_N = 32;
const CSS = `
#mk-map-ui{position:fixed;inset:0;z-index:6;pointer-events:none;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;display:none}
#mk-map-ui.on{display:block}
body.mk-mapopen #mk-root,body.mk-mapopen #joy,body.mk-mapopen #jump,body.mk-mapopen #views,body.mk-mapopen .hud{display:none!important}
#mk-map-ui .pe{pointer-events:auto}
#mk-map-cv{position:absolute;inset:0;width:100%;height:100%;pointer-events:auto;touch-action:none}
.mkm-pin{position:absolute;left:0;top:0;transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;gap:3px;padding:5px 8px 4px;min-width:54px;border-radius:7px;border:1.5px solid rgba(110,220,255,.95);background:linear-gradient(180deg,rgba(20,70,130,.62),rgba(6,24,60,.72));box-shadow:0 0 12px rgba(80,200,255,.65),inset 0 0 10px rgba(110,220,255,.25);color:#e6fbff;font-size:10.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap;text-shadow:0 0 6px rgba(110,220,255,.8)}
.mkm-pin .i{font-size:20px;line-height:1;filter:drop-shadow(0 0 6px rgba(110,220,255,.9))}
.mkm-pin.q{border-color:#ffd25a;box-shadow:0 0 14px rgba(255,200,80,.8);color:#fff3cf}
.mkm-pin.h{opacity:.55;border-style:dashed;min-width:0;padding:3px 6px}
.mkm-pin.h .i{font-size:14px}
.mkm-bot{position:absolute;left:0;top:0;width:30px;height:30px;transform:translate(-50%,-50%)}
.mkm-bot svg{position:absolute;inset:0}
.mkm-bot b{position:absolute;inset:5px;border-radius:50%;background:radial-gradient(circle,#123a66,#081a36);display:flex;align-items:center;justify-content:center;font-size:12px}
.mkm-cat{position:absolute;left:0;top:0;transform:translate(-50%,-160%);font-size:10px;font-weight:900;color:#ffb35a;text-shadow:0 0 6px #000;white-space:nowrap}
#mkm-card{position:absolute;left:50%;bottom:max(18px,max(env(safe-area-inset-bottom),var(--tg-inset-bottom,0px)));transform:translateX(-50%);display:flex;align-items:center;gap:14px;padding:11px 12px 11px 18px;border-radius:8px;border:1.5px solid rgba(110,220,255,.9);background:linear-gradient(180deg,rgba(12,30,60,.85),rgba(5,14,34,.9));box-shadow:0 0 0 2px rgba(200,145,42,.55),0 0 18px rgba(80,200,255,.5);color:#e6fbff;max-width:92vw}
#mkm-card .t{font-size:15px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:58vw}
#mkm-card .t small{display:block;font-size:10.5px;letter-spacing:.08em;color:#9fe6ff;font-weight:700;text-transform:none;margin-top:2px}
#mkm-go{border:1.5px solid #8a5c12;border-radius:7px;padding:9px 16px;background:linear-gradient(180deg,#f6d987,#C8912A);color:#2a1a04;font-weight:900;font-size:14px;letter-spacing:.06em;box-shadow:0 0 10px rgba(255,200,80,.6)}
#mkm-x{position:absolute;right:max(14px,max(env(safe-area-inset-right),var(--tg-inset-right,0px)));top:max(14px,max(env(safe-area-inset-top),var(--tg-inset-top,0px)));width:42px;height:42px;border-radius:50%;border:1.5px solid rgba(110,220,255,.9);background:rgba(6,20,46,.8);color:#cff6ff;font-size:24px;line-height:38px;text-align:center;box-shadow:0 0 10px rgba(80,200,255,.6)}
#mkm-zoom{position:absolute;right:max(14px,max(env(safe-area-inset-right),var(--tg-inset-right,0px)));top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:8px}
#mkm-zoom button{width:40px;height:40px;border-radius:10px;border:1.5px solid rgba(110,220,255,.9);background:rgba(6,20,46,.8);color:#cff6ff;font-size:22px;font-weight:800}
#mkm-title{position:absolute;left:50%;top:max(14px,max(env(safe-area-inset-top),var(--tg-inset-top,0px)));transform:translateX(-50%);font-size:11px;letter-spacing:.3em;color:#9fe6ff;font-weight:800;text-shadow:0 0 8px rgba(110,220,255,.9);text-transform:uppercase}
`;

const holoVS = `varying vec3 vW; varying vec3 vL; varying float vH; attribute float aH; void main(){ vL = position; vH = aH; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const holoFS = `uniform float uT; uniform float uOpen; uniform sampler2D uFog; uniform float uR; uniform float uHK;
varying vec3 vW; varying vec3 vL; varying float vH;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
void main(){
  vec2 uv = vL.xz / (2.0 * uR) + 0.5; float m = pow(abs(vL.x / uR), 4.0) + pow(abs(vL.z / uR), 4.0); if (m > 1.0) discard;
  float fog = texture2D(uFog, uv).r;
  vec3 dx = dFdx(vW), dy = dFdy(vW); vec3 n = normalize(cross(dx, dy)); float sl = 1.0 - abs(n.y);
  float shade = 0.55 + 0.45 * clamp(dot(n, normalize(vec3(-0.4, 0.8, 0.3))), 0.0, 1.0);
  vec3 rock = mix(vec3(0.16, 0.18, 0.24), vec3(0.42, 0.42, 0.46), clamp(vH * uHK * 1.4 + 0.45, 0.0, 1.0)) * shade;
  float ct = abs(fract(vH * uHK * 9.0) - 0.5); float cl = 1.0 - smoothstep(0.0, 0.06 + fwidth(vH * uHK * 9.0) * 1.5, ct);
  float ridge = smoothstep(0.35, 0.85, sl);
  float scan = 0.82 + 0.18 * sin(gl_FragCoord.y * 1.6 + uT * 6.0);
  float flick = 0.93 + 0.07 * sin(uT * 23.0 + hash(floor(uv * 40.0)) * 6.28);
  vec3 cyan = vec3(0.25, 0.85, 1.0);
  float tx = vn(vL.xz * 2.2) * 0.5 + vn(vL.xz * 6.0) * 0.3 + vn(vL.xz * 17.0) * 0.2; rock *= 0.7 + 0.75 * tx;
  vec3 col = rock * 1.05 + cyan * (cl * 0.35 + ridge * 0.35 + 0.06);
  float edge = smoothstep(0.82, 1.0, m); col += cyan * edge * 0.9;
  float grid = (1.0 - smoothstep(0.0, 0.03, abs(fract(vL.x / uR * 6.0) - 0.5) - 0.47)) + (1.0 - smoothstep(0.0, 0.03, abs(fract(vL.z / uR * 6.0) - 0.5) - 0.47));
  col += cyan * grid * 0.05;
  float unk = 1.0 - fog; float noise = hash(floor(uv * 90.0) + floor(uT * 9.0));
  col = mix(col, vec3(0.06, 0.2, 0.36) * (0.7 + 0.6 * tx) + cyan * (0.1 * noise + cl * 0.2 + ridge * 0.15), unk * 0.75);
  float a = (0.92 - unk * 0.35) * scan * flick * uOpen;
  gl_FragColor = vec4(col * scan * flick, a);
}`;

function fogTex() { const d = new Uint8Array(FOG_N * FOG_N * 4); const t = new THREE.DataTexture(d, FOG_N, FOG_N, THREE.RGBAFormat); t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; return t; }

export function makeHoloMap({ renderer, t, onGo }) {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const ui = document.createElement('div'); ui.id = 'mk-map-ui';
  ui.innerHTML = `<canvas id="mk-map-cv"></canvas><div id="mkm-layer"></div><div id="mkm-title"></div><button id="mkm-x" class="pe" aria-label="close">×</button><div id="mkm-zoom" class="pe"><button data-z="1">+</button><button data-z="-1">−</button></div><div id="mkm-card" class="pe"><div class="t"></div><button id="mkm-go"></button></div>`;
  document.body.appendChild(ui); const $ = (s) => ui.querySelector(s); const layer = $('#mkm-layer');
  for (const ev of ['pointerdown', 'touchstart', 'wheel', 'keydown']) ui.addEventListener(ev, e => e.stopPropagation(), { passive: true });

  const scene = new THREE.Scene(); scene.background = new THREE.Color('#03060f');
  const cam = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
  scene.add(new THREE.HemisphereLight('#bfe6ff', '#1a2030', 1.4)); const dl = new THREE.DirectionalLight('#fff4dc', 2.2); dl.position.set(-6, 12, 8); scene.add(dl);
  { // starfield + earth
    const n = 900, p = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const u = Math.random() * 2 - 1, a = Math.random() * 6.283, r = 90; const s = Math.sqrt(1 - u * u); p[i * 3] = Math.cos(a) * s * r; p[i * 3 + 1] = Math.abs(u) * r * 0.9 + 4; p[i * 3 + 2] = Math.sin(a) * s * r; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: '#cfe6ff', size: 1.6, sizeAttenuation: false })));
    const earth = new THREE.Mesh(new THREE.SphereGeometry(7, 32, 20), new THREE.MeshStandardMaterial({ color: '#2a5aa8', emissive: '#0c2a66', roughness: 0.8 })); earth.position.set(22, 13, -60); scene.add(earth); scene.userData.earth = earth;
  }
  const W = 10; // map half-size in scene units
  const board = new THREE.Group(); scene.add(board);
  const fogT = fogTex();
  const U = { uT: { value: 0 }, uOpen: { value: 0 }, uFog: { value: fogT }, uR: { value: W }, uHK: { value: 1 } };
  const hmat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: holoVS, fragmentShader: holoFS, transparent: true, depthWrite: true, side: THREE.DoubleSide, extensions: { derivatives: true } });
  let terr = null, built = null;
  // holo rim: glowing vertical ribbon around the superellipse edge + base plate glow
  const rimPts = []; for (let i = 0; i <= 128; i++) { const a = i / 128 * Math.PI * 2; const c = Math.cos(a), s = Math.sin(a); const k = Math.pow(Math.pow(Math.abs(c), 4) + Math.pow(Math.abs(s), 4), -0.25); rimPts.push(c * k * W, s * k * W); }
  const rimGeo = (() => { const P = [], A = []; for (let i = 0; i < rimPts.length / 2; i++) { const x = rimPts[i * 2], z = rimPts[i * 2 + 1]; P.push(x, -0.6, z, x, 0.9, z); A.push(0, 1); } const idx = []; for (let i = 0; i < rimPts.length / 2 - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aV', new THREE.Float32BufferAttribute(A, 1)); g.setIndex(idx); return g; })();
  const rim = new THREE.Mesh(rimGeo, new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, vertexShader: `attribute float aV; varying float vV; void main(){ vV = aV; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`, fragmentShader: `uniform float uT; uniform float uOpen; varying float vV; void main(){ float a = (1.0 - vV) * 0.55 + exp(-vV * 30.0) * 0.6; float sc = 0.8 + 0.2 * sin(gl_FragCoord.y * 1.4 - uT * 5.0); gl_FragColor = vec4(vec3(0.25, 0.8, 1.0) * a * sc * uOpen, 1.0); }` }));
  board.add(rim);
  const minis = new THREE.Group(); board.add(minis);
  const ivory = new THREE.MeshStandardMaterial({ color: '#efe6d2', roughness: 0.5, metalness: 0.1, emissive: '#3a3020' }), gold = new THREE.MeshStandardMaterial({ color: '#d9a640', roughness: 0.35, metalness: 0.8, emissive: '#3a2400' });
  const crysM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.45, 0.85, 1.6), toneMapped: false });
  const crysI = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0).scale(0.5, 1.3, 0.5), crysM, 64); crysI.count = 0; board.add(crysI);
  // cat marker (orange arrow + glow), target beam + ring, dotted path
  const catM = new THREE.Group(); { const sh = new THREE.Shape(); sh.moveTo(0, 0.55); sh.lineTo(0.38, -0.35); sh.lineTo(0, -0.15); sh.lineTo(-0.38, -0.35); sh.closePath(); const g = new THREE.ExtrudeGeometry(sh, { depth: 0.08, bevelEnabled: false }).rotateX(-Math.PI / 2); const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.7, 0.15), toneMapped: false })); catM.add(m); const d = new THREE.Mesh(new THREE.CircleGeometry(0.7, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 0.4, 0.05), transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false })); d.position.y = -0.02; catM.add(d); } board.add(catM);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.32, 6, 16, 1, true).translate(0, 3, 0), new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, vertexShader: `varying float vY; void main(){ vY = position.y / 6.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`, fragmentShader: `uniform float uT; uniform float uOpen; varying float vY; void main(){ float a = (1.0 - vY) * (0.75 + 0.25 * sin(uT * 6.0 - vY * 12.0)); gl_FragColor = vec4(vec3(1.4, 1.0, 0.25) * a * uOpen, 1.0); }` })); board.add(beam);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.55, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.05, 0.3), toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); board.add(ring);
  const NP = 60; const pathG = new THREE.BufferGeometry(); pathG.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NP * 3), 3));
  const path = new THREE.Points(pathG, new THREE.PointsMaterial({ color: new THREE.Color(1.6, 1.15, 0.35), size: 0.22, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); board.add(path);
  // the wrist device: fluffy paw + gold bracelet with a cyan screen, projection cone toward the map
  const wrist = new THREE.Group(); scene.add(cam); cam.add(wrist);
  { const fur = new THREE.MeshStandardMaterial({ color: '#efe3cc', roughness: 1 }); const hand = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16).scale(1.0, 0.85, 1.25), fur); hand.position.set(0, 0.25, -0.9); wrist.add(hand);
    for (let k = 0; k < 4; k++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 10), fur); f.position.set(-0.6 + k * 0.4, 0.75 + (k === 1 || k === 2 ? 0.15 : 0), -1.75); wrist.add(f); }
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.0, 3.2, 20).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#e9dfca', roughness: 0.8 })); arm.position.set(0, -0.1, 1.4); wrist.add(arm);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 0.98, 0.8, 28, 1, true).rotateX(Math.PI / 2), gold); band.position.set(0, -0.05, 0.25); wrist.add(band);
    const face = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.22, 28), gold); face.position.set(0, 0.95, 0.25); wrist.add(face);
    const scr = new THREE.Mesh(new THREE.CircleGeometry(0.48, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 1.2, 1.8), toneMapped: false })); scr.position.set(0, 1.07, 0.25); wrist.add(scr); wrist.userData.scr = scr; }
  const cone = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 32, 1, true), new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, vertexShader: `varying float vY; void main(){ vY = position.y + 0.5; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`, fragmentShader: `uniform float uOpen; uniform float uT; varying float vY; void main(){ gl_FragColor = vec4(vec3(0.2, 0.7, 1.0) * (0.03 + 0.07 * vY * vY) * uOpen * (0.85 + 0.15 * sin(uT * 9.0)), 1.0); }` })); scene.add(cone);

  // ---------- state ----------
  let openAt = 0, open = false, openK = 0, yaw = 0, zoom = 1, data = null, region = null, R = 140, cx = 0, cz = 0, S = W / 140, HK = 1, h0 = 0; const pins = [];
  const toMap = (x, z, y) => new THREE.Vector3((x - cx) * S, y != null ? y : 0, (z - cz) * S);
  const HMAX = 1.5; const hMap = h => HMAX * Math.tanh((h - h0) * S * 3.0 / HMAX); const hAt = (x, z) => hMap(data.groundAt(x, z));
  function buildTerrain() {
    if (terr) { board.remove(terr); terr.geometry.dispose(); }
    const N = 110, g = new THREE.PlaneGeometry(2 * W, 2 * W, N, N).rotateX(-Math.PI / 2); const P = g.attributes.position; const aH = new Float32Array(P.count);
    let mn = 1e9, mx = -1e9; const hs = []; for (let i = 0; i < P.count; i++) { const x = cx + P.getX(i) / S, z = cz + P.getZ(i) / S; const h = data.groundAt(x, z); hs.push(h); mn = Math.min(mn, h); mx = Math.max(mx, h); }
    { const so = hs.slice().sort((a, b) => a - b); h0 = so[Math.floor(so.length * 0.4)]; } for (let i = 0; i < P.count; i++) { const y = hMap(hs[i]); P.setY(i, y); aH[i] = y; }
    HK = 1 / (2 * HMAX); U.uHK.value = HK; g.setAttribute('aH', new THREE.BufferAttribute(aH, 1)); g.computeVertexNormals();
    terr = new THREE.Mesh(g, hmat); terr.renderOrder = 1; board.add(terr); built = region;
  }
  function buildMinis() {
    while (minis.children.length) minis.remove(minis.children[0]);
    const b = data.base; if (!b) return; const p = toMap(b.x, b.z, hAt(b.x, b.z)); const k = Math.max(0.6, 26 * S);
    const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(p.x + x * k, p.y + y * k, p.z + z * k); minis.add(m); return m; };
    add(new THREE.CylinderGeometry(0.62, 0.62, 0.22, 28), ivory, 0, 0.11, 0); add(new THREE.TorusGeometry(0.62, 0.035, 6, 28).rotateX(Math.PI / 2), gold, 0, 0.23, 0);
    add(new THREE.CircleGeometry(0.42, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 0.9, 0.35), toneMapped: false }), 0, 0.235, 0);
    for (const [x, z, r] of [[-1.0, -0.2, 0.32], [0.95, 0.15, 0.36], [0.2, -0.95, 0.3], [-0.35, 0.95, 0.28], [1.25, -0.8, 0.24]]) { add(new THREE.SphereGeometry(r, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), ivory, x, 0, z); add(new THREE.CylinderGeometry(r, r, 0.12, 18), ivory, x, 0.0, z); }
    add(new THREE.CylinderGeometry(0.09, 0.12, 1.1, 10), ivory, 0.15, 0.75, -0.55); add(new THREE.ConeGeometry(0.09, 0.32, 10), gold, 0.15, 1.46, -0.55);
    for (const [x, z] of [[-0.25, -0.75], [0.55, -0.7]]) { add(new THREE.CylinderGeometry(0.035, 0.05, 0.9, 6), ivory, x, 0.45, z); add(new THREE.ConeGeometry(0.04, 0.16, 6), gold, x, 0.98, z); }
    const dish = add(new THREE.SphereGeometry(0.28, 14, 6, 0, Math.PI * 2, 0, 1.0), ivory, -0.9, 0.55, -0.75); dish.rotation.x = 0.9;
  }
  function pinEl(cls, html) { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; layer.appendChild(d); return d; }
  function rebuildPins() {
    layer.innerHTML = ''; pins.length = 0;
    for (const p of data.pins) pins.push({ ...p, y: hAt(p.x, p.z), el: pinEl('mkm-pin' + (p.kind === 'hint' ? ' h' : p.kind === 'quest' ? ' q' : ''), `<span class="i">${p.icon}</span>${p.label ? `<span>${p.label}</span>` : ''}`), lift: p.kind === 'hint' ? 0.6 : 2.2 });
    for (const c of data.crew) { const el = pinEl('mkm-bot', `<svg viewBox="0 0 30 30"><circle cx="15" cy="15" r="13" fill="none" stroke="rgba(110,220,255,.3)" stroke-width="3"/><circle cx="15" cy="15" r="13" fill="none" stroke="#ffd25a" stroke-width="3" stroke-linecap="round" stroke-dasharray="81.7" stroke-dashoffset="${(81.7 * (1 - Math.max(0, c.prog))).toFixed(1)}" transform="rotate(-90 15 15)" ${c.prog < 0 ? 'opacity="0"' : ''}/></svg><b>🤖</b>`); pins.push({ x: c.x, z: c.z, y: hAt(c.x, c.z), el, lift: 0.5, bot: true }); }
    const ce = pinEl('mkm-cat', t('mapYou')); pins.push({ x: data.me.x, z: data.me.z, y: hAt(data.me.x, data.me.z), el: ce, lift: 0.4, cat: true });
    // lines from pins down to the terrain
    if (board.userData.lines) { board.remove(board.userData.lines); board.userData.lines.geometry.dispose(); }
    const L = []; for (const p of pins) { if (p.bot || p.cat) continue; const q = toMap(p.x, p.z, p.y); L.push(q.x, q.y, q.z, q.x, q.y + p.lift, q.z); }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(L, 3)); const lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: new THREE.Color(0.4, 1.1, 1.6), toneMapped: false, transparent: true, opacity: 0.85 })); board.add(lines); board.userData.lines = lines;
  }
  function updateFogTex() { const f = data.fog; const d = fogT.image.data; for (let i = 0; i < FOG_N * FOG_N; i++) { const v = f[i] ? 255 : 0; d[i * 4] = v; d[i * 4 + 1] = v; d[i * 4 + 2] = v; d[i * 4 + 3] = 255; } fogT.needsUpdate = true; }
  function sync() {
    data = api.getData(); if (!data) return;
    if (data.region.key !== region || !terr) { region = data.region.key; R = data.region.R; cx = data.region.x; cz = data.region.z; S = W / R; buildTerrain(); buildMinis(); }
    updateFogTex();
    const cs = data.crystals.slice(0, 64); const M = new THREE.Matrix4(); cs.forEach((c, i) => { const p = toMap(c.x, c.z, hAt(c.x, c.z)); const s = 0.3 + 0.1 * ((i * 0.618) % 1); M.compose(p.setY(p.y + s * 1.2), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, i, 0.15 * Math.sin(i))), new THREE.Vector3(s, s, s)); crysI.setMatrixAt(i, M); }); crysI.count = cs.length; crysI.instanceMatrix.needsUpdate = true;
    const mp = toMap(data.me.x, data.me.z, hAt(data.me.x, data.me.z) + 0.12); catM.position.copy(mp); catM.rotation.y = data.me.yaw + Math.PI;
    const tg = data.target; beam.visible = ring.visible = path.visible = !!tg;
    if (tg) { const tp = toMap(tg.x, tg.z, hAt(tg.x, tg.z)); beam.position.copy(tp); ring.position.copy(tp).setY(tp.y + 0.05); const A = pathG.attributes.position; const mx = (mp.x + tp.x) / 2, mz = (mp.z + tp.z) / 2; const nx = -(tp.z - mp.z) * 0.18, nz = (tp.x - mp.x) * 0.18;
      for (let i = 0; i < NP; i++) { const u = i / (NP - 1); const x = (1 - u) * (1 - u) * mp.x + 2 * u * (1 - u) * (mx + nx) + u * u * tp.x, z = (1 - u) * (1 - u) * mp.z + 2 * u * (1 - u) * (mz + nz) + u * u * tp.z; const wx = cx + x / S, wz = cz + z / S; A.setXYZ(i, x, hAt(wx, wz) + 0.15, z); } A.needsUpdate = true; }
    rebuildPins();
    $('#mkm-title').textContent = data.region.name; $('#mkm-card .t').innerHTML = `${data.quest ? data.quest.title : t('mapNoQuest')}${data.quest && data.quest.sub ? `<small>${data.quest.sub}</small>` : ''}`; $('#mkm-go').textContent = t('mapGo'); $('#mkm-go').style.display = tg ? '' : 'none';
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
      const dist = (port ? 30 : 21) / zoom; cam.position.set(0, dist * 0.62, dist * 0.78); cam.lookAt(0, port ? -0.8 : -1.8, port ? 0.8 : 1.0);
      board.rotation.y = yaw; board.scale.setScalar(0.25 + 0.75 * (1 - Math.pow(1 - openK, 3))); board.position.y = 0;
      board.rotation.x = 0; board.rotation.z = 0;
      scene.userData.earth.rotation.y += dt * 0.03;
      // wrist in the lower-left foreground, projection cone from the screen to the board
      wrist.position.set(port ? -1.05 : -2.35, port ? -2.6 : -1.75, -5.0); wrist.rotation.set(0.55, -0.55, 0.25, 'YXZ'); wrist.scale.setScalar(port ? 0.42 : 0.55);
      cam.updateMatrixWorld(true); const s0 = wrist.userData.scr.getWorldPosition(new THREE.Vector3()); const s1 = new THREE.Vector3(0, 0, 0); const mid = s0.clone().add(s1).multiplyScalar(0.5); const len = s0.distanceTo(s1);
      cone.position.copy(mid); cone.scale.set(W * 0.8 * board.scale.x, len, W * 0.8 * board.scale.x); cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), s1.clone().sub(s0).normalize());
      catM.children[0].material.color.setScalar(1).setRGB(1.6, 0.7 + 0.2 * Math.sin(T * 5), 0.15);
      const path_ = pathG.attributes.position; void path_; path.material.size = 0.2 + 0.05 * Math.sin(T * 6);
      board.updateMatrixWorld(true);
      for (const p of pins) { pv.copy(toMap(p.x, p.z, p.y + p.lift)); board.localToWorld(pv); pv.project(cam); const vis = pv.z < 1 && Math.abs(pv.x) < 1.1 && Math.abs(pv.y) < 1.1; p.el.style.display = vis && openK > 0.6 ? '' : 'none'; p.sx = (pv.x + 1) / 2 * w; p.sy = (1 - pv.y) / 2 * h; p.vis = vis; }
      { const placed = []; const lab = pins.filter(p => p.vis && !p.bot && !p.cat).sort((a, b) => b.sy - a.sy); for (const p of lab) { const bw = p.kind === 'hint' ? 26 : 70, bh = p.kind === 'hint' ? 26 : 44; let bx = p.sx, by = p.sy; const C = [[0, 0], [-0.55, 0], [0.55, 0], [0, -1], [-0.55, -0.6], [0.55, -0.6], [-1.1, 0], [1.1, 0], [-0.55, -1.2], [0.55, -1.2], [0, -2]]; for (const [kx, ky] of C) { const x = p.sx + kx * (bw + 4), y = p.sy + ky * (bh + 2); if (!placed.some(q => Math.abs(q.x - x) < (bw + q.w) / 2 && Math.abs(q.y - y) < (bh + q.h) / 2)) { bx = x; by = y; break; } } placed.push({ x: bx, y: by, w: bw, h: bh }); p.sx = bx; p.sy = by; } }
      for (const p of pins) if (p.vis) p.el.style.transform = `translate(${p.sx.toFixed(1)}px,${p.sy.toFixed(1)}px) translate(-50%,${p.bot ? '-50%' : '-100%'})`;
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
