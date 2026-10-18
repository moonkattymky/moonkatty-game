import * as THREE from 'three';
import { GLTFLoader } from '../vendor/three/jsm/loaders/GLTFLoader.js';
import { EffectComposer } from '../vendor/three/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/three/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../vendor/three/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../vendor/three/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from '../vendor/three/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from '../vendor/three/jsm/shaders/FXAAShader.js';
import { makeFootprints } from './footprints.js';
import { initTelegram } from './tg/telegram.js';
import * as TERRAIN_MOD from './terrain.js';
const TGAPI = initTelegram({ exitUrl: '../' }); // Telegram Mini App shell (no-op in a plain browser)
const ASSET_V = '39'; // bump with the GLB (immutable per version -> HTTP + service-worker cache hits)
const loadMsg = (f) => { const el = document.getElementById('loadbar'); if (el) el.style.width = Math.round(20 + f * 80) + '%'; };
import { buildTerrain, GRID, groundAt, sd, F, Rt, LOOKOUT, CONCEPT, PLAY_START, LAMPMAP, LAMPMAP_R, AOMAP, REGIONS, PATCH, PATCH2, PATCH3, canyonPoint, canyonS } from './terrain.js';
import { Builder, GQ } from './builder.js';
import { buildHub, colliders, C, LAMPS } from './base.js';
import { buildWorld } from './world.js';
import { buildRocks, buildCrystals, beamMaterial, addBeams, InstanceCuller, buildTracks, TRACK_MAIN } from './props.js';
import { makeAtlas, EMISSIVE_INTENSITY } from './atlas.js';
import { buildSky, buildSpace } from './sky.js';
import { Controller } from './controller.js';
import { buildSolids } from './collide.js';
import { createGame } from './game/index.js';
import { LEDGE, LAMPK } from './terrain.js';
// NaN/Inf guard (iPad "blinking black squares"): a single non-finite pixel (derivative-based normals of sub-pixel far-rock facets -> normalize(0))
// gets smeared by UnrealBloom's separable blur into a big black rectangle for that frame. Make normals safe, clamp lit output, and sanitize the bloom input.
{ const C = THREE.ShaderChunk;
  C.normal_fragment_begin = C.normal_fragment_begin.replace('vec3 normal = normalize( cross( fdx, fdy ) );', 'vec3 nCr = cross( fdx, fdy ); float nLn = length( nCr ); vec3 normal = nLn > 0.0 ? nCr / nLn : vec3( 0.0, 0.0, 1.0 );');
  C.lights_fragment_begin = 'if ( !( dot( normal, normal ) < 4.0 ) ) normal = vec3( 0.0, 0.0, 1.0 );\n' + C.lights_fragment_begin;
  C.opaque_fragment = 'outgoingLight = all( lessThan( abs( outgoingLight ), vec3( 6.0e4 ) ) ) ? outgoingLight : vec3( 0.0 );\n' + C.opaque_fragment; }

const Q = new URLSearchParams(location.search);
const SHOT = Q.has('shot'); const VIEW = Q.get('view') || 'play';
const LOW = Q.get('q') === 'low'; if (LOW) { GQ.s = 0.4; GRID.Mn = 72; GRID.Mf = 40; } // phones: fewer segments on all architecture + coarser near terrain rings
const MOBILE = Q.get('q') === 'mobile' || (!Q.get('q') && (matchMedia('(pointer:coarse)').matches || Math.min(innerWidth, innerHeight) < 480));
if (MOBILE && !LOW) { GQ.s = 0.46; GRID.Mn = 84; GRID.Mf = 44; GRID.si = 1; GRID.sn = 4; GRID.sf = 1; } // auto phone preset: lighter architecture + terrain in fewer, larger chunks (fewer draw calls), keeps ridge/crystals/bloom/shadows
const BLOOM = Q.get('bloom') !== '0' && !LOW;
document.body.classList.toggle('shot', SHOT);

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: SHOT });
let PR = Math.min(devicePixelRatio, LOW ? 1 : MOBILE ? 1.25 : 1.5); if (Q.get('pr')) PR = +Q.get('pr');
renderer.setPixelRatio(PR); renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = +(Q.get('exp') || 0.92);
renderer.shadowMap.enabled = !LOW; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2('#1e2024', 0.0011);
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.2, 9000);

// light: sun from camera-left in the concept framing, cool sky fill, warm bounce
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const sunDir = v3(-Rt.x * 0.75 - F.x * 0.45, 0.62, -Rt.z * 0.75 - F.z * 0.45).normalize();
const earthYaw = 0.296, earthEl = 0.138; // radians relative to concept forward
const ef = v3(F.x, 0, F.z).applyAxisAngle(v3(0, 1, 0), -earthYaw); const earthDir = ef.multiplyScalar(Math.cos(earthEl)).add(v3(0, Math.sin(earthEl), 0)).normalize();
const hemi = new THREE.HemisphereLight('#b3b6bc', '#4a4a4d', 0.6); scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff1dc', 2.3); sun.castShadow = true;
sun.shadow.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048); const sc = sun.shadow.camera; sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 1; sc.far = 400; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);
const fill = new THREE.DirectionalLight('#8f9aab', 0.45); fill.position.copy(earthDir).multiplyScalar(100); scene.add(fill);
const front = new THREE.DirectionalLight('#d6d3cc', 0.55); front.position.set(-F.x * 80 - Rt.x * 40, 60, -F.z * 80 - Rt.z * 40); scene.add(front);
const rim = new THREE.DirectionalLight('#ffc978', 0.75); rim.position.set(F.x * 80 + Rt.x * 20, 34, F.z * 80 + Rt.z * 20); scene.add(rim); // gentle warm gold rim from behind the base (toward the play/concept cameras) // soft key from behind the concept camera (lights the left hillside)
const coreLight = new THREE.PointLight('#ff9a40', 60, 32, 1.6); scene.add(coreLight);

// environment for gold/ivory reflections: dark sky, light ground, warm sun panel
function makeEnv() {
  const s = new THREE.Scene();
  const g = new THREE.SphereGeometry(10, 32, 16); const col = []; const P = g.attributes.position;
  for (let i = 0; i < P.count; i++) { const y = P.getY(i) / 10; const c = new THREE.Color(); if (y > 0) c.set('#0b1626').lerp(new THREE.Color('#2a3d58'), Math.pow(1 - y, 4)); else c.set('#6d6b68').lerp(new THREE.Color('#3a3936'), -y); col.push(c.r, c.g, c.b); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  s.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(6, 4), new THREE.MeshBasicMaterial({ color: new THREE.Color(12, 10, 8), side: THREE.DoubleSide })); panel.position.copy(sunDir).multiplyScalar(8); panel.lookAt(0, 0, 0); s.add(panel);
  const p2 = new THREE.Mesh(new THREE.PlaneGeometry(8, 3), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 2.2, 3.5), side: THREE.DoubleSide })); p2.position.copy(earthDir).multiplyScalar(8); p2.lookAt(0, 0, 0); s.add(p2);
  const pm = new THREE.PMREMGenerator(renderer); const rt = pm.fromScene(s, 0.02); pm.dispose(); return rt.texture;
}
const env = makeEnv();

