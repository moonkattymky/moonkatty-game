import * as THREE from 'three';
import { fbm, ridged, noise2, smoothstep, lerp, clamp } from './noise.js';
import { toCreasedNormals } from '../vendor/three/jsm/utils/BufferGeometryUtils.js';

// World layout (meters). Hub "Base Alpha" centered at origin, ~180 m across.
export const REGIONS = {
  canyon:  { x: -540, z: 60,   name: 'Landing Canyon' },
  reactor: { x: 440,  z: 400,  name: 'Reactor Crater' },
  launch:  { x: 430,  z: -430, name: 'Launch Complex' },
  echo:    { x: -60,  z: -660, name: 'Echo Relay Field' },
};
// Concept-camera frame: forward F (from lookout toward base), right Rt. sd(s,d) -> world xz
export const F = { x: 0.592, z: -0.806 }, Rt = { x: 0.806, z: 0.592 };
export function sd(s, d) { return { x: s * Rt.x + d * F.x, z: s * Rt.z + d * F.z }; }
export const LOOKOUT = { ...sd(-2, -54), r: 19, h: 10 };
// The concept-art camera: cat on the lip of a ridge, base below at ~60 m
export const CONCEPT = { cat: sd(-2.53, -51.23), cam: sd(-0.59, -54.45), target: sd(-5.5, 0), eye: 1.1, drop: 3.5, fov: 47, catYaw: -0.15 };
// walkable rock ledge under the concept cat (the rock mesh itself lives in props.js); raises groundAt so the cat really stands on it
const _lc = sd(-3.0, -51.85); export const LEDGE = { x: _lc.x, z: _lc.z, h: 1.0, r0: 1.4, r1: 1.85 };
export function ledgeAt(x, z) { const d = Math.hypot(x - LEDGE.x, z - LEDGE.z); if (d >= LEDGE.r1) return 0; const t = Math.min(1, Math.max(0, (d - LEDGE.r0) / (LEDGE.r1 - LEDGE.r0))); return LEDGE.h * (1 - t * t * (3 - 2 * t)); }
const LIP = sd(-2, -56);
export const PLAY_START = sd(-3, -21);
export const PORTAL = sd(34, 36);
const PORTAL_WALL = sd(50, 57), LEFT_HILL = sd(-40, -19);
export const CAVE = { ...sd(43.5, 47), yawOff: 0.35 };
const CANYON_A = { x: -400, z: -300 }, CANYON_B = { x: -660, z: 380 };
// pass 21: winding canyon - meandering centreline along A->B, terraced layered walls (shared with world.js props)
const CAN_L = Math.hypot(CANYON_B.x - CANYON_A.x, CANYON_B.z - CANYON_A.z), CAN_U = { x: (CANYON_B.x - CANYON_A.x) / CAN_L, z: (CANYON_B.z - CANYON_A.z) / CAN_L };
export function canyonMeander(s) { return 18 * Math.sin(s * 0.0105 + 0.6) + 7 * Math.sin(s * 0.029 + 2.1); }
export function canyonPoint(s, off = 0) { const m = canyonMeander(s) + off; return { x: CANYON_A.x + CAN_U.x * s - CAN_U.z * m, z: CANYON_A.z + CAN_U.z * s + CAN_U.x * m }; }
export function canyonS(x, z) { return (x - CANYON_A.x) * CAN_U.x + (z - CANYON_A.z) * CAN_U.z; }
// pass 22: crisp terraced profile - 5 tiers of steep risers (fr 0.3-0.7) with flat lit ledges between
export function canyonInfo(x, z) { const px = x - CANYON_A.x, pz = z - CANYON_A.z; const cs = px * CAN_U.x + pz * CAN_U.z, cv = -px * CAN_U.z + pz * CAN_U.x; const sc = clamp(cs, 0, CAN_L);
  const d = Math.hypot(cv - canyonMeander(sc), Math.max(0, -cs, cs - CAN_L)); const fl = 16 + 5 * noise2(sc * 0.02, 3.3), ww = 30 + 9 * noise2(sc * 0.015, 9.1) + 4 * noise2(x * 0.05, z * 0.05);
  const u = clamp((d - fl) / ww, 0, 1); const k = u * 5, kf = Math.floor(Math.min(k, 4.999)), fr = k - kf; const st = Math.min(1, (kf + smoothstep(0.3, 0.7, fr)) / 5); return { d, fl, ww, u, kf, fr, st }; }
export const CANYON = { A: CANYON_A, B: CANYON_B, L: CAN_L, U: CAN_U };
const LAUNCH_CRATERS = [[20, 88, 12], [52, 72, 6], [248, 70, 8], [300, 98, 13], [338, 66, 5], [35, 112, 5], [283, 58, 3.5], [8, 130, 9], [95, 120, 7], [230, 120, 10], [318, 128, 6], [62, 98, 3]]; // [deg, r, R] around the launch pad, clear of the structures
const SMALL_CRATERS = [
  [-58, -8, 9], [30, 40, 7], [-34.0, 20.9, 4.5], [-37.7, 10.8, 3.2], [-32.7, 29.3, 2.6], [-20, 62, 6], [60, 18, 8], [-70, 40, 10], [8, -66, 7], [70, -60, 11], [-40, -60, 9], [95,70,14], [-110,-20,16]
];

function segDist(px, pz, a, b) {
  const vx = b.x - a.x, vz = b.z - a.z; const t = clamp(((px - a.x) * vx + (pz - a.z) * vz) / (vx * vx + vz * vz), 0, 1);
  return Math.hypot(px - (a.x + vx * t), pz - (a.z + vz * t));
}
function crater(d, R, depth, rimH) {
  const t = d / R; let h = 0;
  if (t < 1) h -= depth * (1 - t * t);
  h += rimH * Math.exp(-(((t - 1) / 0.28) ** 2));
  return h;
}
function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d); }
const PASS_ANG = Object.values(REGIONS).map(r => Math.atan2(r.z, r.x));
const EARTH_ANG = Math.atan2(-0.806, 0.592) + 0.33;

