import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 576 } });
await page.goto((process.env.MK_BASE || 'http://localhost:47321/index.html') + '?shot=1&pr=1&view=concept');
await page.waitForFunction(() => window.MK && window.MK.ready, null, { timeout: 120000 });
console.log(await page.evaluate(() => { const c = MK.camera; const e = MK.sky.earth; const THREE_V = e.getWorldPosition(e.position.clone()); const p = THREE_V.clone().project(c); const dir = c.getWorldDirection(THREE_V.clone()); return { cam: c.position.toArray(), fov: c.fov, aspect: c.aspect, dir: dir.toArray(), earthScreen: [(p.x * 0.5 + 0.5) * 1024, (0.5 - p.y * 0.5) * 576], earthLocal: e.position.toArray() }; }));
await browser.close().catch(()=>{}); process.exit(0);
