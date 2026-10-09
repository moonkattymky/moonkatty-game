# Chapter 1 pure replay prototype

## Status and scope

Local defensive prototype only. No production file was modified; no endpoint,
controller, runtime script list, model generator, SQL policy, settlement, or reward
path imports it. There is no receipt service, deployment, push, or PR. Existing
legacy policy and the ten-digit Chapter 3 memory code are unchanged.

Base: local `54db90e00c346433544784fd09c30360659f2d4c`, tree
`f3ec07d7adf6d0126b71ae9585b37030221d251e` (the accepted PR44 tree supplied for
this task). The source manifest pins the 12 relevant production files, including
integration surfaces, by SHA-256. The checkout was cloned with `--no-hardlinks`;
the base checkout remained clean and at the same commit/tree.

This checks consistency of a claimed Chapter 1 finale transcript. It does not
prove human play, elapsed real time, a real viewport, the other eight finales,
or the eight story tasks preceding a finale. It cannot authorize payment or
settlement by itself.

## Source-only API

- `life1-model.js`: deterministic, DOM-free shared model. `create(route,w,h)`
  initializes the attempt; `transition(state,event)` returns a new state without
  modifying the prior state; `admissible(state,event)` applies the prototype UI
  admission checks. Geometry is frozen and calculated from declared dimensions.
- `server/rewards/life1-verifier.cjs`: pure CommonJS verifier importing that exact
  model, with no network, storage, HTTP handler, or database side effects.
  `replayLife1(trustedRoute, jsonString)` can return an incomplete diagnostic
  replay; `verifyLife1(...)` accepts only a complete replay.
- No generated server ESM copy was added. The existing generator and its check
  still pass. Deno/Edge packaging and imports remain future work.

The caller must independently authenticate the owner and retrieve the current
account-bound route from a trusted source. The standalone verifier requires
`life:1`, `edition:2`, `challenge_version:2`, a UUID-shaped route string, and an
unsigned 32-bit numeric seed. The UUID check matches the existing campaign
boundary's shape check; it is not a database existence/ownership check.

The exact JSON envelope is:

```js
{
  version: 1,
  route: trustedRoute.route,
  challenge: Model.routeKey(trustedRoute),
  rules: Model.RULES,
  layout: Model.LAYOUT,
  initial: [worldBorderBoxWidth, worldBorderBoxHeight],
  events: [/* tuples below */]
}
```

All other envelope fields are rejected. There are no client answer, final-state,
completion-boolean, checkpoint, rectangle, or event-count shortcuts. The
challenge string binds route ID, seed, life, edition, challenge version, rules,
and layout. It is not a signature or secret. A domain-separated seeded PRNG
recomputes the initial 58–79 frequency and four A/B/C entries; terminal close
consumes the next four deterministic draws, matching the source's regeneration.

Every event starts with a string opcode and a finite, nonnegative monotonic
millisecond timestamp. Exact tuples:

- `['frame', time, x, y]`, axes in [-1,1]
- `['collect', time, '1'|'2'|'3']`
- `['open'|'close', time, 'repair'|'antenna']`
- `['cell', time, 0|1|2]`; `['dial', time, integer from 0 through 100]`
- `['tune'|'hold'|'show'|'delay'|'stop'|'leave'|'screen-enter', time]`
- `['pause'|'hidden', time, boolean]`
- `['layout', time, width, height]`

`hold` is one scheduled 120ms antenna callback. `delay` is one scheduled 50ms
missionTimeout callback for sequence playback or the completion card; it is not
a caller-selected count of hidden simulation steps. Late hold callbacks schedule
the next one no sooner than 120ms later, preventing a same-timestamp backlog.
Timestamp claims are still untrusted. Browser timer precision/jitter and
recording policy have not been validated against this conservative admission
contract, so it is not ready to ingest production traces unchanged.

## Controller behavior and deliberately separate admission

