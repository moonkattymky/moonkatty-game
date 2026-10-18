// Close-up of the blue energy crystals (pickup + mining ore) next to the user's art reference -> renders/crystal_compare.png
import { chromium } from 'playwright-core';
import { execSync } from 'child_process';
const REF = process.argv[2] || '/home/box/agent-data/agents/2e137442-742f-420a-bc0f-9f91777db88f/attachments/18fa7550f1c81a3e4fc1e6c5371175cf18e5c1fb7ec9016607f876b91de70461.png';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 600, height: 600 } }); const logs = []; p.on('pageerror', e => logs.push(e.message)); p.on('console', x => { if (x.type() === 'error') logs.push(x.text()); });
await p.goto((process.env.MK_BASE || 'http://localhost:47321/index.html') + '?view=play&reset=1&fast=1'); await p.waitForFunction(() => window.MK && MK.ready && MK.game && MK.game.ready, null, { timeout: 150000 }); await p.waitForTimeout(800);
const frame = async (sel, d, h, name) => { await p.evaluate(({ sel, d, h }) => { const c = MK.game.crystals().spots[sel]; MK.game.teleport(c.x + 4, c.z + 4); MK.ctrl.camFree = false; const cam = MK.camera; cam.fov = 40; cam.position.set(c.x + d * 0.8, c.y + h, c.z + d * 0.6); cam.lookAt(c.x, c.y + 0.75, c.z); cam.updateProjectionMatrix(); for (const id of ['mk-root', 'views', 'joy', 'jump', 'fuelwrap']) { const e = document.getElementById(id); if (e) e.style.display = 'none'; } }, { sel, d, h }); await p.waitForTimeout(1200); await p.screenshot({ path: name }); };
const idx = await p.evaluate(() => { const s = MK.game.crystals().spots; let b = 0, bd = 1e9; s.forEach((c, i) => { const d = Math.hypot(c.x - MK.ctrl.pos.x, c.z - MK.ctrl.pos.z); if (d < bd) { bd = d; b = i; } }); return b; });
await frame(idx, 3.2, 1.0, '/tmp/crystal_close.png'); await frame(idx, 7, 2.6, '/tmp/crystal_mid.png');
const tris = await p.evaluate(() => MK.scene.getObjectByName('game_crystals').geometry.attributes.position.count / 3);
console.log(JSON.stringify({ tris, logs }));
await b.close();
execSync(`python3 -c "
from PIL import Image
r=Image.open('${REF}').convert('RGB'); a=r.crop((170,760,500,1120)).resize((550,600)); c=Image.open('/tmp/crystal_close.png').convert('RGB'); m=Image.open('/tmp/crystal_mid.png').convert('RGB')
o=Image.new('RGB',(1800,600),(10,10,14)); o.paste(a,(0,10)); o.paste(c,(600,0)); o.paste(m,(1200,0)); o.save('renders/crystal_compare.png')"`);
