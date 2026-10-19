import * as THREE from 'three';
import { mergeGeometries } from '../../vendor/three/jsm/utils/BufferGeometryUtils.js';
import { sq } from './robot.js';
// ============================================================================================
// World-life machines (concept d04ca995), procedural hand-built like the crew robots: soft superellipsoid ivory volumes,
// gold trim, emissive bits (aE vertex attribute -> one shared vertex-colour material). Each machine = ONE merged mesh
// (+ the drill head, which spins) with a hi LOD up close and a cheap LO LOD beyond. Local +z = forward.
// ============================================================================================
const C = { iv: '#ece4d2', iv2: '#ddd2ba', gold: '#d6a136', dgold: '#a8761e', tire: '#1c1a19', metal: '#8a8578', dark: '#4a4743', glass: '#1d3350', cry: '#2a8cff', cry2: '#6cc8ff', lamp: '#fff2c8', red: '#ff4030' };
export const col = (g, hex, e = 0) => { g = g.index ? g.toNonIndexed() : g; const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3), ae = new Float32Array(n); for (let i = 0; i < n; i++) { c.toArray(a, i * 3); ae[i] = e; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.setAttribute('aE', new THREE.BufferAttribute(ae, 1)); if (g.attributes.uv) g.deleteAttribute('uv'); return g; };
const merge = (list) => mergeGeometries(list.map(g => g.index ? g.toNonIndexed() : g));
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s = 10, open = false, t0 = 0, tl = Math.PI * 2) => new THREE.CylinderGeometry(rt, rb, h, s, 1, open, t0, tl);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _q = new THREE.Quaternion();
const rod = (a, b, r, hex, s = 6, e = 0) => { _a.set(...a); _b.set(...b); const d = _b.clone().sub(_a); const g = cyl(r, r, d.length(), s); _q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()); g.applyQuaternion(_q); const m = _a.clone().add(_b).multiplyScalar(0.5); g.translate(m.x, m.y, m.z); return col(g, hex, e); };
const truss = (a, b, w, d, n, r) => { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), ax = B.clone().sub(A), up = new THREE.Vector3(0, 1, 0); const side = new THREE.Vector3(1, 0, 0), nrm = ax.clone().normalize().cross(side).normalize(); const out = []; const P = (u, i, j) => A.clone().addScaledVector(ax, u).addScaledVector(side, i * w / 2).addScaledVector(nrm, j * d / 2).toArray();
  for (const [i, j] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) out.push(rod(P(0, i, j), P(1, i, j), r, C.gold, 5));
  for (let k = 0; k < n; k++) { const u0 = k / n, u1 = (k + 1) / n; for (const i of [-1, 1]) out.push(rod(P(u0, i, k % 2 ? -1 : 1), P(u1, i, k % 2 ? 1 : -1), r * 0.6, C.dgold, 4)); for (const j of [-1, 1]) out.push(rod(P(u0, k % 2 ? -1 : 1, j), P(u1, k % 2 ? 1 : -1, j), r * 0.6, C.dgold, 4)); }
  void up; return out; };
const crystal = (x, y, z, h, w, rz, rx, hex, e) => col(new THREE.OctahedronGeometry(1, 0).scale(w, h, w).translate(0, h * 0.7, 0).rotateZ(rz).rotateX(rx).translate(x, y, z), hex, e);

