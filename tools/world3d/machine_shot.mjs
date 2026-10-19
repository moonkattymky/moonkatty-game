// Close-up of a world-life machine (v51 hand-built LOD check). usage: node tools/machine_shot.mjs rover|drill|welder out.png [dist] [yawDeg] [h]
import { chromium } from 'playwright-core'; import { seed } from './ch2_seed.mjs'; import fs from 'fs';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', e => errs.push('ERR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('C ' + m.text().slice(0, 200)); });
await seed(p, process.env.Q || '', { done: ['c2_collect', 'c2_send', 'c2_upgrade', 'c2_help', 'c2_daily', 'c2_deliver'], level: 3, robots: [{ id: 'r1', type: 'builder', xp: 0 }, { id: 'r2', type: 'geologist', xp: 0 }, { id: 'r3e', type: 'engineer', xp: 0 }] });
const WHO = process.argv[2] || 'rover', OUT = process.argv[3] || 'renders/machine.png', DIST = +(process.argv[4] || 7), YAW = +(process.argv[5] || 35) * Math.PI / 180, H = +(process.argv[6] || 2.2);
await p.waitForTimeout(1500);
const info = await p.evaluate(async ([WHO, DIST, YAW, H]) => { const G = MK.game; for (let i = 0; i < 40 && !G.life(); i++) await new Promise(r => setTimeout(r, 250)); const L = G.life(); const m = L.meshes[WHO];
  const p0 = m.position; G.teleport(p0.x + 3, p0.z + 3, 0, true);
  window.__camFix = () => { const C = MK.camera; MK.ctrl.camFree = false; const ry = m.rotation.y + YAW; const q = m.position; C.position.set(q.x + Math.sin(ry) * DIST, q.y + H, q.z + Math.cos(ry) * DIST); C.lookAt(q.x, q.y + (WHO === 'drill' ? 3 : 1), q.z); C.fov = 50; C.updateProjectionMatrix(); };
  window.__camFix(); setInterval(window.__camFix, 20); return { pos: p0.toArray() }; }, [WHO, DIST, YAW, H]);
await p.addStyleTag({ content: '#mk-root > *:not(#mk-toasts):not(.mk-toast){visibility:hidden} #joy,#jump,#views,#help,#title,#fuelwrap{display:none !important}' });
await p.waitForTimeout(2500); await p.screenshot({ path: OUT });
const NF = +(process.env.NF || 0), DIR = process.env.DIR || '/tmp/mframes'; let maxT = 0;
if (NF) { fs.rmSync(DIR, { recursive: true, force: true }); fs.mkdirSync(DIR, { recursive: true }); await p.evaluate(() => { window.__manual = true; }); for (let i = 0; i < NF; i++) { const s = await p.evaluate((k) => { MK.step(1 / 48, 1); window.__camFix(); MK.step(1 / 48, 1); return k % 24 ? 0 : MK.stats().mainPass.triangles; }, i); maxT = Math.max(maxT, s); await p.screenshot({ path: `${DIR}/f${String(i).padStart(3, '0')}.jpg`, type: 'jpeg', quality: 85 }); } console.log('MAXTRIS', maxT); }
const st = await p.evaluate(() => MK.stats ? MK.stats().mainPass : null); console.log(JSON.stringify({ info, st, errs })); await b.close();
