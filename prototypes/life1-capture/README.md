# Chapter 1 test-injected capture and paused hydration

Experimental source and synthetic fixtures only. Nothing here is loaded by the
shipped index, changes controller rules, establishes route authority, or replaces
a future server verifier. Callback-count replay verifies consistency of supplied
events; it does not verify admissible frequency, elapsed real time or a player.

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
