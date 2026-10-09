# Atomic creator and social admission

This is a source-only security patch stacked on trusted campaign route PR #40
head `48e7bd3d3687d0d2edd69a69b14737554fbc2572`.
It does not deploy a function, apply a production migration, change a reward
policy, or alter any existing submission, moderation decision, balance or ledger.

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

The additive migration was created using official pinned Supabase CLI 2.117.0:
`supabase/migrations/20261009153246_atomic_submission_admission.sql`.
Only isolated PGlite databases were used for execution. No project dependency,
lockfile, linked database, credentials or live infrastructure was changed.

1. Obtain approval for the production migration and matching rewards-function
   deployment, and rehearse the exact bundle on an authorized staging database.
2. Apply the migration before deploying the new handler. Existing handlers remain
   protected by the INSERT trigger during the transition. If they lose a quota
   race, their current database-error mapping may show generic unavailable rather
   than the specific limit; they fail closed and cannot create the extra row.
3. Deploy both changed server modules together. A new handler against an unmigrated
   database fails closed rather than falling back to separate reads/writes.
4. Verify exact deployed versions, service-only function ACLs, private table RLS,
   one legitimate creator and social pending submission, retry after a lost reply,
   independent accounts, quota errors and rejection/resubmission using authorized
   test accounts. Confirm pending admission pays no points and historical totals
   are unchanged. Keep normal admin review/rewards regression checks.
5. Preserve the database guards if application rollback is needed. Do not drop
   them or restore vulnerable direct admission to recover a friendlier message.
   Fix forward without deleting or reclassifying historical records.

## Verification and remaining gates

Local verification: 28/28 focused Node/model/SQL files passed, plus changed-file
JavaScript syntax and whitespace checks. This is not a full browser-suite pass.

- `submission-admission-sql.cjs` runs the exact migration and production submission
  modules against PostgreSQL SQL/PLpgSQL in PGlite. It covers overlapping caller
  requests for weekly/daily/follow/pending slots; same-owner retries; cross-account
  canonical duplicates; inclusive weekly/UTC boundaries and non-UTC sessions;
  rejection/resubmission; old/new mixed writers and multi-row inserts; locked
  players; injected rollback; lost HTTP replies; caller-field spoofing; preserved
  historical oversubscription/rewards; invoker/search-path/RLS/role permissions;
  and fail-closed isolation handling.
- `submission-admission-client.cjs` exercises the production clients with a minimal
  DOM for pending/approved/rejected duplicates, translated status text, ordinary
  new-submission messages and absence of client-side reward/state mutation.
- Existing creator/social HTTP server, reward, referral, campaign, model and SQL
  integrity suites remain applicable. The integrity suite now includes this
  migration when testing moderation and transactional reward rollback.
- PGlite has one backend connection. Promise.all provides overlapping caller
  requests but is not proof of independent PostgreSQL-session lock contention or
  production load capacity. Rehearse two-session contention in authorized staging
  before release; no live attack/load test was performed here.
- Local Chromium remains environment-blocked. The complete GitHub Actions suite
  must pass at the exact stacked draft-PR head before treating browser regressions
  as verified. No browser success is inferred from these Node/SQL checks.

References: [PostgreSQL row locking](https://www.postgresql.org/docs/current/explicit-locking.html),
[volatile function snapshots](https://www.postgresql.org/docs/current/xfunc-volatility.html),
[Supabase function privileges](https://supabase.com/docs/guides/database/functions).

## Separate pre-existing audit finding

TikTok daily proof normalization still retains input URL details in its unique key
when no valid comment ID is present. Equivalent underlying videos can consequently
have different keys. This needs a separate canonicalization/historical-alias design;
the quota patch does not change URL validation or claim to resolve that issue.
