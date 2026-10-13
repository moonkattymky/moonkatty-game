# Source-only context and phase transport, Step A

This component is not imported by the game. It supplies fixed local formats,
streaming archive transport and executable representation-budget checks. It has
no completion/award/navigation callback, session owner, controller handoff,
production backend or retention/deletion policy. Those are later integration
gates. Existing formats, adapter/schema, game rules and storage limits are unchanged.

## Fixed formats

`finale-context-v1.mjs` admits an exact StoryPlan storage string and bounded
binding into an opaque capsule. It preserves raw UTF-16 code units, whitespace,
number spelling, lone surrogates and opaque proof/evidence fields. The existing
StoryPlan restore checks a supported edition-2 core plan once. Its normalized
result is measured and discarded; it never replaces the raw archived string.
Packed task proof bytes are not expanded or asserted to prove gameplay.

The descriptor is ARCHIVE1 / `finale-chapter-context-v1`, with two UTF-16LE
components, story and binding. Its run is `fc1:<32-hex-session>:<8-or-9>`.
Story raw and canonical representation caps are each 65,536 bytes. Binding is
at most 4,096 representation bytes. The framed artifact is at most 69,660 bytes.
Virtual framing writes/compares at most 32,768 bytes at a time, including framing
boundaries. No complete context frame, assembly, UTF-8 expansion or second expected
buffer is created. Every returned page is compared directly to admitted code units.

`finale-phase-v2.mjs` privately freezes bounded raw inputs, then admits the full
checkpoint/source/binding against the context. The fixed phase format contains
checkpoint, exact stored source, binding and context-reference. Its run is
`fp2:<session>:<chapter>:<phase>`. Packet and aggregate canonical caps remain
16,384 representation bytes. Raw checkpoint serialization retains the existing
8,192-byte codec bound; only the existing five model-version-2 raw phase schemas
are admitted. Packed/v1 phase checkpoints remain refused intact.

The reference pins scope/run, context descriptor binding and sealed head token.
Synchronous helper checks are structural. The async streamer first recomputes
native SHA-256 descriptor/head/chains, checks exact append acknowledgements and
compares every readback byte. Only then does it mint a module-private branded
reference. A copied plain object cannot serve as that verified capability.
This is local archive verification, not authenticated gameplay/reward authority.

Source correspondence follows the unchanged writer: JSON.stringify normalizes
-0 to 0 in stored source, while raw checkpoint serialization retains -0. The
phase streamer additionally requires the packet's exact source text to equal
its current-context expected source, before any append. Context/source bytes,
scope, identity generation and source identity are checked at async boundaries.
Generation/ABA observation remains a caller-provided isolation contract; this
component does not supply production account epochs or cross-tab exclusion.

## API and ownership

Create a fixed `createPhaseBudget({observe?})`. It permanently charges metadata
32,768 and adapter 393,216 as a conservative base reservation. The observer is
synchronous diagnostic instrumentation; it is not a continuation capability.

1. Reserve raw-capsule 65,536 and context-retained equal to raw string length*2.
2. `freezeFinalePhase(input,budget)` captures private raw inputs synchronously.
3. `admitContext(input,budget)` reserves/measures/releases context parse and
   restore slots. It checks raw size before parsing and rejects restored/final
   rewrite growth that cannot fit the 65,536-byte post-story cap.
4. After context parse/restore references are gone, release raw-capsule and
   reserve phase-workspace 327,680. Its existing fixed slots cover the retained
   raw inputs and later caller-owned phase output.
5. `createContextStream({context,coordinator,readContext,expectedContext,budget,crypto?})`:
   `save()`, `retry()`, `view()`, `reference()`; the reference requires READY.
6. `makeFinalePhase(raw,context,reference,budget)` builds a small public packet
   in an existing phase-workspace slot. `createPhaseStream` reserves/copies its
   own private packet before awaiting; caller mutation cannot alter that capture.
   It has save/retry/view and deliberately no Continue API.

`expectedContext` has scope, generation, sourceIdentity and exact sourceText;
`readContext()` returns those plus exact storyText. The coordinator's own reader
must be the small identity reader, not an additional unaccounted full-store read.
A blocked/stale result retains its bytes/prefix; it never selects a new run or
silently deletes source. Direct low-level helpers expose no global one-chain
ownership: the next session-gate slice must supply that permanent shared owner.

One candidate survives exact retry, including unknown native outcomes. Cursor
advances only on exact committed/duplicate receipts. A late terminal alone is
not success. Before verification, unknown ownership must be resolved and the
coordinator retained lease must be zero. Read failures rerun readback, not append.
Conflict or malformed/newer/changed/missing data blocks rather than adopting it.

## Executable representation budget

The shared modeled ceiling remains 1,016,832 bytes. This is a bound on the counted
encoded/string/buffer representations, not JS heap/RSS, native IDB clones,
object headers, GC timing, hostile same-origin replacement or whole-game memory.

Storage/readback worst schedule:

- adapter 393,216 + metadata 32,768
- phase workspace 327,680 + private phase 16,384
- exact context 65,536
- candidate/page OR phase assembly+page 32,768
- helper framing/hash OR temporary current-context read 132,096
- total 1,000,448

Reservation precedes allocation. Fixed labels reject double candidates/pages,
candidate/readback overlap, page+assembly above 32,768, context parse/restore while
phase workspace is held, and context comparison while hash/framing scratch is
occupied. Busy view/save/retry never invoke the full current-context reader.
Tests delay every native WebCrypto await and repeatedly exercise those methods.
This exclusion must remain true even during reentrant observer/reader calls.

The exact 65,536 raw boundary may still refuse if canonical or restored/final
rewrite data exceeds its bound. Inputs remain intact. Large legal plans beyond
this prototype cap and long raw phase traces are deliberately unsupported;
codec-valid data can be far larger. No nine-chapter/unlimited-session claim follows.

## Evidence and remaining gates

Socket-free tests use native WebCrypto and deterministic transport doubles.
They cover all 17 existing raw checkpoints; exact code-unit/frame boundaries;
limits and preserved refusals; private snapshot and observer mutation; exact
receipts/heads/cursors; every context ordinal's known/unknown retry; staleness;
readback corruption; and reserve-first/non-overlap invariants.

The measured real 911-row task-proof StoryPlan is 38,628 UTF-16 representation
bytes. One fixture context frame is 39,038 bytes; frame size varies with bounded
scope/binding metadata. It is one real proof plus metadata records, not an
entire earned campaign. The original v1 packet rejects that same plan at its
16 KiB cap; the new context path preserves it exactly.

This Step A does not establish native IndexedDB commits, browser controller
handoff, cross-reload exactly-once rewards, continuous native completion,
phone/OS-eviction behavior, server eligibility or production readiness. Actual
lifecycle and native acceptance must be independently reviewed after this slice.
