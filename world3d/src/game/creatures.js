// v73 Moon creatures (concept 5ceae58c): Moon Bunny (fluffy silver, glowing blue ears, forehead crystal), Crystal Hedgehog,
// cave Glowbugs, floating Dust Jellies. Hand-modelled procedural geometry, ALL creatures in ONE merged vertex-coloured mesh:
// every vertex carries its slot id; per-slot transforms + animation params are uniforms (ears / tentacles / legs animate in
// the vertex shader). Slots are laid out bunny, hedgehog, jellies, glowbugs and the draw range stops after the last visible
// slot -> 1 draw call total (0 when nothing is near), triangles only for what is in range.
import * as THREE from 'three';
import { mergeGeometries } from '../../vendor/three/jsm/utils/BufferGeometryUtils.js';

const P_BODY = 0, P_EARL = 1, P_EARR = 2, P_WAVE = 3, P_LEG = 4, P_BELL = 5, P_GLOW = 6, P_FUR = 7;
// deterministic noise for the fur / crystal variation (same look every load)
const rnd = (() => { let s = 7331; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
function prep(g, hex, e, part, slot, wFn) { g = g.index ? g.toNonIndexed() : g.clone(); for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); if (!g.attributes.normal) g.computeVertexNormals();
  const n = g.attributes.position.count, P = g.attributes.position, c = new THREE.Color(hex), C = new Float32Array(n * 3), E = new Float32Array(n), S = new Float32Array(n), PA = new Float32Array(n), W = new Float32Array(n);
  for (let i = 0; i < n; i++) { c.toArray(C, i * 3); E[i] = e; S[i] = slot; PA[i] = part; W[i] = wFn ? wFn(P.getX(i), P.getY(i), P.getZ(i)) : 0; }
  g.setAttribute('color', new THREE.BufferAttribute(C, 3)); g.setAttribute('aE', new THREE.BufferAttribute(E, 1)); g.setAttribute('aS', new THREE.BufferAttribute(S, 1)); g.setAttribute('aP', new THREE.BufferAttribute(PA, 1)); g.setAttribute('aW', new THREE.BufferAttribute(W, 1)); return g; }
const ell = (rx, ry, rz, ws, hs) => new THREE.SphereGeometry(1, Math.max(5, ws), Math.max(3, hs)).scale(rx, ry, rz);
// soft fur: sphere pushed out by smooth noise so the silhouette is tufted, not a perfect ball
function furry(rx, ry, rz, ws, hs, amp) { const g = ell(rx, ry, rz, ws, hs); const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const k = 1 + amp * (Math.sin(v.x * 37 + v.y * 23) * Math.sin(v.z * 41 - v.y * 17) * 0.6 + Math.sin(v.x * 71 + v.z * 59) * 0.4); p.setXYZ(i, v.x * k, v.y * k, v.z * k); } g.computeVertexNormals(); return g; }
// fur tufts: small open cones along the surface normal of an ellipsoid
function tufts(L, cx, cy, cz, rx, ry, rz, n, len, hex, slot, filt, part = P_BODY) { for (let i = 0; i < n; i++) { const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, s = Math.sqrt(1 - u * u); const nx = s * Math.cos(a), ny = u, nz = s * Math.sin(a); if (filt && !filt(nx, ny, nz)) continue;
    const px = cx + nx * rx * 0.96, py = cy + ny * ry * 0.96, pz = cz + nz * rz * 0.96; const dir = new THREE.Vector3(nx / rx, ny / ry, nz / rz).normalize().add(new THREE.Vector3(0, -0.25, 0)).normalize(); const l = len * (0.7 + rnd() * 0.6);
    const g = new THREE.ConeGeometry(l * 0.7, l, 4, 1, true).translate(0, l / 2, 0); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)); g.translate(px, py, pz); L.push(prep(g, hex, 0.06, part, slot)); } }
