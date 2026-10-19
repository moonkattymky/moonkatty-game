import { makeStaticCrystals } from './game/crystal.js';
import * as THREE from 'three';
import { groundAt, groundMesh, LEDGE, slopeAt, F, Rt, LOOKOUT, REGIONS, sd, CONCEPT, CAVE, PORTAL, canyonPoint, canyonS, canyonInfo, regolithDetail } from './terrain.js';
import { noise2, seeded } from './noise.js';
import { colliders, LAMPS } from './base.js';
import { KEEP } from './world.js';
import { mergeVertices, toCreasedNormals } from '../vendor/three/jsm/utils/BufferGeometryUtils.js';
// pass 41: natural boulders - creased normals (smooth across shallow facet joints, crisp only at real breaks) + facet colours blended per corner
export function creaseRock(g, deg = 55, cm = 0.75) { const o = toCreasedNormals(g, deg * Math.PI / 180); const P = o.attributes.position, C = o.attributes.color;
  if (C) { const acc = new Map(); const key = (i) => Math.round(P.getX(i) * 500) + ',' + Math.round(P.getY(i) * 500) + ',' + Math.round(P.getZ(i) * 500);
    for (let i = 0; i < P.count; i++) { const k = key(i); let a = acc.get(k); if (!a) acc.set(k, a = [0, 0, 0, 0]); a[0] += C.getX(i); a[1] += C.getY(i); a[2] += C.getZ(i); a[3]++; }
    for (let i = 0; i < P.count; i++) { const a = acc.get(key(i)); C.setXYZ(i, C.getX(i) + (a[0] / a[3] - C.getX(i)) * cm, C.getY(i) + (a[1] / a[3] - C.getY(i)) * cm, C.getZ(i) + (a[2] / a[3] - C.getZ(i)) * cm); } C.needsUpdate = true; }
  o.computeBoundingSphere(); return o; }

const rnd = seeded(2024);
export function rockGeom(detail, seed, stretch = [1, 1, 1], rough = 0.32, light = 1) {
  const g = detail === 'b' ? new THREE.BoxGeometry(1.4, 1.4, 1.4, 1, 1, 1).toNonIndexed() : detail === 'd' ? new THREE.DodecahedronGeometry(1, 0) : detail < 0 ? new THREE.OctahedronGeometry(1, 0) : new THREE.IcosahedronGeometry(1, detail);
  const P = g.attributes.position; const v = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) {
    v.fromBufferAttribute(P, i);
    const n = noise2(v.x * 1.7 + seed * 3.1, v.z * 1.7 + v.y * 1.3 - seed) * rough + noise2(v.y * 3.1 + seed, v.x * 2.9) * rough * 0.45;
    v.multiplyScalar(1 + n); v.x *= stretch[0]; v.y *= stretch[1]; v.z *= stretch[2];
    if (v.y < -0.35) v.y = -0.35 - (v.y + 0.35) * 0.15;
    P.setXYZ(i, v.x, v.y, v.z);
  }
  g.deleteAttribute('uv'); g.computeVertexNormals();
  const col = new Float32Array(P.count * 3); const r = seeded(seed * 97 + 5); const N = g.attributes.normal;
  for (let f = 0; f < P.count; f += 3) {
    const up = (N.getY(f) + 1) * 0.5; const base = (0.12 + r() * 0.09 + up * 0.09) * light;
    for (let k = 0; k < 3; k++) { const y = P.getY(f + k); const ao = THREE.MathUtils.clamp(0.55 + (y + 0.35) * 0.45, 0.5, 1.05); const c = base * ao; col[(f + k) * 3] = c * 1.03; col[(f + k) * 3 + 1] = c; col[(f + k) * 3 + 2] = c * 0.94; }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return g;
}

// higher-detail rock prototype: noise-displaced icosphere with sharp strata terraces + baked AO (same shape at every LOD)
// weld duplicate vertices so computeVertexNormals gives smooth-ish shading (no addons needed)
export function weld(g) {
  const P = g.attributes.position; const map = new Map(); const pos = []; const idx = [];
  for (let i = 0; i < P.count; i++) { const k = P.getX(i).toFixed(4) + ',' + P.getY(i).toFixed(4) + ',' + P.getZ(i).toFixed(4); let j = map.get(k); if (j === undefined) { j = pos.length / 3; map.set(k, j); pos.push(P.getX(i), P.getY(i), P.getZ(i)); } idx.push(j); }
  const o = new THREE.BufferGeometry(); o.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); o.setIndex(idx); return o;
}
// chunky regolith boulder: welded (smooth normals), noise-displaced, rough flattened top, warm-neutral per-vertex colour with baked AO
export function chunkGeom(detail, seed, top = 0.5) {
  const g = weld(new THREE.IcosahedronGeometry(1, detail)); const P = g.attributes.position; const v = new THREE.Vector3(); const nz = [];
  for (let i = 0; i < P.count; i++) {
    v.fromBufferAttribute(P, i);
    const n = noise2(v.x * 1.4 + seed * 3.1, v.z * 1.4 + v.y * 1.2 - seed) * 0.3 + noise2(v.y * 2.9 + seed, v.x * 2.6 + v.z) * 0.15 + noise2(v.x * 6.1 - seed, v.y * 5.7 + v.z * 5.3) * 0.07;
    v.multiplyScalar(1 + n); v.x *= 1.2; v.y *= 0.85; v.z *= 1.05;
    if (v.y > top) v.y = top + (v.y - top) * 0.2 + noise2(v.x * 3.7 + seed, v.z * 3.9) * 0.05;
    if (v.y < -0.3) v.y = -0.3 - (v.y + 0.3) * 0.15;
    P.setXYZ(i, v.x, v.y, v.z); nz.push(n);
  }
  g.computeVertexNormals(); const N = g.attributes.normal; const col = new Float32Array(P.count * 3);
  for (let i = 0; i < P.count; i++) { const up = N.getY(i); const y = P.getY(i); const ao = THREE.MathUtils.clamp(0.7 + (y + 0.3) * 0.4, 0.65, 1.0); const c = (0.21 + Math.max(0, up) * 0.03 + nz[i] * 0.03) * ao; col[i * 3] = c * 1.04; col[i * 3 + 1] = c; col[i * 3 + 2] = c * 0.93; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeBoundingSphere(); return g;
}
// chiselled boulder: icosphere cut by random planes -> flat facets with crisp edges (angular, chunky), flat-shaded, top-lit vertex colours
export function chiselGeom(seed, cuts = 11, detail = 2) {
  const r = seeded(seed * 13 + 1); const g = new THREE.IcosahedronGeometry(1, detail); const P = g.attributes.position; const v = new THREE.Vector3(); const n = new THREE.Vector3();
  const planes = []; for (let i = 0; i < cuts; i++) { const th = r() * Math.PI * 2, y = i < 2 ? 0.85 + r() * 0.15 : (r() - 0.35) * 1.3; n.set(Math.cos(th) * Math.sqrt(Math.max(0, 1 - y * y)), y, Math.sin(th) * Math.sqrt(Math.max(0, 1 - y * y))).normalize(); planes.push([n.clone(), i < 2 ? 0.45 + r() * 0.15 : 0.55 + r() * 0.3]); }
  for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i); for (const [pn, d] of planes) { const k = v.dot(pn); if (k > d) v.addScaledVector(pn, d - k); } { const dn = noise2(v.x * 3.1 + seed, v.z * 3.3 + v.y * 2.7) * 0.075 + noise2(v.x * 7.7 - seed, v.y * 7.1 + v.z * 6.3) * 0.03; v.multiplyScalar(1 + dn); } v.x *= 1.25; v.z *= 1.05; v.y *= 0.9; if (v.y < -0.3) v.y = -0.3 - (v.y + 0.3) * 0.15; P.setXYZ(i, v.x, v.y, v.z); }
  g.deleteAttribute('uv'); g.computeVertexNormals(); const N = g.attributes.normal; const col = new Float32Array(P.count * 3);
  for (let f = 0; f < P.count; f += 3) { const nx = (N.getX(f) + N.getX(f + 1) + N.getX(f + 2)) / 3, ny = (N.getY(f) + N.getY(f + 1) + N.getY(f + 2)) / 3; const c = (0.24 + Math.max(0, ny) * 0.06 + Math.max(0, -nx) * 0.03 + (r() - 0.5) * 0.07) * (r() < 0.12 ? 0.68 : 1); /* facet tone variety + dark crevice faces */ for (let k = 0; k < 3; k++) { const y = P.getY(f + k); const ao = THREE.MathUtils.clamp(0.52 + (y + 0.3) * 0.55, 0.5, 1.0); const cc = c * ao; col.set([cc * 1.03, cc, cc * 0.95], (f + k) * 3); } }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeBoundingSphere(); return g;
}
// jagged crest for crater-wall pieces: lift upper vertices by position-hashed noise into sharp spires (no new triangles, crack-free)
export function jagGeom(g, seed, amp = 0.9) { // irregular crest: a couple of uneven peaks, broken plateau shelves, eroded flanks (crack-free: displacement hashed by position)
  const P = g.attributes.position; for (let i = 0; i < P.count; i++) { let x = P.getX(i), y = P.getY(i), z = P.getZ(i); if (y <= 0.05) continue;
    const big = Math.pow(noise2(x * 1.1 + seed, z * 1.1 - seed) * 0.5 + 0.5, 4.0); const small = noise2(x * 4.7 - seed, z * 4.3 + y * 3.1) * 0.5 + 0.5; const k = (y - 0.05);
    y += (big * amp * 2.2 + small * amp * 0.35) * k; if (y > 0.62 && big < 0.25) y = 0.62 + (y - 0.62) * 0.25; // plateau shelf where no peak
    const er = 1 - 0.2 * small * k; P.setXYZ(i, x * er, y, z * er); }
  g.computeVertexNormals(); g.computeBoundingSphere(); return g; }
// massif block: rough mesa (blunt broken crest, steep eroded flanks with strata) - overlapping copies fuse into one continuous cliff mass
export function mesaGeom(g, seed) {
  const P = g.attributes.position; for (let i = 0; i < P.count; i++) { let x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    if (y > 0.3) { const n = noise2(x * 3.1 + seed, z * 3.3 - seed) * 0.5 + 0.5, m = noise2(x * 7.3 - seed, z * 6.9 + seed) * 0.5 + 0.5; y = 0.3 + (y - 0.3) * 0.32 + (n - 0.5) * 0.16 + (m - 0.5) * 0.06; }
    else { const e = 1 - 0.12 * (noise2(x * 5.0 + seed, y * 6.0) * 0.5 + 0.5); x *= e; z *= e; } // eroded flanks
    P.setXYZ(i, x, y, z); }
  g.computeVertexNormals(); g.computeBoundingSphere(); return g; }
