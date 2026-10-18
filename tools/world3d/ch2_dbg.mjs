import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 } }); const errs = []; p.on('pageerror', e => errs.push('ERR ' + e.message + e.stack)); p.on('console', m => { errs.push('C ' + m.type() + ' ' + m.text().slice(0, 300)); });
await p.goto((process.env.MK_BASE || 'http://localhost:47321/index.html') + '?view=play&reset=1&fast=1'); await p.waitForFunction(() => window.MK && MK.ready && MK.game && MK.game.ready, null, { timeout: 150000 });
await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('mkty_world_v1')); s.ch1.done = ['power','canyon','crystals','parts','dish','reactor','launch','secret','home']; s.base.built = ['depot']; localStorage.setItem('mkty_world_v1', JSON.stringify(s)); });
await p.goto((process.env.MK_BASE || 'http://localhost:47321/index.html') + '?view=play&fast=1'); await p.waitForFunction(() => window.MK && MK.ready && MK.game && MK.game.ready, null, { timeout: 150000 });
await p.waitForTimeout(3000);
console.log(await p.evaluate(() => JSON.stringify({ on: MK.game.ch2.on, q: MK.game.quest(), q2: MK.game.ch2.quest(), t: MK.game.gameTime(), crew: MK.game.ch2.crew() })));
console.log(errs.slice(0, 15).join('\n')); await b.close();
