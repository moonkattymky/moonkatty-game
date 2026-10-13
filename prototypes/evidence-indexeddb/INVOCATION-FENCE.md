# Fixed finale invocation fence (source-only candidate)

`invocation-fence.mjs` adds an isolated local experiment to the accepted
`9b072131` source tree (`f21589b2`, corresponding to remote PR 76 `3299c5b3`).
It does not modify the game, session manager, original handlers, storage facade,
IndexedDB adapter/schema, server, SQL, index, assets or existing limits. This is
not a shipped integration or a statement that the browser/native matrix passed.

## Deliberately narrow outcome

For the cooperating disposable-guest fixture, a newly committed **and verified**
ISSUED record arms one synchronous invocation in the same still-current realm.
The capability is consumed before entering the unchanged original callback.
An exception, reentry, duplicate, stale result, unknown commit or retry cannot
restore that capability. A fresh realm can inspect records but receives no
invocation, gameplay, native-write or replay capability.

The only original actions in this slice are chapter 8 phase 1 and chapter 9
phase 2 final dispatches. The writer contract is exactly
`final-prepared-operations-v1`. Old absent-operations fixtures remain separate
inspection evidence; they are not silently admitted as this fresh contract.
RETURNED observes a normal synchronous callback return only. It is not DONE,
writer-finish proof, exact native settlement, an award acknowledgment, a unique
execution cursor or permission to open the next board. The integrating wrapper
is responsible for the existing writer's begin/handleWrite/finish behavior.

## API and caller responsibilities

`createInvocationFence(options)` returns:

- `prepare()`: async, bounded fresh-journal preflight, PREPARED commit and exact pinned readback
- `issue()`: async, fresh ISSUED commit and exact pinned readback; arms once
- `invoke(original)`: synchronous; returns true only after consuming the arm
  and observing a normal synchronous return, false when no arm is available;
  throws and permanently blocks when the original throws or returns a thenable
- `recordReturned()`: async optional observation after a normal return
- `retry()`: resolves only the adapter's retained exact request; never arms
- `view()`: bounded diagnostic state; no token or callback capability escapes

Options are an exact ordinary data-property object containing `coordinator`,
`budget`, `scope`, `session`, `chapter`, `phase`, `identity`, `expectedContext`,
`contextPin`, `phasePin`, `isCurrent`, `sessionMetadataBytes`, and optional
`crypto`. Functions/capabilities are permitted in their named slots. Accessor
option fields, custom prototypes, unsupported fields and malformed pins refuse.

`expectedContext` is exactly `{scope,generation,sourceIdentity}`. The session is
32 lowercase hex characters. Both pins are exactly
`{binding,root,ordinal,total}`; binding and root are 64 lowercase hex characters.
The phase is one segment, at most 16,384 bytes. The context has at most three
segments and at most 69,660 framed bytes. The constructor owns immutable copies
of these small inputs. Caller mutation cannot change them.

`identity` must equal native SHA-256 of the UTF-8 encoding of:

```
JSON.stringify([
  'invocation-fence-identity-v1',
  scope, generation, sourceIdentity, session, chapter, phase
])
```

The helper checks this correspondence before PREPARED; the inspector checks it
before discovery. It is not authentication, ownership or a cross-tab lease.

The fresh caller must already own an admitted, cooperating fresh-fixture
session and verified sealed phase/context references. The fresh helper trusts
these caller-admitted references; it does not re-admit the large checkpoint or
context. It must not be used to infer freshness from archive absence after
reload, loss, eviction, rollback, migration or an old unjournaled callback.

`isCurrent()` must enforce the caller's original realm, identity, ownership and
exact precondition pins before invocation, and the authorized original writer's
continuity once invocation starts. It is checked across every async boundary
and around the final physical-idle check. Reentry sees the helper busy or the
already-consumed state. These are cooperating capability checks, not an
atomic exclusion mechanism against malicious getters or arbitrary old writers.

`sessionMetadataBytes()` returns the current measured existing-session metadata
without the helper's additional representations. It must include the original
writer's future-target metadata and all parent-owned retained metadata. The
helper re-admits combined metadata at resource transitions and immediately
before and after the original callback. An integration must preserve the
combined accounting contract while the original writer runs.

