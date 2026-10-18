import * as THREE from 'three';
// Energy crystals (user art ref): a cluster of 3-5 tall sharp hexagonal shards of different heights growing from one base, saturated
// electric blue/cyan, translucent look with a bright inner glow, white-hot facet edges, a soft blue halo (fake bloom, additive billboard)
// and a faint pulsing light pool on the ground. No real-time lights. Per field: 1 instanced shard draw + 1 instanced glow draw.

// hexagonal shard: tapered prism + long faceted point (optional second ring = convex "gothic" point); barycentric attribute marks only the real
// crystal ridges (vertical ridges, shoulder ring, tip ridges) - no horizontal ring lines and no quad diagonals, so it reads as a cut gem, not a wire mesh
function shard(pos, bary, hh, { x, z, h, r, rb = 0.85, tilt = 0, dir = 0, tip, rot = 0.3, tm = null }, small = false) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, -0.06, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt * Math.sin(dir), 0, -tilt * Math.cos(dir))), new THREE.Vector3(1, 1, 1));
  const v = (a, y, rr) => new THREE.Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr).applyMatrix4(m);
  const ring = (y, rr) => Array.from({ length: 6 }, (_, i) => v(i / 6 * Math.PI * 2 + rot, y, rr));
  const B = ring(0, r * rb), T = ring(h, r), P = v(0, h + tip, 0); const H = h + tip;
  const tri = (a, b, c, ba, bb, bc) => { for (const [p, q] of [[a, ba], [c, bc], [b, bb]]) { pos.push(p.x, p.y, p.z); bary.push(...q); hh.push(Math.max(0, p.y - m.elements[13]) / H + (small ? 2 : 0)); } }; // aH: height 0..1, +2 on the small shards (softer ridges)
  for (let i = 0; i < 6; i++) { const j = (i + 1) % 6; tri(B[i], B[j], T[j], [1, 1, 1], [0, 1, 0], [0, 1, 1]); tri(B[i], T[j], T[i], [1, 1, 0], [0, 1, 1], [0, 1, 0]);
    if (!tm) { tri(T[i], T[j], P, [1, 0, 0], [0, 1, 0], [0, 0, 1]); continue; }
    const M = ring(h + tip * tm[0], r * tm[1]); // band T -> M (ridges continue, no ring line), then M -> apex
    tri(T[i], T[j], M[j], [1, 1, 1], [0, 1, 1], [0, 1, 1]); tri(T[i], M[j], M[i], [1, 0, 1], [1, 1, 1], [1, 0, 1]); tri(M[i], M[j], P, [1, 0, 1], [0, 1, 1], [0, 0, 1]); }
}
let _geo = null;
// proportions measured on the user's reference (silhouette overlay, tools/crystal_shot.mjs): one tall dominant slim prism, slightly narrower at the
// base, with a long convex faceted point (shoulders at ~55% of the height); two long shards splayed ~45-50 deg low at the base; small chips in front
export const CLUSTER = [{ x: 0, z: 0, h: 0.94, r: 0.44, rb: 0.74, tip: 0.7, tm: [0.46, 0.64], rot: 0.0 },
  { x: -0.215, z: 0.05, h: 0.5, r: 0.21, rb: 0.7, tip: 0.245, tilt: 0.92, dir: 3.022, rot: 0.3 }, { x: 0.17, z: 0.05, h: 0.38, r: 0.17, rb: 0.7, tip: 0.24, tilt: 1.02, dir: 0.12, rot: 0.2 },
  { x: -0.04, z: 0.26, h: 0.12, r: 0.09, tip: 0.1, tilt: 0.95, dir: 2.071 },
  { x: -0.48, z: 0.12, h: 0.1, r: 0.12, tip: 0.09, tilt: 1.42, dir: 3.392 }, { x: 0.38, z: 0.14, h: 0.1, r: 0.12, tip: 0.09, tilt: 1.46, dir: -0.25 }, { x: 0.12, z: 0.28, h: 0.07, r: 0.06, tip: 0.06, tilt: 0.8, dir: 0.971 }];
export function buildCluster(list, low = false) { const pos = [], bary = [], hh = [];
  list.forEach((s, i) => { if (!(low && i >= 4)) shard(pos, bary, hh, s, i > 0); });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aBary', new THREE.Float32BufferAttribute(bary, 3)); g.setAttribute('aH', new THREE.Float32BufferAttribute(hh, 1)); g.computeVertexNormals(); g.computeBoundingSphere();
  return g; }
export function clusterGeometry() { // q=low: skip the tiny base chips (main + splayed shards + front shard kept)
  return _geo || (_geo = buildCluster(CLUSTER, true)); }
