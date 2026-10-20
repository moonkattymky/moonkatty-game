import * as THREE from 'three';
import { toCreasedNormals } from '../vendor/three/jsm/utils/BufferGeometryUtils.js';
import { G, quatFromDir, GQ } from './builder.js';
import { groundAt, sd, PORTAL, F, CAVE, PLAY_START, CONCEPT } from './terrain.js';
import { noise2 } from './noise.js';

const PI = Math.PI;
export const C = {
  ivory: '#dccaa8', ivory2: '#ccb995', gold: '#e9bd58', gold2: '#efd295', goldD: '#aa7835', navy: '#102e40', night: '#05070d',
  dark: '#2a3442', win: '#ffb347', winHot: '#ff9a30', cyan: '#67d7f0', mint: '#a8dbc9',
};
export const colliders = [];
const faceCam = Math.atan2(-F.x, -F.z); // yaw that faces the concept camera

function windowsRing(b, x, y, z, R, count, w, h, opts = {}) {
  const a0 = opts.a0 || 0, skip = opts.skip || [];
  for (let i = 0; i < count; i++) {
    const a = a0 + i / count * PI * 2;
    if (skip.some(s => Math.abs(Math.atan2(Math.sin(a - s), Math.cos(a - s))) < (opts.skipW || 0.35))) continue;
    b.add('glow', new THREE.PlaneGeometry(w, h), { pos: [x + Math.sin(a) * R, y, z + Math.cos(a) * R], rot: [0, a, 0], color: opts.color || C.win, intensity: opts.I || 2.2 });
    if (opts.frame) b.add('gold', G.box(w + 0.14, 0.08, 0.12), { pos: [x + Math.sin(a) * R, y - h / 2 - 0.04, z + Math.cos(a) * R], rot: [0, a, 0], color: C.gold });
  }
}
function door(b, x, y, z, a, R, w = 1.4, h = 1.9, color = C.winHot) {
  const px = x + Math.sin(a) * R, pz = z + Math.cos(a) * R;
  b.add('gold', G.box(w + 0.5, h + 0.3, 0.7), { pos: [px, y + (h + 0.3) / 2, pz], rot: [0, a, 0], color: C.gold });
  b.add('glow', G.box(w, h, 0.2), { pos: [px + Math.sin(a) * 0.3, y + h / 2, pz + Math.cos(a) * 0.3], rot: [0, a, 0], color, intensity: 1.5 });
}
function antenna(b, x, y, z, h, light = C.win) {
  b.add('gold', G.cyl(0.08, 0.14, h, 6), { pos: [x, y, z], color: C.gold });
  b.add('gold', G.sphere(0.18, 6, 4), { pos: [x, y + h * 0.6, z], color: C.gold });
  b.add('glow', G.octa(0.16), { pos: [x, y + h + 0.1, z], color: light, intensity: 4 });
}

// stacked gold finial spire (concept: collar, orb, slim cone, small orb, warm tip light)
function finial(b, x, y, z, h) {
  b.add('gold', G.cyl(0.22, 0.3, 0.35, 8), { pos: [x, y, z], color: C.goldD });
  b.add('gold', G.sphere(0.3, 6, 4), { pos: [x, y + 0.6, z], color: C.gold });
  b.add('gold', G.cone(0.16, h, 8), { pos: [x, y + 0.75, z], color: C.gold });
  b.add('gold', G.octa(0.14), { pos: [x, y + 0.75 + h * 0.45, z], color: C.gold2 });
  b.add('glow', G.octa(0.14), { pos: [x, y + 0.85 + h, z], color: C.win, intensity: 4 });
}
export function dome(b, s, d, r, o = {}) {
  const { x, z } = sd(s, d); const y = groundAt(x, z) - 0.15;
  colliders.push({ x, z, r: r * 1.15 }); const seg = r > 4 ? 18 : 14;
  // wide skirt platform (concept: low stepped deck ringed in gold, warm edge lights)
  b.add('dark', G.cyl(r * 1.5, r * 1.58, 0.45, seg), { pos: [x, y - 0.25, z], color: '#3a4250' });
  b.add('ivory', G.cyl(r * 1.4, r * 1.48, 0.3, seg), { pos: [x, y + 0.05, z], color: '#babdc3' });
  b.add('gold', G.torus(r * 1.46, 0.09, 3, 14), { pos: [x, y + 0.33, z], rot: [PI / 2, 0, 0], color: C.gold });
  b.add('gold', G.torus(r * 1.12, 0.12, 3, 14), { pos: [x, y + 0.36, z], rot: [PI / 2, 0, 0], color: C.gold });
  for (let k = 0; k < 8; k++) { const a = k / 8 * PI * 2 + 0.2; b.add('glow', G.box(0.18, 0.08, 0.18), { pos: [x + Math.sin(a) * r * 1.3, y + 0.38, z + Math.cos(a) * r * 1.3], color: C.win, intensity: 3 }); }
  const wallH = r * 0.45, yw = y + 0.3;
  b.add('tex', G.cyl(r, r * 1.05, wallH, seg, true), { region: 'domeWall', pos: [x, yw, z], rot: [0, o.rotA || 0.2, 0], color: '#e8e9ec', ao: [yw - 0.4, yw + wallH * 1.4] });
  const dA = o.doorA ?? faceCam;
  door(b, x, yw, z, dA, r * 0.97, 1.3, Math.min(1.9, wallH * 0.8));
  b.add('gold', G.torus(r * 1.01, 0.12, 3, seg), { pos: [x, yw + wallH, z], rot: [PI / 2, 0, 0], color: C.gold });
  const sy = 0.8, yd = yw + wallH;
  b.add('tex', G.cap(r, seg, 4), { region: 'domeCap', pos: [x, yd, z], rot: [0, (o.rotA || 0.2) + 0.1, 0], scale: [1, sy, 1], color: '#e2e4e8' });
  const top = yd + r * sy;
  b.add('ivory', G.cyl(r * 0.18, r * 0.24, 0.5, 16), { pos: [x, top - 0.15, z], color: C.ivory2 });
  b.add('gold', G.torus(r * 0.2, 0.06, 3, 16), { pos: [x, top + 0.33, z], rot: [PI / 2, 0, 0], color: C.gold });
  finial(b, x, top + 0.3, z, o.spireH || r * 0.75);
  return { x, y, z, top };
}

