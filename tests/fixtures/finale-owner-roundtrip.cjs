'use strict';
/* Test-only injection at the real chapter-space MKTYField.open descriptor.
 * This is deliberately NOT a production integration or a gameplay policy.
 * A refused handoff withholds original completion only to inspect retained data.
 * No browser, socket, network, reward implementation or player data is used.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const codec = require('../../trace-codec.js');
const field = require('../../field-model.js');
const Plan = require('../../story-plan.js');
const makeEnvelope = require('./finale-envelope-21-group-baseline.cjs');
const makeOwner = require('../../finale-evidence-owner.js');
const copy = value => structuredClone(value);
const equal = (a, b) => codec.stringify(a) === codec.stringify(b);
const storyKey = n => 'mkty_story_plan_' + n + '_v1';
const activeKey = n => 'mkty_field_finale_' + n + '_v1';

function createFixture(data, options = {}) {
  const map = new Map(Object.entries(data));
  const events = [], attempts = [], tasks = [], awards = [], legacyWrites = [];
  const state = {
    context: copy(options.context || {account: 'synthetic-owner', route: 'synthetic-route', navigation: 1}),
    persistent: true,
    fault: null,
    hooks: {},
    generation: 0
  };
  let ownerWritten = false;
  const storage = {
    map,
    getItem(key) {
      events.push({type: 'read', key});
      if (ownerWritten && state.fault === 'readback') throw Error('synthetic_readback');
      return map.get(key) ?? null;
    },
    setItem(key, value) {
      events.push({type: 'write', key, value: String(value)});
      if (/^mkty_story_plan_/.test(key)) {
        if (state.fault === 'quota') throw Error('synthetic_quota');
        ownerWritten = true;
        if (state.fault === 'discard') return;
      }
      map.set(key, String(value));
    },
    removeItem(key) { events.push({type: 'remove', key}); map.delete(key); },
    key: i => [...map.keys()][i],
    get length() { return map.size; }
  };
  const model = options.model || Plan;
  const owner = makeOwner({codec, storyPlan: model, envelopes: makeEnvelope({field, codec})});
  const snapshot = () => Object.fromEntries(map);

  function inject(task) {
    const opened = JSON.parse(map.get(activeKey(task.chapter)));
    const expectedContext = copy(state.context);
    const generation = ++state.generation;
    const originalComplete = task.complete;
    return {...task, complete(checkpoint) {
      const attempt = {
        checkpoint: copy(checkpoint),
        checkpointText: codec.stringify(checkpoint),
        previousSnapshot: snapshot(),
        originalCalled: false,
        sourceValue: map.get(activeKey(task.chapter))
      };
      attempts.push(attempt);
      const fail = error => {
        attempt.result = {ok: false, error, recordingOnly: true, mayRetireCapturedCheckpoint: false};
        return attempt.result;
      };
      const sameContext = () => generation === state.generation && equal(state.context, expectedContext);
      try {
        if (!sameContext()) return fail('fixture_stale_context');
        const current = JSON.parse(storage.getItem(activeKey(task.chapter)));
        if (!current || current.n !== task.chapter || current.seed !== opened.seed || current.phase !== task.id) {
          return fail('fixture_stale_source');
        }
        // Capture the callback's FULL raw state, not FieldRules.restore's copy.
        const source = {
          chapter: task.chapter, baseSeed: opened.seed, phase: task.id,
          context: copy(expectedContext), checkpoint: copy(checkpoint),
          provenance: copy(options.provenance?.(task.chapter, task.id) || {authority: 'synthetic only'})
        };
        attempt.source = source;
        const prepared = owner.prepareCapture({snapshot: snapshot(), source});
        attempt.prepared = prepared;
        if (!prepared.ok) return fail(prepared.error);
        state.hooks.beforePersist?.(attempt);
        if (!sameContext()) return fail('fixture_stale_context');
        // Recovery reads exact acknowledged bytes without an unnecessary rewrite.
        const acknowledged = prepared.change === 'duplicate'
          ? owner.acknowledge(prepared, {storage, persistent: state.persistent, source})
          : owner.persist(prepared, {storage, isPersistent: () => state.persistent, source});
        attempt.acknowledged = acknowledged;
        if (!acknowledged.ok || !acknowledged.mayRetireCapturedCheckpoint) {
          return fail(acknowledged.error || 'fixture_retirement_unconfirmed');
        }
        state.hooks.beforeCleanup?.(attempt);
        if (state.hooks.interruptBeforeCleanup) return fail('fixture_interrupted_before_cleanup');
        if (!sameContext()) return fail('fixture_stale_context');
        if (state.persistent !== true) return fail('fixture_persistence_changed');
        // An acknowledgement is scoped to these exact bytes, not a future writer.
        if (storage.getItem(prepared.write.key) !== prepared.write.value ||
            storage.getItem(prepared.sourceKey) !== prepared.expected.active) {
          return fail('fixture_stale_acknowledgement');
        }
        events.push({type: 'original-complete', chapter: task.chapter, phase: task.id});
        attempt.originalCalled = true;
        originalComplete(checkpoint);
        attempt.result = {ok: true, recordingOnly: true, originalCalled: true};
        return attempt.result;
      } catch (error) {
        return fail(String(error.message || error));
      }
    }};
  }

  // Minimal DOM for actual unmodified story.js read/complete/archive behavior.
  const nodes = new Map();
  let active = 'home', random = 777;
  class Element {
    constructor(id = '') {
      this.id = id; this.dataset = {}; this.children = []; this.classes = new Set();
      this.style = {setProperty() {}};
      this.classList = {
        contains: value => this.classes.has(value), add: value => this.classes.add(value),
        remove: value => this.classes.delete(value), toggle() {}
      };
    }
    set innerHTML(value) {
      this.html = value;
      for (const match of value.matchAll(/id="([^"]+)"/g)) get(match[1]);
      this.mapNodes = [...value.matchAll(/data-map-step="(\d+)"/g)].map(match => {
        const element = new Element(); element.dataset.mapStep = match[1]; return element;
      });
    }
    get innerHTML() { return this.html || ''; }
    setAttribute() {}
    compareDocumentPosition() { return 0; }
    before() {}
    append(...values) { this.children.push(...values); }
    replaceChildren(...values) { this.children = values; }
    querySelectorAll() { return this.mapNodes || []; }
    click() { if (!this.disabled) this.onclick?.(); }
  }
  const get = id => {
    if (!nodes.has(id)) nodes.set(id, new Element(id));
    return nodes.get(id);
  };
  const document = {
    documentElement: get('html'), getElementById: get, createElement: () => new Element(),
    querySelector: selector => selector === '.screen.active' ? get(active) : null, hidden: false
  };
  const c = {
    console, document, localStorage: storage, StoryPlan: model, FieldRules: field,
    MutationObserver: class { observe() {} }, Node: {DOCUMENT_POSITION_FOLLOWING: 4},
    FieldArt: {map: (_n, steps) => steps.map(task => '<g data-map-step="' + task.id + '"></g>').join('')},
    crypto: {getRandomValues: value => { value[0] = random++; return value; }},
    setInterval() {}, setTimeout() {}, queueMicrotask() {}, addEventListener() {},
    MKTYCampaign: {render() {}}, MKTYOps: {pending: () => false},
    MKTYStorage: {identity: () => state.context.account, get persistent() { return state.persistent; }},
    MKTYLegacy: {
      set: (key, value) => legacyWrites.push({key, value}),
      epilogue: callback => callback()
    },
    MKTYField: {open(task, saved) {
      tasks.push({original: task, task: options.inject === false ? task : inject(task), saved: copy(saved)});
    }},
    awardLifePoints: (chapter, points) => awards.push({chapter, points}),
    show: id => { get(active).classes.delete('active'); active = id; get(id).classes.add('active'); },
    URL, Blob
  };
  c.window = c;
  for (const [index, name] of ['openMission', 'openMission2', 'openLife3MemoryGate', 'openMission4',
    'openMission5', 'openMission6', 'openMission7', 'openMission8', 'openMission9'].entries()) {
    c[name] = () => { events.push({type: 'legacy-screen', chapter: index + 1}); c.show('mission' + (index + 1)); };
  }
  vm.createContext(c);
  // Match index.html's load order. MKTYStory exists when open() is later called.
  for (const name of ['chapter-space.js', 'story.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, name), 'utf8'), c, {filename: name});
  }
  return {
    c, storage, state, events, attempts, tasks, awards, legacyWrites, owner, snapshot,
    open: chapter => c.MKTYSpatialFinale.open(chapter),
    get task() { return tasks.at(-1)?.task; }
  };
}

module.exports = {createFixture, storyKey, activeKey};
