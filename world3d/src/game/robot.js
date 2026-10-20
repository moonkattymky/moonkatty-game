import * as THREE from 'three';
import { mergeGeometries } from '../../vendor/three/jsm/utils/BufferGeometryUtils.js';
// Builder robot "Строитель" — hand-built 1:1 to the approved concept: rounded gold hard hat (ridges, brim, front tabs), soft ivory squircle
// head with gold/dark ear discs, glossy black face screen with cyan oval eyes + smile, rounded tapered ivory torso with gold collar and
// gold crescent, chunky rounded shoulder caps with gold pads, rounded limbs with dark joints and gold cuffs, dark segmented gloves with
// gold knuckles, welding torch + dark hose in the right hand, steel I-beam in the left, gold knee pads and rounded ivory boots on gold soles.
// Materials per vertex: glossy ivory, metallic gold, painted hat gold, dark rubber, glossy black glass, steel. 3 draws + sparks/flame.
export const COL = { ivory: '#88807c', ivoryS: '#7a736f', gold: '#a07812', hat: '#a27408', dark: '#24272d', rubber: '#16181c', steel: '#80858d', black: '#050608', eye: '#4fe8ff', leather: '#5a3a1e', holo: '#3fc8ff', flame: '#5fb8ff', lamp: '#ffe2a0', glyph: '#c88a1a' };
export const MAT = { ivory: [0.0, 0.34], ivoryS: [0.0, 0.38], gold: [0.85, 0.3], hat: [0.3, 0.2], dark: [0.15, 0.55], rubber: [0.0, 0.62], steel: [0.8, 0.35], black: [0.1, 0.08], leather: [0.0, 0.7], eye: [0, 2.5], holo: [0, 2.5], flame: [0, 2.5], lamp: [0, 2.5], glyph: [0, 2.5] }; // roughness > 1.5 = self-lit (eyes / holo / flame baked into the single-mesh LOD)

// geometry detail per preset (same detection as main.js): phone / q=low get coarser tessellation of the rounded volumes (Chapter-1 triangle budget)
const _Q = new URLSearchParams(location.search).get('q'); const _MOB = _Q === 'mobile' || _Q === 'low' || (!_Q && (matchMedia('(pointer:coarse)').matches || Math.min(innerWidth, innerHeight) < 480));
export const LQ0 = _Q === 'low' ? 0.42 : _MOB ? 0.72 : 0.9; let LQ = LQ0; export const setLQ = (v) => { LQ = v; }; export const PRESET = { low: _Q === 'low', mobile: _MOB }; const sg = (n, lo = 3) => Math.max(lo, Math.round(n * LQ));
// superellipsoid (rounded, soft "squircle" volumes): unit sphere vertices pushed onto |x|^p+|y|^p+|z|^p=1, then scaled to w,h,d
export function sq(w, h, d, p = 3, ws = 16, hs = 10, o = {}) { const g = new THREE.SphereGeometry(1, sg(ws, 6), sg(hs, 3), 0, Math.PI * 2, 0, o.th || Math.PI); const P = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i); const n = Math.pow(Math.pow(Math.abs(v.x), p) + Math.pow(Math.abs(v.y), p) + Math.pow(Math.abs(v.z), p), 1 / p) || 1; v.divideScalar(n);
    const t = (v.y + 1) / 2, tx = o.taper ? 1 - o.taper * (1 - t) : 1; P.setXYZ(i, v.x * w / 2 * tx, v.y * h / 2, v.z * d / 2 * (o.taperZ ? 1 - o.taperZ * (1 - t) : 1)); }
  g.computeVertexNormals(); return g; }
