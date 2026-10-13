# Source-only unsaved-result gate

This isolated prototype is not imported by the game. It does not change the
working game/server, existing adapter/contract/coordinator, rewards, gameplay,
legacy storage, identity policy, schema, database name/version, quota, source
retirement, deletion, artwork, runtime locales, or production navigation.

Basis: accepted gate design SHA-256
`5ba9514db2a530470749e16a8093076b66a0d0dbcb48a52b851019549d888b34`, against accepted
source tree `212f2767e56d5127092a0f67950143fbf615114f`. The earlier design's pending
adapter acceptance statement is historical. This note makes no new native
browser, restart, hardware-durability, WebView, or production-readiness claim.

## Test-only API

`createUnsavedResultGate({coordinator, readContext, onContinue})` returns a frozen
object with `accept(input)`, `retry()`, `continue()`, and `view()`.

- The caller constructs the unchanged coordinator with the SAME `readContext`.
  It must return ordinary data `{scope, generation, sourceIdentity}` and must
  advance a non-reused, safe, monotonic generation for every account/session/
  source-ownership change. Matching labels alone are not authentication.
- `accept({descriptor, bytes, context, summary})` synchronously validates and
  privately snapshots a bounded capture, then returns a Promise of the view.
  One live capture is admitted per imported gate-module realm, across all gate
  instances. Refusal before ownership leaves the caller owning its result.
  Reflection, reader, and asynchronous reentry cannot acquire a second capture.
- `retry()` returns a Promise of the view. It is an explicit user action, never
  a queue, automatic loop, recapture, game replay, or reward operation.
- `continue()` is synchronous. It invokes `onContinue()` with no arguments only
  after READY and a current-context check. It claims its reentry guard BEFORE
  invoking the reader, and marks CONTINUED/consumed BEFORE invoking the callback.
  A thrown or reentrant callback remains consumed. The callback must be a
  synchronous synthetic navigation hook; its returned value is ignored.
- `view()` and action-returned views are bounded, frozen snapshots. They expose
  a frozen summary and checkpoint, NEVER owned bytes, buffers, subviews,
  candidate requests, or a recovered completion. Reads of current context can
  permanently latch STALE; correctness never relies on refreshing a view.

A view contains `state`, `reason`, `phase`, `retained`, `summary`,
`retryEnabled`, `continueEnabled`, `message`, `warning`, `checkpoint`,
`ownedUnknown`, and `diagnostics`. States are EMPTY, SAVING, UNSAVED, VERIFYING,
READY, STALE, BLOCKED, and CONTINUED. Phases are capture, append, verify, and
continue. Reasons are fixed codes, not arbitrary exception messages. A throwing
exception-message accessor is never invoked. Early busy/refused actions can
return an action-specific reason without mutating the retained session state.

The default unsaved text is “Result not saved yet.” and “Closing this page
before the result is saved may lose it.” READY says “Result saved. Continue when
ready.” Test UI translations are separate fixtures, not runtime activation.
Some blocked conditions can have acknowledged stored bytes but still lack the
required exact readback/admission; this gate never enables Continue in that case.

## Narrow synthetic admission and allocation

`makeSyntheticCompletion({scope,run,summary,totalBytes=196608})` builds a
caller-owned test capture directly, without a capture-sized padding string.
The summary's exact fields are `{version:1,resultId,completedSteps,label}`:
nonempty resultId <=128 UTF-8 bytes, nonnegative safe integer completedSteps,
and label <=2048 UTF-8 bytes. The full canonical JSON is <=4096 UTF-8 bytes.
Escaped JSON size, including lone surrogates and control characters, is checked
BEFORE stringify; the canonicalization workspace cannot exceed that slot.
Accessors, extra keys, arbitrary object graphs and custom arrays are refused.

The descriptor is fixed to kind `synthetic-completion`, model
`synthetic-completion-v1`, empty note, and exactly two UTF-8 components named
`summary` and `padding`. Fixed-shape descriptor checks precede serialization.
The artifact is ARCHIVE1 with exact two-component framing; summary bytes must
match the private canonical encoding and padding is only ASCII `x` (120).
The pure `admitSyntheticCompletion` scans in place before ownership/write and
again after byte-equal readback. It does not decode, call general unframe, retain
inputs, invoke an arbitrary admission callback, or allocate another full
artifact. The retained private summary encoding is reused for both admissions.

All metadata slots are reserved before canonicalization. Owned bytes are
reserved before their native typed-array copy; shared, detached, shadowed-size,
zero-length and oversized byte inputs are refused. The gate never exposes the
owned bytes, so JavaScript's inability to freeze nonempty typed arrays does not
create a mutable public reference. Descriptor components and context are frozen.

At N <=196608 framed bytes, with fixed 65536-byte segments (at most three), the
conservative combined byte/encoded-slot envelope is:

- N private captured bytes
- N optional assemble output, reserved before assembly and released on success,
  failure or staleness
