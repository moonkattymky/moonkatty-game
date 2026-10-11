# Atomic creator and social admission

## Selective current-base port, 11 October 2026

This local source/test port starts from released main
`c80afa046714a51aff64e84084050aace90614b9`, tree
`f68eb2cd601b869642ae632ea4883a36856dcbb4`. The local tree-equivalent base commit is
`5158858c79e378a1a958657ed2c4a7ef92f3108c`; this is not a claim of identical commit
history. Only the admission diff from [PR41](https://github.com/moonkattymky/moonkatty-game/pull/41)
head `e892ddc5245c4136dc20844b8e16cd6c07fe6c92` and isolated test support from
[PR44](https://github.com/moonkattymky/moonkatty-game/pull/44) head
`854cc0c8a06b233272dd9bc5cb6da5e91e06ee93` are included.

No branch was uploaded, PR opened, migration applied to a live database or function
deployed. No real player data or credentials were used. Trusted routes, finale
prototypes, reward holds, bot setup and settings are outside this port. Current
compact-save transport (`traceTransport:true`, v20 release), authentication,
route/seed contracts, reward amounts, historical records and graphics are retained.
Only the two submission module bodies and two client success messages change;
index.html changes only their cache tokens.

## Preserved rules and retry contract

- Creator: at most one new submission in a rolling 168-hour window. The original
  inclusive comparison is preserved: a submission exactly seven days old still
  blocks a new one. Rejected submissions still consume this window.
- Social: at most three pending records per player across all platforms/kinds.
  A non-rejected follow blocks another follow on that platform; a non-rejected
  daily record blocks another daily on that platform and UTC day. Rejection
  releases that eligibility and pending capacity, but never releases the global
  canonical proof key.
- Admission time comes from the authenticated server's clock (or database time
  for an old direct writer). The social UTC date is derived from that timestamp,
  including when an old handler supplied a different `day`. The HTTP request
  cannot supply a player ID, admission timestamp, status, code, or quota limit.
- Canonical validation, creator ownership attestation and hashtag validation stay
  in the server modules. Moderation is still restricted to the existing admin
  allowlist. A pending submission earns no points.
- Retrying the same canonical key for its owner returns the existing submission
  with `duplicate: true`. It does not change its proof/caption, creation date, day,
  review state or rewards, and does not consume another slot. This works after a
  lost reply, at a full pending cap and after review. A rejected proof retry
  returns its rejected row; a new review needs a different proof and eligibility.
  Another account receives only the existing duplicate error, never the row.
  Creator/social client replay messages show the existing review status using
  existing translations, rather than claiming a reviewed row was newly submitted.
- Existing locked-balance behavior is retained: submission/retry rejects a locked
  player, and the database rechecks this even if the handler's player is stale.

## Transaction and privilege boundary

`mkty_creator_submit` and `mkty_social_submit` lock the stable player row using
`FOR NO KEY UPDATE`, then resolve an existing canonical key or insert a new
pending row. Every INSERT, including old direct REST writes, passes through the
same trigger and player lock before count/check/insert completes. Existing global
unique constraints remain the final cross-account canonical-key arbiter.

The trigger uses the same player row as balance locking and review. Its quota
queries read submission rows without locking them, so it introduces no reverse
submission-lock dependency against `mkty_review`'s submission-then-player order.
The new functions are explicitly `SECURITY INVOKER`, have an empty search path,
and revoke execution from `PUBLIC`, `anon` and `authenticated`. The existing
private table RLS and grants remain unchanged.

The functions are volatile and require READ COMMITTED (or PostgreSQL's equivalent
READ UNCOMMITTED) for fresh post-lock statement snapshots. The INSERT guard fails
closed if a writer chooses REPEATABLE READ or SERIALIZABLE. Do not override these
RPCs/writers to a stronger fixed-snapshot isolation level without redesigning and
testing that contract. Service-role maintenance tools must not rewrite identity,
canonical keys or quota timestamps around the admission guard.

The migration makes no attempt to repair historical oversubscription. Existing
rows still count under the original rules; no rows are deleted, rejected or paid.

## Coordinated release

The existing reviewed migration
`supabase/migrations/20261009153246_atomic_submission_admission.sql` is ported
byte-for-byte from PR41; no new migration identity is invented. Its new guards do
not depend on the unmerged trusted-route migration. Only isolated PGlite databases
were used locally. No package/lockfile, linked database, credentials or live
infrastructure was changed.

Source/test publication, merging, client release and backend activation are
separate decisions. A push to main triggers GitHub Pages deployment. Keep any
future source publication in an approved draft PR until release is authorized.

1. Obtain approval for the production migration and matching rewards-function
   deployment, and rehearse the exact bundle on an authorized staging database.
2. Apply the migration before deploying the new handler. Existing handlers remain
   protected by the INSERT trigger during the transition. If they lose a quota
   race, their current database-error mapping may show generic unavailable rather
   than the specific limit; they fail closed and cannot create the extra row.
3. Deploy both changed server modules together as part of the current rewards
   package. Preserve rewards/index.ts with traceTransport:true and all current
   codec/model dependencies and authentication settings. Leave telegram-progress
   unchanged. A new handler against an unmigrated database fails closed rather
   than falling back to separate reads/writes.
4. Verify exact deployed source and database catalog/privilege metadata within the
   separately approved activation. Repeat synthetic correctness checks in isolated
   staging first. Production signed-account acceptance needs separately authorized
   test accounts or owner-performed ordinary actions; do not query or mutate real
   player records under source-test authorization.
5. Archive the exact current v20-compatible rewards package before activation.
   If application rollback is needed, restore that package while retaining the
   database admission guards/RPCs. Its older direct inserts remain guarded, though
   raced errors may be generic. Never restore a pre-codec package or delete,
   reclassify, expand or rewrite player records to make rollback fit. A database
   rollback/guard removal is not part of this release plan; fix forward.

## Verification and remaining gates

Fresh local validation: **31/31 selected Node/PGlite suites passed**, including
153 old/new-handler compatibility checks, seven focused admission/HTTP/SQL/offline
PostgreSQL companion suites, and 23 existing reward/account/cloud/trace/model
regressions. Changed JavaScript syntax and whitespace checks passed. Independent
read-only source review found no concrete correctness or scope defects.

Runtime: Node 24.19.0, existing PGlite 0.3.14. No package was installed or changed.
The CI workflow uses Node 22 and still needs its own exact-head result. All 349
tracked base files outside the nine intended tracked edits are byte-identical,
including all graphics, compact transport, auth/route code, existing workflows,
packages and newer launch-integrity synchronization. The original checkout is
unchanged. The SQL migration retains Git blob
`c3b5200ba8fa2f7bdc427c72d69ae3ecd2178479`, identical to reviewed PR41.

These results do not include full npm test, browser execution, native PostgreSQL
contention, live authentication or production traffic. Those were not attempted.

- `submission-admission-fixture.cjs` explicitly lists the five current-base schema
  inputs and target admission migration. Both SQL harnesses use that manifest;
  neither discovers unmerged migrations by directory scan.
- `submission-admission-sql.cjs` runs the exact migration and production modules:
  retries after a lost reply, pending/approved/rejected owner rows, canonical-key
  privacy, inclusive 168-hour/UTC boundaries, rejection/resubmission, historical
  oversubscription preservation, mixed direct/RPC writes, multi-row rollback,
  locked balances and existing role/RLS boundaries.
- `submission-admission-client.cjs` exercises real client response handlers with
  a minimal DOM and existing translated labels. Pending submission pays nothing.
- `submission-admission-compatibility.cjs` uses pinned byte-identical baseline
  creator/social modules and current modules against PGlite. Its deterministic
  scheduling of stale old-handler prechecks is not independent-session contention.
- The shared atomic mock remains only a narrow adapter. Current route mocks,
  launch-integrity save acknowledgments, model-tests workflow, package versions,
  compact-save entrypoint and ordered reward-client behavior are preserved.
- The separate [PostgreSQL workflow](POSTGRES_ADMISSION_CONTENTION.md) retains the
  32 two-backend commit/rollback cases and observed-lock requirements. Its
  [historical run](https://github.com/moonkattymky/moonkatty-game/actions/runs/37970627591)
  passed on exact PR44 head `854cc0c8a06b233272dd9bc5cb6da5e91e06ee93`.
  Fresh real PostgreSQL contention on this selective port has NOT been executed.
- Full exact-head browser/model CI and a fresh isolated PostgreSQL workflow are
  required before release. Browser/socket attempts and public publication were
  outside this local task. The prior product release's full-suite pass does not
  certify this new source combination.
- After separately approved source publication, the standalone test workflow may
  run only its fresh disposable synthetic cluster. It is not wired to deployment,
  uses no live secrets, and cannot establish capacity or 10,000-user readiness.

References: [PostgreSQL row locking](https://www.postgresql.org/docs/current/explicit-locking.html),
[volatile function snapshots](https://www.postgresql.org/docs/current/xfunc-volatility.html),
[Supabase function privileges](https://supabase.com/docs/guides/database/functions).


## Exact local changed paths

Only these 24 paths are part of the port; six are runtime source/migration paths.

- `.github/workflows/postgres-admission.yml`
- `creator.js`
- `docs/ATOMIC_SUBMISSION_ADMISSION_20261009.md`
- `docs/POSTGRES_ADMISSION_CONTENTION.md`
- `index.html`
- `server/rewards/creator.mjs`
- `server/rewards/social.mjs`
- `social.js`
- `supabase/migrations/20261009153246_atomic_submission_admission.sql`
- `tests/atomic-rpc-fixture.cjs`
- `tests/creator-server.cjs`
- `tests/fixtures/pre-admission-creator-c80afa0.mjs`
- `tests/fixtures/pre-admission-social-c80afa0.mjs`
- `tests/integrity-sql.cjs`
- `tests/postgres-admission-driver.cjs`
- `tests/postgres-admission-sql.cjs`
- `tests/postgres/fake-psql-fixture.cjs`
- `tests/postgres/psql-session.cjs`
- `tests/postgres/submission-admission.cjs`
- `tests/social-server.cjs`
- `tests/submission-admission-client.cjs`
- `tests/submission-admission-compatibility.cjs`
- `tests/submission-admission-fixture.cjs`
- `tests/submission-admission-sql.cjs`
