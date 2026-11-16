// gd: crew close-ups (hi mesh) over time + a crew-group frame + LOD tri counts. usage: MKPORT=47410 node tools/world3d/gd_pr159_crew_shot.mjs <outPrefix> [desktop|phone|low]
import { chromium } from 'playwright-core'; import { seed } from './ch2_seed.mjs';
const out = process.argv[2] || '/tmp/gd159/crew'; const m = process.argv[3] || 'desktop', PH = m !== 'desktop';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const R8 = ['builder', 'geologist', 'engineer', 'archaeologist', 'builder', 'geologist', 'engineer', 'archaeologist'].map((type, i) => ({ id: 'r' + (i + 1), type, xp: 30 }));
try { const p = await b.newPage(PH ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : { viewport: { width: 1024, height: 576 } });
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  await seed(p, '&pr=1' + (m === 'low' ? '&q=low' : ''), { done: ['c2_collect', 'c2_home', 'c2_send', 'c2_upgrade', 'c2_help', 'c2_daily', 'c2_deliver', 'c2_l3'], level: 5, robots: R8 }); await p.waitForTimeout(2500);
  await p.addStyleTag({ content: '#mk-root > *{visibility:hidden} #joy,#jump,#views,#help,#title,#fuelwrap{display:none !important} .hud{display:none !important}' });
  // pick the crew robot nearest the crew centre, stand the cat beside it
  const info = await p.evaluate(() => { const cr = MK.game.ch2.crew(); const c0 = cr[0], c1 = cr[cr.length - 1]; const mx = (c0.x + c1.x) / 2, mz = (c0.z + c1.z) / 2; MK.game.teleport(mx + 6, mz + 4, Math.atan2(-6, -4));
    const L = []; MK.scene.traverse(o => { if (/^crew_/.test(o.name) && o.parent === MK.scene) L.push(o); }); window.__crew = L; return { n: L.length, crew: cr.map(c => c.mode || c.state || '') }; });
  await p.waitForTimeout(1500);
  // two crew frames (play camera behind the cat), three moments each 1.3 s apart (animation)
  const shots = {};
  for (const [v, dx, dz] of [[0, 6, 4], [1, -5, 5]]) { await p.evaluate(({ dx, dz }) => { const cr = MK.game.ch2.crew(); const c0 = cr[0], c1 = cr[cr.length - 1]; const mx = (c0.x + c1.x) / 2, mz = (c0.z + c1.z) / 2; MK.ctrl.camFree = true; MK.game.teleport(mx + dx, mz + dz, Math.atan2(-dx, -dz)); }, { dx, dz }); await p.waitForTimeout(2000);
    for (let k = 0; k < 3; k++) { await p.screenshot({ path: `${out}_v${v}_${k}.png` }); shots[`v${v}_${k}`] = await p.evaluate(() => MK.stats().mainPass); await p.waitForTimeout(1300); } }
  // close-up (camera within the hi-mesh range, camFree off so the controller leaves the camera alone): 12 moments 1 s apart -> idle life / waves
  const CU = process.env.CU ? +process.env.CU : 12; const cu = [];
  const SW = process.env.SWEEP ? +process.env.SWEEP : 0; for (let k = 0; k < CU; k++) { await p.evaluate(({ a, d, t }) => { window.__cuA = a; window.__cuD = d; if (t) window.__cuT = t; }, { d: +(process.env.CUD || 3), a: SW ? (k - CU / 2) * SW : +(process.env.CUA || 0), t: process.env.CUT || '' }); const r = await p.evaluate(() => { const L = window.__crew.filter(o => o.name !== 'crew_impostors'); const T = L.find(o => o.name === 'crew_' + (window.__cuT || 'builder')) || L[0]; if (!T) return null; MK.ctrl.camFree = false; const c = MK.camera; let mx = 0, mz = 0; for (const o of L) { mx += o.position.x / L.length; mz += o.position.z / L.length; } let dx = T.position.x - mx, dz = T.position.z - mz; const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
      const A = Math.atan2(dx, dz) + (window.__cuA ?? 0); c.position.set(T.position.x + Math.sin(A) * (window.__cuD || 3), T.position.y + 2.3 + ((window.__cuD || 3) - 3) * 0.5, T.position.z + Math.cos(A) * (window.__cuD || 3)); c.lookAt((T.position.x * 2 + mx) / 3, T.position.y + 0.6, (T.position.z * 2 + mz) / 3); c.updateMatrixWorld(); return T.name; });
    await p.waitForTimeout(120); await p.screenshot({ path: `${out}_cu_${String(k).padStart(2, '0')}.png` }); cu.push([r, (await p.evaluate(() => MK.stats().mainPass)), await p.evaluate(() => window.__crew.filter(o => o.name !== 'crew_impostors').map(o => { const hi = o.children.find(c => c.isGroup); const pv = hi && hi.children.find(c => c.isGroup); return o.name.slice(5, 8) + (o.visible ? '' : '-') + ':' + (hi ? (hi.visible ? 'H' : 'L') : '?') + (hi ? hi.rotation.y.toFixed(2) : '') + '/' + (pv ? pv.rotation.z.toFixed(2) + ',' + pv.rotation.x.toFixed(2) : ''); }).join(' '))]); await p.waitForTimeout(200); await p.evaluate(() => { for (let i = 0; i < 8; i++) { MK.step(1 / 30, 3); MK.camera.updateMatrixWorld(); } }); }
  shots.cu = cu.slice(0, 2); shots.cuPose = cu.map(c => c[2]);
  const tris = await p.evaluate(() => { const o = {}; for (const r of window.__crew) { let hi = 0, lo = 0; r.traverse(q => { if (q.isMesh && q.geometry) { const t = (q.geometry.index ? q.geometry.index.count : q.geometry.attributes.position.count) / 3; if (q.name === 'crew_lod') lo += t; else hi += t; } }); o[r.name] = [hi | 0, lo | 0]; } return o; });
  const st = await p.evaluate(() => MK.stats().mainPass);
  console.log(JSON.stringify({ info, shots, tris, last: st, errors: errors.slice(0, 3) }));
} finally { await b.close(); }
