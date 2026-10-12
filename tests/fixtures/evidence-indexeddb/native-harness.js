/* Test-only native instrumentation. Served solely at evidence-adapter.test in CI.
   The adapter never imports this file. No game controller, progression or reward runs. */
(() => {
  'use strict';
  const native = {
    transaction: IDBDatabase.prototype.transaction,
    addEventListener: EventTarget.prototype.addEventListener,
    get: IDBObjectStore.prototype.get,
    add: IDBObjectStore.prototype.add,
    put: IDBObjectStore.prototype.put,
    getAll: IDBObjectStore.prototype.getAll,
    getAllKeys: IDBObjectStore.prototype.getAllKeys,
    openCursor: IDBObjectStore.prototype.openCursor,
    openKeyCursor: IDBObjectStore.prototype.openKeyCursor,
    count: IDBObjectStore.prototype.count,
    open: indexedDB.open.bind(indexedDB),
    digest: crypto.subtle.digest.bind(crypto.subtle)
  };
  const log = [], transactions = new WeakMap(), active = new Map();
  const control = {abortAt: null, holdTerminal: false, relaxed: false, reloadOnAdd: false};
  let sequence = 0, physical = 0, fixture = false;
  const held = [];
  function event(type, details = {}) {
    const row = {n: log.length, type, ...details}; log.push(row);
    if (window.nativeEvidence) void window.nativeEvidence(row).catch(() => {});
    return row;
  }
  function delivery(tx, callback) {
    if (!callback) return callback;
    return function (e) {
      if (transactions.get(tx)?.hold && ['complete', 'abort'].includes(e.type)) {
        held.push(() => typeof callback === 'function' ? callback.call(tx, e) : callback.handleEvent(e));
        event('delivery-held', {tx: transactions.get(tx).id, terminal: e.type});
      } else if (typeof callback === 'function') return callback.call(tx, e);
      else return callback.handleEvent(e);
    };
  }
  IDBTransaction.prototype.addEventListener = function (type, callback, options) {
    return native.addEventListener.call(this, type, delivery(this, callback), options);
  };
  for (const name of ['oncomplete', 'onabort']) {
    const d = Object.getOwnPropertyDescriptor(IDBTransaction.prototype, name);
    if (!d?.set || !d.configurable) throw Error('Native terminal instrumentation unsupported: ' + name);
    Object.defineProperty(IDBTransaction.prototype, name, {...d, set(fn) {d.set.call(this, delivery(this, fn));}});
  }
  IDBDatabase.prototype.transaction = function (stores, mode, options) {
    const tx = native.transaction.call(this, stores, mode, !fixture && control.relaxed && mode === 'readwrite' ? {durability: 'relaxed'} : options);
    const record = {id: ++sequence, mode: tx.mode, fixture, hold: !fixture && control.holdTerminal && tx.mode === 'readwrite',
      abortAt: !fixture ? control.abortAt : null, reloadOnAdd: !fixture && control.reloadOnAdd};
    if (record.hold) control.holdTerminal = false;
    if (record.abortAt) control.abortAt = null;
    if (record.reloadOnAdd) control.reloadOnAdd = false;
    transactions.set(tx, record); active.set(record.id, record); physical++;
    event('transaction', {tx: record.id, mode: tx.mode, stores: [...tx.objectStoreNames], durability: tx.durability, fixture});
    for (const terminal of ['complete', 'abort']) native.addEventListener.call(tx, terminal, () => {
      physical--; active.delete(record.id); event(terminal, {tx: record.id, error: tx.error?.name || null, fixture: record.fixture});
    });
    native.addEventListener.call(tx, 'error', e => event('transaction-error', {tx: record.id, error: e.target.error?.name || null}));
    return tx;
  };
  for (const kind of ['get', 'add', 'put', 'getAll', 'getAllKeys', 'openCursor', 'openKeyCursor', 'count']) {
    IDBObjectStore.prototype[kind] = function (...args) {
      const tx = this.transaction, record = transactions.get(tx);
      const request = native[kind].apply(this, args), store = this.name;
      event('request', {tx: record?.id || 'upgrade', kind, store, key: typeof args.at(-1) === 'string' ? args.at(-1) : null, fixture: fixture || !!record?.fixture});
      native.addEventListener.call(request, 'success', () => {
        event('request-success', {tx: record?.id || 'upgrade', kind, store});
        if (record?.abortAt && (record.abortAt === 'first-add' && kind === 'add' || record.abortAt === 'meta-put' && kind === 'put' && store === 'meta')) {
          record.abortAt = null; event('abort-requested-after-success', {tx: record.id, kind, store}); tx.abort();
        }
        if (record?.reloadOnAdd && kind === 'add') {
          record.reloadOnAdd = false; sessionStorage.setItem('fixture-navigation-cut', 'request-success-without-terminal-observation'); location.reload();
        }
      });
      native.addEventListener.call(request, 'error', () => event('request-error', {tx: record?.id || 'upgrade', kind, store, error: request.error?.name}));
      return request;
    };
  }
  SubtleCrypto.prototype.digest = function (algorithm, input) {
    event('digest', {bytes: input.byteLength, activeTransactions: [...active.values()].filter(x => !x.fixture).map(x => x.id)});
    return native.digest(algorithm, input).then(result => {event('digest-complete', {bytes: input.byteLength}); return result;});
  };
  window.__nativeHarness = {native, log, control, event, transactions, get physical() {return physical;},
    releaseTerminals() {const callbacks = held.splice(0); for (const cb of callbacks) cb(); return callbacks.length;},
    async fixture(fn) {fixture = true; try {return await fn();} finally {fixture = false;}},
    setFixture(value) {fixture = value;}};
})();
