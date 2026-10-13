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
  let terminalBarrier = null, watchdogCaptureActive = false;
  function event(type, details = {}) {
    const row = {n: log.length, type, ...details}; log.push(row);
    if (window.nativeEvidence) void window.nativeEvidence(row).catch(() => {});
    return row;
  }
  function delivery(tx, callback) {
    if (!callback) return callback;
    return function (e) {
      if (transactions.get(tx)?.hold && ['complete', 'abort'].includes(e.type)) {
        const record = transactions.get(tx);
        held.push({tx: record.id, terminal: e.type, invoke: () => typeof callback === 'function' ? callback.call(tx, e) : callback.handleEvent(e)});
        const delivered = event('delivery-held', {tx: record.id, terminal: e.type});
        if (terminalBarrier?.tx === record.id) {
          const barrier = terminalBarrier; terminalBarrier = null;
          if (barrier.terminal !== e.type || record.nativeTerminal !== e.type || !Number.isInteger(record.nativeEvent)) barrier.reject(Error('Wrong native terminal for held transaction ' + record.id));
          else barrier.resolve({tx: record.id, mode: record.mode, fixture: record.fixture, terminal: e.type, createdEvent: record.createdEvent, nativeEvent: record.nativeEvent, heldEvent: delivered.n, queued: held.filter(value => value.tx === record.id).length});
        }
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
    if (record.hold) {control.holdTerminal = false; if (terminalBarrier && terminalBarrier.tx === null) terminalBarrier.tx = record.id;}
    if (record.abortAt) control.abortAt = null;
    if (record.reloadOnAdd) control.reloadOnAdd = false;
    transactions.set(tx, record); active.set(record.id, record); physical++;
    record.createdEvent = event('transaction', {tx: record.id, mode: tx.mode, stores: [...tx.objectStoreNames], durability: tx.durability, fixture}).n;
    for (const terminal of ['complete', 'abort']) native.addEventListener.call(tx, terminal, () => {
      physical--; active.delete(record.id); record.nativeTerminal = terminal;
      record.nativeEvent = event(terminal, {tx: record.id, error: tx.error?.name || null, fixture: record.fixture}).n;
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
  // Test-only control of one watchdog CALLBACK DELIVERY. Its real timer still
  // expires normally; native IDB event production and outcomes are unchanged.
  function gateWatchdogDuring(start, expectedDelay = 100) {
    if (watchdogCaptureActive) throw Error('Nested watchdog capture');
    if (typeof start !== 'function') throw Error('Watchdog start required');
    const original = window.setTimeout, originalClear = window.clearTimeout;
    let timerId, captured = 0, due = false, released = false, dispatched = false, callback, args;
    let resolveDue; const duePromise = new Promise(resolve => {resolveDue = resolve;});
    watchdogCaptureActive = true;
    window.setTimeout = function (fn, delay, ...rest) {
      if (delay !== expectedDelay) return original.call(this, fn, delay, ...rest);
      captured++;
      if (captured !== 1 || typeof fn !== 'function') throw Error('Expected exactly one watchdog timer');
      callback = fn; args = rest;
      timerId = original.call(this, () => {
        due = true; event('watchdog-native-due', {timerId, delay}); resolveDue({timerId, delay});
      }, delay);
      event('watchdog-captured', {timerId, delay}); return timerId;
    };
    try {start(); if (captured !== 1) throw Error('Expected exactly one watchdog timer');}
    catch (error) {if (timerId !== undefined) originalClear.call(window, timerId); throw error;}
    finally {window.setTimeout = original; watchdogCaptureActive = false;}
    return Object.freeze({timerId, captured, due: duePromise,
      release() {
        if (!due || released) throw Error('Watchdog release requires one observed real deadline');
        released = true; event('watchdog-delivery-released', {timerId});
        original.call(window, () => {
          if (dispatched) throw Error('Watchdog delivered twice');
          dispatched = true; event('watchdog-delivered', {timerId}); callback.apply(window, args);
        }, 0);
      }
    });
  }
  window.__nativeHarness = {native, log, control, event, transactions, gateWatchdogDuring, get physical() {return physical;},
    holdNextTerminal(terminal) {
      if (!['complete', 'abort'].includes(terminal) || terminalBarrier) throw Error('Invalid or overlapping native terminal barrier');
      control.holdTerminal = true;
      return new Promise((resolve, reject) => {terminalBarrier = {terminal, tx: null, resolve, reject}; event('terminal-barrier-armed', {terminal});});
    },
    releaseTerminals(txId = null) {
      const callbacks = held.filter(value => txId === null || value.tx === txId);
      for (const value of callbacks) {held.splice(held.indexOf(value), 1); event('delivery-released', {tx: value.tx, terminal: value.terminal}); value.invoke();}
      return callbacks.length;
    },
    async fixture(fn) {fixture = true; try {return await fn();} finally {fixture = false;}},
    setFixture(value) {fixture = value;}};
})();
