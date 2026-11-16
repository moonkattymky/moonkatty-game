import * as THREE from 'three';
import { Kit, sq, cyl, sph, tor, capsule, ring, tube, crescent, gloveTo, material, faceTexture, builderKits, setLQ, LQ0, PRESET, setCosmetic, conceptLegs, conceptChest } from './robot.js';
// ============================================================================================
// Chapter 2 robot crew, derived 1:1 from the approved concept sheet (c3d81f09): same ivory/gold body language as the Builder,
// types differ by head gear, locomotion and tool:
//   geologist     - round head with gold top cap + lamp, (v100: concept legs, tracks removed), heavy DRILL right arm, gold sample canisters on the back
//   archaeologist - round head with gold top cap, (v100: concept legs, hover removed), glowing SCANNER (right), golden glyph TABLET (left), satchel + strap
//   engineer      - Builder legs + gold hard hat, SCREWDRIVER (right), WRENCH (left), holo BLUEPRINT panel, leather TOOLBELT with pouches
// Every robot = hi mesh (body + animated arm + face plane, 3 draws) near the camera, and a single-mesh LOD (eyes baked as self-lit
// geometry, ~1/4 tris, 1 draw) further away / always on ?q=low. Robot levels add visible tool upgrades (lvl 2: gold tool rings, lvl 3+: shoulder lamp).
// ============================================================================================
const PI = Math.PI;
function legs(body) { conceptLegs(body); } // v100: short cream legs + gold cuffed boots (concept), shared by every crew type
function torso(body, y0 = 0) { // waist joint, hip block, boxy torso shell, chest plate + crescent, belt, collar, neck, shoulder pads
  const Y = (y) => y + y0;
  body.add(sq(0.46, 0.12, 0.3, 2.4, 10, 4), 'dark', { p: [0, Y(0.515), 0] });
  body.add(sq(0.58, 0.2, 0.38, 2.6, 10, 5), 'ivoryS', { p: [-0.02, Y(0.44), 0.0] });
  body.add(sq(0.68, 0.48, 0.44, 3.2, 16, 9, { taper: 0.1, taperZ: 0.04 }), 'ivory', { p: [0, Y(0.73), 0] });
  conceptChest(body, y0);
  body.add(sq(0.52, 0.05, 0.36, 3, 10, 3), 'gold', { p: [0, Y(0.535), 0] });
  body.add(tor(0.16, 0.02, 3, 14), 'gold', { p: [0, Y(0.94), 0.0], r: [PI / 2, 0, 0], s: [1.3, 1.1, 1] });
  body.add(cyl(0.12, 0.13, 0.07, 12), 'dark', { p: [0, Y(0.955), 0] });
  for (const sx of [-1, 1]) { const so = 0.39; body.add(sq(0.3, 0.3, 0.34, 2.05, 10, 6), 'ivory', { p: [sx * so, Y(0.8), 0] });
    body.add(sq(0.3, 0.045, 0.34, 2.4, 10, 3), 'gold', { p: [sx * (so + 0.005), Y(0.69), 0], r: [0, 0, -sx * 0.12] });
    body.add(sq(0.05, 0.22, 0.05, 2.5, 4, 5), 'gold', { p: [sx * (so + 0.03), Y(0.81), 0.165], r: [0, 0, -sx * 0.2] }); }
}
function head(kit, y0, { round = false, hat = false, cap = false, lamp = false } = {}) {
  const HY = 1.15 + y0;
  const hs = round ? 1.1 : 1; kit.add(round ? sq(0.74, 0.6, 0.62, 2.2, 18, 12) : sq(0.74, 0.46, 0.58, 2.7, 18, 11), 'ivory', { p: [0, HY, 0], s: [hs, hs, hs] });
  for (const sx of [-1, 1]) { kit.add(cyl(0.125, 0.13, 0.06, 12), 'gold', { p: [sx * 0.37 * hs, HY - 0.01, -0.01], r: [0, 0, PI / 2] }); kit.add(cyl(0.088, 0.088, 0.065, 10), 'dark', { p: [sx * 0.38 * hs, HY - 0.01, -0.01], r: [0, 0, PI / 2] }); kit.add(cyl(0.045, 0.045, 0.07, 6), 'gold', { p: [sx * 0.385 * hs, HY - 0.01, -0.01], r: [0, 0, PI / 2] }); }
  kit.add(sq(0.55 * hs, 0.32 * hs, 0.07, 3.6, 14, 7), 'black', { p: [0, HY, round ? 0.32 : 0.275] });
  if (cap) { const ty = HY + (round ? 0.31 : 0.23); kit.add(cyl(0.11, 0.13, 0.05, 14), 'ivoryS', { p: [0, ty, 0] }); kit.add(cyl(0.085, 0.095, 0.075, 14), 'gold', { p: [0, ty + 0.06, 0] }); kit.add(cyl(0.1, 0.1, 0.018, 14), 'gold', { p: [0, ty + 0.1, 0] });
    if (lamp) { kit.add(cyl(0.04, 0.045, 0.03, 10), 'lamp', { p: [0, ty + 0.065, 0.085], r: [PI / 2, 0, 0] }); } }
  if (hat) { const HB = HY + 0.14; kit.add(sq(0.74, 0.64, 0.7, 1.9, 22, 8, { th: PI / 2 }), 'hat', { p: [0, HB, 0.0] }); kit.add(sq(0.075, 0.67, 0.73, 2.2, 6, 8, { th: PI / 2 }), 'hat', { p: [0, HB, 0] });
    const pr = [[0.35, 0.0], [0.4, -0.012], [0.415, 0.006], [0.405, 0.03], [0.35, 0.04]].map(([x, y]) => new THREE.Vector2(x, y)); kit.add(new THREE.LatheGeometry(pr, 24), 'hat', { p: [0, HB - 0.005, 0.03], s: [1, 1, 1.12] });
    kit.add(sq(0.42, 0.03, 0.12, 3, 8, 3), 'hat', { p: [0, HB, 0.43], r: [0.12, 0, 0] }); }
  return HY;
}
// eyes + smile baked as self-lit geometry on the screen (single-mesh LOD)
function bakedFace(kit, HY, z, s = 1) { for (const sx of [-1, 1]) kit.add(sq(0.07, 0.1, 0.012, 2, 8, 6), 'eyeL', { p: [sx * 0.09 * s, HY + 0.02, z], s: [s, s, 1] }); kit.add(new THREE.TorusGeometry(0.05, 0.009, 3, 8, PI * 0.5).rotateZ(-PI * 0.75), 'eyeL', { p: [0, HY - 0.02, z] }); }

