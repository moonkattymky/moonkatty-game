import * as THREE from 'three';
import { mergeGeometries } from '../../vendor/three/jsm/utils/BufferGeometryUtils.js';
// ============================================================================================
// Chapter 2 finale "Night meteor storm" (concept fa97fd4b): night falls, the cat presses the glowing cyan paw button on a
// console, a translucent cyan HEX energy dome expands over the whole base (hex grid + fresnel rim, additive, expanding
// reveal), meteors with fiery orange trails rain down and burst into sparks on the dome with a ripple running across the
// hex cells; robots weld damaged generator panels with blue sparks while the cat helps repair them.
// Draws: dome 1, meteor trails 1 (instanced billboards), sparks 1 (points), console 2.
// ============================================================================================
const HEX = `
float hexD(vec2 p){ p = abs(p); return max(dot(p, vec2(0.5, 0.8660254)), p.x); }
vec4 hexC(vec2 uv){ vec2 r = vec2(1.0, 1.7320508), h = r * 0.5; vec2 a = mod(uv, r) - h, b = mod(uv - h, r) - h; vec2 g = dot(a, a) < dot(b, b) ? a : b; return vec4(g, uv - g); }`;
function pawTexture() { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); const gr = g.createRadialGradient(128, 128, 20, 128, 128, 128); gr.addColorStop(0, '#9ff4ff'); gr.addColorStop(0.55, '#2cc8ff'); gr.addColorStop(0.8, '#0a6fb0'); gr.addColorStop(0.92, '#bff8ff'); gr.addColorStop(1, '#0a3050'); g.fillStyle = gr; g.beginPath(); g.arc(128, 128, 126, 0, 7); g.fill();
  g.fillStyle = '#e8feff'; g.shadowColor = '#ffffff'; g.shadowBlur = 16; g.beginPath(); g.ellipse(128, 150, 38, 30, 0, 0, 7); g.fill(); for (const [x, y, r] of [[82, 102, 15], [108, 80, 16], [148, 80, 16], [174, 102, 15]]) { g.beginPath(); g.ellipse(x, y, r, r * 1.2, 0, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
function streakTexture() { const W = 32, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); const im = g.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = y / (H - 1), u = Math.abs(x / (W - 1) - 0.5) * 2; const head = Math.exp(-Math.pow((v - 0.06) / 0.05, 2)) * Math.exp(-u * u * 3); const tail = Math.pow(1 - v, 1.6) * Math.exp(-u * u * (6 + v * 10)); const i = (y * W + x) * 4; const a = Math.min(1, head * 1.4 + tail);
    im.data[i] = 255; im.data[i + 1] = Math.round(255 * Math.min(1, 0.35 + head * 0.9 + (1 - v) * 0.3)); im.data[i + 2] = Math.round(255 * Math.min(1, head * 0.8 + 0.05)); im.data[i + 3] = Math.round(255 * a); }
  g.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(c); return t; }

