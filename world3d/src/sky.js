import * as THREE from 'three';
import { seeded } from './noise.js';
import { rockGeom } from './props.js';
import { Builder, G } from './builder.js';
import { C } from './base.js';

const NOISE_GLSL = `
float h3(vec3 p){ p=fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float n3(vec3 x){ vec3 i=floor(x); vec3 f=fract(x); f=f*f*(3.0-2.0*f);
 return mix(mix(mix(h3(i+vec3(0,0,0)),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
            mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z); }
float fbm3(vec3 p){ float a=0.5,s=0.; for(int i=0;i<5;i++){ s+=a*n3(p); p=p*2.03+vec3(1.7,9.2,3.1); a*=0.5;} return s; }`;

let _earthDir = null; // remembered for the satellite (buildSpace runs right after buildSky)
export function buildSky(sunDir, earthDir, lite = false) {
  _earthDir = earthDir.clone();
  const group = new THREE.Group(); group.name = 'sky';
  // gd pr159 (concept d04ca995, measured): near-black zenith, deep navy lower sky, no grey haze; fewer, dimmer stars.
  // Reuse the existing dome shader: no added geometry, passes, textures or draw calls.
  // Keep the zenith dark so stars and the Earth retain their night-sky contrast.
  // gradient dome + faint milky way
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color('#010207') }, mid: { value: new THREE.Color('#06122a') }, hor: { value: new THREE.Color('#123058') }, band: { value: new THREE.Vector3(0.35, 0.55, -0.76).normalize() } },
    vertexShader: `varying vec3 vD; void main(){ vD=normalize(position); vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.); gl_Position=p.xyww; }`,
    fragmentShader: `uniform vec3 top,mid,hor,band; uniform samplerCube stars; varying vec3 vD; ${NOISE_GLSL}
      void main(){ float y=normalize(vD).y; vec3 c=mix(hor,mid,smoothstep(-0.08,0.34,y)); c=mix(c,top,smoothstep(0.26,0.85,y));
        float b=exp(-pow(dot(vD,band)/0.16,2.)); float n=fbm3(vD*6.0); float n2=fbm3(vD*14.0+3.0); c+=vec3(0.03,0.045,0.08)*b*smoothstep(0.3,0.8,n)*1.6; c+=vec3(0.025,0.032,0.04)*exp(-pow((y-0.055)/0.18,2.)); c+=vec3(0.012,0.016,0.03)*b; c+=vec3(0.09,0.07,0.06)*b*b*smoothstep(0.5,0.85,n2)*0.8; c-=vec3(0.02)*b*smoothstep(0.55,0.75,fbm3(vD*9.0+7.0)); c+=textureCube(stars,vD).rgb*1.25*smoothstep(-0.12,0.0,y);
        gl_FragColor=vec4(c,1.); }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(6000, 24, 12), skyMat); dome.renderOrder = -10; dome.frustumCulled = false; group.add(dome);
  // stars
  const r = seeded(99); const N = lite ? 9000 : 13000; /* gd pr159: concept star px ~0.3% vs game ~0.9% */ const pos = new Float32Array(N * 3), size = new Float32Array(N), col = new Float32Array(N * 3);
  const band = skyMat.uniforms.band.value;
  for (let i = 0; i < N; i++) {
    let v; do { v = new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1); } while (v.lengthSq() > 1 || v.lengthSq() < 0.01);
    v.normalize(); if (i < N * 0.25) { v.addScaledVector(band, -v.dot(band) * (0.8 + r() * 0.2)); v.normalize(); }
    if (v.y < -0.08) v.y = -v.y;
    pos.set(v.clone().multiplyScalar(5500).toArray(), i * 3);
    const m = r(); size[i] = m > 0.985 ? 3.6 + r() * 2 : m > 0.88 ? 2.2 + r() : 1.2 + r() * 0.9;
    const t = r(); const c = t < 0.15 ? [1, 0.85, 0.65] : t < 0.3 ? [0.7, 0.85, 1] : [1, 1, 1]; const br = 0.35 + r() * 0.55; col.set(c.map(x => x * br), i * 3);
  }
  // stars baked into a cube map sampled by the sky dome (0 extra draw calls / primitives)
  const FS = 1024; const faces = []; for (let f = 0; f < 6; f++) { const cv = document.createElement('canvas'); cv.width = cv.height = FS; const cx = cv.getContext('2d'); cx.fillStyle = '#000'; cx.fillRect(0, 0, FS, FS); faces.push(cx); }
  for (let i = 0; i < N; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2]; const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z); let f, sc, tc, ma;
    if (ax >= ay && ax >= az) { ma = ax; if (x > 0) { f = 0; sc = -z; tc = -y; } else { f = 1; sc = z; tc = -y; } }
    else if (ay >= az) { ma = ay; if (y > 0) { f = 2; sc = x; tc = z; } else { f = 3; sc = x; tc = -z; } }
    else { ma = az; if (z > 0) { f = 4; sc = x; tc = -y; } else { f = 5; sc = -x; tc = -y; } }
    const u = (sc / ma + 1) / 2 * FS, v = (tc / ma + 1) / 2 * FS; const rad = size[i] * 0.55; const cx = faces[f];
    const [cr, cg, cb] = [col[i * 3], col[i * 3 + 1], col[i * 3 + 2]].map(c => Math.min(255, Math.round(c * 215)));
    const g = cx.createRadialGradient(u, v, 0, u, v, rad); g.addColorStop(0, `rgba(${cr},${cg},${cb},1)`); g.addColorStop(0.45, `rgba(${cr},${cg},${cb},0.55)`); g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
    cx.fillStyle = g; cx.fillRect(u - rad, v - rad, rad * 2, rad * 2);
  }
  const starTex = new THREE.CubeTexture(faces.map(c => c.canvas)); starTex.colorSpace = THREE.SRGBColorSpace; starTex.generateMipmaps = false; starTex.minFilter = THREE.LinearFilter; starTex.needsUpdate = true;
  skyMat.uniforms.stars = { value: starTex };
  const starMat = { uniforms: { uTime: { value: 0 }, uPR: { value: 1 } } };
  // Earth
  const earthMat = new THREE.ShaderMaterial({
    fog: false, uniforms: { sun: { value: sunDir.clone() }, uTime: { value: 0 } },
    vertexShader: `varying vec3 vN; varying vec3 vP; varying vec3 vV; void main(){ vN=normalize(mat3(modelMatrix)*normal); vP=position; vec4 w=modelMatrix*vec4(position,1.); vV=normalize(cameraPosition-w.xyz); gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform vec3 sun; uniform float uTime; varying vec3 vN; varying vec3 vP; varying vec3 vV; ${NOISE_GLSL}
      void main(){ vec3 p=normalize(vP);
        vec3 wq=p*2.6+vec3(2.2,0.4,6.5); wq+=vec3(fbm3(p*3.6+2.),fbm3(p*3.6+8.),fbm3(p*3.6+5.))*0.28;
        float land=fbm3(wq); float lnd=smoothstep(0.43,0.47,land); float shelf=smoothstep(0.46,0.51,land)*(1.0-lnd);
        vec3 ocean=mix(vec3(0.008,0.07,0.34),vec3(0.015,0.16,0.55),fbm3(p*7.0)); ocean=mix(ocean,vec3(0.05,0.32,0.58),shelf);
        float gn=fbm3(p*8.0); vec3 ground=mix(vec3(0.06,0.30,0.07),vec3(0.46,0.26,0.10),smoothstep(0.28,0.70,gn));
        ground=mix(ground,vec3(0.52,0.44,0.30),smoothstep(0.55,0.8,fbm3(p*14.0+4.0))*0.65);
        ground=mix(ground,vec3(0.78,0.84,0.90),smoothstep(0.82,0.96,abs(p.y)));
        vec3 c=mix(ocean,ground,lnd);
        float cw=fbm3(p*14.0+vec3(fbm3(p*7.0),fbm3(p*7.0+3.0),fbm3(p*7.0+7.0))*0.4);
        float streak=fbm3(p*30.0+vec3(4.0,uTime*0.004,1.0));
        float cov=smoothstep(0.74,0.90,cw)*0.22+smoothstep(0.82,0.95,streak)*0.08;
        c=mix(c,vec3(0.95,0.97,1.0),clamp(cov,0.0,0.26));
        float ndl=dot(normalize(vN),normalize(sun)); float lit=smoothstep(-0.05,0.55,ndl);
        vec3 col=c*(0.18+0.85*lit);
        float ndv=max(dot(normalize(vN),normalize(vV)),0.0); float limb=pow(1.0-ndv,1.45);
        col+=vec3(0.45,0.72,1.0)*limb*0.95; col+=vec3(0.9,0.96,1.0)*pow(1.0-ndv,5.0)*0.45;
        gl_FragColor=vec4(col,1.0); }`,
  });
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1, lite ? 28 : 40, lite ? 14 : 20), earthMat); earth.renderOrder = -8;
  const ED = 4200, ER = lite ? 440 : 800; // resized per aspect in main.js; these are the first-frame sizes
  earth.position.copy(earthDir).multiplyScalar(ED); earth.scale.setScalar(ER); earth.rotation.set(0.4, 2.2, 0.2);
  group.add(earth);
  const haloMat = new THREE.ShaderMaterial({
    fog: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide, uniforms: { sun: { value: sunDir.clone() } },
    vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vN=normalize(mat3(modelMatrix)*normal); vec4 w=modelMatrix*vec4(position,1.); vV=normalize(cameraPosition-w.xyz); gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform vec3 sun; varying vec3 vN; varying vec3 vV; void main(){ float d=dot(normalize(vN),vV); float a=pow(smoothstep(0.0,0.5,-d),3.0); float lit=0.3+0.7*smoothstep(-0.5,0.4,dot(normalize(vN),sun)); gl_FragColor=vec4(vec3(0.25,0.5,0.95)*a*lit*0.7,1.); }`,
  });
  const halo = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10), haloMat); halo.position.copy(earth.position); halo.scale.setScalar(ER * 1.035); halo.renderOrder = -7; group.add(halo);
  // homeDir is the aspect-framed disc. Cutscenes pass a direction; null returns to homeDir without changing size.
  let homeDir = earthDir.clone();
  const setEarthDir = (d) => { const v = (d || homeDir).clone().normalize().multiplyScalar(ED); earth.position.copy(v); halo.position.copy(v); };
  const setEarthPose = (d, radius) => { homeDir.copy(d); earth.scale.setScalar(radius); halo.scale.setScalar(radius * 1.035); setEarthDir(d); };
  return { group, earth, starMat, earthMat, setEarthDir, setEarthPose };
}

