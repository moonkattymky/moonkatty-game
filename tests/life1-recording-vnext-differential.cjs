'use strict';
/* Socket-free source differential with MANUALLY annotated source-call steps.
 * The fixture executes original app/experience/campaign excerpts. This test is
 * not automatic-capture evidence, native-layout certification, or timing/admission
 * proof: its synthetic DOM deliberately shares the frozen native geometry math.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {create, DEFAULT_CONTEXT, MEASURED_GEOMETRY} = require('./fixtures/life1-recording-vnext-controller-helper.cjs');
const Model = require('../prototypes/life1-capture/vnext/source-model.cjs');
const sourcePath = path.join(__dirname, 'fixtures/life1-recording-source-controller.cjs');
const frozenHash = crypto.createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex');
const EXPECTED_SOURCE_HASH = '669887107233f27fdfc52d1f26ddef15c18e91dacb2536bcb7d04b384695b4c2';
assert.equal(frozenHash, EXPECTED_SOURCE_HASH, 'frozen source oracle must remain byte-identical');
let comparedStates = 0, comparedCallbacks = 0, immutabilityChecks = 0;
const callbackKinds = new Set();
function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
const envelope = snapshot => ['width', 'height', 'left', 'top'].map(key => snapshot.liveGeometry[key]);
const liveStep = snapshot => ['live', ...envelope(snapshot)];
const normalizedNear = value => value === 'repairTerminal' ? 'repair' : value === 'antennaHotspot' ? 'antenna' : value;
function equalRect(actual, expected, name) {
  for (const key of ['left', 'top', 'right', 'bottom', 'width', 'height']) {
    assert(Object.is(actual[key], expected[key]), name + '.' + key + ': ' + actual[key] + ' !== ' + expected[key]);
  }
}
function compare(pair, label) {
  const actual = pair.controller.snapshot(), expected = pair.state;
  const mappings = {x: 'x', y: 'y', direction: 'direction', walkDistance: 'walkDistance', walking: 'walking',
    moveX: 'moveX', moveY: 'moveY', lastFrame: 'lastFrame', nearbyAt: 'nearbyAt', clockResumedAt: 'clockResumedAt',
    stage: 'stage', repairCells: 'repairCells', repairShowing: 'repairShowing', target: 'frequency', dial: 'dial',
    holdProgress: 'holdProgress', holdActive: 'holding', repairOpen: 'repairOpen', antennaOpen: 'antennaOpen',
    completeVisible: 'completeVisible', active: 'active', paused: 'paused', hidden: 'hidden'};
  for (const [from, to] of Object.entries(mappings)) {
    assert(Object.is(actual[from], expected[to]), label + ': ' + from + ' source=' + actual[from] + ' model=' + expected[to]);
  }
  assert.equal(actual.now, expected.dispatchMs, label + ': raw dispatch');
  assert.equal(actual.energyCollected, expected.collected.length, label + ': energy count');
  assert.deepEqual(actual.collectedIds.map(String), ['1', '2', '3'].filter(id => expected.collected.includes(id)), label + ': collection membership');
  assert.deepEqual(actual.repairSequence, expected.sequence, label + ': repair sequence');
  assert.deepEqual(actual.repairInput, expected.repairInput, label + ': repair input');
  assert.deepEqual(actual.cellsDisabled, Array(3).fill(expected.repairDisabled), label + ': input disabled');
  assert.equal(normalizedNear(actual.near), expected.near, label + ': nearby selection');
  for (const key of ['width', 'height']) assert(Object.is(actual.geometry[key], expected.geometry[key]), label + ': cache ' + key);
  assert.deepEqual(actual.geometry.obstacles, expected.geometry.obstacles, label + ': cached collision edges');
  // A status write can change DOM layout after the last original geometry read.
  // In that interval the model retains its last observation, not a live DOM poll.
  if (!pair.unobservedLive) {
    equalRect(actual.rectangles.world, expected.liveGeometry.world, label + ': live world');
    equalRect(actual.rectangles.player, Model.N.playerRect(expected.liveGeometry, expected.x, expected.y), label + ': player');
    for (let i = 0; i < 3; i++) equalRect(actual.rectangles.obstacles[i], expected.liveGeometry.rawObstacles[i], label + ': obstacle ' + i);
    for (const [index, id] of ['1', '2', '3', 'repair', 'antenna'].entries()) {
      const rect = index < 3 ? actual.rectangles.energies[index] : actual.rectangles[id];
      equalRect(rect, Model.N.spotRect(expected.liveGeometry, id, expected.highlightedNear, expected.collected.includes(id)), label + ': target ' + id);
    }
  }
  assert.deepEqual(pair.controller.source().missionDelayHandles.map(String), Object.keys(expected.timers), label + ': mission timer handles');
  comparedStates++;
}
function pair(options = {}) {
  const controller = create({capture: false, ...options});
  const s = controller.snapshot();
  const result = {controller, state: Model.create({context: DEFAULT_CONTEXT, initial: envelope(s), clock: {
    lastFrame: s.lastFrame, nearbyAt: s.nearbyAt, clockResumedAt: s.clockResumedAt}}), callbacks: []};
  compare(result, 'initial');
  return result;
}
function commit(pair, kind, steps, label = kind) {
  const previous = pair.state, before = structuredClone(previous);
  const callback = {kind, dispatchMs: pair.controller.snapshot().now, steps};
  const originalCallback = structuredClone(callback);
  freeze(previous); freeze(callback);
  pair.state = Model.transition(previous, callback);
  assert.deepEqual(previous, before, label + ': previous state remains immutable');
  assert.deepEqual(callback, originalCallback, label + ': supplied callback remains immutable');
  immutabilityChecks++; comparedCallbacks++; callbackKinds.add(kind);
  pair.callbacks.push(originalCallback);
  compare(pair, label);
}
function frame(pair, frameMs, dispatchMs = frameMs, x = 0, y = 0) {
  const s = pair.state, source = pair.controller;
  const active = s.active && !s.hidden && !s.paused && !s.repairOpen && !s.antennaOpen && !s.completeVisible;
  const nearbyDue = active && Math.hypot(x, y) > .08 && frameMs - s.nearbyAt >= 90;
  source.dualFrame(frameMs, dispatchMs, x, y);
  const steps = [['frame', frameMs, x, y]];
  if (s.active && !active && (s.walking || x || y)) steps.push(['stop']);
  if (nearbyDue) steps.push(liveStep(source.snapshot()), ['nearby'], ['nearby-at', frameMs]);
  commit(pair, 'frame', steps, 'frame ' + frameMs + ' dispatched ' + dispatchMs);
}
function pause(pair, value, dispatchMs = pair.controller.snapshot().now) {
  pair.controller.setClock(dispatchMs); pair.controller.setPaused(value);
  commit(pair, value ? 'pause' : 'resume', value ? [['pause', true], ['stop']] : [['pause', false]]);
}
function refresh(pair, dispatchMs) {
  pair.controller.setClock(dispatchMs);
  const before = pair.controller.snapshot(), after = pair.controller.refresh();
  const steps = [liveStep(after), ['cache', ...envelope(after)]];
  if (!Object.is(before.x, after.x) || !Object.is(before.y, after.y)) steps.push(['stop'], liveStep(after), ['nearby']);
  commit(pair, 'refresh', steps);
}
function collect(pair, id) {
  const before = pair.controller.snapshot(); pair.controller.collect(Number(id) - 1);
  const steps = [liveStep(before), ['collect', id], liveStep(pair.controller.snapshot()), ['nearby']];
  commit(pair, 'collect', steps);
  return steps;
}
function open(pair, which) {
  const before = pair.controller.snapshot();
  pair.controller[which === 'repair' ? 'openRepair' : 'openAntenna']();
  commit(pair, 'open', [liveStep(before), ['open', which]]);
}
function cell(pair, value) {
  const before = pair.controller.snapshot(); pair.controller.cell(value);
  const steps = [['cell', value]];
  if (before.stage === 1 && pair.controller.snapshot().stage === 2) steps.push(liveStep(pair.controller.snapshot()), ['nearby']);
  commit(pair, 'cell', steps);
}
function navigate(pair, id) {
  const c = pair.controller;
  frame(pair, c.snapshot().now + 1);
  const s = pair.state, q = [{x: s.x, y: s.y, parent: null}], seen = new Set([s.x + ',' + s.y]);
  let goal;
  for (let i = 0; i < q.length; i++) {
    const p = q[i];
    if (Model.Original.distance({...s, x: p.x, y: p.y}, id) < .22) {goal = p; break;}
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const x = p.x + dx, y = p.y + dy, key = x + ',' + y;
      if (x < 7 || x > 90 || y < 18 || y > 88 || seen.has(key) || Model.Original.blocked(s, x, y)) continue;
      seen.add(key); q.push({x, y, parent: p});
    }
  }
  assert(goal, 'a source-controller path exists to ' + id);
  const points = [];
  while (goal.parent) {points.push(goal); goal = goal.parent;}
  for (const p of points.reverse()) {
    const s = pair.state, dx = (p.x - s.x) * s.geometry.width / 100, dy = (p.y - s.y) * s.geometry.height / 100;
    const distance = Math.hypot(dx, dy), parts = Math.ceil(distance / 3.4), dt = distance / parts / 88 * 1000;
    for (let i = 0; i < parts; i++) frame(pair, c.snapshot().now + dt, c.snapshot().now + dt, dx / distance, dy / distance);
  }
}

// Exact measured world-height gap: collect's pre-action read, quest transition,
// status mutation, and post-action nearby read belong to one outer callback.
const measured = pair(MEASURED_GEOMETRY);
navigate(measured, '2');
assert(measured.controller.snapshot().now < 1289);
frame(measured, 1289);
const beforeCollect = measured.state, beforeCollectCopy = structuredClone(measured.state);
const collectSteps = collect(measured, '2');
assert.deepEqual(collectSteps, [
  ['live', 362, 483.96875, 14, 83.15625], ['collect', '2'],
  ['live', 362, 495.84375, 14, 83.15625], ['nearby']
]);
assert.equal(measured.state.geometry.height, 483.96875);
assert.equal(measured.state.liveGeometry.world.height, 495.84375);
assert.equal(measured.controller.snapshot().rectangles.status.height, 30);
assert.throws(() => Model.transition(beforeCollect, {kind: 'collect', dispatchMs: 1289,
  steps: [['live', 362, 483.96875, 14, 83.15625], ['collect', '2']]}),
  'an incomplete collected callback is refused');
assert.deepEqual(beforeCollect, beforeCollectCopy, 'refused callback also preserves its previous state');
const beforeGapFrame = measured.state;
frame(measured, 1296, 1296, 0, 1);
assert.equal(measured.state.y, beforeGapFrame.y + 88 * .007 / 483.96875 * 100);
assert.notEqual(measured.state.y, beforeGapFrame.y + 88 * .007 / 495.84375 * 100);
assert.equal(measured.state.geometry.height, 483.96875);
assert.deepEqual(measured.callbacks.at(-1).steps, [
  ['frame', 1296, 0, 1], ['live', 362, 495.84375, 14, 83.15625], ['nearby'], ['nearby-at', 1296]
], 'the stale-cache moving frame performs its due proximity read against live geometry');
refresh(measured, 1321);
assert.equal(measured.state.geometry.height, 495.84375);

// Dispatch order is distinct from RAF physics time. A paused delivered frame
// updates the exact RAF register, and the first resumed frame uses that value.
const mixed = pair();
frame(mixed, 100, 100, 0, 1);
pause(mixed, true, 110);
frame(mixed, 105, 115);
assert.equal(mixed.state.dispatchMs, 115); assert.equal(mixed.state.lastFrame, 105);
pause(mixed, false, 116);
const beforeResume = mixed.state;
frame(mixed, 112.125, 120.25, 0, 1);
assert.equal(mixed.state.y, beforeResume.y + 88 * .007125 / 402 * 100);
frame(mixed, 112.125, 121.5, 0, 1);
assert.equal(mixed.state.y, beforeResume.y + 88 * .007125 / 402 * 100);
const zero = pair();
frame(zero, -0, -0, 0, 1);
assert(Object.is(zero.state.lastFrame, -0));
assert(Object.is(zero.controller.snapshot().lastFrame, -0));
assert(Object.is(zero.state.dispatchMs, -0));
const zeroY = zero.state.y;
frame(zero, .125, .25, 0, 1);
assert.equal(zero.state.y, zeroY, 'a true negative-zero sentinel still gives a zero first dt');
frame(zero, .125, .5, 0, 1);
assert.equal(zero.state.y, zeroY, 'same-time RAF gives zero dt');
frame(zero, .25, .75, 0, 1);
assert.equal(zero.state.y, zeroY + 88 * .000125 / 402 * 100);

// Isolated branch initial conditions, established through the original campaign
// restoration code. Position/nearby cleanup is a capture-disabled fixture probe,
// not earned gameplay, recorded authority, or a permitted hydration state source.
function seededRepair(options = {}, x = 65.32954025271465, y = 75) {
  const controller = create({capture: false, ...options, storageSeed: {
    mkty_campaign_checkpoint_1: JSON.stringify({version: 1, stage: 1, x, y,
      energy: ['1', '2', '3'], frequency: 77, dial: 20})
  }});
  controller.fixturePosition(x, y, {clearNearby: true});
  const source = controller.snapshot();
  const state = Model.create({context: DEFAULT_CONTEXT, initial: envelope(source),
    clock: {lastFrame: source.lastFrame, nearbyAt: source.nearbyAt, clockResumedAt: source.clockResumedAt}});
  Object.assign(state, {stage: 1, collected: ['1', '2', '3'], x, y, near: null, highlightedNear: null});
  const result = {controller, state, callbacks: []}; compare(result, 'seeded source branch'); return result;
}
const actionEnvelope = {width: 320.625, height: 400.015625, left: 14, top: 83.15625};
const boundaryProbe = seededRepair(actionEnvelope);
assert.equal(boundaryProbe.controller.sourceDistance('repair'), .2399999918811235);
boundaryProbe.controller.nearby();
commit(boundaryProbe, 'nearby', [liveStep(boundaryProbe.controller.snapshot()), ['nearby']]);
assert.equal(boundaryProbe.state.near, 'repair');
assert.equal(boundaryProbe.controller.sourceDistance('repair'), .2400000232942341);
// The direct terminal handler really rechecks distance and rejects this state.
boundaryProbe.controller.openRepair();
commit(boundaryProbe, 'open', [liveStep(boundaryProbe.controller.snapshot())], 'direct open rejects highlighted boundary');
assert.equal(boundaryProbe.state.repairOpen, false);
assert.equal(boundaryProbe.controller.snapshot().status, 'Move closer to interact with this station.');
// The original action handler selects nearby, changes its highlight, then opens
// from that selected target and stage. It does not repeat the distance guard.
const actionBoundary = seededRepair(actionEnvelope);
actionBoundary.controller.action();
commit(actionBoundary, 'action', [liveStep(actionBoundary.controller.snapshot()), ['nearby'],
  ['open', 'repair'], liveStep(actionBoundary.controller.snapshot()), ['nearby']], 'action opens after highlight crosses threshold');
assert.equal(actionBoundary.state.repairOpen, true);
assert.equal(actionBoundary.state.near, null, 'trailing original nearby read clears the now-outside highlight');

// Rejected source actions perform their pre-action distance read, then may write
// a differently sized status. There is no new geometry observation at that write.
function rejectedStatusGap(which) {
  const options = {width: 362, height: 483.96875, left: 14, top: 83.15625,
    statusTextHook: ({text}) => text === (which === 'collect' ? 'Move closer to collect this energy.' :
      'Move closer to interact with this station.') ? {height: 495.84375, statusHeight: 30} : null};
  const p = which === 'collect' ? pair(options) : seededRepair(options, 7, 18);
  const oldLive = structuredClone(p.state.liveGeometry), oldCache = structuredClone(p.state.geometry);
  const before = p.controller.snapshot(); p.controller.setClock(40);
  if (which === 'collect') p.controller.collect(0); else p.controller.openRepair();
  p.unobservedLive = true;
  commit(p, which, [liveStep(before)], 'rejected ' + which + ' keeps last observed geometry');
  assert.equal(p.controller.snapshot().liveGeometry.height, 495.84375, 'status write changed actual synthetic DOM');
  assert.deepEqual(p.state.liveGeometry, oldLive, 'status write is not an implicit source geometry read');
  assert.deepEqual(p.state.geometry, oldCache, 'status write does not refresh collision cache');
  assert.equal(p.state.repairOpen, false); assert.equal(p.state.collected.length, which === 'collect' ? 0 : 3);
  frame(p, 45, 45, 0, 0);
  assert.deepEqual(p.state.liveGeometry, oldLive, 'non-proximity frame does not sample changed layout');
  p.controller.nearby(); p.unobservedLive = false;
  commit(p, 'nearby', [liveStep(p.controller.snapshot()), ['nearby']], 'next source read observes rejected-' + which + ' layout');
  assert.equal(p.state.liveGeometry.world.height, 495.84375);
  assert.equal(p.state.geometry.height, 483.96875);
}
rejectedStatusGap('collect'); rejectedStatusGap('open');

// Continue actual source navigation through repair. Timer registration samples
// are explicitly distinct from callback dispatch, including fresh registrations
// later inside an expiring timer callback. No guessed elapsed time is inserted.
for (const id of ['1', '3']) {navigate(measured, id); collect(measured, id);}
navigate(measured, 'repair'); open(measured, 'repair');
const c = measured.controller;
c.setClock(10000); c.performanceSamples([10007.25]); c.showSequence();
let registration = c.timerRegistrations().at(-1);
assert.equal(registration.lastPerformanceSample, 10007.25);
commit(measured, 'show', [['show'], ['cue'], ['timer-start', registration.id, 'repair', 650, 10007.25]]);
const registrations = [{dispatchMs: 10000, sample: 10007.25}];
let repairTicks = 0;
while (c.snapshot().repairShowing) {
  assert(repairTicks < 100, 'bounded original repair playback');
  const handle = c.source().missionDelayHandles[0], dispatchMs = c.snapshot().now + (repairTicks++ % 2 ? 35 : 65);
  c.performanceSamples([dispatchMs, dispatchMs + 5.5]); c.delayCallback(dispatchMs);
  const handles = c.source().missionDelayHandles, steps = [['timer-tick', handle, dispatchMs]];
  if (!handles.includes(handle)) {
    steps.push(['cue']);
    if (handles.length) {
      registration = c.timerRegistrations().at(-1);
      assert.equal(registration.id, handles[0]);
      assert.equal(registration.lastPerformanceSample, dispatchMs + 5.5);
      steps.push(['timer-start', registration.id, 'repair', 650, registration.lastPerformanceSample]);
      registrations.push({dispatchMs, sample: registration.lastPerformanceSample});
    }
  }
  commit(measured, 'delay', steps);
}
c.performanceSamples([]);
assert.equal(registrations.length, 4);
assert(registrations.every(entry => entry.sample !== entry.dispatchMs));
const sequence = c.snapshot().repairSequence;
cell(measured, sequence[0]); cell(measured, sequence[1]); pause(measured, true);
assert.equal(measured.state.repairCells, 2);
pause(measured, false); cell(measured, sequence[2]); cell(measured, sequence[3]);
navigate(measured, 'antenna'); open(measured, 'antenna');
c.dial(c.snapshot().target); commit(measured, 'dial', [['dial', c.snapshot().dial]]);
c.tune(); commit(measured, 'tune', [['tune']]);
assert.equal(c.timerRegistrations().at(-1).delay, 120);
for (let i = 0; i < 10; i++) {
  c.holdTick(c.snapshot().now + (i % 2 ? 105 : 135));
  commit(measured, 'hold', [['hold', c.snapshot().dial]]);
}
pause(measured, true);
assert.equal(measured.state.holdProgress, 40); assert.equal(measured.state.holding, true);
pause(measured, false);
for (let i = 0; i < 15; i++) {
  const dispatchMs = c.snapshot().now + (i % 2 ? 105 : 135);
  c.performanceSamples([dispatchMs + 3.75]); c.holdTick(dispatchMs);
  const steps = [['hold', c.snapshot().dial]];
  if (c.snapshot().stage === 3) {
    registration = c.timerRegistrations().at(-1);
    assert.equal(registration.lastPerformanceSample, dispatchMs + 3.75);
    steps.push(['finish'], ['timer-start', registration.id, 'complete', 300, registration.lastPerformanceSample]);
  }
  commit(measured, 'hold', steps);
}
assert.equal(measured.state.holdProgress, 100);
let completionTicks = 0;
while (!c.snapshot().completeVisible) {
  assert(completionTicks < 20, 'bounded original completion delay');
  const handle = c.source().missionDelayHandles[0], dispatchMs = c.snapshot().now + (completionTicks++ % 2 ? 35 : 65);
  c.performanceSamples([dispatchMs]); c.delayCallback(dispatchMs);
  const steps = [['timer-tick', handle, dispatchMs]];
  if (c.snapshot().completeVisible) steps.push(['card']);
  commit(measured, 'delay', steps);
}
assert.equal(c.snapshot().memoryCodeShows, 1);
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex'), frozenHash);
const report = {test: 'life1-recording-vnext-differential', comparedStates, comparedCallbacks, immutabilityChecks,
  callbackKinds: [...callbackKinds], measuredCollectDispatchMs: 1289, staleCacheFrameMs: 1296, actualRefreshMs: 1321,
  measuredLiveHeights: [483.96875, 495.84375], nonzeroMovementUsesStaleCache: true, staleCacheNearbyUsesLiveGeometry: true,
  separateRawDispatchAndRaf: true, duplicateRaf: true, negativeZeroSentinel: true, rejectedCallbackPreservesPreviousState: true,
  fractionalRegistrationSamples: registrations, originalDelayJitter: [65, 35], originalHoldJitter: [135, 105],
  pausedTwoCellRepair: true, pausedFortyPercentHold: true, originalCompletionCard: true,
  sourceActionOpenBoundary: {initial: [320.625, 400.015625, 14, 83.15625], x: 65.32954025271465, y: 75,
    unhighlightedDistance: .2399999918811235, highlightedDistance: .2400000232942341,
    directOpenRejected: true, actionOpenAccepted: true, isolatedSeededSourceBranch: true},
  rejectedCollectAndOpenRetainLastObservedLiveGeometry: true,
  frozenSourceSha256: frozenHash, manuallyAnnotatedCallbacks: true, sharedSyntheticGeometry: true,
  automaticCaptureCertified: false, browserExecuted: false, nativeGeometryCertified: false, authoritativeAdmission: false};
const out = process.env.MKTY_TEST_OUTPUT || '/tmp/mkty-life1-recording-vnext-differential';
fs.mkdirSync(out, {recursive: true}); fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
