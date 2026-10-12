# Source-only real-finale admission

This is a bounded integration-characterization format. It is not imported by
index.html and changes no game, model, codec, backend, storage policy or rewards.
Local admission uses the existing FieldRules/TraceCodec/StoryPlan semantics. It
establishes neither trusted provenance nor server eligibility or replay proof.

## Fixed API and artifact

`makeFinaleCompletion({scope,run,checkpoint,sourceText,storyText,binding})` builds
one caller-owned artifact synchronously and returns `{descriptor,bytes,summary}`.
Use `gate.accept({...artifact,context})` with the existing gate. No model,
validator or admission function is supplied by the caller. The helper imports
the three unchanged model modules directly (CommonJS default exports in Node;
UMD globals after module evaluation in browsers).

The fixed descriptor has kind `finale-phase-completion`, model
`finale-phase-completion-v1`, empty note and exactly four ARCHIVE1 components:
`checkpoint`, `source`, `story`, `binding`, all encoded as UTF-16LE. The source
and StoryPlan are their exact storage strings, including whitespace, numeric
spelling and lone raw UTF-16 code units. The checkpoint and binding use the
existing lossless codec JSON encoding, preserving negative zero. No hash receipt
or normalized checkpoint replaces the raw callback argument.

The exact binding fields are version=1, chapter=8/9, edition=2, phase,
mechanic, fieldStage=4, baseSeed, derived seed, sourceKey, storyKey,
route=`spatial-finale`, and provenance. Keys must name the corresponding chapter
storage entries; mechanics are `[10,3]` and `[9,6,11]`; derived seed is
`(baseSeed + phase*7919) >>> 0`. Provenance is ordinary bounded finite JSON data,
at most 2,048 bytes in its lossless UTF-16 representation; full binding is at
most 4,096 bytes. It is a captured local observation, never authority.

Admission requires an exact six-field active source session, valid core-phase
edition-2 StoryPlan, full model-version-2 raw checkpoint with a nonempty raw
trace, supported checkpoint fields, valid attempt/failures/impacts counters (0–10,000), and completed/won status
both on the raw checkpoint and the existing model's restore result. It does
not use the restore result as the retained checkpoint. Existing trace limits
remain in force, with an additional 8,192-byte raw-format serialization limit.
Packed trace markers are refused anywhere in this format; they are not expanded.

The real source writer uses JSON.stringify. Accordingly source checkpoint
correspondence follows that writer's semantics: negative zero can appear as
zero in the source while the separately captured raw checkpoint keeps negative
zero. All values are ordinary finite data before this comparison, so undefined,
functions, symbols, getters, sparse arrays and custom serialization cannot gain
correspondence through omission. Exact source and story strings are separately
retained. Caller-facing context invalidation must compare those captured exact
strings and monotonic ownership generation at every relevant boundary.

The frozen summary is derived, not supplied as authority: version, chapter,
edition, phase, mechanic, fieldStage, seed, modelVersion, attempt, seconds,
traceRows, completed=true, authority=`not-established`. The supplied summary
must match every derived field. The gate repeats admission after sealed exact
byte readback. Its private frozen raw checkpoint is passed to
`onContinue(rawCheckpoint)` once, only after READY and a current-context check.
Synthetic format behavior remains `onContinue()` with no argument. Both formats
use the same gate module's realmOwner and realmAccepting; creating another gate
cannot bypass the one-capture lifetime. Throwing continuation stays consumed.

## Limits and allocation derivation

The old synthetic cap remains 196,608 bytes, segments remain 65,536, adapter
reservation remains 393,216 and the shared combined modeled ceiling remains
1,016,832. The synthetic in-place scanner's derivation is unchanged. It is not
reused as a decoder budget.

Finale artifacts have an explicitly smaller **16,384-byte test-format cap**,
including all four full components and 44 framing bytes. In addition, the
AGGREGATE canonical lossless UTF-16 JSON representation of parsed checkpoint,
source, story and binding must fit 16,384 bytes. Measuring each separately is
insufficient: short exponent spellings can expand substantially on stringify.
This aggregate preflight occurs before recursive serializers and model calls.
It counts every node (maximum 4,096), each container (maximum 128 object keys or
4,096 array elements), depth (maximum 64), escaped strings and numeric spellings.
All text lengths are checked before JSON.parse or decode allocation.

The finale gate reserves **327,680 bytes**, twenty fixed 16,384-byte
representation/workspace slots, before admission. It retains this reservation
for the capture's entire lifetime, including stale/blocked/continued states.
The slots deliberately overcount non-overlapping lifetimes:

