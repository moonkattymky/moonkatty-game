/* Run the unmodified legacy input/lifecycle controllers with real models. No browser is required. */
const assert = require('node:assert/strict');
const codec = require('../trace-codec.js');
const {KEY, initial, fixture, verify, verifyRestore, tickRow, expectedTail, firstFrames, movingFrames} = require('./trace-controller-helper.cjs');

for (const kind of ['field', 'flight']) {
  const {saved, original, marker} = initial(kind, codec);
  const f = fixture(kind);
  f.open(saved);
  verifyRestore(kind, f.snapshot(), saved);
  verify(f.snapshot(), marker, original, [], codec, kind + ' restored');
  f.resume();
  firstFrames.forEach(f.frame);
  verify(f.snapshot(), marker, original, [tickRow(kind, 3)], codec, kind + ' first raw RLE row');
  f.key('keydown', 'ArrowRight');
  if (kind === 'flight') f.key('keydown', 'ShiftLeft');
  movingFrames.forEach(f.frame);
  f.key('keyup', 'ArrowRight');
  if (kind === 'flight') f.key('keyup', 'ShiftLeft');
  f.key('keydown', kind === 'flight' ? 'KeyQ' : 'Space');
  f.key('keyup', kind === 'flight' ? 'KeyQ' : 'Space');
  f.frame(220);
  const tail = expectedTail(kind);
  verify(f.snapshot(), marker, original, tail, codec, kind + ' appended controls and action');
  // Both handlers persist the actual old controller's hybrid, without invoking the new codec.
  f.hide();
  verify(f.saved(), marker, original, tail, codec, kind + ' pagehide save');
  f.pause();
  verify(f.saved(), marker, original, tail, codec, kind + ' blur save');
  assert.deepEqual(saved.trace, [marker], kind + ' caller-owned packed input was not mutated');

  const reboot = fixture(kind, Object.fromEntries(f.data));
  const persisted = JSON.parse(reboot.data.get(KEY));
  reboot.open(persisted);
  verifyRestore(kind, reboot.snapshot(), persisted);
  verify(reboot.snapshot(), marker, original, tail, codec, kind + ' fresh document reload');
  reboot.resume();
  reboot.frame(100);
  reboot.frame(120);
  const afterReload = structuredClone(tail);
  afterReload.at(-1)[1]++;
  reboot.hide();
  verify(reboot.saved(), marker, original, afterReload, codec, kind + ' resumed raw tail RLE');
  // A subsequent new client can compact the old client's hybrid without dropping any history.
  const repacked = codec.packTrace(reboot.saved().trace);
  assert.deepEqual(codec.unpackTrace(repacked), [...original, ...afterReload], kind + ' re-packed hybrid');
}
console.log('PASS: actual old field/flight controllers preserve packed prefixes through resume, raw-tail RLE/actions, pagehide/blur save, document reload and re-packing');
