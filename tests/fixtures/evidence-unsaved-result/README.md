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
A fresh BrowserContext provides synthetic storage for each case. Explicit reload
cases keep that same context and origin while replacing the page's module realm.

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
within that case's one origin. Previously saved records remain intact.

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
