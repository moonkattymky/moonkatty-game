// "World life" pass (chapter 2, concept d04ca995): the base feels inhabited. Everything moves:
//  sky: shuttles + a satellite cross on paths, a distant shuttle lifts off with a flame trail, shooting stars;
//  lore: Dust Jellies drift + pulse over a far crater, a rare bunny silhouette runs on the horizon;
//  ground: a cargo rover loops fields -> storage with headlights + dust trail, a drill rig spins with sparks,
//  steam vents puff, beacons blink, the radar dish turns; ambient audio + radio chatter (RU/EN subtitles), mute toggle.
// Cheap by design: few draw calls, low-poly merged meshes, one particle system, distance culling.
import * as THREE from 'three';
import { mergeGeometries } from '../../vendor/three/jsm/utils/BufferGeometryUtils.js';
import { DRILL_HEAD } from './machines.js';
import { setRut, setCrater, setRut2, setRut3, PLAY_START, PLAY_CRATER, F, sd, REGIONS, canyonPoint, canyonS } from '../terrain.js';
import { haulerPieces } from '../world.js';

const col = (g, hex, e = 0, mr = null) => { g = g.index ? g.toNonIndexed() : g; const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3), ae = new Float32Array(n), am = new Float32Array(n * 2); const metal = mr ? mr[0] : 0.45, rough = mr ? mr[1] : 0.45; for (let i = 0; i < n; i++) { c.toArray(a, i * 3); ae[i] = e; am[i * 2] = metal; am[i * 2 + 1] = rough; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.setAttribute('aE', new THREE.BufferAttribute(ae, 1)); g.setAttribute('aMR', new THREE.BufferAttribute(am, 2)); if (g.attributes.uv) g.deleteAttribute('uv'); return g; };
const merge = (list) => mergeGeometries(list.map(g => g.index ? g.toNonIndexed() : g));
function vcMat(env) { const m = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 1, roughness: 1, envMap: env || null, envMapIntensity: 0.55 }); m.onBeforeCompile = (sh) => { sh.vertexShader = 'attribute float aE; attribute vec2 aMR; varying float vE; varying vec2 vMR;\n' + sh.vertexShader.replace('#include <color_vertex>', '#include <color_vertex>\n vE = aE; vMR = aMR;'); sh.fragmentShader = 'varying float vE; varying vec2 vMR;\n' + sh.fragmentShader.replace('#include <metalnessmap_fragment>', 'float metalnessFactor = vMR.x;').replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vMR.y;').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += vColor.rgb * vE;'); }; m.customProgramCacheKey = () => 'mk_life_vc2'; return m; }

function shuttleGeo() { return merge([col(new THREE.CylinderGeometry(0.55, 0.7, 4.2, 8).rotateZ(Math.PI / 2), '#e9e2d2'), col(new THREE.ConeGeometry(0.55, 1.4, 8).rotateZ(-Math.PI / 2).translate(2.8, 0, 0), '#e9e2d2'), col(new THREE.BoxGeometry(2.2, 0.12, 3.6).translate(-0.6, -0.15, 0), '#d8cdb5'), col(new THREE.BoxGeometry(1.0, 1.2, 0.1).translate(-1.6, 0.7, 0), '#f0b020' /* v123 warmer gold */), col(new THREE.BoxGeometry(0.7, 0.3, 0.6).translate(1.4, 0.4, 0), '#3a6fb0', 0.6), col(new THREE.CylinderGeometry(0.4, 0.5, 0.4, 8).rotateZ(Math.PI / 2).translate(-2.25, 0, 0), '#6a5a40')]); }
function satGeo() { return merge([col(new THREE.BoxGeometry(1, 1, 1.4), '#d8c08a'), col(new THREE.BoxGeometry(4.2, 0.05, 1.3).translate(-2.8, 0, 0), '#2a4f9a', 0.25), col(new THREE.BoxGeometry(4.2, 0.05, 1.3).translate(2.8, 0, 0), '#2a4f9a', 0.25), col(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 4).translate(0, 1.1, 0), '#f0b020' /* v123 warmer gold */), col(new THREE.ConeGeometry(0.5, 0.3, 8, 1, true).translate(0, 1.7, 0), '#e9e2d2')]); }
function roverGeo() { const L = [col(new THREE.BoxGeometry(1.6, 0.5, 2.6).translate(0, 0.75, 0), '#e6dcc6'), col(new THREE.BoxGeometry(1.7, 0.08, 2.7).translate(0, 1.02, 0), '#f0b020' /* v123 warmer gold */), col(new THREE.BoxGeometry(1.4, 0.45, 1.6).translate(0, 1.25, -0.35), '#d8cdb5'), col(new THREE.BoxGeometry(1.0, 0.35, 0.5).translate(0, 1.15, 1.05), '#2b3d5c', 0.15)];
  for (const z of [-0.95, 0, 0.95]) for (const x of [-0.9, 0.9]) L.push(col(new THREE.CylinderGeometry(0.34, 0.34, 0.3, 10).rotateZ(Math.PI / 2).translate(x, 0.34, z), '#3a3530'));
  for (const x of [-0.5, 0.5]) L.push(col(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 8).rotateX(Math.PI / 2).translate(x, 0.85, 1.32), '#fff2c8', 3.0));
  for (let k = 0; k < 7; k++) L.push(col(new THREE.OctahedronGeometry(1, 0).scale(0.16, 0.38 + (k % 3) * 0.08, 0.16).rotateZ((k - 3) * 0.12).translate(-0.45 + (k % 4) * 0.3, 1.6 + (k % 3) * 0.04, -0.75 + Math.floor(k / 4) * 0.5), '#5fc4ff', 2.2));
  return merge(L); }
