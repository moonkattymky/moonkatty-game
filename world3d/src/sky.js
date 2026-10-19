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

export function buildSky(sunDir, earthDir, lite = false) {
  const group = new THREE.Group(); group.name = 'sky';
  // gradient dome + faint milky way
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color('#03050b') }, mid: { value: new THREE.Color('#070c18') }, hor: { value: new THREE.Color('#16283a') }, band: { value: new THREE.Vector3(0.35, 0.55, -0.76).normalize() } },
    vertexShader: `varying vec3 vD; void main(){ vD=normalize(position); vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.); gl_Position=p.xyww; }`,
    fragmentShader: `uniform vec3 top,mid,hor,band; uniform samplerCube stars; varying vec3 vD; ${NOISE_GLSL}
      void main(){ float y=vD.y; vec3 c=mix(hor,mid,smoothstep(-0.05,0.18,y)); c=mix(c,top,smoothstep(0.18,0.8,y));
        float b=exp(-pow(dot(vD,band)/0.16,2.)); float n=fbm3(vD*6.0); float n2=fbm3(vD*14.0+3.0); c+=vec3(0.07,0.085,0.13)*b*smoothstep(0.3,0.8,n)*2.1; c+=vec3(0.045,0.075,0.12)*exp(-pow((y-0.015)/0.07,2.)); c+=vec3(0.035,0.038,0.06)*b; c+=vec3(0.09,0.07,0.06)*b*b*smoothstep(0.5,0.85,n2)*0.8; c-=vec3(0.02)*b*smoothstep(0.55,0.75,fbm3(vD*9.0+7.0)); c+=textureCube(stars,vD).rgb*1.7*smoothstep(-0.12,0.0,y);
        gl_FragColor=vec4(c,1.); }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(6000, 24, 12), skyMat); dome.renderOrder = -10; dome.frustumCulled = false; group.add(dome);
  // stars
  const r = seeded(99); const N = 26000; const pos = new Float32Array(N * 3), size = new Float32Array(N), col = new Float32Array(N * 3);
  const band = skyMat.uniforms.band.value;
  for (let i = 0; i < N; i++) {
    let v; do { v = new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1); } while (v.lengthSq() > 1 || v.lengthSq() < 0.01);
    v.normalize(); if (i < N * 0.5) { v.addScaledVector(band, -v.dot(band) * (0.8 + r() * 0.2)); v.normalize(); }
    if (v.y < -0.08) v.y = -v.y;
    pos.set(v.clone().multiplyScalar(5500).toArray(), i * 3);
    const m = r(); size[i] = m > 0.985 ? 3.6 + r() * 2 : m > 0.88 ? 2.2 + r() : 1.2 + r() * 0.9;
    const t = r(); const c = t < 0.15 ? [1, 0.85, 0.65] : t < 0.3 ? [0.7, 0.85, 1] : [1, 1, 1]; const br = 0.6 + r() * 0.6; col.set(c.map(x => x * br), i * 3);
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
        // continents: warped fbm with crisp coastlines; ocean deep blue with shallow shelves
        vec3 wq=p*2.0+vec3(3.,1.,7.); wq+=vec3(fbm3(p*3.1+2.),fbm3(p*3.1+8.),fbm3(p*3.1+5.))*0.55; float land=fbm3(wq); float l=smoothstep(0.55,0.565,land); float shelf=smoothstep(0.49,0.55,land)*(1.-l);
        vec3 ocean=mix(vec3(0.004,0.03,0.16),vec3(0.01,0.09,0.34),fbm3(p*5.)); ocean=mix(ocean,vec3(0.03,0.22,0.45),shelf*0.6);
        float gn=fbm3(p*9.); vec3 ground=mix(vec3(0.09,0.17,0.06),vec3(0.46,0.34,0.18),smoothstep(0.35,0.65,gn)); ground=mix(ground,vec3(0.62,0.52,0.36),smoothstep(0.62,0.75,fbm3(p*16.+4.))*0.5);
        vec3 c=mix(ocean,ground,l);
        // clouds: domain-warped swirls, crisp edges + fine streaks
        vec3 q=p*3.2+vec3(fbm3(p*4.+uTime*0.01),fbm3(p*4.+5.),fbm3(p*4.+9.))*1.6; float cf=fbm3(q*1.9); float cl=smoothstep(0.56,0.64,cf); float cl2=smoothstep(0.6,0.66,fbm3(q*4.3+2.))*0.45; float cov=clamp(cl*0.92+cl2*(1.-cl),0.,1.);
        c=mix(c,vec3(0.92,0.94,0.97),cov);
        float ndl=dot(normalize(vN),sun); float lit=smoothstep(-0.2,0.45,ndl); vec3 col=c*(0.05+1.2*lit);
        float fr=pow(1.-max(dot(normalize(vN),vV),0.),4.); col+=vec3(0.2,0.45,1.0)*fr*(0.08+0.55*lit); float rim=pow(1.-max(dot(normalize(vN),vV),0.),2.2); col+=vec3(0.3,0.6,1.0)*smoothstep(0.55,1.0,rim)*(0.12+0.5*lit);
        float lum=dot(col,vec3(0.3,0.59,0.11)); col=mix(vec3(lum),col,0.9)*0.5; gl_FragColor=vec4(col,1.); }`,
  });
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1, lite ? 28 : 40, lite ? 14 : 20), earthMat); earth.renderOrder = -8;
  const ED = 4200, ER = 690; earth.position.copy(earthDir).multiplyScalar(ED); earth.scale.setScalar(ER); earth.rotation.set(0.4, 2.2, 0.2);
  group.add(earth);
  const haloMat = new THREE.ShaderMaterial({
    fog: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide, uniforms: { sun: { value: sunDir.clone() } },
    vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vN=normalize(mat3(modelMatrix)*normal); vec4 w=modelMatrix*vec4(position,1.); vV=normalize(cameraPosition-w.xyz); gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform vec3 sun; varying vec3 vN; varying vec3 vV; void main(){ float d=dot(normalize(vN),vV); float a=pow(smoothstep(0.0,0.5,-d),3.0); float lit=0.3+0.7*smoothstep(-0.5,0.4,dot(normalize(vN),sun)); gl_FragColor=vec4(vec3(0.25,0.5,0.95)*a*lit*0.7,1.); }`,
  });
  const halo = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10), haloMat); halo.position.copy(earth.position); halo.scale.setScalar(ER * 1.035); halo.renderOrder = -7; group.add(halo);
  // cutscenes can park the Earth in a chosen direction (null = back to the default)
  const setEarthDir = (d) => { const v = (d || earthDir).clone().normalize().multiplyScalar(ED); earth.position.copy(v); halo.position.copy(v); };
  return { group, earth, starMat, earthMat, setEarthDir };
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
  // pass 21: Ark station rebuilt in its own local frame (ring in XY, spin axis Z): detailed, lit, frustum-culled
  const b = new Builder(); const st = new THREE.Group(); st.name = 'ark'; st.position.set(2300, 2050, -2500); st.rotation.set(1.15, 0.5, 0); st.scale.setScalar(1.3); g.add(st);
  b.add('ivory', G.torus(220, 18, 10, 64), { color: C.ivory });
  b.add('gold', G.torus(220, 19.5, 4, 64), { scale: [1, 1, 0.22], color: C.gold });
  for (let k = 0; k < 12; k++) { const a = (k + 0.5) / 12 * Math.PI * 2; b.add('ivory', G.box(30, 46, 44), { pos: [Math.cos(a) * 224, Math.sin(a) * 224, 0], rot: [0, 0, a], color: C.ivory2 }); b.add('gold', G.box(31, 47, 3), { pos: [Math.cos(a) * 224, Math.sin(a) * 224, 23], rot: [0, 0, a], color: C.goldD }); }
  for (let k = 0; k < 36; k++) { const a = k / 36 * Math.PI * 2; if (k % 3 === 1) continue; b.add('glow', G.box(3, 9, 26), { pos: [Math.cos(a) * 238.5, Math.sin(a) * 238.5, 0], rot: [0, 0, a], color: C.win, intensity: 2.6 }); }
  for (let k = 0; k < 6; k++) b.add('gold', G.cyl(6, 6, 404, 6).translate(0, -202, 0).rotateZ(k * Math.PI / 3 + 0.26), { color: C.goldD });
  b.add('ivory', G.sphere(44, 16, 10), { color: C.ivory }); b.add('gold', G.torus(45, 4, 4, 24), { color: C.gold });
  b.add('ivory', G.cyl(20, 20, 540, 12).translate(0, -270, 0).rotateX(Math.PI / 2), { color: C.ivory2 });
  for (const zz of [-210, 190]) { b.add('gold', G.torus(32, 6, 4, 20), { pos: [0, 0, zz], color: C.gold }); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; b.add('glow', G.octa(5), { pos: [Math.cos(a) * 38, Math.sin(a) * 38, zz], color: k % 2 ? '#ff5030' : '#fff2d0', intensity: 6 }); } }
  for (const sg of [-1, 1]) for (const zz of [-262, -232]) { b.add('dark', G.box(150, 2, 26), { pos: [sg * 100, 0, zz], color: '#2b3d63' }); b.add('gold', G.box(152, 2.6, 2.5), { pos: [sg * 100, 0, zz + 13], color: C.goldD }); }
  b.add('glow', G.octa(8), { pos: [0, 0, 280], color: '#ff5030', intensity: 7 });
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; b.add('glow', G.octa(4.5), { pos: [Math.cos(a) * 220, Math.sin(a) * 220, 20], color: k % 2 ? '#ff5030' : '#fff2d0', intensity: 6 }); }
  const hm = hullMat.clone(); hm.fog = false; const mats = { hull: hm };
  const built = b.build(mats, st); for (const k in built) { built[k].castShadow = built[k].receiveShadow = false; built[k].frustumCulled = true; }
  scene.add(g);
  const fr = new THREE.Frustum(), pm4 = new THREE.Matrix4();
  const updateBelt = (camera, hideAll) => { if (!lite) return; if (hideAll) { bg.visible = false; return; } pm4.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); fr.setFromProjectionMatrix(pm4); bg.visible = bg.userData.samples.some(sp => fr.intersectsSphere(sp)); }; // phones: the belt is 2 big draws - skip it in the hub and whenever the band is off-screen
  return { group: g, mats, beltU, updateBelt };
}
