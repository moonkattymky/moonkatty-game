import * as THREE from 'three';
import { groundAt } from './terrain.js';

// World collision for the cat: every rock instance (boulders, cliff slabs, crater massifs, strata outcrops, rubble/pebbles),
// the region structures (launch complex, reactor crater, canyon, echo) and the hub hull are rasterised once at load into
// sparse top-height grids ("solid columns"). The controller then
//   - stands on the highest solid under its footprint (small rocks / pads / ledges are stepped onto, jet-landing on boulder tops works),
//   - is blocked by anything that rises more than CAT.step above its feet (boulders, cliffs, walls),
// and every spawn / teleport / quest marker is pushed to the nearest spot where the capsule is free (nearestFree).
// Geometry that only hangs overhead (> CAT.head above the terrain: dish bowls, pipe runs, floating crystals, roofs) does not
// create a column; it is recorded in an 'over' grid so a spawn never lands under/inside a roof.
export const CAT = { rb: 0.45, rs: 0.36, step: 0.42, head: 2.0, clear: 8 };

class SolidMap {
  constructor(cell, n) { this.c = cell; this.n = n; this.tiles = new Map(); this.cells = 0; }
  _t(ci, cj, make) { const n = this.n, tx = Math.floor(ci / n), tz = Math.floor(cj / n); const k = (tx + 8192) * 16384 + (tz + 8192); let t = this.tiles.get(k);
    if (!t && make) { t = { top: new Float32Array(n * n).fill(-Infinity), over: null }; this.tiles.set(k, t); } return t ? [t, (ci - tx * n) + (cj - tz * n) * n] : null; }
  put(x, z, y, mode) { const r = this._t(Math.floor(x / this.c), Math.floor(z / this.c), mode !== 1); if (!r) return; const [t, i] = r;
    if (mode === 0) { if (y > t.top[i]) t.top[i] = y; } else if (mode === 1) { if (t.top[i] > -Infinity && y > t.top[i]) t.top[i] = y; } else { if (!t.over) { t.over = new Float32Array(this.n * this.n).fill(Infinity); t.otop = new Float32Array(this.n * this.n).fill(-Infinity); } if (y < t.over[i]) t.over[i] = y; if (y > t.otop[i]) t.otop[i] = y; } }
  // rasterise one triangle: its three edges (thin / vertical faces) + every cell centre inside it (plane height)
  tri(ax, ay, az, bx, by, bz, cx, cy, cz, mode) { const c = this.c, h = c * 0.5;
    const edge = (x0, y0, z0, x1, y1, z1) => { const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / h) + 1; for (let i = 0; i <= n; i++) { const t = i / n; this.put(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, y0 + (y1 - y0) * t, mode); } };
    edge(ax, ay, az, bx, by, bz); edge(bx, by, bz, cx, cy, cz); edge(cx, cy, cz, ax, ay, az);
    const det = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz); if (Math.abs(det) < 1e-6) return;
    const i0 = Math.floor(Math.min(ax, bx, cx) / c), i1 = Math.floor(Math.max(ax, bx, cx) / c), j0 = Math.floor(Math.min(az, bz, cz) / c), j1 = Math.floor(Math.max(az, bz, cz) / c);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const x = (i + 0.5) * c, z = (j + 0.5) * c;
      const l1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / det, l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / det, l3 = 1 - l1 - l2;
      if (l1 >= 0 && l2 >= 0 && l3 >= 0) { let y = l1 * ay + l2 * by + l3 * cy;
        if (mode === 0 || mode === 1) { /* conservative: the plane's highest point over the whole cell (a corner), capped at the triangle top */ const gx = ((by - cy) * (az - cz) - (ay - cy) * (bz - cz)) / det, gz = ((ay - cy) * (bx - cx) - (by - cy) * (ax - cx)) / det; y = Math.min(Math.max(ay, by, cy), y + (Math.abs(gx) + Math.abs(gz)) * h); }
        this.put(x, z, y, mode); } } }
  // max column top (or min overhead height) over all cells touching the disc (x, z, r)
  query(x, z, r, over) { const c = this.c; let best = over ? Infinity : -Infinity;
    const i0 = Math.floor((x - r) / c), i1 = Math.floor((x + r) / c), j0 = Math.floor((z - r) / c), j1 = Math.floor((z + r) / c);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const qx = Math.max(i * c, Math.min(x, (i + 1) * c)), qz = Math.max(j * c, Math.min(z, (j + 1) * c)); if ((qx - x) ** 2 + (qz - z) ** 2 > r * r) continue;
      const t = this._t(i, j, false); if (!t) continue; if (over) { if (t[0].over) best = Math.min(best, t[0].over[t[1]]); } else best = Math.max(best, t[0].top[t[1]]); }
    return best; }
  // overhead slabs (geometry hanging above the terrain: dish bowls, pipe runs, gantry arms, floating crystals) as [over, otop] per cell
  slab(x, z, r, fn) { const c = this.c; const i0 = Math.floor((x - r) / c), i1 = Math.floor((x + r) / c), j0 = Math.floor((z - r) / c), j1 = Math.floor((z + r) / c);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const qx = Math.max(i * c, Math.min(x, (i + 1) * c)), qz = Math.max(j * c, Math.min(z, (j + 1) * c)); if ((qx - x) ** 2 + (qz - z) ** 2 > r * r) continue;
      const t = this._t(i, j, false); if (!t || !t[0].over) continue; const lo = t[0].over[t[1]]; if (lo < Infinity) fn(lo, t[0].otop[t[1]]); } }
}

