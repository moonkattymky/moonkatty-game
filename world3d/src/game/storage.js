import { ch2Defaults } from './economy.js';
// Player-state storage behind one interface, so the localStorage backend can be swapped for a server API later.
//   backend: { load(): Promise<object|null>, save(data): Promise<void>, wipe(): Promise<void>, addPoints?(n, reason, day): Promise<{granted}> }
//   store:   load() / save() / addPoints(n, reason) (enforces the daily cap) / capInfo() / data
// With a server backend that implements addPoints, the server is the authority for the cap and balance.
export const DAILY_CAP = 300;
export const STORAGE_KEY = 'mkty_world_v1'; // separate from the 9 Lives game's 'mkty_points' (merge happens server-side later)

export class LocalBackend {
  constructor(key = STORAGE_KEY) { this.key = key; }
  async load() { try { return JSON.parse(localStorage.getItem(this.key) || 'null'); } catch (e) { return null; } }
  async save(data) { try { localStorage.setItem(this.key, JSON.stringify(data)); } catch (e) { } }
  async wipe() { try { localStorage.removeItem(this.key); } catch (e) { } }
}
// Stage-2 placeholder: same interface over HTTP (not used yet).
export class ApiBackend {
  constructor(base, auth) { this.base = base; this.auth = auth; }
  async req(path, opt = {}) { const r = await fetch(this.base + path, { ...opt, headers: { 'content-type': 'application/json', authorization: this.auth || '', ...(opt.headers || {}) } }); if (!r.ok) throw new Error('api ' + r.status); return r.json(); }
  async load() { return this.req('/state'); }
  async save(data) { await this.req('/state', { method: 'PUT', body: JSON.stringify(data) }); }
  async wipe() { await this.req('/state', { method: 'DELETE' }); }
  async addPoints(n, reason, day) { return this.req('/points', { method: 'POST', body: JSON.stringify({ n, reason, day }) }); }
}

export function dayKey(ms) { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
// v2 (Chapter 1 overhaul): ch1.done is the source of truth (idx is derived), + lives, secrets, base build, activity sub-state.
// v3 (Chapter 2): + ch2 (base level, storage, robots, timed jobs with absolute timestamps, daily tasks / streak / login, museum).
const defaults = () => ({ v: 3, points: 0, xp: 0, level: 1, lives: 9, daily: { day: '', earned: 0 }, crystals: { day: '', taken: [] },
  ch1: { idx: 0, prog: 0, done: [], crossed: [], mined: [], powered: [], parts: [], sprint: 0 }, secrets: [], base: { built: [] }, ch2: ch2Defaults(), stats: { crystals: 0, quests: 0, secrets: 0, falls: 0, hits: 0 } });
// old v1 quest ids -> new ids (already-earned quests are skipped, never re-rewarded)
const V1_MAP = { canyon: ['canyon'], crystals: ['crystals'], dish: ['parts', 'dish'], reactor: ['reactor'], launch: ['launch'], ledge: ['secret'], home: ['home'] };
export function migrate(d) {
  if (!d || typeof d !== 'object') return d; if ((d.v || 1) >= 3) return d;
  if ((d.v || 1) === 2) return { ...d, v: 3, ch2: ch2Defaults(), migratedFrom: d.migratedFrom || 2 }; // v2 -> v3: Chapter 2 starts fresh (ch1 progress untouched)
  return migrate(migrate1(d));
}
function migrate1(d) {
  const old = (d.ch1 && Array.isArray(d.ch1.done)) ? d.ch1.done : []; const done = old.length ? ['power'] : []; // returning players skip the intro hook
  for (const id of old) for (const n of (V1_MAP[id] || [])) if (!done.includes(n)) done.push(n);
  const out = { ...d, v: 2, ch1: { idx: 0, prog: 0, done, crossed: [], mined: [], powered: [], parts: [], sprint: done.includes('launch') ? 1 : 0 }, secrets: old.includes('ledge') ? ['ledge'] : [], base: { built: old.includes('home') ? ['depot'] : [] }, lives: 9, migratedFrom: 1 };
  return out;
}

export function createStore({ backend = new LocalBackend(), dailyCap = DAILY_CAP, now = () => Date.now() } = {}) {
  let data = defaults(); let saveT = null;
  const today = () => dayKey(now());
  const roll = () => { const d = today(); if (data.daily.day !== d) data.daily = { day: d, earned: 0 }; if (data.crystals.day !== d) data.crystals = { day: d, taken: [] }; };
  const store = {
    get data() { return data; }, dailyCap, today,
    async load() { const d = migrate(await backend.load()); data = Object.assign(defaults(), d || {}); for (const k of ['daily', 'crystals', 'ch1', 'stats', 'base']) data[k] = Object.assign(defaults()[k], (d || {})[k] || {}); if (!Array.isArray(data.secrets)) data.secrets = []; { const c = defaults().ch2, o = (d || {}).ch2 || {}; data.ch2 = Object.assign(c, o); for (const k of ['storage', 'res', 'eng', 'streak', 'login', 'daily']) data.ch2[k] = Object.assign(ch2Defaults()[k], o[k] || {}); for (const k of ['robots', 'jobs', 'log', 'museum', 'sets', 'story', 'done']) if (!Array.isArray(data.ch2[k])) data.ch2[k] = ch2Defaults()[k]; } if (data.ch1.done.length && !data.ch1.done.includes('power')) data.ch1.done.unshift('power'); if (!(data.lives >= 1 && data.lives <= 9)) data.lives = 9; roll(); return data; },
    async save() { clearTimeout(saveT); saveT = null; roll(); await backend.save(data); },
    queueSave() { if (!saveT) saveT = setTimeout(() => store.save(), 250); },
    async wipe() { await backend.wipe(); data = defaults(); roll(); },
    capInfo() { roll(); return { earned: data.daily.earned, cap: dailyCap, left: Math.max(0, dailyCap - data.daily.earned) }; },
    async addPoints(n, reason = '') {
      roll(); let granted;
      if (backend.addPoints) { const r = await backend.addPoints(n, reason, data.daily.day); granted = r.granted; if (r.points != null) data.points = r.points; else data.points += granted; data.daily.earned += granted; }
      else { granted = Math.max(0, Math.min(n, dailyCap - data.daily.earned)); data.points += granted; data.daily.earned += granted; }
      store.queueSave(); return { granted, capped: granted < n, points: data.points, earned: data.daily.earned, cap: dailyCap };
    },
    roll,
  };
  return store;
}