// ---------------- cargo rover: ivory + gold, 6 chunky wheels, open cargo bed of glowing crystals, headlights ----------------
export function roverHi() { const L = [];
  L.push(col(sq(2.0, 0.55, 3.5, 7, 10, 5).translate(0, 0.92, 0), C.iv), col(box(1.86, 0.2, 3.2).translate(0, 0.62, 0), C.dark), col(box(2.05, 0.06, 3.56).translate(0, 1.13, 0), C.gold));
  for (const s of [-1, 1]) L.push(col(box(0.04, 0.12, 2.4).translate(s * 1.0, 0.86, 0), C.gold));
  // cab
  L.push(col(sq(1.72, 0.78, 1.15, 7, 10, 5).translate(0, 1.5, 1.05), C.iv2), col(box(1.3, 0.34, 0.06).rotateX(-0.38).translate(0, 1.62, 1.6), C.glass, 0.35));
  for (const s of [-1, 1]) L.push(col(box(0.05, 0.26, 0.62).translate(s * 0.86, 1.6, 1.02), C.glass, 0.3));
  L.push(col(box(1.05, 0.07, 0.14).translate(0, 1.92, 1.2), C.gold)); for (const x of [-0.3, 0, 0.3]) L.push(col(box(0.16, 0.06, 0.06).translate(x, 1.93, 1.29), C.lamp, 2.5));
  // headlights + bumper
  for (const s of [-1, 1]) L.push(col(cyl(0.16, 0.16, 0.05, 10).rotateX(Math.PI / 2).translate(s * 0.62, 1.0, 1.75), C.gold), col(cyl(0.12, 0.12, 0.06, 10).rotateX(Math.PI / 2).translate(s * 0.62, 1.0, 1.78), C.lamp, 5.0), col(cyl(0.2, 0.2, 0.02, 10).rotateX(Math.PI / 2).translate(s * 0.62, 1.0, 1.8), '#ffe9b0', 1.6));
  L.push(col(box(1.8, 0.14, 0.16).translate(0, 0.72, 1.76), C.gold));
  // open cargo bed
  L.push(col(box(1.8, 0.08, 1.9).translate(0, 1.18, -0.6), C.metal));
  for (const s of [-1, 1]) L.push(col(box(0.08, 0.42, 1.9).translate(s * 0.88, 1.39, -0.6), C.iv), col(box(0.11, 0.05, 1.96).translate(s * 0.88, 1.62, -0.6), C.gold));
  for (const z of [-1.52, 0.33]) L.push(col(box(1.8, 0.42, 0.08).translate(0, 1.39, z), C.iv), col(box(1.86, 0.05, 0.11).translate(0, 1.62, z), C.gold));
  const CR = [[-0.5, -1.2, 0.55, 0.16, 0.2], [-0.15, -1.25, 0.75, 0.2, -0.1], [0.25, -1.15, 0.6, 0.17, -0.25], [0.55, -1.25, 0.45, 0.14, -0.4], [-0.45, -0.7, 0.7, 0.19, 0.3], [0.0, -0.6, 0.95, 0.24, 0.05], [0.4, -0.7, 0.65, 0.18, -0.3], [-0.5, -0.15, 0.5, 0.15, 0.35], [-0.1, -0.1, 0.62, 0.17, 0.12], [0.3, -0.15, 0.55, 0.16, -0.2], [0.6, -0.2, 0.4, 0.13, -0.45]];
  CR.forEach(([x, z, h, w, rz], i) => L.push(crystal(x, 1.2, z, h, w, rz, (i % 3 - 1) * 0.15, i % 4 ? C.cry : C.cry2, i % 4 ? 1.35 : 1.7)));
  // wheels: chunky tyre, gold hub, ivory cap; ivory fenders with a gold edge
  for (const z of [-1.15, 0, 1.15]) for (const s of [-1, 1]) { const x = s * 1.07;
    L.push(col(cyl(0.46, 0.46, 0.4, 10).rotateZ(Math.PI / 2).translate(x, 0.46, z), C.tire), col(cyl(0.25, 0.25, 0.42, 6).rotateZ(Math.PI / 2).translate(x, 0.46, z), C.gold));
 }
  for (const z of [-1.15, 0, 1.15]) for (const s of [-1, 1]) { const x = s * 1.07; L.push(col(cyl(0.58, 0.58, 0.48, 8, true, 0, Math.PI).rotateZ(Math.PI / 2).translate(x, 0.5, z), C.iv2), col(new THREE.TorusGeometry(0.6, 0.045, 3, 8, Math.PI).rotateY(Math.PI / 2).translate(x + s * 0.25, 0.5, z), C.gold)); }
  // cargo bed detail: corner posts, cross ribs, side lamps, tie-down rail
  for (const x of [-0.88, 0.88]) for (const z of [-1.52, 0.33]) L.push(col(box(0.12, 0.55, 0.12).translate(x, 1.45, z), C.gold));
  for (const z of [-1.05, -0.6, -0.15]) L.push(col(box(1.72, 0.03, 0.05).translate(0, 1.23, z), C.dgold));
  for (const s of [-1, 1]) L.push(col(box(0.04, 0.06, 1.7).translate(s * 0.93, 1.5, -0.6), C.dgold), col(box(0.06, 0.08, 0.1).translate(s * 0.93, 1.3, -1.45), C.red, 3.0));
  L.push(rod([0.7, 1.85, 0.75], [0.7, 2.8, 0.7], 0.02, C.metal, 4), col(new THREE.SphereGeometry(0.06, 6, 4).translate(0.7, 2.82, 0.7), C.red, 3.5));
  return merge(L); }
