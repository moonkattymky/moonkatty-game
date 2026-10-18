import * as THREE from 'three';
import { G, quatFromDir } from './builder.js';
import { groundAt, REGIONS, sd, canyonPoint, canyonS } from './terrain.js';
import { C, rocket, dome } from './base.js';
import { fbm } from './noise.js';
const PI = Math.PI;

function lattice(b, x, y, z, w, h, levels) {
  const sh = h / levels;
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) b.add('ivory', G.box(0.7, h, 0.7), { pos: [x + sx * w / 2, y + h / 2, z + sz * w / 2], color: C.ivory2 });
  for (let i = 0; i < levels; i++) {
    const yy = y + (i + 0.5) * sh;
    for (const [px, pz, ry] of [[0, w / 2, 0], [0, -w / 2, PI], [w / 2, 0, PI / 2], [-w / 2, 0, -PI / 2]]) b.add('lattice', new THREE.PlaneGeometry(w, sh), { pos: [x + px, yy, z + pz], rot: [0, ry, 0], color: i % 4 === 3 ? C.gold : '#ffffff' });
    if (i % 3 === 2) { b.add('gold', G.box(w + 0.9, 0.45, w + 0.9), { pos: [x, yy + sh / 2, z], color: C.goldD }); for (const [sx, sz] of [[1, 1], [-1, -1], [1, -1], [-1, 1]]) b.add('glow', G.octa(0.35), { pos: [x + sx * w / 2, yy + sh / 2 + 0.5, z + sz * w / 2], color: i >= levels - 2 ? '#ff5533' : C.win, intensity: 5 }); }
  }
}

// pass 20: industrial pipe run — straight segments with ball joints at clean bends, ivory with gold bands, supports standing on the ground
function pipeRun(b, path, { r = 0.75, clear = 0.9, every = 4, endY = null, startY = null, bandStep = 5, lights = true } = {}) {
  const S = path.map(p => { const f = r + 0.6; const gy = Math.max(groundAt(p.x, p.z), groundAt(p.x + f, p.z), groundAt(p.x - f, p.z), groundAt(p.x, p.z + f), groundAt(p.x, p.z - f)); return { x: p.x, z: p.z, gy }; });
  const N = S.length - 1; const V = []; for (let i = 0; i <= N; i += every) V.push(i); if (V[V.length - 1] !== N) V.push(N);
  const Y = V.map(i => S[i].gy + r + clear); if (startY !== null) Y[0] = startY; if (endY !== null) Y[Y.length - 1] = endY;
  for (let it = 0; it < 6; it++) for (let s = 0; s < V.length - 1; s++) { const i0 = V[s], i1 = V[s + 1]; let need = 0; for (let i = i0 + 1; i < i1; i++) { const t = (i - i0) / (i1 - i0); const ly = Y[s] + (Y[s + 1] - Y[s]) * t; need = Math.max(need, S[i].gy + r + 0.35 - ly); } if (need > 0) { if (!(s === 0 && startY !== null)) Y[s] += need; if (!(s + 1 === V.length - 1 && endY !== null)) Y[s + 1] += need; } }
  const P = V.map((i, k) => new THREE.Vector3(S[i].x, Y[k], S[i].z));
  for (let k = 0; k < P.length - 1; k++) { const dv = P[k + 1].clone().sub(P[k]); const L = dv.length(); const q = quatFromDir(dv);
    b.add('ivory', G.cyl(r, r, L, 10, true), { pos: P[k].toArray(), quat: q, color: C.ivory2 });
    const nb = Math.max(1, Math.floor(L / bandStep)); for (let j = 1; j <= nb; j++) { const t = j / (nb + 1); const c = P[k].clone().addScaledVector(dv, t); b.add('gold', G.cyl(r * 1.13, r * 1.13, 0.4, 10, true), { pos: c.clone().addScaledVector(dv, -0.2 / L).toArray(), quat: q, color: C.gold }); }
    // supports: every ~6 m along the segment, column from the ground (sunk) to the pipe belly + gold saddle
    const ns = Math.floor(L / 6); for (let j = 1; j <= ns; j++) { const c = P[k].clone().addScaledVector(dv, j / (ns + 1)); const gy = Math.min(groundAt(c.x, c.z), groundAt(c.x + 0.4, c.z), groundAt(c.x - 0.4, c.z)); const h = c.y - r - gy; if (h < 0.15) continue; b.add('dark', G.box(0.55, h + 0.5, 0.55), { pos: [c.x, gy - 0.5 + (h + 0.5) / 2, c.z], color: '#3a4250' }); b.add('dark', G.box(1.6, 0.25, 1.6), { pos: [c.x, gy + 0.05, c.z], color: '#2e3540' }); b.add('gold', G.box(r * 2.3, 0.22, 0.7), { pos: [c.x, c.y - r - 0.08, c.z], quat: quatFromDir(new THREE.Vector3(0, 1, 0)).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(dv.x, dv.z))), color: C.goldD }); if (lights && j === ns) b.add('glow', G.box(0.35, 0.35, 0.35), { pos: [c.x, c.y + r + 0.3, c.z], color: C.win, intensity: 3.5 }); } }
  for (let k = 1; k < P.length - 1; k++) { b.add('ivory', G.sphere(r * 1.18, 12, 8), { pos: P[k].toArray(), color: C.ivory }); b.add('gold', G.torus(r * 1.2, 0.1, 3, 14), { pos: P[k].toArray(), rot: [PI / 2, 0, 0], color: C.gold }); }
  return P;
}

