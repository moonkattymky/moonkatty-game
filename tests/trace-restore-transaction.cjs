/* Exercise actual storage.js memory overlays and cloud-save.js restore transactions. The native
   Storage shim latches a quota failure after deterministic writes/removes; every reboot loses
   the previous document's overlay and therefore must recover from durable transaction data. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Codec = require('../trace-codec.js');
const PENDING = 'mkty_cloud_restore_pending';
const TRANSACTION = 'mkty_cloud_restore_transaction';
const RECOVERY = 'mkty_cloud_recovery';
const OUTGOING = 'mkty_cloud_restore_outgoing';
const RETRY_GUARD = 'mkty_cloud_restore_retry_guard';
const REVISION = 'mkty_cloud_revision';
const DIRTY = 'mkty_cloud_dirty';
const rows = Array.from({length: 240}, (_, i) => ['tick', 1, i % 2 ? .125 : -.125, 0]);
const original = {
  mkty_story_plan_1_v1: JSON.stringify({checkpoint: 'original', trace: rows.slice(0, 5)}),
  mkty_campaign_checkpoint_2: JSON.stringify({version: 1, joined: ['Engineer'], pipes: []}),
  mkty_field_finale_8_v1: JSON.stringify({stage: 'original-finale'}),
  mkty_current_chapter: '2'
};
const remoteSnapshot = {
  mkty_story_plan_1_v1: JSON.stringify({checkpoint: 'remote', trace: rows}),
  mkty_field_finale_9_v1: JSON.stringify({stage: 'remote-finale'}),
  mkty_current_chapter: '6'
};
const remote = {ok: true, revision: 8, protocol: Codec.PROTOCOL, snapshot: Codec.packSnapshot(remoteSnapshot)};
const liveKeys = new Set([...Object.keys(original), ...Object.keys(remoteSnapshot)]);
const clone = value => JSON.parse(JSON.stringify(value));

function nativeStorage(seed) {
  const data = new Map(Object.entries(seed));
  const log = [], guardErrors = [], readErrors = [], readKeys = [], enumerationErrors = [];
  let fault = null, failed = false, guard = null, readFault = null, enumerationFault = null;
  function mutate(type, key, value) {
    const entry = {type, key, value, success: false};
    if (liveKeys.has(key) && guard) {try {guard(entry, data);} catch (error) {guardErrors.push(error);}}
    if (failed || fault?.(entry, log)) {
      failed = true;
      log.push(entry);
      const error = new Error('Injected native Storage quota failure at ' + type + ' ' + key);
      error.name = 'QuotaExceededError';
      throw error;
    }
    if (type === 'set') data.set(key, String(value)); else data.delete(key);
    entry.success = true;
    log.push(entry);
  }
  return {
    data, log, guardErrors, readErrors, readKeys, enumerationErrors, getItem(key) {
      readKeys.push(key);
      if (readFault?.(key)) {readErrors.push(key); throw new Error('Injected native Storage read failure at ' + key);}
      return data.get(key) ?? null;
    },
    setItem: (key, value) => mutate('set', key, value), removeItem: key => mutate('remove', key),
    key(index) {
      if (enumerationFault?.(index)) {enumerationErrors.push(index); throw new Error('Injected native Storage enumeration failure');}
      return [...data.keys()][index] ?? null;
    }, get length() {return data.size;},
    arm(predicate) {fault = predicate; failed = false;},
    allow() {fault = null; failed = false;},
    failReads(predicate) {readFault = predicate;},
    allowReads() {readFault = null;},
    failEnumeration(predicate) {enumerationFault = predicate;},
    allowEnumeration() {enumerationFault = null;},
    guard(callback) {guard = callback;}
  };
}
function reboot(native, options = {}) {
  const nodes = new Map(), events = new Map(), microtasks = [];
  const sessions = new Map(Object.entries(options.sessions || {}));
  let reloads = 0;
  const on = (type, fn) => events.set(type, [...(events.get(type) || []), fn]);
  const emit = event => {for (const fn of events.get(event.type) || []) fn(event);};
  const create = tag => ({tagName: String(tag).toUpperCase(), children: [], style: {},
    setAttribute() {}, append(...children) {this.children.push(...children); for (const node of children) if (node.id) nodes.set(node.id, node);},
    replaceChildren(...children) {this.children = children;}, remove() {nodes.delete(this.id);}});
  const document = {body: create('body'), hidden: false, readyState: 'loading',
    createElement: create, createTextNode: text => ({textContent: text}), getElementById: id => nodes.get(id),
    querySelector: () => ({id: 'home'}), addEventListener: (type, fn) => on('document:' + type, fn)};
  const c = {console, document, localStorage: native, URLSearchParams,
    sessionStorage: {get length() {return sessions.size;}, key: i => [...sessions.keys()][i] ?? null, getItem: key => sessions.get(key) ?? null},
    Telegram: {WebApp: {initData: options.initData ?? (options.identity ? 'user=' + encodeURIComponent(JSON.stringify({id: options.identity})) : 'test-only-no-user-identity')}},
    MKTYTraceCodec: Codec,
    MKTYRewards: {endpoint: 'test-only', traceProtocol: async () => Codec.PROTOCOL,
      authenticatedFetch: async () => clone(remote)},
    CustomEvent: class {constructor(type, options) {this.type = type; this.detail = options?.detail;}},
    queueMicrotask: fn => microtasks.push(fn), setTimeout() {return 1;}, clearTimeout() {},
    addEventListener: on, dispatchEvent: emit,
    location: {reload() {reloads++; emit({type: 'pagehide'});}}
  };
  c.window = c; c.globalThis = c;
  vm.createContext(c);
  for (const file of ['storage.js', 'cloud-save.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), c, {filename: file});
  }
  while (microtasks.length) microtasks.shift()();
  return {c, nodes, reloads: () => reloads, snapshot: () => clone(c.MKTYCloud.snapshot()),
    get: key => c.localStorage.getItem(key), load: () => c.MKTYCloud.load()};
}
function liveNative(native) {
  return Object.fromEntries([...native.data].filter(([key]) => liveKeys.has(key)));
}
function seed(staged = true, dirty = true) {
  return {...original, [REVISION]: '3', ...(dirty ? {[DIRTY]: 'yes'} : {}),
    mkty_points: '9100', unrelated_preference: 'untouched',
    ...(staged ? {[PENDING]: JSON.stringify(remote)} : {})};
}
function assertOriginal(f, native, backup, label) {
  assert.deepEqual(f.snapshot(), original, label + ': controllers see one coherent original snapshot');
  assert.equal(f.get(REVISION), '3', label + ': original local revision is restored');
  assert.equal(f.get(DIRTY), 'yes', label + ': original dirty flag is restored');
  assert.equal(f.get(RECOVERY), backup, label + ': original recovery copy is unchanged in the overlay');
  assert.equal(native.data.get(RECOVERY), backup, label + ': first recovery copy remains durable');
  assert(native.data.has(PENDING), label + ': staged remote remains durable');
  assert(native.data.has(TRANSACTION), label + ': transaction marker remains durable');
  assert.equal(f.get('mkty_points'), '9100', label + ': balance is outside restore scope');
  assert.equal(f.get('unrelated_preference'), 'untouched', label + ': unrelated state is untouched');
}
function guardStaging(native) {
  native.guard((_entry, data) => {
    assert(data.has(PENDING), 'Remote must be durably staged before any live mutation');
    const staged = JSON.parse(data.get(PENDING));
    assert.deepEqual(Codec.unpackSnapshot(staged.snapshot), remoteSnapshot, 'Compact staging decodes to the fully validated remote');
    assert.equal(JSON.parse(staged.snapshot.mkty_story_plan_1_v1).trace[0][0], 'mkty-trace', 'Compressible transport is staged compactly');
    assert.deepEqual(JSON.parse(data.get(RECOVERY)), original, 'Original backup must be durable before live mutation');
    const transaction = JSON.parse(data.get(TRANSACTION));
    assert.equal(transaction.revision, 8, 'Transaction marker must be durable before live mutation');
    assert.equal(transaction.localRevision, '3');
    assert.equal(transaction.phase, 'applying');
  });
}

(async () => {
  for (const point of ['remove-local', 'write-remote', 'revision', 'clear-dirty', 'complete-marker']) {
    const native = nativeStorage(seed());
    guardStaging(native);
    native.arm((entry, log) => point === 'remove-local'
      ? entry.type === 'remove' && liveKeys.has(entry.key) && log.some(x => x.success && x.type === 'remove' && liveKeys.has(x.key))
      : point === 'write-remote' ? entry.type === 'set' && entry.key === 'mkty_current_chapter'
      : point === 'revision' ? entry.type === 'set' && entry.key === REVISION
      : point === 'clear-dirty' ? entry.type === 'remove' && entry.key === DIRTY
      : entry.type === 'set' && entry.key === TRANSACTION && JSON.parse(entry.value).phase === 'complete');
    let f = reboot(native);
    assert.deepEqual(native.guardErrors, [], point + ': staging precedes every mutation');
    assert.equal(f.c.MKTYStorage.persistent, false, point + ': actual adapter detected the native failure');
    assert(native.log.some(x => x.success && liveKeys.has(x.key)), point + ': failure follows at least one durable live mutation');
    assert.notDeepEqual(liveNative(native), original, point + ': native state is genuinely partial or remote');
    const backup = native.data.get(RECOVERY);
    assert.deepEqual(JSON.parse(backup), original);
    assertOriginal(f, native, backup, point + ' first failure');
    // This is not a loop over the same in-memory map. Every fresh document gets a new adapter.
    for (let i = 0; i < 3; i++) {
      f = reboot(native);
      assertOriginal(f, native, backup, point + ' failed reboot ' + (i + 1));
      assert.equal(f.c.MKTYStorage.persistent, false);
    }
    native.allow();
    assert.equal(f.c.MKTYStorage.retry(), true, point + ': ordinary storage retry persists the coherent overlay');
    assert.deepEqual(liveNative(native), original, point + ': retry does not flush a partial cloud snapshot');
    assert.equal(JSON.parse(native.data.get(TRANSACTION)).phase, 'local', point + ': successful storage retry pauses old restore intent');
    f = reboot(native);
    assertOriginal(f, native, backup, point + ': immediate retry/reload preserves outgoing progress');
    const select = f.nodes.get('cloudSaveStatus')?.children.find(node => node.tagName === 'BUTTON');
    assert(select, point + ': cloud restoration requires explicit reselection after retry');
    select.onclick();
    assert.equal(f.reloads(), 1);
    assert.equal(JSON.parse(native.data.get(TRANSACTION)).phase, 'retry');
    f = reboot(native);
    assert.deepEqual(f.snapshot(), remoteSnapshot, point + ': explicit reselection installs the entire expanded remote snapshot');
    assert.deepEqual(liveNative(native), remoteSnapshot);
    assert.equal(f.get(REVISION), '8');
    assert.equal(f.get(DIRTY), null);
    assert.equal(f.get(PENDING), null);
    assert.equal(f.get(TRANSACTION), null);
    assert.equal(f.get(RECOVERY), backup, point + ': success still keeps the first original recovery copy');
    assert.deepEqual(native.guardErrors, [], point + ': all writes respect durable staging');
    native.guard(null);
    const settled = reboot(native);
    assert.deepEqual(settled.snapshot(), remoteSnapshot, point + ': settled state survives another reload');
    assert.equal(settled.get(RECOVERY), backup);
  }

  // Gameplay can continue in the adapter's memory overlay while native storage is failing.
  // The retry event must fire only after those edits are durable, and pause stale cloud intent
  // even when no further gameplay edit occurs between Retry saving and a document reload.
  for (const nativeRecoversEarly of [false, true]) {
    const native = nativeStorage(seed());
    native.arm(entry => entry.type === 'set' && entry.key === 'mkty_current_chapter');
    const f = reboot(native);
    const backup = native.data.get(RECOVERY);
    const edited = JSON.stringify({checkpoint: 'played-while-memory-only', trace: rows.slice(0, 12)});
    const continued = {...original, mkty_story_plan_1_v1: edited};
    if (nativeRecoversEarly) native.allow();
    const beforeEdit = native.log.length;
    f.c.localStorage.setItem('mkty_story_plan_1_v1', edited);
    assert.equal(native.log.length, beforeEdit, 'Memory-only mode freezes native writes even if native storage recovers early');
    assert.equal(f.c.MKTYStorage.persistent, false);
    assert.deepEqual(f.snapshot(), continued);
    assert.notDeepEqual(liveNative(native), continued, 'New gameplay has not yet reached native storage');
    assert.equal(JSON.parse(f.get(TRANSACTION)).phase, 'applying');
    let events = 0;
    f.c.addEventListener('mkty:storage-retry', () => {
      events++;
      assert.equal(f.c.MKTYStorage.persistent, true, 'Retry event fires only when durable');
      assert.deepEqual(liveNative(native), continued, 'Entire gameplay overlay is flushed before retry event');
    });
    if (!nativeRecoversEarly) {
      assert.equal(f.c.MKTYStorage.retry(), false);
      assert.equal(events, 0, 'Failed retry never announces durable storage recovery');
      assert.deepEqual(f.snapshot(), continued, 'Failed retry keeps memory-only gameplay intact');
    }
    native.allow();
    assert.equal(f.c.MKTYStorage.retry(), true);
    assert.equal(events, 1);
    assert.equal(JSON.parse(native.data.get(TRANSACTION)).phase, 'local');
    const after = reboot(native);
    assert.deepEqual(after.snapshot(), continued, 'Memory-only play → Retry saving → reload keeps newly durable gameplay');
    assert.equal(after.get(RECOVERY), backup);
    assert(after.get(PENDING), 'Cloud data remains available for explicit selection');
    assert.equal(after.get(REVISION), '3');
    assert.equal(after.get(DIRTY), 'yes');
  }

  // Retry itself can fail between a durable gameplay flush and the local-phase marker.
  // A complete guard must precede the first live write and recover that latest overlay on boot.
  for (const failure of ['guard-write', 'local-marker', 'partial-flush']) {
    const native = nativeStorage(seed());
    native.arm(entry => entry.type === 'set' && entry.key === 'mkty_current_chapter');
    const f = reboot(native);
    const backup = native.data.get(RECOVERY);
    const latest = {...original,
      mkty_story_plan_1_v1: JSON.stringify({checkpoint: 'latest-before-retry-' + failure, trace: rows.slice(0, 14)}),
      mkty_current_chapter: '4'};
    f.c.localStorage.setItem('mkty_story_plan_1_v1', latest.mkty_story_plan_1_v1);
    f.c.localStorage.setItem('mkty_current_chapter', latest.mkty_current_chapter);
    assert.deepEqual(f.snapshot(), latest);
    const before = native.log.length, durableBefore = liveNative(native);
    native.arm((entry, log) => failure === 'guard-write'
      ? entry.type === 'set' && entry.key === RETRY_GUARD
      : failure === 'local-marker' ? entry.type === 'set' && entry.key === TRANSACTION && JSON.parse(entry.value).phase === 'local'
      : liveKeys.has(entry.key) && log.slice(before).some(row => row.success && liveKeys.has(row.key)));
    assert.equal(f.c.MKTYStorage.retry(), false, failure + ': injected retry failure is reported');
    assert.equal(f.c.MKTYStorage.persistent, false);
    assert.deepEqual(f.snapshot(), latest, failure + ': live document retains complete latest overlay');
    assert.equal(native.data.get(RECOVERY), backup, failure + ': first recovery copy is unchanged');
    const retryLog = native.log.slice(before);
    if (failure === 'guard-write') {
      assert.equal(retryLog.filter(entry => liveKeys.has(entry.key)).length, 0, 'Guard-write failure prevents any live flush');
      assert.deepEqual(liveNative(native), durableBefore);
      assert.equal(native.data.has(RETRY_GUARD), false);
      native.allow();
      assert.equal(f.c.MKTYStorage.retry(), true, 'An ordinary successful retry can recover after guard-write refusal');
    } else {
      const guard = JSON.parse(native.data.get(RETRY_GUARD));
      assert.deepEqual(guard.snapshot, latest, 'Durable retry guard contains one complete latest snapshot');
      assert.equal(guard.localRevision, '3');
      assert.equal(guard.dirty, true);
      assert.equal(guard.tx.phase, 'local');
      const guardIndex = retryLog.findIndex(entry => entry.key === RETRY_GUARD && entry.success);
      const liveIndex = retryLog.findIndex(entry => liveKeys.has(entry.key));
      assert(guardIndex >= 0 && liveIndex > guardIndex, 'Guard becomes durable before the first live flush');
      if (failure === 'local-marker') {
        assert.deepEqual(liveNative(native), latest, 'Local-marker failure occurs after the entire latest overlay flushed');
        assert.equal(JSON.parse(native.data.get(TRANSACTION)).phase, 'applying', 'Old durable phase proves startup needs the retry guard');
      } else {
        assert.notDeepEqual(liveNative(native), latest, 'Retry flush genuinely stopped partway through live writes');
      }
      native.allow();
    }
    const recovered = reboot(native);
    assert.deepEqual(recovered.snapshot(), latest, failure + ': healthy reboot preserves complete latest gameplay');
    assert.deepEqual(liveNative(native), latest);
    assert.equal(recovered.get(RECOVERY), backup);
    assert.equal(recovered.get(REVISION), '3');
    assert.equal(recovered.get(DIRTY), 'yes');
    assert.equal(JSON.parse(recovered.get(TRANSACTION)).phase, 'local');
    assert.equal(recovered.get(RETRY_GUARD), null, 'Settled retry guard is removed only after recovery is durable');
    assert(recovered.get(PENDING), 'Remote remains available only by explicit selection');
    const again = reboot(native);
    assert.deepEqual(again.snapshot(), latest, 'Guard recovery survives a second document reload');
  }

  // The retry guard may see a failed native metadata read as null. It must not mistake
  // unreadable metadata for 'no transaction' and flush live gameplay without a durable guard.
  for (const failedRead of [TRANSACTION, REVISION, DIRTY]) {
    let native, f, options = {};
    if (failedRead === TRANSACTION) {
      native = nativeStorage(seed());
      native.arm(entry => entry.type === 'set' && entry.key === 'mkty_current_chapter');
      reboot(native);
      native.data.set(PENDING, '{malformed-pending-after-interrupted-restore');
      // Recovery without a known transaction argument leaves its metadata only in native
      // storage, which is essential to reproducing the original null-on-read-failure bug.
      f = reboot(native);
      assert.deepEqual(f.snapshot(), original);
    } else {
      // Paused progress can also reopen outside Telegram. No cloud dirty-event rewrite then
      // masks the native revision/dirty reads, but startup recovery and retry guards still run.
      options = {initData: ''};
      native = nativeStorage({...seed(), [RECOVERY]: JSON.stringify(original),
        [TRANSACTION]: JSON.stringify({revision: 8, phase: 'local', localRevision: '3', dirty: true})});
      f = reboot(native, options);
      native.arm(entry => entry.type === 'set' && entry.key === 'mkty_story_plan_1_v1');
    }
    const backup = native.data.get(RECOVERY);
    const latest = {...original, mkty_story_plan_1_v1: JSON.stringify({checkpoint: 'memory-play-before-metadata-read-failure', trace: rows.slice(0, 17)})};
    f.c.localStorage.setItem('mkty_story_plan_1_v1', latest.mkty_story_plan_1_v1);
    assert.deepEqual(f.snapshot(), latest);
    assert.equal(f.c.MKTYStorage.persistent, false);
    native.allow();
    native.failReads(key => key === failedRead);
    const writesBefore = native.log.length;
    const durableBefore = Object.fromEntries(native.data);
    assert.equal(f.c.MKTYStorage.retry(), false, failedRead + ': unreadable guard metadata refuses retry');
    assert(native.readErrors.includes(failedRead), failedRead + ': failure hit the real native metadata read');
    assert.equal(native.log.slice(writesBefore).filter(entry => liveKeys.has(entry.key) || entry.key === RETRY_GUARD).length, 0,
      failedRead + ': no guard or live flush follows unreadable retry metadata');
    assert.deepEqual(Object.fromEntries(native.data), durableBefore, 'Only a temporary probe ran; durable data was not changed');
    assert.equal(f.get('mkty_story_plan_1_v1'), latest.mkty_story_plan_1_v1, 'New memory-only gameplay stays readable after refused retry');
    native.allowReads();
    assert.deepEqual(f.snapshot(), latest);
    assert.equal(f.c.MKTYStorage.retry(), true, failedRead + ': recovered metadata permits coherent guarded retry');
    const after = reboot(native, options);
    assert.deepEqual(after.snapshot(), latest, failedRead + ': retry/reload retains latest memory play');
    assert.equal(after.get(RECOVERY), backup);
    assert.equal(after.get(REVISION), '3');
    assert.equal(after.get(DIRTY), 'yes');
    assert.equal(JSON.parse(after.get(TRANSACTION)).phase, 'local');
    assert.equal(after.get(RETRY_GUARD), null);
  }

  // An unreadable authoritative retry guard at startup is different from a missing guard.
  // Do not fall back to the original backup or remote; reread and overlay the guarded latest
  // checkpoint before an actual Retry saving can flush anything in the new document.
  {
    const native = nativeStorage(seed());
    native.arm(entry => entry.type === 'set' && entry.key === 'mkty_current_chapter');
    const f = reboot(native);
    const backup = native.data.get(RECOVERY);
    const latest = {...original,
      mkty_story_plan_1_v1: JSON.stringify({checkpoint: 'authoritative-unreadable-retry-guard', trace: rows.slice(0, 18)}),
      mkty_current_chapter: '5'};
    f.c.localStorage.setItem('mkty_story_plan_1_v1', latest.mkty_story_plan_1_v1);
    f.c.localStorage.setItem('mkty_current_chapter', latest.mkty_current_chapter);
    native.arm(entry => entry.type === 'set' && entry.key === TRANSACTION && JSON.parse(entry.value).phase === 'local');
    assert.equal(f.c.MKTYStorage.retry(), false, 'Local-marker fault leaves a durable latest retry guard');
    const guard = native.data.get(RETRY_GUARD);
    assert.deepEqual(JSON.parse(guard).snapshot, latest);
    assert.equal(JSON.parse(native.data.get(TRANSACTION)).phase, 'applying');
    native.allow();
    native.failReads(key => key === RETRY_GUARD);
    const writesBefore = native.log.length;
    const blocked = reboot(native);
    assert(native.readErrors.includes(RETRY_GUARD), 'Startup hits the native guard read failure');
    assert.equal(blocked.c.MKTYStorage.persistent, false);
    assert.equal(native.log.length, writesBefore, 'Unreadable guard startup performs no native writes or fallback restore');
    assert.deepEqual(liveNative(native), latest, 'Original or remote snapshot cannot overwrite guarded gameplay');
    assert.equal(native.data.get(RETRY_GUARD), guard);
    assert.equal(native.data.get(RECOVERY), backup);
    assert.equal(blocked.get('mkty_story_plan_1_v1'), latest.mkty_story_plan_1_v1);
    let requests = 0;
    blocked.c.MKTYRewards.authenticatedFetch = async () => {requests++; return clone(remote);};
    await blocked.load();
    assert.equal(requests, 0, 'Cloud load waits for an authoritative guard read');
    assert.equal(blocked.c.MKTYStorage.retry(), false, 'Retry also refuses while its authoritative guard is unreadable');
    assert.equal(native.data.get(RETRY_GUARD), guard);
    assert.equal(native.log.slice(writesBefore).filter(entry => liveKeys.has(entry.key) || entry.key === RETRY_GUARD).length, 0);
    native.allowReads();
    const readsBefore = native.readKeys.length;
    assert.equal(blocked.c.MKTYStorage.retry(), true, 'Recovered guard read permits the actual adapter retry');
    assert.equal(native.readKeys[readsBefore], RETRY_GUARD, 'Retry rereads the authoritative guard before other recovery metadata');
    assert.deepEqual(blocked.snapshot(), latest);
    assert.deepEqual(liveNative(native), latest);
    assert.equal(blocked.get(RETRY_GUARD), null);
    assert.equal(JSON.parse(blocked.get(TRANSACTION)).phase, 'local');
    const after = reboot(native);
    assert.deepEqual(after.snapshot(), latest, 'Guard read recovery survives the next document reload');
    assert.equal(after.get(RECOVERY), backup);
    assert.equal(after.get(REVISION), '3');
    assert.equal(after.get(DIRTY), 'yes');
  }

  // Legacy migration uses the actual account namespace adapter. A quota failure must queue
  // every copy and the owner marker, so a later boot cannot re-copy stale legacy checkpoints.
  {
    const identity = '101', prefix = 'mkty_account_v3_' + identity + ':';
    const options = {identity, sessions: {['mkty_session_v1_' + identity]: JSON.stringify({token: 'fixture-session-only'})}};
    const legacy = {...seed(false), mkty_lang: 'en', mkty_pending_v2_101: '[]'};
    const native = nativeStorage(legacy);
    native.arm(entry => entry.type === 'set' && entry.key === prefix + 'mkty_campaign_checkpoint_2');
    const f = reboot(native, options);
    assert.equal(f.c.MKTYStorage.identity(), identity);
    assert.equal(f.c.MKTYStorage.persistent, false, 'Migration quota failure reaches actual adapter');
    assert.deepEqual(f.snapshot(), original, 'All legacy gameplay is coherent in the account overlay');
    assert(native.data.has(prefix + 'mkty_story_plan_1_v1'), 'First account copy was durable before quota failure');
    assert.equal(native.data.has(prefix + 'mkty_current_chapter'), false, 'Later migration copies are initially memory-only');
    assert.equal(native.data.has('mkty_legacy_owner_v3'), false, 'Migration owner marker is not prematurely durable');
    native.allow();
    assert.equal(f.c.MKTYStorage.retry(), true, 'Retry flushes all remaining account copies and owner marker');
    assert.equal(native.data.get('mkty_legacy_owner_v3'), identity, 'Migration completion marker is flushed with queued copies');
    const migratedKeys = [...Object.keys(original), REVISION, DIRTY, 'mkty_points'];
    for (const key of migratedKeys) assert.equal(native.data.get(prefix + key), legacy[key], key + ': complete migrated account data');
    const ownerIndex = native.log.findIndex(entry => entry.success && entry.key === 'mkty_legacy_owner_v3');
    for (const key of migratedKeys) {
      const copyIndex = native.log.findIndex(entry => entry.success && entry.key === prefix + key);
      assert(copyIndex >= 0 && copyIndex < ownerIndex, 'Every migrated copy is durable before the legacy owner marker');
    }
    assert.equal(native.data.has(prefix + 'mkty_lang'), false, 'Shared language preference is not duplicated');
    assert.equal(native.data.has(prefix + 'mkty_pending_v2_101'), false, 'Existing reward queue retains its account-specific key');
    const newer = JSON.stringify({checkpoint: 'new-namespaced-progress-after-migration', trace: rows.slice(0, 16)});
    f.c.localStorage.setItem('mkty_story_plan_1_v1', newer);
    assert.equal(native.data.get(prefix + 'mkty_story_plan_1_v1'), newer);
    assert.equal(native.data.get('mkty_story_plan_1_v1'), original.mkty_story_plan_1_v1, 'Unscoped legacy checkpoint remains an independent old copy');
    const writesBefore = native.log.length;
    const after = reboot(native, options);
    assert.deepEqual(after.snapshot(), {...original, mkty_story_plan_1_v1: newer}, 'Reload cannot remigrate stale legacy data over newer account progress');
    assert.equal(native.log.slice(writesBefore).filter(entry => entry.key.startsWith(prefix)).length, 0, 'Completed migration does not run again');
    assert.equal(after.get('mkty_points'), '9100');
    assert.equal(after.get('mkty_lang'), 'en');
    const other = reboot(native, {identity: '202', sessions: {mkty_session_v1_202: JSON.stringify({token: 'other-fixture-session'})}});
    assert.deepEqual(other.snapshot(), {}, 'A second account cannot inherit the first account or attributed legacy progress');
    assert.equal(other.get('mkty_points'), null);
    assert.equal(native.data.get(prefix + 'mkty_story_plan_1_v1'), newer);
  }

  // Migration must capture every legacy source and destination before making any copy.
  // Read failures leave the attempt pending so Retry saving can finish missing copies without
  // replacing existing account work or newer memory-only gameplay created during the outage.
  for (const failure of ['source-read', 'key-enumeration', 'owner-read', 'target-read']) {
    const identity = '101', prefix = 'mkty_account_v3_' + identity + ':';
    const options = {identity, sessions: {mkty_session_v1_101: JSON.stringify({token: 'fixture-migration-read-session'})}};
    const existing = JSON.stringify({checkpoint: 'existing-account-finale-before-migration'});
    const legacy = {...seed(false), mkty_lang: 'en', mkty_pending_v2_101: '[]',
      [prefix + 'mkty_field_finale_8_v1']: existing};
    const native = nativeStorage(legacy);
    if (failure === 'key-enumeration') native.failEnumeration(index => index === 2);
    else native.failReads(key => key === (failure === 'source-read' ? 'mkty_campaign_checkpoint_2'
      : failure === 'owner-read' ? 'mkty_legacy_owner_v3' : prefix + 'mkty_campaign_checkpoint_2'));
    const f = reboot(native, options);
    assert.equal(f.c.MKTYStorage.persistent, false, failure + ': actual migration encountered the injected read failure');
    if (failure === 'key-enumeration') assert(native.enumerationErrors.length > 0);
    else assert(native.readErrors.length > 0);
    assert.equal(native.log.length, 0, failure + ': partial capture cannot copy anything or write its owner marker');
    assert.deepEqual(Object.fromEntries(native.data), legacy);
    assert.equal(f.get('mkty_current_chapter'), null, 'Uncaptured migration keys were not partly staged in memory');
    assert.equal(f.get('mkty_field_finale_8_v1'), existing, 'Existing namespaced checkpoint is available and untouched');
    const newer = JSON.stringify({checkpoint: 'new-account-memory-play-during-' + failure, trace: rows.slice(0, 19)});
    f.c.localStorage.setItem('mkty_story_plan_1_v1', newer);
    assert.equal(f.get('mkty_story_plan_1_v1'), newer);
    assert.equal(native.data.has(prefix + 'mkty_story_plan_1_v1'), false, 'New play remains in memory while migration reads are unavailable');
    f.c.localStorage.removeItem('mkty_current_chapter');
    assert.equal(f.get('mkty_current_chapter'), null, 'Queued deletion creates a memory tombstone during deferred migration');
    assert.equal(native.data.get('mkty_current_chapter'), legacy.mkty_current_chapter, 'Account deletion does not touch the legacy original');
    const beforeRetry = native.log.length;
    assert.equal(f.c.MKTYStorage.retry(), false, failure + ': retry refuses while migration capture is still incomplete');
    assert.equal(native.log.slice(beforeRetry).filter(entry => entry.key !== 'mkty_storage_probe').length, 0,
      failure + ': failed retry cannot flush gameplay, partial copies, or owner marker');
    assert.deepEqual(Object.fromEntries(native.data), legacy, 'Failed capture/retry leaves original native data untouched');
    assert.equal(native.data.has('mkty_legacy_owner_v3'), false);
    assert.equal(f.get('mkty_story_plan_1_v1'), newer, 'Failed migration retry preserves memory-only account work');
    native.allowReads();
    native.allowEnumeration();
    assert.equal(f.c.MKTYStorage.retry(), true, failure + ': recovered source/destination reads finish migration before flushing');
    const expected = {...original, mkty_story_plan_1_v1: newer, mkty_field_finale_8_v1: existing};
    delete expected.mkty_current_chapter;
    assert.deepEqual(f.snapshot(), expected, 'Missing legacy progress joins account work without resurrecting queued deletions');
    assert.equal(f.get('mkty_current_chapter'), null);
    assert.equal(native.data.has(prefix + 'mkty_current_chapter'), false, 'Recovered migration respects the namespaced deletion tombstone');
    assert.equal(native.data.get('mkty_legacy_owner_v3'), identity);
    const ownerIndex = native.log.findIndex(entry => entry.success && entry.key === 'mkty_legacy_owner_v3');
    for (const key of [...Object.keys(original), REVISION, DIRTY, 'mkty_points']) {
      const expectedValue = key === 'mkty_current_chapter' ? undefined : key === 'mkty_story_plan_1_v1' ? newer : key === 'mkty_field_finale_8_v1' ? existing : legacy[key];
      assert.equal(native.data.get(prefix + key), expectedValue, failure + ': complete account value for ' + key);
      assert.equal(native.data.get(key), legacy[key], 'Original unscoped legacy data is never mutated');
      if (key === 'mkty_field_finale_8_v1') {
        assert.equal(native.log.filter(entry => entry.key === prefix + key).length, 0, 'Existing account value takes precedence without a write');
      } else {
        const copied = native.log.findIndex(entry => entry.success && entry.key === prefix + key);
        assert(copied >= 0 && copied < ownerIndex, 'Every missing, edited, or deleted account key flushes before the owner marker');
        if (key === 'mkty_current_chapter') {
          assert.equal(native.log[copied].type, 'remove', 'Tombstone flushes as deletion');
          assert.equal(native.log.filter(entry => entry.key === prefix + key && entry.type === 'set').length, 0, 'Legacy current chapter is never copied over the deletion');
        }
      }
    }
    assert.equal(native.data.has(prefix + 'mkty_lang'), false);
    assert.equal(native.data.has(prefix + 'mkty_pending_v2_101'), false);
    const beforeReload = native.log.length;
    const after = reboot(native, options);
    assert.deepEqual(after.snapshot(), expected, 'Reload cannot remigrate stale legacy data over recovered account work');
    assert.equal(native.log.slice(beforeReload).filter(entry => entry.key.startsWith(prefix)).length, 0);
    assert.equal(after.get('mkty_points'), '9100');
    assert.equal(after.get('mkty_current_chapter'), null, 'Namespaced deletion remains absent after reload');
    assert.equal(native.data.get('mkty_current_chapter'), legacy.mkty_current_chapter);
  }

  // The storage lifecycle event has no restore side effects for ordinary sessions.
  {
    const native = nativeStorage(seed(false));
    const f = reboot(native), before = Object.fromEntries(native.data);
    let events = 0;
    f.c.addEventListener('mkty:storage-retry', () => events++);
    assert.equal(f.c.MKTYStorage.retry(), true);
    assert.equal(events, 1, 'Successful adapter retry publishes its lifecycle event');
    assert.deepEqual(Object.fromEntries(native.data), before, 'Retry event with no transaction is a no-op for saved data');
    for (const key of [PENDING, TRANSACTION, RECOVERY, OUTGOING]) assert.equal(f.get(key), null);
    const beforeNotification = native.log.length;
    f.c.dispatchEvent(new f.c.CustomEvent('mkty:storage-retry'));
    assert.equal(events, 2);
    assert.equal(native.log.length, beforeNotification, 'Unrelated retry notifications do not mutate storage');
    assert.equal(f.nodes.has('cloudSaveStatus'), false, 'Ordinary retry does not invent a cloud conflict');
  }

  // Recovered storage plus a real new gameplay edit is a local continuation. A stale
  // applying transaction must never silently overwrite that durable edit on the next boot.
  {
    const native = nativeStorage(seed());
    native.arm(entry => entry.type === 'set' && entry.key === 'mkty_current_chapter');
    let f = reboot(native);
    const backup = native.data.get(RECOVERY);
    assertOriginal(f, native, backup, 'failure before local continuation');
    native.allow();
    assert.equal(f.c.MKTYStorage.retry(), true);
    const edited = JSON.stringify({checkpoint: 'local-after-storage-retry', trace: rows.slice(0, 8)});
    f.c.localStorage.setItem('mkty_story_plan_1_v1', edited);
    const continued = {...original, mkty_story_plan_1_v1: edited};
    assert.deepEqual(liveNative(native), continued, 'New gameplay is genuinely durable before reload');
    assert.equal(JSON.parse(native.data.get(TRANSACTION)).phase, 'local');
    const staged = native.data.get(PENDING);
    for (let i = 0; i < 2; i++) {
      f = reboot(native);
      assert.deepEqual(f.snapshot(), continued, 'Failure → Retry saving → edit → reload preserves new gameplay');
      assert.equal(f.get(REVISION), '3');
      assert.equal(f.get(DIRTY), 'yes');
      assert.equal(f.get(PENDING), staged, 'Cloud copy remains available as an explicit choice');
      assert.equal(f.get(RECOVERY), backup, 'First original copy is never repurposed');
    }

    // Choosing cloud again authorizes replacement, but the latest outgoing controller save
    // happens during pagehide. It needs its own durable backup before remote data is applied.
    await f.load();
    const button = f.nodes.get('cloudSaveStatus')?.children.find(node => node.tagName === 'BUTTON');
    assert(button, 'Paused local restore exposes an explicit cloud selection');
    const finalEdit = JSON.stringify({checkpoint: 'last-controller-pagehide-save', trace: rows.slice(0, 9)});
    const outgoing = {...continued, mkty_story_plan_1_v1: finalEdit, mkty_current_chapter: '3'};
    f.c.addEventListener('pagehide', () => {
      f.c.localStorage.setItem('mkty_story_plan_1_v1', finalEdit);
      f.c.localStorage.setItem('mkty_current_chapter', '3');
    });
    button.onclick();
    assert.equal(f.reloads(), 1, 'Explicit cloud selection requests exactly one reload');
    assert.deepEqual(liveNative(native), outgoing, 'Outgoing pagehide completes before cloud replacement');
    assert.equal(JSON.parse(native.data.get(TRANSACTION)).phase, 'retry', 'Outgoing edits retain the explicit reselection intent');
    assert.equal(native.data.get(RECOVERY), backup);
    assert.equal(native.data.has(OUTGOING), false, 'Latest outgoing snapshot is captured on the new document, after pagehide');
    // A failed reselection must recover the latest outgoing run, never the older first copy.
    for (const blockedKey of [OUTGOING, 'mkty_current_chapter']) {
      const retryNative = nativeStorage(Object.fromEntries(native.data));
      retryNative.arm(entry => entry.type === 'set' && entry.key === blockedKey);
      let interrupted = reboot(retryNative);
      assert.equal(interrupted.c.MKTYStorage.persistent, false);
      assert.deepEqual(interrupted.snapshot(), outgoing, 'Interrupted reselection keeps latest outgoing gameplay');
      assert.equal(interrupted.get(RECOVERY), backup);
      if (blockedKey === OUTGOING) {
        assert.equal(retryNative.log.filter(entry => liveKeys.has(entry.key)).length, 0, 'Failed latest backup prevents all live mutations');
      } else {
        assert.deepEqual(JSON.parse(retryNative.data.get(OUTGOING)), outgoing);
        interrupted = reboot(retryNative);
        assert.deepEqual(interrupted.snapshot(), outgoing, 'Failed retry reboot recovers latest backup, not first original');
        assert.equal(interrupted.get(RECOVERY), backup);
        assert.equal(interrupted.get(REVISION), '3');
        assert.equal(interrupted.get(DIRTY), 'yes');
      }
    }
    native.guard((_entry, data) => {
      assert.equal(data.get(RECOVERY), backup, 'Retry keeps first recovery unchanged');
      assert.deepEqual(JSON.parse(data.get(OUTGOING)), outgoing, 'Latest outgoing snapshot is durable before retry mutates live data');
      assert(data.has(PENDING));
    });
    const selected = reboot(native);
    assert.deepEqual(native.guardErrors, []);
    assert.deepEqual(selected.snapshot(), remoteSnapshot, 'Explicit reselection installs the full cloud snapshot');
    assert.equal(selected.get(RECOVERY), backup);
    assert.deepEqual(JSON.parse(selected.get(OUTGOING)), outgoing, 'Latest outgoing snapshot remains recoverable after success');
    assert.equal(selected.get(REVISION), '8');
    assert.equal(selected.get(DIRTY), null);
    assert.equal(selected.get(PENDING), null);
    assert.equal(selected.get(TRANSACTION), null);
  }

  // An applying marker without pending transport rolls back once. Once that rollback is
  // durable, later reloads must not keep restoring the old backup over new local progress.
  {
    const native = nativeStorage(seed());
    native.arm(entry => entry.type === 'set' && entry.key === 'mkty_current_chapter');
    reboot(native);
    const backup = native.data.get(RECOVERY);
    native.data.delete(PENDING); // Simulate an interrupted/missing staged payload.
    native.allow();
    const recovered = reboot(native);
    assert.deepEqual(recovered.snapshot(), original, 'Orphaned applying transaction rolls back before controllers start');
    assert.deepEqual(liveNative(native), original, 'Orphan rollback is durably complete');
    assert.equal(JSON.parse(native.data.get(TRANSACTION)).phase, 'local');
    const edited = JSON.stringify({checkpoint: 'local-after-orphan-recovery', trace: rows.slice(0, 10)});
    recovered.c.localStorage.setItem('mkty_story_plan_1_v1', edited);
    const afterEdit = {...original, mkty_story_plan_1_v1: edited};
    const writesBefore = native.log.length;
    const after = reboot(native);
    assert.deepEqual(after.snapshot(), afterEdit, 'Orphan rollback does not repeat over new local gameplay');
    assert.deepEqual(liveNative(native), afterEdit);
    assert.equal(native.log.slice(writesBefore).filter(entry => liveKeys.has(entry.key)).length, 0, 'Settled orphan does not rewrite live checkpoints');
    assert.equal(after.get(RECOVERY), backup);
    assert.equal(after.get(PENDING), null);
    assert.equal(after.get(REVISION), '3');
    assert.equal(after.get(DIRTY), 'yes');
  }

  // A committed transaction may fail to remove either temporary key. The complete marker
  // must prevent stale pending data from replacing gameplay saved after that commit.
  for (const blockedKey of [PENDING, TRANSACTION]) {
    const native = nativeStorage(seed());
    guardStaging(native);
    native.arm(entry => entry.type === 'remove' && entry.key === blockedKey);
    const f = reboot(native);
    assert.equal(f.c.MKTYStorage.persistent, false, blockedKey + ': cleanup failure was exercised');
    assert.deepEqual(f.snapshot(), remoteSnapshot, blockedKey + ': completed restore remains coherent');
    assert.deepEqual(liveNative(native), remoteSnapshot);
    assert.equal(JSON.parse(native.data.get(TRANSACTION)).phase, 'complete', 'Durable complete marker survives cleanup failure');
    assert.equal(native.data.has(PENDING), blockedKey === PENDING, 'Only successfully deleted temporary keys disappear');
    const backup = native.data.get(RECOVERY);
    assert.deepEqual(JSON.parse(backup), original);
    assert.deepEqual(native.guardErrors, []);
    native.guard(null);
    native.allow();
    const newer = JSON.stringify({checkpoint: 'new-gameplay-after-restore', trace: [...rows, ['act', 'brake', null]]});
    // Even if native storage is usable again, the adapter keeps all writes in its overlay
    // until explicit Retry saving flushes the full checkpoint and metadata together.
    const beforeEdit = native.log.length;
    f.c.localStorage.setItem('mkty_story_plan_1_v1', newer);
    assert.equal(native.log.length, beforeEdit, 'Native writes remain frozen until explicit retry');
    assert.deepEqual(liveNative(native), remoteSnapshot, 'New gameplay is still memory-only before retry');
    assert.deepEqual(f.snapshot(), {...remoteSnapshot, mkty_story_plan_1_v1: newer});
    assert.equal(f.c.MKTYStorage.retry(), true);
    assert.equal(native.data.get('mkty_story_plan_1_v1'), newer);
    assert.equal(native.data.get(DIRTY), 'yes');
    const after = reboot(native);
    assert.deepEqual(after.snapshot(), {...remoteSnapshot, mkty_story_plan_1_v1: newer}, 'Complete marker protects newer gameplay on reload');
    assert.equal(after.get(REVISION), '8');
    assert.equal(after.get(DIRTY), 'yes', 'New gameplay keeps its dirty flag');
    assert.equal(after.get(PENDING), null);
    assert.equal(after.get(TRANSACTION), null);
    assert.equal(after.get(RECOVERY), backup);
  }

  // Paused local progress keeps its already-staged remote choice when the fresh document
  // cannot reach the server. An offline load must not erase that choice or its action.
  {
    const native = nativeStorage(seed());
    native.arm(entry => entry.type === 'set' && entry.key === 'mkty_current_chapter');
    const failed = reboot(native);
    const backup = native.data.get(RECOVERY);
    native.allow();
    assert.equal(failed.c.MKTYStorage.retry(), true);
    const offline = reboot(native);
    const staged = offline.get(PENDING);
    let requests = 0;
    offline.c.MKTYRewards.authenticatedFetch = async () => {requests++; throw new Error('offline');};
    await offline.load();
    assert.equal(requests, 1, 'Fresh startup attempted an offline cloud load');
    assert.deepEqual(offline.snapshot(), original);
    assert.equal(offline.get(PENDING), staged, 'Offline startup keeps the validated staged copy');
    const select = offline.nodes.get('cloudSaveStatus')?.children.find(node => node.tagName === 'BUTTON');
    assert(select, 'Previously staged cloud selection remains actionable while offline');
    select.onclick();
    assert.equal(offline.reloads(), 1, 'Explicit offline reselection can use the durable staged copy');
    assert.equal(requests, 1, 'Selecting the staged copy needs no second network request');
    const selected = reboot(native);
    assert.deepEqual(selected.snapshot(), remoteSnapshot);
    assert.equal(selected.get(RECOVERY), backup);
    assert.equal(selected.get(REVISION), '8');
    assert.equal(selected.get(PENDING), null);
    assert.equal(selected.get(TRANSACTION), null);
  }

  // A complete marker from revision 8 can survive a cleanup failure. A genuinely newer
  // revision 9 selection must settle that old marker before staging the new transaction.
  {
    const native = nativeStorage(seed());
    native.arm(entry => entry.type === 'remove' && entry.key === PENDING);
    const f = reboot(native);
    assert.equal(JSON.parse(native.data.get(TRANSACTION)).revision, 8);
    assert.equal(JSON.parse(native.data.get(TRANSACTION)).phase, 'complete');
    native.allow();
    assert.equal(f.c.MKTYStorage.retry(), true);
    assert.equal(JSON.parse(native.data.get(TRANSACTION)).phase, 'complete', 'Cleanup marker still exists after retry');
    const localEdit = JSON.stringify({checkpoint: 'continued-from-revision-eight', trace: rows.slice(0, 11)});
    f.c.localStorage.setItem('mkty_story_plan_1_v1', localEdit);
    const nextSnapshot = {...remoteSnapshot,
      mkty_story_plan_1_v1: JSON.stringify({checkpoint: 'new-remote-revision-nine', trace: rows.slice(0, 15)}),
      mkty_current_chapter: '7'};
    f.c.MKTYRewards.authenticatedFetch = async () => ({...remote, revision: 9, snapshot: Codec.packSnapshot(nextSnapshot)});
    await f.load();
    const select = f.nodes.get('cloudSaveStatus')?.children.find(node => node.tagName === 'BUTTON');
    assert(select, 'New revision requires explicit selection over current local play');
    select.onclick();
    assert.equal(f.reloads(), 1);
    assert.equal(JSON.parse(native.data.get(PENDING)).revision, 9, 'Old complete cleanup did not delete newly staged revision 9');
    assert.deepEqual(Codec.unpackSnapshot(JSON.parse(native.data.get(PENDING)).snapshot), nextSnapshot);
    assert.equal(f.get('mkty_story_plan_1_v1'), localEdit, 'Current gameplay remains intact until reload');
    const selected = reboot(native);
    assert.deepEqual(selected.snapshot(), nextSnapshot, 'Fresh document applies selected revision 9, not stale revision 8');
    assert.equal(selected.get(REVISION), '9');
    assert.equal(selected.get(DIRTY), null);
    assert.equal(selected.get(PENDING), null);
    assert.equal(selected.get(TRANSACTION), null);
  }

  // No destructive step is allowed when any prerequisite cannot be made durable.
  for (const blockedKey of [PENDING, RECOVERY, TRANSACTION]) {
    const native = nativeStorage(seed(false, false));
    native.arm(entry => entry.type === 'set' && entry.key === blockedKey);
    const f = reboot(native);
    await f.load();
    assert.equal(f.c.MKTYStorage.persistent, false, blockedKey + ': injected durability failure was exercised');
    assert.deepEqual(f.snapshot(), original, blockedKey + ': no partial restore in the memory overlay');
    assert.deepEqual(liveNative(native), original, blockedKey + ': no native checkpoint mutation');
    assert.equal(native.log.filter(x => liveKeys.has(x.key)).length, 0, blockedKey + ': live keys were never touched');
    assert.equal(f.get(REVISION), '3');
    assert.equal(f.get(DIRTY), null);
  }

  // If staged data becomes unreadable after a partial commit, startup still has to recover
  // the original before any gameplay controller reads storage. Re-decoding must not erase it.
  for (const malformed of ['{not-json', JSON.stringify({...remote, snapshot: {
    mkty_current_chapter: '9', mkty_story_plan_1_v1: JSON.stringify({trace: [['mkty-trace', 99, 1, 1, 'AA==']]})
  }})]) {
    const native = nativeStorage(seed());
    native.arm(entry => entry.type === 'set' && entry.key === 'mkty_current_chapter');
    reboot(native);
    const backup = native.data.get(RECOVERY);
    assert.deepEqual(JSON.parse(backup), original);
    assert.notDeepEqual(liveNative(native), original);
    native.data.set(PENDING, malformed); // Simulate damaged persisted transport after interruption.
    for (let i = 0; i < 2; i++) {
      const f = reboot(native);
      assertOriginal(f, native, backup, 'malformed pending, failed reboot ' + (i + 1));
      assert.equal(native.data.get(PENDING), malformed, 'Unreadable evidence is retained for recovery');
    }
  }
  console.log('PASS: actual storage/cloud durable staging, mid-remove/write/revision failures, coherent memory rollback, repeated reload recovery, first-backup preservation, durable retry guards/events/metadata-and-guard-read protection, memory-only continuation, atomic migration capture/read-recovery, local continuation/orphan recovery/reselection, committed-cleanup/new-gameplay protection, offline cached selection, newer-revision selection and malformed staged recovery');
})().catch(error => {console.error(error); process.exitCode = 1;});