export function heightAt(x, z) {
  const r = Math.hypot(x, z);
  const hub = 1 - smoothstep(48, 100, r);
  const large = fbm(x * 0.0028 + 3.1, z * 0.0028 - 1.7, 4) * 18;
  const medium = fbm(x * 0.022, z * 0.022, 3) * 2.6;
  const small = fbm(x * 0.11 + 9, z * 0.11, 2) * 0.45;
  const flat = 1 - smoothstep(30, 46, r); // building pad
  let h = (large + medium) * (1 - hub * 0.95) + small * (1 - flat * 0.7);
  // rim mountains around the hub basin, with passes toward the chapter regions
  const ang = Math.atan2(z, x);
  let pass = 1; for (const a of PASS_ANG) pass *= 1 - 0.8 * Math.exp(-(((angDiff(ang, a)) / 0.2) ** 2));
  pass *= 1 - 0.55 * Math.exp(-(((angDiff(ang, EARTH_ANG)) / 0.3) ** 2)); // lower ridge under the Earth in the concept view
  const rIn = 118 + 26 * noise2(Math.cos(ang) * 1.3, Math.sin(ang) * 1.3);
  const ring = smoothstep(rIn, rIn + 50, r) * (1 - smoothstep(230, 360, r));
  const rid = ridged(x * 0.011, z * 0.011, 4);
  const mass = 0.5 + 0.5 * fbm(x * 0.007 + 11, z * 0.007 - 4, 3);
  const jag = ridged(x * 0.03 + 5, z * 0.03, 3);
  h += ring * pass * (4 + mass * 15 + rid * rid * 13 + jag * jag * 9 + fbm(x * 0.05, z * 0.05, 2) * 3);
  // rocky outcrops / chunky ground around the hub (kept off the building pad)
  { const oc = Math.max(0, ridged(x * 0.075 + 3, z * 0.075 - 7, 2) - 0.62) * 5.5; const cs = x * Rt.x + z * Rt.z, cd = x * F.x + z * F.z; const corridor = (1 - smoothstep(18, 28, Math.abs(cs - 8))) * smoothstep(-62, -55, cd) * (1 - smoothstep(-6, 0, cd)); h += oc * smoothstep(40, 58, r) * (1 - smoothstep(220, 300, r)) * (1 - corridor); h += (ridged(x * 0.35, z * 0.35, 2) - 0.5) * 0.35 * smoothstep(34, 50, r); }
  // lookout ledge (where the concept camera / cat stands)
  const dl = Math.hypot(x - LOOKOUT.x, z - LOOKOUT.z);
  { const ux = x - LIP.x, uz = z - LIP.z; const u = ux * F.x + uz * F.z, v = ux * Rt.x + uz * Rt.z;
    let f = u > 0 ? clamp(1 - u / 37, 0, 1) : 1; f = f * f * (1.6 - 0.6 * f) ; // gentle convex ramp toward the base
    f *= 1 - smoothstep(12, 30, -u); f *= 1 - smoothstep(12 + Math.max(0, -v) * 0.0, 34, Math.abs(v) * (v < 0 ? 0.7 : 1));
    h += LOOKOUT.h * f * (1 + 0.12 * noise2(x * 0.25, z * 0.25)) + f * fbm(x * 0.35, z * 0.35, 2) * 0.5; }
  // concept mid-ground left of the track (between the cat's lookout and the base): broken, stepped, uneven ground instead of a flat plane
  { const cs = x * Rt.x + z * Rt.z, cd = x * F.x + z * F.z;
    const m = smoothstep(-34, -24, cs) * (1 - smoothstep(-6, -1.5, cs)) * smoothstep(-50, -44, cd) * (1 - smoothstep(-24, -18, cd)) * smoothstep(29, 34, r) * smoothstep(4.5, 8, Math.hypot(cs + 9.5, cd + 16)) * smoothstep(4, 7.5, Math.hypot(cs + 3, cd + 21));
    if (m > 0) { const u = fbm(x * 0.07 + 2.3, z * 0.07 - 5.1, 3) * 2.6 + ridged(x * 0.13, z * 0.13, 2) * 1.4; const st = 0.85; const k = Math.floor(u / st), fr = u / st - k;
      const terr = (k + smoothstep(0.55, 0.95, fr)) * st; // terraces with short steep risers -> low ledges
      h += m * (terr * 0.9 + 0.5); } }
  // portal crater wall (cyan gate) behind the base on the right
  const dp = Math.hypot(x - PORTAL_WALL.x, z - PORTAL_WALL.z);
  h += 15 * (1 - smoothstep(7, 21, dp)) * (0.82 + 0.36 * rid) + 6 * (1 - smoothstep(14, 34, dp));
  const dpp = Math.hypot(x - PORTAL.x, z - PORTAL.z); h = lerp(h, 0.3 + small, 1 - smoothstep(8, 12.5, dpp));
  const dh = Math.hypot(x - LEFT_HILL.x, z - LEFT_HILL.z);
  h += 20 * (1 - smoothstep(4, 19, dh)) * (0.7 + 0.6 * rid);
  // small craters in the hub
  for (const [cx, cz, cr] of SMALL_CRATERS) { const d = Math.hypot(x - cx, z - cz); if (d < cr * 2) h += crater(d, cr, cr * 0.22, cr * 0.12); }
  // landing canyon
  { const ci = canyonInfo(x, z); if (ci.d < 140) { const st = ci.st; h -= (large * 0.6 + medium * 0.85) * (1 - hub * 0.95) * (1 - smoothstep(0.0, 0.5, st)); /* flatter canyon floor */ h += 6 * Math.exp(-(((ci.d - ci.fl - ci.ww - 12) / 13) ** 2)); h -= 58 * (1 - st) * (0.88 + 0.24 * rid); } }
  // reactor crater
  { const R = REGIONS.reactor; const d = Math.hypot(x - R.x, z - R.z); if (d < 220) { h = lerp(h, h * 0.3, 1 - smoothstep(70, 200, d)); if (d < 82) { const u = clamp((d - 34) / 48, 0, 1); const k = u * 3, st = (Math.floor(k) + smoothstep(0.55, 1, k - Math.floor(k))) / 3; const a = Math.atan2(z - R.z, x - R.x); h += -30 * (1 - lerp(u, Math.min(st, 1), 0.75)) + (d < 36 ? 0.5 * noise2(x * 0.08, z * 0.08) : (1.6 * ridged(x * 0.05 + 2, z * 0.05, 2) + 1.2 * noise2(a * 6, d * 0.05)) * smoothstep(34, 40, d)); } h += 18 * Math.exp(-(((d / 82 - 1) / 0.28) ** 2)); } } /* pass 19: flat reactor floor, three terraced benches, jagged slopes */
  // launch complex pad
  { const L = REGIONS.launch; const d = Math.hypot(x - L.x, z - L.z); if (d < 700) { const pad = 1 - smoothstep(26, 95, d); /* pass 21: rolling plain, varied craters, outcrops, ridge ring */
    const und = fbm(x * 0.016 + 4.2, z * 0.016 - 2.7, 3) * 3.2 + fbm(x * 0.045, z * 0.045, 2) * 0.9; let lh = 3 + small + und * (1 - pad);
    for (const [ad, rr, R] of LAUNCH_CRATERS) { const cx = L.x + Math.cos(ad * Math.PI / 180) * rr, cz = L.z + Math.sin(ad * Math.PI / 180) * rr; const dd = Math.hypot(x - cx, z - cz); if (dd < R * 2) lh += crater(dd, R, R * 0.2, R * 0.1); }
    const oc = Math.max(0, ridged(x * 0.05 + 7, z * 0.05 - 3, 2) - 0.66) * 14 * smoothstep(85, 110, d) * (1 - smoothstep(150, 175, d)) * smoothstep(0.25, 0.6, noise2(x * 0.01 + 3, z * 0.01) * 0.5 + 0.5); lh += oc;
    { const rx = x - (L.x - 52.33), rz = z - (L.z + 52.33); const al = (rx + rz) * 0.70711, pe = (rz - rx) * 0.70711; /* pass 25: graded runway bed (flat, so the paved strip reads clean) */
      const m = (1 - smoothstep(9, 17, Math.abs(pe))) * (1 - smoothstep(80, 94, Math.abs(al))); if (m > 0) lh = lerp(lh, 3.0, m); }
    h = lerp(h, lh, 1 - smoothstep(130, 175, d));
    h += smoothstep(190, 300, d) * (1 - smoothstep(480, 640, d)) * (6 + mass * 22 + rid * rid * 18 + jag * jag * 8) * smoothstep(380, 520, r); } }
  // echo plateau
  { const E = REGIONS.echo; const d = Math.hypot(x - E.x, z - E.z); h = lerp(h, 22 + small, 1 - smoothstep(60, 110, d)); }
  // world boundary mountains
  h += smoothstep(900, 1300, r) * (25 + mass * 55 + rid * 25 + jag * 30);
  return h;
}