function geologist(level) { const body = new Kit(), arm = new Kit(); const y0 = 0;
  legs(body); // v100: legs instead of tracks (concept)
  torso(body, y0); const HY = head(body, y0, { round: true, cap: true, lamp: true });
  for (const dx of [0, 0.17]) { body.add(cyl(0.085, 0.085, 0.42, 12), 'gold', { p: [-0.3 + dx, 0.88 + y0, -0.24] }); body.add(cyl(0.09, 0.09, 0.05, 12), 'dark', { p: [-0.3 + dx, 1.1 + y0, -0.24] }); body.add(cyl(0.09, 0.09, 0.03, 12), 'dark', { p: [-0.3 + dx, 0.8 + y0, -0.24] }); } // gold sample canisters on the back (show above the right shoulder)
  // left arm resting forward, fist
  body.add(capsule([0.43, 0.76 + y0, 0], [0.5, 0.58 + y0, 0.08], 0.115, 8, 2), 'ivory'); body.add(sph(0.08, 6, 4), 'gold', { p: [0.5, 0.56 + y0, 0.1] }); body.add(capsule([0.5, 0.55 + y0, 0.12], [0.48, 0.5 + y0, 0.3], 0.12, 8, 2), 'ivory'); body.add(ring([0.5, 0.55 + y0, 0.12], [0.48, 0.5 + y0, 0.29], 0.118, 0.022), 'gold'); gloveTo(body, [0.47, 0.49 + y0, 0.38], 1, [1.2, 0, 0]);
  // right arm = heavy drill (animated): upper arm, elbow, thick ivory drill housing with gold rings, steel bit
  arm.add(capsule([0, -0.02, 0], [-0.08, -0.2, 0.04], 0.12, 8, 2), 'ivory'); arm.add(sph(0.082, 6, 4), 'gold', { p: [-0.09, -0.23, 0.06] });
  const A = new THREE.Vector3(-0.09, -0.24, 0.08), B = new THREE.Vector3(0.04, -0.5, 0.6); const d = B.clone().sub(A), L = d.length(), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()); const at = (f) => A.clone().addScaledVector(d, f);
  const put = (g, f, col) => { g.applyQuaternion(q); const p = at(f); g.translate(p.x, p.y, p.z); arm.add(g, col); };
  put(cyl(0.13, 0.14, L * 0.62, 14), 0.31, 'ivory'); put(cyl(0.135, 0.135, 0.04, 14), 0.12, 'gold'); put(cyl(0.128, 0.128, 0.035, 14), 0.5, level >= 2 ? 'gold' : 'ivoryS'); put(cyl(0.1, 0.12, 0.06, 12), 0.66, 'dark');
  const bit = new Kit(); bit.add(cyl(0.014, 0.11, 0.34, 12), 'steel', { p: [0, 0.17, 0] }); for (let k = 0; k < 4; k++) bit.add(tor(0.095 - k * 0.022, 0.012, 3, 10), level >= 2 ? 'gold' : 'steel', { p: [0, 0.05 + k * 0.07, 0], r: [PI / 2, 0, 0.3] }); // separate (spins)
  const bitPos = at(0.72), bitQ = q.clone();
  if (level >= 3) body.add(cyl(0.05, 0.05, 0.05, 10), 'lamp', { p: [0.41, 0.95 + y0, 0.08], r: [PI / 2, 0, 0] }); // shoulder lamp (robot lvl 3+)
  return { body, arm, bit, bitPos, bitQ, HY, SH: [-0.39, 0.8 + y0, 0], faceZ: 0.365, round: true };
}
function archaeologist(level) { const body = new Kit(), arm = new Kit(); const y0 = 0;
  legs(body); // v100: walks on legs like the concept (no hover thruster)
  torso(body, y0); const HY = head(body, y0, { round: true, cap: true });
  // strap across the chest + satchel on the left hip
  body.add(tube([[-0.3, 0.9 + y0, 0.12], [-0.05, 0.75 + y0, 0.24], [0.2, 0.58 + y0, 0.22], [0.33, 0.47 + y0, 0.15]], 0.018, 6, 3), 'leather');
  body.add(sq(0.22, 0.2, 0.12, 3, 6, 4), 'leather', { p: [0.36, 0.4 + y0, 0.1], r: [0, -0.4, 0] });
  // left hand holds the golden glyph tablet up
  body.add(capsule([0.43, 0.76 + y0, 0], [0.52, 0.62 + y0, 0.08], 0.115, 8, 2), 'ivory'); body.add(sph(0.08, 6, 4), 'gold', { p: [0.53, 0.6 + y0, 0.1] }); body.add(capsule([0.53, 0.6 + y0, 0.12], [0.5, 0.72 + y0, 0.28], 0.115, 8, 2), 'ivory'); gloveTo(body, [0.49, 0.76 + y0, 0.33], 1, [0.3, 0, 0]);
  body.add(new THREE.BoxGeometry(0.25, 0.34, 0.025), 'gold', { p: [0.55, 0.9 + y0, 0.37], r: [-0.1, -0.15, 0] }); glyph(body, [0.548, 0.9 + y0, 0.387], [-0.1, -0.15, 0]);
  // right arm (animated): scanner with a glowing lens
  arm.add(capsule([0, -0.02, 0], [-0.12, -0.17, 0.05], 0.115, 8, 2), 'ivory'); arm.add(sph(0.08, 6, 4), 'gold', { p: [-0.13, -0.19, 0.07] }); arm.add(capsule([-0.13, -0.2, 0.1], [-0.08, -0.1, 0.3], 0.115, 8, 2), 'ivory'); arm.add(ring([-0.13, -0.2, 0.1], [-0.085, -0.11, 0.29], 0.112, 0.022), 'gold');
  gloveTo(arm, [-0.07, -0.07, 0.37], -1, [0.6, 0.3, 0]);
  arm.add(sq(0.13, 0.11, 0.2, 3, 8, 5), 'dark', { p: [-0.06, -0.02, 0.43], r: [-0.3, 0, 0] }); arm.add(cyl(0.05, 0.05, 0.03, 12), level >= 2 ? 'gold' : 'steel', { p: [-0.06, 0.01, 0.53], r: [PI / 2 - 0.3, 0, 0] }); arm.add(cyl(0.038, 0.038, 0.02, 12), 'eye', { p: [-0.06, 0.012, 0.548], r: [PI / 2 - 0.3, 0, 0] });
  if (level >= 3) body.add(cyl(0.05, 0.05, 0.05, 10), 'lamp', { p: [0.41, 0.95 + y0, 0.08], r: [PI / 2, 0, 0] });
  return { body, arm, HY, SH: [-0.39, 0.8 + y0, 0], faceZ: 0.365, round: true };
}
function engineer(level) { const body = new Kit(), arm = new Kit(); const y0 = 0;
  legs(body); torso(body, y0); const HY = head(body, y0, { hat: true });
  // leather toolbelt with pouches + gold buckle
  body.add(sq(0.6, 0.07, 0.4, 3, 12, 3), 'leather', { p: [0, 0.5, 0] }); body.add(new THREE.BoxGeometry(0.08, 0.06, 0.02), 'gold', { p: [0, 0.5, 0.205] });
  for (const [x, z, w] of [[-0.24, 0.13, 0.11], [0.2, 0.15, 0.13], [0.3, 0.02, 0.09]]) body.add(sq(w, 0.13, 0.08, 3, 6, 4), 'leather', { p: [x, 0.44, z], r: [0, Math.atan2(x, 0.3), 0] });
  // left hand: wrench held up
  body.add(capsule([0.43, 0.76, 0], [0.54, 0.62, 0.06], 0.115, 8, 2), 'ivory'); body.add(sph(0.08, 6, 4), 'gold', { p: [0.55, 0.6, 0.08] }); body.add(capsule([0.55, 0.6, 0.1], [0.56, 0.7, 0.28], 0.115, 8, 2), 'ivory'); gloveTo(body, [0.56, 0.73, 0.34], 1, [0.2, 0, 0]);
  body.add(new THREE.BoxGeometry(0.035, 0.32, 0.02), 'steel', { p: [0.6, 0.86, 0.36], r: [0, 0, -0.35] }); body.add(tor(0.05, 0.018, 4, 10, PI * 1.5), level >= 2 ? 'gold' : 'steel', { p: [0.66, 1.02, 0.36], r: [0, 0, 0.6] });
  // right arm (animated): screwdriver
  arm.add(capsule([0, -0.02, 0], [-0.12, -0.18, 0.04], 0.115, 8, 2), 'ivory'); arm.add(sph(0.08, 6, 4), 'gold', { p: [-0.13, -0.2, 0.06] }); arm.add(capsule([-0.13, -0.21, 0.09], [-0.06, -0.14, 0.29], 0.115, 8, 2), 'ivory'); arm.add(ring([-0.13, -0.21, 0.09], [-0.065, -0.145, 0.28], 0.112, 0.022), 'gold');
  gloveTo(arm, [-0.05, -0.12, 0.36], -1, [0.5, 0.2, 0]);
  arm.add(cyl(0.028, 0.03, 0.14, 8), 'hat', { p: [-0.04, -0.03, 0.39], r: [0.25, 0, 0] }); arm.add(cyl(0.008, 0.008, 0.16, 6), 'steel', { p: [-0.035, 0.11, 0.42], r: [0.25, 0, 0] });
  if (level >= 3) body.add(cyl(0.05, 0.05, 0.05, 10), 'lamp', { p: [0.41, 0.95, 0.08], r: [PI / 2, 0, 0] });
  return { body, arm, HY, SH: [-0.39, 0.8, 0], faceZ: 0.31, holo: true };
}
function glyph(kit, p, r) { // engraved sun/eye glyph on the tablet: thin self-lit strokes over a darker gold inset
  const M = new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r, 'YXZ')), new THREE.Vector3(1, 1, 1));
  const add = (g, col, o) => { g.translate(...o); g.applyMatrix4(M); kit.add(g, col); };
  add(new THREE.TorusGeometry(0.05, 0.008, 3, 9), 'glyph', [0, 0.05, 0]); add(new THREE.BoxGeometry(0.012, 0.2, 0.004), 'glyph', [0, -0.02, 0]); add(new THREE.BoxGeometry(0.15, 0.012, 0.004), 'glyph', [0, -0.04, 0]);
  add(new THREE.BoxGeometry(0.19, 0.27, 0.002), 'hat', [0, 0, -0.003]); }