// Wheeled drill (d04ca995): ivory cab, dark-blue glass, gold joints and hubs, paneled boom, cylindrical motor stack, one tapered auger under the stack. DRILL_HEAD stays (0, 1.05, -2.7) — the auger socket.
const IV = [0.06, 0.55], GD = [0.72, 0.34], DK = [0.04, 0.9], ST = [0.4, 0.4], GL = [0.06, 0.14];
const AUGER_TIP = -1.42; // bit-local y of the cutting point. With the rig scale, this bites the ground in front of the truck.
function rigGeo(hi, aug) {
  const Y = (r1, r2, h, n, open = false) => new THREE.CylinderGeometry(r1, r2, h, n, 1, open), B = (w, h, d) => new THREE.BoxGeometry(w, h, d), nC = hi ? 8 : 6, wN = hi ? 10 : 6, L = [];
  const rod = (a, b, r, c, n, mr) => { const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b), d = Bv.clone().sub(A), len = Math.max(0.05, d.length()), g = Y(r, r, len, n, true); g.translate(0, len / 2, 0); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize())); g.translate(A.x, A.y, A.z); return col(g, c, 0, mr); };
  const beam = (a, b, w, h, c, mr) => { const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b), d = Bv.clone().sub(A), len = Math.max(0.05, d.length()), g = B(w, len, h).translate(0, len / 2, 0); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize())); g.translate(A.x, A.y, A.z); return col(g, c, 0, mr); };
  const MZ = -2.7;
  // Chassis bottom is 0.42; tyres of radius 0.46 are centered at y=0.46 so they meet the ground and the body stays above it.
  L.push(col(B(1.50, 0.16, 3.20).translate(0, 0.48, 0.02), '#241f1c', 0, DK));
  L.push(col(B(1.86, 0.40, 3.08).translate(0, 0.78, 0.02), '#f6efe2', 0, IV));
  L.push(col(B(0.06, 0.05, 3.12).translate(0.93, 0.99, 0.02), '#e2b04a', 0, GD), col(B(0.06, 0.05, 3.12).translate(-0.93, 0.99, 0.02), '#e2b04a', 0, GD));
  L.push(col(B(1.28, 0.58, 1.16).translate(0, 1.14, 0.70), '#f7f1e4', 0, IV));
  const cab = new THREE.SphereGeometry(0.56, hi ? 10 : 6, hi ? 7 : 4); cab.scale(1.12, 0.78, 1.16); L.push(col(cab.translate(0, 1.40, 0.60), '#f7f1e4', 0, IV));
  L.push(col(B(1.00, 0.34, 0.06).translate(0, 1.26, 1.26), '#16325c', 0.7, GL));
  L.push(col(B(0.06, 0.30, 0.52).translate(0.66, 1.24, 0.74), '#16325c', 0.45, GL), col(B(0.06, 0.30, 0.52).translate(-0.66, 1.24, 0.74), '#16325c', 0.45, GL));
  L.push(col(B(1.08, 0.045, 0.07).translate(0, 1.46, 1.28), '#e2b04a', 0, GD));
  L.push(col(Y(0.08, 0.10, 0.52, nC).translate(0.42, 2.08, 0.88), '#9aa3ab', 0, ST), col(Y(0.13, 0.10, 0.12, nC).translate(0.42, 2.38, 0.88), '#2c2926', 0, DK));
  if (hi) { L.push(col(B(0.04, 0.16, 1.35).translate(1.02, 0.76, 0.05), '#e2b04a', 0, GD), col(B(0.04, 0.16, 1.35).translate(-1.02, 0.76, 0.05), '#e2b04a', 0, GD)); }
  for (const s of [-1, 1]) for (const z of [1.18, 0.08, -1.02]) {
    const x = s * 1.08;
    L.push(col(Y(0.46, 0.46, 0.32, wN).rotateZ(Math.PI / 2).translate(x, 0.46, z), '#141210', 0, DK));
    L.push(col(Y(0.17, 0.17, 0.10, hi ? 12 : 6).rotateZ(Math.PI / 2).translate(x + s * 0.14, 0.46, z), '#e2b04a', 0, GD));
    L.push(col(Y(0.055, 0.055, 0.06, 5).rotateZ(Math.PI / 2).translate(x + s * 0.20, 0.46, z), '#1a1612', 0, DK));
    L.push(col(Y(0.06, 0.06, 0.32, 5).rotateZ(Math.PI / 2).translate(s * 0.86, 0.46, z), '#2a2724', 0, DK));
  }
  const P0 = [0, 1.86, 0.42], J = [0, 3.72, -1.12], H = [0, 4.10, MZ];
  L.push(beam(P0, J, 0.12, 0.18, '#e2b04a', GD), beam(J, H, 0.10, 0.14, '#e2b04a', GD));
  L.push(beam([0.16, P0[1], P0[2]], [0.14, J[1], J[2]], 0.09, 0.13, '#f7f1e4', IV), beam([-0.16, P0[1], P0[2]], [-0.14, J[1], J[2]], 0.09, 0.13, '#f7f1e4', IV));
  L.push(beam([0.13, J[1], J[2]], [0.10, H[1], H[2]], 0.07, 0.10, '#f7f1e4', IV), beam([-0.13, J[1], J[2]], [-0.10, H[1], H[2]], 0.07, 0.10, '#f7f1e4', IV));
  L.push(col(new THREE.SphereGeometry(0.20, hi ? 8 : 6, hi ? 6 : 4).translate(J[0], J[1], J[2]), '#5c584f', 0, ST));
  L.push(col(new THREE.SphereGeometry(0.15, 6, 4).translate(P0[0], P0[1], P0[2]), '#5c584f', 0, ST));
  L.push(col(B(0.52, 0.26, 0.40).translate(H[0], H[1], H[2]), '#e2b04a', 0, GD));
  L.push(rod([0.58, 0.95, 0.15], [0.16, 3.15, -0.72], 0.055, '#c5ccd4', hi ? 6 : 5, ST));
  L.push(beam([-0.72, 0.78, -1.22], [-0.30, 2.22, MZ + 0.12], 0.10, 0.08, '#d5dbe2', ST), beam([0.72, 0.78, -1.22], [0.30, 2.22, MZ + 0.12], 0.10, 0.08, '#d5dbe2', ST));
  // Motor stack hangs off the boom jaw. Outlet bottom is y=1.92 so the auger collar (bit at DRILL_HEAD) stays inside it.
  const hous = hi ? [[0.34, 0.52, 2.18], [0.50, 0.70, 2.71], [0.42, 0.56, 3.26], [0.30, 0.62, 3.77]] : [[0.40, 0.78, 2.31], [0.50, 0.86, 3.05], [0.34, 0.72, 3.76]];
  for (const [r, h, y] of hous) L.push(col(Y(r, r * 0.94, h, nC).translate(0, y, MZ), '#d5dbe2', 0, ST), col(Y(r + 0.05, r + 0.05, 0.06, nC, true).translate(0, y + h * 0.42, MZ), '#e2b04a', 0, GD));
  if (aug) for (const g of augerList(false)) L.push(g.translate(0, DRILL_HEAD.y, MZ));
  return merge(L);
}
function augerFlight(hi) {
  const y0 = 0.52, y1 = -0.98, yTop = 1.08, yBot = -1.15, turns = 3, seg = hi ? 48 : 22;
  const rShaft = (y) => { const t = Math.min(1, Math.max(0, (yTop - y) / (yTop - yBot))); return 0.28 + (0.045 - 0.28) * t; };
  const pos = [], idx = [], lift = 0.02;
  const V = (y, a, extra, dy) => { const r = rShaft(y) + extra, i = pos.length / 3; pos.push(Math.cos(a) * r, y + dy, Math.sin(a) * r); return i; };
  const top = [], bot = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, y = y0 + (y1 - y0) * t, a = t * turns * Math.PI * 2, w = 0.26 * (1 - t * 0.5);
    top.push([V(y, a, 0.008, lift), V(y, a, w, lift)]);
    bot.push([V(y, a, 0.008, -lift), V(y, a, w, -lift)]);
  }
  for (let i = 0; i < seg; i++) {
    const [a, b] = top[i], [c, d] = top[i + 1]; idx.push(a, b, d, a, d, c);
    const [e, f] = bot[i], [g, h] = bot[i + 1]; idx.push(e, h, f, e, g, h);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals(); return geo;
}
function augerList(hi) {
  const n = hi ? 8 : 6, ST = [0.35, 0.38], GD = [0.7, 0.32], L = [];
  const h = 1.08 - (-1.15), cy = (1.08 + -1.15) / 2;
  L.push(col(new THREE.CylinderGeometry(0.28, 0.045, h, n).translate(0, cy, 0), '#b7c0c8', 0, ST));
  const tip = new THREE.ConeGeometry(0.045, 0.36, n); tip.rotateX(Math.PI); tip.translate(0, -1.33, 0); L.push(col(tip, '#e8eef2', 0, ST));
  const hot = new THREE.ConeGeometry(0.035, 0.18, n); hot.rotateX(Math.PI); hot.translate(0, AUGER_TIP, 0); L.push(col(hot, '#ff9a3c', 1.5, [0.12, 0.3]));
  L.push(col(new THREE.CylinderGeometry(0.38, 0.32, 0.24, n).translate(0, 1.02, 0), '#c5ccd4', 0, ST));
  L.push(col(new THREE.CylinderGeometry(0.42, 0.42, 0.055, n, 1, true).translate(0, 1.12, 0), '#e2b04a', 0, GD));
  const rAt = (y) => 0.28 + (0.045 - 0.28) * Math.min(1, Math.max(0, (1.08 - y) / h));
  for (const y of (hi ? [0.55, 0.02, -0.42] : [0.28, -0.28])) L.push(col(new THREE.CylinderGeometry(rAt(y) + 0.025, rAt(y) + 0.025, 0.05, n, 1, true).translate(0, y, 0), '#e2b04a', 0, GD));
  L.push(col(augerFlight(hi), '#f7f9fb', 0, [0.55, 0.32]));
  return L;
}
function augerGeo(hi) { return merge(augerList(hi)); }
// Same parts as the parked hauler (world.js haulerPieces). hi: 20-gon tyres up close. lo: 8-gon.
function haulerGeo(hi) {
  const MR = { dark: [0.04, 0.9], ivory: [0.08, 0.48], gold: [0.78, 0.32], glow: [0.12, 0.2], tex: [0.2, 0.22] };
  const L = [];
  for (const p of haulerPieces(hi ? 20 : 8, 8)) {
    let g = p.geo.clone(); g.translate(p.pos[0], p.pos[1], p.pos[2]);
    const mr = p.mr || MR[p.group] || MR.ivory;
    if (g.attributes.aGemE && g.attributes.color) {
      const n = g.attributes.position.count, ae = new Float32Array(g.attributes.aGemE.array), am = new Float32Array(n * 2);
      for (let i = 0; i < n; i++) { am[i * 2] = mr[0]; am[i * 2 + 1] = mr[1]; }
      g.setAttribute('aE', new THREE.BufferAttribute(ae, 1)); g.setAttribute('aMR', new THREE.BufferAttribute(am, 2)); g.deleteAttribute('aGemE');
      if (g.attributes.uv) g.deleteAttribute('uv'); L.push(g); continue;
    }
    if (!p.shade) { L.push(col(g, p.color, p.emit || 0, mr)); continue; }
    g = g.index ? g.toNonIndexed() : g;
    const P = g.attributes.position, n = P.count, a = new Float32Array(n * 3), ae = new Float32Array(n), am = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { const c = p.shade(P.getX(i), P.getY(i), P.getZ(i)); a[i * 3] = c[0]; a[i * 3 + 1] = c[1]; a[i * 3 + 2] = c[2]; ae[i] = c[3] || 0; am[i * 2] = mr[0]; am[i * 2 + 1] = mr[1]; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.setAttribute('aE', new THREE.BufferAttribute(ae, 1)); g.setAttribute('aMR', new THREE.BufferAttribute(am, 2)); if (g.attributes.uv) g.deleteAttribute('uv');
    L.push(g);
  }
  return merge(L);
}
function drillGeo() { const L = [col(new THREE.BoxGeometry(2.2, 0.8, 3.2).translate(0, 0.9, 0), '#e6dcc6'), col(new THREE.BoxGeometry(2.3, 0.1, 3.3).translate(0, 1.32, 0), '#f0b020' /* v123 warmer gold */), col(new THREE.BoxGeometry(1.2, 0.9, 1.0).translate(0, 1.8, -1.0), '#d8cdb5'), col(new THREE.BoxGeometry(0.9, 0.4, 0.1).translate(0, 1.9, -0.48), '#2b3d5c', 0.2), col(new THREE.BoxGeometry(0.3, 4.2, 0.3).translate(0, 3.2, 1.1), '#e8b038' /* v123 warmer gold */), col(new THREE.BoxGeometry(0.9, 0.5, 0.6).translate(0, 5.1, 1.1), '#e6dcc6')];
  for (const z of [-1.1, 0, 1.1]) for (const x of [-1.2, 1.2]) L.push(col(new THREE.CylinderGeometry(0.42, 0.42, 0.34, 10).rotateZ(Math.PI / 2).translate(x, 0.42, z), '#3a3530'));
  L.push(col(new THREE.SphereGeometry(0.12, 6, 4).translate(0, 5.45, 1.1), '#ff4030', 4.0)); return merge(L); }
function bitGeo() { return merge([col(new THREE.CylinderGeometry(0.32, 0.32, 1.4, 10), '#b8b2a6'), col(new THREE.TorusGeometry(0.34, 0.06, 4, 10).rotateX(Math.PI / 2).translate(0, 0.3, 0), '#f0b020' /* v123 warmer gold */), col(new THREE.TorusGeometry(0.34, 0.06, 4, 10).rotateX(Math.PI / 2).translate(0, -0.2, 0), '#f0b020' /* v123 warmer gold */), col(new THREE.ConeGeometry(0.3, 0.6, 10).rotateX(Math.PI).translate(0, -1.0, 0), '#d8d0c0')]); }

// one additive particle system for dust, steam, sparks, engine/flame trails
function makeParticles(scene, N) {
  const g = new THREE.BufferGeometry(); const P = new Float32Array(N * 3), C = new Float32Array(N * 4), S = new Float32Array(N); g.setAttribute('position', new THREE.BufferAttribute(P, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('color', new THREE.BufferAttribute(C, 4).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('size', new THREE.BufferAttribute(S, 1).setUsage(THREE.DynamicDrawUsage)); const V = new Float32Array(N * 4); g.setAttribute('vel', new THREE.BufferAttribute(V, 4).setUsage(THREE.DynamicDrawUsage)); /* v57: xyz velocity, w = 1 for streak sparks */
  const m = new THREE.ShaderMaterial({ uniforms: { uScale: { value: innerHeight * 0.6 } }, transparent: true, depthWrite: false, toneMapped: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    vertexShader: `attribute float size; attribute vec4 color; attribute vec4 vel; varying vec4 vC; varying vec3 vD; uniform float uScale; void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); vec4 c0 = projectionMatrix * mv; vec4 c1 = projectionMatrix * (modelViewMatrix * vec4(position + vel.xyz * 0.02, 1.0)); vec2 d = c1.xy / c1.w - c0.xy / c0.w; float L = length(d); vD = vec3(L > 1e-5 ? d / L : vec2(1.0, 0.0), vel.w); gl_PointSize = min(size * uScale / max(0.5, -mv.z) * (1.0 + vel.w * 0.35), 64.0); gl_Position = c0; }`,
    fragmentShader: `varying vec4 vC; varying vec3 vD; void main(){ vec2 d = gl_PointCoord - 0.5; if (vD.z > 0.5) { vec2 dir = vec2(vD.x, -vD.y); float al = dot(d, dir), ac = dot(d, vec2(-dir.y, dir.x)); float a = exp(-al * al * 14.0 - ac * ac * 900.0); if (a < 0.03) discard; float core = exp(-al * al * 40.0 - ac * ac * 3000.0); vec3 c = vC.rgb * a + vec3(1.6, 1.4, 1.1) * core * max(vC.r, 0.0) * 0.6; gl_FragColor = vec4(c, vC.a * a); return; } float a = exp(-dot(d, d) * 12.0); if (a < 0.03) discard; gl_FragColor = vec4(vC.rgb * a, vC.a * a); }` });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 4; pts.name = 'life_particles'; scene.add(pts);
  const L = Array.from({ length: N }, () => ({ life: 0 })); const R = Math.min(64, N >> 3), NM = N - R; let pi = 0, ri = 0; /* v92: last R slots reserved for steam so dust can't evict plumes */
  return { pts, m, emitR(x, y, z, vx, vy, vz, life, size, r, gc, b, occ, kind, grow = 0, grav = 0) { const p = L[NM + ri]; ri = (ri + 1) % R; Object.assign(p, { x, y, z, vx, vy, vz, life, max: life, size, r, g: gc, b, occ, kind, grow, grav }); }, emit(x, y, z, vx, vy, vz, life, size, r, gc, b, occ, kind, grow = 0, grav = 0) { const p = L[pi]; pi = (pi + 1) % NM; Object.assign(p, { x, y, z, vx, vy, vz, life, max: life, size, r, g: gc, b, occ, kind, grow, grav }); },
    update(dt) { let any = false; for (let i = 0; i < N; i++) { const p = L[i]; if (p.life <= 0) { S[i] = 0; continue; } any = true; p.life -= dt; p.vy -= p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; const f = Math.max(0, p.life / p.max); P[i * 3] = p.x; P[i * 3 + 1] = p.y; P[i * 3 + 2] = p.z; const k = p.kind === 'smoke' ? Math.sin(f * Math.PI) : p.kind === 'steam' ? Math.min(1, (1 - f) * 30) * Math.sqrt(f) : f; /* v91 steam: dense at the vent, thins as it rises */ C[i * 4] = p.r * k; C[i * 4 + 1] = p.g * k; C[i * 4 + 2] = p.b * k; C[i * 4 + 3] = p.occ * k; S[i] = p.size + p.grow * (1 - f); V[i * 4] = p.vx; V[i * 4 + 1] = p.vy; V[i * 4 + 2] = p.vz; V[i * 4 + 3] = p.kind === 'spark' ? 1 : 0; }
      pts.visible = any; if (any) { g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; g.attributes.size.needsUpdate = true; g.attributes.vel.needsUpdate = true; } m.uniforms.uScale.value = innerHeight * 0.6; } };
}

// billboards with procedural looks: kind 0 jelly, 1 bunny silhouette, 2 shooting star, 3 engine glow
function makeBillboards(scene, N) {
  const g = new THREE.InstancedBufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3)); g.setIndex([0, 1, 2, 0, 2, 3]);
  const iP = new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4), iD = new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4); iP.setUsage(THREE.DynamicDrawUsage); iD.setUsage(THREE.DynamicDrawUsage); g.setAttribute('iP', iP); g.setAttribute('iD', iD); g.instanceCount = N;
  const U = { uT: { value: 0 } };
  const m = new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    vertexShader: `attribute vec4 iP; attribute vec4 iD; varying vec2 vUv; varying vec4 vD; varying float vS; void main(){ vD = iD; vUv = position.xy + 0.5; vS = iP.w; vec3 R = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]), Up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
      vec3 p; if (iD.x > 1.5 && iD.x < 2.5) { vec3 dir = normalize(vec3(cos(iD.z), -0.55, sin(iD.z))); vec3 toC = normalize(cameraPosition - iP.xyz); vec3 sd = normalize(cross(dir, toC)); p = iP.xyz + dir * (position.y - 0.5) * iP.w * 1.6 * -1.0 + sd * position.x * iP.w * 0.07; } else p = iP.xyz + (R * position.x * (iD.x > 0.5 ? 1.4 : 1.0) + Up * position.y * (iD.x > 0.5 ? 1.0 : 1.3)) * iP.w;
      gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`,
    fragmentShader: `uniform float uT; varying vec2 vUv; varying vec4 vD; varying float vS;
      void main(){ vec2 u = vUv; vec3 c = vec3(0.0); float a = 0.0; if (vS <= 0.0) discard;
        if (vD.x < 0.5) { float ph = uT * 1.6 + vD.y; float pu = 0.5 + 0.5 * sin(ph); vec2 b = (u - vec2(0.5, 0.7)) / vec2(0.36 + 0.05 * pu, 0.22 - 0.03 * pu); float bell = smoothstep(1.0, 0.75, length(b)) * step(-0.25, b.y); float rim = smoothstep(0.8, 1.0, length(b)) * smoothstep(1.15, 1.0, length(b)) * step(-0.3, b.y);
          float ten = 0.0; for (int i = 0; i < 5; i++) { float x0 = 0.3 + float(i) * 0.1; float x = x0 + 0.03 * sin(u.y * 14.0 - uT * 3.0 + float(i)); ten += smoothstep(0.012, 0.0, abs(u.x - x)) * step(u.y, 0.58) * smoothstep(0.02, 0.5, u.y); }
          vec3 jc = mix(vec3(0.15, 1.15, 1.7), vec3(0.45, 1.6, 2.0), 0.5 + 0.5 * sin(ph * 0.5)); c = jc * (bell * 0.55 + rim * 1.2 + ten * 0.8) * (0.7 + 0.5 * pu); a = (bell * 0.25 + rim * 0.3 + ten * 0.2); }
        else if (vD.x < 1.5) { vec2 q = u - 0.5; float run = sin(uT * 18.0) * 0.06; float body = smoothstep(0.02, 0.0, length((q - vec2(0.0, -0.05)) / vec2(0.26, 0.15)) - 1.0); float head = smoothstep(0.02, 0.0, length((q - vec2(0.24, 0.08)) / vec2(0.11, 0.1)) - 1.0);
          float ear1 = smoothstep(0.02, 0.0, length((q - vec2(0.22, 0.27 + run * 0.3)) / vec2(0.03, 0.12)) - 1.0), ear2 = smoothstep(0.02, 0.0, length((q - vec2(0.28, 0.25)) / vec2(0.03, 0.11)) - 1.0); float leg = smoothstep(0.02, 0.0, length((q - vec2(-0.15 + run, -0.22)) / vec2(0.1, 0.05)) - 1.0) + smoothstep(0.02, 0.0, length((q - vec2(0.12 - run, -0.21)) / vec2(0.07, 0.04)) - 1.0);
          float s = clamp(body + head + ear1 + ear2 + leg, 0.0, 1.0); c = vec3(0.9, 0.9, 1.0) * s * 0.9; a = s * 0.9; }
        else if (vD.x < 2.5) { float w = smoothstep(0.5, 0.0, abs(u.x - 0.5)); float t = pow(u.y, 3.0); c = vec3(1.15, 0.42, 0.08) * w * t * 1.15 + vec3(1.35, 0.72, 0.22) * w * smoothstep(0.9, 1.0, u.y); a = 0.0; }
        else { float r = length(u - 0.5); float g = exp(-r * r * 30.0); c = (vD.y > 0.5 ? vec3(2.2, 1.0, 0.3) : vec3(0.5, 1.2, 2.4)) * g * 1.6; a = 0.0; }
        gl_FragColor = vec4(c, a); }` });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 3; mesh.name = 'life_billboards'; scene.add(mesh);
  return { mesh, U, set(i, x, y, z, s, kind, a = 0, b = 0) { iP.setXYZW(i, x, y, z, s); iD.setXYZW(i, kind, a, b, 0); }, flush() { iP.needsUpdate = true; iD.needsUpdate = true; } };
}