export const KEEP = []; // pass 20: footprints of region structures ({x, z, r}) — props keep rubble out of them
const upN = (n) => { const a = new Float32Array(n); for (let k = 1; k < n; k += 3) a[k] = 1; return a; };
// pass 25: continuous ground-seated wall that follows a path (base sunk 1.2 m below the terrain; outward-facing sides + flat top)
function wallRun(b, P, off, w, h, group, color) { const pos = []; const quad = (a, bb, c, d, ex) => { const ux = bb[0] - a[0], uy = bb[1] - a[1], uz = bb[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]; const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; if (nx * ex[0] + ny * ex[1] + nz * ex[2] >= 0) pos.push(...a, ...bb, ...c, ...a, ...c, ...d); else pos.push(...a, ...c, ...bb, ...a, ...d, ...c); };
  for (let k = 0; k < P.length - 1; k++) { const A = P[k], B = P[k + 1]; const dx = B.x - A.x, dz = B.z - A.z, l = Math.hypot(dx, dz), nx = -dz / l, nz = dx / l; const ns = Math.max(1, Math.ceil(l / 2.5));
    const q = (t, o, top) => { const px = A.x + dx * t + nx * o, pz = A.z + dz * t + nz * o; return [px, groundAt(px, pz) + (top ? h : -1.2), pz]; };
    const tq = (t, o) => { const px = A.x + dx * t + nx * o, pz = A.z + dz * t + nz * o; const c0 = A.x + dx * t + nx * off, c1 = A.z + dz * t + nz * off; return [px, groundAt(c0, c1) + h, pz]; };
    const oi = off - w / 2, oo = off + w / 2;
    for (let i = 0; i < ns; i++) { const t0 = i / ns, t1 = (i + 1) / ns;
      quad(q(t0, oi, 0), q(t1, oi, 0), [...tq(t1, oi)], [...tq(t0, oi)], [-nx, 0, -nz]);
      quad(q(t0, oo, 0), q(t1, oo, 0), [...tq(t1, oo)], [...tq(t0, oo)], [nx, 0, nz]);
      quad(tq(t0, oi), tq(t1, oi), tq(t1, oo), tq(t0, oo), [0, 1, 0]); }
    if (k === 0 || k === P.length - 2) { const t = k === 0 ? 0 : 1; const ex = k === 0 ? [-dx / l, 0, -dz / l] : [dx / l, 0, dz / l]; quad(q(t, oi, 0), q(t, oo, 0), tq(t, oo), tq(t, oi), ex); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); b.add(group, g, { color }); }
function strip(b, P, off, w, lift, group, color, I) { const pos = []; const nc = Math.max(1, Math.ceil(w / 3)); /* pass 24: subdivided (<=2.5 m along, <=3 m across) so it drapes the terrain; upward winding */
  for (let k = 0; k < P.length - 1; k++) { const A = P[k], B = P[k + 1]; const dx = B.x - A.x, dz = B.z - A.z, l = Math.hypot(dx, dz), nx = -dz / l, nz = dx / l; const ns = Math.max(1, Math.ceil(l / 2.5));
    const q = (t, o) => { const px = A.x + dx * t + nx * o, pz = A.z + dz * t + nz * o; return [px, groundAt(px, pz) + lift, pz]; };
    for (let i = 0; i < ns; i++) for (let c = 0; c < nc; c++) { const t0 = i / ns, t1 = (i + 1) / ns, o0 = off - w / 2 + w * c / nc, o1 = off - w / 2 + w * (c + 1) / nc; const a1 = q(t0, o0), a2 = q(t0, o1), b1 = q(t1, o0), b2 = q(t1, o1); pos.push(...a1, ...a2, ...b1, ...a2, ...b2, ...b1); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(upN(pos.length), 3)); /* pass 25: up-facing normals (no terrain facet shading) */ b.add(group, g, { color, intensity: I }); }
function launchComplex(b, beams, bn) {
  const { x, z } = REGIONS.launch; const y = groundAt(x, z);
  const at = (a, r) => ({ x: x + Math.cos(a) * r, z: z + Math.sin(a) * r }); const D = PI / 180;
  // ---- far + near: pad, main rocket, gantry (visible on the world map) ----
  b.add('dark', G.cyl(26, 28, 1.2, 8), { pos: [x, y - 0.5, z], color: '#3a4250' });
  b.add('ivory', G.cyl(24, 25, 1.2, 8), { pos: [x, y + 0.2, z], color: C.ivory2 });
  b.add('gold', G.torus(24.6, 0.4, 4, 8), { pos: [x, y + 1.4, z], rot: [PI / 2, 0, PI / 8], color: C.gold });
  rocket(b, x, y + 1.4, z, 3.3, -0.8);
  lattice(b, x + 14, y + 1.4, z - 6, 6, 74, 18);
  for (const yy of [20, 38, 52]) b.add('gold', G.box(9, 1, 1.2), { pos: [x + 9, y + yy, z - 4], rot: [0, 0.4, 0], color: C.goldD });
  for (let i = 0; i < 5; i++) { const a = -0.6 + i * 0.5; const px = x + Math.cos(a) * 46, pz = z + Math.sin(a) * 46; const yy = groundAt(px, pz); KEEP.push({ x: px, z: pz, r: 10 }); b.add('tex', G.box(12, 6 + i % 2 * 3, 9), { region: 'panel', pos: [px, yy + 3, pz], rot: [0, -a, 0], color: '#ffffff' }); b.add('gold', G.box(12.4, 0.5, 9.4), { pos: [px, yy + 6.2 + i % 2 * 3, pz], rot: [0, -a, 0], color: C.gold }); for (let k = 0; k < 4; k++) b.add('glow', G.box(1.6, 1.0, 9.5), { pos: [px + Math.cos(-a) * (k * 2.6 - 4), yy + 3.5, pz - Math.sin(-a) * (k * 2.6 - 4)], rot: [0, -a, 0], color: C.win, intensity: 2.2 }); }
  KEEP.push({ x, z, r: 29 }, { x: x + 14, z: z - 6, r: 8 }); for (const ca of [275 * D]) KEEP.push({ ...at(ca, 98), r: 16 }); KEEP.push({ x: x - 92, z: z + 66, r: 16 }); /* QA camera spots */
  // ---- near detail (only drawn within ~330 m) ----
  // flame trench: walled channel from the pad edge out to a scorched apron, deflector wedge under the rocket
  { const a = -135 * D; const ux = Math.cos(a), uz = Math.sin(a), vx = -uz, vz = ux; const T = []; for (let k = 0; k <= 8; k++) T.push(at(a, 14 + k * 6));
    /* pass 25: trench walls + floor removed — at the region-shot grazing angle they only read as flat pale planks; the deflector wedge stays */
    bn.add('dark', new THREE.CylinderGeometry(0.01, 4.5, 6, 3, 1).rotateX(PI / 2).rotateZ(PI / 2), { pos: [x + ux * 6, y + 2.6, z + uz * 6], rot: [0, -a, 0], scale: [1, 0.55, 1], color: '#2b2f36' });
    
    for (let k = 0; k <= 8; k++) KEEP.push({ ...at(a, 14 + k * 6), r: 7 }); }
  // gantry crown, elevator cab, lightning mast, beacons
  { const gx = x + 14, gz = z - 6, top = y + 1.4 + 74; bn.add('dark', G.box(9, 0.6, 9), { pos: [gx, top + 0.3, gz], color: '#3a4250' }); bn.add('gold', G.box(9.4, 0.3, 9.4), { pos: [gx, top + 0.75, gz], color: C.gold });
    bn.add('gold', G.cyl(0.2, 0.35, 16, 6), { pos: [gx, top + 0.9, gz], color: C.goldD }); bn.add('glow', G.octa(0.7), { pos: [gx, top + 17.4, gz], color: '#ff5030', intensity: 6 });
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) bn.add('glow', G.octa(0.45), { pos: [gx + sx * 4.6, top + 1.4, gz + sz * 4.6], color: C.winHot, intensity: 5 });
    bn.add('glow', G.box(2.2, 3.2, 2.2), { pos: [gx - 3.6, y + 31, gz + 2.0], color: C.win, intensity: 2.0 }); bn.add('ivory', G.box(2.5, 0.4, 2.5), { pos: [gx - 3.6, y + 32.8, gz + 2.0], color: C.ivory });
    for (const yy of [12, 28, 44, 60]) for (const sg of [-1, 1]) bn.add('glow', G.box(0.35, 0.35, 0.35), { pos: [gx + sg * 3.3, y + yy, gz + 3.3], color: C.win, intensity: 4 }); }
  // spherical fuel tanks on legs + pipes to the pad
  for (const ad of [64, 88, 112]) { const c = at(ad * D, 58); /* pass 22: moved behind the pad so launch2 sees the rocket base */ const gy = groundAt(c.x, c.z); KEEP.push({ x: c.x, z: c.z, r: 9 });
    bn.add('ivory', G.sphere(5.6, 20, 14), { pos: [c.x, gy + 7.2, c.z], color: C.ivory }); bn.add('gold', G.torus(5.62, 0.22, 3, 24), { pos: [c.x, gy + 7.2, c.z], rot: [PI / 2, 0, 0], color: C.gold });
    for (let k = 0; k < 6; k++) { const la = k / 6 * PI * 2; bn.add('dark', G.box(0.5, 7.2, 0.5), { pos: [c.x + Math.cos(la) * 4.4, gy + 3.4, c.z + Math.sin(la) * 4.4], color: '#3a4250' }); }
    bn.add('dark', G.cyl(5.8, 6.2, 0.5, 16), { pos: [c.x, gy - 0.2, c.z], color: '#2e3540' }); bn.add('gold', G.cyl(0.25, 0.25, 4, 6), { pos: [c.x, gy + 12.6, c.z], color: C.goldD }); bn.add('glow', G.octa(0.3), { pos: [c.x, gy + 16.8, c.z], color: '#ff5030', intensity: 5 });
    const path = []; for (let k = 0; k <= 12; k++) { const t = k / 12; const r = 52 - t * 27; path.push(at(ad * D, r)); } pipeRun(bn, path, { r: 0.6, every: 6, startY: gy + 2.2, endY: y + 2.0, lights: false }); }
  // horizontal tanks: gold bands, end caps, saddles, header pipe to the pad
  for (let i = 0; i < 3; i++) { const p = { x: x - 40 + i * 14, z: z + 40 }; const yy = groundAt(p.x, p.z); KEEP.push({ x: p.x, z: p.z, r: 9 });
    const ty = yy + 5.7; b.add('ivory', G.cyl(5, 5, 14, 16).translate(0, -7, 0).rotateX(PI / 2), { pos: [p.x, ty, p.z], color: C.ivory }); /* axis along z: three tanks side by side */
    for (const dz of [-4.5, 0, 4.5]) bn.add('gold', G.cyl(5.12, 5.12, 0.5, 16, true).translate(0, -0.25, 0).rotateX(PI / 2), { pos: [p.x, ty, p.z + dz], color: C.gold });
    for (const sg of [-1, 1]) { b.add('ivory', G.cap(5, 16, 5).rotateX(sg * PI / 2), { pos: [p.x, ty, p.z + sg * 7], scale: [1, 1, 0.55], color: C.ivory }); /* pass 21: closed domed end caps (the open cylinder ends read as dark holes) */ bn.add('gold', G.torus(5.02, 0.22, 3, 16), { pos: [p.x, ty, p.z + sg * 6.95], color: C.gold }); bn.add('gold', G.cyl(0.9, 0.9, 0.5, 8).rotateX(sg * PI / 2), { pos: [p.x, ty, p.z + sg * 9.6], color: C.goldD }); bn.add('dark', G.box(8, 2.0, 1.4), { pos: [p.x, yy + 0.5, p.z + sg * 4.5], color: '#3a4250' }); } }
  { const path = []; for (let k = 0; k <= 16; k++) { const t = k / 16; path.push({ x: x - 26 + t * 8, z: z + 33 - t * 14 }); } pipeRun(bn, path, { r: 0.7, every: 8, lights: false }); }
  // control bunker: bermed block with a glowing window band, antenna mast + small dish
  { const c = at(167 * D, 54); const gy = groundAt(c.x, c.z); const a = Math.atan2(z - c.z, x - c.x); KEEP.push({ x: c.x, z: c.z, r: 16 });
    bn.add('tex', G.box(18, 4.6, 10), { region: 'panel', pos: [c.x, gy + 2.0, c.z], rot: [0, -a + PI / 2, 0], color: '#ffffff' });
    bn.add('glow', G.box(15, 1.0, 10.15), { pos: [c.x, gy + 3.0, c.z], rot: [0, -a + PI / 2, 0], color: C.win, intensity: 2.6 }); bn.add('gold', G.box(18.4, 0.4, 10.4), { pos: [c.x, gy + 4.5, c.z], rot: [0, -a + PI / 2, 0], color: C.gold });
    const bx = c.x - Math.cos(a) * 8, bz = c.z - Math.sin(a) * 8; const sh = new THREE.Shape(); sh.moveTo(-6, 0); sh.lineTo(6, 0); sh.lineTo(0, 5.2); sh.lineTo(-6, 0); bn.add('ivory', G.sphere(1, 14, 7), { pos: [bx, gy - 1.4, bz], rot: [0, -a + PI / 2, 0], scale: [12, 3.4, 7.5], color: '#86837c' }); /* regolith berm (was a dark wedge) */
    bn.add('gold', G.cyl(0.3, 0.4, 8, 6), { pos: [c.x + 5, gy + 4.6, c.z], color: C.goldD }); bn.add('glow', G.octa(0.25), { pos: [c.x + 5, gy + 13.4, c.z], color: '#ff5030', intensity: 5 }); }
  // landing strip toward the hub: dark runway, gold edge lights on posts, white centre dashes, threshold bars
  { const a = 135 * D, va = 45 * D; const c = at(a, 74); const P = []; for (let k = 0; k <= 16; k++) { const t = k / 16 - 0.5; P.push({ x: c.x + Math.cos(va) * t * 150, z: c.z + Math.sin(va) * t * 150 }); }
    strip(bn, P, 0, 14, 0.12, 'ivory', '#6f7278', 1); /* pass 25: uniform grey paving on a graded bed */ strip(bn, P, -6.6, 0.3, 0.16, 'glow', C.gold, 1.3); strip(bn, P, 6.6, 0.3, 0.16, 'glow', C.gold, 1.3);
    for (let k = 0; k <= 30; k++) { const t = k / 30 - 0.5; const px = c.x + Math.cos(va) * t * 150, pz = c.z + Math.sin(va) * t * 150; if (k % 3 === 0) for (const sg of [-1, 1]) { /* pass 21: 11 posts per edge in two neat rows (was 31) */ const qx = px + Math.cos(a) * 7.6 * sg, qz = pz + Math.sin(a) * 7.6 * sg; const gy = groundAt(qx, qz); bn.add('ivory', G.cyl(0.08, 0.1, 0.8, 5), { pos: [qx, gy, qz], color: C.ivory2 }); bn.add('glow', G.octa(0.2), { pos: [qx, gy + 0.95, qz], color: k === 0 || k === 30 ? '#ff6040' : C.win, intensity: 4 }); }
      if (k % 2 === 1 && k > 2 && k < 28) bn.add('ivory', G.box(0.7, 0.06, 6), { pos: [px, groundAt(px, pz) + 0.18, pz], rot: [0, -va + PI / 2, 0], color: '#e8e2d6' }); }
    for (const t of [-0.46, 0.46]) for (let m = -2; m <= 2; m++) { const px = c.x + Math.cos(va) * t * 150 + Math.cos(a) * m * 2.4, pz = c.z + Math.sin(va) * t * 150 + Math.sin(a) * m * 2.4; bn.add('ivory', G.box(1.4, 0.06, 5), { pos: [px, groundAt(px, pz) + 0.18, pz], rot: [0, -va, 0], color: '#e8e2d6' }); }
    for (let k = 0; k <= 16; k++) KEEP.push({ ...P[k], r: 11 }); }
  // second, smaller rocket on its own pad with a slim service tower
  { const c = at(200 * D, 86); const gy = groundAt(c.x, c.z); KEEP.push({ x: c.x, z: c.z, r: 15 });
    bn.add('dark', G.cyl(11, 12, 1.0, 8), { pos: [c.x, gy - 0.4, c.z], color: '#3a4250' }); bn.add('ivory', G.cyl(10, 10.5, 0.8, 8), { pos: [c.x, gy + 0.2, c.z], color: C.ivory2 }); bn.add('gold', G.torus(10.3, 0.25, 3, 8), { pos: [c.x, gy + 1.0, c.z], rot: [PI / 2, 0, PI / 8], color: C.gold });
    rocket(bn, c.x, gy + 1.0, c.z, 1.7, 0.6, 16); lattice(bn, c.x + 6.5, gy + 1.0, c.z + 1.5, 3, 34, 9); bn.add('glow', G.octa(0.4), { pos: [c.x + 6.5, gy + 36.5, c.z + 1.5], color: '#ff5030', intensity: 5 }); }
  // floodlight masts around the main pad
  for (const ad of [-10, 100, 170, 280]) { const c = at(ad * D, 33); const gy = groundAt(c.x, c.z); const a = Math.atan2(z - c.z, x - c.x);
    bn.add('ivory', G.cyl(0.25, 0.4, 22, 8), { pos: [c.x, gy, c.z], color: C.ivory2 }); bn.add('dark', G.box(3.2, 1.4, 0.6), { pos: [c.x, gy + 22.4, c.z], rot: [0, -a + PI / 2, 0], color: '#3a4250' }); bn.add('glow', G.box(2.9, 1.1, 0.2), { pos: [c.x + Math.cos(a) * 0.35, gy + 22.4, c.z + Math.sin(a) * 0.35], rot: [0, -a + PI / 2, 0], color: '#fff2d0', intensity: 3.5 }); KEEP.push({ x: c.x, z: c.z, r: 3 }); }
}

function reactorCrater(b, beams, bn, bf) { // pass 19: a real reactor complex on the crater floor (was a floating disc + floating pipes)
  const { x, z } = REGIONS.reactor; const y = groundAt(x, z);
  // far LOD (world/aerial maps): one simple drum + glowing pool
  bf.add('tex', G.cyl(20, 21, 8.7, 16), { region: 'reactorWall', pos: [x, y, z], color: '#ffffff' }); bf.add('glow', G.disc(12, 16), { pos: [x, y + 8.75, z], color: C.winHot, intensity: 4 });
  // stepped core drum on the flat floor
  bn.add('dark', G.cyl(25, 26.5, 1.2, 48), { pos: [x, y - 0.6, z], color: '#3a4250' });
  bn.add('gold', G.torus(25.6, 0.35, 4, 48), { pos: [x, y + 0.55, z], rot: [PI / 2, 0, 0], color: C.gold });
  bn.add('tex', G.cyl(20, 21, 4.2, 40, true), { region: 'reactorWall', pos: [x, y + 0.5, z], color: '#ffffff', ao: [y, y + 6] });
  bn.add('ivory', G.ring(14.5, 20.2, 40), { pos: [x, y + 4.7, z], color: C.ivory2 });
  bn.add('gold', G.torus(20.1, 0.4, 4, 40), { pos: [x, y + 4.7, z], rot: [PI / 2, 0, 0], color: C.gold });
  bn.add('tex', G.cyl(13.5, 14.5, 3.2, 36, true), { region: 'reactorWall', pos: [x, y + 4.7, z], color: '#ffffff', ao: [y + 4.5, y + 9] });
  bn.add('ivory', G.torus(13.6, 0.9, 5, 36), { pos: [x, y + 7.9, z], rot: [PI / 2, 0, 0], color: C.ivory });
  bn.add('gold', G.torus(12.7, 0.22, 4, 36), { pos: [x, y + 8.5, z], rot: [PI / 2, 0, 0], color: C.gold2 });
  // molten core pool + glowing pit wall
  bn.add('glow', G.cyl(12.6, 11.8, 2.2, 36, true), { pos: [x, y + 6.0, z], flip: true, color: (px, py) => { const t = THREE.MathUtils.clamp((py - y - 6.0) / 2.2, 0, 1); const k = 1.6 - 0.7 * t; return [k, k * 0.2, k * 0.02]; } });
  bn.add('glow', G.disc(11.9, 36), { pos: [x, y + 6.1, z], color: (px, py, pz) => { const t = Math.hypot(px - x, pz - z) / 12; return [1.9 - 0.6 * t, 0.62 - 0.3 * t, 0.06]; } }); /* amber, under the bloom threshold */
  for (const [ri, ro] of [[3.2, 3.9], [6.4, 7.0], [9.4, 10.0]]) { bn.add('dark', G.ring(ri, ro, 36), { pos: [x, y + 6.18, z], color: '#3a3430' }); bn.add('gold', G.torus(ro, 0.09, 3, 36), { pos: [x, y + 6.22, z], rot: [PI / 2, 0, 0], color: C.goldD }); }
  for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2; bn.add('dark', G.box(0.45, 0.22, 8.2), { pos: [x + Math.cos(a) * 6.3, y + 6.2, z + Math.sin(a) * 6.3], rot: [0, -a + PI / 2, 0], color: '#3a3430' }); }
  bn.add('gold', G.cyl(1.4, 1.9, 2.6, 16), { pos: [x, y + 6.1, z], color: C.goldD }); bn.add('glow', G.sphere(1.0, 12, 8), { pos: [x, y + 9.0, z], color: '#ffb24a', intensity: 2.6 }); /* central fuel column + hot cap */
  // buttress fins between the tiers + deck lights
  for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2; bn.add('ivory', G.box(1.2, 3.6, 4.2), { pos: [x + Math.cos(a) * 18.6, y + 2.3, z + Math.sin(a) * 18.6], rot: [0, -a, 0], color: C.ivory });
    bn.add('glow', G.box(0.5, 0.25, 0.5), { pos: [x + Math.cos(a + 0.26) * 17.2, y + 4.9, z + Math.sin(a + 0.26) * 17.2], color: i % 2 ? C.winHot : C.win, intensity: 4 }); }
  beams.push({ x, y: y + 6, z, r: 11, h: 90, color: '#ff8a30', I: 0.32 });
  beams.push({ x, y: y + 6, z, r: 4.5, h: 170, color: '#ffb050', I: 0.38 });
  // cooling towers ringing the core (tapered ivory stacks, gold bands, glowing crowns)
  for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2 + 0.3; const px = x + Math.cos(a) * 33, pz = z + Math.sin(a) * 33; const yy = groundAt(px, pz) - 0.3;
    bn.add('ivory', G.cyl(3.0, 4.2, 8, 20), { pos: [px, yy, pz], color: C.ivory, ao: [yy, yy + 10] }); bn.add('ivory', G.cyl(3.5, 3.0, 6, 20, true), { pos: [px, yy + 8, pz], color: C.ivory2 }); bn.add('dark', G.cyl(3.3, 2.8, 5.9, 20, true), { pos: [px, yy + 8.05, pz], flip: true, color: '#2a2e36' });
    for (const hb of [3, 8, 13.6]) bn.add('gold', G.torus(hb < 8 ? 3.95 - hb * 0.12 : hb < 13 ? 3.05 : 3.52, 0.18, 3, 20), { pos: [px, yy + hb, pz], rot: [PI / 2, 0, 0], color: C.gold });
    bn.add('glow', G.ring(2.9, 3.4, 20), { pos: [px, yy + 14.05, pz], color: C.winHot, intensity: 3 }); bn.add('dark', G.disc(3.3, 20), { pos: [px, yy + 13.9, pz], color: '#1c2028' }); /* hollow-looking crown */
    bn.add('dark', G.box(1.4, 2.2, 0.2), { pos: [px + Math.cos(a + PI) * 4.05, yy + 1.1, pz + Math.sin(a + PI) * 4.05], rot: [0, -a + PI / 2, 0], color: '#2a3442' }); }
  // service road down the crater wall toward the hub (dark strip with gold edge lights) — leading line for the region shot
  { const ah = Math.atan2(-z, -x); const P = []; for (let k = 0; k <= 30; k++) { const t = k / 30; const rr = 120 - t * 96; const a = ah + Math.sin(t * PI * 1.5) * 0.28; P.push({ x: x + Math.cos(a) * rr, z: z + Math.sin(a) * rr }); }
    /* pass 25: the paved strip stays hidden here (the steep, rough crater wall pokes through any draped ribbon); the lamp-post rows remain the leading line, as in passes 20-23 */
    for (let k = 2; k < P.length; k += 3) for (const sgn of [-1, 1]) { const A = P[k], B = P[k - 1]; const dx = A.x - B.x, dz = A.z - B.z, l = Math.hypot(dx, dz); const px = A.x - dz / l * 3.6 * sgn, pz = A.z + dx / l * 3.6 * sgn; const yy = groundAt(px, pz); bn.add('ivory', G.cyl(0.12, 0.16, 2.2, 6), { pos: [px, yy, pz], color: C.ivory2 }); bn.add('glow', G.octa(0.22), { pos: [px, yy + 2.35, pz], color: C.win, intensity: 4 }); } }
  // rim stations + pipes that follow the crater wall down to the core (on short supports, not floating)
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * PI * 2; const rr = 92; const px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr; const yy = groundAt(px, pz);
    b.add('tex', G.box(9, 5, 7), { region: 'panel', pos: [px, yy + 2, pz], rot: [0, -a, 0], color: '#ffffff' });
    b.add('gold', G.box(9.3, 0.5, 7.3), { pos: [px, yy + 4.6, pz], rot: [0, -a, 0], color: C.gold });
    b.add('glow', G.box(7, 1.0, 7.4), { pos: [px, yy + 2.5, pz], rot: [0, -a, 0], color: C.winHot, intensity: 2.5 });
    if (i % 2 === 0) { const path = []; for (let k = 0; k <= 30; k++) { const r2 = 87 - k * (87 - 21.6) / 30; path.push({ x: x + Math.cos(a) * r2, z: z + Math.sin(a) * r2 }); } pipeRun(bn, path, { r: 0.8, every: 6, endY: y + 2.4 }); }
  }
}

