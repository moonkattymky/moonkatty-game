// pick meshes at screen points in the crystal_ingame view: node tools/pick.mjs x,y x,y ...
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1024, height: 576 } });
await p.goto((process.env.MK_BASE || 'http://localhost:47321/index.html') + '?view=concept&shot=1&pr=1'); await p.waitForFunction(() => window.MK && MK.ready, null, { timeout: 180000 });

await p.waitForTimeout(3000);
const pts = process.argv.slice(2).map(s => s.split(',').map(Number));
console.log(await p.evaluate((pts) => { const T = MK.THREE; const rc = new T.Raycaster(); const out = []; for (const [x, y] of pts) { rc.setFromCamera(new T.Vector2(x / 512 - 1, 1 - y / 288), MK.camera); const h = rc.intersectObjects(MK.scene.children, true).filter(h => h.object.visible); out.push([x, y, h.slice(0, 3).map(h => h.object.name + '|' + h.object.type + '|' + h.distance.toFixed(0) + '|' + (h.object.material.flatShading) + '|' + h.object.material.type)]); } return JSON.stringify(out, null, 1); }, pts));
await b.close();
