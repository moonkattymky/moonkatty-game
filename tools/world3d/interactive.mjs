import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const logs = [];
// desktop: walk + jetpack
const page = await browser.newPage({ viewport: { width: 1024, height: 576 } });
page.on('pageerror', e => logs.push('PAGEERROR ' + e.message)); page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ' ' + m.text()); });
await page.goto((process.env.MK_BASE || 'http://localhost:47321/index.html') + '?view=play&pr=1');
await page.waitForFunction(() => window.MK && window.MK.ready, null, { timeout: 120000 });
const p0 = await page.evaluate(() => MK.ctrlState());
// warm-up: SwiftShader renders ~1-2 fps, so wait for a few real frames before driving input, then poll for the walk state
await page.waitForFunction(() => MK.frameTimes().n >= 4, null, { timeout: 60000 });
await page.keyboard.down('KeyW'); await page.waitForTimeout(2500);
await page.waitForFunction(() => { const s = MK.ctrlState(); return s.anim === 'walk' || s.anim === 'run'; }, null, { timeout: 15000 }).catch(() => logs.push('WALK-TIMEOUT'));
const p1 = await page.evaluate(() => MK.ctrlState());
await page.keyboard.down('Space'); await page.waitForTimeout(1200);
const p2 = await page.evaluate(() => MK.ctrlState());
await page.screenshot({ path: 'renders/interactive_jetpack.png' });
await page.keyboard.up('Space'); await page.keyboard.up('KeyW'); await page.waitForTimeout(2500);
const p3 = await page.evaluate(() => MK.ctrlState());
console.log(JSON.stringify({ p0, p1, p2, p3, ft: await page.evaluate(() => MK.frameTimes()) }));
// mobile portrait with touch HUD (close the desktop page first: two SwiftShader pages starve each other and the mobile load used to time out)
await page.close();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const m = await ctx.newPage(); m.on('pageerror', e => logs.push('PAGEERROR(m) ' + e.message));
await m.goto((process.env.MK_BASE || 'http://localhost:47321/index.html') + '?view=play', { waitUntil: 'domcontentloaded', timeout: 120000 });
await m.waitForFunction(() => window.MK && window.MK.ready, null, { timeout: 120000 });
await m.waitForTimeout(1500);
await m.screenshot({ path: 'renders/mobile_portrait.png' });
console.log(logs.slice(0, 20).join('\n'));
await browser.close().catch(() => {}); process.exit(0);
