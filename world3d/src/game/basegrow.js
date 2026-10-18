import * as THREE from 'three';
import { mergeGeometries } from '../../vendor/three/jsm/utils/BufferGeometryUtils.js';
// ============================================================================================
// Chapter 2 base growth around the storage module (depot): ONE merged mesh for every expansion level, revealed
// by the same build shader as the depot (stage = (level-2)*3 + sub-stage: 0 floor/foundation, 1 walls/frame, 2 roof/lights).
//   L2 annex: corridor + small dome + crate stack      L3 storage racks + antenna mast + museum corner (pedestals)
//   L4 second section: big dome + corridor + solar     L5 large hangar (half-cylinder, gold bands, door lights)
// Museum artifacts: 1 extra mesh, each artifact shown when owned (uniform mask, 12 slots).
// Pieces sit on the ground under their own centre (per-piece y offset), front arc (door side, local +z) stays free for robots.
// ============================================================================================
const colorize = (g, hex) => { g = g.index ? g.toNonIndexed() : g; const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) c.toArray(a, i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k); return g; };
const IV = '#e4dccb', IV2 = '#d8cfbd', GOLD = '#d6a136', DARK = '#3a3f47', STEEL = '#9a978f', WIN = '#6fe7ff', WARM = '#ffb030', CRATE = '#8a6a3a', SOLAR = '#1d3a6a';
export const MUSEUM_SLOTS = ['ancient:tablet', 'ancient:idol', 'ancient:glyph', 'ancient:mask', 'station:badge', 'station:logbook', 'station:helmet', 'station:flag', 'meteor:shard', 'meteor:geode', 'meteor:iron', 'meteor:pearl'];

