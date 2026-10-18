import { chromium } from 'playwright-core';
const u = process.argv[2];
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
await p.goto(u); await p.waitForFunction(() => window.MK && MK.ready && MK.game && MK.game.ready, null, { timeout: 150000 }); await p.waitForTimeout(2000);
const s = await p.evaluate(() => { window.TOPN = 40; const s = MK.stats(); return { main: s.mainPass, sh: s.mainPlusShadowPass, frame: s.wholeFrameInclPost, top: s.top }; });
console.log(JSON.stringify({ main: s.main, sh: s.sh, frame: s.frame })); console.log(JSON.stringify(s.top)); await b.close();