export function protoGeom(detail, seed, stretch = [1, 1, 1], strata = 0.65, light = 1) {
  const g = new THREE.IcosahedronGeometry(1, detail); const P = g.attributes.position; const v = new THREE.Vector3(); const rr = new Float32Array(P.count);
  for (let i = 0; i < P.count; i++) {
    v.fromBufferAttribute(P, i);
    const n = noise2(v.x * 1.3 + seed * 3.1, v.z * 1.3 + v.y * 1.1 - seed) * 0.34 + noise2(v.y * 2.7 + seed, v.x * 2.5 + v.z) * 0.16 + noise2(v.x * 5.1 - seed, v.y * 5.3 + v.z * 4.7) * 0.07;
    v.multiplyScalar(1 + n); v.x *= stretch[0]; v.y *= stretch[1]; v.z *= stretch[2];
    const st = 0.24 * stretch[1]; const q = Math.round(v.y / st) * st; v.y += (q - v.y) * strata; // strata ledges
    if (v.y < -0.3) v.y = -0.3 - (v.y + 0.3) * 0.15;
    P.setXYZ(i, v.x, v.y, v.z); rr[i] = Math.hypot(v.x / stretch[0], v.z / stretch[2]);
  }
  g.deleteAttribute('uv'); g.computeVertexNormals();
  const N = g.attributes.normal; const col = new Float32Array(P.count * 3); const r = seeded(seed * 31 + 7);
  for (let f = 0; f < P.count; f += 3) {
    const up = N.getY(f); const base = (0.13 + r() * 0.06 + Math.max(0, up) * 0.11 - Math.max(0, -up) * 0.05) * light;
    for (let k = 0; k < 3; k++) { const i = f + k; const y = P.getY(i) / stretch[1]; const ao = THREE.MathUtils.clamp(0.5 + (y + 0.3) * 0.42, 0.45, 1.05) * THREE.MathUtils.clamp(0.75 + rr[i] * 0.3, 0.7, 1.08); const c = base * ao; col[i * 3] = c * 1.03; col[i * 3 + 1] = c; col[i * 3 + 2] = c * 0.94; }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeBoundingSphere(); return g;
}
// jagged crater-wall piece: tapering strata ledges with ragged rims and a faceted peak (sharp silhouette, not boxy)
export function wallGeom(seed, layers = 4, sides = 8) {
  const r = seeded(seed); const pos = [], col = []; const h = 1 / layers; let prevTop = null;
  for (let k = 0; k < layers; k++) {
    const y0 = k * h - (k ? 0.04 : 0.15); const R = 1 - k * 0.21; const cx = (r() - 0.5) * 0.2 * k, cz = (r() - 0.5) * 0.2 * k;
    const pts = []; for (let i = 0; i < sides; i++) { const a = i / sides * Math.PI * 2 + r() * 0.35; const rad = R * (0.6 + r() * 0.55); pts.push([cx + Math.cos(a) * rad, cz + Math.sin(a) * rad, (k + 1) * h + (r() - 0.5) * h * 0.7]); }
    const shade = 0.14 + r() * 0.04;
    for (let i = 0; i < sides; i++) { const [ax, az, ay] = pts[i], [bx, bz, by] = pts[(i + 1) % sides]; const t0 = shade * 0.55, t1 = shade;
      pos.push(ax, y0, az, bx, by, bz, bx, y0, bz, ax, y0, az, ax, ay, az, bx, by, bz); col.push(t0, t0, t0, t1, t1, t1, t0, t0, t0, t0, t0, t0, t1, t1, t1, t1, t1, t1); }
    if (k === layers - 1) { const ap = [cx + (r() - 0.5) * 0.5, (k + 1) * h + 0.12 + r() * 0.14, cz + (r() - 0.5) * 0.3]; const top = shade * 1.4; for (let i = 0; i < sides; i++) { const [ax, az, ay] = pts[i], [bx, bz, by] = pts[(i + 1) % sides]; pos.push(ax, ay, az, ap[0], ap[1], ap[2], bx, by, bz); col.push(top, top, top, top * 1.1, top * 1.1, top * 1.1, top, top, top); } }
    else { const top = shade * 1.45; for (let i = 1; i < sides - 1; i++) { pos.push(pts[0][0], pts[0][2], pts[0][1], pts[i + 1][0], pts[i + 1][2], pts[i + 1][1], pts[i][0], pts[i][2], pts[i][1]); col.push(top, top, top, top, top, top, top, top, top); } }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); g.computeBoundingSphere(); return g;
}
// layered strata block: stacked jagged prisms with sharp horizontal ledges (far rim cliffs, hill ledges)
export function strataGeom(seed, layers = 3, sides = 7) {
  const r = seeded(seed); const pos = [], col = []; const h = 1 / layers;
  for (let k = 0; k < layers; k++) {
    const y0 = k * h - 0.15, y1 = (k + 1) * h; const cx = (r() - 0.5) * 0.15 * k, cz = (r() - 0.5) * 0.15 * k; const R = 1 - k * 0.2;
    const pts = []; for (let i = 0; i < sides; i++) { const a = i / sides * Math.PI * 2 + r() * 0.3; const rad = R * (0.72 + r() * 0.4); pts.push([cx + Math.cos(a) * rad, cz + Math.sin(a) * rad]); }
    const shade = 0.13 + r() * 0.04;
    for (let i = 0; i < sides; i++) { const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % sides]; const t0 = shade * 0.55, t1 = shade * 1.0;
      pos.push(ax, y0, az, bx, y1 * 0.98 + y0 * 0.02, bz, bx, y0, bz, ax, y0, az, ax, y1, az, bx, y1 * 0.98 + y0 * 0.02, bz); col.push(t0, t0, t0, t1, t1, t1, t0, t0, t0, t0, t0, t0, t1, t1, t1, t1, t1, t1); }
    const top = shade * 1.45; for (let i = 1; i < sides - 1; i++) { pos.push(pts[0][0], y1, pts[0][1], pts[i + 1][0], y1, pts[i + 1][1], pts[i][0], y1, pts[i][1]); col.push(top, top, top, top, top, top, top, top, top); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); g.computeBoundingSphere(); return g;
}

// pass 19: rounded, squashed irregular pebble (smooth icosahedron, 20 tris) with baked AO: dark underside, lit top
function pebbleGeom(seed) {
  const g0 = new THREE.IcosahedronGeometry(1, 0); g0.deleteAttribute('normal'); g0.deleteAttribute('uv'); const g = mergeVertices(g0); const P = g.attributes.position; const r = seeded(seed); const col = [];
  for (let i = 0; i < P.count; i++) { const k = 0.8 + r() * 0.4; let x = P.getX(i) * k, y = P.getY(i) * k, z = P.getZ(i) * k; y = y < 0 ? y * 0.5 : y; /* flat base */ P.setXYZ(i, x, y, z); const t = THREE.MathUtils.clamp((y + 0.5) / 1.4, 0, 1); const c = 0.5 + 0.55 * t; col.push(c * 1.02, c, c * 0.96); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
}
function rockMaterial(fog = true, bump = 2.2, smooth = false, key = 0.0, far = false, crack = false, amb = 0.32, rug = 0, cliff = 0) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: !smooth, roughness: 0.95, metalness: 0.0, fog }); m.color.setScalar(0.82); m.customProgramCacheKey = () => 'rock' + bump + fog + smooth + key + far + crack + amb + rug + 'c' + cliff;
  m.onBeforeCompile = (sh) => { sh.uniforms.uDet = { value: regolithDetail() };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <project_vertex>', `#include <project_vertex>
      #ifdef USE_INSTANCING
        vWP = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
      #else
        vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;
      #endif`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vWP;
      float hh(vec2 p){ p = fract(p * vec2(0.1031, 0.1030)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.x); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(hh(i), hh(i + vec2(1, 0)), f.x), mix(hh(i + vec2(0, 1)), hh(i + vec2(1, 1)), f.x), f.y); }
      uniform sampler2D uDet;
      float vor(vec2 p){ vec2 i = floor(p), f = fract(p); float m1 = 8., m2 = 8.; for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 o = vec2(x, y); vec2 r = o + vec2(hh(i + o), hh(i + o + 17.3)) - f; float dd = dot(r, r); if (dd < m1) { m2 = m1; m1 = dd; } else if (dd < m2) m2 = dd; } return sqrt(m2) - sqrt(m1); }
      float crH(vec3 w){ vec2 a = w.xz * 5.0 + w.y * 3.3, c = vec2(w.x + w.y * 0.8, w.z - w.y * 0.8) * 11.0; return vn(a) * 0.45 + vn(c) * 0.3 + vn(a * 4.3) * 0.17 + vn(c * 3.1) * 0.08; }
      float farH(vec3 w){ float sb = smoothstep(0.25, 0.75, vn(vec2(w.y * 0.55, (w.x + w.z) * 0.03))); float cn = vn(w.xz * 0.3 + w.y * 0.45) * 0.7 + vn(w.xz * 0.9 - w.y * 0.8) * 0.3; return sb * 0.5 + cn * 0.5; }
      float clP(vec2 p, out float cv, out float sh){ vec2 wq = p * 0.045; p += vec2(vn(wq) - 0.5, vn(wq + 5.2) - 0.5) * 9.0; /* domain warp */ float ra = (vn(p * 0.012 + 3.7) - 0.5) * 1.1; float cs = cos(ra), sn = sin(ra); vec2 pr = vec2(cs * p.x - sn * p.y, sn * p.x + cs * p.y); /* per-region rotation for the crack field */ float yy = p.y * 0.12 + vn(vec2(p.x * 0.02, 7.0)) * 2.2 + p.x * 0.03; float b = fract(yy); sh = 1.0 + 0.18 * (1.0 - smoothstep(0.0, 0.1, b)) - 0.36 * smoothstep(0.7, 1.0, b); float led = smoothstep(0.0, 0.3, b) * 0.6 + b * 0.4; float cr = vor(vec2(pr.x * 0.07, pr.y * 0.022 + floor(yy) * 0.23) + vec2(vn(pr * 0.08), vn(pr * 0.08 + 9.0)) * 0.6); float cr2 = vor(vec2(pr.x * 0.15 + pr.y * 0.05, pr.y * 0.06) + 11.0); cv = max(1.0 - smoothstep(0.03, 0.17, cr), (1.0 - smoothstep(0.02, 0.09, cr2)) * 0.45); return led * 0.8 - cv * 0.8 + vn(p * 0.22) * 0.4; }
      float clH(vec3 w, vec3 n, out float crev, out float wt, out float shd){ float ax = n.x * n.x, az = n.z * n.z, s = ax + az + 1e-3; float c1, c2, s1, s2; float h = (clP(vec2(w.z, w.y), c1, s1) * ax + clP(vec2(w.x, w.y) + 31.0, c2, s2) * az) / s; wt = smoothstep(0.25, 0.7, ax + az); crev = (c1 * ax + c2 * az) / s * wt; shd = mix(1.0, (s1 * ax + s2 * az) / s, wt); return h * wt; }
      float rkH(vec3 w){ vec2 a = w.xz * 2.3 + w.y * 1.7, b = vec2(w.x + w.y * 0.7, w.z - w.y * 0.7) * 3.1; return vor(a) * 0.55 + vor(b) * 0.3 + vn(a * 4.0) * 0.15; }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      diffuseColor.rgb *= mix(vec3(0.97, 0.98, 1.0), vec3(1.02, 1.0, 0.95), smoothstep(0.25, 0.8, vn(vWP.xz * 0.06 + 4.0))); // pass 40: near-neutral lunar grey (was warm)
      diffuseColor.rgb *= mix(vec3(1.0), vec3(0.74, 0.8, 0.94), smoothstep(70.0, 260.0, length(vWP - cameraPosition))); // pass 41: far cliffs cool + darker (concept rim)
      { vec3 fnD = normalize(cross(dFdx(vWP), dFdy(vWP))); vec3 tw = pow(abs(fnD), vec3(4.0)); tw /= tw.x + tw.y + tw.z + 1e-4; float dD = length(vWP - cameraPosition); float fdD = 1.0 - smoothstep(25.0, 110.0, dD);
        float ta = texture2D(uDet, vWP.zy / 2.6).r * tw.x + texture2D(uDet, vWP.xz / 2.6).r * tw.y + texture2D(uDet, vWP.xy / 2.6).r * tw.z; /* pass 40: triplanar crisp grain/pits (same detail map as the ground) */
        diffuseColor.rgb *= mix(1.0, 0.35 + 1.05 * ta, fdD * 0.9) * mix(0.6, 1.0, smoothstep(-0.55, 0.35, fnD.y)); } /* undersides / bases darker: contact occlusion */
      { float d = length(vWP - cameraPosition); float fd = 1.0 - smoothstep(30.0, 120.0, d); vec2 q = vWP.xz * 1.9 + vWP.yy * 1.3;
        float n = vn(q) * 0.6 + vn(q * 3.7) * 0.4; diffuseColor.rgb *= mix(1.0, 0.93 + 0.14 * n, fd);
        ${rug > 0 ? 'vec2 rq = vec2(vWP.x * 0.7 + vWP.z * 0.7, vWP.y * 1.8) * 0.16; float rv = vor(rq) + 0.5 * vor(rq * 2.7 + 3.0); diffuseColor.rgb *= mix(1.0, 0.62 + 0.5 * smoothstep(0.02, 0.35, rv), smoothstep(40.0, 90.0, d) * ' + rug.toFixed(2) + ');' : ''}
        ${far ? 'float fdd = smoothstep(25.0, 60.0, d); float fh = farH(vWP); diffuseColor.rgb *= mix(1.0, 0.72 + 0.55 * fh, fdd);' : ''}
        ${crack ? 'vec2 cq = vec2(vWP.x + vWP.y * 0.6, vWP.z - vWP.y * 0.6); float cv = vor(cq * 0.45); float cm = smoothstep(0.62, 0.72, vn(cq * 0.22 + 3.0)); float cl = (1.0 - smoothstep(0.01, 0.025 + fwidth(cv) * 1.2, cv)) * cm; float cv2 = vor(cq * 1.3 + 5.0); float cl2 = (1.0 - smoothstep(0.006, 0.014 + fwidth(cv2), cv2)) * smoothstep(0.68, 0.78, vn(cq * 0.5 + 9.0)); diffuseColor.rgb *= 1.0 - (0.6 * cl + 0.35 * cl2) * (1.0 - smoothstep(6.0, 40.0, d));' : ''}
        ${cliff > 0 ? 'vec3 fnw = normalize(cross(dFdx(vWP), dFdy(vWP))); float ccv, cwt, csh; float chh = clH(vWP, fnw, ccv, cwt, csh); float cfd = smoothstep(12.0, 25.0, d) * (1.0 - smoothstep(220.0, 320.0, d)); diffuseColor.rgb *= mix(1.0, (1.0 - 0.6 * ccv) * csh * (0.9 + 0.18 * clamp(chh, 0.0, 1.0)), cfd * ' + cliff.toFixed(2) + ');' : ''}
        ${smooth ? 'float ck = crH(vWP); diffuseColor.rgb *= mix(1.0, 0.97 + 0.04 * ck, fd);' : 'float ck = rkH(vWP); diffuseColor.rgb *= mix(1.0, 0.93 + 0.08 * smoothstep(0.08, 0.42, ck), fd);'} }`)
      .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
      { // crumbly micro-relief: derivative bump from a cellular/fbm height (no extra geometry)
        float d = length(vWP - cameraPosition); float fb = 1.0 - smoothstep(10.0, 70.0, d);
        if (fb > 0.01) { vec3 sp = -vViewPosition; vec3 sx = dFdx(sp), sy = dFdy(sp); vec3 R1 = cross(sy, normal), R2 = cross(normal, sx); float det = dot(sx, R1);
          float H = ${smooth ? 'crH(vWP)' : 'rkH(vWP)'}; float dhx = dFdx(H), dhy = dFdy(H); vec3 grad = sign(det) * (dhx * R1 + dhy * R2); normal = normalize(mix(normal, normalize(abs(det) * normal - grad * ${bump.toFixed(2)}), fb)); }
        ${cliff > 0 ? '{ float cfb = smoothstep(12.0, 25.0, d) * (1.0 - smoothstep(220.0, 320.0, d)); if (cfb > 0.01) { vec3 fnw = normalize(cross(dFdx(vWP), dFdy(vWP))); float ccv, cwt, csh; float H = clH(vWP, fnw, ccv, cwt, csh) * ' + (1.0 * cliff).toFixed(2) + '; vec3 sp = -vViewPosition; vec3 sx = dFdx(sp), sy = dFdy(sp); vec3 R1 = cross(sy, normal), R2 = cross(normal, sx); float det = dot(sx, R1); vec3 grad = sign(det) * (dFdx(H) * R1 + dFdy(H) * R2); normal = normalize(mix(normal, normalize(abs(det) * normal - grad), cfb)); } }' : ''}
        ${far ? 'float ffb = smoothstep(25.0, 60.0, d); if (ffb > 0.01) { vec3 sp = -vViewPosition; vec3 sx = dFdx(sp), sy = dFdy(sp); vec3 R1 = cross(sy, normal), R2 = cross(normal, sx); float det = dot(sx, R1); float H = farH(vWP) * 1.6; vec3 grad = sign(det) * (dFdx(H) * R1 + dFdy(H) * R2); normal = normalize(mix(normal, normalize(abs(det) * normal - grad), ffb * 0.8)); }' : ''} }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      { vec3 fnD = normalize(cross(dFdx(vWP), dFdy(vWP))); vec3 tw = pow(abs(fnD), vec3(4.0)); tw /= tw.x + tw.y + tw.z + 1e-4; float fnK = 1.0 - smoothstep(15.0, 70.0, length(vWP - cameraPosition));
        if (fnK > 0.01) { vec2 nx = texture2D(uDet, vWP.zy / 2.6).gb - 0.5, ny = texture2D(uDet, vWP.xz / 2.6).gb - 0.5, nz = texture2D(uDet, vWP.xy / 2.6).gb - 0.5;
          vec3 gw = vec3(0.0, nx.y, nx.x) * tw.x + vec3(ny.x, 0.0, ny.y) * tw.y + vec3(nz.x, nz.y, 0.0) * tw.z; normal = normalize(normal + (viewMatrix * vec4(gw * 3.2 * fnK, 0.0)).xyz); } } /* pass 40: triplanar detail normal: faces are no longer flat */`)
      .replace('#include <opaque_fragment>', `${key > 0 ? `{ vec3 kd = normalize((viewMatrix * vec4(${KEY}, 0.0)).xyz); outgoingLight += diffuseColor.rgb * vec3(1.0, 0.96, 0.9) * (${key.toFixed(2)} * max(dot(normal, kd), 0.0) + ${amb.toFixed(2)}); }` : ''}
      #include <opaque_fragment>`);
  };
  return m;
}