export function roverLo() { const L = [col(box(2.0, 0.55, 3.5).translate(0, 0.92, 0), C.iv), col(box(2.05, 0.06, 3.56).translate(0, 1.13, 0), C.gold), col(box(1.7, 0.75, 1.1).translate(0, 1.5, 1.05), C.iv2), col(box(1.3, 0.3, 0.05).translate(0, 1.6, 1.61), C.glass, 0.35), col(box(1.8, 0.4, 1.9).translate(0, 1.38, -0.6), C.iv)];
  for (const [x, z, h] of [[-0.4, -1.1, 0.6], [0.3, -1.0, 0.7], [0, -0.4, 0.9], [-0.4, -0.1, 0.55], [0.45, -0.2, 0.5]]) L.push(crystal(x, 1.4, z, h, 0.2, 0, 0, C.cry, 1.4));
  for (const z of [-1.15, 0, 1.15]) for (const s of [-1, 1]) L.push(col(cyl(0.46, 0.46, 0.4, 7).rotateZ(Math.PI / 2).translate(s * 1.07, 0.46, z), C.tire));
  for (const s of [-1, 1]) L.push(col(box(0.22, 0.18, 0.05).translate(s * 0.62, 1.0, 1.77), C.lamp, 4.5));
  return merge(L); }

// ---------------- v55 drill truck (concept d04ca995): 6-wheel ivory/gold truck, cab up front, articulated gold arm on a
// turntable at the rear holding a vertical drill motor; the spinning bit (separate mesh) hangs below it to the ground ----------------
export const DRILL_HEAD = new THREE.Vector3(0, 1.05, -2.7); // where the spinning bit hangs (local)
const WZ = [-1.35, 0, 1.35];
export function drillHi() { const L = []; const HZ = DRILL_HEAD.z;
  // wheels: chunky tyres, gold hubs, rounded ivory fenders
  for (const z of WZ) for (const s of [-1, 1]) { const x = s * 1.12; L.push(col(cyl(0.44, 0.44, 0.42, 12).rotateZ(Math.PI / 2).translate(x, 0.44, z), C.tire), col(cyl(0.23, 0.23, 0.44, 6).rotateZ(Math.PI / 2).translate(x, 0.44, z), C.gold), col(cyl(0.54, 0.54, 0.5, 8, true, 0, Math.PI).rotateZ(Math.PI / 2).translate(x, 0.5, z), C.iv2), col(new THREE.TorusGeometry(0.56, 0.04, 3, 8, Math.PI).rotateY(Math.PI / 2).translate(x + s * 0.25, 0.5, z), C.gold)); }
  // chassis + gold trim + dark underframe
  L.push(col(sq(2.0, 0.55, 4.6, 7, 12, 5).translate(0, 1.05, -0.1), C.iv), col(box(2.04, 0.07, 4.5).translate(0, 1.3, -0.1), C.gold), col(box(1.7, 0.25, 4.2).translate(0, 0.72, -0.1), C.dark));
  for (const s of [-1, 1]) L.push(col(box(0.05, 0.14, 3.6).translate(s * 1.0, 1.0, -0.1), C.gold));
  // cab up front: rounded ivory, wrap glass, gold roof + light bar, headlights, bumper
  L.push(col(box(1.86, 0.62, 1.3).translate(0, 1.64, 1.5), C.iv2), col(box(1.8, 0.5, 1.2).translate(0, 2.2, 1.45), C.iv), col(box(1.5, 0.42, 0.04).rotateX(-0.08).translate(0, 2.2, 2.07), C.glass, 0.4), col(box(1.9, 0.05, 0.06).translate(0, 1.95, 2.12), C.gold));
  for (const s of [-1, 1]) L.push(col(box(0.04, 0.36, 0.8).translate(s * 0.91, 2.22, 1.4), C.glass, 0.35), col(box(0.08, 0.55, 0.08).translate(s * 0.88, 2.2, 2.06), C.gold));
  L.push(col(box(1.96, 0.08, 1.36).translate(0, 2.49, 1.45), C.gold)); for (const x of [-0.42, -0.14, 0.14, 0.42]) L.push(col(box(0.18, 0.07, 0.07).translate(x, 2.56, 2.0), C.lamp, 3.2));
  for (const s of [-1, 1]) L.push(col(cyl(0.15, 0.15, 0.05, 10).rotateX(Math.PI / 2).translate(s * 0.66, 1.2, 2.2), C.gold), col(cyl(0.1, 0.1, 0.06, 10).rotateX(Math.PI / 2).translate(s * 0.66, 1.2, 2.23), C.lamp, 4.0));
  L.push(col(box(1.9, 0.16, 0.16).translate(0, 0.86, 2.24), C.gold));
  // engine block behind the cab with vents + exhaust stack
  L.push(col(sq(1.5, 0.6, 0.9, 6, 8, 4).translate(0, 1.6, 0.35), C.iv)); for (let k = 0; k < 3; k++) L.push(col(box(1.0, 0.04, 0.03).translate(0, 1.45 + k * 0.12, -0.11), C.dark));
  L.push(rod([0.62, 1.6, 0.65], [0.62, 2.75, 0.65], 0.07, C.metal, 6), col(cyl(0.09, 0.07, 0.12, 6).translate(0.62, 2.8, 0.65), C.dgold));
  // rear deck + turntable
  L.push(col(box(1.9, 0.06, 1.9).translate(0, 1.36, -1.45), C.metal), col(cyl(0.6, 0.66, 0.24, 14).translate(0, 1.5, -1.2), C.gold), col(cyl(0.48, 0.5, 0.3, 12).translate(0, 1.77, -1.2), C.iv));
  // articulated arm: twin gold lower boom up to the elbow, upper boom out over the rear, hydraulic cylinders, joints
  const SH = [0, 1.9, -1.2], EL = [0, 3.55, -1.45], WR = [0, 2.95, HZ];
  L.push(...truss(SH, EL, 0.36, 0.3, 5, 0.045), ...truss([0, EL[1], EL[2]], [0, WR[1] + 0.2, WR[2]], 0.3, 0.26, 4, 0.038)); // v57 lattice/truss booms (concept): 4 gold chords + zig-zag braces

  L.push(rod([0, 1.6, -0.6], [0, 2.75, -1.3], 0.09, C.metal, 6), rod([0, 2.1, -0.9], [0, 2.75, -1.3], 0.13, C.iv2, 6));   // lift cylinder
  L.push(rod([0, 3.45, -1.3], [0, 3.2, -2.15], 0.07, C.metal, 6), rod([0, 3.45, -1.3], [0, 3.38, -1.75], 0.1, C.iv2, 6));     // reach cylinder
  for (const [y, z, r] of [[SH[1], SH[2], 0.2], [EL[1], EL[2], 0.2], [WR[1] + 0.2, WR[2], 0.17]]) L.push(col(cyl(r, r, 0.62, 10).rotateZ(Math.PI / 2).translate(0, y, z), C.dgold));
  // drill motor housing hanging from the wrist: ivory cylinder with gold rings + status lamp; hoses
  L.push(col(cyl(0.3, 0.3, 0.6, 12).translate(0, 2.42, HZ), C.iv), col(cyl(0.33, 0.33, 0.06, 12).translate(0, 2.72, HZ), C.gold), col(cyl(0.33, 0.33, 0.06, 12).translate(0, 2.13, HZ), C.gold), col(cyl(0.22, 0.27, 0.14, 10).translate(0, 2.03, HZ), C.dgold));
  L.push(col(new THREE.SphereGeometry(0.06, 6, 4).translate(0.22, 2.55, HZ + 0.22), C.red, 4.0), rod([0.2, 2.7, HZ + 0.12], [0.3, 1.7, -1.6], 0.03, C.dark, 3));
  // beacon on the cab
  L.push(col(new THREE.SphereGeometry(0.1, 6, 4).translate(-0.6, 2.55, 1.2), C.red, 4.0));
  return merge(L); }
