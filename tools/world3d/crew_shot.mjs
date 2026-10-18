// Chapter 2 crew robots vs concept crops -> renders/ch2_robots_compare.png (concept row | hi row | LOD row)
// usage: node tools/crew_shot.mjs [yaw=0.35] [level=1] [q=]
import { chromium } from 'playwright-core'; import { execSync } from 'child_process';
const yaw = +(process.argv[2] || 0.35), level = +(process.argv[3] || 1), q = process.argv[4] || '';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 340, height: 420 }, deviceScaleFactor: 1.5 }); const logs = []; p.on('pageerror', e => logs.push(e.message)); p.on('console', m => { if (m.type() === 'error') logs.push(m.text()); });
await p.goto((process.env.MK_BASE || 'http://localhost:47321/index.html') + '?view=play&reset=1&fast=1' + (q ? '&q=' + q : '')); await p.waitForFunction(() => window.MK && MK.ready && MK.game && MK.game.ready, null, { timeout: 150000 });
await p.addStyleTag({ content: 'body > *:not(#app){display:none !important}' });
const types = ['geologist', 'archaeologist', 'engineer', 'builder']; const info = {};
for (const t of types) for (const lod of [0, 1]) {
  info[t + lod] = await p.evaluate(async ([t, yaw, level, lod]) => { const { makeCrewRobot } = await import('./src/game/robots.js?v=' + (window.__cv ||= Date.now()));
    for (const r of window.__crew || []) r.root.visible = false; const old = MK.scene.getObjectByName('game_robot'); if (old) old.visible = false;
    const r = makeCrewRobot(MK.scene, MK.env, t, level); (window.__crew ||= []).push(r);
    const T = await import('./src/terrain.js'); const c = MK.ctrl; c.camFree = false; window.__sp ||= [c.pos.x + 4, c.pos.z + 3]; const [x, z] = window.__sp; c.place(x - 10, z - 10, 0); r.root.visible = true; r.root.position.set(x, T.groundAt(x, z), z);
    const sunYaw = -1.25; r.root.rotation.y = sunYaw + yaw; const cam = MK.camera; const D = 3.6; cam.position.set(x + Math.sin(sunYaw) * D, r.root.position.y + 1.1, z + Math.cos(sunYaw) * D); cam.lookAt(x, r.root.position.y + 0.8, z); cam.fov = 30; cam.updateProjectionMatrix();
    clearInterval(window.__ci); const far = lod ? new MK.THREE.Vector3(1e4, 0, 0) : cam.position; window.__ci = setInterval(() => r.update(1 / 30, 'idle', far), 33); return { hi: Math.round(r.triHi), lo: Math.round(r.triLo) }; }, [t, yaw, level, lod]);
  await p.waitForTimeout(1800); await p.screenshot({ path: `/tmp/crew_${t}_${lod}.png` }); }
console.log(JSON.stringify({ info, logs })); await b.close();
console.log(execSync(`python3 - <<'PY'
from PIL import Image, ImageDraw
H=420
refs=[Image.open('refs/crop_%s.png'%k).convert('RGB') for k in ['geo','arch','eng','bld']]
refs=[i.resize((int(i.width*H/i.height),H)) for i in refs]
row=lambda ims: ims
W=max(sum(i.width for i in refs), 4*510)
S=Image.new('RGB',(4*510,H*3+60),'#111'); d=ImageDraw.Draw(S)
for k,(t,r) in enumerate(zip(['geologist','archaeologist','engineer','builder'],refs)):
  S.paste(r,(k*510+(510-r.width)//2,0))
  for lod in (0,1):
    im=Image.open('/tmp/crew_%s_%d.png'%(t,lod)).convert('RGB').resize((340*H//420*1,H)); S.paste(im,(k*510+(510-im.width)//2,H*(1+lod)))
  d.text((k*510+10,H*3+10),t,fill='white')
d.text((10,H*3+35),'row1 concept  row2 in-game hi mesh  row3 single-mesh LOD (far / q=low)',fill='#aaa')
S.save('renders/ch2_robots_compare${level>1?'_l'+level:''}${q?'_'+q:''}.png'); print('saved')
PY`).toString());
