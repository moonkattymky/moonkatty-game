# Source-only vNext callback capture contract

Status: local source regressions implemented; native CI evidence pending. No shipped loader, controller, CSS, rule,
timer, reward, backend or route authority changes. Frozen PR47 and prior recorder
files remain byte-identical. The new format is not accepted as an old recording.

## Evidence requiring this version

PR77 head `4faf69c37cdc43d6b68cde3efc752b882f47a2bb`, dedicated run
`38217033903`, reload artifact `11732169843`:

* At 1289 ms before collect: world/cache/model height 483.96875 px.
* Collection reduces status height 41.875 -> 30 px; live world becomes
  495.84375 px while collision cache still has the old height.
* Original frame at 1296 ms runs before the original ResizeObserver refresh.
* By 1321 ms the source cache has refreshed. Animations/transforms were absent.

The old recorder correctly refuses this unsupported geometry interval. Its
separate clock regression also refuses a RAF physics timestamp 105 delivered at
115 after pause dispatch 110. Both remain baseline characterizations, not tests
to remove or relax. The failed artifact is retained separately unchanged.

## Envelope, order and arithmetic

An accepted entry is one **complete outer controller callback**:

```
{document, sequence, dispatchMs, kind, steps}
```

`sequence` is contiguous acceptance order. `dispatchMs` is a finite raw
performance-clock observation at callback entry, nondecreasing within a
document. Nested observed functions contribute steps to their outer callback;
they do not reorder or independently commit it. A frame step retains its exact
supplied RAF timestamp, independent of dispatch time. No global physics time,
timestamp rounding, event sorting, epsilon or frequency authority is introduced.

The model stores document-local source clock registers. Frame movement uses the
source expression `lastFrame ? Math.min((frameTime-lastFrame)/1000,.04) : 0`,
including the zero sentinel, then stores `frameTime`. Near-check throttling uses
the same raw frame time. Timer registration and tick steps retain the original
source samples, not a different observer-entry sample. Mission-delay arithmetic
retains `Math.min(100, now-Math.max(last,clockResumedAt))`. Delivered hold ticks
retain the original pause/visibility guards and +4 increment. Exact source
callback registration samples are needed because a cue can schedule its next
timer later in the same callback; that must not be synthesized as the old tick
time. Same-time callbacks and signed zero survive serialization unchanged.

## Geometry and source-aligned steps

The model contains two different values:

* `liveGeometry`: last observed on-demand source world envelope and derived native DOMRect
  geometry, used only by original on-demand proximity/nearby reads.
* `geometry`: the collision cache last installed by the original refresh,
  used by movement, obstacle tests and walkability correction.

A `live` step changes only last-observed live geometry. Failed reach handlers can
rewrite status after their final read; that does not imply a new observed layout
until a later original read. Action-button panel opening uses the freshly chosen
nearby target and stage; direct station handlers instead recheck distance. These
source branches remain distinct even at floating-point proximity boundaries. A `cache` step is recorded only at an
actual original refresh and changes only collision geometry; the original
walkability correction is reproduced with identical expression and candidate
order. Geometry primitive declarations remain within the frozen native math
profile. Source raw rectangles are compared exactly in native tests, not treated
as arbitrary trusted player positions or collision edges.

Steps follow source call sites, rather than folding later reads into earlier
actions. Required families are:

* observed post-calculation joystick `input`, `live`, `cache`, `frame`,
  `nearby`, `nearby-at`, `stop`;
* accepted `collect`, `open`, `show`, `cell`, `dial`, `tune`, `close`;
* a `scan` callback containing its actual remaining-energy proximity reads;
  visual reveal/status mutations stay in the original controller;
* explicit repair cue/reset and mission-delay registration/tick/completion;
* `hold`, signal completion/card, pause, visibility and leave.

For collection: the original pre-action distance read declares live geometry;
collection commits quest fields; the DOM/status mutation occurs; the original
nearby call declares the new live geometry and then recomputes nearby state.
There is no implicit nearby update inside the earlier collection transition.
A stale-cache frame must remain legal. Frame movement uses cached dimensions,
while any subsequent actual nearby read uses the live dimensions.

Instrumentation may wrap source callback entry/exit and observe the source's
existing reads. It must not invoke refresh, wait for ResizeObserver, alter CSS,
modify source input, synthesize completion, or advance the supplied clock. The
application files on disk stay unchanged. Unknown source anchors fail closed.
Unsupported callback/phase schemas produce explicit recording refusal.

## Atomicity and capacity

