import * as THREE from 'three';
import { mergeGeometries } from '../vendor/three/jsm/utils/BufferGeometryUtils.js';
import { swatchUV, glowUV, rectUV } from './atlas.js';

// Accumulates static geometry and bakes it into a few merged meshes.
// 'ivory' | 'dark' | 'gold' | 'glow' | 'tex' (atlas region) all end up in ONE atlas-textured mesh ('hull').
// 'lattice' (alpha-tested, double sided) and 'beam' (additive) stay separate.
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _c = new THREE.Color();
export class Builder {
  constructor() { this.groups = {}; }
  add(group, geom, o = {}) {
    let g = geom.index ? geom.toNonIndexed() : geom.clone();
    if (o.matrix) _m.copy(o.matrix); else {
      const p = o.pos || [0, 0, 0], r = o.rot || [0, 0, 0], s = o.scale === undefined ? [1, 1, 1] : (typeof o.scale === 'number' ? [o.scale, o.scale, o.scale] : o.scale);
      if (o.quat) _q.copy(o.quat); else _q.setFromEuler(_e.set(r[0], r[1], r[2], o.order || 'YXZ'));
      _m.compose(new THREE.Vector3(...p), _q, new THREE.Vector3(...s));
    }
    g.applyMatrix4(_m);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    const n = g.attributes.position.count; const P = g.attributes.position;
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    const uv = g.attributes.uv; const col = new Float32Array(n * 3); const I = o.intensity ?? 1;
    const colorAt = (i) => typeof o.color === 'function' ? o.color(P.getX(i), P.getY(i), P.getZ(i)) : null;
    if (group === 'beam') {
      if (o.uvY !== undefined) for (let i = 0; i < n; i++) uv.setY(i, o.uvY);
      _c.set(o.color || '#ffffff'); for (let i = 0; i < n; i++) { col[i * 3] = _c.r * I; col[i * 3 + 1] = _c.g * I; col[i * 3 + 2] = _c.b * I; }
    } else if (group === 'glow') {
      for (let i = 0; i < n; i++) { const cc = colorAt(i); let u; if (cc) { _c.setRGB(cc[0], cc[1], cc[2]); const mx = Math.max(cc[0], cc[1], cc[2]); u = glowUV(_c.clone().multiplyScalar(1 / mx), mx); } else u = glowUV(o.color || '#ffb347', I); uv.setXY(i, u[0], u[1]); col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 1; }
    } else {
      if (group === 'tex' || group === 'lattice') {
        const [u0, v0, u1, v1] = rectUV(group === 'lattice' ? 'lattice' : o.region);
        let mnu = 1e9, mxu = -1e9, mnv = 1e9, mxv = -1e9; for (let i = 0; i < n; i++) { mnu = Math.min(mnu, uv.getX(i)); mxu = Math.max(mxu, uv.getX(i)); mnv = Math.min(mnv, uv.getY(i)); mxv = Math.max(mxv, uv.getY(i)); }
        const du = (mxu - mnu) || 1, dv = (mxv - mnv) || 1; const pad = 0.0015;
        for (let i = 0; i < n; i++) { let tu = (uv.getX(i) - mnu) / du, tv = (uv.getY(i) - mnv) / dv; if (o.flipV) tv = 1 - tv; uv.setXY(i, u0 + pad + tu * (u1 - u0 - 2 * pad), v0 + pad + tv * (v1 - v0 - 2 * pad)); }
      } else { const s = swatchUV(group); for (let i = 0; i < n; i++) uv.setXY(i, s[0], s[1]); }
      if (typeof o.color === 'function') for (let i = 0; i < n; i++) { const cc = colorAt(i); col.set(cc, i * 3); }
      else { _c.set(o.color || '#ffffff'); for (let i = 0; i < n; i++) { col[i * 3] = _c.r * I; col[i * 3 + 1] = _c.g * I; col[i * 3 + 2] = _c.b * I; } }
      if (o.ao) { const y0 = o.ao[0], y1 = o.ao[1]; for (let i = 0; i < n; i++) { const t = THREE.MathUtils.clamp((P.getY(i) - y0) / (y1 - y0), 0, 1); const f = 0.6 + 0.4 * t; col[i * 3] *= f; col[i * 3 + 1] *= f; col[i * 3 + 2] *= f; } }
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (o.flip) flipGeom(g);
    const key = group === 'beam' ? 'beam' : group === 'lattice' ? 'lattice' : 'hull';
    (this.groups[key] ||= []).push(g);
    return g;
  }
  tris() { const o = {}; for (const [k, l] of Object.entries(this.groups)) o[k] = l.reduce((s, g) => s + g.attributes.position.count / 3, 0); return o; }
  build(materials, parent, suffix = '') {
    const out = {};
    for (const [k, list] of Object.entries(this.groups)) {
      const merged = mergeGeometries(list, false); merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, materials[k]); mesh.name = 'merged_' + k + suffix;
      mesh.castShadow = k !== 'beam'; mesh.receiveShadow = k !== 'beam';
      if (k === 'beam') mesh.renderOrder = 10;
      parent.add(mesh); out[k] = mesh;
    }
    return out;
  }
}
export function flipGeom(g) {
  const A2 = ['position', 'normal', 'color', 'uv'].map(k => g.attributes[k]).filter(Boolean);
  for (let i = 0; i < g.attributes.position.count; i += 3) for (const A of A2) for (let c = 0; c < A.itemSize; c++) { const t = A.array[i * A.itemSize + c]; A.array[i * A.itemSize + c] = A.array[(i + 2) * A.itemSize + c]; A.array[(i + 2) * A.itemSize + c] = t; }
  const N = g.attributes.normal; if (N) for (let i = 0; i < N.array.length; i++) N.array[i] *= -1;
}
// geometry quality scale (low preset for phones sets GQ.s < 1 before the hub is built): fewer segments, same shapes/UV layout
export const GQ = { s: 1 };
const q = (n, min) => GQ.s === 1 ? n : Math.max(min, Math.round(n * GQ.s));
export const G = {
  cyl: (rt, rb, h, seg = 24, open = false) => new THREE.CylinderGeometry(rt, rb, h, q(seg, 6), 1, open).translate(0, h / 2, 0),
  box: (w, h, d) => new THREE.BoxGeometry(w, h, d),
  torus: (R, t, rs = 5, ts = 28, arc = Math.PI * 2) => new THREE.TorusGeometry(R, t, q(rs, 3), q(ts, 6), arc),
  cap: (r, ws = 28, hs = 10, theta = Math.PI / 2) => new THREE.SphereGeometry(r, q(ws, 8), q(hs, 3), 0, Math.PI * 2, 0, theta),
  sphere: (r, ws = 12, hs = 8) => new THREE.SphereGeometry(r, q(ws, 6), q(hs, 4)),
  cone: (r, h, seg = 12) => new THREE.ConeGeometry(r, h, q(seg, 5)).translate(0, h / 2, 0),
  ring: (ri, ro, seg = 40) => new THREE.RingGeometry(ri, ro, q(seg, 12)).rotateX(-Math.PI / 2),
  disc: (r, seg = 40) => new THREE.CircleGeometry(r, q(seg, 12)).rotateX(-Math.PI / 2),
  octa: (r) => new THREE.OctahedronGeometry(r, 0),
  plane: (w, h) => new THREE.PlaneGeometry(w, h),
};
export function quatFromDir(dir) { return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()); }
