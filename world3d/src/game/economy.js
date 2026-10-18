// ============================================================================================
// Chapter 2 economy: base levels, storage, robots (Clash-of-Clans style builders), timed jobs that keep running
// offline (absolute timestamps in the save), daily tasks, forgiving streak, login reward, museum sets.
// Pure logic (no three.js / DOM) so it is unit-testable; the world/UI layer (ch2.js) only reads state + calls actions.
//   now()  : ms clock (game passes Date.now() + test offsets)
//   scale  : duration multiplier (?fast=1 -> 1/60: 2 min -> 2 s, 4 h -> 4 min)
// ============================================================================================
export const TYPES = ['builder', 'geologist', 'archaeologist', 'engineer'];
export const MAX_ROBOTS = 8, MAX_PER_TYPE = 2;
// base level table: storage capacity (crystal+ore units), passive reactor trickle (units/h), upgrade cost + build time (s)
export const BASE = [
  null,
  { cap: 60, rate: 6 },
  { cap: 120, rate: 10, cost: { ore: 20, cry: 10 }, dur: 120 },      // first ch2 build: ~2 min
  { cap: 200, rate: 16, cost: { ore: 40, cry: 25 }, dur: 600 },      // racks + antenna
  { cap: 320, rate: 24, cost: { ore: 120, cry: 70 }, dur: 2700 },    // second section
  { cap: 500, rate: 36, cost: { ore: 260, cry: 140 }, dur: 7200 },   // large hangar
];
export const MAX_LEVEL = BASE.length - 1;
// geologist expeditions (yield goes to storage, capped by its free space)
export const EXPEDITIONS = [
  { id: 'e30', dur: 1800, cry: 14, ore: 22, lvl: 1 },
  { id: 'e60', dur: 3600, cry: 26, ore: 40, lvl: 1 },
  { id: 'e120', dur: 7200, cry: 48, ore: 74, lvl: 2 },
  { id: 'e240', dur: 14400, cry: 90, ore: 140, lvl: 3 },
  { id: 'night', dur: 28800, cry: 190, ore: 290, lvl: 2, night: true },  // overnight long shift: +bonus per hour
];
// archaeologist searches -> rare artifacts (museum sets)
export const DIGS = [
  { id: 'd2', dur: 7200, rolls: 1, lvl: 1 },
  { id: 'd4', dur: 14400, rolls: 2, lvl: 2 },
  { id: 'd8', dur: 28800, rolls: 3, lvl: 3, night: true },
];
// engineer upgrades: each has 3 levels (minutes -> hours)
export const ENG = {
  jet: { dur: [900, 3600, 10800], cost: [{ ore: 30, cry: 10 }, { ore: 80, cry: 40 }, { ore: 180, cry: 90 }] },      // jetpack fuel +25%/lvl
  reactor: { dur: [1200, 5400, 14400], cost: [{ ore: 40, cry: 20 }, { ore: 100, cry: 50 }, { ore: 220, cry: 110 }] }, // passive storage trickle +30%/lvl
  antenna: { dur: [1800, 7200, 18000], cost: [{ ore: 50, cry: 20 }, { ore: 120, cry: 60 }, { ore: 260, cry: 130 }] }, // expeditions 10% faster/lvl
};
export const MUSEUM = {
  ancient: { items: ['tablet', 'idol', 'glyph', 'mask'], bonus: 'cap' },        // +20% storage cap
  station: { items: ['badge', 'logbook', 'helmet', 'flag'], bonus: 'speed' },  // robots 10% faster
  meteor: { items: ['shard', 'geode', 'iron', 'pearl'], bonus: 'yield' },      // expeditions +15% yield
};
export const ALL_ART = Object.entries(MUSEUM).flatMap(([s, v]) => v.items.map(i => s + ':' + i));
export const STORY = ['old_probe', 'tracks', 'signal', 'cave_lights', 'frozen_flag', 'whale_rock'];
export const ROBOT_XP = [0, 3, 8, 15, 25]; // xp needed for robot level 1..5
export const DAILY_POOL = ['collect', 'send', 'crystals', 'help', 'points', 'jet', 'visit', 'home'];
export const DAILY_NEED = { collect: 1, send: 1, crystals: 3, help: 1, points: 40, jet: 8, visit: 1, home: 1 };
export const DAILY_PTS = 20, DAILY_ALL_ORE = 20;
const H = 3600e3;
export const dayStr = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const dayNum = (s) => { const [y, m, d] = s.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 864e5); };
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const rng = (seed) => { let a = seed >>> 0 || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };

export const ch2Defaults = () => ({
  on: false, done: [], level: 1, storage: { cry: 0, ore: 0, t: 0 }, res: { cry: 0, ore: 0 },
  robots: [{ id: 'r1', type: 'builder', xp: 0 }, { id: 'r2', type: 'geologist', xp: 0 }], jobs: [], log: [],
  eng: { jet: 0, reactor: 0, antenna: 0 }, museum: [], sets: [], story: [],
  streak: { last: '', count: 0, best: 0, grace: 1 }, login: { day: '' }, daily: { day: '', tasks: [], bonus: false },
  helped: 0, expeditions: 0, seq: 0,
});

export function createEconomy({ data, now = () => Date.now(), scale = 1, onEvent = () => { } }) {
  const S = () => data.ch2; const D = () => data;
  const T = () => now();
  const lvl = () => S().level;
  const setDone = (s) => S().sets.includes(s);
  const cap = () => Math.round(BASE[lvl()].cap * (setDone('ancient') ? 1.2 : 1));
  const stored = () => S().storage.cry + S().storage.ore;
  const free = () => Math.max(0, cap() - stored());
  const robotLevel = (r) => { let L = 1; for (let i = 1; i < ROBOT_XP.length; i++) if (r.xp >= ROBOT_XP[i]) L = i + 1; return Math.min(5, L); };
  const speedMul = (r) => (1 + 0.05 * (robotLevel(r) - 1)) * (setDone('station') ? 1.1 : 1);
  const jobOf = (rid) => S().jobs.find(j => j.rid === rid) || null;
  const robot = (rid) => S().robots.find(r => r.id === rid);
  const countType = (ty) => S().robots.filter(r => r.type === ty).length;
  const slots = () => { const st = Math.max(S().streak.best, S().streak.count); let n = 2; if (st >= 7) n++; if (lvl() >= 4) n++; if (lvl() >= 5) n++; if (st >= 14) n++; if (st >= 21) n++; if (st >= 30) n++; return Math.min(MAX_ROBOTS, n); };
  const canAfford = (c) => !c || (S().res.ore >= (c.ore || 0) && S().res.cry >= (c.cry || 0));
  const pay = (c) => { if (!c) return; S().res.ore -= c.ore || 0; S().res.cry -= c.cry || 0; };
  const deliver = (cry, ore) => { const f = free(); const tot = cry + ore; if (tot <= 0) return { cry: 0, ore: 0, lost: 0 }; const k = Math.min(1, f / tot); const dc = Math.floor(cry * k), dor = Math.floor(ore * k); S().storage.cry += dc; S().storage.ore += dor; return { cry: dc, ore: dor, lost: tot - dc - dor }; };
  const passive = () => { const st = S().storage; const t = T(); if (!st.t) { st.t = t; return; } const dt = (t - st.t) / H / scale; if (dt <= 0) return; const rate = BASE[lvl()].rate * (1 + 0.3 * S().eng.reactor); const units = Math.floor(dt * rate); if (units > 0) { deliver(Math.ceil(units * 0.4), units - Math.ceil(units * 0.4)); st.t += units / rate * H * scale; } if (free() <= 0) st.t = t; };
  // ---------- jobs ----------
  function start(rid, kind, what, extra = {}) {
    const r = robot(rid); if (!r) return { ok: false, why: 'robot' }; if (jobOf(rid)) return { ok: false, why: 'busy' };
    let dur, cost = null;
    if (kind === 'upgrade') { if (r.type !== 'builder') return { ok: false, why: 'type' }; if (lvl() >= MAX_LEVEL) return { ok: false, why: 'max' }; if (S().jobs.some(j => j.kind === 'upgrade')) return { ok: false, why: 'already' }; const B = BASE[lvl() + 1]; dur = B.dur; cost = B.cost; what = lvl() + 1; }
    else if (kind === 'expedition') { if (r.type !== 'geologist') return { ok: false, why: 'type' }; const E = EXPEDITIONS.find(e => e.id === what); if (!E) return { ok: false, why: 'what' }; if (lvl() < E.lvl) return { ok: false, why: 'level' }; dur = E.dur * Math.pow(0.9, S().eng.antenna); }
    else if (kind === 'dig') { if (r.type !== 'archaeologist') return { ok: false, why: 'type' }; const G = DIGS.find(e => e.id === what); if (!G) return { ok: false, why: 'what' }; if (lvl() < G.lvl) return { ok: false, why: 'level' }; dur = G.dur; }
    else if (kind === 'eng') { if (r.type !== 'engineer') return { ok: false, why: 'type' }; const U = ENG[what]; if (!U) return { ok: false, why: 'what' }; const L = S().eng[what]; if (L >= 3) return { ok: false, why: 'max' }; if (S().jobs.some(j => j.kind === 'eng' && j.what === what)) return { ok: false, why: 'already' }; dur = U.dur[L]; cost = U.cost[L]; }
    else return { ok: false, why: 'kind' };
    if (!canAfford(cost)) return { ok: false, why: 'cost', cost }; pay(cost);
    dur = (extra.dur != null ? extra.dur : dur) / speedMul(r);
    const t = T(); const j = { id: 'j' + (++S().seq), rid, kind, what, start: t, end: t + dur * 1000 * scale, dur, help: 'none', bonus: 0 };
    S().jobs.push(j); onEvent('start', j); return { ok: true, job: j };
  }
  const progress = (j) => Math.max(0, Math.min(1, (T() - j.start) / (j.end - j.start)));
  const left = (j) => Math.max(0, (j.end - T()) / 1000);
  function finish(j) {
    S().jobs = S().jobs.filter(x => x !== j); const r = robot(j.rid); const res = { job: j, kind: j.kind };
    if (r) { const before = robotLevel(r); r.xp += Math.max(1, Math.round(j.dur / 1800)); res.robotUp = robotLevel(r) > before ? robotLevel(r) : 0; }
    const rnd = rng(hash(j.id + ':' + j.start));
    if (j.kind === 'upgrade') { S().level = Math.max(S().level, j.what); res.level = S().level; }
    else if (j.kind === 'eng') { S().eng[j.what] = Math.min(3, S().eng[j.what] + 1); res.eng = j.what; res.engLvl = S().eng[j.what]; }
    else if (j.kind === 'expedition') { const E = EXPEDITIONS.find(e => e.id === j.what); const k = (1 + j.bonus) * (setDone('meteor') ? 1.15 : 1); res.deliv = deliver(Math.round(E.cry * k), Math.round(E.ore * k)); S().expeditions++;
      if (rnd() < (E.night ? 0.6 : 0.3)) { const kind = rnd(); if (kind < 0.45) { const st = STORY.find(s => !S().story.includes(s)); if (st) { S().story.push(st); res.story = st; } else res.bonusCry = 10; } else if (kind < 0.75) { res.rare = 'geode'; const a = 'meteor:geode'; if (!S().museum.includes(a)) { S().museum.push(a); res.artifact = a; } else res.bonusCry = 15; } else res.bonusCry = 20; if (res.bonusCry) res.deliv2 = deliver(res.bonusCry, 0); } }
    else if (j.kind === 'dig') { const G = DIGS.find(e => e.id === j.what); res.found = []; for (let i = 0; i < G.rolls + (j.bonus > 0 ? 1 : 0); i++) { if (rnd() < 0.85) { const pool = ALL_ART.filter(a => !S().museum.includes(a)); if (pool.length) { const a = pool[Math.floor(rnd() * pool.length)]; S().museum.push(a); res.found.push(a); continue; } } res.deliv = deliver(0, 12); } }
    for (const [s, v] of Object.entries(MUSEUM)) if (!S().sets.includes(s) && v.items.every(i => S().museum.includes(s + ':' + i))) { S().sets.push(s); (res.sets ||= []).push(s); }
    S().log.unshift({ t: T(), kind: j.kind, what: j.what, rid: j.rid }); S().log.length = Math.min(S().log.length, 12);
    onEvent('done', res); return res;
  }
  // mid-job help request: asked at ~40% of jobs longer than 20 min (scaled), expires at 90%
  function helpCheck(j) { if (j.help === 'none' && j.dur >= 1200 && progress(j) >= 0.4 && progress(j) < 0.9) { j.help = 'asked'; onEvent('help', j); } if (j.help === 'asked' && progress(j) >= 0.9) j.help = 'expired'; }
  function help(jid, result) { const j = S().jobs.find(x => x.id === jid); if (!j || j.help !== 'asked') return { ok: false }; j.help = 'done'; S().helped++; if (result !== 'miss') { j.bonus = result === 'perfect' ? 0.35 : 0.25; const t = T(); j.end = t + (j.end - t) * 0.9; } return { ok: true, bonus: j.bonus }; }
  // ---------- storage ----------
  function collect() { passive(); const st = S().storage; const got = { cry: st.cry, ore: st.ore }; S().res.cry += st.cry; S().res.ore += st.ore; st.cry = 0; st.ore = 0; return got; }
  // ---------- daily ----------
  function rollDay() {
    const d = dayStr(T()); const sk = S().streak;
    if (sk.last !== d) { // streak (visit-based), 1 grace day: one missed day keeps the streak (once per 7 streak days)
      if (!sk.last) sk.count = 1; else { const gap = dayNum(d) - dayNum(sk.last); if (gap === 1) sk.count++; else if (gap === 2 && sk.grace > 0) { sk.count++; sk.grace--; sk.usedGrace = d; } else if (gap > 1) { sk.count = 1; sk.grace = 1; } }
      if (sk.count > 0 && sk.count % 7 === 0) sk.grace = 1; sk.last = d; sk.best = Math.max(sk.best, sk.count); }
    const dl = S().daily; if (dl.day !== d) { const r = rng(hash('daily' + d)); const pool = DAILY_POOL.filter(k => k !== 'visit' || lvl() >= 3); const pick = []; while (pick.length < 3) { const k = pool[Math.floor(r() * pool.length)]; if (!pick.includes(k)) pick.push(k); } S().daily = { day: d, tasks: pick.map(id => ({ id, prog: 0, need: DAILY_NEED[id], done: false, claimed: false })), bonus: false }; }
  }
  function track(id, n = 1) { const dl = S().daily; let changed = null; for (const t of dl.tasks) if (t.id === id && !t.done) { t.prog = Math.min(t.need, t.prog + n); if (t.prog >= t.need) { t.done = true; changed = t; } } return changed; }
  const loginReward = () => { const c = Math.max(1, S().streak.count); return { pts: Math.min(40, 10 + 5 * (c - 1)), ore: Math.min(30, 5 * c) }; };
  function claimLogin() { const d = dayStr(T()); if (S().login.day === d) return null; S().login.day = d; const r = loginReward(); S().res.ore += r.ore; return r; }
  function claimTask(i) { const t = S().daily.tasks[i]; if (!t || !t.done || t.claimed) return null; t.claimed = true; let all = null; if (!S().daily.bonus && S().daily.tasks.every(x => x.claimed)) { S().daily.bonus = true; S().res.ore += DAILY_ALL_ORE; all = { ore: DAILY_ALL_ORE }; } return { pts: DAILY_PTS, all }; }
  // ---------- robots ----------
  function recruit(type) { if (!TYPES.includes(type)) return { ok: false, why: 'type' }; if (S().robots.length >= slots()) return { ok: false, why: 'slots' }; if (countType(type) >= MAX_PER_TYPE) return { ok: false, why: 'max' }; const r = { id: 'r' + (++S().seq) + type[0], type, xp: 0 }; S().robots.push(r); return { ok: true, robot: r }; }
  function tick() { passive(); const out = []; for (const j of [...S().jobs]) { if (T() >= j.end) out.push(finish(j)); else helpCheck(j); } return out; }
  return { get S() { return S(); }, cap, stored, free, slots, robotLevel, speedMul, jobOf, robot, countType, canAfford, progress, left, start, finish, help, collect, rollDay, track, claimLogin, claimTask, loginReward, recruit, tick, deliver, passive, setDone, scale };
}