function reactor(b, s, d) {
  const { x, z } = sd(s, d); const y = groundAt(x, z) - 0.1; const R = 8.5, H = 2.6, Ri = R - 2.4;
  colliders.push({ x, z, r: R * 1.1 });
  b.add('dark', G.cyl(R * 1.1, R * 1.16, 0.5, 36), { pos: [x, y - 0.2, z], color: '#3a4250' });
  b.add('gold', G.torus(R * 1.09, 0.14, 3, 32), { pos: [x, y + 0.3, z], rot: [PI / 2, 0, 0], color: C.gold });
  b.add('tex', G.cyl(R, R * 1.04, H, 36, true), { region: 'reactorWall', pos: [x, y + 0.3, z], color: '#ffffff', ao: [y - 0.5, y + H * 1.3] });
  const doors = [faceCam, faceCam + 1.9, faceCam - 1.6, faceCam + PI];
  for (const a of doors) door(b, x, y + 0.3, z, a, R * 1.0, 1.6, 2.0);
  const yt = y + 0.3 + H;
  // rounded shoulder so the outer wall reads as a fat ring (concept) rather than a flat drum
  b.add('ivory', G.torus(R - 0.15, 0.68, 5, 36).rotateZ(PI / 36), { pos: [x, yt - 0.2, z], rot: [PI / 2, 0, 0], color: C.ivory });
  b.add('ivory', G.torus(R + 0.05, 0.32, 4, 36), { pos: [x, y + 0.55, z], rot: [PI / 2, 0, 0], color: C.ivory2 });
  b.add('ivory', G.ring(Ri, R, 36), { pos: [x, yt, z], color: C.ivory2 });
  b.add('gold', G.torus(R, 0.3, 4, 32), { pos: [x, yt, z], rot: [PI / 2, 0, 0], color: C.gold });
  // raised inner lip around the molten pit (concept: thick rounded rim with gold top line)
  b.add('ivory', G.cyl(Ri + 0.1, Ri + 0.75, 0.3, 36, true), { pos: [x, yt, z], color: C.ivory, ao: [yt - 0.3, yt + 1.2] });
  b.add('ivory', G.ring(Ri, Ri + 0.15, 36), { pos: [x, yt + 0.3, z], color: C.ivory2 });
  b.add('gold', G.torus(Ri + 0.08, 0.13, 4, 36), { pos: [x, yt + 0.32, z], rot: [PI / 2, 0, 0], color: C.gold });
  b.add('gold', G.torus(Ri + 0.72, 0.08, 3, 36), { pos: [x, yt + 0.05, z], rot: [PI / 2, 0, 0], color: C.goldD });
  // ring of warm lights on the inner lip around the core + walkway railing posts / deck plates
  for (let i = 0; i < 28; i++) { const a = i / 28 * PI * 2; b.add('glow', G.box(0.32, 0.12, 0.22), { pos: [x + Math.sin(a) * (Ri + 0.42), yt + 0.36, z + Math.cos(a) * (Ri + 0.42)], rot: [0, a, 0], color: i % 2 ? C.winHot : C.win, intensity: 4 }); }
  for (let i = 0; i < 18; i++) { const a = i / 18 * PI * 2 + 0.09; const rr = Ri + 1.25; b.add('gold', G.cyl(0.05, 0.05, 0.55, 4), { pos: [x + Math.sin(a) * rr, yt + 0.02, z + Math.cos(a) * rr], color: C.gold2 }); b.add('dark', G.box(0.08, 0.02, 1.0), { pos: [x + Math.sin(a + 0.17) * (Ri + 1.1), yt + 0.012, z + Math.cos(a + 0.17) * (Ri + 1.1)], rot: [0, a + 0.17, 0], color: '#8a8070' }); }
  b.add('gold', G.torus(Ri + 1.25, 0.035, 3, 36), { pos: [x, yt + 0.57, z], rot: [PI / 2, 0, 0], color: C.gold2 });
  // deep glowing pit: walls glow hotter toward the molten floor, with dark vertical ribs
  const pitD = 0.85;
  b.add('glow', G.cyl(Ri, Ri * 0.92, pitD + 0.55, 36, true), { pos: [x, yt - pitD, z], flip: true, color: (px, py, pz) => { const hh = pitD + 0.55; const ly = py > yt - pitD - 1 ? py - (yt - pitD) : py; const t = THREE.MathUtils.clamp(ly / hh, 0, 1); const k = 1.55 - 0.6 * t; return [k, k * 0.17, k * 0.012]; } });
  for (let i = 0; i < 20; i++) { const a = i / 20 * PI * 2; b.add('dark', G.box(0.16, pitD + 0.8, 0.1), { pos: [x + Math.sin(a) * (Ri * 0.96 - 0.06), yt - pitD / 2 + 0.4, z + Math.cos(a) * (Ri * 0.96 - 0.06)], rot: [0, a, 0], color: '#5a3a20' }); }
  b.add('glow', G.disc(Ri * 0.97, 32), { pos: [x, yt + 0.2, z], color: (px, py, pz) => { const t = Math.hypot(px - x, pz - z) / Ri; const k = 0.95 - 0.4 * t; return [k, k * 0.2, k * 0.012]; } });
  b.add('glow', G.disc(Ri * 0.42, 24), { pos: [x, yt + 0.215, z], color: '#ffb347', intensity: 2.4 }); for (const f of [0.55, 0.78]) b.add('dark', G.ring(Ri * f, Ri * f + 0.34, 48), { pos: [x, yt + 0.218, z], color: '#1c0d06' }); // molten core: hot centre + crust rings
  // small rooftop units
  for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2 + 0.5; const rr = (R + Ri + 0.75) / 2; b.add('ivory', G.cyl(0.35, 0.45, 0.6, 10), { pos: [x + Math.sin(a) * rr, yt, z + Math.cos(a) * rr], color: C.ivory }); b.add('glow', G.octa(0.14), { pos: [x + Math.sin(a) * rr, yt + 0.7, z + Math.cos(a) * rr], color: C.win, intensity: 4 }); }
  return { x, y: yt, z, Ri };
}

function corridor(b, A, B, r = 1.05, h = r + 0.3) {
  const ya = groundAt(A.x, A.z), yb = groundAt(B.x, B.z);
  const a = new THREE.Vector3(A.x, ya + h, A.z), c = new THREE.Vector3(B.x, yb + h, B.z);
  const dir = c.clone().sub(a); const L = dir.length(); dir.normalize(); const q = quatFromDir(dir); const mid = a.clone().add(c).multiplyScalar(0.5);
  const side = new THREE.Vector3(-dir.z, 0, dir.x).normalize(); const yaw = Math.atan2(side.x, side.z);
  const n = Math.max(1, Math.round(L / 2.4)); const sl = L / n;
  for (let i = 0; i < n; i++) {
    const p = a.clone().addScaledVector(dir, (i + 0.5) * sl);
    b.add('tex', G.cyl(r, r, sl, 16, true).translate(0, -sl / 2, 0).rotateY(PI / 4), { region: 'corridor', pos: p.toArray(), quat: q, color: '#ffffff' });
    if (i > 0) { const pc = a.clone().addScaledVector(dir, i * sl); b.add('ivory', G.cyl(r * 1.13, r * 1.13, 0.42, 16, true), { pos: pc.toArray(), quat: q, color: C.ivory2 }); } // raised segment collars (concept: chunky ribbed tubes)
    if (i > 0) b.add('gold', G.torus(r * 1.17, 0.2, 3, 14), { pos: a.clone().addScaledVector(dir, i * sl).toArray(), quat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir), color: C.gold }); /* pass 26: thicker, uniformly bright gold rings (concept) */
    for (const sg of [-1, 1]) b.add('glow', new THREE.PlaneGeometry(sl * 0.62, 0.2), { pos: [p.x + side.x * sg * r * 1.0, p.y + 0.12, p.z + side.z * sg * r * 1.0], rot: [0, yaw + (sg < 0 ? PI : 0), 0], color: C.win, intensity: 1.8 });
    if (i % 2 === 1) b.add('dark', G.box(0.5, h, 0.8), { pos: [p.x, p.y - r - h / 2 + 0.6, p.z], rot: [0, yaw, 0], color: '#4a5260' });
  }
  for (let i = 0; i < 6; i++) colliders.push({ x: A.x + (B.x - A.x) * (i + 0.5) / 6, z: A.z + (B.z - A.z) * (i + 0.5) / 6, r: r + 0.4 });
}

