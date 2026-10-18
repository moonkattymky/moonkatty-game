// Telegram-like WebView test for the Mini App port of chapter 1.
// Mobile Chromium (touch, DPR 3, 390x844) with a mocked Telegram WebApp SDK (served instead of telegram.org/js/telegram-web-app.js)
// and the REAL rewards Edge Function handler (server/rewards/core.mjs) running in Node against an in-memory fake database,
// so client <-> server world.state / world.save / world.reward are exercised end to end without live secrets.
// usage: MK_BASE=http://127.0.0.1:47400/world3d/index.html node tools/world3d/tg_webview_test.mjs   -> renders/port_tg_*.png
import { chromium } from 'playwright-core';
import { createHandler } from '../../server/rewards/core.mjs';
const BASE = process.env.MK_BASE || 'http://127.0.0.1:47400/world3d/index.html';
const OUT = process.env.MK_OUT || 'renders/port_tg_';
const results = []; const ok = (n, c, i = '') => { results.push({ n, pass: !!c }); console.log((c ? 'PASS ' : 'FAIL ') + n + (i ? '  ' + i : '')); };
// ---------- fake DB + real handler ----------
let skew = 0; const db = { player: null, events: [], save: { revision: 0, snapshot: {} } }; let down = false; const calls = [];
const J = (x, s = 200) => new Response(JSON.stringify(x), { status: s });
const fetcher = async (url, opts = {}) => { const u = new URL(url), p = u.pathname, m = (opts.method || 'GET').toUpperCase(), b = opts.body ? JSON.parse(opts.body) : null; const now = new Date(Date.now() + skew).toISOString();
  if (p.endsWith('/players')) { if (m === 'GET') return J(db.player ? [db.player] : []); if (m === 'POST') { db.player = { telegram_id: b.telegram_id, moon_points: 1000, lives: 9, story_life: 1, created_at: now }; return J([db.player]); } if (m === 'PATCH') { Object.assign(db.player, b); return J([db.player]); } }
  if (p.endsWith('/reward_events')) return J(db.events.filter(e => e.event_key.startsWith('world3d:')));
  if (p.endsWith('/rpc/mkty_restore_lives')) return J(db.player);
  if (p.endsWith('/rpc/mkty_rate_limit')) return J({ allowed: true });
  if (p.endsWith('/rpc/mkty_reward')) { if (db.events.find(e => e.event_key === b.p_key)) return J({ inserted: false, player: db.player }); db.events.push({ event_key: b.p_key, points: b.p_points, created_at: b.p_now }); db.player.moon_points += b.p_points; return J({ inserted: true, player: db.player }); }
  if (p.endsWith('/rpc/mkty_world_save')) { if (b.p_snapshot == null) return J(db.save); if (b.p_expected !== db.save.revision) return J({ conflict: true, ...db.save }); db.save = { revision: db.save.revision + 1, snapshot: b.p_snapshot }; return J({ revision: db.save.revision }); }
  return J({}); };
