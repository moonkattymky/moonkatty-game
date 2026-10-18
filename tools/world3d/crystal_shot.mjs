// Crystal 1:1 check vs the user's art reference -> renders/crystal_compare.png (reference | ours, same angle | silhouette overlay) + IoU
// usage: node tools/crystal_shot.mjs   (server on :47321; reference mask /tmp/cref_mask.png = filled silhouette of the reference crop, see tools/crystal_refmask.py)
import { chromium } from 'playwright-core';
import { execSync } from 'child_process';
import fs from 'fs';
const ELEV = +(process.argv[2] || 1.15), DIST = +(process.argv[3] || 5.2);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 560, height: 660 } }); const logs = []; p.on('pageerror', e => logs.push(e.message)); p.on('console', x => { if (x.type() === 'error') logs.push(x.text()); });
await p.goto((process.env.MK_BASE || 'http://localhost:47321/index.html') + '?view=play&reset=1&fast=1' + (process.env.QS || '')); await p.waitForFunction(() => window.MK && MK.ready && MK.game && MK.game.ready, null, { timeout: 150000 }); await p.waitForTimeout(800);
await p.addStyleTag({ content: 'body > *:not(#app){display:none !important}' });
// silhouette of the cluster geometry alone, front view (local +z), same camera as the beauty shot
const durl = await p.evaluate(async ([E, D]) => { const { clusterGeometry } = await import('./src/game/crystal.js'); const T = MK.THREE, R = MK.renderer; const W = 560, H = 660;
  const sc = new T.Scene(); sc.add(new T.Mesh(clusterGeometry(), new T.MeshBasicMaterial({ color: 0xffffff, side: T.DoubleSide }))); const cam = new T.PerspectiveCamera(30, W / H, 0.1, 50); cam.position.set(0, E, D); cam.lookAt(0, 0.68, 0);
  const rt = new T.WebGLRenderTarget(W, H); R.setRenderTarget(rt); R.setClearColor(0x000000, 1); R.clear(); R.render(sc, cam); const px = new Uint8Array(W * H * 4); R.readRenderTargetPixels(rt, 0, 0, W, H, px); R.setRenderTarget(null);
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); const im = g.createImageData(W, H); for (let y = 0; y < H; y++) im.data.set(px.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4); g.putImageData(im, 0, 0); return c.toDataURL(); }, [ELEV, DIST]);
fs.writeFileSync('/tmp/crystal_mask.png', Buffer.from(durl.split(',')[1], 'base64'));
// beauty: nearest in-game crystal, camera placed in front of that instance's local +z at the same relative position
const info = await p.evaluate(([E, D]) => { const f = MK.game.crystals(); const s = f.spots; let bi = 0, bd = 1e9; s.forEach((c, i) => { const d = Math.hypot(c.x - MK.ctrl.pos.x, c.z - MK.ctrl.pos.z); if (d < bd && f.alive[i]) { bd = d; bi = i; } });
  const c = s[bi]; const yaw = bi * 2.399, k = 0.85 + 0.3 * ((bi * 0.618) % 1); MK.ctrl.place(c.x - 7 * Math.sin(yaw), c.z - 7 * Math.cos(yaw), 0); MK.ctrl.camFree = false;
  const cam = MK.camera; window.__cs = () => { cam.fov = 30; cam.position.set(c.x + Math.sin(yaw) * D * k, c.y + E * k, c.z + Math.cos(yaw) * D * k); cam.lookAt(c.x, c.y + 0.68 * k, c.z); cam.updateProjectionMatrix(); };
  window.__cs(); window.__csi = setInterval(window.__cs, 16); return { idx: bi, k }; }, [ELEV, DIST]);
if (process.env.HIDEGLOW) await p.evaluate(() => MK.scene.traverse(o => { if (/_glow$/.test(o.name)) o.visible = false; }));
await p.waitForTimeout(2500); await p.evaluate(() => window.__cs()); await p.screenshot({ path: '/tmp/crystal_ours.png' });
const tris = await p.evaluate(() => MK.scene.getObjectByName('game_crystals').geometry.attributes.position.count / 3);
console.log(JSON.stringify({ ...info, tris, logs })); await b.close();
console.log(execSync(`python3 - <<'PY'
from PIL import Image
import numpy as np
ref=Image.open('/tmp/cref_c1.png').convert('RGB')
rm=np.array(Image.open('/tmp/cref_mask.png').convert('L'))>128
om=np.array(Image.open('/tmp/crystal_mask.png').convert('L'))>60
ours=Image.open('/tmp/crystal_ours.png').convert('RGB')
W,H=560,660
def box(m):
  ys,xs=np.where(m); return xs.min(),ys.min(),xs.max(),ys.max()
rb=box(rm); ob=box(om); s=(rb[3]-rb[1])/(ob[3]-ob[1])
def fit(img, resample):
  w,h=img.size; im=img.resize((int(w*s),int(h*s)),resample); cx=(ob[0]+ob[2])/2*s; by=ob[3]*s; tx=(rb[0]+rb[2])/2-cx; ty=rb[3]-by
  c=Image.new(img.mode,(W,H)); c.paste(im,(int(round(tx)),int(round(ty)))); return c
om2=np.array(fit(Image.fromarray((om*255).astype('uint8')),Image.NEAREST))>128; ours2=fit(ours,Image.LANCZOS)
iou=(rm&om2).sum()/(rm|om2).sum()
ov=np.zeros((H,W,3),dtype='uint8'); ov[rm&~om2]=(255,70,70); ov[om2&~rm]=(70,160,255); ov[rm&om2]=(235,235,235)
S=Image.new('RGB',(W*3,H),'#111'); S.paste(ref,(0,0)); S.paste(ours2,(W,0)); S.paste(Image.fromarray(ov),(W*2,0)); S.save('renders/crystal_compare.png')
a=np.array(ours2).astype(float); sel=om2 & (a.sum(2)>30)
px=a[sel]; r=np.array(ref).astype(float)[rm]
print('IoU %.3f'%iou, 'ours mean',px.mean(0).round(), 'p10',np.percentile(px,10,0).round(),'p90',np.percentile(px,90,0).round(), '| ref mean',r.mean(0).round(),'p10',np.percentile(r,10,0).round(),'p90',np.percentile(r,90,0).round())
for y in range(0,H,40):
  def ext(m):
    xs=np.where(m[y])[0]; return (xs.min(),xs.max()) if len(xs) else None
  print(y, 'ref',ext(rm),'ours',ext(om2))
PY`).toString());
