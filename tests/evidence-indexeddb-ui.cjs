'use strict';
/* Native IndexedDB acceptance driver. CI only; no local HTTP listener is created.
 * All documents/modules are fulfilled at one disposable synthetic HTTPS origin.
 * Two pages share one persistent profile; isolated BrowserContexts are not used.
 * Native engine allocation, OS flush/power loss and production readiness are not claimed.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {createHash} = require('node:crypto');
const {chromium} = require('playwright');
const F = require('./evidence-indexeddb-fixture.cjs');
const root = path.resolve(__dirname, '..');
const ORIGIN = 'https://evidence-adapter.test';
const DB = 'mkty_evidence_idb_prototype_20261012';
const STORES = ['heads', 'segments', 'payloads', 'indices', 'scopes', 'meta'];
const out = process.env.MKTY_TEST_OUTPUT || path.join(os.tmpdir(), 'mkty-evidence-indexeddb-native');
const report = {status: 'not-run', groups: {}, nativeQuota: {status: 'not-run'}, versions: {}, inputs: {},
  boundary: {origin: ORIGIN, realIndexedDB: true, sameOriginPages: true, gracefulRestartOnly: true,
    strictIsHint: true, noPowerLossProof: true, noProductionActivation: true, serviceWorkers: 'blocked',
    exclusions: ['native engine clones and allocation', 'JS heap/RSS', 'origin-wide aggregate transient bound', 'site-data-loss survival']},
  events: [], diagnostics: [], network: {fulfilled: 0, rejected: []}};
let context, profile, currentGroup;
const pages = [];
const hash = value => createHash('sha256').update(value).digest('hex');
const serial = q => ({...q, payload: Array.from(q.payload)});
const request = (d, b, h = null, sealed = false) => F.makeRequest(d, Buffer.from(b), h, sealed);
const desc = (run, size = 100000, note = '', scope = 'fixture:A') => F.makeDescriptor(run, size, note, scope);
const fixtureHTML = '<!doctype html><meta charset="utf-8"><title>Synthetic IndexedDB fixture</title><body><script src="/fixture/native-harness.js"></script><script type="module" src="/fixture/bootstrap.mjs"></script>';
const bootstrap = `
import * as A from '/prototypes/evidence-indexeddb/adapter.mjs';
import * as K from '/prototypes/evidence-indexeddb/contract.mjs';
import * as C from '/prototypes/evidence-indexeddb/coordinator.mjs';
const N = window.__nativeHarness, adapters = new Map();
const done = tx => new Promise((resolve, reject) => {tx.oncomplete = resolve; tx.onabort = () => reject(tx.error || Error('fixture-abort'));});
async function rawOpen(version = 1) {return new Promise((resolve, reject) => {const q = N.native.open(A.DB_NAME, version); q.onsuccess = () => resolve(q.result); q.onerror = () => reject(q.error);});}
window.H = {A, K, C, N, adapters, done, rawOpen,
 create(id, options = {}) {const a = A.createTestAdapter({scope: 'fixture:A', ...options}); adapters.set(id, a); return a;},
 async invoke(id, method, q) {const a = adapters.get(id); if (q?.payload) q = {...q, payload: new Uint8Array(q.payload)};
  const result = await a[method](q); return {result, diagnostics: a.diagnostics, state: a.state, retainedBytes: a.retainedBytes};},
 async snapshot() {return N.fixture(async () => {const db = await rawOpen(), tx = db.transaction(A.STORES, 'readonly'), completion = done(tx), result = {};
  for (const name of A.STORES) {const store = tx.objectStore(name); const keys = store.getAllKeys(), values = store.getAll();
   values.onsuccess = () => {result[name] = values.result.map((value, i) => [keys.result[i], value instanceof Uint8Array ? Array.from(value) : value]);};}
  await completion; db.close(); return result;});},
 async mutate(store, key, patch, remove = false) {return N.fixture(async () => {const db = await rawOpen(), tx = db.transaction([store], 'readwrite'), completion = done(tx), s = tx.objectStore(store);
  if (remove) s.delete(key); else {const q = s.get(key); q.onsuccess = () => {let value = q.result;
   if (patch.__payload) value = new Uint8Array(patch.__payload); else if (patch.__replace) value = patch.__replace; else {Object.assign(value, patch); for (const k of patch.__delete || []) delete value[k]; delete value.__delete;}
   s.put(value, key);};} await completion; db.close();});},
 async reset() {for (const a of adapters.values()) a.close(); adapters.clear(); await N.fixture(() => new Promise((resolve, reject) => {const q = indexedDB.deleteDatabase(A.DB_NAME); q.onsuccess = resolve; q.onerror = () => reject(q.error); q.onblocked = () => reject(Error('fixture-delete-blocked'));}));},
 async read(id, q) {const r = await this.invoke(id, 'readSegments', q); if (r.result.segments) for (const s of r.result.segments) s.payload = Array.from(s.payload); return r;},
 async assemble(id, item, maximum) {const r = await C.assemble(adapters.get(id), item, maximum); return {...r, bytes: Array.from(r.bytes)};}
};
window.fixtureReady = true;
`;
const routeFiles = new Map([
  ['/fixture/native-harness.js', 'tests/fixtures/evidence-indexeddb/native-harness.js'],
  ...['adapter', 'contract', 'coordinator'].map(name => ['/prototypes/evidence-indexeddb/' + name + '.mjs', 'prototypes/evidence-indexeddb/' + name + '.mjs']),
  ...['storage.js', 'cloud-save.js', 'trace-codec.js', 'story-plan.js'].map(name => ['/legacy/' + name, name]),
  ['/legacy/story-plan-before-finale-evidence.js', 'tests/fixtures/story-plan-before-finale-evidence.js']
]);
function save() {fs.mkdirSync(out, {recursive: true}); fs.writeFileSync(path.join(out, 'native-indexeddb-results.json'), JSON.stringify(report, null, 2) + '\n');}
async function launch() {
  context = await chromium.launchPersistentContext(profile, {headless: true, executablePath: process.env.CHROMIUM_PATH,
    serviceWorkers: 'block', args: ['--no-sandbox'], viewport: {width: 800, height: 600}});
  const versionSession = await context.newCDPSession(context.pages()[0] || await context.newPage());
  const version = await versionSession.send('Browser.getVersion'); await versionSession.detach();
  assert.match(version.product, /Chrome|Chromium/); report.versions.chromium = version.product; report.versions.cdp = version;
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== ORIGIN) {report.network.rejected.push(url.origin + url.pathname); return route.abort('blockedbyclient');}
    const pathname = url.pathname;
    if (pathname === '/' || pathname === '/fixture.html') {report.network.fulfilled++; return route.fulfill({contentType: 'text/html', body: fixtureHTML});}
    if (pathname === '/fixture/bootstrap.mjs') {report.network.fulfilled++; return route.fulfill({contentType: 'application/javascript', body: bootstrap});}
    if (pathname === '/fixture/cloud') {report.network.fulfilled++; return route.fulfill({contentType: 'application/json', body: JSON.stringify({ok: true, revision: 2, snapshot: {mkty_life1_memory_code: 'cloud-restored'}})});}
    const file = routeFiles.get(pathname);
    if (file) {report.network.fulfilled++; return route.fulfill({contentType: 'application/javascript', body: fs.readFileSync(path.join(root, file))});}
    report.network.rejected.push(url.href); return route.abort('blockedbyclient');
  });
}
async function page() {
  const p = await context.newPage(); pages.push(p);
  p.setDefaultTimeout(12000);
  await p.exposeFunction('nativeEvidence', row => {report.events.push({group: currentGroup, page: pages.indexOf(p), ...row});});
  p.on('pageerror', error => report.events.push({group: currentGroup, type: 'pageerror', error: error.message}));
  await p.goto(ORIGIN + '/fixture.html'); await p.waitForFunction(() => window.fixtureReady === true); return p;
}
async function ready(p) {await p.waitForFunction(() => window.fixtureReady === true);}
async function fresh() {for (const p of context.pages()) await p.close(); const p = await page(); await p.evaluate(() => H.reset()); return p;}
async function open(p, id = 'a', options = {}) {return p.evaluate(async ({id, options}) => {const a = H.create(id, options); return a.open();}, {id, options});}
async function invoke(p, id, method, q) {
  const out = await p.evaluate(({id, method, q}) => H.invoke(id, method, q), {id, method, q});
  report.diagnostics.push({group: currentGroup, method, diagnostics: out.diagnostics, state: out.state, retainedBytes: out.retainedBytes});
  return out.result;
}
async function append(p, q, id = 'a') {return invoke(p, id, 'appendSegment', serial(q));}
async function snapshot(p) {return p.evaluate(() => H.snapshot());}
async function raceAppends(p, q, other, otherQ) {
  for (const [page, scope] of [[p, q.descriptor.scope], [other, otherQ.descriptor.scope]]) await page.evaluate(async scope => {
    H.adapters.get('a')?.close(); H.raceStarted = false; H.raceArmed = false; let release; H.raceGate = new Promise(resolve => {release = resolve;}); H.releaseRace = release;
    H.create('a', {scope, crypto: {subtle: {digest: async (...args) => {if (H.raceArmed) {H.raceStarted = true; await H.raceGate;} return crypto.subtle.digest(...args);}}}}); await H.adapters.get('a').open(); H.raceArmed = true;
  }, scope);
  await Promise.all([[p, q], [other, otherQ]].map(([page, value]) => page.evaluate(value => {H.racing = H.invoke('a', 'appendSegment', value);}, serial(value))));
  await Promise.all([p, other].map(page => page.waitForFunction(() => H.raceStarted)));
  await Promise.all([p, other].map(page => page.evaluate(() => {H.raceArmed = false; H.releaseRace();})));
  return Promise.all([p, other].map(async page => {const value = await page.evaluate(() => H.racing); report.diagnostics.push({group: currentGroup, method: 'appendSegment', diagnostics: value.diagnostics}); return value.result;}));
}
async function recover(p, scope = 'fixture:A', cursor = null, id = 'a', extra = {}) {return invoke(p, id, 'recover', {scope, cursor, ...extra});}
async function read(p, q, id = 'a') {
  const result = await p.evaluate(({id, q}) => H.read(id, q), {id, q});
  report.diagnostics.push({group: currentGroup, method: 'readSegments', diagnostics: result.diagnostics}); return result.result;
}
async function allBytes(p, item, id = 'a') {
  let q = {captureIdentity: item.captureIdentity, throughHead: item.head.token}, bytes = [], count = 0;
  do {const r = await read(p, q, id); assert.equal(r.status, 'page', r.reason); assert(r.payloadBytes <= 65536);
    for (const s of r.segments) bytes.push(...s.payload); q = r.nextCursor; assert(++count <= 10000, 'bounded test assembly');} while (q);
  return Buffer.from(bytes);
}
async function itemFor(p, run, scope = 'fixture:A', id = 'a') {
  let cursor = null;
  do {const r = await recover(p, scope, cursor, id); assert.equal(r.status, 'page', r.reason); const item = r.heads.find(item => item.descriptor.run === run); if (item) return item; cursor = r.nextCursor;} while (cursor);
  throw Error('Fixture capture not found: ' + run);
}
async function test(group, name, fn) {
  currentGroup = group; report.groups[group] ||= []; const row = {name, status: 'running'}; report.groups[group].push(row); save();
  const start = Date.now();
  try {const details = await fn(); Object.assign(row, {status: 'passed', ms: Date.now() - start, ...(details === undefined ? {} : {details})}); console.log('PASS ' + group + ': ' + name);}
  catch (error) {Object.assign(row, {status: 'failed', ms: Date.now() - start, error: error.stack}); throw error;}
  finally {save();}
}
function noAuthority(result) {assert.doesNotMatch(JSON.stringify(result), /"(?:mayAward|eligible|mayAdvance|mayRetire|mayRetireCapturedCheckpoint)"\s*:/);}
function counter(s) {return s.meta.find(([key]) => key === 'global')[1];}
function validateEvents(events) {
  for (const event of events) if (event.type === 'digest') {assert.equal(event.activeTransactions.length, 0, 'No digest starts while an adapter transaction is physically active'); assert(event.bytes <= 66048, 'bounded WebCrypto input');}
  for (const event of events) if (event.type === 'transaction' && event.mode === 'readwrite' && !event.fixture) assert.equal(event.durability, 'strict');
}

(async () => {
  if (process.env.GITHUB_ACTIONS !== 'true' || process.env.CI !== 'true') throw Error('Native fixture runs only in authorized GitHub CI; local browsers/listeners are prohibited.');
  const prepared = F.prepareInputs(); report.inputs = prepared.sourceHashes; report.qualifications = prepared.qualifications;
  report.versions = {node: process.version, playwright: require('playwright/package.json').version}; assert.equal(report.versions.playwright, '1.58.2');
  report.commit = process.env.GITHUB_SHA; assert.match(report.commit || '', /^[a-f0-9]{40}$/);
  report.testHashes = Object.fromEntries(['tests/evidence-indexeddb-ui.cjs', 'tests/evidence-indexeddb.cjs', 'tests/evidence-indexeddb-fixture.cjs', 'tests/fixtures/evidence-indexeddb/native-harness.js', '.github/workflows/evidence-indexeddb-tests.yml'].map(file => [file, hash(fs.readFileSync(path.join(root, file)))]));
  report.adapterHashes = Object.fromEntries(['adapter', 'contract', 'coordinator'].map(name => [name + '.mjs', hash(fs.readFileSync(path.join(root, 'prototypes/evidence-indexeddb/' + name + '.mjs')))]));
  profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mkty-evidence-idb-profile-')); await launch(); report.status = 'running';
  await test('A', '24 original-admission/exact-byte artifacts through real IDB and reload', async () => {
    const p = await fresh(); assert.equal((await open(p)).status, 'open'); const rows = [];
    await p.evaluate(() => {localStorage.setItem('mkty_points', '12250'); localStorage.setItem('mkty_pending_v2_101', 'synthetic-unchanged'); localStorage.setItem('source-sentinel', 'exact-source-v1');});
    for (const artifact of prepared.artifacts) {
      let head = null, segments = 0;
      for (let at = 0; at < artifact.bytes.length; at += artifact.segmentBytes || 65536) {
        const end = Math.min(artifact.bytes.length, at + (artifact.segmentBytes || 65536));
        const q = request(artifact.descriptor, artifact.bytes.subarray(at, end), head, end === artifact.bytes.length);
        const r = await append(p, q); assert.equal(r.status, 'committed', r.reason); assert.equal(r.receipt.acknowledgement, 'idb-transaction-complete'); assert.equal(r.receipt.durability, 'strict'); noAuthority(r); head = r.currentHead; segments++;
      }
      rows.push({name: artifact.name, bytes: artifact.bytes.length, segments, sha256: hash(artifact.bytes)});
    }
    await p.reload(); await ready(p); assert.equal((await open(p)).status, 'open');
    for (const artifact of prepared.artifacts) {const item = await itemFor(p, artifact.descriptor.run); const bytes = await allBytes(p, item); F.verifyRecovered(artifact, bytes); noAuthority(item);}
    assert.deepEqual(await p.evaluate(() => ['mkty_points', 'mkty_pending_v2_101', 'source-sentinel'].map(k => localStorage.getItem(k))), ['12250', 'synthetic-unchanged', 'exact-source-v1']);
    validateEvents(await p.evaluate(() => H.N.log)); return {artifacts: rows, qualifiers: prepared.qualifications};
  });
  await test('A', 'one segment versus many segments matches frozen byte and head vectors', async () => {
    const p = await fresh(); await open(p); const artifact = prepared.artifacts.find(a => a.bytes.length <= 65536);
    for (const size of [65536, 29]) {
      const d = {...artifact.descriptor, run: 'same-bytes-' + size}, reference = F.S.makeAdapter(F.S.createImage()); let head = null;
      for (let at = 0; at < artifact.bytes.length; at += size) {const end = Math.min(at + size, artifact.bytes.length), q = request(d, artifact.bytes.subarray(at, end), head, end === artifact.bytes.length), r = await append(p, q);
        assert.equal(r.status, 'committed'); const expected = await reference.appendSegment(q); assert.equal(expected.status, 'committed'); assert.deepEqual(r.currentHead, expected.currentHead); head = r.currentHead;}
      assert.deepEqual(await allBytes(p, await itemFor(p, d.run)), artifact.bytes);
    }
  });
  await test('B', 'native add-success and final-counter-success aborts roll every store back', async () => {
    const p = await fresh(); await open(p); const base = await append(p, request(desc('prior'), Buffer.from('prior'))); assert.equal(base.status, 'committed');
    for (const abortAt of ['first-add', 'meta-put']) {
      const before = await snapshot(p), start = await p.evaluate(() => H.N.log.length);
      await p.evaluate(abortAt => {H.N.control.abortAt = abortAt;}, abortAt);
      const r = await append(p, request(desc('aborted-' + abortAt), Buffer.from('candidate'))); assert.equal(r.status, 'refused'); assert.deepEqual(await snapshot(p), before);
      const events = await p.evaluate(start => H.N.log.slice(start), start);
      assert(events.some(e => e.type === 'abort-requested-after-success')); assert(events.some(e => e.type === 'abort')); assert(!events.some(e => e.type === 'complete' && e.tx === events.find(x => x.type === 'abort-requested-after-success').tx));
      noAuthority(r);
    }
  });
  await test('B', 'delayed prehash owns copied bytes and opens no transaction; read hash is post-complete', async () => {
    const p = await fresh();
    await p.evaluate(() => {
      let released; H.hashGate = new Promise(resolve => {released = resolve;}); H.releaseHash = released; H.hashStarted = false;
      H.create('a', {crypto: {subtle: {digest: async (...args) => {H.hashStarted = true; await H.hashGate; return crypto.subtle.digest(...args);}}}});
    });
    const d = desc('copied-prehash'), q = request(d, Buffer.from('immutable'));
    await p.evaluate(q => {H.caller = {...q, payload: new Uint8Array(q.payload)}; H.pending = H.adapters.get('a').appendSegment(H.caller);}, serial(q));
    await p.waitForFunction(() => H.hashStarted);
    assert.equal((await p.evaluate(() => H.N.log)).filter(e => e.type === 'transaction').length, 0);
    await p.evaluate(() => {H.caller.payload.fill(88); H.caller.descriptor.note = 'caller-mutated'; H.releaseHash();});
    const r = await p.evaluate(() => H.pending); assert.equal(r.status, 'committed');
    assert.deepEqual(await allBytes(p, await itemFor(p, d.run)), q.payload);
    const events = await p.evaluate(() => H.N.log); validateEvents(events);
    const writeTx = events.find(e => e.type === 'transaction' && e.mode === 'readwrite' && !e.fixture);
    assert(events.findIndex(e => e.type === 'digest-complete') < events.indexOf(writeTx));
    const reads = events.filter(e => e.type === 'transaction' && e.mode === 'readonly' && !e.fixture);
    assert(reads.length > 0); return {nativeDigests: events.filter(e => e.type === 'digest').length};
  });
  await test('C', 'same-origin real two-page contention for distinct and identical next records', async () => {
    const p = await fresh(), other = await page(); await open(p); await open(other);
    assert.equal(await p.evaluate(() => location.origin), await other.evaluate(() => location.origin));
    const d = desc('race-different'), seed = await append(p, request(d, Buffer.from('seed'))); assert.equal(seed.status, 'committed');
    const q1 = request(d, Buffer.from('left'), seed.currentHead), q2 = request(d, Buffer.from('right'), seed.currentHead);
    const before = await snapshot(p), race = await raceAppends(p, q1, other, q2);
    assert.equal(race.filter(r => r.status === 'committed').length, 1); assert.equal(race.filter(r => r.status === 'conflict').length, 1);
    assert.equal(counter(await snapshot(p)).segments, counter(before).segments + 1);
    const sameD = desc('race-same'), same = request(sameD, Buffer.from('exact'));
    const identical = await raceAppends(p, same, other, same);
    assert.deepEqual(identical.map(r => r.status).sort(), ['committed', 'duplicate']); assert.deepEqual(identical[0].receipt, identical[1].receipt);
    const after = await snapshot(p); assert.equal(counter(after).captures, 2); assert.equal(after.indices.length, 2); assert.equal(after.scopes[0][1].highWater, 2);
    return {different: race.map(r => r.status), identical: identical.map(r => r.status), sharedProfile: true};
  });
  await test('C', 'stale guard/sealed conflicts and duplicate-before-guard returns newer head', async () => {
    const p = await fresh(), other = await page(); await open(p); await open(other); const d = desc('later-head', 24), q0 = request(d, Buffer.from('ab'));
    const first = await append(p, q0); assert.equal(first.status, 'committed');
    const next = await append(other, request(d, Buffer.from('cd'), first.currentHead)); assert.equal(next.status, 'committed');
    const retry = await append(p, q0); assert.equal(retry.status, 'duplicate'); assert.deepEqual(retry.receipt, first.receipt); assert.deepEqual(retry.currentHead, next.currentHead);
    const before = await snapshot(p); const stale = await append(p, request(d, Buffer.from('zz'), first.currentHead)); assert.equal(stale.status, 'conflict'); assert.deepEqual(await snapshot(p), before);
    const sealedD = desc('sealed', 24), full = await append(p, request(sealedD, Buffer.from('123456789012345678901234'), null, true)); assert.equal(full.status, 'committed');
    const conflict = await append(other, request(sealedD, Buffer.from('different'))); assert.equal(conflict.status, 'conflict');
  });
  await test('C', 'two pages create new captures and scopes with exact shared counters', async () => {
    const p = await fresh(), other = await page(); await open(p); await open(other, 'a', {scope: 'fixture:B'});
    const qa = request(desc('new-a'), Buffer.from('a')), qb = request(desc('new-b', 100000, '', 'fixture:B'), Buffer.from('b'));
    const [a, b] = await raceAppends(p, qa, other, qb); assert.equal(a.status, 'committed'); assert.equal(b.status, 'committed');
    const s = await snapshot(p); assert.equal(counter(s).captures, 2); assert.equal(counter(s).segments, 2); assert.deepEqual(s.scopes.map(x => x[1].highWater), [1, 1]); assert.equal(s.indices.length, 2);
    const da = F.S.descriptor(qa.descriptor), db = F.S.descriptor(qb.descriptor);
    const expected = 384 + [da, db].reduce((sum, d) => {const c = F.S.metadataCharges(d, 1); return sum + 1 + 4096 + c.head + c.index + c.counters;}, 0);
    assert.equal(counter(s).bytes, expected); return {counter: counter(s)};
  });
  await test('D', 'known native completion loses wrapper receipt on actual reload, then exact retry', async () => {
    const p = await fresh(); await open(p); const d = desc('known-lost'), q = request(d, Buffer.from('known-complete'));
    await p.evaluate(q => {H.receiptDelivered = false; H.knownWrite = H.invoke('a', 'appendSegment', q).then(value => {H.committed = value; return new Promise(() => {});});}, serial(q));
    await p.waitForFunction(() => H.committed?.result.status === 'committed'); assert.equal(await p.evaluate(() => H.receiptDelivered), false);
    const prior = await p.evaluate(() => H.committed.result); await p.reload(); await ready(p); await open(p);
    const next = await append(p, request(d, Buffer.from('later'), prior.currentHead)); assert.equal(next.status, 'committed');
    const retry = await append(p, q); assert.equal(retry.status, 'duplicate'); assert.deepEqual(retry.receipt, prior.receipt); assert.deepEqual(retry.currentHead, next.currentHead);
    assert.equal(counter(await snapshot(p)).segments, 2); return {observedTerminal: 'complete', wrapperReceiptDelivered: false};
  });
  await test('D', 'document loss at add success permits only all-or-none native archive state', async () => {
    const p = await fresh(); await open(p); const q = request(desc('unobserved-terminal'), Buffer.from('unknown-document'));
    const before = await snapshot(p); await p.evaluate(() => {H.N.control.reloadOnAdd = true;});
    await Promise.all([p.waitForEvent('framenavigated', frame => frame === p.mainFrame()), p.evaluate(q => {void H.invoke('a', 'appendSegment', q);}, serial(q))]);
    await ready(p); assert.equal(await p.evaluate(() => sessionStorage.getItem('fixture-navigation-cut')), 'request-success-without-terminal-observation'); await open(p);
    const s = await snapshot(p), committed = counter(s).segments === counter(before).segments + 1;
    if (!committed) assert.deepEqual(s, before); else {assert.equal(s.heads.length, 1); assert.equal(s.segments.length, 1); assert.equal(s.payloads.length, 1); assert.equal(s.indices.length, 1); assert.equal(s.scopes[0][1].highWater, 1); assert.deepEqual(await allBytes(p, await itemFor(p, q.descriptor.run)), q.payload);}
    const retry = await append(p, q); assert.equal(retry.status, committed ? 'duplicate' : 'committed'); return {callerOutcome: 'unknown', recovered: committed ? 'all' : 'none'};
  });
  await test('D', 'graceful persistent Chromium profile restart recovers complete and incomplete bytes', async () => {
    let p = await fresh(); await open(p); const full = request(desc('persistent-complete', 24), Buffer.alloc(24, 51), null, true), partial = request(desc('persistent-prefix'), Buffer.from('incomplete'));
    assert.equal((await append(p, full)).status, 'committed'); assert.equal((await append(p, partial)).status, 'committed'); const before = await snapshot(p);
    await context.close(); context = null; await launch(); p = await page(); const opening = await open(p); assert.equal(opening.status, 'open'); assert.equal(opening.createdNew, false);
    assert.deepEqual(await snapshot(p), before); for (const q of [full, partial]) assert.deepEqual(await allBytes(p, await itemFor(p, q.descriptor.run)), q.payload);
    const incomplete = await itemFor(p, partial.descriptor.run); assert.equal(incomplete.head.sealed, false); assert.equal((await append(p, full)).status, 'duplicate');
    return {restart: 'graceful-browser-context-close-and-relaunch-same-profile', powerLoss: 'not-tested'};
  });
  await test('D', 'disposable origin clearing loses IDB and old pinned receipt explicitly refuses', async () => {
    const p = await fresh(); await open(p); const q = request(desc('site-data-loss', 24), Buffer.alloc(24, 12), null, true), committed = await append(p, q); assert.equal(committed.status, 'committed');
    await p.evaluate(() => {localStorage.setItem('cleared-origin-sentinel', 'yes'); for (const a of H.adapters.values()) a.close();});
    const cdp = await context.newCDPSession(p); await cdp.send('Storage.clearDataForOrigin', {origin: ORIGIN, storageTypes: 'indexeddb,local_storage'}); await cdp.detach();
    await p.reload(); await ready(p); const opened = await open(p); assert.equal(opened.createdNew, true); assert.equal(await p.evaluate(() => localStorage.getItem('cleared-origin-sentinel')), null);
    const pinned = await read(p, {captureIdentity: committed.receipt.captureIdentity, throughHead: committed.currentHead.token}); assert.equal(pinned.status, 'refused'); assert.equal(Object.hasOwn(pinned, 'segments'), false);
    return {siteDataLossSurvival: false, createdNewDisclosed: true, oldReceiptRefused: true};
  });
  await test('E', 'fixed logical quota refusal retains every previously committed record', async () => {
    const p = await fresh(); await open(p); const d = desc('logical-quota', 8388000); let head = null, commits = 0, refused;
    while (commits < 128) {
      const q = request(d, Buffer.alloc(65536, commits % 251), head), metadata = await p.evaluate(() => H.N.fixture(async () => {const db = await H.rawOpen(), tx = db.transaction(['meta'], 'readonly'), completion = H.done(tx), r = tx.objectStore('meta').get('global'); await completion; db.close(); return r.result;}));
      const charges = F.S.metadataCharges(F.S.descriptor(d), 1), peak = metadata.bytes + 65536 + 4096 + charges.head + (head ? 0 : charges.index) + charges.counters + 384 + F.S.validate(q).requestBytes;
      const before = peak > 8388608 ? await snapshot(p) : null, r = await append(p, q);
      if (r.status !== 'committed') {assert.equal(r.status, 'refused'); assert.match(r.reason, /quota/); assert(before, 'predicted exact fixed-Q staging threshold'); assert.deepEqual(await snapshot(p), before); refused = r; break;}
      head = r.currentHead; commits++;
    }
    assert(refused, 'logical quota reached within fixed maximum'); const s = await snapshot(p); assert.equal(counter(s).segments, commits); assert(counter(s).bytes <= 8388608); assert(head.total > 7000000);
    assert.equal((await itemFor(p, d.run)).head.sealed, false); return {kind: 'logical-quota-refusal', committedSegments: commits, counters: counter(s), refusal: refused};
  });
  await test('E', 'Chromium quota override yields actual native QuotaExceededError below logical Q', async () => {
    const p = await fresh(); await open(p); const prior = request(desc('quota-prior'), Buffer.from('prior')); assert.equal((await append(p, prior)).status, 'committed');
    const cdp = await context.newCDPSession(p); const evidence = {kind: 'native-browser-quota', status: 'unverified', protocol: 'Storage.overrideQuotaForOrigin', prior: await cdp.send('Storage.getUsageAndQuota', {origin: ORIGIN})};
    report.nativeQuota = evidence;
    try {
      await cdp.send('Storage.overrideQuotaForOrigin', {origin: ORIGIN, quotaSize: 1});
      evidence.override = await cdp.send('Storage.getUsageAndQuota', {origin: ORIGIN}); assert.equal(evidence.override.overrideActive, true);
      let observed = false;
      for (let n = 0; n < 16; n++) {
        const before = await snapshot(p), mark = await p.evaluate(() => H.N.log.length), bytes = Buffer.alloc(65536); for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 131 + n * 17) % 251;
        const result = await append(p, request(desc('native-quota-' + n), bytes)); const events = await p.evaluate(mark => H.N.log.slice(mark), mark);
        const nativeError = events.find(e => (e.type === 'request-error' || e.type === 'abort') && e.error === 'QuotaExceededError');
        if (nativeError) {assert.equal(result.status, 'refused'); assert.deepEqual(await snapshot(p), before); assert(events.some(e => e.type === 'abort')); Object.assign(evidence, {status: 'verified', result, nativeError, counters: counter(before), events}); observed = true; break;}
        assert.equal(result.status, 'committed', 'logical refusal/injected abort cannot count as native quota');
      }
      assert(observed, 'Native quota remains unverified: override produced no actual QuotaExceededError');
    } catch (error) {if (evidence.status !== 'verified') evidence.reason = error.message; throw error;}
    finally {await cdp.send('Storage.overrideQuotaForOrigin', {origin: ORIGIN}).catch(error => {evidence.resetError = error.message;}); await cdp.detach();}
    return evidence;
  });
  await test('F', 'strict hint, missing APIs, insecure context and policy denial fail closed', async () => {
    const p = await fresh(); await open(p); const before = await snapshot(p);
    await p.evaluate(() => {H.N.control.relaxed = true;}); const r = await append(p, request(desc('strict-unavailable'), Buffer.from('no'))); assert.equal(r.reason, 'unsupported-durability');
    await p.evaluate(() => {H.N.control.relaxed = false;}); assert.deepEqual(await snapshot(p), before);
    const cases = await p.evaluate(async () => {
      const result = [];
      for (const [name, options] of [['idb', {indexedDB: null}], ['crypto', {crypto: null}], ['insecure', {secureContext: false}], ['policy', {openRequestFactory() {throw new DOMException('Fixture policy denial', 'SecurityError');}}]]) {
        const a = H.create(name, options); result.push({name, result: await a.open()});
      }
      return result;
    });
    assert.deepEqual(cases.map(x => x.result.reason), ['indexeddb-unavailable', 'webcrypto-unavailable', 'insecure-context', 'storage-unavailable']);
    const encoding = await p.evaluate(async () => {const saved = TextDecoder; window.TextDecoder = undefined; try {return await H.create('encoding').open();} finally {window.TextDecoder = saved;}}); assert.equal(encoding.reason, 'encoding-unavailable');
    const digestUnavailable = await p.evaluate(async q => {const a = H.create('sha-unavailable', {crypto: {subtle: {digest: () => Promise.reject(new DOMException('SHA-256 unavailable', 'NotSupportedError'))}}}); return a.appendSegment({...q, payload: new Uint8Array(q.payload)});}, serial(request(desc('unsupported-sha'), Buffer.from('no')))); assert.equal(digestUnavailable.status, 'refused');
    assert.deepEqual(await snapshot(p), before); return {cases, encoding, digestUnavailable};
  });
  await test('F', 'real versionchange drains delayed work and refuses existing newer schema', async () => {
    const p = await fresh(); await open(p); await p.evaluate(() => H.adapters.get('a').close());
    await p.evaluate(async () => {
      H.hold = false; H.started = false; let release; H.gate = new Promise(r => {release = r;}); H.release = release;
      H.create('a', {crypto: {subtle: {digest: async (...args) => {if (H.hold) {H.started = true; await H.gate;} return crypto.subtle.digest(...args);}}}}); await H.adapters.get('a').open(); H.hold = true;
    });
    await p.evaluate(q => {H.pending = H.invoke('a', 'appendSegment', q);}, serial(request(desc('drained'), Buffer.from('held')))); await p.waitForFunction(() => H.started);
    await p.evaluate(async () => {H.upgrader = await H.rawOpen(2);}); assert.equal(await p.evaluate(() => H.adapters.get('a').state), 'draining');
    await p.evaluate(() => H.release()); const stale = await p.evaluate(() => H.pending); assert.equal(stale.result.reason, 'adapter-closed');
    const newer = await open(p, 'newer'); assert.equal(newer.reason, 'unsupported-version'); await p.evaluate(() => H.upgrader.close());
  });
  await test('F', 'blocked native v2 test-factory request is abandoned and late upgrade aborts', async () => {
    const p = await fresh(); await open(p); await p.evaluate(() => H.adapters.get('a').close());
    const blocked = await p.evaluate(async () => {
      H.blocker = await H.rawOpen(1); H.blocker.onversionchange = () => {H.blockerSawVersionChange = true;};
      H.blockedTerminal = false;
      const a = H.create('blocked', {openRequestFactory(name, version) {
        if (name !== H.A.DB_NAME || version !== 1) throw Error('public database/version changed');
        const r = indexedDB.open(name, 2); r.addEventListener('error', () => {H.blockedTerminal = true;});
        r.addEventListener('success', () => {H.lateConnectionExposedByNative = true; r.result.close(); H.blockedTerminal = true;}); return r;
      }}); return a.open();
    });
    assert.equal(blocked.reason, 'open-blocked'); assert.equal(await p.evaluate(() => H.blockerSawVersionChange), true);
    assert.equal((await open(p, 'repeated')).reason, 'busy'); assert.equal((await invoke(p, 'blocked', 'open')).reason, 'busy');
    await p.evaluate(() => H.blocker.close()); await p.waitForFunction(() => H.blockedTerminal);
    const late = await p.evaluate(async () => {const db = await H.rawOpen(1); const version = db.version; db.close(); return {version, nativeSuccess: !!H.lateConnectionExposedByNative};});
    assert.deepEqual(late, {version: 1, nativeSuccess: false}); assert.equal((await open(p, 'fresh')).status, 'open');
    return {factoryTranslation: 'fixed v1 request translated externally to native v2 for blocked lifecycle only', retainedVersion: 1};
  });
  await test('F', 'watchdog while digest or native terminal delivery is pending retains exact realm slot', async () => {
    let p = await fresh(); await p.evaluate(() => {
      H.started = false; let release; H.gate = new Promise(r => {release = r;}); H.release = release;
      H.create('a', {watchdogMs: 30, crypto: {subtle: {digest: async (...args) => {H.started = true; await H.gate; return crypto.subtle.digest(...args);}}}});
    });
    const timeout = await append(p, request(desc('digest-timeout'), Buffer.from('held'))); assert.equal(timeout.reason, 'operation-timeout'); assert.equal((await open(p, 'b')).reason, 'busy');
    await p.evaluate(() => H.release());
    await p.waitForFunction(() => H.adapters.get('a').diagnostics.liveAccountedBytes === 0);
    assert.equal((await open(p, 'c')).status, 'open');
    p = await fresh(); await open(p, 'a', {watchdogMs: 100}); const q = request(desc('terminal-held'), Buffer.from('completed-native'));
    await p.evaluate(() => {H.N.control.holdTerminal = true;}); const unknown = await append(p, q); assert.equal(unknown.status, 'outcomeUnknown'); assert.equal(unknown.reason, 'terminal-unobserved');
    assert((await p.evaluate(() => H.N.log)).some(e => e.type === 'complete' && !e.fixture), 'actual native terminal is separately observed by fixture');
    assert.equal((await open(p, 'other')).reason, 'busy'); assert(await p.evaluate(() => H.adapters.get('a').retainedBytes > 0));
    assert.equal(await p.evaluate(() => H.N.releaseTerminals()), 1);
    await p.waitForFunction(() => H.adapters.get('a').diagnostics.terminal === 'complete');
    const originalSettlement = await p.evaluate(() => H.adapters.get('a').diagnostics.events.filter(e => e.startsWith('caller:'))); assert.deepEqual(originalSettlement, ['caller:outcomeUnknown']);
    await open(p, 'scope-b', {scope: 'fixture:B'}); const otherScope = await append(p, request(desc('other-scope-while-retained', 100000, '', 'fixture:B'), Buffer.from('blocked')), 'scope-b'); assert.equal(otherScope.reason, 'retry-pending');
    const retry = await invoke(p, 'a', 'retry'); assert.equal(retry.status, 'duplicate'); assert.equal(await p.evaluate(() => H.adapters.get('a').retainedBytes), 0);
    const settled = await p.evaluate(() => H.adapters.get('a').diagnostics.events.filter(e => e.startsWith('caller:')).length); assert.equal(settled, 1);
    p = await fresh(); await open(p, 'a', {watchdogMs: 100}); const beforeHeldAbort = await snapshot(p); await p.evaluate(() => {H.N.control.holdTerminal = true; H.N.control.abortAt = 'first-add';});
    const abortedUnknown = await append(p, request(desc('abort-terminal-held'), Buffer.from('abort-me'))); assert.equal(abortedUnknown.status, 'outcomeUnknown'); assert((await p.evaluate(() => H.N.log)).some(e => e.type === 'abort')); assert.equal((await open(p, 'blocked-after-abort')).reason, 'busy');
    assert.equal(await p.evaluate(() => H.N.releaseTerminals()), 1); await p.waitForFunction(() => H.adapters.get('a').diagnostics.terminal === 'abort');
    const abortedSettlement = await p.evaluate(() => H.adapters.get('a').diagnostics.events.filter(e => e.startsWith('caller:'))); assert.deepEqual(abortedSettlement, ['caller:outcomeUnknown']); assert.deepEqual(await snapshot(p), beforeHeldAbort); assert.equal((await invoke(p, 'a', 'retry')).status, 'committed');
    return {delayedDigest: 'refused with busy slot until completion', terminalDelivery: 'actual complete/abort held from adapter; both callers unknown; exact retries duplicate/committed', originalSettlement, abortedSettlement, retainedScopeBlocksOtherScope: true};
  });
  await test('F', 'open watchdog abandons uncancellable request; explicit close and fresh-data disclosure', async () => {
    const p = await fresh(); await open(p); await p.evaluate(() => H.adapters.get('a').close());
    const result = await p.evaluate(async () => {
      H.blocker = await H.rawOpen(); H.blocker.onversionchange = () => {}; H.doneOpen = false;
      const a = H.create('timeout-open', {watchdogMs: 30, openRequestFactory(name) {
        const r = indexedDB.open(name, 2), add = r.addEventListener.bind(r);
        r.addEventListener = (type, fn, options) => type === 'blocked' ? undefined : add(type, fn, options);
        add('error', () => {H.doneOpen = true;}); return r;
      }}); return a.open();
    });
    assert.equal(result.reason, 'open-timeout'); assert.equal((await open(p, 'busy')).reason, 'busy'); await p.evaluate(() => H.blocker.close()); await p.waitForFunction(() => H.doneOpen);
    const a = await open(p, 'usable'); assert.equal(a.status, 'open'); await p.evaluate(() => H.adapters.get('usable').close());
    assert.equal((await invoke(p, 'usable', 'recover', {scope: 'fixture:A'})).reason, 'adapter-closed');
    await p.evaluate(() => H.reset()); const missing = await open(p, 'new-data'); assert.equal(missing.createdNew, true);
    return {createdNewCannotDistinguishFirstUseFromSiteDataLoss: true};
  });
  await test('F', 'missing/corrupt schema and unknown global marker refuse without repairs', async () => {
    const cases = ['missing-store', 'key-path', 'index', 'unknown-marker']; const outcomes = [];
    for (const kind of cases) {
      const p = await fresh(); await p.evaluate(async kind => H.N.fixture(() => new Promise((resolve, reject) => {
        const r = indexedDB.open(H.A.DB_NAME, 1); r.onupgradeneeded = () => {
          for (const name of H.A.STORES) {if (kind === 'missing-store' && name === 'indices') continue;
            const s = r.result.createObjectStore(name, kind === 'key-path' && name === 'heads' ? {keyPath: 'key'} : undefined); if (kind === 'index' && name === 'heads') s.createIndex('unexpected', 'sequence');}
          r.transaction.objectStore('meta').add({version: 1, format: kind === 'unknown-marker' ? 'unknown-v9' : 'archive-bytes-v1', quota: 8388608, captureLimit: 128, bytes: 384, captures: 0, segments: 0}, 'global');
        }; r.onsuccess = () => {r.result.close(); resolve();}; r.onerror = () => reject(r.error);
      })), kind);
      const r = await open(p); assert.equal(r.status, 'refused'); assert.match(r.reason, /schema|marker/); outcomes.push({kind, reason: r.reason});
      const retained = await p.evaluate(async () => {const db = await H.rawOpen(); const state = {version: db.version, stores: [...db.objectStoreNames]}; db.close(); return state;}); assert.equal(retained.version, 1); assert.equal(retained.stores.length, kind === 'missing-store' ? 5 : 6);
    }
    return outcomes;
  });
  await test('G', 'actual legacy plan rewrite, namespace migration, clear and retry leave IDB intact', async () => {
    const p = await fresh(); await open(p); const q = request(desc('legacy-independent', 24), Buffer.alloc(24, 7), null, true); assert.equal((await append(p, q)).status, 'committed'); const idbBefore = await snapshot(p);
    await p.evaluate(() => {
      localStorage.clear(); sessionStorage.clear(); H.rawStorage = localStorage;
      localStorage.setItem('mkty_life1_memory_code', 'legacy-code'); localStorage.setItem('mkty_points', '12250'); localStorage.setItem('mkty_pending_v2_101', 'pending-sentinel');
      sessionStorage.setItem('mkty_session_v1_101', JSON.stringify({token: 'fixture-token'})); window.Telegram = {WebApp: {initData: 'user=' + encodeURIComponent(JSON.stringify({id: 101}))}};
      const set = Storage.prototype.setItem; Storage.prototype.setItem = function (key, value) {if (window.fixtureLocalQuota) throw new DOMException('Synthetic legacy failure', 'QuotaExceededError'); return set.call(this, key, value);};
    });
    await p.addScriptTag({url: ORIGIN + '/legacy/storage.js'});
    const migrated = await p.evaluate(() => ({logical: localStorage.getItem('mkty_life1_memory_code'), legacy: H.rawStorage.getItem('mkty_life1_memory_code'), namespaced: H.rawStorage.getItem('mkty_account_v3_101:mkty_life1_memory_code'), owner: H.rawStorage.getItem('mkty_legacy_owner_v3')}));
    assert.deepEqual(migrated, {logical: 'legacy-code', legacy: 'legacy-code', namespaced: 'legacy-code', owner: '101'});
    await p.addScriptTag({url: ORIGIN + '/legacy/story-plan.js'}); const retainedPointer = await p.evaluate(() => {H.plan = {...StoryPlan.fresh(8, 9008, 2), finaleEvidence: {sentinel: 'old-parser-will-drop'}}; return StoryPlan.restore(H.plan).finaleEvidence;}); assert.deepEqual(retainedPointer, {sentinel: 'old-parser-will-drop'});
    await p.addScriptTag({url: ORIGIN + '/legacy/story-plan-before-finale-evidence.js'});
    const rewrite = await p.evaluate(() => {const old = StoryPlan.restore(H.plan); localStorage.setItem('mkty_story_plan_8_v1', JSON.stringify(old)); return old;});
    assert.equal(Object.hasOwn(rewrite, 'finaleEvidence'), false); assert.deepEqual(await snapshot(p), idbBefore);
    const retry = await p.evaluate(async () => {
      window.fixtureLocalQuota = true; localStorage.setItem('mkty_life1_memory_code', 'memory-overlay'); await Promise.resolve();
      const failed = MKTYStorage.persistent, failedRetry = MKTYStorage.retry(); window.fixtureLocalQuota = false;
      document.querySelector('#storageRecovery button').click();
      return {failed, failedRetry, persistent: MKTYStorage.persistent, logical: localStorage.getItem('mkty_life1_memory_code'), native: H.rawStorage.getItem('mkty_account_v3_101:mkty_life1_memory_code')};
    });
    assert.deepEqual(retry, {failed: false, failedRetry: false, persistent: true, logical: 'memory-overlay', native: 'memory-overlay'}); assert.deepEqual(await snapshot(p), idbBefore);
    const scopes = await p.evaluate(() => {
      Telegram.WebApp.initData = 'user=' + encodeURIComponent(JSON.stringify({id: 202})); localStorage.setItem('mkty_life1_memory_code', 'other-scope');
      Telegram.WebApp.initData = 'user=' + encodeURIComponent(JSON.stringify({id: 101})); const returned = localStorage.getItem('mkty_life1_memory_code');
      localStorage.clear(); return {returned, cleared: localStorage.getItem('mkty_life1_memory_code'), other: H.rawStorage.getItem('mkty_account_v3_202:mkty_life1_memory_code'), pending: H.rawStorage.getItem('mkty_pending_v2_101')};
    });
    assert.deepEqual(scopes, {returned: 'memory-overlay', cleared: null, other: 'other-scope', pending: 'pending-sentinel'}); assert.deepEqual(await snapshot(p), idbBefore);
    return {executed: ['frozen storage migration', 'frozen old StoryPlan.restore rewrite', 'injected localStorage failure and actual Retry saving button', 'real storage namespace change', 'actual MKTYStorage.clear'], noIDBMigration: true};
  });
  await test('G', 'actual cloud restore and injected legacy-write rollback preserve the archive', async () => {
    const p = await fresh(); await open(p); const q = request(desc('cloud-independent'), Buffer.from('archive-prefix')); await append(p, q); const idbBefore = await snapshot(p);
    await p.evaluate(() => {
      localStorage.clear(); sessionStorage.clear(); H.rawStorage = localStorage;
      window.Telegram = {WebApp: {initData: 'user=' + encodeURIComponent(JSON.stringify({id: 101}))}};
      localStorage.setItem('mkty_account_v3_101:mkty_life1_memory_code', 'outgoing'); localStorage.setItem('mkty_account_v3_101:mkty_cloud_revision', '1');
      localStorage.setItem('mkty_account_v3_101:mkty_points', '12250'); localStorage.setItem('mkty_pending_v2_101', 'pending-sentinel');
      const screen = document.createElement('section'); screen.className = 'screen active'; screen.id = 'home'; document.body.append(screen);
      window.MKTYRewards = {endpoint: '/fixture/cloud', traceProtocol: async () => null, authenticatedFetch: async url => (await fetch(url)).json()};
    });
    for (const name of ['trace-codec.js', 'storage.js', 'cloud-save.js']) await p.addScriptTag({url: ORIGIN + '/legacy/' + name});
    await p.evaluate(() => MKTYCloud.load());
    const restored = await p.evaluate(() => ({code: localStorage.getItem('mkty_life1_memory_code'), revision: localStorage.getItem('mkty_cloud_revision'), backup: JSON.parse(localStorage.getItem('mkty_cloud_recovery')), points: localStorage.getItem('mkty_points'), pending: localStorage.getItem('mkty_pending_v2_101')}));
    assert.deepEqual(restored, {code: 'cloud-restored', revision: '2', backup: {mkty_life1_memory_code: 'outgoing'}, points: '12250', pending: 'pending-sentinel'}); assert.deepEqual(await snapshot(p), idbBefore);
    // Recreate only this controlled legacy fixture, preserving the same synthetic IDB.
    await p.reload(); await ready(p); await open(p);
    await p.evaluate(() => {
      window.Telegram = {WebApp: {initData: 'user=' + encodeURIComponent(JSON.stringify({id: 101}))}}; H.rawStorage = localStorage;
      localStorage.setItem('mkty_account_v3_101:mkty_life1_memory_code', 'rollback-outgoing'); localStorage.setItem('mkty_account_v3_101:mkty_cloud_revision', '1');
      localStorage.removeItem('mkty_account_v3_101:mkty_cloud_recovery');
      const screen = document.createElement('section'); screen.className = 'screen active'; screen.id = 'home'; document.body.append(screen);
      const set = Storage.prototype.setItem; Storage.prototype.setItem = function (key, value) {if (window.fixtureFailRemote && key.endsWith(':mkty_life1_memory_code') && value === 'cloud-restored') throw new DOMException('Injected local restore write failure', 'QuotaExceededError'); return set.call(this, key, value);};
      window.MKTYRewards = {endpoint: '/fixture/cloud', traceProtocol: async () => null, authenticatedFetch: async url => (await fetch(url)).json()};
    });
    for (const name of ['trace-codec.js', 'storage.js', 'cloud-save.js']) await p.addScriptTag({url: ORIGIN + '/legacy/' + name});
    await p.evaluate(async () => {window.fixtureFailRemote = true; await MKTYCloud.load();});
    assert.deepEqual(await p.evaluate(() => ({code: localStorage.getItem('mkty_life1_memory_code'), persistent: MKTYStorage.persistent, revision: localStorage.getItem('mkty_cloud_revision')})), {code: 'rollback-outgoing', persistent: false, revision: '1'});
    await p.evaluate(() => {window.fixtureFailRemote = false; document.querySelector('#storageRecovery button').click();});
    assert.equal(await p.evaluate(() => H.rawStorage.getItem('mkty_account_v3_101:mkty_life1_memory_code')), 'rollback-outgoing'); assert.deepEqual(await snapshot(p), idbBefore);
    return {network: 'synthetic intercepted fetch only', rollback: 'actual cloud-save.js rollback, injected legacy native-write failure', idbUnchanged: true};
  });
  await test('G', 'scope mismatch refuses before access; A-to-B-to-A generation/source stays stale', async () => {
    const p = await fresh(); await open(p);
    const mismatch = request(desc('other-scope', 100000, '', 'fixture:B'), Buffer.from('b')), mark = await p.evaluate(() => H.N.log.length);
    assert.equal((await append(p, mismatch)).reason, 'scope-mismatch'); assert.equal((await recover(p, 'fixture:B')).reason, 'scope-mismatch');
    assert.equal((await p.evaluate(mark => H.N.log.slice(mark), mark)).filter(e => ['transaction', 'request'].includes(e.type)).length, 0);
    await p.evaluate(async () => {
      H.adapters.get('a').close(); H.hold = false; H.started = false; let release; H.gate = new Promise(r => {release = r;}); H.release = release;
      H.create('a', {crypto: {subtle: {digest: async (...args) => {if (H.hold) {H.started = true; await H.gate;} return crypto.subtle.digest(...args);}}}}); await H.adapters.get('a').open();
      H.context = {scope: 'fixture:A', generation: 1, sourceIdentity: 'source-v1'}; H.coordinator = H.C.createCoordinator(H.adapters.get('a'), () => H.context); H.hold = true;
    });
    const before = await snapshot(p); await p.evaluate(q => {H.pending = H.coordinator.appendSegment({...q, payload: new Uint8Array(q.payload)}, {...H.context});}, serial(request(desc('stale-prehash'), Buffer.from('stale'))));
    await p.waitForFunction(() => H.started); await p.evaluate(() => {H.context = {scope: 'fixture:B', generation: 2, sourceIdentity: 'source-v2'}; H.context = {scope: 'fixture:A', generation: 3, sourceIdentity: 'source-v3'}; H.release();});
    const stale = await p.evaluate(() => H.pending); assert.equal(stale.reason, 'stale-context'); assert.deepEqual(await snapshot(p), before);
    await p.evaluate(() => {H.hold = false; H.N.control.holdTerminal = true; H.context = {scope: 'fixture:A', generation: 4, sourceIdentity: 'source-v4'};});
    await p.evaluate(q => {H.pending = H.coordinator.appendSegment({...q, payload: new Uint8Array(q.payload)}, {...H.context});}, serial(request(desc('stale-ack'), Buffer.from('scope-A-bytes'))));
    await p.waitForFunction(() => H.N.log.some(e => e.type === 'delivery-held'));
    await p.evaluate(() => {H.context = {scope: 'fixture:B', generation: 5, sourceIdentity: 'source-v5'}; H.context = {scope: 'fixture:A', generation: 6, sourceIdentity: 'source-v6'}; H.N.releaseTerminals();});
    const late = await p.evaluate(() => H.pending); assert.equal(late.status, 'committed'); assert.equal(late.contextCurrent, false); assert.equal(late.receipt.captureIdentity.scope, 'fixture:A'); noAuthority(late);
    return {scopeLabelsAreNotAuthentication: true, originalScopeRetained: true, sourceIdentityAndGenerationBothChecked: true};
  });
  await test('H', 'bounded tiny-segment paging counts pinned/prior positions and exact required bytes', async () => {
    const p = await fresh(); await open(p); const d = desc('tiny-pages', 40); let head = null;
    for (let n = 0; n < 40; n++) {const r = await append(p, request(d, Buffer.from([n]), head, n === 39)); assert.equal(r.status, 'committed'); head = r.currentHead;}
    const item = await itemFor(p, d.run), first = await read(p, {captureIdentity: item.captureIdentity, throughHead: head.token}); assert.equal(first.status, 'page'); assert(first.nextCursor); assert(first.segments.length <= 15);
    const diagnostic = await p.evaluate(() => H.adapters.get('a').diagnostics); assert(diagnostic.segmentPositions <= 16); assert.equal(diagnostic.segmentPositions, first.segments.length + 1);
    const second = await read(p, first.nextCursor); assert.equal(second.status, 'page'); const secondDiagnostic = await p.evaluate(() => H.adapters.get('a').diagnostics); assert(secondDiagnostic.segmentPositions <= 16); assert.equal(secondDiagnostic.segmentPositions, second.segments.length + 2);
    assert.deepEqual(await allBytes(p, item), Buffer.from(Array.from({length: 40}, (_, n) => n)));
    const large = request(desc('read-byte-stop'), Buffer.alloc(4096, 8)); assert.equal((await append(p, large)).status, 'committed'); const largeItem = await itemFor(p, large.descriptor.run);
    const small = await read(p, {captureIdentity: largeItem.captureIdentity, throughHead: largeItem.head.token, maxBytes: 4095}); assert.equal(small.reason, 'page-budget-too-small'); assert.equal(small.required, 4096); assert.equal(Object.hasOwn(small, 'segments'), false);
  });
  await test('H', 'watermark membership, cursor scope/checksum, and exact escaped response budgets', async () => {
    const p = await fresh(), other = await page(), scope = '\0'.repeat(128); await open(p, 'a', {scope}); await open(other, 'a', {scope});
    for (let n = 0; n < 17; n++) assert.equal((await append(p, request(desc(String(n).padStart(2, '0'), 20, 'x'.repeat(1700), scope), Buffer.alloc(20), null, true))).status, 'committed');
    const first = await recover(p, scope); assert.equal(first.status, 'page'); assert(first.nextCursor); assert(first.heads.length < 16); assert.equal(first.watermark, 17);
    const diag = await p.evaluate(() => H.adapters.get('a').diagnostics); assert.equal(diag.indexPositions, first.heads.length + 1); assert(diag.indexPositions <= 16); assert.equal(diag.outputBytes, Buffer.byteLength(JSON.stringify(first))); assert(diag.outputBytes <= 65536);
    assert.equal((await append(other, request(desc('inserted-after-W', 20, '', scope), Buffer.alloc(20), null, true))).status, 'committed');
    let cursor = first.nextCursor, recovered = [...first.heads]; do {const r = await recover(p, scope, cursor); assert.equal(r.status, 'page'); assert.equal(r.watermark, 17); recovered.push(...r.heads); cursor = r.nextCursor;} while (cursor);
    assert.equal(recovered.length, 17); assert(!recovered.some(x => x.descriptor.run === 'inserted-after-W')); assert.equal((await recover(p, scope)).watermark, 18);
    const one = await recover(p, scope, null, 'a', {maxHeads: 1}), required = Buffer.byteLength(JSON.stringify(one));
    const tooSmall = await recover(p, scope, null, 'a', {maxHeads: 1, maxBytes: required - 1}); assert.equal(tooSmall.reason, 'page-budget-too-small'); assert.equal(tooSmall.required, required);
    assert.deepEqual(await recover(p, scope, null, 'a', {maxHeads: 1, maxBytes: required}), one);
    assert.equal((await recover(p, scope, first.nextCursor.slice(0, -1) + (first.nextCursor.endsWith('0') ? '1' : '0'))).status, 'refused');
    await open(p, 'b', {scope: 'fixture:B'}); assert.equal((await recover(p, 'fixture:B', first.nextCursor, 'b')).status, 'refused');
    const badW = await p.evaluate(scope => H.K.token('r', {scope, W: 128, next: 1}), scope); assert.equal((await recover(p, scope, badW)).reason, 'cursor-invalid');
    return {firstHeads: first.heads.length, inspectedPositions: diag.indexPositions, actualResponseBytes: diag.outputBytes, oneHeadRequired: required};
  });
  await test('H', 'metadata maximum, escaped keys, payload limits and capture ceiling stay fixed', async () => {
    const p = await fresh(); await open(p); let note = 0;
    while (note < 4096) {try {F.S.validate(request(desc('metadata-maximum', 100000, 'x'.repeat(note)), Buffer.alloc(1))); note++;} catch {break;}}
    const exact = request(desc('metadata-maximum', 100000, 'x'.repeat(note - 1)), Buffer.alloc(1)); assert.equal(F.S.validate(exact).metadataBytes, 4096); assert.equal((await append(p, exact)).status, 'committed');
    assert.equal((await append(p, request(desc('metadata-maximum', 100000, 'x'.repeat(note)), Buffer.alloc(1)))).reason, 'metadata-limit');
    for (const size of [0, 1, 65535, 65536, 65537]) {const result = await append(p, request(desc('payload-' + size), Buffer.alloc(size))); assert.equal(result.status, size === 0 || size > 65536 ? 'refused' : 'committed');}
    for (const character of ['\0', '\x01', '\x1f', '\\', '"', '\n', 'a']) {
      const scope = character.repeat(128), run = character.repeat(128); await open(p, 'escaped', {scope}); const q = request(desc(run, 20, '', scope), Buffer.alloc(20), null, true); assert.equal((await append(p, q, 'escaped')).status, 'committed');
      const s = await snapshot(p), key = F.S.keyOf(scope, run), head = s.heads.find(x => x[0] === key), index = s.indices.find(x => x[1].key === key), charges = F.S.metadataCharges(F.S.descriptor(q.descriptor), 1);
      assert(Buffer.byteLength(JSON.stringify(head[1])) + Buffer.byteLength(JSON.stringify(head[0])) <= charges.head); assert(Buffer.byteLength(JSON.stringify(index[1])) + Buffer.byteLength(JSON.stringify(index[0])) <= charges.index);
      const escapedItem = await itemFor(p, run, scope, 'escaped'); assert.deepEqual(await allBytes(p, escapedItem, 'escaped'), q.payload);
    }
    const empty = await fresh(); await open(empty);
    for (let n = 0; n < 128; n++) assert.equal((await append(empty, request(desc('capture-' + n), Buffer.from('x')))).status, 'committed');
    const before = await snapshot(empty), overflow = await append(empty, request(desc('capture-129'), Buffer.from('x'))); assert.equal(overflow.reason, 'logical-quota'); assert.deepEqual(await snapshot(empty), before); assert.equal(counter(before).captures, 128);
    return {maxMetadata: 4096, maxPayload: 65536, captures: 128};
  });
  await test('H', 'all frozen seal-shape corruptions refuse both ordinary and prior-cursor reads', async () => {
    const changes = ['missing-discriminator', 'undefined-discriminator', 'null-discriminator', 'zero-discriminator', 'string-discriminator', 'undefined-seal', 'null-seal', 'empty-seal', 'missing-seal', 'extra-seal-field', 'string-total', 'numeric-root'];
    for (const change of changes) {
      const p = await fresh(); await open(p); const d = desc('seal-corruption', 20), first = await append(p, request(d, Buffer.alloc(10))), last = await append(p, request(d, Buffer.alloc(10), first.currentHead, true)); assert.equal(last.status, 'committed');
      const key = F.S.segmentKey(F.S.keyOf(d.scope, d.run), 0);
      await p.evaluate(async ({key, change}) => H.N.fixture(async () => {
        const db = await H.rawOpen(), tx = db.transaction(['segments'], 'readwrite'), completion = H.done(tx), store = tx.objectStore('segments'), r = store.get(key);
        r.onsuccess = () => {const m = r.result;
          if (change === 'missing-discriminator') delete m.hasSeal;
          else if (change === 'undefined-discriminator') m.hasSeal = undefined;
          else if (change === 'null-discriminator') m.hasSeal = null;
          else if (change === 'zero-discriminator') m.hasSeal = 0;
          else if (change === 'string-discriminator') m.hasSeal = '';
          else if (change === 'undefined-seal') m.seal = undefined;
          else if (change === 'null-seal') m.seal = null;
          else if (change === 'empty-seal') m.seal = {};
          else {m.hasSeal = true; if (change !== 'missing-seal') m.seal = {totalBytes: change === 'string-total' ? '10' : 10, root: change === 'numeric-root' ? 0 : H.K.ZERO, ...(change === 'extra-seal-field' ? {extra: true} : {})};}
          store.put(m, key);
        }; await completion; db.close();
      }), {key, change});
      const before = await snapshot(p), args = {captureIdentity: {scope: d.scope, run: d.run}, throughHead: last.currentHead.token};
      for (const afterOrdinal of [-1, 0]) {const r = await read(p, {...args, afterOrdinal}); assert.equal(r.reason, 'segment-seal-format', change); assert.equal(Object.hasOwn(r, 'segments'), false);}
      assert.deepEqual(await snapshot(p), before);
    }
    for (const reversed of [false, true]) {const p = await fresh(); await open(p); const q = request(desc('seal-order', 20), Buffer.alloc(20), null, true);
      if (reversed) q.seal = {root: q.seal.root, totalBytes: q.seal.totalBytes}; const first = await append(p, q); assert.equal(first.status, 'committed');
      q.seal = reversed ? {totalBytes: q.seal.totalBytes, root: q.seal.root} : {root: q.seal.root, totalBytes: q.seal.totalBytes}; const retry = await append(p, q); assert.equal(retry.status, 'duplicate'); assert.deepEqual(retry.receipt, first.receipt);
    }
    const invalid = await fresh(); await open(invalid); const pristine = await snapshot(invalid);
    for (const seal of [undefined, null, {}, {totalBytes: 20, root: F.S.ZERO, extra: true}, {totalBytes: '20', root: F.S.ZERO}, {totalBytes: 20, root: 0}]) {const q = request(desc('invalid-input-seal', 20), Buffer.alloc(20)); q.seal = seal; assert.equal((await append(invalid, q)).status, 'refused'); assert.deepEqual(await snapshot(invalid), pristine);}
    const noSeal = request(desc('seal-presence', 20), Buffer.alloc(20)), committed = await append(invalid, noSeal); assert.equal(committed.status, 'committed'); const withSeal = {...noSeal, seal: {totalBytes: 20, root: F.S.chain(F.S.descriptor(noSeal.descriptor), noSeal, noSeal.payload)}}; assert.equal((await append(invalid, withSeal)).status, 'conflict');
    return {corruptions: changes.length, invalidInputSeals: 6, validSealOrderDirections: 2, sealPresenceImmutable: true};
  });
  await test('H', 'missing/altered bounded records and counters refuse and retain without silent skips', async () => {
    const kinds = ['missing-metadata', 'missing-payload', 'altered-payload', 'missing-index', 'missing-head', 'unknown-segment', 'unknown-head', 'scope-counter', 'global-counter'];
    for (const kind of kinds) {
      const p = await fresh(); await open(p); const d = desc('bounded-corruption', 24), q = request(d, Buffer.alloc(24, 17), null, true), result = await append(p, q), key = F.S.keyOf(d.scope, d.run), sk = F.S.segmentKey(key, 0); assert.equal(result.status, 'committed');
      const item = await itemFor(p, d.run);
      if (kind === 'missing-metadata') await p.evaluate(key => H.mutate('segments', key, {}, true), sk);
      if (kind === 'missing-payload') await p.evaluate(key => H.mutate('payloads', key, {}, true), sk);
      if (kind === 'altered-payload') await p.evaluate(key => H.mutate('payloads', key, {__payload: Array(24).fill(18)}), sk);
      if (kind === 'missing-index') await p.evaluate(key => H.mutate('indices', key, {}, true), F.S.keyOf(d.scope, '1'));
      if (kind === 'missing-head') await p.evaluate(key => H.mutate('heads', key, {}, true), key);
      if (kind === 'unknown-segment') await p.evaluate(key => H.mutate('segments', key, {version: 9}), sk);
      if (kind === 'unknown-head') await p.evaluate(key => H.mutate('heads', key, {version: 9}), key);
      if (kind === 'scope-counter') await p.evaluate(scope => H.mutate('scopes', scope, {highWater: 0}), d.scope);
      if (kind === 'global-counter') await p.evaluate(() => H.mutate('meta', 'global', {bytes: Number.MAX_SAFE_INTEGER}));
      const before = await snapshot(p); let r;
      if (kind === 'missing-index' || kind === 'scope-counter') r = await recover(p);
      else if (kind === 'global-counter') r = await append(p, request(desc('later-at-corrupt-global'), Buffer.from('no')));
      else r = await read(p, {captureIdentity: item.captureIdentity, throughHead: item.head.token});
      assert.equal(r.status, 'refused', kind); assert.equal(Object.hasOwn(r, 'segments'), false); assert.deepEqual(await snapshot(p), before, kind);
    }
  });
  await test('H', 'duplicate checks every immutable field and post-complete current-head checksum', async () => {
    const fields = ['version', 'binding', 'scope', 'run', 'ordinal', 'offset', 'previousRoot', 'length', 'root', 'hasSeal', 'headToken', 'payload', 'descriptor-text', 'current-head-token', 'rolled-back-head'];
    for (const field of fields) {
      const p = await fresh(); await open(p); const d = desc('duplicate-corrupt'), q = request(d, Buffer.from('first')), first = await append(p, q), later = await append(p, request(d, Buffer.from('later'), first.currentHead)); assert.equal(later.status, 'committed');
      const key = F.S.keyOf(d.scope, d.run), sk = F.S.segmentKey(key, 0);
      if (field === 'payload') await p.evaluate(sk => H.mutate('payloads', sk, {__payload: Array(5).fill(9)}), sk);
      else if (field === 'descriptor-text') await p.evaluate(async key => H.N.fixture(async () => {const db = await H.rawOpen(), tx = db.transaction(['heads'], 'readwrite'), completion = H.done(tx), store = tx.objectStore('heads'), q = store.get(key); q.onsuccess = () => {const h = q.result; h.d.text += ' '; store.put(h, key);}; await completion; db.close();}), key);
      else if (field === 'rolled-back-head') await p.evaluate(({key, head}) => H.mutate('heads', key, {head}), {key, head: first.currentHead});
      else if (field === 'current-head-token') await p.evaluate(async key => H.N.fixture(async () => {const db = await H.rawOpen(), tx = db.transaction(['heads'], 'readwrite'), completion = H.done(tx), s = tx.objectStore('heads'), r = s.get(key); r.onsuccess = () => {const v = r.result; v.head.token = v.head.token.slice(0, -1) + (v.head.token.endsWith('0') ? '1' : '0'); s.put(v, key);}; await completion; db.close();}), key);
      else await p.evaluate(({sk, field}) => H.mutate('segments', sk, {[field]: field === 'length' ? 4 : field === 'version' ? 2 : ['ordinal', 'offset'].includes(field) ? 1 : ['binding', 'root', 'previousRoot'].includes(field) ? 'f'.repeat(64) : field === 'hasSeal' ? 'false' : 'changed'}), {sk, field});
      const before = await snapshot(p), mark = await p.evaluate(() => H.N.log.length), r = await append(p, field === 'rolled-back-head' ? request(d, Buffer.from('later'), first.currentHead) : q); assert(['refused', 'conflict'].includes(r.status), field); assert.deepEqual(await snapshot(p), before);
      const events = await p.evaluate(mark => H.N.log.slice(mark), mark); assert(!events.some(e => e.type === 'request' && ['add', 'put'].includes(e.kind) && !e.fixture));
      if (field === 'current-head-token') {assert.equal(r.status, 'refused'); const terminal = events.findIndex(e => e.type === 'complete' && !e.fixture), digest = events.findIndex((e, n) => n > terminal && e.type === 'digest'); assert(terminal >= 0 && digest > terminal);}
    }
  });
  await test('I', 'storage-only oversized bytes remain inadmissible; no gameplay authority or source edits', async () => {
    const p = await fresh(); await open(p); const bytes = Buffer.alloc(1000001, 97), d = desc('storage-only-oversize', bytes.length); let head = null;
    await p.evaluate(() => {window.awards = 0; window.completions = 0; localStorage.setItem('mkty_points', '12250'); localStorage.setItem('mkty_pending_v2_101', 'pending-sentinel'); localStorage.setItem('fixture-source', 'unchanged');});
    for (let at = 0; at < bytes.length; at += 65536) {const end = Math.min(at + 65536, bytes.length), r = await append(p, request(d, bytes.subarray(at, end), head, end === bytes.length)); assert.equal(r.status, 'committed'); noAuthority(r); head = r.currentHead;}
    const item = await itemFor(p, d.run), recovered = await allBytes(p, item); assert.deepEqual(recovered, bytes); const refusals = F.verifyLimitRefusals(recovered); noAuthority(item);
    assert.deepEqual(await p.evaluate(() => ({awards, completions, points: localStorage.getItem('mkty_points'), pending: localStorage.getItem('mkty_pending_v2_101'), source: localStorage.getItem('fixture-source')})), {awards: 0, completions: 0, points: '12250', pending: 'pending-sentinel', source: 'unchanged'});
    assert.deepEqual(F.verifySources().sourceHashes, report.inputs); return refusals;
  });
  await test('H', 'all measured operation counters stay inside reviewed per-realm bounds', async () => {
    const rows = report.diagnostics.filter(row => row.diagnostics).map(row => row.diagnostics); assert(rows.length > 0);
    for (const d of rows) {
      assert(d.peakAccountedBytes <= 393216, 'transient reservation cap'); assert(d.maxHashInputBytes <= 66048, 'hash concatenation cap'); assert(d.requestBytes <= 69632, 'request lease cap'); assert(d.inputCopyBytes <= 65536, 'payload copy cap'); assert.equal(d.enumerations, 0);
      if (d.op === 'append') {assert(d.segmentPositions <= 1); assert(d.headReads <= 1); assert(d.counterReads <= 2); assert(d.payloadReads <= 1); assert(d.touchedWrites <= 6); assert(d.chainHashes <= 1);}
      if (d.op === 'read') {assert(d.segmentPositions <= 16); assert(d.payloadReads <= 16); assert(d.touchedWrites === 0);}
      if (d.op === 'recover') {assert(d.indexPositions <= 16); assert(d.headReads <= 16); assert(d.outputBytes <= 65536); assert(d.touchedWrites === 0);}
    }
    const maxima = Object.fromEntries(['requestBytes', 'inputCopyBytes', 'maxHashInputBytes', 'webCryptoCopyBytes', 'peakAccountedBytes', 'segmentPositions', 'indexPositions', 'headReads', 'touchedWrites', 'outputBytes'].map(key => [key, Math.max(...rows.map(row => row[key] || 0))]));
    for (const event of report.events) {if (event.type === 'digest') {assert.equal(event.activeTransactions.length, 0); assert(event.bytes <= 66048);}
      if (event.type === 'request' && !event.fixture) assert(!['getAll', 'getAllKeys', 'openCursor', 'openKeyCursor', 'count'].includes(event.kind), 'adapter performs direct lookups only');}
    report.maxima = maxima; report.accounting = {measured: 'adapter-owned buffer/encoded-slot reservations', nativeEngineAndJSHeap: 'excluded', wholeArtifactAssembly: 'separately bounded test ownership', aggregateAcrossContexts: 'not claimed'};
    return maxima;
  });
  assert.deepEqual(report.events.filter(event => event.type === 'pageerror'), [], 'no unexpected uncaught browser errors');
  assert.deepEqual(report.network.rejected, [], 'fixture attempted no unapproved resource loads');
  for (const group of 'ABCDEFGHI') assert(report.groups[group]?.length, 'missing required acceptance group ' + group);
  report.status = 'passed'; report.finishedAt = new Date().toISOString(); save();
  console.log('PASS: native Chromium IndexedDB groups A-I; fixture-only storage, same-origin concurrency, qualified restart and quota evidence');
})().catch(error => {report.status = 'failed'; report.error = error.stack; save(); console.error(error.stack); process.exitCode = 1;}).finally(async () => {
  if (context) await context.close().catch(error => {report.cleanupError = error.message;});
  if (profile) fs.rmSync(profile, {recursive: true, force: true}); save();
});