// ---------- audio (WebAudio, synthesized; starts on first gesture; mute saved) ----------
function makeAudio() {
  let ctx = null, master = null, muted = localStorage.getItem('mk_mute') === '1', humG = null;
  const start = () => { if (ctx) return; try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; } master = ctx.createGain(); master.gain.value = muted ? 0 : 0.55; master.connect(ctx.destination);
    humG = ctx.createGain(); humG.gain.value = 0.05; humG.connect(master); for (const f of [55, 82.4, 110.3]) { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; const g = ctx.createGain(); g.gain.value = f === 55 ? 0.6 : 0.25; o.connect(g); g.connect(humG); o.start(); }
    const pad = ctx.createGain(); pad.gain.value = 0.0; pad.connect(master); const chords = [[220, 277.2, 329.6], [196, 246.9, 293.7], [174.6, 220, 261.6], [196, 246.9, 329.6]]; let ci = 0; const osc = chords[0].map(f => { const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f; const g = ctx.createGain(); g.gain.value = 0.018; o.connect(g); g.connect(pad); o.start(); return o; });
    pad.gain.setTargetAtTime(1, ctx.currentTime, 4); setInterval(() => { ci = (ci + 1) % chords.length; osc.forEach((o, k) => o.frequency.setTargetAtTime(chords[ci][k], ctx.currentTime, 1.5)); }, 8000); };
  const once = () => { start(); removeEventListener('pointerdown', once); removeEventListener('keydown', once); }; addEventListener('pointerdown', once); addEventListener('keydown', once);
  const blip = (f0, f1, dur, vol = 0.08, type = 'square') => { if (!ctx || muted) return; const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f0, ctx.currentTime); o.frequency.exponentialRampToValueAtTime(f1, ctx.currentTime + dur); g.gain.setValueAtTime(vol, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur); o.connect(g); g.connect(master); o.start(); o.stop(ctx.currentTime + dur + 0.02); };
  const noise = (dur, f, q, vol) => { if (!ctx || muted) return; const n = ctx.createBufferSource(); const b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; n.buffer = b; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q; const g = ctx.createGain(); g.gain.setValueAtTime(vol, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur); n.connect(bp); bp.connect(g); g.connect(master); n.start(); };
  return { get muted() { return muted; }, setMuted(v) { muted = v; localStorage.setItem('mk_mute', v ? '1' : '0'); if (master) master.gain.value = v ? 0 : 0.55; },
    beep() { const f = 600 + Math.random() * 900; blip(f, f * (Math.random() < 0.5 ? 1.6 : 0.6), 0.09, 0.05); setTimeout(() => blip(f * 1.3, f * 0.9, 0.07, 0.04), 110); },
    step() { noise(0.06, 380, 1.2, 0.05); }, radio() { noise(0.35, 1800, 0.8, 0.04); setTimeout(() => blip(1200, 1200, 0.05, 0.03, 'sine'), 360); }, whoosh() { noise(1.4, 500, 0.6, 0.03); } };
}

