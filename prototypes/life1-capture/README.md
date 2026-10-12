# Chapter 1 test-injected capture and paused hydration

Experimental source and synthetic fixtures only. Nothing here is loaded by the
shipped index, changes controller rules, establishes route authority, or replaces
a future server verifier. Callback-count replay verifies consistency of supplied
events; it does not verify admissible frequency, elapsed real time or a player.

## vNext source-only candidate

`vnext/CONTRACT.md` defines a separate supplied-callback format. Frozen PR47,
prior recorder/adapter, and the old native reload fixture remain unchanged.
The implementation separates last-observed live geometry from the collision
cache, and raw dispatch time from RAF and original timer samples. It preserves
source arithmetic, including branch-specific action-button versus direct-open
eligibility and signed zero. A complete outer callback is the atomic journal
unit; nested checkpoint requests wait for the whole callback to close.

Actually run socket-free:

```
node tests/life1-recording-vnext-differential.cjs
node tests/life1-recording-vnext-grammar.cjs
node tests/life1-recording-vnext-controller.cjs
node tests/life1-recording-vnext-journal.cjs
```

The manual source differential has 369 exact state comparisons / 362 immutable
transitions. Automatic capture has 306 exact comparisons, two-cell repair and
40% hold recovery across fresh clock epochs, measured live/cache divergence,
original 135/105 ms hold and 65/35 ms delay callbacks, atomic capacity refusal,
and post-stage hydration refusal that keeps the old prefix and disarms the fresh
source. Grammar checks cover 34 refusals. Journal checks cover 192 assertions,
including a 16,213-entry / 524,281-byte near-ceiling replay in about 0.44 seconds
on the local test machine (reported measurement, no timing pass threshold).
The ordinary synthetic completion path uses 272 entries / 24,212 bytes.

Defaults remain 4,096 entries / 196,608 bytes, hard ceilings 16,384 / 524,288,
and drafts 128 steps / 32,768 bytes. All metadata counts. These are recorder
resource budgets: exhaustion explicitly retains the accepted prefix while
original gameplay continues. They neither cap gameplay duration nor establish
long-session completeness. The independent lossless codec is not integrated.

Fresh hydration uses original source clocks without rebasing old timestamps.
Panel/status writes precede the actual refresh observations. A complete holding
recovery requires an explicit original interval rearm; repair recovery forbids
one. Failure after staging retains old memory/durable bytes, cancels hydration's
new work, and requires a new paused document. Full DOM rollback is not claimed.
A future repair-sequence regeneration after cross-document recovery still needs
an explicit random-source contract; this candidate does not claim that arbitrary
prior sequence resets can migrate the browser's Math.random state.

The separately selected vNext browser fixture is prepared for coordinator-owned
CI. Its bounded, one-shot MutationObserver watches the original displayed 40%
hold progress, then invokes the original pause button handler after that hold
callback has committed. This is test automation, not evidence of a trusted
physical gesture; it changes no progress, timer, RAF or geometry value. It has not been executed locally. Exact native layout, complete native
callback interleaving and fresh-page recovery remain pending until that lane
passes. The old mixed-clock lane keeps `gatePassed:false`. The old native reload
failure remains preserved and gets an exact expected-refusal wrapper; other
failures and unexpected success fail that baseline check. No waiting workaround,
new tolerance, forced geometry refresh or gameplay-dt change is used to conceal
the observed gap.

## Frozen baseline documentation

The sections below describe the original single-clock prototype and its known
refusals. They do not describe the vNext wire format or replace its contract.

## Provenance and boundaries

The isolated branch starts at actual commit
`eaa09304c773129d8b06ec4c85a542e123e13450`, tree
`a08ec6ee9578eacca3f81da296964613d8dd7299`. That exact object was fetched from the
verified public origin. It is not a synthetic commit or a branch descended from
PR47. Existing `app.js`, `experience.js`, `campaign.js`, `index.html`, CSS, artwork,
rules and seed behavior are unchanged. `source-manifest.json` records their
reference hashes and the exact frozen dependencies copied into this fixture.

The model/native geometry originated at PR47 commit
`a158781dbd334bcd0ffcde9a0b00756f929942c7`. The copied pure recorder and callback
variant are byte-identical to the previous local four-suite prototype. The model
copies retain their documented extra terminal LF from initial materialization;
canonical Git blob IDs in the manifest exclude only that LF. See
`prototype/CALLBACK_DIFFERENTIAL.md` for the original callback-specific rationale.
No tolerance or physics/model adjustment was introduced in this slice.

## Smallest seam

`tests/fixtures/life1-recording-instrument.cjs` injects fail-closed observation
hooks into source strings only. Original statements retain their order. The hooks
observe accepted collect/open/show/cell/dial/tune actions, meaningful stop events,
movement frames, original hold/delay callbacks, geometry refresh, pause/resume,
visibility and leave. Campaign's existing checkpoint save observes the same real
guide pause. Repeated no-op opens, pauses, inactive callbacks and an idempotent
stop already represented by pause/open are omitted; meaningful pointer release
is retained. No test hook is written into the production files.

