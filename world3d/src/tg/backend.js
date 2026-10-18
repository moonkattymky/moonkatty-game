// Server-backed storage for the 3D world inside Telegram, behind the storage.js backend interface
// ({load, save, wipe, addPoints}). Auth = the game's existing flow: Telegram initData -> 12h session from the
// `rewards` Edge Function (same sessionStorage key as the 2D client). Progress: world.state / world.save (CAS).
// Moon Points: world.reward (server decides the amount; idempotent ledger). localStorage is always written first,
// so the game keeps working offline or before the server actions are deployed; unconfirmed claims are queued
// and retried, and the balance shown is the server's whenever it is reachable.
export const ENDPOINT = 'https://lswbmgoeinblzuqzakvi.supabase.co/functions/v1/rewards';
const LAUNCH_BASE = 30, STAR_PTS = 5;
const uniq = (a, b) => [...new Set([...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])])];
// Merge two v2/v3 saves without ever losing progress (union of completed things, max of counters).
export function mergeSaves(a, b) {
  if (!a || typeof a !== 'object') return b || null; if (!b || typeof b !== 'object') return a;
  const hi = ((a.level || 1) > (b.level || 1) || ((a.level || 1) === (b.level || 1) && (a.xp || 0) >= (b.xp || 0))) ? a : b;
  const ca = a.ch1 || {}, cb = b.ch1 || {};
  const out = { ...b, ...a, v: Math.max(a.v || 1, b.v || 1), level: hi.level || 1, xp: hi.xp || 0, points: Math.max(a.points || 0, b.points || 0), lives: Math.min(9, Math.max(a.lives || 0, b.lives || 0)) || 9,
    ch1: { ...cb, ...ca, done: uniq(cb.done, ca.done), crossed: uniq(cb.crossed, ca.crossed), mined: uniq(cb.mined, ca.mined), powered: uniq(cb.powered, ca.powered), parts: uniq(cb.parts, ca.parts), sprint: Math.max(ca.sprint || 0, cb.sprint || 0), prog: 0 },
    secrets: uniq(b.secrets, a.secrets), base: { ...(b.base || {}), ...(a.base || {}), built: uniq((b.base || {}).built, (a.base || {}).built) }, stats: { ...(b.stats || {}) } };
  for (const [k, v] of Object.entries(a.stats || {})) out.stats[k] = Math.max(Number(v) || 0, Number(out.stats[k]) || 0);
  const da = a.crystals || {}, db = b.crystals || {}; out.crystals = da.day === db.day ? { day: da.day, taken: uniq(db.taken, da.taken) } : ((da.day || '') > (db.day || '') ? da : db);
  const ya = a.daily || {}, yb = b.daily || {}; out.daily = ya.day === yb.day ? { day: ya.day, earned: Math.max(ya.earned || 0, yb.earned || 0) } : ((ya.day || '') > (yb.day || '') ? ya : yb);
  // v3 (chapter 2): keep the richer ch2 block whole (jobs/robots/storage are internally consistent), union completed quests
  if (a.ch2 || b.ch2) { const sc = (c) => !c || typeof c !== 'object' ? -1 : (Array.isArray(c.done) ? c.done.length : 0) * 1e6 + (c.level || 0) * 1e4 + (Array.isArray(c.museum) ? c.museum.length : 0) * 10 + (Array.isArray(c.robots) ? c.robots.length : 0) + (c.on ? 0.5 : 0);
    const pick = sc(a.ch2) >= sc(b.ch2) ? a.ch2 : b.ch2; out.ch2 = { ...pick, done: uniq((b.ch2 || {}).done, (a.ch2 || {}).done) }; }
  return out;
}
export function userIdFrom(initData) { try { const u = JSON.parse(new URLSearchParams(initData).get('user')); return Number.isSafeInteger(u.id) && u.id > 0 ? u.id : null; } catch (e) { return null; } }

