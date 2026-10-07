# Release integrity fixes — 7 October 2026

Baseline: `3d5ddb67fc946eb1405b0cb17be7737c439092c8`.

## Why this release

The reward API trusted client amounts, lacked strict chapter ordering, and recorded
ledger events separately from balances. Network failures could lose points while the
client displayed success. A ten-minute Telegram launch-proof expiry interrupted
normal chapter-length sessions. Initial navigation loaded every translation pack.

## Changes

- No public arbitrary-points verification. Rewards follow dedicated verified actions.
- Service-role-only, SECURITY INVOKER PostgreSQL functions atomically update rewards,
  chapter progression, final lock, lives, referrals, daily cipher/check-in and moderation payouts.
- Serialised row locks, canonical event keys, bounded referral caps and verified source
  events. Existing recorded legacy chapters never pay under a second namespace.
- Old `telegram-progress` URL delegates to the same reward engine.
- Fresh Telegram proof exchanges for a signed 12-hour application session. It cannot
  renew without another fresh Telegram launch. Sessions are domain-separated HMACs,
  not service keys. A rejected session is cleared; raw launch data is not logged.
- Telegram completion remains locally playable during a network failure, with a
  visible pending state. Confirmed balances never receive optimistic points. Pending
  completion/spend requests retry on reconnection, reload or explicit tap.
- Guests retain local demo play. Server-unavailable daily tasks cannot award demo points
  to authenticated players.
- One generated locale bundle loads for the chosen language. Language changes do not
  interrupt an already opened mission. All original 13 choices remain available.
- Home background uses existing artwork rather than eagerly downloading a video;
  cinematics remain in their chapters. Reactor/asteroid art loads on demand.
- Compact help is checked through the pause dialog; test clock setup no longer tries
  to pause in the past. CI adds pinned dependencies, SQL integrity and browser smoke tests.

## Preserved rules and data

Chapter reward amounts, one-chapter-per-UTC-day pacing, referral passes, nine lives,
12-hour life restoration and the final reward freeze remain unchanged. Existing balances
and achievements are not recomputed or reset. The freeze is a deliberate product rule;
changing its incentives requires a separate product decision.

Migration: `supabase/migrations/20261007200800_reward_integrity_sessions.sql`.
Apply migration before deploying the function bundles. Rollback must not restore the
old arbitrary-points API. No new hosting provider or paid service was introduced.

## Verification

`npm ci --ignore-scripts`; `npx playwright install chromium`; `npm test`.
Use `CHROMIUM_PATH` for an existing Chromium binary.

- `integrity-sql.cjs`: exact migration executed on PGlite/Postgres; 40 concurrent
  distinct events, 20 duplicate requests, injected database rollback, sequential
  chapter completion, daily gates, final lock, lives, referrals, cipher final-attempt
  rollback, moderation payout rollback, execution privileges, expired/tampered sessions.
- `rewards-client-ui.cjs`: 401/503, no optimistic credit, pending banner, retry,
  reload, session reuse and completion deduplication.
- Full campaign, variants, layouts, controls, saved-state and language tests.
- Live verification must compare published bytes with this release and probe the
  deployed reward/leaderboard APIs, rather than relying only on green Actions.

Live database smoke used a transaction rolled back in full. Five real player records
were preserved; immediately after migration balances and reward ledger both totalled
2071. Subsequent legitimate gameplay may change those totals.

## Limits of the release claim

This fixes the reproduced integrity and playability defects; it is not a claim of
9/10 market readiness. Chapter ordering and point amounts are server-enforced, but
the server does not independently replay every client movement. Do not treat this as
proof of bot-resistant skill or eligibility for monetary/token payouts. Such payouts
are outside this release.

Physical iOS/Android Telegram WebViews, real cohort retention, acquisition costs and
human completion-time distributions still require external/pilot testing. Lab frame
and network measurements are not physical-device benchmarks. No fabricated retention
or revenue data is provided.