const shardMat = () => new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 } }, toneMapped: false,
  vertexShader: `attribute vec3 aBary; attribute float aH; attribute float aState; varying vec3 vB; varying float vH; varying float vE; varying vec3 vV; varying float vS; varying float vSeed; varying vec3 vLP; varying vec3 vWP;
    void main(){ vLP = position; mat4 im = modelMatrix * instanceMatrix; vec4 wp = im * vec4(position, 1.0); vWP = wp.xyz; vV = cameraPosition - wp.xyz; vB = aBary; vH = aH > 1.5 ? aH - 2.0 : aH; vE = aH > 1.5 ? 0.0 : 1.0; vS = aState; vSeed = im[3].x * 0.37 + im[3].z * 0.11; gl_Position = projectionMatrix * viewMatrix * wp; }`,
  fragmentShader: `uniform float uTime; varying vec3 vB; varying float vH; varying float vE; varying vec3 vV; varying float vS; varying float vSeed; varying vec3 vLP; varying vec3 vWP;
    float h3(vec3 p){ p = fract(p * vec3(0.1031, 0.103, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.x + p.y) * p.z); }
    void main(){
      vec3 fn = cross(dFdx(vWP), dFdy(vWP)); float fl = length(fn); vec3 n = fl > 1e-12 ? fn / fl : vec3(0.0, 1.0, 0.0); // flat facet normal (cut-gem faces)
      vec3 V = normalize(vV); if (dot(n, V) < 0.0) n = -n; float nv = clamp(dot(n, V), 0.0, 1.0); float fr = pow(1.0 - nv, 2.2);
      vec3 ln = cross(dFdx(vLP), dFdy(vLP)); float ll = length(ln); ln = ll > 1e-12 ? ln / ll : vec3(0.0, 1.0, 0.0);
      float face = h3(floor(vec3(ln.x, ln.y * 0.6, ln.z) * 3.0 + 0.5) + floor(vSeed * 7.0)); // one tone per facet (a prism face and its point facet share it)
      // stained-glass interior: refracted cells (shift with the view) in royal / deep / light blue, with soft lighter fracture streaks between some of them
      vec3 rd = refract(-V, n, 0.66); vec3 q = vLP * 3.1 + rd * 0.45 + vec3(vSeed);
      vec4 d = vec4(dot(q, vec3(0.86, 0.45, 0.24)), dot(q, vec3(-0.42, 0.8, 0.43)), dot(q, vec3(0.3, -0.25, 0.92)), dot(q, vec3(0.62, -0.7, 0.36)) * 0.8);
      vec4 cid = floor(d); float cell = h3(cid.xyz * 1.7 + cid.w * 5.3 + 3.1); vec4 fd = abs(fract(d) - 0.5); float ib = 0.5 - max(max(fd.x, fd.y), max(fd.z, fd.w));
      float streak = pow(1.0 - smoothstep(0.0, 0.16, ib), 2.0) * step(0.6, h3(cid.xyz + cid.w * 2.0 + 11.0));
      float tone = clamp(face * 0.5 + cell * 0.9 - 0.2, 0.0, 1.0);
      float pulse = 0.92 + 0.08 * sin(uTime * 2.2 + vSeed);
      // lit from INSIDE: facets in varied blues (deep cobalt -> royal -> cyan -> near white), a luminous light-blue/white core seen through the
      // facing facets, lighter refracted fracture planes, soft light-blue fresnel. Colours pre-solved through the ACES output transform.
      vec3 cobalt = vec3(0.0, 0.02, 0.42), royal = vec3(0.0, 0.07, 0.85), cyan = vec3(0.0, 0.42, 1.5), ice = vec3(0.12, 0.85, 2.1), hot = vec3(0.4, 1.6, 3.2);
      vec3 c = mix(cobalt * 0.8, royal, smoothstep(0.2, 0.6, tone));
      c = mix(c, cyan, smoothstep(0.7, 0.95, tone) * 0.65);
      c = mix(c, ice, smoothstep(0.97, 1.0, tone) * 0.35);
      c *= mix(0.42, 1.0, pow(nv, 0.8)); float thr = pow(nv, 1.6); float ax = length(vLP.xz); float coreC = exp(-ax * ax / 0.028) * (0.45 + 0.55 * (smoothstep(0.0, 0.12, vH) * (1.0 - smoothstep(0.62, 0.98, vH)))); float coreH = exp(-pow((vH - 0.38) / 0.42, 2.0));
      c += cyan * thr * thr * coreH * 0.3 * pulse + mix(cyan, hot, 0.45) * pow(nv, 4.0) * exp(-pow((vH - 0.26) / 0.26, 2.0)) * mix(0.1, 1.0, smoothstep(0.35, 0.9, cell)) * 0.7 * pulse;                      // inner glow core
      c += cyan * streak * 0.5;                                   // refracted fracture planes
      c += royal * fr * 0.25 + cyan * pow(1.0 - nv, 8.0) * 0.6;                                                        // soft fresnel
      c += mix(ice, hot, 0.4) * pow(1.0 - vH, 9.0) * 1.3 * pulse * (0.4 + 0.6 * exp(-ax * ax / 0.08));                  // glowing base
      // edge highlights: soft and only on SOME facet edges (per-facet random), brighter toward the tip - no uniform wireframe outline
      float e = min(min(vB.x, vB.y), vB.z); float w = fwidth(e);
      float sel = mix(0.3, 1.0, step(0.45, h3(floor(ln * 4.0 + 0.5) + floor(vSeed * 3.0) + 7.0))) * mix(0.55, 1.0, vE);
      float soft = 1.0 - smoothstep(0.0, 0.07, e), core = 1.0 - smoothstep(w * 0.5, w * 2.2, e);
      c += mix(cyan, ice, 0.3) * soft * soft * 0.9 * sel * (0.45 + 0.55 * vH) + ice * core * 0.35 * sel * smoothstep(0.25, 1.0, vH);
      c += ice * smoothstep(0.9, 1.0, vH) * 0.25;                                  // bright tips
      if (vS > 0.5) c = c * vec3(0.35, 0.33, 0.4) + vec3(0.5, 0.12, 0.05) * core; // mined / cracked
      gl_FragColor = vec4(c, 1.0); }` });