function dishModule(b, s, d) {
  const { x, z } = sd(s, d); const y = groundAt(x, z) - 0.1;
  colliders.push({ x, z, r: 5 });
  b.add('dark', G.cyl(4.6, 4.9, 0.5, 32), { pos: [x, y - 0.2, z], color: '#3a4250' });
  b.add('tex', G.cyl(4.2, 4.4, 2.6, 32, true), { region: 'domeWall', pos: [x, y + 0.3, z], color: '#ffffff', ao: [y - 0.5, y + 3.4] });
  door(b, x, y + 0.3, z, faceCam, 4.1, 1.2, 1.7);
  b.add('gold', G.torus(4.3, 0.16, 3, 32), { pos: [x, y + 2.9, z], rot: [PI / 2, 0, 0], color: C.gold });
  b.add('ivory', G.cyl(3.2, 4.1, 1.2, 32), { pos: [x, y + 2.9, z], color: C.ivory2 });
  b.add('gold', G.torus(3.2, 0.12, 3, 28), { pos: [x, y + 4.1, z], rot: [PI / 2, 0, 0], color: C.gold });
  b.add('ivory', G.cyl(2.0, 2.4, 0.8, 24), { pos: [x, y + 4.1, z], color: C.ivory, ao: [y + 3.9, y + 5.2] }); b.add('gold', G.torus(2.05, 0.09, 3, 24), { pos: [x, y + 4.9, z], rot: [PI / 2, 0, 0], color: C.gold });
  b.add('gold', G.cyl(0.9, 1.3, 1.0, 12), { pos: [x, y + 4.9, z], color: C.gold }); b.add('gold', G.cyl(0.55, 0.7, 1.4, 10), { pos: [x, y + 5.9, z], color: C.goldD });
  // ornate turret: stacked gold collars, buttress fins, light ring
  for (const [yy, rr] of [[5.35, 1.05], [5.75, 0.85], [6.2, 0.75]]) b.add('gold', G.torus(rr, 0.08, 3, 16), { pos: [x, y + yy, z], rot: [PI / 2, 0, 0], color: C.gold2 });
  for (let k = 0; k < 8; k++) { const a = k / 8 * PI * 2; const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0.9, 0); sh.lineTo(0, 1.6); sh.lineTo(0, 0); const g = new THREE.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: false }).translate(0, 0, -0.05); b.add('gold', g, { pos: [x + Math.sin(a) * 1.1, y + 4.9, z + Math.cos(a) * 1.1], rot: [0, a - PI / 2, 0], color: C.goldD }); }
  for (let k = 0; k < 14; k++) { const a = k / 14 * PI * 2; b.add('glow', G.box(0.18, 0.1, 0.18), { pos: [x + Math.sin(a) * 2.25, y + 4.92, z + Math.cos(a) * 2.25], color: C.win, intensity: 3.5 }); }
  for (let k = 0; k < 16; k++) { const a = k / 16 * PI * 2; b.add('glow', G.box(0.22, 0.1, 0.22), { pos: [x + Math.sin(a) * 3.65, y + 4.12, z + Math.cos(a) * 3.65], color: C.gold2, intensity: 3 }); }
  { const DY = faceCam + PI + 0.9; // yoke: two ornate gold arms + pivot hubs + elevation drum
    for (const sx of [-1, 1]) { const ox = Math.cos(DY) * sx * 1.25, oz = -Math.sin(DY) * sx * 1.25; b.add('gold', G.box(0.32, 1.6, 0.95), { pos: [x + ox, y + 7.8, z + oz], rot: [0, DY, 0], color: C.gold }); b.add('gold', G.cyl(0.42, 0.42, 0.3, 14).rotateZ(PI / 2), { pos: [x + ox * 1.12, y + 8.35, z + oz * 1.12], rot: [0, DY, 0], color: C.gold2 }); b.add('glow', G.box(0.12, 0.7, 0.12), { pos: [x + ox * 1.15, y + 7.6, z + oz * 1.15], rot: [0, DY, 0], color: C.win, intensity: 3 }); }
    b.add('ivory', G.cyl(0.95, 1.1, 0.7, 18), { pos: [x, y + 7.35, z], color: C.ivory }); b.add('gold', G.torus(1.0, 0.07, 3, 18), { pos: [x, y + 7.7, z], rot: [PI / 2, 0, 0], color: C.gold });
    // sculpted pedestal: ivory urn neck with gold collars + glowing band, lifts the dish like the concept's tall turret
    b.add('ivory', G.cyl(0.62, 0.8, 0.9, 16), { pos: [x, y + 6.45, z], color: C.ivory, ao: [y + 6.2, y + 7.4] }); for (const [yy, rr] of [[6.45, 0.82], [6.9, 0.7], [7.32, 0.66]]) b.add('gold', G.torus(rr, 0.07, 3, 16), { pos: [x, y + yy, z], rot: [PI / 2, 0, 0], color: C.gold2 });
    b.add('glow', G.cyl(0.71, 0.71, 0.12, 16, true), { pos: [x, y + 7.0, z], color: C.win, intensity: 2.5 });
    // balustrade on the upper deck: gold posts + rail
    for (let k = 0; k < 18; k++) { const a = k / 18 * PI * 2; b.add('gold', G.box(0.07, 0.45, 0.07), { pos: [x + Math.sin(a) * 3.0, y + 4.32, z + Math.cos(a) * 3.0], color: C.gold }); }
    b.add('gold', G.torus(3.0, 0.05, 3, 28), { pos: [x, y + 4.55, z], rot: [PI / 2, 0, 0], color: C.gold2 }); }
  // dish
  const DY = faceCam + PI + 0.9; const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.55, DY, 0, 'YXZ'));
  const center = new THREE.Vector3(x, y + 9.8, z);
  const M = (g, off, col, grp = 'ivory', extra = {}) => { const m = new THREE.Matrix4().compose(center, tilt, new THREE.Vector3(1, 1, 1)); m.multiply(new THREE.Matrix4().makeTranslation(...off)); b.add(grp, g, { matrix: m, color: col, ...extra }); };
  const Rd = 4.6, th = 0.62; const sr = Rd / Math.sin(th);
  const cap = new THREE.SphereGeometry(sr, 28, 6, 0, PI * 2, PI - th, th); // bottom cap: bowl opening up
  const cy = sr * Math.cos(th);
  M(cap, [0, cy, 0], C.ivory, 'ivory');
  M(cap, [0, cy + 0.06, 0], C.ivory2, 'ivory', { flip: true });
  M(G.torus(Rd, 0.16, 3, 32).rotateX(PI / 2), [0, 0.03, 0], C.gold, 'gold');
  for (const f of [0.45, 0.75]) { const t2 = Math.asin(f * Math.sin(th)); M(G.torus(f * Rd, 0.06, 3, 28).rotateX(PI / 2), [0, cy - sr * Math.cos(t2) + 0.1, 0], C.gold2, 'gold'); }
  for (let k = 0; k < 8; k++) { const g = G.torus(sr, 0.05, 3, 6, th).rotateZ(-PI / 2 - th).rotateY(k * PI / 4); M(g, [0, cy + 0.08, 0], C.gold2, 'gold'); }
  for (let k = 0; k < 3; k++) { const a = k / 3 * PI * 2; const p0 = new THREE.Vector3(Math.cos(a) * Rd * 0.95, 0, Math.sin(a) * Rd * 0.95), p1 = new THREE.Vector3(0, 3.2, 0); const dv = p1.clone().sub(p0); const L = dv.length(); const g = G.cyl(0.06, 0.06, L, 5).applyQuaternion(quatFromDir(dv)); M(g, p0.toArray(), C.gold, 'gold'); }
  M(G.cone(0.35, 0.9).rotateX(PI), [0, 3.8, 0], C.gold, 'gold'); M(G.cyl(0.55, 0.55, 0.12, 14), [0, 3.25, 0], C.gold2, 'gold'); M(G.torus(Rd + 0.05, 0.2, 4, 36).rotateX(PI / 2), [0, 0.05, 0], C.gold2, 'gold'); M(G.cyl(0.6, 0.9, 0.9, 14), [0, -1.95, 0], C.gold, 'gold'); // sub-reflector, heavy gold rim, back hub
  M(G.sphere(0.2, 8, 6), [0, 2.9, 0], C.win, 'glow', { intensity: 4 });
  M(G.cyl(0.9, 0.6, 0.6, 12), [0, -0.5, 0], C.ivory2, 'ivory');
  // pass 17: lattice truss on the dish back (alpha lattice group -> no extra draw call) + gold feed horn with glowing tip
  M(G.cyl(Rd * 0.78, 0.75, 1.5, 12, true), [0, -1.35, 0], '#ffffff', 'lattice');
  M(G.cyl(0.07, 0.18, 0.9, 8), [0, 3.95, 0], C.gold2, 'gold'); M(G.torus(0.2, 0.04, 3, 10).rotateX(PI / 2), [0, 3.3, 0], C.gold2, 'gold');
}