// ---------- world ----------
const terrain = buildTerrain(); scene.add(terrain);
const b = new Builder(), wb = new Builder(); const beams = [];
const WB = { launch: new Builder(), reactor: new Builder(), reactorNear: new Builder(), reactorFar: new Builder(), launchNear: new Builder(), canyonNear: new Builder(), echoNear: new Builder(), canyon: new Builder(), echo: new Builder(), roads: new Builder(), misc: new Builder() };
const hub = buildHub(b, beams); buildWorld(WB, beams); addBeams(wb, beams);
{ // warm light pools under the path lamps (terrain samples this map; no runtime lights)
  const N = 512, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, N, N); g.globalCompositeOperation = 'lighter';
  for (const L of LAMPS) { const u = (L.x / (2 * LAMPMAP_R) + 0.5) * N, v = (L.z / (2 * LAMPMAP_R) + 0.5) * N; const r = 3.2 / (2 * LAMPMAP_R) * N; const gr = g.createRadialGradient(u, v, 0, u, v, r); gr.addColorStop(0, 'rgba(255,170,90,0.55)'); gr.addColorStop(0.45, 'rgba(255,150,70,0.2)'); gr.addColorStop(1, 'rgba(255,140,60,0)'); g.fillStyle = gr; g.fillRect(u - r, v - r, 2 * r, 2 * r); }
  const t = new THREE.CanvasTexture(c); t.flipY = true; t.colorSpace = THREE.SRGBColorSpace; LAMPMAP.value = t; }