The variable-dt baseline is preserved: first frame zero, later dt capped at .04,
88 CSS px/sec, strict magnitude > .08, unit magnitude normalization, independent
X then Y collision, 7–90 / 18–88 coordinate clamps, and 90ms nearby updates. No
fixed-step alternative is implemented or adopted.

Movement divides by the world's border-box width/height. Absolute child
percentages instead use the inner containing block (world minus its 1px border
on each side). The 78px player's visual center has the -27.3px vertical offset
from translate(-50%,-85%). Obstacles are squares from final percentage widths
17%,14%,13%, at positions in chapters-1-4.css; mission-polish.css overrides their
older heights. Collision rectangles inset 3px on left/right, 2px at bottom and
36% at top, then normalize to border-box dimensions. Resize relocation uses the
same fixed candidate search as the original controller. Hotspot scale(1.08)
about its center does not change the distance target.

The contract allows finite border-box dimensions in [64,4096], including
fractions, strictly as prototype processing bounds. It never accepts arbitrary
obstacles. It does not certify that the dimensions are attainable on a device,
that the browser rounds percentage/subpixel boxes identically, or that a caller
actually used the declared layout. The VM calculates rectangles from source CSS;
it does not run a CSS layout engine.

Three distinct in-range energy pickups precede terminal repair; four correct
entries precede antenna use; tolerance is inclusive ±3; completion requires
exactly 25 active callbacks. Pause/background callbacks do not advance progress. Hiding the active mission
automatically opens the guide and pauses it; becoming visible does not resume
until the guide resume event. Leaving a screen closes the guide and clears pause.
Wrong repair input resets the prefix; terminal close regenerates the sequence;
antenna close/lost signal resets the hold. The completion card appears after 300
active ms through the same capped missionTimeout callbacks and stops subsequent
movement. Leaving cancels timers. Leaving during repair playback retains the
source's disabled repair buttons; reopening the screen cannot silently enable
them, and completion requires another completed watch or a close/reset.

The source onclick functions can be invoked programmatically with closed
panels or while paused. The pure transition models controller state, while the
verifier additionally requires visible/active, stage-correct, in-range UI
interactions and enabled cells. This is a proposed proof admission layer, not a
change to production controls. Wrong sequence/tuning attempts remain valid
failed attempts; they cannot skip prerequisites.

## Navigation, interruption and reload boundary

`leave` mirrors leaving mission1; `screen-enter` mirrors only
`show('mission1')`, preserving existing in-memory state and resetting first-frame
dt. It does not mean `openMission()`: the real chapter opener resets the mission
and then asks campaign.restore to restore a subset of checkpoint fields.

The existing version 1 checkpoint lacks movement history, repair sequence/input,
button state and hold evidence. It is rejected, never grandfathered. There is no
reload/reset/checkpoint-import event in the prototype. Replaying the complete
retained transcript from its initial route can rebuild a diagnostic prefix, and
appending a valid continuation verifies from scratch. That proves replay
reconstruction only; production checkpoint reload, cross-page monotonic clock
normalization, restart issuance, persistence, and a controller recording adapter
remain unimplemented. Screen-only return after completion-delay cancellation
also retains the source's missing completion card rather than inventing a new
timer.

## Bounds and benchmark

Prototype-only ceilings, not approved production playtime limits:

- 8,192 movement events
- 1,024 semantic events, including timer and lifecycle callbacks
- 128 layouts including initial layout, so at most 127 resize events
- 192 KiB encoded  / 512 KiB decoded UTF-8 bytes

Version 1 accepts only a raw JSON string; no compressed transport exists, so
encoded and decoded bytes are equal and 192 KiB dominates. The decoded bound
also supplies a cheap string-length guard before UTF-8 allocation. Oversized
input never reaches JSON.parse; exact bytes are counted before parsing. The
complete event list is shape-validated and charged before any replay. Over-limit
and malformed tails return explicit errors and `work.replayed:0`; no truncation
or already-won early return can skip the tail.

