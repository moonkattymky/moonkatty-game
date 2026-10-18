// Post-deploy check of the published 3D chapter on GitHub Pages (no secrets, no real account traffic beyond a rejected auth probe).
// usage: node tools/world3d/live_check.mjs [siteRoot]   -> renders/port_live_*.png
import { chromium } from 'playwright-core';
const SITE = process.argv[2] || 'https://moonkattymky.github.io/moonkatty-game/';
const res = []; const ok = (n, c, i = '') => { res.push(!!c); console.log((c ? 'PASS ' : 'FAIL ') + n + (i ? '  ' + i : '')); };
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const dev = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
const ready = (p) => p.waitForFunction(() => window.MK && MK.ready && MK.game && MK.game.ready, null, { timeout: 240000 });
{ const ctx = await browser.newContext(dev); const p = await ctx.newPage(); const logs = []; p.on('pageerror', e => logs.push('PAGEERROR ' + e.message)); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.text()); });
  const t0 = Date.now(); await p.goto(SITE + 'world3d/?view=play'); await ready(p); const s = ((Date.now() - t0) / 1000).toFixed(1);
  ok('live world3d boots (plain browser, local mode)', true, s + ' s incl. download, swiftshader');
  await p.waitForTimeout(3000); ok('service worker registered', await p.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())));
  ok('no console errors/warnings', logs.length === 0, JSON.stringify(logs.slice(0, 4)));
  ok('dev camera buttons hidden by default', (await p.evaluate(() => getComputedStyle(document.getElementById('views')).display)) === 'none');
  await p.screenshot({ path: 'renders/port_live_world3d.png' });
  await p.goto(SITE + 'world3d/?view=play&debug=1'); await ready(p);
  ok('?debug=1 shows the dev camera buttons', (await p.evaluate(() => getComputedStyle(document.getElementById('views')).display)) === 'flex');
  const t1 = Date.now(); await p.reload(); await ready(p); ok('repeat launch (cache/SW)', true, ((Date.now() - t1) / 1000).toFixed(1) + ' s');
  await ctx.close(); }
{ // fake Telegram launch against the REAL rewards endpoint: forged initData must be rejected and the game must fall back cleanly
  const ctx = await browser.newContext(dev); const p = await ctx.newPage(); const logs = []; let auth = 0;
  p.on('pageerror', e => logs.push('PAGEERROR ' + e.message)); p.on('console', m => { if ((m.type() === 'error' || m.type() === 'warning') && !/status of 401/.test(m.text())) logs.push(m.text()); });
  p.on('response', r => { if (r.url().includes('/functions/v1/rewards') && r.status() === 401) auth++; });
  await p.route('https://telegram.org/js/telegram-web-app.js*', r => r.fulfill({ contentType: 'application/javascript', body: "window.Telegram={WebApp:{initData:'user=%7B%22id%22%3A1%7D&auth_date=1&signature=forged',initDataUnsafe:{},version:'8.0',isVersionAtLeast:()=>true,ready(){},expand(){},disableVerticalSwipes(){},enableClosingConfirmation(){},setHeaderColor(){},setBackgroundColor(){},setBottomBarColor(){},onEvent(){},BackButton:{show(){},hide(){},onClick(){}},HapticFeedback:{impactOccurred(){},notificationOccurred(){},selectionChanged(){}},safeAreaInset:{},contentSafeAreaInset:{}}};" }));
  await p.goto(SITE + 'world3d/?view=play&sw=0'); await ready(p); await p.waitForTimeout(2500);
  ok('forged Telegram initData rejected by live rewards (401) and game still runs', auth > 0 && (await p.evaluate(() => MK.game.state().v)) === 2, '401s: ' + auth);
  ok('no unexpected console errors (CORS/CSP ok)', logs.length === 0, JSON.stringify(logs.slice(0, 4)));
  await ctx.close(); }
{ const ctx = await browser.newContext(dev); const p = await ctx.newPage(); await p.route('https://telegram.org/**', r => r.fulfill({ body: '' }));
  await p.goto(SITE + '?world3d=1', { waitUntil: 'domcontentloaded' }); await p.waitForURL(/world3d\//, { timeout: 30000 }).catch(() => { });
  ok('2D entry ?world3d=1 forwards to world3d/', /\/world3d\//.test(p.url()), p.url());
  const p2 = await ctx.newPage(); await p2.route('https://telegram.org/**', r => r.fulfill({ body: '' })); await p2.goto(SITE, { waitUntil: 'load' }); await p2.waitForTimeout(1500);
  ok('normal 2D launch is not redirected', !/world3d/.test(p2.url()) && (await p2.locator('#languages button').count()) > 0, p2.url());
  await ctx.close(); }
await browser.close(); const n = res.filter(Boolean).length; console.log(`SUMMARY live ${n}/${res.length}`); process.exit(n === res.length ? 0 : 1);