function canyon(b, beams, bn) { // pass 21: winding canyon floor - beacons follow the meander, landing-site camp around the region centre
  const s0 = canyonS(REGIONS.canyon.x, REGIONS.canyon.z); const P = (s, o = 0) => { const p = canyonPoint(s, o); return { ...p, y: groundAt(p.x, p.z) }; };
  { const cp = canyonPoint(s0 - 84, -2); KEEP.push({ x: cp.x, z: cp.z, r: 20 }); } /* QA camera spot */
  const dirAt = (s) => { const a = canyonPoint(s - 2), c = canyonPoint(s + 2); return Math.atan2(c.z - a.z, c.x - a.x); };
  for (const s of [120, 250, s0 - 135, s0 + 110, 640]) { const p = P(s); beams.push({ x: p.x, y: p.y, z: p.z, r: 1.2, h: 12, color: '#3fe0d0', I: 0.18 }); b.add('glow', G.disc(3, 12), { pos: [p.x, p.y + 0.3, p.z], color: C.cyan, intensity: 3 }); KEEP.push({ x: p.x, z: p.z, r: 4 }); }
  // floor marker lamps: two neat rows along the winding floor
  for (let s = s0 - 190; s <= s0 + 190; s += 16) for (const sg of [-1, 1]) { const p = P(s, sg * 6.5); bn.add('ivory', G.cyl(0.1, 0.14, 1.0, 5), { pos: [p.x, p.y, p.z], color: C.ivory2 }); bn.add('glow', G.octa(0.22), { pos: [p.x, p.y + 1.15, p.z], color: C.cyan, intensity: 4 }); }
  // landing pad: ring of lights on a dark disc, MK flag ring
  { const p = P(s0 - 18, -1); KEEP.push({ x: p.x, z: p.z, r: 12 }); bn.add('dark', G.cyl(9, 9.6, 0.5, 24), { pos: [p.x, p.y - 0.3, p.z], color: '#3a4250' }); bn.add('ivory', G.ring(7.4, 8.2, 24), { pos: [p.x, p.y + 0.24, p.z], color: C.ivory2 });
    for (let k = 0; k < 12; k++) { const a = k / 12 * PI * 2; bn.add('glow', G.box(0.4, 0.2, 0.4), { pos: [p.x + Math.cos(a) * 8.8, p.y + 0.3, p.z + Math.sin(a) * 8.8], color: k % 3 ? C.win : C.cyan, intensity: 4 }); }
    bn.add('gold', G.ring(2.2, 2.8, 16), { pos: [p.x, p.y + 0.26, p.z], color: C.gold }); }
  // crashed lander on the floor: tilted drum, cracked dome, one leg snapped, scattered hull panels, smoke-dark scorch
  { const p = P(s0 + 34, 3); const a = dirAt(s0 + 34); KEEP.push({ x: p.x, z: p.z, r: 11 }); const R = [0.32, a, -0.22];
    bn.add('ivory', G.cyl(4, 5.2, 4.6, 12), { pos: [p.x, p.y - 0.8, p.z], rot: R, color: C.ivory }); bn.add('gold', G.torus(4.9, 0.25, 3, 12), { pos: [p.x, p.y + 0.4, p.z], rot: [R[0] + PI / 2, R[1], R[2]], color: C.gold });
    bn.add('dark', G.cap(3.6, 12, 4), { pos: [p.x - 1.2, p.y + 3.4, p.z + 0.6], rot: R, color: '#6f8fa8' }); bn.add('dark', G.cyl(1.6, 1.0, 1.6, 8), { pos: [p.x + 2.5, p.y - 1.0, p.z - 0.8], rot: [PI / 2 + 0.3, a, 0], color: '#2b2f36' });
    for (let k = 0; k < 4; k++) { const la = a + k * PI / 2 + 0.4; const broken = k === 2; bn.add('gold', G.box(0.45, broken ? 2.6 : 6, 0.45), { pos: [p.x + Math.cos(la) * 5, p.y + (broken ? 0.4 : 1.2), p.z + Math.sin(la) * 5], rot: [0.55 * Math.sin(la) + (broken ? 1.2 : 0), 0, 0.55 * Math.cos(la)], color: C.goldD }); bn.add('dark', G.cyl(0.9, 1.1, 0.3, 8), { pos: [p.x + Math.cos(la) * 6.6, p.y - 0.1, p.z + Math.sin(la) * 6.6], color: '#3a4250' }); }
    for (let k = 0; k < 7; k++) { const pa = a + 1.3 + k * 0.9, pr = 8 + (k * 37 % 9); const q = { x: p.x + Math.cos(pa) * pr, z: p.z + Math.sin(pa) * pr }; bn.add('ivory', G.box(1.6 + k % 3 * 0.6, 0.12, 1.1 + k % 2), { pos: [q.x, groundAt(q.x, q.z) + 0.15, q.z], rot: [0.3 * Math.sin(k * 2.1), pa * 1.7, 0.25 * Math.cos(k * 1.3)], color: k % 3 ? C.ivory2 : C.gold }); }
    bn.add('glow', G.octa(0.35), { pos: [p.x - 2.6, p.y + 2.2, p.z + 2.4], color: '#ff5030', intensity: 6 }); }
  // camp: supply crates (stacked, gold straps), flags, tripod floodlights, a cable to the pad
  { const p = P(s0 - 44, 2); const a = dirAt(s0 - 44); KEEP.push({ x: p.x, z: p.z, r: 10 }); const ca = Math.cos(a), sa = Math.sin(a);
    const crate = (u, v, lvl, sz, rot) => { const x = p.x + ca * u - sa * v, z = p.z + sa * u + ca * v; const gy = groundAt(p.x + ca * u - sa * v, p.z + sa * u + ca * v); bn.add('ivory', G.box(sz, sz * 0.8, sz), { pos: [x, gy + sz * 0.4 + lvl * sz * 0.8, z], rot: [0, -a + rot, 0], color: lvl ? C.ivory : C.ivory2 }); bn.add('gold', G.box(sz * 1.02, sz * 0.82, 0.22), { pos: [x, gy + sz * 0.4 + lvl * sz * 0.8, z], rot: [0, -a + rot, 0], color: C.goldD }); };
    crate(0, 0, 0, 2.0, 0.1); crate(2.3, 0.4, 0, 2.0, -0.15); crate(1.1, 0.2, 1, 1.8, 0.3); crate(-2.0, 2.6, 0, 1.4, 0.6); crate(-0.4, 3.4, 0, 1.2, -0.4); crate(4.4, -1.8, 0, 1.6, 0.2); crate(-3.2, -1.2, 0, 1.0, 0.9);
    bn.add('dark', G.box(4.2, 0.12, 3.0), { pos: [p.x - sa * -5.5, groundAt(p.x + sa * 5.5, p.z - ca * 5.5) + 0.07, p.z + ca * -5.5], rot: [0, -a, 0], color: '#2a3442' }); }
  for (const [ds, o, col] of [[-30, -6, C.gold], [-27, 7, '#e8e2d6'], [-8, -7, C.gold], [48, -6, C.cyan]]) { const p = P(s0 + ds, o); KEEP.push({ x: p.x, z: p.z, r: 2 }); bn.add('ivory', G.cyl(0.07, 0.08, 4.2, 5), { pos: [p.x, p.y, p.z], color: C.ivory2 }); bn.add(col === C.cyan ? 'glow' : 'gold', G.box(1.8, 1.1, 0.06), { pos: [p.x + 0.9, p.y + 3.5, p.z], rot: [0, 0.4, 0.04], color: col, intensity: 1.4 }); bn.add('glow', G.octa(0.12), { pos: [p.x, p.y + 4.3, p.z], color: C.win, intensity: 5 }); }
  for (const [ds, o] of [[-60, 8], [10, -8], [70, 8], [-120, -8], [130, -8]]) { const p = P(s0 + ds, o); const t = canyonPoint(s0 + ds); const a = Math.atan2(t.z - p.z, t.x - p.x); KEEP.push({ x: p.x, z: p.z, r: 2.5 });
    for (let k = 0; k < 3; k++) { const la = k / 3 * PI * 2; bn.add('dark', G.box(0.14, 5.4, 0.14), { pos: [p.x + Math.cos(la) * 0.9, p.y + 2.5, p.z + Math.sin(la) * 0.9], rot: [0.17 * Math.sin(la), 0, -0.17 * Math.cos(la)], color: '#555c66' }); }
    bn.add('dark', G.box(2.2, 1.0, 0.5), { pos: [p.x, p.y + 5.4, p.z], rot: [0, -a + PI / 2, 0], color: '#3a4250' }); bn.add('glow', G.box(2.0, 0.8, 0.12), { pos: [p.x + Math.cos(a) * 0.3, p.y + 5.4, p.z + Math.sin(a) * 0.3], rot: [0, -a + PI / 2, 0], color: '#fff2d0', intensity: 3.5 }); }
  // glowing survey markers bolted to the wall benches (gives the layered walls scale)
  for (let s = s0 - 170; s <= s0 + 170; s += 34) for (const sg of [-1, 1]) { const p = P(s + sg * 9, sg * 28); bn.add('glow', G.box(0.5, 0.5, 0.5), { pos: [p.x, p.y + 0.6, p.z], color: C.cyan, intensity: 3 }); }
}

