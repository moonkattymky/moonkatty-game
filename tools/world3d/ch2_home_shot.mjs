import { chromium } from 'playwright-core'; import { seed } from './ch2_seed.mjs'; import { execSync } from 'child_process';
const q = process.argv[2] || '';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', e => errs.push('ERR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('C ' + m.text().slice(0, 200)); });
await seed(p, q, { done: ['c2_collect'], level: 3, museum: ['ancient:tablet', 'ancient:idol', 'meteor:geode', 'station:helmet'] });
const info = await p.evaluate(async () => { const G = MK.game, H = G.ch2.home(); G.teleport(H.outside.x, H.outside.z); await new Promise(r => setTimeout(r, 300)); await G.ch2.enterHome(); const h = G.ch2.home(); const o = h.origin;
  const catP = { x: o.x - 1.9, z: o.z - 1.25 }; MK.ctrl.place(catP.x, catP.z, Math.atan2(1.0, 1.1), false);
  window.__camFix = () => { const C = MK.camera; MK.ctrl.camFree = false; C.position.set(o.x, o.y + 1.35, o.z + 1.9); C.lookAt(o.x, o.y + 1.12, o.z - 3); C.fov = 66; C.updateProjectionMatrix(); }; window.__camFix(); setInterval(window.__camFix, 30);
  const R = MK.renderer.info.render; return { inside: h.inside }; });
await p.addStyleTag({ content: '#mk-root{display:none !important} body > *:not(#app):not(canvas){opacity:0}' });
await p.waitForTimeout(4000);
const st = await p.evaluate(() => { const s = MK.stats(); return { main: s.mainPass, shadow: s.mainPlusShadowPass, frame: s.wholeFrameInclPost }; });
await p.screenshot({ path: `renders/ch2_home${q ? '_' + q.replace(/\W/g, '') : ''}.png` });
console.log(JSON.stringify({ info, st, errs })); await b.close();
if (!q) console.log(execSync(`python3 -c "
from PIL import Image, ImageDraw
a=Image.open('refs/home_concept.jpg').convert('RGB').resize((1280,720)); b=Image.open('renders/ch2_home.png').convert('RGB').resize((1280,720))
S=Image.new('RGB',(2560,760),'#111'); S.paste(a,(0,0)); S.paste(b,(1280,0)); d=ImageDraw.Draw(S); d.text((10,730),'concept (approved)',fill='white'); d.text((1290,730),'in-game v40+ interior (headless SwiftShader render)',fill='white'); S.save('renders/ch2_home_vs_concept.png'); print('ok')
"`).toString());