coreLight.position.set(hub.reactor.x, hub.reactor.y + 2.5, hub.reactor.z);
const atlas = makeAtlas();
const hullOpts = { map: atlas.map, emissiveMap: atlas.emissiveMap, emissive: '#ffffff', emissiveIntensity: EMISSIVE_INTENSITY, roughnessMap: atlas.ormMap, metalnessMap: atlas.ormMap, roughness: 1, metalness: 1, vertexColors: true, envMap: env, envMapIntensity: 0.75 };
const mats = {
  hull: new THREE.MeshStandardMaterial(hullOpts),
  lattice: new THREE.MeshStandardMaterial({ ...hullOpts, alphaTest: 0.5, side: THREE.DoubleSide }),
  beam: beamMaterial(),
};
mats.ivory = mats.hull; // placeholder fallback
mats.hull.color.setRGB(0.8, 0.78, 0.77); mats.lattice.color.setRGB(0.8, 0.78, 0.77); // pass 41 grade: concept ivory is a soft grey-beige, not bright yellow
{ // pass 40: architecture micro-detail (one shared material, no geometry): world-space panel seams + per-panel tone on flat ivory panels
  // (crates, storage modules, walls, pads), fading with distance/footprint so it never aliases; curved hulls keep their atlas panelling
  const hm = mats.hull; hm.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPh;').replace('#include <project_vertex>', '#include <project_vertex>\nvWPh = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPh; float hhP(vec2 p){ p = fract(p * vec2(0.1031, 0.1030)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.x); }')
      .replace('#include <color_fragment>', `#include <color_fragment>
      { float dH = length(vWPh - cameraPosition); float kH = 1.0 - smoothstep(30.0, 90.0, dH); vec3 fn = normalize(cross(dFdx(vWPh), dFdy(vWPh)));
        float lum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11)); float sat = max(max(diffuseColor.r, diffuseColor.g), diffuseColor.b) - min(min(diffuseColor.r, diffuseColor.g), diffuseColor.b);
        float iv = smoothstep(0.3, 0.45, lum) * smoothstep(0.42, 0.58, diffuseColor.b / max(diffuseColor.r, 1e-3)); /* ivory (linear): bright, not gold */ float flat_ = 1.0 - smoothstep(0.02, 0.08, length(fwidth(fn)));
        float ny_ = abs(fn.y); float k = kH * iv * flat_ * max(max(1.0 - smoothstep(0.2, 0.4, ny_), smoothstep(0.9, 0.97, ny_)), 0.3); /* pass 41: only walls + flat tops (no diagonal stripes on slanted roofs) */ if (k > 0.01) { vec3 aw = abs(fn); vec2 uv = (aw.x > aw.y && aw.x > aw.z) ? vWPh.zy : ((aw.y > aw.z) ? vWPh.xz : vWPh.xy);
          vec2 g = uv / vec2(0.8, 0.55); vec2 fw = fwidth(g); vec2 dd = min(fract(g), 1.0 - fract(g)); vec2 sl = (1.0 - smoothstep(fw * 0.9, fw * 2.2, dd)) * (1.0 - smoothstep(0.18, 0.4, fw)); vec2 hl = (1.0 - smoothstep(fw * 2.2, fw * 3.6, abs(fract(g) - fw * 3.0))) * (1.0 - smoothstep(0.18, 0.4, fw));
          float seam = max(sl.x, sl.y); float pt = hhP(floor(g) + floor(vWPh.y * 0.1)); diffuseColor.rgb *= mix(1.0, (1.0 - 0.42 * seam + 0.12 * max(hl.x, hl.y) * (1.0 - seam)) * (0.93 + 0.14 * pt), k); } } /* dark seam + lit bevel on one side */`);
  }; hm.customProgramCacheKey = () => 'hull_p41';
}
const built = b.build(mats, scene); for (const [n, B] of [...Object.entries(WB), ['beams', wb]]) { const bw = B.build(mats, scene, '_' + n); for (const k in bw) bw[k].castShadow = false; }
// far chapter-region hulls sit behind the crater rim: skip them while the camera is low inside the hub basin (cheap occlusion cull)
const farRegion = []; scene.traverse(o => { if (o.isMesh && /_(launch|echo|canyon|reactor)$/.test(o.name)) { o.geometry.computeBoundingSphere(); farRegion.push([o, o.geometry.boundingSphere.center.clone()]); } });
const cullFarRegions = () => { const c = camera.position; for (const [o, R] of (cullFarRegions.cr ??= ['crystals_canyon', 'crystals_echo'].map(n => scene.getObjectByName(n)).filter(Boolean).map(o => { o.computeBoundingSphere(); return [o, o.boundingSphere]; }))) o.visible = Math.hypot(c.x - R.center.x, c.z - R.center.z) < R.radius + 260 && !(Math.hypot(c.x, c.z) < 125 && c.y < 45); /* hidden behind the crater rim from inside the hub basin. Chapter-1 budget: far crystal fields are invisible specks from the hub */ { const away = Math.hypot(c.x, c.z) > 280 && c.y < 70; for (const o of (cullFarRegions.hub ??= (() => { const l = []; scene.traverse(o => { if (o.isMesh && ((o.name === 'merged_hull' && o.parent === scene) || /^terrain_i\d/.test(o.name))) l.push(o); }); return l; })())) o.visible = !away; } /* pass 21: hub base + inner terrain hidden behind the crater rim when the camera is out in a chapter region */ { const pm3 = (cullFarRegions.pm3 ??= scene.getObjectByName('terrain_patch3')); if (pm3) { const on3 = Math.hypot(c.x - PATCH3.x, c.z - PATCH3.z) < 360 && c.y < 260; pm3.visible = on3; PATCH3.on.value = on3 ? 1 : 0; } } const inHub = Math.hypot(c.x, c.z) < 125 && c.y < 45; for (const [o, ctr] of farRegion) o.visible = !inHub || ctr.distanceTo(c) < 380; { const pm2 = (cullFarRegions.pm2 ??= scene.getObjectByName('terrain_patch2')); if (pm2) { const on2 = Math.hypot(c.x - PATCH2.x, c.z - PATCH2.z) < 340 && c.y < 260; pm2.visible = on2; PATCH2.on.value = on2 ? 1 : 0; } } { const pm = (cullFarRegions.pm ??= scene.getObjectByName('terrain_patch')); if (pm) { const on = Math.hypot(c.x - PATCH.x, c.z - PATCH.z) < 330 && c.y < 200; pm.visible = on; PATCH.on.value = on ? 1 : 0; for (const o of (cullFarRegions.rl ??= scene.children.filter(o => /_reactor(Near|Far)$/.test(o.name)))) o.visible = /Near$/.test(o.name) ? on : !on && !(Math.hypot(c.x, c.z) < 125 && c.y < 45); } for (const [o, R] of (cullFarRegions.nl ??= scene.children.filter(o => /_(launch|canyon|echo)Near$/.test(o.name)).map(o => [o, REGIONS[o.name.match(/_(launch|canyon|echo)Near$/)[1]]]))) o.visible = Math.hypot(c.x - R.x, c.z - R.z) < 340 && c.y < 260; /* region near-detail LOD */ } /* reactor high-res patch only up close; base terrain fills the hole otherwise */ { const farRidgeMesh = (cullFarRegions.fr ??= scene.getObjectByName('farRidge')); if (farRidgeMesh) farRidgeMesh.visible = !LOW && Math.hypot(c.x, c.z) < 140 && c.y < 60; } }; // far ridge is a backdrop layer for in-hub views only (no ring band from world/aerial)
const culler = new InstanceCuller();
const rocks = buildRocks(scene, culler, LOW ? 0.6 : MOBILE ? 0.8 : 1);
const crystals = buildCrystals(scene, env, LOW);
// cat collision: rasterise every rock instance + region/hub structures into solid columns (stand on top / blocked by anything taller than a step)
const solids = (() => { const meshes = []; scene.traverse(o => { if (!o.isMesh || !o.geometry) return; if (o.isInstancedMesh) { if (/^crystals(_canyon|_echo)?$/.test(o.name)) { const T = []; for (let i = 0; i < o.count; i++) { const m = new THREE.Matrix4(); o.getMatrixAt(i, m); T.push(m); } meshes.push({ mesh: o, matrices: T }); } return; }
  if (/^merged_(hull|lattice)/.test(o.name) && !/_(reactorFar|beams)$/.test(o.name)) meshes.push({ mesh: o }); });
  return buildSolids({ rocks, meshes, colliders }); })();
{ // terrain contact-shadow / crevice map (1024², +-75 m): dark soft pools under every rock -> rugged lit-top / dark-crevice contrast
  const N = 1024, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, N, N);
  for (const [x, z, s, w] of rocks.contacts) { const u = (x / (2 * LAMPMAP_R) + 0.5) * N, v = (z / (2 * LAMPMAP_R) + 0.5) * N; const r = Math.max(1.5, s * 1.35 / (2 * LAMPMAP_R) * N); const a = 0.5 * w;
    const gr = g.createRadialGradient(u, v, 0, u, v, r); gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(0.55, `rgba(0,0,0,${a * 0.45})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(u - r, v - r, 2 * r, 2 * r); }
  const t = new THREE.CanvasTexture(c); t.flipY = true; AOMAP.value = t; }
{ const pts = []; for (let i = 0; i <= 46; i++) { const t = i / 46; pts.push(TRACK_MAIN(t)); }
  const loop = []; for (let i = 0; i <= 64; i++) { const a = i / 64 * Math.PI * 2; loop.push({ x: Math.cos(a) * 31, z: Math.sin(a) * 31 }); }
  const spur = []; for (let i = 0; i <= 20; i++) { const t = i / 20; spur.push(sd(-1.5 - t * 3 + Math.sin(t * 3) * 1.5, -11 - t * 20)); }
  const toPortal = []; for (let i = 0; i <= 20; i++) { const t = i / 20; toPortal.push(sd(22 + t * 9, 18 + t * 13 + Math.sin(t * 3) * 2)); }
  const side = []; for (let i = 0; i <= 36; i++) { const t = i / 36; side.push(sd(8 - t * 4.5 + Math.sin(t * 2.6) * 1.6, -42 + t * 30)); } /* pass 26: second rover trail curving into the base (concept foreground) */
  buildTracks(scene, [pts, loop, spur, toPortal, side]); }
const sky = buildSky(sunDir, earthDir, LOW); scene.add(sky.group); sky.starMat.uniforms.uPR.value = PR;
const space = buildSpace(scene, mats.hull, MOBILE || LOW);

// ---------- cat ----------
const ctrl = new Controller(camera, renderer.domElement, colliders); ctrl.solids = solids;
const catRoot = new THREE.Group(); scene.add(catRoot);
let mixer = null, actions = {}, current = null, headBone = null, headYaw = 0;
const _hq = new THREE.Quaternion(), _hp = new THREE.Quaternion(), _hr = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0), _hw = new THREE.Vector3();
let lookTarget = null; // world point the cat looks at (concept), else camera forward while idle
function headLook(dt) {
  if (!headBone) return; catRoot.updateMatrixWorld(true);
  let want = 0;
  if (lookTarget && !ctrl.camFree) { headBone.getWorldPosition(_hw); want = Math.atan2(lookTarget.x - _hw.x, lookTarget.z - _hw.z) - ctrl.yaw; }
  else if (ctrl.camFree && ctrl.speed < 0.6 && ctrl.onGround) { const d = new THREE.Vector3(); camera.getWorldDirection(d); want = Math.atan2(d.x, d.z) - ctrl.yaw; }
  want = Math.atan2(Math.sin(want), Math.cos(want)); want = THREE.MathUtils.clamp(want, -0.95, 0.95);
  headYaw = dt >= 0.5 ? want : headYaw + (want - headYaw) * Math.min(1, dt * 4);
  headBone.userData.pre = (headBone.userData.pre || new THREE.Quaternion()).copy(headBone.quaternion); headBone.parent.getWorldQuaternion(_hp); _hr.setFromAxisAngle(_up, headYaw); _hq.copy(_hp).invert().multiply(_hr).multiply(_hp); headBone.quaternion.premultiply(_hq); headBone.updateMatrixWorld(true);
}
const flame = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.9, 10, 1, true).rotateX(Math.PI).translate(0, -0.35, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 2.2, 0.8), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
flame.position.set(0, 0.85, -0.45); flame.visible = false; catRoot.add(flame);
// walk/run locomotion: per-clip timeScale = speed / measured stride (feet planted up to the cap, then accept a little slide);
// if the glb has a 'run' clip, cross-fade walk<->run with hysteresis, carrying the gait phase over so feet don't jump
function locomotion(speed) {
  const hasRun = !!actions.run; const inRun = current === actions.run && hasRun;
  const name = hasRun && (inRun ? speed > 6.2 : speed > 7.2) ? 'run' : 'walk'; const a = actions[name]; if (!a) return;
  if (current !== a) { const prev = current; const ph = prev && (prev === actions.walk || prev === actions.run) ? (prev.time / prev.getClip().duration) % 1 : 0; play(name, prev === actions.walk || prev === actions.run ? 0.3 : 0.25); a.time = ph * a.getClip().duration; }
  a.timeScale = THREE.MathUtils.clamp(speed / (STRIDES[name] || STRIDE), 0.6, STRIDE_MAX_TS);
}
function play(name, fade = 0.25) { const a = actions[name]; if (!a || current === a) return; a.reset().fadeIn(fade).play(); if (current) current.fadeOut(fade); current = a; }
const catURL = Q.get('cat') || 'assets/moonkatty.glb';
// walk-cycle stride speed: how fast a planted foot travels backwards (m/s at timeScale 1), measured from the clip itself so
// walk playback = actualSpeed / STRIDE keeps feet planted (re-measured automatically whenever the cat glb changes)
let STRIDE = 0.8; const STRIDES = {}; const STRIDE_MAX_TS = 3.5;
function measureStride(model, clip) {
  if (!clip) return STRIDE; const feet = ['foot_L', 'foot_R'].map(n => model.getObjectByName(n)).filter(Boolean); if (!feet.length) return STRIDE;
  const mx = new THREE.AnimationMixer(model), act = mx.clipAction(clip).play(); const N = 96, D = clip.duration, inv = new THREE.Matrix4(), v = new THREE.Vector3();
  const S = feet.map(() => []); for (let i = 0; i <= N; i++) { mx.setTime(i / N * D); model.updateMatrixWorld(true); inv.copy(model.matrixWorld).invert(); feet.forEach((f, k) => S[k].push(f.getWorldPosition(v).applyMatrix4(inv).clone().applyMatrix4(model.matrix))); }
  act.stop(); mx.uncacheRoot(model);
  const vs = []; for (const P of S) { const mn = Math.min(...P.map(p => p.y)); const tol = Math.max(0.012, (Math.max(...P.map(p => p.y)) - mn) * 0.12); for (let i = 0; i < N; i++) if (P[i].y < mn + tol && P[i + 1].y < mn + tol) vs.push(-(P[i + 1].z - P[i].z) / (D / N)); }
  const st = vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : 0; (window.__stride ||= {})[clip.name] = { stride: +st.toFixed(3), dur: +D.toFixed(3), samples: vs.length };
  return st > 0.2 && st < 4 ? st : STRIDE;
}
const catPromise = new GLTFLoader().loadAsync(catURL + '?v=' + ASSET_V, (e) => { if (e && e.total) loadMsg(e.loaded / e.total); }).then(gltf => {
  const m = gltf.scene; m.traverse(o => { if (o.isMesh) { o.castShadow = !(MOBILE ? /Eye|Glow|Dome|Glint|Outline|Whisker|Flame/i : /Eye|Glow|Dome|Glint|Outline/i).test(Array.isArray(o.material) ? '' : o.material.name); o.receiveShadow = true; o.frustumCulled = false; const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const mt of ms) { if (mt.transmission > 0) { mt.transmission = 0; mt.transparent = true; mt.opacity = Math.min(mt.opacity, 0.35); mt.depthWrite = false; } /* transmission would re-render the whole opaque scene every frame */ if (mt.isMeshStandardMaterial) { mt.envMap = env; mt.envMapIntensity = /gold/i.test(mt.name) ? 1.6 : 0.6; } if (/Face|Fur|Eye/i.test(mt.name) && mt.isMeshStandardMaterial) { /* cat-only warm fill: face reads bright orange inside the dome even with the sun behind (no scene light added) */ if (mt.map) mt.emissiveMap = mt.map; mt.emissive = new THREE.Color(/Eye/i.test(mt.name) ? '#8a8a8a' : '#ffc89a'); mt.emissiveIntensity = /Eye/i.test(mt.name) ? 0.3 : 0.42; mt.needsUpdate = true; } if (/^MK_Dome$/i.test(mt.name)) { /* clear glass: weaker env/spec glare so the face reads through the helmet */ mt.opacity = 0.16; mt.envMapIntensity = 0.3; if ('specularIntensity' in mt) mt.specularIntensity = 0.5; if ('clearcoat' in mt) mt.clearcoat = 0; mt.needsUpdate = true; } if (/DomeGlint/i.test(mt.name)) mt.opacity = 0.22; if (/Fur/i.test(mt.name)) mt.emissiveIntensity = 0.3; } } });
  catRoot.add(m); m.traverse(o => { if (!headBone && /^head$/i.test(o.name)) headBone = o; }); if (!headBone) m.traverse(o => { if (!headBone && /head/i.test(o.name) && !o.isMesh) headBone = o; });
  if (gltf.animations.length) { mixer = new THREE.AnimationMixer(m); for (const c of gltf.animations) actions[c.name] = mixer.clipAction(c); STRIDE = measureStride(m, gltf.animations.find(c => c.name === 'walk')); STRIDES.walk = STRIDE; { const rc = gltf.animations.find(c => c.name === 'run'); if (rc) STRIDES.run = measureStride(m, rc); } play('idle', 0); }
  return gltf;
}).catch(err => { console.warn('cat glb missing, using placeholder', err); const ph = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 0.9, 4, 12), mats.ivory); ph.position.y = 0.85; ph.castShadow = true; catRoot.add(ph); });

// ---------- views ----------
const VIEWS = {
  concept: () => { lookTarget = new THREE.Vector3(...(() => { const p = sd(45, -48); return [p.x, 2, p.z]; })()); const K = CONCEPT; ctrl.place(K.cat.x, K.cat.z, Math.atan2(F.x, F.z) + K.catYaw); const gy = groundAt(K.cat.x, K.cat.z); camera.position.set(K.cam.x, gy + K.eye, K.cam.z); camera.lookAt(K.target.x, gy + K.eye - K.drop, K.target.z); camera.fov = K.fov; ctrl.camFree = false; },
  ...Object.fromEntries([['reactor', 70, 80, 13], ['reactor2', 44, 53, 3.2]].map(([k, dc, dcam, up]) => [k, () => { lookTarget = null; const R = REGIONS.reactor; const ah = Math.atan2(-R.z, -R.x) + 0.35; const cx = R.x + Math.cos(ah) * dc, cz = R.z + Math.sin(ah) * dc; ctrl.place(cx, cz, Math.atan2(-Math.cos(ah), -Math.sin(ah))); const px = R.x + Math.cos(ah + 0.06) * dcam, pz = R.z + Math.sin(ah + 0.06) * dcam; camera.position.set(px, groundAt(px, pz) + up, pz); camera.lookAt(R.x, groundAt(R.x, R.z) + (k === 'reactor' ? 4 : 8), R.z); camera.fov = 55; ctrl.camFree = false; }])), // reactor crater QA shots: rim overlook + floor level
  ark: () => { lookTarget = null; const L = REGIONS.launch; const px = L.x + 60, pz = L.z + 95; ctrl.place(px + 4, pz - 6, 0); camera.position.set(px, groundAt(px, pz) + 4, pz); camera.lookAt(2300, 2050, -2500); camera.fov = 34; ctrl.camFree = false; },
  belt: () => { lookTarget = null; const px = -230, pz = 170; ctrl.place(px + 3, pz + 4, 0); camera.position.set(px, groundAt(px, pz) + 6, pz); camera.lookAt(-2400, 2400, 3300); camera.fov = 70; ctrl.camFree = false; },
  canyon: () => { lookTarget = null; const s0 = canyonS(REGIONS.canyon.x, REGIONS.canyon.z); const c = canyonPoint(s0 - 62, 0), t = canyonPoint(s0 - 40, 0); ctrl.place(c.x, c.z, Math.atan2(t.x - c.x, t.z - c.z)); const e = canyonPoint(s0 - 92, -3), l = canyonPoint(s0 + 25, 0); camera.position.set(e.x, groundAt(e.x, e.z) + 14, e.z); camera.lookAt(l.x, groundAt(l.x, l.z) + 3, l.z); camera.fov = 58; ctrl.camFree = false; },
  launch: () => { lookTarget = null; const L = REGIONS.launch; const c = { x: L.x - 52, z: L.z + 38 }; ctrl.place(c.x, c.z, Math.atan2(L.x - c.x, L.z - c.z)); camera.position.set(L.x - 92, groundAt(L.x - 92, L.z + 66) + 16, L.z + 66); camera.lookAt(L.x + 4, groundAt(L.x, L.z) + 22, L.z - 4); camera.fov = 55; ctrl.camFree = false; },
  launch2: () => { lookTarget = null; const L = REGIONS.launch; const c = { x: L.x + Math.cos(4.2) * 84, z: L.z + Math.sin(4.2) * 84 }; ctrl.place(c.x, c.z, Math.atan2(L.x - c.x, L.z - c.z)); const ca = 275 * Math.PI / 180; const px = L.x + Math.cos(ca) * 98, pz = L.z + Math.sin(ca) * 98; camera.position.set(px, groundAt(px, pz) + 12, pz); camera.lookAt(L.x, groundAt(L.x, L.z) + 15, L.z); camera.fov = 55; ctrl.camFree = false; },
  echo2: () => { lookTarget = null; const E = REGIONS.echo; const a0 = 292 * Math.PI / 180; const px = E.x + Math.cos(a0) * 30, pz = E.z + Math.sin(a0) * 30; const la = 290 * Math.PI / 180; const lx = E.x + Math.cos(la) * 100, lz = E.z + Math.sin(la) * 100; ctrl.place(px + 3, pz + 2, Math.atan2(lx - px, lz - pz)); camera.position.set(px, groundAt(px, pz) + 7, pz); camera.lookAt(lx, groundAt(lx, lz) + 3, lz); camera.fov = 60; ctrl.camFree = false; },
  echo: () => { lookTarget = null; const E = REGIONS.echo; const ca = -52 * Math.PI / 180, cb = -44 * Math.PI / 180; const cx = E.x + Math.cos(cb) * 64, cz = E.z + Math.sin(cb) * 64; ctrl.place(cx, cz, Math.atan2(E.x - cx, E.z - cz)); const px = E.x + Math.cos(ca) * 88, pz = E.z + Math.sin(ca) * 88; camera.position.set(px, groundAt(px, pz) + 11, pz); camera.lookAt(E.x + 8, groundAt(E.x, E.z) + 9, E.z + 4); camera.fov = 50; ctrl.camFree = false; }, /* pass 22: composed relay-station shot */
  play: () => { lookTarget = null; const c = PLAY_START; ctrl.place(c.x, c.z, Math.atan2(F.x, F.z) + 0.25); ctrl.camYaw = Math.atan2(-F.x, -F.z) - 0.30; ctrl.camPitch = 0.15; ctrl.camDist = 7; ctrl.camFree = true; camera.fov = 55; },
  aerial: () => { lookTarget = null; const c = sd(-2, -57); ctrl.place(c.x, c.z, Math.atan2(F.x, F.z)); const p = sd(-70, -125); camera.position.set(p.x, 75, p.z); const t = sd(8, 25); camera.lookAt(t.x, -6, t.z); camera.fov = 50; ctrl.camFree = false; },
  world: () => { lookTarget = null; const c = sd(-2, -57); ctrl.place(c.x, c.z, Math.atan2(F.x, F.z)); camera.position.set(-260, 520, 820); camera.lookAt(40, 0, -60); camera.fov = 55; ctrl.camFree = false; },
  cave: () => { lookTarget = null; const c = sd(24, 20); ctrl.place(c.x, c.z, Math.atan2(F.x, F.z)); const p = sd(18, 14); camera.position.set(p.x, groundAt(p.x, p.z) + 7, p.z); const cv = hub.cave; camera.lookAt(cv.x, cv.y + 4, cv.z); camera.fov = 55; ctrl.camFree = false; },
  base: () => { lookTarget = null; const c = sd(16, -28); ctrl.place(c.x, c.z, Math.atan2(F.x, F.z) - 0.4); const p = sd(36, -60); camera.position.set(p.x, 34, p.z); const t = sd(0, 10); camera.lookAt(t.x, 2, t.z); camera.fov = 50; ctrl.camFree = false; },
};
(VIEWS[VIEW] || VIEWS.play)(); camera.updateProjectionMatrix();

// ---------- post ----------
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }));
composer.addPass(new RenderPass(scene, camera));
let bloom = null; if (BLOOM) { bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.52, 0.36, 2.0); composer.addPass(bloom); { const hm = bloom.materialHighPassFilter; hm.fragmentShader = hm.fragmentShader.replace('vec4 texel = texture2D( tDiffuse, vUv );', 'vec4 texel = texture2D( tDiffuse, vUv ); if ( !all( lessThan( abs( texel ), vec4( 6.0e4 ) ) ) ) texel = vec4( 0.0 );'); hm.needsUpdate = true; } if (MOBILE) { bloom.nMips = 3; const T = bloom.compositeMaterial.uniforms.bloomTintColors.value; T[3].set(0, 0, 0); T[4].set(0, 0, 0); bloom.compositeMaterial.uniforms.bloomFactors.value = [1.0, 0.9, 0.85, 0, 0]; } } // phones: 3 bloom mips (4 fewer blur passes)
composer.addPass(new OutputPass());
const grade = new ShaderPass({ uniforms: { tDiffuse: { value: null }, uVig: { value: 0.3 } }, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uVig; varying vec2 vUv;
    void main(){ vec4 t = texture2D(tDiffuse, vUv); vec3 c = t.rgb; float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(c, c * vec3(0.95, 0.98, 1.06), (1.0 - smoothstep(0.0, 0.5, l)) * 0.7); // pass 41 grade (concept): cool neutral shadows/rock
      { float s0 = max(max(c.r, c.g), c.b) - min(min(c.r, c.g), c.b); float ws = smoothstep(0.12, 0.3, s0) * step(c.b, c.r);
        c += vec3(0.045, 0.02, -0.025) * smoothstep(0.45, 1.0, l) * ws; // warm highlights only on already-warm colours (cat fur, lights, gold); greys stay neutral
        c = mix(vec3(l), c, mix(0.94, 0.8, smoothstep(0.12, 0.4, s0) * (1.0 - smoothstep(0.35, 0.6, s0)))); } // tame mid-saturation ivory/beige cast, keep vivid colours
      c = mix(c, c * c * (3.0 - 2.0 * c), 0.42); // stronger S-curve: deep crevices, bright sunlit faces
      c += vec3(0.0, 0.002, 0.008) * (1.0 - smoothstep(0.0, 0.08, l)); // faint blue in the black sky
      vec2 d = vUv - 0.5; d.x *= 1.15; c *= 1.0 - uVig * smoothstep(0.3, 0.85, length(d) * 1.25);
      gl_FragColor = vec4(c, t.a); }` });
