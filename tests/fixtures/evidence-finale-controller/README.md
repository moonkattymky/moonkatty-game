# Actual spatial finale controller, source-only CI fixture

This fixture serves the unchanged repository `index.html` and its real client
scripts, styles and art at an intercepted synthetic HTTPS origin. Every phase
gets a fresh BrowserContext. External transports and service workers are blocked.
It is not referenced by the real index, is not a production integration, and has
no accounts, credentials, player writes, server writes, or local browser/listener.

Run portable preparation with `node tests/evidence-finale-controller-fixture.cjs`.
The native driver `tests/evidence-finale-controller-ui.cjs` refuses outside
`CI=true GITHUB_ACTIONS=true`; the existing GitHub workflow owns browser execution.
Output is `native-finale-controller-results.json` inside `MKTY_TEST_OUTPUT`.
Playwright remains pinned at 1.58.2; there are no new dependencies. There are
exactly 80 cases/fresh contexts and 37 native continuation cuts, with no skipped
cases. The first-party resource cache is bounded to 200 files / 32 MiB. Runtime
hashes for 65 unchanged first-party index/scripts/styles are pinned to the
reviewed baseline. Page/console failures, unexpected network attempts and cleanup
failures fail the report; explicitly blocked Telegram script loading is classified.

## Exact boundary

The wrapper passes each real `MKTYField.open` descriptor to its original function.
Tests click its actual Resume and Finish buttons. Finish first performs the real
stop/save and sets the field's task to null. The wrapper synchronously retains
full raw callback values and exact current source/StoryPlan strings before any
await, then calls the real `show()` to enter a test-only result screen. That move
prevents the known task-null blur/pause path from crashing. No callback is invoked
through a synthetic replacement of the award or storage facade.

The fixed helper frames checkpoint/source/story/binding; the gate must commit and
read back exactly before an explicit Continue invokes its private immutable
callback copy once. The real guest award, Pacing, Story, Rewards, Campaign and
Continuation functions run through pass-through spies. Chapter 9 additionally
clicks its actual epilogue button before Campaign restoration and review.

All 17 original checkpoints are restored using actual controller controls. Three
separate cases earn Echo (noise 105), final trajectory, and final closing gate
(stability -1) through actual buttons/native range keys. The remaining phase
cases are explicitly restored fixtures, not claims of native docking/convoy
input coverage. Setup seeds the exact idle ExpeditionRules.restore(null) profile
and checks it against the real MKTYExpedition.snapshot(). The original unconditional
expedition pagehide save therefore re-writes its established background baseline.
Full-state equality before Continue still covers that key; it is not ignored,
and no idle expedition timer or extra continuation cutpoint is introduced.
Date is fixed for exact expected writes; real timers still run.
Original fixture time is preserved, and pure trace replay's controller-timing
qualification remains separate. No human timing or continuous-play claim follows.

## Native faults and finite matrix

Evidence append faults target actual ordinal **0**, the only segment for these
packets. The unchanged reviewed IDB terminal harness produces actual aborts and
holds acknowledgement delivery after an actual terminal and actual watchdog
expiry. A reviewed setup-only timer-delivery barrier verifies real schema
completion/cancellation before arming the held-terminal test; the original 100 ms
append watchdog is unchanged. Readback covers a real readonly transaction abort and a separately
labelled injected coordinator timeout, plus changed bytes and context settlement.

The test-only monotonic bridge observes actual logical writes, clear, descriptor
reopen and navigation. Account A→B→A uses an explicit test account-label bridge;
it is not a production account epoch. Clear→identical restore uses real
MKTYStorage operations. Cloud restoration stages a bounded synthetic startup
restore and performs a real reload through unchanged cloud-save code. The new
gate is EMPTY and can inspect the archive only; it cannot resume continuation.

The concrete continuation set/remove sequence is pinned, not discovered and
silently accepted: Echo 6, trajectory 11, convoy 4, docking 4, closing gate 12.
There are exactly **37 native write cutpoints**, including the Chapter 9 epilogue
click. An additional 40-operation hard stop rejects unexpected expansion. The
fixture has no operations-core record, no completion/award timestamps, no Chapter
8 coordinates, and no Chapter 9 balance-lock markers. Changed preconditions must
change the reviewed matrix explicitly.

For every cutpoint the fault is below MKTYStorage's unchanged native boundary.
It records the successful native prefix, swallowed failure, logical overlay,
source/report/story/award/points and destination. A late idempotent write failure
may leave persistent=false without different native values; this is reported
honestly. Background native and logical timer writes are retained separately, including
logical-only overlay writes during persistent=false. Only known life-bank, restore
and campaign-checkpoint timer keys may appear in the fault/retry window; any other
asynchronous key fails the case. They are not hidden in the
synchronous finite sequence. Actual recovery-banner Retry saving flushes the
overlay without replaying the handler. First-cut cases also fail after one overlay
key has flushed, then retry successfully. Final native data must exactly equal
the logical target and original award counts/points must remain unchanged.

Gate CONTINUED means one callback invocation, not durable game progress. Closing
before retry can lose the in-page overlay. A caught throw is consumed with
navigation-threw and explicitly excludes the original callback remainder.

## Bounds and exclusions

The initial 17 explicit small StoryPlans produce 4,378–10,240 byte packets, all
one segment, against the helper's conservative 16,384-byte test-format cap. Raw
source sizes are 1,440–4,556 UTF-16 bytes; the current StoryPlans are 248 or 634 bytes.
A separate eight-record task-shape fixture, with one model-valid field proof, has
2,628 StoryPlan bytes and a 6,592-byte packet. It does not claim eight natively
earned proofs. Adding 900 legitimate repeated station inputs to that field proof
creates a 38,628-byte StoryPlan: the existing codec accepts it, but this test format
refuses it intact. This is not long-session capacity proof. Oversized complete StoryPlans must refuse
without deleting source data or trimming proof. Existing codec/storage/proof
limits and the gate's overall cap are unchanged.

The gate's modeled reservation is separate from test observation copies. Exact
source/story comparison references and the bounded raw input representation are
retained at the seam; diagnostic expected strings/snapshots/log histories are
fixture-only observation, including bounded rawCheckpointText and originalArgumentText
post-hoc comparison strings plus snapshot/history copies, and are excluded from encoded-buffer slot accounting.
The pre-existing original callback closure/controller state is also outside the
new captured-representation reservation. Neither accounting proves native JS
object/engine heap allocation or power-loss
persistence. No release of same-realm ownership occurs; explicit mixed-format
second captures must refuse. No cache-busted module import claims a chain.

Still excluded: continuous-phase handoff, authenticated/server rewards, production
identity invalidation, durable continuation settlement/reload replay, legacy
pulse/final-input puzzles, physical devices, eviction and power loss.
