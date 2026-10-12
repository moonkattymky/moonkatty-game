'use strict';
/* Socket-free pure journal tests. Supplied-step replay is not a browser,
 * timing-admission, storage-trust, or production-integration certificate. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {performance} = require('node:perf_hooks');
const R = require('../prototypes/life1-capture/vnext/recorder.cjs');
const M = require('../prototypes/life1-capture/vnext/source-model.cjs');
const context = Object.freeze({life1_profile: M.Original.NATIVE_PROFILE,
  route: '00000000-0000-4000-8000-000000000571', life: 1, edition: 2, challenge_version: 2, seed: 571});
const initial = [402, 402, 0, 0];
const zeroClock = {dispatchMs: 0, lastFrame: 0, nearbyAt: 0, clockResumedAt: 0};
const byteLength = x => Buffer.byteLength(typeof x === 'string' ? x : R.encode(x), 'utf8');
let checks = 0;
function okay(result, label = 'accepted') {assert.equal(result.ok, true, label + ': ' + result.error); checks++; return result.recording;}
function fresh(limits = R.DEFAULT, options = {}) {return okay(R.create({context, initial, limits, ...options}));}
function append(recording, kind, steps, dispatchMs = recording.state.dispatchMs) {
  return okay(R.appendCallback(recording, {kind, dispatchMs, steps}), kind);
}
function counted(recording, label) {
  assert.equal(recording.usage.entries, recording.wire.entries.length, label + ': every document and callback counts');
  assert.equal(recording.usage.bytes, byteLength(R.serialize(recording)), label + ': entire UTF-8 envelope counts');
  assert(Object.isFrozen(recording) && Object.isFrozen(recording.wire.entries) && Object.isFrozen(recording.state)); checks++;
}
function retained(recording, operation, error) {
  const before = R.serialize(recording), state = structuredClone(recording.state), usage = structuredClone(recording.usage);
  const result = operation();
  assert.equal(result.ok, false); assert.equal(result.error, error);
  assert.equal(result.recording, recording, 'refusal returns the identical complete accepted prefix');
  assert.equal(R.serialize(recording), before, 'old accepted bytes are unchanged');
  assert.deepEqual(recording.state, state); assert.deepEqual(recording.usage, usage); checks++;
  return result;
}
function reLimit(recording, limits) {
  const wire = structuredClone(recording.wire); wire.capacity = {...limits};
  return okay(R.inspect(R.encode(wire)), 'replay with test capacity');
}
function tightBytes(wire) {
  const copy = structuredClone(wire); copy.capacity.maxBytes = R.HARD.maxBytes;
  let bytes;
  do {bytes = copy.capacity.maxBytes; copy.capacity.maxBytes = byteLength(copy);} while (bytes !== copy.capacity.maxBytes);
  assert(copy.capacity.maxBytes >= 512); return copy.capacity.maxBytes;
}

assert.deepEqual(R.DEFAULT, {maxEntries: 4096, maxBytes: 196608});
assert.deepEqual(R.HARD, {maxEntries: 16384, maxBytes: 524288});
assert.deepEqual(R.DRAFT, {maxSteps: 128, maxBytes: 32768});
for (const limits of [{...R.DEFAULT, extra: true}, {...R.DEFAULT, maxEntries: 0},
  {...R.HARD, maxEntries: R.HARD.maxEntries + 1}, {...R.HARD, maxBytes: R.HARD.maxBytes + 1},
  {...R.DEFAULT, maxBytes: 511}, {...R.DEFAULT, maxEntries: 1.5}]) {
  assert.equal(R.create({context, initial, limits}).error, 'invalid-capacity'); checks++;
}
let seed = fresh(); counted(seed, 'initial metadata');
assert.equal(seed.usage.entries, 1);
assert(seed.usage.bytes > byteLength(seed.wire.entries), 'format, transition, context, geometry and capacity metadata are counted');
const pause = {kind: 'pause', dispatchMs: .25, steps: [['pause', true], ['stop']]};

// Count and exact byte thresholds refuse the complete multi-step callback.
let countPrefix = append(fresh({maxEntries: 2, maxBytes: R.HARD.maxBytes}), 'stop', [['stop']]);
const countRefusal = retained(countPrefix, () => R.appendCallback(countPrefix, pause), 'capacity-refused');
assert.equal(countRefusal.required.entries, 3); assert.deepEqual(countRefusal.retained, countPrefix.usage);
assert.equal(countPrefix.state.paused, false, 'the first step of refused pause was not published');
let broad = fresh(R.HARD);
for (let i = 0; i < 5; i++) broad = append(broad, 'stop', [['stop']]);
const candidate = okay(R.appendCallback(broad, pause));
const exactBytes = tightBytes(candidate.wire);
const exactPrefix = reLimit(broad, {maxEntries: R.HARD.maxEntries, maxBytes: exactBytes});
const exactAccepted = okay(R.appendCallback(exactPrefix, pause));
assert.equal(exactAccepted.usage.bytes, exactBytes); counted(exactAccepted, 'exact byte boundary');
const bytePrefix = reLimit(broad, {maxEntries: R.HARD.maxEntries, maxBytes: exactBytes - 1});
const byteRefusal = retained(bytePrefix, () => R.appendCallback(bytePrefix, pause), 'capacity-refused');
assert.equal(byteRefusal.required.bytes, exactBytes); assert.deepEqual(byteRefusal.retained, bytePrefix.usage);
assert.equal(bytePrefix.state.paused, false);
assert.equal(R.serialize(okay(R.inspect(R.serialize(exactAccepted)))), R.serialize(exactAccepted));
const oversizedWire = structuredClone(exactAccepted.wire); oversizedWire.capacity.maxBytes--;
const oversized = R.inspect(R.encode(oversizedWire));
assert.equal(oversized.error, 'capacity-refused');
assert.equal(R.serialize(oversized.recording), R.serialize(bytePrefix), 'inspection retains exactly the last complete budgeted prefix');
assert.deepEqual(oversized.required, byteRefusal.required);
const excessCountWire = structuredClone(candidate.wire); excessCountWire.capacity.maxEntries = 2;
const excessCount = R.inspect(R.encode(excessCountWire));
assert.equal(excessCount.error, 'capacity-refused'); assert.equal(excessCount.recording.usage.entries, 2);
counted(excessCount.recording, 'count-refused inspection prefix');

// Invalid final effects cannot publish an earlier valid step, either live or on replay.
const incompletePause = {kind: 'pause', dispatchMs: .25, steps: [['pause', true]]};
const incomplete = retained(seed, () => R.appendCallback(seed, incompletePause), 'callback-kind-grammar');
const malformedWire = structuredClone(seed.wire);
malformedWire.entries.push(['callback', 0, 1, .25, 'pause', incompletePause.steps]);
const malformed = R.inspect(R.encode(malformedWire));
assert.equal(malformed.error, incomplete.error); assert.equal(R.serialize(malformed.recording), R.serialize(seed));
const invalidLastStep = {...pause, steps: [['pause', true], ['stop', 'unknown']]};
retained(seed, () => R.appendCallback(seed, invalidLastStep), 'invalid-step-arity');
malformedWire.entries[1][5] = invalidLastStep.steps;
const partiallyReplayed = R.inspect(R.encode(malformedWire));
assert.equal(partiallyReplayed.error, 'invalid-step-arity');
assert.equal(R.serialize(partiallyReplayed.recording), R.serialize(seed));
assert.equal(partiallyReplayed.recording.state.paused, false, 'failed candidate state never becomes the accepted prefix');

// The bounded draft itself includes kind, dispatch and step metadata and UTF-8.
const maxSteps = {kind: 'stop', dispatchMs: 0, steps: Array.from({length: R.DRAFT.maxSteps}, () => ['stop'])};
assert.equal(R.checkDraft(maxSteps), maxSteps);
const tooManySteps = {...maxSteps, steps: [...maxSteps.steps, ['stop']]};
retained(seed, () => R.appendCallback(seed, tooManySteps), 'callback-draft-capacity-refused');
const draftBase = {kind: '', dispatchMs: 0, steps: []};
const exactDraft = {...draftBase, kind: 'x'.repeat(R.DRAFT.maxBytes - byteLength(draftBase))};
assert.equal(byteLength(exactDraft), R.DRAFT.maxBytes); assert.equal(R.checkDraft(exactDraft), exactDraft);
retained(seed, () => R.appendCallback(seed, {...exactDraft, kind: exactDraft.kind + 'x'}), 'callback-draft-capacity-refused');
const utf8Draft = {...draftBase, kind: '界'.repeat(Math.floor((R.DRAFT.maxBytes - byteLength(draftBase)) / 3) + 1)};
assert(R.encode(utf8Draft).length < R.DRAFT.maxBytes); assert(byteLength(utf8Draft) > R.DRAFT.maxBytes);
retained(seed, () => R.appendCallback(seed, utf8Draft), 'callback-draft-capacity-refused');
retained(seed, () => R.appendCallback(seed, {...pause, extra: true}), 'callback-draft-capacity-refused');

// Signed zero survives initial geometry, all raw clocks, callback dispatch and RAF.
const minusZero = {dispatchMs: -0, lastFrame: -0, nearbyAt: -0, clockResumedAt: -0};
let negative = fresh(R.DEFAULT, {initial: [402, 402, -0, -0], clock: minusZero});
negative = append(negative, 'frame', [['frame', -0, -0, -0]], -0);
const negativeBody = R.serialize(negative), negativeReplay = okay(R.inspect(negativeBody));
assert.equal(R.serialize(negativeReplay), negativeBody);
assert.deepEqual(negativeReplay.state, negative.state); counted(negativeReplay, 'negative-zero envelope');
for (const key of ['dispatchMs', 'lastFrame', 'nearbyAt', 'clockResumedAt']) assert(Object.is(negativeReplay.state[key], -0), key);
for (const value of negativeReplay.wire.initial.slice(2)) assert(Object.is(value, -0));
for (const value of negativeReplay.wire.entries[1][5][0].slice(1)) assert(Object.is(value, -0));

// Unknown serialized envelope fields and noncontiguous document/sequence IDs fail closed.
function rejectedMutation(recording, mutate, error) {
  const wire = structuredClone(recording.wire); mutate(wire);
  const result = R.inspect(R.encode(wire)); assert.equal(result.ok, false); if (error) assert.equal(result.error, error); checks++;
}
rejectedMutation(seed, w => {w.extra = true;}, 'recording-format');
rejectedMutation(seed, w => {w.context.extra = true;}, 'invalid-context');
rejectedMutation(seed, w => {w.capacity.extra = true;}, 'invalid-capacity');
rejectedMutation(seed, w => {w.initial.push(0);});
rejectedMutation(seed, w => {w.entries[0].push(0);}, 'initial-document');
rejectedMutation(seed, w => {w.entries[0][1] = 1;}, 'initial-document');
rejectedMutation(exactAccepted, w => {w.entries[1].push({extra: true});}, 'document-sequence');
rejectedMutation(exactAccepted, w => {w.entries[1][1] = 1;}, 'document-sequence');
rejectedMutation(exactAccepted, w => {w.entries[1][2] = 2;}, 'journal-sequence');
rejectedMutation(exactAccepted, w => {w.entries[1][5][0].push({extra: true});}, 'invalid-step-arity');
rejectedMutation(exactAccepted, w => {w.entries[1][5][0] = ['unrecognized'];}, 'callback-kind-grammar');
for (const input of [null, '', 'null', '{}']) assert.equal(R.inspect(input).ok, false);
for (const input of [' '.repeat(R.HARD.maxBytes + 1), '界'.repeat(R.HARD.maxBytes / 2)]) assert.equal(R.inspect(input).error, 'recording-byte-limit');
rejectedMutation(seed, w => {w.entries.push(...Array.from({length: R.HARD.maxEntries}, () => []));}, 'recording-format');
for (const raw of [{...zeroClock, extra: 0}, {...zeroClock, lastFrame: Infinity}, {...zeroClock, dispatchMs: -1}]) {
  assert.equal(R.create({context, initial, clock: raw}).error, 'invalid-source-clock');
  retained(seed, () => R.preflightDocument(seed, raw), 'invalid-source-clock');
}
retained(seed, () => R.preflightDocument(seed, zeroClock), 'unsupported-recovery-phase');

// Earn a replayable paused two-cell repair prefix using only ordinary pure model
// callbacks. This route is a test input, not a claim about real elapsed play.
let repair = fresh(R.HARD);
const live = () => ['live', ...initial];
function moveFrame(x, y, deltaMs = 25) {
  const now = repair.state.dispatchMs + deltaMs;
  const steps = [['frame', now, x, y]];
  if (Math.hypot(x, y) > .08 && now - repair.state.nearbyAt >= 90) steps.push(live(), ['nearby'], ['nearby-at', now]);
  repair = append(repair, 'frame', steps, now);
}
function navigate(id) {
  moveFrame(0, 0, 1);
  const state = repair.state, queue = [{x: state.x, y: state.y, parent: null}], seen = new Set([state.x + ',' + state.y]);
  let goal;
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i];
    if (M.Original.distance({...state, x: p.x, y: p.y}, id) < .22) {goal = p; break;}
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const x = p.x + dx, y = p.y + dy, key = x + ',' + y;
      if (x < 7 || x > 90 || y < 18 || y > 88 || seen.has(key) || M.Original.blocked(state, x, y)) continue;
      seen.add(key); queue.push({x, y, parent: p});
    }
  }
  assert(goal, 'bounded path to ' + id); const points = [];
  while (goal.parent) {points.push(goal); goal = goal.parent;}
  for (const point of points.reverse()) {
    const dx = (point.x - repair.state.x) * 402 / 100, dy = (point.y - repair.state.y) * 402 / 100;
    const distance = Math.hypot(dx, dy), parts = Math.ceil(distance / 3.4);
    for (let i = 0; i < parts; i++) moveFrame(dx / distance, dy / distance, distance / parts / 88 * 1000);
  }
}
for (const id of ['1', '2', '3']) {
  navigate(id); repair = append(repair, 'collect', [live(), ['collect', id], live(), ['nearby']]);
}
navigate('repair'); repair = append(repair, 'open', [live(), ['open', 'repair']]);
for (let i = 0; i < 2; i++) repair = append(repair, 'cell', [['cell', repair.state.sequence[i]]]);
repair = append(repair, 'pause', [['pause', true], ['stop']]);
assert(M.recoveryPhase(repair.state));
const repairBody = R.serialize(repair), repairState = structuredClone(repair.state);
const freshClock = {dispatchMs: .125, lastFrame: -0, nearbyAt: -0, clockResumedAt: .0625};
assert.deepEqual(R.preflightDocument(repair, freshClock), {ok: true});
assert.equal(R.serialize(repair), repairBody); assert.deepEqual(repair.state, repairState);
retained(repair, () => R.beginDocument(repair, freshClock, []), 'callback-kind-grammar');
const hydrate = [['stop'], live(), ['cache', ...initial]];
const restored = okay(R.beginDocument(repair, freshClock, hydrate));
assert.equal(restored.state.document, 1); assert.equal(restored.state.dispatchMs, .125); assert(Object.is(restored.state.lastFrame, -0));
assert.deepEqual(restored.wire.entries.slice(0, repair.wire.entries.length), repair.wire.entries, 'every old document byte value stays unchanged');
assert.equal(R.encode(restored.wire.entries.slice(0, -1)), R.encode(repair.wire.entries));
counted(restored, 'document, source-clock, geometry, step metadata');
const resumed = append(restored, 'resume', [['pause', false]], .25);
assert.equal(resumed.wire.entries.at(-1)[1], 1); assert.equal(resumed.wire.entries.at(-1)[2], resumed.wire.entries.length - 1);
assert.equal(R.serialize(okay(R.inspect(R.serialize(resumed)))), R.serialize(resumed));
const repairedReplay = okay(R.recover(repairBody, freshClock, hydrate));
assert.deepEqual(repairedReplay, restored);
rejectedMutation(restored, w => {w.entries.at(-1)[1] = 2;}, 'document-sequence');
rejectedMutation(restored, w => {w.entries.at(-1)[2]--;}, 'journal-sequence');
rejectedMutation(restored, w => {w.entries.at(-1).push('extra');}, 'document-sequence');
rejectedMutation(resumed, w => {w.entries.at(-1)[1] = 0;}, 'document-sequence');
const twoDocuments = okay(R.beginDocument(restored, zeroClock, hydrate));
assert.equal(twoDocuments.state.document, 2); assert.equal(R.serialize(okay(R.inspect(R.serialize(twoDocuments)))), R.serialize(twoDocuments));
const noEntryRoom = reLimit(repair, {maxEntries: repair.usage.entries, maxBytes: R.HARD.maxBytes});
retained(noEntryRoom, () => R.preflightDocument(noEntryRoom, freshClock), 'capacity-refused');
retained(noEntryRoom, () => R.beginDocument(noEntryRoom, freshClock, hydrate), 'capacity-refused');
const minimumDocumentWire = structuredClone(repair.wire);
minimumDocumentWire.entries.push(['document', 1, repair.usage.entries, freshClock.dispatchMs, freshClock.lastFrame, freshClock.nearbyAt, freshClock.clockResumedAt, []]);
const minimumDocumentBytes = tightBytes(minimumDocumentWire);
const noMetadataRoom = reLimit(repair, {maxEntries: R.HARD.maxEntries, maxBytes: minimumDocumentBytes - 1});
retained(noMetadataRoom, () => R.preflightDocument(noMetadataRoom, freshClock), 'capacity-refused');
const metadataOnlyRoom = reLimit(repair, {maxEntries: R.HARD.maxEntries, maxBytes: minimumDocumentBytes});
assert.deepEqual(R.preflightDocument(metadataOnlyRoom, freshClock), {ok: true});
retained(metadataOnlyRoom, () => R.beginDocument(metadataOnlyRoom, freshClock, hydrate), 'capacity-refused');

// Near-ceiling replay is built directly so construction cannot mask replay cost.
// Count the total text given to encoders to test linear work deterministically;
// report elapsed time without an environment-sensitive timing assertion.
const ceilingWire = structuredClone(fresh(R.HARD).wire);
let ceilingBytes = byteLength(ceilingWire);
while (ceilingWire.entries.length < R.HARD.maxEntries) {
  const entry = ['callback', 0, ceilingWire.entries.length, 0, 'stop', []], size = 1 + byteLength(entry);
  if (ceilingBytes + size > R.HARD.maxBytes) break;
  ceilingWire.entries.push(entry); ceilingBytes += size;
}
const ceilingBody = R.encode(ceilingWire);
assert.equal(byteLength(ceilingBody), ceilingBytes); assert(ceilingWire.entries.length > 16000);
assert(R.HARD.maxBytes - ceilingBytes < 40, 'uses the unchanged hard byte ceiling');
const NativeEncoder = global.TextEncoder;
let encodedChars = 0, encodeCalls = 0, wholeWireEncodes = 0;
global.TextEncoder = class CountingEncoder extends NativeEncoder {
  encode(text = '') {encodedChars += text.length; encodeCalls++; if (text.length >= ceilingBody.length / 2) wholeWireEncodes++; return super.encode(text);}
};
let ceiling, inspectMs;
try {const start = performance.now(); ceiling = R.inspect(ceilingBody); inspectMs = performance.now() - start;}
finally {global.TextEncoder = NativeEncoder;}
const ceilingRecording = okay(ceiling, 'near-ceiling replay');
assert(encodedChars < 5 * ceilingBody.length, 'inspection serialization work stays linear in the input');
assert.equal(wholeWireEncodes, 1, 'only the input byte guard encodes the complete large journal');
counted(ceilingRecording, 'near-ceiling replay'); assert.equal(R.serialize(ceilingRecording), ceilingBody);
retained(ceilingRecording, () => R.appendCallback(ceilingRecording, {kind: 'stop', dispatchMs: 0, steps: []}), 'capacity-refused');

const report = {test: 'life1-recording-vnext-journal', checks, defaults: R.DEFAULT, hardCeilings: R.HARD, draftCeilings: R.DRAFT,
  completeCallbackCountRefusal: true, completeCallbackByteRefusal: true, exactByteBoundary: exactBytes,
  draftStepAndUtf8ByteBoundaries: true, allSerializedMetadataCounted: true, strictUnknownFields: true,
  documentAndSequenceContinuity: true, documentPreflightIsReadOnly: true, noEmptyHydrateAccepted: true,
  oldAcceptedBytesRetained: true, signedZeroRoundTrip: true,
  nearCeiling: {entries: ceilingRecording.usage.entries, bytes: ceilingRecording.usage.bytes,
    inspectMs: Number(inspectMs.toFixed(3)), encodedChars, encodeCalls, wholeWireEncodes},
  linearEncoderWorkAssertion: true, timingAssertion: false, browserExecuted: false, authoritativeAdmission: false};
const out = process.env.MKTY_TEST_OUTPUT || '/tmp/mkty-life1-recording-vnext-journal';
fs.mkdirSync(out, {recursive: true}); fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