composer.addPass(grade);
const fxaa = new ShaderPass(FXAAShader); composer.addPass(fxaa);
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h); composer.setPixelRatio(PR); composer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); fxaa.material.uniforms.resolution.value.set(1 / (w * PR), 1 / (h * PR)); }
addEventListener('resize', resize); resize();

// ---------- HUD ----------
const joy = document.getElementById('joy');
ctrl.bindTouch(joy, document.getElementById('knob'), document.getElementById('jump'));
document.getElementById('jump').addEventListener('pointerdown', () => TGAPI.haptic.impact('light'));
const fuelEl = document.getElementById('fuel');
document.getElementById('views').addEventListener('click', e => { const v = e.target.dataset.v; if (v) { (VIEWS[v])(); camera.updateProjectionMatrix(); if (v === 'concept' || v === 'aerial' || v === 'base') setTimeout(() => { }, 0); } });
addEventListener('keydown', e => { if (e.code === 'KeyC') { VIEWS.concept(); camera.updateProjectionMatrix(); } if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code) && !ctrl.camFree) { ctrl.camFree = true; ctrl.camYaw = ctrl.yaw + Math.PI; camera.fov = 55; camera.updateProjectionMatrix(); } });
renderer.domElement.addEventListener('pointerdown', () => { if (!ctrl.camFree && !SHOT) { ctrl.camFree = true; ctrl.camYaw = Math.atan2(camera.position.x - ctrl.pos.x, camera.position.z - ctrl.pos.z); } });

