import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 } }); const errs = []; p.on('pageerror', e => errs.push('ERR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('C ' + m.text().slice(0, 300)); });
await p.goto((process.env.MK_BASE || 'http://localhost:47321/index.html') + '?view=play&reset=1&fast=1'); await p.waitForFunction(() => window.MK && MK.ready && MK.game && MK.game.ready, null, { timeout: 150000 });
const G = 'MK.game';
for (let i = 0; i < 12; i++) { const r = await p.evaluate(async () => { const q = MK.game.quest(); if (!q) return null; const ok = await MK.game.auto(); return [q.id, ok]; }); console.log('ch1', JSON.stringify(r)); if (!r) break; }
await p.waitForFunction(() => MK.game.ch2.on, null, { timeout: 60000 });
console.log('ch2 on', await p.evaluate(() => MK.game.ch2.on), JSON.stringify(await p.evaluate(() => MK.game.ch2.quest())));
for (let i = 0; i < 10; i++) { const r = await p.evaluate(async () => { const q = MK.game.ch2.quest(); if (!q) return null; const ok = await MK.game.auto(); return [q.id, ok, MK.game.state().ch2.level, JSON.stringify(MK.game.state().ch2.res)]; }); console.log('ch2', JSON.stringify(r)); if (!r) break; }
console.log(JSON.stringify(await p.evaluate(() => MK.game.ch2.crew())));
await p.screenshot({ path: '/tmp/ch2_quick.png' });
console.log(errs.slice(0, 10).join('\n')); await b.close();