export function buildSolids({ rocks, meshes, colliders }) {
  const t0 = performance.now(); const fine = new SolidMap(0.25, 32), coarse = new SolidMap(0.5, 32);
  const v = new THREE.Vector3(), m4 = new THREE.Matrix4(); let ntri = 0;
  const posOf = (g) => { const P = g.attributes.position.array, I = g.index ? g.index.array : null; return { P, I, n: I ? I.length : P.length / 3 }; };
  // rocks: closed lumps resting on the terrain -> every triangle builds the column
  const addRock = (map, g, m) => { const { P, I, n } = posOf(g); const e = m.elements; const W = new Float32Array(P.length);
    for (let i = 0; i < P.length; i += 3) { const x = P[i], y = P[i + 1], z = P[i + 2]; W[i] = e[0] * x + e[4] * y + e[8] * z + e[12]; W[i + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; W[i + 2] = e[2] * x + e[6] * y + e[10] * z + e[14]; }
    for (let k = 0; k < n; k += 3) { const a = (I ? I[k] : k) * 3, b = (I ? I[k + 1] : k + 1) * 3, c = (I ? I[k + 2] : k + 2) * 3; map.tri(W[a], W[a + 1], W[a + 2], W[b], W[b + 1], W[b + 2], W[c], W[c + 1], W[c + 2], 0); ntri++; } };
  for (const [name, kind] of Object.entries(rocks.kinds)) { const map = name === 'wall' ? coarse : fine;
    // collide with every LOD that can be on screen while the cat is near (rockA lod0==lod1; strata lod0/lod1 differ -> union); back-layer walls only ever draw lod1
    const geos = kind.lods.map(l => l.mesh.geometry);
    for (const it of kind.items) { m4.fromArray(it.m); const use = name === 'strata' ? [geos[0], geos[1]] : name === 'wall' ? [it.lodK >= 100 ? geos[1] : geos[0]] : [geos[0]]; for (const g of use) addRock(map, g, m4); } }
  // structures / crystal clusters: open, arbitrary geometry -> columns only from faces that reach down near the terrain; higher faces raise an existing column (tall walls) or go to the overhead grid
  const over = [];
  const addMesh = (mesh, matrices) => { const { P, I, n } = posOf(mesh.geometry); const T = matrices || [mesh.matrixWorld];
    for (const M of T) { const e = M.elements; const w = (i) => { const x = P[i], y = P[i + 1], z = P[i + 2]; return [e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]]; };
      for (let k = 0; k < n; k += 3) { const A = w((I ? I[k] : k) * 3), B = w((I ? I[k + 1] : k + 1) * 3), C = w((I ? I[k + 2] : k + 2) * 3); ntri++;
        const low = Math.min(A[1] - groundAt(A[0], A[2]), B[1] - groundAt(B[0], B[2]), C[1] - groundAt(C[0], C[2]));
        if (low < CAT.head) fine.tri(...A, ...B, ...C, 0); else over.push(A, B, C); } } };
  for (const { mesh, matrices } of meshes) { mesh.updateMatrixWorld(true); addMesh(mesh, matrices); }
  for (let k = 0; k < over.length; k += 3) { fine.tri(...over[k], ...over[k + 1], ...over[k + 2], 1); fine.tri(...over[k], ...over[k + 1], ...over[k + 2], 2); }
  const cols = colliders.filter(c => !c.walk);
  const S = {
    CAT, fine, coarse,
    top(x, z, r = CAT.rb) { return Math.max(fine.query(x, z, r, false), coarse.query(x, z, r, false)); },
    over(x, z, r = CAT.rs) { return fine.query(x, z, r, true); },
    standAt(x, z) { return Math.max(groundAt(x, z), S.top(x, z, CAT.rs)); },
    // visual contact height (no capsule margin): solid column in the cell right under the point, never more than 0.45 m below the physics stand height
    visAt(x, z) { const s = S.standAt(x, z); return Math.min(s, Math.max(groundAt(x, z), fine.query(x, z, 0, false), coarse.query(x, z, 0, false), s - 0.45)); },
    // does the capsule span [y0, y1] overlap any overhead slab around (x, z)? returns the lowest overlapping slab bottom (or Infinity)
    slabHit(x, z, y0, y1, r = CAT.rb) { let lo = Infinity; fine.slab(x, z, r, (a, b) => { if (a < y1 && b > y0 && a < lo) lo = a; }); return lo; },
    // feet height for a cat currently at height y: terrain / column tops, or the top of an overhead slab it is above (lands on a dish rim, pipe, gantry arm)
    floorAt(x, z, y = Infinity) { let f = S.standAt(x, z); if (y < Infinity) fine.slab(x, z, CAT.rs, (a, b) => { if (b <= y + CAT.step && b > f) f = b; }); return f; }, // feet height: terrain or the top of whatever rock / pad is under the capsule
    inCollider(x, z, pad = CAT.rb) { for (const c of cols) if (Math.hypot(x - c.x, z - c.z) < c.r + pad) return true; return false; },
    // free spawn spot: nothing under the capsule rises above a step, no hub collider, no roof / overhang within CAT.clear above the feet
    isFree(x, z) { const g = groundAt(x, z); if (S.top(x, z, CAT.rb) > g + CAT.step) return false; if (S.inCollider(x, z)) return false; return S.over(x, z, CAT.rb) > S.standAt(x, z) + CAT.clear; },
    nearestFree(x, z, maxR = 60) { if (S.isFree(x, z)) return { x, z, moved: 0 };
      for (let r = 0.5; r <= maxR; r += 0.5) { const n = Math.max(8, Math.ceil(2 * Math.PI * r / 0.5)); let best = null, bd = 1e9;
        for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (!S.isFree(px, pz)) continue; const d = Math.abs(groundAt(px, pz) - groundAt(x, z)); if (d < bd) { bd = d; best = { x: px, z: pz, moved: r }; } } // nearest ring; prefer the spot at the same terrain level
        if (best) return best; }
      return { x, z, moved: -1 }; },
    stats: () => ({ ms: Math.round(performance.now() - t0), tris: ntri, tilesFine: fine.tiles.size, tilesCoarse: coarse.tiles.size, overTris: over.length / 3 }),
  };
  const st = S.stats(); S.buildMs = st.ms; S.info = st;
  return S;
}