// ---------- game layer (stage 1: progression + Chapter 1 quests). Off in ?shot renders unless &game=1 ----------
// base power (game hook: in a new game the reactor flickers out; restoring it lights the base back up). 1 = normal look.
const POW = { level: 1, red: 0, flick: 1 };
const setPower = (lv, red = 0) => { POW.level = lv; POW.red = red; };
const applyPower = (t) => { const fl = POW.level < 1 ? (Math.random() < 0.06 ? 0.25 : 1) * (0.85 + 0.15 * Math.sin(t * 23)) : 1; const red = POW.level < 1 ? POW.red : 0; const k = POW.level >= 1 ? 1 : (red ? 0.05 + 0.2 * Math.pow(Math.abs(Math.sin(t * 2.2)), 6) : (0.03 + 0.82 * POW.level) * fl); /* power out: windows dark, slow red emergency pulse */
  for (const m of [mats.hull, mats.lattice]) { m.emissive.setRGB(1, 1 - 0.8 * red, 1 - 0.85 * red); m.emissiveIntensity = EMISSIVE_INTENSITY * k * (red ? 2.2 : 1); } LAMPK.value = red ? 0.02 : k; mats.beam.uniforms.uPow.value = k;
  coreLight.color.setRGB(1, 0.6 - 0.45 * POW.red, 0.25 - 0.2 * POW.red); coreLight.intensity = (55 + Math.sin(t * 2.3) * 8) * (POW.level >= 1 ? 1 : (0.35 + 0.65 * POW.level) * (POW.red ? 0.6 + 0.4 * Math.abs(Math.sin(t * 5.5)) : 1)); };
