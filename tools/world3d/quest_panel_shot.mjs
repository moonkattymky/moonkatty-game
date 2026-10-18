// quest panel check: phone 390x844 + desktop 1280x720 -> renders/qp_phone.png, qp_desktop.png (+ bounding rect of #mk-track)
import { chromium } from 'playwright-core';
const base = process.argv[2] || `http://localhost:${process.env.MKPORT || 47321}/index.html`;
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const out = {};
for (const [name, vp] of [['phone', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }], ['desktop', { viewport: { width: 1280, height: 720 } }]]) {
  const p = await b.newPage(vp); const logs = []; p.on('pageerror', e => logs.push(e.message)); p.on('console', m => { if (m.type() === 'error') logs.push(m.text()); });
  await p.goto(base + (base.includes('?') ? '&' : '?') + 'view=play&reset=1' + (process.env.LANGQ || ''));
  await p.waitForFunction(() => window.MK && MK.ready && MK.game && MK.game.ready, null, { timeout: 150000 });
  await p.waitForTimeout(4000); await p.screenshot({ path: `renders/qp_${name}.png` });
  const r = await p.evaluate(() => { const e = document.querySelector('#mk-track'); const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, vw: innerWidth, vh: innerHeight, txt: e.innerText.slice(0, 120) }; });
  await p.evaluate(() => document.querySelector('#mk-track').click()); await p.waitForTimeout(500);
  const r2 = await p.evaluate(() => { const b = document.querySelector('#mk-track').getBoundingClientRect(); return { h: b.height }; });
  await p.screenshot({ path: `renders/qp_${name}_expanded.png` });
  out[name] = { ...r, expandedH: r2.h, logs }; await p.close();
}
console.log(JSON.stringify(out)); await b.close();