// Terrain mesh: polar rings around the hub. NEAR disc (r < ~260 m, 128 segments, ~2.5-3 m facets near the base)
// split into 6 angular sectors + FAR ring (64 segments) split into 4 quadrants, so the GPU only draws what is in view.
export const GRID = { Mn: 128, Mf: 64, inner: 20, step: 2.5, grow: 1.05, R1: 260, growFar: 1.1, maxR: 1450, si: 6, sn: 8, sf: 4 }; // si/sn/sf: angular sector counts per band (fewer = fewer draw calls; phones use fewer)
let H = null, PX = null, PZ = null, TRI = null, BUCKET = null;
const AB = 256;
const rbOf = r => r < 20 ? Math.floor(r / 2.5) : 8 + Math.floor(Math.log(r / 20) / Math.log(1.05));
function buildTopology() {
  const rings = []; // {r, M, stagger}
  rings.push({ r: 0, M: 1 });
  let r = GRID.step; while (r <= GRID.inner) { rings.push({ r, M: GRID.Mn }); r += GRID.step; }
  r = rings[rings.length - 1].r; while (r < GRID.R1) { r *= GRID.grow; rings.push({ r, M: GRID.Mn }); }
  while (r < GRID.maxR) { r *= GRID.growFar; rings.push({ r, M: GRID.Mf }); }
  let off = 0; rings.forEach((g, k) => { g.off = off; off += g.M; g.st = (k % 2) * 0.5; });
  const NV = off; const px = new Float32Array(NV), pz = new Float32Array(NV);
  rings.forEach(g => { for (let j = 0; j < g.M; j++) { const th = (j + (g.M > 1 ? g.st : 0)) / g.M * Math.PI * 2; px[g.off + j] = Math.cos(th) * g.r; pz[g.off + j] = Math.sin(th) * g.r; } });
  const tris = []; const id = (g, j) => g.off + ((j % g.M) + g.M) % g.M;
  for (let k = 0; k < rings.length - 1; k++) {
    const A = rings[k], B = rings[k + 1];
    if (A.M === 1) { for (let j = 0; j < B.M; j++) tris.push(A.off, id(B, j), id(B, j + 1)); continue; }
    if (A.M === B.M) { for (let j = 0; j < A.M; j++) { const a = id(A, j), b = id(A, j + 1), c = id(B, j), d = id(B, j + 1); tris.push(a, c, b, b, c, d); } continue; }
    // stitch 2:1 (inner A has 2x the segments of outer B)
    for (let j = 0; j < B.M; j++) { const i0 = id(A, 2 * j), i1 = id(A, 2 * j + 1), i2 = id(A, 2 * j + 2), o0 = id(B, j), o1 = id(B, j + 1); tris.push(i0, o0, i1, i1, o0, o1, i1, o1, i2); }
  }
  // enforce CCW (upward) winding in xz
  for (let t = 0; t < tris.length; t += 3) { const a = tris[t], b = tris[t + 1], c = tris[t + 2]; const cr = (px[b] - px[a]) * (pz[c] - pz[a]) - (pz[b] - pz[a]) * (px[c] - px[a]); if (cr > 0) { tris[t + 1] = c; tris[t + 2] = b; } }
  return { NV, px, pz, tris: new Uint32Array(tris), rings };
}
function buildBuckets() {
  BUCKET = new Map(); const T = TRI;
  const put = (key, t) => { let l = BUCKET.get(key); if (!l) BUCKET.set(key, l = []); l.push(t); };
  for (let t = 0; t < T.length; t += 3) {
    let rmin = 1e9, rmax = 0, center = false; const th = [];
    for (let k = 0; k < 3; k++) { const v = T[t + k]; const r = Math.hypot(PX[v], PZ[v]); rmin = Math.min(rmin, r); rmax = Math.max(rmax, r); if (r < 1e-3) center = true; else { let a = Math.atan2(PZ[v], PX[v]); if (a < 0) a += Math.PI * 2; th.push(a); } }
    const r0 = rbOf(rmin), r1 = rbOf(rmax);
    let a0 = Math.min(...th), a1 = Math.max(...th); let ranges = [[a0, a1]];
    if (center) ranges = [[0, Math.PI * 2 - 1e-6]]; else if (a1 - a0 > Math.PI) { const lo = th.filter(a => a < Math.PI), hi = th.filter(a => a >= Math.PI); ranges = [[0, Math.max(...lo)], [Math.min(...hi), Math.PI * 2 - 1e-6]]; }
    for (let rb = r0; rb <= r1; rb++) for (const [x0, x1] of ranges) for (let ab = Math.floor(x0 / (Math.PI * 2) * AB); ab <= Math.floor(x1 / (Math.PI * 2) * AB); ab++) put(rb * AB + ab, t);
  }
}
export function groundAt(x, z) { return groundMesh(x, z) + ledgeAt(x, z); } // terrain mesh + walkable concept ledge
export const PATCH = { x: REGIONS.reactor.x, z: REGIONS.reactor.z, r: 150, cut: 143, on: { value: 1 } };
export const PATCH2 = { x: REGIONS.launch.x, z: REGIONS.launch.z, r: 165, cut: 158, on: { value: 1 } }; // pass 20: launch complex patch (smooth blend into the hills)
const _cs3 = canyonS(REGIONS.canyon.x, REGIONS.canyon.z), _c3 = canyonPoint(_cs3, 0);
export const PATCH3 = { x: _c3.x, z: _c3.z, rect: { ux: CAN_U.x, uz: CAN_U.z, hl: 200, hw: 92 }, cut: 6, on: { value: 1 } }; // pass 21: canyon strip patch (aligned with the canyon)
export const PATCHES = [PATCH, PATCH2, PATCH3];
function inPatch(P, x, z) { if (!P.rect) return Math.hypot(x - P.x, z - P.z) < P.cut; const dx = x - P.x, dz = z - P.z; const R = P.rect; return Math.abs(dx * R.ux + dz * R.uz) < R.hl - P.cut && Math.abs(-dx * R.uz + dz * R.ux) < R.hw - P.cut; } // high-res terrain patch for the reactor crater (base terrain is discarded inside `cut`)
export function groundMesh(x, z) { // exact height of the rendered terrain mesh
  for (const P of PATCHES) if (inPatch(P, x, z)) return P === PATCH3 && RP ? rectPatchHeight(x, z) : heightAt(x, z); // patch is dense enough to follow heightAt
  const r = Math.hypot(x, z); if (!BUCKET || r >= GRID.maxR * 0.98) return heightAt(x, z);
  let a = Math.atan2(z, x); if (a < 0) a += Math.PI * 2;
  const list = BUCKET.get(rbOf(r) * AB + Math.floor(a / (Math.PI * 2) * AB) % AB); if (!list) return heightAt(x, z);
  let best = null, bestErr = 1e9;
  for (const t of list) {
    const A = TRI[t], B = TRI[t + 1], Cc = TRI[t + 2];
    const x1 = PX[A], z1 = PZ[A], x2 = PX[B], z2 = PZ[B], x3 = PX[Cc], z3 = PZ[Cc];
    const det = (z2 - z3) * (x1 - x3) + (x3 - x2) * (z1 - z3); if (Math.abs(det) < 1e-9) continue;
    const l1 = ((z2 - z3) * (x - x3) + (x3 - x2) * (z - z3)) / det, l2 = ((z3 - z1) * (x - x3) + (x1 - x3) * (z - z3)) / det, l3 = 1 - l1 - l2;
    const err = Math.max(0, -l1) + Math.max(0, -l2) + Math.max(0, -l3);
    if (err < bestErr) { bestErr = err; best = l1 * H[A] + l2 * H[B] + l3 * H[Cc]; if (err === 0) break; }
  }
  return best ?? heightAt(x, z);
}

