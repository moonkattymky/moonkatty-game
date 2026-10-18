import * as THREE from 'three';
import { mergeGeometries } from '../../vendor/three/jsm/utils/BufferGeometryUtils.js';
import { makeCrewRobot } from './robots.js';
import { makeStaticCrystals } from './crystal.js';
// ============================================================================================
// The cat's home (concept 2d260de8): an enterable living module. Outside: a round gold-framed airlock door on the
// living dome. Inside (its own scene on render layer 1 - the outside world is not rendered while inside):
// round ivory quilted room, gold rings, warm LED strips, quilted ceiling with a cove light, two big gold portholes
// (the airlock door one shows the moonscape, the other the base with the rocket and Earth - both live snapshots of the
// real world taken on entry), capsule bed with a paw pillow, small dome pet house with a cushion (reserved for the
// Moon Bunny), gold rack with spare SPACESUITS + helmets, wall shelf with blue crystals + museum artifacts (from the
// save), holographic hub console with a robot beside it, round rug, paw-print armchair.
// ============================================================================================
const LAYER = 1;
const colorize = (g, hex) => { g = g.index ? g.toNonIndexed() : g; const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) c.toArray(a, i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k); return g; };
function canvasTex(w, h, draw, rep) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } t.anisotropy = 4; return t; }
const quilt = (g, w, h) => { g.fillStyle = '#efe6d6'; g.fillRect(0, 0, w, h); const s = w / 2; // 2x2 diamonds per tile: soft pillow shading + stitched seams + gold studs
  for (let i = -1; i < 3; i++) for (let j = -1; j < 3; j++) { const cx = i * s + (j % 2 ? s / 2 : 0), cy = j * s / 2; const gr = g.createRadialGradient(cx - s * 0.08, cy - s * 0.1, s * 0.05, cx, cy, s * 0.62); gr.addColorStop(0, '#f6ecdb'); gr.addColorStop(0.6, '#e2d3b8'); gr.addColorStop(1, '#b9a688'); g.fillStyle = gr; g.beginPath(); g.moveTo(cx, cy - s / 2); g.lineTo(cx + s / 2, cy); g.lineTo(cx, cy + s / 2); g.lineTo(cx - s / 2, cy); g.closePath(); g.fill(); }
  g.strokeStyle = 'rgba(150,130,100,0.55)'; g.lineWidth = 2; for (let k = -4; k < 8; k++) { g.beginPath(); g.moveTo(k * s / 2 - h, h); g.lineTo(k * s / 2 + h, -h); g.stroke(); g.beginPath(); g.moveTo(k * s / 2 - h, -h + h * 2 - h); g.lineTo(k * s / 2 + h, h + h); g.stroke(); }
  g.fillStyle = '#c9a050'; for (let i = 0; i <= 2; i++) for (let j = 0; j <= 4; j++) { g.beginPath(); g.arc(i * s + (j % 2 ? s / 2 : 0), j * s / 2, 3, 0, 7); g.fill(); } };
const paw = (g, x, y, r, col) => { g.fillStyle = col; g.beginPath(); g.ellipse(x, y + r * 0.25, r * 0.55, r * 0.45, 0, 0, 7); g.fill(); for (const [dx, dy] of [[-0.62, -0.32], [-0.24, -0.66], [0.24, -0.66], [0.62, -0.32]]) { g.beginPath(); g.ellipse(x + dx * r, y + dy * r, r * 0.2, r * 0.25, 0, 0, 7); g.fill(); } };

