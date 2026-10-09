# Trusted campaign routes: source-only release plan

Base: draft PR #39 at `a902c6699383d09688aa1f7969a8b46eeb3ff3c8`.
This separate batch has not been merged, deployed, or applied to a live database.
No player balances, confirmed achievements, secrets, or production settings were changed.

## What changes

- New chapter challenges use a cryptographically random server seed and edition 2.
  Neither a requested client seed nor edition can select the issued challenge.
  The database generates the seed as well as the route UUID, protecting the boundary
  even during a mixed-version handler rollout.
- Existing rows receive `challenge_version = 1`. New issuance and explicit restart
  create version 2. Previously verified legacy rows do not authorize new rewards.
  Existing ledger entries and imported confirmed chapter completions still retry
  idempotently and keep their balances.
- The client waits for an account-owned, version-2 receipt, persists it, and adopts
  its seed before the first stage can start. Repeated clicks share requests;
  responses for another account or an abandoned screen cannot replace a run or
  reopen a dismissed screen. Connection/storage failures preserve the old run.
- An unfinished legacy or divergent route is archived before replacement. Its
  plan and chapter/finale checkpoints remain on the device under a unique archive
  key. The chapter screen explains the restart and offers a JSON download. Only
  the player's explicit “keep archive and start a new route” action replaces it.
  Archives are local and are not automatically uploaded. The download is a recovery
  artifact, not a server-accepted reward proof or an automatic import feature.
- Explicit restart compares the expected current UUID, preserves its database
  history, and is idempotent across duplicate requests and lost replies. A stale
  request superseded on another device is cleared and refreshed without resetting
  the newer route; the player must choose again.
- The payout transaction rechecks the exact trusted, verified UUID while holding
  the same player lock used by restart. A reset between validation and payout can
  no longer award for a replaced challenge. Referral chapter-skip passes still
  work before a chapter has been played and do not require campaign proof.

## Migration and verification

`supabase/migrations/20261009151834_trusted_campaign_routes.sql` was created with
pinned official Supabase CLI 2.117.0 (`migration new`, after command help discovery).
Its changes were executed only in isolated PGlite test databases. The CLI used a
throwaway local home/cache; project dependencies and lockfiles are unchanged.

The migration adds one version column, one private/RLS-enabled route history
relation, a compare-and-restart RPC, and replaces the route/verification/reward
RPC bodies. Privileged functions remain `SECURITY INVOKER`, use an empty search
path, and are not executable by `PUBLIC`, `anon`, or `authenticated`.

Focused tests:

- `campaign-security.cjs`: ignored client challenge hints, independent issuance,
  cross-account transcript rebinding rejection, positive recorded UI replay,
  legacy rejection, idempotent completion/restart, and reset/payout interleaving.
- `campaign-routes-sql.cjs`: additive upgrade preserves players, reward ledger and
  cloud snapshots; old verified routes fail closed; concurrent restart and reward
  retries settle once; referral skips and archive permissions remain correct.
- `campaign-routes-client.cjs`: actual production story/reward clients under delayed
  replies, repeated clicks, cancellation/newer navigation, stale confirmations,
  account switches, offline/storage failures, archive/restart recovery, lost reply
  retry and another device's superseding restart.
- Existing reward, recovery, rule-model and server suites remain applicable.

The local Node/SQL checks do not certify browser behavior. Chromium cannot run in
this execution environment. Full browser CI must pass for the exact stacked PR
commit, followed by signed Telegram and physical iPhone/Android checks. In
particular verify archive downloads in the Telegram WebView, every chapter's
resume/finale transition, Back/Cancel, multiple tabs/devices and account changes.

## Approval and rollout gates

1. Obtain the product decision for unfinished legacy routes: old progress is kept,
   but earning a new reward requires an explicit verified-route restart. Separately
   approve the production migration and rewards-function deployment.
2. Before deployment, take/verify the normal database backup and record current
   migration/function versions and confirmed balance/ledger totals. Rehearse the
   exact migration and application bundle together in staging. No live inventory
   or backup operation was performed for this source batch.
3. Use a coordinated maintenance/release window: database migration, matching
   rewards handler, then matching client assets/cache versions. The hardened
   database intentionally rejects new payouts from an old handler that omits its
   route receipt; an old database/client cannot be treated as a successful rollout.
   The new client fails closed if the backend lacks trusted challenge versions.
4. Verify exact deployed versions and permissions, trusted issuance, one successful
   legitimate completion/retry, one legacy recovery, one restart retry, referral
   skip, and account isolation using authorized test accounts. Confirm balances
   and old achievements are unchanged, and watch errors before reopening traffic.
5. If rollout fails, stop new campaign reward claims and fix forward while retaining
   saves, history, queues and confirmed balances. Do not revert to accepting legacy
   proofs, delete archives, or bulk-reclassify version-1 rows as trusted.

A connection is required to open/adopt a verified route, including after reload.
An already open stage can save while offline; failed registration/reward sync
retains progress and can retry. This batch does not solve oversized cloud traces.

## Remaining security gap: all nine finales

This patch verifies the existing eight-stage transcript and its issued route.
It does **not** add authoritative proof for the chapter finales. A successful
client finale flag or checksum is not adequate evidence. Consequently this is a
bounded integrity fix, not financial-grade security or proof of human play.

A complete finale verification project needs:

1. Pure versioned rules extracted from the chapter 1–4 controllers, reactor 5,
   liftoff 6 and void 7; deterministic, server-issued phase challenges for the
   chapter 8/9 spatial sequences as well. Keep browser/server rule parity tests.
2. Server registration of each finale attempt against the account, route and
   challenge version; bounded replayable input evidence for every required phase,
   including code/puzzle dependencies. Freeze the rules version used by that run.
3. Server replay and canonical success checks, followed by an atomic final verified
   receipt consumed by the existing payout transaction. Never trust terminal
   booleans, local timestamps, local reward flags or client-supplied checksums.
4. Real completed transcripts for all nine finales, corrupted/omitted/reordered
   phase cases, interruption and resume, two devices, duplicate finalization,
   account changes, version migration, payload bounds and rollout compatibility.

The alternative is to withhold **new unverified chapter rewards** until the
required finale verifier exists, while preserving existing confirmed balances
and pending progress. That changes reward availability and requires a product
and rollout decision. No new finale reward gate is implemented in this batch.

Further limits remain: deterministic public client models can be automated;
32-bit model seeds have a finite collision/precomputation domain; repeated account
or restart issuance needs abuse/rate controls. Solving those requires a separate
server-checkpoint/admission design. This change does not make a concurrent-user
capacity claim or expand the infrastructure architecture.
