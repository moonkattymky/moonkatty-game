# Synthetic unsaved-result gate fixture

This directory is test-only. It is neither imported by the game nor a production
UI integration. It contains no real account, result, reward, controller, cloud
API, replay, retirement, deletion, migration or navigation operation. The sole
Continue callback increments a synthetic navigation counter. A saved result
never automatically calls it.

## Local, socket-free checks

- `node tests/evidence-unsaved-result-fixture.cjs`
- `node --check tests/evidence-unsaved-result-ui.cjs`
- `node --check tests/fixtures/evidence-unsaved-result/fixture.mjs`

Preparation checks 13 complete dictionaries, exact existing `CONTINUE` labels,
en/ru `Retry saving` labels from `storage.js`, fixture-only imports, source
accessibility requirements, and the unchanged reviewed terminal-harness hash.
Preparation does not run Chromium or prove visual geometry, storage, input-device
behavior, or professional translation quality.

## Native acceptance, authorized GitHub CI only

`node tests/evidence-unsaved-result-ui.cjs` requires both `CI=true` and
`GITHUB_ACTIONS=true`, a real 40-hex `GITHUB_SHA`, and pinned Playwright 1.58.2.
Do not set those variables to bypass the local-browser prohibition. No HTTP
listener is needed or started. The driver intercepts every resource at
`https://unsaved-result-fixture.test`; unknown network requests fail acceptance.
A fresh BrowserContext provides synthetic storage for each case. The quota case
uses a fresh disposable persistent Chromium profile, matching the existing
accepted adapter quota fixture, with a committed synthetic archive before the
quota override. The other cases use isolated ephemeral contexts. Explicit reload
cases keep that same context and origin while replacing the page's module realm.
Temporary profile files are removed only after their context has closed.

There are 27 native cases, including 26 language/viewport screenshots within the
language case:

- One- and three-segment native save, exact pinned readback and second admission;
  zero navigation until explicit Continue, then one invocation
- Immutable capture/summary after caller mutation
- Native abort after request success at ordinals 0, 1 and 2, with unchanged prefix
  and exact failed-candidate retry
- Controlled unknown followed by late native complete or abort, explicit exact
  retry, and no intervening append or premature Continue
- Interrupted verification resumed from the same sealed head with zero rewrites
- Duplicate Retry/Continue and context-reader/navigation reentry; thrown navigation
  remains consumed
- A-B-A generation, source identity, post-append and first-page settlement changes,
  context-reader failure, and a stale retained unknown
- Synthetic legacy old-write/clear/restore notifications that leave archives and
  unrelated live captures unchanged; explicit source invalidation makes the gate
  stale without deleting archives
- Actual page reload after an unsealed prefix, unknown, or sealed save, followed
  only by bounded inspection; no capture, automatic resume, navigation or reward
- Observed native `QuotaExceededError` under Chromium's quota override, followed by
  explicit retry after removing the test override
- Full warning, retained summary/cursor, RTL and 44px control geometry for en, ru,
  uk, es, pt, de, fr, it, tr, he, ar, ko and zh at 320px and 390px
- Real keyboard and touch Retry/Continue at 320px

## Evidence qualifications

The driver reuses the unchanged
`tests/fixtures/evidence-indexeddb/native-harness.js` (SHA-256
`9d22a89077d380c3701b6fd5d4fca2eb282a8a61c28494555c6968d07b989df2`).
For unknown cases it binds a single exact native transaction to its real terminal
event, held callback, actual watchdog deadline, controlled delivery and later
retry transaction. This is delayed terminal-delivery evidence, not a claim that
the native database was physically undecided after its terminal event. All
barriers have deadlines owned by Node; short browser sleeps are not evidence.

Abort injection calls real native `tx.abort()` after a successful request. Quota
acceptance requires an actual native request/transaction `QuotaExceededError`;
a logical quota refusal or generic injected failure cannot pass. An unavailable
quota outcome fails rather than being labelled verified. To exhaust Chromium's
allocation slack, up to 16 fresh page realms may save distinct synthetic captures
within that case's one origin. Previously saved records remain intact. Prior/override/per-attempt usage, exact
transaction outcomes and the failure reason are saved in `nativeQuota` even when
quota verification fails. No quota failure is inferred from compression, a timer,
a logical limit or a successful override alone. In the first CI candidate, all
48 segment transactions in the ephemeral quota context completed, so native quota
remained unverified. The revised fixture aligns the disk-backed profile and seeded
prior archive with the accepted adapter fixture without weakening acceptance.
A second run with the disk-backed profile also completed all 48 writes while the
quota override was active. Persistent mode alone therefore did not resolve it.

The quota case now has one Node-owned 31-second no-write preparation interval
after applying the override and before starting a target capture. It records
monotonic elapsed time, unchanged native write count, zero active transactions,
and quota/usage before and after. The existing 16-attempt cap, artifact sizes,
logical quota, adapter watchdog and case deadline remain unchanged. This delay
never establishes acceptance: the gate candidate must still produce an observed
native `QuotaExceededError`, retain its result/prefix, and pass exact Retry and
readback assertions after the override is removed.

Primary Chromium source at revision
[`1c9524c5d3627044b0cf0a0b679978e82b702279`](https://chromium.googlesource.com/chromium/src/+/1c9524c5d3627044b0cf0a0b679978e82b702279/content/browser/indexed_db/instance/bucket_context.h)
declares a 30-second bucket-space cache. Its
[`CheckCanUseDiskSpace` / `GetBucketSpaceToAllot` implementation](https://chromium.googlesource.com/chromium/src/+/1c9524c5d3627044b0cf0a0b679978e82b702279/content/browser/indexed_db/instance/bucket_context.cc)
(lines 403–464) can approve from cached authority without consulting QuotaManager;
after the cache lifetime, available cached authority becomes zero. The exact
Chromium 145.0.7632.6 / `47e20adcc15fc15f01825aa17e570c8f5492ac0f` source was not
available through the research tool. The setup rationale is consequently
version-qualified; native CI determines whether the quota boundary is exercised.
No failure is attributed to compression or cached authority solely from elapsed
time or these source comparisons.

The interrupted-read test injects a supported refusal before its second page
dispatch. Context-change tests inject changes around actual native page results.
These are deterministic boundary controls, not spontaneous native faults. Actual
legacy functions remain covered by the separate pre-existing adapter suite; these
new synthetic notifications do not prescribe or activate production clear/restore
policy.

Output `native-unsaved-result-results.json` records source hashes, exact commit,
engine versions, native events, transaction binding, failure checkpoints, counters,
modelled ownership and qualifications. Screenshots record full translated warning
layout. Native engine allocation, JS heap/RSS, origin-wide cross-tab memory,
crash/power-loss survival and production eligibility are not claimed. Strict
IndexedDB durability is a requested hint. Read-only inspection of a sealed archive
does not reconstruct a live completion or enable Continue.
