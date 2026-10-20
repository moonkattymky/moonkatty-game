import { makeCrewRobot } from './robots.js';
import * as THREE from 'three';
import { pickLang, makeT } from './i18n.js';
import { createStore, LocalBackend } from './storage.js';
import { TelegramBackend } from '../tg/backend.js';
import { chapter1, addXP, xpForLevel } from './quests.js';
import { makeBeacon, makeCrystals, makeBurst } from './fx.js';
import { makeHUD, esc } from './hud.js';
import { makeMiner, makePuzzle } from './minigames.js';
import { makeGate, makeCrack, makeOre, makeParts, makeRings, makeMeteors, makeCache, makeDepot } from './activities.js';
import { makeRobot } from './robot.js';
import { makeProgressLabel, makeRobotJob } from './jobs.js';
import { DEPOT_STAGES } from './activities.js';
import { groundAt as terrainAt } from '../terrain.js';
import { createChapter2, FEAT } from './ch2.js';
import { makeWorldLife } from './worldlife.js';
import { BASE } from './economy.js';
import { makeHoloMap, fogGet, fogSet, fogReveal } from './holomap.js';

// Game layer: progression + Chapter 1 activities on top of the 3D world. createGame() is called once from main.js.
//   opts: { scene, camera, ctrl, renderer, env, solids, groundAt, Q, places, crystalSpots, layout }
//   layout (world positions, all pre-resolved to free spots by main.js):
//     gates {hub, canyon, launch}, regions {hub, canyon, launch} (centres), cracks [{x,z,tx,tz,w,len,region}], ore [{x,z}], parts [{x,z}],
//     meteor {x,z,r}, rings [{x,z,yaw}], secrets [{id,x,z,y?}], depot {x,z,yaw}, robotSpawn {x,z}
// TG glue: Telegram safe-area insets (CSS vars set by tg/telegram.js), cached ~0.5 s; 0 in a plain browser
let _tgI = { t: 0, b: 0 }, _tgAt = -1e9; function tgInsets() { const n = performance.now(); if (n - _tgAt > 500) { _tgAt = n; try { const cs = getComputedStyle(document.documentElement); _tgI = { t: parseFloat(cs.getPropertyValue('--tg-inset-top')) || 0, b: parseFloat(cs.getPropertyValue('--tg-inset-bottom')) || 0, qp: null }; const q = document.getElementById('mk-track'); if (q && q.offsetParent !== null) { const r = q.getBoundingClientRect(); if (r.height > 0) _tgI.qp = { r: r.right, b: r.bottom }; } } catch (e) { } } return _tgI; }
export function createGame({ scene, camera, ctrl, renderer, env, solids, setPower = () => { }, setNight = () => { }, setEarthDir = () => { }, sd = null, mobile = false, catRoot = null, earthDir = null, groundAt, visAt, Q, places, crystalSpots, layout: L }) {
  const FAST = Q.get('fast') === '1'; const lang = pickLang(Q); const t = makeT(lang);
  let dayOffset = 0; const clock = { off: 0 }; // test hooks: shift "today" / advance the job clock
  const nowMs = () => Date.now() + dayOffset * 864e5 + clock.off;
  // Telegram Mini App: server-backed progress + Moon Points (localStorage cache/fallback); plain browser: local only
  const TGW = window.Telegram?.WebApp; const tgInit = TGW && TGW.initData && Q.get('local') !== '1' ? TGW.initData : '';
  const backend = tgInit ? new TelegramBackend({ initData: tgInit }) : new LocalBackend();
  const HX = () => window.MKTYTG?.haptic; const hx = (k, a) => { try { HX()?.[k]?.(a); } catch (e) { } };
  const store = createStore({ backend, now: nowMs });
  const gy = (p) => (p.y != null ? p.y : groundAt(p.x, p.z));
  const P = {}; for (const [k, v] of Object.entries(places)) P[k] = { x: v.x, z: v.z, y: groundAt(v.x, v.z) };
  const Qs = chapter1(P, FAST);
  const hud = makeHUD(t); const beacon = makeBeacon(scene); const spots = crystalSpots.map(c => ({ x: c.x, z: c.z, y: groundAt(c.x, c.z) }));
  const crystals = makeCrystals(scene, spots); const burst = makeBurst(scene);
  const miner = makeMiner(hud.root, t, FAST); const puzzle = makePuzzle(hud.root, t, (moves) => onPuzzleSolved(moves));
  if (renderer) renderer.localClippingEnabled = true;
  const BASE_SPEED = FAST ? 3 : 1; ctrl.speedMul = BASE_SPEED;
  let ready = false, lastThrust = -99, time = 0, sheetOpen = false, tab = 'ch', busy = false;
  const D = () => store.data;
  const isDone = (id) => D().ch1.done.includes(id);
  const cur = () => Qs.find(q => !isDone(q.id)) || null;
  const syncIdx = () => { const i = Qs.findIndex(q => !isDone(q.id)); D().ch1.idx = i < 0 ? Qs.length : i; };
  const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const me = () => ctrl.pos;

  // ---------- world props ----------
  const G = {}; for (const [k, p] of Object.entries(L.gates)) G[k] = { ...p, y: groundAt(p.x, p.z), fx: makeGate(scene, { x: p.x, y: groundAt(p.x, p.z), z: p.z }, k === 'launch' ? '#ffb347' : '#a98bff') };
  const cracks = L.cracks.map(c => ({ ...c, fx: makeCrack(scene, c, groundAt), lastSide: 0, air: false }));
  const ore = makeOre(scene, L.ore.map(p => ({ x: p.x, z: p.z, y: groundAt(p.x, p.z) })), env);
  const pow = makeOre(scene, L.power.map(p => ({ x: p.x, z: p.z, y: groundAt(p.x, p.z) })), env); // hook: 3 energy crystals right by the spawn
  // mining sets: which field + which saved list a mining quest uses
  const MS = { mine: { f: ore, list: () => D().ch1.mined }, power: { f: pow, list: () => D().ch1.powered } };
  const mset = () => { const q = cur(); return q && MS[q.kind]; };
  const parts = makeParts(scene, L.parts.map(p => ({ x: p.x, z: p.z, y: groundAt(p.x, p.z) })), env);
  const rings = makeRings(scene, L.rings.map(r => ({ ...r, y: groundAt(r.x, r.z) })));
  const meteors = makeMeteors(scene, 5); const MZ = { ...L.meteor, y: groundAt(L.meteor.x, L.meteor.z) };
  const caches = L.secrets.map(s => { const y = s.y != null ? s.y : solids.standAt(s.x, s.z); return { ...s, y, fx: makeCache(scene, { x: s.x, y, z: s.z, yaw: s.yaw || 0 }, env) }; });
  const depotP = { ...L.depot, y: groundAt(L.depot.x, L.depot.z) }; const depot = makeDepot(scene, depotP, env);
  const robot = makeRobot(scene, env); robot.root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  // robot feet: highest visual contact under the two boots (not the cat capsule's conservative stand height)
  const VA = visAt || groundAt; const robotY = (x, z, yaw) => { const cx = Math.cos(yaw) * 0.25, cz = -Math.sin(yaw) * 0.25; return Math.max(VA(x + cx, z + cz), VA(x - cx, z - cz), VA(x, z)); };
  // flattest spot around the module within +-span of angle a0 (no rock lumps under the boots); used for every robot work spot
  const flatSpot = (a0, span) => { let best = null; for (let k = -16; k <= 16; k++) { const da = k * 0.1; if (Math.abs(da) > span + 1e-6) continue; for (const r of [2.45, 2.8, 3.2]) { const a = a0 + da, x = depotP.x + Math.cos(a) * r, z = depotP.z + Math.sin(a) * r; let bump = 0, lo = 1e9, hi = -1e9; for (const [ox, oz] of [[0, 0], [0.3, 0], [-0.3, 0], [0, 0.3], [0, -0.3]]) { const v = VA(x + ox, z + oz); lo = Math.min(lo, v); hi = Math.max(hi, v); bump = Math.max(bump, v - terrainAt(x + ox, z + oz), groundAt(x + ox, z + oz) - v); } bump += hi - lo; const sc = bump + Math.abs(k) * 0.004 + (r - 2.45) * 0.05; if (!best || sc < best.sc) best = { x, z, sc }; } } return { x: best.x, z: best.z }; };
  const weldSpot = flatSpot(Math.atan2(L.robotSpawn.z - depotP.z, L.robotSpawn.x - depotP.x), 1.6);
  const stageSpots = (() => { const wa = Math.atan2(weldSpot.z - depotP.z, weldSpot.x - depotP.x); return DEPOT_STAGES.map((s, i) => i === 0 ? weldSpot : flatSpot(wa + s.a, 0.35)); })();
  const STAGE_T = lang === 'ru' ? { foundation: 'Фундамент', frame: 'Каркас', panels: 'Панели', dome: 'Купол', lights: 'Свет' } : { foundation: 'Foundation', frame: 'Frame', panels: 'Panels', dome: 'Dome', lights: 'Lights' };
  const jobLabel = makeProgressLabel(scene);
  const depotCollider = { x: depotP.x, z: depotP.z, r: 1.65, h: 4.5 };
  // new props are solid too: ore clusters (until mined) and the robot (circle colliders, same system as the hub props)
  const oreCol = [...ore.spots.map((s, i) => ({ x: s.x, z: s.z, r: 0.75, h: 2.6, f: ore, i })), ...pow.spots.map((s, i) => ({ x: s.x, z: s.z, r: 0.75, h: 2.6, f: pow, i }))]; const robotCol = { x: 0, z: 0, r: 0.45, h: 1.9 };
  const syncCols = () => { const C = ctrl.colliders; oreCol.forEach((c) => { const on = c.f.mesh.visible && c.f.state[c.i].alive; const k = C.indexOf(c); if (on && k < 0) C.push(c); if (!on && k >= 0) C.splice(k, 1); }); const on = robot.root.visible && !ch2.on; const k = C.indexOf(robotCol); if (on) { robotCol.x = robot.root.position.x; robotCol.z = robot.root.position.z; if (k < 0) C.push(robotCol); } else if (k >= 0) C.splice(k, 1); };

  // ---------- helpers ----------
  const refreshTop = () => { const c = store.capInfo(); hud.setTop({ level: D().level, xp: D().xp, need: xpForLevel(D().level), points: D().points, earned: c.earned, cap: c.cap, cry: D().ch2 && D().ch2.on ? D().ch2.res.cry : D().stats.crystals }); hud.lives(D().lives); };
  const syncCrystals = () => { store.roll(); const tk = new Set(D().crystals.taken); spots.forEach((_, i) => crystals.setAlive(i, !tk.has(i))); };
  const syncProps = () => {
    const q = cur(); ore.state.forEach((s, i) => { s.alive = !isDone('crystals') && !D().ch1.mined.includes(i); });
    parts.alive.forEach((_, i) => parts.alive[i] = !D().ch1.parts.includes(i)); parts.mesh.visible = q && q.id === 'parts';
    ore.mesh.visible = !isDone('crystals') && isDone('canyon');
    pow.state.forEach((s, i) => { s.alive = !isDone('power') && !D().ch1.powered.includes(i); }); pow.mesh.visible = !isDone('power');
    powerLevel = isDone('power') ? 1 : D().ch1.powered.length / 3; if (!powerAnim) setPower(powerLevel >= 1 ? 1 : powerLevel * 0.5, powerLevel >= 1 ? 0 : 1);
    caches.forEach(c => c.fx.mesh.visible = !D().secrets.includes(c.id));
    G.launch.fx.setOn(isDone('reactor')); G.launch.fx.mesh.visible = true;
    if (D().base.built.includes('depot')) { depot.set(1, false); if (!ctrl.colliders.includes(depotCollider)) ctrl.colliders.push(depotCollider); robotState.mode = 'done'; placeRobot(weldSpot, depotP, true); }
  };
  let powerLevel = 1, powerAnim = 0, hookT = 0;
  async function grant(n, why) { const r = await store.addPoints(n, why); refreshTop(); return r; }
  async function reward(q, extra = {}) {
    if (busy || isDone(q.id)) return; busy = true; const pts = q.pts + (extra.bonus || 0); const r = await store.addPoints(pts, 'quest:' + q.id); const ups = addXP(D(), q.xp); hx('notify', 'success');
    if (!isDone(q.id)) D().ch1.done.push(q.id); D().ch1.prog = 0; D().stats.quests++; syncIdx(); await store.save(); refreshTop();
    const last = !cur();
    hud.popup({ icon: last ? '🏆' : (extra.icon || q.icon), head: last ? t('chapterDone') : t('questDone'), title: (extra.title || t('q_' + q.id + '_t')), pts: r.granted, xp: q.xp, level: ups ? D().level : 0, note: r.capped ? `${t('capPart')}: ${r.earned}/${r.cap}` : (extra.note || (last ? t('chapterDoneSub') : '')) }, last ? 4600 : 3000);
    busy = false; syncProps(); if (sheetOpen) renderSheet();
  }
  async function pickCrystal(i) {
    crystals.setAlive(i, false); D().crystals.taken.push(i); D().stats.crystals++; const s = spots[i]; burst.fire(s.x, s.y + 1.0, s.z);
    const r = await store.addPoints(3, 'crystal:' + i); addXP(D(), 5); hx('impact', 'light');
    hud.toast(r.granted ? `💎 ${t('crystalToast')} +${r.granted} ⭐` : `💎 ${t('capHit')}`); store.queueSave(); refreshTop(); if (ch2.on) ch2.track('crystals');
  }
  // ---------- regions + travel gates (no more running across the map) ----------
  const regionOf = (p) => { let best = 'hub', bd = Math.hypot(p.x - L.regions.hub.x, p.z - L.regions.hub.z) - 120; for (const k of ['canyon', 'launch']) { const d = Math.hypot(p.x - L.regions[k].x, p.z - L.regions[k].z); if (d < bd) { bd = d; best = k; } } return best; };
  const gateOpen = (k) => k !== 'launch' || isDone('reactor');
  const travelOptions = () => { const r = regionOf(me()); const g = G[r]; if (!g || dist2(me(), g) > 3.0) return []; if (r === 'hub') return ['canyon', 'launch']; return ['hub']; };
  let traveling = false;
  async function travel(dest) {
    if (traveling) return; if (!gateOpen(dest)) { hud.toast('🔒 ' + t('gateLocked')); return; }
    traveling = true; hx('impact', 'medium'); hud.fade(true); await wait(FAST ? 0.15 : 0.4);
    const g = G[dest]; const q = cur(); const look = (q && targetRaw(q, dest)) || L.regions[dest]; const a = Math.atan2(look.x - g.x, look.z - g.z);
    api.teleport(g.x + Math.sin(a) * 3.2, g.z + Math.cos(a) * 3.2, a); ctrl.camYaw = a + Math.PI; cracks.forEach(c => { c.lastSide = 0; });
    await wait(0.12); hud.fade(false); traveling = false;
  }
  const wait = (s) => new Promise(r => setTimeout(r, s * 1000));

  // ---------- crack hops ----------
  function updateCracks(dt) {
    for (const c of cracks) c.fx.mesh.visible = Math.hypot(camera.position.x - c.x, camera.position.z - c.z) < c.len / 2 + 140; /* far fissures are invisible slivers: skip their 2 draws */
    for (const [i, c] of cracks.entries()) {
      const p = me(); const l = c.fx.local(p.x, p.z); if (Math.abs(l.v) > c.len / 2 + 8 || Math.abs(l.u) > 40) { c.lastSide = 0; continue; }
      if (c.fx.inGap(p.x, p.z) && ctrl.onGround) { // fell in: back to the safe side, with a hint (Chapter 1 is forgiving: no life lost)
        const side = c.lastSide || -1; const s = c.fx.safePoint(side, 1.8); D().stats.falls++; hud.fade(true); setTimeout(() => hud.fade(false), 260);
        api.teleport(s.x, s.z, Math.atan2(c.tx * -side, c.tz * -side)); hud.toast('🕳️ ' + t('crackFell')); if (sprint.state === 'run') sprint.fellBack(); continue; }
      if (!ctrl.onGround) { if (c.lastSide) c.air = true; continue; }
      const sd = Math.abs(l.u) > c.w * 0.42 && Math.abs(l.v) < c.len / 2 ? Math.sign(l.u) : 0; if (!sd) continue;
      if (c.lastSide && sd !== c.lastSide && c.air) { if (!D().ch1.crossed.includes(i)) { D().ch1.crossed.push(i); store.queueSave(); } hud.toast('🚀 ' + t('crossed')); burst.fire(p.x, p.y + 0.5, p.z); }
      c.lastSide = sd; c.air = false;
      if (!c.hinted && Math.abs(l.u) < 14 && !D().ch1.crossed.includes(i)) { c.hinted = true; hud.toast('⚠️ ' + t('crackHint')); }
    }
  }
  // ---------- meteor shower (periodic, canyon zone) ----------
  const met = { items: [], next: 1, inv: 0, warned: false, slant: { x: 0.35, z: -0.2 } };
  function updateMeteors(dt) {
    const p = me(); const near = dist2(p, MZ) < MZ.r + 60; meteors.show(near); met.inv = Math.max(0, met.inv - dt); if (!near) { met.items.length = 0; return; }
    const inZone = dist2(p, MZ) < MZ.r + 2; if (inZone && !met.warned) { met.warned = true; hud.toast('☄️ ' + t('meteorWarn')); }
    met.next -= dt; if (met.next <= 0 && met.items.filter(m => m.alive).length < meteors.N) { met.next = 0.9 + Math.random() * 0.6; // 1 meteor ~ every second, ~40% aimed at the cat when it is in the zone
      let x, z; if (inZone && Math.random() < 0.4) { x = p.x + (Math.random() - 0.5) * 1.5; z = p.z + (Math.random() - 0.5) * 1.5; } else { const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * MZ.r; x = MZ.x + Math.cos(a) * r; z = MZ.z + Math.sin(a) * r; }
      const slot = met.items.findIndex(m => !m.alive); const it = { x, z, y: groundAt(x, z), t: 0, fall: 0, alive: true }; if (slot >= 0) met.items[slot] = it; else met.items.push(it); }
    for (const m of met.items) { if (!m.alive) continue; if (m.t < 1) { m.t += dt / 1.6; continue; } m.fall += dt / 0.35; if (m.fall >= 1) { m.alive = false; burst.fire(m.x, m.y + 0.3, m.z); impact(m); } }
    meteors.draw(met.items, met.slant);
  }
  function impact(m) {
    const p = me(); const d = Math.hypot(p.x - m.x, p.z - m.z); if (d > 1.9 || p.y > m.y + 2.6 || met.inv > 0) return;
    if (solids.over(p.x, p.z, 0.3) < p.y + 6) return; // took cover under an overhang
    met.inv = 2.0; D().lives--; D().stats.hits++; const k = d > 0.05 ? 1 / d : 1; ctrl.vel.x += (p.x - m.x) * k * 6; ctrl.vel.z += (p.z - m.z) * k * 6; ctrl.vel.y = 4.5; ctrl.onGround = false;
    hud.lives(D().lives, true); hud.toast('☄️ ' + t('meteorHit'));
    if (D().lives <= 0) { D().lives = 9; setTimeout(() => { hud.lives(9, true); hud.toast('🐾 ' + t('livesRefill')); }, 900); }
    store.queueSave();
  }
  // ---------- 60 s hook: reactor flickers red until 3 energy crystals are mined, then the base lights ramp back up ----------
  function updatePower(dt) {
    hookT += dt;
    if (!powerAnim) return; powerAnim += dt; const k = Math.min(1, powerAnim / 2.4); // flicker-in, then full power
    setPower(k < 1 ? (k < 0.35 ? (Math.random() < 0.5 ? 0.15 : 0.7) : 0.5 + 0.5 * k) : 1, 0);
    if (k >= 1) { powerAnim = 0; setPower(1, 0); const q = cur(); const c = P.reactorConsole; burst.fire(c.x, c.y + 2, c.z); D().stats.hookPowerAt = +hookT.toFixed(1); if (q && q.kind === 'power') reward(q, { icon: '💡', title: t('powerOn'), note: t('powerOnSub') }); }
  }
  // ---------- mining ----------
  const nearestOre = () => { const S = mset(); const f = S ? S.f : ore; let b = -1, bd = 1e9; f.state.forEach((s, i) => { if (!s.alive) return; const d = dist2(me(), f.spots[i]); if (d < bd) { bd = d; b = i; } }); return { i: b, d: bd }; };
  let mineTarget = -1, firstMineAt = null;
  async function mineResult(res) {
    const S = mset(); const i = mineTarget; if (i < 0 || !res || !S) return; const f = S.f; const s = f.state[i]; const q = cur();
    if (res === 'miss') { hx('notify', 'error'); s.cracked = 1; s.shake = 1; miner.msg(t('mineMiss'), 'bad'); hud.toast('💥 ' + t('mineCracked')); return; }
    s.alive = false; S.list().push(i); const o = f.spots[i]; burst.fire(o.x, o.y + 1.2, o.z); mineTarget = -1;
    if (firstMineAt == null) firstMineAt = +hookT.toFixed(2);
    hx('impact', res === 'perfect' ? 'heavy' : 'medium'); const r = await grant(res === 'perfect' ? 10 : 5, 'mine:' + (S === MS.power ? 'power' : 'ore') + ':' + i + ':' + res); addXP(D(), res === 'perfect' ? 10 : 5); refreshTop();
    miner.msg(res === 'perfect' ? t('minePerfect') : t('mineOk'), res); hud.toast(`${res === 'perfect' ? '✨' : '💠'} ${res === 'perfect' ? t('minePerfect') : t('mineOk')} +${r.granted} ⭐`);
    miner.pips(S.list().length, 3); store.queueSave();
    if (q && q.kind === 'power') { const n = S.list().length; powerLevel = n / 3; if (n < q.need) { setPower(powerLevel * 0.5, 1); hud.toast(`⚡ ${t('powerStep')} ${n}/3`); } else { setTimeout(() => miner.hide(), 700); powerAnim = 0.001; } }
    if (q && q.kind === 'mine' && S.list().length >= q.need) { setTimeout(() => miner.hide(), 700); await reward(q); }
  }
  // ---------- action buttons (press-and-hold aware) ----------
  let holdLatch = false, holdDown = false, hold = 0, act1 = null, act2 = null;
  const actDown = () => { if (act1 && act1.startsWith('c2:')) { ch2.actDown(act1); if (!act1.startsWith('c2:robot')) hud.$('#mk-act').classList.add('hold'); return; } if (act1 === 'mine') { miner.press(); hud.$('#mk-act').classList.add('hold'); } else if (act1 === 'install') { holdDown = true; hud.$('#mk-act').classList.add('hold'); } else if (act1 === 'puzzle') puzzle.show(); else if (act1 === 'sprint') sprint.start(); else if (act1 && act1.startsWith('go:')) travel(act1.slice(3)); };
  const actUp = () => { hud.$('#mk-act').classList.remove('hold'); if (act1 && act1.startsWith('c2:')) { ch2.actUp(act1); return; } if (act1 === 'mine' && miner.holding) mineResult(miner.release()); holdDown = false; };
  const actEl = hud.$('#mk-act');
  actEl.addEventListener('pointerdown', (e) => { e.preventDefault(); actDown(); }); for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) actEl.addEventListener(ev, actUp);
  hud.$('#mk-act2').addEventListener('click', () => { if (act2 && act2.startsWith('go:')) travel(act2.slice(3)); });
  addEventListener('keydown', e => { if (e.repeat) return; if (e.code === 'KeyE') actDown(); if (e.code === 'KeyR' && act2) travel(act2.slice(3)); if (e.code === 'KeyQ' || e.code === 'KeyJ') openSheet(!sheetOpen); if (e.code === 'Escape') { openSheet(false); puzzle.hide(); } });
  addEventListener('keyup', e => { if (e.code === 'KeyE') actUp(); });
  // ---------- puzzle ----------
  async function onPuzzleSolved(moves) { const q = cur(); if (q && q.kind === 'puzzle') { hud.toast('⚡ ' + t('reactorOn')); await reward(q, { note: t('reactorOn') }); } }
  // ---------- sprint ----------
  const sprint = { state: 'idle', time: 0, n: 0, cd: 0, last: null, best: 0,
    start() { if (sprint.state === 'countdown' || sprint.state === 'run') return; sprint.state = 'countdown'; sprint.cd = FAST ? 0.9 : 3; sprint.n = 0; sprint.time = 0; rings.setNext(0); rings.mesh.visible = true; const r0 = rings.pts[0]; const s = L.sprintStart; api.teleport(s.x, s.z, Math.atan2(r0.x - s.x, r0.z - s.z)); },
    fellBack() { const b = sprint.n > 0 ? rings.pts[sprint.n - 1] : L.sprintStart; const nx = rings.pts[sprint.n]; api.teleport(b.x, b.z, Math.atan2(nx.x - b.x, nx.z - b.z)); },
    stars(tm) { const q = Qs.find(q => q.kind === 'sprint'); return tm <= q.times[0] ? 3 : tm <= q.times[1] ? 2 : 1; },
    async finish() { sprint.state = 'done'; ctrl.speedMul = BASE_SPEED; const tm = sprint.time; const st = sprint.stars(tm); const best = Math.max(D().ch1.sprint || 0, st); D().ch1.sprint = best; sprint.last = { time: tm, stars: st }; hud.big(''); store.queueSave();
      const q = cur(); const sStr = '★'.repeat(st) + '☆'.repeat(3 - st);
      if (q && q.kind === 'sprint') await reward(q, { bonus: q.starPts * st, title: `${t('sprintDone')} ${sStr}`, note: `${tm.toFixed(1)} s · ${t('sprintBest')}: ${'★'.repeat(best)}` });
      else hud.popup({ icon: '🏁', head: t('sprintDone'), title: `${sStr}  ${tm.toFixed(1)} s`, note: `${t('sprintBest')}: ${'★'.repeat(best)}` }, 3000);
      setTimeout(() => { if (sprint.state === 'done') { sprint.state = 'idle'; hud.sprint(false); } }, 3200); },
    fail() { sprint.state = 'idle'; ctrl.speedMul = BASE_SPEED; hud.big(''); hud.sprint(false); hud.toast('⏱️ ' + t('sprintFail')); rings.setNext(0); },
    update(dt) { const q = Qs.find(q => q.kind === 'sprint');
      rings.mesh.visible = sprint.state !== 'idle' || (regionOf(me()) === 'launch' && (cur() === q || isDone('launch')));
      if (sprint.state === 'countdown') { sprint.cd -= dt; hud.big(sprint.cd > 0 ? String(Math.ceil(sprint.cd / (FAST ? 0.3 : 1))) : t('sprintGo')); if (sprint.cd <= 0) { sprint.state = 'run'; ctrl.speedMul = BASE_SPEED * 1.5; hud.toast('⚡ ' + t('boost')); setTimeout(() => { if (sprint.state === 'run') hud.big(''); }, 600); } }
      else if (sprint.state === 'run') { sprint.time += dt; const r = rings.pts[sprint.n]; const p = me(); rings.pulse(time, sprint.n);
        if (Math.hypot(p.x - r.x, p.z - r.z) < 2.7 && p.y < r.y + 6) { burst.fire(r.x, r.y + 2.6, r.z); sprint.n++; rings.setNext(sprint.n); if (sprint.n >= rings.pts.length) { sprint.finish(); return; } }
        if (sprint.time > q.times[1] * 2 || Math.hypot(p.x - r.x, p.z - r.z) > 140) sprint.fail(); }
      if (sprint.state === 'run' || sprint.state === 'countdown' || sprint.state === 'done') { const tm = sprint.state === 'done' && sprint.last ? sprint.last.time : sprint.time; const st = sprint.stars(tm); hud.sprint(true, tm, `${t('sprintRing')} ${Math.min(sprint.n, rings.pts.length)}/${rings.pts.length}`, '★'.repeat(st) + '☆'.repeat(3 - st)); } } };
  // ---------- secrets ----------
  async function openCache(c) {
    if (D().secrets.includes(c.id)) return; D().secrets.push(c.id); D().stats.secrets++; c.fx.mesh.visible = false; burst.fire(c.x, c.y + 0.8, c.z);
    hx('notify', 'success'); const r = await grant(15, 'secret:' + c.id); addXP(D(), 15); refreshTop(); store.queueSave();
    const q = cur(); const n = D().secrets.length;
    if (q && q.kind === 'secret' && q.cache === c.id) await reward(q, { note: `🗝️ ${t('secrets')} ${n}/${caches.length} · ${t('secretsHint')}` });
    else hud.popup({ icon: '🗝️', head: t('secretFound'), title: `${t('secrets')} ${n}/${caches.length}`, pts: r.granted, xp: 15, note: r.capped ? `${t('capPart')}: ${r.earned}/${r.cap}` : '' }, 2600);
    if (sheetOpen) renderSheet();
  }
  // ---------- robot + build ----------
  const robotState = { mode: 'hidden', frac: 0, pos: new THREE.Vector3() };
  function placeRobot(p, look, snap) { robotState.pos.set(p.x, robotY(p.x, p.z, Math.atan2(look.x - p.x, look.z - p.z)), p.z); robot.root.position.copy(robotState.pos); robot.root.rotation.y = Math.atan2(look.x - p.x, look.z - p.z); robot.root.visible = true; }
  function startBuild() { if (robotState.mode !== 'hidden') return; robotState.mode = 'walk'; robotState.frac = 0; placeRobot(L.robotSpawn, weldSpot); hud.toast('🤖 ' + t('robotArrives')); burst.fire(L.robotSpawn.x, groundAt(L.robotSpawn.x, L.robotSpawn.z) + 1, L.robotSpawn.z); }
  async function updateRobot(dt) {
    if (ch2.on) { robot.root.visible = false; if (!robotState.c2hid) { robotState.c2hid = true; jobLabel.hide(); } return; }
    const S = robotState; const q = cur(); const hubNear = Math.hypot(camera.position.x - depotP.x, camera.position.z - depotP.z) < 220;
    if (S.mode === 'hidden') { robot.root.visible = false; robot.update(dt, 'idle'); return; }
    robot.root.visible = hubNear;
    if (S.mode === 'walk') { const dx = weldSpot.x - S.pos.x, dz = weldSpot.z - S.pos.z, d = Math.hypot(dx, dz); const sp = (FAST ? 4 : 1.6) * dt; if (d <= sp) { S.mode = 'weld'; placeRobot(weldSpot, depotP); } else { S.pos.x += dx / d * sp; S.pos.z += dz / d * sp; S.pos.y = robotY(S.pos.x, S.pos.z, Math.atan2(dx, dz)); robot.root.position.copy(S.pos); robot.root.rotation.y = Math.atan2(dx, dz); } robot.update(dt, 'walk'); depot.set(0, true); hud.build(false); { const bq = Qs.find(q => q.kind === 'build'); jobLabel.set(new THREE.Vector3(depotP.x, depotP.y + 4.5, depotP.z), 0, bq.buildTime, STAGE_T.foundation); } }
    else if (S.mode === 'weld') { const bq = Qs.find(q => q.kind === 'build');
      if (!S.job) S.job = makeRobotJob({ duration: bq.buildTime, stages: DEPOT_STAGES.map((s, i) => ({ ...s, title: STAGE_T[s.id], spot: stageSpots[i] })), label: jobLabel, anchor: depotP, labelHeight: 4.5, onStage: (s) => { S.target = s.spot; } });
      S.job.update(dt); S.frac = S.job.frac; depot.setValue(S.job.value, true); hud.build(false);
      const tg = S.target || weldSpot, dx = tg.x - S.pos.x, dz = tg.z - S.pos.z, d = Math.hypot(dx, dz);
      if (d > 0.06) { const st = Math.min(d, (FAST ? 4 : 1.3) * dt); S.pos.x += dx / d * st; S.pos.z += dz / d * st; S.pos.y = robotY(S.pos.x, S.pos.z, Math.atan2(dx, dz)); robot.root.position.copy(S.pos); robot.root.rotation.y = Math.atan2(dx, dz); robot.update(dt, 'walk'); }
      else { const ry = Math.atan2(depotP.x - S.pos.x, depotP.z - S.pos.z); let dr = ry - robot.root.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); robot.root.rotation.y += dr * Math.min(1, dt * 5); robot.update(dt, 'weld'); }
      if (S.job.done) { S.job = null; S.labelT = 2.5; S.mode = 'done'; depot.set(1, false); hud.build(false); if (!D().base.built.includes('depot')) D().base.built.push('depot'); if (!ctrl.colliders.includes(depotCollider)) ctrl.colliders.push(depotCollider); const dp = depot.topWorld(); burst.fire(dp.x, dp.y, dp.z); if (q && q.kind === 'build') await reward(q, { note: `🏗️ ${t('built')} · ${t('baseGrows')}` }); placeRobot({ x: S.pos.x, z: S.pos.z }, { x: camera.position.x, z: camera.position.z }); } }
    else { robot.update(dt, 'idle'); if (S.labelT > 0) { S.labelT -= dt; if (S.labelT <= 0) jobLabel.hide(); } }
  }

  // ---------- quests sheet ----------
  function renderSheet() {
    const sh = hud.$('#mk-sheet'); sh.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    const sub = sh.querySelector('.sub'), list = sh.querySelector('.list'); const ci = D().ch1.idx;
    if (ch2.on && !cur()) { if (tab === 'crew') ch2.renderCrew(sub, list); else if (tab === 'daily') ch2.renderDaily(sub, list); else { ch2.renderChapter(sub, list); list.insertAdjacentHTML('beforeend', `<details class="mk-ch1done"><summary>✅ ${esc(t('chapterTitle'))} · ${D().ch1.done.length}/${Qs.length}</summary>${ch1HTML()}</details>`); } return; }
    if (tab === 'crew') tab = 'ch';
    if (tab === 'ch') {
      sub.innerHTML = `<span>${esc(t('chapterTitle'))}</span><span>${D().ch1.done.length}/${Qs.length}</span>`;
      list.innerHTML = ch1HTML();
    } else { sub.innerHTML = `<span>${esc(t('daily'))}</span><span></span>`; list.innerHTML = `<div class="mk-soon"><b>🗓️</b>${esc(t('dailySoon'))}<br>${esc(t('dailySoon2'))}</div>`; }
  }
  function ch1HTML() { const ci = D().ch1.idx;
      const sec = `<div class="mk-sec" id="mk-secrets"><span>🗝️ ${esc(t('secrets'))} ${D().secrets.length}/${caches.length}<small>${esc(t('secretsHint'))}</small></span><span>🐾 ${D().lives}</span></div>`;
      return sec + Qs.map((q, i) => { const s = isDone(q.id) ? 'done' : i === ci ? 'active' : 'locked'; return `<div class="mk-q ${s}"><div class="ic">${s === 'done' ? '✅' : s === 'locked' ? '🔒' : q.icon}</div><div class="tx"><div class="tt">${esc(t('q_' + q.id + '_t'))}</div><div class="dd">${esc(t('q_' + q.id + '_d'))}</div><div class="st">${esc(t(s === 'done' ? 'done' : s === 'active' ? 'active' : 'locked'))}${q.kind === 'sprint' && D().ch1.sprint ? ' · ' + '★'.repeat(D().ch1.sprint) : ''}</div></div><div class="rw">+${q.pts} ⭐<small>+${q.xp} XP</small></div></div>`; }).join('');
  }
  const openSheet = (o) => { if (o !== sheetOpen) hx('select'); sheetOpen = o; hud.sheet(o, renderSheet); };
  // Telegram BackButton closes the top-most overlay first; with nothing open it leaves the 3D world
  window.MKTYTG?.setBackInterceptor?.(() => { const pop = hud.$('#mk-pop'); if (holo && holo.open) { holo.close(); return true; } /* TG BackButton closes the holo map first */ if (puzzle.open) { puzzle.hide(); return true; } if (sheetOpen) { openSheet(false); return true; } if (pop && pop.classList.contains('on')) { pop.classList.remove('on'); return true; } if (miner.open) { miner.hide(); return true; } return false; });
  backend.onPoints = (p) => { D().points = p; refreshTop(); };
  hud.$('#mk-qbtn').addEventListener('click', () => openSheet(!sheetOpen));
  hud.$('#mk-track').addEventListener('click', () => openSheet(true));
  hud.$('#mk-scrim').addEventListener('click', () => openSheet(false));
  hud.$('#mk-sheet .x').addEventListener('click', () => openSheet(false));
  hud.$('#mk-sheet .tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { tab = b.dataset.tab; renderSheet(); } });
  // ---------- Chapter 2 (starts when Chapter 1 is complete) ----------
  const ch2 = createChapter2({ backend: tgInit ? backend : null, scene, env, camera, ctrl, store, hud, t, lang, FAST, depotP, groundAt, robotY, gates: G, layout: L, places: P, burst, miner, grant, addXP, refreshTop, regionOf, me, now: nowMs,
    setNight, setEarthDir, sd, mobile, catRoot, earthDir, renderer, fade: (o) => hud.fade(o), time: () => time, free: (p, r) => { const f = solids.nearestFree(p.x, p.z, r); return { x: f.x, z: f.z }; }, low: Q.get('q') === 'low', openSheet: (o) => openSheet(o), isSheetOpen: () => sheetOpen, setTab: (x) => { tab = x; }, rerender: () => { if (sheetOpen) renderSheet(); } });
  let c2wait = 0;

  // ---------- targets ----------
  const v = new THREE.Vector3();
  const inZone = (q) => q.target && dist2(me(), q.target) < q.r;
  const nearestPart = () => { let b = -1, bd = 1e9; parts.alive.forEach((a, i) => { if (!a) return; const d = dist2(me(), parts.spots[i]); if (d < bd) { bd = d; b = i; } }); return { i: b, d: bd }; };
  function targetRaw(q, region) { // the activity's own target (ignoring travel routing)
    if (!q) return null;
    switch (q.kind) {
      case 'hop': { if (!D().ch1.crossed.includes(q.crack)) { const c = cracks[q.crack]; const s = c.fx.safePoint(1, 3); return { x: s.x, z: s.z, y: groundAt(s.x, s.z) }; } return q.target; }
      case 'mine': case 'power': { const n = nearestOre(); return n.i >= 0 ? mset().f.spots[n.i] : (q.kind === 'power' ? P.reactorConsole : P.canyonPad); }
      case 'parts': { const n = nearestPart(); return n.i >= 0 ? parts.spots[n.i] : null; }
      case 'sprint': return sprint.state === 'run' ? { ...rings.pts[sprint.n] } : { ...L.sprintStart, y: groundAt(L.sprintStart.x, L.sprintStart.z) };
      case 'secret': { const c = caches.find(c => c.id === q.cache); return c; }
      default: return q.target;
    }
  }
  function targetOf(q) { // routed: if the activity is in another region, point at this region's travel gate first
    if (!q) return null; const here = regionOf(me()); if (q.region && q.region !== here && G[here]) return G[here];
    return targetRaw(q);
  }
  function trackHTML(q, dist) {
    if (!q && ch2.on) return ch2.trackHTML(dist);
    if (!q) return `<div class="ch"><span>${esc(t('chapter'))} · ${esc(t('chapterTitle'))}</span><span>${Qs.length}/${Qs.length}</span></div><div class="t">🏆 ${esc(t('chapterDone'))}</div><div class="d">${esc(t('chapterDoneSub'))}</div><div class="row"><span style="color:#ffd77a">🗝️ ${esc(t('secrets'))} ${D().secrets.length}/${caches.length}</span></div>`;
    let prog = '', hint = '';
    const bar = (a, b) => `<div class="row"><div class="bar"><i style="width:${Math.min(100, a / b * 100)}%"></i></div><span>${a}/${b}</span></div>`;
    const routed = q.region && q.region !== regionOf(me());
    if (routed) hint = `🌀 ${esc(t(q.region === 'canyon' ? 'toCanyon' : q.region === 'launch' ? 'toLaunch' : 'toBase'))}`;
    else if (q.kind === 'hop') hint = D().ch1.crossed.includes(q.crack) ? '' : '🔥 ' + esc(t('crackHint'));
    else if (q.kind === 'mine') prog = bar(D().ch1.mined.length, q.need);
    else if (q.kind === 'power') { prog = bar(D().ch1.powered.length, q.need); hint = '⛏️ ' + esc(t('mineHint')); }
    else if (q.kind === 'parts') { prog = bar(D().ch1.parts.length, q.need); const n = nearestPart(); hint = n.d < 25 ? '📡 ' + esc(t('partsHot')) : '🧭 ' + esc(t('partsCold')); }
    else if (q.kind === 'secret') hint = '🔥 ' + esc(t('useJet'));
    return `<div class="ch"><span>${esc(t('chapter'))} · ${esc(t('chapterTitle'))}</span><span>${D().ch1.idx + 1}/${Qs.length}</span></div><div class="t">${q.icon} ${esc(t('q_' + q.id + '_t'))}</div>${q.kind === 'power' ? '' : `<div class="d">${esc(t('q_' + q.id + '_d'))}</div>`}${prog}<div class="row" style="margin-top:5px"><span style="color:rgba(247,242,231,.6)">+${q.pts} ⭐ · +${q.xp} XP</span><span class="dist">${dist != null ? Math.round(dist) + ' ' + t('m') : ''}</span></div>${hint ? `<div class="hint">${hint}</div>` : ''}`;
  }


  // ---------- holographic world map (HUD map button / M key) ----------
  const MAP_R = { hub: 90, canyon: 90, launch: 90 };
  const mapRegion = () => { const k = regionOf(me()); const c = k === 'hub' && sd ? sd(-1, 12) : L.regions[k]; return { key: k, x: c.x, z: c.z, R: MAP_R[k] || 120, name: t('map_r_' + k) }; };
  let holo = null, fogA = null, fogK = null, fogT = 0, goT = 0;
  const fogFor = (rg) => { if (fogK !== rg.key) { fogK = rg.key; fogA = fogGet(store, rg.key); } return fogA; };
  function mapData() {
    const rg = mapRegion(); const inR = (p) => p && Math.hypot(p.x - rg.x, p.z - rg.z) < rg.R * 0.92; const pins = [];
    const pin = (p, icon, key, kind) => { if (inR(p)) pins.push({ x: p.x, z: p.z, icon, label: key ? t(key) : '', kind: kind || 'place' }); };
    const base = sd ? sd(-1, 5) : L.regions.hub; if (rg.key === 'hub') pin(base, '🏠', 'map_base');
    const al = spots.filter((s, i) => crystals.alive[i] && inR(s)); if (al.length) { const c = al.reduce((a, s) => ({ x: a.x + s.x / al.length, z: a.z + s.z / al.length }), { x: 0, z: 0 }); pin(c, '💎', 'map_crystals'); }
    pin(P.reactorConsole, '⚡', 'map_reactor'); pin(P.dish, '📡', 'map_antenna'); pin(P.ledge, '⛰️', 'map_ledge'); pin(P.launchPad, '🚀', 'map_launch'); pin(P.canyonPad, '🛬', 'map_canyon'); if (G[rg.key]) pin(G[rg.key], '🌀', 'map_cave');
    for (const c of caches) if (!D().secrets.includes(c.id)) pin(c, '❔', '', 'hint');
    const q = cur(); const tg = q ? targetOf(q) : ch2.target(); const cq = !q && ch2.on && ch2.cur ? ch2.cur() : null;
    const quest = q ? { title: `${q.icon} ${t('q_' + q.id + '_t')}`, sub: t('q_' + q.id + '_d') } : cq ? { title: `${cq.icon || '⭐'} ${t('q_' + cq.id + '_t')}`, sub: t('q_' + cq.id + '_d') } : null;
    const crew = ch2.on && ch2.mapCrew ? ch2.mapCrew().filter(inR) : [];
    const ore_ = ore.state ? L.ore.filter((p, i) => ore.state[i] && ore.state[i].alive && inR(p)) : [];
    return { region: rg, groundAt: terrainAt, me: { x: me().x, z: me().z, yaw: ctrl.yaw }, target: tg && inR(tg) ? tg : null, quest, pins, crystals: [...al, ...ore_], crew, base: rg.key === 'hub' ? base : null, fog: fogFor(rg) };
  }
  function ensureMap() { if (holo) return holo; holo = makeHoloMap({ renderer, t, world: scene, onGo: () => { goT = 6; } }); holo.getData = mapData; return holo; }
  hud.onMap = () => { if (!ready) return; ensureMap().toggle(); };
  addEventListener('keydown', e => { if (e.code === 'KeyM' && ready && !(holo && holo.open)) ensureMap().show(); });
  function updateFog(dt) { fogT -= dt; if (fogT > 0) return; fogT = 0.5; const rg = mapRegion(); const a = fogFor(rg); if (fogReveal(a, rg, me().x, me().z, 30)) { fogSet(store, rg.key, a); store.queueSave(); } }

  // ---------- world life (chapter 2, FEAT.life, ?life=0 disables) ----------
  let life = null; const LIFE_ON = FEAT.life && Q.get('life') !== '0';
  function updateLife(dt) {
    if (!LIFE_ON) return; const show = ch2.on && regionOf(me()) === 'hub' && !ch2.inside && !(ch2.api && ch2.api.storm().on); // storm cutscene: world life off (night, budget)
    if (!life && show) { const base = sd ? sd(-1, 5) : L.regions.hub; const ra = Math.atan2(400 - base.z, 440 - base.x); const crater = { x: base.x + Math.cos(ra) * 170, z: base.z + Math.sin(ra) * 170 };
      life = makeWorldLife({ scene, camera, env, groundAt: terrainAt, depotP, fields: spots.filter(s => Math.hypot(s.x - base.x, s.z - base.z) < 140), base, launch: L.regions.launch, crater, t, hud, low: Q.get('q') === 'low', mobile, ctrl, makeCrew: makeCrewRobot }); ch2.api.extraImp = (imp) => life && life.pushImp(imp); }
    if (!life) return; life.setVisible(show); if (show) life.update(dt, time, me(), ch2.mapCrew ? ch2.mapCrew() : []);
  }
  // ---------- frame ----------
  function update(dt) {
    if (!ready) return; time += dt; updateFog(dt); if (goT > 0) goT -= dt; updateLife(dt);
    if (ctrl.thrusting) lastThrust = time;
    crystals.update(time); burst.update(dt); ore.update(time, dt); pow.update(time, dt); updatePower(dt); for (const k in G) G[k].fx.update(time); for (const c of caches) if (c.fx.mesh.visible) c.fx.update(time);
    for (let i = 0; i < spots.length; i++) { if (!crystals.alive[i]) continue; const s = spots[i]; if (Math.hypot(s.x - ctrl.pos.x, s.z - ctrl.pos.z) < 1.7 && Math.abs(ctrl.pos.y - s.y) < 3.5) pickCrystal(i); }
    updateCracks(dt); updateMeteors(dt); sprint.update(dt); updateRobot(dt); miner.update(dt); syncCols();
    for (const c of caches) { if (!c.fx.mesh.visible) continue; if (dist2(me(), c) < 1.7 && Math.abs(me().y - c.y) < 2.2) openCache(c); }
    const q = cur(); if (!q) { if (!ch2.on) { c2wait += dt; if (c2wait > (FAST ? 0.3 : 5)) ch2.begin(true); } ch2.update(dt); } const tg = q ? targetOf(q) : ch2.target(); const p = me();
    // parts: hidden hunt (compass + glow when close, beacon only within 22 m)
    let showBeacon = !!tg; const nP = q && q.kind === 'parts' ? nearestPart() : null;
    if (nP) { parts.update(time, nP.d < 25 ? 1 : 0); if (!(q.region !== regionOf(p))) showBeacon = nP.d < 22; for (let i = 0; i < parts.spots.length; i++) { if (!parts.alive[i]) continue; const s = parts.spots[i]; if (dist2(p, s) < 1.9 && Math.abs(p.y - s.y) < 2.5) { parts.alive[i] = false; D().ch1.parts.push(i); burst.fire(s.x, s.y + 0.6, s.z); grant(5, 'part:' + i); hx('impact', 'medium'); hud.toast(`📡 ${t('partFound')} ${D().ch1.parts.length}/3`); store.queueSave(); if (D().ch1.parts.length >= q.need) reward(q); } } }
    if (nP && nP.i >= 0 && q.region === regionOf(p)) { const s = parts.spots[nP.i]; const cf = new THREE.Vector3(); camera.getWorldDirection(cf); const rot = Math.atan2(s.x - p.x, s.z - p.z) - Math.atan2(cf.x, cf.z); hud.compass(true, -rot, `📡 ${Math.round(nP.d)} ${t('m')}`, `${t('parts')} ${D().ch1.parts.length}/3`, nP.d < 25); } else if (goT > 0 && tg) { const cf = new THREE.Vector3(); camera.getWorldDirection(cf); const rot = Math.atan2(tg.x - p.x, tg.z - p.z) - Math.atan2(cf.x, cf.z); hud.compass(true, -rot, `🎯 ${Math.round(Math.hypot(tg.x - p.x, tg.z - p.z))} ${t('m')}`, t('mapQuest'), true); } else hud.compass(false);
    beacon.set(showBeacon && tg ? { x: tg.x, y: gy(tg), z: tg.z } : null, q && (q.kind === 'mine' || q.kind === 'parts' || q.kind === 'power') ? '#7fd8ff' : (tg && tg.fx ? '#a98bff' : '#67d7f0')); beacon.update(time, camera.position);
    const dist = tg ? dist2(tg, p) : null;
    // ---- activity logic / context buttons ----
    act1 = null; let label1 = null, frac1 = 0;
    const opts = ch2.inside ? [] : travelOptions(); act2 = opts[0] ? 'go:' + opts[0] : null; hud.action2(act2 ? (gateOpen(opts[0]) ? '🌀 ' : '🔒 ') + t(opts[0] === 'canyon' ? 'toCanyon' : opts[0] === 'launch' ? 'toLaunch' : 'toBase') : null);
    if (opts[1]) { act1 = 'go:' + opts[1]; label1 = (gateOpen(opts[1]) ? '🌀 ' : '🔒 ') + t(opts[1] === 'launch' ? 'toLaunch' : 'toCanyon'); }
    if (q && !busy && !traveling) {
      if (q.kind === 'hop') { if (inZone(q)) { if (D().ch1.crossed.includes(q.crack)) reward(q); else if (!q._warned) { q._warned = true; hud.toast('🕳️ ' + t('crossFirst')); } } else q._warned = false; }
      else if (q.kind === 'mine' || q.kind === 'power') { const n = nearestOre(); if (n.i >= 0 && n.d < 2.8) { if (mineTarget !== n.i) { mineTarget = n.i; } miner.easy(q.kind === 'power'); miner.show(mset().list().length, q.need); act1 = 'mine'; label1 = miner.holding ? '⛏️ …' : '⛏️ ' + t('mine'); } else if (miner.open) miner.hide(); }
      else if (q.kind === 'install') { if (inZone(q)) { act1 = 'install'; if (holdDown || holdLatch) hold += dt; if (hold >= q.hold) { hold = 0; holdLatch = false; holdDown = false; hud.toast('📡 ' + t('installed')); reward(q, { note: t('installed') }); } label1 = '🔧 ' + t('install'); frac1 = Math.min(1, hold / q.hold); } else { hold = 0; holdLatch = false; } }
      else if (q.kind === 'puzzle') { if (inZone(q)) { act1 = 'puzzle'; label1 = '⚡ ' + t('openConsole'); } else if (puzzle.open && dist2(p, q.target) > q.r + 4) puzzle.hide(); }
      else if (q.kind === 'secret') { if (D().secrets.includes(q.cache)) reward(q); }
      else if (q.kind === 'build') { if (inZone(q) && robotState.mode === 'hidden') startBuild(); }
    }
    if (!q && !traveling && ch2.on) { const a = ch2.action(dt); if (a && (!act1 || a.act === 'c2:help')) { act1 = a.act; label1 = a.label; frac1 = a.frac || 0; if (holdLatchC2 && (act1 === 'c2:collect' || act1 === 'c2:repair')) ch2.actDown(act1); } }
    if (!act1 && sprint.state === 'idle' && L.sprintStart && dist2(p, L.sprintStart) < 4.5 && (isDone('reactor'))) { act1 = 'sprint'; label1 = '🏁 ' + t(isDone('launch') ? 'retrySprint' : 'startSprint'); }
    if (q && q.kind !== 'mine' && q.kind !== 'power' && miner.open && !powerAnim) miner.hide();
    hud.action(label1, frac1);
    hud.setTrack(trackHTML(q, dist));
    // marker: chip over the beacon when on screen, edge arrow otherwise
    if (showBeacon && tg && dist > 2.5) {
      v.set(tg.x, gy(tg) + 3.2, tg.z).project(camera); const W = innerWidth, Hh = innerHeight; const behind = v.z > 1;
      let x = (v.x * 0.5 + 0.5) * W, y = (-v.y * 0.5 + 0.5) * Hh; const tgI = tgInsets(), mT = 150 + tgI.t, mB = 230 + tgI.b, mX = 34 /* TG glue: edge arrow keeps clear of the inset-shifted quest panel / bottom controls */; const label = Math.round(dist) + ' ' + t('m');
      if (!behind && x > mX && x < W - mX && y > mT && y < Hh - mB) hud.marker('chip', x, y, 0, label);
      else { let dx = x - W / 2, dy = y - Hh / 2; if (behind) { dx = -dx; dy = -dy; } if (Math.abs(dx) < 1e-3 && Math.abs(dy) < 1e-3) dy = 1; const cx = W / 2, cy = (mT + Hh - mB) / 2; const hx = W / 2 - mX, hy = (Hh - mB - mT) / 2; const k = Math.min(hx / Math.abs(dx || 1e-6), hy / Math.abs(dy || 1e-6)); let ax = cx + dx * k, ay = cy + dy * k; if (tgI.qp && ax < tgI.qp.r + 23 && ay < tgI.qp.b + 30) ay = tgI.qp.b + 30; /* TG glue: never cover the quest panel */ hud.marker('arrow', ax, ay, Math.atan2(dx, -dy), label); }
    } else hud.marker(null);
  }

  const boot = (async () => {
    if (Q.get('reset') === '1') { await store.wipe(); try { history.replaceState(null, '', location.pathname + location.search.replace(/([?&])reset=1&?/, '$1').replace(/[?&]$/, '')); } catch (e) { } }
    await store.load(); syncIdx(); syncCrystals(); syncProps(); refreshTop(); if (!cur() && !D().ch2.on) ch2.begin(false); ch2.boot(); await store.save(); ready = true;
    if (!isDone('power')) setTimeout(() => hud.toast('⚠️ ' + t('powerOut')), 600);
    if (FAST) { const b = hud.$('#mk-auto'); b.style.display = 'block'; b.addEventListener('click', () => api.auto()); }
  })();

  // ?fast=1 auto-play of the current Chapter 2 quest (real actions through the same code paths; waits are skipped with the job clock)
  async function autoCh2() {
    const A = ch2.api, E = A.econ, S2 = () => D().ch2; const q = ch2.cur(); if (!q) return false; const id = q.id; const done = () => S2().done.includes(id);
    const robotOf = (ty) => S2().robots.find(r => r.type === ty); const finishJob = async (j) => { if (!j) return; api.advance(Math.max(0, (j.end - nowMs()) / 1000) + 0.05); await frames(4); };
    const topUp = (c) => { if (!c) return; S2().res.ore = Math.max(S2().res.ore, c.ore); S2().res.cry = Math.max(S2().res.cry, c.cry); };
    if (regionOf(me()) !== 'hub') { await travel('hub'); await frames(3); }
    if (q.kind === 'collect' || q.kind === 'deliver') { if (q.kind === 'deliver') { let e = S2().jobs.find(j => j.kind === 'expedition'); if (!e && !S2().expeditions) { await A.start(robotOf('geologist').id, 'expedition', 'e30'); e = S2().jobs.find(j => j.kind === 'expedition'); } await finishJob(e); }
      api.teleport(depotP.x + Math.sin(depotP.yaw) * 3.0, depotP.z + Math.cos(depotP.yaw) * 3.0); await frames(3); holdLatchC2 = true; let f = 0; while (!done() && f++ < 120) { await frames(2); } holdLatchC2 = false; if (!done()) await A.collect(); }
    else if (q.kind === 'send') { await A.start(robotOf('geologist').id, 'expedition', 'e30'); }
    else if (q.kind === 'level') { let up = S2().jobs.find(j => j.kind === 'upgrade'); if (!up) { topUp(BASE_COST(S2().level + 1)); await A.start(robotOf('builder').id, 'upgrade'); up = S2().jobs.find(j => j.kind === 'upgrade'); } await finishJob(up); }
    else if (q.kind === 'help') { if (!S2().jobs.some(j => j.kind === 'expedition')) await A.start(robotOf('geologist').id, 'expedition', 'e30'); await frames(3); A.tick(); let j = null; for (let k = 0; k < 40 && !(j = S2().jobs.find(j => j.help === 'asked')); k++) await frames(1); if (j) { const c = A.crew().find(c => c.id === j.rid); for (let k = 0; k < 60 && A.crew().find(c => c.id === j.rid).state !== 'site'; k++) await frames(1); const site = A.crew().find(c => c.id === j.rid); if (regionOf(site) !== regionOf(me())) { await travel(regionOf(site)); await frames(3); } api.teleport(site.x + 1.6, site.z); await frames(4); if (!done()) await A.helpResult('perfect'); } }
    else if (q.kind === 'daily') { await A.claimLogin(); if (!S2().daily.tasks.some(x => x.done)) { const tk = S2().daily.tasks[0]; tk.prog = tk.need; tk.done = true; } await A.claimTask(S2().daily.tasks.findIndex(x => x.done && !x.claimed)); }
    else if (q.kind === 'streak') { for (let k = 0; k < 7 && Math.max(S2().streak.count, S2().streak.best) < 7; k++) { api.shiftDay(1); await frames(1); } if (S2().robots.length < 3) await A.recruit('archaeologist'); A.tick(); }
    else if (q.kind === 'home') { const h = A.home(); if (!h.inside) { api.teleport(h.outside.x, h.outside.z); await frames(3); await A.enterHome(); await frames(3); } const ci = A.home().consoleIn; ctrl.place(ci.x, ci.z, 0, false); await frames(3); ch2.actDown('c2:home:console'); await frames(3); openSheet(false); await A.exitHome(); await frames(3); }
    else if (q.kind === 'storm') { const cp = A.storm().console; api.teleport(cp.x + 1.8, cp.z); await frames(3); if (!A.storm().on) { A.startStorm(); if (A.stepStorm) A.stepStorm(12); } let f = 0; while (!done() && f++ < 3000) { const st = A.storm(); const sp = st.spots.find(s => s.hp > 0); if (sp) { api.teleport(sp.x + 1.4, sp.z); await frames(2); holdLatchC2 = true; } await frames(2); } holdLatchC2 = false; }
    else if (q.kind === 'museum') { if (!robotOf('archaeologist')) await A.recruit('archaeologist'); for (let k = 0; k < 6 && !S2().museum.length; k++) { const r = robotOf('archaeologist'); let j = S2().jobs.find(j => j.rid === r.id); if (!j) { await A.start(r.id, 'dig', 'd2'); j = S2().jobs.find(j => j.rid === r.id); } await finishJob(j); } }
    let fr = 0; while (!done() && fr++ < 200) { A.tick(); await frames(2); } return done();
  }
  let holdLatchC2 = false; const BASE_COST = (l) => BASE[l] ? BASE[l].cost : null;
  const frames = (n = 2) => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
  const api = {
    boot, get ready() { return ready; }, t, lang, fast: FAST,
    state: () => JSON.parse(JSON.stringify(D())), quest: () => { const q = cur(); return q && { id: q.id, kind: q.kind, idx: D().ch1.idx, prog: D().ch1.prog, need: q.need }; },
    target: () => { const g = targetOf(cur()); return g && { x: g.x, y: gy(g), z: g.z }; },
    targetRaw: () => { const g = targetRaw(cur()); return g && { x: g.x, y: gy(g), z: g.z }; },
    region: () => regionOf(me()),
    teleport(x, z, yaw = ctrl.yaw, raw = false) { ctrl.place(x, z, yaw, !raw); ctrl.vel.set(0, 0, 0); cracks.forEach(c => { c.lastSide = 0; c.air = false; }); },
    teleportToTarget(off = 0) { const g = targetOf(cur()); if (g) api.teleport(g.x + off, g.z); return g; },
    travel, interact() { const q = cur(); if (q && q.kind === 'install') holdLatch = true; else if (q && q.kind === 'puzzle') puzzle.show(); },
    openSheet, setTab(x) { tab = x; renderSheet(); },
    addPoints: (n, why) => store.addPoints(n, why).then(r => { refreshTop(); return r; }),
    shiftDay(n) { dayOffset += n; store.roll(); syncCrystals(); refreshTop(); if (ch2.on) { ch2.api.econ.rollDay(); ch2.api.tick(); } },
    ch2: ch2.api, advance(sec) { clock.off += sec * 1000; if (ch2.on) ch2.api.tick(); }, now: nowMs,
    crystals: () => ({ alive: crystals.alive.filter(Boolean).length, total: spots.length, spots: spots.map((s, i) => ({ ...s, alive: crystals.alive[i] })) }),
    fakeThrust() { lastThrust = time; }, popup: (o) => hud.popup(o, 60000), save: () => store.save(),
    // activity introspection for tests / screenshots
    buildTo: (f) => { const j = robotState.job; if (j) j.update(Math.max(0, f * j.duration - j.t)); return j ? j.frac : null; }, // QA hook: jump the running robot job (renders at 10/50/90%)
    layout: () => ({ power: pow.spots, gates: Object.fromEntries(Object.entries(G).map(([k, g]) => [k, { x: g.x, y: g.y, z: g.z }])), cracks: cracks.map(c => ({ x: c.x, z: c.z, tx: c.tx, tz: c.tz, w: c.w, len: c.len })), ore: ore.spots, parts: parts.spots, meteor: MZ, rings: rings.pts, sprintStart: L.sprintStart, secrets: caches.map(c => ({ id: c.id, x: c.x, y: c.y, z: c.z })), depot: depotP, weldSpot }),
    miner, puzzle, sprint: () => ({ state: sprint.state, n: sprint.n, time: sprint.time, last: sprint.last }), robotState: () => ({ mode: robotState.mode, frac: robotState.frac, visible: robot.root.visible }), robot: () => robot,
    power: () => ({ level: powerLevel, anim: powerAnim, hookT, firstMineAt: firstMineAt }), gameTime: () => time,
    meteors: () => ({ active: meteors.shadows.visible, items: met.items.filter(m => m.alive).length, inv: met.inv }), forceMeteor(x, z, t0 = 0.999) { const it = { x, z, y: groundAt(x, z), t: t0, fall: 0, alive: true }; let i = met.items.findIndex(m => !m.alive); if (i < 0 && met.items.length >= meteors.N) i = met.items.reduce((b, m, j) => (m.t < met.items[b].t ? j : b), 0); if (i >= 0) met.items[i] = it; else met.items.push(it); },
    crackSide: (i) => { const c = cracks[i]; return { ...c.fx.local(me().x, me().z), side: c.lastSide, air: c.air }; },
    // ?fast=1: every activity can be auto-completed (also the ⏩ AUTO button in the HUD)
    async auto() {
      if (!FAST) return false; const q = cur(); if (!q) return ch2.on ? autoCh2() : false; const id = q.id;
      const go = async (dest) => { if (regionOf(me()) !== dest) { await travel(dest === 'hub' ? 'hub' : dest); await frames(3); } };
      if (q.region && regionOf(me()) !== q.region) { if (regionOf(me()) !== 'hub') await travel('hub'); if (q.region !== 'hub') await travel(q.region); await frames(3); }
      if (q.kind === 'hop') { const c = cracks[q.crack]; if (!D().ch1.crossed.includes(q.crack)) { await api.hop(q.crack); } api.teleport(q.target.x, q.target.z); }
      else if (q.kind === 'mine' || q.kind === 'power') { const f = mset().f; for (let i = 0; i < f.spots.length && cur() === q; i++) { if (!f.state[i].alive) continue; const o = f.spots[i]; api.teleport(o.x + 1.6, o.z, Math.atan2(-1.6, 0)); await frames(3); miner.press(); await frames(2); await mineResult(miner.release(miner.zone().c)); await frames(2); } }
      else if (q.kind === 'parts') { for (let i = 0; i < parts.spots.length; i++) { if (!parts.alive[i]) continue; const s = parts.spots[i]; api.teleport(s.x, s.z, 0, true); await frames(3); } }
      else if (q.kind === 'install') { api.teleport(q.target.x, q.target.z); await frames(2); holdLatch = true; }
      else if (q.kind === 'puzzle') { api.teleport(q.target.x, q.target.z); await frames(2); puzzle.show(); await frames(1); for (const i of puzzle.solution()) { puzzle.rotate(i); await frames(1); } }
      else if (q.kind === 'sprint') { sprint.start(); while (sprint.state === 'countdown') await frames(1); for (let i = 0; i < rings.pts.length && sprint.state === 'run'; i++) { const r = rings.pts[sprint.n]; api.teleport(r.x, r.z, ctrl.yaw, true); await frames(2); } }
      else if (q.kind === 'secret') { const c = caches.find(c => c.id === q.cache); api.teleport(c.x, c.z, 0, true); ctrl.pos.y = c.y; await frames(2); }
      else if (q.kind === 'build') { api.teleport(q.target.x, q.target.z); }
      let fr = 0; while (!isDone(id) && fr++ < 500) await frames(2); return isDone(id);
    },
    // real physics hop over crack i (runs at it, jumps, holds JET) - used by tests and auto()
    async hop(i, withJet = true) { const c = cracks[i]; const s = c.fx.safePoint(-1, 3.0); const a = Math.atan2(c.tx, c.tz); api.teleport(s.x, s.z, a, true); await frames(3); c.lastSide = -1;
      ctrl.vel.set(c.tx * 9, 8.0, c.tz * 9); ctrl.onGround = false; ctrl.pos.y += 0.05; await frames(2); let fr = 0, gr = 0;
      while (gr < 3 && fr++ < 600) { if (ctrl.onGround) { gr++; await frames(1); continue; } gr = 0; ctrl.vel.x = c.tx * 9; ctrl.vel.z = c.tz * 9; const lu = c.fx.local(ctrl.pos.x, ctrl.pos.z).u; if (withJet && ctrl.vel.y < 1.5 && lu < c.w / 2 + 1.0) { ctrl.vel.y += 0.75; ctrl.thrusting = true; } await frames(1); }
      ctrl.vel.set(0, 0, 0); await frames(3); return D().ch1.crossed.includes(i); },
    cacheAt: (id) => caches.find(c => c.id === id),
    async mineTry(needle) { if (!miner.open || mineTarget < 0) return null; if (!miner.holding) miner.press(); const r = miner.release(needle); await mineResult(r); return r; },
  };
  api.map = () => ensureMap(); api.life = () => life; api.mapData = () => mapData();
  return { update, api, get map() { return holo; } };
}
