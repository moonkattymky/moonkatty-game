# Why the callback variant differs

References are the unchanged local runtime copies, originally inspected at
baseline `2d96570779e34d8fab56551adf0b83dff8093075`, and PR47
`a158781dbd334bcd0ffcde9a0b00756f929942c7`.

`pr47/app.js:360-364` installs a 120 ms interval. The callback returns while hidden
or paused, checks carrier tolerance, then increments signalHoldProgress by 4.
It does not require callbackTime >= previousCallbackTime + 120. A late delivery
followed by a shorter recovery interval consequently advances twice. The local
135/105 ms case exercises exactly two source callbacks, never elapsed-time-based
manufactured callback counts.

`pr47/app.js:69-75` implements missionTimeout through a 50 ms interval. A delivered
callback computes Math.min(100, now - Math.max(last, missionClockResumedAt)), then
updates last. Hidden/paused callbacks do not deduct remaining time. It does not
require a minimum 50 ms gap from the previous delivered callback. Alternating
65/35 ms deliveries preserve the original elapsed-time arithmetic and existing
650 ms repair-step / 300 ms completion behavior.

The original pure PR47 model has additional hold-callback-early,
sequence-callback-early and completion-callback-early checks. Those model and
verifier files remain untouched. The new local transition ID explicitly records
that observed callback playback has different admission semantics.

The local variant retains tuple validation, monotonic event order, existing
UI/stage/panel admission, pause/hidden handling, 4% hold increments, carrier
tolerance, 100 ms missionTimeout clamp and completion transitions. All other
events delegate to the original model. No epsilon or geometry threshold changed.

`tests/callback-controller-differential.cjs` executes actual unchanged app.js and
experience.js excerpts using the original PR47 test controller. It checks 221
states, including position/input, playback, cells, hold, visibility, pause and
completion. Every compared field uses exact equality. It also demonstrates the
old early-callback checks rejecting the ordinary synthetic recovery cadence.

The fixture clock invokes callbacks explicitly and does not establish which
schedules a real browser will produce. A faithful replay of supplied callbacks
is not authoritative evidence of callback delivery, timing or human play. A
future verifier requires its own provenance/admission design. The local adapter
must never be described or used as that verifier.
