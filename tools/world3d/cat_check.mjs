import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 576 } }); const logs = [];
page.on('pageerror', e => logs.push('PAGEERROR ' + e.message)); page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ' ' + m.text()); });
await page.goto((process.env.MK_BASE || 'http://localhost:47321/index.html') + '?view=play&pr=1');
await page.waitForFunction(() => window.MK && window.MK.ready, null, { timeout: 150000 });
// snapshot: local quaternions of ear/tail bones + world position of the tail tip (last tail bone) and ear tips
const snap = () => page.evaluate(() => { const q = {}, w = {}; let tip = null, arm = null; MK.scene.traverse(o => { if (!arm && o.isBone && !o.parent.isBone) arm = o.parent; }); arm.updateWorldMatrix(true, true); const rel = v => arm.worldToLocal(v).toArray(); MK.scene.traverse(o => { if (o.isBone && /^(ear_|tail)/i.test(o.name)) { q[o.name] = o.quaternion.toArray(); if (/tail/i.test(o.name) && (!tip || o.name > tip.name)) tip = o; if (/^ear_/i.test(o.name)) { o.updateWorldMatrix(true, false); const p = o.localToWorld(new o.position.constructor(0, 0.1, 0)); w[o.name + '_tip'] = rel(p); } } }); if (tip) { tip.updateWorldMatrix(true, false); w[tip.name + '_tip'] = rel(tip.localToWorld(new tip.position.constructor(0, 0.1, 0))); } return { q, w }; });
// wait until the page has rendered at least n more animation frames (SwiftShader frames are slow and irregular)
const frames = (n) => page.evaluate((n) => new Promise(res => { let k = 0; const f = () => (++k >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const diff = (a, b) => { const out = []; for (const k in a.q) { const x = a.q[k], y = b.q[k]; const dot = Math.min(1, Math.abs(x[0]*y[0]+x[1]*y[1]+x[2]*y[2]+x[3]*y[3])); const deg = 2 * Math.acos(dot) * 180 / Math.PI; if (deg > 0.05) out.push(k + ' ' + deg.toFixed(2) + '°'); } for (const k in a.w) { const d = Math.hypot(...a.w[k].map((v, i) => v - b.w[k][i])); out.push(k + ' moved (cat-local) ' + (d * 100).toFixed(1) + 'cm'); } return out.join(', '); };
const a0 = await snap(); await frames(4); await page.waitForTimeout(300); const a1 = await snap();
console.log('idle ear/tail rotation:', diff(a0, a1) || 'NONE');
await page.keyboard.down('KeyW'); await page.waitForTimeout(3000); console.log('walk', JSON.stringify(await page.evaluate(() => MK.ctrlState())));
const b0 = await snap(); await frames(3); const b1 = await snap(); console.log('walk ear/tail rotation:', diff(b0, b1) || 'NONE');
await page.keyboard.down('ShiftLeft'); await page.waitForTimeout(2500); console.log('run', JSON.stringify(await page.evaluate(() => MK.ctrlState())));
await page.keyboard.up('ShiftLeft'); await page.keyboard.up('KeyW');
console.log('LOGS', JSON.stringify(logs));
await browser.close().catch(() => {}); process.exit(0);
