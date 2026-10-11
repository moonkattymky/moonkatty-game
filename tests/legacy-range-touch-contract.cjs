/* Socket-free legacy fixture validation. Browser/native results are deliberately separate. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const StoryPlan = require('../story-plan.js');
const {scenarios, checkpoint, profile} = require('./legacy-range-touch-fixture.cjs');
const current = require('./native-range-touch-fixture.cjs');
const source = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const app = source('app.js');
function functionLine(name) {
  const line = app.split('\n').find(line => line.startsWith('function ' + name + '('));
  assert(line && line.endsWith('}'), 'expected complete single-line production function: ' + name);
  return line;
}
function continuation() {
  const nodes = new Map();
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, {value: '', textContent: '', hidden: false, dataset: {}, style: {
      setProperty(key, value) {this[key] = value;}
    }});
    return nodes.get(id);
  };
  const context = {$: node, document: {querySelector: node, querySelectorAll: () => []}, clearInterval() {}};
  context.window = context; vm.createContext(context);
  vm.runInContext(`let targetFreq8=0,targetPhase8=0,pulse8=[],pulseInput8=[],pulseRound8=1,phaseTimer8=null,phaseProgress8=0,pulseReady8=false;
    let navTarget9=50,syncSeq9=[],syncInput9=[],syncRound9=1,finalSeq9=[],finalInput9=[],coreHealth9=100,finalPower9=100,finalTimer9=null,syncReady9=false,finalReady9=false;
    ${['setSignalStage8', 'setFinalStage9', 'updateFreq8', 'updatePhase8'].map(functionLine).join('\n')}
    ${source('continuation.js')}`, context);
  return {api: context.MKTYContinuation, node};
}
assert.equal(scenarios.length, 3);
assert.deepEqual(scenarios.map(s => s.controls[0].selector), ['#freq8', '#phase8', '#navDial9']);
for (const spec of scenarios) {
  const records = profile(spec), cp = checkpoint(spec), control = spec.controls[0];
  assert.equal(records['mkty_life' + spec.chapter], undefined, 'target mission has not been completed');
  assert.equal(records['mkty_field_finale_' + spec.chapter + '_v1'], undefined, 'legacy route has no spatial checkpoint');
  assert(Object.keys(records).every(key => !/pending|user|account|auth|token/.test(key)), 'no authenticated account or reward data');
  for (let n = 1; n <= 9; n++) {
    const story = StoryPlan.restore(JSON.parse(records[`mkty_story_plan_${n}_v1`]));
    assert(story); assert.equal(story.edition, 1);
    assert.equal(story.done.length, 8);
    if (n < spec.chapter) assert.equal(records['mkty_life' + n], 'complete');
  }
  const ops = JSON.parse(records[`mkty_operations_${spec.chapter}_v1`]);
  assert.equal(ops.round, 3); assert.equal(ops.phase, 'core');
  const {api, node} = continuation();
  assert.equal(api.restore(spec.chapter, cp), true, 'unchanged production continuation accepts pre-control fixture');
  assert.deepEqual(JSON.parse(JSON.stringify(api.save(spec.chapter))), cp, 'production restore/save roundtrip preserves every seeded field');
  assert.equal(Number(node(control.selector.slice(1)).value), control.initial, 'fixture starts at declared input value');
  assert.equal(node('mission' + spec.chapter).dataset.stage, spec.stage);
  if (spec.chapter === 9) assert.equal(records.mkty_life9_coordinates, cp.latitude + ',' + cp.longitude);
  if (control.key === 'frequency') {
    const strength = Math.max(0, 100 - Math.abs(cp.frequency - cp.targetFrequency) * 4);
    assert.equal(node('freqRead8').textContent, (140 + cp.frequency / 10).toFixed(1) + ' MHz');
    assert.equal(node('strengthText8').textContent, 'SIGNAL ' + strength + '%');
    assert.equal(node('strengthFill8').style.width, strength + '%');
  } else assert.equal(node(control.key === 'phase' ? 'phaseNeedle8' : 'corridorNeedle9').style.left, control.initial + '%');
}
// Original suite remains a separate 13-scenario/14-control run, not silently expanded.
assert.equal(current.scenarios.length, 13);
assert.equal(current.scenarios.reduce((n, s) => n + s.controls.length * (s.resume ? 2 : 1) + (s.mechanic === 8 ? 1 : 0), 0), 34);
const browser = source('tests/legacy-range-native-touch.cjs');
assert(!/require\(['"](?:node:)?(?:http|https|net)['"]\)|\.dispatchEvent\s*\(|\.fill\s*\(|\.value\s*=/.test(browser), 'legacy suite only uses the trusted native input driver');
assert(browser.includes("require('./native-range-touch.cjs')"));
assert(browser.includes("onceKey: 'native_legacy_range_fixture_seeded'"), 'reload never reseeds prerequisite values');
assert(browser.includes('90000'), 'separate browser suite has a 90-second bound');
console.log(JSON.stringify({legacyScenarios: 3, legacyControls: 3, plannedNativeGestures: 24, productionContinuationFixtures: 'restore/save roundtrip passed',
  originalScenarios: current.scenarios.length, originalControlPairs: 34, browserCoverage: false}));
