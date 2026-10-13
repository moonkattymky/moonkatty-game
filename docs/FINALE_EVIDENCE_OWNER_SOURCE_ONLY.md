# Chapter 8–9 evidence storage owner: source-only candidate

## Scope and status

Base: actual commit `eaa09304c773129d8b06ec4c85a542e123e13450`, tree `a08ec6ee9578eacca3f81da296964613d8dd7299`.

This candidate adds optional recovery-data ownership to StoryPlan.restore and a separately injected capture/storage helper. It is **not full controller integration**. `index.html`, `chapter-space.js`, `field-missions.js`, `story.js`, reward clients, campaign/core endpoints, SQL, configuration, artwork, game rules, seeds and modifiers are unchanged. No deployment or backend activation is included.

Current chapter-space still deletes checkpoints through its original path; it does not call this helper or handle its recording errors. Runtime wiring requires a later reviewed slice. A capture failure must retain previous evidence and the source checkpoint; this helper does so and returns a recording-only result, but that caller contract is not implemented in today's finale controller. Do not treat recording failures as new gameplay/reward eligibility rules or new pending-completion guards.

The source-only generated mirror `server/rewards/models/story-plan.mjs` is changed mechanically to match the canonical model. No other server source is changed. Production backend remains untouched.

## Files

- `story-plan.js`: preserve an existing own finaleEvidence field for chapters 8/9, regardless of payload version/type. Missing stays absent. This does not validate proof or reject an otherwise playable plan.
- `server/rewards/models/story-plan.mjs`: exact mechanically generated mirror of the preceding change.
- `finale-evidence-owner.js`: unactivated dependency-injected helper; no imports, networking, globals read from a player session, or controller hooks. Its only storage action is an explicitly called checked write through a supplied storage object. It never deletes checkpoints.
- `tests/finale-evidence-owner.cjs`: socket-free model/controller lifecycle, error, compatibility and budget checks.
- `tests/fixtures/finale-checkpoints-17-state.json`: unchanged copy of the 17 prior action-only checkpoints.
- `tests/fixtures/finale-envelope-21-group-baseline.cjs`: unchanged copy of the reviewed 21-group pure envelope adapter, including explicit interrupted-retirement recovery. Test dependency only, not loaded by the game.
- `tests/fixtures/story-plan-before-finale-evidence.js`: exact base-commit model for genuine old-writer characterization.

## Storage schema and guarantees

Known field:

    finaleEvidence: {
      format: "mkty-finale-evidence",
      version: 1,
      encoding: "mkty-trace-v1/json",
      payload: "<lossless serialized codec.packProof({finale: envelope})>"
    }

The envelope keeps the reviewed schema: chapter, existing finale base seed, ordered completed records, current cursor, opaque serializable context, raw checkpoints/modifiers/trace/provenance, and missing historical evidence. It does not claim route authority, verifier acceptance or human play.

Why a string: ordinary story writes use JSON.stringify. Raw nested negative zero would become zero. The known payload is serialized with the existing lossless codec and remains a string through StoryPlan.restore, story completion/write, reload and archive. Its exact payload string and decoded numeric/trace values survive those paths.

Why pre-pack: a payload string hides nested trace properties from the surrounding recursive snapshot packer. The helper first uses the existing codec.packProof, then losslessly serializes the packed object. Decoding performs the matching codec.unpackProof and envelope checks. No codec or limit changes are introduced. The resulting enclosing entry and **whole snapshot** are then checked using the existing snapshot codec and raw/packed mode limits.

Unknown versions, encodings, types, extra wrapper fields or damaged known payloads are opaque recovery data. StoryPlan retains the field structurally and normal gameplay read/complete/write continues. The recorder refuses to overwrite opaque/unreadable data rather than reinterpreting it or fabricating a new proof. This is **not byte-perfect preservation of arbitrary unknown objects**: ordinary JSON serialization can normalize negative zero, whitespace and numeric spelling. The test explicitly demonstrates raw unknown -0 becoming 0. Existing opaque string content is retained as a string.