export function makeHome(scene, { env, groundAt, door, origin, low = false, earthDir = null, getMuseum = () => [], getHubInfo = () => ({}) }) {
  const I = new THREE.Group(); I.name = 'ch2_home'; I.position.copy(origin); scene.add(I);
  const R = 3.5, WH = 3.0; const W = (r) => R - (4.6 - r); // radii below are authored as distance-from-wall in a 4.6 m room
  // layout (angles around the room; 0 = straight ahead of the entry view): tightened toward the concept's composition
  const LAY = { door: -0.93, rack: -0.27, pet: -0.08, win: 0.72, bed: 0.6, desk: 1.27, shelf: 1.25, chair: 1.6, robot: 0.98 }; // solved so the entry view frames them like the concept
  const setL = (o) => o.traverse(x => x.layers.set(LAYER));
  const std = (o = {}) => new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0.0, envMap: env || null, envMapIntensity: 0.5, ...o });
  // ---- shell: floor, quilted wall, ceiling with cove ----
  const wallTex = canvasTex(256, 256, quilt, [16, 3.5]);
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(R, R, WH, 72, 1, true).translate(0, WH / 2, 0), std({ map: wallTex, side: THREE.BackSide })); I.add(wall);
  const floorTex = canvasTex(512, 512, (g, w, h) => { g.fillStyle = '#c9b494'; g.fillRect(0, 0, w, h); for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(120,95,65,${0.05 + Math.random() * 0.06})`; g.lineWidth = 1 + Math.random() * 2; g.beginPath(); g.moveTo(0, i * 13 + Math.random() * 4); g.lineTo(w, i * 13 + Math.random() * 4); g.stroke(); } });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(R, 72).rotateX(-Math.PI / 2), std({ map: floorTex, roughness: 0.35, envMapIntensity: 0.8 })); I.add(floor);
  const ceilTex = canvasTex(256, 256, quilt, [12, 2]);
  const ceilProf = [[R, WH], [R - 0.2, WH + 0.35], [R - 0.9, WH + 0.6], [R - 1.5, WH + 0.62], [R - 1.5, WH + 0.85], [R - 1.7, WH + 0.95], [0.0, WH + 1.05]].map(([x, y]) => new THREE.Vector2(x, y));
  const ceil = new THREE.Mesh(new THREE.LatheGeometry(ceilProf, 64), std({ map: ceilTex, side: THREE.BackSide })); I.add(ceil);
  // ---- merged vertex-coloured furniture + trims ----
  const parts = []; const A = (g, col) => parts.push(colorize(g, col)); const GOLD = '#d4a24a', IV = '#efe6d6', IV2 = '#e3d8c4', LED = '#ffd890', CY = '#4fd8ff';
  const onWall = (phi, r = R) => ({ x: Math.sin(phi) * r, z: -Math.cos(phi) * r, yaw: -phi });
  A(new THREE.TorusGeometry(R - 0.04, 0.06, 6, 96).rotateX(Math.PI / 2).translate(0, 0.08, 0), GOLD); A(new THREE.TorusGeometry(R - 0.05, 0.05, 6, 96).rotateX(Math.PI / 2).translate(0, WH - 0.02, 0), GOLD);
  A(new THREE.TorusGeometry(R - 0.08, 0.03, 4, 96).rotateX(Math.PI / 2).translate(0, 0.2, 0), LED); A(new THREE.TorusGeometry(R - 1.48, 0.05, 4, 72).rotateX(Math.PI / 2).translate(0, WH + 0.66, 0), LED); A(new THREE.TorusGeometry(R - 0.25, 0.04, 4, 96).rotateX(Math.PI / 2).translate(0, WH + 0.33, 0), GOLD);
  for (let k = 0; k < 12; k++) { const w = onWall(k * Math.PI / 6 + 0.1, R - 0.03); A(new THREE.BoxGeometry(0.16, WH, 0.06).rotateY(w.yaw).translate(w.x, WH / 2, w.z), IV2); }
  // portholes: ivory bezel + gold frame (glass discs are textured separately)
  const PH = [{ phi: LAY.door, y: 1.45, r: 1.25, door: true }, { phi: LAY.win, y: 1.85, r: 1.05 }];
  for (const p of PH) { const w = onWall(p.phi, R - 0.12); const q = new THREE.Matrix4().makeRotationY(w.yaw); const at = (g) => g.applyMatrix4(q).translate(w.x, p.y, w.z);
    A(at(new THREE.TorusGeometry(p.r + 0.22, 0.2, 10, 48)), IV); A(at(new THREE.TorusGeometry(p.r + 0.02, 0.09, 10, 48).translate(0, 0, 0.12)), GOLD); A(at(new THREE.TorusGeometry(p.r - 0.05, 0.035, 6, 48).translate(0, 0, 0.05)), GOLD);
    if (p.door) { A(at(new THREE.BoxGeometry(0.12, 0.5, 0.08).translate(p.r + 0.33, 0, 0.18)), GOLD); A(at(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 16).rotateX(Math.PI / 2).translate(p.r + 0.62, 0.35, 0.05)), CY); } }
  // capsule bed under the window porthole
  { const w = onWall(LAY.bed, W(3.55)); const M = new THREE.Matrix4().makeRotationY(w.yaw).setPosition(w.x, 0, w.z); const at = (g) => g.applyMatrix4(M);
    A(at(new THREE.CapsuleGeometry(0.42, 1.3, 6, 16).rotateZ(Math.PI / 2).scale(1, 0.62, 1.15).translate(0, 0.3, 0)), IV); A(at(new THREE.TorusGeometry(0.5, 0.025, 4, 24).scale(1.9, 0.6, 1).rotateX(Math.PI / 2).translate(0, 0.07, 0)), LED);
    A(at(new THREE.BoxGeometry(1.95, 0.16, 0.86).translate(0, 0.56, 0.02)), '#f6f0e4'); A(at(new THREE.BoxGeometry(1.2, 0.09, 0.9).translate(0.32, 0.66, 0.03)), '#d9c6a8');
    A(at(new THREE.CapsuleGeometry(0.16, 0.3, 4, 10).rotateZ(Math.PI / 2).scale(1, 0.7, 1).translate(-0.72, 0.72, -0.18)), '#f2ebdd'); A(at(new THREE.BoxGeometry(2.1, 0.05, 0.05).translate(0, 0.5, 0.48)), GOLD); }
  // dome pet house (empty, reserved for the Moon Bunny)
  { const w = onWall(LAY.pet, W(3.5)); const M = new THREE.Matrix4().makeRotationY(w.yaw).scale(new THREE.Vector3(1.3, 1.3, 1.3)).setPosition(w.x, 0, w.z); const at = (g) => g.applyMatrix4(M);
    A(at(new THREE.SphereGeometry(0.5, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.05, 1).translate(0, 0.12, 0)), IV); A(at(new THREE.CylinderGeometry(0.56, 0.58, 0.12, 24).translate(0, 0.06, 0)), IV2); A(at(new THREE.TorusGeometry(0.57, 0.02, 4, 24).rotateX(Math.PI / 2).translate(0, 0.12, 0)), GOLD);
    A(at(new THREE.CircleGeometry(0.3, 16, 0, Math.PI).translate(0, 0.14, 0.505)), '#4a3f33'); A(at(new THREE.TorusGeometry(0.3, 0.035, 6, 16, Math.PI).translate(0, 0.14, 0.5)), IV2);
    A(at(new THREE.TorusGeometry(0.2, 0.08, 6, 16).rotateX(Math.PI / 2).scale(1, 1, 0.8).translate(0, 0.2, 0.18)), '#e8c9b4'); }
  // gold clothing rack with spare spacesuits + helmets on the top shelf
  const rack = onWall(LAY.rack, W(3.95)); { const M = new THREE.Matrix4().makeRotationY(rack.yaw).setPosition(rack.x, 0, rack.z); const at = (g) => g.applyMatrix4(M);
    for (const sx of [-0.55, 0.55]) { A(at(new THREE.CylinderGeometry(0.025, 0.025, 1.95, 8).translate(sx, 0.98, 0)), GOLD); A(at(new THREE.BoxGeometry(0.06, 0.04, 0.42).translate(sx, 0.03, 0)), GOLD); }
    A(at(new THREE.CylinderGeometry(0.02, 0.02, 1.12, 8).rotateZ(Math.PI / 2).translate(0, 1.55, 0)), GOLD); A(at(new THREE.BoxGeometry(1.16, 0.03, 0.34).translate(0, 1.95, 0)), GOLD); A(at(new THREE.BoxGeometry(1.1, 0.03, 0.3).translate(0, 0.32, 0)), GOLD);
    const suits = [['#f3ede2', '#d4a24a'], ['#f0c8d0', '#e9e2d6'], ['#bfe6e6', '#d4a24a']]; suits.forEach(([c, tr], i) => { const x = -0.36 + i * 0.36; A(at(new THREE.TorusGeometry(0.05, 0.008, 4, 10, Math.PI).translate(x, 1.55, 0)), GOLD);
      A(at(new THREE.CapsuleGeometry(0.13, 0.3, 4, 10).scale(1, 1, 0.7).translate(x, 1.24, 0)), c); for (const s of [-1, 1]) { A(at(new THREE.CapsuleGeometry(0.045, 0.3, 3, 8).rotateZ(s * 0.25).translate(x + s * 0.16, 1.22, 0)), c); A(at(new THREE.CapsuleGeometry(0.05, 0.26, 3, 8).translate(x + s * 0.06, 0.85, 0)), c); }
      A(at(new THREE.TorusGeometry(0.11, 0.022, 4, 12).rotateX(Math.PI / 2).translate(x, 1.43, 0)), tr); A(at(new THREE.BoxGeometry(0.1, 0.08, 0.02).translate(x, 1.26, 0.1)), '#ffcf60'); }); }
  // wall shelf with blue crystals + museum artifacts
  const shelf = { phi: LAY.shelf }; { for (let k = 0; k < 4; k++) { const y = 0.75 + k * 0.5; const g = new THREE.RingGeometry(R - 0.42, R - 0.02, 24, 1, Math.PI / 2 - shelf.phi - 0.32, 0.64); A(g.rotateX(-Math.PI / 2).translate(0, y, 0), IV2); A(new THREE.TorusGeometry(R - 0.42, 0.015, 3, 24, 0.64).rotateX(Math.PI / 2).rotateY(Math.PI / 2 - shelf.phi + 0.32).translate(0, y - 0.02, 0), LED); }
    for (const s of [-0.34, 0.34]) { const w = onWall(shelf.phi + s, R - 0.22); A(new THREE.BoxGeometry(0.07, 2.1, 0.44).rotateY(w.yaw).translate(w.x, 1.5, w.z), IV); A(new THREE.BoxGeometry(0.02, 2.1, 0.02).rotateY(w.yaw).translate(Math.sin(shelf.phi + s) * (R - 0.01 - 0.45), 1.5, -Math.cos(shelf.phi + s) * (R - 0.01 - 0.45)), GOLD); }
    { const bg = new THREE.CylinderGeometry(R - 0.03, R - 0.03, 2.1, 16, 1, true, Math.PI + shelf.phi - 0.34, 0.68).scale(-1, 1, 1).translate(0, 1.5, 0); bg.computeVertexNormals(); A(bg, '#d9cdb6'); } }
  // holo console desk + armchair + cabinet + rug edge
  const desk = onWall(LAY.desk, W(3.4)); { const M = new THREE.Matrix4().makeRotationY(desk.yaw).setPosition(desk.x, 0, desk.z); const at = (g) => g.applyMatrix4(M);
    A(at(new THREE.BoxGeometry(1.3, 0.7, 0.55).translate(0, 0.35, 0)), IV); A(at(new THREE.BoxGeometry(1.4, 0.06, 0.65).translate(0, 0.73, 0.02)), IV2); A(at(new THREE.BoxGeometry(1.4, 0.02, 0.02).translate(0, 0.7, 0.35)), GOLD); A(at(new THREE.BoxGeometry(0.5, 0.03, 0.25).translate(-0.15, 0.77, 0.08)), '#1a2a3a'); A(at(new THREE.CylinderGeometry(0.03, 0.03, 0.45, 8).translate(0.4, 1.0, -0.1)), GOLD); }
  { const w = onWall(LAY.chair, 2.25); const M = new THREE.Matrix4().makeRotationY(w.yaw + 0.4).setPosition(w.x, 0, w.z); const at = (g) => g.applyMatrix4(M);
    A(at(new THREE.SphereGeometry(0.55, 20, 12).scale(1, 0.5, 0.9).translate(0, 0.3, 0)), IV); A(at(new THREE.CapsuleGeometry(0.2, 0.7, 4, 12).rotateZ(Math.PI / 2).translate(0, 0.62, -0.38)), IV); for (const s of [-1, 1]) A(at(new THREE.CapsuleGeometry(0.15, 0.4, 4, 10).rotateX(Math.PI / 2).translate(s * 0.5, 0.5, -0.05)), IV2); A(at(new THREE.TorusGeometry(0.52, 0.02, 4, 24).rotateX(Math.PI / 2).translate(0, 0.08, 0)), GOLD); }
  { const w = onWall(-1.7, W(4.15)); const M = new THREE.Matrix4().makeRotationY(w.yaw).setPosition(w.x, 0, w.z); const at = (g) => g.applyMatrix4(M); A(at(new THREE.BoxGeometry(0.6, 0.85, 0.45).translate(0, 0.43, 0)), IV); for (const y of [0.3, 0.6]) A(at(new THREE.BoxGeometry(0.4, 0.02, 0.02).translate(0, y, 0.235)), GOLD); A(at(new THREE.CylinderGeometry(0.08, 0.08, 0.04, 12).rotateX(Math.PI / 2).translate(0, 0.72, 0.235)), CY); }
  const fm = std({ vertexColors: true }); fm.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += vColor.rgb * (step(0.97, vColor.r) * step(vColor.b, 0.4) * 2.6 + step(0.8, vColor.b) * step(vColor.r, 0.4) * 2.0);'); }; fm.customProgramCacheKey = () => 'home_furn';
  const furn = new THREE.Mesh(mergeGeometries(parts), fm); furn.name = 'home_furniture'; I.add(furn);
  // ---- textured details: rug, paw pillow, armchair paw, porthole views, holo panel ----
  const rug = new THREE.Mesh(new THREE.CircleGeometry(1.9, 48).rotateX(-Math.PI / 2).translate(0.2, 0.012, 0.3), std({ roughness: 0.95, map: canvasTex(512, 512, (g, w) => { const c = w / 2; const gr = g.createRadialGradient(c, c, 10, c, c, c); gr.addColorStop(0, '#e2d6c2'); gr.addColorStop(1, '#cbbba2'); g.fillStyle = gr; g.beginPath(); g.arc(c, c, c, 0, 7); g.fill(); g.strokeStyle = '#b9a688'; g.lineWidth = 10; g.beginPath(); g.arc(c, c, c - 18, 0, 7); g.stroke(); g.lineWidth = 3; g.beginPath(); g.arc(c, c, c - 34, 0, 7); g.stroke();
    const ink = '#a8916c'; g.fillStyle = ink; g.beginPath(); g.arc(c - 30, c + 5, 150, 0, 7); g.fill(); g.fillStyle = '#ded2bd'; g.beginPath(); g.arc(c + 25, c - 25, 140, 0, 7); g.fill(); // moon-cat emblem: crescent hugging a sitting cat silhouette
    g.fillStyle = ink; g.beginPath(); g.ellipse(c + 30, c + 55, 62, 78, 0, 0, 7); g.fill(); g.beginPath(); g.arc(c + 30, c - 40, 46, 0, 7); g.fill();
    g.beginPath(); g.moveTo(c - 6, c - 62); g.lineTo(c - 2, c - 112); g.lineTo(c + 22, c - 80); g.fill(); g.beginPath(); g.moveTo(c + 66, c - 62); g.lineTo(c + 62, c - 112); g.lineTo(c + 38, c - 80); g.fill();
    g.strokeStyle = ink; g.lineWidth = 16; g.lineCap = 'round'; g.beginPath(); g.moveTo(c + 85, c + 110); g.quadraticCurveTo(c + 150, c + 90, c + 130, c + 30); g.stroke();
    g.fillStyle = '#f0d58a'; g.beginPath(); g.arc(c + 12, c - 44, 7, 0, 7); g.arc(c + 48, c - 44, 7, 0, 7); g.fill();
    g.fillStyle = 'rgba(200,160,80,0.9)'; for (let k = 0; k < 5; k++) { const a = -0.6 + k * 0.32, rr = c - 60; g.beginPath(); g.arc(c + Math.cos(a) * rr, c + Math.sin(a) * rr, 5, 0, 7); g.fill(); }
    paw(g, c - 120, c + 120, 30, 'rgba(150,130,105,0.5)'); paw(g, c + 140, c - 130, 24, 'rgba(150,130,105,0.4)'); }) })); I.add(rug);
  const decal = (w, h, draw, pos, yaw, tilt = 0) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), std({ map: canvasTex(128, 128, draw), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })); m.position.copy(pos); m.rotation.set(tilt, yaw, 0, 'YXZ'); I.add(m); return m; };
  { const w = onWall(LAY.bed, W(3.55)); const yaw = w.yaw; const lx = -0.72 * Math.cos(yaw) + 0.0, lz = 0; const off = new THREE.Vector3(-0.72, 0.74, -0.04).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw); decal(0.22, 0.22, (g) => paw(g, 64, 64, 40, '#c99a4a'), new THREE.Vector3(w.x, 0, w.z).add(off).add(new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(0.0)).add(new THREE.Vector3(0, 0, 0)), yaw + 0.0, -0.2); }
  { const w = onWall(LAY.chair, 2.25); const yaw = w.yaw + 0.4; const f = new THREE.Vector3(0.62, 0.32, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw); decal(0.3, 0.3, (g) => paw(g, 64, 64, 44, '#b08850'), new THREE.Vector3(w.x, 0, w.z).add(f), yaw + Math.PI / 2); }
  const rts = PH.map(() => new THREE.WebGLRenderTarget(low ? 256 : 512, low ? 256 : 512, { colorSpace: THREE.LinearSRGBColorSpace }));
  const glass = PH.map((p, i) => { const w = onWall(p.phi, R - 0.16); const m = new THREE.Mesh(new THREE.CircleGeometry(p.r, 40), new THREE.MeshBasicMaterial({ map: rts[i].texture })); m.position.set(w.x, p.y, w.z); m.rotation.y = w.yaw; I.add(m); return m; });
  const holoTex = canvasTex(512, 300, () => { }); const holo = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.98), new THREE.MeshBasicMaterial({ map: holoTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false, color: new THREE.Color(1.9, 2.3, 2.8) }));
  { const off = new THREE.Vector3(-0.05, 1.42, 0.22).applyAxisAngle(new THREE.Vector3(0, 1, 0), desk.yaw); holo.position.set(desk.x + off.x, off.y, desk.z + off.z); holo.rotation.set(-0.12, desk.yaw, 0, 'YXZ'); I.add(holo); }
  const holo2 = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.5), holo.material); { const off = new THREE.Vector3(-1.05, 1.3, 0.45).applyAxisAngle(new THREE.Vector3(0, 1, 0), desk.yaw); holo2.position.set(desk.x + off.x, off.y, desk.z + off.z); holo2.rotation.set(-0.1, desk.yaw + 0.55, 0, 'YXZ'); I.add(holo2); }
  const holo3 = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.36).rotateX(-Math.PI / 2 + 0.5), holo.material); { const off = new THREE.Vector3(-0.1, 0.92, 0.3).applyAxisAngle(new THREE.Vector3(0, 1, 0), desk.yaw); holo3.position.set(desk.x + off.x, off.y, desk.z + off.z); holo3.rotation.y = desk.yaw; I.add(holo3); }
  function drawHolo() { const g = holoTex.image.getContext('2d'), W = 512, H = 300; const info = getHubInfo(); g.clearRect(0, 0, W, H); g.fillStyle = 'rgba(30,140,220,0.25)'; g.fillRect(0, 0, W, H); g.strokeStyle = 'rgba(140,230,255,0.9)'; g.lineWidth = 3; g.strokeRect(3, 3, W - 6, H - 6);
    g.fillStyle = '#d8f8ff'; g.font = '700 26px system-ui,sans-serif'; g.fillText(info.title || 'MOONKATTY HUB', 18, 38); g.font = '600 20px system-ui,sans-serif'; (info.lines || []).slice(0, 7).forEach((l, i) => g.fillText(l, 18, 74 + i * 30));
    g.strokeStyle = 'rgba(160,240,255,0.9)'; g.lineWidth = 2; g.beginPath(); for (let i = 0; i <= 20; i++) { const x = 300 + i * 9.5, y = 230 - (Math.sin(i * 0.7) * 0.5 + 0.5) * 70 - i * 2; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); for (let i = 0; i < 8; i++) { g.fillStyle = 'rgba(120,220,255,0.6)'; g.fillRect(300 + i * 24, 270 - (20 + (i * 37) % 60), 14, 20 + (i * 37) % 60); }
    holoTex.needsUpdate = true; }
  // crystals + artifacts on the shelf (rebuilt from the save on entry)
  const crysMat = new THREE.MeshStandardMaterial({ color: '#58c8ff', emissive: '#2aa8ff', emissiveIntensity: 3.0, roughness: 0.15, metalness: 0.1, envMap: env || null }); let crys = null, arts = null;
  const artMat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.6, roughness: 0.35, envMap: env || null });
  function fillShelf() { for (const m of [crys, arts]) if (m) { I.remove(m); m.geometry.dispose(); } const cg = [], ag = [], cl = []; const list = getMuseum(); const AC = { ancient: '#d8a640', station: '#c8ced8', meteor: '#7a6aa8' };
    const SH = { tablet: () => new THREE.BoxGeometry(0.12, 0.16, 0.03), idol: () => new THREE.CapsuleGeometry(0.045, 0.09, 2, 6), glyph: () => new THREE.TorusGeometry(0.06, 0.018, 4, 10), mask: () => new THREE.SphereGeometry(0.075, 8, 5, 0, Math.PI), badge: () => new THREE.CylinderGeometry(0.06, 0.06, 0.02, 10).rotateX(Math.PI / 2), logbook: () => new THREE.BoxGeometry(0.15, 0.04, 0.11), helmet: () => new THREE.SphereGeometry(0.08, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.6), flag: () => new THREE.BoxGeometry(0.12, 0.08, 0.01), shard: () => new THREE.OctahedronGeometry(0.07, 0).scale(0.6, 1.3, 0.6), geode: () => new THREE.DodecahedronGeometry(0.07, 0), iron: () => new THREE.IcosahedronGeometry(0.065, 0).scale(1.3, 0.8, 1), pearl: () => new THREE.SphereGeometry(0.06, 10, 8) };
    let slot = 0; const pos = (k) => { const row = k % 4, col = Math.floor(k / 4); const phi = shelf.phi - 0.24 + col * 0.12 + (row % 2) * 0.05; const w = onWall(phi, R - 0.24); return new THREE.Vector3(w.x, 0.75 + row * 0.5 + 0.02, w.z); };
    for (let k = 0; k < 6; k++) { const p = pos(slot++); const h = 0.22 + (k % 3) * 0.07; cl.push({ x: p.x, y: p.y, z: p.z, s: h * 1.05, tilt: 0.05 * (k % 2), ph: k * 1.7 }); }
    for (const a of list) { if (slot >= 16) break; const [set, it] = a.split(':'); if (!SH[it]) continue; const p = pos(slot++); ag.push(colorize(SH[it]().translate(p.x, p.y + 0.09, p.z), AC[set])); }
    crys = makeStaticCrystals(I, cl, 'home_crystals'); crys.position.y -= 0;  if (ag.length) { arts = new THREE.Mesh(mergeGeometries(ag), artMat); I.add(arts); } else arts = null; setL(I); }
  // robot beside the console
  const robot = makeCrewRobot(I, env, 'builder', 1); { const rp = onWall(LAY.robot, 2.3); robot.root.position.set(rp.x, 0, rp.z); const yD = Math.atan2(desk.x - rp.x, desk.z - rp.z), yC = Math.atan2(0 - rp.x, 2.2 - rp.z); robot.root.rotation.y = yD + Math.atan2(Math.sin(yC - yD), Math.cos(yC - yD)) * 0.55; robot.root.visible = true; }
  // lights (layer 1 only: they never touch the outside world)
  const hemi = new THREE.HemisphereLight('#ffe9cc', '#8a6c4a', 0.65); const lamp = new THREE.PointLight('#ffcf94', 8, 0, 1.6); lamp.position.set(0, WH + 0.6, 0); const cyan = new THREE.PointLight('#7fdcff', 2.0, 5, 2); { const off = new THREE.Vector3(0, 1.3, 0.6).applyAxisAngle(new THREE.Vector3(0, 1, 0), desk.yaw); cyan.position.set(desk.x + off.x, off.y, desk.z + off.z); }
  I.add(hemi, lamp, cyan); setL(I); I.visible = false;
  // collision: room circle + furniture circles (local xz)
  const L = (phi, r) => onWall(phi, r);
  const cols = [{ ...L(LAY.bed, W(3.55)), r: 1.0 }, { ...L(LAY.bed, W(3.0)), r: 0.75 }, { ...L(LAY.pet, W(3.5)), r: 0.6 }, { ...rack, r: 0.65 }, { ...desk, r: 0.75 }, { ...L(LAY.chair, 2.25), r: 0.62 }, { ...L(-1.7, W(4.15)), r: 0.45 }, { x: robot.root.position.x, z: robot.root.position.z, r: 0.45 }];
  const doorIn = onWall(PH[0].phi, R - 1.1), consoleIn = (() => { const off = new THREE.Vector3(0, 0, 1.05).applyAxisAngle(new THREE.Vector3(0, 1, 0), desk.yaw); return { x: desk.x + off.x, z: desk.z + off.z }; })();
  const top = (x, z, r = 0.3) => { const lx = x - origin.x, lz = z - origin.z; if (Math.hypot(lx, lz) > R - 0.35 - r) return origin.y + 20; for (const c of cols) if (Math.hypot(lx - c.x, lz - c.z) < c.r + r) return origin.y + 20; return -1e9; };
  // ---- outside: airlock door on the living dome (layer 0) ----
  const dg = []; const D = (g, col) => dg.push(colorize(g, col)); D(new THREE.CylinderGeometry(1.45, 1.45, 1.1, 24, 1, true).rotateX(Math.PI / 2).translate(0, 1.45, -0.3), IV2); D(new THREE.TorusGeometry(1.4, 0.16, 6, 28).translate(0, 1.45, 0.25), IV); D(new THREE.TorusGeometry(1.22, 0.08, 5, 28).translate(0, 1.45, 0.33), GOLD);
  D(new THREE.BoxGeometry(3.0, 0.2, 1.6).translate(0, 0.0, 0.2), '#8d8a84'); D(new THREE.BoxGeometry(0.5, 0.06, 0.04).translate(0, 2.98, 0.3), CY);
  const dm = std({ vertexColors: true, metalness: 0.3, roughness: 0.45 }); dm.onBeforeCompile = fm.onBeforeCompile; dm.customProgramCacheKey = () => 'home_furn';
  const doorM = new THREE.Mesh(mergeGeometries(dg), dm); doorM.name = 'ch2_airlock'; const dy = groundAt(door.x, door.z); doorM.position.set(door.x, dy, door.z); doorM.rotation.y = door.yaw; doorM.visible = false; scene.add(doorM); // Chapter 2 only (shown by ch2 when the home feature is on)
  const leafG = new THREE.CircleGeometry(1.2, 32, -Math.PI / 2, Math.PI); const leafM = std({ color: '#d9cfbd', metalness: 0.35, roughness: 0.4 });
  const leaves = [-1, 1].map(s => { const m = new THREE.Mesh(leafG, leafM); m.rotation.y = s < 0 ? Math.PI : 0; const g = new THREE.Group(); g.add(m); g.position.set(0, 1.45, 0.3); doorM.add(g); return g; });
  const doorLamp = new THREE.Mesh(new THREE.CircleGeometry(0.12, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 2.2, 3.0), toneMapped: false })); doorLamp.position.set(1.75, 1.45, 0.35); doorM.add(doorLamp);
  let open = 0, want = 0, holoT = 0;
  const outsideDoorW = { x: door.x + Math.sin(door.yaw) * 2.2, z: door.z + Math.cos(door.yaw) * 2.2 };
  const api = { group: I, LAYER, R, doorIn, consoleIn, outside: outsideDoorW, doorW: { x: door.x, z: door.z }, robot, doorMesh: doorM,
    solids(real) { const fy = origin.y; return { CAT: real.CAT, standAt: () => fy, floorAt: () => fy, visAt: () => fy, top, over: () => 1e9, slabHit: () => Infinity, nearestFree: (x, z) => { const lx = x - origin.x, lz = z - origin.z, d = Math.hypot(lx, lz), m = R - 1.0; if (d > m) return { x: origin.x + lx / d * m, z: origin.z + lz / d * m, moved: d - m }; return { x, z, moved: 0 }; } }; },
    setOpen(v) { want = v ? 1 : 0; },
    snapshot(renderer, sc, camWorld) { // live views for the two portholes (taken on entry, from the real world)
      const cam = new THREE.PerspectiveCamera(55, 1, 0.5, 4000); const dyaw = door.yaw; const eye = new THREE.Vector3(door.x + Math.sin(dyaw) * 1.0, dy + 1.6, door.z + Math.cos(dyaw) * 1.0);
      const prevT = renderer.getRenderTarget(); const prevMask = cam.layers.mask; cam.layers.set(0);
      cam.position.copy(eye); cam.lookAt(eye.x + Math.sin(dyaw + 0.5) * 10, eye.y - 0.6, eye.z + Math.cos(dyaw + 0.5) * 10); renderer.setRenderTarget(rts[0]); renderer.render(sc, cam);
      const tgt = camWorld.base; cam.fov = 48; cam.updateProjectionMatrix(); const e2 = new THREE.Vector3(door.x - Math.sin(dyaw) * 3, dy + 5.5, door.z - Math.cos(dyaw) * 3); cam.position.copy(e2); const look = new THREE.Vector3(tgt.x, dy + 6, tgt.z); if (earthDir) look.lerp(e2.clone().addScaledVector(earthDir, 60), 0.5); cam.lookAt(look); renderer.setRenderTarget(rts[1]); renderer.render(sc, cam);
      renderer.setRenderTarget(prevT); },
    enterPrep() { fillShelf(); drawHolo(); },
    update(dt, camPos, inside) { open += (want - open) * Math.min(1, dt * 5); for (const [i, g] of leaves.entries()) g.position.x = (i ? 1 : -1) * open * 1.25; leaves.forEach(g => g.visible = open < 0.98);
      if (inside) { robot.update(dt, 'work', camPos); holoT -= dt; if (holoT <= 0) { holoT = 1; drawHolo(); } holo.material.opacity = 0.85 + 0.15 * Math.sin(performance.now() * 0.004); } } };
  return api;
}