function tower(b, x, z, h, w = 1.5) {
  const y = groundAt(x, z); colliders.push({ x, z, r: w });
  b.add('dark', G.cyl(w * 1.2, w * 1.4, 0.6, 8), { pos: [x, y - 0.2, z], color: '#3a4250' });
  const n = 6; const sh = h / n;
  for (let i = 0; i < n; i++) {
    const ww = w * (1 - i * 0.07); const yy = y + 0.4 + i * sh;
    b.add('ivory', G.cyl(ww * 0.55, ww * 0.6, sh * 0.92, 8), { pos: [x, yy, z], color: C.ivory });
    b.add('gold', G.cyl(ww * 0.68, ww * 0.68, sh * 0.1, 8), { pos: [x, yy + sh * 0.9, z], color: C.gold });
    for (let k = 0; k < 4; k++) { const a = k * PI / 2 + PI / 8; b.add('glow', new THREE.PlaneGeometry(0.28, sh * 0.4), { pos: [x + Math.sin(a) * ww * 0.56, yy + sh * 0.5, z + Math.cos(a) * ww * 0.56], rot: [0, a, 0], color: C.win, intensity: 2.5 }); }
    if (i === 2 || i === 4) { b.add('ivory', G.cyl(ww * 1.05, ww * 0.8, 0.35, 12), { pos: [x, yy + sh * 0.95, z], color: C.ivory2 }); b.add('glow', G.torus(ww * 1.05, 0.05, 3, 16), { pos: [x, yy + sh * 0.95 + 0.36, z], rot: [PI / 2, 0, 0], color: C.win, intensity: 2.5 }); }
    const lw = ww * 0.95; for (let k = 0; k < 4; k++) { const a = k * PI / 2 + PI / 4; b.add('lattice', new THREE.PlaneGeometry(lw * 1.414, sh * 0.9), { pos: [x + Math.sin(a) * lw * 0.707, yy + sh * 0.45, z + Math.cos(a) * lw * 0.707], rot: [0, a, 0], color: '#ffffff' }); }
  }
  const top = y + 0.4 + h;
  b.add('gold', G.cone(w * 0.35, h * 0.22, 8), { pos: [x, top, z], color: C.gold });
  b.add('glow', G.octa(0.2), { pos: [x, top + h * 0.22 + 0.15, z], color: '#ff6a3a', intensity: 5 });
  return top;
}

