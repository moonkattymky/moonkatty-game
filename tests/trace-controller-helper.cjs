/* Deterministic rollback fixtures. The controller sources are loaded unchanged, with no codec
   in their global scope: an old client must preserve a packed prefix and append ordinary rows. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const FieldRules = require('../field-model.js');
const ExpeditionRules = require('../expedition-model.js');
const root = path.resolve(__dirname, '..');
const KEY = 'trace-controller-checkpoint';

function initial(kind, codec) {
  const flight = kind === 'flight';
  // Adjacent equal tick rows are intentional. Packing must preserve original row boundaries.
  const original = Array.from({length: 180}, () => flight
    ? [['act', 'scan'], ['tick', 1, 0, 0, false, false], ['tick', 2, 0, 0, false, false]]
    : [['act', 'brake', null], ['tick', 1, 0, 0], ['tick', 2, 0, 0]]).flat();
  let saved;
  if (flight) {
    const profile = ExpeditionRules.profile();
    saved = {version: 1, profile, run: ExpeditionRules.create(53, 'rescue', 1, profile)};
    for (const row of original) {
      if (row[0] === 'act') ExpeditionRules.action(saved.run, profile, row[1]);
      else for (let i = 0; i < row[1]; i++) ExpeditionRules.step(saved.run, profile,
        {x: row[2], y: row[3], boost: row[4], action: row[5]}, .02);
    }
  } else {
    saved = FieldRules.create(6, 3, 21);
    for (const row of original) {
      if (row[0] === 'act') FieldRules.act(saved, row[1], row[2]);
      else for (let i = 0; i < row[1]; i++) FieldRules.tick(saved, 1 / 60, {x: row[2], y: row[3]});
    }
  }
  saved.trace = codec.packTrace(original);
  assert.equal(saved.trace[0][0], 'mkty-trace', kind + ' fixture must actually be packed');
  assert.equal(saved.trace.length, 1, kind + ' fixture must begin with only a packed prefix');
  assert.deepEqual(codec.unpackTrace(saved.trace), original);
  return {saved, original, marker: structuredClone(saved.trace[0])};
}

// These timestamps produce three neutral ticks, then two directional ticks in both controllers.
const firstFrames = [100, 120, 140, 160];
const movingFrames = [180, 200];
function tickRow(kind, count, x = 0, y = 0) {
  return kind === 'flight' ? ['tick', count, x, y, x !== 0, false] : ['tick', count, x, y];
}
function expectedTail(kind) {
  // Field runs at 60 Hz (six total ticks by 100 ms); flight runs at 50 Hz (five).
  return [tickRow(kind, 3), tickRow(kind, kind === 'flight' ? 2 : 3, 1),
    kind === 'flight' ? ['act', 'scan'] : ['act', 'brake', null], tickRow(kind, 1)];
}
function verify(saved, marker, original, tail, codec, label) {
  assert.deepEqual(saved.trace[0], marker, label + ': packed prefix is byte-for-byte unchanged');
  assert.deepEqual(saved.trace.slice(1), tail, label + ': old controller appends/RLEs only raw tail rows');
  assert.deepEqual(codec.unpackTrace(saved.trace), [...original, ...tail], label + ': exact row order and values decode');
}

function verifyRestore(kind, actual, saved) {
  const restored = kind === 'flight' ? ExpeditionRules.restore(saved) : FieldRules.restore(saved, 6, 3, 21);
  assert(restored && (kind !== 'flight' || restored.run), kind + ': fixture is a valid restorable checkpoint');
  if (kind === 'flight') assert.equal(restored.run.time, saved.run.time, 'flight checkpoint was not reset');
  else assert.equal(restored.seconds, saved.seconds, 'field checkpoint was not reset');
  restored.trace = structuredClone(saved.trace);
  assert.deepEqual(actual, restored, kind + ': actual gameplay state is restored, not only the trace');
}

function fixture(kind, seed) {
  const data = new Map(Object.entries(seed || {}));
  const nodes = new Map();
  const frames = new Map();
  let frameId = 0;
  const eventTarget = object => Object.assign(object, {
    listeners: new Map(),
    addEventListener(type, fn) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(fn);
    },
    dispatchEvent(event) {
      event.target ||= this;
      event.preventDefault ||= () => {};
      for (const fn of this.listeners.get(event.type) || []) fn(event);
      this['on' + event.type]?.(event);
      return true;
    }
  });
  const canvas = new Proxy({}, {get: (o, key) => key in o ? o[key] :
    key === 'createRadialGradient' || key === 'createLinearGradient' ? () => ({addColorStop() {}}) : () => {},
  set: (o, key, value) => (o[key] = value, true)});
  const create = (tag = 'div') => {
    const classes = new Set();
    const node = eventTarget({tagName: tag.toUpperCase(), dataset: {}, children: [], open: false,
      style: {setProperty() {}}, classList: {
        add: (...names) => names.forEach(n => classes.add(n)),
        remove: (...names) => names.forEach(n => classes.delete(n)),
        contains: name => classes.has(name),
        toggle(name, force) { const enabled = force ?? !classes.has(name); enabled ? classes.add(name) : classes.delete(name); return enabled; }
      },
      append(...children) {this.children.push(...children);}, before() {},
      setAttribute() {}, getAttribute() {return null;}, removeAttribute() {},
      querySelector() {return null;}, querySelectorAll() {return [];}, getAnimations() {return [];},
      matches() {return false;}, focus() {}, setPointerCapture() {},
      getContext() {return canvas;},
      getBoundingClientRect() {return {x: 0, y: 0, width: 390, height: 480};},
      showModal() {this.open = true;}, close() {this.open = false;}
    });
    Object.defineProperty(node, 'id', {get() {return this._id;}, set(id) {this._id = id; nodes.set(id, this);}});
    return node;
  };
  const $ = id => {
    if (!nodes.has(id)) {const node = create(); node.id = id;}
    return nodes.get(id);
  };
  const document = eventTarget({body: create('body'), documentElement: create('html'), hidden: false,
    createElement: create, getElementById: $, activeElement: null});
  const localStorage = {getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value))};
  const c = eventTarget({console, document, localStorage, structuredClone, setInterval() {}, clearInterval() {},
    setTimeout() {}, clearTimeout() {}, queueMicrotask: fn => fn(),
    requestAnimationFrame: fn => (frames.set(++frameId, fn), frameId),
    cancelAnimationFrame: id => frames.delete(id),
    matchMedia: () => ({matches: true}),
    MutationObserver: class {observe() {}}, ResizeObserver: class {observe() {}},
    Image: class {complete = false;}, FieldRules, ExpeditionRules,
    FieldArt: {scene: () => '<svg></svg>'}
  });
  c.window = c;
  c.globalThis = c;
  c.show = id => {for (const node of nodes.values()) node.classList.remove('active'); $(id).classList.add('active');};
  vm.createContext(c);
  const source = kind === 'flight' ? 'expedition.js' : 'field-missions.js';
  vm.runInContext(fs.readFileSync(path.join(root, source), 'utf8'), c, {filename: source});
  assert.equal(c.MKTYTraceCodec, undefined, 'rollback controller must run without the codec');
  const api = kind === 'flight' ? c.MKTYExpedition : c.MKTYField;
  function open(saved) {
    const task = {chapter: 6, id: 0, fieldStage: 3, seed: kind === 'flight' ? 53 : 21,
      contract: 'rescue', tier: 1, title: ['Проверка', 'Trace rollback'],
      save: value => localStorage.setItem(KEY, JSON.stringify(value)),
      exit() {}, complete() {throw new Error('Fixture unexpectedly completed');}};
    if (kind === 'flight') api.openStory(task, saved); else api.open(task, saved);
  }
  const resume = () => {
    if (kind === 'flight') $('expeditions').dispatchEvent({type: 'click', target: {
      closest: () => ({dataset: {expDialog: 'resume'}})}});
    else $('fieldResume').dispatchEvent({type: 'click'});
  };
  const key = (type, code) => (kind === 'flight' ? document : c).dispatchEvent({type, code, target: document.body, repeat: false});
  const frame = now => {
    assert.equal(frames.size, 1, 'Exactly one active controller animation callback');
    const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(fn => fn(now));
  };
  return {open, resume, key, frame, data, snapshot: () => api.snapshot(), saved: () => JSON.parse(data.get(KEY)),
    pause: () => c.dispatchEvent({type: 'blur'}), hide: () => c.dispatchEvent({type: 'pagehide'})};
}

module.exports = {KEY, initial, fixture, verify, verifyRestore, tickRow, expectedTail, firstFrames, movingFrames};