function eye(L, x, y, z, r, slot, iris = '#2f74ff', yaw = 0, Q = 1) { const s = Math.sign(x) || 1, a = Math.max(6, Math.round(12 * Q)), b = Math.max(4, Math.round(8 * Q)); L.push(prep(new THREE.SphereGeometry(r, a, b).scale(1, 1.08, 0.72).rotateY(yaw * s).translate(x, y, z), '#03050b', 0, P_BODY, slot));
  L.push(prep(new THREE.SphereGeometry(r * 0.6, Math.max(6, a - 2), Math.max(3, b - 2)).scale(1, 1.08, 0.3).rotateY(yaw * s).translate(x, y - r * 0.1, z + r * 0.52), iris, 0.45, P_BODY, slot));
  L.push(prep(new THREE.SphereGeometry(r * 0.19, Q > 0.6 ? 6 : 4, Q > 0.6 ? 4 : 2).translate(x + r * 0.32, y + r * 0.38, z + r * 0.72), '#ffffff', 2.6, P_BODY, slot)); if (Q > 0.6) L.push(prep(new THREE.SphereGeometry(r * 0.12, 5, 3).translate(x - r * 0.25, y - r * 0.3, z + r * 0.74), '#cfe6ff', 1.6, P_BODY, slot)); }

