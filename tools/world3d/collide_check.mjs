// Collision QA: the cat capsule must never intersect rock / cliff / prop / structure geometry.
// Samples: every quest marker + crystal pickup, every spawn/view position, the game_test teleports, every quest teleportToTarget,
// random teleports in each region, a reload with saved progress, and simulated walks (joystick input through the real controller) through
// hub Alpha, Landing Canyon, Reactor Crater, Launch Complex and Echo field. Ground truth is the actual triangles (not the solid map).
// usage: node tools/collide_check.mjs [phone|desktop|low] [--raw]   (server on :47321; --raw also reports the un-resolved points, i.e. the old behaviour)
import { chromium } from 'playwright-core';
const mode = process.argv[2] || 'phone'; const RAW = process.argv.includes('--raw');
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const ctx = await browser.newContext(mode === 'phone' ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage(); const logs = []; page.on('pageerror', e => logs.push('PAGEERROR ' + e.message)); page.on('console', m => { if (m.type() === 'error') logs.push(m.text()); });
const q = mode === 'low' ? '&q=low' : '';
const boot = async (extra) => { await page.goto((process.env.MK_BASE || 'http://localhost:' + (process.env.MKPORT || 47321) + '/index.html') + '?view=play&fast=1' + q + extra); await page.waitForFunction(() => window.MK && MK.ready && MK.game && MK.game.ready, null, { timeout: 180000 }); };
await boot('&reset=1');
// ground-truth checker (re-installed after every page load)
const INSTALL = async () => { window.__terrain = await import('./src/terrain.js');
  const THREE = MK.THREE; const R = 0.33, YS = [0.43, 0.545, 0.66, 0.775, 0.89, 1.005, 1.12]; // capsule: r 0.33, y +0.10 .. +1.45 above the feet
  const tris = []; const H = new Map(); const HC = 4; const hk = (i, j) => i * 100003 + j;
  const addTri = (A, B, C, tag) => { const id = tris.length; tris.push([A, B, C, tag]); const i0 = Math.floor(Math.min(A[0], B[0], C[0]) / HC), i1 = Math.floor(Math.max(A[0], B[0], C[0]) / HC), j0 = Math.floor(Math.min(A[2], B[2], C[2]) / HC), j1 = Math.floor(Math.max(A[2], B[2], C[2]) / HC);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const k = hk(i, j); let l = H.get(k); if (!l) H.set(k, l = []); l.push(id); } };
  const fromGeo = (g, M, tag) => { const P = g.attributes.position.array, I = g.index ? g.index.array : null, n = I ? I.length : P.length / 3; const e = M.elements; const w = (i) => { i *= 3; const x = P[i], y = P[i + 1], z = P[i + 2]; return [e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]]; };
    for (let k = 0; k < n; k += 3) addTri(w(I ? I[k] : k), w(I ? I[k + 1] : k + 1), w(I ? I[k + 2] : k + 2), tag); };
  const rockInst = []; const m4 = new THREE.Matrix4();
  for (const [name, kind] of Object.entries(MK.rocks.kinds)) { const geos = kind.lods.map(l => l.mesh.geometry); kind.items.forEach((it, idx) => { m4.fromArray(it.m); const use = name === 'strata' ? [geos[0], geos[1]] : name === 'wall' ? [it.lodK >= 100 ? geos[1] : geos[0]] : [geos[0]]; const id0 = tris.length; for (const g of use) fromGeo(g, m4, name + '#' + idx); rockInst.push({ name, idx, x: it.x, z: it.z, r: it.r, a: id0, b: tris.length }); }); }
  MK.scene.traverse(o => { if (!o.isMesh || !o.geometry) return; if (o.isInstancedMesh) { if (/^crystals(_canyon|_echo)?$/.test(o.name)) for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m4); fromGeo(o.geometry, m4, o.name + '#' + i); } return; }
    if (/^merged_(hull|lattice)/.test(o.name) && !/_(reactorFar|beams)$/.test(o.name)) { o.updateMatrixWorld(true); fromGeo(o.geometry, o.matrixWorld, o.name); } });
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cp = (p, a, b, c) => { const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a); const d1 = dot(ab, ap), d2 = dot(ac, ap); if (d1 <= 0 && d2 <= 0) return a; const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp); if (d3 >= 0 && d4 <= d3) return b;
    const vc = d1 * d4 - d3 * d2; if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); return [a[0] + ab[0] * v, a[1] + ab[1] * v, a[2] + ab[2] * v]; } const cpp = sub(p, c), d5 = dot(ab, cpp), d6 = dot(ac, cpp); if (d6 >= 0 && d5 <= d6) return c;
    const vb = d5 * d2 - d1 * d6; if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); return [a[0] + ac[0] * w, a[1] + ac[1] * w, a[2] + ac[2] * w]; } const va = d3 * d6 - d5 * d4; if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); return [b[0] + (c[0] - b[0]) * w, b[1] + (c[1] - b[1]) * w, b[2] + (c[2] - b[2]) * w]; }
    const den = 1 / (va + vb + vc), v = vb * den, w = vc * den; return [a[0] + ab[0] * v + ac[0] * w, a[1] + ab[1] * v + ac[1] * w, a[2] + ab[2] * v + ac[2] * w]; };
  const near = (x, z, r) => { const s = new Set(); for (let i = Math.floor((x - r) / HC); i <= Math.floor((x + r) / HC); i++) for (let j = Math.floor((z - r) / HC); j <= Math.floor((z + r) / HC); j++) { const l = H.get(hk(i, j)); if (l) for (const id of l) s.add(id); } return s; };
  // vertical ray parity (+y) against one rock instance's triangles: odd = point inside the closed rock
  const upHits = (x, y, z, a, b, below) => { let n = 0; for (let k = a; k < b; k++) { const [A, B, C] = tris[k]; const det = (B[2] - C[2]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[2] - C[2]); if (Math.abs(det) < 1e-12) continue;
    const l1 = ((B[2] - C[2]) * (x - C[0]) + (C[0] - B[0]) * (z - C[2])) / det, l2 = ((C[2] - A[2]) * (x - C[0]) + (A[0] - C[0]) * (z - C[2])) / det, l3 = 1 - l1 - l2; if (l1 < 0 || l2 < 0 || l3 < 0) continue; const hy = l1 * A[1] + l2 * B[1] + l3 * C[1]; if (below ? hy < y : hy > y) n++; } return n; };
  window.__cc = { ntris: tris.length,
    test(x, y, z, roof = false) { const hits = []; for (const id of near(x, z, R + 0.1)) { const [A, B, C, tag] = tris[id]; for (const yy of YS) { const p = [x, y + yy, z]; const q = cp(p, A, B, C); const d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); if (d < R) { hits.push(tag + '@' + yy.toFixed(2) + ' d=' + d.toFixed(2)); break; } } if (hits.length > 3) break; }
      for (const ri of rockInst) { if (Math.abs(ri.x - x) > ri.r + 1 || Math.abs(ri.z - z) > ri.r + 1) continue; for (const yy of [0.12, 0.8]) if (upHits(x, y + yy, z, ri.a, ri.b, false) % 2 === 1) { hits.push('INSIDE ' + ri.name + '#' + ri.idx + '@' + yy); break; } }
      let roofed = null; if (roof) for (const id of near(x, z, 0.2)) { const [A, B, C, tag] = tris[id]; if (/^(rockA|debris|scatter|strata|wall)/.test(tag)) continue; const det = (B[2] - C[2]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[2] - C[2]); if (Math.abs(det) < 1e-12) continue;
        const l1 = ((B[2] - C[2]) * (x - C[0]) + (C[0] - B[0]) * (z - C[2])) / det, l2 = ((C[2] - A[2]) * (x - C[0]) + (A[0] - C[0]) * (z - C[2])) / det, l3 = 1 - l1 - l2; if (l1 < 0 || l2 < 0 || l3 < 0) continue; const hy = l1 * A[1] + l2 * B[1] + l3 * C[1]; if (hy > y + 1.45 && hy < y + 8) { roofed = tag + ' +' + (hy - y).toFixed(1); break; } }
      if (roofed) hits.push('ROOF ' + roofed); return hits; },
    cat() { const p = MK.ctrl.pos; return [p.x, p.y, p.z]; },
  };
};
await page.evaluate(INSTALL);
const results = []; const fails = []; let nChecks = 0;
const ck = async (label, kind, roof = true) => { const r = await page.evaluate((roof) => { const [x, y, z] = __cc.cat(); return { x, y, z, h: __cc.test(x, y, z, roof), moved: MK.ctrl.lastPlaceMove }; }, roof); nChecks++; if (r.h.length) fails.push({ label, kind, pos: [r.x, r.y, r.z].map(v => +v.toFixed(2)), hits: r.h.slice(0, 3) }); return r; };
const raw = []; const rawck = async (label, x, z) => { if (!RAW) return; const r = await page.evaluate(({ x, z }) => { const { groundAt } = window.__terrain; const y = groundAt(x, z); return __cc.test(x, y, z, false); }, { x, z }); raw.push({ label, bad: r.length > 0, hits: r.slice(0, 2) }); };
const info = await page.evaluate(() => ({ tris: __cc.ntris, solids: MK.solids.info, colliders: MK.colliders.length }));
console.log('ground-truth tris', info.tris, 'solid map', JSON.stringify(info.solids));
const TP = (x, z, yaw) => page.evaluate(({ x, z, yaw }) => MK.game.teleport(x, z, yaw), { x, z, yaw });
// 1) spawn / view positions
const views = await page.evaluate(() => MK.VIEWS);
for (const v of views) { await page.evaluate((v) => MK.setView(v), v); await ck('view:' + v, 'spawn'); }
await page.evaluate(() => MK.setView('play'));
// 2) quest markers + crystal pickups (resolved positions; marker = where the beacon stands and where teleportToTarget lands)
const places = await page.evaluate(() => window.__gamePlaces);
for (const [k, p] of Object.entries(places)) { await TP(p.x, p.z); await ck('marker:' + k, 'marker'); }
const spots = await page.evaluate(() => MK.game.crystals().spots);
for (let i = 0; i < spots.length; i++) { await page.evaluate(() => MK.game.shiftDay(0)); await TP(spots[i].x, spots[i].z); await ck('crystal#' + i, 'marker'); }
await boot('&reset=1'); await page.evaluate(INSTALL);
// 3) the game_test teleports (canyon marker shot / edge arrow / hub marker shot) + teleportToTarget through the whole chapter
const tgt = () => page.evaluate(() => MK.game.target());
{ const t = await tgt(); const x = t.x - 14.3, z = t.z + 37.4; await rawck('game_test canyon marker', x, z); await TP(x, z, Math.atan2(t.x - x, t.z - z)); await ck('tp:canyon_marker_shot', 'teleport'); }
// Chapter-1 activity spots: gates, ore, antenna parts, sprint rings/start, secret caches, depot/robot (teleport + check)
{ const L = await page.evaluate(() => MK.game.layout()); const pts = [...Object.entries(L.gates).map(([k, g]) => ['gate:' + k, g, false]), ...L.ore.map((o, i) => ['ore#' + i, { x: o.x + 1.6, z: o.z }, false]), ...L.power.map((o, i) => ['power#' + i, { x: o.x + 1.6, z: o.z }, false]), ...L.parts.map((o, i) => ['part#' + i, o, true]), ...L.rings.map((o, i) => ['ring#' + i, o, true]), ['sprintStart', L.sprintStart, false], ...L.secrets.map(o => ['secret:' + o.id, o, true]), ['robotWeld', L.weldSpot, false]];
  for (const [n, p, raw] of pts) { await page.evaluate(({ x, z, raw }) => MK.game.teleport(x, z, 0, raw), { ...p, raw }); await ck('tp:' + n, 'teleport'); } }
