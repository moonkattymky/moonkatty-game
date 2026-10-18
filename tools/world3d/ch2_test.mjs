// Chapter 2 in-browser tests: full ch1 -> ch2 quest line via ?fast=1 auto (real code paths), home enter/exit, storm finale,
// offline jobs via the job clock, day roll/streak, recruit limits, save reload, zero console errors. usage: node tools/ch2_test.mjs [extra-query]
import { chromium } from 'playwright-core';
const q = process.argv[2] || '';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 } }); const errs = []; p.on('pageerror', e => errs.push('ERR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('C ' + m.text().slice(0, 300)); });
let pass = 0, fail = 0; const T = (name, ok, extra = '') => { if (ok) pass++; else fail++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? ' ' + extra : '')); };
const url = (process.env.MK_BASE || 'http://localhost:' + (process.env.MKPORT || 47321) + '/index.html') + '?view=play&fast=1' + q;
await p.goto(url + '&reset=1'); await p.waitForFunction(() => window.MK && MK.ready && MK.game && MK.game.ready, null, { timeout: 150000 });
for (let i = 0; i < 14; i++) { const r = await p.evaluate(async () => { const q = MK.game.quest(); if (!q) return null; const ok = await MK.game.auto(); return [q.id, ok]; }); if (!r) break; }
await p.waitForFunction(() => MK.game.ch2.on, null, { timeout: 60000 }).catch(() => { });
T('ch2 starts after ch1', await p.evaluate(() => MK.game.ch2.on && MK.game.state().ch1.done.length >= 9));
T('starts with 2 robots', await p.evaluate(() => MK.game.state().ch2.robots.length === 2));
const seen = [];
for (let i = 0; i < 16; i++) { const r = await p.evaluate(async () => { const q = MK.game.ch2.quest(); if (!q) return null; let inside = null, storm = null; const ok = await MK.game.auto(); if (q.kind === 'home') inside = MK.game.ch2.home().inside; if (q.kind === 'storm') storm = MK.game.ch2.storm().state; return { id: q.id, kind: q.kind, ok, inside, storm, lvl: MK.game.state().ch2.level }; }); if (!r) break; seen.push(r); console.log('  ch2', JSON.stringify(r)); }
const ids = seen.map(s => s.id), done = await p.evaluate(() => MK.game.state().ch2.done);
const NOF = (process.env.NOFEAT || '').split(',').filter(Boolean); // e.g. NOFEAT=home,storm for staged builds
for (const id of ['c2_collect', 'c2_home', 'c2_send', 'c2_upgrade', 'c2_help', 'c2_daily', 'c2_deliver', 'c2_l3', 'c2_storm', 'c2_streak', 'c2_museum'].filter(id => !NOF.includes(id.slice(3)))) T('quest ' + id + ' completes', done.includes(id));
T('base reached level >= 3', await p.evaluate(() => MK.game.state().ch2.level >= 3));
if (!NOF.includes('home')) {
// home: enter, outside world not rendered (camera layer 1), exit back
const h = await p.evaluate(async () => { const G = MK.game; const H = G.ch2.home(); if (H.inside) await G.ch2.exitHome(); G.teleport(H.outside.x, H.outside.z); await G.ch2.enterHome(); const a = { inside: G.ch2.home().inside, layer: MK.camera.layers.mask, y: MK.ctrl.pos.y - G.ch2.home().origin.y }; await new Promise(r => setTimeout(r, 400)); await G.ch2.exitHome(); return { ...a, out: !G.ch2.home().inside, layer2: MK.camera.layers.mask }; });
T('home enter switches to interior layer', h.inside && h.layer === 2 && Math.abs(h.y) < 1.5, JSON.stringify(h)); T('home exit returns outside', h.out && h.layer2 === 1);
}
if (!NOF.includes('storm')) T('storm finale finished', await p.evaluate(() => ['done', 'off'].includes(MK.game.ch2.storm().state) && MK.game.ch2.storm().night === 0));
// offline job via job clock
const off = await p.evaluate(async () => { const G = MK.game, A = G.ch2; const S = () => G.state().ch2; const geo = S().robots.find(r => r.type === 'geologist' && !S().jobs.some(j => j.rid === r.id)); if (!geo) return { skip: true }; const r = await A.start(geo.id, 'expedition', 'e30'); if (!r || !r.ok) return { start: false, r }; const before = S().storage.cry + S().storage.ore + S().expeditions; G.advance(r.job.dur * 2); await new Promise(r => setTimeout(r, 200)); return { ok: !S().jobs.some(j => j.id === r.job.id), before, after: S().storage.cry + S().storage.ore + S().expeditions }; });
T('timed job finishes via clock (offline)', off.ok && off.after > off.before, JSON.stringify(off));
// recruit limit
const rec = await p.evaluate(() => { const A = MK.game.ch2, S = MK.game.state().ch2; const n = S.robots.length; const r = A.recruit('engineer'); return { n, slots: A.econ.slots(), r: r && r.ok, n2: MK.game.state().ch2.robots.length }; });
T('recruit respects slots/type limits', rec.n2 <= rec.slots && rec.n2 <= 8, JSON.stringify(rec));
// day roll: daily tasks regenerate, login claimable again
const dl = await p.evaluate(() => { const G = MK.game; const d0 = G.state().ch2.daily.day; G.shiftDay(1); const s = G.state().ch2; return { changed: s.daily.day !== d0, tasks: s.daily.tasks.length, login: !!G.ch2.claimLogin() }; });
T('day roll: new dailies + login reward', dl.changed && dl.tasks === 3 && dl.login, JSON.stringify(dl));
// save persists across reload
const lvl = await p.evaluate(() => MK.game.state().ch2.level); await p.waitForTimeout(1500);
await p.goto(url); await p.waitForFunction(() => window.MK && MK.ready && MK.game && MK.game.ready, null, { timeout: 150000 });
T('ch2 save persists across reload', await p.evaluate((l) => MK.game.state().v === 3 && MK.game.state().ch2.level === l && MK.game.ch2.on !== false, lvl));
T('zero console errors', errs.length === 0, errs.slice(0, 5).join(' | '));
console.log(`ch2 browser: ${pass} passed, ${fail} failed`); await b.close(); process.exit(fail ? 1 : 0);
