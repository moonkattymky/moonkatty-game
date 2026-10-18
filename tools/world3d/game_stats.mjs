// Budgets with the game layer ON (no ?shot): play start + hub quest marker (beacon + crystals in view).
// usage: node tools/game_stats.mjs phone|phonelow|desktop
import { chromium } from 'playwright-core';
const m = process.argv[2] || 'phone'; const PH = m !== 'desktop';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const p = await b.newPage(PH ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : { viewport: { width: 1024, height: 576 } });
const logs = []; p.on('pageerror', e => logs.push('PAGEERROR ' + e.message)); p.on('console', x => { if (x.type() === 'error') logs.push(x.text()); });
const go = async (q) => { await p.goto((process.env.MK_BASE || 'http://localhost:47321/index.html') + '?view=play&pr=1' + q + (m === 'phonelow' ? '&q=low' : '')); await p.waitForFunction(() => window.MK && MK.ready && MK.game && MK.game.ready, null, { timeout: 150000 }); await p.waitForTimeout(1500); };
const st = async (label) => { const s = await p.evaluate(() => MK.stats()); const r = await p.evaluate(() => { const objs = []; MK.scene.traverse(o => { if (/^game_/.test(o.name)) objs.push([o, o.visible]); }); objs.forEach(([o]) => o.visible = false); const s = MK.stats(); objs.forEach(([o, v]) => o.visible = v); return s.mainPass; }); console.log(m, label, 'main', JSON.stringify(s.mainPass), 'frame', JSON.stringify(s.wholeFrameInclPost), '| same camera, game objects hidden: main', JSON.stringify(r)); };
await go('&reset=1'); await st('play-start(arrow)');
// hub quest: jump the chain to the reactor console and frame beacon + hub crystals
await p.evaluate(async () => { const s = MK.game.state(); });
await p.evaluate(() => { MK.game.teleportToTarget(); }); await p.waitForFunction(() => MK.game.state().ch1.idx >= 1, null, { timeout: 60000 });
for (let k = 0; k < 5; k++) { const before = await p.evaluate(() => MK.game.state().stats.crystals); await p.evaluate(() => { const t = MK.game.target(); MK.game.teleport(t.x, t.z); }); await p.waitForFunction((bb) => MK.game.state().stats.crystals > bb, before, { timeout: 30000 }); }
await p.waitForFunction(() => MK.game.state().ch1.idx >= 2, null, { timeout: 60000 });
await p.evaluate(() => { const t = MK.game.target(); const l = Math.hypot(t.x, t.z); const x = t.x + t.x / l * 26 + 3, z = t.z + t.z / l * 26; MK.game.teleport(x, z, Math.atan2(t.x - x, t.z - z)); }); await p.waitForTimeout(3000);
await st('hub-marker(beacon+crystals)');
await p.evaluate(() => MK.game.shiftDay(1)); await p.evaluate(() => MK.setView('play')); await p.waitForTimeout(2500); await st('play-start(all crystals respawned)');
console.log('LOGS', JSON.stringify(logs)); await b.close();