function echo(b, beams, bn) {
  const { x, z } = REGIONS.echo; const y = groundAt(x, z);
  b.add('dark', G.cyl(16, 17, 1, 32), { pos: [x, y - 0.4, z], color: '#2c3644' });
  b.add('glow', G.ring(9, 10, 40), { pos: [x, y + 0.65, z], color: C.cyan, intensity: 3 });
  beams.push({ x, y: y + 0.6, z, r: 4, h: 26, color: '#40e0e0', I: 0.35 });
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * PI * 2; const rr = i % 2 ? 34 : 24; const px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr; const yy = groundAt(px, pz); const h = 16 + (i % 3) * 7;
    b.add('ivory', G.cyl(0.6, 1.4, h, 8), { pos: [px, yy, pz], color: C.ivory });
    b.add('gold', G.torus(1.2, 0.18, 4, 10), { pos: [px, yy + h * 0.3, pz], rot: [PI / 2, 0, 0], color: C.gold });
    b.add('glow', G.octa(1.1), { pos: [px, yy + h + 1.2, pz], scale: [1, 1.6, 1], color: C.cyan, intensity: 5 });
    beams.push({ x: px, y: yy + h, z: pz, r: 0.6, h: 10 + (i % 3) * 4, color: '#50e0e8', I: 0.4 });
    KEEP.push({ x: px, z: pz, r: 4 });
    // pass 20: cable runs between neighbouring pylons (sagging, 3 segments) + base plinth with lights
    { const a2 = (i + 1) / 9 * PI * 2, rr2 = (i + 1) % 2 ? 34 : 24, qx = x + Math.cos(a2) * rr2, qz = z + Math.sin(a2) * rr2, qy = groundAt(qx, qz) + 16 + ((i + 1) % 3) * 7; const p0 = new THREE.Vector3(px, yy + h * 0.85, pz), p1 = new THREE.Vector3(qx, qy * 0 + (qy - 16 - ((i + 1) % 3) * 7) + (16 + ((i + 1) % 3) * 7) * 0.85, qz);
      let prev = p0; for (let k = 1; k <= 4; k++) { const t = k / 4; const cur = p0.clone().lerp(p1, t); cur.y -= Math.sin(t * PI) * 2.2; const dv = cur.clone().sub(prev); bn.add('gold', G.cyl(0.07, 0.07, dv.length(), 4), { pos: prev.toArray(), quat: quatFromDir(dv), color: C.goldD }); prev = cur; } }
    bn.add('dark', G.cyl(2.2, 2.6, 0.8, 8), { pos: [px, yy - 0.3, pz], color: '#2e3540' }); bn.add('glow', G.box(0.3, 0.3, 0.3), { pos: [px + 2.3, yy + 0.6, pz], color: C.cyan, intensity: 4 });
  }
  // relay hut + small dish array beside the field
  { const hx = x + 46, hz = z + 10, hy = groundAt(hx, hz); KEEP.push({ x: hx, z: hz, r: 12 }); bn.add('tex', G.box(12, 4.5, 8), { region: 'panel', pos: [hx, hy + 2.0, hz], color: '#ffffff' }); bn.add('glow', G.box(10, 0.9, 8.1), { pos: [hx, hy + 3.0, hz], color: C.cyan, intensity: 2.2 }); bn.add('gold', G.box(12.4, 0.4, 8.4), { pos: [hx, hy + 4.45, hz], color: C.gold });
    for (let k = 0; k < 3; k++) { const dx = hx - 10 + k * 7, dz = hz + 12, dy = groundAt(dx, dz); KEEP.push({ x: dx, z: dz, r: 4 }); bn.add('ivory', G.cyl(0.25, 0.35, 3.5, 8), { pos: [dx, dy, dz], color: C.ivory2 }); bn.add('ivory', G.cap(2.2, 14, 4, 0.9).rotateX(-0.8), { pos: [dx, dy + 3.8, dz], rot: [0, 0.6, 0], color: C.ivory }); bn.add('gold', G.cyl(0.05, 0.05, 1.6, 4).rotateX(-0.8), { pos: [dx, dy + 3.9, dz], rot: [0, 0.6, 0], color: C.gold }); } }
  // pass 24: cable trenches radiating to small antenna arrays, a parked rover by the relay hut
  for (const ad of [100, 200, 262, 325]) { const a = ad * PI / 180; const P = []; for (let k = 0; k <= 8; k++) { const rr = 38 + k * 8.5; P.push({ x: x + Math.cos(a) * rr, z: z + Math.sin(a) * rr }); } /* pass 25: dead-straight runs */
    strip(bn, P, 0, 1.3, 0.06, 'dark', '#3a3e46', 1); strip(bn, P, 0, 0.18, 0.11, 'glow', C.cyan, 1.4); /* pass 25: up normals, narrower, softer grey, continuous glow line */ for (const p of P) KEEP.push({ x: p.x, z: p.z, r: 2 });
    for (let k = 1; k < 8; k += 3) { const p = P[k]; const gy = groundAt(p.x, p.z); bn.add('ivory', G.box(0.9, 0.5, 0.9), { pos: [p.x, gy + 0.2, p.z], rot: [0, -a, 0], color: C.ivory2 }); bn.add('glow', G.box(0.3, 0.12, 0.3), { pos: [p.x, gy + 0.5, p.z], color: C.cyan, intensity: 4 }); }
    const c = { x: x + Math.cos(a) * 112, z: z + Math.sin(a) * 112 }; const gy = groundAt(c.x, c.z); KEEP.push({ x: c.x, z: c.z, r: 7 });
    bn.add('dark', G.box(5.6, 0.4, 5.6), { pos: [c.x, gy + 0.1, c.z], rot: [0, -a, 0], color: '#2e3540' }); bn.add('tex', G.box(1.6, 1.2, 1.1), { region: 'panel', pos: [c.x, gy + 0.85, c.z], rot: [0, -a, 0], color: '#ffffff' });
    for (const [u, v, h] of [[-1.8, -1.8, 7], [1.8, -1.8, 9], [-1.8, 1.8, 8.5], [1.8, 1.8, 6]]) { const px = c.x + Math.cos(a) * u - Math.sin(a) * v, pz = c.z + Math.sin(a) * u + Math.cos(a) * v;
      bn.add('ivory', G.cyl(0.08, 0.13, h, 5), { pos: [px, gy, pz], color: C.ivory }); for (const yy of [0.55, 0.8]) bn.add('gold', G.box(1.4, 0.07, 0.07), { pos: [px, gy + h * yy, pz], rot: [0, -a + PI / 4, 0], color: C.goldD }); bn.add('glow', G.octa(0.16), { pos: [px, gy + h + 0.2, pz], color: h > 8 ? '#ff5030' : C.cyan, intensity: 5 }); } }
  { const rx = x + 22, rz = z - 47; KEEP.push({ x: rx, z: rz, r: 6 }); rover(bn, rx, rz, 2.4); }
}