export function rocketGeom(scale = 1, seg = 20) {
  const prof = [[0, 0], [1.25, 0], [1.55, 1.0], [1.65, 3], [1.65, 9.5], [1.55, 11.5], [1.25, 13.2], [0.75, 14.8], [0.25, 15.9], [0, 16.2]];
  // resample the profile by arc length so the atlas strip (bands, portholes) is not distorted
  const cum = [0]; for (let i = 1; i < prof.length; i++) cum.push(cum[i - 1] + Math.hypot(prof[i][0] - prof[i - 1][0], prof[i][1] - prof[i - 1][1]));
  const N = 26, pts = []; for (let k = 0; k <= N; k++) { const t = k / N * cum[cum.length - 1]; let i = 1; while (i < cum.length - 1 && cum[i] < t) i++; const f = (t - cum[i - 1]) / (cum[i] - cum[i - 1]); pts.push(new THREE.Vector2((prof[i - 1][0] + (prof[i][0] - prof[i - 1][0]) * f) * scale, (prof[i - 1][1] + (prof[i][1] - prof[i - 1][1]) * f) * scale)); }
  pts[0].x = 0.001 * scale; // avoid degenerate bottom
  return new THREE.LatheGeometry(pts.slice(1), GQ.s === 1 ? seg : Math.max(8, Math.round(seg * GQ.s)));
}
export function rocket(b, x, y, z, S = 1, yaw = 0, seg = 20) {
  const by = y + 1.4 * S;
  b.add('gold', G.cone(1.15 * S, 1.6 * S, 16).rotateX(PI).translate(0, 1.6 * S, 0), { pos: [x, y - 0.2 * S, z], color: C.goldD });
  b.add('dark', G.cyl(1.0 * S, 1.0 * S, 0.1 * S, 16), { pos: [x, y - 0.25 * S, z], color: '#ff8a30', intensity: 0.4 });
  b.add('tex', rocketGeom(S, seg), { region: 'rocket', pos: [x, by, z], rot: [0, yaw + PI, 0], color: '#ffffff', ao: [by - 1.5 * S, by + 5 * S] });
  b.add('gold', G.torus(1.3 * S, 0.12 * S, 4, 28), { pos: [x, by + 0.4 * S, z], rot: [PI / 2, 0, 0], color: C.gold });
  for (let k = 0; k < 4; k++) {
    const a = yaw + k * PI / 2 + PI / 4; const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(2.2, -1.2); sh.lineTo(2.3, -2.6); sh.lineTo(0, -1.4); sh.lineTo(0, 4.2); sh.lineTo(0, 0);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.2, bevelEnabled: false }).translate(0, 0, -0.1).scale(S * 1.4, S * 1.3, S);
    b.add('ivory', g, { pos: [x + Math.sin(a) * 1.5 * S, by + 2.6 * S, z + Math.cos(a) * 1.5 * S], rot: [0, a - PI / 2, 0], color: C.ivory2 });
    // gold leading edge + tip
    const e0 = new THREE.Vector3(0, 4.2, 0), e1 = new THREE.Vector3(2.2, -1.2, 0); const dv = e1.clone().sub(e0); const Lr = dv.length();
    const edge = G.cyl(0.11, 0.11, Lr, 5).applyQuaternion(quatFromDir(dv)).translate(0, 4.2, 0).scale(S * 1.4, S * 1.3, S);
    b.add('gold', edge, { pos: [x + Math.sin(a) * 1.5 * S, by + 2.6 * S, z + Math.cos(a) * 1.5 * S], rot: [0, a - PI / 2, 0], color: C.gold });
    b.add('gold', G.box(0.14 * S, 1.9 * S, 0.3 * S), { pos: [x + Math.sin(a) * 4.7 * S, by - 0.3 * S, z + Math.cos(a) * 4.7 * S], rot: [0, a, 0], color: C.gold });
  }
  b.add('gold', G.cyl(0.05 * S, 0.05 * S, 1.2 * S, 5), { pos: [x, by + 16.1 * S, z], color: C.gold });
  b.add('glow', G.octa(0.16 * S), { pos: [x, by + 17.4 * S, z], color: '#ff5533', intensity: 5 });
}

function launchPad(b, s, d) {
  const { x, z } = sd(s, d); const y = groundAt(x, z);
  colliders.push({ x, z, r: 7.2 });
  // round stepped pad (concept): three ivory tiers, gold lips, warm marker lights
  b.add('dark', G.cyl(7.7, 8.1, 0.6, 32), { pos: [x, y - 0.4, z], color: '#3a4250' });
  b.add('ivory', G.cyl(7.0, 7.4, 0.8, 32), { pos: [x, y - 0.2, z], color: C.ivory2 });
  b.add('gold', G.torus(7.05, 0.12, 3, 32), { pos: [x, y + 0.6, z], rot: [PI / 2, 0, 0], color: C.gold });
  b.add('ivory', G.cyl(5.4, 5.7, 0.6, 32), { pos: [x, y + 0.6, z], color: C.ivory });
  b.add('gold', G.torus(5.45, 0.1, 3, 32), { pos: [x, y + 1.2, z], rot: [PI / 2, 0, 0], color: C.gold });
  b.add('ivory', G.cyl(3.6, 3.9, 0.6, 24), { pos: [x, y + 1.2, z], color: C.ivory2 });
  b.add('gold', G.torus(3.65, 0.08, 3, 24), { pos: [x, y + 1.8, z], rot: [PI / 2, 0, 0], color: C.goldD });
  for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2; b.add('glow', G.box(0.35, 0.12, 0.35), { pos: [x + Math.sin(a) * 6.35, y + 0.62, z + Math.cos(a) * 6.35], color: C.win, intensity: 3 }); }
  rocket(b, x, y + 1.95, z, 1.2, faceCam);
  const t1 = sd(s - 7.5, d - 1), t2 = sd(s + 7.5, d + 1.5);
  const h1 = tower(b, t1.x, t1.z, 19, 1.6), h2 = tower(b, t2.x, t2.z, 16, 1.5);
  // gantry arms
  for (const [t, hh] of [[t1, 11.5], [t2, 9.5]]) { const A = new THREE.Vector3(t.x, y + hh, t.z), B = new THREE.Vector3(x, y + hh, z); const dv = B.clone().sub(A); const L = dv.length() - 2.1; b.add('gold', G.box(0.35, 0.35, L), { pos: A.clone().addScaledVector(dv.normalize(), L / 2).toArray(), rot: [0, Math.atan2(dv.x, dv.z), 0], color: C.goldD }); }
}

function beaconPad(b, s, d, beams, height = 46) {
  const { x, z } = sd(s, d); const y = groundAt(x, z) + 0.15;
  colliders.push({ x, z, r: 1.4 });
  // three stepped tiers with cyan rings and a glowing emitter (concept foreground beacon)
  b.add('dark', G.cyl(3.7, 4.1, 0.6, 32), { pos: [x, y - 0.4, z], color: '#2c3644' });
  b.add('gold', G.torus(3.7, 0.13, 3, 32), { pos: [x, y + 0.2, z], rot: [PI / 2, 0, 0], color: C.gold });
  b.add('glow', G.ring(3.05, 3.35, 32), { pos: [x, y + 0.21, z], color: C.cyan, intensity: 2.2 });
  b.add('ivory', G.cyl(2.6, 2.9, 0.5, 32), { pos: [x, y + 0.2, z], color: C.ivory });
  b.add('gold', G.torus(2.6, 0.1, 3, 28), { pos: [x, y + 0.7, z], rot: [PI / 2, 0, 0], color: C.gold });
  b.add('glow', G.ring(1.85, 2.1, 32), { pos: [x, y + 0.72, z], color: C.cyan, intensity: 3 });
  b.add('dark', G.cyl(1.35, 1.55, 0.4, 24), { pos: [x, y + 0.7, z], color: '#2c3644' });
  b.add('gold', G.torus(1.35, 0.07, 3, 24), { pos: [x, y + 1.1, z], rot: [PI / 2, 0, 0], color: C.gold2 });
  b.add('glow', G.disc(1.1, 24), { pos: [x, y + 1.11, z], color: C.cyan, intensity: 4.5 });
  beams.push({ x, y: y + 1.1, z, r: 0.7, h: height, color: C.cyan, I: 0.9, taper: 0.45 });
}

