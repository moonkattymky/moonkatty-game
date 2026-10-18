// Normal gameplay-camera shot of the nearest quest crystal -> renders/crystal_ingame.png. usage: node tools/crystal_ingame.mjs [baseURL]
import { chromium } from 'playwright-core';
const base = process.argv[2] || (process.env.MK_BASE || 'http://localhost:47321/index.html') + '';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1024, height: 576 } }); const logs = []; p.on('pageerror', e => logs.push(e.message)); p.on('console', m => { if (m.type() === 'error') logs.push(m.text()); });
await p.goto(base + (base.includes('?') ? '&' : '?') + 'view=play&reset=1'); await p.waitForFunction(() => window.MK && MK.ready && MK.game && MK.game.ready, null, { timeout: 180000 });
const v = await p.evaluate(() => { const f = MK.game.crystals(); const c = f.spots[0]; const x = c.x + 4.5, z = c.z + 3.5; MK.game.teleport(x, z, Math.atan2(c.x - x, c.z - z)); return document.querySelector('script[src*="main.js"]').getAttribute('src'); });
await p.waitForTimeout(4000); await p.screenshot({ path: 'renders/crystal_ingame.png' }); console.log(JSON.stringify({ v, logs })); await b.close();