export function makeBaseGrowth(scene, p, env, { groundAt, low = false, mobile = false } = {}) {
  const yaw = p.yaw || 0, cy = Math.cos(yaw), sy = Math.sin(yaw);
  const toW = (lx, lz) => ({ x: p.x + lx * cy + lz * sy, z: p.z - lx * sy + lz * cy }); // local -> world (mesh rotation.y = yaw)
  const seg = (n) => Math.max(6, Math.round(n * (low ? 0.4 : 0.5)));
  const parts = []; const pieces = []; // pieces: {level, lx, lz, r} -> colliders
  let curOff = 0;
  const at = (lx, lz) => { const w = toW(lx, lz); curOff = groundAt(w.x, w.z) - p.y; return curOff; };
  const add = (g, col, st, lx = 0, lz = 0) => { g = colorize(g, col); g.translate(lx, curOff, lz); g.computeBoundingBox(); const b = g.boundingBox, n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([st, b.min.y, b.max.y], i * 3); g.setAttribute('aStg', new THREE.BufferAttribute(a, 3)); parts.push(g); };
  const dome = (st, lx, lz, R, H, col = IV) => { at(lx, lz); add(new THREE.CylinderGeometry(R + 0.1, R + 0.18, 0.7, seg(16)).translate(0, -0.2, 0), '#8d8a84', st, lx, lz); add(new THREE.CylinderGeometry(R, R + 0.05, H, seg(16), 1).translate(0, H / 2, 0), col, st + 1, lx, lz); add(new THREE.CylinderGeometry(R + 0.03, R + 0.03, 0.12, seg(16), 1, true).translate(0, H * 0.7, 0), GOLD, st + 1, lx, lz); add(new THREE.SphereGeometry(R, seg(16), 5, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, H, 0), '#ece4d2', st + 2, lx, lz); };
  const corridor = (st, ax, az, bx, bz, r = 0.55) => { const lx = (ax + bx) / 2, lz = (az + bz) / 2, L = Math.hypot(bx - ax, bz - az), a = Math.atan2(bx - ax, bz - az); at(lx, lz); const g = new THREE.CylinderGeometry(r, r, L, seg(10), 1, true).rotateX(Math.PI / 2).rotateY(a).translate(0, r + 0.15, 0); add(g, IV2, st + 1, lx, lz); add(new THREE.BoxGeometry(r * 2.1, 0.3, L).rotateY(a).translate(0, 0.05, 0), '#8d8a84', st, lx, lz); for (const f of [-0.3, 0.3]) add(new THREE.TorusGeometry(r + 0.03, 0.05, 4, seg(10)).rotateY(a).translate(Math.sin(a) * L * f, r + 0.15, Math.cos(a) * L * f), GOLD, st + 2, lx, lz); add(new THREE.BoxGeometry(0.06, 0.1, L * 0.7).rotateY(a).translate(0, r * 2 + 0.17, 0), WIN, st + 2, lx, lz); };
  // ---- L2 annex (stage 0..2): corridor east, small dome, crate stack ----
  corridor(0, 1.5, 0.2, 3.1, -0.3); dome(0, 4.3, -0.6, 1.3, 1.25); pieces.push({ level: 2, lx: 4.3, lz: -0.6, r: 1.45 }, { level: 2, lx: 2.4, lz: 0.0, r: 0.6 });
  at(4.4, 0.9); add(new THREE.BoxGeometry(0.44, 0.7, 0.18).translate(0, 0.5, 0.0).rotateY(0), DARK, 1, 4.4, 0.75); add(new THREE.BoxGeometry(0.3, 0.1, 0.06).translate(0, 1.0, 0.1), WIN, 2, 4.4, 0.75);
  at(3.0, 1.6); for (const [x, y, z] of [[0, 0, 0], [0.5, 0, 0.1], [0.25, 0.42, 0.05]]) add(new THREE.BoxGeometry(0.42, 0.42, 0.42).translate(x, y + 0.21, z), CRATE, 1, 3.0, 1.6); add(new THREE.BoxGeometry(0.12, 0.05, 0.43).translate(0.25, 0.85, 0.05), GOLD, 2, 3.0, 1.6); pieces.push({ level: 2, lx: 3.25, lz: 1.65, r: 0.6 });
  // ---- L3 (stage 3..5): storage racks (west), antenna mast (north-west), museum corner (south-west, open plinth) ----
  for (let k = 0; k < 3; k++) { const lx = -3.0 - k * 0.0, lz = -0.8 - k * 1.05; at(lx, lz); add(new THREE.BoxGeometry(1.0, 0.12, 0.8).translate(0, 0.0, 0), '#8d8a84', 3, lx, lz); for (const [ox, oz] of [[-0.45, -0.35], [0.45, -0.35], [-0.45, 0.35], [0.45, 0.35]]) add(new THREE.BoxGeometry(0.06, 1.5, 0.06).translate(ox, 0.75, oz), STEEL, 4, lx, lz); for (const h of [0.5, 1.0, 1.48]) add(new THREE.BoxGeometry(0.98, 0.04, 0.78).translate(0, h, 0), STEEL, 4, lx, lz); for (const [ox, h, c] of [[-0.22, 0.52, CRATE], [0.24, 0.52, '#c9973a'], [0.0, 1.02, CRATE], [0.26, 1.02, '#6fb0c8']]) add(new THREE.BoxGeometry(0.36, 0.34, 0.5).translate(ox, h + 0.17, 0), c, 5, lx, lz); add(new THREE.BoxGeometry(0.9, 0.04, 0.04).translate(0, 1.55, 0.38), WIN, 5, lx, lz); pieces.push({ level: 3, lx, lz, r: 0.62 }); }
  { const lx = -1.6, lz = -3.6; at(lx, lz); add(new THREE.CylinderGeometry(0.5, 0.6, 0.3, 8).translate(0, 0.05, 0), '#8d8a84', 3, lx, lz); const H = 5.2; for (let k = 0; k < 3; k++) { const a = k * Math.PI * 2 / 3; add(new THREE.CylinderGeometry(0.035, 0.05, H, 5).translate(Math.cos(a) * 0.28, H / 2, Math.sin(a) * 0.28), STEEL, 4, lx, lz); } for (let h = 0.6; h < H; h += 0.8) add(new THREE.TorusGeometry(0.27 - h * 0.012, 0.025, 3, 6).rotateX(Math.PI / 2).translate(0, h, 0), STEEL, 4, lx, lz);
    add(new THREE.SphereGeometry(0.85, seg(14), 5, 0, Math.PI * 2, 0, Math.PI * 0.32).rotateX(-Math.PI * 0.62).translate(0, H + 0.25, 0.1), '#ece4d2', 5, lx, lz); add(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 5).rotateX(-0.95).translate(0, H + 0.3, 0.45), GOLD, 5, lx, lz); add(new THREE.SphereGeometry(0.1, 6, 4).translate(0, H + 0.9, 0), WARM, 5, lx, lz); pieces.push({ level: 3, lx, lz, r: 0.75 }); }
  const museum = { lx: -3.4, lz: 2.0 }; { const { lx, lz } = museum; at(lx, lz); add(new THREE.CylinderGeometry(1.5, 1.6, 0.5, 6).translate(0, 0.0, 0), '#8d8a84', 3, lx, lz); add(new THREE.CylinderGeometry(1.42, 1.42, 0.06, 6).translate(0, 0.27, 0), GOLD, 4, lx, lz);
    for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + Math.PI / 6; add(new THREE.BoxGeometry(0.08, 1.9, 0.08).translate(Math.cos(a) * 1.38, 1.2, Math.sin(a) * 1.38), IV2, 4, lx, lz); } add(new THREE.TorusGeometry(1.38, 0.05, 4, 6).rotateX(Math.PI / 2).rotateY(Math.PI / 6).translate(0, 2.15, 0), GOLD, 5, lx, lz);
    for (let i = 0; i < 12; i++) { const a = (i % 6) * Math.PI / 3 + (i >= 6 ? Math.PI / 6 : 0), r = i < 6 ? 1.0 : 0.45; add(new THREE.CylinderGeometry(0.13, 0.15, 0.5, 6).translate(Math.cos(a) * r, 0.52, Math.sin(a) * r), IV, 4, lx, lz); add(new THREE.BoxGeometry(0.18, 0.03, 0.03).translate(Math.cos(a) * r, 0.78, Math.sin(a) * r + 0.12), WIN, 5, lx, lz); } pieces.push({ level: 3, lx, lz, r: 1.6, museum: true }); }
  // ---- L4 second section (stage 6..8): big dome north + corridor + solar wings ----
  corridor(6, 0.2, -1.5, 0.9, -3.5); dome(6, 1.4, -5.0, 1.85, 1.6); pieces.push({ level: 4, lx: 1.4, lz: -5.0, r: 2.0 }, { level: 4, lx: 0.55, lz: -2.5, r: 0.6 });
  for (const s of [-1, 1]) { const lx = 1.4 + s * 3.0, lz = -5.6; at(lx, lz); add(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 5).translate(0, 0.6, 0), STEEL, 7, lx, lz); add(new THREE.BoxGeometry(1.6, 0.05, 0.9).rotateX(-0.5).translate(0, 1.25, 0), SOLAR, 8, lx, lz); add(new THREE.BoxGeometry(1.64, 0.02, 0.06).rotateX(-0.5).translate(0, 1.27, 0), GOLD, 8, lx, lz); pieces.push({ level: 4, lx, lz, r: 0.5 }); }
  // ---- L5 large hangar (stage 9..11): half-cylinder east-north-east, door with warm lights ----
  { const lx = 6.2, lz = -3.6, R = 2.3, Lh = 5.0, a = -0.35; at(lx, lz); add(new THREE.BoxGeometry(R * 2 + 0.4, 0.6, Lh + 0.3).rotateY(a).translate(0, -0.15, 0), '#8d8a84', 9, lx, lz);
    add(new THREE.CylinderGeometry(R, R, Lh, seg(18), 1, true, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2).rotateY(a).translate(0, 0.15, 0), IV, 10, lx, lz);
    for (const f of [-0.42, -0.14, 0.14, 0.42]) add(new THREE.CylinderGeometry(R + 0.04, R + 0.04, 0.16, seg(18), 1, true, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2).rotateY(a).translate(Math.sin(a) * Lh * f, 0.15, Math.cos(a) * Lh * f), GOLD, 11, lx, lz);
    const end = new THREE.CircleGeometry(R, seg(18), 0, Math.PI); add(end.clone().rotateY(a).translate(Math.sin(a) * -Lh / 2, 0.15, Math.cos(a) * -Lh / 2), IV2, 10, lx, lz); add(end.clone().rotateY(a + Math.PI).translate(Math.sin(a) * -Lh / 2, 0.15, Math.cos(a) * -Lh / 2), IV2, 10, lx, lz);
    const fz = Lh / 2 + 0.02; add(new THREE.CircleGeometry(R, seg(18), 0, Math.PI).rotateY(a).translate(Math.sin(a) * fz, 0.15, Math.cos(a) * fz), IV2, 10, lx, lz); add(new THREE.BoxGeometry(2.2, 1.9, 0.08).rotateY(a).translate(Math.sin(a) * (fz + 0.03), 1.1, Math.cos(a) * (fz + 0.03)), DARK, 11, lx, lz);
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.12, 1.8, 0.06).rotateY(a).translate(Math.sin(a) * (fz + 0.08) + Math.cos(a) * s * 1.2, 1.05, Math.cos(a) * (fz + 0.08) - Math.sin(a) * s * 1.2), WARM, 11, lx, lz);
    add(new THREE.BoxGeometry(2.6, 0.12, 0.06).rotateY(a).translate(Math.sin(a) * (fz + 0.08), 2.05, Math.cos(a) * (fz + 0.08)), WIN, 11, lx, lz);
    for (const f of [-0.3, 0, 0.3]) pieces.push({ level: 5, lx: lx + Math.sin(a) * Lh * f, lz: lz + Math.cos(a) * Lh * f, r: R * 0.95 }); }
  const geo = mergeGeometries(parts); geo.computeBoundingSphere(); const NS = 12;
  const uB = { value: 0 };
  const inject = (sh, ghost) => { sh.uniforms.uB = uB;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aStg; varying vec3 vStg; varying float vLY;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvStg = aStg; vLY = position.y;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uB; varying vec3 vStg; varying float vLY;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
      float sf = clamp(uB - vStg.x, 0.0, 1.0); float cut = mix(vStg.y - 0.001, vStg.z + 0.001, sf); bool built = vLY <= cut && uB > vStg.x;
      ${ghost ? 'if (built || vStg.x >= ceil(uB / 3.0 + 0.0001) * 3.0) discard;' : 'if (!built) discard; float seam = (sf < 1.0) ? 1.0 - smoothstep(0.0, 0.07, cut - vLY) : 0.0;'}`); };
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.35, roughness: 0.5, envMap: env || null, side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => { inject(sh, false); sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance = vColor.rgb * (step(0.9, vColor.b) * step(vColor.r, 0.5) * 1.6 + step(0.95, vColor.r) * step(vColor.b, 0.25) * 2.2) + vec3(1.6, 0.75, 0.25) * seam * 0.9;'); };
  mat.customProgramCacheKey = () => 'basegrow_stg';
  const m = new THREE.Mesh(geo, mat); m.name = 'ch2_base'; m.position.set(p.x, p.y, p.z); m.rotation.y = yaw; m.receiveShadow = true; m.castShadow = false; m.visible = false; scene.add(m);
  const gm = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 1.1, 1.5), transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, wireframe: true, toneMapped: false });
  gm.onBeforeCompile = (sh) => inject(sh, true); gm.customProgramCacheKey = () => 'basegrow_ghost';
  const ghost = new THREE.Mesh(geo, gm); ghost.name = 'ch2_base_ghost'; ghost.visible = false; m.add(ghost);
  // museum artifacts: small emissive-gold / stone / metal items on the 12 pedestals, shown per owned slot
  const art = []; const AC = { ancient: '#d8a640', station: '#c8ced8', meteor: '#7a6aa8' };
  MUSEUM_SLOTS.forEach((id, i) => { const [set, it] = id.split(':'); const a = (i % 6) * Math.PI / 3 + (i >= 6 ? Math.PI / 6 : 0), r = i < 6 ? 1.0 : 0.45; const x = museum.lx + Math.cos(a) * r, z = museum.lz + Math.sin(a) * r; at(museum.lx, museum.lz);
    const shapes = { tablet: new THREE.BoxGeometry(0.16, 0.22, 0.04), idol: new THREE.CapsuleGeometry(0.06, 0.12, 2, 6), glyph: new THREE.TorusGeometry(0.08, 0.025, 4, 10), mask: new THREE.SphereGeometry(0.1, 8, 5, 0, Math.PI), badge: new THREE.CylinderGeometry(0.09, 0.09, 0.03, 10).rotateX(Math.PI / 2), logbook: new THREE.BoxGeometry(0.2, 0.05, 0.15), helmet: new THREE.SphereGeometry(0.11, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.6), flag: new THREE.BoxGeometry(0.16, 0.1, 0.01).translate(0.08, 0.1, 0), shard: new THREE.OctahedronGeometry(0.1, 0).scale(0.6, 1.3, 0.6), geode: new THREE.DodecahedronGeometry(0.1, 0), iron: new THREE.IcosahedronGeometry(0.09, 0).scale(1.3, 0.8, 1), pearl: new THREE.SphereGeometry(0.08, 10, 8) };
    let g = colorize(shapes[it], AC[set]); g.translate(x, curOff + 0.9, z); const n = g.attributes.position.count, ia = new Float32Array(n).fill(i); g.setAttribute('aArt', new THREE.BufferAttribute(ia, 1)); art.push(g); });
  const ag = mergeGeometries(art); const uMask = { value: new Array(12).fill(0) };
  const am = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.6, roughness: 0.35, envMap: env || null });
  am.onBeforeCompile = (sh) => { sh.uniforms.uMask = uMask; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aArt; uniform float uMask[12]; varying float vOn;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvOn = uMask[int(aArt + 0.5)]; if (vOn < 0.5) transformed *= 0.0;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += vColor.rgb * 0.5;'); };
  am.customProgramCacheKey = () => 'museum_art';
  let artOK = false; const _aw = new THREE.Vector3(); const artM = new THREE.Mesh(ag, am); artM.name = 'ch2_museum_art'; artM.visible = false; m.add(artM);
  let spin = 0;
  const api = { mesh: m, NS, museumW: toW(museum.lx, museum.lz), pieces: pieces.map(q => ({ ...q, ...toW(q.lx, q.lz) })),
    siteW: (level) => { const P = pieces.filter(q => q.level === level); const c = P.reduce((s, q) => ({ x: s.x + q.lx / P.length, z: s.z + q.lz / P.length }), { x: 0, z: 0 }); return toW(c.x, c.z); },
    // level: built base level (1..5); building: level under construction or 0; frac 0..1 of that build
    set(level, building = 0, frac = 0) { const v = building ? (building - 2) * 3 + 3 * Math.max(0, Math.min(1, frac)) : Math.max(0, (level - 1) * 3); uB.value = v; m.visible = v > 0 || !!building; ghost.visible = !!building && frac < 1; artOK = level >= 3; artM.visible = artOK; },
    cull(cam) { if (!artOK) return; const w = toW(museum.lx, museum.lz); artM.visible = Math.hypot(w.x - cam.x, w.z - cam.z) < 10; }, // small artifacts: distance-culled (budget)
    setArtifacts(list) { MUSEUM_SLOTS.forEach((id, i) => uMask.value[i] = list.includes(id) ? 1 : 0); },
    colliders(level) { return api.pieces.filter(q => q.level <= level).map(q => ({ x: q.x, z: q.z, r: q.r, h: q.level === 3 && !q.museum ? 6 : 4.5, ch2: true })); },
    update(dt) { spin += dt; } };
  return api;
}