// rock-only soft key light from the concept camera's upper-left/front (concept: foreground rocks sunlit from the left)
const KEY = (() => { const v = new THREE.Vector3(-Rt.x * 0.65 - F.x * 0.35, 0.72, -Rt.z * 0.65 - F.z * 0.35).normalize(); return `vec3(${v.x.toFixed(3)}, ${v.y.toFixed(3)}, ${v.z.toFixed(3)})`; })();
// main rover track: from just ahead of the concept camera, curving down the lookout to the hub (concept: track from the bottom centre)
export const TRACK_MAIN = (t) => { const k = 1 - THREE.MathUtils.smoothstep(t, 0.0, 0.35); return sd(0.3 + Math.sin(t * 2.6) * 3 - t * 3 - 1.6 * k, -52.6 + t * 41.6); }; // start bends to the bottom-centre of the concept frame
const TRACK_PTS = Array.from({ length: 47 }, (_, i) => TRACK_MAIN(i / 46)); const nearTrack = (x, z, w) => TRACK_PTS.some(p => Math.hypot(p.x - x, p.z - z) < w);
const CLEAR = sd(-3, -21.5);
function blocked(x, z, pad) { if (Math.hypot(x - CLEAR.x, z - CLEAR.z) < 2.5 + pad * 0.5) return true; for (const c of colliders) if (Math.hypot(x - c.x, z - c.z) < c.r + pad) return true; return false; }

// ---------- per-frame area culling + distance LOD for instanced rocks (constant draw calls) ----------
export class InstanceCuller {
  constructor() { this.kinds = []; this.frustum = new THREE.Frustum(); this.pm = new THREE.Matrix4(); this.last = new THREE.Matrix4(); this.lastPos = new THREE.Vector3(1e9, 0, 0); this.sphere = new THREE.Sphere(); }
  add(kind) { this.kinds.push(kind); return kind; }
  update(camera, force = false) {
    camera.updateMatrixWorld();
    const moved = camera.position.distanceToSquared(this.lastPos) > 0.5; const turned = !this.last.equals(camera.matrixWorld);
    if (!force && !moved && !turned) return; this.lastPos.copy(camera.position); this.last.copy(camera.matrixWorld);
    this.pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); this.frustum.setFromProjectionMatrix(this.pm);
    const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
    for (const k of this.kinds) {
      const counts = k.lods.map(() => 0); const arr = k.lods.map(l => l.mesh.instanceMatrix.array);
      for (const it of k.items) {
        const d2 = ((it.x - cx) ** 2 + (it.y - cy) ** 2 + (it.z - cz) ** 2) * it.lodK; // size-aware LOD: small rocks drop detail sooner
        let li = -1; for (let i = 0; i < k.lods.length; i++) if (d2 < k.lods[i].d2) { li = i; break; }
        if (li < 0) continue;
        this.sphere.center.set(it.x, it.y, it.z); this.sphere.radius = it.r + 2.5;
        if (!this.frustum.intersectsSphere(this.sphere)) continue;
        arr[li].set(it.m, counts[li] * 16); counts[li]++;
      }
      k.lods.forEach((l, i) => { l.mesh.count = counts[i]; l.mesh.visible = counts[i] > 0; l.mesh.instanceMatrix.needsUpdate = true; l.mesh.instanceMatrix.clearUpdateRanges?.(); });
    }
  }
  stats() { const o = {}; for (const k of this.kinds) o[k.name] = k.lods.map(l => l.mesh.count + '×' + (l.mesh.geometry.attributes.position.count / 3)); return o; }
}
let LOD_SCALE = 1; // low preset shortens all rock LOD distances
function makeKind(scene, name, lods, items, mat, castShadow) {
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const single = lods.length === 1; const its = items.map(o => { q.setFromEuler(e.set(o.r[0], o.r[1], o.r[2])); m4.compose(new THREE.Vector3(o.x, o.y, o.z), q, new THREE.Vector3(...o.s)); const r = Math.max(...o.s) * 1.6; const sn = Math.min(1, Math.max(0.3, r / 2.4)); return { x: o.x, y: o.y, z: o.z, r, lodK: o.lodK ?? (single ? 1 : 1 / (sn * sn)), m: m4.toArray() }; });
  const kind = { name, items: its, lods: lods.map(([g, dist], i) => { const im = new THREE.InstancedMesh(g, mat, Math.max(1, its.length)); im.count = 0; im.frustumCulled = false; im.castShadow = typeof castShadow === 'number' ? i < castShadow : (castShadow && i === 0 || castShadow === 'all'); im.receiveShadow = true; im.name = name + '_lod' + i; scene.add(im); return { mesh: im, d2: (dist * LOD_SCALE) ** 2 }; }) };
  return kind;
}

