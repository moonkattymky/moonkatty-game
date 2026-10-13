# Finale owner roundtrip: test-only callback seam

## Scope

This slice adds three test/documentation files on the frozen owner candidate:

- `tests/finale-owner-roundtrip.cjs`
- `tests/fixtures/finale-owner-roundtrip.cjs`
- `docs/FINALE_OWNER_ROUNDTRIP_TEST_ONLY.md`

Base local commit: `e3e76206d8a5d7080aad9320f55b58acc8c1be31`.
Base tree: `e2fcb06cbfad2f51359d3beab33a839f0d07ad84`, the same tree as draft
PR76 head `aace48ee175db7f56f150048c92f87d3cffa9302`.

All existing source, fixtures, workflows and production bytes stay unchanged.
There is no controller activation, script inclusion, graphics/rules/reward
change, server/SQL/configuration change, access change or real-player data.
The fixture itself performs no network, publication or deployment operations.
The production live revision remains outside this slice. The original owner
candidate remains frozen.

## Exact seam and the two separate observations

`field-missions.js` saves a structured clone through `task.save` before its
`finish` action invokes `task.complete` with another full clone. The completion
descriptor was supplied by `chapter-space.js` through `MKTYField.open`.

The original `chapter-space.js` callback validates with `FieldRules.restore`
and `FieldRules.won`, adds elapsed seconds, updates Echo legacy observations,
deletes `session.checkpoint`, increments the phase, and writes/opens the next
phase. At the final phase it updates StoryPlan/report/coordinates, removes the
finale key, and calls the existing award and legacy-screen paths.

The suite first executes that original callback without injection for all 17
checkpoint fixtures. It confirms source replacement/removal without evidence
capture. This is a characterization of current behavior, not a fixed path.

The second observation uses a **test-only replacement for MKTYField.open**.
It receives the real original task descriptor and wraps its `complete`
callback. No production source is text-rewritten or changed. The wrapper:

1. Retains the full raw callback checkpoint, raw active-source string and full
   pre-attempt snapshot. It checks its synthetic account/route/navigation and
   descriptor generation against current test context.
2. Presents the original checkpoint, provenance and current snapshot to the
   unchanged owner helper's `prepareCapture`.
3. Uses the helper's checked write/readback. A reloaded exact duplicate uses
   `acknowledge` and does not perform another story write.
4. Checks current persistence, synthetic context, exact story/source bytes
   again immediately before handing off to the real original callback.
5. Calls original completion only for a successful, still-current handoff.

The original callback then performs its original phase cleanup. The harness
uses actual unmodified `chapter-space.js` and `story.js`, in index load order,
with the real frozen owner/model/codec. DOM, storage, field-open delivery,
award calls, legacy observations and screen endpoints are test doubles.
`field-missions.js` is inspected and hash-pinned, not browser-executed here.
No full-app UI, actual reward client, browser disk or server runs in this test.

## Failure contract is not a gameplay decision

**Withholding original completion on a capture refusal is only this test's
inspection contract. It is not an approved new gameplay/reward gate and is not
safe runtime wiring.** Today, intermediate advancement rewrites the same
single source key and final advancement removes it. Therefore these two
requirements cannot both be implemented by simply wrapping that callback:

- Preserve its unconfirmed source checkpoint in the existing source key.
- Continue the original cleanup/phase-advance path unchanged after failure.

An actual integration needs a separately reviewed failure/persistence policy.
This slice does not choose to stop gameplay, change eligibility, invent a
pending completion, allocate a new durable key, increase limits, discard a
trace or silently continue with missing evidence.

Retention claims are deliberately scoped:

- Quota/discarded-write/capacity/opaque-data refusals do not overwrite the
  original stored snapshot. The original source string, including its
  whitespace, remains byte-identical.
- Memory-only and failed-readback cases leave the source string unchanged;
  the proposed story bytes can already be in the test storage map. The full
  previous snapshot and callback checkpoint remain separately accessible in
  the attempt record. This does not prove durable retention after process
  loss, OS durability, or storage outside this in-memory test map.
- When a concurrent writer replaces bytes, the fixture preserves its prior
  inputs separately and never rolls that writer back. It withholds cleanup.
