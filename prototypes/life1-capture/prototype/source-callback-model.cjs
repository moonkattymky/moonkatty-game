'use strict';
/* LOCAL, UNWIRED transition variant. Not a proof verifier or a timing attestation.
 * Original PR47 model remains unchanged. Only observed hold/delay callback delivery
 * differs: production advances from callbacks actually delivered, not an invented
 * minimum spacing from the previous delivery. All arithmetic and other transitions
 * are delegated unchanged or copied expression-for-expression from that model's
 * source-controller counterpart. See CALLBACK_DIFFERENTIAL.md and the tests.
 */
const Original = require('../pr47/life1-model.js');
const ID = 'life1-observed-source-callbacks-local-1';
function fail(code) { const error = new Error(code); error.code = code; throw error; }
function transition(previous, event) {
  Original.validateEvent(event, previous.layout);
  const [op, time] = event;
  if (time < previous.now) fail('time-reordered');
  const reason = Original.admissible(previous, event);
  if (reason) fail(reason);
  if (op !== 'hold' && op !== 'delay') return Original.transition(previous, event);
  const s = {...previous, now: time};
  if (op === 'hold') {
    // app.js tune interval: pause/hidden skip; a delivered active callback adds 4.
    // holdDue remains an original-model compatibility field, not the browser's
    // actual next interval deadline and not admission or a rearming instruction.
    s.holdDue = time + 120;
    if (s.hidden || s.paused) return s;
    if (Math.abs(s.dial - s.frequency) > 3) {
      s.holding = false; s.holdDue = null; s.holdProgress = 0; return s;
    }
    s.holdProgress += 4;
    if (s.holdProgress >= 100) {
      s.holding = false; s.holdDue = null; s.stage = 3; s.antennaOpen = false;
      s.completeDue = time + 50; s.completeLast = time; s.completeRemaining = 300;
    }
    return s;
  }
  // app.js missionTimeout: elapsed since the last delivered callback, capped at
  // 100 ms and clipped by visibility resumption. The real callback may arrive
  // sooner than previousDelivery + 50 after an earlier delayed delivery.
  if (s.completeDue !== null) {
    const dt = Math.min(100, time - Math.max(s.completeLast, s.clockResumedAt));
    s.completeLast = time; s.completeDue = time + 50;
    if (!s.active) { s.completeDue = null; return s; }
    if (s.hidden || s.paused) return s;
    s.completeRemaining -= dt;
    if (s.completeRemaining <= 0) { s.completeVisible = true; s.completeDue = null; }
    return s;
  }
  if (!s.repairShowing || s.showDue === null) return s;
  const dt = Math.min(100, time - Math.max(s.showLast, s.clockResumedAt));
  s.showLast = time; s.showDue = time + 50;
  if (!s.active) { s.showDue = null; return s; }
  if (s.hidden || s.paused) return s;
  s.showRemaining -= dt;
  if (s.showRemaining <= 0) {
    if (s.showIndex >= 4) { s.repairShowing = false; s.repairDisabled = false; s.showDue = null; }
    else { s.showIndex++; s.showRemaining = 650; }
  }
  return s;
}
module.exports = Object.freeze({ID, transition, Original});
