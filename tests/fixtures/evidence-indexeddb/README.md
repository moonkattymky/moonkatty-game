# Frozen IndexedDB evidence inputs

These files are test-only inputs for the source-only IndexedDB adapter prototype.
They are not loaded by the game. The helper never opens IndexedDB, starts a browser,
creates a listener or socket, or claims new native browser acceptance.

`manifest.json` pins all twelve vendored files and thirteen already-present PR76
inputs by exact byte count and SHA-256. The helper pins the manifest itself and
verifies every input **before requiring admission/reference code**. Missing or
changed inputs are errors. All executable paths are repository-relative; source
checkout names, commits, trees, and the original evidence run are provenance only.

- `native-wires/`: the six complete original native JSON wrappers from evidence run
  38225561325, copied without editing. Both wrapper and extracted UTF-8 wire hashes
  are pinned. Durable-prefix fixtures remain prefixes of the recorded gameplay.
  Sealing their archive means only that the selected bytes were stored completely.
- `c1/vnext/` and `c1/pr47/`: the exact minimal four-file C1 admission dependency
  closure. Relative imports are unchanged.
- `reference-v3/`: exact Node-only `store.cjs` and `coordinator.cjs` vectors from the
  accepted v3 archive, SHA-256
  `29d03d1e2343e4e0fa6ea7f09ec8f2375184e38409bbb8cf06e916f15f02551b`.
  These files model reference semantics; they are not the browser adapter.

## Helper contract

`require('../../evidence-indexeddb-fixture.cjs')` from this directory exports:

- `prepareInputs()` → `{artifacts, qualifications, sourceHashes}`, synchronously.
  There are 17 admitted checkpoint frames, six admitted C1 wire frames, and one
  storage-only scalar/UTF-16 vector. Each has `name`, `descriptor`, owned Buffer
  `bytes`, `admissionKind`, and `segmentBytes`. Scope defaults to `fixture:A`.
- `verifyRecovered(artifact, bytes)` checks exact bytes, the frozen descriptor,
  original admission, every scalar with `Object.is`, and ordered object/array
  keys. It returns comparison counts and explicit replay qualifications.
- `makeDescriptor(run, length, note = '', scope = 'fixture:A')` and
  `makeRequest(descriptor, payload, head = null, sealed = false)` use the frozen
  v3 descriptor order and Node hashing. Requests contain Buffer payloads; browser
  callers must serialize them to arrays and reconstruct `Uint8Array` themselves.
- `verifySources()` returns the verified manifest and path-to-SHA-256 map.
- `verifyLimitRefusals(bytes)` repeats the seven original recorder/snapshot/proof
  refusal checks, optionally on recovered oversized storage-only bytes.
- `S` and `C` expose the frozen Node reference store and coordinator.

Running `node tests/evidence-indexeddb-fixture.cjs` performs only socket-free
preparation and recovery-verifier self-checks, and prints a JSON report. It does
not test IndexedDB persistence. Native execution belongs to the separate,
explicitly authorized CI driver.

Five checkpoints replay every field exactly. Twelve preserve controller-timed
`seconds: 3`, while the trace-only comparison copy replays to `seconds: 0`; the
archived bytes are never changed to hide this limitation. Checkpoint provenance
is synthetic local observation, not trusted server provenance. The scalar vector
preserves signed zero, exact clocks, geometry values, and isolated UTF-16
surrogates. Neither an admitted recording nor an archive receipt grants gameplay,
reward, retirement, or server authority. Recorder and codec limits are unchanged.

## Native acceptance driver (prepared, not locally executed)

`tests/evidence-indexeddb-ui.cjs` is discovered by the existing full-test runner
and has a dedicated read-only-permission workflow. It refuses execution outside
GitHub Actions. It creates no HTTP server or listener: Playwright fulfills an
allowlist of fixture documents and modules at `https://evidence-adapter.test`,
blocks every other request, and blocks service workers. Two pages share one
temporary persistent profile. `native-harness.js` is test-only instrumentation
and is never imported by the adapter or game.

