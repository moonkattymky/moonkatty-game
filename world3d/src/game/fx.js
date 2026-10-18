import * as THREE from 'three';
import { mergeGeometries } from '../../vendor/three/jsm/utils/BufferGeometryUtils.js';
import { makeCrystalField } from './crystal.js';
// In-world game visuals, kept to 2 always-on draw calls: one quest beacon (beam + ground ring in one mesh) and one crystal InstancedMesh.
// The pickup burst (1 Points object) is only visible for ~0.8 s.

export function makeBeacon(scene) {
  const beam = new THREE.CylinderGeometry(0.55, 0.55, 60, 16, 1, true).translate(0, 30, 0); beam.setAttribute('aK', new THREE.Float32BufferAttribute(new Float32Array(beam.attributes.position.count).fill(0), 1));
  const ring = new THREE.RingGeometry(1.5, 2.1, 32).rotateX(-Math.PI / 2).translate(0, 0.08, 0); ring.setAttribute('aK', new THREE.Float32BufferAttribute(new Float32Array(ring.attributes.position.count).fill(1), 1));
  for (const g of [beam, ring]) g.deleteAttribute('normal');
  const geo = mergeGeometries([beam, ring]);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color('#67d7f0') } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
    vertexShader: 'attribute float aK; varying vec2 vUv; varying float vK; void main(){ vUv = uv; vK = aK; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uTime; uniform vec3 uColor; varying vec2 vUv; varying float vK;
      void main(){ float a;
        if (vK < 0.5) { float y = vUv.y; a = pow(1.0 - y, 1.6) * 0.55 * (0.82 + 0.18 * sin(uTime * 3.0 - y * 18.0)); }
        else { a = 0.85 * (0.65 + 0.35 * sin(uTime * 4.0)); }
        gl_FragColor = vec4(uColor * 1.6 * a, a); }`,
  });
  geo.computeBoundingSphere(); const m = new THREE.Mesh(geo, mat); m.name = 'game_beacon'; m.frustumCulled = true; /* culled when off-screen (bounding sphere follows the distance scale) */ m.renderOrder = 3; m.visible = false; scene.add(m);
  return {
    mesh: m,
    set(p, color) { if (!p) { m.visible = false; return; } m.visible = true; m.position.set(p.x, p.y, p.z); if (color) mat.uniforms.uColor.value.set(color); },
    update(t, camPos) { mat.uniforms.uTime.value = t; if (m.visible) { const d = camPos.distanceTo(m.position); const s = Math.max(1, d / 55); m.scale.set(s, 1, s); } },
  };
}

// daily pickups: blue energy-crystal clusters (see crystal.js), grounded, glow + halo; hidden instance = scale 0
export function makeCrystals(scene, spots) { return makeCrystalField(scene, spots, { scale: 0.95, name: 'game_crystals' }); }

export function makeBurst(scene) {
  const N = 28; const pos = new Float32Array(N * 3), vel = new Float32Array(N * 3);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dot = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })();
  const mat = new THREE.PointsMaterial({ map: dot, color: new THREE.Color(0.35, 1.1, 2.6), size: 0.22, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const pts = new THREE.Points(g, mat); pts.name = 'game_burst'; pts.visible = false; pts.frustumCulled = false; scene.add(pts); let age = 9;
  return {
    fire(x, y, z) { for (let i = 0; i < N; i++) { pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; const a = Math.random() * Math.PI * 2, u = Math.random() * 2 - 1, sp = 2.5 + Math.random() * 3; const r = Math.sqrt(1 - u * u); vel[i * 3] = Math.cos(a) * r * sp; vel[i * 3 + 1] = Math.abs(u) * sp + 1.5; vel[i * 3 + 2] = Math.sin(a) * r * sp; } age = 0; pts.visible = true; },
    update(dt) { if (!pts.visible) return; age += dt; if (age > 0.8) { pts.visible = false; return; } for (let i = 0; i < N; i++) { vel[i * 3 + 1] -= 6 * dt; pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt; } g.attributes.position.needsUpdate = true; mat.opacity = 1 - age / 0.8; },
  };
}