export class TelegramBackend {
  constructor({ initData, endpoint = ENDPOINT, fetcher = (...a) => fetch(...a), dailyCap = 300, storage = localStorage, session = sessionStorage } = {}) {
    this.initData = initData; this.endpoint = endpoint; this.fetch = fetcher; this.dailyCap = dailyCap; this.ls = storage; this.ss = session;
    this.uid = userIdFrom(initData); this.key = 'mkty_world_v1_tg_' + this.uid; this.qkey = 'mkty_world_pending_v1_' + this.uid; this.skey = 'mkty_session_v1_' + this.uid;
    this.revision = 0; this.online = null; this.serverPoints = null; this.saveT = null; this.last = null; this.status = 'init'; this.flushing = null;
  }
  readLocal() { try { return JSON.parse(this.ls.getItem(this.key) || 'null'); } catch (e) { return null; } }
  writeLocal(d) { try { this.ls.setItem(this.key, JSON.stringify(d)); } catch (e) { } }
  pending() { try { const q = JSON.parse(this.ls.getItem(this.qkey) || '[]'); return Array.isArray(q) ? q : []; } catch (e) { return []; } }
  setPending(q) { try { this.ls.setItem(this.qkey, JSON.stringify(q.slice(-200))); } catch (e) { } }
  async auth() {
    let s = null; try { s = JSON.parse(this.ss.getItem(this.skey) || 'null'); } catch (e) { }
    if (s && s.token && s.expires_at > Date.now() + 30000) return { session: s.token };
    const r = await this.post({ initData: this.initData, action: 'session' }, true);
    if (r.ok && r.session) { try { this.ss.setItem(this.skey, JSON.stringify(r.session)); } catch (e) { } return { session: r.session.token }; }
    return { initData: this.initData };
  }
  async post(body, raw = false) {
    const res = await this.fetch(this.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout ? AbortSignal.timeout(9000) : undefined });
    let data = {}; try { data = await res.json(); } catch (e) { }
    if (!raw && data.error === 'auth') { try { this.ss.removeItem(this.skey); } catch (e) { } }
    return { status: res.status, ...data };
  }
  async call(action, extra = {}) { const a = await this.auth(); return this.post({ ...a, action, ...extra }); }
  noteServer(r) { if (r && r.player && Number.isFinite(r.player.moon_points)) this.serverPoints = r.player.moon_points; }
  async load() {
    const local = this.readLocal(); let merged = local;
    try {
      const r = await this.call('world.state');
      if (!r.ok) throw new Error(r.error || 'state');
      this.online = true; this.status = 'online'; this.revision = r.save.revision; this.noteServer(r);
      const remote = r.save.snapshot && Object.keys(r.save.snapshot).length ? r.save.snapshot : null;
      merged = mergeSaves(local, remote);
      if (merged && this.serverPoints != null) merged.points = this.serverPoints;
      if (merged && r.world) merged.daily = { day: merged.daily && merged.daily.day || '', earned: Math.max(r.world.today_earned || 0, 0) };
    } catch (e) { this.online = false; this.status = 'offline'; }
    if (!merged && this.serverPoints != null) merged = { v: 2, points: this.serverPoints };
    if (merged) this.writeLocal(merged); this.flush(); return merged;
  }
  async save(data) {
    this.last = data; this.dirty = true; this.writeLocal(data); this.schedulePush(1500);
  }
  schedulePush(ms) { if (!this.saveT) this.saveT = setTimeout(() => { this.saveT = null; this.pushSave(); }, ms); }
  async pushSave(tries = 0) {
    if (!this.last || !this.dirty) return;
    if (this.online === false && Date.now() < (this.retryAt || 0)) { this.schedulePush(this.retryAt - Date.now() + 50); return; }
    this.dirty = false;
    const snap = JSON.parse(JSON.stringify(this.last)); delete snap.points; // balance is server-authoritative
    try {
      const r = await this.call('world.save', { revision: this.revision, snapshot: snap });
      if (r.ok && r.conflict && tries < 2) { this.revision = r.revision; const m = mergeSaves(this.last, r.snapshot); Object.assign(this.last, m); this.writeLocal(this.last); this.dirty = true; return this.pushSave(tries + 1); }
      if (!r.ok) throw new Error(r.error || 'save');
      this.revision = r.revision; this.online = true; this.status = 'online'; this.retryAt = 0;
    } catch (e) { this.dirty = true; this.online = false; this.status = 'offline'; this.retryAt = Date.now() + 15000; this.schedulePush(15050); }
  }
  async wipe() { try { this.ls.removeItem(this.key); } catch (e) { } } // local cache only; the server save is kept (dev ?reset=1)
  claimBody(n, reason) { const b = { reason }; if (reason === 'quest:launch') b.stars = Math.max(0, Math.min(3, Math.round((n - LAUNCH_BASE) / STAR_PTS))); return b; }
  async addPoints(n, reason) {
    if (this.online !== false) {
      try {
        const r = await this.call('world.reward', this.claimBody(n, reason));
        if (r.ok) { this.online = true; this.noteServer(r); return { granted: r.granted || 0, points: this.serverPoints }; }
        if (r.error === 'reason') return { granted: 0, points: this.serverPoints }; // not a server-paid reward
      } catch (e) { this.online = false; this.status = 'offline'; }
    }
    // offline / server not ready / too fast / out of order: show it locally, confirm later
    const q = this.pending(); if (!q.some(x => x.reason === reason)) q.push({ n, reason, at: Date.now() }); this.setPending(q); this.scheduleFlush();
    return { granted: n, points: null };
  }
  scheduleFlush(ms = 10000) { if (!this.flushT) this.flushT = setTimeout(() => { this.flushT = null; this.flush(); }, ms); }
  flush() {
    if (this.flushing) return this.flushing;
    this.flushing = (async () => {
      let q = this.pending(); if (!q.length) return;
      for (const item of [...q]) {
        let r; try { r = await this.call('world.reward', this.claimBody(item.n, item.reason)); } catch (e) { this.online = false; break; }
        if (r.ok || r.error === 'reason' || r.error === 'locked') { this.noteServer(r); q = q.filter(x => x.reason !== item.reason); this.online = true; continue; }
        if (r.error === 'order' || r.error === 'too_fast') continue; // an earlier quest is still pending, or wait for the gap
        if (r.status >= 500 || r.status === 429 || r.error === 'action' || r.error === 'auth') { this.online = r.error === 'action' ? false : this.online; break; }
        q = q.filter(x => x.reason !== item.reason); // other 4xx: invalid claim, drop it
      }
      if (this.online && this.dirty) this.pushSave();
      this.setPending(q); if (q.length) this.scheduleFlush(this.online === false ? 30000 : 10000);
      if (this.onPoints && this.serverPoints != null) this.onPoints(this.serverPoints);
    })().finally(() => { this.flushing = null; });
    return this.flushing;
  }
}