- one 65536-byte returned read page
- 32768 metadata slots, including <=4096 private summary encoding, <=4096 summary
  canonicalization workspace, descriptor/context/candidate/head/status metadata
- two 66048-byte helper hash/framing buffers, reserved before allocation
- unchanged adapter reservation of 393216

Maximum envelope: **1,016,832 bytes**. This intentionally overcounts phases that
do not overlap. It is NOT JS heap/RSS. Native IDB clones/allocator/collector
behavior, decoded-object overhead, and caller-retained inputs/views are excluded.
`diagnostics` records reservations, modeled peak/envelope, capture/attempt/
append/retry/read/admission/navigation counts, and one active gate attempt.
Counters saturate instead of becoming unsafe integers. `wholeArtifactCopies`
counts the one private capture copy; readback has its separately reported
reserved assembly output. No accumulated history, receipts, or listeners exist.

## Cursor, retry ownership and exact verification

The gate does not call `archive()`. It owns the acknowledged cursor
`{nextOrdinal,offset,previousRoot,expectedHead}` and one unchanged private
candidate. It computes each candidate's root and exact expected returned head
with the unchanged contract helpers. Only an exact committed/duplicate receipt
with IDB transaction-complete acknowledgement, strict durability, exact capture,
ordinal, length, root, seal, token, and every expected head field can advance.
A duplicate returning a newer current head is BLOCKED, not suffix adoption.

Known abort/quota/pretransaction refusal retains the prefix and candidate.
Explicit Retry resends the failed candidate, never earlier acknowledged segments.
Only this gate's own outcomeUnknown establishes unknown-request ownership.
Unrelated nonzero `retainedBytes` or retry-pending never authorizes calling
someone else's retry. While an owned unknown exists, only coordinator.retry()
is used. Late commit/abort alone does not publish READY. Physical busy retains
the same phase and request; an explicit successful exact retry may then finish
remaining segments within that attempt.

The retry lease matrix fails closed: observed transaction-aborted, native-quota,
or logical-quota resolution must release the lease before a later explicit
reappend. Pretransaction retry refusal must retain it. Unexpected disappearance,
retention after an acknowledgement/known terminal refusal, no-retry, or a
capability mismatch becomes BLOCKED. Ambiguous unfamiliar errors also block;
there is no inferred ownership, lease discard, transfer, or alternative realm/DB.

After final sealed acknowledgement, the phase irreversibly moves to verification.
The unchanged assemble() receives only a read-only guarded readSegments facade.
Each page checks context before dispatch and after its await, then checks exact
pinned identity/token, segment shape/ordinal/offset/length, and the required
continuation pointer. With fixed-size segments exactly one fits each page. A
missing/forged pointer cannot truncate, loop, or request a later page. Final
assembly is checked after its await, compared byte-for-byte with the private
capture, and passed through fixed synthetic admission again. A read-only retry
restarts assembly at the SAME head and performs no append/retry writes.

Scope/generation/source mismatch or reader failure latches STALE permanently.
Context is checked around every gate-controlled async boundary and before
publishing state. An unknown storage settlement still records its own ownership
when stale, but cannot advance, retry, rebind or navigate. An account A-to-B-to-A
transition is stale when the required generation contract is honored. The gate
does not invent production account-switch/discard policy.

## Reload and unresolved production decisions

Reload loses this in-memory result, cursor and exactly-once navigation latch.
A fresh gate stays EMPTY. There is no load-from-recovery, automatic append resume,
completion reconstruction or persistent completion token API. A separate fixture
may call bounded recover/assemble for inspection only. Unsealed is incomplete;
sealed archived bytes still do not authorize Continue, reward, gameplay proof or
server eligibility. First use/createdNew/missing storage are not proof of a
particular loss history.

No deletion, repair, migration, alternate database, fallback storage, quota
increase, cloud backup or retention/legacy policy change is implemented. Account
identity integration, real controller ownership and admission, production UI,
source staleness recovery, cross-tab writers, cross-reload completion, retention,
backup and server eligibility remain separate decisions.

## Verification

Run socket-free deterministic tests with `node tests/evidence-unsaved-result.cjs`.
The twelve named groups distinguish scripted coordinator/adapter outcomes from
native storage evidence: one/three-segment success; immutable bounded ownership;
per-ordinal failure cursor; unknown/late commit; unknown/late abort and lease
matrix; duplicate/reentrant controls; scope/generation/source and page-settlement
staleness; read-only verification retry; malformed receipt/head/bytes/pointers;
competing head/unrelated owner; inspection-only fresh realm; and unavailable/
closed/schema/size refusals. Independent helper checks cover summary correspondence
and second-admission rejection inputs. No game/reward callback is part of the API.

These tests do NOT claim native abort/quota/unknown/durability/reload behavior.
Native Chromium fixtures and the full aggregate are separate acceptance steps.
No browser or listener is started by this unit suite.