export function makeShield(scene, { center, R, groundAt, consoleP, low = false, mobile = false, env }) {
  const NM = low ? 7 : mobile ? 12 : 18, NS = low ? 120 : mobile ? 220 : 360, HY = 0.62; // flattening of the dome (concept: low wide dome)
  const root = new THREE.Group(); root.name = 'ch2_shield'; scene.add(root);
  const cy = groundAt(center.x, center.z) - 2.0;
  // ---- dome ----
  const hits = Array.from({ length: 6 }, () => new THREE.Vector4(0, -999, 0, -99));
  const U = { uTime: { value: 0 }, uReveal: { value: 0 }, uAlpha: { value: 1 }, uHits: { value: hits }, uR: { value: R } };
  const dm = new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, toneMapped: false, // premultiplied: tints what's behind cyan instead of washing it white
    vertexShader: `varying vec3 vP; varying vec3 vN; varying vec3 vW; void main(){ vP = position; vN = normalize(normalMatrix * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime, uReveal, uAlpha, uR; uniform vec4 uHits[6]; varying vec3 vP; varying vec3 vN; varying vec3 vW; ${HEX}
    void main(){
      vec3 n = normalize(vP); float lat = asin(clamp(n.y, -1.0, 1.0));
      // reveal: grows from the ground ring up to the apex, bright leading edge
      float h = lat / 1.5708; float edge = uReveal * 1.15 - h; if (edge < 0.0) discard;
      float lead = exp(-edge * 18.0) * step(uReveal, 0.999);
      // hex grid: side projection (azimuth x height) blended into a top projection near the apex
      float cell = 0.34; vec2 uvS = vec2(atan(n.z, n.x) * uR * 0.159 * 6.2832 / 3.1, lat * uR / 3.1) ; vec2 uvT = vP.xz / 3.1; float wt = smoothstep(0.62, 0.82, n.y);
      vec4 a = hexC(uvS), b = hexC(uvT); float ea = 0.5 - hexD(a.xy), eb = 0.5 - hexD(b.xy); float e = mix(ea, eb, wt); vec2 id = mix(a.zw, b.zw, wt);
      float line = 1.0 - smoothstep(0.0, 0.03, e); float glowL = exp(-e * 14.0);
      float fres = pow(1.0 - abs(dot(normalize(vN), vec3(0.0, 0.0, 1.0))), 2.2);
      float flick = 0.85 + 0.15 * sin(uTime * 2.0 + dot(id, vec2(1.7, 2.3)));
      // impact ripples: a ring running across the cells + a flash at the hit
      float rip = 0.0, fl = 0.0; for (int i = 0; i < 6; i++) { vec4 H = uHits[i]; float age = uTime - H.w; if (age < 0.0 || age > 3.0) continue; float d = distance(vW, H.xyz); rip += exp(-pow((d - age * 16.0) / 2.6, 2.0)) * exp(-age * 1.0) * 2.0; fl += exp(-d * 0.9) * exp(-age * 6.0) * 1.2; }
      vec3 lineC = vec3(0.03, 0.65, 1.0), tint = vec3(0.003, 0.144, 0.35);
      float lineK = (1.0 - smoothstep(0.0, 0.022, e)); float edgeK = 1.0 - smoothstep(0.0, 0.008, e);
      vec3 col = tint * (0.07 + 0.22 * pow(fres, 2.0) + exp(-h * 10.0) * 0.5) + lineC * (lineK * (0.9 + 0.6 * fres) * flick + glowL * 0.08 + edgeK * 0.7 + pow(fres, 5.0) * 0.18 + exp(-h * 12.0) * 0.55 + lead * 1.3 + rip * (0.2 + lineK * 1.1))
        + vec3(0.25, 0.85, 1.0) * edgeK * 0.25 * (0.6 + fres) + vec3(1.2, 0.45, 0.08) * fl * (0.35 + lineK);
      float aT = clamp(0.16 + 0.28 * pow(fres, 2.0) + lineK * 0.35 + exp(-h * 10.0) * 0.2, 0.0, 0.8);
      gl_FragColor = vec4(col * uAlpha, aT * uAlpha);
    }` });
  const dg = new THREE.SphereGeometry(R, low ? 40 : 64, low ? 12 : 20, 0, Math.PI * 2, 0, Math.PI / 2);
  const dome = new THREE.Mesh(dg, dm); dome.name = 'ch2_shield_dome'; dome.position.set(center.x, cy, center.z); dome.scale.set(1, HY, 1); dome.renderOrder = 5; dome.frustumCulled = false; dome.visible = false; root.add(dome);
  // ---- meteor trails: instanced billboards (head + tapered fiery tail) ----
  const qg = new THREE.InstancedBufferGeometry(); qg.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3)); qg.setIndex([0, 1, 2, 0, 2, 3]);
  const iHead = new THREE.InstancedBufferAttribute(new Float32Array(NM * 3), 3), iDir = new THREE.InstancedBufferAttribute(new Float32Array(NM * 4), 4); iHead.setUsage(THREE.DynamicDrawUsage); iDir.setUsage(THREE.DynamicDrawUsage); qg.setAttribute('iHead', iHead); qg.setAttribute('iDir', iDir); qg.instanceCount = NM;
  const mm = new THREE.ShaderMaterial({ uniforms: { uMap: { value: streakTexture() } }, side: THREE.DoubleSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    vertexShader: `attribute vec3 iHead; attribute vec4 iDir; varying vec2 vUv; varying float vOn; void main(){ vec3 d = iDir.xyz; float len = iDir.w; vOn = step(0.01, len); vec3 toCam = normalize(cameraPosition - iHead); vec3 side = normalize(cross(d, toCam)); float w = 0.3 + len * 0.008;
      vec3 p = iHead - d * (position.y - 0.06) * len + side * position.x * w; vUv = vec2(position.x + 0.5, position.y); gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`,
    fragmentShader: `uniform sampler2D uMap; varying vec2 vUv; varying float vOn; void main(){ vec4 c = texture2D(uMap, vUv); if (vOn < 0.5) discard; float hd = exp(-pow((vUv.x - 0.5) * 4.0, 2.0)) * exp(-abs(vUv.y - 0.06) * 26.0); float g = smoothstep(0.04, 0.75, vUv.y); vec3 tc = mix(vec3(1.9, 0.42, 0.02), vec3(0.8, 0.07, 0.008), g); float core = exp(-pow((vUv.x - 0.5) * 3.4, 2.0)); float hh = exp(-pow((vUv.x - 0.5) * 10.0, 2.0)) * exp(-abs(vUv.y - 0.06) * 70.0); gl_FragColor = vec4(tc * c.a * core * 1.15 + vec3(2.3, 0.6, 0.02) * hd * 1.15 + vec3(1.7, 1.05, 0.45) * hh, 1.0); }` });
  const trails = new THREE.Mesh(qg, mm); trails.frustumCulled = false; trails.renderOrder = 6; trails.visible = false; root.add(trails);
  const met = Array.from({ length: NM }, () => ({ on: false }));
  // ---- sparks (impacts: orange; welding: blue-white) ----
  const sp = new THREE.BufferGeometry(); const sPos = new Float32Array(NS * 3), sCol = new Float32Array(NS * 3), sSize = new Float32Array(NS); sp.setAttribute('position', new THREE.BufferAttribute(sPos, 3).setUsage(THREE.DynamicDrawUsage)); sp.setAttribute('color', new THREE.BufferAttribute(sCol, 3).setUsage(THREE.DynamicDrawUsage)); sp.setAttribute('size', new THREE.BufferAttribute(sSize, 1).setUsage(THREE.DynamicDrawUsage));
  const pm = new THREE.ShaderMaterial({ uniforms: { uScale: { value: innerHeight * 0.5 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, vertexColors: true,
    vertexShader: `attribute float size; varying vec3 vC; uniform float uScale; void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * uScale / max(0.5, -mv.z); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec3 vC; void main(){ vec2 d = gl_PointCoord - 0.5; float a = exp(-dot(d, d) * 18.0); if (a < 0.02) discard; gl_FragColor = vec4(vC * a, 1.0); }` });
  const sparks = new THREE.Points(sp, pm); sparks.frustumCulled = false; sparks.renderOrder = 7; sparks.visible = false; root.add(sparks);
  const P = Array.from({ length: NS }, () => ({ life: 0 })); let pi = 0;
  function emit(x, y, z, n, kind) { if (kind === 'hit' && n >= 20) { const f = P[pi]; pi = (pi + 1) % NS; Object.assign(f, { x, y, z, vx: 0, vy: 0, vz: 0, life: 0.45, max: 0.45, kind: 'flash', g: 0 }); } n = Math.max(2, Math.round(n * (low ? 0.4 : mobile ? 0.65 : 1))); for (let k = 0; k < n; k++) { const p = P[pi]; pi = (pi + 1) % NS; const a = Math.random() * 6.283, u = Math.random() * 2 - 1, s = kind === 'weld' ? 2.5 + Math.random() * 3.5 : 4 + Math.random() * 9; const r = Math.sqrt(1 - u * u);
      p.x = x; p.y = y; p.z = z; p.vx = Math.cos(a) * r * s; p.vy = (kind === 'weld' ? Math.abs(u) * 0.8 + 0.6 : u) * s; p.vz = Math.sin(a) * r * s; p.life = p.max = kind === 'weld' ? 0.25 + Math.random() * 0.35 : 0.5 + Math.random() * 0.9; p.kind = kind === 'hit' && n >= 12 ? 'burst' : kind; p.g = kind === 'weld' ? 9 : 3; } }
  // ---- console with the glowing paw button ----
  const cg = []; const col = (g, hex) => { g = g.index ? g.toNonIndexed() : g; const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) c.toArray(a, i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.deleteAttribute('uv'); return g; };
  const O = Math.PI / 8; // octagon faces toward +z
  cg.push(col(new THREE.CylinderGeometry(0.66, 0.72, 0.2, 8).rotateY(O).translate(0, 0.1, 0), '#ece2cc'), col(new THREE.CylinderGeometry(0.735, 0.735, 0.035, 8, 1, true).rotateY(O).translate(0, 0.19, 0), '#d6a136'), col(new THREE.CylinderGeometry(0.69, 0.69, 0.03, 8).rotateY(O).translate(0, 0.215, 0), '#d6a136'),
    col(new THREE.CylinderGeometry(0.52, 0.6, 0.2, 8).rotateY(O).translate(0, 0.33, 0), '#e6dac2'), col(new THREE.CylinderGeometry(0.535, 0.535, 0.035, 8, 1, true).rotateY(O).translate(0, 0.43, 0), '#d6a136'), col(new THREE.CylinderGeometry(0.5, 0.51, 0.03, 8).rotateY(O).translate(0, 0.445, 0), '#2a2f38'));
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; const ca = Math.cos(a), sa = Math.sin(a); cg.push(col(new THREE.BoxGeometry(0.34, 0.035, 0.02).rotateY(-a + Math.PI / 2).translate(ca * 0.57, 0.33, sa * 0.57), '#4fd8ff'), col(new THREE.BoxGeometry(0.2, 0.025, 0.02).rotateY(-a + Math.PI / 2).translate(ca * 0.705, 0.1, sa * 0.705), k % 2 ? '#ffb030' : '#4fd8ff'), col(new THREE.BoxGeometry(0.05, 0.2, 0.05).translate(Math.cos(a + O) * 0.66, 0.1, Math.sin(a + O) * 0.66), '#d6a136')); }
  cg.push(col(new THREE.TorusGeometry(0.43, 0.025, 6, 32).rotateX(Math.PI / 2).translate(0, 0.465, 0), '#4fd8ff'));
  const cm = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.55, roughness: 0.4, envMap: env || null }); cm.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += vColor.rgb * (step(0.8, vColor.b) * step(vColor.r, 0.4) * 2.5 + step(0.95, vColor.r) * step(vColor.b, 0.3) * 1.8);'); }; cm.customProgramCacheKey = () => 'ch2_console';
  const cons = new THREE.Mesh(mergeGeometries(cg), cm); cons.name = 'ch2_console'; const cgy = groundAt(consoleP.x, consoleP.z); cons.position.set(consoleP.x, cgy, consoleP.z); cons.receiveShadow = true; cons.scale.set(1, 1.2, 1); cons.visible = false; scene.add(cons); // shown by Chapter 2 once the finale unlocks
  const btnM = new THREE.MeshBasicMaterial({ map: pawTexture(), toneMapped: false, color: new THREE.Color(0.75, 1.15, 1.35) }); const btn = new THREE.Mesh(new THREE.CircleGeometry(0.41, 32).rotateX(-Math.PI / 2), btnM); btn.position.y = 0.47; cons.add(btn);
  // ---- storm state ----
  let state = 'off', T = 0, sT = 0, nextM = 0, hitI = 0, night = 0, alpha = 0; const S = { dur: 30, onHit: null };
  let camA = 0, poseK = 0; const domePoint = () => { const a = camA + (Math.random() - 0.5) * (poseK ? 1.3 : 2.2), el = poseK ? 0.22 + Math.random() * 0.45 : 0.25 + Math.random() * 1.1; return new THREE.Vector3(center.x + Math.cos(a) * Math.cos(el) * R, cy + Math.sin(el) * R * HY, center.z + Math.sin(a) * Math.cos(el) * R); };
  function spawn() { const m = met.find(m => !m.on); if (!m) return; const E = domePoint(); const ca = Math.cos(camA), sa = Math.sin(camA), sk = 0.5 + Math.random() * 0.25; const fx = -ca, fz = -sa; const dir = new THREE.Vector3(-fz * (0.75 + Math.random() * 0.2) + fx * 0.3, -1, fx * (0.75 + Math.random() * 0.2) + fz * 0.3).normalize(); void sk; const L = 90 + Math.random() * 50; m.S = E.clone().addScaledVector(dir, -L); m.E = E; m.dir = dir; m.t = 0; m.dur = (FASTK ? 0.7 : 1.0) * (2.2 + Math.random() * 1.0); m.on = true; m.frozen = false; }
  let FASTK = false; // meteors fall from the upper left to the lower right on screen (concept)
  const api = { root, dome, console: cons, get state() { return state; }, get night() { return night; }, emit,
    configure(o) { Object.assign(S, o); FASTK = !!o.fast; },
    start() { if (state !== 'off' && state !== 'done') return false; state = 'rise'; T = 0; sT = 0; hits.forEach(h => h.w = -99); return true; },
    end() { if (state === 'storm' || state === 'rise') { state = 'fall'; T = 0; } },
    pose(n) { poseK = 1; for (let k = 0; k < n; k++) { spawn(); const m = met.filter(m => m.on).pop(); if (m) { m.t = 0.8 + 0.17 * k / Math.max(1, n - 1); m.frozen = true; } } for (let k = 0; k < 4; k++) { const E = domePoint(); emit(E.x, E.y, E.z, 40, 'hit'); const h = hits[hitI]; hitI = (hitI + 1) % hits.length; h.set(E.x, E.y, E.z, U.uTime.value - 0.3 * k); } poseK = 0; }, // screenshot helper: several meteors mid-flight
    weld(p) { emit(p.x, p.y, p.z, 16, 'weld'); },
    update(dt, time, camPos) { U.uTime.value = time; T += dt; if (camPos) camA = Math.atan2(camPos.z - center.z, camPos.x - center.x);
      if (state === 'rise') { night = Math.min(1, night + dt / 2.2); U.uReveal.value = Math.min(1, T / 3.2); alpha = 1; if (T > 3.4) { state = 'storm'; sT = 0; } }
      else if (state === 'storm') { night = 1; sT += dt; nextM -= dt; if (nextM <= 0 && sT < S.dur - 2) { nextM = (FASTK ? 0.18 : 0.42) + Math.random() * 0.35; spawn(); } if (sT >= S.dur && !met.some(m => m.on)) { state = 'calm'; } }
      else if (state === 'fall') { night = Math.max(0, night - dt / 3); alpha = Math.max(0, alpha - dt / 2.5); if (night <= 0 && alpha <= 0) { state = 'done'; } }
      U.uAlpha.value = alpha; dome.visible = alpha > 0.01 && state !== 'off'; const sc = state === 'rise' ? 0.35 + 0.65 * (1 - Math.pow(1 - Math.min(1, T / 3.2), 3)) : 1; dome.scale.set(sc, HY * sc, sc);
      // meteors
      for (let i = 0; i < NM; i++) { const m = met[i]; if (!m.on) { iDir.setXYZW(i, 0, 0, 0, 0); continue; } if (!m.frozen) m.t += dt / m.dur; const k = Math.min(1, m.t); const p = m.S.clone().lerp(m.E, k); iHead.setXYZ(i, p.x, p.y, p.z); iDir.setXYZW(i, m.dir.x, m.dir.y, m.dir.z, Math.min(72, 24 + k * 80));
        if (k >= 1) { m.on = false; emit(m.E.x, m.E.y, m.E.z, 40, 'hit'); const h = hits[hitI]; hitI = (hitI + 1) % hits.length; h.set(m.E.x, m.E.y, m.E.z, time); S.onHit && S.onHit(m.E); } }
      iHead.needsUpdate = true; iDir.needsUpdate = true; trails.visible = state === 'storm' || met.some(m => m.on);
      // sparks
      let any = false; for (let i = 0; i < NS; i++) { const p = P[i]; if (p.life <= 0) { sSize[i] = 0; continue; } any = true; p.life -= dt; p.vy -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; const f = Math.max(0, p.life / p.max); sPos[i * 3] = p.x; sPos[i * 3 + 1] = p.y; sPos[i * 3 + 2] = p.z;
        if (p.kind === 'flash') { sCol[i * 3] = 2.4 * f; sCol[i * 3 + 1] = 0.75 * f; sCol[i * 3 + 2] = 0.12 * f; sSize[i] = 0.35 + 1.0 * f; } else if (p.kind === 'weld') { sCol[i * 3] = 1.0 + 1.6 * f; sCol[i * 3 + 1] = 1.9 + 1.4 * f; sCol[i * 3 + 2] = 4.6; sSize[i] = 0.1 + 0.2 * f; } else if (p.kind === 'burst') { sCol[i * 3] = 2.8; sCol[i * 3 + 1] = 0.9 + 1.0 * f; sCol[i * 3 + 2] = 0.12 + 0.3 * f; sSize[i] = 0.25 + 0.55 * f; } else { sCol[i * 3] = 4.0; sCol[i * 3 + 1] = 1.0 + 1.6 * f; sCol[i * 3 + 2] = 0.2 * f; sSize[i] = 0.06 + 0.16 * f; } }
      sparks.visible = any; if (any) { sp.attributes.position.needsUpdate = true; sp.attributes.color.needsUpdate = true; sp.attributes.size.needsUpdate = true; }
      pm.uniforms.uScale.value = innerHeight * 0.6;
      { const k = 1.0 + 0.4 * Math.sin(time * 3.2) * (state === 'off' || state === 'done' ? 1 : 0.25); btnM.color.setRGB(0.35 * k, 1.0 * k, 1.3 * k); } },
    set calmDone(v) { if (v && state === 'calm') { state = 'fall'; T = 0; } } };
  return api;
}
