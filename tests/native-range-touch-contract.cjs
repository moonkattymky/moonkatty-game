/* Socket-free fixture/coverage checks. These do not establish native touch correctness. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const R = require('../field-model.js');
const StoryPlan = require('../story-plan.js');
const {scenarios, profile, checkpoint} = require('./native-range-touch-fixture.cjs');
const source = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
function controllerFunction(file, name) {
  const text = source(file), start = text.indexOf(' function ' + name + '(');
  assert(start >= 0, file + ': expected real function');
  const end = text.indexOf('\n function ', start + 1);
  assert(end > start, file + ': expected next function boundary');
  return text.slice(start, end);
}
const unique = new Set(), totals = {scenarios: scenarios.length, controlPairs: 0, vertical: 0};
for (const spec of scenarios) {
  const records = profile(spec);
  assert.equal(records.mkty_lang, spec.lang || 'en');
  assert.equal(records['mkty_life' + spec.chapter], undefined, 'target chapter is unfinished');
  assert.equal(records.mkty_current_chapter, String(spec.chapter));
  assert(Object.keys(records).every(key => !/pending|user|account|auth|token/.test(key)), 'no authenticated account or reward queue fixture');
  for (let n = 1; n <= 9; n++) {
    const story = StoryPlan.restore(JSON.parse(records[`mkty_story_plan_${n}_v1`]));
    assert(story, 'real story validator accepts all prerequisite fixtures');
    assert.equal(story.done.length, 8);
    if (n < spec.chapter) assert.equal(records['mkty_life' + n], 'complete');
  }
  if (spec.spatial) {
    assert.equal(JSON.parse(records.mkty_story_plan_8_v1).edition, 2);
    assert.deepEqual(JSON.parse(records.mkty_field_finale_8_v1), {version: 1, n: 8, phase: 1, seed: 731, seconds: 19});
  }
  totals.controlPairs += spec.controls.length * (spec.resume ? 2 : 1) + (spec.mechanic === 8 ? 1 : 0);
  totals.vertical += Number(!!spec.mechanic);
  for (const control of spec.controls) unique.add(control.kind === 'field' ? 'field-' + spec.mechanic + control.selector : control.selector);
  if (spec.mechanic) {
    const stage = spec.spatial ? 4 : 3, seed = spec.spatial ? 731 + 7919 : 21;
    const field = R.create(spec.mechanic, stage, seed);
    assert(R.restore(field, spec.mechanic, stage, seed), 'public field fixture is restorable');
    assert.equal(field.version, 2);
    for (const control of spec.controls) {
      const bounds = control.key === 'trim' ? [-20, 20] : control.key === 'power' ? [20, 90] : control.key === 'valve' ? [0, 100] : spec.mechanic === 8 ? [0, 359] : [15, 80];
      for (const fraction of [.18, .82]) {
        const value = Math.round(bounds[0] + fraction * (bounds[1] - bounds[0]));
        assert(R.act(field, control.key, control.key === 'valve' ? [Number(control.index), value] : value), 'real field model accepts range input');
        assert.equal(control.key === 'valve' ? field.valves[Number(control.index)] : spec.mechanic === 8 ? field.angles[field.station] : field[control.key], value);
        assert.equal(field.complete, false, 'drags alone never forge completion');
        assert(R.restore(field, spec.mechanic, stage, seed), 'native-range values remain serializable');
      }
    }
  }
}
assert.equal(unique.size, 14);
assert.deepEqual(totals, {scenarios: 13, controlPairs: 34, vertical: 8});
// Execute the production restore functions unchanged, with only storage and state shells.
const reactor = checkpoint(5).value;
const reactorContext = {localStorage: {getItem: () => JSON.stringify(reactor)}};
vm.createContext(reactorContext);
vm.runInContext(`let state={};const checkpointKey='mkty_reactor5_checkpoint_v2',clamp=(v,a,b)=>Math.max(a,Math.min(b,v));${controllerFunction('reactor5.js', 'restoreCheckpoint')}this.valid=restoreCheckpoint();this.restored=state;`, reactorContext);
assert.equal(reactorContext.valid, true, 'real reactor restore accepts balanced-stage fixture');
assert.equal(reactorContext.restored.phase, 'balance');
for (const phase of ['ignition', 'flight']) {
  const data = checkpoint(6, phase).value, context = {localStorage: {getItem: () => JSON.stringify(data)}};
  vm.createContext(context);
  vm.runInContext(`let s={};const KEY='mkty_liftoff6_checkpoint_v1',systems=['NAV','FUEL','CREW','CORE'],phases=['briefing','preflight','ignition','countdown','flight','abort','orbit','complete'];${controllerFunction('liftoff6.js', 'restore')}this.valid=restore();this.restored=s;`, context);
  assert.equal(context.valid, true, 'real flight restore accepts ' + phase + ' fixture');
  assert.equal(context.restored.phase, phase);
  assert.equal(context.restored.armed, 4);
}
const test = fs.readFileSync(path.join(__dirname, 'native-range-touch.cjs'), 'utf8');
assert(!/require\(['"](?:node:)?(?:http|https|net)['"]\)/.test(test), 'native suite never opens a server');
assert(!/\.dispatchEvent\s*\(|\.fill\s*\(|\.value\s*=/.test(test.replace(/\/\*[\s\S]*?\*\//g, '')), 'native suite never assigns a range or synthesizes an input event');
assert(test.includes("if (url.origin !== origin) {record.blockedExternalRequests++; return route.abort();}"), 'every external origin is aborted');
assert(test.includes("serviceWorkers: 'block'"));
assert(test.includes("Input.dispatchTouchEvent"));
console.log(JSON.stringify({...totals, distinctRanges: unique.size, plannedNativeGestures: totals.controlPairs * 2 + totals.vertical,
  storyFixturesValid: true, reactorAndFlightRestoreValid: true, fieldFixturesAndRangeValuesValid: true, browserCoverage: false}));
