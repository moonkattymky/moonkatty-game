import { chromium } from 'playwright-core';
const u = process.argv[2];
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 } }); const errs = []; p.on('pageerror', e => errs.push('ERR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('C ' + m.text().slice(0, 200)); });
await p.goto(u); await p.waitForFunction(() => window.MK && MK.ready && MK.game && MK.game.ready, null, { timeout: 150000 }); await p.waitForTimeout(3000);
console.log(JSON.stringify({ v: await p.evaluate(() => [...document.scripts].map(s => s.src).find(s => /main\.js/.test(s))), save: await p.evaluate(() => MK.game.state().v), quest: await p.evaluate(() => MK.game.quest()), errs })); await b.close();
