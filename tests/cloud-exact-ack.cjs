/* Metadata-only lost-receipt reconciliation through real storage/cloud clients.
   All accounts, requests, native faults and response barriers are deterministic
   VM fixtures. No browser, server, socket, network or real account is used. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Codec = require('../trace-codec.js');
const KEY = 'mkty_story_plan_1_v1', CHAPTER = 'mkty_current_chapter';
const REVISION = 'mkty_cloud_revision', DIRTY = 'mkty_cloud_dirty';
const GUARDS = ['mkty_cloud_restore_pending', 'mkty_cloud_restore_transaction', 'mkty_cloud_restore_retry_guard'];
const RECOVERY = 'mkty_cloud_recovery', OUTGOING = 'mkty_cloud_restore_outgoing';
const original = {[KEY]: JSON.stringify({trace: Array.from({length: 50}, () => ['tick', 1, .125, 0]), checkpoint: 'same'}), [CHAPTER]: '3'};
const clone = value => JSON.parse(JSON.stringify(value));
const turn = () => new Promise(resolve => setImmediate(resolve));
function deferred() {let resolve; const promise = new Promise(done => {resolve = done;}); return {promise, resolve};}
function mock(modern) {
  const cloud = {revision: 2, snapshot: clone(original)}, calls = [], barriers = new Map();
  let loseWrite = false;
  return {cloud, calls, loseWrite: () => {loseWrite = true;},
    hold(kind) {const started = deferred(), reply = deferred(); barriers.set(kind, {started, reply}); return {started: started.promise, release: reply.resolve};},
    async request(_url, body) {
      calls.push(clone(body)); assert.equal(body.action, modern ? 'campaign.cloud.v2' : 'campaign.cloud');
      let result;
      if (body.snapshot) {
        if (body.revision !== cloud.revision) result = {ok: true, conflict: true, revision: cloud.revision, snapshot: modern ? Codec.packSnapshot(cloud.snapshot) : clone(cloud.snapshot)};
        else {
          cloud.revision++; cloud.snapshot = Codec.unpackSnapshot(body.snapshot);
          if (loseWrite) {loseWrite = false; throw Error('lost acknowledgement');}
          result = {ok: true, revision: cloud.revision};
        }
      } else result = {ok: true, revision: cloud.revision, snapshot: modern ? Codec.packSnapshot(cloud.snapshot) : clone(cloud.snapshot)};
      if (modern) result.protocol = Codec.PROTOCOL;
      const barrier = barriers.get(body.snapshot ? 'write' : 'read');
      if (barrier) {barriers.delete(body.snapshot ? 'write' : 'read'); barrier.started.resolve(); await barrier.reply.promise;}
      return result;
    }};
}
function fixture(server, modern, persisted) {
  const physical = (key, id = 101) => `mkty_account_v3_${id}:${key}`;
  const data = persisted ? new Map(persisted) : new Map(Object.entries({...original, [REVISION]: '1', [DIRTY]: 'yes',
    [RECOVERY]: 'first-recovery-copy', [OUTGOING]: 'latest-outgoing-copy', mkty_points: '9250'})
    .map(([key, value]) => [physical(key), value]));
  const events = new Map(), nodes = new Map(), timers = new Map(), mutations = [];
  let writeFault = null, readFault = null, enumerationFault = false, failed = false, timerId = 0, active = 'home';
  const on = (type, fn) => events.set(type, [...(events.get(type) || []), fn]);
  const emit = event => {for (const fn of events.get(event.type) || []) fn(event);};
  function mutate(type, key, value) {
    const item = {type, key, value}; mutations.push(item);
    if (failed || writeFault?.(item)) {failed = true; throw Error('native write failure');}
    if (type === 'set') data.set(key, String(value)); else data.delete(key);
  }
  const native = {getItem(key) {if (readFault === key) throw Error('native read failure'); return data.get(key) ?? null;},
    setItem: (key, value) => mutate('set', key, value), removeItem: key => mutate('remove', key),
    key(index) {if (enumerationFault) throw Error('native enumeration failure'); return [...data.keys()][index] ?? null;},
    get length() {return data.size;}};
  const create = tag => ({tagName: tag.toUpperCase(), children: [], style: {}, setAttribute() {},
    replaceChildren(...children) {this.children = children;},
    append(...children) {this.children.push(...children); for (const node of children) if (node.id) nodes.set(node.id, node);},
    remove() {nodes.delete(this.id);}});
  const c = {console, URLSearchParams, localStorage: native, sessionStorage: {length: 0, key() {}, getItem() {}},
    Telegram: {WebApp: {initData: 'user=' + encodeURIComponent(JSON.stringify({id: 101}))}}, MKTYTraceCodec: Codec,
    MKTYRewards: {endpoint: 'vm-only', traceProtocol: async () => modern ? Codec.PROTOCOL : null, authenticatedFetch: server.request},
    CustomEvent: class {constructor(type, options) {this.type = type; this.detail = options?.detail;}},
    addEventListener: on, dispatchEvent: emit, queueMicrotask,
    setTimeout: (fn, ms) => (timers.set(++timerId, {fn, ms}), timerId), clearTimeout: id => timers.delete(id),
    location: {reload() {throw Error('unexpected reload');}}};
  c.document = {body: create('body'), createElement: create, createTextNode: text => ({textContent: text}),
    getElementById: id => nodes.get(id), querySelector: () => ({id: active}), addEventListener: (type, fn) => on('document:' + type, fn)};
  c.window = c; c.globalThis = c; vm.createContext(c);
  for (const file of ['storage.js', 'cloud-save.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), c, {filename: file});
  return {c, data, mutations, timers, physical, server, emit,
    read: key => c.localStorage.getItem(key), write: (key, value) => c.localStorage.setItem(key, value),
    put: (key, value, id) => data.set(physical(key, id), value), persisted: () => new Map(data),
    active: value => {active = value;}, owner: id => {c.Telegram.WebApp.initData = 'user=' + encodeURIComponent(JSON.stringify({id}));},
    faultWrite: callback => {writeFault = callback; failed = false;}, failRead: key => {readFault = physical(key);},
    failEnumeration: () => {enumerationFault = true;}, allow: () => {writeFault = readFault = null; failed = enumerationFault = false;},
    text: () => nodes.get('cloudSaveStatus')?.children[0]?.textContent || '',
    conflict: () => !!nodes.get('cloudSaveStatus')?.children.some(node => node.tagName === 'BUTTON')};
}
function assertNoProgressWrites(f, start = 0) {
  assert(f.mutations.slice(start).every(row => [REVISION, DIRTY].some(key => row.key === f.physical(key))), 'reconciliation writes only revision and dirty metadata');
  assert.equal(f.read(RECOVERY), 'first-recovery-copy'); assert.equal(f.read(OUTGOING), 'latest-outgoing-copy'); assert.equal(f.read('mkty_points'), '9250');
}
async function invoke(f, mode, remote = original) {
  if (mode === 'conflict') {f.server.cloud.revision = 1; await f.c.MKTYCloud.load(); f.server.cloud.revision = 2;}
  f.server.cloud.snapshot = clone(remote);
  return mode === 'load' ? f.c.MKTYCloud.load() : f.c.MKTYCloud.flush();
}

(async () => {
  for (const modern of [false, true]) {
    for (const mode of ['load', 'conflict']) {
      const server = mock(modern), f = fixture(server, modern);
      f.active('expedition');
      await invoke(f, mode, {[CHAPTER]: original[CHAPTER], [KEY]: original[KEY]});
      assert.equal(f.read(REVISION), '2'); assert.equal(f.read(DIRTY), null); assert.equal(f.text(), '');
      assert.deepEqual(clone(f.c.MKTYCloud.snapshot()), original); assertNoProgressWrites(f);
      assert.equal(server.calls.filter(call => call.snapshot).length, mode === 'load' ? 0 : 1);
      assert.equal(server.cloud.revision, 2, 'exact acknowledgement never makes an additional cloud revision');
      for (const different of [
        {...original, [CHAPTER]: '4'}, {[KEY]: original[KEY]}, {...original, mkty_life9_coordinates: 'new'},
        {...original, [KEY]: JSON.stringify({checkpoint: 'same', trace: JSON.parse(original[KEY]).trace})},
        {...original, [CHAPTER]: '3 '}, {...original, unexpected_key: 'unaccepted'}
      ]) {
        const divergent = fixture(mock(modern), modern); await invoke(divergent, mode, different);
        assert(divergent.conflict(), `${modern}/${mode}: divergent values remain a choice`); assert.equal(divergent.read(REVISION), '1'); assert.equal(divergent.read(DIRTY), 'yes');
        assert.deepEqual(clone(divergent.c.MKTYCloud.snapshot()), original); assertNoProgressWrites(divergent);
      }

      // Even an edit that returns to identical bytes is newer than the request.
      for (const kind of ['newer-edit', 'edit-and-revert', 'account-switch', 'account-round-trip']) {
        const s = mock(modern), h = fixture(s, modern);
        if (mode === 'conflict') {s.cloud.revision = 1; await h.c.MKTYCloud.load(); s.cloud.revision = 2;}
        const barrier = s.hold(mode === 'load' ? 'read' : 'write');
        const work = mode === 'load' ? h.c.MKTYCloud.load() : h.c.MKTYCloud.flush(); await barrier.started;
        if (kind.startsWith('account')) {
          h.owner(202); h.write(KEY, 'account B'); h.write(DIRTY, 'yes');
          if (kind === 'account-round-trip') h.owner(101);
        } else {h.write(KEY, 'newer local'); if (kind === 'edit-and-revert') h.write(KEY, original[KEY]);}
        barrier.release(); await work;
        assert.equal(h.data.get(h.physical(REVISION)), '1', kind + ': old response cannot acknowledge the original account');
        assert.equal(h.data.get(h.physical(DIRTY)), 'yes');
        if (kind.startsWith('account')) {
          assert.equal(h.data.get(h.physical(KEY, 202)), 'account B');
          assert.equal(h.data.get(h.physical(REVISION, 202)), undefined);
          assert.equal(h.data.get(h.physical(DIRTY, 202)), 'yes');
        }
        assert.equal(h.data.get(h.physical(KEY)), kind === 'newer-edit' ? 'newer local' : original[KEY]);
      }

      for (const key of GUARDS) {
        const h = fixture(mock(modern), modern); h.put(key, 'unresolved-marker');
        await invoke(h, mode);
        assert(h.conflict()); assert.equal(h.read(key), 'unresolved-marker');
        assert.equal(h.read(REVISION), '1'); assert.equal(h.read(DIRTY), 'yes'); assertNoProgressWrites(h);
      }

      // Fault each metadata operation. Both reload and Retry saving must retain
      // every progress byte and recover without claiming memory-only success.
      for (const point of ['revision', 'dirty']) for (const recovery of ['reload', 'retry']) {
        const s = mock(modern), h = fixture(s, modern);
        if (mode === 'conflict') {s.cloud.revision = 1; await h.c.MKTYCloud.load(); s.cloud.revision = 2;}
        h.faultWrite(row => point === 'revision' ? row.type === 'set' && row.key === h.physical(REVISION)
          : row.type === 'remove' && row.key === h.physical(DIRTY));
        await (mode === 'load' ? h.c.MKTYCloud.load() : h.c.MKTYCloud.flush());
        assert.equal(h.c.MKTYStorage.persistent, false); assert.equal(h.read(DIRTY), 'yes');
        assert.equal(h.data.get(h.physical(DIRTY)), 'yes'); assert.match(h.text(), /Restore device saving/);
        assert.equal(h.data.get(h.physical(REVISION)), point === 'revision' ? '1' : '2');
        assertNoProgressWrites(h); assert.deepEqual(s.cloud.snapshot, original);
        let resumed;
        if (recovery === 'reload') resumed = fixture(s, modern, h.persisted());
        else {h.allow(); assert.equal(h.c.MKTYStorage.retry(), true); resumed = h;}
        await resumed.c.MKTYCloud.flush();
        assert.equal(resumed.c.MKTYStorage.persistent, true); assert.equal(resumed.read(DIRTY), null);
        assert.deepEqual(clone(resumed.c.MKTYCloud.snapshot()), original); assert.deepEqual(s.cloud.snapshot, original);
        assert.equal(resumed.read(RECOVERY), 'first-recovery-copy'); assert.equal(resumed.read(OUTGOING), 'latest-outgoing-copy');
      }

      for (const fault of [KEY, ...GUARDS, 'enumeration']) {
        const s = mock(modern), h = fixture(s, modern);
        if (mode === 'conflict') {s.cloud.revision = 1; await h.c.MKTYCloud.load(); s.cloud.revision = 2;}
        const barrier = s.hold(mode === 'load' ? 'read' : 'write');
        const work = mode === 'load' ? h.c.MKTYCloud.load() : h.c.MKTYCloud.flush(); await barrier.started;
        if (fault === 'enumeration') h.failEnumeration(); else h.failRead(fault);
        barrier.release(); await work;
        assert.equal(h.c.MKTYStorage.persistent, false, fault + ': native capture failure cannot masquerade as complete equality');
        assert.equal(h.data.get(h.physical(REVISION)), '1'); assert.equal(h.data.get(h.physical(DIRTY)), 'yes');
        assert.match(h.text(), /Restore device saving/); assert.equal(h.mutations.length, 0);
      }
      // A capture can return a complete map even if another storage access in
      // that synchronous path has just moved the adapter into memory-only mode.
      const flippedServer = mock(modern), flipped = fixture(flippedServer, modern);
      if (mode === 'conflict') {flippedServer.cloud.revision = 1; await flipped.c.MKTYCloud.load(); flippedServer.cloud.revision = 2;}
      const gate = flippedServer.hold(mode === 'load' ? 'read' : 'write');
      const pending = mode === 'load' ? flipped.c.MKTYCloud.load() : flipped.c.MKTYCloud.flush(); await gate.started;
      const capture = flipped.c.MKTYStorage.snapshot;
      flipped.c.MKTYStorage.snapshot = () => {
        const complete = capture(); flipped.failRead('mkty_capture_probe');
        flipped.c.localStorage.getItem('mkty_capture_probe'); return complete;
      };
      gate.release(); await pending;
      assert.equal(flipped.c.MKTYStorage.persistent, false); assert.equal(flipped.read(REVISION), '1');
      assert.equal(flipped.read(DIRTY), 'yes'); assert.equal(flipped.mutations.length, 0);
      assert.match(flipped.text(), /Restore device saving/);
    }
    // A request commits remotely and throws before its acknowledgement arrives.
    const s = mock(modern), h = fixture(s, modern); s.cloud.revision = 1;
    await h.c.MKTYCloud.load(); s.loseWrite(); await h.c.MKTYCloud.flush();
    assert.equal(s.cloud.revision, 2); assert.equal(h.read(REVISION), '1'); assert.equal(h.read(DIRTY), 'yes');
    await h.c.MKTYCloud.flush(); assert.equal(h.read(REVISION), '2'); assert.equal(h.read(DIRTY), null);
    assert.equal(s.calls.filter(call => call.snapshot).length, 2, 'only the committed attempt and its conflict retry were sent');
    assert.equal(s.cloud.revision, 2); assertNoProgressWrites(h);

    for (const remoteRevision of [0, 1]) {
      const stale = fixture(mock(modern), modern); stale.put(REVISION, '2'); stale.server.cloud.revision = remoteRevision;
      await stale.c.MKTYCloud.flush(); assert.equal(stale.read(REVISION), '2'); assert.equal(stale.read(DIRTY), 'yes');
      assert(stale.conflict()); assert.deepEqual(stale.server.cloud.snapshot, original);
    }
    for (const invalid of [
      {revision: '2', snapshot: original}, {revision: 2, snapshot: []},
      {revision: 2, snapshot: {...original, [KEY]: JSON.stringify({trace: [['mkty-trace', 9, 1, 1, 'AA==']]})}}
    ]) {
      const s = mock(modern); s.request = async () => ({ok: true, ...invalid, ...(modern ? {protocol: Codec.PROTOCOL} : {})});
      const h = fixture(s, modern); await h.c.MKTYCloud.load();
      assert.equal(h.read(REVISION), '1'); assert.equal(h.read(DIRTY), 'yes'); assert.equal(h.mutations.length, 0);
      assert.deepEqual(clone(h.c.MKTYCloud.snapshot()), original);
    }
  }
  await turn();
  console.log('PASS: legacy/compact exact load/conflict acknowledgements; strict byte/key equality; generation/account fences; restore markers; native read/metadata failures and reload/retry recovery; lost response retry and stale revisions');
})().catch(error => {console.error(error); process.exitCode = 1;});