export function drillLo() { const L = []; const HZ = DRILL_HEAD.z;
  for (const z of WZ) for (const s of [-1, 1]) L.push(col(cyl(0.44, 0.44, 0.42, 7).rotateZ(Math.PI / 2).translate(s * 1.12, 0.44, z), C.tire));
  L.push(col(box(2.0, 0.55, 4.6).translate(0, 1.05, -0.1), C.iv), col(box(2.04, 0.07, 4.5).translate(0, 1.3, -0.1), C.gold), col(box(1.85, 1.05, 1.25).translate(0, 1.88, 1.45), C.iv2), col(box(1.45, 0.4, 0.05).translate(0, 2.0, 2.09), C.glass, 0.4), col(box(1.5, 0.6, 0.9).translate(0, 1.6, 0.35), C.iv),
    rod([0, 1.9, -1.2], [0, 3.55, -1.45], 0.2, C.gold, 4), rod([0, 3.55, -1.45], [0, 3.1, HZ], 0.15, C.gold, 4), col(cyl(0.3, 0.3, 0.6, 6).translate(0, 2.42, HZ), C.iv));
  for (const s of [-1, 1]) L.push(col(box(0.22, 0.18, 0.05).translate(s * 0.66, 1.2, 2.24), C.lamp, 4.0));
  return merge(L); }
export function drillHeadGeo() { const L = [col(cyl(0.2, 0.2, 1.5, 8), C.metal), col(cyl(0.3, 0.3, 0.14, 10).translate(0, 0.72, 0), C.gold), col(cyl(0.26, 0.02, 0.5, 8).translate(0, -1.0, 0), '#d8d0c0')];
  for (let k = 0; k < 14; k++) { const a = k * 0.9, y = 0.62 - k * 0.12; L.push(col(box(0.46, 0.05, 0.13).rotateZ(0.28).rotateY(a).translate(0, y, 0), C.dgold)); } L.push(col(new THREE.IcosahedronGeometry(0.16, 0).translate(0, -1.22, 0), '#ffa040', 6.0), col(new THREE.IcosahedronGeometry(0.1, 0).scale(1, 0.4, 1).translate(0, -1.28, 0), '#fff0c0', 8.0));
  return merge(L); }