// ---- Moon Bunny: ~0.95 m to the ear tips, faces +Z, feet at y=0 ----
function bunnyGeo(slot, Q) { const L = [], ws = Math.round(18 * Q), hs = Math.round(12 * Q), FUR = '#bcc4e4', FUR2 = '#dfe3f6';
  L.push(prep(furry(0.24, 0.27, 0.22, ws, hs, 0.05).translate(0, 0.27, -0.01), FUR, 0.07, P_FUR, slot)); // body
  if (Q > 0.3) L.push(prep(furry(0.17, 0.19, 0.12, ws, hs, 0.05).translate(0, 0.27, 0.12), FUR2, 0.07, P_FUR, slot)); // chest fluff
  L.push(prep(furry(0.21, 0.19, 0.19, ws, hs, 0.035).translate(0, 0.63, 0.03), FUR, 0.07, P_FUR, slot)); // head
  for (const s of [-1, 1]) { L.push(prep(furry(0.09, 0.075, 0.08, Math.round(10 * Q), Math.round(6 * Q), 0.05).translate(s * 0.1, 0.565, 0.13), FUR2, 0.06, P_BODY, slot)); // cheeks
    L.push(prep(ell(0.06, 0.09, 0.06, Math.round(8 * Q), Math.round(6 * Q)).translate(s * 0.12, 0.33, 0.16), FUR2, 0.05, P_BODY, slot)); // little arms
    L.push(prep(ell(0.075, 0.048, 0.13, Math.round(10 * Q), Math.round(6 * Q)).translate(s * 0.1, 0.045, 0.08), FUR2, 0.05, P_BODY, slot)); // big feet
    if (Q > 0.3) L.push(prep(ell(0.045, 0.012, 0.05, 5, 3).translate(s * 0.1, 0.012, 0.15), '#c9d4ee', 0.3, P_BODY, slot)); // paw pads
    // tall ears: fluffy outer + glowing blue/lilac inner, flex from the base (aW 0 at the root .. 1 at the tip)
    const part = s < 0 ? P_EARL : P_EARR, wf = (x, y) => Math.max(0, Math.min(1, (y - 0.74) / 0.36));
    const ear = new THREE.CapsuleGeometry(0.058, 0.26, Math.max(2, Math.round(4 * Q)), Math.max(6, Math.round(10 * Q))).scale(1, 1, 0.55).rotateZ(-s * 0.16).translate(s * 0.085, 0.92, -0.01); L.push(prep(ear, FUR, 0.06, part, slot, wf));
    const inn = new THREE.CapsuleGeometry(0.036, 0.2, Math.max(1, Math.round(3 * Q)), Math.max(5, Math.round(8 * Q))).scale(1, 1, 0.25).rotateZ(-s * 0.16).translate(s * 0.087, 0.93, 0.034); L.push(prep(inn, '#5f7fff', 2.8, part, slot, wf));
    if (Q > 0.6) L.push(prep(new THREE.CapsuleGeometry(0.02, 0.12, 2, 6).scale(1, 1, 0.3).rotateZ(-s * 0.16).translate(s * 0.087, 0.9, 0.04), '#f2a9e0', 1.6, part, slot, wf)); }
  tufts(L, 0, 0.27, -0.01, 0.24, 0.27, 0.22, Math.round((Q > 0.3 ? 60 : 36) * Q), 0.04, FUR, slot, (x, y, z) => y > -0.6, P_FUR);
  tufts(L, 0, 0.63, 0.03, 0.21, 0.19, 0.19, Math.round(26 * Q), 0.03, FUR, slot, (x, y, z) => z < 0.55 || y > 0.5, P_FUR);
  tufts(L, 0, 0.27, 0.12, 0.17, 0.19, 0.12, Math.round(14 * Q), 0.03, FUR2, slot, (x, y, z) => z > 0.3, P_FUR);
  L.push(prep(furry(0.085, 0.08, 0.08, Math.round(10 * Q), Math.round(6 * Q), 0.08).translate(0, 0.17, -0.24), FUR2, 0.08, P_BODY, slot)); // pom tail
  eye(L, -0.085, 0.645, 0.18, 0.064, slot, '#2f74ff', 0.22, Q); eye(L, 0.085, 0.645, 0.18, 0.064, slot, '#2f74ff', 0.22, Q);
  L.push(prep(new THREE.SphereGeometry(0.02, 6, 4).scale(1.2, 0.8, 0.8).translate(0, 0.585, 0.218), '#f3a6bd', 0.3, P_BODY, slot)); // nose
  L.push(prep(new THREE.TorusGeometry(0.018, 0.004, 3, 8, Math.PI).rotateZ(Math.PI).translate(0, 0.565, 0.212), '#9c7f96', 0, P_BODY, slot)); // mouth
  // forehead crystal (+ two small shards) and blue sparkles in the fur
  L.push(prep(new THREE.OctahedronGeometry(1, 0).scale(0.032, 0.062, 0.02).rotateX(-0.25).translate(0, 0.75, 0.175), '#7fe6ff', 2.6, P_BODY, slot));
  for (const s of [-1, 1]) L.push(prep(new THREE.OctahedronGeometry(1, 0).scale(0.016, 0.03, 0.012).rotateZ(s * 0.6).translate(s * 0.035, 0.735, 0.172), '#9fd0ff', 2.2, P_BODY, slot));
  for (let i = 0; i < Math.round(12 * Q); i++) { const a = rnd() * Math.PI * 2, y = 0.12 + rnd() * 0.6, r = y > 0.45 ? 0.2 : 0.24; L.push(prep(new THREE.OctahedronGeometry(0.008 + rnd() * 0.006, 0).translate(Math.cos(a) * r, y, Math.sin(a) * r * 0.95), '#8fd4ff', 3.0, P_BODY, slot)); }
  return L; }