// glowing portal cave carved into the crater wall: rocky arch, dark tunnel, gold/cyan gate, cyan pads + beams
function rockyArch(R, tube, seed) {
  const g = new THREE.TorusGeometry(R, tube, 6, 16, PI).toNonIndexed(); const P = g.attributes.position; const v = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i); const n = noise2(v.x * 0.45 + seed, v.y * 0.45 + v.z * 0.6) * 0.9 + noise2(v.x * 1.3, v.y * 1.3 + seed) * 0.35; const ang = Math.atan2(v.y, v.x); const c = new THREE.Vector3(Math.cos(ang) * R, Math.sin(ang) * R, 0); const d = v.clone().sub(c); v.copy(c).addScaledVector(d, 1 + n * 0.55); if (v.y < 0) v.y = -0.5; P.setXYZ(i, v.x, v.y, v.z); }
  return toCreasedNormals(g, 1.0); /* pass 41: rounded rock arch (no triangle facets) */
}
function portalCave(b, beams) {
  const P0 = PORTAL; let yaw = Math.atan2(P0.x - CAVE.x, P0.z - CAVE.z); // faces out of the wall, toward the hub
  // mouth: walk from the flat pad into the wall until the slope is tall enough
  let mx = P0.x, mz = P0.z; let fx = Math.sin(yaw), fz = Math.cos(yaw); const y0 = groundAt(P0.x, P0.z);
  for (let t = 0; t < 30; t += 0.5) { mx = P0.x - fx * t; mz = P0.z - fz * t; if (groundAt(mx, mz) - y0 > 2.2) break; }
  const y = y0; const R = 8.2;
  { const cy = Math.atan2(CONCEPT.cam.x - mx, CONCEPT.cam.z - mz); const d = Math.atan2(Math.sin(cy - yaw), Math.cos(cy - yaw)); yaw += Math.max(-0.45, Math.min(0.45, d)); fx = Math.sin(yaw); fz = Math.cos(yaw); } // turn the mouth toward the concept camera so the recess reads deep
  colliders.push({ x: mx, z: mz, r: 3 });
  const at = (dx, dz, dy = 0) => [mx + Math.cos(yaw) * dx + fx * dz, y + dy, mz - Math.sin(yaw) * dx + fz * dz];
  { // inner arch faces fall off into darkness so the mouth reads as a deep cave from the concept camera
    const archCol = (c, R0, span, kOut) => (px, py, pz) => { const lat = (px - c[0]) * Math.cos(yaw) - (pz - c[2]) * Math.sin(yaw); const rr = Math.hypot(lat, py - c[1]); const t = THREE.MathUtils.clamp((rr - R0) / span, 0, 1); const k = 0.003 + kOut * t * t; return [k * 1.02, k, k * 0.96]; };
    const c1 = at(0, 0.2), c2 = at(0, -1.8);
    b.add('dark', rockyArch(R + 1.6, 2.1, 3), { pos: c1, rot: [0, yaw, 0], ao: [y - 1, y + 10], color: archCol(c1, R + 0.5, 4.0, 0.016) });
    b.add('dark', rockyArch(R + 4.2, 2.9, 7), { pos: c2, rot: [0, yaw, 0], color: archCol(c2, R + 2.2, 5.0, 0.034) });
  }
  // tunnel (inside visible) + glowing back
  b.add('dark', new THREE.CylinderGeometry(R, R * 0.7, 14, 16, 1, true, -PI / 2, PI).rotateX(PI / 2).rotateZ(0).translate(0, 0, -7), { pos: at(0, 0.4), rot: [0, yaw, 0], color: '#040508', flip: true });
  b.add('dark', new THREE.CircleGeometry(R + 0.4, 20, 0, PI), { pos: at(0, -0.9), rot: [0, yaw, 0], color: '#060708' });
  b.add('dark', new THREE.CircleGeometry(R + 0.3, 24, 0, PI), { pos: at(0, 0.6, -0.4), rot: [0, yaw, 0], color: '#050607' }); b.add('dark', new THREE.CircleGeometry(R - 0.5, 24, 0, PI), { pos: at(0, 1.7, -0.3), rot: [0, yaw, 0], color: '#040506' }); // deep-shadow mouth face: hides the lit inner arch so the opening reads as a dark cave
  b.add('glow', new THREE.PlaneGeometry(2 * R - 3, 0.7).translate(0, 0.35, 0), { pos: at(0, -0.8, 0.02), rot: [0, yaw, 0], color: C.cyan, intensity: 1.6 }); // faint cyan floor glow deep inside
  b.add('dark', new THREE.PlaneGeometry(2 * R + 0.2, 0.4).rotateX(-PI / 2), { pos: at(0, -4, 0.05), rot: [0, yaw, 0], color: '#2a3442' });
  for (let k = 0; k < 5; k++) { const a = (k + 0.5) / 5 * PI; b.add('glow', G.octa(0.22), { pos: at(Math.cos(a) * (R - 0.9), -0.6, Math.sin(a) * (R - 0.9)), rot: [0, yaw, 0], color: C.cyan, intensity: 2.5 }); }
  // pad + 4 beam pylons in front
  b.add('dark', G.cyl(7.5, 8.2, 0.6, 32), { pos: [P0.x, y0 - 0.35, P0.z], color: '#2c3644' });
  b.add('ivory', G.cyl(7.0, 7.4, 0.4, 32), { pos: [P0.x, y0 + 0.1, P0.z], color: C.ivory2 });
  b.add('gold', G.torus(7.1, 0.12, 3, 32), { pos: [P0.x, y0 + 0.5, P0.z], rot: [PI / 2, 0, 0], color: C.gold });
  b.add('glow', G.ring(4.6, 5.0, 36), { pos: [P0.x, y0 + 0.52, P0.z], color: C.mint, intensity: 2.4 });
  // three beam pylons (concept: central larger ringed pad flanked by two smaller ones)
  for (let k = 0; k < 3; k++) {
    const lat = (k - 1) * 3.0 + 2.4, fwd = k === 1 ? 1.6 : 3.8; const [px, , pz] = at(lat, fwd); const py = groundAt(px, pz); const big = k === 1 ? 1.5 : 1;
    b.add('dark', G.cyl(1.25 * big, 1.45 * big, 0.5, 20), { pos: [px, py, pz], color: '#3a4250' });
    b.add('ivory', G.cyl(0.9 * big, 1.1 * big, 0.6, 20), { pos: [px, py + 0.4, pz], color: C.ivory });
    b.add('gold', G.torus(0.95 * big, 0.08, 3, 20), { pos: [px, py + 1.0, pz], rot: [PI / 2, 0, 0], color: C.gold });
    if (big > 1) { b.add('ivory', G.torus(1.6, 0.18, 4, 24), { pos: [px, py + 1.5, pz], rot: [PI / 2, 0, 0], color: C.ivory2 }); for (let q = 0; q < 4; q++) { const aa = q * PI / 2; b.add('ivory', G.box(0.2, 1.2, 0.2), { pos: [px + Math.sin(aa) * 1.6, py + 0.9, pz + Math.cos(aa) * 1.6], color: C.ivory2 }); } }
    b.add('glow', G.disc(0.7 * big, 16), { pos: [px, py + 1.02, pz], color: C.cyan, intensity: 4 });
    beams.push({ x: px, y: py + 1.0, z: pz, r: 0.36 * big, h: 15 + (k === 1 ? 4 : 0), color: '#53e0d0', I: 1.9 });
  }
  return { x: mx, y, z: mz, yaw };
}