The coordinator is the existing coordinator: append is called with its exact
`expectedContext`, and strict acknowledgment and physical-idle properties are
required. No bound wrapper, new storage schema or reset/delete API is introduced.

## Records, framing and fixed identities

Each receipt is one sealed `archive-bytes-v1` segment. The fixed run is:

```
fr1:<session>:8:1:PREPARED|ISSUED|RETURNED
fr1:<session>:9:2:PREPARED|ISSUED|RETURNED
```

Descriptor kind/model are `finale-recovery-observation` and
`finale-recovery-observation-v1`; the sole component is `observation`, UTF-8.
The exact ordered JSON fields are:

```
version, session, stage, event, writer, identity, phase, context, previous
```

`version` is 1; `stage` is `8:1` or `9:2`; `writer` is the fixed contract above.
`phase` and `context` contain the compact pins. PREPARED has `previous:null`;
ISSUED names the exact PREPARED root and RETURNED the exact ISSUED root. No retry
suffix, timestamp, random attempt, nativeBefore/nativeAfter, original closure,
facade RAM, retained-story witness or dynamic native target is serialized.

All record fields are ASCII. Text and parsed representation are each at most
1,344 UTF-16 representation bytes. Framing is at most 692 bytes. Unknown keys,
noncanonical ordering, whitespace, versions, contracts, stages, dependency
chains or pin values fail closed. Readback compares every original scalar and
canonical syntax without creating a second full canonical string, and verifies
the exact existing descriptor-bound segment root under its pinned head.

Before PREPARED, bounded read-only discovery must exhaust a consistent membership
snapshot. It accepts only the thirteen fixed session capture identities, tracks
distinctness in a compact bitmask, verifies authenticated cursor progression and
requires the inspected-member count to equal the watermark. Any surviving
own-action receipt, including a later-only ISSUED or RETURNED after partial loss,
refuses before a new journal append. Unsupported members, malformed envelopes,
truncated/empty early pages and inconsistent cursors also refuse. This detects
partial evidence loss; it does not turn missing evidence into recovery authority
or protect against coherent loss or changes beyond the membership snapshot.

Only `committed` can advance a fresh instance. Even duplicate PREPARED blocks
this instance from issuing. Any duplicate ISSUED blocks; it never borrows an arm
from the original append. A lost acknowledgment retains the same deterministic
request under the adapter's existing ownership. Retrying it may establish a
journal fact but leaves the helper inspection-only. No second candidate identity
or original invocation is produced.

## Read-only inspection

`inspectInvocationFence(options)` requires the same immutable expected metadata,
`isCurrent`, coordinator and budget. It invokes only recover/readSegments and
native hashing; it receives no original callback, native game writer or facade
retry function. Every result has `inspectionOnly:true`, `invocationAllowed:false`,
`playEnabled:false` and `continueEnabled:false`.

It visits at most 128 discovered heads, one head per page, and validates complete
watermark exhaustion, cursor progression and distinct known members. The membership
watermark is fixed and reported as `membershipOnly:true`; an append after that
watermark can be absent from the result. It is not a current cross-tab journal
snapshot. This can make a result conservatively incomplete or prepared-only;
it never makes invocation safe.

The target action's context and phase descriptors, exact expected pins and all
payload segments are validated under exact through-head tokens. This verifies
archive byte integrity and journal correspondence; it does not reconstruct or
re-admit gameplay state. Receipt payloads are canonical-decoded and checked
against the expected identity/pins and each preceding root. A receipt without
its context, phase or predecessor remains incomplete. All original data and
archives remain unchanged.

Recognized receipts for the other fixed final in the same session are ignored
as evidence for this action; inspecting that final verifies its own payloads.
Other expected session phase/context captures are similarly not adopted as this
action's evidence. Foreign or unsupported receipt namespaces fail closed.

Classification is one of `absent/legacy-unattributed`, `incomplete/unverified`,
`prepared-only`, `issued/no-return-observed`, `returned-observation`,
`unsupported/conflicting`, or `unavailable`. Missing or old archives never prove
first use. Corrupt records and references do not authorize inference from an
apparently complete native image. ISSUED stays unresolved at every original
write prefix, including source removal before reward, points before marker,
complete native bytes without RETURNED, and duplicate/no-op write images.

## Representation ownership and unchanged limits

