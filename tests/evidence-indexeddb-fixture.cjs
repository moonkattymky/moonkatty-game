'use strict';
/* Portable, socket-free fixture preparation. Node reference code is test-only.
 * The native wrappers and C1 dependency closure are exact pinned bytes. This
 * file does not start a browser/server, execute gameplay, or change a limit.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const fixtureRoot = path.join(__dirname, 'fixtures/evidence-indexeddb');
const manifestPath = path.join(fixtureRoot, 'manifest.json');
const manifestHash = 'd1f94001ab2de7b9f91fd63632b933a691a0459f2f6e38945484a2ba5490a5ee';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function verifySources() {
  const raw = fs.readFileSync(manifestPath);
  assert.equal(hash(raw), manifestHash, 'IndexedDB fixture manifest hash mismatch');
  const manifest = JSON.parse(raw);
  assert.equal(manifest.version, 1);
  assert.equal(manifest.files.length, 25);
  const sourceHashes = {'tests/fixtures/evidence-indexeddb/manifest.json': manifestHash};
  for (const entry of manifest.files) {
    assert.equal(typeof entry.path, 'string');
    assert(!path.isAbsolute(entry.path) && !entry.path.split('/').includes('..'), 'fixture path must be repository-relative');
    assert(!Object.hasOwn(sourceHashes, entry.path), 'duplicate fixture path');
    const bytes = fs.readFileSync(path.join(root, entry.path));
    assert.equal(bytes.length, entry.bytes, 'fixture size mismatch: ' + entry.path);
    assert.equal(hash(bytes), entry.sha256, 'fixture hash mismatch: ' + entry.path);
    if (entry.group === 'native-wire-wrapper') {
      const wrapper = JSON.parse(bytes);
      assert.equal(typeof wrapper.wire, 'string', 'missing native wire: ' + entry.path);
      const wire = Buffer.from(wrapper.wire, 'utf8');
      assert.equal(wire.length, entry.wireBytes, 'native wire size mismatch: ' + entry.path);
      assert.equal(hash(wire), entry.wireSha256, 'native wire hash mismatch: ' + entry.path);
    }
    sourceHashes[entry.path] = entry.sha256;
  }
  sourceHashes['tests/evidence-indexeddb-fixture.cjs'] = hash(fs.readFileSync(__filename));
  return {manifest, sourceHashes};
}
// Verify before require() can execute any vendored or reused admission code.
verifySources();
const S = require('./fixtures/evidence-indexeddb/reference-v3/store.cjs');
const C = require('./fixtures/evidence-indexeddb/reference-v3/coordinator.cjs');
const R = require('./fixtures/evidence-indexeddb/c1/vnext/recorder.cjs');
const Codec = require('../trace-codec.js');
const Field = require('../field-model.js');
const Plan = require('../story-plan.js');
const Envelope = require('./fixtures/finale-envelope-21-group-baseline.cjs')({field: Field, codec: Codec});
const Owner = require('../finale-evidence-owner.js')({field: Field, codec: Codec, storyPlan: Plan, envelopes: Envelope});
const checkpoints = require('./fixtures/finale-checkpoints-17-state.json');
const {storyKey, activeKey} = require('./fixtures/finale-owner-roundtrip.cjs');
const admitted = new Map();
const admissionContext = Object.freeze({route: 'opaque-synthetic-context', challenge: Object.freeze({id: 'not-an-authoritative-binding'})});

function makeDescriptor(run = 'run', length = 200000, note = '', scope = 'fixture:A') {
  // Field order, naming and framing size are the frozen v3 descriptor contract.
  return {format: S.FORMAT, scope, run, kind: 'storage-only', model: 'opaque-v1',
    components: [{name: 'opaque', encoding: 'opaque', length: length - 20}], note};
}

function makeRequest(descriptor, payload, head = null, sealed = false) {
  const request = {descriptor, expectedHead: head?.token ?? null, ordinal: head ? head.ordinal + 1 : 0,
    offset: head?.total ?? 0, previousRoot: head?.root ?? S.ZERO, payload: Buffer.from(payload)};
  if (sealed) request.seal = {totalBytes: request.offset + request.payload.length,
    root: S.chain(S.descriptor(descriptor), request, request.payload)};
  return request;
}

function exactSemantic(actual, expected, label, stats = {scalars: 0, negativeZero: 0, containers: 0}) {
  if (expected === null || typeof expected !== 'object') {
    assert(Object.is(actual, expected), label + ': scalar identity');
    stats.scalars++;
    if (Object.is(expected, -0)) stats.negativeZero++;
    return stats;
  }
  assert(actual !== null && typeof actual === 'object', label + ': container type');
  assert.equal(Array.isArray(actual), Array.isArray(expected), label + ': array identity');
  assert.deepEqual(Object.keys(actual), Object.keys(expected), label + ': ordered keys');
  stats.containers++;
  for (const key of Object.keys(expected)) exactSemantic(actual[key], expected[key], label + '.' + key, stats);
  return stats;
}

function checkpointAdmission(p, checkpoint, raw, provenance, stats) {
  const baseSeed = (p.seed - p.index * 7919) >>> 0;
  const started = Envelope.begin({chapter: p.chapter, baseSeed, phase: p.index, context: admissionContext});
  assert(started.ok, started.error);
  const captured = Envelope.captureCompleted(started.candidate, {index: p.index,
    checkpoint: structuredClone(checkpoint), provenance: structuredClone(provenance)});
  assert(captured.ok, captured.error);
  // Full raw checkpoint, including trace and exact clock spelling, is retained.
  exactSemantic(checkpoint, p.state, 'checkpoint', stats);
  exactSemantic(provenance, p.provenance, 'provenance', stats);
  const replay = Field.create(p.mechanic, p.fieldStage, p.seed, checkpoint.mods);
  for (const row of checkpoint.trace) {
    if (row[0] === 'act') Field.act(replay, row[1], row[2]);
    else for (let tick = 0; tick < row[1]; tick++) Field.tick(replay, 1 / 60, {x: row[2], y: row[3]});
  }
  assert(replay.complete && Field.won(replay), 'checkpoint replay must complete');
  const replayExpected = structuredClone(checkpoint);
  delete replayExpected.trace;
  const controllerTimed = replayExpected.seconds !== replay.seconds;
  if (controllerTimed) {
    // Original v3 qualification: only the comparison copy changes. The archived
    // raw checkpoint remains at seconds=3; trace replay alone does not prove it.
    assert.equal(replayExpected.seconds, 3);
    assert.equal(replay.seconds, 0);
    replayExpected.seconds = 0;
  }
  exactSemantic(replay, replayExpected, 'replayed checkpoint', stats);
  const source = {chapter: p.chapter, baseSeed, phase: p.index, context: admissionContext, checkpoint, provenance};
  const sourceSnapshot = {
    [storyKey(p.chapter)]: JSON.stringify({...Plan.fresh(p.chapter, 9000 + p.chapter, 2),
      createdAt: 1, phase: 'core', done: [0, 1, 2, 3, 4, 5, 6, 7]}),
    [activeKey(p.chapter)]: raw, mkty_points: '12250', mkty_pending_v2_101: 'synthetic-unchanged'
  };
  const original = structuredClone(sourceSnapshot);
  const prepared = Owner.prepareCapture({snapshot: sourceSnapshot, source});
  assert(prepared.ok, prepared.error);
  assert.deepEqual(sourceSnapshot, original, 'admission must leave source snapshot unchanged');
  return {controllerTimed};
}

function scalarVector() {
  // Exact vector from v3 test 05, including signed zero, clocks, geometry and
  // unpaired UTF-16 surrogates that must never pass through UTF-8 normalization.
  const value = {negativeZero: -0, subnormal: Number.MIN_VALUE, fraction: 0.1, dispatchMs: -0, RAF: 1000 / 60, timer: 0.0625,
    callbacks: [{kind: 'frame', dispatchMs: 20, steps: [['raw', -0]]}, {kind: 'delay', dispatchMs: 20, steps: []}],
    documents: [0, 1, 2], live: {x: 1.125, y: -0}, cache: {x: 0.125, y: Number.MIN_VALUE},
    context: {route: '🌙雪', capacity: R.DEFAULT}};
  const raw = ' {\n"zero": -0.0, "num": 1e-07, "text": "x" }\t' + String.fromCharCode(0xd800, 0xdc00, 0xd800, 0x61, 0xdc00);
  return {value, raw};
}

function verifyLimitRefusals(bytes = Buffer.alloc(1000001, 97)) {
  assert(bytes instanceof Uint8Array && bytes.length > R.HARD.maxBytes, 'oversized storage-only bytes required');
  assert.deepEqual(R.DEFAULT, {maxEntries: 4096, maxBytes: 196608});
  assert.deepEqual(R.HARD, {maxEntries: 16384, maxBytes: 524288});
  assert.deepEqual(R.DRAFT, {maxSteps: 128, maxBytes: 32768});
  assert.equal(R.inspect(Buffer.from(bytes).toString()).error, 'recording-byte-limit');
  assert.equal(R.inspect(' '.repeat(R.HARD.maxBytes + 1)).error, 'recording-byte-limit');
  const text = 'a'.repeat(1000001);
  assert.throws(() => Codec.packSnapshot({x: 'a'.repeat(180000)}), /snapshot_too_large/);
  assert.throws(() => Codec.unpackSnapshot({x: text}), /snapshot_too_large/);
  assert.throws(() => Codec.packSnapshot({a: 'a'.repeat(174992), b: 'b'.repeat(174994)}), /snapshot_too_large/);
  assert.throws(() => Codec.packProof({x: 'a'.repeat(399993)}), /proof_too_large/);
  assert.throws(() => Codec.unpackProof({x: 'a'.repeat(999993)}), /proof_too_large/);
  return {checks: 7, storageOnlyBytes: bytes.length, recorderDefault: {...R.DEFAULT}, recorderHard: {...R.HARD},
    callbackDraft: {...R.DRAFT}, snapshotEntryAtLeast: 180000, snapshotAggregateAbove: 350000,
    decodedProofAbove: 1000000, packedProofAbove: 400000, limitsChanged: false};
}

function prepareInputs() {
  const {manifest, sourceHashes} = verifySources();
  const artifacts = [];
  admitted.clear();
  const qualifications = {
    exactCheckpointReplay: 0, controllerTimedCheckpointReplay: 0, nativeWires: 0,
    checkpointTiming: 'Controller-timed seconds=3 is preserved exactly for twelve checkpoints; their trace-only replay has seconds=0. Five replay every checkpoint field exactly.',
    provenance: 'Checkpoint provenance is synthetic local observation, not trusted server provenance. C1 wires reuse the existing admitted native callbacks, exact clocks and geometry; this preparation is not a new native run.',
    execution: 'Node-only socket-free fixture preparation; no IndexedDB persistence or browser acceptance claimed.',
    originalLimitRefusals: verifyLimitRefusals(),
    referenceArchiveSha256: '29d03d1e2343e4e0fa6ea7f09ec8f2375184e38409bbb8cf06e916f15f02551b'
  };
  function add(artifact, expected) {
    S.descriptor(artifact.descriptor);
    assert(!admitted.has(artifact.name), 'unique fixture name');
    admitted.set(artifact.name, {...expected, descriptor: structuredClone(artifact.descriptor),
      bytes: Buffer.from(artifact.bytes), admissionKind: artifact.admissionKind});
    artifacts.push(artifact);
  }
  assert.equal(checkpoints.phases.length, 17);
  for (const [index, p] of checkpoints.phases.entries()) {
    const baseSeed = (p.seed - p.index * 7919) >>> 0;
    const raw = '\n  ' + Codec.stringify({version: 1, n: p.chapter, phase: p.index, seed: baseSeed, seconds: 0, checkpoint: p.state}) + ' \n';
    const admittedCheckpoint = checkpointAdmission(p, p.state, raw, p.provenance);
    qualifications[admittedCheckpoint.controllerTimed ? 'controllerTimedCheckpointReplay' : 'exactCheckpointReplay']++;
    const framed = C.frame([{name: 'checkpoint', encoding: 'utf8', text: Codec.stringify(p.state)},
      {name: 'source-storage-string', encoding: 'utf16le', text: raw},
      {name: 'provenance', encoding: 'utf8', text: Codec.stringify(p.provenance)}]);
    const name = 'checkpoint-' + index;
    const descriptor = {...makeDescriptor(name, framed.bytes.length), kind: 'admitted-finale-checkpoint', model: 'frozen-field', components: framed.components};
    add({name, descriptor, bytes: framed.bytes, admissionKind: 'checkpoint', segmentBytes: 4096}, {p, raw});
  }
  const wires = manifest.files.filter(entry => entry.group === 'native-wire-wrapper');
  assert.equal(wires.length, 6);
  for (const entry of wires) {
    const wrapper = JSON.parse(fs.readFileSync(path.join(root, entry.path)));
    const checked = R.inspect(wrapper.wire);
    assert(checked.ok, checked.error);
    const framed = C.frame([{name: 'wire', encoding: 'utf8', text: wrapper.wire}]);
    const name = path.basename(entry.path);
    const descriptor = {...makeDescriptor(name, framed.bytes.length), kind: 'admitted-c1-wire',
      model: checked.recording.wire.transition, components: framed.components};
    add({name, descriptor, bytes: framed.bytes, admissionKind: 'c1-wire', segmentBytes: S.LIMIT.payload},
      {wire: wrapper.wire, recording: checked.recording});
    qualifications.nativeWires++;
  }
  const scalar = scalarVector();
  const framed = C.frame([{name: 'scalar', encoding: 'utf8', text: R.encode(scalar.value)},
    {name: 'raw', encoding: 'utf16le', text: scalar.raw}]);
  add({name: 'scalars', descriptor: {...makeDescriptor('scalars', framed.bytes.length), components: framed.components},
    bytes: framed.bytes, admissionKind: 'scalar-utf16', segmentBytes: 1}, scalar);
  assert.equal(qualifications.exactCheckpointReplay, 5);
  assert.equal(qualifications.controllerTimedCheckpointReplay, 12);
  return {artifacts, qualifications, sourceHashes};
}

function verifyRecovered(artifact, bytes) {
  assert(bytes instanceof Uint8Array, 'recovered bytes must be a Uint8Array');
  const expected = admitted.get(artifact.name);
  assert(expected, 'prepareInputs must admit this artifact before verification');
  assert.equal(artifact.admissionKind, expected.admissionKind);
  exactSemantic(artifact.descriptor, expected.descriptor, 'descriptor');
  const restored = Buffer.from(bytes);
  assert.deepEqual(restored, expected.bytes, artifact.name + ': byte-for-byte recovery');
  const parts = C.unframe(restored, expected.descriptor);
  const stats = {scalars: 0, negativeZero: 0, containers: 0};
  let replayQualification;
  if (expected.admissionKind === 'checkpoint') {
    assert.equal(parts[1].text, expected.raw, 'exact raw UTF-16 source spelling');
    const checkpoint = JSON.parse(parts[0].text), provenance = JSON.parse(parts[2].text);
    replayQualification = checkpointAdmission(expected.p, checkpoint, parts[1].text, provenance, stats).controllerTimed
      ? 'controller-timed-clock-preserved' : 'all-fields-replayed-exactly';
  } else if (expected.admissionKind === 'c1-wire') {
    assert.equal(parts[0].text, expected.wire, 'exact original native wire');
    const checked = R.inspect(parts[0].text);
    assert(checked.ok, checked.error);
    exactSemantic(checked.recording.wire, expected.recording.wire, 'native wire', stats);
    exactSemantic(checked.recording.state, expected.recording.state, 'native source replay', stats);
    replayQualification = 'frozen-native-callback-model-reinspected';
  } else {
    assert.equal(expected.admissionKind, 'scalar-utf16');
    exactSemantic(JSON.parse(parts[0].text), expected.value, 'scalar vector', stats);
    assert.equal(parts[1].text, expected.raw, 'UTF-16 including isolated surrogate code units');
    assert.equal(stats.negativeZero, 4);
    replayQualification = 'storage-only-scalar-vector';
  }
  return {ok: true, name: artifact.name, admissionKind: expected.admissionKind, bytes: restored.length,
    sha256: hash(restored), replayQualification, ...stats};
}

module.exports = {prepareInputs, verifyRecovered, makeDescriptor, makeRequest, verifySources, verifyLimitRefusals, S, C};
if (require.main === module) {
  const prepared = prepareInputs();
  const checked = prepared.artifacts.map(artifact => verifyRecovered(artifact, artifact.bytes));
  process.stdout.write(JSON.stringify({artifacts: checked, qualifications: prepared.qualifications,
    sourceHashes: prepared.sourceHashes}, null, 2) + '\n');
}