const game = (!SHOT || Q.has('game')) ? (() => { const cs0 = canyonS(REGIONS.canyon.x, REGIONS.canyon.z); const L = REGIONS.launch, hl = Math.hypot(L.x, L.z); const lu = { x: L.x / hl, z: L.z / hl };
  const pad = sd(-9.5, -16), dsh = sd(-14, 12), st = PLAY_START; const dd = Math.hypot(st.x - dsh.x, st.z - dsh.z);
  const free = (p, r) => { const f = solids.nearestFree(p.x, p.z, r); return { x: f.x, z: f.z }; }; // markers / pickups never sit inside a rock or prop
  const cp = (ds, o = 0) => canyonPoint(cs0 + ds, o); const ctan = (ds) => { const a = cp(ds - 1), b = cp(ds + 1), l = Math.hypot(b.x - a.x, b.z - a.z); return { x: (b.x - a.x) / l, z: (b.z - a.z) / l }; };
  // canyon floor half-width at s: walk sideways until the ground climbs > 2.6 m above the centre line
  const floorHalf = (ds) => { const c = cp(ds), t = ctan(ds), g0 = groundAt(c.x, c.z); let lo = 0, hi = 0; for (let o = 0; o < 40; o += 0.5) { if (groundAt(c.x - t.z * o, c.z + t.x * o) - g0 > 2.6) break; hi = o; } for (let o = 0; o < 40; o += 0.5) { if (groundAt(c.x + t.z * o, c.z - t.x * o) - g0 > 2.6) break; lo = o; } return { lo, hi }; };
  const crackBest = (d0, d1, w) => { let best = null; for (let ds = d0; ds <= d1; ds += 1) { const c = crackAt(ds, w); let ob = 0; for (let u = -w / 2 - 4; u <= w / 2 + 4; u += 1) for (let vv = -c.len / 2 + 2; vv <= c.len / 2 - 2; vv += 1.5) { const x = c.x + c.tx * u - c.tz * vv, z = c.z + c.tz * u + c.tx * vv; const g = groundAt(x, z); if (solids.top(x, z, 0.45) > g + 0.35 || solids.over(x, z, 0.45) < g + 7) ob++; }
      const sl = Math.abs(groundAt(c.x + c.tx * 6, c.z + c.tz * 6) - groundAt(c.x - c.tx * 6, c.z - c.tz * 6)); const sc = ob * 1.5 + sl * 2; if (!best || sc < best.sc) best = { ...c, sc, ob, sl }; } return best; }; // flat, rock-free stretch of floor
  const crackAt = (ds, w) => { const h = floorHalf(ds), c = cp(ds), t = ctan(ds); const mid = (h.hi - h.lo) / 2; return { x: c.x - t.z * mid, z: c.z + t.x * mid, tx: t.x, tz: t.z, w, len: (h.hi + h.lo) + 3, region: 'canyon' }; };
  // launch complex: boost-sprint course on an arc around the pad (ring spots pushed to free ground)
  const lg = free({ x: L.x - lu.x * 78, z: L.z - lu.z * 78 }); const a0 = Math.atan2(lg.z - L.z, lg.x - L.x); const RR = 66;
  const sprintStart = free({ x: L.x + Math.cos(a0 + 0.16) * RR, z: L.z + Math.sin(a0 + 0.16) * RR });
  const rings = []; for (let i = 0; i < 8; i++) { const a = a0 + 0.36 + i * 0.3; const p = free({ x: L.x + Math.cos(a) * (RR + Math.sin(i * 1.7) * 6), z: L.z + Math.sin(a) * (RR + Math.sin(i * 1.7) * 6) }, 20); rings.push(p); }
  rings.forEach((r, i) => { const n = rings[Math.min(i + 1, rings.length - 1)], pv = rings[Math.max(i - 1, 0)]; r.yaw = Math.atan2(n.x - pv.x, n.z - pv.z); });
  const sc = { x: (rings[3].x + rings[4].x) / 2, z: (rings[3].z + rings[4].z) / 2 }; const sl = Math.hypot(rings[4].x - rings[3].x, rings[4].z - rings[3].z);
  const sprintCrack = { x: sc.x, z: sc.z, tx: (rings[4].x - rings[3].x) / sl, tz: (rings[4].z - rings[3].z) / sl, w: 5.5, len: 16, region: 'launch' };
  // secret caches (off the main route): behind a hub boulder, lookout ledge (JET), portal cave mouth, canyon rock terrace (JET), launch complex, echo field
  const hubRock = (() => { let b = null; for (const it of rocks.kinds.rockA.items) { const d = Math.hypot(it.x, it.z); if (d > 38 && d < 95 && it.r > 1.6 && it.r < 5 && (!b || it.r > b.r)) b = it; } return b; })();
  const behind = hubRock ? free({ x: hubRock.x + hubRock.x / Math.hypot(hubRock.x, hubRock.z) * (hubRock.r + 1.1), z: hubRock.z + hubRock.z / Math.hypot(hubRock.x, hubRock.z) * (hubRock.r + 1.1) }) : free(sd(-30, 20));
  const terrace = (() => { const c = cp(-18); let b = null; for (const it of rocks.kinds.rockA.items) { if (Math.hypot(it.x - c.x, it.z - c.z) > 75) continue; const h = solids.top(it.x, it.z, 0.6) - groundAt(it.x, it.z); if (h > 2.4 && h < 7 && Math.abs(solids.top(it.x, it.z, 0.9) - solids.top(it.x, it.z, 0.3)) < 0.6 && (!b || Math.abs(h - 4) < Math.abs(b.h - 4))) b = { x: it.x, z: it.z, h }; } return b ? { x: b.x, z: b.z, y: solids.top(b.x, b.z, 0.5) } : { ...free(cp(-30, 12)) }; })();
  const cave = hub.cave; const caveP = free({ x: cave.x + Math.sin(cave.yaw) * 4.2 + Math.cos(cave.yaw) * 4.0, z: cave.z + Math.cos(cave.yaw) * 4.2 - Math.sin(cave.yaw) * 4.0 });
  const E = REGIONS.echo;
  const ledgeY = solids.standAt(LEDGE.x, LEDGE.z);
  const depot = free(sd(-19, -22), 12);
  const cy0 = Math.atan2(-F.x, -F.z) - 0.30, fwd = { x: -Math.sin(cy0), z: -Math.cos(cy0) }; // play-view camera forward at spawn
  const layout = {
    power: [free({ x: st.x + fwd.x * 6.5, z: st.z + fwd.z * 6.5 }), free(sd(9, -12.5)), free(sd(-12.5, -5))], // hook: first crystal ~6.5 m straight ahead of the spawn camera
    gates: { hub: free(sd(5, -25)), canyon: free(cp(-74, 0)), launch: lg },
    regions: { hub: { x: 0, z: 0 }, canyon: cp(-10), launch: { x: L.x, z: L.z } },
    cracks: [crackBest(-41, -32, 6.5), crackBest(11, 18, 6.5), sprintCrack],
    ore: [cp(-25, 8), cp(-11, -9), cp(-5, 7)].map(p => free(p)),
    parts: [free(cp(36, 3)), free(cp(-62, -9)), free(cp(28, -10))],
    meteor: { ...cp(36, 0), r: 15 },
    rings, sprintStart,
    secrets: [{ id: 'ledge', x: LEDGE.x, z: LEDGE.z, y: ledgeY }, { id: 'hub', ...behind }, { id: 'cave', ...caveP, yaw: cave.yaw }, { id: 'canyon', ...terrace }, { id: 'launch', ...free({ x: L.x + lu.z * 46, z: L.z - lu.x * 46 }) }, { id: 'echo', ...free({ x: E.x + 18, z: E.z - 14 }) }],
    depot: { ...depot, yaw: Math.atan2(pad.x - depot.x, pad.z - depot.z) }, robotSpawn: free({ x: pad.x + (depot.x - pad.x) * 0.25, z: pad.z + (depot.z - pad.z) * 0.25 }),
  };
  const places = Object.fromEntries(Object.entries({ canyonPad: cp(-18, -1), reactorConsole: sd(0, -10.6), dish: { x: dsh.x + (st.x - dsh.x) / dd * 7.2, z: dsh.z + (st.z - dsh.z) / dd * 7.2 }, launchPad: { x: L.x - L.x / hl * 34, z: L.z - L.z / hl * 34 }, ledge: { x: LEDGE.x, z: LEDGE.z }, homePad: pad, sprintStart }).map(([k, p]) => [k, free(p)]));
  window.__gamePlaces = places; window.__gameLayout = layout;
  return createGame({ scene, camera, ctrl, renderer, env, solids, setPower, groundAt: solids.standAt, visAt: solids.visAt, Q, places, layout,
    crystalSpots: [...[[-46, 4], [-36, -5], [-27, 4], [6, -4.5], [15, 4.5], [25, -3]].map(([ds, o]) => canyonPoint(cs0 - 18 + ds, o)), sd(-8, -31), sd(7, -27), sd(-20, -6), sd(17, -15)].map(p => free(p)) }); })() : null;
