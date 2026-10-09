/* Real index.html, native CSSAnimation and ResizeObserver. No clock mocking, controller replacement,
   synthetic completion events, or animation-duration overrides. Run only where Chromium/local
   sockets are permitted. Automatically discovered by tests/run-all.cjs. */
function main() {
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const os = require('node:os');
const root = path.resolve(__dirname, '..');
const out = process.env.MKTY_TEST_OUTPUT || fs.mkdtempSync(path.join(os.tmpdir(), 'mkty-life1-geometry-'));
const types = {'.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.mp4': 'video/mp4'};
// Serve only the checked-out game's static assets. No backend, tests, dotfiles or symlink escape.
const server = http.createServer((req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://local').pathname); } catch { res.writeHead(400); return res.end(); }
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return res.end(); }
  if (pathname === '/') pathname = '/index.html';
  if (!/^\/(?:[^/]+|(?:art|locales\/runtime)\/[^/]+)$/.test(pathname) || pathname.split('/').some(part => part.startsWith('.'))) {
    res.writeHead(403); return res.end();
  }
  const file = path.resolve(root, '.' + pathname), type = types[path.extname(file)];
  if (!type || !file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
  // Video playback is unrelated to this controller; do not load large cinematic assets.
  if (path.extname(file) === '.mp4') { res.writeHead(204); return res.end(); }
  fs.realpath(file, (error, real) => {
    if (error || !real.startsWith(root + path.sep)) { res.writeHead(error ? 404 : 403); return res.end(); }
    fs.readFile(real, (readError, body) => {
      res.writeHead(readError ? 404 : 200, {'Content-Type': type, 'Cache-Control': 'no-store'});
      res.end(readError || req.method === 'HEAD' ? '' : body);
    });
  });
});
let browser, page;
const errors = [], report = {cases: [], nativeEvents: []};
const deadline = setTimeout(() => { console.error('Chapter 1 native geometry test exceeded 60s'); process.exit(1); }, 60000);
deadline.unref();
function check(snapshot, label) {
  assert(snapshot.active, label + ': chapter remains active');
  assert(snapshot.world.width > 0 && snapshot.world.height > 0, label + ': visible world');
  for (const key of ['width', 'height']) assert(Math.abs(snapshot.cache[key] - snapshot.world[key]) < 1e-6,
    `${label}: stale ${key}: cache=${snapshot.cache[key]}, actual=${snapshot.world[key]}`);
  assert.equal(snapshot.cache.obstacles.length, snapshot.physical.length, label + ': obstacle count');
  assert.equal(snapshot.physical.length, 3, label + ': actual three-obstacle scene');
  for (const [i, rect] of snapshot.physical.entries()) for (const key of ['left', 'right', 'top', 'bottom'])
    assert(Math.abs(snapshot.cache.obstacles[i][key] - rect[key]) < 1e-7, `${label}: obstacle ${i} ${key}`);
  assert(snapshot.probes.length >= 36, label + ': all boundary probes are present');
  for (const p of snapshot.probes) assert.equal(p.actual, p.expected, `${label}: obstacle ${p.obstacle} ${p.edge} at ${p.x},${p.y}`);
  assert.equal(snapshot.playerBlocked, false, label + ': player is walkable');
  report.cases.push({label, width: snapshot.world.width, height: snapshot.world.height, boundaryProbes: snapshot.probes.length});
}
async function frames() { await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); }
async function home() {
  await page.evaluate(() => { show('home'); document.getElementById('mission1').style.removeProperty('animation'); });
  await frames();
}
async function enter(waitForStart = true) {
  return page.evaluate(wait => {
    const test = window.geometryLifecycle, mission = document.getElementById('mission1');
    test.events.length = 0; test.cancelMarker = null;
    if (!wait) { openMission(); return test.snapshot(); }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { mission.removeEventListener('animationstart', started); reject(Error('native screenEnter did not start')); }, 3000);
      function started(event) {
        if (event.target !== mission || event.animationName !== 'screenEnter') return;
        clearTimeout(timer); mission.removeEventListener('animationstart', started); resolve(test.snapshot());
      }
      mission.addEventListener('animationstart', started); openMission();
    });
  }, waitForStart);
}
async function event(type) {
  await page.waitForFunction(type => window.geometryLifecycle.events.some(e => e.type === type), type);
  const value = await page.evaluate(type => window.geometryLifecycle.events.find(e => e.type === type), type);
  assert(value.trusted, type + ' is browser-generated, not synthetic');
  assert.equal(value.name, 'screenEnter');
  report.nativeEvents.push({type: value.type, trusted: value.trusted, active: value.snapshot.active});
  return value;
}
function running(snapshot, label) {
  assert.equal(snapshot.animation?.kind, 'CSSAnimation', label + ': real CSS animation');
  assert.equal(snapshot.animation.name, 'screenEnter');
  assert.equal(snapshot.animation.duration, 420, label + ': unchanged production duration');
  assert.equal(snapshot.animation.rate, 1, label + ': native playback speed');
  assert(snapshot.animation.time >= 0 && snapshot.animation.time < 420, label + ': entrance still running');
  assert.notEqual(snapshot.transform, 'none', label + ': actual entrance transform is present');
}
return (async () => {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const origin = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({headless: true, executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox']});
  page = await browser.newPage({viewport: {width: 390, height: 844}, reducedMotion: 'no-preference', serviceWorkers: 'block'});
  page.setDefaultTimeout(5000); page.setDefaultNavigationTimeout(15000);
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === origin) return route.continue();
    if (url.href === 'https://telegram.org/js/telegram-web-app.js') return route.fulfill({status: 200, contentType: 'application/javascript', body: ''});
    return route.abort();
  });
  await page.addInitScript(require('./story-finale-fixture.cjs'));
  await page.addInitScript(() => { localStorage.setItem('mkty_lang', 'en'); localStorage.setItem('mkty_test_no_pacing', 'yes'); });
  await page.goto(origin + '/', {waitUntil: 'load'});
  await page.waitForFunction(() => window.MKTYStory && window.MKTYExperience && typeof openMission === 'function');
  await page.evaluate(() => {
    const mission = document.getElementById('mission1'), world = document.getElementById('life1World');
    const test = window.geometryLifecycle = {events: [], cancelMarker: null};
    test.snapshot = () => {
      const w = world.getBoundingClientRect();
      const physical = w.width && w.height ? [...world.querySelectorAll('.l1-obstacle')].map(el => {
        const r = el.getBoundingClientRect();
        return {left: (r.left + 3 - w.left) / w.width * 100, right: (r.right - 3 - w.left) / w.width * 100,
          top: (r.top + .36 * r.height - w.top) / w.height * 100, bottom: (r.bottom - 2 - w.top) / w.height * 100};
      }) : [];
      const probes = [], epsilon = .00002;
      const blocked = (x, y) => physical.some(r => x > r.left && x < r.right && y > r.top && y < r.bottom);
      for (const [obstacle, r] of physical.entries()) {
        const mx = (r.left + r.right) / 2, my = (r.top + r.bottom) / 2;
        for (const edge of ['left', 'right', 'top', 'bottom']) for (const delta of [-epsilon, 0, epsilon]) {
          const x = edge === 'left' || edge === 'right' ? r[edge] + delta : mx;
          const y = edge === 'top' || edge === 'bottom' ? r[edge] + delta : my;
          probes.push({obstacle, edge, x, y, expected: blocked(x, y), actual: life1Blocked(x, y)});
        }
      }
      const animation = mission.getAnimations().find(a => a.animationName === 'screenEnter');
      return {active: mission.classList.contains('active'), world: {width: w.width, height: w.height},
        cache: JSON.parse(JSON.stringify(l1Geometry)), physical, probes, playerBlocked: life1Blocked(l1PX, l1PY),
        transform: getComputedStyle(mission).transform,
        animation: animation ? {kind: animation.constructor.name, name: animation.animationName, duration: animation.effect.getTiming().duration,
          time: animation.currentTime, rate: animation.playbackRate} : null};
    };
    // These run after the app's own mission listeners, so snapshots observe its completed refresh.
    for (const type of ['animationend', 'animationcancel']) mission.addEventListener(type, e => {
      if (e.target !== mission || e.animationName !== 'screenEnter') return;
      test.events.push({type: e.type, name: e.animationName, trusted: e.isTrusted,
        sameCache: test.cancelMarker === l1Geometry, snapshot: test.snapshot()});
    });
  });
  await home();
  const initial = await enter(); running(initial, 'ordinary entry');
  assert(initial.cache.width < initial.world.width / .99 + .01, 'entry starts with scaled geometry');
  const settled = (await event('animationend')).snapshot;
  assert(settled.world.width - initial.cache.width > .05, 'native transform changed world size after the initial cache');
  assert.equal(settled.transform, 'none'); check(settled, 'ordinary native animation end');
  // Re-entering repeats a real animation, without installing another controller or listener.
  await home(); running(await enter(), 're-entry'); check((await event('animationend')).snapshot, 'native end after re-entry');
  await home(); running(await enter(), 'active cancellation');
  await page.evaluate(() => { document.getElementById('mission1').style.animation = 'none'; });
  const cancelled = (await event('animationcancel')).snapshot;
  assert.equal(cancelled.transform, 'none'); check(cancelled, 'native cancellation while still active');
  await home(); running(await enter(), 'motion preference cancellation');
  await page.emulateMedia({reducedMotion: 'reduce'});
  check((await event('animationcancel')).snapshot, 'native cancellation after reduced-motion change');
  await home();
  const reduced = await enter(false); assert.equal(reduced.animation, null); assert.equal(reduced.transform, 'none');
  check(reduced, 'reduced-motion immediate entry without animation events');
  await frames(); assert.deepEqual(await page.evaluate(() => geometryLifecycle.events), [], 'reduced motion needs no animation event');
  await page.setViewportSize({width: 320, height: 568});
  await page.waitForFunction(() => Math.abs(l1Geometry.width - document.getElementById('life1World').getBoundingClientRect().width) < 1e-6);
  check(await page.evaluate(() => geometryLifecycle.snapshot()), 'reduced-motion viewport resize');
  await home(); await page.emulateMedia({reducedMotion: 'no-preference'});
  running(await enter(), 'animated viewport resize');
  await page.setViewportSize({width: 568, height: 320});
  running(await page.evaluate(() => geometryLifecycle.snapshot()), 'viewport changed before entrance ended');
  check((await event('animationend')).snapshot, 'final cache after resize during entrance');
  await home(); running(await enter(), 'navigation away');
  await page.evaluate(() => { geometryLifecycle.cancelMarker = l1Geometry; show('home'); });
  const left = await event('animationcancel');
  assert.equal(left.snapshot.active, false, 'navigation really departed Chapter 1');
  assert.equal(left.sameCache, true, 'inactive cancellation never replaces cache with hidden geometry');
  assert.equal(await page.locator('.screen.active').getAttribute('id'), 'home');
  await frames();
  assert(await page.evaluate(() => geometryLifecycle.cancelMarker === l1Geometry), 'hidden ResizeObserver delivery preserves the last visible cache');
  running(await enter(), 'return after interrupted entrance');
  check((await event('animationend')).snapshot, 'fresh geometry after interrupted entrance and return');
  assert.deepEqual(errors, [], 'full game runtime errors');
  console.log('PASS: full-game native screenEnter end/cancel, reduced-motion change/entry, re-entry, navigation away, viewport resize, physical obstacle boundaries');
})().catch(async error => {
  report.failure = error.stack; console.error(error); process.exitCode = 1;
  await page?.screenshot({path: path.join(out, 'failure.png')}).catch(() => {});
}).finally(async () => {
  fs.mkdirSync(out, {recursive: true}); fs.writeFileSync(path.join(out, 'life1-geometry.json'), JSON.stringify({...report, errors}, null, 2));
  await browser?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); clearTimeout(deadline);
});

}
// Importing this test is safe in socket-free source checks. Only direct execution starts a browser.
module.exports = {main};
if (require.main === module) main();
