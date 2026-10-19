// World-life check (FEAT.life): seeds chapter 2, frames base (left) + drill (right) like concept d04ca995,
// saves renders/life.png and N frames to /tmp/lifeframes for an MP4. usage: node tools/life_shot.mjs [frames] [side]
import { chromium } from 'playwright-core'; import { seed } from './ch2_seed.mjs'; import fs from 'fs';
const NF = +(process.argv[2] || 0), SIDE = +(process.argv[3] || 1);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', e => errs.push('ERR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('C ' + m.text().slice(0, 200)); });
await seed(p, process.env.Q || '', { done: ['c2_collect', 'c2_send', 'c2_upgrade', 'c2_help', 'c2_daily', 'c2_deliver'], level: 3, robots: [{ id: 'r1', type: 'builder', xp: 0 }, { id: 'r2', type: 'geologist', xp: 0 }, { id: 'r3e', type: 'engineer', xp: 0 }] });
await p.waitForTimeout(1500);
const info = await p.evaluate(async (SIDE) => {
  const G = MK.game; for (let i = 0; i < 40 && !G.life(); i++) await new Promise(r => setTimeout(r, 250));
  const L = G.life(); if (!L) return { noLife: true };
  const dr = L.meshes.drill.position, ro = L.meshes.rover.position; const B = G.mapData().base || { x: 0, z: 0 };
  const tx = (B.x + dr.x) / 2, tz = (B.z + dr.z) / 2; let nx = -(dr.z - B.z), nz = dr.x - B.x; const nl = Math.hypot(nx, nz); nx = nx / nl * SIDE; nz = nz / nl * SIDE;
  const D = +(new URLSearchParams(location.search).get('cd') || 34), H = +(new URLSearchParams(location.search).get('ch') || 3.2);
  let ux = dr.x - B.x, uz = dr.z - B.z; const ul = Math.hypot(ux, uz); ux /= ul; uz /= ul; const MODE = new URLSearchParams(location.search).get('cm') || 'drill'; let cx = tx - nx * D, cz = tz - nz * D; if (MODE === 'drill') { const back = +(new URLSearchParams(location.search).get('cb') || 14), lat = +(new URLSearchParams(location.search).get('cl') || 9); cx = dr.x + ux * back + nx * lat; cz = dr.z + uz * back + nz * lat; } const lx = MODE === 'drill' ? B.x + nx * 6 : tx, lz = MODE === 'drill' ? B.z + nz * 6 : tz; const kx = cx + (lx - cx) * 0.18, kz = cz + (lz - cz) * 0.18;
  G.teleport(kx, kz, Math.atan2(cx - kx, cz - kz) + 0.5, true); const gy = MK.ctrl.pos.y;
  window.__camFix = () => { const C = MK.camera; MK.ctrl.camFree = false; C.position.set(cx, gy + H, cz); C.lookAt(lx, gy + H + 1, lz); C.fov = 60; C.updateProjectionMatrix(); };
  window.__camFix(); setInterval(window.__camFix, 30);
  return { B, dr: [dr.x, dr.z], ro: [ro.x, ro.z], cam: [cx, cz], vis: Object.fromEntries(Object.entries(L.meshes).map(([k, m]) => [k, Array.isArray(m) ? m.map(s => (s.m || s).visible) : m.visible])) };
}, SIDE);
await p.addStyleTag({ content: '#mk-root > *:not(#mk-toasts):not(.mk-toast){visibility:hidden} #joy,#jump,#views,#help,#title,#fuelwrap{display:none !important}' });
await p.waitForTimeout(3000); await p.screenshot({ path: 'renders/life.png' });
if (NF) { fs.rmSync('/tmp/lifeframes', { recursive: true, force: true }); fs.mkdirSync('/tmp/lifeframes'); await p.evaluate(() => { window.__manual = true; }); for (let i = 0; i < NF; i++) { await p.evaluate(() => MK.step(1 / 48, 2)); await p.screenshot({ path: `/tmp/lifeframes/f${String(i).padStart(3, '0')}.jpg`, type: 'jpeg', quality: 85 }); } await p.evaluate(() => { window.__manual = false; }); }
const st = await p.evaluate(() => ({ s: MK.stats ? MK.stats().mainPass : null, top: MK.stats && (window.TOPN = 18, MK.stats().top), cam: MK.camera.position.toArray().map(v => +v.toFixed(1)), free: MK.ctrl.camFree, cat: [MK.ctrl.pos.x, MK.ctrl.pos.z].map(v => +v.toFixed(1)) }));
console.log('LIFEMESH', JSON.stringify(await p.evaluate(() => { const out = []; const C = MK.camera; MK.scene.traverse(o => { if (!o.isMesh && !o.isPoints) return; let a = o, vis = true, life = false; while (a) { if (!a.visible) vis = false; if (/^(world_life|life_)/.test(a.name)) life = true; a = a.parent; } if (!vis || !life) return; const g = o.geometry; const t = g.index ? g.index.count / 3 : g.attributes.position.count / 3; out.push([o.name || o.parent.name, Math.round(t * (o.isInstancedMesh ? o.count : 1)), +o.getWorldPosition(new MK.THREE.Vector3()).distanceTo(C.position).toFixed(0)]); }); return out; })));
if (process.env.NOLIFE) { await p.evaluate(() => { const L = MK.game.life(); L.setVisible(false); L.update = () => { }; L.setVisible = () => { }; (L.meshes.porters || []).forEach(r => r.visible = false); L.pushImp = () => { }; }); await p.waitForTimeout(1500); console.log('NOLIFE', JSON.stringify(await p.evaluate(() => MK.stats().mainPass))); }
console.log(JSON.stringify({ info, st, errs })); await b.close();
