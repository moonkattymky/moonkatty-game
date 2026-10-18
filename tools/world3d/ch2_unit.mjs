// Chapter 2 pure-logic tests (economy + save migration). usage: node tools/ch2_unit.mjs
import fs from 'fs'; import path from 'path'; import { fileURLToPath, pathToFileURL } from 'url';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url))); const tmp = '/tmp/ch2u'; fs.mkdirSync(tmp, { recursive: true });
fs.writeFileSync(tmp + '/package.json', '{"type":"module"}'); for (const f of ['economy.js', 'storage.js']) fs.copyFileSync(path.join(root, 'src/game', f), path.join(tmp, f));
const E = await import(pathToFileURL(tmp + '/economy.js')); const St = await import(pathToFileURL(tmp + '/storage.js'));
let pass = 0, fail = 0; const T = (name, ok) => { if (ok) pass++; else fail++; console.log((ok ? 'PASS ' : 'FAIL ') + name); };
const day = 86400e3; let now = new Date('2026-10-01T10:00:00').getTime(); const clk = () => now;
const mk = () => { const data = { ch2: E.ch2Defaults() }; data.ch2.on = true; return { data, e: E.createEconomy({ data, now: clk }) }; };
// migration
{ const v2 = { v: 2, points: 50, ch1: { done: ['power', 'canyon'] } }; const m = St.migrate(v2); T('migrate v2->v3 adds ch2, keeps ch1', m.v === 3 && m.ch2 && m.ch2.level === 1 && m.ch2.robots.length === 2 && m.ch1.done.length === 2 && m.points === 50); }
{ const v1 = { v: 1, points: 10, ch1: { done: ['canyon', 'dish', 'home'] } }; const m = St.migrate(v1); T('migrate v1->v3 (via v2 map)', m.v === 3 && m.ch2 && m.ch1.done.includes('parts') && m.ch1.done.includes('dish') && m.base.built.includes('depot')); }
{ const v3 = { v: 3, ch2: { level: 4 } }; T('migrate v3 untouched', St.migrate(v3).ch2.level === 4); }
// base levels
T('base L1-L5 storage 60/120/200/320/500', E.BASE.filter(Boolean).map(b => b.cap).slice(-5).join() === '60,120,200,320,500' && E.MAX_LEVEL === 5);
// robots: 2 start, slots
{ const { data, e } = mk(); T('starts with 2 robots (builder+geologist)', data.ch2.robots.length === 2); T('recruit blocked at 2 slots', !e.recruit('engineer').ok);
  data.ch2.streak.best = 7; T('7-day streak opens 3rd slot', e.slots() === 3 && e.recruit('engineer').ok); data.ch2.streak.best = 30; data.ch2.level = 5; T('max 8 slots', e.slots() === 8);
  e.recruit('engineer'); T('max 2 per type', !e.recruit('engineer').ok && e.recruit('archaeologist').ok); }
// offline job: expedition finishes after real time passes (no client running)
{ const { data, e } = mk(); const r = e.start('r2', 'expedition', 'e30'); T('expedition starts', r.ok); T('busy robot rejected', !e.start('r2', 'expedition', 'e30').ok);
  now += 10e3; T('not done early', e.tick().length === 0); now += r.job.dur * 1000; const out = e.tick(); T('finished offline after duration', out.length === 1 && data.ch2.storage.cry + data.ch2.storage.ore > 0);
  const got = e.collect(); T('collect moves storage to res', got.cry + got.ore > 0 && e.stored() === 0 && data.ch2.res.ore + data.ch2.res.cry > 0); }
// upgrade by builder
{ const { data, e } = mk(); data.ch2.res = { ore: 100, cry: 100 }; const r = e.start('r1', 'upgrade', 2); T('builder upgrade starts + pays', r.ok && data.ch2.res.ore < 100); T('geologist cannot upgrade', !e.start('r2', 'upgrade', 2).ok); now += r.job.dur * 1000 + 1; e.tick(); T('level 2 reached, cap grows', data.ch2.level === 2 && e.cap() === E.BASE[2].cap); }
// storage cap
{ const { data, e } = mk(); const d = e.deliver(500, 500); T('delivery capped by storage', e.stored() <= e.cap() && d.lost > 0); }
// daily + streak + grace
{ const { data, e } = mk(); e.rollDay(); T('3 daily tasks', data.ch2.daily.tasks.length === 3); T('login reward once a day', !!e.claimLogin() && !e.claimLogin());
  now += day; e.rollDay(); T('streak 2', data.ch2.streak.count === 2); now += 2 * day; e.rollDay(); T('1-day grace keeps streak', data.ch2.streak.count === 3); now += 2 * day; e.rollDay(); T('second miss without grace resets', data.ch2.streak.count === 1);
  const t0 = data.ch2.daily.tasks[0]; e.track(t0.id, t0.need); T('task completes + claim', t0.done && !!e.claimTask(0) && !e.claimTask(0)); }
// help request on long job
{ const { data, e } = mk(); const r = e.start('r2', 'expedition', 'e60'); now += r.job.dur * 1000 * 0.5; e.tick(); T('help asked mid-job', r.job.help === 'asked'); T('help shortens/boosts', e.help(r.job.id, 'perfect').ok && r.job.bonus > 0); }
// scale (?fast)
{ const data = { ch2: E.ch2Defaults() }; const e = E.createEconomy({ data, now: clk, scale: 0.01 }); const r = e.start('r2', 'expedition', 'e30'); T('scaled job duration', Math.abs(e.left(r.job) - r.job.dur * 0.01) < 0.5); }
console.log(`ch2 unit: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