The helper cannot recover information already lost by older serializers/controllers. Its guarantee begins with the accepted checkpoint/envelope presented to the helper.

## Pure capture / checked write / scoped retirement seam

Create the helper with `{codec, storyPlan, envelopes}`. The envelope adapter is injected; the fixture copy is only for testing the existing contract.

- `encode(envelope)` validates the known envelope, pre-packs its trace payload, and produces the versioned string wrapper.
- `inspect(plan)` reports absent, opaque, unreadable or known. Known still has authority=not-established.
- `prepareCapture({snapshot, source, mode})` takes the whole current allowed-key snapshot plus the accepted source `{chapter, baseSeed, phase, context, checkpoint, provenance}`. It checks source session identity/current checkpoint, preserves any prior accepted records, captures once, exercises the actual StoryPlan.restore plus ordinary JSON write roundtrip, and returns an exact one-key story write. No storage changes occur here.
- `persist(prepared, {storage, isPersistent, source})` checks unchanged story/source bytes, writes only the story key, reads back exact bytes, checks persistence, and returns a scoped retirement acknowledgement when valid. It never retires the source itself.
- `acknowledge(prepared, {storage, persistent, source})` handles already-written evidence without requiring a duplicate write. An exact duplicate capture after reload uses the baseline adapter's narrowly checked interrupted-retirement recovery.

Prior snapshot, incoming source, and candidate evidence remain available separately. On quota, unreadable read-back, memory-only persistence, stale source/story bytes, opaque existing data or codec oversize, no retirement acknowledgement is granted. No automatic rollback overwrites a newer writer. The previous accepted envelope and source are not silently truncated or removed.

The future caller must actually read the current source and persistence state, preserve both old evidence/source on recording refusal, maintain existing account/navigation/pending guards, and ensure no newer writer intervenes before consuming an acknowledgement. Synchronous compare/write/read-back is **not cross-tab atomic compare-and-swap** or an OS durability guarantee.

Context is serializable local data only. Equality after reload is not an authoritative persisted route binding. A process-local WeakMap capability does not survive JSON cloning and cannot serve as that binding; upstream route/provenance contracts remain unresolved.

## Lifecycle and compatibility results

18 targeted groups pass, covering:

- Six campaign fixture envelopes, actual unmodified story.js completion/write, document-context reload, explicit replay archive, and fresh-plan absence of old evidence
- All 17 original checkpoint fixtures, including model-version/raw terminal-state/trace preservation
- Known payload negative-zero preservation through actual ordinary story writes
- Absent/unknown/damaged evidence retaining otherwise playable plans; no silent interpretation as proof
- Actual old StoryPlan writer behavior, using the exact base fixture
- Preparation interrupted before write; persisted capture interrupted before source retirement; exact duplicate recovery without appending or another write
- Quota, memory-only storage, post-write read failure, stale source/story, unchanged points/pending data and no helper-driven retirement
- Pre-packed lossless long-trace storage, raw-mode refusal, aggregate accumulation and larger bounded refusal
- Client/generated mirror parity (excluding the unchanged restore-time timestamp)

All 17 checkpoint traces independently reach complete/won states. Five reproduce the full model state exactly; twelve action-only fixtures additionally contain three seconds from the controller interval, while raw R.act replay has zero seconds. They establish lossless retention of accepted checkpoints, not authoritative elapsed-time replay proofs.

The helper tests use in-memory storage with injected failures. They do not establish real-browser disk durability, cloud CAS, multi-tab atomicity, full app integration, server reward behavior or physical-device performance.

### Genuine mixed-writer limitation

The existing transport codec roundtrips the new wrapper as opaque data. An old StoryPlan reader/writer drops the top-level field during ordinary completion, and the next new reader sees evidence absent. The test demonstrates this directly rather than inventing compatibility. No proof is reconstructed and no forced gameplay replay is introduced.

