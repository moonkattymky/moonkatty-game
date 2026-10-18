import * as THREE from 'three';
import { makeCrewRobot } from './robots.js';
// ============================================================================================
// Crew robot impostors: each robot type is rendered once (front + 3/4 views) into a small atlas at startup, far robots are
// drawn as camera-facing (cylindrical) billboards in ONE instanced draw (2 tris each). Keeps 8 robots inside the
// ?q=low / phone budgets; near robots still use the real meshes (hi / LOD).
// ============================================================================================
const TYPES = ['builder', 'geologist', 'archaeologist', 'engineer'], VIEWS = 2, CW = 96, CH = 128, MAXN = 12;
export function makeImpostors(scene, renderer, env) {
  const rt = new THREE.WebGLRenderTarget(CW * TYPES.length, CH * VIEWS, { colorSpace: THREE.LinearSRGBColorSpace, samples: 0 });
  const tmp = new THREE.Scene(); tmp.add(new THREE.HemisphereLight('#dfe6f2', '#5a5550', 1.3)); const dl = new THREE.DirectionalLight('#fff4e6', 2.4); dl.position.set(2, 4, 3); tmp.add(dl); const dl2 = new THREE.DirectionalLight('#b8d4ff', 0.8); dl2.position.set(-3, 2, -2); tmp.add(dl2);
  const H = 1.5, W = H * CW / CH; const cam = new THREE.OrthographicCamera(-W / 2, W / 2, H, 0, 0.1, 20); cam.position.set(0, 0, 6); cam.lookAt(0, 0, 0); cam.position.y = 0; cam.updateProjectionMatrix();
  const prevT = renderer.getRenderTarget(), prevC = renderer.getClearColor(new THREE.Color()), prevA = renderer.getClearAlpha(), prevAuto = renderer.autoClear, prevSh = renderer.shadowMap.enabled;
  renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.autoClear = false;
  const bots = TYPES.map(t => { const r = makeCrewRobot(tmp, env, t, 1); r.root.visible = true; r.update(0.016, 'idle', new THREE.Vector3(0, 1, 2)); return r; });
  for (let v = 0; v < VIEWS; v++) for (let i = 0; i < TYPES.length; i++) { bots.forEach((b, k) => b.root.visible = k === i); bots[i].root.rotation.y = v ? 0.75 : 0; rt.viewport.set(i * CW, v * CH, CW, CH); rt.scissor.set(i * CW, v * CH, CW, CH); rt.scissorTest = true; renderer.setRenderTarget(rt); renderer.render(tmp, cam); }
  rt.viewport.set(0, 0, CW * TYPES.length, CH * VIEWS); rt.scissorTest = false; renderer.setRenderTarget(prevT); renderer.setClearColor(prevC, prevA); renderer.autoClear = prevAuto; renderer.shadowMap.enabled = prevSh;
  bots.forEach(b => b.root.traverse(o => { if (o.geometry) o.geometry.dispose(); })); // shared materials stay (used by the real crew)
  const g = new THREE.InstancedBufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3)); g.setIndex([0, 1, 2, 0, 2, 3]);
  const iP = new THREE.InstancedBufferAttribute(new Float32Array(MAXN * 4), 4), iT = new THREE.InstancedBufferAttribute(new Float32Array(MAXN * 2), 2); iP.setUsage(THREE.DynamicDrawUsage); iT.setUsage(THREE.DynamicDrawUsage); g.setAttribute('iP', iP); g.setAttribute('iT', iT); g.instanceCount = 0;
  const U = { uMap: { value: rt.texture }, uDim: { value: 1 }, uSize: { value: new THREE.Vector2(W, H) }, uAtlas: { value: new THREE.Vector2(TYPES.length, VIEWS) } };
  const m = new THREE.ShaderMaterial({ uniforms: U, transparent: false, side: THREE.DoubleSide,
    vertexShader: `attribute vec4 iP; attribute vec2 iT; uniform vec2 uSize, uAtlas; varying vec2 vUv; void main(){ vec3 c = iP.xyz; vec3 toC = cameraPosition - c; toC.y = 0.0; toC = normalize(toC); vec3 side = vec3(toC.z, 0.0, -toC.x);
      // pick the front or 3/4 view from the angle between the robot's facing (iP.w) and the camera
      float rel = atan(toC.x, toC.z) - iP.w; rel = atan(sin(rel), cos(rel)); float view = abs(rel) > 0.45 ? 1.0 : 0.0; float flip = (view > 0.5 && rel < 0.0) ? -1.0 : 1.0;
      vec3 p = c + side * position.x * uSize.x * -1.0 + vec3(0.0, position.y * uSize.y, 0.0); vUv = vec2(((position.x * flip + 0.5) + iT.x) / uAtlas.x, (position.y + view) / uAtlas.y); gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`,
    fragmentShader: `uniform sampler2D uMap; uniform float uDim; varying vec2 vUv; void main(){ vec4 c = texture2D(uMap, vUv); if (c.a < 0.5) discard; gl_FragColor = vec4(c.rgb / max(c.a, 0.001) * uDim, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }` });
  const mesh = new THREE.Mesh(g, m); mesh.name = 'crew_impostors'; mesh.userData.rt = rt; mesh.frustumCulled = false; mesh.visible = false; scene.add(mesh);
  let n = 0;
  return { TYPES, mesh, begin() { n = 0; }, push(pos, type, yaw) { if (n >= MAXN) return false; iP.setXYZW(n, pos.x, pos.y, pos.z, yaw); iT.setXY(n, Math.max(0, TYPES.indexOf(type)), 0); n++; return true; },
    end() { g.instanceCount = n; mesh.visible = n > 0; if (n) { iP.needsUpdate = true; iT.needsUpdate = true; } }, set dim(v) { U.uDim.value = v; } };
}
