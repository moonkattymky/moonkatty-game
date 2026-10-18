import { chromium } from 'playwright-core'; import { seed } from './ch2_seed.mjs';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 640, height: 360 } }); const errs = []; p.on('pageerror', e => errs.push('ERR ' + e.message)); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push('C ' + m.text().slice(0, 300)); });
await seed(p, '', { done: ['c2_collect', 'c2_home', 'c2_send', 'c2_upgrade', 'c2_help', 'c2_daily', 'c2_deliver', 'c2_l3'], level: 3 });
console.log(await p.evaluate(async () => { const G = MK.game; G.ch2.startStorm(); G.ch2.stepStorm(8); const sh = G.ch2.shield; const tr = sh.root.children[1]; const g = tr.geometry; return JSON.stringify({ vis: tr.visible, n: g.instanceCount, head: Array.from(g.attributes.iHead.array.slice(0, 6)), dir: Array.from(g.attributes.iDir.array.slice(0, 8)), cam: MK.camera.position, st: sh.state }); }));
await p.evaluate(() => { const sh = MK.game.ch2.shield; const g = sh.root.children[1].geometry; const h = g.attributes.iHead.array; MK.ctrl.camFree = false; setInterval(() => { const C = MK.camera; C.position.set(h[3] + 40, h[4] + 5, h[5] + 40); C.lookAt(h[3], h[4], h[5]); }, 20); });
await p.addStyleTag({ content: '#mk-root{display:none !important}' }); await p.waitForTimeout(3000); await p.screenshot({ path: '/tmp/trail.png' });
console.log(errs.join('\n')); await b.close();