// warm light pools under the path lamps: a small world-space light map painted in main.js (one texture fetch, no extra lights)
const TFILL = (() => { const x = Rt.x * 0.6 - F.x * 0.3, z = Rt.z * 0.6 - F.z * 0.3, y = 0.6, l = Math.hypot(x, y, z); return `vec3(${(x / l).toFixed(3)}, ${(y / l).toFixed(3)}, ${(z / l).toFixed(3)})`; })();
export const LAMPMAP = { value: null }; export const LAMPK = { value: 1 }; /* base power (game: reactor out -> lamp pools off) */ export const LAMPMAP_R = 75; export const AOMAP = { value: new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1) }; AOMAP.value.needsUpdate = true;
const SUNXZ = (() => { const x = -Rt.x * 0.75 - F.x * 0.45, z = -Rt.z * 0.75 - F.z * 0.45, l = Math.hypot(x, z); return `${(x / l).toFixed(3)}, ${(z / l).toFixed(3)}`; })(); // sun direction on the ground plane (for painted rubble highlights/shadows)
// pass 40: crisp tiling regolith detail (generated once, 512^2, mipmapped): R = albedo, G/B = world-xz normal, A = unused.
// Fine grain + ~1000 pebbles (domes with baked shading via the normal) + small craters (bowl + rim). Sampled at two scales/rotations in the
// terrain shader with distance blending, so it never repeats visibly and fades into the macro noise far away.
export const DETAIL = { value: null };
export function regolithDetail() { if (DETAIL.value) return DETAIL.value; const N = 512, Hh = new Float32Array(N * N), A = new Float32Array(N * N).fill(1);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const lat = (G) => { const g = new Float32Array(G * G); for (let i = 0; i < G * G; i++) g[i] = rnd(); return (x, y) => { const fx = x / N * G, fy = y / N * G, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy; const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty); const v = (i, j) => g[((j % G + G) % G) * G + ((i % G + G) % G)]; return (v(ix, iy) * (1 - sx) + v(ix + 1, iy) * sx) * (1 - sy) + (v(ix, iy + 1) * (1 - sx) + v(ix + 1, iy + 1) * sx) * sy; }; };
  const o = [[lat(8), 0.5], [lat(24), 0.3], [lat(64), 0.15], [lat(160), 0.1]];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let h = 0; for (const [f, w] of o) h += f(x, y) * w; Hh[y * N + x] = h * 0.6; A[y * N + x] = 0.82 + 0.3 * (o[0][0](x, y) - 0.5) + 0.25 * (o[2][0](x, y) - 0.5) + 0.2 * (rnd() - 0.5); }
  const stamp = (cx, cy, r, fn) => { const R = Math.ceil(r * 1.6); for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) { const d = Math.hypot(dx, dy) / r; if (d > 1.6) continue; const i = (((cy + dy) % N + N) % N) * N + (((cx + dx) % N + N) % N); fn(i, d); } };
  for (let k = 0; k < 26; k++) { const r = 7 + rnd() * rnd() * 30, cx = Math.floor(rnd() * N), cy = Math.floor(rnd() * N); stamp(cx, cy, r, (i, d) => { const bowl = d < 1 ? -(1 - d * d) * 0.9 : 0, rim = Math.exp(-(((d - 1) / 0.22) ** 2)) * 0.35; Hh[i] += (bowl + rim) * r * 0.07; if (d < 1) A[i] *= 0.9 + 0.06 * d; else A[i] *= 1 + 0.08 * Math.exp(-(((d - 1.1) / 0.25) ** 2)); }); }
  for (let k = 0; k < 1100; k++) { const big = rnd() < 0.12, r = big ? 4 + rnd() * 5 : 1.4 + rnd() * 2.6, cx = Math.floor(rnd() * N), cy = Math.floor(rnd() * N), tone = 0.7 + rnd() * 0.55;
    stamp(cx, cy, r, (i, d) => { if (d < 1) { Hh[i] = Math.max(Hh[i], Hh[i] * 0.3 + Math.sqrt(1 - d * d) * r * 0.22); A[i] = A[i] * 0.3 + tone * 0.7; } else A[i] *= 1 - 0.18 * Math.exp(-(((d - 1.05) / 0.25) ** 2)); }); } // pebble + dark contact ring
  const d = new Uint8Array(N * N * 4); const at = (x, y) => Hh[((y + N) % N) * N + ((x + N) % N)];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const nx = (at(x - 1, y) - at(x + 1, y)) * 1.6, nz = (at(x, y - 1) - at(x, y + 1)) * 1.6; const l = Math.hypot(nx, nz, 1); const i = (y * N + x) * 4;
    d[i] = Math.max(0, Math.min(255, A[y * N + x] * 160)); d[i + 1] = (nx / l * 0.5 + 0.5) * 255; d[i + 2] = (nz / l * 0.5 + 0.5) * 255; d[i + 3] = 255; }
  const t = new THREE.DataTexture(d, N, N, THREE.RGBAFormat); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 4; t.needsUpdate = true;
  return (DETAIL.value = t); }
