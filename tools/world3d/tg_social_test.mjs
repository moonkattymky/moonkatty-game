// Friend help + notification opt-in in the Telegram WebView (mock SDK, REAL rewards handler on an in-memory fake DB).
// usage: MK_BASE=http://127.0.0.1:47400/world3d/index.html node tools/world3d/tg_social_test.mjs  -> renders/port_social_*.png
import { chromium } from '/workspace/port-tools/node_modules/playwright-core/index.mjs';
import { createHandler } from '../../server/rewards/core.mjs';
const BASE = process.env.MK_BASE || 'http://127.0.0.1:47400/world3d/index.html', OUT = process.env.MK_OUT || 'renders/port_social_';
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
await page.goto(BASE + '?view=play&fast=1&q=low'); await ready(); await page.waitForTimeout(1500);
// seed: chapter 2 open with a robot on a long expedition
await E((K) => { const s = JSON.parse(localStorage.getItem(K)) || MK.game.state(); s.ch1 = s.ch1 || {}; s.ch1.done = ['power', 'canyon', 'crystals', 'parts', 'dish', 'reactor', 'launch', 'secret', 'home']; s.base = s.base || {}; s.base.built = ['depot']; s.ch2 = Object.assign(s.ch2 || {}, { on: true, done: ['c2_collect', 'c2_home'], level: 2 }); localStorage.setItem(K, JSON.stringify(s)); }, KEY);
await page.goto(BASE + '?view=play&fast=1&q=low'); await page.waitForFunction(() => window.MK && MK.ready && MK.game && MK.game.ready && MK.game.ch2.on, null, { timeout: 200000 }); await page.waitForTimeout(1500);
const jobInfo = await E(() => { const S = MK.game.ch2.econ ? MK.game.ch2.econ.S : null; return S ? { robots: S.robots.length } : null; });
const job = await E(() => { const s = JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => k.startsWith('mkty_world_v1_tg_')))); return s && s.ch2 && s.ch2.robots && s.ch2.robots[0] && s.ch2.robots[0].id; });
ok('chapter 2 open with a robot', !!job, JSON.stringify(jobInfo));
// friend Анна helped me earlier today (server row), then the game is reopened with a running job
const now0 = Date.now(); await E(([K, rid, t]) => { const s = JSON.parse(localStorage.getItem(K)); s.ch2.jobs = [{ id: 'jT', rid, kind: 'expedition', what: 'e30', start: t - 5000, end: t + 600000, dur: 1800, help: 'none', bonus: 0 }]; localStorage.setItem(K, JSON.stringify(s)); }, [KEY, job, now0]);
help.push({ helper_id: 777002, target_id: ME });
await page.goto(BASE + '?view=play&fast=1&q=low'); await page.waitForFunction(() => window.MK && MK.ready && MK.game && MK.game.ready && MK.game.ch2.on, null, { timeout: 200000 });
await page.waitForFunction(() => document.body.innerText.includes('Друзья помогли'), null, { timeout: 60000 }).catch(() => { });
const toast = await E(() => document.body.innerText.includes('Друзья помогли (1)'));
const end1 = await E((K) => { const s = JSON.parse(localStorage.getItem(K)); const j = (s.ch2.jobs || []).find(x => x.id === 'jT'); return j ? j.end : null; }, KEY);
ok('received help applied: toast + job remaining time / 1.1', toast && end1 && end1 < now0 + 600000 - 40000, JSON.stringify({ toast, left_before: 600000, left_after: end1 ? end1 - now0 : null }));
ok('help consumed on the server', help.every(h => h.c), JSON.stringify(help));
await E(() => document.getElementById('mk-crewbtn').click()); await page.waitForTimeout(1200);
await E(() => { const el = document.getElementById('c2-fh'); if (el) el.scrollIntoView({ block: 'start' }); }); await page.waitForTimeout(600);
await page.screenshot({ path: OUT + 'panel.png' });
const ui = await E(() => [...document.querySelectorAll('[data-act^="fh:"]')].map(b => ({ id: b.dataset.act, name: b.querySelector('span').textContent, dis: b.disabled })));
ok('friend list = referral graph (inviter Анна + invitee Боб, not strangers)', ui.length === 2 && ui.some(x => x.name === 'Анна') && ui.some(x => x.name === 'Боб'), JSON.stringify(ui));
await E(() => document.querySelector('[data-act="fh:777003"]').click()); await page.waitForTimeout(2500);
ok('help Боб: stored once on the server, button now done', help.some(h => h.helper_id === ME && h.target_id === 777003) && await E(() => document.querySelector('[data-act="fh:777003"]').disabled));
await E(() => { const el = document.getElementById('c2-fh'); if (el) el.scrollIntoView({ block: 'start' }); }); await page.screenshot({ path: OUT + 'helped.png' });
await E(() => document.querySelector('[data-act="ntf"]').click()); await page.waitForTimeout(3000);
const log = await E(() => __tg.log);
ok('notify opt-in asks Telegram requestWriteAccess first, then stores opt-in', log.includes('writeAccess') && prefs.get(ME)?.opted_in === true, JSON.stringify([...prefs.values()]));
ok('next robot return scheduled (opted in only)', queue.has(ME + ':robot'), JSON.stringify([...queue.entries()]));
await E(() => { const el = document.getElementById('c2-fh'); if (el) el.scrollIntoView({ block: 'start' }); }); await page.screenshot({ path: OUT + 'notify.png' });
ok('no Telegram Bot API calls (sender off)', tgApi.length === 0, JSON.stringify(tgApi));
ok('no page errors', !logs.length, JSON.stringify(logs.slice(0, 3)));
console.log('calls', JSON.stringify([...new Set(calls)]));
console.log(`SUMMARY social ${results.filter(Boolean).length}/${results.length}`); await browser.close(); process.exit(results.every(Boolean) ? 0 : 1);