These are encoded-representation and reserved-slot bounds, not JS heap/RSS,
object-header, engine string-layout, DOM, clone, GC or physical disk guarantees.
Every retained representation across an async boundary has an existing slot or
an explicit metadata charge. No new budget label, database store or global cap
is introduced.

The journal-specific *admission* ceiling is 5,120 bytes inside the existing
32,768-byte metadata reservation, not an additional reservation. It replaced the
unpublished proposed 4,096 allowance after independent review of the actual
append-response overlap. Combined existing-session plus journal metadata must
remain at most 32,768. With the existing long-fixture metadata 26,384, the full
5,120 admission allowance gives 31,504. Longer scope/source identities may refuse
intact under this narrower helper even though the general adapter accepts them.

- Private settings and pending state are actual compact frozen/scalar tuples.
  The previous root is one shared scalar, not a second history graph.
- Record graph plus canonical text are measured together with retained pins and
  scalars. No `nativeBefore` or second large native/story copy is retained.
- Fresh preflight borrows existing `returned-page` at 16,384 for one at-most-
  8,192-byte discovery response. It retains no page graph after release and
  charges its compact cursor before the next await. It performs no payload
  reads. This slot is compatible with live raw/context/post-target ownership;
  the conservative existing-slot bound is 638,976. All page ownership ends
  before subsequent descriptor hashing, framing or candidate construction.
- `stream-candidate` is borrowed at 2,048 bytes. The frame is at most 692 bytes;
  direct ASCII copying avoids an additional UTF-8 temporary (even the reviewed
  672-byte encode plus frame would fit). Record graph/text die before descriptor
  processing.
- Each descriptor representation is bounded at 896 UTF-16 bytes and at most
  1,024 UTF-8 bytes. All simultaneous descriptor graphs/text are charged before
  hashing. The temporary spread metadata used only to measure a request dies in
  a synchronous helper before append awaits.
- The sole pre-append predicted root lives in the request's seal during append.
  The pending root slot is null until that request is dropped, then receives the
  same root scalar. The request, compact metadata and complete response envelope
  are admitted together before await. The exact narrow response bound accounts
  for scope escaping, fixed run and the adapter's 295-character head token.
- Candidate storage is dropped before readback. `returned-page` is borrowed at
  1,024 bytes for receipts; scalar-by-scalar validation does not allocate a second
  full expected JSON string. The caller transfers its token reference before
  awaiting readback. Every journal page/helper/frame lease is gone before the
  original callback.
- Unknown physical appends retain the exact adapter-owned request under its
  existing adapter reservation; the helper retains only bounded fixed metadata.
  Physical pending or retained bytes prevent arming/invocation.
- Inspection keeps `recovery-page` 16,384 live for one at-most-8,192-byte discovery
  response until that item's archive verification completes. Item/head/next-cursor
  aliases remain owned by that lease. Independent descriptor/decoded copies are
  metadata-charged; all such references die or transfer before lease release.
  Large referenced payloads use existing `returned-page` at 32,768 sequentially.
  No raw/context/phase workspace is admitted during inspection. The conservative
  existing-slot schedule is 425,984 + 16,384 + 32,768 + 132,096 = 607,232 bytes.
- A reserve/allocate observer throwing after reservation is cleaned up using the
  actual owned slot. Each caller records successful acquisition; a failed
  borrow never releases another owner's equal-sized pre-held slot. Release
  observer failures cannot restore invocation or leak
  candidate, readback or hash/framing leases.

The unchanged global representation ceiling is 1,016,832. The unchanged logical
adapter quota is 8,388,608 bytes and 128 captures. Two finals add at most six
receipts, for 13 captures with the existing seven phase/context captures. At the
reviewed conservative maximum of 14,004 committed bytes per receipt, added
logical bytes are at most 84,024. Actual adapter staging/quota checks still
control each append; this is not a whole-session reservation or permission to
delete old evidence.

## What remains outside this candidate

There is no IndexedDB/localStorage atomic transaction, exact-once award promise,
recovered writer completion, replay or suffix repair, restored removed source,
reconstructed timestamp, old-save ownership attribution, migration/account
policy, cross-tab lease, durable WeakMap witness, post-target archive or native
DONE acknowledgment. Archive loss, coherent rollback, arbitrary legacy writers,
OS eviction and power loss are not solved. The deliberately safe recovered
outcome can remain blocked forever.
