// Chapter-2 budgets (main pass tris / draw calls) at the heaviest ch2 views.
// Each level is a fresh browser. Reusing one page made the phone L5 reseed time out
// at 150s after L1 and L3 had already filled the GPU. usage: node tools/ch2_stats.mjs desktop|phone|low
import { chromium } from 'playwright-core';
import { seed } from './ch2_seed.mjs';
import { pageUrl } from './baseurl.mjs';

const m = process.argv[2] || 'desktop';
const PH = m !== 'desktop';
const q = '&pr=1' + (m === 'low' ? '&q=low' : '');
const R8 = [['r1', 'builder'], ['r2', 'geologist'], ['r3', 'engineer'], ['r4', 'archaeologist'], ['r5', 'builder'], ['r6', 'geologist'], ['r7', 'engineer'], ['r8', 'archaeologist']].map(([id, type]) => ({ id, type, xp: 30 }));
const out = {};
const logs = [];
process.env.MK_BASE ||= pageUrl();

const launch = () => chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const open = async (b) => {
  const p = await b.newPage(PH ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : { viewport: { width: 1024, height: 576 } });
  p.on('pageerror', e => logs.push('PAGEERROR ' + e.message));
  p.on('console', x => { if (x.type() === 'error') logs.push(x.text()); });
  return p;
};
const st = async (p, l) => {
  await p.waitForTimeout(1200);
  const s = await p.evaluate((N) => { window.TOPN = N; return MK.stats(); }, +(process.env.TOPN || 8));
  out[l] = s.mainPass;
  console.log(m, l.padEnd(28), JSON.stringify(s.mainPass), JSON.stringify(s.top));
};
const views = async (p, tag) => {
  const d = await p.evaluate(() => MK.game.layout().depot);
  const yaw = d.yaw || 0, fx = Math.sin(yaw), fz = Math.cos(yaw);
  for (const [n, k, s] of [['front', 14, 0], ['side', 10, 14], ['far', 30, -8], ['back', -18, 6]]) {
    await p.evaluate(({ x, z, tx, tz }) => MK.game.teleport(x, z, Math.atan2(tx - x, tz - z)), { x: d.x + fx * k - fz * s, z: d.z + fz * k + fx * s, tx: d.x, tz: d.z });
    await st(p, tag + '-' + n);
  }
};

async function level(name, setup, hooks = {}) {
  const b = await launch();
  try {
    const p = await open(b);
    await seed(p, q, setup);
    if (hooks.before) await hooks.before(p);
    await views(p, name);
    if (hooks.after) await hooks.after(p);
  } finally { await b.close(); }
}

await level('L1-2robots', { done: ['c2_collect'], level: 1 });
await level('L3-4robots-building', { done: ['c2_collect', 'c2_home', 'c2_send', 'c2_upgrade', 'c2_help', 'c2_daily', 'c2_deliver'], level: 3, robots: R8.slice(0, 4), museum: ['ancient:tablet', 'ancient:idol', 'meteor:geode', 'station:helmet', 'station:badge'] }, { before: async (p) => { await p.evaluate(async () => { await MK.game.ch2.start('r1', 'upgrade'); }); } });
await level('L5-8robots', { done: ['c2_collect', 'c2_home', 'c2_send', 'c2_upgrade', 'c2_help', 'c2_daily', 'c2_deliver', 'c2_l3'], level: 5, robots: R8, museum: ['ancient:tablet', 'ancient:idol', 'ancient:glyph', 'ancient:mask', 'meteor:geode', 'meteor:iron', 'station:helmet', 'station:badge', 'station:logbook'] }, { after: async (p) => {
  const cr = await p.evaluate(() => MK.game.ch2.crew());
  const c0 = cr[0], c1 = cr[cr.length - 1];
  const mx = (c0.x + c1.x) / 2, mz = (c0.z + c1.z) / 2;
  await p.evaluate(({ x, z, tx, tz }) => MK.game.teleport(x, z, Math.atan2(tx - x, tz - z)), { x: mx + 5, z: mz + 3, tx: mx, tz: mz });
  await st(p, 'L5-among-crew');
  if (process.env.STORM !== '0') {
    const ok = await p.evaluate(async () => { const G = MK.game, st = G.ch2.storm(); const cp = st.console, c = st.center; const a = Math.atan2(c.x - cp.x, c.z - cp.z); G.teleport(cp.x - Math.sin(a) * 1.5, cp.z - Math.cos(a) * 1.5, a); G.ch2.startStorm(); G.ch2.stepStorm(9); if (G.ch2.poseStorm) G.ch2.poseStorm(); if (G.ch2.shield.pose) G.ch2.shield.pose(9); return G.ch2.storm().state; });
    console.log('storm state', ok); await st(p, 'storm-console');
    await p.evaluate(() => { const st = MK.game.ch2.storm(); MK.game.teleport(st.center.x + 50, st.center.z + 20, Math.atan2(-50, -20)); });
    await st(p, 'storm-wide');
  }
  if (process.env.HOME_V !== '0') {
    await p.evaluate(async () => { const G = MK.game; const H = G.ch2.home(); G.teleport(H.outside.x, H.outside.z); await G.ch2.enterHome(); });
    await st(p, 'home-interior');
    await p.evaluate(() => { MK.ctrl.yaw += Math.PI; });
    await st(p, 'home-interior-back');
  }
} });
console.log('MAX', m, JSON.stringify({ tris: Math.max(...Object.values(out).map(v => v.triangles)), calls: Math.max(...Object.values(out).map(v => v.calls)) }), 'LOGS', JSON.stringify(logs));
