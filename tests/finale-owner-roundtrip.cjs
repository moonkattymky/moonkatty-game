'use strict';
/* Socket-free callback-seam characterization. The injection lives only in tests. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {createFixture, storyKey, activeKey} = require('./fixtures/finale-owner-roundtrip.cjs');
const P = require('../story-plan.js');
const OldP = require('./fixtures/story-plan-before-finale-evidence.js');
const R = require('../field-model.js');
const C = require('../trace-codec.js');
const input = require('./fixtures/finale-checkpoints-17-state.json');
const root = path.resolve(__dirname, '..');
const checks = [];
const test = (name, fn) => { fn(); checks.push(name); };
const copy = value => structuredClone(value);
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const plan = n => ({...P.fresh(n, 9000 + n, 2), createdAt: 1, phase: 'core', done: [0, 1, 2, 3, 4, 5, 6, 7]});
const first = input.campaigns[0];
function data(campaign, phase = campaign.phases[0]) {
  return {
    [storyKey(campaign.chapter)]: JSON.stringify(plan(campaign.chapter)),
    [activeKey(campaign.chapter)]: C.stringify({version: 1, n: campaign.chapter,
      phase: phase.index, seed: campaign.baseSeed, seconds: 0, checkpoint: phase.state}),
    mkty_points: '12250', mkty_pending_v2_101: 'synthetic-unchanged'
  };
}
const options = campaign => ({provenance: (_n, index) => campaign.phases.find(phase => phase.index === index).provenance});
function start(campaign = first, phase = campaign.phases[0], extra = {}, opts = {}) {
  const fixture = createFixture({...data(campaign, phase), ...extra}, {...options(campaign), ...opts});
  fixture.open(campaign.chapter);
  return fixture;
}
function retained(fixture, before, phase, error) {
  const attempt = fixture.attempts.at(-1);
  assert.equal(attempt.result.ok, false);
  if (error) assert.match(attempt.result.error, error);
  assert.equal(attempt.originalCalled, false);
  assert.equal(attempt.result.mayRetireCapturedCheckpoint, false);
  assert.equal(fixture.storage.map.get(activeKey(phase.chapter || first.chapter)), attempt.sourceValue);
  assert.deepEqual(attempt.previousSnapshot, before);
  assert.deepEqual(attempt.checkpoint, phase.state);
  assert.equal(attempt.checkpointText, C.stringify(phase.state));
  assert.equal(fixture.awards.length, 0);
  assert.equal(fixture.events.some(event => event.type === 'original-complete'), false);
  assert.equal(fixture.storage.map.get('mkty_points'), '12250');
  assert.equal(fixture.storage.map.get('mkty_pending_v2_101'), 'synthetic-unchanged');
}

test('original unmodified callback retires source without capturing evidence: all 17 checkpoints', () => {
  for (const phase of input.phases) {
    const campaign = {chapter: phase.chapter, baseSeed: (phase.seed - phase.index * 7919) >>> 0, phases: [phase]};
    const fixture = start(campaign, phase, {}, {inject: false});
    const before = fixture.storage.map.get(activeKey(phase.chapter));
    fixture.task.complete(copy(phase.state));
    const after = fixture.storage.map.get(activeKey(phase.chapter));
    assert.notEqual(after, before);
    if (phase.index === (phase.chapter === 8 ? 1 : 2)) assert.equal(after, undefined);
    else { assert.equal(JSON.parse(after).phase, phase.index + 1); assert.equal(JSON.parse(after).checkpoint, undefined); }
    assert.equal(fixture.owner.inspect(JSON.parse(fixture.storage.map.get(storyKey(phase.chapter)))).kind, 'absent');
    assert.equal(fixture.attempts.length, 0);
  }
});

let exactReplay = 0, controllerTimed = 0;
test('all 17 raw traces earn completion; action-only timer qualification stays explicit', () => {
  assert.equal(input.phases.length, 17);
  for (const phase of input.phases) {
    const replay = R.create(phase.mechanic, phase.fieldStage, phase.seed, phase.state.mods);
    for (const row of phase.state.trace) {
      if (row[0] === 'act') R.act(replay, row[1], row[2]);
      else for (let tick = 0; tick < row[1]; tick++) R.tick(replay, 1 / 60, {x: row[2], y: row[3]});
    }
    assert(replay.complete && R.won(replay));
    const expected = copy(phase.state); delete expected.trace;
    if (expected.seconds !== replay.seconds) {
      assert.equal(expected.seconds, 3); assert.equal(replay.seconds, 0);
      expected.seconds = replay.seconds; controllerTimed++;
    } else exactReplay++;
    assert.deepEqual(replay, expected);
  }
  assert.equal(exactReplay, 5); assert.equal(controllerTimed, 12);
});

test('test-injected handoff stores all 17 FULL raw checkpoints before real original cleanup', () => {
  for (const phase of input.phases) {
    const campaign = {chapter: phase.chapter, baseSeed: (phase.seed - phase.index * 7919) >>> 0, phases: [phase]};
    const fixture = start(campaign, phase);
    assert(fixture.task.complete(copy(phase.state)).ok);
    const attempt = fixture.attempts[0];
    assert(attempt.originalCalled && attempt.acknowledged.mayRetireCapturedCheckpoint);
    const stored = fixture.owner.inspect(JSON.parse(fixture.storage.map.get(storyKey(phase.chapter))));
    const record = stored.envelope.completed.find(record => record.index === phase.index);
    assert.equal(C.stringify(record.checkpoint), C.stringify(phase.state));
    assert.deepEqual(record.provenance, phase.provenance);
    assert.equal(stored.summary.authority, 'not-established');
    assert.deepEqual(stored.summary.missingPhases, Array.from({length: phase.index}, (_, index) => index));
    const cleanupIndex = fixture.events.findIndex(event => event.type === 'original-complete');
    const writeIndex = fixture.events.findIndex(event => event.type === 'write' && event.key === storyKey(phase.chapter));
    assert(writeIndex >= 0 && writeIndex < cleanupIndex);
    assert(fixture.events.slice(writeIndex + 1, cleanupIndex).some(event => event.type === 'read' && event.key === storyKey(phase.chapter)));
  }
});

test('repeated completed callbacks cannot retire another phase or duplicate original side effects', () => {
  for (const phase of input.phases) {
    const campaign = {chapter: phase.chapter, baseSeed: (phase.seed - phase.index * 7919) >>> 0, phases: [phase]};
    const fixture = start(campaign, phase), completedTask = fixture.task;
    assert(completedTask.complete(copy(phase.state)).ok);
    const before = fixture.snapshot(), eventCount = fixture.events.length, awardCount = fixture.awards.length;
    const repeated = completedTask.complete(copy(phase.state));
    assert.equal(repeated.ok, false);
    assert.match(repeated.error, /fixture_stale_context|fixture_stale_source/);
    assert.deepEqual(fixture.snapshot(), before);
    assert.equal(fixture.awards.length, awardCount);
    assert.equal(fixture.events.slice(eventCount).some(event => ['write', 'remove', 'original-complete'].includes(event.type)), false);
  }
});

for (const campaign of input.campaigns) test('checked callback, actual story completion, reload and archive: ' + campaign.chapter + '/' + campaign.baseSeed, () => {
  let fixture = start(campaign);
  for (const phase of campaign.phases) {
    assert.equal(fixture.task.id, phase.index);
    fixture.task.save(copy(phase.state));
    const originalRaw = fixture.storage.map.get(activeKey(campaign.chapter));
    assert(fixture.task.complete(copy(phase.state)).ok);
    const attempt = fixture.attempts.at(-1);
    assert.equal(attempt.sourceValue, originalRaw);
    const stored = fixture.owner.inspect(JSON.parse(fixture.storage.map.get(storyKey(campaign.chapter))));
    assert.equal(stored.envelope.completed.length, phase.index + 1);
    for (const prior of campaign.phases.slice(0, phase.index + 1)) {
      assert.deepEqual(stored.envelope.completed[prior.index].checkpoint, prior.state);
    }
    if (phase.index < campaign.phases.length - 1) {
      fixture = createFixture(fixture.snapshot(), options(campaign));
      fixture.open(campaign.chapter);
    }
  }
  assert.equal(fixture.storage.map.has(activeKey(campaign.chapter)), false);
  assert.deepEqual(fixture.awards, [{chapter: campaign.chapter, points: campaign.chapter === 8 ? 2000 : 3000}]);
  fixture.c.MKTYStory.complete(campaign.chapter);
  const raw = fixture.storage.map.get(storyKey(campaign.chapter));
  const completed = JSON.parse(raw);
  assert.equal(completed.phase, 'complete');
  assert(fixture.owner.inspect(completed).summary.evidenceComplete);
  const reloaded = createFixture(fixture.snapshot(), options(campaign));
  assert.equal(reloaded.c.MKTYStory.read(campaign.chapter).finaleEvidence.payload, completed.finaleEvidence.payload);
  reloaded.c.MKTYStory.replay(campaign.chapter);
  const pointer = reloaded.storage.map.get('mkty_story_archive_latest_' + campaign.chapter);
  const archived = JSON.parse(reloaded.storage.map.get(pointer));
  assert.equal(archived.snapshot[storyKey(campaign.chapter)], raw);
  assert.equal(archived.snapshot[activeKey(campaign.chapter)], undefined);
  assert.equal(reloaded.owner.inspect(reloaded.c.MKTYStory.read(campaign.chapter)).kind, 'absent');
});

test('quota, memory-only, silently discarded write and failed readback retain every input byte for all 17 checkpoints', () => {
  for (const phase of input.phases) for (const fault of ['quota', 'memory', 'discard', 'readback']) {
    const campaign = {chapter: phase.chapter, baseSeed: (phase.seed - phase.index * 7919) >>> 0, phases: [phase]};
    const fixture = start(campaign, phase);
    // Whitespace and numeric spelling belong to the retained raw storage input.
    const value = fixture.storage.map.get(activeKey(phase.chapter));
    fixture.storage.map.set(activeKey(phase.chapter), '\n  ' + value + ' \n');
    const before = fixture.snapshot();
    if (fault === 'memory') fixture.state.persistent = false;
    else fixture.state.fault = fault;
    fixture.task.complete(copy(phase.state));
    retained(fixture, before, phase, /synthetic_quota|persistence_unconfirmed|synthetic_readback/);
    if (fault === 'quota' || fault === 'discard') assert.deepEqual(fixture.snapshot(), before);
    else assert.equal(fixture.storage.map.get(storyKey(phase.chapter)), fixture.attempts[0].prepared.write.value);
  }
});

test('aggregate capacity refuses before writes and preserves prior accepted evidence plus current checkpoint', () => {
  const campaign = input.campaigns.find(value => value.chapter === 9);
  const fixture = start(campaign);
  assert(fixture.task.complete(copy(campaign.phases[0].state)).ok);
  fixture.task.save(copy(campaign.phases[1].state));
  for (const n of [1, 2]) fixture.storage.map.set('mkty_operations_' + n + '_v1', JSON.stringify({syntheticPadding: 'x'.repeat(174000)}));
  const before = fixture.snapshot(), count = fixture.events.length;
  fixture.task.complete(copy(campaign.phases[1].state));
  const attempt = fixture.attempts.at(-1);
  assert.equal(attempt.result.error, 'snapshot_too_large');
  assert.equal(attempt.originalCalled, false);
  assert.deepEqual(fixture.snapshot(), before);
  assert.deepEqual(attempt.previousSnapshot, before);
  assert.deepEqual(attempt.checkpoint, campaign.phases[1].state);
  assert.equal(fixture.events.slice(count).some(event => ['write', 'remove', 'original-complete'].includes(event.type)), false);
  assert.equal(fixture.owner.inspect(JSON.parse(before[storyKey(9)])).envelope.completed.length, 1);
});

test('unknown and unreadable evidence refuses without normalizing or overwriting raw stored bytes', () => {
  for (const evidence of [{version: 99, recovery: ['future']}, {format: 'mkty-finale-evidence', version: 1, encoding: 'mkty-trace-v1/json', payload: 'damaged'}]) {
    const raw = '{\n  ' + JSON.stringify({...plan(8), finaleEvidence: evidence}).slice(1, -1) + ', "unknownNumeric": -0.0\n}';
    const fixture = start(first, first.phases[0], {[storyKey(8)]: raw});
    const before = fixture.snapshot();
    fixture.task.complete(copy(first.phases[0].state));
    retained(fixture, before, first.phases[0], /evidence_opaque|evidence_unreadable/);
    assert.deepEqual(fixture.snapshot(), before);
  }
});

test('interruption after write recovers exact capture on reload without duplicate append or rewrite', () => {
  const fixture = start();
  fixture.state.hooks.interruptBeforeCleanup = true;
  const before = fixture.snapshot();
  fixture.task.complete(copy(first.phases[0].state));
  retained(fixture, before, first.phases[0], /interrupted_before_cleanup/);
  assert(fixture.attempts[0].acknowledged.ok);
  const disk = fixture.snapshot();
  const reloaded = createFixture(disk, options(first)); reloaded.open(8);
  assert(reloaded.task.complete(copy(first.phases[0].state)).ok);
  const attempt = reloaded.attempts[0];
  assert.equal(attempt.prepared.change, 'duplicate');
  assert(attempt.acknowledged.retirementRecovery);
  assert.equal(reloaded.events.some(event => event.type === 'write' && event.key === storyKey(8)), false);
  assert.equal(reloaded.owner.inspect(JSON.parse(reloaded.storage.map.get(storyKey(8)))).envelope.completed.length, 1);
  assert.equal(JSON.parse(reloaded.storage.map.get(activeKey(8))).phase, 1);
});

test('account, route, navigation, and superseded callback contexts never consume original cleanup', () => {
  for (const changed of ['account', 'route', 'navigation', 'reopen']) {
    const fixture = start(), task = fixture.task;
    if (changed === 'reopen') fixture.open(8);
    else fixture.state.context[changed] = 'changed';
    const before = fixture.snapshot();
    task.complete(copy(first.phases[0].state));
    retained(fixture, before, first.phases[0], /fixture_stale_context/);
    assert.deepEqual(fixture.snapshot(), before);
  }
});

test('stale source and story at checked write do not overwrite a newer writer', () => {
  for (const key of [activeKey(8), storyKey(8)]) {
    const fixture = start();
    fixture.state.hooks.beforePersist = () => fixture.storage.map.set(key, 'newer-writer-bytes');
    const before = fixture.snapshot();
    fixture.task.complete(copy(first.phases[0].state));
    const attempt = fixture.attempts[0];
    assert.equal(attempt.result.error, 'source_changed');
    assert.equal(attempt.originalCalled, false);
    assert.equal(fixture.storage.map.get(key), 'newer-writer-bytes');
    assert.deepEqual(attempt.previousSnapshot, before);
    assert.equal(fixture.events.some(event => event.type === 'write' || event.type === 'remove'), false);
  }
});

test('checkpoint mismatch and changed session seed refuse before any cleanup or evidence write', () => {
  for (const change of ['checkpoint', 'seed']) {
    const fixture = start(), checkpoint = copy(first.phases[0].state);
    if (change === 'checkpoint') checkpoint.trace.push(['act', 'tune', checkpoint.band]);
    else {
      const current = JSON.parse(fixture.storage.map.get(activeKey(8)));
      current.seed = (current.seed + 1) >>> 0;
      fixture.storage.map.set(activeKey(8), JSON.stringify(current));
    }
    const before = fixture.snapshot();
    fixture.task.complete(checkpoint);
    const attempt = fixture.attempts[0];
    assert.match(attempt.result.error, /capture_source_mismatch|fixture_stale_source/);
    assert.equal(attempt.originalCalled, false);
    assert.deepEqual(fixture.snapshot(), before);
    assert.deepEqual(attempt.checkpoint, checkpoint);
    assert.equal(fixture.events.some(event => event.type === 'write' || event.type === 'remove'), false);
  }
});

test('context changes between preparation and persistence cannot grant cleanup', () => {
  const fixture = start(), before = fixture.snapshot();
  fixture.state.hooks.beforePersist = () => { fixture.state.context.route = 'replacement-route'; };
  fixture.task.complete(copy(first.phases[0].state));
  retained(fixture, before, first.phases[0], /fixture_stale_context/);
  assert.deepEqual(fixture.snapshot(), before);
});

test('post-ack context, persistence or bytes changes revoke test cleanup while retaining old/new inputs separately', () => {
  for (const change of ['context', 'persistence', 'story', 'source']) {
    const fixture = start(), before = fixture.snapshot();
    fixture.state.hooks.beforeCleanup = () => {
      if (change === 'context') fixture.state.context.account = 'other-owner';
      else if (change === 'persistence') fixture.state.persistent = false;
      else fixture.storage.map.set(change === 'story' ? storyKey(8) : activeKey(8), 'newer-after-ack');
    };
    fixture.task.complete(copy(first.phases[0].state));
    const attempt = fixture.attempts[0];
    assert(attempt.acknowledged.ok);
    assert.equal(attempt.originalCalled, false);
    assert.match(attempt.result.error, /fixture_stale_context|fixture_persistence_changed|fixture_stale_acknowledgement/);
    assert.deepEqual(attempt.previousSnapshot, before);
    assert.equal(attempt.sourceValue, before[activeKey(8)]);
    assert.deepEqual(attempt.checkpoint, first.phases[0].state);
    assert.equal(fixture.events.some(event => event.type === 'remove' || event.type === 'original-complete'), false);
  }
});

test('an old StoryPlan writer between acknowledgement and cleanup invalidates the handoff', () => {
  const fixture = start(), before = fixture.snapshot();
  fixture.state.hooks.beforeCleanup = () => {
    const old = createFixture(fixture.snapshot(), {model: OldP, inject: false});
    old.c.MKTYStory.complete(8);
    fixture.storage.map.set(storyKey(8), old.storage.map.get(storyKey(8)));
  };
  fixture.task.complete(copy(first.phases[0].state));
  retained(fixture, before, first.phases[0], /fixture_stale_acknowledgement/);
  assert.equal(fixture.owner.inspect(JSON.parse(fixture.storage.map.get(storyKey(8)))).kind, 'absent');
});

test('a genuine old writer after source retirement loses copied evidence; no durability claim', () => {
  const fixture = start();
  assert(fixture.task.complete(copy(first.phases[0].state)).ok);
  assert.equal(JSON.parse(fixture.storage.map.get(activeKey(8))).checkpoint, undefined);
  const transported = C.unpackSnapshot(C.packSnapshot(fixture.snapshot()));
  const old = createFixture(transported, {model: OldP, inject: false});
  assert.equal(old.owner.inspect(JSON.parse(old.storage.map.get(storyKey(8)))).kind, 'known');
  old.c.MKTYStory.complete(8);
  const next = createFixture(old.snapshot(), options(first));
  assert.equal(next.owner.inspect(next.c.MKTYStory.read(8)).kind, 'absent');
  assert.equal(next.c.MKTYStory.read(8).phase, 'complete');
  assert.equal(JSON.parse(next.storage.map.get(activeKey(8))).checkpoint, undefined);
});

test('an old owner cannot acknowledge a newly proposed evidence write', () => {
  const fixture = start(first, first.phases[0], {}, {model: OldP});
  const before = fixture.snapshot();
  fixture.task.complete(copy(first.phases[0].state));
  // Frozen helper's equality serializes undefined after the old model drops the
  // field; the codec throws trace_invalid before its named owner error is reached.
  retained(fixture, before, first.phases[0], /^trace_invalid$/);
  assert.deepEqual(fixture.snapshot(), before);
});

test('injection is test-only and real production files remain pinned', () => {
  const expected = {
    'chapter-space.js': 'e8c38ea4db0db9d5054f73ce69655fb33c1af11d2a6a67418ac3250c9d905af0',
    'field-missions.js': '4c7f573cc0fef7d7bb8c27b599791134b0d55354c135205928ddba8aa0cae1c2',
    'story.js': 'fe567d0983f0243e931053972d338ebad9bc72ea1628bfcf30b3c3b6b09b4249',
    'finale-evidence-owner.js': 'e582316f1e56a9a13222bca42f63fead5e251ff3d3a97decff1cf5a01813e6fd',
    'index.html': '3c51e6458d985c46257c265e667bfcabbf3420cfa2f41722bb48ebf4a1da9643'
  };
  for (const [name, hash] of Object.entries(expected)) assert.equal(sha256(fs.readFileSync(path.join(root, name))), hash, name);
  const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.equal(/finale-evidence-owner|finale-owner-roundtrip/.test(index), false);
});

const report = {
  scope: 'test-only injection into actual unmodified chapter-space callback; socket-free VM',
  passed: checks.length, checks, originalEarnedCheckpoints: 17,
  timingQualification: {exactModelReplays: exactReplay, controllerTimedActionOnly: controllerTimed, authoritativeTimingProof: false},
  productionFilesChanged: false, runtimeIntegration: false, serverActivation: false,
  originalCallbackOnCaptureFailure: 'withheld only by test injection; not an approved gameplay gate',
  oldWriterPreservesEvidence: false, crossTabAtomicity: false,
  durableRecoveryAfterProcessLossOnUnconfirmedWrite: 'not established',
  requiredPolicyDecision: 'single source key cannot both retain failed capture and follow original cleanup; supported writer/version, persistence and failure policy remain unresolved'
};
console.log(JSON.stringify(report, null, 2));
if (process.env.MKTY_FINALE_ROUNDTRIP_REPORT) fs.writeFileSync(process.env.MKTY_FINALE_ROUNDTRIP_REPORT, JSON.stringify(report, null, 2) + '\n');
