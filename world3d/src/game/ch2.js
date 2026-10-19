import { makeImpostors } from './impostors.js';
import * as THREE from 'three';
import { createEconomy, BASE, MAX_LEVEL, EXPEDITIONS, DIGS, ENG, MUSEUM, TYPES, MAX_PER_TYPE, DAILY_PTS, DAILY_ALL_ORE, ROBOT_XP } from './economy.js';
import { makeCrewRobot } from './robots.js';
import { makeBaseGrowth } from './basegrow.js';
import { makeProgressLabel, fmtTime } from './jobs.js';
import { esc } from './hud.js';
import { makeShield } from './shield.js';
import { makeHome } from './home.js';
// ============================================================================================
// Chapter 2 "The Base Grows": world + UI layer over economy.js.
//   - crew robots live in the world: idle at home spots in front of the storage module, walk to their work site,
//     work there with a world-space progress label (geologist drills in the canyon, archaeologist scans by the meteor
//     crater, engineer works at the reactor, builder builds the next base section, revealed stage by stage)
//   - jobs use absolute timestamps (economy) -> continue offline; ?fast=1 scales every duration by 1/60
//   - quest line c2_* teaches collect / expeditions / upgrades / helping robots / daily ritual / streak / museum
//   - sheet tabs: Chapter (ch2 quests), Crew (robot panel), Daily (login reward, streak, 3 tasks)
// ============================================================================================
// staged rollout switches (v40 base/storage/robots, v41 + home, v42 + storm finale)
export const FEAT = { home: true, storm: true, life: true };
const CH2_ALL = [
  { id: 'c2_collect', icon: '📦', kind: 'collect', pts: 15, xp: 20 },
  { id: 'c2_home', icon: '🏠', kind: 'home', pts: 15, xp: 20 },
  { id: 'c2_send', icon: '⛏️', kind: 'send', pts: 15, xp: 20 },
  { id: 'c2_upgrade', icon: '🏗️', kind: 'level', lvl: 2, pts: 25, xp: 30 },
  { id: 'c2_help', icon: '🆘', kind: 'help', pts: 20, xp: 25 },
  { id: 'c2_daily', icon: '🗓️', kind: 'daily', pts: 15, xp: 20 },
  { id: 'c2_deliver', icon: '💎', kind: 'deliver', pts: 25, xp: 30 },
  { id: 'c2_l3', icon: '📡', kind: 'level', lvl: 3, pts: 35, xp: 40 },
  { id: 'c2_storm', icon: '☄️', kind: 'storm', pts: 50, xp: 60 },
  { id: 'c2_streak', icon: '🔥', kind: 'streak', need: 7, pts: 40, xp: 50 },
  { id: 'c2_museum', icon: '🏺', kind: 'museum', pts: 40, xp: 50 },
];
export const CH2 = CH2_ALL.filter(q => FEAT[q.kind] !== false);
const ICON = { builder: '🏗️', geologist: '⛏️', archaeologist: '🔎', engineer: '🔧' };
const JICON = { upgrade: '🏗️', expedition: '⛏️', dig: '🏺', eng: '🔧' };
const CSS = `
.c2-card{padding:9px 10px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid rgba(247,242,231,.1);margin-bottom:7px}
.mk-ch1done{margin-top:10px}.mk-ch1done summary{cursor:pointer;opacity:.8;padding:8px 4px;font-weight:600}
.c2-card.ask{border-color:#ff9a5a;box-shadow:0 0 10px rgba(255,140,80,.35)}
.c2-card.hl{border-color:#67d7f0;box-shadow:0 0 10px rgba(103,215,240,.3)}
.c2-row{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12.5px;font-weight:800}
.c2-row small{font-weight:700;color:rgba(247,242,231,.65);font-size:10.5px}
.c2-bar{height:5px;border-radius:3px;background:rgba(255,255,255,.12);margin-top:5px;overflow:hidden}.c2-bar i{display:block;height:100%;background:linear-gradient(90deg,#67d7f0,#ffd77a)}
.c2-acts{display:flex;flex-direction:column;gap:5px;margin-top:7px}
.c2-btn{display:flex;justify-content:space-between;align-items:center;gap:6px;border:1px solid rgba(233,189,88,.55);background:rgba(16,32,58,.75);color:#f7f2e7;border-radius:11px;padding:7px 9px;font-size:11.5px;font-weight:800;text-align:left}
.c2-btn small{color:#ffd77a;font-weight:800;white-space:nowrap}.c2-btn:disabled{opacity:.45}
.c2-btn.go{background:linear-gradient(180deg,#f3d58a,#c9973a);color:#1a1406}.c2-btn.go small{color:#1a1406}
.c2-tag{font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:rgba(247,242,231,.6);margin:9px 2px 5px}
.c2-stub{opacity:.55;font-size:11px;padding:6px 9px;border:1px dashed rgba(247,242,231,.3);border-radius:11px;margin-top:5px}
#mk-crewbtn{display:none;border:1px solid rgba(103,215,240,.7);background:rgba(16,32,58,.8);color:#a8f0ff;font-weight:800;font-size:12px;border-radius:18px;padding:8px 10px;margin-left:4px;white-space:nowrap}
#mk-crewbtn.ask{border-color:#ff9a5a;color:#ffcf9a;box-shadow:0 0 10px rgba(255,140,80,.5)}
`;