`controller-adapter.js` is injected explicitly by the fixture. `armFresh` requires
a matching synthetic initial challenge; `restore` is an explicit fixture call.
The browser harness scopes deterministic randomness to synthetic resets and
restores `Math.random` immediately. This is not live route/challenge integration.
Route context is an opaque versioned future input, not trusted authority.

## Supported recovery contract

The user has already opened the original guide/pause before persistence. A new
document can replay and hydrate either a visible repair panel with 1–3 accepted
cells, or a visible antenna panel with 1–99% earned hold progress. Recovery keeps
all original accepted entries and dispatch observations, appends an explicit
document epoch and exact new primitive layout, and leaves the source paused.
Resume uses the original controller callbacks. A hold registers a new original
120 ms interval; its remaining callback count is preserved, not the exact old
interval deadline. Duplicate hydration in one recording document is refused.
If clock rebasing would turn a nonzero old frame time into the source's zero
first-frame sentinel, recovery returns `clock-rebase-sentinel` before mutation.

Active-unpaused reload, hidden panels, repair sequence playback, completion-delay
hydration and arbitrary geometry/profile migration are unsupported. They return
an explicit refusal instead of inventing pause/history. The legacy campaign
checkpoint is not itself a complete repair/hold recovery contract.

## Time and storage limits

Checkpoint version `life1-controller-checkpoint-test-2` contains the original
recorder JSON string plus `clockObservations`: dispatch order, document epoch,
event index, raw callback-arrival `performance.now()` and separate supplied RAF
physics timestamp. Signed zero and numeric precision are preserved in checkpoint
serialization. Events are never sorted, rounded or quantized.

**Known blocker:** the frozen recorder/model still requires a single monotonic
event clock. An ordinary pause dispatched at 110 ms followed by a RAF callback
arriving at 115 ms with supplied physics timestamp 105 ms is valid source order,
but gets `local-time-reordered`. The fixture preserves both clocks and the first
refusal without changing gameplay `dt`. A future versioned dual-clock model needs
a source differential before full native recording can be integrated. General
floating-point equivalence of affine cross-document clock arithmetic also remains
unproven outside the exact recovery cases tested here. The native
mixed-clock lane is a diagnostic with `gatePassed:false`, even if a bounded sample
does not happen to exhibit this ordering. It is not a native admission gate pass.

All checkpoint bytes, including the clock journal, count toward capacity. On
capacity refusal the accepted memory prefix and its journal remain unchanged;
source gameplay continues, and status explicitly reports the refusal. A local
storage quota failure retains memory plus the old durable checkpoint for retry.
There is no silent truncation or player-facing duration cap. At this stage an
observer capacity fault cannot resume missing subsequent observations; exporting
the retained prefix or provisioning a new future bounded storage strategy is a
coordinator concern. Long-session lossless codec/budget research is separate;
its sizes do not include this wrapper journal unless explicitly measured.

## Executable checks

Socket-free, actually run locally:

```
node tests/life1-recording-source.cjs
node tests/life1-recording-controller.cjs
node tests/life1-geometry-lifecycle.cjs
node tests/life1-touch-lifecycle.cjs
```

The integration suite checks 318 exact source/model states, two-cell repair and
40% hold recovery into fresh controllers, retained original prefixes, 135/105 ms
hold callback jitter, 65/35 ms delay callbacks, one completion card, pause-only
save, duplicate hydration refusal, storage retry, full-wrapper byte refusal,
non-DOM collection order, zero-sentinel rebase refusal and the dual-clock blocker.
CSS-derived VM rectangles do not certify browser layout.
The source suite hashes dependencies, compiles instrumentation and the browser
bundle, and imports the browser fixture without loading any socket/browser code.

Prepared for later authorized CI, **not run in this local environment**:

```
MKTY_C1_NATIVE_LANE=reload node tests/life1-recording-browser-fixture.cjs
MKTY_C1_NATIVE_LANE=mixed-clock node tests/life1-recording-browser-fixture.cjs
```

The separate workflow `life1-capture-prototype.yml` uses the existing pinned
Playwright dependency and a loopback-only synthetic app. Off-origin network and
websockets are blocked. No credentials or secrets are required. The browser file
is named `fixture` so the ordinary all-tests collector does not silently activate
this experimental lane.

The reload lane prepares genuine page reloads, original DOM/joystick actions,
exact native pixel-geometry comparisons under an explicit virtual clock, then a
separate native hold-timer sample with movement RAF cancelled only while the
antenna modal blocks movement. The mixed-clock lane leaves native RAF untouched
and records actual pause/resume dispatch ordering. Browser behavior, exact native
geometry and these unexecuted harness assumptions remain CI questions. A green
diagnostic never implies runtime readiness, authoritative admission, physical
phone or Telegram coverage. Native CI results must be evaluated separately before integration.

`reports/` records the actual local results, including a fresh rerun of the four
frozen suites in a disposable copy (the original preparation directory remained
unchanged). A separate bounded source review covered the adapter and fixture files,
found the collection-order and zero-sentinel issues described above, and
rechecked their fixes. That review does not establish unexecuted native behavior.
