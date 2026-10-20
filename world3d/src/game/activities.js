import * as THREE from 'three';
import { mergeGeometries } from '../../vendor/three/jsm/utils/BufferGeometryUtils.js';
import { makeCrystalField } from './crystal.js';
// Chapter 1 activity visuals. Everything is low-poly, instanced where repeated, frustum-culled, and only visible while relevant,
// so the always-on cost in the hub is ~1-2 draw calls (travel gate + nearby caches).

const tag = (g, k) => { g = g.index ? g.toNonIndexed() : g; g.setAttribute('aK', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count).fill(k), 1)); for (const n of ['normal']) if (g.attributes[n]) g.deleteAttribute(n); return g; };
const colorize = (g, col) => { g = g.index ? g.toNonIndexed() : g.clone(); for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); if (!g.attributes.normal) g.computeVertexNormals(); const c = new THREE.Color(col), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) c.toArray(a, i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
const place = (g, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) => g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new THREE.Vector3(...s)));

// ---------- travel gate: glowing pad ring + swirl disc + short beam (1 additive mesh per gate) ----------
export function makeGate(scene, p, color = '#a98bff') {
  const beam = tag(new THREE.CylinderGeometry(1.7, 1.9, 9, 20, 1, true).translate(0, 4.5, 0), 0);
  const ring = tag(new THREE.RingGeometry(1.9, 2.35, 36).rotateX(-Math.PI / 2).translate(0, 0.07, 0), 1);
  const disc = tag(new THREE.CircleGeometry(1.9, 36).rotateX(-Math.PI / 2).translate(0, 0.05, 0), 2);
  const geo = mergeGeometries([beam, ring, disc]);
  const mat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uOn: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
    vertexShader: 'attribute float aK; varying vec2 vUv; varying float vK; varying vec3 vP; void main(){ vUv = uv; vK = aK; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uTime; uniform vec3 uColor; uniform float uOn; varying vec2 vUv; varying float vK; varying vec3 vP;
      void main(){ float a;
        if (vK < 0.5) { float y = vUv.y; a = pow(1.0 - y, 2.2) * 0.42 * (0.7 + 0.3 * sin(uTime * 2.0 + vUv.x * 37.7 - y * 9.0)); }
        else if (vK < 1.5) a = 0.95 * (0.75 + 0.25 * sin(uTime * 3.0));
        else { float r = length(vP.xz) / 1.9; float an = atan(vP.z, vP.x); a = 0.35 * (0.5 + 0.5 * sin(an * 3.0 + r * 9.0 - uTime * 3.0)) * (1.0 - r * 0.6); }
        a *= mix(0.25, 1.0, uOn); gl_FragColor = vec4(uColor * 1.5 * a, a); }` });
  const m = new THREE.Mesh(geo, mat); m.name = 'game_gate'; m.position.set(p.x, p.y, p.z); m.renderOrder = 3; geo.computeBoundingSphere(); scene.add(m);
  return { mesh: m, update(t) { mat.uniforms.uTime.value = t; }, setOn(on) { mat.uniforms.uOn.value = on ? 1 : 0; }, setColor(c) { mat.uniforms.uColor.value.set(c); } };
}

// ---------- ground crack: jagged dark fissure decal with rubble lips, conformed to the ground. Detection is analytic (local u/v frame) ----------
export function makeCrack(scene, c, groundAt) {
  // c: { x, z, tx, tz (unit, across-the-crack direction = travel direction), w (gap width), len (lateral extent) }
  const nx = -c.tz, nz = c.tx; const N = Math.max(22, Math.round(c.len * 1.2)); const pos = [], col = []; /* dense enough to follow the terrain patch triangles (no ground poking through) */
  const rnd = (i, k) => { const s = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return s - Math.floor(s); };
  const prof0 = [[-1.25, 0.18, '#5b5853'], [-1.0, 0.09, '#2c2a28'], [-0.55, 0.08, '#040405'], [0.55, 0.08, '#040405'], [1.0, 0.09, '#2c2a28'], [1.25, 0.18, '#5b5853']];
  const prof = []; for (let k = 0; k < prof0.length - 1; k++) { const [u0, h0, c0] = prof0[k], [u1, h1] = prof0[k + 1]; const n = k === 2 ? 6 : 2; for (let j = 0; j < n; j++) prof.push([u0 + (u1 - u0) * j / n, h0 + (h1 - h0) * j / n, j === 0 || k === 2 ? c0 : prof0[k + 1][2]]); } prof.push(prof0[prof0.length - 1]);
  const row = (i) => { const v = -c.len / 2 + c.len * i / N; const j1 = 0.8 + 0.4 * rnd(i, 1), j2 = 0.8 + 0.4 * rnd(i, 2); const taper = Math.min(1, (0.5 - Math.abs(v / c.len)) * 6 + 0.35);
    return prof.map(([u, h, cc], k) => { const uu = u * c.w / 2 * (u < 0 ? j1 : j2) * taper; const x = c.x + c.tx * uu + nx * v, z = c.z + c.tz * uu + nz * v; return [x, groundAt(x, z) + h, z, cc]; }); };
  let prev = row(0); const cc = new THREE.Color();
  for (let i = 1; i <= N; i++) { const cur = row(i); for (let k = 0; k < prof.length - 1; k++) { const q = [prev[k], prev[k + 1], cur[k + 1], prev[k], cur[k + 1], cur[k]]; for (const p of q) { pos.push(p[0], p[1], p[2]); cc.set(p[3]); col.push(cc.r, cc.g, cc.b); } } prev = cur; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeBoundingSphere();
  // faint cyan glow deep in the fissure (2nd strip, additive)
  const gp = []; for (let i = 0; i <= N; i++) { const v = -c.len / 2 + c.len * i / N; const w = c.w * 0.07 * (0.6 + 0.6 * rnd(i, 3)); for (const u of [-w, w]) { const x = c.x + c.tx * u + nx * v, z = c.z + c.tz * u + nz * v; gp.push(x, groundAt(x, z) + 0.1, z); } }
  const gi = []; for (let i = 0; i < N; i++) { const a = i * 2; gi.push(a, a + 1, a + 3, a, a + 3, a + 2); }
  const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3)); gg.setIndex(gi);
  const base = new THREE.MeshBasicMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide });
  const m = new THREE.Mesh(g, base); m.name = 'game_crack'; scene.add(m);
  const glow = new THREE.Mesh(gg, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.05, 0.45, 1.5), transparent: true, opacity: 0.7, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, toneMapped: false }));
  glow.name = 'game_crack_glow'; m.add(glow); glow.position.set(0, 0, 0);
  // local frame: u = along travel (across the gap), v = lateral
  const local = (x, z) => { const dx = x - c.x, dz = z - c.z; return { u: dx * c.tx + dz * c.tz, v: dx * nx + dz * nz }; };
  return { mesh: m, def: c, local, inGap(x, z) { const l = local(x, z); return Math.abs(l.u) < c.w * 0.42 && Math.abs(l.v) < c.len * 0.5 - 0.6; }, side(x, z) { return Math.sign(local(x, z).u) || 1; },
    safePoint(side, off = 2.2) { const u = side * (c.w / 2 + off); return { x: c.x + c.tx * u, z: c.z + c.tz * u }; } };
}

// ---------- ore crystals for the mining mini-game: big blue energy clusters (crystal.js); cracked = dim + red edges ----------
export function makeOre(scene, spots) {
  const f = makeCrystalField(scene, spots, { scale: 1.75, name: 'game_ore', cluster: 200 });
  const state = spots.map((_, i) => ({ get alive() { return f.alive[i]; }, set alive(v) { f.alive[i] = v; }, get cracked() { return f.cracked[i]; }, set cracked(v) { f.cracked[i] = v; }, set shake(v) { if (v) f.shake(i); }, get shake() { return 0; } }));
  const mesh = { set visible(v) { f.setVisible(v); }, get visible() { return f.groups[0].on !== false; } };
  return { mesh, field: f, state, spots, update: (t, dt) => f.update(t, dt) };
}

// ---------- lost antenna parts (instanced, glow brighter when the cat is close) ----------
export function makeParts(scene, spots, env) {
  const g = [colorize(new THREE.CylinderGeometry(0.07, 0.07, 1.0, 6).rotateZ(1.15).translate(0, 0.32, 0), '#d8d2c4'),
    colorize(new THREE.ConeGeometry(0.42, 0.22, 10, 1, true).rotateX(-0.9).translate(0.32, 0.5, 0.05), '#e8c060'),
    colorize(new THREE.BoxGeometry(0.3, 0.18, 0.24).translate(-0.3, 0.12, 0), '#c9973a'), colorize(new THREE.SphereGeometry(0.07, 6, 4).translate(0.44, 0.62, 0.2), '#7ff3ff')];
  const geo = mergeGeometries(g);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.6, roughness: 0.35, envMap: env || null, emissive: '#ffb347', emissiveIntensity: 0.25 });
  const im = new THREE.InstancedMesh(geo, mat, spots.length); im.name = 'game_parts'; const M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const alive = spots.map(() => true);
  const update = (t, glow = 0) => { spots.forEach((c, i) => { e.set(0.2, t * 0.9 + i * 2, 0.15); q.setFromEuler(e); p.set(c.x, c.y + 0.35 + Math.sin(t * 2.2 + i) * 0.08, c.z); s.setScalar(alive[i] ? 1.35 : 0); M.compose(p, q, s); im.setMatrixAt(i, M); }); im.instanceMatrix.needsUpdate = true; mat.emissiveIntensity = 0.25 + glow * (1.2 + 0.6 * Math.sin(t * 6)); };
  update(0); im.computeBoundingSphere(); im.boundingSphere.radius += 2; im.visible = false; scene.add(im);
  return { mesh: im, alive, spots, update };
}

// ---------- sprint checkpoint rings (1 instanced draw; next ring gold, passed rings dim) ----------
export function makeRings(scene, pts) {
  const geo = new THREE.TorusGeometry(2.3, 0.17, 5, 22);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const im = new THREE.InstancedMesh(geo, mat, pts.length); im.name = 'game_rings'; const M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
  const cNext = new THREE.Color(3.0, 2.1, 0.7), cTodo = new THREE.Color(0.5, 1.7, 2.2), cDone = new THREE.Color(0.25, 0.3, 0.35);
  pts.forEach((r, i) => { e.set(0, r.yaw, 0); q.setFromEuler(e); p.set(r.x, r.y + 2.6, r.z); M.compose(p, q, s); im.setMatrixAt(i, M); im.setColorAt(i, cTodo); });
  im.computeBoundingSphere(); im.boundingSphere.radius += 3; im.visible = false; scene.add(im);
  return { mesh: im, pts, setNext(n) { pts.forEach((_, i) => im.setColorAt(i, i < n ? cDone : i === n ? cNext : cTodo)); im.instanceColor.needsUpdate = true; },
    pulse(t, n) { if (n >= pts.length) return; const r = pts[n]; e.set(0, r.yaw, 0); q.setFromEuler(e); p.set(r.x, r.y + 2.6, r.z); const k = 1 + 0.08 * Math.sin(t * 8); s.set(k, k, k); M.compose(p, q, s); im.setMatrixAt(n, M); im.instanceMatrix.needsUpdate = true; s.set(1, 1, 1); } };
}

// ---------- meteor shower: red growing warning shadows + falling glowing rocks (2 instanced draws, only near the zone) ----------
export function makeMeteors(scene, N = 5) {
  const sg = new THREE.RingGeometry(0.0, 1, 24).rotateX(-Math.PI / 2);
  const sm = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    vertexShader: 'attribute float aT; varying float vT; varying vec2 vP; void main(){ vT = aT; vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying float vT; varying vec2 vP; void main(){ float r = length(vP); float edge = smoothstep(0.82, 0.97, r) * (1.0 - smoothstep(0.97, 1.0, r)); float fill = (1.0 - r) * 0.55 * vT; float a = clamp(edge * (0.6 + 0.4 * vT) + fill, 0.0, 1.0); gl_FragColor = vec4(vec3(1.6, 0.18, 0.08) * (0.6 + vT), a * 0.85); }' });
  const sh = new THREE.InstancedMesh(sg, sm, N); sh.name = 'game_meteor_shadows'; const aT = new THREE.InstancedBufferAttribute(new Float32Array(N), 1); sg.setAttribute('aT', aT);
  const core = colorize(new THREE.IcosahedronGeometry(0.55, 0), '#ffe6a8'); const trail = colorize(new THREE.ConeGeometry(0.5, 3.2, 7, 1, true).translate(0, 1.85, 0), '#ff6a1a');
  const rg = mergeGeometries([core, trail]); const rm = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, color: new THREE.Color(2.2, 1.6, 1.2) });
  const rk = new THREE.InstancedMesh(rg, rm, N); rk.name = 'game_meteors'; for (const m of [sh, rk]) { m.frustumCulled = false; m.visible = false; scene.add(m); }
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), dir = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  return { N, shadows: sh, rocks: rk,
    // items: [{x,y,z,t (0..1 warning progress), fall (0..1), alive}] ; slant: fall direction
    draw(items, slant) { q.identity(); for (let i = 0; i < N; i++) { const it = items[i]; if (!it || !it.alive) { M.makeScale(0, 0, 0); sh.setMatrixAt(i, M); rk.setMatrixAt(i, M); continue; }
        const R = 0.6 + 1.4 * Math.min(1, it.t); M.compose(p.set(it.x, it.y + 0.06, it.z), q.identity(), s.set(R, 1, R)); sh.setMatrixAt(i, M); aT.setX(i, Math.min(1, it.t));
        const h = (1 - it.fall) * 42; dir.set(slant.x, 1, slant.z).normalize(); p.set(it.x + dir.x * h, it.y + 0.4 + dir.y * h, it.z + dir.z * h); const qq = new THREE.Quaternion().setFromUnitVectors(up, dir); M.compose(p, qq, s.set(1, 1, 1).multiplyScalar(it.fall > 0 ? 1 : 0)); rk.setMatrixAt(i, M); }
      sh.instanceMatrix.needsUpdate = true; rk.instanceMatrix.needsUpdate = true; aT.needsUpdate = true; },
    show(v) { sh.visible = v; rk.visible = v; } };
}

// ---------- secret caches: small ivory/gold chest with a glowing cyan crescent seam (1 mesh each, shared geometry) ----------
let _cacheGeo = null;
export function makeCache(scene, p, env) {
  if (!_cacheGeo) { _cacheGeo = mergeGeometries([colorize(new THREE.BoxGeometry(0.9, 0.5, 0.6).translate(0, 0.25, 0), '#ddd5c2'), colorize(new THREE.CylinderGeometry(0.3, 0.3, 0.92, 10, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(Math.PI / 2).rotateY(Math.PI / 2).translate(0, 0.5, 0), '#d6a136'),
    colorize(new THREE.BoxGeometry(0.94, 0.06, 0.64).translate(0, 0.5, 0), '#b8862c'), colorize(new THREE.BoxGeometry(0.16, 0.2, 0.05).translate(0, 0.42, 0.31), '#7ff3ff'), colorize(new THREE.BoxGeometry(0.08, 0.52, 0.64).translate(-0.36, 0.26, 0), '#c9973a'), colorize(new THREE.BoxGeometry(0.08, 0.52, 0.64).translate(0.36, 0.26, 0), '#c9973a')]); _cacheGeo.computeBoundingSphere(); }
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.45, roughness: 0.4, envMap: env || null, emissive: '#3fd9ff', emissiveIntensity: 0 });
  mat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance *= step(0.9, vColor.b) * step(vColor.r, 0.6);'); };
  const m = new THREE.Mesh(_cacheGeo, mat); m.name = 'game_cache'; m.position.set(p.x, p.y, p.z); m.rotation.y = p.yaw || 0; m.castShadow = true; scene.add(m);
  const fx = { mesh: m, hl: 0, update(t) { mat.emissiveIntensity = fx.hl > 0 ? 3.2 + Math.sin(t * 9) * 1.8 : 1.4 + Math.sin(t * 3 + p.x) * 0.8; } }; return fx; // v73 hl: the Moon Bunny sniffed it out
}

// ---------- the first base module the builder robot builds: storage depot, revealed bottom-up by a clip plane + holo ghost ----------
// storage module built in visible stages (foundation → frame → panels → dome → lights). Every part carries aStg = (stage, y0, y1):
// parts of finished stages are shown, the current stage grows upward from y0 to y1 with a hot weld seam at the cut, later stages are a faint wire ghost.
export const DEPOT_STAGES = [{ id: 'foundation', w: 0.13, a: 0 }, { id: 'frame', w: 0.22, a: 0.85 }, { id: 'panels', w: 0.3, a: -0.85 }, { id: 'dome', w: 0.23, a: 0.45 }, { id: 'lights', w: 0.12, a: -0.4 }];
export function makeDepot(scene, p, env) {
  const parts = []; const add = (g, col, st) => { g = colorize(g, col); g.computeBoundingBox(); const b = g.boundingBox, n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([st, b.min.y, b.max.y], i * 3); g.setAttribute('aStg', new THREE.BufferAttribute(a, 3)); parts.push(g); };
  // 0 foundation: slab + anchor pads
  add(new THREE.CylinderGeometry(1.58, 1.58, 0.16, 18, 1).translate(0, 0.08, 0), '#8d8a84', 0);
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; add(new THREE.BoxGeometry(0.34, 0.1, 0.34).translate(Math.cos(a) * 1.62, 0.05, Math.sin(a) * 1.62), '#6e6b66', 0); }
  // 1 frame: 10 struts + top ring
  for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5; add(new THREE.BoxGeometry(0.07, 1.78, 0.07).translate(Math.cos(a) * 1.5, 1.05, Math.sin(a) * 1.5), '#a8a296', 1); }
  add(new THREE.TorusGeometry(1.5, 0.045, 4, 20).rotateX(Math.PI / 2).translate(0, 1.92, 0), '#a8a296', 1);
  // 2 panels: shell, gold band, door
  add(new THREE.CylinderGeometry(1.45, 1.55, 1.9, 18, 1).translate(0, 0.95, 0), '#e4dccb', 2);
  add(new THREE.CylinderGeometry(1.5, 1.5, 0.14, 18, 1, true).translate(0, 1.35, 0), '#d6a136', 2);
  add(new THREE.BoxGeometry(0.85, 1.25, 0.2).translate(0, 0.72, 1.45), '#3a3f47', 2); add(new THREE.BoxGeometry(1.0, 0.1, 0.24).translate(0, 1.4, 1.47), '#d6a136', 2);
  // 3 dome
  add(new THREE.SphereGeometry(1.45, 18, 5, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 1.9, 0), '#ece4d2', 3);
  // 4 lights: windows, mast, beacon
  add(new THREE.BoxGeometry(0.42, 0.16, 0.08).translate(-0.95, 1.1, 1.1).rotateY(-0.6), '#6fe7ff', 4); add(new THREE.BoxGeometry(0.42, 0.16, 0.08).translate(0.95, 1.1, 1.1).rotateY(0.6), '#6fe7ff', 4);
  add(new THREE.CylinderGeometry(0.04, 0.04, 1.0, 5).translate(0.5, 3.6, 0), '#c9c2b2', 4); add(new THREE.SphereGeometry(0.09, 6, 4).translate(0.5, 4.12, 0), '#ffb347', 4);
  const geo = mergeGeometries(parts.map(g => g.index ? g.toNonIndexed() : g)); geo.computeBoundingSphere();
  const uB = { value: 0 }, NS = DEPOT_STAGES.length;
  const inject = (sh, ghost) => { sh.uniforms.uB = uB;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aStg; varying vec3 vStg; varying float vLY;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvStg = aStg; vLY = position.y;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uB; varying vec3 vStg; varying float vLY;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
      float sf = clamp(uB - vStg.x, 0.0, 1.0); float cut = mix(vStg.y - 0.001, vStg.z + 0.001, sf); bool built = vLY <= cut && uB > vStg.x;
      ${ghost ? 'if (built) discard;' : 'if (!built) discard; float seam = (sf < 1.0) ? 1.0 - smoothstep(0.0, 0.07, cut - vLY) : 0.0;'}`); };
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.35, roughness: 0.5, envMap: env || null, side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => { inject(sh, false); sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance = vColor.rgb * step(0.9, vColor.b) * step(vColor.r, 0.5) * 1.6 + vec3(1.6, 0.75, 0.25) * seam * 0.9;'); };
  mat.customProgramCacheKey = () => 'depot_stg';
  const m = new THREE.Mesh(geo, mat); m.name = 'game_depot'; m.position.set(p.x, p.y, p.z); m.rotation.y = p.yaw || 0; m.castShadow = false; m.receiveShadow = true; m.visible = false; scene.add(m);
  const gm = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 1.1, 1.5), transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, wireframe: true, toneMapped: false });
  gm.onBeforeCompile = (sh) => inject(sh, true); gm.customProgramCacheKey = () => 'depot_ghost';
  const ghost = new THREE.Mesh(geo, gm); ghost.name = 'game_depot_ghost'; m.add(ghost);
  const H = 4.2; let frac = 0; const tops = [0.16, 1.97, 1.97, 3.35, 4.2];
  const toValue = (f) => { let acc = 0; for (let i = 0; i < NS; i++) { const w = DEPOT_STAGES[i].w; if (f <= acc + w || i === NS - 1) return Math.min(NS, i + Math.min(1, (f - acc) / w)); acc += w; } return NS; };
  const api = { mesh: m, H, stages: DEPOT_STAGES, get frac() { return frac; }, get value() { return uB.value; },
    // f: overall 0..1 (stage weights applied); building: show the ghost of the unbuilt rest
    set(f, building) { frac = Math.max(0, Math.min(1, f)); api.setValue(frac >= 1 ? NS : toValue(frac), building); },
    setValue(v, building) { uB.value = v; frac = v >= NS ? 1 : frac; m.visible = v > 0 || building; ghost.visible = building && v < NS; m.castShadow = v >= NS; },
    topWorld() { const i = Math.min(NS - 1, Math.floor(uB.value)); return new THREE.Vector3(p.x, p.y + (uB.value >= NS ? H : tops[i]), p.z); } };
  api.set(0, false); return api;
}
