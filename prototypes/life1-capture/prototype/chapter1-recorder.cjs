'use strict';
/* LOCAL SOURCE-ONLY RECORDER/RECOVERY EXPERIMENT. No browser, storage, network,
 * global clock, account, endpoint, game controller or reward side effects.
 * The opaque context is synthetic model input, never asserted trusted authority.
 * Refusal stops recording acceptance only; this module has no gameplay control.
 */
const CallbackModel = require('./source-callback-model.cjs');
const M = CallbackModel.Original;
const FORMAT = 'mkty-life1-recorder-local-1';
const HARD = Object.freeze({maxEntries: 16384, maxBytes: 524288});
const DEFAULT = Object.freeze({maxEntries: 4096, maxBytes: 196608});
const clone = value => structuredClone(value);
const bytes = value => new TextEncoder().encode(value).byteLength;
const finiteTime = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;
function fail(code) { const error = new Error(code); error.code = code; throw error; }
function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
// JSON.stringify erases -0. Valid JSON can retain it, and JSON.parse restores it.
// The bounded wire schema contains only shallow plain objects, arrays and scalars.
function wireJSON(value) {
  if (typeof value === 'number') { if (!Number.isFinite(value)) fail('invalid-wire-number'); return Object.is(value,-0)?'-0':String(value); }
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (Array.isArray(value)) return '['+value.map(wireJSON).join(',')+']';
  if (value && typeof value === 'object') return '{'+Object.keys(value).map(k=>JSON.stringify(k)+':'+wireJSON(value[k])).join(',')+'}';
  fail('invalid-wire-value');
}
function exact(object, keys) {
  return object && typeof object === 'object' && !Array.isArray(object) &&
    Object.keys(object).length === keys.length && keys.every(k => Object.hasOwn(object, k));
}
function capacity(value = DEFAULT) {
  if (!exact(value, ['maxEntries', 'maxBytes']) || !Number.isSafeInteger(value.maxEntries) || value.maxEntries < 1 ||
      value.maxEntries > HARD.maxEntries || !Number.isSafeInteger(value.maxBytes) || value.maxBytes < 512 || value.maxBytes > HARD.maxBytes) fail('invalid-capacity');
  return {...value};
}
function usage(wire) { return {entries: wire.entries.length, bytes: bytes(wireJSON(wire))}; }
function result(wire, state, clock) { return freeze({wire, state, clock, usage: usage(wire)}); }
function refused(recording, error, detail = {}) { return {ok: false, error, recording, ...detail}; }
function accepted(recording) { return {ok: true, recording}; }
function candidate(recording, entry, apply) {
  const wire = {...recording.wire, entries: [...recording.wire.entries, clone(entry)]};
  const required = usage(wire), limits = wire.capacity;
  if (required.entries > limits.maxEntries || required.bytes > limits.maxBytes) {
    return refused(recording, 'capacity-refused', {required, capacity: {...limits}, retained: {...recording.usage}});
  }
  try { const {state, clock} = apply(); return accepted(freeze({wire, state, clock, usage: required})); }
  catch (error) { return refused(recording, error.code || error.message || 'invalid-event'); }
}
function create({context, initial, localOriginMs = 0, limits = DEFAULT} = {}) {
  try {
    if (!finiteTime(localOriginMs)) fail('invalid-clock-origin');
    // Explicit native profile only. No legacy fallback and no inferred authority.
    if (!exact(context,['life1_profile','route','life','edition','challenge_version','seed']) || context.life1_profile !== M.NATIVE_PROFILE) fail('unsupported-recorder-profile');
    const safeContext = clone(context), profile = M.profileForRoute(safeContext);
    M.validateInitial(initial, profile.layout);
    const state = M.createNative(safeContext, ...initial);
    const wire = {format: FORMAT, transition: CallbackModel.ID, context: safeContext,
      initial: clone(initial), capacity: capacity(limits), entries: [['epoch', localOriginMs, 0]]};
    const recording = result(wire, state, {localOrigin: localOriginMs, logicalOrigin: 0, lastLocal: localOriginMs});
    if (recording.usage.bytes > wire.capacity.maxBytes) return refused(null, 'capacity-refused', {required: recording.usage, capacity: wire.capacity});
    return accepted(recording);
  } catch (error) { return refused(null, error.code || error.message || 'invalid-create'); }
}
function normalize(recording, event) {
  M.validateEvent(event, recording.state.layout);
  const local = event[1], clock = recording.clock;
  if (local < clock.localOrigin || local < clock.lastLocal) fail('local-time-reordered');
  const logical = clock.logicalOrigin + (local - clock.localOrigin);
  if (!finiteTime(logical) || logical < recording.state.now) fail('logical-time-invalid');
  // All input/geometry values are copied unchanged. The exact original local
  // timestamp remains in the wire; only the separate logical timeline is rebased.
  const canonical = [event[0], logical, ...event.slice(2)];
  return {canonical, clock: {...clock, lastLocal: local}};
}
function append(recording, event) {
  try {
    const normalized = normalize(recording, event);
    return candidate(recording, ['event', event], () => ({
      state: CallbackModel.transition(recording.state, normalized.canonical), clock: normalized.clock
    }));
  } catch (error) { return refused(recording, error.code || error.message || 'invalid-event'); }
}
function beginDocument(recording, localOriginMs) {
  if (!finiteTime(localOriginMs)) return refused(recording, 'invalid-clock-origin');
  // Bounded first recovery slice. An active held input/playback reload needs a
  // separately specified hydration policy. Never silently invent stop/reset.
  if (!(recording.state.paused || !recording.state.active || recording.state.completeVisible)) {
    return refused(recording, 'recovery-requires-quiescent-prefix');
  }
  return candidate(recording, ['epoch', localOriginMs, recording.state.now], () => ({
    state: recording.state,
    clock: {localOrigin: localOriginMs, logicalOrigin: recording.state.now, lastLocal: localOriginMs}
  }));
}
function serialize(recording) { return wireJSON(recording.wire); }
function inspect(body) {
  try {
    if (typeof body !== 'string' || body.length > HARD.maxBytes || bytes(body) > HARD.maxBytes) fail('recording-byte-limit');
    const wire = JSON.parse(body);
    if (!exact(wire, ['format','transition','context','initial','capacity','entries']) || wire.format !== FORMAT || wire.transition !== CallbackModel.ID) fail('recording-format');
    capacity(wire.capacity);
    if (!Array.isArray(wire.entries) || !wire.entries.length || wire.entries.length > wire.capacity.maxEntries || bytes(body) > wire.capacity.maxBytes) fail('recording-capacity');
    const first = wire.entries[0];
    if (!Array.isArray(first) || first.length !== 3 || first[0] !== 'epoch' || first[2] !== 0) fail('initial-epoch');
    let opened = create({context: wire.context, initial: wire.initial, limits: wire.capacity, localOriginMs: first[1]});
    if (!opened.ok) return opened;
    let recording = opened.recording;
    for (const entry of wire.entries.slice(1)) {
      if (Array.isArray(entry) && entry.length === 2 && entry[0] === 'event') {
        const normalized = normalize(recording, entry[1]);
        recording = {...recording, state: CallbackModel.transition(recording.state, normalized.canonical), clock: normalized.clock};
      } else if (Array.isArray(entry) && entry.length === 3 && entry[0] === 'epoch' && entry[2] === recording.state.now && finiteTime(entry[1])) {
        if (!(recording.state.paused || !recording.state.active || recording.state.completeVisible)) fail('recovery-requires-quiescent-prefix');
        recording = {...recording, clock: {localOrigin: entry[1], logicalOrigin: recording.state.now, lastLocal: entry[1]}};
      } else fail('invalid-entry');
    }
    // Replay once after bounded parsing; do not rebuild/serialize every prefix.
    // There is no supplied gameplay snapshot or inferred completion shortcut.
    return accepted(result(wire, recording.state, recording.clock));
  } catch (error) { return refused(null, error.code || error.message || 'invalid-recording'); }
}
function recover(body, {localOriginMs} = {}) {
  const replayed = inspect(body);
  return replayed.ok ? beginDocument(replayed.recording, localOriginMs) : replayed;
}
module.exports = Object.freeze({FORMAT, TRANSITION: CallbackModel.ID, HARD, DEFAULT,
  create, append, beginDocument, serialize, inspect, recover});