Thirty named cases cover A (2), B (2), C (3), D (4), E (2), F (6), G (3), H (7),
and I (1). Nested cases include all 24 artifacts, 12 stored-seal corruptions,
six invalid input seals, two valid seal-order directions, nine bounded corruption
categories, fifteen duplicate-integrity mutations, seven maximal escaping
characters, and the 128-capture ceiling. Both watchdog/held-complete and
watchdog/held-abort paths observe real terminal events separately from adapter
listener delivery. Cross-page writes begin behind digest barriers.

`native-indexeddb-results.json` includes exact Chromium/CDP/Playwright versions,
source/adapter hashes, native request and terminal events, measured reservation
and I/O counters, outcomes, and qualifications. A case is reported as passed only
after its assertions finish. A failed or unavailable Chromium quota override is
recorded as **native quota unverified** and fails acceptance; logical quota and
injected aborts never stand in for an observed native `QuotaExceededError`.

Native/browser execution was deliberately not performed during source-only
preparation. CI must establish whether the fixture and implementation pass.
Graceful profile restart and document reload do not demonstrate OS/power-loss
safety. The destructive site-data-clear case uses only the disposable synthetic
origin and explicitly expects old receipt recovery to fail. There is no claim
of surviving eviction, origin-data clearing, profile loss, or arbitrary hostile
same-origin corruption. Legacy storage failures are labelled injections;
legacy parser/storage/cloud modules execute only against controlled fixture data.


### Held-terminal setup qualification

The complete/abort held-terminal append cases use a setup-only barrier around
`adapter.open()`. It reuses `gateWatchdogDuring` with the existing 100ms adapter
setting while Node independently bounds setup. The setup watchdog callback is
never released. A genuine successful open must cancel its exact timer, complete
the native readonly schema/marker check, leave zero physical transactions and
retained bytes, and expose open state before any raw snapshot or terminal hold.
The `clearTimeout` observer delegates unchanged and is restored in `finally`;
`setTimeout` interception is restored synchronously by the existing harness.

Setup refusal or a bounded setup failure is recorded and fails immediately,
without retry, fallback or raw snapshot. Ordinary open outcomes and these setup
proofs are retained in `native-indexeddb-results.json`, including on failure. This
correction addresses an earlier unchecked setup path that led to `NotFoundError`
in a raw snapshot; that old run did not retain the original open refusal reason,
so an exact timeout cause is not claimed.

Only setup for the two held-terminal cases is gated. Their existing append
watchdog, real native terminal/deadline ordering, unknown outcome and exact retry
assertions are unchanged. Separate open-timeout/blocked-open tests remain
ungated. This setup does not establish that opening storage always takes less
than 100ms, and adds no production timeout or storage-policy change.


### Native quota preparation qualification

The adapter's native-quota case, like the separate result-gate quota fixture,
uses one measured 31-second no-write preparation interval after the quota override
and before its first candidate append. Node independently bounds this preparation
at 35 seconds and records monotonic elapsed time, unchanged native readwrite
transaction count, zero active transactions, and the still-active quota/usage.
Per-attempt results, native events, prior counters and usage persist on failure.
The existing 16-attempt cap, 65536-byte payloads, native `QuotaExceededError`
requirement, whole-store rollback comparison and logical/storage limits are
unchanged. No adapter watchdog or other case is modified.

The rationale is the 30-second cached bucket authority documented by Chromium's
[header at revision 1c9524c5d3627044b0cf0a0b679978e82b702279](https://chromium.googlesource.com/chromium/src/+/1c9524c5d3627044b0cf0a0b679978e82b702279/content/browser/indexed_db/instance/bucket_context.h)
and its [quota-check implementation, lines 403–464](https://chromium.googlesource.com/chromium/src/+/1c9524c5d3627044b0cf0a0b679978e82b702279/content/browser/indexed_db/instance/bucket_context.cc).
The exact tested Chromium 145.0.7632.6 revision was unavailable for source
inspection. This is a version-qualified setup rationale: the actual native error
and rollback evidence determine acceptance, never elapsed time alone. Earlier
passes took longer, while a later run completed all capped writes without a quota
error in 19.819 seconds; incidental preceding test work is not relied on to age
the cache.
