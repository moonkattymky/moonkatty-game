// gd: sky frames (default play view, a look up toward the Earth, a look at the orbital satellite). HUD hidden, frozen frames.
// usage: MKPORT=47410 node tools/world3d/gd_pr159_sky_shot.mjs <outPrefix> [desktop|phone]
import { chromium } from 'playwright-core'; import { pageUrl } from './baseurl.mjs';
const out = process.argv[2] || '/tmp/gd159/sky'; const PH = process.argv[3] === 'phone';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
try {
  const p = await b.newPage(PH ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : { viewport: { width: 1024, height: 576 } });
  const errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto(pageUrl() + '?view=play&pr=1&reset=1&fast=1'); await p.waitForFunction(() => window.MK && MK.ready && MK.game && MK.game.ready, null, { timeout: 180000 });
  await p.waitForTimeout(2500);
  await p.addStyleTag({ content: '#mk-root > *{visibility:hidden} #joy,#jump,#views,#help,#title,#fuelwrap{display:none !important} .hud{display:none !important}' });
  const st = async (tag) => { const s = await p.evaluate(() => { window.__manual = true; MK.step(1 / 60, 4); return MK.stats().mainPass; }); await p.screenshot({ path: `${out}_${tag}.png` }); return s; };
  const res = { play: await st('play') };
  const aim = (name) => p.evaluate((name) => { const T3 = MK.THREE, C = MK.camera; let tgt = null; if (name === 'earth') { const sky = MK.scene.getObjectByName('sky'); sky.traverse(o => { if (!tgt && o.isMesh && o.geometry.parameters && o.geometry.parameters.radius === 1) tgt = o.getWorldPosition(new T3.Vector3()); }); } else { const a = MK.scene.getObjectByName('ark'); tgt = a.getWorldPosition(new T3.Vector3()); }
    MK.ctrl.camFree = false; const c = MK.ctrl.pos.clone(); c.y += 1.7; const d = tgt.clone().sub(c).normalize(); const yaw = Math.atan2(d.x, d.z) - (name === 'earth' ? 0.3 : 0), el = Math.asin(d.y) - (name === 'earth' ? 0.12 : 0);
    C.position.copy(c).addScaledVector(new T3.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), -4); C.fov = 50; C.updateProjectionMatrix(); C.lookAt(C.position.clone().add(new T3.Vector3(Math.sin(yaw) * Math.cos(el), Math.sin(el), Math.cos(yaw) * Math.cos(el)))); }, name);
  await aim('earth'); res.earth = await st('earth');
  await aim('ark'); res.sat = await st('sat');
  console.log(JSON.stringify({ res, errors: errors.slice(0, 3) }));
} finally { await b.close(); }