for (let qi = 0; qi < 9; qi++) { const q = await page.evaluate(() => { const q = MK.game.quest(); return q && q.id; }); if (!q) break;
  await page.evaluate(() => MK.game.teleportToTarget()); await ck('tp:quest_' + q + '_target', 'teleport');
  await page.evaluate(() => MK.game.auto()); await ck('auto:' + q, 'teleport');
  await page.evaluate(() => document.querySelector('#mk-pop')?.classList.remove('on')); }
const chap = await page.evaluate(() => MK.game.state().ch1.done.length); results.push(['chapter completes with resolved markers (auto activities)', chap === 9, 'done ' + chap]);
// 4) saved progress reload (mkty_world_v1) -> spawn
await page.evaluate(() => MK.game.save()); await boot(''); await page.evaluate(INSTALL); await ck('spawn after reload (saved progress)', 'spawn');
results.push(['saved progress loaded', (await page.evaluate(() => MK.game.state().ch1.done.length)) === 9, '']);
// 5) random teleports in every region (stress: arbitrary teleport targets must resolve to a free spot)
const REG = await page.evaluate(async () => { const T = await import('./src/terrain.js'); const s0 = T.canyonS(T.REGIONS.canyon.x, T.REGIONS.canyon.z); const c = T.canyonPoint(s0 - 18, 0); return { hub: { x: 0, z: 0, r: 70 }, canyon: { x: c.x, z: c.z, r: 60, canyon: s0 }, reactor: { ...T.REGIONS.reactor, r: 110 }, launch: { ...T.REGIONS.launch, r: 120 }, echo: { ...T.REGIONS.echo, r: 100 } }; });
const N_TP = +(process.env.NTP || 50);
for (const [name, R] of Object.entries(REG)) { let s = 12345 + name.length * 77; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < N_TP; i++) { let x, z; if (R.canyon) { const p = await page.evaluate(({ s, o }) => import('./src/terrain.js').then(T => T.canyonPoint(s, o)), { s: R.canyon - 18 + (rnd() - 0.5) * 220, o: (rnd() - 0.5) * 40 }); x = p.x; z = p.z; } else { const a = rnd() * 6.283, d = Math.sqrt(rnd()) * R.r; x = R.x + Math.cos(a) * d; z = R.z + Math.sin(a) * d; }
    await rawck('random tp ' + name, x, z); await TP(x, z, rnd() * 6.28); await ck('tp:random:' + name + '#' + i, 'teleport'); } }
