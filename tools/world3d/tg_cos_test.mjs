// v72 robot cosmetics in the Telegram WebView (mock SDK, REAL rewards handler on an in-memory fake DB): picker, locks, save round-trip via world.save, shots.
// usage: MK_BASE=http://127.0.0.1:47400/world3d/index.html node tools/world3d/tg_cos_test.mjs  -> renders/port_cos_*.png
import { chromium } from '/workspace/port-tools/node_modules/playwright-core/index.mjs';
import { createHandler } from '../../server/rewards/core.mjs';
const BASE = process.env.MK_BASE || 'http://127.0.0.1:47400/world3d/index.html', OUT = process.env.MK_OUT || 'renders/port_cos_';
const results = []; const ok = (n, c, i = '') => { results.push(!!c); console.log((c ? 'PASS ' : 'FAIL ') + n + (i ? '  ' + i : '')); };
const ME = 777001, players = new Map([[ME, { telegram_id: ME, first_name: 'Tester', moon_points: 1000, lives: 9, story_life: 1, referred_by: 777002 }], [777002, { telegram_id: 777002, first_name: 'Анна', moon_points: 0, lives: 9, story_life: 1, referred_by: null }], [777003, { telegram_id: 777003, first_name: 'Боб', moon_points: 0, lives: 9, story_life: 1, referred_by: ME }], [777004, { telegram_id: 777004, first_name: 'Чужой', moon_points: 0, lives: 9, story_life: 1, referred_by: null }]]);
const help = [], prefs = new Map(), queue = new Map(), tgApi = []; let save = { revision: 0, snapshot: {} };
const J = (x, s = 200) => new Response(JSON.stringify(x), { status: s });
const fetcher = async (url, opts = {}) => { const u = new URL(url), p = u.pathname, m = (opts.method || 'GET').toUpperCase(), b = opts.body ? JSON.parse(opts.body) : null, sp = k => u.searchParams.get(k), eq = k => sp(k) && Number(sp(k).slice(3));
  if (/api\.telegram\.org/.test(String(url))) { tgApi.push(p); return J({ ok: true }); }
  if (p.endsWith('/players')) { if (m === 'GET') { if (sp('referred_by')) return J([...players.values()].filter(x => x.referred_by === eq('referred_by'))); const x = players.get(eq('telegram_id')); return J(x ? [x] : []); } if (m === 'PATCH') { const x = players.get(eq('telegram_id')); Object.assign(x, b); return J([x]); } return J([players.get(ME)]); }
  if (p.endsWith('/reward_events')) return J([]);
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
const E = (f, a) => page.evaluate(f, a);
const KEY = 'mkty_world_v1_tg_' + ME;
const go = async () => { for (let k = 0; k < 3; k++) { await page.goto(BASE + '?view=play&fast=1'); const r = await page.waitForFunction(() => window.MK && MK.ready && MK.game && MK.game.ready && MK.game.ch2.on, null, { timeout: 120000 }).then(() => 1, () => 0); if (r) break; console.log('reload retry', k); } await page.waitForTimeout(1500); }; // swiftshader under load occasionally stalls the first frame
await page.goto(BASE + '?view=play&fast=1'); await ready(); await page.waitForTimeout(1500);
await E((K) => { const s = JSON.parse(localStorage.getItem(K)) || MK.game.state(); s.ch1 = s.ch1 || {}; s.ch1.done = ['power', 'canyon', 'crystals', 'parts', 'dish', 'reactor', 'launch', 'secret', 'home']; s.base = s.base || {}; s.base.built = ['depot'];
  s.ch2 = Object.assign(s.ch2 || {}, { on: true, done: ['c2_collect', 'c2_home'], level: 3, robots: [{ id: 'r1', type: 'builder', xp: 0 }, { id: 'r2', type: 'geologist', xp: 9 }, { id: 'r3', type: 'engineer', xp: 3 }], jobs: [] }); localStorage.setItem(K, JSON.stringify(s)); }, KEY);
await go();
const crew = () => E(() => MK.game.ch2.crew()); const btn = (a) => E((a) => { const e = document.querySelector(`[data-act="${a}"]`); return e ? { dis: e.disabled, on: e.classList.contains('go') } : null; }, a);
let c = await crew(); ok('old robots (no cos) load as classic/crescent', c.length === 3 && c.every(x => x.look.p === 'classic' && x.look.d === 'crescent'), JSON.stringify(c.map(x => x.look)));
await E(() => document.getElementById('mk-crewbtn').click()); await page.waitForTimeout(1200);
await E(() => document.querySelector('[data-act="cs:r2"]').click()); await page.waitForTimeout(500);
ok('locks: lvl-3 robot royal/paw open, museum options locked', !(await btn('cp:r2:royal')).dis && !(await btn('cd:r2:paw')).dis && (await btn('cp:r2:pearl')).dis && (await btn('cd:r2:bolt')).dis);
await E(() => document.querySelector('[data-act="cp:r2:royal"]').click()); await page.waitForTimeout(300); await E(() => document.querySelector('[data-act="cd:r2:paw"]').click()); await page.waitForTimeout(600);
await E(() => document.querySelector('[data-act="cs:r2"]')?.scrollIntoView({ block: 'start' })); await page.waitForTimeout(400); await page.screenshot({ path: OUT + 'panel.png' });
await E(() => { const b = document.querySelector('[data-act="cs:r1"]'); b.click(); }); await page.waitForTimeout(400); await E(() => document.querySelector('[data-act="cp:r1:navy"]').click()); await page.waitForTimeout(300); await E(() => document.querySelector('[data-act="cd:r1:star"]').click()); await page.waitForTimeout(300);
await E(() => { const b = document.querySelector('[data-act="cp:r1:royal"]'); b.disabled = false; b.click(); }); await page.waitForTimeout(300);
await E(() => document.querySelector('[data-act="cs:r3"]').click()); await page.waitForTimeout(400); await E(() => document.querySelector('[data-act="cp:r3:cyan"]').click()); await page.waitForTimeout(300); await E(() => document.querySelector('[data-act="cd:r3:star"]').click()); await page.waitForTimeout(500);
c = await crew(); const L = Object.fromEntries(c.map(x => [x.id, x.look.p + '/' + x.look.d]));
ok('picks applied live, forged locked pick ignored', L.r1 === 'navy/star' && L.r2 === 'royal/paw' && L.r3 === 'cyan/star', JSON.stringify(L));
await page.waitForFunction(() => true); await page.waitForTimeout(6000); await E(() => MK.store && MK.store.save && MK.store.save()); await page.waitForTimeout(3000);
const srv = save.snapshot && (typeof save.snapshot === 'string' ? JSON.parse(save.snapshot) : save.snapshot); const sr = srv && srv.ch2 && srv.ch2.robots || [];
ok('cos reaches the server save (world.save, v3)', sr.find(r => r.id === 'r2')?.cos?.p === 'royal' && sr.find(r => r.id === 'r1')?.cos?.d === 'star', JSON.stringify({ v: srv && (srv.v ?? srv.version), robots: sr }));
await go(); c = await crew(); ok('looks persist after reopen', Object.fromEntries(c.map(x => [x.id, x.look.p])).r2 === 'royal');
// painted crew shot: put the crew in a row in front of the camera
await E(() => document.querySelector('#mk-sheet .x, #mk-sheet [data-close]')?.click());
// painted crew shot: idle crew stand at their depot homes; walk the cat next to them and look back at the group
const cr = await crew(); const cx = cr.reduce((a, x) => a + x.x, 0) / cr.length, cz = cr.reduce((a, x) => a + x.z, 0) / cr.length;
for (const [i, [yaw, d]] of [[0, 2.8], [Math.PI, 2.8], [0.6, 3.2]].entries()) { const c2 = await crew(); const mx = c2.reduce((a, x) => a + x.x, 0) / c2.length, mz = c2.reduce((a, x) => a + x.z, 0) / c2.length; await E(([cx, cz, yaw, d]) => { MK.ctrl.place(cx - Math.sin(yaw) * d, cz - Math.cos(yaw) * d, yaw, true); MK.ctrl.camDist = 4.4; }, [mx, mz, yaw, d]); await page.waitForTimeout(3000); await page.screenshot({ path: OUT + 'robots_' + i + '.png' }); }
ok('no page errors', logs.length === 0, logs.slice(0, 3).join(' | ')); ok('no Bot API calls', tgApi.length === 0);
console.log('calls', JSON.stringify([...new Set(calls)])); console.log(`SUMMARY cos ${results.filter(Boolean).length}/${results.length}`); await browser.close(); process.exit(results.every(Boolean) ? 0 : 1);