- Known accepted checkpoint state and trace values are preserved losslessly.
  Unknown stored inputs are not normalized by a refused attempt. This does
  not widen the frozen owner's documented guarantees for arbitrary unknown
  data passing through later ordinary JSON writers.

## Coverage

23 test groups cover:

- All 17 existing raw earned checkpoints, including terminal Echo noise 105
  and gate stability -1, through the real original callback seam.
- Independent model trace replay: five exact full-state matches; twelve
  action-only fixtures also contain three controller-timer seconds, whereas
  action replay has zero. No authoritative elapsed-time proof is claimed.
- Six complete synthetic finale sequences, including seed zero and uint32
  wraparound, with reload between phases. Earlier completed records remain
  exact; actual story completion/reload/replay archive retains the final
  story string, and the fresh plan has no inherited evidence.
- 68 refusal cases: quota, memory-only, silently discarded write and failed
  readback for each of the 17 checkpoints, including intermediate and final
  phases. No original cleanup or award call follows the refused handoff.
- Whole-snapshot capacity refusal with prior accepted evidence still present;
  no new limits or truncation.
- Opaque/unreadable evidence and original raw whitespace/numeric spelling;
  refusal preserves stored bytes rather than reinterpreting them.
- Interrupted checked persistence followed by reload/recovery, without a
  second append or redundant story write.
- Repeated callbacks, superseded opens, account/route/navigation changes,
  mismatched checkpoint/seed, stale story/source writes and post-ack changes
  to context, persistence or bytes.
- Exact production-file hashes and absence of any index script activation.

Points and pending-key sentinels remain untouched by the fixture. The award
spy merely records original callback arguments; it is not an actual reward
execution or an eligibility test. Story prerequisites, context and provenance
are synthetic. No all-nine uninterrupted campaign or long-session browser
playthrough is claimed.

## Genuine old-writer limitation

The unchanged legacy StoryPlan fixture actually drops `finaleEvidence` during
an ordinary `story.js` completion rewrite. Transport alone preserves it.

- If an old writer rewrites the story after acknowledgement but before test
  cleanup, the final byte check refuses the handoff and leaves the source.
- If it rewrites the story after successful original source retirement, the
  copied evidence is lost. A new reader sees evidence absent. No recovery or
  forced gameplay replay is invented.
- Using that old model as the proposed owner refuses before writing. The
  current frozen helper reports `trace_invalid`: its equality comparison
  serializes the dropped `undefined` field before its intended
  `owner_drops_evidence` diagnostic can run. The test records the real error
  without fixing or widening this slice.

Supported writer/version rollout and authoritative route/provenance policies
remain unresolved. Synchronous compare/write/readback is not cross-tab atomic
CAS, and a check cannot prevent an old client from rewriting evidence later.
No server or legacy-policy decision is made here.

## Verification

Run exact socket-free files, avoiding substring selection of UI suites:

    node --check tests/finale-owner-roundtrip.cjs
    node --check tests/fixtures/finale-owner-roundtrip.cjs
    node tests/finale-owner-roundtrip.cjs
    node tests/finale-evidence-owner.cjs
    node tests/story-plan.cjs
    node tests/echo-checkpoints.cjs
    node tests/gate-checkpoints.cjs
    node tests/trace-codec.cjs
    node tools/build-server-models.cjs --check

The new suite passes 23 groups on Node v24.19.0. Its JSON report can be written
using `MKTY_FINALE_ROUNDTRIP_REPORT`. Existing native CI uses Node 22; no CI or
browser pass is claimed for this new tree until the coordinator runs it.

Verification incident: an initial `run-all.cjs` substring-filter selection
also selected `echo-checkpoints-ui.cjs` and `gate-checkpoints-ui.cjs`.
Both unintended browser launches failed immediately because the Chromium
executable was absent. No browser test completed, no install or alternative
browser path was attempted, and neither failure is counted as a pass.
The requested local scope is socket-free tests only; use the exact commands
above for future local checks. The full suite was not run locally.

The existing all-tests discovery will include the new top-level `.cjs` test;
the injected fixture remains under `tests/fixtures`. No CI workflow edit is
needed for a later coordinator-approved candidate run.