const glowMat = () => new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  vertexShader: `attribute float aK; attribute float aState; varying vec2 vP; varying float vK; varying float vS; varying float vSeed;
    void main(){ mat4 im = modelMatrix * instanceMatrix; float s = length(im[0].xyz); vec3 c = im[3].xyz; vP = position.xy; vK = aK; vS = aState; vSeed = c.x * 0.37 + c.z * 0.11; vec3 wp;
      if (aK < 0.5) { vec3 R = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]), U = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]); wp = c + vec3(0.0, 0.7 * s, 0.0) + (R * position.x * 1.6 + U * position.y * 1.6) * s; wp += normalize(cameraPosition - wp) * 0.75 * s; } /* pulled toward the camera so it is not clipped by the ground; it only rings the silhouette (no tint over the body) */
      else wp = c + vec3(position.x, 0.04, position.y) * 2.1 * s;
      gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0); }`,
  fragmentShader: `uniform float uTime; varying vec2 vP; varying float vK; varying float vS; varying float vSeed;
    void main(){ float r = length(vP); if (r > 1.0) discard; float pulse = 0.75 + 0.25 * sin(uTime * 2.4 + vSeed); vec3 add; float occ;
      // premultiplied blend (One, OneMinusSrcAlpha): the halo both adds blue light and dims what is behind it, so it reads as a deep blue glow even on
      // bright regolith (pure additive blue on a light background turns lavender)
      if (vK < 0.5) { vec2 e = vec2(vP.x * 1.45, (vP.y - 0.08) * 1.0); float rr = dot(e, e); float h = exp(-rr * 4.5) * 1.5 * pulse; float wr = smoothstep(0.1, 0.28, rr); // halo ringing the silhouette (no tint over the crystal body)
        add = vec3(0.02, 0.4, 1.6) * h * wr * (1.0 - smoothstep(0.3, 0.9, rr)); occ = min(0.7, h * 0.6 * wr);
        vec2 b = vec2(vP.x / 0.62, (vP.y + 0.5) / 0.13); add += vec3(0.15, 0.7, 2.1) * exp(-dot(b, b)) * 0.8 * pulse;
        vec2 sp = vec2(vP.x - 0.18, vP.y + 0.42) * 6.0; float tw = pow(0.5 + 0.5 * sin(uTime * 3.7 + vSeed * 5.0), 3.0); add += vec3(0.6, 1.4, 2.6) * (exp(-abs(sp.x) * 9.0) * exp(-abs(sp.y) * 1.3) + exp(-abs(sp.y) * 9.0) * exp(-abs(sp.x) * 1.3)) * 0.45 * tw; } // twinkling sparkle at the base // white-cyan flare at the base
      else { float a = (pow(1.0 - r, 3.0) * 1.1 + smoothstep(0.08, 0.0, abs(r - fract(uTime * 0.45 + vSeed))) * 0.16 * (1.0 - r)) * pulse;
        vec3 col = mix(vec3(0.02, 0.2, 1.2), vec3(0.15, 0.7, 1.9), pow(1.0 - r, 6.0)); add = col * a * a * 2.3; occ = 0.0; } // pooled light on the ground
      if (vS > 0.5) { add *= 0.25; occ *= 0.25; } gl_FragColor = vec4(add, occ); }` });