export function createChapter2(ctx) {
  const { scene, env, camera, ctrl, store, hud, t, FAST, depotP, groundAt, robotY, gates, layout, places, burst, miner, grant, addXP, refreshTop, regionOf, me, now, free, low, openSheet, isSheetOpen, rerender } = ctx;
  const SCALE = FAST ? 1 / 60 : 1;
  const D = () => store.data, S = () => store.data.ch2;
  const pending = [];
  const econ = createEconomy({ data: { get ch2() { return store.data.ch2; } }, now, scale: SCALE, onEvent: (k, x) => pending.push([k, x]) });
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  // crew button next to "Quests" + a Crew tab in the sheet
  const qb = hud.$('#mk-qbtn'); const cb = document.createElement('button'); cb.id = 'mk-crewbtn'; cb.className = 'pe'; cb.textContent = '🤖 ' + t('crew'); qb.parentNode.insertBefore(cb, qb.nextSibling);
  for (const ev of ['pointerdown', 'touchstart', 'wheel']) cb.addEventListener(ev, e => e.stopPropagation(), { passive: true });
  cb.addEventListener('click', () => { ctx.setTab('crew'); openSheet(true); });
  const tabs = hud.$('#mk-sheet .tabs'); const tb = document.createElement('button'); tb.dataset.tab = 'crew'; tb.textContent = t('crew'); tb.style.display = 'none'; tabs.insertBefore(tb, tabs.lastChild);
  const name = (r) => t('rb_' + r.type);
  const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  // ---------- world anchors ----------
  const yaw = depotP.yaw || 0, cy = Math.cos(yaw), sy = Math.sin(yaw);
  const toW = (lx, lz) => ({ x: depotP.x + lx * cy + lz * sy, z: depotP.z - lx * sy + lz * cy });
  const base = makeBaseGrowth(scene, depotP, env, { groundAt, low, mobile: !!ctx.mobile });
  const HOMES = [[1.3, 2.7], [-1.3, 2.7], [0, 3.7], [2.3, 3.4], [-1.8, 4.3], [1.0, 4.9], [-0.6, 5.6], [2.6, 5.0]].map(([x, z]) => toW(x, z));
  const WORK = { 2: toW(5.6, 0.7), 3: toW(-2.0, -1.9), 4: toW(3.4, -3.0), 5: toW(6.0, -1.6) };
  const canyonSite = free({ x: layout.ore[0].x + 1.5, z: layout.ore[0].z }, 3); const meteorSite = free({ x: layout.meteor.x + layout.meteor.r * 0.75, z: layout.meteor.z }, 3);
  const engSite = free({ x: places.reactorConsole.x + 1.8, z: places.reactorConsole.z + 1.2 }, 3);
  const hubGate = gates.hub;
  const siteOf = (j) => j.kind === 'expedition' ? { ...canyonSite, region: 'canyon' } : j.kind === 'dig' ? { ...meteorSite, region: 'canyon' } : j.kind === 'eng' ? { ...engSite, region: 'hub' } : { ...WORK[j.what] || WORK[2], region: 'hub' };
  const storeLabel = makeProgressLabel(scene, { accent: '#ffd77a', size: 0.06 });
  // ---------- finale: night meteor storm + hex shield ----------
  const shieldC = ctx.sd ? ctx.sd(-1, 5) : { x: 0, z: 0 }; const consoleP = (() => { const a0 = Math.atan2(depotP.z - shieldC.z, depotP.x - shieldC.x); const gc = groundAt(shieldC.x, shieldC.z); let best = null;
    for (let k = -40; k <= 40; k++) for (const r of [54, 57, 60]) { const a = a0 + k * 0.04, x = shieldC.x + Math.cos(a) * r, z = shieldC.z + Math.sin(a) * r; let lo = 1e9, hi = -1e9; for (let ox = -2; ox <= 2; ox += 1) for (let oz = -2; oz <= 2; oz += 1) { const v = groundAt(x + ox, z + oz); lo = Math.min(lo, v); hi = Math.max(hi, v); }
      const f = free({ x, z }, 3); const moved = Math.hypot(f.x - x, f.z - z); const gy = groundAt(x, z) + 1.5; let occ = 0; const ca = Math.atan2(shieldC.z - z, shieldC.x - x); for (const da of [-0.5, -0.25, 0, 0.25, 0.5]) { let m = 0; for (let t = 5; t <= 40; t += 2.5) { const h = groundAt(x + Math.cos(ca + da) * t, z + Math.sin(ca + da) * t); m = Math.max(m, (h - gy) / t); } occ += Math.max(0, m - 0.04); } // storm cutscene: the whole dome must be visible from the console (concept)
      const sc = (hi - lo) * 2 + Math.abs(k) * 0.02 + Math.max(0, groundAt(x, z) - gc - 1) * 0.5 + moved * 2 + occ * 40; if (!best || sc < best.sc) best = { x: f.x, z: f.z, sc }; }
    return { x: best.x, z: best.z }; })(); // just outside the shield edge, on the storage-module side (concept: the cat outside, the dome over the base)
  const shield = makeShield(scene, { center: shieldC, R: 42, groundAt, consoleP, low, mobile: ctx.mobile, env });
  // ---------- the cat's home: airlock door on the living dome, interior on its own render layer ----------
  const homeDoor = (() => { const c = ctx.sd ? ctx.sd(-22, 3) : { x: 0, z: 0 }, d = ctx.sd ? ctx.sd(12.5, -19) : { x: 0, z: 1 }; const l = Math.hypot(d.x, d.z); const yw = Math.atan2(d.x / l, d.z / l); return { x: c.x + d.x / l * 4.95, z: c.z + d.z / l * 4.95, yaw: yw }; })();
  const homeO = new THREE.Vector3(0, groundAt(0, 0) + 300, 0);
  const home = makeHome(scene, { env, groundAt, door: homeDoor, origin: homeO, low, earthDir: ctx.earthDir, getMuseum: () => S().museum,
    getHubInfo: () => { const s = S(); const jobs = s.jobs.map(j => `${JICON[j.kind]} ${name(econ.robot(j.rid))}: ${Math.floor(econ.progress(j) * 100)}% · ${fmtTime(econ.left(j))}`); return { title: `MOONKATTY HUB · ${t('baseLvl')} ${s.level}`, lines: [`📦 ${t('storage')} ${econ.stored()}/${econ.cap()}`, `💎 ${s.res.cry}   🪨 ${s.res.ore}`, ...jobs.slice(0, 3), `🔥 ${t('streak')} ${s.streak.count} · 🎁 ${s.login.day === store.today() ? '✓' : '!'}`, `🗓️ ${s.daily.tasks.filter(x => x.claimed).length}/3`] }; } });
  const hw = (p) => ({ x: homeO.x + p.x, z: homeO.z + p.z });
  let inside = false, homeBusy = false, realSolids = null, outCam = null, entryAt = null, bunnyHint = false;
  const wait = (s) => new Promise(r => setTimeout(r, s * 1000));
  async function enterHome() { if (homeBusy || inside) return; homeBusy = true; home.setOpen(true); await wait(FAST ? 0.15 : 0.6); ctx.fade(true); await wait(FAST ? 0.1 : 0.35);
    try { home.snapshot(ctx.renderer, scene, { base: shieldC }); } catch (e) { } home.enterPrep(); realSolids = ctrl.solids; ctrl.solids = home.solids(realSolids); home.group.visible = true; camera.layers.set(home.LAYER); ctx.renderer.shadowMap.autoUpdate = false; if (ctx.catRoot) ctx.catRoot.traverse(o => o.layers.enable(home.LAYER));
    outCam = { d: ctrl.camDist, p: ctrl.camPitch }; const asp = camera.aspect || 1.7, E = asp < 1 ? home.entry.portrait : home.entry, di = hw(E.cat); ctrl.place(di.x, di.z, E.yaw, false); ctrl.camYaw = E.camYaw; ctrl.camDist = E.camDist; ctrl.camPitch = E.camPitch; outCam.fov = camera.fov; camera.fov = E.fov; camera.updateProjectionMatrix(); ctrl.camShift = E.fixedShift ? E.shift : E.shift * Math.min(1, asp / 1.6); ctrl.camLift = E.lift || 0; entryAt = { x: di.x, z: di.z }; try { if (window.MK && MK.setCatStride) MK.setCatStride({ ph: E.stride ?? 0.25, t: 8 }); } catch (e) { } inside = true; home.setOpen(false); await wait(0.1); ctx.fade(false); homeBusy = false; track('home'); rerender(); }
  async function exitHome() { if (homeBusy || !inside) return; homeBusy = true; ctx.fade(true); await wait(FAST ? 0.1 : 0.35); camera.layers.set(0); ctx.renderer.shadowMap.autoUpdate = true; ctx.renderer.shadowMap.needsUpdate = true; ctrl.solids = realSolids; home.group.visible = false; inside = false; ctrl.camShift = 0; ctrl.camLift = 0; try { if (window.MK && MK.setCatStride) MK.setCatStride(null); } catch (e) { } if (outCam && outCam.fov) { camera.fov = outCam.fov; camera.updateProjectionMatrix(); } home.setOpen(true);
    const o = home.outside; ctrl.place(o.x, o.z, homeDoor.yaw, true); if (outCam) { ctrl.camDist = outCam.d; ctrl.camPitch = outCam.p; } await wait(0.1); ctx.fade(false); await wait(FAST ? 0.2 : 0.8); home.setOpen(false); homeBusy = false; rerender(); }
  function homeAction() { const p = me();
    if (!inside) { if (FEAT.home && regionOf(p) === 'hub' && dist2(p, homeDoor) < 2.8) { home.setOpen(true); return { act: 'c2:home:in', label: '🚪 ' + t('homeEnter') }; } return null; }
    if (dist2(p, hw(home.doorIn)) < 1.5) return { act: 'c2:home:out', label: '🚪 ' + t('homeExit') };
    if (dist2(p, hw(home.consoleIn)) < 1.6) return { act: 'c2:home:console', label: '🖥️ ' + t('homeConsole') };
    return null; }
  const storm = { spots: [], t: 0, on: false, emberT: 0, replay: false };
  // damaged shield-emitter panels sit just outside the dome rim on the console side (concept: robots weld in front of the dome)
  const SPOTS = (() => { const fx = shieldC.x - consoleP.x, fz = shieldC.z - consoleP.z, fl = Math.hypot(fx, fz) || 1, ux = fx / fl, uz = fz / fl, rx = -uz, rz = ux; // u: console -> dome, r: screen-right of the cutscene camera
    return [[5.4, 1.5], [6.8, 3.3], [4.9, 0.0]].map(([a, l]) => free({ x: consoleP.x + ux * a + rx * l, z: consoleP.z + uz * a + rz * l }, 1.5)); })();
  const CUT = { on: false, t: 0, hold: false, dur: 0, saved: null };
  const cutBasis = () => { const fx = shieldC.x - consoleP.x, fz = shieldC.z - consoleP.z, fl = Math.hypot(fx, fz) || 1; const ux = fx / fl, uz = fz / fl; return { ux, uz, rx: -uz, rz: ux }; };
  function pressPaw() { try { const { ux, uz, rx, rz } = cutBasis(); const CK_U = CUT.ku ?? 0.3, CK_R = CUT.kr ?? 0.85; const kx = consoleP.x + ux * CK_U - rx * CK_R, kz = consoleP.z + uz * CK_U - rz * CK_R; const cdx = -ux * (CUT.dist ?? 2.3) + rx * (CUT.right ?? 0.6) - (ux * CK_U - rx * CK_R), cdz = -uz * (CUT.dist ?? 2.3) + rz * (CUT.right ?? 0.6) - (uz * CK_U - rz * CK_R); const yaw = Math.atan2(cdx, cdz) + (CUT.turn ?? 0); if (ctrl.place) ctrl.place(kx, kz, yaw);
    const ex = kx - consoleP.x, ez = kz - consoleP.z, el = Math.hypot(ex, ez) || 1; const pad = new THREE.Vector3(); shield.console.updateMatrixWorld(true); shield.console.localToWorld(pad.set(0, 0.47, 0)); pad.x += ex / el * 0.2; pad.z += ez / el * 0.2; pad.y += 0.04; const side = (pad.x - kx) * Math.cos(yaw) - (pad.z - kz) * Math.sin(yaw) > 0 ? 'L' : 'R';
    const M = window.MK; if (M && M.setCatPose) { M.setCatPose({ target: pad, side, lean: 0.3, bend: 0.5 }); CUT.poseT = FAST ? 0.4 : 3.6; } } catch (e) { } }
  // dedicated cutscene camera (independent of the gameplay rig): low, close, cat large on the left, console bottom-left, dome centre-right, Earth top-right
  function cutCam() { const { ux, uz, rx, rz } = cutBasis(); const gy = groundAt(consoleP.x, consoleP.z); const C = camera; const D = CUT.dist ?? 2.3, R = CUT.right ?? 0.6, H = CUT.h ?? 1.05;
    C.position.set(consoleP.x - ux * D + rx * R, gy + H, consoleP.z - uz * D + rz * R); const L = CUT.look ?? 5, LH = CUT.lookH ?? 5.5; C.lookAt(consoleP.x + ux * 30 + rx * L, gy + LH, consoleP.z + uz * 30 + rz * L); C.fov = CUT.fov ?? 60; C.updateProjectionMatrix(); C.updateMatrixWorld(); }
  function cutStart() { CUT.on = true; CUT.t = 0; CUT.dur = FAST ? 1.5 : 9; CUT.saved = { sm: ctrl.speedMul, fov: camera.fov }; ctrl.camFree = false; ctrl.speedMul = 0; cutCam(); }
  function cutEnd() { if (!CUT.on) return; CUT.on = false; ctrl.speedMul = CUT.saved ? CUT.saved.sm : 1; camera.fov = CUT.saved ? CUT.saved.fov : camera.fov; camera.updateProjectionMatrix(); ctrl.camFree = true; ctrl.camYaw = Math.atan2(camera.position.x - ctrl.pos.x, camera.position.z - ctrl.pos.z); }
  function cutUpdate(dt) { if (CUT.poseT > 0) { CUT.poseT -= dt; if (CUT.poseT <= 0 && !CUT.hold && window.MK && MK.setCatPose) MK.setCatPose(null); } if (!CUT.on) return; CUT.t += dt; if (ctrl.camFree && CUT.t > 0.2) { CUT.on = false; ctrl.speedMul = CUT.saved ? CUT.saved.sm : 1; return; } /* player tapped: skip */ if (CUT.t >= CUT.dur && !CUT.hold) { cutEnd(); return; } cutCam(); }
  // cutscene Earth: park it up and to the right of the dome as seen from the console (restored when the storm ends)
  function stormEarth(on) { if (!ctx.setEarthDir) return; if (!on) { ctx.setEarthDir(null); return; } const fx = shieldC.x - consoleP.x, fz = shieldC.z - consoleP.z, fl = Math.hypot(fx, fz) || 1; const f = new THREE.Vector3(fx / fl, 0, fz / fl), r = new THREE.Vector3(-f.z, 0, f.x); ctx.setEarthDir(f.multiplyScalar(0.82).addScaledVector(r, 0.55).add(new THREE.Vector3(0, 0.4, 0)).normalize()); }
  // temporary 'repair crew' NPC builders for the cutscene: every damaged panel without a real robot gets one (works with an empty save)
  const npcs = []; function npcFor(sp, i) { let n = npcs[i]; if (!n) { const rob = makeCrewRobot(scene, env, 'builder', 2); rob.root.name = 'ch2_repair_npc'; n = npcs[i] = { rob, sparkT: 0 }; } const { ux, uz, rx, rz } = cutBasis(); const side = i % 2 ? 1 : -1; n.sp = sp; n.x = sp.x - ux * 0.3 + rx * 0.8 * side; n.z = sp.z - uz * 0.3 + rz * 0.8 * side; n.yaw = Math.atan2(sp.x - n.x, sp.z - n.z); n.rob.root.position.set(n.x, groundAt(n.x, n.z), n.z); n.rob.root.rotation.y = n.yaw; n.rob.root.visible = true; sp.npc = n; return n; }
  function updateNpcs(dt, camP) { for (const n of npcs) { if (!n || !n.sp) continue; const sp = n.sp; if (!storm.on || !sp || sp.hp <= 0) { n.rob.root.visible = false; n.far = false; continue; } const dn = Math.hypot(n.x - camP.x, n.z - camP.z); n.far = !!imp && dn > IMP_D - 3; n.rob.root.visible = !n.far; if (!n.far) n.rob.update(dt, 'work', camP); n.sparkT -= dt; if (n.sparkT <= 0) { n.sparkT = 0.09; shield.weld({ x: n.x + Math.sin(n.yaw) * 0.55, y: groundAt(n.x, n.z) + 0.55, z: n.z + Math.cos(n.yaw) * 0.55 }); } } }
  function startStorm() { if (!shield.start()) return; pressPaw(); cutStart(); stormEarth(true); storm.on = true; storm.t = 0; storm.spots = []; storm.replay = isDone('c2_storm'); shield.configure({ dur: FAST ? 8 : 32, fast: FAST, onHit: () => { } }); hud.toast('🐾 ' + t('stormStart')); }
  function updateStorm(dt) { const st = shield.state; if (st === 'off' && !storm.on) { shield.console.visible = FEAT.storm && S().on && isDone('c2_l3'); return; } shield.console.visible = true;
    ctx.setNight(shield.night); cutUpdate(dt); if (!storm.on) return; storm.t += dt; const D0 = FAST ? 8 : 32;
    // damaged generator panels appear during the storm (shock waves through the ground)
    const want = st === 'storm' || st === 'calm' ? Math.min(3, Math.floor((storm.t - 3.4) / (D0 / 3.2)) + 1) : 0; while (storm.spots.length < want && storm.spots.length < 3) { const p = SPOTS[storm.spots.length]; const sp = { x: p.x, z: p.z, y: groundAt(p.x, p.z), hp: 1 }; storm.spots.push(sp); shield.emit(sp.x, sp.y + 0.3, sp.z, 30, 'hit'); hud.toast('⚠️ ' + t('panelHit'));
      const free_ = [...crew.values()].find(c => !c.storm && !econ.jobOf(c.r.id) && (c.state === 'home' || c.state === 'return')); if (free_) { free_.storm = sp; sp.rid = free_.r.id; } else npcFor(sp, storm.spots.length - 1); }
    storm.emberT -= dt; for (const sp of storm.spots) { if (sp.hp <= 0) continue; if (storm.emberT <= 0) shield.emit(sp.x + (Math.random() - 0.5) * 0.6, sp.y + 0.2, sp.z + (Math.random() - 0.5) * 0.6, 3, 'hit'); const c = sp.rid && crew.get(sp.rid); if ((c && c.weldOn) || sp.npc) sp.hp -= dt / (FAST ? 5 : 40); if (sp.hp <= 0) { sp.hp = 0; shield.emit(sp.x, sp.y + 0.6, sp.z, 20, 'weld'); hud.toast('🔧 ' + t('panelFixed')); if (c) { c.storm = null; c.weldOn = false; } } } if (storm.emberT <= 0) storm.emberT = 0.35;
    if (st === 'calm' && storm.spots.length >= 3 && storm.spots.every(s => s.hp <= 0)) { shield.calmDone = true; }
    updateNpcs(dt, camera.position);
    if (st === 'done') { storm.on = false; ctx.setNight(0); stormEarth(false); cutEnd(); npcs.forEach(n => { n.rob.root.visible = false; n.sp = null; }); const q = cur(); if (q && q.kind === 'storm') reward(q, '🛡️ ' + t('stormDone')); else hud.toast('🛡️ ' + t('stormDone')); } }

  // ---------- crew in the world ----------
  const crew = new Map(); const crewCols = [];
  let imp = null; const IMP_D = low ? 6 : ctx.mobile ? 7 : 8; // far crew -> one instanced billboard draw
  let api_extraImp = null; // other systems (world life porters) add far robots to the crew impostor draw
  function ensureCrew() { if (!imp && ctx.renderer) { try { imp = makeImpostors(scene, ctx.renderer, env); } catch (e) { imp = null; } }
    S().robots.forEach((r, i) => { if (crew.has(r.id)) return; const rob = makeCrewRobot(scene, env, r.type, Math.min(3, econ.robotLevel(r)));
      const c = { r, rob, label: makeProgressLabel(scene, { size: 0.065 }), home: HOMES[i % HOMES.length], pos: new THREE.Vector3(), state: 'home', target: null, yaw: 0, col: { x: 0, z: 0, r: 0.45, h: 1.9 }, sparkT: 0 };
      const j = econ.jobOf(r.id); if (j && j.kind !== 'upgrade' && j.kind !== 'eng') { const s = siteOf(j); place(c, s, s); c.state = 'site'; } else if (j) { const s = siteOf(j); place(c, s, depotP); c.state = 'site'; } else { place(c, c.home, { x: c.home.x + Math.sin(yaw) * 5, z: c.home.z + Math.cos(yaw) * 5 }); c.state = 'home'; }
      c.lastKind = j ? j.kind : null; crew.set(r.id, c); });
  }
  function place(c, p, look) { const a = Math.atan2(look.x - p.x, look.z - p.z); c.pos.set(p.x, robotY(p.x, p.z, a), p.z); c.yaw = a; c.rob.root.position.copy(c.pos); c.rob.root.rotation.y = a; }
  function walk(c, tg, dt, sp) { const dx = tg.x - c.pos.x, dz = tg.z - c.pos.z, d = Math.hypot(dx, dz); if (d < 0.08) return true; const s = Math.min(d, sp * dt); c.pos.x += dx / d * s; c.pos.z += dz / d * s; const a = Math.atan2(dx, dz); let dr = a - c.yaw; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); c.yaw += dr * Math.min(1, dt * 8); c.pos.y = robotY(c.pos.x, c.pos.z, c.yaw); c.rob.root.position.copy(c.pos); c.rob.root.rotation.y = c.yaw; return false; }
  const SPD = FAST ? 4.5 : 1.6;
  // state machine: home -> (job) walkout -> site (work) -> (done) return -> home. Upgrades / engineer jobs are local (walk straight to the site).
  function updateCrew(dt) {
    const camR = regionOf(camera.position); const camP = camera.position; if (imp) { imp.begin(); imp.dim = 1 + 0.25 * shield.night; }
    const showBot = (c, vis, mode, d) => { const far = imp && vis && d > (storm.on ? IMP_D - 3 : IMP_D) /* v51: during the storm ALL crew go impostor sooner (no 3.3k lo meshes in the console view) */ && imp.push(c.pos, c.r.type, c.yaw); /* storm: panel crew sits close to the console -> impostor sooner (budget) */ c.rob.root.visible = vis && !far; if (vis && !far) c.rob.update(dt, mode, camP); };
    for (const c of crew.values()) {
      const j = econ.jobOf(c.r.id); const local = j && (j.kind === 'upgrade' || j.kind === 'eng');
      let mode = 'idle', vis = true, region = 'hub';
      if (j && c.state === 'home') c.state = local ? 'golocal' : 'walkout';
      if (!j && (c.state === 'site' || c.state === 'golocal')) { if (c.state === 'site' && !local && c.lastKind && c.lastKind !== 'upgrade' && c.lastKind !== 'eng') { place(c, hubGate, depotP); burst.fire(hubGate.x, hubGate.y + 1, hubGate.z); c.state = 'return'; } else c.state = 'return'; }
      if (j) c.lastKind = j.kind;
      if (c.storm && !j) { const sp = c.storm; const tg = { x: sp.x + (c.home.x - sp.x) * 0.0 + 0.85 * Math.sign((c.home.x - sp.x) || 1), z: sp.z }; mode = 'walk'; c.weldOn = false;
        if (walk(c, tg, dt, SPD * 2.4)) { mode = 'work'; let dr = Math.atan2(sp.x - c.pos.x, sp.z - c.pos.z) - c.yaw; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); c.yaw += dr * Math.min(1, dt * 6); c.rob.root.rotation.y = c.yaw; c.weldOn = true; c.sparkT -= dt; if (c.sparkT <= 0) { c.sparkT = 0.09; shield.weld({ x: c.pos.x + Math.sin(c.yaw) * 0.55, y: c.pos.y + 0.55, z: c.pos.z + Math.cos(c.yaw) * 0.55 }); } }
        c.state = 'return'; const d = c.pos.distanceTo(camP); showBot(c, camR === 'hub' && d < 140, mode, d); c.label.hide(); continue; }
      if ((c.state === 'walkout' || c.state === 'golocal') && !j) c.state = 'return';
      if (c.state === 'walkout') { mode = 'walk'; if (walk(c, hubGate, dt, SPD)) { burst.fire(c.pos.x, c.pos.y + 1, c.pos.z); const s = siteOf(j); place(c, s, s.region === 'canyon' ? { x: s.x + 3, z: s.z + 1 } : depotP); c.state = 'site'; } }
      else if (c.state === 'golocal') { mode = 'walk'; const s = siteOf(j); if (walk(c, s, dt, SPD)) c.state = 'site'; }
      else if (c.state === 'site') { region = j ? siteOf(j).region : 'hub'; mode = 'work'; if (j && j.kind === 'upgrade') { let dr = Math.atan2(base.siteW(j.what).x - c.pos.x, base.siteW(j.what).z - c.pos.z) - c.yaw; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); c.yaw += dr * Math.min(1, dt * 5); c.rob.root.rotation.y = c.yaw; c.sparkT -= dt; if (c.sparkT <= 0) { c.sparkT = 1.1; const sw = base.siteW(j.what); burst.fire(sw.x + (c.pos.x - sw.x) * 0.5, c.pos.y + 0.9, sw.z + (c.pos.z - sw.z) * 0.5); } } }
      else if (c.state === 'return') { mode = FEAT.life && c.lastKind && c.lastKind !== 'upgrade' && c.lastKind !== 'eng' ? 'carry' : 'walk'; if (walk(c, c.home, dt, SPD)) { c.state = 'home'; } }
      else { mode = 'idle'; }
      if (c.state === 'walkout' || c.state === 'return' || c.state === 'golocal' || c.state === 'home') region = 'hub';
      const d = c.pos.distanceTo(camP); vis = region === camR && d < 140;
      showBot(c, vis, mode, d);
      // collider while standing in the world
      const ci = ctrl.colliders.indexOf(c.col); const solid = vis && regionOf(me()) === region && (c.state === 'home' || c.state === 'site'); if (solid) { c.col.x = c.pos.x; c.col.z = c.pos.z; if (ci < 0) ctrl.colliders.push(c.col); } else if (ci >= 0) ctrl.colliders.splice(ci, 1);
      // label: over the site (or the build) when in view; at the hub gate while the robot works in the canyon
      if (j) { const fr = econ.progress(j), left = econ.left(j); const title = (j.help === 'asked' ? '🆘 ' + name(c.r) + ' · ' + t('helpAsk') : JICON[j.kind] + ' ' + name(c.r) + ' · ' + jobTitle(j));
        let lp = null; if (j.kind === 'upgrade') { const sw = base.siteW(j.what); lp = new THREE.Vector3(sw.x, groundAt(sw.x, sw.z) + 4.2, sw.z); } else if (c.state === 'site' && region === camR) lp = new THREE.Vector3(c.pos.x, c.pos.y + 2.25, c.pos.z); else if (camR === 'hub' && c.state === 'site') { const k = [...crew.values()].filter(o => o.state === 'site' && econ.jobOf(o.r.id) && siteOf(econ.jobOf(o.r.id)).region !== 'hub').indexOf(c); lp = new THREE.Vector3(hubGate.x, hubGate.y + 3.4 + k * 0.9, hubGate.z); }
        if (lp && lp.distanceTo(camP) < 90) c.label.set(lp, fr, left, title); else c.label.hide(); }
      else c.label.hide();
    }
    // storage label over the depot when close
    const sd = dist2(camP, depotP); if (S().on && sd < 30 && camR === 'hub') { const cap = econ.cap(), n = econ.stored(); storeLabel.set(new THREE.Vector3(depotP.x, depotP.y + 4.9, depotP.z), n / cap, 0, '📦 ' + t('storage') + (n >= cap ? ' · ' + t('storageFull') : ''), `${n}/${cap}`); } else storeLabel.hide();
  }
  const jobTitle = (j) => j.kind === 'upgrade' ? t('upTo') + ' ' + j.what : j.kind === 'expedition' ? t(j.what) : j.kind === 'dig' ? t(j.what) : t('eng_' + j.what).split(':')[0];
  // ---------- base visuals / colliders ----------
  let baseCols = [];
  function syncBase() { const up = S().jobs.find(j => j.kind === 'upgrade'); base.set(S().level, up ? up.what : 0, up ? econ.progress(up) : 0); base.setArtifacts(S().museum);
    for (const c of baseCols) { const i = ctrl.colliders.indexOf(c); if (i >= 0) ctrl.colliders.splice(i, 1); } baseCols = S().on ? base.colliders(S().level) : []; ctrl.colliders.push(...baseCols);
    ctrl.fuelMul = 1 + 0.25 * S().eng.jet; }
  // ---------- quests ----------
  const isDone = (id) => S().done.includes(id);
  const cur = () => CH2.find(q => !isDone(q.id)) || null;
  let busy = false;
  async function reward(q, note) { if (busy || isDone(q.id)) return; busy = true; const r = await grant(q.pts, 'quest:' + q.id); const ups = addXP(D(), q.xp); S().done.push(q.id); await store.save(); refreshTop(); const last = !cur();
    hud.popup({ icon: last ? '🏆' : q.icon, head: last ? t('ch2Done') : t('questDone'), title: t('q_' + q.id + '_t'), pts: r.granted, xp: q.xp, level: ups ? D().level : 0, note: r.capped ? `${t('capPart')}: ${r.earned}/${r.cap}` : (note || (last ? t('ch2DoneSub') : '')) }, last ? 4600 : 3000); busy = false; rerender(); }
  function checkQuest() { const q = cur(); if (!q || busy) return; const s = S();
    if (q.kind === 'level' && s.level >= q.lvl) reward(q, `🏗️ ${t('baseUp')} ${s.level}`);
    else if (q.kind === 'daily' && s.login.day && s.daily.tasks.some(x => x.claimed)) reward(q);
    else if (q.kind === 'streak' && Math.max(s.streak.best, s.streak.count) >= q.need && s.robots.length >= 3) reward(q);
    else if (q.kind === 'museum' && s.museum.length >= 1) reward(q);
    else if (q.kind === 'help') { // scripted: a running job (prefer the expedition) asks for help as soon as this quest is active
      if (!s.jobs.some(j => j.help === 'asked')) { const j = s.jobs.find(j => j.kind === 'expedition' && j.help !== 'done') || s.jobs.find(j => j.help === 'none'); if (j && econ.progress(j) < 0.85) { j.help = 'asked'; pending.push(['help', j]); } } } }
  // ---------- economy events ----------
  const away = []; let booting = true;
  function onEvent(k, x) {
    if (k === 'start') { track('send'); }
    else if (k === 'help') { const r = econ.robot(x.rid); if (!booting) hud.toast(`🆘 ${name(r)} ${t('helpAsk')}`); }
    else if (k === 'done') { const r = econ.robot(x.job.rid); const lines = []; const nm = r ? name(r) : '';
      if (x.kind === 'upgrade') lines.push(`🏗️ ${t('baseUp')} ${x.level}`); if (x.kind === 'eng') lines.push(`🔧 ${t('engUp')}: ${t('eng_' + x.eng)} (${x.engLvl}/3)`);
      if (x.deliv) lines.push(`📦 ${t('delivered')}: 💎${x.deliv.cry} 🪨${x.deliv.ore}${x.deliv.lost ? ` (${x.deliv.lost} ${t('lost')})` : ''}`);
      if (x.story) lines.push(`📜 ${t('st_' + x.story)}`); if (x.bonusCry) lines.push(`✨ +${x.bonusCry} 💎`);
      if (x.artifact) lines.push(`🏺 ${t('found')}: ${artName(x.artifact)}`); if (x.found && x.found.length) lines.push(`🏺 ${t('found')}: ${x.found.map(artName).join(', ')}`);
      if (x.sets) for (const s of x.sets) lines.push(`🏆 ${t('setDone')} ${t('set_' + s)} · ${t('bonus_' + MUSEUM[s].bonus)}`);
      if (x.robotUp) { lines.push(`⬆️ ${t('robotUp')} ${x.robotUp}${x.robotUp <= 3 ? ' · ' + t('newTool') : ''}`); const c = crew.get(x.job.rid); if (c) c.rob.setLevel(Math.min(3, x.robotUp)); }
      if (booting) away.push(...lines.map(l => (nm ? nm + ': ' : '') + l));
      else hud.popup({ icon: JICON[x.kind], head: `${nm} ${t('returned')}`, title: jobTitle(x.job), note: lines.join(' · ') }, 3600);
      syncBase(); }
    rerender();
  }
  const artName = (a) => t('art_' + a.split(':')[1]);
  function flush() { while (pending.length) { const [k, x] = pending.shift(); onEvent(k, x); } }
  // ---------- daily ----------
  function track(id, n = 1) { const tk = econ.track(id, n); if (tk && !booting) hud.toast(`🗓️ ${t('taskDone')}: ${t('dt_' + id)}`); if (tk) { store.queueSave(); rerender(); } }
  async function claimLogin() { const r = econ.claimLogin(); if (!r) return; const g = await grant(r.pts, 'login'); hud.toast(`🎁 ${t('loginToast')}: +${g.granted} ⭐ +${r.ore} 🪨`); await store.save(); refreshTop(); rerender(); checkQuest(); }
  async function claimTask(i) { const r = econ.claimTask(i); if (!r) return; const g = await grant(r.pts, 'daily:' + i); /* TG port: per-task ledger key (server: daily:0..2) */ hud.toast(`🗓️ +${g.granted} ⭐${r.all ? ` · ${t('allBonus')}: +${r.all.ore} 🪨` : ''}`); await store.save(); refreshTop(); rerender(); checkQuest(); }
  // ---------- actions ----------
  async function startJob(rid, kind, what) { const r = econ.start(rid, kind, what); if (!r.ok) { hud.toast('⚠️ ' + (r.why === 'cost' ? t('needRes') : r.why === 'level' ? t('needLvl') : r.why)); return r; }
    flush(); const rb = econ.robot(rid); hud.toast(`${JICON[kind]} ${name(rb)}: ${t('jobStarted')} · ${fmtTime(econ.left(r.job))}${kind === 'expedition' || kind === 'dig' ? ' · ' + t('walkOut') : ''}`);
    const q = cur(); if (q && q.kind === 'send' && kind === 'expedition') reward(q); syncBase(); await store.save(); rerender(); return r; }
  async function doCollect() { const had = econ.stored() + 0; const got = econ.collect(); const n = got.cry + got.ore; if (!n) { hud.toast('📦 ' + t('collectEmpty')); return got; }
    burst.fire(depotP.x, depotP.y + 2.5, depotP.z); hud.toast(`📦 ${t('collected')}: 💎 ${got.cry} 🪨 ${got.ore}`); track('collect');
    const q = cur(); if (q && q.kind === 'collect') reward(q); if (q && q.kind === 'deliver' && S().expeditions >= 1) reward(q);
    await store.save(); rerender(); return got; }
  async function recruit(type) { const r = econ.recruit(type); if (!r.ok) { hud.toast('⚠️ ' + r.why); return r; } ensureCrew(); const c = crew.get(r.robot.id); burst.fire(c.pos.x, c.pos.y + 1, c.pos.z); hud.toast(`🤖 ${t('hired')} ${name(r.robot)}`); await store.save(); checkQuest(); rerender(); return r; }
  // help minigame (reuses the Chapter 1 mining timing bar)
  let helpJob = null;
  async function helpResult(res) { const j = helpJob; if (!j || !res) return; if (res === 'miss') { miner.msg(t('helpMiss'), 'bad'); return; }
    const r = econ.help(j.id, res); helpJob = null; miner.msg(t('helpDone'), res); setTimeout(() => miner.hide(), 700); if (!r.ok) return; const c = crew.get(j.rid); if (c) burst.fire(c.pos.x, c.pos.y + 1.2, c.pos.z);
    hud.toast(`🤝 ${t('helpThanks')} · +${Math.round(r.bonus * 100)}%`); track('help'); const q = cur(); if (q && q.kind === 'help') reward(q, `+${Math.round(r.bonus * 100)}% · ${t('helpDone')}`); await store.save(); rerender(); }
  // ---------- context action (called from the game's action button logic when Chapter 1 is finished) ----------
  let holdT = 0, holding = false, focusRid = null;
  function action(dt) {
    if (!S().on) return null; const ha = homeAction(); if (ha || inside) return ha; const p = me(); const here = regionOf(p);
    // 1) a robot asking for help nearby
    for (const c of crew.values()) { const j = econ.jobOf(c.r.id); if (!j || j.help !== 'asked' || !c.rob.root.visible || c.state !== 'site') continue; if (dist2(p, c.pos) < 2.9) { if (helpJob !== j) { helpJob = j; miner.easy(true); } if (!miner.open) miner.show(0, 1); return { act: 'c2:help', label: miner.holding ? '🛠️ …' : '🛠️ ' + t('helpBtn') }; } }
    if (helpJob && miner.open) { miner.hide(); helpJob = null; }
    // finale: paw button on the shield console, then repair damaged panels
    if (here === 'hub') { const st = shield.state; if (shield.console.visible && (st === 'off' || st === 'done') && dist2(p, consoleP) < 2.6) return { act: 'c2:storm', label: '🐾 ' + t('shieldBtn') };
      if (storm.on) for (const sp of storm.spots) { if (sp.hp > 0 && dist2(p, sp) < 2.4) { if (holding) { sp.hp -= dt / (FAST ? 0.4 : 1.6); if (Math.random() < 0.5) shield.weld({ x: sp.x, y: sp.y + 0.3, z: sp.z }); } return { act: 'c2:repair', label: '🔧 ' + t('repair'), frac: 1 - sp.hp }; } } }
    // 2) storage
    if (here === 'hub' && dist2(p, depotP) < 3.7) { if (holding) holdT += dt; if (holdT >= (FAST ? 0.25 : 0.8)) { holdT = 0; holding = false; doCollect(); } return { act: 'c2:collect', label: `📦 ${t('collect')} ${econ.stored()}`, frac: Math.min(1, holdT / (FAST ? 0.25 : 0.8)) }; }
    holdT = 0;
    // 3) talk to a robot
    let best = null, bd = 2.7; for (const c of crew.values()) { if (!c.rob.root.visible || (c.state !== 'home' && c.state !== 'site')) continue; const d = dist2(p, c.pos); if (d < bd) { bd = d; best = c; } }
    if (best) return { act: 'c2:robot:' + best.r.id, label: `${ICON[best.r.type]} ${name(best.r)} · ${t('talk')}` };
    return null;
  }
  function actDown(a) { if (a === 'c2:home:in') return enterHome(); if (a === 'c2:home:out') return exitHome(); if (a === 'c2:home:console') { ctx.setTab('crew'); openSheet(true); const q = cur(); if (q && q.kind === 'home') reward(q, '🖥️ ' + t('homeConsole')); return; } if (a === 'c2:help') miner.press(); else if (a === 'c2:collect' || a === 'c2:repair') holding = true; else if (a === 'c2:storm') startStorm(); else if (a.startsWith('c2:robot:')) { focusRid = a.slice(9); ctx.setTab('crew'); openSheet(true); } }
  function actUp(a) { if (a === 'c2:help' && miner.holding) helpResult(miner.release()); holding = false; }
  // ---------- target / tracker ----------
  function target() { const q = cur(); if (!q || !S().on) return null; if (inside) return q.kind === 'home' ? { ...hw(home.consoleIn), y: homeO.y } : { ...hw(home.doorIn), y: homeO.y }; if (q.kind === 'home') return { ...homeDoor }; const here = regionOf(me()); const route = (p, region) => region && region !== here ? gates[here] : p;
    const rob = (type) => [...crew.values()].find(c => c.r.type === type);
    if (q.kind === 'collect' || q.kind === 'deliver') { if (q.kind === 'deliver' && S().jobs.some(j => j.kind === 'expedition')) return null; return route({ ...depotP }, 'hub'); }
    if (q.kind === 'send') { const c = rob('geologist'); return c && c.state === 'home' ? route({ x: c.pos.x, y: c.pos.y, z: c.pos.z }, 'hub') : null; }
    if (q.kind === 'level') { const up = S().jobs.find(j => j.kind === 'upgrade'); if (up) return null; const c = rob('builder'); return c && c.state === 'home' ? route({ x: c.pos.x, y: c.pos.y, z: c.pos.z }, 'hub') : null; }
    if (q.kind === 'help') { const j = S().jobs.find(j => j.help === 'asked'); if (j) { const c = crew.get(j.rid); if (c && c.state === 'site') return route({ x: c.pos.x, y: c.pos.y, z: c.pos.z }, siteOf(j).region); return null; } const c = rob('geologist'); return c && c.state === 'home' ? route({ x: c.pos.x, y: c.pos.y, z: c.pos.z }, 'hub') : null; }
    if (q.kind === 'museum' && S().level >= 3) return route({ ...base.museumW }, 'hub');
    if (q.kind === 'storm') { const sp = storm.spots.find(s => s.hp > 0); if (sp) return route({ ...sp }, 'hub'); if (!storm.on) return route({ ...consoleP }, 'hub'); return null; }
    return null; }
  function trackHTML(dist) { const q = cur(); const s = S(); const head = `<div class="ch"><span>${esc(t('chapter2'))} · ${esc(t('chapter2Title'))}</span><span>${Math.min(s.done.length + 1, CH2.length)}/${CH2.length}</span></div>`;
    const resRow = `<div class="row" style="margin-top:4px"><span style="color:#ffd77a">📦 ${econ.stored()}/${econ.cap()} · 💎 ${s.res.cry} · 🪨 ${s.res.ore}</span><span>${esc(t('baseLvl'))} ${s.level}</span></div>`;
    if (!q) return `${head}<div class="t">🏆 ${esc(t('ch2Done'))}</div><div class="d">${esc(t('ch2DoneSub'))}</div>${resRow}`;
    let hint = '', prog = ''; const bar = (a, b, txt) => `<div class="row"><div class="bar"><i style="width:${Math.min(100, a / b * 100)}%"></i></div><span>${txt}</span></div>`;
    const here = regionOf(me()); const tg = target(); if (tg && tg === gates[here]) hint = '🌀 ' + esc(t(here === 'hub' ? 'toCanyon' : 'toBase'));
    const job = (k) => s.jobs.find(j => j.kind === k);
    if (q.kind === 'send' && !hint) hint = '⛏️ ' + esc(t('sendGeo'));
    if (q.kind === 'level') { const up = job('upgrade'); if (up) prog = bar(econ.progress(up), 1, `${Math.floor(econ.progress(up) * 100)}% · ${fmtTime(econ.left(up))}`); else if (!hint) { const B = BASE[q.lvl]; hint = `🏗️ ${esc(t('orderUp'))} · 🪨${s.res.ore}/${B.cost.ore} 💎${s.res.cry}/${B.cost.cry}`; } }
    if (q.kind === 'help' && !hint) hint = s.jobs.some(j => j.help === 'asked') ? '🆘 ' + esc(t('helpFind')) : '⛏️ ' + esc(t('sendGeo'));
    if (q.kind === 'deliver') { const e = job('expedition'); if (e) { prog = bar(econ.progress(e), 1, `${Math.floor(econ.progress(e) * 100)}% · ${fmtTime(econ.left(e))}`); hint = '💤 ' + esc(t('leaveOk')); } else if (!hint) hint = '📦 ' + esc(t('storageHint')); }
    if (q.kind === 'streak') prog = bar(Math.max(s.streak.count, s.streak.best), 7, `🔥 ${Math.max(s.streak.count, s.streak.best)}/7`);
    if (q.kind === 'museum' && !s.robots.some(r => r.type === 'archaeologist')) hint = '🔎 ' + esc(t('needArch'));
    if (q.kind === 'storm') { if (storm.on) prog = bar(storm.spots.filter(s => s.hp <= 0).length, 3, `🔧 ${storm.spots.filter(s => s.hp <= 0).length}/3`); hint = storm.on ? '☄️ ' + esc(t('stormHint')) : '🐾 ' + esc(t('shieldGo')); }
    if (q.kind === 'home') hint = inside ? '🖥️ ' + esc(t('homeConsole')) : '🚪 ' + esc(t('homeGo'));
    if (q.kind === 'daily') hint = `🎁 ${s.login.day ? '✓' : '·'} · 🗓️ ${s.daily.tasks.filter(x => x.done).length}/3`;
    return `${head}<div class="t">${q.icon} ${esc(t('q_' + q.id + '_t'))}</div><div class="d">${esc(t('q_' + q.id + '_d'))}</div>${prog}${resRow}<div class="row" style="margin-top:5px"><span style="color:rgba(247,242,231,.6)">+${q.pts} ⭐ · +${q.xp} XP</span><span class="dist">${dist != null ? Math.round(dist) + ' ' + t('m') : ''}</span></div>${hint ? `<div class="hint">${hint}</div>` : ''}`; }
  // ---------- sheet tabs ----------
  function renderChapter(sub, list) { const s = S(); sub.innerHTML = `<span>${esc(t('chapter2'))} · ${esc(t('chapter2Title'))}</span><span>${s.done.length}/${CH2.length}</span>`; const ci = CH2.findIndex(q => !isDone(q.id));
    list.innerHTML = `<div class="mk-sec"><span>✅ ${esc(t('chapter'))} · ${esc(t('chapterTitle'))}</span><span>9/9</span></div>` + CH2.map((q, i) => { const st = isDone(q.id) ? 'done' : i === ci ? 'active' : 'locked'; return `<div class="mk-q ${st}"><div class="ic">${st === 'done' ? '✅' : st === 'locked' ? '🔒' : q.icon}</div><div class="tx"><div class="tt">${esc(t('q_' + q.id + '_t'))}</div><div class="dd">${esc(t('q_' + q.id + '_d'))}</div><div class="st">${esc(t(st === 'done' ? 'done' : st === 'active' ? 'active' : 'locked'))}</div></div><div class="rw">+${q.pts} ⭐<small>+${q.xp} XP</small></div></div>`; }).join(''); }
  const costTxt = (c) => c ? `🪨${c.ore} 💎${c.cry}` : '';
  const fmtDur = (s) => { s = s * SCALE; const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60); return h ? `${h}${ctx.lang === 'en' ? 'h' : 'ч'}${m ? ' ' + m + (ctx.lang === 'en' ? 'm' : 'м') : ''}` : m ? `${m} ${ctx.lang === 'en' ? 'min' : 'мин'}` : `${Math.round(s)} ${ctx.lang === 'en' ? 's' : 'с'}`; };
  function actionsFor(r) { const s = S(); const L = s.level; const out = []; const btn = (act, label, right, ok, why) => out.push(`<button class="c2-btn${ok ? ' go' : ''}" data-act="${act}" ${ok ? '' : 'disabled'}><span>${label}${why ? ` <small style="color:#ff9a7a">· ${esc(why)}</small>` : ''}</span><small>${right}</small></button>`);
    const sm = econ.speedMul(r);
    if (r.type === 'builder') { if (L >= MAX_LEVEL) out.push(`<div class="c2-stub">${esc(t('maxLvl'))}</div>`); else { const B = BASE[L + 1]; const ok = econ.canAfford(B.cost) && !s.jobs.some(j => j.kind === 'upgrade'); btn(`up:${r.id}`, `🏗️ ${t('upTo')} ${L + 1} · 📦 ${B.cap}`, `${costTxt(B.cost)} · ${fmtDur(B.dur / sm)}`, ok, !econ.canAfford(B.cost) ? t('needRes') : s.jobs.some(j => j.kind === 'upgrade') ? t('busyBuild') : ''); } }
    if (r.type === 'geologist') for (const E of EXPEDITIONS) { const ok = L >= E.lvl; btn(`ex:${r.id}:${E.id}`, `${t(E.id)}`, `💎${E.cry} 🪨${E.ore} · ${fmtDur(E.dur * Math.pow(0.9, s.eng.antenna) / sm)}`, ok, ok ? '' : `🔒 ${t('needLvl')} ${E.lvl}`); }
    if (r.type === 'archaeologist') for (const G of DIGS) { const ok = L >= G.lvl; btn(`dg:${r.id}:${G.id}`, `${t(G.id)}`, `🏺×${G.rolls} · ${fmtDur(G.dur / sm)}`, ok, ok ? '' : `🔒 ${t('needLvl')} ${G.lvl}`); }
    if (r.type === 'engineer') for (const [k, U] of Object.entries(ENG)) { const lv = s.eng[k]; if (lv >= 3) { btn(`en:${r.id}:${k}`, `${t('eng_' + k)} (3/3)`, t('engMax'), false, ''); continue; } const busy = s.jobs.some(j => j.kind === 'eng' && j.what === k); const ok = econ.canAfford(U.cost[lv]) && !busy; btn(`en:${r.id}:${k}`, `${t('eng_' + k)} (${lv}/3)`, `${costTxt(U.cost[lv])} · ${fmtDur(U.dur[lv] / sm)}`, ok, ok ? '' : busy ? '…' : t('needRes')); }
    return out.join(''); }
  function renderCrew(sub, list) { const s = S(); const cap = econ.cap(), n = econ.stored(); const rate = BASE[s.level].rate * (1 + 0.3 * s.eng.reactor);
    sub.innerHTML = `<span>🤖 ${esc(t('robotsN'))} ${s.robots.length}/${econ.slots()}</span><span>${esc(t('baseLvl'))} ${s.level}</span>`;
    let h = `<div class="c2-card"><div class="c2-row"><span>📦 ${esc(t('storage'))} ${n}/${cap}</span><small>+${Math.round(rate)}${esc(t('perH'))}</small></div><div class="c2-bar"><i style="width:${Math.min(100, n / cap * 100)}%"></i></div><div class="c2-row" style="margin-top:6px"><span>${esc(t('res'))}: 💎 ${s.res.cry} · 🪨 ${s.res.ore}</span><small>${esc(t('storageHint'))}</small></div></div>`;
    for (const r of s.robots) { const j = econ.jobOf(r.id); const lv = econ.robotLevel(r); const nx = ROBOT_XP[lv] ?? null; const ask = j && j.help === 'asked';
      h += `<div class="c2-card${ask ? ' ask' : ''}${focusRid === r.id ? ' hl' : ''}" data-rid="${r.id}"><div class="c2-row"><span>${ICON[r.type]} ${esc(name(r))} <small>${esc(t('lvlShort'))} ${lv}${nx != null ? ` · XP ${r.xp}/${nx}` : ''}</small></span><small>${j ? (ask ? '🆘 ' + esc(t('helpAsk')) : JICON[j.kind] + ' ' + esc(jobTitle(j))) : esc(t('idle'))}</small></div>`;
      if (j) h += `<div class="c2-bar"><i style="width:${econ.progress(j) * 100}%"></i></div><div class="c2-row" style="margin-top:4px"><small>${Math.floor(econ.progress(j) * 100)}% · ${fmtTime(econ.left(j))}</small><small>${j.bonus ? '+' + Math.round(j.bonus * 100) + '%' : ''}</small></div>`;
      else h += `<div class="c2-acts">${actionsFor(r)}</div>`;
      h += `</div>`; }
    // recruit
    const slots = econ.slots(); h += `<div class="c2-tag">${esc(t('recruit'))} · ${esc(t('slots'))} ${s.robots.length}/${slots}</div>`;
    if (s.robots.length < slots) { h += `<div class="c2-acts">` + TYPES.map(ty => { const ok = econ.countType(ty) < MAX_PER_TYPE; return `<button class="c2-btn${ok ? ' go' : ''}" data-act="hire:${ty}" ${ok ? '' : 'disabled'}><span>${ICON[ty]} ${esc(t('rb_' + ty))}</span><small>${ok ? esc(t('hire')) : esc(t('maxType'))}</small></button>`; }).join('') + `</div>`; }
    else h += `<div class="c2-stub">🔒 ${esc(slots <= 2 ? t('slot3') + ` (${s.streak.count}/7)` : t('slotNext').replace('{n}', [7, 14, 21, 30].find(x => x > Math.max(s.streak.best, s.streak.count)) || 30).replace('{l}', Math.min(5, Math.max(4, s.level + 1))))}</div>`;
    // museum
    if (s.level >= 3) { h += `<div class="c2-tag">🏺 ${esc(t('museum'))}</div>`; for (const [k, v] of Object.entries(MUSEUM)) { const got = v.items.filter(i => s.museum.includes(k + ':' + i)); h += `<div class="c2-card"><div class="c2-row"><span>${s.sets.includes(k) ? '🏆' : '🏺'} ${esc(t('set_' + k))} ${got.length}/4</span><small>${esc(t('bonus_' + v.bonus))}</small></div><div class="c2-row" style="margin-top:3px"><small>${v.items.map(i => (s.museum.includes(k + ':' + i) ? '✅' : '▫️') + ' ' + esc(t('art_' + i))).join('  ')}</small></div></div>`; } }
    // stubs pending the Telegram port
    h += `<div class="c2-stub">${esc(t('friendHelp'))} — ${esc(t('soonTg'))}</div><div class="c2-stub">${esc(t('tgNotify'))} — ${esc(t('soonTg'))}</div>`;
    list.innerHTML = h; if (focusRid) { const el = list.querySelector(`[data-rid="${focusRid}"]`); if (el) el.scrollIntoView({ block: 'nearest' }); focusRid = null; } }
  function renderDaily(sub, list) { const s = S(); econ.rollDay(); const c = store.capInfo(); const lr = econ.loginReward(); const sk = s.streak;
    sub.innerHTML = `<span>${esc(t('daily'))}</span><span>⭐ ${c.earned}/${c.cap}</span>`;
    let h = `<div class="c2-card"><div class="c2-row"><span>🔥 ${esc(t('streak'))} ${sk.count} ${esc(t('days'))}</span><small>${esc(t('best'))} ${sk.best} · 🛡️ ${sk.grace > 0 ? esc(t('grace')) + ' ×' + sk.grace : esc(t('graceUsed'))}</small></div><div class="c2-bar"><i style="width:${Math.min(100, (sk.count % 7 || (sk.count ? 7 : 0)) / 7 * 100)}%"></i></div></div>`;
    const got = s.login.day === store.today(); h += `<div class="c2-card"><div class="c2-row"><span>🎁 ${esc(t('login'))}</span><small>+${lr.pts} ⭐ +${lr.ore} 🪨</small></div><div class="c2-acts"><button class="c2-btn${got ? '' : ' go'}" data-act="login" ${got ? 'disabled' : ''}><span>${got ? '✓ ' + esc(t('claimed')) : esc(t('claim'))}</span><small></small></button></div></div>`;
    h += `<div class="c2-tag">${esc(t('tasksToday'))}</div>`;
    s.daily.tasks.forEach((tk, i) => { h += `<div class="mk-q ${tk.claimed ? 'done' : tk.done ? 'active' : ''}"><div class="ic">${tk.claimed ? '✅' : { collect: '📦', send: '🤖', crystals: '💎', help: '🤝', points: '⭐', jet: '🔥', visit: '🏺', home: '🏠' }[tk.id]}</div><div class="tx"><div class="tt">${esc(t('dt_' + tk.id))}</div><div class="c2-bar"><i style="width:${tk.prog / tk.need * 100}%"></i></div><div class="st">${Math.floor(tk.prog)}/${tk.need}</div></div><div class="rw">${tk.done && !tk.claimed ? `<button class="c2-btn go" data-act="task:${i}"><span>${esc(t('claim'))}</span><small>+${DAILY_PTS}⭐</small></button>` : `+${DAILY_PTS} ⭐`}</div></div>`; });
    h += `<div class="c2-stub">${esc(t('allBonus'))}: +${DAILY_ALL_ORE} 🪨 ${s.daily.bonus ? '✓' : ''}</div>`;
    list.innerHTML = h; }
  async function onClick(e) { const b = e.target.closest('[data-act]'); if (!b || b.disabled) return; const [a, x, y] = b.dataset.act.split(':');
    if (a === 'up') await startJob(x, 'upgrade'); else if (a === 'ex') await startJob(x, 'expedition', y); else if (a === 'dg') await startJob(x, 'dig', y); else if (a === 'en') await startJob(x, 'eng', y);
    else if (a === 'hire') await recruit(x); else if (a === 'login') await claimLogin(); else if (a === 'task') await claimTask(+x); }
  hud.$('#mk-sheet .list').addEventListener('click', onClick);
  // ---------- lifecycle ----------
  let tickT = 0, jetT = 0, visitT = 0, dayT = 0, lastDay = '';
  function begin(first) { const s = S(); if (s.on) return; s.on = true; s.storage = { cry: 24, ore: 30, t: now() }; econ.rollDay(); lastDay = store.today(); ensureCrew(); syncBase(); store.save();
    if (first) hud.popup({ icon: '🤖', head: t('chapter2'), title: t('ch2Intro'), note: t('ch2IntroSub') }, 4200); show(); }
  function show() { home.doorMesh.visible = FEAT.home && !!S().on; cb.style.display = S().on ? 'inline-block' : 'none'; tb.style.display = S().on ? '' : 'none'; }
  function boot() { show(); if (!S().on) return; ensureCrew(); econ.rollDay(); lastDay = store.today(); econ.tick(); flush(); syncBase(); booting = false;
    if (away.length) hud.popup({ icon: '🌙', head: t('awayHead'), title: away.slice(0, 3).join(' · '), note: away.slice(3, 6).join(' · ') }, 5200); away.length = 0;
    if (S().login.day !== store.today()) setTimeout(() => hud.toast('🎁 ' + t('dailyReady')), 1800); }
  function update(dt) { if (!S().on) return; tickT -= dt; if (tickT <= 0) { tickT = 0.5; const res = econ.tick(); flush(); checkQuest(); flush(); if (res.length) store.queueSave();
      const up = S().jobs.find(j => j.kind === 'upgrade'); if (up) base.set(S().level, up.what, econ.progress(up)); track('points', 0); const tk = S().daily.tasks.find(x => x.id === 'points' && !x.done); if (tk) { tk.prog = Math.min(tk.need, D().daily.earned); if (tk.prog >= tk.need) track('points', 0.0001); }
      cb.classList.toggle('ask', S().jobs.some(j => j.help === 'asked')); }
    dayT -= dt; if (dayT <= 0) { dayT = 5; if (store.today() !== lastDay) { lastDay = store.today(); econ.rollDay(); store.queueSave(); rerender(); } }
    if (ctrl.thrusting) { jetT += dt; if (jetT >= 1) { track('jet', 1); jetT -= 1; } }
    if (S().level >= 3 && dist2(me(), base.museumW) < 3.6 && regionOf(me()) === 'hub') { visitT += dt; if (visitT > 1) { visitT = -1e9; track('visit'); } }
    home.update(dt, camera.position, inside); if (inside && ctrl.camShift > 0 && entryAt && dist2(me(), entryAt) > 0.3) { ctrl.camShift = Math.max(0, ctrl.camShift - dt * 1.1); ctrl.camLift = Math.max(0, (ctrl.camLift || 0) - dt * 0.6); if (ctrl.camPitch < 0.05) ctrl.camPitch = Math.min(0.05, ctrl.camPitch + dt * 0.3); } /* entry framing (concept composition) eases back to a centred follow cam once the cat walks */ if (!inside) homeAction(); if (inside && !bunnyHint && dist2(me(), hw({ x: Math.sin(-0.5) * 3.75, z: -Math.cos(-0.5) * 3.75 })) < 1.4) { bunnyHint = true; hud.toast('🐰 ' + t('bunnyHouse')); }
    if (!inside) { const p = me(); if (dist2(p, homeDoor) > 3.2 && !homeBusy) home.setOpen(false); }
    updateCrew(dt); if (imp) for (const n of npcs) if (n && n.far && n.sp && n.sp.hp > 0) imp.push(n.rob.root.position, 'builder', n.yaw); if (imp && api_extraImp) api_extraImp(imp); if (imp) imp.end(); base.update(dt); base.cull && base.cull(camera.position); updateStorm(dt); shield.update(dt, ctx.time(), camera.position); if (isSheetOpen() && (tickT === 0.5)) rerender(); }
  const api = { econ, get on() { return S().on; }, quest: () => { const q = cur(); return q && { id: q.id, kind: q.kind }; }, crew: () => [...crew.values()].map(c => ({ id: c.r.id, type: c.r.type, state: c.state, x: c.pos.x, z: c.pos.z, visible: c.rob.root.visible, triHi: c.rob.triHi, triLo: c.rob.triLo, level: c.rob.level })),
    start: startJob, collect: doCollect, recruit, claimLogin, claimTask, helpResult: async (r) => { const j = S().jobs.find(j => j.help === 'asked'); if (!j) return false; helpJob = j; await helpResult(r); return true; },
    home: () => ({ inside, door: homeDoor, origin: { x: homeO.x, y: homeO.y, z: homeO.z }, doorIn: hw(home.doorIn), consoleIn: hw(home.consoleIn), outside: home.outside }), enterHome, exitHome, homeObj: home,
    storm: () => ({ state: shield.state, on: storm.on, night: shield.night, spots: storm.spots.map(s => ({ x: s.x, z: s.z, hp: s.hp, rid: s.rid })), console: consoleP, center: shieldC }), startStorm, shield, set extraImp(f) { api_extraImp = f; }, cut: CUT, cutCam, poseStorm() { storm.spots.forEach((sp, i) => { sp.hp = 1; if (!sp.rid) npcFor(sp, i); }); while (storm.on && storm.spots.length < 3) { const p = SPOTS[storm.spots.length]; const sp = { x: p.x, z: p.z, y: groundAt(p.x, p.z), hp: 1 }; storm.spots.push(sp); npcFor(sp, storm.spots.length - 1); } for (const c of crew.values()) if (c.storm) { const sp = c.storm; c.pos.set(sp.x + 0.85 * Math.sign((c.home.x - sp.x) || 1), groundAt(sp.x, sp.z), sp.z); c.rob.root.position.copy(c.pos); } }, // screenshot helper: robots already at their panels
    stepStorm(sec) { const t0 = ctx.time(); for (let k = 0, n = Math.ceil(sec / 0.05); k < n; k++) { updateStorm(0.05); updateCrew(0.05); if (imp) imp.end(); shield.update(0.05, t0 + k * 0.05, camera.position); } },
    base: () => ({ level: S().level, value: base.mesh.visible, pieces: base.pieces, museum: base.museumW, homes: HOMES, work: WORK, sites: { canyonSite, meteorSite, engSite } }), baseMesh: base, tick: () => { econ.tick(); flush(); checkQuest(); flush(); }, track };
  const mapCrew = () => [...crew.values()].map(c => { const j = econ.jobOf(c.r.id); return { x: c.pos.x, z: c.pos.z, type: c.r.type, prog: j ? econ.progress(j) : -1 }; });
  return { mapCrew, get inside() { return inside; }, begin, boot, update, action, actDown, actUp, target, trackHTML, renderChapter, renderCrew, renderDaily, track, api, get on() { return S().on; }, cur };
}