// 6) walks: joystick input through the real controller (substeps at 30 Hz), capsule checked every step; blocked = stuck for 1.5 s -> teleport on to the next waypoint
const walkStats = {};
const walk = async (name, pts) => { const r = await page.evaluate(({ pts }) => { const c = MK.ctrl; const out = { steps: 0, hits: [], stuck: 0, dist: 0, climbs: 0, maxRise: 0 }; c.camFree = false; c.speedMul = 1;
  c.place(pts[0].x, pts[0].z, 0); for (let w = 1; w < pts.length; w++) { const P = pts[w]; let last = c.pos.clone(), still = 0;
    for (let k = 0; k < 4000; k++) { const dx = P.x - c.pos.x, dz = P.z - c.pos.z; if (Math.hypot(dx, dz) < 1.2) break; c.camYaw = Math.atan2(-dx, -dz); c.joy.set(0, 1); const y0 = c.pos.y; c.update(1 / 30); out.steps++;
      const rise = c.pos.y - y0; if (c.onGround && rise > out.maxRise) out.maxRise = rise;
      const h = __cc.test(c.pos.x, c.pos.y, c.pos.z, false); if (h.length && out.hits.length < 6) out.hits.push({ p: c.pos.toArray().map(v => +v.toFixed(2)), h: h.slice(0, 2) });
      out.dist += Math.hypot(c.pos.x - last.x, c.pos.z - last.z); if (Math.hypot(c.pos.x - last.x, c.pos.z - last.z) < 0.02) still++; else still = 0; last.copy(c.pos);
      if (still > 45) { out.stuck++; c.place(P.x, P.z, c.yaw); break; } } }
  c.joy.set(0, 0); c.camFree = true; return out; }, { pts }); walkStats[name] = { steps: r.steps, dist: Math.round(r.dist), blockedStops: r.stuck, hits: r.hits.length }; nChecks += r.steps; for (const h of r.hits) fails.push({ label: 'walk:' + name, kind: 'walk', pos: h.p, hits: h.h }); };
