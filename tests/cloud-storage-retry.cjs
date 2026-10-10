/* Ordinary recovery uses the real storage event and autosave timer, never a test-side flush.
   Only native Storage, DOM and transport are deterministic shims; no browser or network. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Codec = require('../trace-codec.js');
const KEY = 'mkty_story_plan_1_v1';
const DIRTY = 'mkty_cloud_dirty';
const original = JSON.stringify({checkpoint: 'original'});
const continued = JSON.stringify({checkpoint: 'played-during-quota'});
const settle = () => new Promise(resolve => setImmediate(resolve));

function fixture(options = {}) {
  const data = new Map(Object.entries({[KEY]: original, mkty_cloud_revision: '1', ...options.seed}));
  const events = new Map(), nodes = new Map(), timers = new Map();
  let quota = false, readFailure = null, timerId = 0;
  const server = {revision: 1, snapshot: {[KEY]: original}, offline: false,
    invalid: false, reads: 0, writes: 0};
  const native = {
    getItem(key) {if (readFailure === key) throw Error('native read unavailable'); return data.get(key) ?? null;},
    setItem(key, value) {
      if (quota) {const error = Error('native quota exceeded'); error.name = 'QuotaExceededError'; throw error;}
      data.set(key, String(value));
    },
    removeItem: key => data.delete(key),
    key: index => [...data.keys()][index] ?? null,
    get length() {return data.size;}
  };
  const on = (name, fn) => events.set(name, [...(events.get(name) || []), fn]);
  const emit = (name, event = {}) => {for (const fn of events.get(name) || []) fn(event);};
  const create = tag => ({tagName: tag.toUpperCase(), children: [], style: {}, setAttribute() {},
    replaceChildren(...children) {this.children = children;},
    append(...children) {this.children.push(...children); for (const child of children) if (child.id) nodes.set(child.id, child);},
    remove() {nodes.delete(this.id);}});
  const c = {console, localStorage: native, URLSearchParams, MKTYTraceCodec: Codec,
    sessionStorage: {length: 0, key() {}, getItem() {}},
    Telegram: {WebApp: {initData: 'test-only-no-account'}},
    CustomEvent: class {constructor(type, options) {this.type = type; this.detail = options?.detail;}},
    addEventListener: on, dispatchEvent: event => emit(event.type, event), queueMicrotask,
    setTimeout(fn, ms) {timers.set(++timerId, {fn, ms}); return timerId;},
    clearTimeout: id => timers.delete(id), location: {reload() {throw Error('unexpected reload');}}};
  c.document = {body: create('body'), hidden: false, createElement: create,
    createTextNode: text => ({textContent: text}), getElementById: id => nodes.get(id),
    querySelector: () => ({id: 'home'}), addEventListener: (name, fn) => on('document:' + name, fn)};
  c.MKTYRewards = {endpoint: 'local-only', traceProtocol: async () => null,
    authenticatedFetch: async (_url, body) => {
      assert.equal(body.action, 'campaign.cloud', 'compact writes stay disabled');
      if (body.snapshot) server.writes++; else server.reads++;
      if (server.offline) throw Error('offline');
      if (server.invalid) return {ok: true, revision: -1, snapshot: {}};
      if (body.snapshot) {
        if (body.revision !== server.revision) return {ok: true, conflict: true,
          revision: server.revision, snapshot: {...server.snapshot}};
        server.snapshot = {...body.snapshot}; server.revision++;
        return {ok: true, revision: server.revision};
      }
      return {ok: true, revision: server.revision, snapshot: {...server.snapshot}};
    }};
  c.window = c; c.globalThis = c; vm.createContext(c);
  for (const file of ['storage.js', 'cloud-save.js'])
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), c, {filename: file});
  return {c, data, nodes, timers, server, emit, quota: value => quota = value,
    failRead: key => readFailure = key,
    text: () => nodes.get('cloudSaveStatus')?.children[0]?.textContent || ''};
}
async function nextTimer(f) {
  assert.equal(f.timers.size, 1, 'one deduplicated cloud retry is pending');
  const [id, {fn, ms}] = f.timers.entries().next().value;
  assert.equal(ms, 8000, 'recovery uses the existing eight-second scheduler');
  f.timers.delete(id); fn(); await settle();
}
async function exhaustQuota(f, value = continued) {
  f.quota(true); f.c.localStorage.setItem(KEY, value); await settle();
  assert.equal(f.c.MKTYStorage.persistent, false);
  await nextTimer(f);
  assert.equal(f.timers.size, 0, 'memory-only storage does not spin cloud retries');
  assert.equal(f.server.writes, 0);
  assert.match(f.text(), /Restore device saving/);
}

(async () => {
  const f = fixture(); await f.c.MKTYCloud.load(); await exhaustQuota(f);
  assert.equal(f.c.MKTYStorage.retry(), false, 'failed Retry saving cannot announce recovery');
  assert.equal(f.timers.size, 0);
  f.quota(false);
  const retryButton = f.nodes.get('storageRecovery').children.find(node => node.tagName === 'BUTTON');
  retryButton.onclick(); await settle();
  assert.equal(f.c.MKTYStorage.persistent, true);
  assert.equal(f.data.get(KEY), continued, 'entire memory-only checkpoint is now durable');
  assert(!f.nodes.has('storageRecovery'));
  assert.equal(f.data.get(DIRTY), 'yes');
  assert.equal(f.timers.size, 1, 'successful Retry saving must rearm cloud sync');
  assert.doesNotMatch(f.text(), /Restore device saving/, 'recovered storage must not point at a removed button');
  await nextTimer(f);
  assert.equal(f.server.writes, 1);
  assert.equal(f.server.snapshot[KEY], continued);
  assert.equal(f.data.get(DIRTY), undefined);
  assert.equal(f.text(), '');
  assert.equal(f.timers.size, 0);

  // An existing cloud choice remains a choice after local storage recovers.
  const conflict = fixture({seed: {[DIRTY]: 'yes'}});
  conflict.server.revision = 2; conflict.server.snapshot = {[KEY]: 'different-device'};
  await conflict.c.MKTYCloud.load(); await exhaustQuota(conflict);
  conflict.quota(false); assert.equal(conflict.c.MKTYStorage.retry(), true); await settle();
  assert.match(conflict.text(), /newer save/);
  assert(conflict.nodes.get('cloudSaveStatus').children.some(node => node.tagName === 'BUTTON'));
  assert.equal(conflict.timers.size, 0); assert.equal(conflict.server.writes, 0);
  assert.equal(conflict.server.snapshot[KEY], 'different-device');
  assert.equal(conflict.data.get(KEY), continued); assert.equal(conflict.data.get(DIRTY), 'yes');

  // A newer cloud snapshot discovered only after recovery must also stay untouched.
  const changed = fixture(); await changed.c.MKTYCloud.load(); await exhaustQuota(changed);
  changed.server.revision = 2; changed.server.snapshot = {[KEY]: 'newer-cloud'};
  changed.emit('online'); await settle(); // Invalidates the cached download while still memory-only.
  changed.quota(false); assert.equal(changed.c.MKTYStorage.retry(), true);
  await nextTimer(changed);
  assert.match(changed.text(), /newer save/); assert.equal(changed.server.writes, 0);
  assert.equal(changed.data.get(KEY), continued); assert.equal(changed.data.get(DIRTY), 'yes');
  assert.equal(changed.timers.size, 0);

  // The storage retry may attempt raw sync once, but it cannot bypass size refusal.
  const large = fixture(), oversized = 'x'.repeat(Codec.LIMITS.snapshotEntryBytes);
  await large.c.MKTYCloud.load(); await exhaustQuota(large, oversized);
  large.quota(false); assert.equal(large.c.MKTYStorage.retry(), true); await nextTimer(large);
  assert.match(large.text(), /too large/); assert.equal(large.server.writes, 0);
  assert.equal(large.timers.size, 0); assert.equal(large.data.get(KEY), oversized);
  assert.equal(large.data.get(DIRTY), 'yes');

  // A transient download failure must not consume the only retry for dirty local work.
  const initial = fixture(); initial.server.offline = true;
  initial.c.localStorage.setItem(KEY, continued); await nextTimer(initial);
  assert.equal(initial.server.reads, 1); assert.equal(initial.server.writes, 0);
  assert.equal(initial.data.get(DIRTY), 'yes');
  initial.server.offline = false; await nextTimer(initial);
  assert.equal(initial.server.reads, 2); assert.equal(initial.server.writes, 1);
  assert.equal(initial.server.snapshot[KEY], continued); assert.equal(initial.data.get(DIRTY), undefined);
  // load() already scheduled a dirty check; its later no-op must not create a loop.
  if (initial.timers.size) await nextTimer(initial);
  assert.equal(initial.timers.size, 0); assert.equal(initial.server.writes, 1);

  // Recovery must not create a poll loop for invalid transport or unreadable device data.
  const invalid = fixture(); invalid.server.invalid = true;
  invalid.c.localStorage.setItem(KEY, continued); await nextTimer(invalid);
  assert.match(invalid.text(), /could not be verified/); assert.equal(invalid.timers.size, 0);
  assert.equal(invalid.data.get(DIRTY), 'yes'); assert.equal(invalid.server.writes, 0);
  const unreadable = fixture(); unreadable.c.localStorage.setItem(KEY, continued);
  unreadable.failRead('mkty_cloud_revision'); await nextTimer(unreadable);
  assert.equal(unreadable.c.MKTYStorage.persistent, false);
  assert.match(unreadable.text(), /Restore device saving/); assert.equal(unreadable.timers.size, 0);
  assert.equal(unreadable.server.writes, 0);

  console.log('PASS: actual Retry saving button resumes raw cloud sync via the eight-second timer; conflicts, size stops, transient initial downloads and unreadable storage remain safe');
})().catch(error => {console.error(error); process.exitCode = 1;});