function rover(b, x, z, yaw) { // 6-wheel retro rover: rounded ivory cab with glowing windscreen, gold trim, rear cargo deck, antenna dish
  const y = groundAt(x, z) + 0.55;
  const off = (dx, dy, dz) => [x + Math.cos(yaw) * dx + Math.sin(yaw) * dz, y + dy, z - Math.sin(yaw) * dx + Math.cos(yaw) * dz];
  const R = [0, yaw, 0];
  b.add('dark', G.box(2.3, 0.35, 4.4), { pos: off(0, 0.35, 0), rot: R, color: '#4a505a' }); // chassis
  b.add('gold', G.box(2.42, 0.12, 4.5), { pos: off(0, 0.55, 0), rot: R, color: C.gold }); // trim line
  b.add('ivory', G.box(2.2, 0.55, 2.0), { pos: off(0, 0.85, -1.15), rot: R, color: C.ivory2 }); // cargo deck
  b.add('gold', G.box(2.24, 0.06, 2.04), { pos: off(0, 1.14, -1.15), rot: R, color: C.goldD });
  b.add('dark', G.box(1.7, 0.06, 1.5), { pos: off(0, 1.2, -1.2), rot: [-0.08, yaw, 0], color: '#1b3c5a' }); // solar deck
  b.add('ivory', new THREE.CylinderGeometry(1, 1, 2.3, 12, 1, false, -PI / 2, PI).rotateX(-PI / 2), { pos: off(0, 0.6, 1.05), rot: R, scale: [1.1, 0.85, 1], color: C.ivory }); // rounded cab (half cylinder, closed by end plates)
  b.add('ivory', new THREE.CircleGeometry(1, 12, 0, PI), { pos: off(0, 0.6, -0.1), rot: [0, yaw + PI, 0], scale: [1.1, 0.85, 1], color: C.ivory2 });
  b.add('dark', new THREE.CircleGeometry(1, 12, 0, PI), { pos: off(0, 0.6, 2.2), rot: R, scale: [1.1, 0.85, 1], color: '#2a3442' }); b.add('glow', new THREE.CircleGeometry(0.85, 12, 0.25, PI - 0.5), { pos: off(0, 0.62, 2.21), rot: R, scale: [1.1, 0.8, 1], color: C.win, intensity: 2.2 }); b.add('gold', G.torus(1.0, 0.06, 3, 12, PI), { pos: off(0, 0.6, 2.22), rot: R, scale: [1.1, 0.85, 1], color: C.gold }); // front: dark bezel, glowing windscreen, gold arch
  for (const sx of [-1, 1]) { b.add('gold', G.box(0.08, 0.1, 2.3), { pos: off(sx * 1.12, 0.7, 1.05), rot: R, color: C.gold }); b.add('glow', G.box(0.22, 0.14, 0.06), { pos: off(sx * 0.75, 0.62, 2.58), rot: R, color: C.gold2, intensity: 4 }); }
  for (const dz of [-1.5, 0, 1.5]) for (const dx of [-1.32, 1.32]) { b.add('dark', G.cyl(0.52, 0.52, 0.42, 12).rotateZ(PI / 2), { pos: off(dx, 0.0, dz), rot: R, color: '#3a3f48' }); b.add('gold', G.cyl(0.24, 0.24, 0.46, 8).rotateZ(PI / 2), { pos: off(dx, 0.0, dz), rot: R, color: C.gold }); }
  b.add('gold', G.cyl(0.04, 0.04, 1.4, 4), { pos: off(0.75, 1.9, -1.9), color: C.gold }); b.add('ivory', G.cap(0.4, 8, 2).rotateX(-0.9), { pos: off(0.75, 2.6, -1.9), rot: R, color: C.ivory }); b.add('glow', G.octa(0.07), { pos: off(0.75, 2.65, -1.75), color: C.gold2, intensity: 4 });
}