function builder() { const k = builderKits(); return { body: k.body, arm: k.arm, HY: 1.15, SH: [-0.37, 0.78, 0], faceZ: 0.313, HT: k.HT, builder: true }; }
const BUILD = { geologist, archaeologist, engineer, builder };
// v72 cosmetics (navy / gold / ivory / cyan house style). Paints remap palette names in the vertex colours; decals swap the chest crescent.
// lock: null = free, {lvl:n} = robot level n, {set:'station'} = completed museum set. All baked into the existing merged meshes: 0 extra draws.
const _p = (c, mr) => ({ c, mr });
export const PAINTS = {
  classic: { sw: '#e8e2d6', lock: null, map: {} },
  navy: { sw: '#22305a', lock: null, map: { ivory: _p('#1c2847', [0.1, 0.3]), ivoryS: _p('#17203a', [0.1, 0.34]) } },
  cyan: { sw: '#3aa8c8', lock: { lvl: 2 }, map: { ivory: _p('#2b7590', [0.1, 0.3]), ivoryS: _p('#225f75', [0.1, 0.34]) } },
  royal: { sw: '#c9a032', lock: { lvl: 3 }, map: { ivory: _p('#1c2847', [0.15, 0.26]), ivoryS: _p('#17203a', [0.15, 0.3]), gold: _p('#c0941a', [0.9, 0.22]), hat: _p('#c0941a', [0.9, 0.22]), dark: _p('#2a3a66', [0.3, 0.45]) } },
  pearl: { sw: '#f4f1ea', lock: { set: 'station' }, map: { ivory: _p('#b2aea8', [0.05, 0.22]), ivoryS: _p('#a19c96', [0.05, 0.26]), gold: _p('#8d949c', [0.85, 0.25]), hat: _p('#8d949c', [0.85, 0.25]) } },
  relic: { sw: '#9a7424', lock: { set: 'ancient' }, map: { ivory: _p('#7a5a1c', [0.7, 0.32]), ivoryS: _p('#6a4c16', [0.7, 0.36]), gold: _p('#2b6f86', [0.5, 0.3]) } },
};
export const DECALS = { crescent: { lock: null }, star: { lock: null }, paw: { lock: { lvl: 2 } }, bolt: { lock: { set: 'meteor' } } };
export const cosOf = (r) => ({ p: PAINTS[r && r.cos && r.cos.p] ? r.cos.p : 'classic', d: DECALS[r && r.cos && r.cos.d] ? r.cos.d : 'crescent' });
export const cosUnlocked = (lock, lvl, sets) => !lock || (lock.lvl ? lvl >= lock.lvl : !!(sets && sets.includes(lock.set)));
// impostor tint: index into PAINTS order (0 = classic -> no tint)
export const PAINT_IDS = Object.keys(PAINTS);
function holoTexture() { const c = document.createElement('canvas'); c.width = 256; c.height = 180; const g = c.getContext('2d'); g.fillStyle = 'rgba(40,170,255,0.22)'; g.fillRect(0, 0, 256, 180); g.strokeStyle = 'rgba(140,230,255,0.9)'; g.lineWidth = 3; g.strokeRect(4, 4, 248, 172);
  g.lineWidth = 1; g.strokeStyle = 'rgba(120,210,255,0.45)'; for (let x = 0; x < 256; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 180); g.stroke(); } for (let y = 0; y < 180; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
  g.strokeStyle = 'rgba(200,245,255,0.95)'; g.lineWidth = 3; g.beginPath(); g.arc(160, 80, 38, 0, 7); g.stroke(); g.strokeRect(40, 40, 70, 90); g.beginPath(); g.moveTo(40, 130); g.lineTo(200, 150); g.stroke(); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }

