import * as THREE from 'three';
const T = await import('../src/terrain.js'); T.buildTerrain();
const { Builder } = await import('../src/builder.js');
const { buildHub } = await import('../src/base.js');
const b = new Builder(); const orig = b.add.bind(b); const st = {};
b.add = (grp, g, o) => { const r = orig(grp, g, o); const k = grp + ':' + g.type + (g.parameters && g.parameters.tubularSegments ? '/' + g.parameters.radialSegments + 'x' + g.parameters.tubularSegments : ''); st[k] = (st[k] || 0) + r.attributes.position.count / 3; return r; };
buildHub(b, []);
console.log(Object.entries(st).sort((a, b) => b[1] - a[1]).slice(0, 25));
