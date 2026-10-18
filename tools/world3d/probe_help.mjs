import { chromium } from 'playwright-core'; import { seed } from './ch2_seed.mjs';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 } }); const errs = []; p.on('pageerror', e => errs.push('ERR ' + e.message + (e.stack || '').slice(0, 300))); p.on('console', m => { if (m.type() === 'error' || m.text().startsWith('DBG')) errs.push('C ' + m.text().slice(0, 300)); });
await seed(p, '', { done: ['c2_collect', 'c2_home', 'c2_send', 'c2_upgrade'], level: 2 });
const t0 = Date.now();
const r = await p.evaluate(async () => { const G = MK.game; const s0 = JSON.stringify(G.state().ch2.jobs); const q = G.ch2.quest(); const P = G.auto(); let out = []; for (let i = 0; i < 30; i++) { await new Promise(r => setTimeout(r, 3000)); out.push(JSON.stringify({ jobs: G.state().ch2.jobs.map(j => [j.kind, j.help, +(G.ch2.econ.progress(j)).toFixed(2)]), crew: G.ch2.crew().map(c => [c.id, c.state]), done: G.state().ch2.done.length, reg: G.region() })); if (G.state().ch2.done.includes('c2_help')) break; } return { q, s0, out }; });
console.log(JSON.stringify(r, null, 1), (Date.now() - t0) / 1000, errs.join('\n')); await b.close();
