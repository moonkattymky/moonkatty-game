/* Socket-free lifecycle regression against production functions. This is not a browser-layout
   substitute: life1-geometry-browser.cjs separately exercises the native CSS animation. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
function section(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  assert(a >= 0 && b > a, 'production controller section exists: ' + start);
  return source.slice(a, b);
}
const controller = section('// LIFE #1 mobile exploration controller', 'let l1PointerId=null');
const show = section('function show(id){', 'function openMission(){');
function harness() {
  let scale = .99, width = 400, height = 500, frame = 0;
  const elements = new Map(), observed = [], reads = {world: 0, obstacle: 0}, frames = new Map();
  class Element {
    constructor(id) {
      this.id = id; this.style = {}; this.dataset = {}; this.hidden = true; this.listeners = new Map();
      this.classes = new Set(); this.classList = {
        contains: n => this.classes.has(n), add: n => this.classes.add(n), remove: n => this.classes.delete(n),
        toggle: (n, on) => on ? this.classes.add(n) : this.classes.delete(n)
      };
    }
    addEventListener(type, callback) { const a = this.listeners.get(type) || []; a.push(callback); this.listeners.set(type, a); }
    querySelector() { return get('sprite'); }
    querySelectorAll() { return []; }
    getBoundingClientRect() { return rect(100, 100, 30, 30); }
    fire(type, target = this, animationName = 'screenEnter') {
      for (const fn of this.listeners.get(type) || []) fn({type, target, currentTarget: this, animationName});
    }
  }
  const get = id => { if (!elements.has(id)) elements.set(id, new Element(id)); return elements.get(id); };
  const rect = (left, top, w, h) => ({left, top, width: w, height: h, right: left + w, bottom: top + h});
  const mission = get('mission1'), home = get('home'), world = get('life1World'); home.classes.add('active');
  world.getBoundingClientRect = () => { reads.world++; return rect(50, 75, width * scale, height * scale); };
  const specs = [[.28, .54, 58, 38], [.7, .65, 46, 32], [.57, .43, 42, 42]];
  const obstacles = specs.map(([x, y, w, h], i) => {
    const el = get('rock' + i);
    el.getBoundingClientRect = () => { reads.obstacle++; return rect(50 + width * x * scale, 75 + height * y * scale, w * scale, h * scale); };
    return el;
  });
  const document = {
    hidden: false, getElementById: get,
    querySelector: selector => selector === '.screen.active' ? [mission, home].find(el => el.classes.has('active')) : null,
    querySelectorAll: selector => selector === '.screen' ? [mission, home] :
      selector === '.mission-screen.active' ? [mission].filter(el => el.classes.has('active')) :
      selector === '#life1World .l1-obstacle' ? obstacles : []
  };
  const context = vm.createContext({document, $: get, window: {scrollTo() {}}, console, activeCinematic: null,
    ResizeObserver: class { constructor(callback) { this.callback = callback; } observe(el) { observed.push({el, callback: this.callback}); } },
    requestAnimationFrame(fn) { frames.set(++frame, fn); return frame; }, cancelAnimationFrame(id) { frames.delete(id); },
    leaveMission() {}, life1Stage: 0
  });
  vm.runInContext(controller + '\n' + show + '\nfunction stopLife1Stick(){l1MoveX=0;l1MoveY=0;l1Walking=false;}', context);
  const run = code => vm.runInContext(code, context), snapshot = () => JSON.parse(run('JSON.stringify(l1Geometry)'));
  const expected = () => ({width: width * scale, height: height * scale, obstacles: specs.map(([x, y, w, h]) => ({
    left: x * 100 + 3 / (width * scale) * 100, right: (x + w / width) * 100 - 3 / (width * scale) * 100,
    top: (y + h * .36 / height) * 100, bottom: (y + h / height) * 100 - 2 / (height * scale) * 100
  }))});
  return {mission, get, reads, observed, run, snapshot, expected, frames,
    resize(w, h) { width = w; height = h; observed[0].callback(); },
    transform(s) { scale = s; }, enter() { run("show('mission1')"); }, leave() { run("show('home')"); }};
}
function close(actual, expected, message) {
  for (const key of ['width', 'height']) assert(Math.abs(actual[key] - expected[key]) < 1e-9, message + ': ' + key);
  assert.equal(actual.obstacles.length, expected.obstacles.length);
  actual.obstacles.forEach((r, i) => { for (const key of ['left', 'right', 'top', 'bottom']) assert(Math.abs(r[key] - expected.obstacles[i][key]) < 1e-9, `${message}: obstacle ${i} ${key}`); });
}
const h = harness();
assert.equal(h.observed.length, 1); assert.equal(h.observed[0].el.id, 'life1World');
h.enter(); close(h.snapshot(), h.expected(), 'immediate entrance geometry');
assert.equal(h.snapshot().width, 396, 'entry really measures the .99 scaled box');
// CSS transforms do not issue ResizeObserver notifications. No resize callback is sent here.
h.transform(1);
for (const type of ['animationend', 'animationcancel']) {
  for (const [target, name] of [[h.get('rock0'), 'screenEnter'], [h.mission, 'other-animation']]) {
    const before = {...h.reads}; h.mission.fire(type, target, name);
    assert.deepEqual(h.reads, before, type + ' ignores bubbled child and unrelated animation');
  }
}
assert.equal(h.snapshot().width, 396, 'ignored events cannot accidentally repair the stale cache');
h.mission.fire('animationend'); close(h.snapshot(), h.expected(), 'ordinary animation end');
for (const type of ['animationend', 'animationcancel']) {
  h.leave(); h.transform(.99); h.enter(); h.transform(1); h.mission.fire(type);
  close(h.snapshot(), h.expected(), type + ' on re-entry');
  h.leave(); const before = {...h.reads}; h.mission.fire(type);
  assert.deepEqual(h.reads, before, type + ' ignores a departed screen');
}
// Reduced motion has no animation event, so the immediate show() read is essential.
h.transform(1); h.enter(); close(h.snapshot(), h.expected(), 'reduced-motion immediate entry');
h.resize(320, 280); close(h.snapshot(), h.expected(), 'ordinary viewport resize');
h.leave(); h.transform(.995); h.enter(); h.resize(350, 260);
close(h.snapshot(), h.expected(), 'resize while transition is active');
h.transform(1); h.mission.fire('animationend'); close(h.snapshot(), h.expected(), 'settled geometry after animated resize');
// Inclusive edges remain walkable; just inside each physical collision rectangle is blocked.
for (const [i, r] of h.expected().obstacles.entries()) {
  const x = (r.left + r.right) / 2, y = (r.top + r.bottom) / 2, epsilon = 1e-6;
  const tests = [[r.left - epsilon, y, false], [r.left + epsilon, y, true], [r.right - epsilon, y, true], [r.right + epsilon, y, false],
    [x, r.top - epsilon, false], [x, r.top + epsilon, true], [x, r.bottom - epsilon, true], [x, r.bottom + epsilon, false]];
  for (const [px, py, blocked] of tests) assert.equal(h.run(`life1Blocked(${px},${py})`), blocked, 'obstacle ' + i + ' physical boundary');
}
const obstacle = h.expected().obstacles[0];
h.run(`l1PX=${(obstacle.left + obstacle.right) / 2};l1PY=${(obstacle.top + obstacle.bottom) / 2};l1MoveX=1;`);
h.mission.fire('animationcancel');
assert.equal(h.run('life1Blocked(l1PX,l1PY)'), false, 'refresh preserves walkable-position correction');
assert.equal(h.run('l1MoveX'), 0, 'correction releases held movement');
// Re-entry cannot accumulate listeners or introduce per-frame obstacle DOM reads.
for (let i = 0; i < 6; i++) { h.leave(); h.enter(); }
for (const type of ['animationend', 'animationcancel']) assert.equal(h.mission.listeners.get(type).length, 1);
const before = h.reads.obstacle;
h.run('l1MoveX=1;l1MoveY=0;for(let i=1;i<=120;i++)life1MoveLoop(i*16);');
assert.equal(h.reads.obstacle, before, 'animation fix keeps obstacle reads off the movement hot path');
console.log('PASS: immediate/settled/cancelled Chapter 1 cache, event guards, reduced motion, re-entry, resize, obstacle boundaries and cached movement');