let _glowGeo = null;
const glowGeometry = () => { if (_glowGeo) return _glowGeo; const q = new THREE.PlaneGeometry(2, 2).toNonIndexed(); const a = q.clone(); const b = q.clone(); const g = new THREE.BufferGeometry(); const P = [...a.attributes.position.array, ...b.attributes.position.array]; g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aK', new THREE.Float32BufferAttribute([...Array(6).fill(0), ...Array(6).fill(1)], 1)); g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 3.5); return (_glowGeo = g); };

// spots: [{x,y,z}] -> fields clustered by 60 m (one shard + one glow InstancedMesh each, frustum-culled)
export function makeCrystalField(scene, spots, { scale = 1, name = 'game_crystals', cluster = 60 } = {}) {
  const geo = clusterGeometry(); const sm = shardMat(), gm = glowMat();
  const groups = []; spots.forEach((c, i) => { let g = groups.find(g => Math.hypot(g.x - c.x, g.z - c.z) < cluster); if (!g) groups.push(g = { x: c.x, z: c.z, ids: [] }); g.ids.push(i); });
  const alive = spots.map(() => true), cracked = spots.map(() => 0), shake = spots.map(() => 0);
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
  for (const g of groups) { const n = g.ids.length;
    const sgeo = geo.clone(); sgeo.setAttribute('aState', new THREE.InstancedBufferAttribute(new Float32Array(n), 1)); const ggeo = glowGeometry().clone(); ggeo.setAttribute('aState', new THREE.InstancedBufferAttribute(new Float32Array(n), 1));
    g.im = new THREE.InstancedMesh(sgeo, sm, n); g.im.name = name; g.gl = new THREE.InstancedMesh(ggeo, gm, n); g.gl.name = name + '_glow'; g.gl.renderOrder = 2; g.im.castShadow = false; scene.add(g.im, g.gl); }
  const update = (t, dt = 0) => { sm.uniforms.uTime.value = t; gm.uniforms.uTime.value = t;
    for (const g of groups) { const sa = g.im.geometry.attributes.aState, ga = g.gl.geometry.attributes.aState; g.ids.forEach((i, k) => { const c = spots[i]; shake[i] = Math.max(0, shake[i] - dt * 3); e.set(Math.sin(t * 45) * 0.07 * shake[i], i * 2.399, 0); q.setFromEuler(e); p.set(c.x, c.y, c.z); s.setScalar(alive[i] ? scale * (0.85 + 0.3 * ((i * 0.618) % 1)) : 0); M.compose(p, q, s); g.im.setMatrixAt(k, M); g.gl.setMatrixAt(k, M); sa.setX(k, cracked[i]); ga.setX(k, cracked[i]); });
      g.im.instanceMatrix.needsUpdate = true; g.gl.instanceMatrix.needsUpdate = true; sa.needsUpdate = true; ga.needsUpdate = true; const vis = g.ids.some(i => alive[i]); g.im.visible = vis && g.on !== false; g.gl.visible = g.im.visible; } };
  update(0); for (const g of groups) { for (const m of [g.im, g.gl]) { m.computeBoundingSphere(); m.boundingSphere.radius += 3 * scale; } }
  return { meshes: groups.map(g => g.im), groups, alive, cracked, spots, update, setAlive(i, v) { alive[i] = v; }, setVisible(v) { groups.forEach(g => g.on = v); }, shake(i) { shake[i] = 1; } };
}

// static decor clusters (canyon / echo world crystals): same look, one shard + one glow instanced draw for the whole list
export function makeStaticCrystals(scene, list, name, k = 1) {
  const n = list.length; const sgeo = clusterGeometry().clone(); sgeo.setAttribute('aState', new THREE.InstancedBufferAttribute(new Float32Array(n), 1));
  const ggeo = glowGeometry().clone(); ggeo.setAttribute('aState', new THREE.InstancedBufferAttribute(new Float32Array(n), 1));
  const im = new THREE.InstancedMesh(sgeo, shardMat(), n), gl = new THREE.InstancedMesh(ggeo, glowMat(), n); im.name = name; gl.name = name + '_glow'; gl.renderOrder = 2; im.castShadow = false;
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  list.forEach((it, i) => { q.setFromEuler(e.set(it.tilt * 0.6, it.ph, it.tilt * 0.3)); M.compose(v.set(it.x, it.y + 0.25 * it.s, it.z), q, sc.setScalar(it.s * k)); im.setMatrixAt(i, M); q.identity(); M.compose(v, q, sc); gl.setMatrixAt(i, M); });
  im.computeBoundingSphere(); gl.computeBoundingSphere(); gl.boundingSphere.radius += 4 * k * 2.5; im.add(gl); gl.matrixAutoUpdate = false; gl.matrix.identity(); gl.matrixWorldAutoUpdate = true;
  scene.add(im); return im;
}