export const cyl = (rt, rb, h, s = 12, open = false) => new THREE.CylinderGeometry(rt, rb, h, sg(s, 6), 1, open);
export const sph = (r, ws = 10, hs = 6) => new THREE.SphereGeometry(r, sg(ws, 6), sg(hs, 3));
export const tor = (R, t, rs = 4, ts = 14, arc = Math.PI * 2) => new THREE.TorusGeometry(R, t, rs, sg(ts, 6), arc);
export function capsule(a, b, r, rad = 10, cap = 3) { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A); const g = new THREE.CapsuleGeometry(r, Math.max(0.001, d.length()), Math.max(1, Math.round(cap * LQ)), sg(rad, 5));
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())); g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2); return g; }
export function ring(a, b, R, t) { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b); const g = new THREE.TorusGeometry(R, t, 4, sg(12, 6)); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), B.clone().sub(A).normalize())); g.translate(B.x, B.y, B.z); return g; } // cuff ring at b, perpendicular to a->b
export function tube(pts, r, seg = 16, rad = 6) { return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), sg(seg, 6), r, sg(rad, 4)); }
// v72 cosmetics: optional paint scheme (palette-name -> colour / [metal, rough]) applied while a crew robot's Kit is filled, and an optional
// chest decal swapped in for the crescent. Both only change vertex colours / the emblem shape inside the merged body -> no new draws or materials.
let PAINT = null, DECAL = null; export const setCosmetic = (paint, decal) => { PAINT = paint || null; DECAL = decal && decal !== 'crescent' ? decal : null; };
function decalShape(kind, R) { const sh = new THREE.Shape(); const P = [];
  if (kind === 'star') { for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? R * 0.42 : R; P.push([Math.cos(a) * r, Math.sin(a) * r]); } }
  else if (kind === 'bolt') { P.push(...[[0.25, 1], [-0.45, -0.05], [-0.02, -0.05], [-0.3, -1], [0.5, 0.15], [0.06, 0.15], [0.4, 1]].map(([x, y]) => [x * R, y * R])); }
  else if (kind === 'paw') { const pad = new THREE.Shape(); pad.absellipse(0, -R * 0.3, R * 0.5, R * 0.42, 0, Math.PI * 2); const toes = [[-0.62, 0.32], [-0.22, 0.72], [0.22, 0.72], [0.62, 0.32]].map(([x, y]) => { const t = new THREE.Shape(); t.absellipse(x * R, y * R, R * 0.2, R * 0.25, 0, Math.PI * 2); return t; }); return [pad, ...toes]; }
  else return null; sh.moveTo(...P[0]); for (const q of P.slice(1)) sh.lineTo(...q); sh.closePath(); return sh; }
export function crescent(R = 0.07) { if (DECAL) { const sh = decalShape(DECAL, R * 1.05); if (sh) return new THREE.ExtrudeGeometry(sh, { depth: 0.014, bevelEnabled: false, curveSegments: DECAL === 'paw' ? 2 : 4 }); } // emblems stay <= the crescent's triangles
 const sh = new THREE.Shape(); const N = 18; // outer arc + inner arc (opening upper right, as on the concept chest)
  const r2 = R * 0.78, cx = R * 0.42, cy = R * 0.3; const pts = []; for (let i = 0; i <= N; i++) { const a = 0.2 * Math.PI + (1.6 * Math.PI) * i / N + 0.12; pts.push([Math.cos(a) * R, Math.sin(a) * R]); }
  sh.moveTo(...pts[0]); for (const p of pts.slice(1)) sh.lineTo(...p); for (let i = N; i >= 0; i--) { const a = 0.2 * Math.PI + 0.12 + (1.6 * Math.PI) * i / N; const x = Math.cos(a) * R, y = Math.sin(a) * R; const dx = x - cx, dy = y - cy, dd = Math.hypot(dx, dy); const k = dd < r2 ? 1 : r2 / dd; sh.lineTo(cx + dx * Math.min(1, k * 1.0), cy + dy * Math.min(1, k)); }
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.014, bevelEnabled: false, curveSegments: 4 }); return g; }
export class Kit { constructor() { this.parts = []; }
  add(g, col, o = {}) { g = g.index ? g.toNonIndexed() : g.clone(); const m = new THREE.Matrix4(); m.compose(new THREE.Vector3(...(o.p || [0, 0, 0])), new THREE.Quaternion().setFromEuler(new THREE.Euler(...(o.r || [0, 0, 0]), 'YXZ')), new THREE.Vector3(...(o.s || [1, 1, 1]))); g.applyMatrix4(m);
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); if (!g.attributes.normal) g.computeVertexNormals();
    const pc = PAINT && PAINT[col]; const c = new THREE.Color((pc && pc.c) || COL[col] || col), n = g.attributes.position.count, cc = new Float32Array(n * 3), mr = new Float32Array(n * 2); const [me, ro] = (pc && pc.mr) || MAT[col] || [0, 0.5];
    for (let i = 0; i < n; i++) { c.toArray(cc, i * 3); mr[i * 2] = me; mr[i * 2 + 1] = ro; } g.setAttribute('color', new THREE.BufferAttribute(cc, 3)); g.setAttribute('aMR', new THREE.BufferAttribute(mr, 2)); this.parts.push(g); return g; }
  build() { const g = mergeGeometries(this.parts, false); g.computeBoundingSphere(); return g; } }