// ---- Crystal Hedgehog: ~0.5 m tall incl. crystal spines, faces +Z ----
function hedgehogGeo(slot, Q) { const L = []; const ws = Math.round(16 * Q), hs = Math.round(10 * Q);
  L.push(prep(ell(0.23, 0.18, 0.28, ws, hs).translate(0, 0.2, -0.02), '#2c4f9e', 0.4, P_BODY, slot)); // body under the spines
  L.push(prep(furry(0.145, 0.13, 0.13, ws, hs, 0.03).translate(0, 0.16, 0.2), '#d2b089', 0, P_BODY, slot)); // face + belly
  L.push(prep(new THREE.ConeGeometry(0.075, 0.14, Math.max(5, Math.round(10 * Q))).rotateX(Math.PI / 2).translate(0, 0.15, 0.33), '#d9ba95', 0, P_BODY, slot)); // snout
  L.push(prep(new THREE.SphereGeometry(0.03, 6, 4).translate(0, 0.155, 0.4), '#15100e', 0, P_BODY, slot)); // nose
  eye(L, -0.068, 0.22, 0.285, 0.04, slot, '#3a2a20', 0.35, Q); eye(L, 0.068, 0.22, 0.285, 0.04, slot, '#3a2a20', 0.35, Q);
  for (const s of [-1, 1]) { L.push(prep(new THREE.SphereGeometry(0.04, 6, 4).scale(1, 1, 0.5).translate(s * 0.12, 0.3, 0.19), '#8a6448', 0, P_BODY, slot)); for (const z of [0.12, -0.14]) L.push(prep(ell(0.045, 0.035, 0.06, 5, 3).translate(s * 0.13, 0.03, z), '#5d4535', 0, P_LEG, slot)); }
  // crystal spines over the back: elongated octahedra along the body normal, light/dark blues, tips shimmer (aW)
  const N = Math.round(190 * Q); for (let i = 0; i < N; i++) { const u = 1 - 2 * (i + 0.5) / N, a = i * 2.39996 + rnd() * 0.3, sq = Math.sqrt(1 - u * u); /* fibonacci sphere: even coverage */ const nx = sq * Math.cos(a), ny = u, nz = sq * Math.sin(a); if (ny < -0.25 || nz > 0.45 + ny * 0.3) continue;
    const px = nx * 0.24, py = 0.2 + ny * 0.18, pz = -0.02 + nz * 0.29; const dir = new THREE.Vector3(nx * 0.7, ny * 0.8 + 0.45, nz * 0.4 - 0.75).normalize(); const l = 0.2 + rnd() * 0.14;
    const g = new THREE.OctahedronGeometry(1, 0).scale(0.05, l / 2, 0.04).translate(0, l * 0.42, 0); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)); g.translate(px, py, pz);
    L.push(prep(g, rnd() < 0.5 ? '#2a62f0' : rnd() < 0.5 ? '#4f98ff' : '#1d3fc0', 0.55 + rnd() * 0.5, P_WAVE, slot, (x, y, z) => Math.max(0, Math.hypot(x - px, y - py, z - pz) / l) * 0.25)); }
  return L; }

// ---- Glowbug: ~0.22 m, dark body, big glowing cyan abdomen (pulses), round eyes, 6 legs, antennae with glowing tips ----
function bugGeo(slot, Q) { const L = []; const ws = Math.max(5, Math.round(9 * Q)), hs = Math.max(3, Math.round(6 * Q)), lo = Q < 0.6;
  L.push(prep(ell(0.075, 0.065, 0.07, ws, hs).translate(0, 0.085, 0.06), '#20242f', 0.05, P_BODY, slot)); // head/thorax
  L.push(prep(ell(0.1, 0.09, 0.12, ws, hs).translate(0, 0.1, -0.06), '#4fd8ff', 2.4, P_GLOW, slot)); // glowing abdomen
  L.push(prep(ell(0.093, 0.04, 0.1, ws, hs).translate(0, 0.14, -0.05), '#2a3140', 0.0, P_BODY, slot)); // wing case over the glow
  for (const s of [-1, 1]) { L.push(prep(new THREE.SphereGeometry(0.03, lo ? 5 : 7, lo ? 3 : 5).translate(s * 0.035, 0.1, 0.115), '#e8eef8', 0.2, P_BODY, slot)); L.push(prep(new THREE.SphereGeometry(0.018, lo ? 4 : 6, lo ? 2 : 4).translate(s * 0.037, 0.1, 0.138), '#05070c', 0, P_BODY, slot)); if (!lo) L.push(prep(new THREE.SphereGeometry(0.006, 4, 2).translate(s * 0.032, 0.108, 0.155), '#ffffff', 2.5, P_BODY, slot));
    L.push(prep(new THREE.CylinderGeometry(0.004, 0.004, 0.09, 3, 1, true).rotateX(-0.5).rotateZ(-s * 0.35).translate(s * 0.03, 0.18, 0.1), '#1a1d26', 0, P_LEG, slot)); L.push(prep(new THREE.OctahedronGeometry(0.012, 0).translate(s * 0.048, 0.22, 0.125), '#8ff0ff', 2.6, P_GLOW, slot));
    for (const z of [0.07, 0.0, -0.07]) { const g = new THREE.CylinderGeometry(0.006, 0.004, 0.11, 3, 1, true).rotateZ(s * 1.0).translate(s * 0.095, 0.045, z); L.push(prep(g, '#161920', 0, P_LEG, slot, () => 1)); } }
  return L; }