export const LAMPS = [];
function lamp(b, x, z, color = C.win) { const y = groundAt(x, z); LAMPS.push({ x, z });
  b.add('gold', G.cyl(0.16, 0.2, 0.18, 6), { pos: [x, y - 0.02, z], color: C.goldD }); b.add('ivory', G.cyl(0.06, 0.085, 1.15, 6), { pos: [x, y + 0.14, z], color: C.ivory });
  if (GQ.s === 1) b.add('gold', G.torus(0.08, 0.025, 3, 6), { pos: [x, y + 0.75, z], rot: [PI / 2, 0, 0], color: C.gold }); b.add('gold', G.cyl(0.13, 0.07, 0.12, 6), { pos: [x, y + 1.27, z], color: C.gold });
  b.add('glow', G.octa(0.13), { pos: [x, y + 1.5, z], color, intensity: 4 }); if (GQ.s === 1) b.add('gold', G.cone(0.1, 0.16, 6), { pos: [x, y + 1.62, z], color: C.gold2 }); }
function crate(b, x, z, s = 1, yaw = 0) { const y = groundAt(x, z); b.add('ivory', G.box(1.2 * s, 0.9 * s, 0.9 * s), { pos: [x, y + 0.45 * s, z], rot: [0, yaw, 0], color: C.ivory2 }); b.add('gold', G.box(1.25 * s, 0.12 * s, 0.95 * s), { pos: [x, y + 0.65 * s, z], rot: [0, yaw, 0], color: C.gold }); colliders.push({ x, z, r: 0.8 * s }); }
// small auxiliary pod (storage / airlock hut): squat ivory drum + low cap, gold band, one lit hatch (concept: little modules scattered around the base)
function pod(b, x, z, r = 1.6, yaw = 0) { const y = groundAt(x, z) - 0.1; colliders.push({ x, z, r: r + 0.4 });
  b.add('ivory', G.cyl(r, r * 1.04, r * 0.7, 10, true), { pos: [x, y, z], color: C.ivory2 }); b.add('ivory', G.cap(r, 10, 3), { pos: [x, y + r * 0.7, z], scale: [1, 0.55, 1], color: C.ivory });
  b.add('gold', G.torus(r * 1.02, 0.07, 3, 10), { pos: [x, y + r * 0.7, z], rot: [PI / 2, 0, 0], color: C.gold });
  const hx = x + Math.sin(yaw) * r * 1.0, hz = z + Math.cos(yaw) * r * 1.0; b.add('glow', G.box(0.55, 0.75, 0.08), { pos: [hx, y + 0.5, hz], rot: [0, yaw, 0], color: C.winHot, intensity: 2.2 });
  b.add('gold', G.cyl(0.05, 0.05, 0.6, 4), { pos: [x, y + r * 1.25, z], color: C.gold2 }); }
function solar(b, x, z, yaw) { const y = groundAt(x, z); b.add('dark', G.cyl(0.1, 0.12, 1.4, 5), { pos: [x, y, z], color: '#555c66' }); b.add('dark', G.box(3.2, 0.08, 1.8), { pos: [x, y + 1.5, z], rot: [-0.5, yaw, 0], color: '#1b3c5a' }); b.add('gold', G.box(3.35, 0.05, 0.08), { pos: [x, y + 1.5, z], rot: [-0.5, yaw, 0], color: C.gold }); }