const SX = 0.86, SZ = 0.92;
// type: builder|geologist|archaeologist|engineer. returns { root, update(dt, mode, camPos), setLevel(l), tris, type }
export function makeCrewRobot(scene, env, type, level = 1, cos = null) {
  const mat = makeCrewRobot.mat ||= material(env); const root = new THREE.Group(); root.name = 'crew_' + type; root.visible = false; scene.add(root);
  const hi = new THREE.Group(); root.add(hi); let lo = null, parts = null, lvl = level, look = cos || { p: 'classic', d: 'crescent' }, ph = Math.random() * 10, life = 0; const seed = Math.random(), wavP = 9 + seed * 5; /* gd pr159: per-robot idle rhythm (wave every 9-14 s) */
  const faceTex = makeCrewRobot.faceTex ||= faceTexture(); const flameTex = makeCrewRobot.flameTex ||= (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(220,245,255,1)'); gr.addColorStop(0.4, 'rgba(90,180,255,0.7)'); gr.addColorStop(1, 'rgba(40,120,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  function build() {
    for (const c of [...hi.children]) { hi.remove(c); c.geometry?.dispose(); } if (lo) { root.remove(lo); lo.geometry.dispose(); }
    // hi
    const pm = (PAINTS[look.p] || PAINTS.classic).map; setCosmetic(pm, look.d); setLQ(LQ0); const P = BUILD[type](lvl); parts = P;
    const bodyM = new THREE.Mesh(P.body.build().scale(SX, 1, SZ), mat); bodyM.castShadow = true; bodyM.name = 'crew_body'; hi.add(bodyM);
    const pivot = new THREE.Group(); pivot.position.set(P.SH[0] * SX, P.SH[1], P.SH[2]); hi.add(pivot); const armM = new THREE.Mesh(P.arm.build().scale(SX, 1, SZ), mat); armM.castShadow = true; pivot.add(armM);
    let bitM = null; if (P.bit) { bitM = new THREE.Mesh(P.bit.build(), mat); bitM.position.copy(P.bitPos).multiply(new THREE.Vector3(SX, 1, SZ)); bitM.quaternion.copy(P.bitQ); const bw = new THREE.Group(); bw.add(bitM); armM.add(bw); }
    const fs = P.round ? 1.1 : 1; const face = new THREE.Mesh(new THREE.PlaneGeometry(0.5 * SX * fs, 0.28 * fs), new THREE.MeshBasicMaterial({ map: faceTex, transparent: true, depthWrite: false, toneMapped: false, color: new THREE.Color(1.6, 1.6, 1.6) }));
    if (P.HT) { const fp = new THREE.Vector3(0, 1.15, 0.313).applyMatrix4(P.HT); face.position.set(fp.x * SX, fp.y, fp.z * SZ); face.rotation.set(0.07, 0, -0.05, 'YXZ'); } else face.position.set(0, P.HY, P.faceZ * SZ); hi.add(face);
    let holo = null; if (P.holo && !PRESET.low) { holo = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.3), new THREE.MeshBasicMaterial({ map: makeCrewRobot.holoTex ||= holoTexture(), transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, color: new THREE.Color(1.3, 1.5, 1.8), blending: THREE.AdditiveBlending })); holo.position.set(0.2, 0.86, 0.5); holo.rotation.set(-0.2, -0.3, 0); hi.add(holo); }
    let flame = null; if (P.hover) { flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, color: new THREE.Color(0.9, 2.0, 4.0), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); flame.position.set(0, 0.06, 0); flame.scale.set(0.34, 0.5, 1); hi.add(flame); }
    // lo: single mesh at reduced tessellation, arm merged at rest pose, eyes baked
    setLQ(PRESET.low ? 0.26 : 0.3); const Q = BUILD[type](lvl); setCosmetic(null, null); bakedFace(Q.body, P.HT ? 1.17 : Q.HY, (Q.faceZ + 0.005), Q.round ? 1.1 : 1);
    const armG = Q.arm.build(); armG.translate(Q.SH[0], Q.SH[1], Q.SH[2]); const g = [Q.body.build(), armG]; if (Q.bit) { const bg = Q.bit.build(); bg.applyQuaternion(Q.bitQ); bg.translate(Q.bitPos.x + Q.SH[0], Q.bitPos.y + Q.SH[1], Q.bitPos.z + Q.SH[2]); g.push(bg); }
    const merged = mergeAll(g).scale(SX, 1, SZ); lo = new THREE.Mesh(merged, mat); lo.name = 'crew_lod'; lo.castShadow = false; root.add(lo); setLQ(LQ0);
    Object.assign(api, { pivot, armM, bitM, face, flame, holo, bodyM, triHi: [bodyM, armM, face, bitM].filter(Boolean).reduce((s, m) => s + m.geometry.attributes.position.count / 3, 0), triLo: merged.attributes.position.count / 3 });
  }
  const _w = new THREE.Vector3();
  const api = { root, type, get level() { return lvl; },
    setLevel(l) { if (l === lvl) return; lvl = l; build(); },
    get look() { return look; }, get paintIdx() { return Math.max(0, PAINT_IDS.indexOf(look.p)); }, setLook(c) { c = c || { p: 'classic', d: 'crescent' }; if (c.p === look.p && c.d === look.d) return; look = { p: c.p, d: c.d }; build(); },
    // mode: idle|walk|work|drive; cam: camera world position (hi mesh within near distance; ?q=low: lo beyond 7 m)
    update(dt, mode, cam) { ph += dt; life += dt; const near = PRESET.low ? 3.5 : PRESET.mobile ? 4 : 5; /* hi mesh only up close (far crew are impostors, see impostors.js); gd pr159: this LOD switch used to sit inside a // comment, so near crew drew hi AND lo */ root.getWorldPosition(_w); const d = cam ? _w.distanceTo(cam) : 0; const useHi = d < near; hi.visible = useHi; lo.visible = !useHi;
      const carry = mode === 'carry' || mode === 'carryidle' || mode === 'wavecarry', wav = mode === 'wave' || mode === 'wavecarry'; if (carry || wav) { if (!api.cry) { const g = makeCrewRobot.cryG ||= new THREE.OctahedronGeometry(0.17, 0).scale(0.8, 1.5, 0.8); const m = makeCrewRobot.cryM ||= new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 2.2, 3.0), toneMapped: false }); api.cry = new THREE.Mesh(g, m); api.cry.name = 'crew_crystal'; api.cry.position.set(-0.3, 0.66, 0.5); root.add(api.cry); } }
      if (api.cry) { api.cry.visible = carry; if (carry) api.cry.rotation.y += dt * 1.5; }
      if (mode === 'carry') mode = 'walk'; else if (mode === 'carryidle') mode = 'idle';
      const P = parts; const b = mode === 'walk' && !P.hover ? Math.abs(Math.sin(ph * 7)) * 0.035 : 0; const hov = P.hover ? 0.04 * Math.sin(ph * 2.2) : 0;
      hi.position.y = b + hov; lo.position.y = hov; api.pivot.rotation.set(0, 0, 0);
      // gd pr159 (concept d04ca995: crew wave and work): body language on the hi/lo groups only - no new meshes, 0 extra draws/tris.
      // idle: breathing bob + slow look-around, and every wavP seconds a ~2 s greeting wave (geologist lifts the drill instead); never during the
      // first 4 s of life, so the impostor atlas (rendered once at startup in 'idle') keeps the neutral pose. work: effort lean; walk: waddle.
      let yaw = 0, lean = 0, roll = 0, bob = 0, idleWave = false;
      if (mode === 'idle' && !wav) { yaw = 0.22 * Math.sin(ph * 0.45 + seed * 6) + 0.08 * Math.sin(ph * 1.1); bob = P.hover ? 0 : 0.008 * Math.sin(ph * 2.1); roll = 0.025 * Math.sin(ph * 0.8 + seed * 3);
        const wt = (ph + seed * wavP) % wavP; idleWave = life > 4 && !carry && wt > wavP - 2.2; if (idleWave) { const k = Math.min(1, (wavP - wt) * 3, (wt - (wavP - 2.2)) * 3); yaw *= 1 - k; lean = -0.05 * k; } }
      else if (mode === 'work') { lean = 0.07 + 0.035 * Math.sin(ph * (type === 'engineer' ? 6 : 2.6)); bob = P.hover ? 0 : -0.012 * Math.abs(Math.sin(ph * 2.6)); }
      else if (mode === 'walk' && !P.hover) roll = 0.045 * Math.sin(ph * 7);
      for (const o of [hi, lo]) { o.rotation.set(lean, yaw, roll); } hi.position.y += bob; lo.position.y += bob;
      if (carry && !wav) api.pivot.rotation.x = -0.9 + Math.sin(ph * 7) * 0.03; else if (wav) { api.pivot.rotation.z = -2.3 + Math.sin(ph * 10) * 0.35; api.pivot.rotation.x = -0.25; }
      else if (idleWave) { const k = Math.min(1, (wavP - (ph + seed * wavP) % wavP) * 3, (((ph + seed * wavP) % wavP) - (wavP - 2.2)) * 3); if (type === 'geologist') { api.pivot.rotation.x = -0.75 * k + Math.sin(ph * 5) * 0.06 * k; } else { api.pivot.rotation.z = (-2.3 + Math.sin(ph * 10) * 0.35) * k; api.pivot.rotation.x = -0.25 * k; } }
      else if (mode === 'walk') api.pivot.rotation.x = Math.sin(ph * 7) * 0.1;
      else if (mode === 'idle') { api.pivot.rotation.x = 0.04 * Math.sin(ph * 2.1 + 1); }
      else if (mode === 'work') { if (type === 'geologist') { api.pivot.rotation.x = 0.12 + Math.sin(ph * 9) * 0.02; } else if (type === 'archaeologist') { api.pivot.rotation.x = -0.15 + Math.sin(ph * 1.3) * 0.25; api.pivot.rotation.y = Math.sin(ph * 0.9) * 0.3; } else if (type === 'engineer') { api.pivot.rotation.x = Math.sin(ph * 6) * 0.18; api.pivot.rotation.z = Math.sin(ph * 6) * 0.1; } else api.pivot.rotation.x = Math.sin(ph * 2.3) * 0.05; }
      if (api.bitM) api.bitM.rotateY(mode === 'work' ? dt * 22 : 0);
      if (api.flame) { const k = 0.85 + 0.15 * Math.sin(ph * 31); api.flame.scale.set(0.3 * k, 0.48 * k, 1); }
      if (api.holo) api.holo.material.opacity = 0.85 + 0.15 * Math.sin(ph * 5); },
  };
  build(); api.tris = api.triHi; return api;
}
function mergeAll(list) { // like mergeGeometries for our Kit outputs (all share position/normal/color/aMR)
  const n = list.reduce((s, g) => s + g.attributes.position.count, 0); const out = new THREE.BufferGeometry(); for (const k of ['position', 'normal', 'color', 'aMR']) { const sz = list[0].attributes[k].itemSize; const a = new Float32Array(n * sz); let o = 0; for (const g of list) { a.set(g.attributes[k].array, o); o += g.attributes[k].array.length; } out.setAttribute(k, new THREE.BufferAttribute(a, sz)); } out.computeBoundingSphere(); return out; }
