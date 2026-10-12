// Synthetic CI UI only. No runtime import, controller, reward, server or fallback.
import * as A from '/prototypes/evidence-indexeddb/adapter.mjs';
import * as C from '/prototypes/evidence-indexeddb/coordinator.mjs';
import {createUnsavedResultGate, GATE_LIMIT} from '/prototypes/evidence-indexeddb/unsaved-result-gate.mjs';
import {makeSyntheticCompletion} from '/prototypes/evidence-indexeddb/synthetic-completion.mjs';
const copy = await (await fetch('/fixture/copy.json')).json();
const N = window.__nativeHarness;
const $ = id => document.getElementById(id);
const clone = value => JSON.parse(JSON.stringify(value));
const sha = async bytes => [...new Uint8Array(await N.native.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
const terminal = tx => new Promise((resolve, reject) => {
  tx.addEventListener('complete', resolve, {once:true});
  tx.addEventListener('abort', () => reject(tx.error || Error('fixture-abort')), {once:true});
});
const rawOpen = () => new Promise((resolve, reject) => {
  const q = N.native.open(A.DB_NAME, 1);
  q.onsuccess = () => resolve(q.result); q.onerror = () => reject(q.error);
});
let language = 'en', gate, adapter, base, options = {}, live, input;
let readCount = 0, activeCalls = 0, peakCalls = 0, reenterReader = false;
const counters = {captures:0, navigation:0, gameplay:0, rewards:0};
const calls = [], diagnostics = [];
const stateKeys = {EMPTY:'empty', SAVING:'saving', UNSAVED:'unsaved', VERIFYING:'verifying', READY:'ready', STALE:'stale', BLOCKED:'blocked', CONTINUED:'continued'};
function readContext() {
  if (options.throwContext) throw Error('fixture-context-unavailable');
  if (reenterReader) {reenterReader = false; H.nestedContinue = gate.continue();}
  return {...live};
}
function render() {
  const d = copy[language], v = gate?.view();
  document.documentElement.lang = language;
  document.documentElement.dir = ['ar','he'].includes(language) ? 'rtl' : 'ltr';
  for (const [id,key] of [['test-only','testOnly'],['language-label','language'],['title','title'],['warning','warning'],['retry','retry'],['continue','continue'],['summary-label','summary']]) $(id).textContent = d[key];
  $('status').textContent = d[stateKeys[v?.state || 'EMPTY']];
  $('warning').hidden = !v?.retained || ['READY','CONTINUED'].includes(v.state);
  $('reason').textContent = v?.reason || '';
  $('retry').disabled = !v?.retryEnabled;
  $('continue').disabled = !v?.continueEnabled;
  $('summary').textContent = v?.summary ? JSON.stringify(v.summary, null, 2) : '';
  document.body.dataset.state = v?.state || 'EMPTY';
  return v;
}
function changed(kind) {live = {...live, generation:live.generation + 1, sourceIdentity:live.sourceIdentity + ':' + kind};}
async function signature(q) {
  return {descriptor:clone(q.descriptor), ordinal:q.ordinal, offset:q.offset, previousRoot:q.previousRoot,
    expectedHead:q.expectedHead, seal:q.seal ? clone(q.seal) : null, length:q.payload.length, payloadSha256:await sha(q.payload)};
}
async function tracked(kind, invoke, request) {
  activeCalls++; peakCalls = Math.max(peakCalls, activeCalls);
  const mark = N.log.length, row = {kind, ...(request || {})}; calls.push(row);
  try {const r = await invoke(); row.result = kind === 'read' ? {status:r.status} : clone(r); return r;}
  finally {
    activeCalls--; const d = clone(adapter.diagnostics); diagnostics.push(d); row.operationId = d.id;
    const events = N.log.slice(mark);
    row.nativeTransactions = events.filter(e => e.type === 'transaction' && !e.fixture).map(created => {
      const end = events.find(e => e.tx === created.tx && ['complete','abort'].includes(e.type));
      return {tx:created.tx, mode:created.mode, durability:created.durability, createdEvent:created.n,
        terminal:end?.type || null, terminalEvent:end?.n ?? null, error:end?.error || null};
    });
  }
}
function begin(action) {
  H.settled = false;
  const promise = action(); render();
  H.pending = Promise.resolve(promise).then(v => {H.settled = true; render(); return v;});
  return H.pending;
}
window.H = {
  N, copy, counters, calls, diagnostics, GATE_LIMIT,
  get adapter() {return adapter;}, get gate() {return gate;}, get input() {return input;},
  async setup(config = {}) {
    if (gate) throw Error('One gate per page; use a fresh realm');
    options = {...config}; live = {scope:'fixture:A', generation:1, sourceIdentity:'synthetic-source:1'};
    adapter = A.createTestAdapter({scope:live.scope, watchdogMs:config.unknown ? 100 : 10000});
    const opened = await adapter.open();
    if (opened.status !== 'open') throw Error('fixture-open: ' + opened.reason);
    base = C.createCoordinator(adapter, readContext);
    const coordinator = Object.freeze({
      async appendSegment(q, context) {
        const sig = await signature(q);
        if (options.abortOrdinal === q.ordinal) {N.control.abortAt = 'first-add'; options.abortOrdinal = null;}
        let operation;
        if (options.unknown?.ordinal === q.ordinal) {
          const target = options.unknown; options.unknown = null;
          const barrier = N.holdNextTerminal(target.terminal);
          if (target.terminal === 'abort') N.control.abortAt = 'first-add';
          const timer = N.gateWatchdogDuring(() => {operation = base.appendSegment(q, context);}, 100);
          H.controlled = {barrier, timer, operationId:adapter.diagnostics.id};
        } else operation = base.appendSegment(q, context);
        const r = await tracked('append', () => operation, sig);
        if (options.switchAfterAppend === q.ordinal) {options.switchAfterAppend = null; changed('append');}
        return r;
      },
      retry() {return tracked('exact-retry', () => base.retry());},
      async readSegments(q) {
        const call = ++readCount;
        if (options.refuseRead === call) {
          options.refuseRead = null;
          calls.push({kind:'read-injected-refusal', call, request:clone(q)});
          return {status:'refused', reason:'operation-timeout'};
        }
        const r = await tracked('read', () => base.readSegments(q), {call, request:clone(q)});
        // Never retain returned payload pages in the evidence log.
        const row = calls.at(-1);
        if (row?.kind === 'read') row.result = {status:r.status, reason:r.reason || null, payloadBytes:r.payloadBytes, nextCursor:r.nextCursor,
          segments:r.segments?.map(s => ({ordinal:s.ordinal, offset:s.offset, length:s.length, root:s.root}))};
        if (options.switchAfterRead === call) {options.switchAfterRead = null; changed('read');}
        if (options.throwAfterRead === call) {options.throwAfterRead = null; options.throwContext = true;}
        if (options.pauseRead === call) {
          options.pauseRead = null;
          H.readBarrier = {call, request:clone(q), status:r.status};
          await new Promise(resolve => {H.releaseRead = resolve;});
        }
        return r;
      },
      recover:q => base.recover(q),
      get retainedBytes() {return base.retainedBytes;}, get inFlight() {return base.inFlight;}
    });
    gate = createUnsavedResultGate({coordinator, readContext, onContinue() {
      counters.navigation++;
      if (options.continueReentry) H.callbackReentry = gate.continue();
      if (options.continueThrow) throw Error('fixture-navigation-threw');
    }});
    const summary = {version:1, resultId:'synthetic-result-1', completedSteps:7, label:'Immutable synthetic completion / 雪 🌙'};
    input = {...makeSyntheticCompletion({scope:live.scope, run:config.run || 'synthetic-run-1', summary, totalBytes:config.totalBytes || 196608}), context:{...live}};
    H.original = {summary:clone(summary), descriptor:clone(input.descriptor), sha256:await sha(input.bytes)};
    render(); return {opened, original:H.original, view:gate.view()};
  },
  accept() {counters.captures++; return begin(() => gate.accept(input));},
  retry() {return begin(() => gate.retry());},
  continue() {const v = gate.continue(); render(); return v;},
  render, view:() => gate.view(),
  facts() {return {view:gate.view(), calls:clone(calls), counters:{...counters}, diagnostics:clone(diagnostics), peakCalls, activeCalls, readCount,
    retainedBytes:adapter.retainedBytes, live:{...live}, original:H.original, summaryText:$('summary').textContent};},
  mutateCaller() {input.bytes.fill(0); input.summary = {...input.summary, label:'caller mutation'}; input.context.sourceIdentity = 'caller mutation';},
  switch(kind) {
    if (kind === 'A-B-A') live = {...live, generation:live.generation + 2};
    else if (kind === 'scope') live = {...live, scope:'fixture:B', generation:live.generation + 1};
    else changed(kind);
    return render();
  },
  armReaderReentry() {reenterReader = true;},
  notifyLegacy(kind, invalidate = false) {
    if (!['old-writer','clear','restore'].includes(kind)) throw Error('fixture-notification');
    if (kind === 'clear') localStorage.removeItem('fixture:legacy');
    else localStorage.setItem('fixture:legacy', kind === 'restore' ? 'synthetic-restored-value' : 'synthetic-old-writer-value');
    if (invalidate) changed(kind);
    return render();
  },
  async snapshot() {
    return N.fixture(async () => {
      const db = await rawOpen(), tx = db.transaction(A.STORES, 'readonly'), done = terminal(tx), output = {};
      for (const name of A.STORES) {
        const s = tx.objectStore(name), keys = s.getAllKeys(), values = s.getAll();
        values.onsuccess = () => {output[name] = values.result.map((value,i) => [keys.result[i],value]);};
      }
      await done; db.close();
      for (const rows of Object.values(output)) for (const row of rows) if (row[1] instanceof Uint8Array) row[1] = {length:row[1].length, sha256:await sha(row[1])};
      return output;
    });
  },
  async inspect(scope = 'fixture:A') {
    const items = []; let cursor = null, pages = 0;
    do {
      const r = await base.recover({scope, cursor});
      if (r.status !== 'page') throw Error('inspection-recovery: ' + r.reason);
      for (const item of r.heads) {
        const row = {descriptor:item.descriptor, head:item.head};
        if (item.head.sealed) {const result = await C.assemble(base,item,196608); row.sha256 = await sha(result.bytes); row.pages = result.pages;}
        items.push(row);
      }
      cursor = r.nextCursor; if (++pages > 8) throw Error('inspection-page-bound');
    } while (cursor);
    return {items, pages, gate:gate.view(), counters:{...counters}};
  }
};
for (const [lang,d] of Object.entries(copy)) {const option = document.createElement('option'); option.value = lang; option.lang = lang; option.dir = ['ar','he'].includes(lang) ? 'rtl' : 'ltr'; option.textContent = d.name; $('language').append(option);}
$('language').addEventListener('change', () => {language = $('language').value; render();});
$('retry').addEventListener('click', () => {void H.retry();});
$('continue').addEventListener('click', () => H.continue());
render();
window.fixtureReady = true;