// rover tread marks from the lookout down to the base (as in the concept foreground)
function tracks(b) {
  const pts = []; for (let i = 0; i <= 40; i++) { const t = i / 40; pts.push(sd(3.5 + Math.sin(t * 2.6) * 4 - t * 2, -54 + t * 44)); }
  for (const off of [-0.85, 0.85]) for (let i = 0; i < pts.length - 1; i++) {
    const A = pts[i], B = pts[i + 1]; const dx = B.x - A.x, dz = B.z - A.z, l = Math.hypot(dx, dz); const nx = -dz / l, nz = dx / l; const yaw = Math.atan2(dx, dz);
    for (let k = 0; k < 3; k++) { const t = k / 3; const px = A.x + dx * t + nx * off, pz = A.z + dz * t + nz * off; b.add('dark', new THREE.PlaneGeometry(0.42, 0.22).rotateX(-PI / 2), { pos: [px, groundAt(px, pz) + 0.04, pz], rot: [0, yaw, 0], color: '#4b4c52' }); }
  }
}
export function buildHub(b, beams) {
  const R = reactor(b, 0, 0);
  beams.push({ x: R.x, y: R.y + 0.2, z: R.z, r: R.Ri * 0.92, h: 5.0, color: "#ff7a1e", I: 0.55, taper: 1.2 }); // warm glow halo rising out of the molten pit (additive, merged into the beam draw)
  beams.push({ x: R.x, y: R.y + 0.2, z: R.z, r: R.Ri * 0.5, h: 3.0, color: "#ffa04a", I: 0.5, taper: 1.3 });
  const L = dome(b, -22, 3, 5.0);
  const Bk = dome(b, -3.5, 25, 5.6, { spireH: 4.5 });
  const sm = dome(b, -9, 16.5, 2.8, { spire: false });
  const Rd = dome(b, 19.5, 9, 4.6);
  const Fd = dome(b, 10.5, -6.5, 3.8);
  const Bd = dome(b, 25, 24, 3.2);
  dishModule(b, -14, 12);
  launchPad(b, 12, 33);
  beaconPad(b, 10.5, -25.5, beams, 17);
  const cave = portalCave(b, beams);
  // corridors (auto-trimmed to module radii)
  const P = (s, d) => sd(s, d);
  const M = { ring: [0, 0, 8.5], L: [-22, 3, 5], Bk: [-3.5, 25, 5.6], sm: [-9, 16.5, 2.8], Rd: [19.5, 9, 4.6], Fd: [10.5, -6.5, 3.8], Bd: [25, 24, 3.2], dish: [-14, 12, 4.3] };
  const link = (a, c, r = 1.3) => { const A = M[a], B = M[c]; const ds = B[0] - A[0], dd = B[1] - A[1]; const l = Math.hypot(ds, dd); const ux = ds / l, uy = dd / l; corridor(b, P(A[0] + ux * (A[2] - 0.3), A[1] + uy * (A[2] - 0.3)), P(B[0] - ux * (B[2] - 0.3), B[1] - uy * (B[2] - 0.3)), r); };
  link('ring', 'L', 1.4); link('ring', 'Fd', 1.2); link('ring', 'Rd', 1.3); link('ring', 'dish', 1.3); link('dish', 'sm', 1.05); link('sm', 'Bk', 1.05); link('Rd', 'Bd', 1.1); link('dish', 'L', 1.15); link('ring', 'Bk', 1.2);
  // props
  const rnd = (() => { let a = 7; return () => (a = (a * 16807) % 2147483647) / 2147483647; })();
  for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2; const p = { x: Math.cos(a) * 38, z: Math.sin(a) * 38 }; lamp(b, p.x, p.z, i % 2 ? C.win : C.gold2); }
  for (let i = 0; i < 10; i++) { const p = P(-26 + rnd() * 10, 10 + rnd() * 8); crate(b, p.x, p.z, 0.8 + rnd() * 0.5, rnd() * 3); }
  for (let i = 0; i < 6; i++) { const p = P(14 + rnd() * 6, -12 - rnd() * 8); crate(b, p.x, p.z, 0.7 + rnd() * 0.4, rnd() * 3); }
  for (let i = 0; i < 8; i++) { const p = P(-30 + (i % 4) * 3.8, 22 + Math.floor(i / 4) * 3); solar(b, p.x, p.z, faceCam + PI); }
  // gameplay start area: landing pad, crates, lamps, a signpost so the behind-the-cat view is rich
  { const lp = P(-9.5, -16); const ly = groundAt(lp.x, lp.z); const S = 0.66; colliders.push({ x: lp.x, z: lp.z, r: 2.6 * S, walk: true }); // compact, flush landing pad (walk: the cat stands on it via the solid map; still keeps rocks off)
    b.add('dark', G.cyl(2.5 * S, 2.7 * S, 0.24, 16), { pos: [lp.x, ly - 0.14, lp.z], color: '#555b64' });
    b.add('gold', G.torus(2.36 * S, 0.045, 3, 24), { pos: [lp.x, ly + 0.11, lp.z], rot: [PI / 2, 0, 0], color: C.gold });
    b.add('ivory', G.ring(1.45 * S, 1.6 * S, 24), { pos: [lp.x, ly + 0.115, lp.z], color: C.ivory2 });
    for (const [w, d, ox] of [[0.16, 1.0, -0.36], [0.16, 1.0, 0.36], [0.56, 0.16, 0]]) b.add('ivory', G.box(w, 0.02, d), { pos: [lp.x + Math.cos(faceCam) * ox, ly + 0.115, lp.z - Math.sin(faceCam) * ox], rot: [0, faceCam, 0], color: C.ivory2 });
    for (let k = 0; k < 6; k++) { const a = k / 6 * PI * 2 + PI / 6; b.add('glow', G.box(0.1, 0.06, 0.1), { pos: [lp.x + Math.sin(a) * 2.45 * S, ly + 0.12, lp.z + Math.cos(a) * 2.45 * S], color: C.gold2, intensity: 3 }); } }
  for (const [s, d, sc, yw] of [[4, -18, 0.9, 0.3], [5.3, -17.2, 0.7, 1.1], [4.6, -16.4, 0.6, 2], [-15, -9, 0.9, 0.4], [-14, -7.8, 0.7, 1.3]]) { const p = P(s, d); crate(b, p.x, p.z, sc, yw); }
  for (const [s, d] of [[-1, -14], [3, -10.5], [-6.5, -11], [7, -13.5], [-5.5, -17.5], [2, -18], [-8, -33], [6, -36]]) { const p = P(s, d); lamp(b, p.x, p.z, C.gold2); }
  { const p = P(5.5, -14.5); const y = groundAt(p.x, p.z); b.add('dark', G.cyl(0.07, 0.09, 2.2, 6), { pos: [p.x, y, p.z], color: '#59616d' });
    b.add('tex', new THREE.BoxGeometry(1.4, 0.7, 0.06), { region: 'panel', pos: [p.x, y + 2.0, p.z], rot: [0, faceCam, 0], color: '#ffffff' }); b.add('gold', G.box(1.5, 0.08, 0.08), { pos: [p.x, y + 2.38, p.z], rot: [0, faceCam, 0], color: C.gold }); }
  // extra small props: solar arrays, mast antennas, path lamps
  for (const [s0, d0, n, yw] of [[30, -6, 4, 0.4], [-28, -8, 3, -0.3], [8, 44, 4, 0.1]]) for (let i = 0; i < n; i++) { const p = P(s0 + i * 3.6 * Math.cos(yw), d0 + i * 3.6 * Math.sin(yw)); solar(b, p.x, p.z, faceCam + PI + yw); }
  for (const [s0, d0, h] of [[-17, -2, 4.5], [27, 14, 3.5], [3, 12, 5], [-12, 26, 4], [17, 30, 4.5], [33, 22, 3]]) { const p = P(s0, d0); const y = groundAt(p.x, p.z); b.add('dark', G.cyl(0.35, 0.45, 0.3, 8), { pos: [p.x, y, p.z], color: '#4a5260' }); antenna(b, p.x, y + 0.3, p.z, h); }
  for (const [s0, d0] of [[-18, -18], [14, -24], [26, -16], [-24, 22], [30, 30], [-6, 38], [20, 40], [-30, -2]]) { const p = P(s0, d0); lamp(b, p.x, p.z, C.gold2); }
  // pass 15: a few small auxiliary pods + crate stacks around the periphery so the base reads more spread out (merged: 0 extra draw calls)
  for (const [s0, d0, r, yw] of [[-31.5, 8, 1.7, -0.6], [-33, -3, 1.35, 0.2], [26.5, -1.5, 1.5, -0.3], [33, 16, 1.6, -1.2], [-21, 31, 1.4, 2.6]]) { const p = P(s0, d0); pod(b, p.x, p.z, r, faceCam + yw); }
  for (const [s0, d0, sc, yw] of [[-29, 11.5, 0.75, 0.4], [-28.2, 12.6, 0.6, 1.2], [-35.5, -0.5, 0.7, 2.1], [29.5, 0.5, 0.7, 0.6], [30.2, 1.7, 0.55, 1.9], [35.5, 13, 0.8, 0.2]]) { const p = P(s0, d0); crate(b, p.x, p.z, sc, yw); }
  return { reactor: R, cave };
}
