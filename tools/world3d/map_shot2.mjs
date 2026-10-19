// Holo map check (v52): one viewport per run. usage: node tools/map_shot2.mjs [out.png] [w] [h] ; env FOG=0.75 reveals fog inside that radius fraction, MOB=1 phone emulation, CH2=1 seeds chapter 2
import { chromium } from 'playwright-core'; import { execSync } from 'child_process';
const port = process.env.MKPORT || 47321; const OUT = process.argv[2] || 'renders/map_v52.png', W = +(process.argv[3] || 1280), H = +(process.argv[4] || 720), MOB = !!process.env.MOB;
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: W, height: H }, isMobile: MOB, hasTouch: MOB, deviceScaleFactor: MOB ? 2 : 1 }); const logs = []; p.on('pageerror', e => logs.push(e.message)); p.on('console', m => { if (m.type() === 'error') logs.push(m.text()); });
if (process.env.CH2) { const { seed } = await import('./ch2_seed.mjs'); await seed(p, process.env.Q || '', { done: ['c2_collect', 'c2_send'], level: 3, robots: [{ id: 'r1', type: 'builder', xp: 0 }, { id: 'r2', type: 'geologist', xp: 0 }, { id: 'r3e', type: 'engineer', xp: 0 }] }); await p.waitForTimeout(4000); } else { await p.goto(`http://localhost:${port}/index.html?view=play&reset=1&fast=1${process.env.Q || ''}`); await p.waitForFunction(() => window.MK && MK.ready && MK.game && MK.game.ready, null, { timeout: 150000 }).catch(e => logs.push('timeout')); }
await p.waitForTimeout(2000);
const d = await p.evaluate(async (FOG) => { const G = MK.game; const md = G.mapData(); if (FOG) { const f = md.fog, n = Math.sqrt(f.length); for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const x = (i + 0.5) / n * 2 - 1, z = (j + 0.5) / n * 2 - 1; if (Math.hypot(x * 1.0, z * 1.15 + 0.1) < FOG + 0.08 * Math.sin(i * 1.7 + j)) f[j * n + i] = 1; } }
  const m = G.map(); m.show(); window.__fogSum = G.mapData().fog.reduce((a, b) => a + b, 0); await new Promise(r => setTimeout(r, 2500)); const s = m.stats(); return { fogSum: window.__fogSum, tris: s.triangles, calls: s.calls, vpins: [...document.querySelectorAll('.mkm-pin,.mkm-bot,.mkm-cat')].filter(e => e.style.display !== 'none').length, region: md.region.key, rg: md.region, target: md.target, me: md.me, crew: md.crew }; }, +(process.env.FOG || 0));
await p.screenshot({ path: OUT }); console.log(JSON.stringify({ d, logs })); await b.close();
if (process.env.SBS) execSync(`python3 -c "
from PIL import Image
c=Image.open('/cursor/stores/store-aec859c9-8de3-4a87-9ebb-d27a70ea91ac/grok-bot/agents/2e137442-742f-420a-bc0f-9f91777db88f/attachments/09b1aaa3561998f6f73a9f46e9a34145f8855c428e4a1d9645349d36b447198a.jpg').convert('RGB')
a=Image.open('${OUT}').convert('RGB'); h=576; c=c.resize((int(c.width*h/c.height),h)); a=a.resize((int(a.width*h/a.height),h))
S=Image.new('RGB',(c.width+a.width+10,h),(10,10,16)); S.paste(c,(0,0)); S.paste(a,(c.width+10,0)); S.save('${process.env.SBS}')
"`);