export function makeWorldLife({ scene, camera, env, creatures = null, groundAt, depotP, fields, base, launch, crater, t, hud, low, mobile, ctrl, dish, makeCrew }) {
  const mat = vcMat(env); const root = new THREE.Group(); root.name = 'world_life'; scene.add(root);
  const parts = makeParticles(scene, low ? 140 : mobile ? 340 : 520); const bb = makeBillboards(scene, 16); if (low) { parts.pts.visible = false; parts.emit = () => { }; parts.emitR = () => { }; } /* ?q=low: no particle draw (call budget) */ const audio = makeAudio();
  // sky ships: 2 shuttles + 1 satellite, merged-geometry meshes moved along arcs high in the sky
  const shG = shuttleGeo(); const LITE = low || mobile; const VR = low ? 45 : mobile ? 75 : 120; // phone/low: fewer sky extras, shorter view range for ground vehicles
  const ships = (low ? [] : LITE ? [0] : [0, 1]).map(i => { const m = new THREE.Mesh(shG, mat); m.name = 'life_ship'; m.scale.setScalar(2.2); root.add(m); return { m, i, t: i === 0 ? 0.4 : 18 }; });
  // v124: shuttles fly fixed world routes (hub oval + hub↔launch corridor), not whatever the camera happens to face.
  const shipRoutes = [
    { cx: base.x + 4, cz: base.z - 6, rx: 42, rz: 16, yaw: Math.atan2(-0.595, 0.803), y0: 14, y1: 20, dur: 24 },
    { cx: (base.x + launch.x) * 0.5, cz: (base.z + launch.z) * 0.5, rx: 210, rz: 72, yaw: Math.atan2(launch.z - base.z, launch.x - base.x), y0: 96, y1: 132, dur: 44 },
  ];
  const SKY_R = low ? 0 : mobile ? 200 : 250; // hub and the launch pad still see their craft; a canyon/echo centre does not pick up the base traffic
  const sat = new THREE.Mesh(satGeo(), mat); sat.name = 'life_sat'; sat.scale.setScalar(0.85); root.add(sat); sat.visible = !LITE;
  const lift = new THREE.Mesh(shG, mat); lift.name = 'life_liftoff'; lift.scale.setScalar(2.6); root.add(lift); let liftT = 5;
  // ground vehicles
  const HID = low ? 0 : mobile ? 16 : 28, /* 20-gon tyres while the hauler is readable from the play stand; 8-gon only once it is a small shape */ HIDD = low ? 0 : mobile ? 40 : 48; /* the play stand and a walk around the rig stay on the full mast; low keeps the same silhouette with fewer wheels */ const rvG = [haulerGeo(false), low ? null : haulerGeo(true)], drG = [rigGeo(false, low), low ? null : rigGeo(true, false)] /* v99: own rig (concept), machines.js untouched */;
  const rover = new THREE.Mesh(rvG[0], mat); rover.name = 'life_rover'; rover.userData.hi = rvG[1]; /* lamps are the round discs in the hauler mesh; no cone wedges */ rover.scale.setScalar(1.0); rover.castShadow = true; root.add(rover);
  const roverCols = [{ lz: -0.55, r: 1.02 }, { lz: 0.12, r: 1.10 }, { lz: 0.80, r: 1.02 }].map(c => ({ x: 0, z: 0, r: c.r, h: 2.0, lz: c.lz })); if (ctrl && ctrl.colliders) roverCols.forEach(c => ctrl.colliders.push(c));
  let sparkAcc = 0, sparkFl = 0; const drill = new THREE.Mesh(drG[0], mat); drill.name = 'life_drill'; drill.userData.hi = drG[1]; drill.scale.setScalar(1.15); /* concept: the drill rig is a big hero prop */ root.add(drill); const bit = new THREE.Mesh(augerGeo(!mobile), mat); bit.position.copy(DRILL_HEAD); drill.add(bit); bit.visible = !low;
  // rotating radar dish next to the base
  if (false) { const rg = merge([col(new THREE.CylinderGeometry(0.25, 0.4, 3.2, 8).translate(0, 1.6, 0), '#d8cdb5'), col(new THREE.BoxGeometry(0.8, 0.5, 0.8).translate(0, 3.3, 0), '#f0b020' /* v123 warmer gold */)]); const st_ = new THREE.Mesh(rg, mat); const rx = base.x + 22, rz = base.z - 12; st_.position.set(rx, groundAt(rx, rz), rz); root.add(st_);
    dish = new THREE.Mesh(merge([col(new THREE.SphereGeometry(2.2, 16, 6, 0, Math.PI * 2, 0, 0.9).rotateX(-Math.PI / 2 + 0.5).translate(0, 0.6, 0), '#efe6d2'), col(new THREE.CylinderGeometry(0.05, 0.05, 2.0, 4).rotateX(-0.6).translate(0, 1.3, 0.55), '#f0b020' /* v123 warmer gold */), col(new THREE.SphereGeometry(0.15, 6, 4).translate(0, 2.1, 1.1), '#7fe0ff', 3.0)]), mat); dish.position.set(0, 3.5, 0); st_.add(dish); dish.name = 'life_radar'; }
  // beacons (instanced spheres, blinking) on the base
  const bN = 6; const beacons = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 6, 4), new THREE.MeshBasicMaterial({ toneMapped: false }), bN); beacons.name = 'life_beacons'; root.add(beacons); beacons.visible = !low; // ?q=low: no beacons / no separate drill bit (draw calls)
  const bPos = Array.from({ length: bN }, (_, i) => { const a = i / bN * Math.PI * 2 + 0.3, r = 9 + (i % 2) * 6; const x = base.x + Math.cos(a) * r, z = base.z + Math.sin(a) * r; return { x, z, y: groundAt(x, z) + 3.2 + (i % 3) * 1.4, c: i % 2 ? new THREE.Color(2.6, 0.25, 0.15) : new THREE.Color(0.3, 1.2, 2.8), ph: i * 0.7 }; });
  // drill site + rover loop on open, flat ground next to the depot (scored: flatness incl. rocks via solids, clearance from props, distance from the base core)
  const sAt = ctrl && ctrl.solids ? (x, z) => ctrl.solids.standAt(x, z) : groundAt; const cols = (ctrl && ctrl.colliders) || [];
  const flat = (x, z, r) => { let mn = 1e9, mx = -1e9; for (let dx = -r; dx <= r; dx += 2) for (let dz = -r; dz <= r; dz += 2) { const h = sAt(x + dx, z + dz); mn = Math.min(mn, h); mx = Math.max(mx, h); } return mx - mn; };
  const clear = (x, z) => cols.reduce((m, c) => Math.min(m, Math.hypot(c.x - x, c.z - z) - (c.r || 1)), 1e9);
  const cy0 = Math.atan2(-F.x, -F.z) - 0.30, fwd = { x: -Math.sin(cy0), z: -Math.cos(cy0) }, right = { x: Math.cos(cy0), z: -Math.sin(cy0) };
  shipRoutes[0].cx -= right.x * 8; shipRoutes[0].cz -= right.z * 8; // stand sky: the near shuttle sits upper-left of the dome, not on the look axis
  // mid-right of the play stand, clear of the cat's corridor and of the crater bowl
  let D = { x: PLAY_START.x + fwd.x * 26 + right.x * 14, z: PLAY_START.z + fwd.z * 26 + right.z * 14 };
  if (flat(D.x, D.z, 4) > 2.5 || clear(D.x, D.z) < 3) { let bs = 1e9, fallback = D; for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; const x = D.x + Math.cos(a) * 4, z = D.z + Math.sin(a) * 4; const sc = flat(x, z, 4) * 3 + Math.max(0, 4 - clear(x, z)) * 4; if (sc < bs) { bs = sc; fallback = { x, z }; } } D = fallback; }
  const dd = { x: D.x - depotP.x, z: D.z - depotP.z }, dl = Math.hypot(dd.x, dd.z) || 1, ux = dd.x / dl, uz = dd.z / dl, px = -uz, pz = ux;
  drill.position.set(D.x, groundAt(D.x, D.z), D.z); drill.rotation.y = Math.atan2(PLAY_START.x - D.x, PLAY_START.z - D.z) + 0.6;
  // rover: depot -> around the drill -> back (closed loop), all inside the open patch
  const hc = sd(4, -18); const hux = F.x, huz = F.z, hpx = -huz, hpz = hux; const loopPts = []; for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; loopPts.push(new THREE.Vector3(hc.x + hux * Math.cos(a) * 5.2 + hpx * Math.sin(a) * 1.8, 0, hc.z + huz * Math.cos(a) * 5.2 + hpz * Math.sin(a) * 1.8)); } setRut(hc.x, hc.z, 5.2, 1.8, hux, huz); setCrater(PLAY_CRATER.x, PLAY_CRATER.z, PLAY_CRATER.r); setRut2(REGIONS.echo.x + 6, REGIONS.echo.z - 2, 8.5, 2.4, 0.71, -0.70); { const _ah = Math.atan2(-REGIONS.reactor.z, -REGIONS.reactor.x); setRut3(REGIONS.reactor.x + Math.cos(_ah) * 34, REGIONS.reactor.z + Math.sin(_ah) * 34, 10, 2.6, Math.cos(_ah), Math.sin(_ah)); }
  const loop = new THREE.CatmullRomCurve3(loopPts, true); const loopLen = loop.getLength();
  // porters: two crew robots shuttling crystals drill -> depot; they wave at the cat when it comes close
  const porters = makeCrew ? [['builder', 0, -7], ['geologist', 0.27, 0.8]].map(([ty, o, ln]) => { const r = makeCrew(scene, env, ty, 2); r.root.name = 'life_porter'; return { r, o, ln, wave: 0 }; }) /* v97: separate lanes + phase so they never stack behind the cat */ : [];
  // v51: a builder welding at the depot wall near the base (orange spark bursts); impostor when far, like the porters
  const welder = makeCrew ? (() => { const r = makeCrew(scene, env, 'builder', 2); r.root.name = 'life_welder'; const x = D.x - fwd.x * 3.4 - right.x * 2.0, z = D.z - fwd.z * 3.4 - right.z * 2.0; return { r, x, z, yaw: Math.atan2(D.x - x, D.z - z), far: false }; })() : null;
  const IMP_D = low ? 6 : mobile ? 7 : 8; const NEAR = low ? 2.4 : mobile ? 2.6 : 2.2; /* v125: the lower boom sits closer to the plaza, so the hi band shrinks or the among-crew view exceeds 100k */ /* v51: life robots show hi only (no lo band) -> impostor beyond NEAR */ // same as the crew: far porters become impostors (one shared instanced draw)
  const pA = { x: D.x - ux * 3 + px * 2, z: D.z - uz * 3 + pz * 2 }, pB = { x: depotP.x + ux * 2.5 + px * 1.2, z: depotP.z + uz * 2.5 + pz * 1.2 };
  if (welder) { const gx = welder.x, gz = welder.z; welder.y = groundAt(gx, gz); }
  // Fixed world worksites. Positions do not depend on the camera. Near: the real crew mesh (its own hi/lo). Far: the shared impostor.
  const zones = [];
  const s0c = canyonS(REGIONS.canyon.x, REGIONS.canyon.z);
  const camp = canyonPoint(s0c - 36, 2.4), camp2 = canyonPoint(s0c - 30, -2.6);
  const Lc = REGIONS.launch, Rc = REGIONS.reactor, Ec = REGIONS.echo, ah = Math.atan2(-Rc.z, -Rc.x);
  const face = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);
  const spots = [
    ['geologist', camp.x, camp.z, face(camp.x, camp.z, camp2.x, camp2.z), 'canyon'],
    ['builder', camp2.x, camp2.z, face(camp2.x, camp2.z, camp.x, camp.z), 'canyon'],
    ['builder', Lc.x + 18, Lc.z + 12, face(Lc.x + 18, Lc.z + 12, Lc.x, Lc.z), 'launch'],
    ['engineer', Lc.x + 14, Lc.z - 16, face(Lc.x + 14, Lc.z - 16, Lc.x, Lc.z), 'launch'],
    ['builder', Rc.x + Math.cos(ah) * 22, Rc.z + Math.sin(ah) * 22, face(Rc.x + Math.cos(ah) * 22, Rc.z + Math.sin(ah) * 22, Rc.x, Rc.z), 'reactor'],
    ['engineer', Rc.x + Math.cos(ah + 0.4) * 18, Rc.z + Math.sin(ah + 0.4) * 18, ah + Math.PI, 'reactor'],
    ['engineer', Ec.x + 11, Ec.z - 5, face(Ec.x + 11, Ec.z - 5, Ec.x, Ec.z), 'echo'],
    ['builder', Ec.x + 16, Ec.z + 3, face(Ec.x + 16, Ec.z + 3, Ec.x, Ec.z), 'echo'],
  ];
  if (makeCrew) for (const [ty, x, z, yaw, kind] of spots) { const r = makeCrew(scene, env, ty, low ? 1 : 2); r.root.name = 'life_zone'; r.root.visible = false; zones.push({ r, type: ty, x, z, y: groundAt(x, z), yaw, kind, far: false }); }
  const skyHomes = [
    { x: camp.x + 6, z: camp.z - 18, y: groundAt(camp.x, camp.z) + 26, ph: 0.4 },
    { x: Lc.x + 28, z: Lc.z - 36, y: groundAt(Lc.x, Lc.z) + 48, ph: 1.1 },
    { x: Rc.x + 30, z: Rc.z - 22, y: groundAt(Rc.x, Rc.z) + 40, ph: 2.0 },
    { x: Ec.x - 16, z: Ec.z + 20, y: groundAt(Ec.x, Ec.z) + 36, ph: 2.7 },
  ];
  // steam vents: play-stand right plain (hauler crew), welder, and the plaza toward the drill
  const ventAt = (x, z, tt) => { const gy = Math.max(groundAt(x, z), sAt(x, z)); return { x, z, y: gy + 1.15, gy, tt }; };
  const vents = [ventAt(PLAY_START.x + fwd.x * 8 + right.x * 8, PLAY_START.z + fwd.z * 8 + right.z * 8, 0.05), ventAt(PLAY_START.x + fwd.x * 12 + right.x * 10.5, PLAY_START.z + fwd.z * 12 + right.z * 10.5, 0.4)];
  vents[0].play = vents[1].play = true;
  if (welder) vents.push(ventAt(welder.x + Math.sin(welder.yaw) * 1.5, welder.z + Math.cos(welder.yaw) * 1.5, 0.35));
  { const x = base.x + (D.x - base.x) * 0.62 - (D.z - base.z) * 0.12, z = base.z + (D.z - base.z) * 0.62 + (D.x - base.x) * 0.12; vents.push(ventAt(x, z, 0)); }
  const crewSpark = vents[0]; /* orange sparks beside the hauler crew, same particle system as the welder */
  const zoneVents = [ventAt(camp.x, camp.z + 3, 0.1), ventAt(Lc.x - 8, Lc.z + 6, 0.3), ventAt(Rc.x + Math.cos(ah + 1.2) * 33, Rc.z + Math.sin(ah + 1.2) * 33, 0.15), ventAt(Ec.x + 12, Ec.z + 2, 0.4)];
  if (!low) { const cap = new THREE.InstancedMesh(col(new THREE.CylinderGeometry(0.45, 0.75, 0.55, 8).translate(0, 0.27, 0), '#8c919b'), mat, vents.length); cap.name = 'life_ventcaps'; const m4 = new THREE.Matrix4(); vents.forEach((v, i) => cap.setMatrixAt(i, m4.makeTranslation(v.x, v.gy, v.z))); root.add(cap); } /* vent caps so plumes start at the ground */
  { drill.updateMatrixWorld(true); const w = drill.localToWorld(new THREE.Vector3(0.42, 2.44, 0.88)); vents.push({ x: w.x, z: w.z, y: w.y, gy: w.y - 0.2, tt: 0.3 }); } /* stack on the cab, same sample the plume uses */
  // lore anchors
  const J = crater; const bunnyPath = { a0: Math.atan2(J.z - base.z, J.x - base.x) + 0.9 };
  const RADIO = ['radio1', 'radio2', 'radio3', 'radio4', 'radio5']; let radioT = 25, beepT = 3, stepT = 0, waveCD = 0;
  let on = true, T = 0; const v = new THREE.Vector3(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  // mute toggle on the HUD
  const mb = document.createElement('button'); mb.id = 'mk-mute'; mb.className = 'pe'; mb.textContent = audio.muted ? '🔇' : '🔊'; mb.setAttribute('aria-label', 'mute');
  mb.style.cssText = 'position:absolute;right:max(10px,env(safe-area-inset-right));top:max(64px,calc(env(safe-area-inset-top) + 56px));width:38px;height:38px;border-radius:50%;border:1.5px solid #C8912A;background:radial-gradient(circle,#13214a,#0B1530);color:#fff;font-size:16px;box-shadow:0 0 8px rgba(103,215,240,.45);pointer-events:auto';
  mb.addEventListener('click', () => { audio.setMuted(!audio.muted); mb.textContent = audio.muted ? '🔇' : '🔊'; }); (hud.root || document.body).appendChild(mb);
  const sub = (key) => { const s = t(key); if (s && s !== key) hud.toast('📻 ' + s); };

  // v73: Dust Jellies are real creatures (creatures.js) instead of billboards: bb size s ~ bell 0.75*s -> creature scale; near ones (k 2,3) get the detailed slots
  const JR = low ? 55 : mobile ? 80 : 110;
  function jelly(bi, k, x, y, z, s) { const cam = camera.position, far = Math.hypot(x - cam.x, z - cam.z) > (k >= 2 ? JR : 260); if (!creatures) { if (far) bb.set(bi, 0, -999, 0, 0, 0); else bb.set(bi, x, y, z, s, 0, k * 1.3); return; } bb.set(bi, 0, -999, 0, 0, 0); const sl = creatures.S.jelly + (k >= 2 ? k - 2 : 2 + k), sc = s * 0.75;
    if (far) { creatures.hide(sl); return; } creatures.set(sl, x, y - 1.25 * sc, z, T * 0.08 + k * 1.7, sc, [k * 1.3, 1, 0, 1], 0.06 * Math.sin(T * 0.5 + k), 0, 1 + 0.07 * Math.sin(T * 1.7 + k), 1.6); } /* v124: far jellies stay over the crater (hub still sees them); other zones do not pay for them */
  function update(dt, time, cat, robots) {
    if (!on) return; T += dt; bb.U.uT.value = T;
    const cam = camera.position;
    // ships across the sky (relative to the base so they read from anywhere)
    for (const s of ships) { s.t += dt; const rt = shipRoutes[s.i] || shipRoutes[0]; const u = (s.t % rt.dur) / rt.dur, a = u * Math.PI * 2; const lx = Math.cos(a) * rt.rx, lz = Math.sin(a) * rt.rz; const c = Math.cos(rt.yaw), sn = Math.sin(rt.yaw); const x = rt.cx + lx * c - lz * sn, z = rt.cz + lx * sn + lz * c; const y = groundAt(base.x, base.z) + rt.y0 + (rt.y1 - rt.y0) * (0.5 + 0.5 * Math.sin(a)); const tx = -Math.sin(a) * rt.rx, tz = Math.cos(a) * rt.rz; const wx = tx * c - tz * sn, wz = tx * sn + tz * c; s.m.position.set(x, y, z); s.m.rotation.set(0.08, Math.atan2(wx, wz), 0.12); s.m.scale.setScalar(s.i === 0 ? 1.7 : 3.2); s.m.visible = Math.hypot(x - cam.x, z - cam.z) < SKY_R; }
    const nearBase = Math.hypot(base.x - cam.x, base.z - cam.z) < (mobile ? 190 : 240), nearLaunch = Math.hypot(launch.x - cam.x, launch.z - cam.z) < (mobile ? 170 : 210);
    const nearZone = zones.some(Z => Math.hypot(Z.x - cam.x, Z.z - cam.z) < 160);
    if (!LITE) { const u = (T % 80) / 80; const a = u * Math.PI * 2; const gy = groundAt(base.x, base.z); const cx = PLAY_START.x + fwd.x * 52 + right.x * 30, cz = PLAY_START.z + fwd.z * 52 + right.z * 30; sat.position.set(cx + Math.cos(a) * 2.5, gy + 14 + Math.sin(a) * 0.6, cz + Math.sin(a) * 1.6); sat.rotation.y += dt * 0.15; sat.rotation.z = 0.35; sat.visible = nearBase && Math.hypot(sat.position.x - cam.x, sat.position.z - cam.z) < 430; }
    // distant shuttle lift-off at the launch site, then re-lands after a pause
    liftT += dt; { const cyc = 48, k = liftT % cyc; const gy = groundAt(launch.x, launch.z); const climb = k < 18 ? Math.pow(k / 18, 2) * 260 : 260 + (k - 18) * 40; const liftNear = Math.hypot(launch.x - cam.x, launch.z - cam.z) < 750; lift.visible = k < 30 && !LITE && liftNear; lift.position.set(launch.x + (k > 8 ? (k - 8) * (k - 8) * 0.25 : 0), gy + 6 + climb, launch.z); lift.rotation.set(0, 0, Math.PI / 2 - Math.min(0.5, Math.max(0, k - 8) * 0.03));
      if (lift.visible && k < 26) { for (let n = 0; n < 2; n++) parts.emit(lift.position.x - 1, lift.position.y - 5, lift.position.z, (Math.random() - 0.5) * 3, -8 - Math.random() * 6, (Math.random() - 0.5) * 3, 1.2, 4.5, 2.2, 1.0, 0.3, 0.0, 'fire', 6); if (k < 4) parts.emit(launch.x + (Math.random() - 0.5) * 8, gy + 1, launch.z + (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 6, 1.5, (Math.random() - 0.5) * 6, 2.5, 4, 0.5, 0.5, 0.5, 0.35, 'smoke', 10); } }
    // engine glows for the ships, shooting stars, jellies, bunny (billboards)
    let bi = 0; for (const s of ships) { if (s.m.visible) { s.m.localToWorld(v.set(-2.5, 0, 0)); bb.set(bi, v.x, v.y, v.z, s.i === 0 ? 4.2 : 11, 3, 0); } else bb.set(bi, 0, -999, 0, 0, 3); bi++; }
    // v124: three fixed meteor lanes (hub sky, hub sky offset, hub↔launch). Same billboard slots. They do not respawn into the lens.
    const lanes = [
      { x: PLAY_START.x + fwd.x * 42 + right.x * 1, z: PLAY_START.z + fwd.z * 42 + right.z * 1, y: groundAt(base.x, base.z) + 18, dir: Math.atan2(right.x, right.z), span: 32, per: 7, ph: 0.8, drop: 8 },
      { x: base.x + 36, z: base.z - 24, y: groundAt(base.x, base.z) + 120, dir: Math.atan2(-0.806, 0.592) - 0.55, span: 190, per: 9.5, ph: 3.1 },
      { x: (base.x + launch.x) * 0.5, z: (base.z + launch.z) * 0.5, y: groundAt(launch.x, launch.z) + 150, dir: Math.atan2(launch.x - base.x, launch.z - base.z), span: 280, per: 12, ph: 1.6 },
    ];
    for (let k = 0; k < 3; k++) { const s = lanes[k], u = ((T + s.ph) % s.per) / s.per, along = (u - 0.5) * s.span; const x = s.x + Math.sin(s.dir) * along, z = s.z + Math.cos(s.dir) * along, y = s.y - u * (s.drop || 36); if (Math.hypot(x - cam.x, z - cam.z) > SKY_R) bb.set(bi, 0, -999, 0, 0, 2); else bb.set(bi, x, y, z, k === 0 ? 7 : 18, 2, 0, s.dir); bi++; }
    for (let k = 0; k < 4; k++) { if (k < 2) { const a = k * 1.7 + T * 0.03; const x = J.x + Math.cos(a) * (14 + k * 6), z = J.z + Math.sin(a) * (14 + k * 6), y = groundAt(J.x, J.z) + 22 + k * 7 + Math.sin(T * 0.6 + k) * 3; jelly(bi++, k, x, y, z, 8 + k * 2); } else { const a = k * 2.1 + T * 0.05; const along = k === 2 ? 36 : 42, side = k === 2 ? 20 : 26; const cx = PLAY_START.x + fwd.x * along + right.x * side, cz = PLAY_START.z + fwd.z * along + right.z * side; const x = cx + Math.cos(a) * 1.6, z = cz + Math.sin(a) * 1.6, y = groundAt(base.x, base.z) + (k === 2 ? 14 : 17) + Math.sin(T * 0.7 + k) * 0.6; jelly(bi++, k, x, y, z, k === 2 ? 3.6 : 3.1); } }
    for (const H of skyHomes) { const d = Math.hypot(H.x - cam.x, H.z - cam.z); if (d > 260) bb.set(bi, 0, -999, 0, 0, 0); else bb.set(bi, H.x + Math.cos(T * 0.12 + H.ph) * 3.5, H.y + Math.sin(T * 0.35 + H.ph) * 1.4, H.z + Math.sin(T * 0.12 + H.ph) * 3.5, 4.4, 0, H.ph); bi++; }
    { const cyc = 75, k = T % cyc; if (k < 6) { const a = bunnyPath.a0 + k * 0.05; const r = 320; const x = base.x + Math.cos(a) * r, z = base.z + Math.sin(a) * r; bb.set(bi, x, groundAt(x, z) + 3 + Math.abs(Math.sin(k * 6)) * 2.5, z, 5, 1, 0); } else bb.set(bi, 0, -999, 0, 0, 1); bi++; }
    bb.flush(); bb.mesh.visible = !low && (nearBase || nearLaunch || nearZone); /* far zones skip the always-on billboard draw */
    // rover on its loop: follows the ground, dust trail, crystals while hauling back
    { const u = ((T * 2.2) / loopLen) % 1; loop.getPointAt(u, v); const gy = groundAt(v.x, v.z); const tng = loop.getTangentAt(u); rover.position.set(v.x, gy, v.z); rover.rotation.y = Math.atan2(tng.x, tng.z); { const fx = Math.sin(rover.rotation.y), fz = Math.cos(rover.rotation.y); for (const c of roverCols) { c.x = v.x + fx * c.lz; c.z = v.z + fz * c.lz; } }
      const e = 0.9; const fy = groundAt(v.x + tng.x * e, v.z + tng.z * e), by = groundAt(v.x - tng.x * e, v.z - tng.z * e); rover.rotation.x = -Math.atan2(fy - by, 2 * e) ; { const dR = Math.hypot(v.x - cam.x, v.z - cam.z); rover.visible = dR < (globalThis.__mkStorm ? 12 : VR); const hiD = HID + (rover.userData.hiOn ? 8 : 0); rover.userData.hiOn = dR < (globalThis.__mkStorm ? 0 : hiD); rover.geometry = rover.userData.hiOn && rvG[1] ? rvG[1] : rvG[0]; }
      if (rover.visible && Math.random() < dt * 90) { const bx = v.x - tng.x * 1.6, bz = v.z - tng.z * 1.6; parts.emit(bx + (Math.random() - 0.5), gy + 0.3, bz + (Math.random() - 0.5), (Math.random() - 0.5) * 0.9, 0.55 + Math.random() * 0.6, (Math.random() - 0.5) * 0.9, 2.0, 1.25, 0.5, 0.46, 0.42, 0.35, 'smoke', 2.6); /* v119 denser dust */ } }
    // drill: bit spins + bobs, sparks at the ground
    // porters: walk A->B carrying a crystal, return empty; wave when the cat is near
    for (const P of porters) { const cyc = 22, k = ((T / cyc + P.o) % 1); const go = k < 0.5, u = go ? k * 2 : (k - 0.5) * 2; const e = u < 0.1 ? 0 : u > 0.9 ? 1 : (u - 0.1) / 0.8; const a = go ? pA : pB, b = go ? pB : pA;
      const x = a.x + (b.x - a.x) * e + px * P.ln, z = a.z + (b.z - a.z) * e + pz * P.ln; const dc = cat ? Math.hypot(cat.x - x, cat.z - z) : 99; if (dc < 4.5 && P.wave <= 0) P.wave = 3.5; P.wave -= dt;
      const R = P.r.root; const gy = groundAt(x, z); R.position.set(x, gy, z); const dcam = Math.hypot(x - cam.x, gy + 0.6 - cam.y, z - cam.z); /* v76: 3D distance like the crew hi/lo switch -> no lo mesh inside the near band (impostor instead) */ P.far = dcam >= NEAR && dcam < 90; const vis = dcam < NEAR; R.visible = vis; P.yaw = Math.atan2(b.x - a.x, b.z - a.z); if (!vis) continue;
      const moving = u >= 0.1 && u <= 0.9; let yaw = Math.atan2(b.x - a.x, b.z - a.z); if (P.wave > 0 && cat) yaw = Math.atan2(cat.x - x, cat.z - z); R.rotation.y = yaw;
      const mode = P.wave > 0 ? (go ? 'wavecarry' : 'wave') : go ? (moving ? 'carry' : 'carryidle') : (moving ? 'walk' : 'idle'); P.r.update(dt, mode, P.wave > 0 && dcam < 6 ? null : cam); }
    const ZNEAR = low ? 8 : mobile ? 10 : 12;
    for (const Z of zones) { const R = Z.r.root; R.position.set(Z.x, Z.y, Z.z); R.rotation.y = Z.yaw; const dcam = Math.hypot(Z.x - cam.x, Z.z - cam.z); const show = dcam < ZNEAR; Z.far = !show && dcam < 120; R.visible = show; if (show) Z.r.update(dt, 'work', cam); if (dcam < 70 && Math.random() < dt * 70) parts.emit(Z.x + 0.4, Z.y + 0.9, Z.z + 0.3, (Math.random() - 0.5) * 2.2, 1.4 + Math.random() * 1.8, (Math.random() - 0.5) * 2.2, 0.7, 0.35, 4.2, 1.3, 0.22, 0, 'spark', 0, 8); }
    if (welder) { const W = welder, R = W.r.root; R.position.set(W.x, W.y, W.z); R.rotation.y = W.yaw; const dcam = Math.hypot(W.x - cam.x, W.z - cam.z); W.far = dcam >= NEAR && dcam < 90; R.visible = dcam < NEAR; /* static prop: impostor sooner than the porters (budget) */ if (R.visible) { W.r.update(dt, 'work', null); W.r.pivot.rotation.x = 0.28 + Math.sin(T * 7) * 0.05; }
      const burst = (T % 3.2) < 2.2; if (burst && dcam < 70 && Math.random() < dt * 70) { const fx = Math.sin(W.yaw), fz = Math.cos(W.yaw), sx = W.x + fx * 0.8, sz = W.z + fz * 0.8; parts.emit(sx, W.y + 0.85, sz, (Math.random() - 0.5) * 3 - fx * 1.2, 1 + Math.random() * 2.5, (Math.random() - 0.5) * 3 - fz * 1.2, 0.7, 0.22, 3.0, 0.9, 0.12, 0, 'spark', 0, 9); } }
    if (crewSpark && Math.hypot(crewSpark.x - cam.x, crewSpark.z - cam.z) < 90 && Math.random() < dt * 45) { parts.emit(crewSpark.x + (Math.random() - 0.5) * 0.45, crewSpark.gy + 0.5, crewSpark.z + (Math.random() - 0.5) * 0.45, (Math.random() - 0.5) * 3.2, 1.2 + Math.random() * 2.2, (Math.random() - 0.5) * 3.2, 0.6, 0.3, 3.6, 1.2, 0.15, 0, 'spark', 0, 8); }
    { const dv = Math.hypot(D.x - cam.x, D.z - cam.z) < (globalThis.__mkStorm ? 0 : VR); drill.visible = dv; if (dv) { drill.geometry = Math.hypot(D.x - cam.x, D.z - cam.z) < (globalThis.__mkStorm ? 0 : HIDD) ? /* v75: storm view budget */ drG[1] : drG[0]; bit.rotation.y += dt * 14; bit.position.y = DRILL_HEAD.y + Math.sin(T * 1.3) * 0.035; sparkAcc += dt * 80; sparkFl -= dt; if (sparkFl <= 0) { sparkFl = 0.85; sparkAcc += 8; } if (sparkAcc >= 1) { bit.updateMatrixWorld(true); bit.localToWorld(v.set(0, AUGER_TIP, 0));
          while (sparkAcc >= 1) { sparkAcc -= 1; const a = Math.random() * Math.PI * 2, sp = 0.25 + Math.random() * 0.7; parts.emit(v.x, v.y, v.z, Math.cos(a) * sp, -0.15 - Math.random() * 1.3, Math.sin(a) * sp, 0.4, 0.14, 1.05, 0.42, 0.06, 0, 'spark', 0, 10); } } } }
    // steam puffs
    for (const s of vents.concat(zoneVents)) { s.tt -= dt; if (s.tt <= 0) { s.tt = 0.16 + Math.random() * 0.06; if (Math.hypot(s.x - cam.x, s.z - cam.z) < 160) { const nP = s.play ? 2 : 1; for (let n = 0; n < nP; n++) parts.emitR(s.x + (Math.random() - 0.5) * 0.5, s.gy + 0.5 + n * 0.2, s.z + (Math.random() - 0.5) * 0.55, 0.25 + (Math.random() - 0.5) * 0.35, 2.0 + Math.random() * 0.45, 0.12 + (Math.random() - 0.5) * 0.3, 4.0, 1.05, 0.82, 0.84, 0.88, 0.42, 'steam', 2.6); } } } /* play-stand vents puff a pair of wisps; drill and welder stay on the same steam slots */
    // beacons blink, dish turns
    { const nearB = Math.hypot(base.x - cam.x, base.z - cam.z) < (mobile ? 100 : 160); beacons.visible = !low && nearB; const caps = root.getObjectByName('life_ventcaps'); if (caps) caps.visible = nearB; const M = new THREE.Matrix4(); bPos.forEach((b, i) => { const on_ = Math.sin(T * 3.0 + b.ph) > 0.2; M.makeTranslation(b.x, b.y, b.z); beacons.setMatrixAt(i, M); beacons.setColorAt(i, on_ ? b.c : new THREE.Color(0.06, 0.06, 0.08)); }); beacons.instanceMatrix.needsUpdate = true; if (beacons.instanceColor) beacons.instanceColor.needsUpdate = true; }
    if (dish) dish.rotation.y += dt * 0.15;
    parts.update(dt); parts.pts.visible = parts.pts.visible && !low && (nearBase || nearLaunch || nearZone);
    // audio: robot beeps nearby, footsteps, radio chatter with subtitles; robots greet the cat
    beepT -= dt; stepT -= dt; radioT -= dt; waveCD -= dt;
    if (robots && robots.length) { let nd = 1e9, nr = null; for (const r of robots) { const d = Math.hypot(r.x - cat.x, r.z - cat.z); if (d < nd) { nd = d; nr = r; } }
      if (beepT <= 0 && nd < 18) { beepT = 2.5 + Math.random() * 4; audio.beep(); }
      if (nr && nd < 3.2 && waveCD <= 0) { waveCD = 12; audio.beep(); nr.wave && nr.wave(); hud.toast('🤖 ' + t('robotHi')); } }
    if (ctrl && ctrl.onGround && ctrl.speed > 0.8 && stepT <= 0) { stepT = 0.42 / Math.min(2, ctrl.speed / 2); audio.step(); }
    if (radioT <= 0) { radioT = 40 + Math.random() * 40; audio.radio(); sub(RADIO[Math.floor(Math.random() * RADIO.length)]); }
  }
  const pushImp = (imp) => { if (!on) return; for (const P of porters) if (P.far) imp.push(P.r.root.position, P.r.type || 'builder', P.yaw); if (welder && welder.far) imp.push(welder.r.root.position, 'builder', welder.yaw); for (const Z of zones) if (Z.far) imp.push(Z.r.root.position, Z.type, Z.yaw); };
  const anchors = () => ({ crew: zones.map(Z => ({ kind: Z.kind, type: Z.type, x: Z.x, z: Z.z })), vents: zoneVents.map(v => ({ x: v.x, z: v.z })), sky: skyHomes.map(H => ({ x: H.x, z: H.z, y: H.y })) });
  return { root, update, audio, pushImp, anchors, setVisible(v_) { on = v_; root.visible = v_; if (!v_) { porters.forEach(P => { P.r.root.visible = false; P.far = false; }); if (welder) { welder.r.root.visible = false; welder.far = false; } zones.forEach(Z => { Z.r.root.visible = false; Z.far = false; }); } parts.pts.visible = v_ && !low; bb.mesh.visible = v_; mb.style.display = v_ ? '' : 'none'; }, meshes: { rover, drill, ships, sat, lift, beacons, porters: porters.map(p => p.r.root), welder: welder && welder.r.root, zones: zones.map(Z => Z.r.root) }, drillAt: D };
}
