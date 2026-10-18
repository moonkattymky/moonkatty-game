// Chapter-1 budgets (main pass tris / draw calls) per preset at the heaviest activity views. usage: node tools/ch1_stats.mjs desktop|phone|low
import { chromium } from 'playwright-core';
const m = process.argv[2] || 'desktop'; const PH = m !== 'desktop';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const p = await b.newPage(PH ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : { viewport: { width: 1024, height: 576 } });
const logs = []; p.on('pageerror', e => logs.push('PAGEERROR ' + e.message)); p.on('console', x => { if (x.type() === 'error') logs.push(x.text()); });
await p.goto((process.env.MK_BASE || 'http://localhost:47321/index.html') + '?view=play&pr=1&reset=1&fast=1' + (m === 'low' ? '&q=low' : ''));
await p.waitForFunction(() => window.MK && MK.ready && MK.game && MK.game.ready, null, { timeout: 150000 }); await p.waitForTimeout(1500);
const E = (f, a) => p.evaluate(f, a); const out = {};
const st = async (l) => { await p.waitForTimeout(1500); const s = await E(() => { window.TOPN = 10; return MK.stats(); }); out[l] = s.mainPass; console.log(m, l.padEnd(26), JSON.stringify(s.mainPass), JSON.stringify(s.top.slice(0, 8))); };
const look = (x, z, tx, tz) => E(({ x, z, tx, tz }) => MK.game.teleport(x, z, Math.atan2(tx - x, tz - z)), { x, z, tx, tz });
await st('play-start(power out)');
const L = await E(() => MK.game.layout());
await E(() => { const t = { x: 0, z: 0 }; MK.game.teleport(-10.77 + 2, 23.11 + 1, Math.atan2(10, -20)); }); await st('hub-gate');
{ const c = await E(() => window.__gamePlaces.reactorConsole); const l = Math.hypot(c.x, c.z); await look(c.x + c.x / l * 26 + 3, c.z + c.z / l * 26, c.x, c.z); await st('hub-reactor-marker'); }
await E(() => MK.game.auto()); await E(() => MK.game.auto()); // power hook, canyon
{ const o = L.ore[1]; await look(o.x + 8, o.z + 6, o.x, o.z); await st('canyon-mining'); }
{ const c = L.cracks[0]; await look(c.x - c.tx * 12, c.z - c.tz * 12, c.x, c.z); await st('canyon-crack'); }
await E(() => MK.game.auto()); { const z = L.meteor; await look(z.x + 10, z.z + 6, z.x, z.z); await E(() => { const p = MK.ctrl.pos; for (let i = 0; i < 4; i++) MK.game.forceMeteor(p.x - 4 - i * 2, p.z - 3); }); await st('canyon-meteors+parts'); }
for (let i = 0; i < 4; i++) await E(() => MK.game.auto()); // parts, dish, reactor, launch... (launch = sprint)
{ const r = L.rings; await look(L.sprintStart.x, L.sprintStart.z, r[2].x, r[2].z); await E(() => { MK.scene.getObjectByName('game_rings').visible = true; }); await st('launch-sprint-rings'); }
for (let i = 0; i < 3; i++) await E(() => MK.game.auto());
{ const d = L.depot, w = L.weldSpot; const x = w.x + (w.x - d.x) * 2.6 + 2.5, z = w.z + (w.z - d.z) * 2.6 + 1; await look(x, z, d.x, d.z); await st('hub-robot+depot'); }
await E(() => MK.setView('play')); await st('play-start-after-chapter');
console.log('MAX', m, JSON.stringify({ tris: Math.max(...Object.values(out).map(v => v.triangles)), calls: Math.max(...Object.values(out).map(v => v.calls)) }), 'LOGS', JSON.stringify(logs)); await b.close();