const ring = (R, rad, n, a0 = 0) => Array.from({ length: n + 1 }, (_, i) => ({ x: R.x + Math.cos(a0 + i / n * 6.283) * rad, z: R.z + Math.sin(a0 + i / n * 6.283) * rad }));
const cross = (R, rad) => [{ x: R.x - rad, z: R.z }, { x: R.x + rad, z: R.z }, { x: R.x, z: R.z - rad }, { x: R.x, z: R.z + rad }];
const canyonLine = await page.evaluate(({ s0 }) => import('./src/terrain.js').then(T => [[-120, 0], [-60, 8], [0, -6], [60, 4], [120, 0], [60, -10], [-120, 10]].map(([d, o]) => T.canyonPoint(s0 + d, o))), { s0: REG.canyon.canyon - 18 });
await walk('hub Alpha', [...ring({ x: 0, z: 0 }, 30, 12), ...ring({ x: 0, z: 0 }, 55, 16), ...cross({ x: 0, z: 0 }, 60)]);
await walk('Landing Canyon', canyonLine);
await walk('Reactor Crater', [...ring(REG.reactor, 40, 12), ...ring(REG.reactor, 75, 14), ...cross(REG.reactor, 90)]);
await walk('Launch Complex', [...ring(REG.launch, 40, 12), ...ring(REG.launch, 80, 14), ...cross(REG.launch, 100)]);
await walk('Echo field', [...ring(REG.echo, 35, 12), ...ring(REG.echo, 70, 14), ...cross(REG.echo, 90)]);
// boulder interaction: walk straight into the big canyon boulder from the bug report -> must be blocked (or step on top), never inside
const boulder = await page.evaluate(() => { const t = window.__gamePlaces.canyonPad; const x = t.x - 14.3, z = t.z + 37.4; let best = null; for (const [name, k] of Object.entries(MK.rocks.kinds)) for (const it of k.items) { const d = Math.hypot(it.x - x, it.z - z); if (d < it.r + 1 && (!best || it.r > best.r)) best = { name, x: it.x, y: it.y, z: it.z, r: it.r }; } return best; });
if (boulder) await walk('into canyon boulder', [{ x: boulder.x - boulder.r - 6, z: boulder.z }, { x: boulder.x, z: boulder.z }, { x: boulder.x + boulder.r + 6, z: boulder.z }]);
// 7) obstacles: walk straight into / obliquely along, and jetpack into, every obstacle class -> stop, slide or climb, never pass through
const OBST = await page.evaluate(() => { const T = window.__terrain, sd = T.sd, E = T.REGIONS.echo, L = T.REGIONS.launch, Rc = T.REGIONS.reactor; const o = [];
  const big = (pred) => { let b = null; for (const [n, k] of Object.entries(MK.rocks.kinds)) if (n === 'rockA' || n === 'wall') for (const it of k.items) if (pred(n, it) && (!b || it.r > b.r)) b = { x: it.x, z: it.z, r: it.r }; return b; };
  const cb = (() => { const t = window.__gamePlaces.canyonPad; const x = t.x - 14.3, z = t.z + 37.4; let b = null; MK.rocks.kinds.rockA.items.forEach(it => { if (Math.hypot(it.x - x, it.z - z) > it.r + 1) return; const h = MK.solids.top(it.x, it.z, 0.5) - T.groundAt(it.x, it.z); if (!b || h > b.h) b = { x: it.x, z: it.z, r: it.r, h }; }); if (!b || b.h < 1) MK.rocks.kinds.rockA.items.forEach(it => { if (Math.hypot(it.x - x, it.z - z) > 25 || it.r > 8) return; const h = MK.solids.top(it.x, it.z, 0.5) - T.groundAt(it.x, it.z); if (!b || h > b.h) b = { x: it.x, z: it.z, r: it.r, h }; }); return b; })(); /* lighter presets place fewer rocks: fall back to the tallest boulder nearby */ // the boulder the cat was buried in (tallest rock at the old teleport spot)
  o.push(['canyon boulder (bug report)', cb.x, cz(cb), 'rock'], ['crater massif wall (cliff)', ...(w => [w.x, w.z])(big((n, it) => n === 'wall' && Math.hypot(it.x, it.z) < 150 && it.r < 40)), 'wall'],
    ['hub reactor drum (building wall)', ...xz(sd(0, 0)), 'wall'], ['hub dome Bk (building)', ...xz(sd(-3.5, 25)), 'building'], ['echo hab block (building)', E.x + 46, E.z + 10, 'building', -Math.PI / 2 /* square onto its 12 m long face, through the rock-free yard */],
    ['echo rover', E.x + 22, E.z - 47, 'prop'], ['hub rover', ...xz(sd(-30, 2)), 'prop'], ['launch rocket', L.x, L.z, 'building'], ['echo pylon', E.x + 24, E.z, 'prop'],
    ['hub crate', ...xz(sd(4, -18)), 'prop'], ['hub lamp post', ...xz(sd(-1, -14)), 'prop'], ['reactor crater complex', Rc.x, Rc.z, 'building']);
  function xz(p) { return [p.x, p.z]; } function cz(b) { return b.z; } return o; });