// Glowing gold-lit roads from the hub toward each chapter region (as on the world map)
function roads(b) { return; /* pass 25: hub->region roads stay hidden (never visible before pass 24; draped versions cost ~12k hub tris) */
  const targets = [REGIONS.canyon, REGIONS.reactor, REGIONS.launch, REGIONS.echo].map(r => ({ x: r.x * 0.86, z: r.z * 0.86 }));
  for (const [ti, T] of targets.entries()) {
    const a0 = Math.atan2(T.z, T.x); const start = { x: Math.cos(a0) * 46, z: Math.sin(a0) * 46 };
    const len = Math.hypot(T.x - start.x, T.z - start.z); const n = Math.ceil(len / 8);
    const P = [];
    for (let i = 0; i <= n; i++) { const t = i / n; const nx = -(T.z - start.z) / len, nz = (T.x - start.x) / len; const w = fbm(t * 3 + ti * 7, ti * 3.3, 2) * 40 * Math.sin(PI * t); P.push({ x: start.x + (T.x - start.x) * t + nx * w, z: start.z + (T.z - start.z) * t + nz * w }); }
    const strip = (offset, width, lift, group, color, I) => {
      const pos = []; const col = new THREE.Color(color);
      for (let i = 0; i < P.length - 1; i++) {
        const A = P[i], B = P[i + 1]; const dx = B.x - A.x, dz = B.z - A.z, l = Math.hypot(dx, dz); const nx = -dz / l, nz = dx / l;
        const q = (p, o) => { const px = p.x + nx * o, pz = p.z + nz * o; return [px, groundAt(px, pz) + lift + Math.min(0.6, Math.hypot(px, pz) / 1500), pz]; };
        const a1 = q(A, offset - width / 2), a2 = q(A, offset + width / 2), b1 = q(B, offset - width / 2), b2 = q(B, offset + width / 2);
        pos.push(...a1, ...a2, ...b1, ...a2, ...b2, ...b1) /* pass 24: upward winding (strips were back-face culled) */;
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
      b.add(group, g, { color, intensity: I });
    };
    strip(0, 5, 0.06, 'dark', '#4a4d55', 1);
    strip(-2.4, 0.22, 0.12, 'glow', C.gold2, 2.2);
    strip(2.4, 0.22, 0.12, 'glow', C.gold2, 2.2);
  }
}

export function buildWorld(B, beams) {
  const b = B.misc; launchComplex(B.launch, beams, B.launchNear); reactorCrater(B.reactor, beams, B.reactorNear, B.reactorFar); canyon(B.canyon, beams, B.canyonNear); echo(B.echo, beams, B.echoNear); roads(B.roads);
  const r1 = sd(-30, 2); rover(b, r1.x, r1.z, 1.2);
  const r3 = sd(28, -2); rover(b, r3.x, r3.z, -0.6);
}