1. All decoded component texts
2. All first-admission parsed component representations
3. Retained raw callback, exact source/story and binding representations
4. All second-admission parsed representations
5. Fixture-wrapper retained raw input/source/story/binding representations
6. UTF-16 decoder's character accumulator
7. Decoder's joined-output workspace
8. Lossless serializer's scalar tokens
9. Its joined serialization
10. Simultaneous checkpoint comparison serialization
11. Source correspondence JSON serialization
12. FieldRules restoreLegacy's JSON serialization
13. Its parsed/spread-visible graph representation
14. FieldRules version-2 JSON serialization
15. Its parsed/spread-visible graph representation
16. Trace validation's row token/join strings
17. Trace validation's returned row representation
18. StoryPlan's restored representation
19. Caller-held returned artifact buffer (at most 16,384 bytes)
20. Fixed model defaults/layout data, top-level spread additions and summary

Nested references shared by model spread targets are not new deep copies.
Their top-level default/key/scalar additions are charged to slot 20. The five
fixed stage-4 model layouts have at most three trajectory targets, three docking
bays, nine convoy nodes or small Echo/gate tables. Their data projection plus
fresh model state is below 4,096 UTF-16 representation bytes in the extreme-seed
and selected charge/stability/repair/cell/preview modifier-maximum source tests; a 16,384-byte slot remains reserved. Model
layout function closures and normal object headers are excluded engine objects,
not serialized data. The source additionally measures the fixed data projection
before restore. Trace row token/join work is bounded by the 8,192-byte codec
limit and aggregate canonical bound, within the fixed 16,384-byte slot.

With actual framed size N <= 16,384, finale's conservative envelope is:

- N private capture, plus N readback assembly
- 65,536 returned-page reservation
- 32,768 existing metadata/summary/descriptor slots
- 132,096 existing hash/framing workspace
- 393,216 unchanged adapter reservation
- 327,680 new decoder/retention slots

Total = **951,296 + 2N**, at most **984,064**, leaving 32,768 under the unchanged
combined ceiling. Reservations happen before the associated owned allocations;
readback/page reservations release in finally, while the new lifetime
reservation does not release after capture. Failed pre-ownership admission
releases it and leaves the realm slot free. The diagnostics expose this extra
reservation as finaleWorkspaceBytes and include it in peak/envelope accounting.

The synchronous builder and direct helper callers have their own explicit
327,680-byte representation/workspace allowance plus one <=16,384-byte output.
They do not invoke storage or overlap asynchronous builder work with the gate.
Once construction returns, temporary workspace becomes unreachable; the
returned packet and wrapper's bounded exact inputs are included in slots 19
and 5 above. This is not an invitation to retain unbounded previous captures,
builder intermediates, fixture reports or copies. Fixture diagnostic histories
are test instrumentation outside the gate's retained-result allowance.

This is encoded/buffer-slot accounting, **not JavaScript heap, RSS, native IDB
cloning or garbage-collector accounting**. Reflection key-reference arrays and
engine enumeration metadata, array capacity, object headers, closures and
uncollected unreachable temporaries are explicitly excluded. Enumeration first
stops at the bounded enumerable key count using descriptor reads; subsequent
Reflect.ownKeys checks hidden/symbol/extra properties before processing names.
A malicious object can have arbitrarily many hidden/symbol keys and therefore
force an unbounded native reflection array before refusal. No constant-space or
side-effect-free claim is made for arbitrary Proxies, which can run traps and
are outside the ordinary-data input contract. Nothing silently drops hidden or
symbol-keyed callback data to admit it.

## Coverage and deliberately limited admission

`node tests/evidence-finale-completion.cjs` is socket-free. It covers all 17
original version-2 checkpoints, including completed Echo noise 105 and gate
stability -1; exact lossless callback preservation; actual source -0
normalization; both cross-format ownership directions; failed preownership
admission; altered source, seed, phase, route, summary, descriptor and readback;
malformed/accessor/hidden/symbol/deep/oversized inputs; exact 16,384-byte acceptance
and next-code-unit refusal; controller retry metadata; earned gate success after a misaligned-launch impact; caller mutation; stale
context and repeated/throwing continuation. The existing gate suite must still
pass all 834 assertions. Native browser/controller coverage is separate.

The 17 small-plan packets are 4,008–10,240 bytes. Those StoryPlans intentionally
serve only source-admission characterization, not complete playthrough evidence.
The test also constructs a structurally restorable populated synthetic
StoryPlan whose repeated proof payloads exceed this cap; those payloads are not
a completed eight-task playthrough. Separately, 1,000 genuine Echo tune actions
followed by the earned noise-105 trace produce a model-valid completed raw
checkpoint that exceeds this cap. Both refuse without changing any input.
Native-fixture measurements separately report their actual StoryPlan inputs.

Legitimate longer sessions and populated StoryPlans can exceed this test-format
allowance and will refuse without truncation or source retirement. Full raw
checkpoint AND source remain mandatory. Model-version-1 checkpoints, completed
checkpoints without a nonempty trace, and packed traces are also conservatively
refused by this version of the characterization format even where the existing
controller/model could accept them. This introduces no live player limit and
makes no all-session coverage claim. Broader supported formats need a separately
reviewed bounded design; no cap is raised here.
