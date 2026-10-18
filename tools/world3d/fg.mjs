import * as THREE from 'three';
const T = await import('/workspace/moonkatty-world/src/terrain.js'); T.buildTerrain();
const { sd, groundAt, CONCEPT: K } = T;
const cgy = groundAt(K.cat.x, K.cat.z); const ccam = new THREE.PerspectiveCamera(K.fov, 16 / 9, 0.2, 5000);
ccam.position.set(K.cam.x, cgy + K.eye, K.cam.z); ccam.lookAt(K.target.x, cgy + K.eye - K.drop, K.target.z); ccam.updateMatrixWorld(); ccam.updateProjectionMatrix();
const fg = [[2.2, -53.5, 1.1], [5.5, -54.5, 1.9], [0.5, -50.5, 1.0], [8.5, -51, 1.6], [3.5, -48, 1.4], [-6.5, -56, 1.0], [-8.5, -52, 2.0], [11, -57, 2.3], [-3, -46, 1.6], [6, -44, 1.5], [-12, -47, 1.8], [24, -54, 1.8], [-14, -58, 2.6], [-18, -52, 3.4], [-11, -62, 1.8], [15, -36, 1.8], [9, -40, 1.2], [-6, -40, 1.4], [1, -42, 1.0], [19, -30, 1.6], [16, -58, 2.6], [21, -50, 2.2], [-20, -60, 2.8], [-9, -44, 2.4]];
for (const [s, d, sz] of fg) { const p = sd(s, d); const v = new THREE.Vector3(p.x, groundAt(p.x, p.z) + sz * 0.8, p.z).project(ccam); const g = new THREE.Vector3(p.x, groundAt(p.x, p.z), p.z).project(ccam); console.log(s, d, sz, 'top px', ((v.x * .5 + .5) * 1024).toFixed(0), ((.5 - v.y * .5) * 576).toFixed(0), 'base py', ((.5 - g.y * .5) * 576).toFixed(0), v.z > 1 ? 'BEHIND' : ''); }