// Asteroid belt + Ark orbital station + MK-01 (sky set pieces; no fog)
export function buildSpace(scene, hullMat, lite = false) {
  const g = new THREE.Group(); g.name = 'space';
  // pass 22: asteroid belt = a band arcing over the sky behind the concept/play direction; 8 frustum-culled instanced chunks, tumbling rocks with a warm rim
  const bg = new THREE.Group(); bg.name = 'belt'; scene.add(bg); /* not in the yaw-rotating space group: the band stays put, the rocks tumble */
  const beltU = { value: 0 }; const rockMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.88, fog: false, color: new THREE.Color('#a4a8ae') });
  rockMat.onBeforeCompile = (sh) => { sh.uniforms.uTime = beltU;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
      uniform float uTime; mat3 rotA(vec3 a, float t){ float c = cos(t), s = sin(t), ic = 1.0 - c; return mat3(c + a.x * a.x * ic, a.y * a.x * ic + a.z * s, a.z * a.x * ic - a.y * s, a.x * a.y * ic - a.z * s, c + a.y * a.y * ic, a.z * a.y * ic + a.x * s, a.x * a.z * ic + a.y * s, a.y * a.z * ic - a.x * s, c + a.z * a.z * ic); }`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
      float fi = float(gl_InstanceID); vec3 tax = normalize(vec3(fract(sin(fi * 12.9898) * 43758.5), fract(sin(fi * 78.233) * 13758.5), fract(sin(fi * 39.425) * 23421.6)) - 0.5 + 1e-3); mat3 tR = rotA(tax, uTime * (0.03 + 0.1 * fract(fi * 0.618)) + fi); objectNormal = tR * objectNormal;`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed = tR * transformed;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `{ float fr = 1.0 - abs(dot(normal, normalize(vViewPosition))); outgoingLight += vec3(0.85, 0.88, 0.95) * pow(fr, 2.5) * 0.3; outgoingLight += diffuseColor.rgb * 0.05; outgoingLight = mix(outgoingLight, vec3(0.04, 0.055, 0.09), 0.38); /* distance/space fade: cool, grey, low contrast */ }
      #include <opaque_fragment>`); };
  // pass 23: far (r ~5.6 km) and high (apex 44 deg): fine dust points + small rocks + a few large silhouettes. Desktop: 6 culled chunks + 3 point chunks; phones: 1 instanced mesh + 1 point cloud
  const Fh = new THREE.Vector3(0.592, 0, -0.806), Rh = new THREE.Vector3(0.806, 0, 0.592); const E = 44 * Math.PI / 180;
  const Ap = Fh.clone().multiplyScalar(-Math.cos(E)).add(new THREE.Vector3(0, Math.sin(E), 0)); const Nb = new THREE.Vector3().crossVectors(Rh, Ap).normalize();
  const r = seeded(7); const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  const gauss = () => (r() + r() + r() - 1.5) / 1.5; const R0 = 5600, OFF = 1100;
  const place = (ph, spread) => { const R = R0 + gauss() * 520 * spread; const off = OFF + gauss() * 380 * spread; return p.copy(Rh).multiplyScalar(Math.cos(ph) * R).addScaledVector(Ap, Math.sin(ph) * R).addScaledVector(Nb, off); };
  const geos = [rockGeom(0, 11, [1.2, 0.9, 1], 0.45), rockGeom(0, 23, [1, 0.8, 1.3], 0.5), rockGeom(1, 37, [1.1, 0.85, 1], 0.35)];
  const far8 = [rockGeom(-1, 11, [1.2, 0.9, 1], 0.45), rockGeom(-1, 23, [1, 0.8, 1.3], 0.5)]; /* small belt rocks are 1-6 px at 5.6 km: 8-tri chunks look identical to 20-tri ones (Chapter-1 budget) */
  const chunks = lite ? [[0, 1, geos[0], 110, 14]] : [0, 1, 2, 3, 4, 5].map(k => [k / 6, (k + 1) / 6, far8[k % 2], 150, 0]).concat([[0, 0.5, geos[2], 10, 10], [0.5, 1, geos[2], 10, 10]]);
  chunks.forEach(([u0, u1, geo, n, nBig], cI) => { const belt = new THREE.InstancedMesh(geo, rockMat, n + (lite ? nBig : 0));
    for (let i = 0; i < belt.count; i++) { const big = geo === geos[2] || i >= n; const ph = Math.PI * (0.12 + 0.76 * (u0 + (u1 - u0) * r())); place(ph, big ? 0.7 : 1);
      const s0 = big ? 80 + r() ** 2 * 110 : 6 + r() ** 4 * 30; sc.set(s0 * (0.8 + r() * 0.5), s0 * (0.6 + r() * 0.4), s0 * (0.8 + r() * 0.5));
      q.setFromEuler(e.set(r() * 6, r() * 6, r() * 6)); m.compose(p, q, sc); belt.setMatrixAt(i, m); }
    belt.computeBoundingSphere(); belt.boundingSphere.radius += 250; belt.frustumCulled = true; belt.name = 'belt' + cI; bg.add(belt); });
  bg.userData.lite = lite; bg.userData.samples = []; for (let k = 0; k <= 16; k++) { const ph = Math.PI * (0.12 + 0.76 * k / 16); const c = new THREE.Vector3().copy(Rh).multiplyScalar(Math.cos(ph) * R0).addScaledVector(Ap, Math.sin(ph) * R0).addScaledVector(Nb, OFF); bg.userData.samples.push(new THREE.Sphere(c, 1700)); } /* pass 24: band coverage for the phone visibility test */
  { const NP = lite ? 5000 : 10500 /* v56: budget headroom */, NCH = lite ? 1 : 3; const pm = new THREE.PointsMaterial({ size: lite ? 1.6 : 1.4, sizeAttenuation: false, vertexColors: true, fog: false });
    for (let c = 0; c < NCH; c++) { const pos = new Float32Array(NP / NCH * 3), col = new Float32Array(NP / NCH * 3);
      for (let i = 0; i < NP / NCH; i++) { const ph = Math.PI * (0.12 + 0.76 * (c + r()) / NCH); place(ph, 0.8 + r() * 0.5); pos.set([p.x, p.y, p.z], i * 3); const k = 0.18 + r() ** 2 * 0.42; col.set([k * 0.95, k * 0.97, k * 1.04], i * 3); }
      const gp = new THREE.BufferGeometry(); gp.setAttribute('position', new THREE.BufferAttribute(pos, 3)); gp.setAttribute('color', new THREE.BufferAttribute(col, 3)); gp.computeBoundingSphere();
      const pts = new THREE.Points(gp, pm); pts.name = 'beltDust' + c; bg.add(pts); } }
  // gd pr159: concept d04ca995 has no ring station; it has a solar-panel satellite just off the Earth's upper-right limb.
  // Same single merged hull mesh the ring used (1 draw call, fewer triangles), parked next to the first-frame Earth and not
  // in the slowly turning space group so it keeps that framing; a slow tumble is applied in updateBelt (called every frame).
  const b = new Builder(); const st = new THREE.Group(); st.name = 'ark'; scene.add(st);
  { const d = (_earthDir || new THREE.Vector3(0.5, 0.2, -0.8)).clone().normalize(), up = new THREE.Vector3(0, 1, 0), rt = new THREE.Vector3().crossVectors(d, up).normalize(), u2 = new THREE.Vector3().crossVectors(rt, d).normalize();
    st.position.copy(d).addScaledVector(rt, Math.tan(0.17)).addScaledVector(u2, Math.tan(0.15)).normalize().multiplyScalar(3900); st.lookAt(0, 0, 0); st.rotateZ(-0.55); st.rotateY(0.35); st.scale.setScalar(1.35); }
  const PN = '#2c55a8', PN2 = '#3a6cc8'; // solar cells: concept blue
  b.add('ivory', G.box(40, 64, 40), { pos: [0, -32, 0], color: C.ivory2 }); // bus
  b.add('gold', G.box(43, 26, 43), { pos: [0, -8, 0], color: C.gold }); // gold foil wrap
  b.add('ivory', G.cyl(16, 22, 18, 10), { pos: [0, 32, 0], color: C.ivory }); b.add('gold', G.cyl(26, 4, 12, 12), { pos: [0, 50, 0], rot: [0.5, 0, 0], color: C.goldD }); // top dish
  b.add('gold', G.cyl(1.6, 1.6, 40, 4), { pos: [8, 50, 0], color: C.goldD }); // antenna
  for (const sx of [-1, 1]) { b.add('gold', G.cyl(3, 3, 46, 6).rotateZ(Math.PI / 2), { pos: [sx * 20, 0, 0], color: C.goldD }); // boom
    const x0 = sx * (42 + 66); b.add('dark', G.box(132, 52, 2.5), { pos: [x0, 0, 0], color: PN }); // cells face the base (+z)
    for (let k = -2; k <= 2; k++) b.add('dark', G.box(1.6, 52, 3.4), { pos: [x0 + k * 26.4, 0, 0], color: PN2 }); b.add('gold', G.box(134, 2.4, 3.6), { pos: [x0, 26, 0], color: C.goldD }); b.add('gold', G.box(134, 2.4, 3.6), { pos: [x0, -26, 0], color: C.goldD }); }
  b.add('glow', G.octa(4), { pos: [0, 74, 0], color: '#ff5030', intensity: 6 }); b.add('glow', G.octa(3), { pos: [0, -66, 0], color: '#fff2d0', intensity: 5 });
  const hm = hullMat.clone(); hm.fog = false; const mats = { hull: hm };
  const built = b.build(mats, st); for (const k in built) { built[k].castShadow = built[k].receiveShadow = false; built[k].frustumCulled = true; }
  scene.add(g);
  const fr = new THREE.Frustum(), pm4 = new THREE.Matrix4();
  const updateBelt = (camera, hideAll) => { st.rotateZ(0.0002); if (hideAll) { bg.visible = false; return; } if (!lite) { bg.visible = true; return; } pm4.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); fr.setFromProjectionMatrix(pm4); bg.visible = bg.userData.samples.some(sp => fr.intersectsSphere(sp)); }; // off past 320 m (a speck from a zone) and, on phones, inside the hub or off-screen
  return { group: g, mats, beltU, updateBelt };
}
