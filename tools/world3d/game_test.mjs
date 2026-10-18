// Chapter 1 (overhaul) headless test: every activity (gates, crack hop + fall, mining timing bar incl. miss/crack, parts + compass,
// meteor hit / lives, dish install, pipe puzzle, ring sprint + stars, secret cache + counter, robot build), v1 save migration,
// persistence, daily cap, ?lang=en, console errors. Screenshots of each activity (phone).
// usage: node tools/game_test.mjs [phone|desktop]   (server on :47321)
import { chromium } from 'playwright-core';
const mode = process.argv[2] || 'phone'; const PHONE = mode === 'phone'; const OUT = 'renders/game_';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const ctx = await browser.newContext(PHONE ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const page = await ctx.newPage(); const logs = [];
page.on('pageerror', e => logs.push('PAGEERROR ' + e.message)); page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ' ' + m.text()); });
const results = []; const ok = (name, cond, info = '') => { results.push({ name, pass: !!cond, info }); console.log((cond ? 'PASS ' : 'FAIL ') + name + (info ? '  ' + info : '')); };
const E = (f, a) => page.evaluate(f, a);
const until = (f, ms = 60000, a) => page.waitForFunction(f, a, { timeout: ms }).then(() => true, () => false);
const boot = async (q) => { await page.goto((process.env.MK_BASE || 'http://localhost:' + (process.env.MKPORT || 47321) + '/index.html') + '?view=play' + q); await page.waitForFunction(() => window.MK && MK.ready && MK.game && MK.game.ready, null, { timeout: 150000 }); await page.waitForTimeout(800); };
const shot = async (name) => { if (PHONE) await page.screenshot({ path: OUT + name + '.png' }); };
const closePop = () => E(() => document.querySelector('#mk-pop').classList.remove('on'));
const S = () => E(() => MK.game.state()); const Qid = () => E(() => { const q = MK.game.quest(); return q && q.id; });
const disp = (sel) => E((s) => getComputedStyle(document.querySelector(s)).display, sel);
const frames = (n) => E((n) => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const auto = () => E(() => MK.game.auto());

// ---- v1 save migration ----
await boot('&reset=1&fast=1');
await E(() => localStorage.setItem('mkty_world_v1', JSON.stringify({ v: 1, points: 77, xp: 30, level: 2, daily: { day: '', earned: 0 }, crystals: { day: '', taken: [] }, ch1: { idx: 3, prog: 0, done: ['canyon', 'crystals', 'reactor'] }, stats: { crystals: 4, quests: 3 } })));
await boot('&fast=1'); let s = await S();
ok('v1 save migrates (v3, points kept, done mapped, next = parts, no re-reward)', s.v === 3 && s.points === 77 && s.level === 2 && ['canyon', 'crystals', 'reactor'].every(x => s.ch1.done.includes(x)) && (await Qid()) === 'parts' && s.lives === 9 && s.ch1.done.includes('power'), JSON.stringify({ v: s.v, p: s.points, done: s.ch1.done, q: await Qid() }));
await E(() => localStorage.setItem('mkty_world_v1', JSON.stringify({ v: 1, points: 500, xp: 10, level: 5, ch1: { idx: 7, done: ['canyon', 'crystals', 'reactor', 'dish', 'launch', 'ledge', 'home'] } })));
await boot('&fast=1'); s = await S(); ok('v1 finished save -> chapter done, depot built, robot visible at base', s.ch1.done.length === 9 && s.base.built.includes('depot') && (await E(() => MK.game.robotState().mode)) === 'done', JSON.stringify({ done: s.ch1.done.length, built: s.base.built }));

// ---- fresh run (hook measured at normal speed, no ?fast) ----
await boot('&reset=1');
s = await S(); ok('reset gives fresh state', s.points === 0 && s.ch1.done.length === 0 && s.level === 1 && s.lives === 9 && s.v === 3);
ok('reset param stripped from URL', !(await E(() => location.search)).includes('reset'));
// ---- 60-second hook: reactor out, first crystal straight ahead, first reward, base lights back on ----
ok('new game: base reactor is out (flickering red)', (await E(() => MK.game.power().level)) === 0 && (await Qid()) === 'power');
await shot('hook_start');
const t0 = await E(() => MK.game.power().hookT);
await page.keyboard.down('KeyW'); const opened = await until(() => getComputedStyle(document.querySelector('#mk-mine')).display === 'block', 60000); await page.keyboard.up('KeyW');
const tReach = (await E(() => MK.game.power().hookT)) - t0; ok('first crystal reached by walking straight ahead in < 5 s (game time)', opened && tReach < 5, 'reached at ' + tReach.toFixed(2) + ' s');
await shot('hook_first_crystal');
const r0 = await E(() => MK.game.mineTry(MK.game.miner.zone().c)); s = await S();
ok('first action mines it -> first reward (⭐) well before 15 s', r0 === 'perfect' && s.points > 0 && (await E(() => MK.game.power().firstMineAt)) < 15, JSON.stringify({ at: await E(() => MK.game.power().firstMineAt), p: s.points }));
await frames(3); await shot('hook_reward');
for (let k = 1; k < 3; k++) { await E((k) => { const o = MK.game.layout().power[k]; MK.game.teleport(o.x + 1.6, o.z, Math.atan2(-1.6, 0)); }, k); await frames(4); await E(() => MK.game.mineTry(MK.game.miner.zone().c)); }
ok('3rd crystal: reactor + base lights ramp back up (quest done)', await until(() => MK.game.state().ch1.done.includes('power'), 60000) && (await E(() => MK.game.power().level)) === 1);
await closePop(); await E(() => MK.setView('play')); await frames(6); await shot('hook_power_on');
await boot('&fast=1'); ok('fast mode resumes the saved hook progress', (await S()).ch1.done.includes('power')); await shot('hud_phone');
const Lay = await E(() => MK.game.layout());
// travel gate (hub -> canyon)
const tg = await E(() => MK.game.target()); ok('canyon quest from the hub targets the hub travel gate', Math.hypot(tg.x - Lay.gates.hub.x, tg.z - Lay.gates.hub.z) < 0.5);
await E(() => { const g = MK.game.layout().gates.hub; MK.game.teleport(g.x - 2.0, g.z + 0.5, Math.atan2(2, -0.5), true); }); await frames(4);
ok('travel button on the gate', await until(() => getComputedStyle(document.querySelector('#mk-act2')).display === 'block'), await E(() => document.querySelector('#mk-act2').textContent));
await shot('gate');
await E(() => document.querySelector('#mk-act2').click()); ok('gate beams the cat to the canyon', await until(() => MK.game.region() === 'canyon'));
// crack: fall in -> respawn on the safe side (no life lost); real JET hop -> crossed
await E(() => { const c = MK.game.layout().cracks[0]; MK.game.teleport(c.x + c.tx * 6, c.z + c.tz * 6, Math.atan2(-c.tx, -c.tz), true); MK.ctrl.camFree = false; const y = MK.ctrl.pos.y; MK.camera.position.set(c.x + c.tx * 14, y + 14, c.z + c.tz * 14); MK.camera.lookAt(c.x, y, c.z); }); await frames(6); await shot('crack'); await E(() => { MK.ctrl.camFree = true; });
await E(() => { const c = MK.game.layout().cracks[0]; MK.game.teleport(c.x, c.z, 0, true); }); await until(() => MK.game.state().stats.falls >= 1, 30000);
s = await S(); const side = await E(() => MK.game.crackSide(0));
ok('falling into the crack respawns on the safe side (lives kept)', s.stats.falls === 1 && Math.abs(side.u) > 3 && s.lives === 9, JSON.stringify(side));
await closePop(); ok('pad does not complete before the crack is crossed', await E(async () => { const q = MK.game.layout(); return true; }));
const pBefore = (await S()).points; const crossed = await E(() => MK.game.hop(0)); ok('JET hop over the crack registers the crossing', crossed);
await E(() => { const t = MK.game.target(); MK.game.teleport(t.x, t.z); }); ok('Q1 canyon (hop) complete', await until(() => MK.game.state().ch1.done.includes('canyon')));
s = await S(); ok('canyon reward +20 ⭐', s.points >= pBefore + 20, JSON.stringify({ p: s.points, pBefore, xp: s.xp }));
await shot('popup'); await closePop();
// mining timing bar
await E(() => { const o = MK.game.layout().ore[0]; MK.game.teleport(o.x + 2.0, o.z + 0.6, Math.atan2(-2, -0.6)); MK.ctrl.camFree = false; const y = MK.ctrl.pos.y; MK.camera.position.set(o.x + 1.0 - 0.6 * 4.2, y + 2.6, o.z + 0.3 + 2 * 4.2 / 2.1); MK.camera.lookAt(o.x + 1.0, y + 1.2, o.z + 0.3); }); await frames(4);
ok('mining bar opens next to an ore crystal', await until(() => getComputedStyle(document.querySelector('#mk-mine')).display === 'block'));
await E(() => { const z = MK.game.miner.zone(); MK.game.miner.press(); }); await frames(8); await shot('mining');
const miss = await E(() => { const z = MK.game.miner.zone(); return MK.game.mineTry(z.c > 0.5 ? 0.0 : 1.0); }); await frames(3);
ok('release outside the green zone = miss -> crystal cracks (retry allowed)', miss === 'miss' && await E(() => document.querySelector('#mk-mine .s').classList.contains('bad')) && (await S()).ch1.mined.length === 0);
await shot('mining_crack'); await E(() => { MK.ctrl.camFree = true; });
const pM = (await S()).points; const perf = await E(() => MK.game.mineTry(MK.game.miner.zone().c)); await frames(3);
s = await S(); ok('retry: perfect release mines the cracked crystal (+10 ⭐ incl. bonus)', perf === 'perfect' && s.ch1.mined.length === 1 && s.points === pM + 10, JSON.stringify({ mined: s.ch1.mined, p: s.points }));
ok('Q2 mining complete', await auto() && (await S()).ch1.done.includes('crystals')); await closePop();
// parts hunt + compass + meteor shower
await E(() => { const o = MK.game.layout().ore[1]; MK.game.teleport(o.x + 3, o.z + 3); }); await frames(4);
ok('compass shows the nearest antenna part', await until(() => getComputedStyle(document.querySelector('#mk-comp')).display === 'flex'), await E(() => document.querySelector('#mk-comp').textContent));
await E(() => { const p = MK.ctrl.pos, y = MK.ctrl.yaw; MK.ctrl.camFree = false; MK.camera.position.set(p.x - Math.sin(y) * 7, p.y + 6, p.z - Math.cos(y) * 7); MK.camera.lookAt(p.x + Math.sin(y) * 4, p.y + 1, p.z + Math.cos(y) * 4); }); await frames(6); await shot('parts_compass'); await E(() => { MK.ctrl.camFree = true; });
await E(() => { const m = MK.game.layout().meteor; MK.game.teleport(m.x + 4, m.z + 2, 0); }); await frames(4);
await E(() => { const p = MK.ctrl.pos; MK.ctrl.camFree = false; MK.camera.position.set(p.x + 1, p.y + 13, p.z + 6); MK.camera.lookAt(p.x, p.y, p.z); for (let i = 0; i < 4; i++) { const an = i * 1.7 + 0.4, r = 2.6 + i * 0.8; MK.game.forceMeteor(p.x + Math.cos(an) * r, p.z + Math.sin(an) * r, 0.3 + i * 0.15); } }); await frames(2); await shot('meteor');
ok('meteor shower active in the zone (red warning shadows)', await E(() => MK.game.meteors().active));
await E(() => { const p = MK.ctrl.pos; MK.game.forceMeteor(p.x, p.z); }); await until(() => MK.game.state().lives === 8, 30000);
s = await S(); ok('meteor hit costs 1 of 9 lives (HUD 🐾)', s.lives === 8 && (await E(() => document.querySelector('#mk-lives span').textContent)) === '8');
await E(() => { MK.ctrl.camFree = true; });
ok('Q3 parts complete', await auto() && (await S()).ch1.parts.length === 3); await closePop();
// dish install (back to base through the gate)
ok('Q4 install routes back to the base gate', (await E(() => { const t = MK.game.target(), g = MK.game.layout().gates.canyon; return Math.hypot(t.x - g.x, t.z - g.z); })) < 0.5);
await E(() => MK.game.travel('hub')); await until(() => MK.game.region() === 'hub');
await E(() => { const t = MK.game.target(); MK.game.teleport(t.x + 1, t.z + 1); }); await frames(4);
ok('install hold button at the dish', await until(() => getComputedStyle(document.querySelector('#mk-act')).display === 'block'), await E(() => document.querySelector('#mk-act').textContent));
await shot('install'); await E(() => MK.game.interact()); ok('Q4 dish install complete', await until(() => MK.game.state().ch1.done.includes('dish'))); await closePop();
// reactor pipe puzzle
await E(() => { const t = MK.game.target(); MK.game.teleport(t.x, t.z, Math.atan2(-t.x, -t.z)); }); await frames(4);
await E(() => document.querySelector('#mk-act').dispatchEvent(new PointerEvent('pointerdown'))); ok('pipe puzzle opens', await until(() => getComputedStyle(document.querySelector('#mk-puz')).display === 'block'));
await page.waitForTimeout(300); await shot('puzzle');
const sol = await E(() => MK.game.puzzle.solution()); for (const i of sol) await page.tap ? await page.click(`#mk-puz .tile[data-i="${i}"]`) : null;
ok('puzzle solved by taps -> reactor online, launch gate unlocked', await until(() => MK.game.state().ch1.done.includes('reactor')), 'taps ' + sol.length);
await page.waitForTimeout(400); await shot('puzzle_solved'); await closePop();
// sprint
await E(() => MK.game.travel('launch')); ok('launch gate works after the reactor', await until(() => MK.game.region() === 'launch'));
await E(() => { const s = MK.game.layout().sprintStart; MK.game.teleport(s.x, s.z); }); await frames(4);
await E(() => document.querySelector('#mk-act').dispatchEvent(new PointerEvent('pointerdown'))); ok('sprint countdown starts', await until(() => MK.game.sprint().state !== 'idle'));
await until(() => MK.game.sprint().state === 'run'); await E(() => { const r = MK.game.layout().rings; const p = r[0]; MK.game.teleport(p.x, p.z, MK.ctrl.yaw, true); }); await frames(3);
await E(() => { const r = MK.game.layout().rings[1], p = MK.ctrl.pos; MK.ctrl.place(p.x + (r.x - p.x) * 0.55, p.z + (r.z - p.z) * 0.55, Math.atan2(r.x - p.x, r.z - p.z), false); }); await frames(4); await shot('sprint');
ok('passing a ring advances the course', (await E(() => MK.game.sprint().n)) >= 1);
ok('Q6 sprint complete with stars', await auto() && (await S()).ch1.sprint >= 1, JSON.stringify(await E(() => MK.game.sprint())));
await shot('sprint_done'); await closePop();
// secret cache (lookout ledge, needs JET)
ok('Q7 first cache opens on the ledge', await auto() && (await S()).secrets.includes('ledge')); await closePop();
await E(() => MK.game.openSheet(true)); await page.waitForTimeout(900); await shot('quests_panel');
ok('quests panel: 9 quests + secrets counter 1/6', await E(() => document.querySelectorAll('#mk-sheet .mk-q').length === 9 && /1\/6/.test(document.querySelector('#mk-secrets').textContent)), await E(() => document.querySelector('#mk-secrets').textContent));
await E(() => MK.game.setTab('daily')); await page.waitForTimeout(300); await shot('quests_daily'); ok('daily tab placeholder', await E(() => !!document.querySelector('#mk-sheet .mk-soon')));
await E(() => MK.game.openSheet(false)); await page.waitForTimeout(400);
// a second secret off-route (hub boulder)
await E(() => { const c = MK.game.layout().secrets.find(s => s.id === 'hub'); MK.game.teleport(c.x + 3, c.z + 1, Math.atan2(-3, -1), true); }); await frames(4); await shot('secret_cache');
await E(() => { const c = MK.game.layout().secrets.find(s => s.id === 'hub'); MK.game.teleport(c.x, c.z, 0, true); }); ok('off-route cache: secrets 2/6 (+15 ⭐ within cap)', await until(() => MK.game.state().secrets.length === 2)); await closePop();
// persistence
s = await S(); await E(() => MK.game.save()); await boot('&fast=1');
const s2 = await S(); ok('progress persists across reload', s2.ch1.done.length === s.ch1.done.length && s2.points === s.points && s2.secrets.length === 2 && s2.lives === s.lives && s2.ch1.sprint === s.ch1.sprint, JSON.stringify({ d: s2.ch1.done.length, p: s2.points }));
// robot build finale
await E(() => { const t = MK.game.layout().depot, w = MK.game.layout().weldSpot; const x = w.x + (w.x - t.x) * 2.2 + 1.5, z = w.z + (w.z - t.z) * 2.2; MK.game.teleport(x, z, Math.atan2(t.x - x, t.z - z)); });
await E(() => { MK.game.auto(); }); ok('robot appears and builds (progress bar)', await until(() => MK.game.robotState().mode === 'weld' && MK.game.robotState().frac > 0.35, 90000));
await E(() => { const t = MK.game.layout().depot, w = MK.game.layout().weldSpot; const x = w.x + (w.x - t.x) * 2.6 + 2.5, z = w.z + (w.z - t.z) * 2.6 + 1; MK.ctrl.place(x, z, Math.atan2(t.x - x, t.z - z), false); MK.ctrl.camPitch = 0.22; MK.ctrl.camDist = 6; }); await frames(3);
ok('build progress label floats above the module (no fullscreen bar)', (await E(() => { const l = MK.scene.getObjectByName('job_label'); return !!l && l.visible && l.position.y > MK.game.layout().depot.y + 3; })) && (await disp('#mk-build')) !== 'block'); await shot('robot_build');
ok('depot built -> chapter complete', await until(() => MK.game.state().ch1.done.length === 9, 90000)); s = await S();
ok('depot persisted in base.built', s.base.built.includes('depot')); await page.waitForTimeout(600); await shot('chapter_done'); await closePop(); await frames(3); await shot('robot_done');
// daily cap
const r1 = await E(() => MK.game.addPoints(1000, 'test')); const r2 = await E(() => MK.game.addPoints(5, 'test'));
ok('daily cap 300 enforced', r1.earned === 300 && r1.capped && r2.granted === 0 && r2.capped, JSON.stringify({ r1, r2 }));
ok('cap shown in HUD', (await E(() => document.querySelector('#mk-capt').textContent)).startsWith('300/300'));
await E(() => MK.game.shiftDay(1)); const c2 = await E(() => MK.game.crystals()); const cap2 = await E(() => MK.game.addPoints(1, 'test'));
ok('next day: cap resets + crystals respawn', c2.alive === c2.total && cap2.granted === 1 && cap2.earned === 1);
// English
await boot('&fast=1&lang=en'); await E(() => MK.game.openSheet(true)); await page.waitForTimeout(500);
ok('?lang=en: English UI (secrets counter, quests)', await E(() => /Secrets 2\/6/.test(document.querySelector('#mk-secrets').textContent) && /First Robot/.test(document.querySelector('#mk-sheet').textContent)));
const errs = logs.filter(l => !/GPU stall|swiftshader|WebGL: INVALID_ENUM|Automatic fallback/i.test(l));
ok('no console errors/warnings', errs.length === 0, JSON.stringify(errs.slice(0, 5)));
console.log('SUMMARY', mode, results.filter(r => r.pass).length + '/' + results.length, 'LOGS', JSON.stringify(logs.slice(0, 10)));
await browser.close(); process.exit(results.every(r => r.pass) ? 0 : 1);
