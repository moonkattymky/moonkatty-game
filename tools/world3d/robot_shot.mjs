// Builder robot vs approved concept, same angle -> renders/robot_compare.png (concept | ours | silhouette overlay) + silhouette IoU
// usage: node tools/robot_shot.mjs [yaw=0.28] [elev=1.1]   (server on :47321; concept mask /tmp/ref_mask.png from rembg)
import { chromium } from 'playwright-core'; import { execSync } from 'child_process';
const yaw = +(process.argv[2] || 0.28), elev = +(process.argv[3] || 1.1);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 330, height: 450 }, deviceScaleFactor: 2 }); const logs = []; p.on('pageerror', e => logs.push(e.message)); p.on('console', m => { if (m.type() === 'error') logs.push(m.text()); });
await p.goto((process.env.MK_BASE || 'http://localhost:47321/index.html') + '?view=play&reset=1&fast=1'); await p.waitForFunction(() => window.MK && MK.ready && MK.game && MK.game.ready, null, { timeout: 150000 });
await p.addStyleTag({ content: 'body > *:not(#app){display:none !important}' });
const info = await p.evaluate(async ([yaw, elev]) => { const { makeRobot } = await import('./src/game/robot.js?' + Date.now()); const r = makeRobot(MK.scene, MK.env);
  const old = MK.scene.getObjectByName('game_robot'); if (old && old !== r.root) old.visible = false;
  const T = await import('./src/terrain.js'); const c = MK.ctrl; c.camFree = false; const x = c.pos.x + 4, z = c.pos.z + 3; c.place(c.pos.x - 6, c.pos.z - 6, 0); r.root.visible = true; r.root.position.set(x, T.groundAt(x, z), z);
  const sunYaw = -1.25; r.root.rotation.y = sunYaw + yaw; window.__rb = r; const cam = MK.camera; const D = 3.5;
  cam.position.set(x + Math.sin(sunYaw) * D, r.root.position.y + elev, z + Math.cos(sunYaw) * D); cam.lookAt(x, r.root.position.y + 0.84, z); cam.fov = 30; cam.updateProjectionMatrix();
  window.__rbi = setInterval(() => r.update(1 / 30, 'weld'), 33); return { tris: r.tris }; }, [yaw, elev]);
await p.waitForTimeout(3000); await p.screenshot({ path: '/tmp/robot_ours.png' });
const durl = await p.evaluate(() => { clearInterval(window.__rbi); const r = window.__rb, T = MK.THREE, R = MK.renderer, cam = MK.camera;
  const W = 660, H = 900; const rt = new T.WebGLRenderTarget(W, H); const sc = new T.Scene(); const prevParent = r.root.parent; sc.add(r.root); sc.overrideMaterial = new T.MeshBasicMaterial({ color: 0xffffff });
  const fl = r.root.getObjectByName('game_robot_flame'); if (fl) fl.visible = false; const a = cam.aspect; cam.aspect = W / H; cam.updateProjectionMatrix();
  R.setRenderTarget(rt); R.setClearColor(0x000000, 1); R.clear(); R.render(sc, cam); const px = new Uint8Array(W * H * 4); R.readRenderTargetPixels(rt, 0, 0, W, H, px); R.setRenderTarget(null); cam.aspect = a; cam.updateProjectionMatrix(); prevParent.add(r.root);
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); const im = g.createImageData(W, H); for (let y = 0; y < H; y++) im.data.set(px.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4); g.putImageData(im, 0, 0); return c.toDataURL(); });
(await import('fs')).writeFileSync('/tmp/robot_mask.png', Buffer.from(durl.split(',')[1], 'base64'));
console.log(JSON.stringify({ ...info, logs })); await b.close();
const out = execSync(`python3 - <<'PY'
from PIL import Image, ImageChops
import numpy as np
ref=Image.open('/cursor/stores/store-aec859c9-8de3-4a87-9ebb-d27a70ea91ac/grok-bot/agents/2e137442-742f-420a-bc0f-9f91777db88f/attachments/c3d81f09779a9361ef30d51172aa3f67f27c68a31a35dc7fbacc29f1efa25705.jpg').convert('RGB').crop((30,160,360,610)).resize((660,900),Image.LANCZOS)
rm=np.array(Image.open('/tmp/ref_mask.png').convert('L').resize((660,900)))>128
om=np.array(Image.open('/tmp/robot_mask.png').convert('L'))>60
ours=Image.open('/tmp/robot_ours.png').convert('RGB')
def box(m):
  ys,xs=np.where(m); return xs.min(),ys.min(),xs.max(),ys.max()
# align ours to the concept by bounding box height (scale) + bottom-centre (translate); hose/beam included in both
rb=box(rm); ob=box(om); s=(rb[3]-rb[1])/(ob[3]-ob[1])
def fit(img, resample):
  W,H=img.size; im=img.resize((int(W*s),int(H*s)),resample); cx=(ob[0]+ob[2])/2*s; by=ob[3]*s; tx=(rb[0]+rb[2])/2-cx; ty=rb[3]-by
  c=Image.new(img.mode,(660,900)); c.paste(im,(int(tx),int(ty))); return c
om2=np.array(fit(Image.fromarray((om*255).astype('uint8')),Image.NEAREST))>128; ours2=fit(ours,Image.LANCZOS)
iou=(rm&om2).sum()/(rm|om2).sum()
ov=np.zeros((900,660,3),dtype='uint8'); ov[rm&~om2]=(255,70,70); ov[om2&~rm]=(70,160,255); ov[rm&om2]=(235,235,235)
S=Image.new('RGB',(660*3,900),'#111'); S.paste(ref,(0,0)); S.paste(ours2,(660,0)); S.paste(Image.fromarray(ov),(1320,0)); S.save('renders/robot_compare.png')
print('IoU %.3f'%iou)
PY`).toString(); console.log(out.trim());
