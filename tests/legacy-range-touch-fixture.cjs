/* Edition-1 controller prerequisites, confined to a new anonymous test context. */
'use strict';
const {profile: currentProfile} = require('./native-range-touch-fixture.cjs');
const scenarios = [
  {name: 'legacy-8-frequency', chapter: 8, stage: 'frequency', selector: '#freq8', key: 'frequency', initial: 20},
  {name: 'legacy-8-phase', chapter: 8, stage: 'phase', selector: '#phase8', key: 'phase', initial: 30},
  {name: 'legacy-9-corridor', chapter: 9, stage: 'corridor', selector: '#navDial9', key: 'dial', initial: 25}
].map(({selector, key, initial, ...spec}) => ({...spec, width: 390, height: 844,
  controls: [{selector, key, initial, kind: 'legacy', thumb: 16, touchAction: 'pan-x'}]}));
function checkpoint(spec) {
  if (spec.chapter === 8) return {version: 1, stage: spec.stage, frequency: spec.stage === 'frequency' ? 20 : 35,
    phase: 30, targetFrequency: 35, targetPhase: 50, round: 1, pattern: [], input: [], ready: false};
  return {version: 1, stage: 'corridor', target: 50, dial: 25, latitude: '12.345', longitude: '67.890',
    round: 1, health: 100, power: 100, sync: [], syncInput: [], syncReady: false, final: [], finalInput: [], finalReady: false};
}
function profile(spec) {
  // Reuse the existing prerequisite-only field-fixture path, then provide the explicit
  // continuation checkpoint. This does not open a field scene or seed completed controls.
  const records = currentProfile({chapter: spec.chapter, mechanic: spec.chapter});
  records['mkty_campaign_checkpoint_' + spec.chapter] = JSON.stringify(checkpoint(spec));
  if (spec.chapter === 9) records.mkty_life9_coordinates = '12.345,67.890'; // Synthetic game coordinates.
  return records;
}
module.exports = {scenarios, checkpoint, profile};
