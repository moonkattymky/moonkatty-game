// Holo world map render: opens the map (phone landscape-ish 1280x720 + phone portrait) -> renders/map.png, renders/map_phone.png, renders/map_vs_concept.png
import { chromium } from 'playwright-core'; import { execSync } from 'child_process';
const port = process.env.MKPORT || 47321; const lang = process.env.LANGQ || '';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const out = {};
for (const [name, vp, mob] of [['map', { width: 1280, height: 720 }, false], ['map_phone', { width: 390, height: 780 }, true]]) {
  const p = await b.newPage({ viewport: vp, isMobile: mob, hasTouch: mob, deviceScaleFactor: mob ? 2 : 1 }); const logs = []; p.on('pageerror', e => logs.push(e.message)); p.on('console', m => { if (m.type() === 'error') logs.push(m.text()); });
  await p.goto(`http://localhost:${port}/index.html?view=play&reset=1${lang}`); await p.waitForFunction(() => window.MK && MK.ready && MK.game && MK.game.ready, null, { timeout: 150000 }).catch(e => logs.push('timeout'));
  await p.waitForTimeout(2500);
  const d = await p.evaluate(() => { const G = MK.game; return new Promise(r => setTimeout(() => { document.querySelector('#mk-map').click(); setTimeout(() => { const m = G.map(); r({ dbg: m.dbg(), vpins: [...document.querySelectorAll('.mkm-pin,.mkm-bot,.mkm-cat')].filter(e => e.style.display !== 'none').length, allpins: document.querySelectorAll('.mkm-pin').length, open: m.open, data: (() => { const x = G.mapData(); return { region: x.region, pins: x.pins.length, crystals: x.crystals.length, crew: x.crew.length, target: !!x.target, quest: x.quest }; })() }); }, 4500); }, 3000)); });
  await p.screenshot({ path: `renders/${name}.png` }); out[name] = { d, logs };
  await p.evaluate(() => document.querySelector('#mkm-x').click()); await p.waitForTimeout(400); out[name].closed = await p.evaluate(() => !MK.game.map().open);
  await p.close();
}
console.log(JSON.stringify(out)); await b.close();
execSync(`python3 -c "
from PIL import Image
c=Image.open('/cursor/stores/store-aec859c9-8de3-4a87-9ebb-d27a70ea91ac/grok-bot/agents/2e137442-742f-420a-bc0f-9f91777db88f/attachments/09b1aaa3561998f6f73a9f46e9a34145f8855c428e4a1d9645349d36b447198a.jpg').convert('RGB').resize((1280,720))
a=Image.open('renders/map.png').convert('RGB').resize((1280,720)); p=Image.open('renders/map_phone.png').convert('RGB'); p=p.resize((int(p.width*720/p.height),720))
S=Image.new('RGB',(2560+p.width+20,720),(10,10,16)); S.paste(c,(0,0)); S.paste(a,(1290,0)); S.paste(p,(2580,0)); S.save('renders/map_vs_concept.png')
"`);
