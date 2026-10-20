// v73 moon creatures in the Telegram WebView (mock SDK, REAL rewards handler on an in-memory fake DB): tame bunny, away finds -> server bunny:0..2 (4 pts, daily cap), hedgehog one-time 20, shots.
// usage: MK_BASE=http://127.0.0.1:47400/world3d/index.html node tools/world3d/tg_pets_test.mjs  -> renders/port_pets_*.png
import { chromium } from '/workspace/port-tools/node_modules/playwright-core/index.mjs';
import { createHandler } from '../../server/rewards/core.mjs';
const BASE = process.env.MK_BASE || 'http://127.0.0.1:47400/world3d/index.html', OUT = process.env.MK_OUT || 'renders/port_pets_';
const results = []; const ok = (n, c, i = '') => { results.push(!!c); console.log((c ? 'PASS ' : 'FAIL ') + n + (i ? '  ' + i : '')); };
const ME = 777001, players = new Map([[ME, { telegram_id: ME, first_name: 'Tester', moon_points: 1000, lives: 9, story_life: 1, referred_by: 777002 }], [777002, { telegram_id: 777002, first_name: 'Анна', moon_points: 0, lives: 9, story_life: 1, referred_by: null }], [777003, { telegram_id: 777003, first_name: 'Боб', moon_points: 0, lives: 9, story_life: 1, referred_by: ME }], [777004, { telegram_id: 777004, first_name: 'Чужой', moon_points: 0, lives: 9, story_life: 1, referred_by: null }]]);
const events = [{ event_key: 'world3d:c1:q:home', points: 15, created_at: new Date(Date.now() - 30 * 86400e3).toISOString() }]; const help = [], prefs = new Map(), queue = new Map(), tgApi = []; let save = { revision: 0, snapshot: {} };
const J = (x, s = 200) => new Response(JSON.stringify(x), { status: s });
const fetcher = async (url, opts = {}) => { const u = new URL(url), p = u.pathname, m = (opts.method || 'GET').toUpperCase(), b = opts.body ? JSON.parse(opts.body) : null, sp = k => u.searchParams.get(k), eq = k => sp(k) && Number(sp(k).slice(3));
  if (/api\.telegram\.org/.test(String(url))) { tgApi.push(p); return J({ ok: true }); }
  if (p.endsWith('/players')) { if (m === 'GET') { if (sp('referred_by')) return J([...players.values()].filter(x => x.referred_by === eq('referred_by'))); const x = players.get(eq('telegram_id')); return J(x ? [x] : []); } if (m === 'PATCH') { const x = players.get(eq('telegram_id')); Object.assign(x, b); return J([x]); } return J([players.get(ME)]); }
  if (p.endsWith('/reward_events')) { const lk = (sp('event_key') || '').replace(/^like\./, ''); const re = new RegExp('^' + lk.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$'); return J(events.filter(e => !lk || re.test(e.event_key))); }
  if (p.endsWith('/rpc/mkty_reward')) { const pl = players.get(b.p_id); if (events.some(e => e.event_key === b.p_key)) return J({ inserted: false, player: pl }); events.push({ event_key: b.p_key, points: b.p_points, created_at: new Date().toISOString() }); pl.moon_points += b.p_points; return J({ inserted: true, player: pl }); }
  if (p.endsWith('/rpc/mkty_restore_lives')) return J(players.get(b.p_id));
  if (p.endsWith('/rpc/mkty_rate_limit')) return J({ allowed: true });
  if (p.endsWith('/rpc/mkty_world_save')) { if (b.p_snapshot == null) return J(save); if (b.p_expected !== save.revision) return J({ conflict: true, ...save }); save = { revision: save.revision + 1, snapshot: b.p_snapshot }; return J({ revision: save.revision }); }
  if (p.endsWith('/mkty_world_help') && m === 'GET') return J(help.filter(h => (!sp('helper_id') || h.helper_id === eq('helper_id')) && (!sp('target_id') || h.target_id === eq('target_id'))));
  if (p.endsWith('/rpc/mkty_world_help')) { const a = players.get(b.p_helper), t = players.get(b.p_target); if (!a || !t || (a.referred_by !== t.telegram_id && t.referred_by !== a.telegram_id)) return J({ error: 'not_friend' }); if (help.some(h => h.helper_id === a.telegram_id && h.target_id === t.telegram_id)) return J({ ok: true, inserted: false, duplicate: true }); help.push({ helper_id: a.telegram_id, target_id: t.telegram_id }); return J({ ok: true, inserted: true }); }
  if (p.endsWith('/rpc/mkty_world_help_claim')) { const mine = help.filter(h => h.target_id === b.p_target && !h.c); mine.forEach(h => h.c = 1); return J({ count: mine.length, helpers: mine.map(h => h.helper_id) }); }
  if (p.endsWith('/mkty_notify_prefs')) { if (m === 'POST') { prefs.set(b.telegram_id, b); return new Response(null, { status: 201 }); } const x = prefs.get(eq('telegram_id')); return J(x ? [x] : []); }
  if (p.endsWith('/mkty_notify_queue')) { for (const k of [...queue.keys()]) if (k.startsWith(eq('telegram_id') + ':')) queue.delete(k); return new Response(null, { status: 204 }); }
  if (p.endsWith('/rpc/mkty_notify_schedule')) { if (!prefs.get(b.p_id)?.opted_in) return J({ ok: true, scheduled: false, opted_in: false }); if (b.p_due === null) { queue.delete(b.p_id + ':' + b.p_kind); return J({ ok: true, scheduled: false }); } queue.set(b.p_id + ':' + b.p_kind, b.p_due); return J({ ok: true, scheduled: true }); }
  if (p.includes('/rpc/')) return J({});
  return J([]); };
const handler = createHandler({ url: 'https://fake.supabase.co', key: 'fake-service-key', fetcher, verify: async (d) => { if (!/user=/.test(d || '')) throw Error('auth'); return { id: ME, first_name: 'Tester' }; }, rateLimit: true, sessionSecret: 'local-test-only-session-secret' });
const SDK = `(()=>{const ev={},log=[];const fire=(n,a)=>(ev[n]||[]).forEach(f=>f(a));const user=encodeURIComponent(JSON.stringify({id:777001,first_name:'Tester',language_code:'ru'}));
const back={isVisible:false,show(){this.isVisible=true;log.push('back.show')},hide(){this.isVisible=false;log.push('back.hide')},onClick(f){(ev.backButtonClicked||=[]).push(f)},offClick(){}};
window.Telegram={WebApp:{initData:'query_id=AA&user='+user+'&auth_date='+Math.floor(Date.now()/1000)+'&signature=x&hash=y',initDataUnsafe:{user:{id:777001,language_code:'ru'}},version:'8.0',platform:'android',
viewportHeight:innerHeight,viewportStableHeight:innerHeight,safeAreaInset:{top:0,bottom:0,left:0,right:0},contentSafeAreaInset:{top:0,bottom:0,left:0,right:0},isExpanded:false,
requestWriteAccess(cb){log.push('writeAccess');setTimeout(()=>cb(true),50)},isVersionAtLeast(v){return parseFloat(v)<=8.0},ready(){log.push('ready')},expand(){this.isExpanded=true;log.push('expand')},disableVerticalSwipes(){log.push('disableVerticalSwipes')},enableClosingConfirmation(){log.push('closingConfirmation')},
setHeaderColor(c){log.push('header:'+c)},setBackgroundColor(c){log.push('bg:'+c)},setBottomBarColor(c){log.push('bottombar:'+c)},close(){log.push('close')},
onEvent(n,f){(ev[n]||=[]).push(f)},offEvent(){},BackButton:back,HapticFeedback:{impactOccurred(s){log.push('haptic:impact:'+s)},notificationOccurred(s){log.push('haptic:notify:'+s)},selectionChanged(){log.push('haptic:select')}}}};
window.__tg={log,fire,back:()=>fire('backButtonClicked')};})();`;
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }); const page = await ctx.newPage(); const logs = [], calls = [];
page.on('pageerror', e => logs.push('PAGEERROR ' + e.message));
await page.route('https://telegram.org/js/telegram-web-app.js*', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: SDK }));
await page.route('https://lswbmgoeinblzuqzakvi.supabase.co/functions/v1/rewards', async r => { const req = r.request();
  if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'POST' } });
  const body = req.postData(); try { calls.push(JSON.parse(body).action); } catch (e) { }
  const res = await handler(new Request('https://fake/rewards', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1' }, body })); r.fulfill({ status: res.status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: await res.text() }); });
const ready = () => page.waitForFunction(() => window.MK && MK.ready && MK.game && MK.game.ready, null, { timeout: 200000 });
const E = (f, a) => page.evaluate(f, a); const W = (ms) => page.waitForTimeout(ms);
const until = async (fn, arg, ms = 25000) => { const t0 = Date.now(); let v; while (Date.now() - t0 < ms) { v = await E(fn, arg); if (v && v.ok) return v; await W(300); } return v; };
const KEY = 'mkty_world_v1_tg_' + ME;
const go = async () => { for (let k = 0; k < 3; k++) { await page.goto(BASE + '?view=play&fast=1'); const r = await page.waitForFunction(() => window.MK && MK.ready && MK.game && MK.game.ready && MK.game.ch2.on, null, { timeout: 120000 }).then(() => 1, () => 0); if (r) break; console.log('reload retry', k); } await W(2000); };
await page.goto(BASE + '?view=play&fast=1'); await ready(); await W(1500);
await E((K) => { const s = JSON.parse(localStorage.getItem(K)) || MK.game.state(); s.ch1 = s.ch1 || {}; s.ch1.done = ['power', 'canyon', 'crystals', 'parts', 'dish', 'reactor', 'launch', 'secret', 'home']; s.base = s.base || {}; s.base.built = ['depot'];
  s.ch2 = Object.assign(s.ch2 || {}, { on: true, done: ['c2_collect', 'c2_home', 'c2_send'], level: 2, robots: [{ id: 'r1', type: 'builder', xp: 0 }], jobs: [] }); delete s.pets; localStorage.setItem(K, JSON.stringify(s)); }, KEY);
await go();
let P = await E(() => MK.game.ch2.pet()); ok('old save -> pet defaults, wild bunny offered', P.tamed === false && !!P.wild, JSON.stringify({ tamed: P.tamed, wild: !!P.wild }));
await E((w) => MK.game.teleport(w.x + 1.2, w.z + 1.2, 0), P.wild); await W(1200); await E(() => MK.game.ch2.actDown('c2:pet:tame')); await W(800);
P = await E(() => MK.game.ch2.pet()); ok('tamed, follows', P.tamed && P.along);
const me = await E(() => ({ x: MK.ctrl.pos.x, z: MK.ctrl.pos.z })); await E((m) => MK.game.teleport(m.x + 4, m.z + 2, 0), me);
const fo = await until(() => { const P = MK.game.ch2.pet(), d = Math.hypot(P.x - MK.ctrl.pos.x, P.z - MK.ctrl.pos.z); return { ok: d < 2.2, d }; }); ok('bunny follows the cat', fo.ok, fo.d.toFixed(2));
await E(() => { MK.ctrl.camDist = 3.6; }); await W(2500); await page.screenshot({ path: OUT + 'bunny_along.png' });
// leave home, then come back 7 h later -> 3 server-paid away finds
await E(() => MK.game.ch2.petSet(false)); await W(1500); await E(() => MK.store && MK.store.save && MK.store.save()); await W(2500);
const pts0 = players.get(ME).moon_points;
const bump = (s) => { s = typeof s === 'string' ? JSON.parse(s) : s; if (s && s.pets) { s.pets.bunny.t = Date.now() - 7 * 3600e3; s.pets.bunny.along = false; } return s; };
save = { revision: save.revision, snapshot: bump(save.snapshot) }; await E((K) => { const s = JSON.parse(localStorage.getItem(K)); s.pets.bunny.t = Date.now() - 7 * 3600e3; s.pets.bunny.along = false; localStorage.setItem(K, JSON.stringify(s)); }, KEY);
await go(); await W(6000);
const bk = events.filter(e => /^world3d:d:\d{4}-\d\d-\d\d:bunny:[0-2]$/.test(e.event_key));
ok('away finds paid by the server: bunny:0..2 x 4 pts', bk.length === 3 && bk.every(e => e.points === 4) && players.get(ME).moon_points - pts0 >= 12, JSON.stringify({ keys: bk.map(e => e.event_key.slice(-7)), d: players.get(ME).moon_points - pts0 }));
// hedgehog: one-time 20
const C = await E(() => MK.game.creatures()); const h = C.hedge; const p1 = players.get(ME).moon_points;
await E((h) => MK.game.teleport(h.x + 1.2, h.z, 0), h); await until(() => ({ ok: MK.game.state().pets && MK.game.state().pets.hedgehog }));
await W(4000); ok('hedgehog bonus paid once by the server (world3d:c2:cr:hedgehog, 20)', events.filter(e => e.event_key === 'world3d:c2:cr:hedgehog').length === 1 && players.get(ME).moon_points - p1 === 20, String(players.get(ME).moon_points - p1));
await E((h) => { MK.game.teleport(h.x + 2.2, h.z + 0.6, -Math.PI / 2); MK.ctrl.camDist = 3.4; }, h); await W(3000); await page.screenshot({ path: OUT + 'hedgehog.png' });
const cave = C.cave; await E((c) => { MK.game.teleport(c.x + 3.5, c.z + 3.5, Math.atan2(-3.5, -3.5)); MK.ctrl.camDist = 3.6; }, cave); await W(3000); await page.screenshot({ path: OUT + 'glowbugs.png' });
ok('no page errors', logs.length === 0, logs.slice(0, 3).join(' | ')); ok('no Bot API calls', tgApi.length === 0);
console.log('calls', JSON.stringify([...new Set(calls)])); console.log(`SUMMARY pets ${results.filter(Boolean).length}/${results.length}`); await browser.close(); process.exit(results.every(Boolean) ? 0 : 1);