const obst = {};
const slideBest = {};
for (const [name, cx, cz, cls, appr] of OBST) for (const [kind, off, jet] of [['head-on', 0, false], ['bump+slide (turn +50°)', 0.87, false], ['bump+slide (turn -50°)', -0.87, false], ['jetpack', 0, true]]) {
  const r = await page.evaluate(({ cx, cz, off, jet, appr }) => { const c = MK.ctrl; c.camFree = false; c.speedMul = 1; const out = { hits: [], bump: false, slide: 0, steps: 0, through: false, maxY: 0, topped: false };
    // start 14 m out on the side with the lowest terrain, aim at the centre (rotated by off), move for 7 s (jet: holding JET)
    let best = null; for (let R = 14; R <= 62 && !best; R += 6) for (let i = 0; i < 16; i++) { const a = appr != null ? appr : i / 16 * 6.283; const x = cx + Math.cos(a) * R, z = cz + Math.sin(a) * R; const g = window.__terrain.groundAt(x, z); if (MK.solids.isFree(x, z) && (!best || g < best.g)) best = { x, z, a, g }; }
    if (!best) return { skip: true }; c.place(best.x, best.z, 0); const dir0 = Math.atan2(cz - c.pos.z, cx - c.pos.x); const aim = (a) => { c.camYaw = Math.atan2(-Math.cos(a), -Math.sin(a)); }; aim(dir0);
    let bumpAt = null, turned = false, contact = 0;
    const NS = Math.round(Math.hypot(c.pos.x - cx, c.pos.z - cz) / 5 * 30) + 90; for (let k = 0; k < NS; k++) { c.joy.set(0, 1); c.jumpHeld = jet && k > 2; c.update(1 / 30); out.steps++; if (c.bumped && !bumpAt) { out.bump = true; bumpAt = c.pos.clone(); if (off) { aim(dir0 + off); turned = k; } }
      if (bumpAt && (!off || k - turned < 90)) { if (c.bumped) contact++; out.slide = Math.max(out.slide, Math.hypot(c.pos.x - bumpAt.x, c.pos.z - bumpAt.z)); } out.maxY = Math.max(out.maxY, c.pos.y - window.__terrain.groundAt(c.pos.x, c.pos.z)); if (c.onGround && MK.solids.top(c.pos.x, c.pos.z, 0.36) > window.__terrain.groundAt(c.pos.x, c.pos.z) + 0.5) out.climbed = Math.max(out.climbed || 0, c.pos.y - window.__terrain.groundAt(c.pos.x, c.pos.z));
      const h = __cc.test(c.pos.x, c.pos.y, c.pos.z, false); if (h.length && out.hits.length < 4) out.hits.push({ p: c.pos.toArray().map(v => +v.toFixed(2)), h: h.slice(0, 2) }); }
    c.jumpHeld = false; c.joy.set(0, 0); c.camFree = true; out.topped = MK.solids.top(c.pos.x, c.pos.z, 0.36) > window.__terrain.groundAt(c.pos.x, c.pos.z) + 0.5 && c.onGround; out.contact = contact; out.end = c.pos.toArray().map(v => +v.toFixed(1)); return out; }, { cx, cz, off, jet, appr: appr ?? null });
  if (r.skip) { obst[name + ' / ' + kind] = 'skip (no free start)'; continue; } nChecks += r.steps;
  obst[name + ' / ' + kind] = `${r.hits.length ? 'HIT' : 'ok'} bump=${r.bump} slide=${r.slide.toFixed(1)}m${off ? ' contactFrames=' + r.contact : ''}${r.climbed ? ' (climbed onto it, ' + r.climbed.toFixed(1) + ' m up)' : ''}${jet ? ' maxAlt=' + r.maxY.toFixed(1) + 'm' : ''}`;
  for (const h of r.hits) fails.push({ label: 'obstacle:' + name + '/' + kind, kind: 'obstacle', pos: h.p, hits: h.h });
  if (!jet && kind === 'head-on') results.push(['stops against or climbs ' + name + ' (' + cls + ')', r.bump || !!r.climbed, r.bump ? 'blocked' : r.climbed ? 'climbed ' + r.climbed.toFixed(1) + ' m' : 'neither: end ' + JSON.stringify(r.end)]);
  if (off) { const sc = (x) => (x.slide > 1.5 ? 1000 : 0) + Math.min(x.contact, 60); const b = slideBest[name]; if (!b || sc(r) > sc(b)) slideBest[name] = { ...r, kind }; } }