export function material(env) { const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 1, envMap: env || null, envMapIntensity: 0.95 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aMR; varying vec2 vMR; varying vec3 vWN;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvMR = aMR; vWN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vMR; varying vec3 vWN;')
      .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= mix(0.55, 1.0, smoothstep(-0.85, 0.55, vWN.y)); /* soft sky/ground occlusion: rounded volumes read like the concept */')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = vMR.x;').replace('#include <roughnessmap_fragment>', 'float roughnessFactor = min(vMR.y, 1.0);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * 0.14 * (1.0 - 0.7 * vMR.x); /* concept fill light on the shadow side */\n if (vMR.y > 1.5) totalEmissiveRadiance += diffuseColor.rgb * 5.0; /* self-lit parts */'); };
  m.customProgramCacheKey = () => 'mk_robot3'; return m; }
export function faceTexture() { const W = 256, H = 150, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  g.clearRect(0, 0, W, H); g.shadowColor = '#2fd9ff'; g.shadowBlur = 22; g.fillStyle = '#8ff6ff'; for (const x of [82, 174]) { g.beginPath(); g.ellipse(x, 64, 17, 26, 0, 0, Math.PI * 2); g.fill(); g.fill(); }
  g.lineWidth = 8; g.lineCap = 'round'; g.strokeStyle = '#8ff6ff'; g.beginPath(); g.arc(128, 86, 24, 0.27 * Math.PI, 0.73 * Math.PI); g.stroke();
  g.shadowBlur = 0; const gl = g.createLinearGradient(0, 0, 0, 40); gl.addColorStop(0, 'rgba(255,255,255,0.16)'); gl.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gl; rr(26, 8, 204, 30, 14); g.fill(); // glossy glass reflection band
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }

export function builderKits() {
  const body = new Kit(), arm = new Kit();
  // proportions measured on the concept cut-out (feet y=0, hat top ~1.67): boots .2, knees .37, waist .5, torso .5-.95, head .94-1.38, brim 1.29
  for (const sx of [-1, 1]) { const x = sx < 0 ? -0.35 : 0.29, zf = sx < 0 ? 0.07 : -0.05, kb = 0.025; // wide stance, right leg a little forward (viewer-left), slight crouch (knees forward)
    const by = sx < 0 ? -0.15 : 0.45; body.add(sq(0.34, 0.2, 0.46, 2.4, 10, 6), 'ivory', { p: [x, 0.12, zf + 0.05], r: [0, by, 0] }); body.add(sq(0.36, 0.065, 0.48, 3.2, 10, 3), 'gold', { p: [x, 0.035, zf + 0.05], r: [0, by, 0] }); // chunky rounded boot on a gold sole
    body.add(sq(0.2, 0.09, 0.05, 3, 6, 3), 'gold', { p: [x + Math.sin(by) * 0.22, 0.17, zf + 0.05 + Math.cos(by) * 0.22], r: [0, by, 0] }); // gold toe-cap plate
    body.add(cyl(0.055, 0.055, 0.02, 8), 'gold', { p: [x + sx * 0.16, 0.14, zf], r: [0, 0, Math.PI / 2] }); // gold ankle disc
    body.add(sq(0.27, 0.25, 0.27, 2.5, 8, 5, { taper: -0.12 }), 'ivory', { p: [x * 0.97, 0.28, zf + kb * 0.5] }); // shin
    body.add(sph(0.085, 6, 4), 'dark', { p: [x * 0.94, 0.38, zf + kb - 0.01] }); body.add(sq(0.21, 0.17, 0.09, 3.2, 6, 4), 'gold', { p: [x * 0.95, 0.37, zf + kb + 0.125], r: [-0.12, 0, 0] }); // dark knee + chunky gold knee pad
    body.add(sq(0.25, 0.16, 0.24, 2.4, 6, 4), 'ivoryS', { p: [x * 0.86, 0.455, zf * 0.5 + kb * 0.6] }); } // thigh
  body.add(sq(0.46, 0.12, 0.3, 2.4, 10, 4), 'dark', { p: [0, 0.515, 0] }); // waist joint
  body.add(sq(0.56, 0.2, 0.36, 3.2, 10, 5), 'ivoryS', { p: [-0.02, 0.44, 0.0] }); // hip block (concept: lower torso fills the gap above the thighs)
  body.add(sq(0.66, 0.47, 0.42, 4.6, 16, 9, { taper: 0.12, taperZ: 0.05 }), 'ivory', { p: [0, 0.73, 0] }); // boxier torso shell (concept: less round)
  body.add(sq(0.44, 0.33, 0.06, 6, 10, 6, { taper: 0.1 }), 'ivory', { p: [0, 0.74, 0.19] }); // flat front chest plate carrying the moon
  for (const sx of [-1, 1]) body.add(new THREE.BoxGeometry(0.012, 0.3, 0.02), 'ivoryS', { p: [sx * 0.225, 0.74, 0.215] }); // plate seams
  body.add(sq(0.52, 0.05, 0.36, 3, 10, 3), 'gold', { p: [0, 0.535, 0] }); // gold belt line
  body.add(crescent(0.08), 'gold', { p: [0.015, 0.76, 0.222], r: [0.0, 0, 0] }); // chest crescent on the plate
  body.add(tor(0.16, 0.02, 3, 14), 'gold', { p: [0, 0.94, 0.0], r: [Math.PI / 2, 0, 0], s: [1.3, 1.1, 1] }); // gold collar
  body.add(cyl(0.12, 0.13, 0.07, 12), 'dark', { p: [0, 0.955, 0] }); // neck
  for (const sx of [-1, 1]) { // rounded ivory shoulder pads with gold trim (concept: mostly ivory, gold edging along the front/lower rim)
    const so = sx < 0 ? 0.37 : 0.41, sy = sx < 0 ? 0 : -0.035; body.add(sq(0.28, 0.28, 0.32, 2.3, 12, 7), 'ivory', { p: [sx * so, 0.8 + sy, 0] });
    body.add(sq(0.3, 0.045, 0.34, 2.4, 10, 3), 'gold', { p: [sx * (so + 0.005), 0.69 + sy, 0], r: [0, 0, -sx * 0.12] }); // gold lower rim
    body.add(sq(0.05, 0.22, 0.05, 2.5, 4, 5), 'gold', { p: [sx * (so + 0.03), 0.81 + sy, 0.165], r: [0, 0, -sx * 0.2] }); } // gold front edge strip
  // left arm (+x, static): elbow out, glove gripping the I-beam end from above
  body.add(capsule([0.43, 0.74, 0], [0.56, 0.64, -0.02], 0.1, 8, 2), 'ivory'); body.add(sph(0.072, 6, 4), 'dark', { p: [0.565, 0.62, 0.0] });
  body.add(capsule([0.56, 0.62, 0.03], [0.53, 0.6, 0.25], 0.112, 8, 2), 'ivory'); body.add(ring([0.56, 0.62, 0.03], [0.535, 0.6, 0.24], 0.11, 0.02), 'gold');
  gloveTo(body, [0.52, 0.58, 0.36], 1, [1.25, 0.0, 0.1]); // fingers wrap down over the beam flange
  { // steel I-beam, low across the front, rising to the left hand (concept: ends under the glove, does not stick out past it)
    const L = 0.84, c = [0.12, 0.45, 0.4], R = [-0.3, -0.12, 0.2]; for (const [w, h, d, dy, col] of [[L, 0.022, 0.17, 0.08, 'steel'], [L, 0.022, 0.17, -0.08, 'steel'], [L, 0.16, 0.03, 0, 'dark']]) body.add(new THREE.BoxGeometry(w, h, d), col, { p: [c[0], c[1] + dy, c[2]], r: R }); }
  // head (built separately, then tilted a little forward / sideways about the neck like the concept): wide soft squircle shell, ear discs, glossy black screen, gold hard hat
  const head = new Kit();
  head.add(sq(0.74, 0.46, 0.58, 3.2, 18, 11), 'ivory', { p: [0, 1.15, 0] });
  for (const sx of [-1, 1]) { head.add(cyl(0.125, 0.13, 0.06, 12), 'gold', { p: [sx * 0.375, 1.14, -0.01], r: [0, 0, Math.PI / 2] }); head.add(cyl(0.088, 0.088, 0.065, 10), 'dark', { p: [sx * 0.385, 1.14, -0.01], r: [0, 0, Math.PI / 2] }); head.add(cyl(0.045, 0.045, 0.07, 6), 'gold', { p: [sx * 0.39, 1.14, -0.01], r: [0, 0, Math.PI / 2] }); }
  head.add(sq(0.55, 0.3, 0.07, 3.6, 14, 7), 'black', { p: [0, 1.15, 0.275] }); // screen
  // gold hard hat: rounder, taller dome, a proud raised centre ridge + two side ridges, rolled brim (wider at the front visor), front tabs
  const HB = 1.29; head.add(sq(0.74, 0.64, 0.7, 1.9, 22, 8, { th: Math.PI / 2 }), 'hat', { p: [0, HB, 0.0] });
  head.add(sq(0.075, 0.67, 0.73, 2.2, 6, 8, { th: Math.PI / 2 }), 'hat', { p: [0, HB, 0] }); // raised centre ridge (a fin standing proud of the dome)
  for (const sx of [-1, 1]) head.add(sq(0.05, 0.6, 0.66, 2.2, 5, 7, { th: Math.PI / 2 }), 'hat', { p: [sx * 0.16, HB, 0] }); // side ridges (follow the dome)
  { const pr = [[0.35, 0.0], [0.4, -0.012], [0.415, 0.006], [0.405, 0.03], [0.35, 0.04]].map(([x, y]) => new THREE.Vector2(x, y)); head.add(new THREE.LatheGeometry(pr, 24), 'hat', { p: [0, HB - 0.005, 0.03], s: [1, 1, 1.12] }); } // brim
  head.add(sq(0.42, 0.03, 0.12, 3, 8, 3), 'hat', { p: [0, HB + 0.0, 0.43], r: [0.12, 0, 0] }); // front visor lip
  for (const sx of [-1, 1]) head.add(sq(0.11, 0.07, 0.05, 3, 4, 3), 'hat', { p: [sx * 0.23, HB + 0.05, 0.34], r: [0, sx * 0.38, 0] }); // front tabs
  const HT = new THREE.Matrix4().makeTranslation(0, 0.95, 0).multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.07, 0, -0.05, 'YXZ'))).multiply(new THREE.Matrix4().makeTranslation(0, -0.95, 0));
  for (const g of head.parts) { g.applyMatrix4(HT); body.parts.push(g); }
  // right arm (-x, animated around the shoulder): upper arm, dark elbow, thick forearm pointing forward, gold cuff, glove gripping the torch, hose
  arm.add(capsule([0, -0.02, 0], [-0.2, -0.17, 0.0], 0.1, 8, 2), 'ivory'); arm.add(sph(0.072, 6, 4), 'dark', { p: [-0.215, -0.205, 0.02] });
  arm.add(capsule([-0.2, -0.22, 0.04], [0.04, -0.2, 0.22], 0.114, 8, 2), 'ivory'); arm.add(ring([-0.2, -0.22, 0.04], [0.035, -0.2, 0.21], 0.114, 0.024), 'gold');
  gloveTo(arm, [0.08, -0.2, 0.3], -1, [0.75, 0.35, 0.0]); // fist around the torch handle
  const TB = new THREE.Vector3(0.06, -0.15, 0.29), TT = new THREE.Vector3(0.41, -0.35, 0.44); // torch back end, nozzle tip (lands on the beam)
  { const d = TT.clone().sub(TB); const L = d.length(); const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
    const at = (f) => TB.clone().addScaledVector(d, f); const put = (g, f, col) => { g.applyQuaternion(q); const p = at(f); g.translate(p.x, p.y, p.z); arm.add(g, col); };
    put(cyl(0.034, 0.038, L * 0.4, 10), 0.22, 'rubber'); put(cyl(0.045, 0.045, 0.035, 12), 0.44, 'gold'); put(cyl(0.02, 0.026, L * 0.4, 8), 0.66, 'steel'); put(cyl(0.012, 0.018, 0.05, 8), 0.9, 'gold'); }
  arm.add(tube([[0.06, -0.16, 0.28], [-0.02, -0.1, 0.3], [-0.15, -0.15, 0.26], [-0.27, -0.29, 0.2], [-0.33, -0.47, 0.16], [-0.35, -0.65, 0.16], [-0.38, -0.76, 0.22], [-0.46, -0.78, 0.32]], 0.026, 18, 5), 'rubber'); // dark hose: from the torch down the outside of the leg to the ground (concept)
  return { body, arm, HT, TB, TT };
}
export function makeRobot(scene, env) {
  const { body, arm, HT, TB, TT } = builderKits();
  const mat = material(env);
  const root = new THREE.Group(); root.name = 'game_robot';
  const SX = 0.86, SZ = 0.92; // overall slimming measured against the concept silhouette (width/height profile)
  const bodyM = new THREE.Mesh(body.build().scale(SX, 1, SZ), mat); bodyM.name = 'game_robot_body'; bodyM.castShadow = true; root.add(bodyM);
  const SH = [-0.37 * SX, 0.78, 0.0]; const armPivot = new THREE.Group(); armPivot.position.set(...SH); root.add(armPivot); const armM = new THREE.Mesh(arm.build().scale(SX, 1, SZ), mat); armM.name = 'game_robot_arm'; armM.castShadow = true; armPivot.add(armM);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.5 * SX, 0.28), new THREE.MeshBasicMaterial({ map: faceTexture(), transparent: true, depthWrite: false, toneMapped: false, color: new THREE.Color(1.6, 1.6, 1.6) })); { const fp = new THREE.Vector3(0, 1.15, 0.313).applyMatrix4(HT); face.position.set(fp.x * SX, fp.y, fp.z * SZ); face.rotation.set(0.07, 0, -0.05, 'YXZ'); } face.name = 'game_robot_face'; root.add(face);
  // welding sparks (Points) + cyan flame glow (additive sprite), only while welding
  const N = 56, sp = new Float32Array(N * 3), sv = new Float32Array(N * 3), sa = new Float32Array(N).fill(9); const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const dot = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(160,230,255,0.8)'); gr.addColorStop(1, 'rgba(40,140,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })();
  const sparks = new THREE.Points(sg, new THREE.PointsMaterial({ map: dot, color: new THREE.Color(1.6, 3.2, 4.2), size: 0.055, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); sparks.name = 'game_robot_sparks'; sparks.frustumCulled = false; sparks.visible = false; scene.add(sparks);
  const star = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.translate(64, 64); const gr = g.createRadialGradient(0, 0, 0, 0, 0, 22); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(150,220,255,0.7)'); gr.addColorStop(1, 'rgba(40,120,255,0)'); g.fillStyle = gr; g.fillRect(-64, -64, 128, 128);
    g.globalCompositeOperation = 'lighter'; for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2 + (i % 2) * 0.13, L = i % 3 === 0 ? 62 : 36 + (i * 7) % 20; const lg = g.createLinearGradient(0, 0, Math.cos(a) * L, Math.sin(a) * L); lg.addColorStop(0, 'rgba(220,245,255,0.95)'); lg.addColorStop(1, 'rgba(60,150,255,0)'); g.strokeStyle = lg; g.lineWidth = i % 3 === 0 ? 2.2 : 1.4; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * L, Math.sin(a) * L); g.stroke(); }
    return new THREE.CanvasTexture(c); })();
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: star, color: new THREE.Color(0.8, 2.2, 5.0), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); flame.scale.set(0.3, 0.3, 1); flame.visible = false; flame.name = 'game_robot_flame';
  const tip = new THREE.Object3D(); tip.position.copy(TT).addScaledVector(TT.clone().sub(TB).normalize(), 0.02).multiply(new THREE.Vector3(SX, 1, SZ)); armM.add(tip); tip.add(flame); const tw = new THREE.Vector3();
  root.visible = false; scene.add(root); let ph = 0; const FY = face.position.y;
  const tris = [bodyM, armM, face].reduce((s, m) => s + m.geometry.attributes.position.count / 3, 0);
  return { root, tris, armPivot, face,
    // mode: 'idle' | 'walk' | 'weld'
    update(dt, mode) { ph += dt; armPivot.rotation.set(0, 0, 0); bodyM.position.y = 0; face.position.y = FY; armPivot.position.y = SH[1];
      if (mode === 'walk') { const b = Math.abs(Math.sin(ph * 7)) * 0.035; bodyM.position.y = b; face.position.y = FY + b; armPivot.position.y = SH[1] + b; armPivot.rotation.x = Math.sin(ph * 7) * 0.1; }
      else if (mode === 'weld') { armPivot.rotation.x = Math.sin(ph * 2.3) * 0.045; armPivot.rotation.z = Math.sin(ph * 1.7) * 0.03; }
      else { armPivot.position.y = SH[1] + Math.sin(ph * 1.6) * 0.006; }
      sparks.visible = flame.visible = mode === 'weld' && root.visible; if (flame.visible) { const k = 0.26 + 0.05 * Math.sin(ph * 37) + 0.04 * Math.sin(ph * 23); flame.scale.set(k, k, 1); }
      if (sparks.visible) { root.updateMatrixWorld(true); tip.getWorldPosition(tw); for (let i = 0; i < N; i++) { sa[i] += dt; if (sa[i] > 0.3 + (i % 7) * 0.05) { sa[i] = 0; sp[i * 3] = tw.x; sp[i * 3 + 1] = tw.y; sp[i * 3 + 2] = tw.z; const a = Math.random() * 6.283, u = 0.4 + Math.random() * 0.6; sv[i * 3] = Math.cos(a) * u * 2.0; sv[i * 3 + 1] = 0.4 + Math.random() * 1.9; sv[i * 3 + 2] = Math.sin(a) * u * 2.0; }
        sv[i * 3 + 1] -= 6 * dt; sp[i * 3] += sv[i * 3] * dt; sp[i * 3 + 1] += sv[i * 3 + 1] * dt; sp[i * 3 + 2] += sv[i * 3 + 2] * dt; } sg.attributes.position.needsUpdate = true; } },
    tipWorld() { root.updateMatrixWorld(true); return tip.getWorldPosition(new THREE.Vector3()); },
  };
}
// dark segmented glove with gold knuckle band, fingers curled around a grip (side = +1 left hand, -1 right hand); r = wrist euler
export function gloveTo(kit, p, side, r) { const e = new THREE.Euler(...r, 'YXZ'), q = new THREE.Quaternion().setFromEuler(e); const P = new THREE.Vector3(...p);
  const put = (g, off, col, rr) => { if (rr) g.applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(...rr))); g.applyQuaternion(q); const o = new THREE.Vector3(...off).applyQuaternion(q).add(P); g.translate(o.x, o.y, o.z); kit.add(g, col); };
  put(sq(0.13, 0.11, 0.13, 2.6, 7, 4), [0, 0, 0], 'dark'); // palm/back of hand
  put(sq(0.11, 0.03, 0.03, 3, 6, 3), [0, 0.03, 0.06], 'gold'); // knuckle band
  for (let i = 0; i < 4; i++) { const x = -0.048 + i * 0.032; // articulated segmented fingers: proximal segment forward, dark knuckle, distal segment curled under (around the grip)
    put(new THREE.CapsuleGeometry(0.02, 0.035, 1, 5), [x, 0.012, 0.085], 'rubber', [Math.PI / 2 - 0.15, 0, 0]); put(sph(0.017, 5, 3), [x, 0.008, 0.115], 'dark');
    put(new THREE.CapsuleGeometry(0.018, 0.03, 1, 5), [x, -0.028, 0.125], 'rubber', [0.25, 0, 0]); put(new THREE.BoxGeometry(0.03, 0.006, 0.012), [x, -0.003, 0.113], 'gold'); }
  put(new THREE.CapsuleGeometry(0.02, 0.045, 1, 4), [side * -0.07, -0.01, 0.03], 'rubber', [0.6, 0, side * 0.7]); }