const prints = makeFootprints(scene, groundAt);
// soft contact (blob) shadows under the cat and the builder robot: 1 instanced draw, radial alpha, no depth write
const contact = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,0.85)'); gr.addColorStop(0.45, 'rgba(0,0,0,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const mat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, opacity: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, fog: true });
  const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2); const im = new THREE.InstancedMesh(geo, mat, 2); im.name = 'contact_shadows'; im.frustumCulled = false; im.renderOrder = 1; scene.add(im);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sv = new THREE.Vector3(), pv = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), n = new THREE.Vector3(); let robot = null;
  const set = (i, x, y, z, s) => { const e = 0.35; n.set(groundAt(x - e, z) - groundAt(x + e, z), 2 * e, groundAt(x, z - e) - groundAt(x, z + e)).normalize(); q.setFromUnitVectors(up, n); m.compose(pv.set(x, y + 0.03, z), q, sv.set(s, 1, s)); im.setMatrixAt(i, m); };
  return { update(p, air) { const k = Math.max(0, 1 - air / 2.5); set(0, p.x, air > 0 ? solids.visAt(p.x, p.z) : p.y, p.z, k > 0 ? 0.95 * (0.6 + 0.4 * k) : 0);
    robot ??= scene.getObjectByName('game_robot'); if (robot && robot.visible) set(1, robot.position.x, robot.position.y, robot.position.z, 1.25); else { m.makeScale(0, 0, 0); im.setMatrixAt(1, m); } im.instanceMatrix.needsUpdate = true; } }; })(); // boot-print ring buffer (1 call, hidden until walking)