// ---- Dust Jelly: bell ~1 m wide (scaled up for the far drifting ones), cute face, frilled rim, glowing tentacles ----
function jellyGeo(slot, Q) { const L = [], vf = Q < 0.2; /* low-tier far jelly: coarser */ const ws = vf ? 6 : Math.max(8, Math.round(18 * Q)), hs = vf ? 3 : Math.max(4, Math.round(8 * Q)), Y = 1.25;
  L.push(prep(new THREE.SphereGeometry(0.5, ws, hs, 0, Math.PI * 2, 0, Math.PI * 0.56).scale(1, 0.8, 1).translate(0, Y - 0.06, 0), '#7458f0', 0.85, P_BELL, slot)); // bell
  if (!vf) L.push(prep(new THREE.SphereGeometry(0.32, Math.max(6, Math.round(12 * Q)), Math.max(3, Math.round(6 * Q))).scale(1, 0.75, 1).translate(0, Y + 0.05, 0), '#b496ff', 1.3, P_BELL, slot)); // inner glow
  L.push(prep(new THREE.TorusGeometry(0.47, 0.045, 3, ws).rotateX(Math.PI / 2).translate(0, Y - 0.12, 0), '#9478ff', 1.3, P_BELL, slot)); // frilled rim
  const nF = Q > 0.4 ? Math.round(9 * Q) : 0; for (let k = 0; k < nF; k++) { const a = k / nF * Math.PI * 2; L.push(prep(new THREE.SphereGeometry(0.06, 5, 3).scale(1, 0.6, 1).translate(Math.cos(a) * 0.47, Y - 0.15, Math.sin(a) * 0.47), '#a58cff', 1.2, P_BELL, slot)); }
  eye(L, -0.15, Y + 0.08, 0.38, 0.075, slot, '#4a5cff', 0.38, Q); eye(L, 0.15, Y + 0.08, 0.38, 0.075, slot, '#4a5cff', 0.38, Q);
  if (Q > 0.4) for (const s of [-1, 1]) L.push(prep(new THREE.SphereGeometry(0.05, 6, 3).scale(1, 0.55, 0.4).translate(s * 0.25, Y - 0.02, 0.38), '#ff9fd2', 1.3, P_BODY, slot));
  L.push(prep(new THREE.TorusGeometry(0.03, 0.007, 3, 8, Math.PI).rotateZ(Math.PI).translate(0, Y - 0.02, 0.44), '#5a3f8a', 0, P_BODY, slot));
  // tentacles (thin, long, glowing cyan-violet) + 4 thicker frilly oral arms; wave in the shader, weight grows toward the tip
  const nT = vf ? 5 : Math.max(6, Math.round(11 * Q)); for (let k = 0; k < nT; k++) { const a = k / nT * Math.PI * 2 + 0.2, r = 0.38 + (k % 2) * 0.06, len = 0.9 + rnd() * 0.5; const pts = []; for (let j = 0; j <= 6; j++) { const u = j / 6; pts.push(new THREE.Vector3(Math.cos(a) * r * (1 - u * 0.25) + Math.sin(u * 5 + k) * 0.05, Y - 0.14 - u * len, Math.sin(a) * r * (1 - u * 0.25) + Math.cos(u * 4 + k) * 0.05)); }
    L.push(prep(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), vf ? 3 : Math.max(4, Math.round(9 * Q)), 0.012, 3, false), k % 3 ? '#62b8ff' : '#a47cff', 2.4, P_WAVE, slot, (x, y) => Math.max(0, (Y - 0.14 - y) / len))); }
  for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + 0.6; const pts = []; for (let j = 0; j <= 5; j++) { const u = j / 5; pts.push(new THREE.Vector3(Math.cos(a) * 0.12 * (1 + u), Y - 0.12 - u * 0.75, Math.sin(a) * 0.12 * (1 + u))); }
    L.push(prep(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), Math.max(3, Math.round(7 * Q)), 0.02, 3, false), '#8a7cff', 1.5, P_WAVE, slot, (x, y) => Math.max(0, (Y - 0.12 - y) / 0.75))); }
  return L; }

