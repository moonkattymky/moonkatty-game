import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
for (const q of ['', '&q=mobile', '&q=low']) { const p = await b.newPage(); await p.goto((process.env.MK_BASE || 'http://localhost:47321/index.html') + '?view=play&fast=1' + q); await p.waitForFunction(() => window.MK && MK.ready && MK.game && MK.game.ready, null, { timeout: 150000 });
  console.log(q || 'desktop', await p.evaluate(() => JSON.stringify({ builder: MK.game.robot().tris, ...(MK.game.robotTris ? MK.game.robotTris() : {}) }))); await p.close(); }
await b.close();
