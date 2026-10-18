// Silhouette fit of the crystal cluster to the reference mask (/tmp/cref_mask.png): coordinate descent over CLUSTER params, same camera + bbox fit as crystal_shot.mjs
import { chromium } from 'playwright-core'; import fs from 'fs';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 560, height: 660 } }); p.on('pageerror', e => console.log('ERR', e.message));
await p.goto((process.env.MK_BASE || 'http://localhost:47321/index.html') + '?view=play&reset=1&fast=1'); await p.waitForFunction(() => window.MK && MK.ready, null, { timeout: 150000 });
const ref = 'data:image/png;base64,' + fs.readFileSync('/tmp/cref_mask.png').toString('base64');
const res = await p.evaluate(async (ref) => {
  const { buildCluster, CLUSTER } = await import('./src/game/crystal.js'); const T = MK.THREE, R = MK.renderer; const W = 560, H = 660;
  const img = new Image(); img.src = ref; await img.decode(); const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g2 = cv.getContext('2d'); g2.drawImage(img, 0, 0, W, H); const rd = g2.getImageData(0, 0, W, H).data;
  const rm = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) rm[i] = rd[i * 4] > 128 ? 1 : 0;
  const box = (m) => { let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (m[y * W + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return [x0, y0, x1, y1]; };
  const rb = box(rm);
  const sc = new T.Scene(); const mesh = new T.Mesh(new T.BufferGeometry(), new T.MeshBasicMaterial({ color: 0xffffff, side: T.DoubleSide })); sc.add(mesh);
  const cam = new T.PerspectiveCamera(30, W / H, 0.1, 50); cam.position.set(0, 1.15, 5.2); cam.lookAt(0, 0.68, 0); const rt = new T.WebGLRenderTarget(W, H); const px = new Uint8Array(W * H * 4); const om = new Uint8Array(W * H);
  const iou = (list) => { mesh.geometry.dispose(); mesh.geometry = buildCluster(list); R.setRenderTarget(rt); R.setClearColor(0, 1); R.clear(); R.render(sc, cam); R.readRenderTargetPixels(rt, 0, 0, W, H, px); R.setRenderTarget(null);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) om[y * W + x] = px[((H - 1 - y) * W + x) * 4] > 60 ? 1 : 0;
    const ob = box(om); const s = (rb[3] - rb[1]) / (ob[3] - ob[1]); const tx = (rb[0] + rb[2]) / 2 - (ob[0] + ob[2]) / 2 * s, ty = rb[3] - ob[3] * s; let I = 0, U = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const sx = Math.floor((x - tx) / s), sy = Math.floor((y - ty) / s); const o = sx >= 0 && sy >= 0 && sx < W && sy < H ? om[sy * W + sx] : 0; const r = rm[y * W + x]; I += o & r; U += o | r; } return I / U; };
  const L = JSON.parse(JSON.stringify(CLUSTER)); const keys = [[0, 'h', 0.04], [0, 'tip', 0.04], [0, 'r', 0.02], [1, 'x', 0.03], [1, 'h', 0.04], [1, 'r', 0.02], [1, 'tilt', 0.06], [1, 'tip', 0.03], [2, 'x', 0.03], [2, 'h', 0.04], [2, 'r', 0.02], [2, 'tilt', 0.06], [2, 'tip', 0.03], [4, 'x', 0.04], [4, 'r', 0.02], [4, 'tilt', 0.08], [5, 'x', 0.04], [5, 'r', 0.02], [5, 'tilt', 0.08]];
  L[0].tm0 = L[0].tm[0]; L[0].tm1 = L[0].tm[1]; keys.push([0, 'tm0', 0.04], [0, 'tm1', 0.04]); const fix = (l) => l.map((s, i) => i === 0 ? { ...s, tm: [s.tm0, s.tm1] } : s);
  let best = iou(fix(L)); const start = best; let n = 0;
  for (let pass = 0; pass < 4; pass++) for (const [i, k, st0] of keys) { const st = st0 / (pass >= 2 ? 2 : 1); for (const d of [st, -st]) { let improved = true; while (improved) { improved = false; L[i][k] += d; const v = iou(fix(L)); n++; if (v > best + 1e-4) { best = v; improved = true; } else L[i][k] -= d; } } }
  const out = fix(L).map(s => { const o = { ...s }; delete o.tm0; delete o.tm1; for (const k in o) if (typeof o[k] === 'number') o[k] = +o[k].toFixed(3); return o; });
  return { start, best, n, out }; }, ref);
console.log('start', res.start.toFixed(3), 'best', res.best.toFixed(3), 'evals', res.n); console.log(JSON.stringify(res.out)); await b.close();
