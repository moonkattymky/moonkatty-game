import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const p = await b.newPage(); p.on('console', m => console.log('C', m.type(), m.text().slice(0,200))); p.on('pageerror', e => console.log('ERR', e.message)); p.on('requestfailed', r => console.log('FAIL', r.url()));
await p.goto((process.env.MK_BASE || 'http://localhost:47321/index.html') + '?shot=1&view=play'); await p.waitForTimeout(40000);
console.log('ready', await p.evaluate(() => !!(window.MK && MK.ready)));
await b.close();