export function buildRocks(scene, culler, quality = 1) { LOD_SCALE = quality < 0.7 ? 0.6 : quality < 0.9 ? 0.8 : 1;
  const mat = rockMaterial(true, 0.2, false, 1.0, true, false, 0.24); mat.color.setScalar(0.95); const matFar = rockMaterial(true, 0.0, true, 2.0, false, true, 0.0); matFar.flatShading = false; mat.flatShading = false; matFar.color.setScalar(0.42); { const ob = matFar.onBeforeCompile, ok = matFar.customProgramCacheKey; matFar.customProgramCacheKey = () => ok() + 'near'; matFar.onBeforeCompile = (sh) => { ob(sh); sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', '{ float dn = length(vWP - cameraPosition); float nk = 1.0 - smoothstep(6.0, 28.0, dn); outgoingLight += diffuseColor.rgb * nk * (0.34 + 0.8 * max(dot(normal, normalize(vec3(-0.45, 0.7, 0.55))), 0.0)); } /* pass 24: lift foreground rock facets out of black */\n#include <opaque_fragment>'); }; } const matDebris = rockMaterial(true, 0.0, true, 2.0, false, false, 0.04); matDebris.color.setScalar(0.32); /* pass 17: debris uses the dark rock tone (no pale chips near camera spots) */ /* debris: smooth normals -> no sub-pixel black/white facet speckle */ const matWall = rockMaterial(true, 1.2, false, 0.35, true, false, 0.32, 1.0, 1.0); /* pass 18: layered/cracked cliff relief */ matWall.color.setScalar(1.05); matWall.flatShading = false;
  const L = { crumb: [], pebble: [], rubble: [], bA: [], bB: [], bC: [], cliff: [], peak: [], wall: [] };
  const K = CONCEPT; const cgy = groundAt(K.cat.x, K.cat.z); const ccam = new THREE.PerspectiveCamera(K.fov, 16 / 9, 0.2, 5000);
  ccam.position.set(K.cam.x, cgy + K.eye, K.cam.z); ccam.lookAt(K.target.x, cgy + K.eye - K.drop, K.target.z); ccam.updateMatrixWorld(); ccam.updateProjectionMatrix();
  const _v = new THREE.Vector3();
  // keep the concept framing readable: nothing may cover the base silhouette / beacon / cat
  const occludes = (x, z, top) => { const dist = Math.hypot(x - K.cam.x, z - K.cam.z); if (dist > 54 || dist < 1) return false; _v.set(x, top, z).project(ccam); if (_v.z > 1) return false; const px = (_v.x * 0.5 + 0.5) * 1024, py = (0.5 - _v.y * 0.5) * 576; return (px > 265 && px < 850 && py < 440 && py > 40) || (dist < 42 && px > 740 && py < 330) || (dist < 37 && px > 720 && px < 940 && py > 280 && py < 500) || (dist < 6 && px > 60 && px < 330 && py < 560); };
  const PCAM0 = sd(-4.5, -26.5); // gameplay start camera
  const put = (list, x, z, s, sink = 0.3, tilt = 0.35, sy = 1) => { if (s > 0.25 && Math.hypot(x - K.cam.x, z - K.cam.z) < 16 && nearTrack(x, z, 0.7 + s)) return; /* keep the concept's bottom-centre track lane open */ if ((list === L.bA || list === L.bB || list === L.bC || (list === L.rubble && s > 0.2)) && (Math.hypot(x - K.cam.x, z - K.cam.z) < 16 || Math.hypot(x - PCAM0.x, z - PCAM0.z) < 10)) { list = L.peak; sy *= 1.25; } else if ((list === L.crumb || list === L.pebble || list === L.rubble) && s > 0.2 && Math.hypot(x - K.cam.x, z - K.cam.z) < 8) { list = L.peak; s *= 0.8; } /* concept foreground: dark faceted outcrops, not pale boulders */ const f = s * 0.8; const y = Math.min(groundAt(x, z), groundAt(x + f, z), groundAt(x - f, z), groundAt(x, z + f), groundAt(x, z - f)) - s * sink; list.push({ x, y, z, s: [s * (0.8 + rnd() * 0.5), s * (0.65 + rnd() * 0.55) * sy, s * (0.8 + rnd() * 0.5)], r: [(rnd() - 0.5) * tilt, rnd() * Math.PI * 2, (rnd() - 0.5) * tilt] }); };
  const bl = () => [L.bA, L.bB, L.bC][Math.floor(rnd() * 3)];
  const viewOK = (x, z, s, k = 0.85) => !occludes(x, z, groundAt(x, z) + s * k);
  // rock clusters: a few boulders surrounded by rubble (like the concept's chunky ground)
  const clusters = [];
  for (let i = 0, t = 0; i < 190 * quality && t < 5000; t++) {
    const m = rnd(); let x, z;
    if (m < 0.25) { const p = sd((rnd() - 0.5) * 70, -64 + rnd() * 44); x = p.x; z = p.z; } // concept foreground band
    else if (m < 0.4) { const a = rnd() * 6.283, r = 6 + Math.sqrt(rnd()) * 18; x = LOOKOUT.x + Math.cos(a) * r; z = LOOKOUT.z + Math.sin(a) * r; }
    else if (m < 0.48) { const p = sd(-3 + (rnd() - 0.5) * 30, -21 + (rnd() - 0.5) * 22); x = p.x; z = p.z; }
    else if (m < 0.6) { const a = rnd() * 6.283, r = 12 + rnd() * 34; x = Math.cos(a) * r; z = Math.sin(a) * r; }
    else { const a = rnd() * 6.283, r = 44 + rnd() * 150; x = Math.cos(a) * r; z = Math.sin(a) * r; }
    if (blocked(x, z, 3)) continue; clusters.push([x, z]); i++;
  }
  for (const [cx, cz] of clusters) {
    const nb = 1 + Math.floor(rnd() * 3); const big = Math.hypot(cx, cz) > 70 ? 1.4 : 1;
    for (let k = 0; k < nb; k++) { const x = cx + (rnd() - 0.5) * 4, z = cz + (rnd() - 0.5) * 4; let s = (0.6 + rnd() ** 1.6 * 2.2) * big; { const dc = Math.hypot(x - K.cam.x, z - K.cam.z); if (dc < 36) s = Math.min(s, 0.45 + dc * 0.035); } if (blocked(x, z, 1.5) || Math.hypot(x - K.cat.x, z - K.cat.z) < 2.2 || !viewOK(x, z, s)) continue; put(bl(), x, z, s, 0.3); }
    const nr = 4 + Math.floor(rnd() * 6);
    for (let k = 0; k < nr; k++) { const a = rnd() * 6.283, r = 1 + rnd() * 5; const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; const s = 0.15 + rnd() ** 2 * 0.7; if (blocked(x, z, 0.6) || !viewOK(x, z, s, 0.6)) continue; put(L.rubble, x, z, s, 0.25, 0.9); }
  }
  // scattered rubble everywhere in the hub + dense on the lookout
  for (let i = 0, t = 0; i < 420 * quality && t < 20000; t++) {
    const m = rnd(); let x, z;
    if (m < 0.22) { const a = rnd() * 6.283, r = Math.sqrt(rnd()) * 20; x = LOOKOUT.x + Math.cos(a) * r; z = LOOKOUT.z + Math.sin(a) * r; }
    else if (m < 0.5) { const p = sd((rnd() - 0.5) * 60, -58 + rnd() * 44); x = p.x; z = p.z; }
    else { const a = rnd() * 6.283, r = 8 + Math.sqrt(rnd()) * 110; x = Math.cos(a) * r; z = Math.sin(a) * r; }
    const s = 0.12 + rnd() ** 2.2 * 0.8; if (blocked(x, z, 0.5) || !viewOK(x, z, s, 0.6)) continue; put(L.rubble, x, z, s, 0.38, 0.45); i++;
  }
  // hand-placed hero boulders for the concept framing (bottom-left / bottom-right clusters)
  // hand-composed foreground rocks for the concept framing: placed by casting rays through screen pixels of the concept camera
  const ray = new THREE.Vector3(); const screenPut = (px, py, k, list, flat = false) => { ray.set(px / 1024 * 2 - 1, 1 - py / 576 * 2, 0.5).unproject(ccam).sub(ccam.position).normalize();
    for (let t = 0.6; t < 140; t += 0.2) { const x = ccam.position.x + ray.x * t, y = ccam.position.y + ray.y * t, z = ccam.position.z + ray.z * t; if (y < groundAt(x, z)) { if (Math.hypot(x - K.cat.x, z - K.cat.z) < 1.1) return; if (t > 30 || (flat && t > 9 && rnd() < 0.55)) return; const slab0 = list === L.peak; let sz = flat ? Math.min(k * (0.16 + t * 0.02), 0.95) : Math.min(k * t * 0.045, 1.3);
        if (flat || slab0) { const g0 = groundAt(x, z); const lim = (px > 250 && px < 880) ? 452 : 405; for (let it = 0; it < 12; it++) { _v.set(x, g0 + sz * 0.85, z).project(ccam); if ((0.5 - _v.y * 0.5) * 576 >= lim) break; sz *= 0.8; } if (sz < 0.07) return; } const slab = list === L.peak; if (nearTrack(x, z, 0.9 + (slab ? sz : 0))) return; put(list, x, z, slab ? sz * 1.15 : sz, slab ? 0.22 : flat ? 0.1 : 0.35, slab ? 0.25 : flat ? 0.22 : 0.4, slab ? 0.95 : flat ? 0.75 : 1); return; } } };
  for (const [px, py, k] of [[30, 560, 1.3], [150, 575, 1.0], [250, 568, 1.1], [20, 430, 1.2], [70, 470, 0.8], [330, 455, 0.9], [270, 420, 0.7], [440, 470, 0.8],
    [790, 590, 1.6], [850, 560, 1.5], [930, 540, 1.3], [1010, 470, 1.3], [880, 470, 0.9], [960, 410, 1.0], [760, 470, 0.7],
    [340, 405, 0.5], [600, 420, 0.45], [880, 380, 0.6], [990, 360, 0.6], [250, 380, 0.55], [460, 410, 0.45]]) screenPut(px, py, k, L.peak);
  // HERO slabs: a few big sunlit chiselled rocks in the concept's bottom band; each is sized so its top projects to the art's rock top
  const heroPut = (px, py, topY, sx = 1.25, sy = 1) => { ray.set(px / 1024 * 2 - 1, 1 - py / 576 * 2, 0.5).unproject(ccam).sub(ccam.position).normalize();
    for (let t = 0.6; t < 60; t += 0.1) { const x = ccam.position.x + ray.x * t, y = ccam.position.y + ray.y * t, z = ccam.position.z + ray.z * t; if (y < groundAt(x, z)) {
      if (Math.hypot(x - K.cat.x, z - K.cat.z) < 1.3 || nearTrack(x, z, 1.8)) return; const g0 = groundMesh(x, z); let lo = 0.2, hi = 4;
      for (let it = 0; it < 18; it++) { const m = (lo + hi) / 2; _v.set(x, g0 + m * 0.62 * sy, z).project(ccam); if ((0.5 - _v.y * 0.5) * 576 > topY) lo = m; else hi = m; }
      const sz = lo; L.peak.push({ x, y: g0 - sz * 0.18, z, s: [sz * sx, sz * 0.8 * sy, sz * (0.9 + rnd() * 0.3)], r: [(rnd() - 0.5) * 0.12, rnd() * 6.28, (rnd() - 0.5) * 0.12] }); return; } } };
  for (const [px, py, top, sx, sy] of [[205, 574, 462, 0.9, 1.3], [60, 566, 420, 0.9, 1.7], [150, 575, 455, 0.9, 1.5], [215, 572, 486, 1.2, 1], [770, 575, 505, 1.1, 1], [955, 528, 395, 0.9, 1.6], [1012, 478, 360, 0.8, 1.8], [870, 572, 450, 0.9, 1.5], [20, 520, 380, 0.8, 1.8]]) heroPut(px, py, top, sx, sy); // dark jagged outcrops framing the bottom corners; centre left open for the track
  const PCAM = sd(-4.5, -26.5); // approx. gameplay start camera position
  // MID-GROUND rubble field between the foreground ledge and the base (concept: rock clusters + broken ground left/right of the base)
  for (let gy = 372; gy < 466; gy += 12) for (let gx = -10; gx < 1040; gx += 34) { if (rnd() < 0.64) continue; const px = gx + (rnd() - 0.5) * 26, py = gy + (rnd() - 0.5) * 10;
    ray.set(px / 1024 * 2 - 1, 1 - py / 576 * 2, 0.5).unproject(ccam).sub(ccam.position).normalize();
    for (let t = 8; t < 90; t += 0.4) { const x = ccam.position.x + ray.x * t, y = ccam.position.y + ray.y * t, z = ccam.position.z + ray.z * t; if (y < groundAt(x, z)) {
      if (t < 16 || blocked(x, z, 1.6) || nearTrack(x, z, 1.2) || Math.hypot(x, z) < 21 || Math.hypot(x - PCAM.x, z - PCAM.z) < 8) break; // keep the gameplay camera's near field clean
      const k = t * 0.024; put(bl(), x, z, k * (0.7 + rnd() ** 1.5 * 1.8), 0.22, 0.4, 1.35);
      const nr = 1 + Math.floor(rnd() * 2); for (let q = 0; q < nr; q++) { const a = rnd() * 6.283, r = k * (1.5 + rnd() * 3); const xx = x + Math.cos(a) * r, zz = z + Math.sin(a) * r; if (!blocked(xx, zz, 0.6)) put(bl(), xx, zz, k * (0.25 + rnd() * 0.45), 0.22, 0.4, 1.2); }
      break; } } }
  // dense chunky foreground (concept: jagged slabs + rubble filling the bottom of the frame around the cat's ledge)
  for (let gy = 455; gy < 595; gy += 26) for (let gx = -10; gx < 1050; gx += 56) { const px = gx + (rnd() - 0.5) * 30, py = gy + (rnd() - 0.5) * 14; if (px > 20 && px < 290 && py < 500) continue; if (rnd() < 0.8) continue; if (px > 420 && px < 720 && py > 470) continue; /* track lane */ screenPut(px, py, 0.8 + rnd() * 2.0, L.peak, true); }
  // rocky ledge under the cat: one big flat-topped boulder matching LEDGE (groundAt is raised there, so feet are grounded) + lower stepped rocks at its front/right edge
  { const gb = Math.min(groundMesh(LEDGE.x, LEDGE.z), groundMesh(LEDGE.x + 1.4, LEDGE.z), groundMesh(LEDGE.x - 1.4, LEDGE.z), groundMesh(LEDGE.x, LEDGE.z + 1.4), groundMesh(LEDGE.x, LEDGE.z - 1.4)); const top = gb + LEDGE.h;
    L.peak.push({ x: LEDGE.x, y: top - 0.53 * 1.7, z: LEDGE.z, s: [1.6, 1.7, 1.75], r: [0, 0.4, 0] });
    for (const [ds, dd, s0, hh] of (() => { const o = [[1.5, -0.4, 0.75, 0.66], [-1.6, -0.5, 0.75, 0.7]]; for (let k = 0; k < 13; k++) { const a = -0.3 + k / 12 * 3.6, rr = 1.45 + rnd() * 1.3; o.push([Math.cos(a) * rr, Math.sin(a) * rr, 0.3 + rnd() * 0.3, Math.max(0.12, 0.62 - (rr - 1.45) * 0.38) + rnd() * 0.1]); } return o; })()) { /* many medium jagged rocks stepping down from the ledge instead of a few big smooth slabs */
      const p = sd(ds, dd), o = sd(0, 0); const x = LEDGE.x + p.x - o.x, z = LEDGE.z + p.z - o.z; const g0 = groundMesh(x, z); L.peak.push({ x, y: g0 + hh - 0.53 * s0, z, s: [s0 * 1.1, s0, s0], r: [0, rnd() * 6.28, 0] }); } }
  // rocky texture left of the cat: layered slabs on the hill side seen at the left edge of the concept frame
  for (let i = 0; i < 24; i++) { const px = rnd() * 120, py = 250 + rnd() * 300; ray.set(px / 1024 * 2 - 1, 1 - py / 576 * 2, 0.5).unproject(ccam).sub(ccam.position).normalize();
    for (let t = 0.6; t < 90; t += 0.3) { const x = ccam.position.x + ray.x * t, y = ccam.position.y + ray.y * t, z = ccam.position.z + ray.z * t; if (y < groundAt(x, z)) { if (Math.hypot(x - K.cat.x, z - K.cat.z) < 1.4) break; const sz = Math.min(0.5 + t * 0.06, 2.6) * (0.5 + rnd() * 0.8); put(L.peak, x, z, sz, 0.3, 0.35, 0.7 + rnd() * 0.4); break; } } }
  for (let i = 0; i < 90; i++) { const px = rnd() * 1024, py = 420 + rnd() * 160; if (px > 20 && px < 290 && py < 500) continue; screenPut(px, py, 0.3 + rnd() * 0.5, L.rubble, true); }
  // cliff slabs on steep slopes (jagged faceted rims / crater walls)
  for (let i = 0, t = 0; i < 140 * quality && t < 60000; t++) {
    const a = rnd() * 6.283, r = 50 + rnd() ** 1.3 * 650; const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const sl = slopeAt(x, z); if (sl < 0.3 || blocked(x, z, 6) || Math.hypot(x - PORTAL.x, z - PORTAL.z) < 20 || Math.hypot(x - (PORTAL.x + CAVE.x) / 2, z - (PORTAL.z + CAVE.z) / 2) < 22 || Math.hypot(x - CAVE.x, z - CAVE.z) < 16 || Math.hypot(x - LOOKOUT.x, z - LOOKOUT.z) < 30) continue;
    const s = (r < 150 ? 2 : 4) + rnd() * (r < 150 ? 5 : 11); if (!viewOK(x, z, s, 1.1)) continue; put(L.cliff, x, z, s, 0.62, 0.3, 1.0); i++;
  }
  // portal crater wall: extra jagged slabs around the cave mouth
  for (let i = 0; i < 26; i++) { const a = (i / 26 - 0.5) * 2.8; const yaw = Math.atan2(-0.592, 0.806) * 0 + 0; const p = { x: CAVE.x + Math.cos(a + 0.6) * (13 + rnd() * 9), z: CAVE.z + Math.sin(a + 0.6) * (13 + rnd() * 9) }; if (Math.hypot(p.x - PORTAL.x, p.z - PORTAL.z) < 16) continue; { const ux = CAVE.x - PORTAL.x, uz = CAVE.z - PORTAL.z, ul = Math.hypot(ux, uz); const tt = Math.max(0, Math.min(1.6, ((p.x - PORTAL.x) * ux + (p.z - PORTAL.z) * uz) / (ul * ul))); if (Math.hypot(p.x - PORTAL.x - ux * tt, p.z - PORTAL.z - uz * tt) < 13) continue; } put(L.cliff, p.x, p.z, 3 + rnd() * 4, 0.4, 0.8, 1.2); }
  // jagged distant mountain rim (big faceted peaks)
  for (let i = 0; i < 70; i++) { const a = rnd() * 6.283, r = 280 + rnd() * 400; const s0 = 9 + rnd() * 11; const tilt = (rnd() - 0.5) * 0.35;
    for (let k = 0; k < 3; k++) { const rr = r + k * s0 * 0.7 + (rnd() - 0.5) * 6, aa = a + (rnd() - 0.5) * 0.05; const x = Math.cos(aa) * rr, z = Math.sin(aa) * rr; const s = s0 * (1 - k * 0.18);
      const gy = Math.min(groundAt(x, z), groundAt(x + Math.sin(aa) * s * 1.5, z - Math.cos(aa) * s * 1.5), groundAt(x - Math.sin(aa) * s * 1.5, z + Math.cos(aa) * s * 1.5)); const it = { x, y: gy - s * 0.25 + k * s0 * 0.3, z, s: [s * (1.6 + rnd() * 0.8), s * (0.9 + rnd() * 0.6), s * (0.9 + rnd() * 0.4)], r: [tilt * 0.3 + (rnd() - 0.5) * 0.06, -aa + Math.PI / 2 + (rnd() - 0.5) * 0.3, (rnd() - 0.5) * 0.25] }; if (Math.hypot(x - REGIONS.launch.x, z - REGIONS.launch.z) > 118 && canyonInfo(x, z).d > 105 && Math.hypot(x - REGIONS.echo.x, z - REGIONS.echo.z) > 130) L.wall.push(it); /* pass 22: no peak slabs in/over the canyon either */ /* keep the launch complex clear of peak slabs (rnd sequence unchanged) */ } }
  // crater walls: connected massifs ringing the hub (r 105-175). Crest heights follow ONE continuous rugged profile instead of per-piece random peaks,
  // so overlapping pieces fuse into big cliff masses. In the concept frame the profile is authored in screen space: a big continuous massif rising
  // behind the base on the left-middle and a lower broken ridge on the right.
  { const wr = seeded(7331); // own RNG: the skyline never shifts with quality level or edits elsewhere
    const n1 = (u, sd0) => noise2(u, sd0) * 0.5 + 0.5;
    const SKY = [[0, 100], [100, 108], [170, 124], [230, 117], [290, 122], [330, 156], [420, 166], [470, 177], [560, 187], [640, 175], [700, 192], [820, 196], [930, 154], [1024, 150]]; // measured from the concept art's skyline
    const skyY = (px) => { let k = 1; while (k < SKY.length - 1 && SKY[k][0] < px) k++; const [x0, y0] = SKY[k - 1], [x1, y1] = SKY[k]; const t = THREE.MathUtils.clamp((px - x0) / (x1 - x0), 0, 1); const b = y0 + (y1 - y0) * t * t * (3 - 2 * t);
      return b + 9 * (n1(px / 38, 3.3) - 0.5) + 4 * (n1(px / 13, 7.1) - 0.5); };
    const prof = (a) => 0.7 + 0.45 * n1(Math.cos(a) * 1.6, Math.sin(a) * 1.6) + 0.15 * n1(Math.cos(a) * 6, Math.sin(a) * 6); // off-frame: continuous profile
    for (let i = 0; i < 190; i++) { const a = i / 190 * Math.PI * 2 + (wr() - 0.5) * 0.02;
      const r0 = 108 + 40 * n1(Math.cos(a) * 2.1 + 5, Math.sin(a) * 2.1) + wr() * 10; const s0 = 7 + wr() * 5;
      for (let k = 0; k < 2; k++) { const rr = r0 + k * s0 * 1.1 + wr() * 3, aa = a + (wr() - 0.5) * 0.015; const x = Math.cos(aa) * rr, z = Math.sin(aa) * rr; const s = s0 * (1 - k * 0.1);
        const gy = Math.min(groundAt(x, z), groundAt(x + Math.sin(aa) * s, z - Math.cos(aa) * s), groundAt(x - Math.sin(aa) * s, z + Math.cos(aa) * s)); const base = gy + k * 2.5;
        let hy = Math.min(s * 1.6 * prof(aa) * (0.9 + wr() * 0.2), 30);
        _v.set(x, base, z).project(ccam); const px = (_v.x * 0.5 + 0.5) * 1024;
        if (_v.z < 1 && px > -80 && px < 1100) { const ty = skyY(THREE.MathUtils.clamp(px, 0, 1024)) - k * 7 + (wr() - 0.5) * 6; let lo = base, hi = base + 90; // binary-search the crest height that lands on the screen-space skyline
          for (let it = 0; it < 22; it++) { const mid = (lo + hi) / 2; _v.set(x, mid, z).project(ccam); if ((0.5 - _v.y * 0.5) * 576 > ty) lo = mid; else hi = mid; }
          hy = THREE.MathUtils.clamp((lo - base) / 0.78, 2.5, 60); }
        L.wall.push({ x, y: base + hy * 0.25, z, s: [s * (2.2 + wr() * 1.6), hy, s * (1.0 + wr() * 0.6)], r: [(wr() - 0.5) * 0.08, -aa + Math.PI / 2 + (wr() - 0.5) * 0.7, (wr() - 0.5) * 0.12], lodK: k ? 100 : undefined /* back layer: always the cheap 20-tri LOD */ }); } } }
  // FAR RIDGE LAYER: one cheap ring mesh (~1.3k tris, 1 draw) of big irregular hazy mountains at r 330-430 receding behind the massif.
  // In the concept frame its crest is authored ~20-60 px above the massif skyline (taller jagged peaks behind the cave on the right).
  { const fr = seeded(9917); const n1 = (u, v) => noise2(u, v) * 0.5 + 0.5; const M = 170, pos = [], col = [];
    const SKY = [[0, 100], [100, 108], [170, 124], [230, 117], [290, 122], [330, 156], [420, 166], [470, 177], [560, 187], [640, 175], [700, 192], [820, 196], [930, 154], [1024, 150]];
    const sky0 = (px) => { let k = 1; while (k < SKY.length - 1 && SKY[k][0] < px) k++; const [x0, y0] = SKY[k - 1], [x1, y1] = SKY[k]; const t = THREE.MathUtils.clamp((px - x0) / (x1 - x0), 0, 1); return y0 + (y1 - y0) * t; };
    const ring = []; let ang = 0;
    // a few big irregular mountains (angular centre, half-width, height) instead of per-vertex teeth
    const peaks = []; { let a0 = fr() * 0.2; while (a0 < Math.PI * 2) { const w = 0.08 + fr() ** 1.2 * 0.22, h = 0.3 + fr() ** 1.5 * 0.7; peaks.push([a0, w, h]); if (fr() < 0.35) peaks.push([a0 + (fr() - 0.5) * w, w * (0.3 + fr() * 0.3), Math.min(1, h * (0.9 + fr() * 0.5))]); a0 += w * (0.55 + fr() * 0.9); } }
    const lift = (a) => { let keep = 1; for (const [c, w, h] of peaks) { const d = Math.abs(Math.atan2(Math.sin(a - c), Math.cos(a - c))) / w; if (d < 1.6) { const f = d < 1 ? Math.pow(1 - d, 0.9) * 0.82 + 0.18 * (1 - d / 1.6) : 0.18 * (1 - d / 1.6); keep *= 1 - h * f; } } /* soft union: overlapping mountains fuse into ranges with shoulders */ const base = 0.16 + 0.16 * n1(Math.cos(a) * 3.1, Math.sin(a) * 3.1); const L = 1 - keep; return Math.max(L, base) * (0.78 + 0.3 * n1(Math.cos(a) * 9, Math.sin(a) * 9) + 0.14 * n1(Math.cos(a) * 34, Math.sin(a) * 34)); };
    for (let i = 0; i < M; i++) { ang = (i + (fr() - 0.5) * 0.6) / M * Math.PI * 2; const R = 360 + 60 * n1(Math.cos(ang) * 1.7, Math.sin(ang) * 1.7) + fr() * 15; const x = Math.cos(ang) * R, z = Math.sin(ang) * R; const gy = groundAt(x, z);
      const Lf = lift(ang); let top = gy + 22 + 80 * Lf;
      _v.set(x, gy, z).project(ccam); const px = (_v.x * 0.5 + 0.5) * 1024;
      if (_v.z < 1 && px > -60 && px < 1090) { const pxc = THREE.MathUtils.clamp(px, 0, 1024); const right = THREE.MathUtils.smoothstep(pxc, 760, 900);
        const ty = sky0(pxc) + 16 - Lf * (40 + 22 * right) - 4 * right; /* only the tallest peaks clear the massif skyline */ let lo = gy, hi = gy + 260;
        for (let it = 0; it < 22; it++) { const mid = (lo + hi) / 2; _v.set(x, mid, z).project(ccam); if ((0.5 - _v.y * 0.5) * 576 > ty) lo = mid; else hi = mid; } top = Math.max(lo, gy + 12); }
      ring.push({ x, z, gy, top, R }); }
    // shared-vertex grid (M angles x 5 rows) -> smooth normals, lit like the terrain; spurs/gullies from angular ridged noise give real relief
    const ROWS = [0, 0.55, 0.8, 0.93, 1], NR = ROWS.length; const pos2 = [], col2 = [], idx = [];
    const rock = new THREE.Color('#a8a49e'), haze = new THREE.Color('#8e98a6'), tmp = new THREE.Color();
    const rdg = (a, f) => { const v = Math.abs(noise2(Math.cos(a) * f, Math.sin(a) * f)); return 1 - v; }; // ridged along the ring: 1 on spur crests
    for (let i = 0; i < M; i++) { const P = ring[i]; const a = Math.atan2(P.z, P.x); const ux = P.x / P.R, uz = P.z / P.R; const H = P.top - P.gy + 6;
      const sp = rdg(a, 48) * 0.65 + rdg(a + 1.3, 110) * 0.35; // spur (1) vs gully (0)
      for (let r = 0; r < ROWS.length; r++) { const t = ROWS[r]; const tt = r === ROWS.length - 1 ? 1 : Math.pow(t, 0.85 + 0.3 * (1 - sp));
        const out = (1 - t) * H * (0.9 - 0.6 * sp) + (1 - sp) * H * 0.1 * t; // gullies cut back (outward), spurs reach toward the hub - also in the visible upper rows
        const y = P.gy - 6 + H * tt - (1 - sp) * H * 0.1 * t * t; // gullies notch the crest
        pos2.push(P.x + ux * out, y, P.z + uz * out);
        tmp.copy(rock).lerp(haze, 0.3 + 0.2 * t).multiplyScalar((0.66 + 0.42 * sp) * (0.8 + 0.25 * t)); col2.push(tmp.r, tmp.g, tmp.b); } }
    for (let i = 0; i < M; i++) { const j = (i + 1) % M; for (let r = 0; r < NR - 1; r++) { const a0 = i * NR + r, a1 = a0 + 1, b0 = j * NR + r, b1 = b0 + 1; idx.push(a0, a1, b0, a1, b1, b0); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos2, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col2, 3)); g.setIndex(idx); g.computeVertexNormals();
    { const n = g.attributes.normal, p3 = g.attributes.position; let dotS = 0; for (let k = 0; k < n.count; k++) dotS += -(n.getX(k) * p3.getX(k) + n.getZ(k) * p3.getZ(k)); if (dotS < 0) { for (let k = 0; k < idx.length; k += 3) { const t0 = idx[k]; idx[k] = idx[k + 2]; idx[k + 2] = t0; } g.setIndex(idx); g.computeVertexNormals(); } } // front faces toward the hub
    const m = rockMaterial(true, 0.0, true, 1.7, false, false, 0.22); m.color.setScalar(1.0); // same fake key + ambient as the massif, smooth normals
    const mesh = new THREE.Mesh(g, m); mesh.name = 'farRidge'; mesh.frustumCulled = false; scene.add(mesh); }
  // crumbs: dense angular fragments in the concept foreground, the lookout and the gameplay start area
  for (let i = 0, t = 0; i < 1400 * quality && t < 40000; t++) { const m = rnd(); let x, z;
    if (m < 0.4) { const p = sd((rnd() - 0.5) * 34, -60 + rnd() * 22); x = p.x; z = p.z; } else if (m < 0.8) { const p = sd(-3 + (rnd() - 0.5) * 36, -21 + (rnd() - 0.5) * 30); x = p.x; z = p.z; } else { const a = rnd() * 6.283, r = 8 + Math.sqrt(rnd()) * 60; x = Math.cos(a) * r; z = Math.sin(a) * r; }
    if (blocked(x, z, 0.2)) continue; const s = 0.05 + rnd() ** 2.5 * 0.3; put(L.crumb, x, z, s, 0.42, 0.3); i++; }
  // pebbles: dense small stones across the hub floor (gameplay view)
  for (let i = 0, t = 0; i < 500 * quality && t < 30000; t++) { const a = rnd() * 6.283, r = 6 + Math.sqrt(rnd()) * 70; const x = Math.cos(a) * r, z = Math.sin(a) * r; if (blocked(x, z, 0.3)) continue; const s = 0.07 + rnd() ** 2 * 0.22; put(L.pebble, x, z, s, 0.3, 1.2); i++; }
  // gameplay area: scattered small stones + small crater rims of rocks around the hub
  for (let i = 0, t = 0; i < 200 * quality && t < 8000; t++) { const p = sd(-3 + (rnd() - 0.5) * 34, -21 + (rnd() - 0.5) * 30); if (blocked(p.x, p.z, 0.4)) continue; put(L.rubble, p.x, p.z, 0.07 + rnd() ** 2 * 0.3, 0.3, 0.8); i++; }
  for (let c = 0, t = 0; c < 16 && t < 400; t++) { const a = rnd() * 6.283, r = 12 + rnd() * 34; const cx = Math.cos(a) * r, cz = Math.sin(a) * r; const cr = 1.4 + rnd() * 2.4; if (blocked(cx, cz, cr + 1)) continue; c++;
    const n = Math.round(cr * 7); for (let k = 0; k < n; k++) { const b = k / n * 6.283 + rnd() * 0.3; const rr = cr * (0.92 + rnd() * 0.2); const x = cx + Math.cos(b) * rr, z = cz + Math.sin(b) * rr; put(L.bB, x, z, 0.16 + rnd() * 0.22, 0.35, 0.6, 0.7); } }
  // pass 17: the biggest smooth slabs along the concept frame's bottom edge -> clusters of medium jagged rocks (same footprint/height, more facets)
  { const out = []; let nSplit = 0; const big = L.peak.map((it, i) => { _v.set(it.x, it.y + it.s[1] * 0.5, it.z).project(ccam); return { it, i, px: (_v.x * 0.5 + 0.5) * 1024, py: (0.5 - _v.y * 0.5) * 576, d: Math.hypot(it.x - K.cam.x, it.z - K.cam.z), sm: Math.max(...it.s) }; })
      .filter(o => o.py > 470 && o.px > -80 && o.px < 1100 && o.d < 14 && o.sm > 1.0 && Math.hypot(o.it.x - LEDGE.x, o.it.z - LEDGE.z) > 2.6).sort((a, b) => b.sm - a.sm).slice(0, 9);
    const drop = new Set(big.map(o => o.i));
    for (const { it } of big) { const n = 5 + Math.floor(rnd() * 3); const R0 = Math.max(it.s[0], it.s[2]) * 0.75; nSplit++;
      for (let k = 0; k < n; k++) { const a = k / n * 6.283 + rnd() * 0.8, rr = k === 0 ? 0 : R0 * (0.45 + rnd() * 0.55); const x = it.x + Math.cos(a) * rr, z = it.z + Math.sin(a) * rr; if (nearTrack(x, z, 0.8) || Math.hypot(x - K.cat.x, z - K.cat.z) < 1.2) continue;
        const sc = (k === 0 ? 0.62 : 0.32 + rnd() * 0.26); const sx = it.s[0] * sc, sy = it.s[1] * sc * (1.15 + rnd() * 0.5), sz = it.s[2] * sc; const g0 = groundAt(x, z);
        out.push({ x, y: g0 + sy * (0.18 + rnd() * 0.12), z, s: [sx, sy, sz], r: [(rnd() - 0.5) * 0.5, rnd() * 6.28, (rnd() - 0.5) * 0.5] }); } }
    const kept = L.peak.filter((_, i) => !drop.has(i)); L.peak.length = 0; L.peak.push(...kept, ...out); window.__split = nSplit; }
  // merge lists: two prototypes (3 LODs each), one debris layer, one strata layer -> 8 instanced draws total
  const half = (l) => [l.filter((_, i) => i % 2 === 0), l.filter((_, i) => i % 2 === 1)]; const [c0, c1] = half(L.cliff);
  const A = [...L.bA, ...L.bC, ...L.bB, ...c0, ...c1]; // one boulder prototype (saves 3 main + 2 shadow draws)
  // pass 20: rock seated on a slope: up axis follows the ground normal, sunk on the downhill side so nothing floats on steep walls
  const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _eu = new THREE.Euler(), _n = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
  const slopeRock = (x, z, sz, rr) => { const e = Math.max(1.0, sz * 0.8); const hx = groundAt(x + e, z) - groundAt(x - e, z), hz = groundAt(x, z + e) - groundAt(x, z - e); _n.set(-hx / (2 * e), 1, -hz / (2 * e)).normalize(); const steep = 1 - _n.y;
    _qa.setFromUnitVectors(_up, _n.clone().lerp(_up, 0.25).normalize()); _qb.setFromAxisAngle(_up, rr() * 6.283); _qa.multiply(_qb); _eu.setFromQuaternion(_qa, 'XYZ');
    const f = sz * 0.7; const gmin = Math.min(groundAt(x, z), groundAt(x + f, z), groundAt(x - f, z), groundAt(x, z + f), groundAt(x, z - f)); const sy = sz * (0.55 + rr() * 0.45);
    return { x, y: (groundAt(x, z) + gmin) / 2 - sy * (0.25 + steep * 0.45), z, s: [sz * (0.8 + rr() * 0.5), sy, sz * (0.8 + rr() * 0.5)], r: [_eu.x, _eu.y, _eu.z] }; };
  // pass 20: rubble + boulders around the launch complex, canyon and echo field (kept out of structure footprints)
  { const r4 = seeded(2020); const free = (x, z, pad) => !KEEP.some(k => Math.hypot(x - k.x, z - k.z) < k.r + pad);
    const zone = (R, r0, r1, n, bigP, bigS, ok = () => true) => { for (let c = 0, t = 0; c < Math.round(n * quality) && t < n * 30; t++) { const a = r4() * 6.283, d = r0 + Math.sqrt(r4()) * (r1 - r0); const x = R.x + Math.cos(a) * d, z = R.z + Math.sin(a) * d; const big = r4() < bigP; const sz = big ? 1.0 + r4() ** 1.6 * bigS : 0.3 + r4() * 0.5; if (!free(x, z, sz + 1.5) || !ok(x, z, sz)) continue; A.push(slopeRock(x, z, sz, r4)); c++; } };
    zone(REGIONS.launch, 20, 130, 420, 0.3, 3.0); { const r5 = seeded(2222); const s0 = canyonS(REGIONS.canyon.x, REGIONS.canyon.z); for (let c = 0, t = 0; c < Math.round(380 * quality) && t < 8000; t++) { const p = canyonPoint(s0 - 195 + r5() * 390, (r5() - 0.5) * 34); const ci = canyonInfo(p.x, p.z); const sz = 0.25 + r5() ** 2.0 * 1.5; if (ci.d > ci.fl - 1 || !free(p.x, p.z, sz + 1)) continue; A.push(slopeRock(p.x, p.z, sz, r5)); c++; } } /* pass 22: scattered floor rocks along the canyon */ zone(REGIONS.echo, 14, 110, 320, 0.4, 3.5); zone(REGIONS.canyon, 10, 150, 420, 0.5, 5.0, (x, z, sz) => { const ci = canyonInfo(x, z); if (ci.d < ci.fl - sz) return true; if (ci.d > ci.fl + ci.ww + 4) return true; const e = sz + 1.5; return ci.fr > 0.74 && ci.fr < 0.98 && Math.abs(groundAt(x + e, z) - groundAt(x - e, z)) + Math.abs(groundAt(x, z + e) - groundAt(x, z - e)) < e * 0.9; }); /* pass 22: canyon rocks only on the floor, ledges and rim - never hanging off a riser */ }
  // pass 19: boulders + rubble on the reactor crater walls/floor (own RNG; drawn only near the region via LOD distance)
  { const r3 = seeded(1919); const R = REGIONS.reactor; const ah = Math.atan2(-R.z, -R.x); const ad = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
    for (let n = 0, t = 0; n < Math.round(900 * quality) && t < 30000; t++) { const a = r3() * 6.283, d = 27 + Math.sqrt(r3()) * 100; const x = R.x + Math.cos(a) * d, z = R.z + Math.sin(a) * d;
      if (d > 24 && ad(a, ah) * d < 9 + d * 0.06) continue; /* service road */ let bad = false; for (let i = 0; i < 14; i += 2) if (ad(a, i / 14 * 6.283) * d < 3.5 && d < 92) bad = true; for (let i = 0; i < 6; i++) { const ta = i / 6 * 6.283 + 0.3; if (Math.hypot(x - R.x - Math.cos(ta) * 33, z - R.z - Math.sin(ta) * 33) < 7.5) bad = true; } for (let i = 0; i < 14; i++) { const ba = i / 14 * 6.283; if (Math.hypot(x - R.x - Math.cos(ba) * 92, z - R.z - Math.sin(ba) * 92) < 8) bad = true; } if (bad) continue;
      const big = r3() < 0.55; const sz = big ? 1.2 + r3() ** 1.6 * 4.0 : 0.35 + r3() * 0.5; A.push(slopeRock(x, z, sz, r3)); n++; } }
  const debris = [...L.rubble, ...L.pebble, ...L.crumb];
  // pass 18: sparse small stones scattered over the walkable hub floor (gameplay view life); own RNG so other placements don't reshuffle; 1 draw call, no shadows/collision
  const matScatter = rockMaterial(true, 0.0, true, 0.15, false, false, 0.02); matScatter.color.setRGB(0.27, 0.262, 0.25); /* ground-matching regolith tone, smooth rounded shading */
  const scatter = []; { const r2 = seeded(1818); const PS = sd(-3, -21); let t = 0;
    while (scatter.length < Math.round(720 * quality * (quality < 0.7 ? 0.3 : 1)) && t++ < 40000) { let x, z; const m = r2(); if (m < 0.12) { const a = r2() * 6.283, r = 0.5 + Math.sqrt(r2()) * 6; x = PCAM0.x + (PS.x - PCAM0.x) * 0.6 + Math.cos(a) * r; z = PCAM0.z + (PS.z - PCAM0.z) * 0.6 + Math.sin(a) * r; } /* right in front of the play camera */ else if (m < 0.36) { const a = r2() * 6.283, r = 1.5 + Math.sqrt(r2()) * 13; x = (PS.x + PCAM0.x) / 2 + Math.cos(a) * r; z = (PS.z + PCAM0.z) / 2 + Math.sin(a) * r; } /* denser around the gameplay start */ else if (m < 0.7) { const a = r2() * 6.283, r = 2.5 + Math.sqrt(r2()) * 30; x = PS.x + Math.cos(a) * r; z = PS.z + Math.sin(a) * r; } else { const a = r2() * 6.283, r = 8 + Math.sqrt(r2()) * 36; x = Math.cos(a) * r; z = Math.sin(a) * r; }
      if (Math.hypot(x, z) > 46 || Math.hypot(x - K.cam.x, z - K.cam.z) < 14 || Math.hypot(x - PS.x, z - PS.z) < 1.1 || colliders.some(c => Math.hypot(x - c.x, z - c.z) < c.r + 1.6) || /* no collision: the spawn clearing may have pebbles */ nearTrack(x, z, 1.3) || LAMPS.some(l => Math.hypot(l.x - x, l.z - z) < 1.7) || slopeAt(x, z) > 0.8) continue;
      const s = 0.08 + r2() ** 2.8 * 0.4; const sy = s * (0.36 + r2() * 0.28); const f = s * 0.6; const y = Math.min(groundAt(x, z), groundAt(x + f, z), groundAt(x - f, z), groundAt(x, z + f), groundAt(x, z - f)) - sy * 0.22; /* many tiny, few medium; flat and partly sunk */
      scatter.push({ x, y, z, s: [s * (0.85 + r2() * 0.45), sy, s * (0.75 + r2() * 0.45)], r: [(r2() - 0.5) * 0.12, r2() * 6.283, (r2() - 0.5) * 0.12], lodK: (() => { const dK = Math.hypot(x - K.cam.x, z - K.cam.z) - 3; return dK < 34 ? (34 / dK) ** 2 : 1; })() /* draw range shrinks so the concept camera never draws them (its triangle budget) */ }); } }
  L.scatter = scatter;
  const kinds = {
    rockA: makeKind(scene, 'rockA', [[creaseRock(protoGeom(1, 2, [1.25, 0.75, 1.05]), 62), 8], [creaseRock(protoGeom(1, 2, [1.25, 0.75, 1.05]), 62), 24], [creaseRock(protoGeom(0, 2, [1.25, 0.75, 1.05], 0.3), 62), 116]], A, mat, 2),
    debris: makeKind(scene, 'debris', [[creaseRock(chiselGeom(14, 6, 0), 50), 7.5]], debris, matDebris, 0),
    scatter: makeKind(scene, 'scatter', [[pebbleGeom(23), 27]], scatter, matScatter, 0),
    strata: makeKind(scene, 'strata', [[creaseRock(chiselGeom(9, 16, 2), 38), 6.5], [creaseRock(chiselGeom(9, 12, 1), 38), 14], [creaseRock(chiselGeom(9, 12, 0), 45), 95]], L.peak, matFar, 0),
    wall: makeKind(scene, 'wall', [[creaseRock(mesaGeom(protoGeom(1, 33, [1, 1, 1], 0.55), 33), 60), 118], [creaseRock(mesaGeom(protoGeom(0, 33, [1, 1, 1], 0.45), 33), 60), 3000]], L.wall, matWall, 0),
  };
    for (const k of Object.values(kinds)) culler.add(k);
  // contact shadows / crevices: every rock near the hub darkens the regolith around its base (painted into the terrain AO map in main.js)
  const contacts = []; for (const k of ['bA', 'bB', 'bC', 'cliff', 'peak', 'rubble', 'pebble', 'crumb']) for (const it of L[k]) { const sx = Array.isArray(it.s) ? Math.max(it.s[0], it.s[2]) : it.s; if (Math.abs(it.x) < 75 && Math.abs(it.z) < 75) contacts.push([it.x, it.z, sx, k === 'crumb' || k === 'pebble' ? 0.5 : 1]); } for (const it of scatter) contacts.push([it.x, it.z, Math.max(it.s[0], it.s[2]) * 1.15, 0.85]); /* pebble contact shadows in the terrain AO map */
  return { kinds, contacts, counts: Object.fromEntries(Object.entries(L).map(([k, v]) => [k, v.length])) };
}

// ---------- crystals: floating gold/amber diamonds + ground clusters (amber, cyan) in ONE instanced draw ----------
function diamondGeom() {
  const n = 6, rr = 0.42, ht = 0.62, hb = 1.15; const pos = [];
  for (let i = 0; i < n; i++) { const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2; const p0 = [Math.cos(a0) * rr, 0, Math.sin(a0) * rr], p1 = [Math.cos(a1) * rr, 0, Math.sin(a1) * rr]; pos.push(...p0, 0, ht, 0, ...p1); pos.push(...p1, 0, -hb, 0, ...p0); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  // face shading gradient baked in vertex colors (bright tip, deeper base)
  const P = g.attributes.position, col = []; for (let i = 0; i < P.count; i++) { const y = P.getY(i); const t = (y + hb) / (hb + ht); col.push(0.75 + 0.25 * t, 0.75 + 0.25 * t, 0.75 + 0.25 * t); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}
// pass 23: cluster of 5 faceted hexagonal shards (prism + pointed tip), brightness ramp base->tip baked in vertex colour
function shardClusterGeom() { const pos = [], col = []; const S = [[0, 0, 0, 1.0, 0.26], [0.32, 0.5, 0.15, 0.62, 0.2], [-0.3, -0.45, 0.25, 0.7, 0.19], [0.1, 2.3, -0.35, 0.5, 0.16], [-0.2, 3.6, 0.42, 0.45, 0.15]];
  const v = new THREE.Vector3(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (const [ox, ang, tl, h, w] of S) { const H = h * 2.2, Hb = H * 0.68; q.setFromEuler(e.set(tl, ang, tl * 0.6)); const off = new THREE.Vector3(ox * Math.cos(ang), 0, ox * Math.sin(ang));
    const P = (a, y, rr) => v.set(Math.cos(a) * rr, y, Math.sin(a) * rr).applyQuaternion(q).add(off).toArray(); const n = 6;
    for (let i = 0; i < n; i++) { const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2; const b0 = P(a0, -0.3, w), b1 = P(a1, -0.3, w), t0 = P(a0, Hb, w * 0.92), t1 = P(a1, Hb, w * 0.92), tip = P(0, H, 0);
      pos.push(...b0, ...t0, ...b1, ...b1, ...t0, ...t1, ...t0, ...tip, ...t1); col.push(0.45, 0.45, 0.45, 0.8, 0.8, 0.8, 0.45, 0.45, 0.45, 0.45, 0.45, 0.45, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 1, 1, 1, 0.8, 0.8, 0.8); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); return g; }
export function buildCrystals(scene, envMap, lite = false) {
  const g = diamondGeom();
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, metalness: 0.55, roughness: 0.18, flatShading: true, emissive: '#ffffff', emissiveIntensity: 1, envMap, envMapIntensity: 1.6 });
  mat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance *= vColor.rgb * vColor.rgb * 2.25; /* pass 24: stronger halos (crystals only) */'); };
  const items = [], regC = [], regE = []; // pass 23: canyon/echo cyan crystals -> separate shard-cluster meshes (frustum-culled, region only)
  const gold = new THREE.Color('#f5b83a'), amber = new THREE.Color('#ff9a2e'), cyan = new THREE.Color('#5ee6ec');
  // floating gold diamonds (hub), several placed to match the concept composition
  const hubSpots = [[-27, -44, 2.6], [-17, -26, 2.2], [-9, 16, 3.5], [-3, -30, 2.4], [5.5, 27, 2.8], [16, 18, 2.6], [29, -2, 2.3], [31, 12, 2.6], [21, -24, 2.2], [-31, -12, 2.6], [-40, 18, 3.0], [40, 30, 2.6], [12, -36, 2.3], [-14, 40, 3.2], [36, -30, 2.6], [-48, -30, 2.8], [46, -8, 2.4], [-2, 48, 3],
    [-9.5, -52, 2.1], [-6, -47, 2.6], [4, -38, 2.0], [-12, -30, 3.2], [8, -18, 2.4], [17, -26, 2.0], [26, -12, 2.8], [33, 4, 3.4], [-21, -8, 2.6], [-26, 10, 3.0], [12, 6, 4.5], [-4, 6, 4.8], [20, 30, 3.6], [42, 14, 3.0], [-36, -40, 3.6], [-16, -60, 2.6]];
  for (const [s, d, h] of hubSpots) { const p = sd(s, d); items.push({ x: p.x, y: groundAt(p.x, p.z) + h, z: p.z, s: 0.55 + rnd() * 0.45, c: rnd() < 0.8 ? gold : amber, bob: true, ph: rnd() * 6 }); }
  for (let i = 0; i < 26; i++) { const a = rnd() * 6.283, r = 50 + rnd() * 120; const x = Math.cos(a) * r, z = Math.sin(a) * r; if (blocked(x, z, 4)) continue; items.push({ x, y: groundAt(x, z) + 2.5 + rnd() * 3, z, s: 0.6 + rnd() * 0.5, c: gold, bob: true, ph: rnd() * 6 }); }
  // amber ground clusters
  for (let i = 0; i < 24; i++) { const a = rnd() * 6.283, r = 48 + rnd() * 110; const cx = Math.cos(a) * r, cz = Math.sin(a) * r; if (blocked(cx, cz, 4)) continue;
    for (let k = 0; k < 4; k++) { const x = cx + (rnd() - 0.5) * 2, z = cz + (rnd() - 0.5) * 2; items.push({ x, y: groundAt(x, z) + 0.2, z, s: 0.5 + rnd() * 0.7, c: amber, tilt: (rnd() - 0.5) * 1.0, ph: rnd() * 6 }); } }
  // cyan clusters at the portal cave mouth
  for (let i = 0; i < 9; i++) { const a = (i / 9 - 0.5) * 2.2 + Math.atan2(PORTAL.z - CAVE.z, PORTAL.x - CAVE.x); const cx = CAVE.x + Math.cos(a) * 8.5, cz = CAVE.z + Math.sin(a) * 8.5;
    for (let k = 0; k < 3; k++) { const x = cx + (rnd() - 0.5) * 1.6, z = cz + (rnd() - 0.5) * 1.6; items.push({ x, y: groundAt(x, z) + 0.3, z, s: 0.6 + rnd() * 1.0, c: cyan, tilt: (rnd() - 0.5) * 0.9, ph: rnd() * 6 }); } }
  for (let i = 0; i < 40; i++) { const t = rnd(); const j1 = rnd(), j2 = rnd(); const cp = canyonPoint(110 + t * 540, (j1 < 0.5 ? -1 : 1) * (20 + j2 * 6)); const x = cp.x, z = cp.z; /* pass 21: clusters at the foot of the winding walls */ regC.push({ x, y: groundAt(x, z) - 0.3, z, s: 1.0 + rnd() * 1.6, tilt: (rnd() - 0.5) * 0.4, ph: rnd() * 6 }); }
  for (let i = 0; i < 12; i++) { const a = rnd() * 6.28; const R = REGIONS.echo; const x = R.x + Math.cos(a) * (45 + rnd() * 20), z = R.z + Math.sin(a) * (45 + rnd() * 20); regE.push({ x, y: groundAt(x, z) - 0.3, z, s: 1.1 + rnd() * 1.4, tilt: (rnd() - 0.5) * 0.3, ph: a * 3.1 }); }
  for (let i = items.length - 1; i >= 0; i--) { const it = items[i]; if (!it.bob && Math.hypot(it.x - CONCEPT.cam.x, it.z - CONCEPT.cam.z) < 12) items.splice(i, 1); }
  // concept composition: floating diamonds at the concept's screen spots/sizes; drop procedural ones that would read big in that shot
  { const K = CONCEPT; const cgy = groundAt(K.cat.x, K.cat.z); const cc = new THREE.PerspectiveCamera(K.fov, 16 / 9, 0.2, 5000); cc.position.set(K.cam.x, cgy + K.eye, K.cam.z); cc.lookAt(K.target.x, cgy + K.eye - K.drop, K.target.z); cc.updateMatrixWorld(); cc.updateProjectionMatrix();
    const v = new THREE.Vector3(); const k = 2 * Math.tan(K.fov * Math.PI / 360) / 576;
    for (let i = items.length - 1; i >= 0; i--) { const it = items[i]; if (!it.bob) continue; v.set(it.x, it.y, it.z); const t = v.distanceTo(cc.position); v.project(cc); if (v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05 && 1.9 * it.s / (t * k) > 20) items.splice(i, 1); }
    for (const [px, py, hp, t] of [[62, 268, 62, 7], [330, 262, 30, 24], [348, 214, 15, 58], [410, 372, 30, 28], [618, 254, 15, 70], [805, 248, 20, 72], [875, 336, 28, 42], [952, 338, 46, 20], [918, 394, 30, 30], [470, 300, 14, 50], [700, 300, 16, 55], [232, 182, 24, 34], [565, 178, 16, 62], [668, 238, 32, 30], [650, 284, 19, 26], [288, 262, 19, 24], [440, 178, 14, 58], [150, 330, 20, 18], [995, 250, 26, 30]]) {
      v.set(px / 512 - 1, 1 - py / 288, 0.5).unproject(cc).sub(cc.position).normalize(); const x = cc.position.x + v.x * t, y = cc.position.y + v.y * t, z = cc.position.z + v.z * t;
      items.push({ x, y: Math.max(y, groundAt(x, z) + 0.6), z, s: hp * t * k / 1.9, c: (rnd() < 0.85 || hp >= 24) ? gold : amber, bob: true, ph: (rnd(), (px * 0.37 + py * 0.11) % 6.28) }); } } // deterministic phase per screen spot (no random mirror flash)
  if (lite) { let n = 0; for (let i = items.length - 1; i >= 0; i--) if (!items[i].bob && (n++ % 3 !== 0)) items.splice(i, 1); } // low preset: a third of the ground clusters
  const im = new THREE.InstancedMesh(g, mat, items.length);
  items.forEach((it, i) => im.setColorAt(i, it.c));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  const update = (t) => { items.forEach((it, i) => { if (!it.bob && t > 0) return; const y = it.bob ? it.y + Math.sin(t * 1.3 + it.ph) * 0.2 : it.y; q.setFromEuler(e.set(it.tilt || 0, it.bob ? t * 0.5 + it.ph : it.ph, 0)); m4.compose(v.set(it.x, y, it.z), q, sc.set(it.s, it.s * 1.08, it.s)); im.setMatrixAt(i, m4); }); im.instanceMatrix.needsUpdate = true; };
  update(0); im.frustumCulled = false; im.castShadow = false; im.name = 'crystals'; scene.add(im);
  for (const [list, nm] of [[regC, 'crystals_canyon'], [regE, 'crystals_echo']]) makeStaticCrystals(scene, lite ? list.filter((_, i) => i % 2 === 0) : list, nm, 1.45); // world crystals share the game crystal look (hex shard clusters, facets, halo, ground light)
  return { mesh: im, update, items };
}

export function beamMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPow: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
    vertexShader: `attribute vec3 color; varying vec3 vC; varying vec2 vUv; varying float vF; varying float vY;
      void main(){ vC=color; vUv=uv; vec4 mv=modelViewMatrix*vec4(position,1.); vec3 n=normalize(normalMatrix*normal); vF=abs(dot(n,normalize(-mv.xyz))); vY=position.y; gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform float uTime; uniform float uPow; varying vec3 vC; varying vec2 vUv; varying float vF; varying float vY;
      void main(){ float fade=pow(1.-vUv.y,2.6)*smoothstep(0.,0.03,vUv.y+0.02); float core=pow(vF,2.0); float fl=0.85+0.15*sin(uTime*3.+vY*0.4);
        gl_FragColor=vec4(vC*fade*core*fl*uPow,1.); }`,
  });
}
export function addBeams(b, beams) {
  for (const B of beams) b.add('beam', new THREE.CylinderGeometry(B.r * (B.taper ?? 1), B.r * 1.05, B.h, 12, 1, true).translate(0, B.h / 2, 0), { pos: [B.x, B.y, B.z], color: B.color, intensity: B.I });
}

// ---------- rover tire tracks: textured ribbons hugging the terrain ----------
export function buildTracks(scene, paths) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d');
  // one wide tread band with chevron lugs (concept: a single caterpillar trail, not twin rails)
  x.clearRect(0, 0, 64, 64); x.filter = 'blur(0.6px)'; x.fillStyle = 'rgba(30,29,28,0.38)'; x.fillRect(10, 0, 44, 64);
  x.fillStyle = 'rgba(14,13,12,0.7)'; for (let y = 0; y < 64; y += 8) { x.beginPath(); x.moveTo(12, y); x.lineTo(32, y + 4); x.lineTo(52, y); x.lineTo(52, y + 3.5); x.lineTo(32, y + 7.5); x.lineTo(12, y + 3.5); x.fill(); }
  x.fillStyle = 'rgba(235,230,220,0.24)'; x.fillRect(7, 0, 3, 64); x.fillRect(54, 0, 3, 64); x.filter = 'none';
  const tex = new THREE.CanvasTexture(c); tex.wrapS = THREE.ClampToEdgeWrapping; tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const pos = [], uv = [];
  // densify the near (concept-foreground) part of the main track so it hugs the bumpy lookout instead of sinking between samples
  const fine = (pts) => { const o = [pts[0]]; for (let i = 1; i < pts.length; i++) { const A = pts[i - 1], B = pts[i]; const n = i < 18 ? Math.ceil(Math.hypot(B.x - A.x, B.z - A.z) / 0.3) : 1; for (let k = 1; k <= n; k++) o.push({ x: A.x + (B.x - A.x) * k / n, z: A.z + (B.z - A.z) * k / n }); } return o; };
  paths = [fine(paths[0]), ...paths.slice(1)];
  for (const pts of paths) {
    let acc = 0; const W = 0.52;
    for (let i = 0; i < pts.length - 1; i++) {
      const A = pts[i], B = pts[i + 1]; const dx = B.x - A.x, dz = B.z - A.z, l = Math.hypot(dx, dz); const nx = -dz / l * W, nz = dx / l * W;
      const p = (P, s) => { const px = P.x + nx * s, pz = P.z + nz * s; return [px, groundAt(px, pz) + 0.06, pz]; };
      const a1 = p(A, -1), a2 = p(A, 1), b1 = p(B, -1), b2 = p(B, 1); const v0 = acc / 1.2, v1 = (acc + l) / 1.2; acc += l;
      pos.push(...a1, ...b1, ...a2, ...a2, ...b1, ...b2); uv.push(0, v0, 0, v1, 1, v0, 1, v0, 0, v1, 1, v1);
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); { const n = new Float32Array(pos.length); for (let k = 1; k < n.length; k += 3) n[k] = 1; g.setAttribute('normal', new THREE.BufferAttribute(n, 3)); } /* pass 26: up-facing normals (no terrain facet shading) */
  const m = new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 1, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true; mesh.name = 'tracks'; mesh.renderOrder = 2; scene.add(mesh); return mesh;
}
