// World-space continuity: crew worksites, steam vents and sky homes stay put
// while the cat approaches, orbits, walks away, returns, and crosses regions.
// Animated offsets (a jelly bob, a ship along its route) are not the anchors.
import { chromium } from 'playwright-core';
import { seed } from './ch2_seed.mjs';

const b = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
p.on('pageerror', e => errs.push('ERR ' + e.message));
p.on('console', m => { if (m.type() === 'error') errs.push('C ' + m.text().slice(0, 240)); });
await seed(p, '&shot=1&game=1&pr=1', { done: ['c2_collect', 'c2_send'], level: 2, robots: [{ id: 'r1', type: 'builder', xp: 0 }] });
await p.evaluate(async () => {
  const G = MK.game;
  for (let i = 0; i < 50 && !G.life(); i++) await new Promise(r => setTimeout(r, 100));
});

const read = () => p.evaluate(() => {
  const L = MK.game.life();
  const a = L.anchors();
  const crew = (L.meshes.zones || []).map(r => ({ x: +r.position.x.toFixed(2), z: +r.position.z.toFixed(2), vis: r.visible }));
  return { a, crew };
});

const same = (a, b, eps = 0.05) => {
  const bad = [];
  const chk = (path, x, y) => { if (Math.abs(x - y) > eps) bad.push(path + ' ' + x + ' -> ' + y); };
  a.a.crew.forEach((c, i) => { chk('crew' + i + '.x', c.x, b.a.crew[i].x); chk('crew' + i + '.z', c.z, b.a.crew[i].z); chk('mesh' + i + '.x', a.crew[i].x, b.crew[i].x); chk('mesh' + i + '.z', a.crew[i].z, b.crew[i].z); });
  a.a.vents.forEach((v, i) => { chk('vent' + i + '.x', v.x, b.a.vents[i].x); chk('vent' + i + '.z', v.z, b.a.vents[i].z); });
  a.a.sky.forEach((s, i) => { chk('sky' + i + '.x', s.x, b.a.sky[i].x); chk('sky' + i + '.z', s.z, b.a.sky[i].z); chk('sky' + i + '.y', s.y, b.a.sky[i].y); });
  return bad;
};

const move = (x, z, yaw) => p.evaluate(({ x, z, yaw }) => {
  MK.ctrl.place(x, z, yaw);
  MK.ctrl.camFree = true; MK.ctrl.camPitch = 0; MK.ctrl.camDist = 5.2; MK.ctrl.camLift = 1.6; MK.ctrl.camYaw = yaw;
  MK.ctrl.updateCamera(1);
  MK.step(1 / 30, 8);
}, { x, z, yaw });

const base = await read();
if (!base.a || base.a.crew.length !== 8 || base.a.vents.length < 4 || base.a.sky.length !== 4) {
  console.log('FAIL anchors missing', JSON.stringify(base && base.a));
  await b.close();
  process.exit(1);
}
let fail = 0;
const check = async (label) => {
  const now = await read();
  const bad = same(base, now);
  if (bad.length) { fail++; console.log('FAIL ' + label, bad.join('; ')); }
  else console.log('PASS ' + label);
};

// orbit and walk at the hub, then each worksite, then back
await move(-14.8, 15.2, 0.4); await check('hub stand');
for (const yaw of [0, 1.6, 3.1, 4.7]) { await move(-14.8, 15.2, yaw); await check('hub orbit ' + yaw.toFixed(1)); }
await move(40, -30, 1); await check('walk away');
await move(-14.8, 15.2, 0.4); await check('return');

for (const c of base.a.crew) {
  await move(c.x - 40, c.z - 30, 0.5); await check('approach ' + c.x.toFixed(0));
  await move(c.x - 6, c.z - 4, Math.atan2(6, 4)); await check('stand ' + c.x.toFixed(0));
  await move(c.x + 8, c.z - 2, 2.2); await check('orbit ' + c.x.toFixed(0));
  await move(c.x - 50, c.z + 40, 0); await check('leave ' + c.x.toFixed(0));
}
await move(-14.8, 15.2, 0.4); await check('home again');
// dt keeps running: anchors must still match after more time
await p.evaluate(() => MK.step(1 / 30, 90));
await check('after time');
const pageErrs = errs.filter(e => e.startsWith('ERR '));
console.log('CONSOLE', errs.length ? errs.slice(0, 8).join(' | ') : 'none');
console.log(fail ? 'FAIL ' + fail : 'PASS world anchors');
await b.close();
process.exit(fail || pageErrs.length ? 1 : 0);