// ---------- loop ----------
const clock = new THREE.Clock(); let t = 0; const ftimes = [];
function frame(dt) {
  t += dt;
  if (!SHOT) ctrl.update(dt); else { ctrl.pos.y = ctrl.floorAt(ctrl.pos.x, ctrl.pos.z); if (ctrl.camFree) { ctrl.camTarget.copy(ctrl.pos).add(new THREE.Vector3(0, 1.3, 0)); ctrl.updateCamera(1); } }
  if (game) game.update(dt);
  catRoot.position.copy(ctrl.pos); catRoot.rotation.y = ctrl.yaw;
  { // visual feet: the physics capsule stands on the highest solid within its 0.36 m radius (so it hovers over rock flanks); drop the model onto the solid right under it
    const st = solids.standAt(ctrl.pos.x, ctrl.pos.z); const want = ctrl.onGround && Math.abs(ctrl.pos.y - st) < 0.03 ? st - solids.visAt(ctrl.pos.x, ctrl.pos.z) : 0;
    frame.vOff = (frame.vOff || 0) + (want - (frame.vOff || 0)) * Math.min(1, dt * 14); catRoot.position.y -= frame.vOff; }
  contact.update(catRoot.position, ctrl.onGround ? 0 : ctrl.pos.y - solids.visAt(ctrl.pos.x, ctrl.pos.z));
  prints.update(ctrl.pos, ctrl.yaw, ctrl.onGround, ctrl.speed);
  if (headBone && headBone.userData.pre) headBone.quaternion.copy(headBone.userData.pre);
  if (mixer) { if (!ctrl.onGround) play(actions.jump ? 'jump' : 'idle', 0.15); else if (ctrl.speed > 0.6) locomotion(ctrl.speed); else play('idle'); mixer.update(dt); }
  headLook(SHOT ? 1 : dt);
  flame.visible = ctrl.thrusting; if (flame.visible) flame.scale.y = 0.8 + Math.random() * 0.5;
  crystals.update(t); mats.beam.uniforms.uTime.value = t; sky.starMat.uniforms.uTime.value = t; sky.earthMat.uniforms.uTime.value = t;
  sky.group.position.copy(camera.position);
  cullFarRegions(); camera.updateMatrixWorld(); space.updateBelt(camera, Math.hypot(camera.position.x, camera.position.z) < 280 && camera.position.y < 70);
  space.group.rotation.y = t * 0.002; space.beltU.value = t;
  // shadow frustum follows the focus point
  const focus = window.__focus || (ctrl.camFree ? ctrl.pos : (VIEW === 'aerial' || VIEW === 'world' ? new THREE.Vector3(sd(0, 5).x, 0, sd(0, 5).z) : new THREE.Vector3(sd(0, -20).x, 0, sd(0, -20).z))); // __focus: QA hook (flicker test)
  { // texel-snapped shadow frustum: move the light camera only by whole shadow-map texels in light space (no shimmering / blinking shadow squares while walking)
    const L = (frame.sL ??= (() => { const z = sunDir.clone(), x = new THREE.Vector3(0, 1, 0).cross(z).normalize(), y = z.clone().cross(x); return { x, y, t: (sc.right - sc.left) / sun.shadow.mapSize.x }; })());
    const f = new THREE.Vector3(focus.x, 0, focus.z); const px = f.dot(L.x), py = f.dot(L.y); f.addScaledVector(L.x, Math.round(px / L.t) * L.t - px).addScaledVector(L.y, Math.round(py / L.t) * L.t - py);
    sun.target.position.copy(f); sun.position.copy(f).addScaledVector(sunDir, 200); }
  applyPower(t);
  fuelEl.style.width = (ctrl.fuel * 100).toFixed(0) + '%';
  culler.update(camera);
  composer.render(dt);
}
// paused (app hidden / Telegram deactivated): stop rendering entirely; resume resets the clock so dt does not jump
let paused = false, looping = false;
TGAPI.onPause((p) => { paused = p; if (p) { ctrl.keys.clear(); ctrl.joy.set(0, 0); ctrl.jumpHeld = false; } else if (MK.ready && !looping && !SHOT) { clock.getDelta(); looping = true; requestAnimationFrame(loop); } });
function loop() { if (paused) { looping = false; return; } looping = true; const dt = Math.min(clock.getDelta(), 0.05); const t0 = performance.now(); frame(dt); ftimes.push(performance.now() - t0); if (ftimes.length > 240) ftimes.shift(); requestAnimationFrame(loop); }

// test / screenshot API
window.MK = { isPaused: () => paused, terrain: TERRAIN_MOD, setPower, POW, THREE, composer, bloom, camera, scene, sky, renderer, env, solids, ctrl, rocks, colliders, VIEWS: Object.keys(VIEWS), head: () => headBone && [headBone.name, headBone.type, +headYaw.toFixed(2)],
  ready: false, game: game && game.api,
  anim: () => ({ mixer, actions, STRIDES, locomotion, current: current && current.getClip().name }), // test hook (walk/run blending)
  setView(v) { VIEWS[v](); camera.updateProjectionMatrix(); },
  renderOnce(dt = 1 / 60) { frame(dt); },
  stats() {
    const info = renderer.info; info.autoReset = false; const sm = renderer.shadowMap;
    sm.autoUpdate = false; sm.needsUpdate = false; info.reset(); renderer.render(scene, camera); const main = { calls: info.render.calls, triangles: info.render.triangles };
    sm.needsUpdate = true; info.reset(); renderer.render(scene, camera); const withShadow = { calls: info.render.calls, triangles: info.render.triangles };
    sm.autoUpdate = true; info.reset(); composer.render(0); const frameAll = { calls: info.render.calls, triangles: info.render.triangles };
    info.autoReset = true;
    culler.update(camera, true); const per = []; scene.traverse(o => { if ((o.isMesh || o.isPoints) && o.visible && o.geometry) { const g = o.geometry; const n = (g.index ? g.index.count : g.attributes.position.count) / (o.isPoints ? 1 : 3) * (o.isInstancedMesh ? o.count : 1); per.push([o.name || o.type, Math.round(n)]); } });
    per.sort((x, y) => y[1] - x[1]);
    return { culler: culler.stats(), rocks: rocks.counts, mainPass: main, mainPlusShadowPass: withShadow, wholeFrameInclPost: frameAll, top: per.slice(0, +(window.TOPN || 14)) };
  },
  ctrlState() { return { pos: ctrl.pos.toArray().map(v => +v.toFixed(2)), onGround: ctrl.onGround, fuel: +ctrl.fuel.toFixed(2), anim: current ? current.getClip().name : null, thrust: ctrl.thrusting, walkTS: actions.walk ? +actions.walk.timeScale.toFixed(2) : null }; },
  frameTimes() { const a = [...ftimes].sort((x, y) => x - y); return { n: a.length, avg: a.reduce((s, x) => s + x, 0) / a.length, p50: a[Math.floor(a.length / 2)], p95: a[Math.floor(a.length * 0.95)] }; },
  async measure(n = 30) { const out = []; for (let i = 0; i < n; i++) { const t0 = performance.now(); frame(1 / 60); { const gl = renderer.getContext(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)); } out.push(performance.now() - t0); await new Promise(r => setTimeout(r, 0)); } out.sort((a, b) => a - b); return { n, p50: out[n >> 1], avg: out.reduce((s, x) => s + x, 0) / n, min: out[0], max: out[n - 1] }; },
};
catPromise.finally(() => { if (SHOT) { for (let i = 0; i < 3; i++) frame(1 / 60); MK.ready = true; } else { try { renderer.compile(scene, camera); } catch (e) { } MK.ready = true; if (!paused) loop(); } /* precompile all materials: no multi-second shader hitch on the first played frames */ document.getElementById('loading').style.display = 'none'; });
