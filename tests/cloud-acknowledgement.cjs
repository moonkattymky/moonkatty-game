/* No browser, socket, real account or wall-clock race. Exercise the actual storage,
   rewards and cloud clients with independently released request/response barriers. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Codec = require('../trace-codec.js');
const {waitForCloud} = require('./cloud-save-helper.cjs');
const CODE = 'mkty_life1_memory_code';
const DIRTY = 'mkty_cloud_dirty';
const REVISION = 'mkty_cloud_revision';
const clone = value => JSON.parse(JSON.stringify(value));
const turn = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve;
  const promise = new Promise(done => {resolve = done;});
  return {promise, resolve};
}
function mock(modern) {
  const cloud = {revision: 1, snapshot: {[CODE]: '1234567890'}}, calls = [];
  const barriers = new Map();
  const caps = modern ? {capabilities: {trace_codec: Codec.PROTOCOL}} : {};
  return {cloud, calls,
    hold(kind) {
      assert(!barriers.has(kind));
      const started = deferred(), reply = deferred();
      barriers.set(kind, {started, reply});
      return {started: started.promise, release: reply.resolve};
    },
    async fetch(_url, options) {
      const body = JSON.parse(options.body);
      calls.push(body);
      let result;
      if (body.action === 'session') result = {ok: true, ...caps, session: {token: 'session:101', expires_at: Date.now() + 43200000}};
      else if (body.action === 'player') result = {ok: true, ...caps, player: {telegram_id: 101, moon_points: 1000, lives: 9, story_life: 2}};
      else {
        assert.equal(body.action, modern ? 'campaign.cloud.v2' : 'campaign.cloud');
        if (body.snapshot) {
          if (body.revision !== cloud.revision) result = {ok: true, conflict: true, ...clone(cloud)};
          else {
            cloud.revision++;
            cloud.snapshot = clone(body.snapshot);
            result = {ok: true, revision: cloud.revision};
          }
        } else result = {ok: true, ...clone(cloud)};
        if (modern) result.protocol = Codec.PROTOCOL;
        const kind = body.snapshot ? 'write' : 'read', barrier = barriers.get(kind);
        if (barrier) {
          barriers.delete(kind);
          barrier.started.resolve(clone(body));
          // Like the UI fixture, server state is committed before the browser
          // sees the acknowledgement. The response can be held independently.
          await barrier.reply.promise;
        }
      }
      return {ok: true, status: 200, json: async () => clone(result)};
    }
  };
}
function documentFixture(server, persisted = new Map()) {
  const data = new Map(persisted), sessions = new Map(), nodes = new Map(), events = new Map(), timers = new Map();
  const checks = [], awaitingChecks = [];
  let timerId = 0, active = 'home';
  const on = (type, fn) => events.set(type, [...(events.get(type) || []), fn]);
  const emit = event => {for (const fn of events.get(event.type) || []) fn(event);};
  const create = tag => ({tagName: tag.toUpperCase(), children: [], style: {},
    setAttribute() {}, replaceChildren(...children) {this.children = children;},
    append(...children) {this.children.push(...children); for (const node of children) if (node.id) nodes.set(node.id, node);},
    appendChild(child) {this.append(child);}, remove() {nodes.delete(this.id);}});
  const native = {getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)),
    removeItem: key => data.delete(key), key: index => [...data.keys()][index] ?? null, get length() {return data.size;}};
  const c = {console, URLSearchParams, AbortController, queueMicrotask,
    localStorage: native, sessionStorage: {getItem: key => sessions.get(key) ?? null,
      setItem: (key, value) => sessions.set(key, String(value)), removeItem: key => sessions.delete(key),
      key: index => [...sessions.keys()][index] ?? null, get length() {return sessions.size;}},
    Telegram: {WebApp: {initData: 'user=' + encodeURIComponent(JSON.stringify({id: 101}))}},
    MKTYTraceCodec: Codec, fetch: server.fetch,
    CustomEvent: class {constructor(type, options) {this.type = type; this.detail = options?.detail;}},
    addEventListener: on, dispatchEvent: emit,
    setTimeout: (fn, ms) => (timers.set(++timerId, {fn, ms}), timerId), clearTimeout: id => timers.delete(id),
    location: {reload() {emit({type: 'pagehide'});}}
  };
  c.document = {body: create('body'), hidden: false, createElement: create,
    createTextNode: text => ({textContent: text}), getElementById: id => nodes.get(id),
    querySelector: selector => selector === '.screen.active' ? {id: active}
      : selector === '#cloudSaveStatus button' ? nodes.get('cloudSaveStatus')?.children.find(node => node.tagName === 'BUTTON') : null,
    addEventListener: (type, fn) => on('document:' + type, fn)};
  c.window = c; c.globalThis = c;
  vm.createContext(c);
  for (const file of ['storage.js', 'rewards-client.js', 'cloud-save.js'])
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), c, {filename: file});
  const page = {async evaluate(fn, arg) {
    c.__argument = arg;
    const result = await vm.runInContext(`(${fn.toString()})(__argument)`, c);
    checks.push(result);
    for (const waiter of awaitingChecks.splice(0)) waiter.resolve();
    return result;
  }};
  return {c, page, nodes, checks, timers, emit, persisted: () => new Map(data),
    read: key => c.localStorage.getItem(key), write: (key, value) => c.localStorage.setItem(key, value),
    active: id => {active = id;},
    async checked() {if (!checks.length) {const waiter = deferred(); awaitingChecks.push(waiter); await waiter.promise;}}
  };
}
// Pinned Playwright 1.58.2's predicate loop, independent of browser execution:
// https://github.com/microsoft/playwright/blob/v1.58.2/packages/playwright-core/src/server/frames.ts#L1400-L1416
function playwrightPoll(predicate, schedule) {
  return new Promise((fulfill, reject) => {
    const next = () => {
      try {
        const success = predicate();
        if (success) {fulfill(success); return;}
        schedule(next);
      } catch (error) {reject(error);}
    };
    next();
  });
}

(async () => {
  for (const modern of [false, true]) {
    const server = mock(modern), first = documentFixture(server), second = documentFixture(server);
    await first.c.MKTYCloud.load();
    await second.c.MKTYCloud.load();
    assert.equal(first.read(CODE), '1234567890');
    assert.equal(second.read(CODE), '1234567890');
    first.write('mkty_current_chapter', '3');
    // A normal visibility-triggered flush is already busy when the test edits.
    const older = server.hold('write');
    first.c.document.hidden = true;
    first.emit({type: 'document:visibilitychange'});
    const olderBody = await older.started;
    assert.equal(Codec.unpackSnapshot(olderBody.snapshot)[CODE], '1234567890');
    first.write(CODE, '2222222222');
    let predicateCalls = 0;
    const oldResult = await playwrightPoll(async () => {
      predicateCalls++;
      await first.c.MKTYCloud.flush();
      return first.read(DIRTY) !== 'yes';
    }, () => {throw Error('An async predicate unexpectedly polled again');});
    assert.equal(oldResult, false, 'The old browser helper resolved successfully with false');
    assert.equal(predicateCalls, 1);
    assert.equal(first.read(DIRTY), 'yes', 'Production retained the unacknowledged edit');
    assert.equal(server.cloud.snapshot[CODE], '1234567890', 'Exact previously failing server value');
    let acknowledged = false;
    const saving = waitForCloud(first.page, 'saved', {polling: 1}).then(value => {acknowledged = true; return value;});
    await first.checked(); await turn();
    assert.equal(first.checks[0], false);
    assert.equal(acknowledged, false, 'A false async result must cause another poll');
    const newer = server.hold('write');
    older.release();
    const newerBody = await newer.started;
    assert.equal(newerBody.revision, 2, 'Second upload follows the first server revision');
    assert.equal(Codec.unpackSnapshot(newerBody.snapshot)[CODE], '2222222222');
    assert.equal(first.read(CODE), '2222222222');
    assert.equal(first.read(DIRTY), 'yes', 'Server commit alone is not client acknowledgement');
    assert.equal(acknowledged, false, 'Held second acknowledgement cannot finish saving');
    newer.release();
    assert.equal(await saving, true);
    assert.equal(first.read(DIRTY), null);
    assert.equal(first.read(REVISION), '3');
    assert.equal(server.cloud.snapshot[CODE], '2222222222');
    // The stale second writer still receives a real conflict and retains its edit.
    second.write(CODE, '3333333333');
    const stale = server.hold('write');
    const staleFlush = second.c.MKTYCloud.flush();
    await stale.started;
    const conflictOldResult = await playwrightPoll(async () => {
      await second.c.MKTYCloud.flush();
      return !!second.c.document.querySelector('#cloudSaveStatus button');
    }, () => {throw Error('An async predicate unexpectedly polled again');});
    assert.equal(conflictOldResult, false, 'The former conflict wait has the same Promise bug');
    let conflictSeen = false;
    const conflict = waitForCloud(second.page, 'conflict', {polling: 1}).then(value => {conflictSeen = true; return value;});
    await second.checked(); await turn();
    assert.equal(conflictSeen, false);
    stale.release(); await staleFlush;
    assert.equal(await conflict, true);
    assert.equal(server.cloud.snapshot[CODE], '2222222222');
    assert.equal(second.read(CODE), '3333333333');
    assert.equal(second.read(DIRTY), 'yes');
    // A held startup load cannot overwrite an edit made before the response arrives.
    const loading = documentFixture(server), remote = server.hold('read');
    const load = loading.c.MKTYCloud.load(); await remote.started;
    loading.write(CODE, '4444444444'); remote.release(); await load;
    assert.equal(loading.read(CODE), '4444444444');
    assert.equal(loading.read(DIRTY), 'yes');
    assert(loading.c.document.querySelector('#cloudSaveStatus button'));

    // Reload can destroy a visibility-triggered write's acknowledgement after
    // the server commits. That durable disk image must offer recovery, not
    // silently overwrite remote state or pretend the save is acknowledged.
    const reloadServer = mock(modern);
    reloadServer.cloud.revision = 0; reloadServer.cloud.snapshot = {};
    const outgoing = documentFixture(reloadServer);
    await outgoing.c.MKTYCloud.load();
    outgoing.write(CODE, '5555555555');
    const lostReceipt = reloadServer.hold('write');
    outgoing.c.document.hidden = true;
    outgoing.emit({type: 'document:visibilitychange'});
    await lostReceipt.started;
    const interrupted = documentFixture(reloadServer, outgoing.persisted());
    await interrupted.c.MKTYCloud.load();
    assert.equal(interrupted.read(CODE), '5555555555');
    assert.equal(interrupted.read(REVISION), null);
    assert.equal(interrupted.read(DIRTY), 'yes');
    assert(interrupted.c.document.querySelector('#cloudSaveStatus button'));
    const callsBefore = reloadServer.calls.length;
    await assert.rejects(waitForCloud(interrupted.page, 'saved', {timeout: 20, polling: 1}), /not acknowledged/);
    assert.equal(reloadServer.calls.length, callsBefore, 'A reload conflict cannot be flushed away');
    // A fixture that intends to continue writing must await the original save
    // before reload, so the next document inherits its acknowledged revision.
    lostReceipt.release();
    await waitForCloud(outgoing.page, 'saved', {polling: 1});
    const resumed = documentFixture(reloadServer, outgoing.persisted());
    await resumed.c.MKTYCloud.load();
    assert.equal(resumed.read(CODE), '5555555555');
    assert.equal(resumed.read(REVISION), '1');
    assert.equal(resumed.read(DIRTY), null);
    assert(!resumed.c.document.querySelector('#cloudSaveStatus button'));
    assert.equal(await waitForCloud(resumed.page, 'saved', {polling: 1}), true);
  }
  // A request that never answers cannot defeat the helper's overall deadline.
  const late = deferred(); let lateChecks = 0;
  await assert.rejects(waitForCloud({evaluate: () => {lateChecks++; return late.promise;}}, 'saved', {timeout: 10}), /not acknowledged/);
  late.resolve(false); await turn(); assert.equal(lateChecks, 1, 'A late response cannot restart expired polling');
  let checks = 0;
  await assert.rejects(waitForCloud({evaluate: async () => {checks++; return false;}}, 'conflict', {timeout: 10, polling: 1}), /not acknowledged/);
  const stoppedAt = checks; await turn(); assert.equal(checks, stoppedAt, 'No polling continues after timeout');
  console.log('PASS: legacy/compact actual-client in-flight save acknowledgements, false async predicate reproduction, stale-writer conflicts, lost-ack reload recovery, pre-reload acknowledgement, load/edit protection and bounded waits');
})().catch(error => {console.error(error); process.exitCode = 1;});