for (const name of ['crater massif wall (cliff)', 'hub reactor drum (building wall)', 'echo hab block (building)', 'hub dome Bk (building)']) { const r = slideBest[name]; if (r) results.push(['bumps into, then slides along ' + name, r.bump && r.slide > 1.5 && r.contact > 5, r.kind + ': slid ' + r.slide.toFixed(1) + ' m in 3 s, ' + r.contact + ' frames in contact']); }
console.log('OBSTACLES'); for (const [k, v] of Object.entries(obst)) console.log('  ' + k + ': ' + v);
// 8) budgets sanity (stats of the current view)
results.push(['solid map built', info.solids.tris > 0, JSON.stringify(info.solids)]);
const errs = logs.filter(l => !/GPU stall|swiftshader|WebGL: INVALID_ENUM|Automatic fallback/i.test(l));
results.push(['no console errors', errs.length === 0, JSON.stringify(errs.slice(0, 3))]);
results.push(['capsule never intersects geometry (' + nChecks + ' samples)', fails.length === 0, fails.length + ' failures']);
console.log('WALKS', JSON.stringify(walkStats, null, 0));
if (RAW) { const bad = raw.filter(r => r.bad); console.log('RAW (old behaviour, unresolved teleport points):', bad.length + '/' + raw.length, 'inside geometry', JSON.stringify(bad.slice(0, 4))); }
for (const f of fails.slice(0, 25)) console.log('FAIL', JSON.stringify(f));
for (const [n, p, i] of results) console.log((p ? 'PASS ' : 'FAIL ') + n + (i ? '  ' + i : ''));
console.log('SUMMARY', mode, results.filter(r => r[1]).length + '/' + results.length, 'samples', nChecks, 'failures', fails.length);
await browser.close(); process.exit(results.every(r => r[1]) ? 0 : 1);