A rollout must address all clients that can rewrite these saves, or choose a separate supported persistence contract before relying on evidence retention/enforcement. This remains a rollout gate; the source-only candidate does not block old clients or add a gameplay gate.

## Measured storage budgets and temporary duplication

Limits remain: packed entry strictly below 180,000 bytes; packed whole snapshot at most 350,000 bytes; decoded entry/proof at most 1,000,000 bytes; decoded snapshot at most 2,000,000 bytes; 25,000 rows and 200,000 ticks per trace. The ordinary request producer still owns the full 400,000-byte transport-envelope check.

Long docking fixture: 16,000 normal model tick-prefix inputs plus the existing completed docking trace, 16,102 rows / 17,285 ticks. No terminal position/win is assigned; model replay earns the completion.

- Packed payload: 152,086 bytes
- Story entry with wrapper: 152,476 bytes
- Still-retained source checkpoint entry, packed: 151,511 bytes
- **Whole packed snapshot during capture-before-retirement: 304,462 bytes**
- Whole raw snapshot: 435,398 bytes
- Stringify-only wrapper without pre-packing would produce a 283,412-byte story entry and fail the current entry budget

The ~304 KB value is the **temporary integration peak with both source checkpoint and accepted envelope retained**, not merely the final stored evidence size. Removing source data before checked persistence to reduce this peak would violate the lifecycle contract and is not done here.

Composite nine-chapter snapshot: existing complete eight-task Chapter1 proof fixture, one ordinary field trace for each Chapter2–8 (Chapter6 is an active checkpoint), plus the long Ch9 finale under synthetic prerequisites:

- Packed whole snapshot: **326,949 bytes**
- Raw whole snapshot: 459,143 bytes
- Long-finalized story entry: 152,476 bytes
- All earlier preparatory entries survive exact decoded roundtrip

A longer 18,000-prefix fixture fits alone at 341,794 packed bytes, but the same nine-chapter composite is rejected by the 350,000-byte aggregate budget. A 19,500-prefix capture is also refused. Refusals keep both previous evidence and source; no limits or gameplay rules are changed.

This is honest **synthetic partial-preparation coverage**, not an uninterrupted campaign or all nine long-session proofs. Full all-nine long-session accumulation remains unmeasured and a rollout gate. These findings establish that individual valid entries can still fail the whole-snapshot budget.

## Verification and remaining release blockers

Targeted commands:

    node tests/finale-evidence-owner.cjs
    node tests/story-plan.cjs
    node tests/echo-checkpoints.cjs
    node tests/gate-checkpoints.cjs
    node tools/build-server-models.cjs --check

The mirror was regenerated for story-plan only, using exactly the generator's assembly:

    node -e 'const fs=require("node:fs");const s=fs.readFileSync("story-plan.js","utf8");fs.writeFileSync("server/rewards/models/story-plan.mjs","// Generated by tools/build-server-models.cjs; edit the root model instead.\nconst module={exports:{}};\n"+s+"\nexport default module.exports;\n");'

`--check` verifies the result against the unchanged canonical generator; other generated models were not changed.

The original release contract pins StoryPlan blob `e0638e84b51fbd3419d47d3fb3fcd19da4cee2d3`. The candidate explicitly repins only the reviewed optional-field model to `469a4e123e7dee66994974b9b1f5cc14fb86b22e`, pins the old-writer fixture to the original blob, and forbids loading finale-evidence-owner.js in index.html. All existing SQL, route, endpoint and automatic-deployment exclusions remain. The full isolated PGlite-backed compatibility suite passed with local installed dependencies; it made no network or live-database requests. This contract delta is included in independent source review before publication.

Do not call this candidate release-ready while old-writer loss, aggregate budgets, pending caller wiring and authoritative provenance remain unresolved.