The adapter accumulates a bounded callback draft. `appendCallback` validates and
replays the entire draft into a candidate, measures the exact serialized bytes
and entries, then commits once. A failure retains the previous complete accepted
prefix and state. The draft has a finite step/byte limit too; overflow refuses
the whole callback without retaining an unbounded buffer or stopping gameplay.
Nested campaign save requests are deferred by the test recorder until the outer
callback closes. The original campaign save still runs in its original place.
No mid-callback recording checkpoint is persisted.

There is no play-duration limit or silent pruning. A capacity-refused recorder
cannot invent subsequently missed history. It exposes the retained prefix for
retry/export; storage redesign and long-session codec integration are separate.

## Recovery boundary

Recovery accepts only a complete paused repair-input prefix or paused partial
antenna-hold prefix. Replay first reconstructs earned progress. A new explicit
document entry records the fresh controller's actual local clock registers; old
timestamps remain in the old document and are never affinely rebased. A true
zero frame sentinel remains zero. The new document's geometry/cache observations
are recorded independently. Hydration changes no gameplay rule and may not infer
unrecorded inputs or elapsed active play.

The original hold interval is registered anew at 120 ms; earned hold progress
remains, old deadline phase does not. Timer rearming is an explicit hydration
boundary, not a replayed successful tune that earns extra progress. Active
reload, repair playback, completion-delay recovery and arbitrary profile changes
remain explicit refusals. Duplicate hydration is refused. Local-storage failure
keeps both the complete memory prefix and the prior durable checkpoint.

## Exact gates and staged scope

1. Socket-free source differential reproduces the measured 362 x 483.96875 ->
   362 x 495.84375 gap, including the 1296 stale-cache frame and later refresh.
   Add a nonzero-axis case to prove movement uses the old cache while proximity
   uses the new live geometry. Do not treat shared geometry math as native proof.
2. Mixed dispatch/RAF order, duplicate/same-time RAF, zero sentinel, fractional
   raw clocks, 135/105 ms hold and 65/35 ms delay samples compare exactly.
3. Atomic refusal at every draft/entry/byte boundary retains a complete prefix.
4. Paused two-cell repair and 40% hold hydrate into fresh source controllers;
   exact subsequent source/model comparisons include the first resumed frame.
5. Frozen hashes and original characterization suites remain intact.
6. Separately selected native CI lane exercises the unchanged source controller
   without a settled-only waiting workaround. Existing diagnostic lanes remain.

Contract review and actual native CI evidence are required before claiming this
slice covers the observed source behavior. Successful supplied-event replay does
not establish admissible human timing, elapsed real time, route authority,
trusted storage, server verification, unrestricted geometry profiles or runtime
readiness. No authoritative admission or protection claim follows from it.

## Review tightenings before implementation

Timer ownership: each registration records its document-local original handle,
owner (`repair`/`complete`), delay and exact source registration sample. A tick
names that existing handle and original `now`; cancellation names owned handles.
Expiry removes the handle and requires the ensuing cue/card step in the same
callback. Show requires a first cue; an unfinished cue requires a fresh 650 ms
registration; hold completion requires finish plus a 300 ms registration. These
are derived requirements, not freely accepted state setters. Paused/hidden ticks
still update `last` but consume no remaining time. Source guard/early-return
paths stay no-ops. Nearby/stop work required by collection/movement/correction
must close inside its outer callback.

Explicit bounds: default 4096 journal entries / 196608 UTF-8 bytes; hard research
ceilings 16384 / 524288. Draft limits 128 steps / 32768 bytes, latched on overflow.
All header, document, callback, geometry and step metadata count. Document IDs
increase by one; sequence IDs follow full journal entry order, including document
boundaries. Bounds will not be increased to force ordinary-path completion.

Exact recovery prefix: paused and not hidden; either stage 1, repair panel open,
1–3 accepted cells and no sequence playback; or stage 2, antenna panel open,
holding with 1–99% progress. Neither may have pending mission-delay work.
Preflight validates replay/phase/domain/known capacity before writes. Staging
requires a fresh already-paused source document without repair playback, hold
timer or Chapter 1 mission delays. Observe geometry after real panel/status
writes and real refresh, never assume a pre-write layout. Publish only a complete
validated, budgeted recovery candidate. If post-write validation fails, cancel
only hydration-created work, retain a paused/disarmed source and old accepted
memory/durable prefix byte-for-byte, latch `hydration-refused`, and require a new
fresh document for retry. No candidate is published, and no full DOM rollback is
claimed. This boundary needs its own exact post-stage-refusal tests.
