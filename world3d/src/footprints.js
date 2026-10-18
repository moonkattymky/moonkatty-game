// Boot-print trail behind the cat: one InstancedMesh ring buffer = 1 draw call, hidden until the first print.
import * as THREE from 'three';

function printTexture() {
  const c = document.createElement('canvas'); c.width = 32; c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#fff';
  const pill = (x, y, w, h) => { g.beginPath(); g.ellipse(x, y, w, h, 0, 0, Math.PI * 2); g.fill(); };
  pill(16, 20, 11, 16); pill(16, 48, 9, 11); // toe + heel pads of the boot sole
  g.globalCompositeOperation = 'destination-out'; g.fillStyle = 'rgba(0,0,0,0.55)';
  for (let y = 8; y < 60; y += 7) g.fillRect(4, y, 24, 2.5); // tread ribs
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export function makeFootprints(scene, groundAt, N = 64) {
  const mat = new THREE.MeshBasicMaterial({ map: printTexture(), color: '#24221f', transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, fog: true });
  mat.onBeforeCompile = (s) => { s.fragmentShader = s.fragmentShader.replace('#include <color_fragment>', '#ifdef USE_INSTANCING_COLOR\n diffuseColor.a *= vColor.r;\n#endif'); };
  mat.customProgramCacheKey = () => 'footprints1';
  const geo = new THREE.PlaneGeometry(0.16, 0.28).rotateX(-Math.PI / 2).rotateY(Math.PI);
  const mesh = new THREE.InstancedMesh(geo, mat, N); mesh.count = 0; mesh.visible = false; mesh.frustumCulled = false; mesh.renderOrder = 1; mesh.name = 'footprints';
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
  scene.add(mesh);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), qy = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), nrm = new THREE.Vector3(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  let head = 0, total = 0, side = 1, last = null;
  function stamp(x, z, yaw) {
    const y = groundAt(x, z), e = 0.25; nrm.set(groundAt(x - e, z) - groundAt(x + e, z), 2 * e, groundAt(x, z - e) - groundAt(x, z + e)).normalize();
    q.setFromUnitVectors(up, nrm).multiply(qy.setFromAxisAngle(up, yaw));
    m.compose(p.set(x, y + 0.015, z), q, one); mesh.setMatrixAt(head, m);
    head = (head + 1) % N; total++; mesh.count = Math.min(total, N); mesh.visible = true;
    for (let i = 0; i < mesh.count; i++) { const age = (head - 1 - i + N) % N; const a = 1 - (i / N) ** 2; mesh.instanceColor.setXYZ(age, a, a, a); }
    mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
  }
  return {
    mesh,
    update(pos, yaw, onGround, speed) {
      if (!onGround || speed < 0.6) { if (!onGround) last = null; return; }
      if (!last) { last = pos.clone(); return; }
      if (last.distanceToSquared(pos) < 0.42 * 0.42) return;
      const dx = pos.x - last.x, dz = pos.z - last.z, h = Math.atan2(dx, dz); last.copy(pos); side = -side;
      stamp(pos.x + Math.cos(h) * 0.13 * side, pos.z - Math.sin(h) * 0.13 * side, h);
    },
  };
}
