// Close-ups of the cat at the canyon boulder from the bug report (the one it used to be buried in):
// 1) walked into it -> stops against its flank   2) jetpacked onto it -> stands on top.  Real controller input, no placement hacks.
// usage: node tools/boulder_closeup.mjs   (server on :47321) -> renders/boulder_beside.png, renders/boulder_on_top.png
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const logs = []; p.on('pageerror', e => logs.push(e.message)); p.on('console', m => { if (m.type() === 'error') logs.push(m.text()); });
await p.goto((process.env.MK_BASE || 'http://localhost:47321/index.html') + '?view=play&reset=1&fast=1'); await p.waitForFunction(() => window.MK && MK.ready && MK.game && MK.game.ready, null, { timeout: 150000 });
await p.addStyleTag({ content: 'body > *:not(#app){display:none !important}' });
const info = await p.evaluate(async () => { const T = await import('./src/terrain.js'); window.__T = T;
  const t = window.__gamePlaces.canyonPad; const x0 = t.x - 14.3, z0 = t.z + 37.4; let bb = null; // tallest rock at the old (buried) teleport spot
  MK.rocks.kinds.rockA.items.forEach(it => { if (Math.hypot(it.x - x0, it.z - z0) > it.r + 1) return; const h = MK.solids.top(it.x, it.z, 0.5) - T.groundAt(it.x, it.z); if (!bb || h > bb.h) bb = { x: it.x, z: it.z, r: it.r, h }; });
  window.__bb = bb; return { bb, oldSpot: [x0, z0] }; });
const run = (fn, a) => p.evaluate(fn, a);
// 1) walk into the boulder from the canyon floor (same side as the old teleport spot)
const beside = await run(({ }) => { const c = MK.ctrl, bb = window.__bb, T = window.__T; c.camFree = false; c.speedMul = 1;
  // try approach directions until the cat ends up stopped against the flank with its feet on the canyon floor (clearest "blocked" picture)
  let dir = 0, bumps = 0; const tryDir = (a0) => { c.place(bb.x + Math.cos(a0) * 7, bb.z + Math.sin(a0) * 7, 0);
    dir = Math.atan2(bb.z - c.pos.z, bb.x - c.pos.x); c.camYaw = Math.atan2(-Math.cos(dir), -Math.sin(dir)); bumps = 0; for (let k = 0; k < 90; k++) { c.joy.set(0, 0.6); c.update(1 / 30); if (c.bumped) bumps++; } c.joy.set(0, 0); for (let k = 0; k < 20; k++) c.update(1 / 30);
    return bumps > 10 && !c.bumpedOnTop ? (c.pos.y - T.groundAt(c.pos.x, c.pos.z)) + Math.hypot(c.pos.x - bb.x, c.pos.z - bb.z) * 0.1 : 1e9; };
  let best = 0, bs = 1e9; for (let i = 0; i < 24; i++) { const sc = tryDir(i / 24 * 6.283); if (sc < bs) { bs = sc; best = i / 24 * 6.283; } } tryDir(best);
  const side = dir + Math.PI / 2; const cam = MK.camera; const cx = c.pos.x + Math.cos(side) * 4.2 - Math.cos(dir) * 1.0, cz = c.pos.z + Math.sin(side) * 4.2 - Math.sin(dir) * 1.0; cam.position.set(cx, Math.max(T.groundAt(cx, cz), MK.solids.top(cx, cz, 0.3), c.pos.y) + 1.0, cz); cam.lookAt((c.pos.x + bb.x) / 2, c.pos.y + 0.7, (c.pos.z + bb.z) / 2); cam.fov = 50; cam.updateProjectionMatrix();
  return { pos: c.pos.toArray(), bumps, gap: Math.hypot(c.pos.x - bb.x, c.pos.z - bb.z), feetAboveGround: c.pos.y - T.groundAt(c.pos.x, c.pos.z) }; }, {});
await p.waitForTimeout(3000); await p.screenshot({ path: 'renders/boulder_beside.png' });
// 2) jetpack onto it: hold JET while walking at the boulder, release over the top, land
const top = await run(({ }) => { const c = MK.ctrl, bb = window.__bb, T = window.__T; const dir = Math.atan2(bb.z - c.pos.z, bb.x - c.pos.x); c.camYaw = Math.atan2(-Math.cos(dir), -Math.sin(dir));
  for (let k = 0; k < 200; k++) { const d = Math.hypot(bb.x - c.pos.x, bb.z - c.pos.z); c.jumpHeld = k < 14; c.joy.set(0, d > 0.6 ? Math.min(0.7, d) : 0); c.update(1 / 30); if (k > 30 && c.onGround && d < 0.8) break; } c.jumpHeld = false; c.joy.set(0, 0); for (let k = 0; k < 30; k++) c.update(1 / 30);
  const side = dir + Math.PI / 2 + 0.4; const cam = MK.camera; const cx = c.pos.x + Math.cos(side) * 5.2, cz = c.pos.z + Math.sin(side) * 5.2; cam.position.set(cx, c.pos.y + 1.4, cz); cam.lookAt(c.pos.x, c.pos.y + 0.2, c.pos.z); cam.fov = 50; cam.updateProjectionMatrix();
  return { pos: c.pos.toArray(), onGround: c.onGround, feetAboveTerrain: c.pos.y - T.groundAt(c.pos.x, c.pos.z), boulderTopAboveTerrain: bb.h }; }, {});
await p.waitForTimeout(3000); await p.screenshot({ path: 'renders/boulder_on_top.png' });
console.log(JSON.stringify({ ...info, beside, top, logs }, null, 1)); await b.close();