export function terrainMaterial(patch = false, canyon = false) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, metalness: 0, flatShading: true }); m.customProgramCacheKey = () => 'terrain' + patch + canyon; m.color.setRGB(0.82, 0.8, 0.78); /* pass 41: brighter regolith (concept) */ // regolith: slightly brighter, less warm (pass 17)
  // procedural regolith: mottled albedo, dark pits, pebble speckle and a bump-mapped normal (fades with distance)
  m.onBeforeCompile = (sh) => { sh.uniforms.uLampMap = LAMPMAP; sh.uniforms.uLampK = LAMPK; sh.uniforms.uAOMap = AOMAP; sh.uniforms.uPatchOn = PATCH.on; sh.uniforms.uPatch2On = PATCH2.on; sh.uniforms.uPatch3On = PATCH3.on; sh.uniforms.uDet = { value: regolithDetail() };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN;').replace('#include <project_vertex>', '#include <project_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vWP; varying vec3 vWN;
      float hh(vec2 p){ p = fract(p * vec2(0.1031, 0.1030)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.x); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(hh(i), hh(i + vec2(1, 0)), f.x), mix(hh(i + vec2(0, 1)), hh(i + vec2(1, 1)), f.x), f.y); }
      uniform sampler2D uDet; uniform sampler2D uLampMap; uniform float uLampK; uniform sampler2D uAOMap; uniform float uPatchOn; uniform float uPatch2On; uniform float uPatch3On;
      ${patch ? `float vor(vec2 p){ vec2 i = floor(p), f = fract(p); float m1 = 8., m2 = 8.; for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 o = vec2(x, y); vec2 r = o + vec2(hh(i + o), hh(i + o + 17.3)) - f; float dd = dot(r, r); if (dd < m1) { m2 = m1; m1 = dd; } else if (dd < m2) m2 = dd; } return sqrt(m2) - sqrt(m1); }
      /* pass 21: low-frequency soft strata + sparse wide cracks, both faded by the pixel footprint fw (world m/px) so they never alias into dashes */
      float clP(vec2 p, float fw, out float cv, out float sh){ vec2 wq = p * 0.025; p += vec2(vn(wq) - 0.5, vn(wq + 5.2) - 0.5) * 8.0;
        float yy = p.y * 0.075 + vn(vec2(p.x * 0.008, 7.0)) * 1.8 + p.x * 0.01; float b = fract(yy); float aS = 1.0 - smoothstep(1.2, 3.5, fw);
        float band = smoothstep(0.0, 0.35, b) * (1.0 - smoothstep(0.55, 1.0, b)); float tone = vn(vec2(yy * 0.9, 3.0));
        float b2 = fract(yy * 3.0 + 0.37); float band2 = smoothstep(0.0, 0.4, b2) * (1.0 - smoothstep(0.5, 1.0, b2)) * (1.0 - smoothstep(0.4, 1.2, fw));
        sh = mix(1.0, 0.76 + 0.3 * band + 0.1 * band2 + 0.3 * (tone - 0.5), aS);
        float cr = vor(vec2(p.x * 0.028, p.y * 0.011) + vec2(vn(p * 0.02), vn(p * 0.02 + 9.0)) * 0.5); float aC = 1.0 - smoothstep(0.5, 1.8, fw);
        cv = (1.0 - smoothstep(0.03, 0.12, cr)) * aC * 0.7; return (band * 0.7 + vn(p * 0.06) * 0.3) * aS - cv * 0.6; }
      float clH(vec3 w, vec3 n, float fw, out float crev, out float wt, out float shd){ float ax = n.x * n.x, az = n.z * n.z, s = ax + az + 1e-3; float c1, c2, s1, s2; float h = (clP(vec2(w.z, w.y), fw, c1, s1) * ax + clP(vec2(w.x, w.y) + 31.0, fw, c2, s2) * az) / s; wt = smoothstep(0.1, 0.4, ax + az); crev = (c1 * ax + c2 * az) / s * wt; shd = mix(1.0, (s1 * ax + s2 * az) / s, wt); return h * wt; }` : ''}
      float rg(vec2 p){ return vn(p * 0.55) * 0.45 + vn(p * 1.7) * 0.33 + vn(p * 5.3) * 0.22; }
      // small impact craters: returns (albedo factor, dh/dx, dh/dz)
      vec3 craters(vec2 p0, float cs){
        float ang = cs * 2.39; mat2 R = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)); vec2 p = R * p0 + vec2(cs * 13.1, cs * 7.7);
        float dens = smoothstep(0.2, 0.75, vn(p0 / (cs * 7.0) + cs)) * 0.85 + 0.1;
        vec2 cell = floor(p / cs); vec3 acc = vec3(1.0, 0.0, 0.0);
        for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
          vec2 c = cell + vec2(float(i), float(j)); if (hh(c + 9.7) > dens) continue;
          vec2 ctr = (c + vec2(hh(c), hh(c + 17.3))) * cs; float hr = hh(c + 5.1); float rad = cs * (0.1 + 0.5 * hr * hr * hr);
          vec2 dv = p - ctr; float dl = length(dv); float d = dl / rad; if (d > 1.7) continue;
          float e1 = exp(-2.5 * d * d), q = (d - 1.0) / 0.28, e2 = exp(-q * q); float dh = 3.0 * d * e1 - 0.25 * 2.0 * q / 0.28 * e2; vec2 g = dh * 0.32 * (dv * R) / max(dl, 1e-3);
          acc.yz += g; acc.x *= (1.0 - 0.12 * e1) * (1.0 + 0.16 * e2);
        }
        return acc; }`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
      reflectedLight.directDiffuse *= 1.45; reflectedLight.indirectDiffuse *= 0.85; /* pass 41: brighter sunlit regolith, deeper shade (concept contrast) */`)
      .replace('#include <opaque_fragment>', `{ vec3 kd = normalize((viewMatrix * vec4(${TFILL}, 0.0)).xyz); outgoingLight += diffuseColor.rgb * vec3(0.98, 0.96, 0.92) * 0.55 * max(dot(normal, kd), 0.0);
        vec2 lu = vec2(vWP.x / 150.0 + 0.5, 0.5 - vWP.z / 150.0); if (lu.x > 0.0 && lu.x < 1.0 && lu.y > 0.0 && lu.y < 1.0) outgoingLight += diffuseColor.rgb * texture2D(uLampMap, lu).rgb * 9.0 * uLampK; }
      #include <opaque_fragment>`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      ${patch ? '' : `if (uPatchOn > 0.5 && length(vWP.xz - vec2(${PATCH.x.toFixed(1)}, ${PATCH.z.toFixed(1)})) < ${PATCH.cut.toFixed(1)}) discard; if (uPatch2On > 0.5 && length(vWP.xz - vec2(${PATCH2.x.toFixed(1)}, ${PATCH2.z.toFixed(1)})) < ${PATCH2.cut.toFixed(1)}) discard; if (uPatch3On > 0.5) { vec2 d3 = vWP.xz - vec2(${PATCH3.x.toFixed(2)}, ${PATCH3.z.toFixed(2)}); vec2 u3 = vec2(${PATCH3.rect.ux.toFixed(5)}, ${PATCH3.rect.uz.toFixed(5)}); if (abs(dot(d3, u3)) < ${(PATCH3.rect.hl-PATCH3.cut).toFixed(1)} && abs(dot(d3, vec2(-u3.y, u3.x))) < ${(PATCH3.rect.hw-PATCH3.cut).toFixed(1)}) discard; } /* covered by the high-res region patches */`}
      float tDist = length(vWP - cameraPosition); float tFade = 1.0 - smoothstep(40.0, 200.0, tDist); float tNear = 1.0 - smoothstep(18.0, 85.0, tDist);
      ${patch ? '' : 'float pFlat = 1.0;'}${patch ? 'float pFW = length(fwidth(vWP)); float pFlat = smoothstep(0.55, 0.85, normalize(vWN).y); tFade *= pFlat; tNear *= pFlat; /* xz-projected regolith detail streaks on steep walls */' : ''}
      float tN = rg(vWP.xz); vec3 cr = vec3(1.0, 0.0, 0.0); if (tNear > 0.01) cr = craters(vWP.xz, 2.6); ${canyon ? 'float sY = vWP.y * 0.42 + (vn(vWP.xz * 0.035) - 0.5) * 1.4; float sF = fract(sY); float sA = 1.0 - smoothstep(0.25, 0.8, fwidth(sY)); float stp = 1.0 - smoothstep(0.75, 0.9, normalize(vWN).y); float lay = vn(vec2(floor(vWP.y / 4.6 + (vn(vWP.xz * 0.02) - 0.5) * 0.8) * 3.7, 2.0)); diffuseColor.rgb *= mix(vec3(1.0), mix(vec3(1.03, 1.01, 0.98), vec3(0.9, 0.92, 0.95), lay) * (0.92 + 0.12 * smoothstep(0.15, 0.85, sF) - 0.2 * (1.0 - smoothstep(0.0, 0.09 + fwidth(sY), sF)) * sA), stp); /* horizontal strata on the risers */ ' + 'cr.x = mix(1.0, cr.x, 0.3); cr.yz *= 0.25; /* canyon floor: small sparse pits, no sponge */' : `float kEc = 1.0 - smoothstep(120.0, 180.0, length(vWP.xz - vec2(${REGIONS.echo.x.toFixed(1)}, ${REGIONS.echo.z.toFixed(1)}))); cr.x = mix(cr.x, mix(1.0, cr.x, 0.3), kEc); cr.yz *= 1.0 - 0.75 * kEc; /* pass 23: echo field - same calm craters as the canyon floor */`} if (tDist < 28.0) { vec3 c2 = craters(vWP.xz + 31.7, 0.85); float w2 = 1.0 - smoothstep(14.0, 28.0, tDist); cr.x *= mix(1.0, c2.x, w2); cr.yz += c2.yz * 0.7 * w2; }
      { float w3 = ${canyon ? '0.0' : '(1.0 - kEc)'} * pFlat * (1.0 - smoothstep(70.0, 130.0, tDist)) * smoothstep(14.0, 24.0, tDist) * smoothstep(28.0, 36.0, length(vWP.xz)); if (w3 > 0.01) { vec3 c3 = craters(vWP.xz + 77.0, 6.5); cr.x *= mix(1.0, c3.x, w3); cr.yz += c3.yz * 1.4 * w3; } }
      { float w4 = ${canyon ? '0.35' : '(1.0 - 0.65 * kEc)'} * pFlat * (1.0 - smoothstep(60.0, 110.0, tDist)) * smoothstep(8.0, 16.0, tDist); if (w4 > 0.01) { vec3 c4 = craters(vWP.xz + 13.3, 1.7); cr.x *= mix(1.0, c4.x, w4); cr.x *= mix(1.0, c4.x * c4.x, w4); cr.yz += c4.yz * 1.7 * w4; } }
      float tMid = (1.0 - smoothstep(55.0, 140.0, tDist)) * smoothstep(6.0, 14.0, tDist)${patch ? ' * pFlat' : ''}; // mid-ground craters (2-3 m) between the ledge and the base
      { float speck = (smoothstep(0.78, 0.95, vn(vWP.xz * 13.0)) - 0.6 * smoothstep(0.8, 0.95, vn(vWP.xz * 9.0 + 3.1))) * pFlat; float grain = vn(vWP.xz * 31.0) * 0.4 + vn(vWP.xz * 67.0) * 0.3 + vn(vWP.xz * 140.0) * 0.15 + hh(floor(vWP.xz * 90.0)) * 0.15;
        diffuseColor.rgb *= mix(1.0, (0.86 + 0.26 * tN) * (1.0 + 0.22 * speck), tFade) * mix(1.0, cr.x * (0.66 + 0.68 * grain), tNear) * (1.0 + 0.45 * (1.0 - smoothstep(3.0, 24.0, tDist)));
        if (tMid > 0.01) { vec2 pc = floor(vWP.xz * 2.2); float pr = hh(pc + 3.3); vec2 pf = fract(vWP.xz * 2.2) - 0.5 + (vec2(hh(pc), hh(pc + 7.1)) - 0.5) * 0.5; float pd = length(pf); float aa = clamp(1.0 - fwidth(vWP.x * 2.2) * 2.0, 0.0, 1.0);
          float peb = (1.0 - smoothstep(0.1, 0.17, pd)) * step(0.55, pr) * aa; float mot = vn(vWP.xz * 0.9 + 5.0) * 0.6 + vn(vWP.xz * 3.1) * 0.4;
          diffuseColor.rgb *= mix(1.0, (0.8 + 0.4 * mot) * (1.0 - 0.45 * peb * step(0.8, pr) + 0.22 * peb * (1.0 - step(0.8, pr))), tMid); }
        { float rh = length(vWP.xz); float apr = smoothstep(5.0, 11.0, rh) * (1.0 - smoothstep(40.0, 60.0, rh)); /* pass 19: darker, rubbly regolith apron around the base (concept mid-ground) */
          if (apr > 0.01) { float pat = vn(vWP.xz * 0.16 + 2.0) * 0.6 + vn(vWP.xz * 0.5 + 7.0) * 0.4; diffuseColor.rgb *= mix(1.0, 0.7 + 0.3 * pat, apr);
            float rw = apr * smoothstep(11.0, 20.0, tDist) * (1.0 - smoothstep(90.0, 130.0, tDist)); if (rw > 0.01) { vec2 sd2 = vec2(${SUNXZ}) * 0.12;
              vec2 q = vWP.xz * 1.1; vec2 qi = floor(q); float d1 = 9.0, d1s = 9.0, keep = 0.0, ks = 0.0;
              for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) { vec2 c = qi + vec2(float(i), float(j)); float h = hh(c + 4.4); vec2 o = vec2(hh(c), hh(c + 7.7)) * 0.8 + 0.1 - (q - c); float dd = length(o); float rr = 0.18 + 0.2 * h; float on = step(0.45, hh(c + 2.2)) ; float v = dd / rr; if (v < d1 && on > 0.5) { d1 = v; } float vs = length(o + sd2 * 1.5) / rr; if (vs < d1s && on > 0.5) { d1s = vs; } }
              float aa = fwidth(q.x) * 3.0; float st = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, d1); float stS = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, d1s);
              float lit = st * (0.82 + 0.5 * (1.0 - d1)); float shad = (1.0 - st) * stS; diffuseColor.rgb *= mix(1.0, mix(1.0 - 0.45 * shad, lit, st), rw); } } }
        ${patch && !canyon ? 'float ccv, cwt, csh; float chh = clH(vWP, normalize(vWN), pFW, ccv, cwt, csh); diffuseColor.rgb *= mix(1.0, (1.0 - 0.4 * ccv) * csh * (0.94 + 0.12 * clamp(chh, 0.0, 1.0)), 1.0 - smoothstep(160.0, 260.0, tDist));' : ''}
        { vec2 dq1 = vWP.xz / 7.0; vec2 dq2 = mat2(0.8, -0.6, 0.6, 0.8) * vWP.xz / 2.3 + 0.37; float dA1 = texture2D(uDet, dq1).r * 1.6, dA2 = texture2D(uDet, dq2).r * 1.6; /* pass 40: crisp regolith detail, two scales */
          float dw1 = (1.0 - smoothstep(35.0, 140.0, tDist)) * pFlat, dw2 = (1.0 - smoothstep(10.0, 40.0, tDist)) * pFlat; diffuseColor.rgb *= mix(1.0, 0.45 + 0.55 * dA1, dw1 * 0.8) * mix(1.0, 0.45 + 0.55 * dA2, dw2 * 0.75);
          ${patch ? `{ vec3 fnT = normalize(vWN); vec3 tw = pow(abs(fnT), vec3(4.0)); tw /= tw.x + tw.y + tw.z + 1e-4; float wS = (1.0 - pFlat) * (1.0 - smoothstep(30.0, 160.0, tDist));
            if (wS > 0.01) { float ta = texture2D(uDet, vWP.zy / 4.5).r * tw.x + texture2D(uDet, vWP.xz / 4.5).r * tw.y + texture2D(uDet, vWP.xy / 4.5).r * tw.z; float tb = texture2D(uDet, vWP.zy / 17.0 + 0.3).r * tw.x + texture2D(uDet, vWP.xz / 17.0 + 0.3).r * tw.y + texture2D(uDet, vWP.xy / 17.0 + 0.3).r * tw.z;
              diffuseColor.rgb *= mix(1.0, (0.4 + 1.0 * ta) * (0.55 + 0.75 * tb), wS * 0.85) * mix(0.62, 1.0, smoothstep(-0.4, 0.4, fnT.y)); } }` : ''} /* pass 41: triplanar rock grain + overhang occlusion on steep walls */
          float lum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11)); diffuseColor.rgb = mix(vec3(lum), diffuseColor.rgb, 0.4) * vec3(0.95, 0.98, 1.06) * mix(vec3(1.0), vec3(0.8, 0.85, 0.96), smoothstep(70.0, 260.0, tDist)); } /* pass 41: far relief cools/darkens (concept rim) */ /* lunar grey (concept): mostly neutral regolith, warmth comes from the lights */
        vec2 au = vec2(vWP.x / 150.0 + 0.5, 0.5 - vWP.z / 150.0); if (au.x > 0.0 && au.x < 1.0 && au.y > 0.0 && au.y < 1.0) diffuseColor.rgb *= texture2D(uAOMap, au).r; }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      if (tFade > 0.01) { float e = 0.15; float n0 = rg(vWP.xz * 1.6), nx = rg(vWP.xz * 1.6 + vec2(e, 0.)), nz = rg(vWP.xz * 1.6 + vec2(0., e));
        vec3 gW = vec3(-(nx - n0) / e, 0.0, -(nz - n0) / e) * 0.35 * tFade - vec3(cr.y, 0.0, cr.z) * 2.4 * tNear;
        if (tNear > 0.01) { float ge = 0.03; vec2 q = vWP.xz * 9.0; float g0 = vn(q), gx = vn(q + vec2(ge * 9.0, 0.)), gz = vn(q + vec2(0., ge * 9.0)); gW += vec3(-(gx - g0), 0.0, -(gz - g0)) * 0.9 * tNear * (1.0 - smoothstep(4.0, 30.0, tDist)); }
        if (tMid > 0.01) { float me = 0.06; vec2 q = vWP.xz * 2.6; float m0 = vn(q), mx = vn(q + vec2(me * 2.6, 0.)), mz = vn(q + vec2(0., me * 2.6)); gW += vec3(-(mx - m0), 0.0, -(mz - m0)) / me * 0.09 * tMid; }
        { vec2 dq1 = vWP.xz / 7.0; vec2 dq2 = mat2(0.8, -0.6, 0.6, 0.8) * vWP.xz / 2.3 + 0.37; vec2 n1 = texture2D(uDet, dq1).gb - 0.5, n2 = (texture2D(uDet, dq2).gb - 0.5) * mat2(0.8, -0.6, 0.6, 0.8);
          float dw1 = (1.0 - smoothstep(35.0, 140.0, tDist)) * pFlat, dw2 = (1.0 - smoothstep(10.0, 40.0, tDist)) * pFlat; gW += vec3(n1.x, 0.0, n1.y) * 1.3 * dw1 + vec3(n2.x, 0.0, n2.y) * 1.5 * dw2; } /* pass 40: detail normal */
        normal = normalize(normal + (viewMatrix * vec4(gW, 0.0)).xyz); }
      ${patch ? `{ vec3 fnT = normalize(vWN); vec3 tw = pow(abs(fnT), vec3(4.0)); tw /= tw.x + tw.y + tw.z + 1e-4; float dT = length(vWP - cameraPosition); float wS = (1.0 - smoothstep(0.55, 0.85, fnT.y)) * (1.0 - smoothstep(20.0, 110.0, dT));
        if (wS > 0.01) { vec2 nx = texture2D(uDet, vWP.zy / 4.5).gb - 0.5, ny = texture2D(uDet, vWP.xz / 4.5).gb - 0.5, nz = texture2D(uDet, vWP.xy / 4.5).gb - 0.5;
          vec3 gw = vec3(0.0, nx.y, nx.x) * tw.x + vec3(ny.x, 0.0, ny.y) * tw.y + vec3(nz.x, nz.y, 0.0) * tw.z; normal = normalize(normal + (viewMatrix * vec4(gw * 2.6 * wS, 0.0)).xyz); } }` : ''}
      ${patch && !canyon ? '{ float ccv, cwt, csh; float H = clH(vWP, normalize(vWN), pFW, ccv, cwt, csh) * 0.6 * (1.0 - smoothstep(0.6, 2.0, pFW)); vec3 sp = -vViewPosition; vec3 sx = dFdx(sp), sy = dFdy(sp); vec3 R1 = cross(sy, normal), R2 = cross(normal, sx); float det = dot(sx, R1); vec3 grad = sign(det) * (dFdx(H) * R1 + dFdy(H) * R2); normal = normalize(abs(det) * normal - grad); }' : ''}`);
  };
  return m;
}

const cA = new THREE.Color('#8e8e92'), cB = new THREE.Color('#717277'), cDark = new THREE.Color('#4a4e58'), cTeal = new THREE.Color('#2f6f78'), cOrange = new THREE.Color('#c0602a'), cLight = new THREE.Color('#aaa8a3'), cTan = new THREE.Color('#99958e'), cSlate = new THREE.Color('#5c5d60');
function vertexColor(c, x, z, h, step) { const r = Math.hypot(x, z);
    const hx = heightAt(x + step, z), hx2 = heightAt(x - step, z), hz = heightAt(x, z + step), hz2 = heightAt(x, z - step);
    const slope = clamp(Math.hypot(hx - hx2, hz - hz2) / (2 * step), 0, 2);
    const ao = clamp(1 - ((hx + hx2 + hz + hz2) / 4 - h) * 0.07 * (6 / Math.max(6, step)), 0.55, 1.12);
    c.copy(cA).lerp(cB, clamp(0.5 + fbm(x * 0.03, z * 0.03, 3) * 1.2, 0, 1));
    c.lerp(cLight, clamp(fbm(x * 0.15 + 4, z * 0.15, 2) * 0.8 + slope * 0.15, 0, 0.55)); // rocky faces read lighter, like the concept
    c.lerp(cDark, clamp(slope * 0.12 - 0.05, 0, 0.2));
    c.multiplyScalar(ao);
    const dc = Math.abs(-(x - CANYON_A.x) * CAN_U.z + (z - CANYON_A.z) * CAN_U.x - canyonMeander(clamp(canyonS(x, z), 0, CAN_L))); if (h < -6) { const cw = 1 - smoothstep(55, 80, dc); const lay = 0.5 + 0.5 * Math.sin(h * 0.42 + fbm(x * 0.02, z * 0.02, 2) * 2.5); c.lerp(lay > 0.5 ? cTan : cSlate, clamp(slope * 0.9, 0, 0.7) * cw * (0.35 + 0.65 * smoothstep(0.1, 0.45, Math.abs(lay - 0.5)))); } /* pass 21: layered tan/grey canyon walls, teal only on the deep floor */
    { const R = REGIONS.reactor; const d = Math.hypot(x - R.x, z - R.z); c.lerp(cOrange, (1 - smoothstep(20, 80, d)) * 0.4); }
    c.lerp(cDark, 0.12 * (1 - smoothstep(10, 40, r)));
}
// pass 19: dense polar patch over the reactor crater (the far rings are ~60 m facets out there)
function buildPatch(mat, PATCH, name, M = 112) {
  const rs = [0]; let r = 1.5; while (r < PATCH.r) { rs.push(r); r += r < 120 ? 1.9 : 3; } rs.push(PATCH.r);
  const pos = [], col = [], idx = []; const c = new THREE.Color();
  rs.forEach((rr, k) => { const n = k === 0 ? 1 : M; for (let j = 0; j < n; j++) { const a = (j + (k % 2) * 0.5) / M * Math.PI * 2; const x = PATCH.x + Math.cos(a) * rr, z = PATCH.z + Math.sin(a) * rr; const h = heightAt(x, z); pos.push(x, h, z); vertexColor(c, x, z, h, 2.5); col.push(c.r, c.g, c.b); } });
  const id = (k, j) => k === 0 ? 0 : 1 + (k - 1) * M + ((j % M) + M) % M;
  for (let k = 0; k < rs.length - 1; k++) for (let j = 0; j < M; j++) { if (k === 0) { idx.push(0, id(1, j + 1), id(1, j)); continue; } const s = k % 2; const a = id(k, j), b = id(k, j + 1), cc = id(k + 1, j - (s ? 0 : 1) + (s ? 0 : 1)), d = id(k + 1, j + 1); idx.push(a, b, cc, b, d, cc); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
  g.computeVertexNormals(); g.computeBoundingSphere(); mat.flatShading = false; /* smooth: no big triangulated facets on the crater wall */
  const mesh = new THREE.Mesh(g, mat); mesh.name = name; mesh.receiveShadow = true; return mesh;
}
// pass 22: canyon patch = crisp low-poly rock: jittered coarse grid, flat-shaded non-indexed faces, per-face strata colours
const CPAL = ['#8f8e8b', '#868583', '#9a9996', '#7e7d7b', '#929190', '#8a8986'].map(h => new THREE.Color(h)); const cLedge = new THREE.Color('#b4b3af') /* pass 41: lunar grey strata (was tan) */, cFloorA = new THREE.Color('#827f79'), cFloorB = new THREE.Color('#9a968e');
let RP = null; // rect patch grid for exact ground queries
function rpDiag(i, j) { const q = Math.sin(i * 91.7 + j * 47.3) * 9631.17; return q - Math.floor(q) > 0.5; } // random diagonals: no zig-zag pattern
function rpVert(i, j) { return i * RP.NV + j; }
function rectPatchHeight(x, z) { const R = PATCH3.rect; const dx = x - PATCH3.x, dz = z - PATCH3.z; const t = dx * R.ux + dz * R.uz, v = -dx * R.uz + dz * R.ux;
  const i0 = Math.floor((t + R.hl) / RP.dt); let j0 = 0; while (j0 < RP.vs.length - 2 && RP.vs[j0 + 1] < v) j0++;
  for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) { const i = i0 + di, j = j0 + dj; if (i < 0 || j < 0 || i >= RP.NI - 1 || j >= RP.NV - 1) continue;
    const a = rpVert(i, j), b = a + 1, c = a + RP.NV, d = c + 1; const tris = rpDiag(i, j) ? [[a, b, c], [b, d, c]] : [[a, d, c], [a, b, d]];
    for (const [A, B, Cc] of tris) { const x1 = RP.X[A], z1 = RP.Z[A], x2 = RP.X[B], z2 = RP.Z[B], x3 = RP.X[Cc], z3 = RP.Z[Cc]; const det = (z2 - z3) * (x1 - x3) + (x3 - x2) * (z1 - z3); if (Math.abs(det) < 1e-9) continue;
      const l1 = ((z2 - z3) * (x - x3) + (x3 - x2) * (z - z3)) / det, l2 = ((z3 - z1) * (x - x3) + (x1 - x3) * (z - z3)) / det, l3 = 1 - l1 - l2; if (l1 >= -1e-6 && l2 >= -1e-6 && l3 >= -1e-6) return l1 * RP.H[A] + l2 * RP.H[B] + l3 * RP.H[Cc]; } }
  return heightAt(x, z); }
function buildRectPatch(mat, P, name) { const R = P.rect; const dt = 4.0; const ss = []; for (let t = -R.hl; t < R.hl - 0.5; t += dt) ss.push(t); ss.push(R.hl);
  const vs = []; for (let v = -R.hw; v < R.hw - 0.5; ) { vs.push(v); v += Math.abs(v) < 72 ? 2.6 : 5; } vs.push(R.hw);
  const NI = ss.length, NV = vs.length; const X = new Float32Array(NI * NV), Z = new Float32Array(NI * NV), Hh = new Float32Array(NI * NV);
  for (let i = 0; i < NI; i++) for (let j = 0; j < NV; j++) { const edge = i === 0 || j === 0 || i === NI - 1 || j === NV - 1; const hj = (a, b) => { const q = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return q - Math.floor(q) - 0.5; };
    const t = ss[i] + (edge ? 0 : hj(i, j) * dt * 0.3), dv = j < NV - 1 ? vs[j + 1] - vs[j] : 2.6, v = vs[j] + (edge ? 0 : hj(j + 0.37, i + 0.71) * dv * 0.28);
    const x = P.x + R.ux * t - R.uz * v, z = P.z + R.uz * t + R.ux * v; const k = i * NV + j; X[k] = x; Z[k] = z; Hh[k] = heightAt(x, z); }
  RP = { X, Z, H: Hh, NI, NV, vs, dt };
  const pos = [], col = [], nrm = []; const c = new THREE.Color(); const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), n = new THREE.Vector3();
  const face = (A, B, Cc) => { const ax = X[A], ay = Hh[A], az = Z[A]; e1.set(X[B] - ax, Hh[B] - ay, Z[B] - az); e2.set(X[Cc] - ax, Hh[Cc] - ay, Z[Cc] - az); n.crossVectors(e1, e2).normalize(); if (n.y < 0) n.negate();
    const cx = (ax + X[B] + X[Cc]) / 3, cz = (az + Z[B] + Z[Cc]) / 3, ch = (ay + Hh[B] + Hh[Cc]) / 3; const ci = canyonInfo(cx, cz); const rv = fbm(cx * 0.9, cz * 0.9, 1) * 0.12 + (Math.sin(cx * 12.9898 + cz * 78.233) * 43758.5 % 1) * 0.05;
    if (ci.d < ci.fl + 1.5) { c.copy(cFloorA).lerp(cFloorB, clamp(0.5 + fbm(cx * 0.06, cz * 0.06, 2) * 1.4, 0, 1)); }
    else if (ci.d < ci.fl + ci.ww + 6) { const band = Math.floor((ch + 90) / 3.6 + fbm(cx * 0.01, cz * 0.01, 2) * 1.6); c.copy(CPAL[((band % 6) + 6) % 6]);
      if (n.y > 0.8) c.lerp(cLedge, 0.55); }
    else vertexColor(c, cx, cz, ch, 3.0);
    c.multiplyScalar(1 + rv - 0.04); const wall = ci.d >= ci.fl + 1.5 && ci.d < ci.fl + ci.ww + 6 && n.y <= 0.8;
    const floor = ci.d < ci.fl + 1.5;
    for (const k of [A, B, Cc]) { if (floor) { const vx = X[k], vz = Z[k], ee = 1.6; const gx = (heightAt(vx + ee, vz) - heightAt(vx - ee, vz)) / (2 * ee), gz = (heightAt(vx, vz + ee) - heightAt(vx, vz - ee)) / (2 * ee); const l = Math.hypot(gx, 1, gz); nrm.push(-gx / l, 1 / l, -gz / l);
        c.copy(cFloorA).lerp(cFloorB, clamp(0.5 + fbm(vx * 0.06, vz * 0.06, 2) * 1.4, 0, 1)).multiplyScalar(0.97 + fbm(vx * 0.5, vz * 0.5, 1) * 0.1); pos.push(vx, Hh[k], vz); col.push(c.r, c.g, c.b); continue; } /* pass 23: smooth floor (per-vertex normals + colour) */
      nrm.push(n.x, n.y, n.z); let f = 1; if (wall) { const vi = canyonInfo(X[k], Z[k]); const ph = clamp((vi.fr - 0.3) / 0.4, 0, 1); f = vi.fr < 0.3 ? 0.62 : vi.fr > 0.7 ? 1.12 : 0.62 + 0.5 * ph; } /* shadowed undercut at the riser foot -> lit lip at the top */
      pos.push(X[k], Hh[k], Z[k]); col.push(c.r * f, c.g * f, c.b * f); } };
  for (let i = 0; i < NI - 1; i++) for (let j = 0; j < NV - 1; j++) { const a = i * NV + j, b = a + 1, cc = a + NV, d = cc + 1; if (rpDiag(i, j)) { face(a, b, cc); face(b, d, cc); } else { face(a, d, cc); face(a, b, d); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); mat.flatShading = false;
  const gc = toCreasedNormals(g, 1.25); { const P = gc.attributes.position, C = gc.attributes.color, acc = new Map(); const key = (i) => Math.round(P.getX(i) * 20) + ',' + Math.round(P.getZ(i) * 20); for (let i = 0; i < P.count; i++) { const k = key(i); let a = acc.get(k); if (!a) acc.set(k, a = [0, 0, 0, 0]); a[0] += C.getX(i); a[1] += C.getY(i); a[2] += C.getZ(i); a[3]++; } for (let i = 0; i < P.count; i++) { const a = acc.get(key(i)); C.setXYZ(i, C.getX(i) * 0.15 + a[0] / a[3] * 0.85, C.getY(i) * 0.15 + a[1] / a[3] * 0.85, C.getZ(i) * 0.15 + a[2] / a[3] * 0.85); } } gc.computeBoundingSphere(); /* per-corner colour: no per-triangle tone steps */ /* pass 41: creased normals - natural rounded walls, crisp only at ledge breaks (no triangle facets) */
  const mesh = new THREE.Mesh(gc, mat); mesh.name = name; mesh.receiveShadow = true; return mesh; }
export function buildTerrain() {
  const topo = buildTopology(); PX = topo.px; PZ = topo.pz; TRI = topo.tris; const NV = topo.NV;
  H = new Float32Array(NV); for (let i = 0; i < NV; i++) H[i] = heightAt(PX[i], PZ[i]);
  buildBuckets();
  const col = new Float32Array(NV * 3); const c = new THREE.Color();
  for (let i = 0; i < NV; i++) { vertexColor(c, PX[i], PZ[i], H[i], Math.max(2.5, Math.hypot(PX[i], PZ[i]) * 0.05));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  // bucket triangles into sectors
  const nearR = GRID.R1 * 1.06; const sectors = new Map();
  for (let t = 0; t < TRI.length; t += 3) {
    const a = TRI[t], b = TRI[t + 1], cc = TRI[t + 2]; const cx = (PX[a] + PX[b] + PX[cc]) / 3, cz = (PZ[a] + PZ[b] + PZ[cc]) / 3;
    const r = Math.hypot(cx, cz); let ang = Math.atan2(cz, cx); if (ang < 0) ang += Math.PI * 2;
    const key = r < 75 ? 'i' + Math.floor(ang / (Math.PI * 2) * GRID.si) : r < nearR ? 'n' + Math.floor(ang / (Math.PI * 2) * GRID.sn) : 'f' + Math.floor(ang / (Math.PI * 2) * GRID.sf);
    let l = sectors.get(key); if (!l) sectors.set(key, l = []); l.push(a, b, cc);
  }
  const group = new THREE.Group(); group.name = 'terrain'; const mat = terrainMaterial(); mat.flatShading = false;
  for (const [key, idx] of sectors) {
    const pos = new Float32Array(idx.length * 3), cl = new Float32Array(idx.length * 3);
    idx.forEach((v, i) => { pos[i * 3] = PX[v]; pos[i * 3 + 1] = H[v]; pos[i * 3 + 2] = PZ[v]; cl[i * 3] = col[v * 3]; cl[i * 3 + 1] = col[v * 3 + 1]; cl[i * 3 + 2] = col[v * 3 + 2]; });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(cl, 3)); const gs = toCreasedNormals(g, 0.8); gs.computeBoundingSphere(); /* pass 41: smooth terrain shading, crisp only at sharp breaks (no triangle facets on hills) */
    const mesh = new THREE.Mesh(gs, mat); mesh.name = 'terrain_' + key; mesh.receiveShadow = true; mesh.castShadow = false; group.add(mesh);
  }
  const pmat = terrainMaterial(true); group.add(buildPatch(pmat, PATCH, 'terrain_patch')); group.add(buildPatch(pmat, PATCH2, 'terrain_patch2', 96)); group.add(buildRectPatch(terrainMaterial(true, true), PATCH3, 'terrain_patch3'));
  group.userData.tris = TRI.length / 3;
  return group;
}
export function slopeAt(x, z) { const e = 1.5; return Math.hypot(heightAt(x + e, z) - heightAt(x - e, z), heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e); }