export function makeCreatures(scene, env, { low = false, mobile = false } = {}) {
  const Q = low ? 0.34 : mobile ? 0.52 : 0.72; const NJ = 4, NB = low ? 3 : 6; const QD = Math.min(Q, 0.52); // v73 budget: near jellies + bugs at mobile detail on desktop
  const LOD = !low; /* bunny distance LOD (desktop/mobile): hi-detail slot only when the camera is within LOD_D, else the coarse slot after the bugs */ const LOD_D = 7.5;
  const S = { bunny: 0, jelly: 1, hedgehog: 1 + NJ, bug: 2 + NJ, bunnyLo: LOD ? 2 + NJ + NB : -1 }, NS = 2 + NJ + NB + (LOD ? 1 : 0); // jellies 0,1 near (full detail), 2,3 far over the crater (coarse)
  const parts = [], ends = []; let v = 0; const add = (list) => { for (const g of list) { parts.push(g); v += g.attributes.position.count; } ends.push(v); };
  add(bunnyGeo(S.bunny, low ? 0.24 : Q)); /* v73 budget: low-tier bunny coarser */ for (let i = 0; i < NJ; i++) add(jellyGeo(S.jelly + i, i < 2 ? QD : Q * 0.4)); add(hedgehogGeo(S.hedgehog, Q)); const bug = bugGeo(0, QD); for (let i = 0; i < NB; i++) add(bug.map(g => { const c = g.clone(); c.attributes.aS.array.fill(S.bug + i); return c; })); if (LOD) add(bunnyGeo(S.bunnyLo, 0.3));
  const geo = mergeGeometries(parts, false); geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
  // index = concatenation of the visible slots' vertex ranges (rewritten only when the visible set changes) -> only visible creatures cost triangles
  const IDX = new THREE.BufferAttribute(v > 65535 ? new Uint32Array(v) : new Uint16Array(v), 1); IDX.setUsage(THREE.DynamicDrawUsage); geo.setIndex(IDX); let key = '';
  const uM = Array.from({ length: NS }, () => new THREE.Matrix4().makeScale(0, 0, 0)), uA = Array.from({ length: NS }, () => new THREE.Vector4(0, 1, 0, 0)), U = { uM: { value: uM }, uA: { value: uA }, uT: { value: 0 } };
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.0, envMap: env || null, envMapIntensity: 0.7 });
  mat.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>\nattribute float aE; attribute float aS; attribute float aP; attribute float aW; uniform mat4 uM[${NS}]; uniform vec4 uA[${NS}]; uniform float uT; varying float vE; varying float vP; varying float vPulse;`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>\n int si = int(aS + 0.5); mat4 SM = uM[si]; vec4 SA = uA[si]; objectNormal = normalize(mat3(SM) * objectNormal);`)
      .replace('#include <begin_vertex>', `vec3 transformed = vec3(position); float ph = SA.x;
        if (aP > 0.5 && aP < 2.5) { float sd = aP < 1.5 ? -1.0 : 1.0; float w = aW * aW; transformed.x += sd * (sin(uT * 2.1 + ph) * 0.03 + SA.y * sin(uT * 13.0 + ph) * 0.035 + SA.z * 0.09) * w; transformed.y -= SA.z * w * 0.2; transformed.z += (sin(uT * 1.7 + ph + sd) * 0.02 - SA.z * 0.26) * w; }
        else if (aP > 2.5 && aP < 3.5) { transformed.x += sin(uT * 2.2 + position.y * 4.0 + ph) * aW * 0.09 * SA.w; transformed.z += cos(uT * 1.8 + position.y * 3.5 + ph * 1.3) * aW * 0.09 * SA.w; }
        else if (aP > 3.5 && aP < 4.5) { transformed.y += max(0.0, sin(uT * 22.0 + ph + position.z * 60.0)) * 0.012 * SA.w; }
        transformed = (SM * vec4(transformed, 1.0)).xyz; vE = aE; vP = aP; vPulse = SA.y;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vE; varying float vP; varying float vPulse;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n totalEmissiveRadiance += vColor.rgb * vE * ((vP > 5.5 && vP < 6.5) ? vPulse : 1.0);
        if (vP > 4.5 && vP < 5.5) { float fr = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 2.0); totalEmissiveRadiance += vColor.rgb * fr * 1.4; }
        if (vP > 6.5) { float fr = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 3.0); totalEmissiveRadiance += vec3(0.35, 0.55, 1.0) * fr * 0.9; } /* fluffy bunny: soft blue rim glow */`); };
  const mesh = new THREE.Mesh(geo, mat); mesh.name = 'creatures'; mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = false; mesh.matrixAutoUpdate = false; mesh.visible = false; scene.add(mesh);
  mesh.layers.enable(1); // also drawn inside the home module (home layer)
  const vis = new Array(NS).fill(false), want = new Array(NS).fill(false), sph = Array.from({ length: NS }, () => new THREE.Sphere()); const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _fr = new THREE.Frustum(), _m = new THREE.Matrix4();
  let camP = null; const api = { mesh, S, NS, NJ, NB, tris: geo.attributes.position.count / 3, slotTris: ends.map((e, i) => (e - (i ? ends[i - 1] : 0)) / 3),
    // place slot i (yaw around Y, optional pitch/roll), anim = [phase, happy|pulse, earFold, wave]
    set(i, x, y, z, yaw, sc = 1, anim, pitch = 0, roll = 0, sy = 1, rad = 1.2) { if (LOD && i === S.bunny) { const far = camP && Math.hypot(camP.x - x, camP.y - y, camP.z - z) > LOD_D * sc; want[far ? S.bunny : S.bunnyLo] = false; if (far) i = S.bunnyLo; } _e.set(pitch, yaw, roll, 'YXZ'); uM[i].compose(_p.set(x, y, z), _q.setFromEuler(_e), _s.set(sc, sc * sy, sc)); if (anim) uA[i].set(anim[0], anim[1], anim[2], anim[3]); want[i] = true; sph[i].center.set(x, y + 0.5 * sc, z); sph[i].radius = rad * sc; },
    hide(i) { want[i] = false; if (LOD && i === S.bunny) want[S.bunnyLo] = false; },
    visible: (i) => vis[i] || (LOD && i === S.bunny && vis[S.bunnyLo]), wanted: (i) => want[i] || (LOD && i === S.bunny && want[S.bunnyLo]),
    flush(T, camera) { U.uT.value = T; if (camera) camP = camera.position; if (camera) _fr.setFromProjectionMatrix(_m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)); // frustum-cull per slot: off-screen creatures cost nothing
      for (let i = 0; i < NS; i++) { vis[i] = want[i] && (!camera || _fr.intersectsSphere(sph[i])); if (!vis[i]) uM[i].makeScale(0, 0, 0); } const k = vis.map(x => x ? 1 : 0).join(''); if (k !== key) { key = k; let n = 0; const A = IDX.array; for (let i = 0; i < NS; i++) if (vis[i]) { for (let j = i ? ends[i - 1] : 0; j < ends[i]; j++) A[n++] = j; } geo.setDrawRange(0, n); IDX.needsUpdate = true; IDX.addUpdateRange ? (IDX.clearUpdateRanges(), IDX.addUpdateRange(0, n)) : 0; api.drawn = n / 3; } mesh.visible = key.includes('1'); },
  };
  return api;
}