Replay work is linear in the bounded transcript. Movement performs at most six
rectangle comparisons and five nearby distances per event. A resize performs
at most one three-rectangle initial test plus 81 candidate tests of three
rectangles each, with constant-size geometry. No event can request an unbounded
internal tick loop. JSON parsing remains bounded by the byte ceiling. Memory
allocation is bounded by the input/array caps; the benchmark is not a measured
per-proof peak-memory guarantee.

Run `node tools/bench-life1-prototype.cjs`. The adjacent JSON is the recorded
full report, including exact iterations, bytes, event counts, timings and
process memory deltas. It includes JSON parsing, validation and replay, with 20
warmup calls per workload, in one local Node 24.19.0 / V8 13.6 process on Linux x64,
AMD EPYC 9V74 (9 visible logical CPUs). It is not Edge/Deno or Node 22 capacity
validation. Heap/RSS deltas span repeated calls and GC; they are neither
per-proof peaks nor a reliable cross-runtime capacity estimate. Keep the stated
prototype ceilings pending real traffic/device/Edge evidence.

Recorded result: 1,000 successful-proof replays (181 events, 6,082 bytes each)
averaged 0.147 ms (p95 0.303 ms). The 200 exact-budget replays
(9,343 events, 172,217 bytes each) averaged 5.437 ms (p95 6.991 ms).
The full numerator, elapsed time and rejection-workload results are in the JSON.

## Verification and open gates

Final local result: 42/42 permitted non-browser test files passed (39 existing
plus 3 new). The new suites contain 15 model groups, 19 verifier groups and the
21 differential scenarios below. Local syntax and generated-model checks pass.

Local tests:

- `node tests/life1-model.cjs`: deterministic model, 24 synthetic full playthroughs
  across 4 seeds and 6 dimensions, strict thresholds, lifecycle, route/sequence,
  unchanged-source fingerprints and no production import.
- `node tests/life1-verifier.cjs`: input/admission/resource groups, 420 bounded
  malformed-input cases, exact/+1 budgets, wrong route/seed/state, disabled
  repair navigation, late timer batching and tail rejection.
- `node tests/life1-controller-differential.cjs`: 21 scenarios, 5,833 compared
  states from unchanged app.js and experience.js source excerpts, including the real guide,
visibility and screen-change lifecycle functions. Includes 18
  full quests across 3 seeds and 6 declared dimensions,1,500 mixed variable-dt
  frames, collision/resize, pause, backgrounding, terminal/antenna close,
  sequence watch/error, disabled-cell return and delayed completion.
- 39 permitted pre-existing non-browser tests are included in the safe local
  aggregate. 29 browser-dependent suites were deliberately not launched because
  local browser/socket execution had already been denied. There is no new
  actual-browser or phone coverage, and no bypass or escalation was attempted.
- Existing PGlite/static/pipe tests run in that aggregate. Real PostgreSQL
  contention was not rerun here; the previously accepted base's 68/68 and 32 real
  contention results are baseline context, not new prototype results.

Required before considering runtime adoption: actual browser CSS/subpixel
fixtures at supported viewports; real pointer/joystick-to-axis recording;
full reload/reset/resume specification and tests; persisted bounded transport;
route-owner binding and stale/replayed-route policy; Edge/runtime resource
validation; separate integration/receipt/settlement review and authorization.
None of those changes is included in this slice.


## Native v2 research continuation

A separately and explicitly selected native v2 geometry ABI is now authored.
See [the browser parity gate](life1-browser-parity.md#explicit-native-v2-abi-and-limits)
for its schema, supported rendering lane, historical failures and pending gates.
The original ideal v1 model, fixtures and benchmark above remain frozen research
context. No runtime, route issuance, reward policy, receipt service or settlement
integration is included. Do not treat v1 benchmark figures or retained geometry
observations as v2 production validation.