const handler = createHandler({ url: 'https://fake.supabase.co', key: 'fake-service-key', fetcher, verify: async (d) => { if (!/user=/.test(d || '')) throw Error('auth'); return { id: 777001, first_name: 'Tester' }; }, clock: () => new Date(Date.now() + skew), rateLimit: true, sessionSecret: 'local-test-only-session-secret' });
// ---------- mocked Telegram SDK ----------
const SDK = `(()=>{const ev={},log=[];const fire=(n,a)=>(ev[n]||[]).forEach(f=>f(a));const user=encodeURIComponent(JSON.stringify({id:777001,first_name:'Tester',language_code:'ru'}));
const back={isVisible:false,show(){this.isVisible=true;log.push('back.show')},hide(){this.isVisible=false;log.push('back.hide')},onClick(f){(ev.backButtonClicked||=[]).push(f)},offClick(){}};
window.Telegram={WebApp:{initData:'query_id=AA&user='+user+'&auth_date='+Math.floor(Date.now()/1000)+'&signature=x&hash=y',initDataUnsafe:{user:{id:777001,language_code:'ru'}},version:'8.0',platform:'android',
viewportHeight:innerHeight,viewportStableHeight:innerHeight,safeAreaInset:{top:0,bottom:0,left:0,right:0},contentSafeAreaInset:{top:0,bottom:0,left:0,right:0},isExpanded:false,
isVersionAtLeast(v){return parseFloat(v)<=8.0},ready(){log.push('ready')},expand(){this.isExpanded=true;log.push('expand')},disableVerticalSwipes(){log.push('disableVerticalSwipes')},enableClosingConfirmation(){log.push('closingConfirmation')},
setHeaderColor(c){log.push('header:'+c)},setBackgroundColor(c){log.push('bg:'+c)},setBottomBarColor(c){log.push('bottombar:'+c)},close(){log.push('close')},
onEvent(n,f){(ev[n]||=[]).push(f)},offEvent(){},BackButton:back,HapticFeedback:{impactOccurred(s){log.push('haptic:impact:'+s)},notificationOccurred(s){log.push('haptic:notify:'+s)},selectionChanged(){log.push('haptic:select')}}}};
window.__tg={log,fire,back:()=>fire('backButtonClicked')};})();`;
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const device = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36 Telegram-Android/11.2.0' };
async function newPage() {
  const ctx = await browser.newContext(device); const page = await ctx.newPage(); const logs = [];
  page.on('pageerror', e => logs.push('PAGEERROR ' + e.message)); page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ' ' + m.text()); });
  await page.route('https://telegram.org/js/telegram-web-app.js*', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: SDK }));
  await page.route('https://lswbmgoeinblzuqzakvi.supabase.co/functions/v1/rewards', async r => { const req = r.request(); if (down) return r.fulfill({ status: 503, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"ok":false,"error":"unavailable"}' });
    if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'POST' } });
    const body = req.postData(); try { calls.push(JSON.parse(body).action); } catch (e) { }
    const res = await handler(new Request('https://fake/rewards', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1' }, body })); r.fulfill({ status: res.status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: await res.text() }); });
  return { ctx, page, logs };
}
const E = (page, f, a) => page.evaluate(f, a);
const boot = async (page, q = '') => { await page.goto(BASE + '?view=play&fast=1' + q); await page.waitForFunction(() => window.MK && MK.ready && MK.game && MK.game.ready, null, { timeout: 180000 }); await page.waitForTimeout(1200); };
const t0 = Date.now();
// ---------- device A ----------
const A = await newPage(); const pa = A.page;
await pa.route('**/assets/moonkatty.glb*', async r => { await new Promise(s => setTimeout(s, 6000)); r.continue(); }); // slow network: show the loading screen
await pa.goto(BASE + '?view=play&fast=1', { waitUntil: 'domcontentloaded' }); await pa.waitForTimeout(1500); await pa.screenshot({ path: OUT + 'loading.png', timeout: 60000 });
ok('loading screen visible while assets download', await E(pa, () => getComputedStyle(document.getElementById('loading')).display !== 'none'));
await pa.waitForFunction(() => window.MK && MK.ready && MK.game && MK.game.ready, null, { timeout: 180000 }); await pa.waitForTimeout(1500);
ok('boot in Telegram WebView < 180 s', true, ((Date.now() - t0) / 1000).toFixed(1) + ' s (swiftshader, CPU)');
let log = await E(pa, () => __tg.log);
ok('SDK: ready + expand + disableVerticalSwipes + colors + closing confirmation', ['ready', 'expand', 'disableVerticalSwipes', 'header:#05070d', 'bg:#05070d', 'closingConfirmation'].every(x => log.includes(x)), JSON.stringify(log.slice(0, 10)));
ok('BackButton shown', await E(pa, () => Telegram.WebApp.BackButton.isVisible));
ok('dev camera buttons hidden inside Telegram', (await E(pa, () => getComputedStyle(document.getElementById('views')).display)) === 'none');
ok('session via initData then world.state', calls.includes('session') && calls.includes('world.state'), JSON.stringify(calls));
ok('HUD shows server Moon Points balance (1000)', (await E(pa, () => MK.game.state().points)) === 1000);
await pa.screenshot({ path: OUT + 'start.png' });
// play the first quests (fast auto); server enforces quest order + 8 s gap -> claims queue and flush
for (let i = 0; i < 3; i++) { await E(pa, () => MK.game.auto()); skew += 9000; await pa.waitForTimeout(600); await E(pa, () => { const p = document.querySelector('#mk-pop'); p && p.classList.remove('on'); }); }
log = await E(pa, () => __tg.log);
ok('haptics on key actions (quest success, mining, travel)', log.includes('haptic:notify:success') && log.some(x => /haptic:impact:(medium|heavy)/.test(x)), JSON.stringify(log.filter(x => x.startsWith('haptic')).slice(0, 8)));
// wait for queued claims to flush (client retries every 10 s)
await pa.waitForFunction(() => { try { return JSON.parse(localStorage.getItem('mkty_world_pending_v1_777001') || '[]').length === 0; } catch (e) { return false; } }, null, { timeout: 60000 }).catch(() => { });
const keys = db.events.map(e => e.event_key);
ok('server ledger has chapter-1 quest rewards (power, canyon, crystals)', ['world3d:c1:q:power', 'world3d:c1:q:canyon', 'world3d:c1:q:crystals'].every(k => keys.includes(k)), JSON.stringify(keys));
ok('server Moon Points increased by exactly the server-side amounts', db.player.moon_points === 1000 + db.events.reduce((a, e) => a + e.points, 0), String(db.player.moon_points));
await pa.waitForTimeout(2500);
ok('progress saved server-side (world.save CAS)', db.save.revision > 0 && (db.save.snapshot.ch1?.done || []).includes('crystals'), JSON.stringify({ rev: db.save.revision, done: db.save.snapshot.ch1?.done }));
ok('balance not stored in server snapshot', db.save.snapshot.points === undefined);
await pa.screenshot({ path: OUT + 'canyon.png' });
// back button: open sheet -> back closes it; nothing open -> leaves to ../
await E(pa, () => MK.game.openSheet(true)); await pa.waitForTimeout(500); await pa.screenshot({ path: OUT + 'sheet.png' });
await E(pa, () => __tg.back()); await pa.waitForTimeout(500);
ok('BackButton closes the quest sheet first', !(await E(pa, () => document.querySelector('#mk-sheet').classList.contains('on'))));
// pause / resume
const fr = () => E(pa, () => MK.renderer.info.render.frame);
await E(pa, () => __tg.fire('deactivated')); const f1 = await fr(); await pa.waitForTimeout(800); const f2 = await fr();
ok('deactivated -> rendering paused', (await E(pa, () => MK.isPaused())) && f2 === f1, f1 + ' -> ' + f2);
await E(pa, () => __tg.fire('activated')); await pa.waitForTimeout(800); const f3 = await fr();
ok('activated -> rendering resumes', !(await E(pa, () => MK.isPaused())) && f3 > f2, f2 + ' -> ' + f3);
// safe areas + viewport change (fullscreen insets, keyboard / landscape)
await E(pa, () => { Telegram.WebApp.safeAreaInset = { top: 47, bottom: 34, left: 0, right: 0 }; Telegram.WebApp.contentSafeAreaInset = { top: 46, bottom: 0, left: 0, right: 0 }; __tg.fire('safeAreaChanged'); });
await pa.waitForTimeout(300);
const tt = await E(pa, () => document.getElementById('mk-top').getBoundingClientRect().top);
ok('safe-area insets applied to HUD (title below Telegram header)', tt >= 93, 'title top ' + tt);
await pa.screenshot({ path: OUT + 'safearea.png' });
await pa.setViewportSize({ width: 844, height: 390 }); await E(pa, () => { Telegram.WebApp.viewportHeight = Telegram.WebApp.viewportStableHeight = 390; __tg.fire('viewportChanged', { isStateStable: true }); }); await pa.waitForTimeout(800);
const cs = await E(pa, () => [MK.renderer.domElement.width, MK.renderer.domElement.height, innerWidth, innerHeight]);
ok('viewportChanged -> renderer resized (landscape)', cs[0] >= cs[2] && cs[0] > cs[1], JSON.stringify(cs));
await pa.screenshot({ path: OUT + 'landscape.png' });
await pa.setViewportSize({ width: 390, height: 844 }); await E(pa, () => __tg.fire('viewportChanged', { isStateStable: true })); await pa.waitForTimeout(500);
// offline fallback: server down -> local grant + queue, game continues; back up -> flushed
down = true; const before = db.events.length; await E(pa, () => MK.game.auto()); await pa.waitForTimeout(1500); await E(pa, () => { const p = document.querySelector('#mk-pop'); p && p.classList.remove('on'); });
const pend = await E(pa, () => JSON.parse(localStorage.getItem('mkty_world_pending_v1_777001') || '[]').length);
ok('server down: game continues, claims queued locally', pend > 0 && (await E(pa, () => MK.game.state().ch1.done.includes('parts'))), 'pending ' + pend);
down = false; skew += 9000;
await pa.waitForFunction(() => JSON.parse(localStorage.getItem('mkty_world_pending_v1_777001') || '[]').length === 0, null, { timeout: 70000 }).catch(() => { });
ok('server back: queued claims confirmed', db.events.map(e => e.event_key).includes('world3d:c1:q:parts') && db.events.length > before);
await pa.waitForTimeout(2500);
const realA = A.logs.filter(l => !/status of 503/.test(l)); // the browser itself logs the simulated outage responses
ok('no console errors/warnings on device A (except the simulated 503s)', realA.length === 0, JSON.stringify(realA.slice(0, 5)));
// leave: back with nothing open -> ../
for (let i = 0; i < 4 && /world3d\/index\.html/.test(pa.url()); i++) { await E(pa, () => __tg.back()).catch(() => { }); await pa.waitForTimeout(1200); } // each press closes one overlay, then leaves
ok('BackButton with nothing open leaves the 3D world (../)', !/world3d\/index\.html/.test(pa.url()), pa.url());
await A.ctx.close();
// ---------- device B: same Telegram user, empty storage -> progress comes from the server ----------
const B = await newPage(); const pb = B.page; await boot(pb);
const sB = await E(pb, () => MK.game.state());
ok('second device restores progress from server', ['power', 'canyon', 'crystals', 'parts'].every(x => sB.ch1.done.includes(x)) && (await E(pb, () => MK.game.quest().id)) === 'dish', JSON.stringify(sB.ch1.done));
ok('second device shows the server balance', sB.points === db.player.moon_points, sB.points + ' vs ' + db.player.moon_points);
await pb.screenshot({ path: OUT + 'device2.png' });
ok('no console errors/warnings on device B', B.logs.length === 0, JSON.stringify(B.logs.slice(0, 5)));
await B.ctx.close(); await browser.close();
const pass = results.filter(r => r.pass).length; console.log(`SUMMARY tg-webview ${pass}/${results.length}`); process.exit(pass === results.length ? 0 : 1);
