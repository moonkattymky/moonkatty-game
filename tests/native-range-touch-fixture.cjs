/* Synthetic guest prerequisites only. No player identifier, authenticated storage or network. */
'use strict';
const finaleControls = {
  3: ['mixO2', 'mixFuel', 'mixCool'].map((id, index) => ({selector: '#' + id, readout: '#' + id + 'Val', kind: 'mix', index, thumb: 16, touchAction: 'pan-x'})),
  4: [{selector: '#thrustDial', readout: '#thrustRead4', kind: 'descent', thumb: 16, touchAction: 'none'}],
  5: [ ['coolantFlow5', 'reactorFlow5', 'flow'], ['fieldTrim5', 'reactorTrim5', 'trim'] ].map(([id, readout, key]) => ({selector: '#' + id, readout: '#' + readout, kind: 'reactor', key, thumb: 20, touchAction: 'none'})),
  6: [{selector: '#lfThrottle6', readout: '#lfThrust6', kind: 'liftoff', key: 'throttle', thumb: 22, touchAction: 'none'}]
};
function fieldControls(mechanic) {
  const keys = mechanic === 3 ? ['angle', 'power', 'trim'] : mechanic === 5 ? ['valve', 'valve', 'valve'] : ['angle'];
  return keys.map((key, i) => {
    const index = mechanic === 5 ? String(i) : '';
    return {selector: `[data-field-slider="${key}"][data-index="${index}"]`, readout: `[data-field-read="${key}${index}"]`,
      kind: 'field', mechanic, key, index, thumb: 16, touchAction: 'pan-y'};
  });
}
const scenarios = [
  ...[3, 4, 5].map(chapter => ({name: 'finale-' + chapter, chapter, width: 390, height: 844, controls: finaleControls[chapter], resume: chapter === 5})),
  ...['ignition', 'flight'].map(phase => ({name: 'finale-6-' + phase, chapter: 6, phase, width: 390, height: 844, controls: finaleControls[6], resume: true})),
  ...[[390, 844], [568, 320]].flatMap(([width, height]) => [3, 5, 8].map(mechanic => ({name: `field-${mechanic}-${width}`, chapter: mechanic, mechanic, width, height, controls: fieldControls(mechanic)}))),
  {name: 'field-3-ar', chapter: 3, mechanic: 3, lang: 'ar', width: 390, height: 844, controls: fieldControls(3)},
  {name: 'chapter-8-phase-2', chapter: 8, mechanic: 3, spatial: true, width: 390, height: 844, controls: fieldControls(3)}
];
function checkpoint(chapter, phase) {
  if (chapter === 3) return {key: 'mkty_campaign_checkpoint_3', value: {version: 1, phase: 'fuel', mix: [30, 40, 30]}};
  if (chapter === 4) return {key: 'mkty_campaign_checkpoint_4', value: {version: 1, alt: 2400, velocity: 18, fuel: 100, drift: 0, driftVelocity: 0, power: 45}};
  if (chapter === 5) return {key: 'mkty_reactor5_checkpoint_v2', value: {version: 2, phase: 'balance', cells: [100, 100, 100], selected: 2, temp: 55, field: 50, fieldTarget: 50, flow: 25, trim: 30, pulses: 0, elapsed: 20}};
  if (chapter === 6) return {key: 'mkty_liftoff6_checkpoint_v1', value: {version: 1, phase, phaseTime: 0, order: ['NAV', 'FUEL', 'CREW', 'CORE'], armed: 4, clock: 35, fault: 0, faultActive: false, faultSolved: true, throttle: 35, alt: 0, x: 50, vx: 0, speed: 0, fuel: 100, hull: 100, temp: 22, gates: 0, offCourse: 0, elapsed: 20, flightTime: 0, flightTimeKnown: true, failedStage: 'preflight', reason: ''}};
  return null;
}
function profile(scenario) {
  const {chapter} = scenario;
  const records = {mkty_lang: scenario.lang || 'en', mkty_test_no_pacing: 'yes', mkty_current_chapter: String(chapter),
    mkty_life1_code_presented: 'yes', mkty_life3_memory_verified: 'yes'};
  for (let n = 1; n <= 9; n++) {
    records[`mkty_story_plan_${n}_v1`] = JSON.stringify({version: 1, edition: scenario.spatial && n === 8 ? 2 : 1, n, seed: n, phase: n < chapter ? 'complete' : 'core', done: [0, 1, 2, 3, 4, 5, 6, 7], tasks: {}, coreSeconds: 0, createdAt: 1791676800000});
    if (n < chapter) {records['mkty_life' + n] = 'complete'; records['mkty_life' + n + '_awarded'] = 'yes';}
    if (n >= 4) records[`mkty_operations_${n}_v1`] = JSON.stringify({version: 1, n, seed: 1, round: 3, phase: n < chapter ? 'complete' : 'core', input: null, confirmed: false, actions: 0, hints: 0, errors: 0, seconds: 0});
  }
  if (scenario.spatial) records.mkty_field_finale_8_v1 = JSON.stringify({version: 1, n: 8, phase: 1, seed: 731, seconds: 19});
  else if (!scenario.mechanic) {const cp = checkpoint(chapter, scenario.phase); records[cp.key] = JSON.stringify(cp.value);}
  return records;
}
module.exports = {scenarios, finaleControls, fieldControls, checkpoint, profile};
