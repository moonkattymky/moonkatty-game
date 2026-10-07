# MOONKATTY backend contract

The browser/localStorage is UI cache only. Real rewards must be authorized by a backend after validating Telegram Mini App initData.

Core rules:
- Telegram ID is the player identity.
- 9 global lives; one spent life restores every 12 hours.
- Reward events are idempotent: the same event_key can pay once.
- Referral count is unlimited. Eligible verified referral mission/video events can pay the inviter +1 Moon Point.
- Referral reward emission has a configurable daily cap. Initial product setting is 40/day; keep this server-side and changeable.
- Self-referrals and duplicate referral events are rejected.
- Completing LIFE #9 atomically records final_balance and balance_locked_at.
- Once balance_locked_at is set, no endpoint may increase that player's Moon Points.
- Daily/community actions must never pay merely because a client button was pressed.
- Future MKTY distribution must use the locked server balance and the official launch distribution rules; there is no fixed conversion rate in this contract.

Suggested API:
POST /api/auth/telegram
GET  /api/player
POST /api/life/complete
POST /api/rewards/verify
POST /api/referrals/claim
POST /api/lives/spend

Security:
Validate Telegram initData server-side, rate-limit writes, keep secrets outside the repository, and maintain an auditable reward-event ledger.

## Mission control standings (2026-10-05)

`server/mission-control/index.ts` is deployed as the `mission-control` Edge Function.

- `GET /functions/v1/mission-control` returns up to 50 scored server profiles,
  ordered by Moon Points and completed chapters; equal results share a rank.
- `POST` with `{ "initData": "..." }` additionally returns the current player's
  position after checking Telegram's Ed25519 signature and a ten-minute expiry.
- The public response contains HMAC-derived callsigns, points and chapter counts.
  It excludes Telegram IDs, first names and usernames. No writes are performed.
- The gateway JWT check is disabled because public standings are readable without
  login and the optional personal view has custom Telegram signature validation.
  The service-role credential exists only in the function environment.
- These are existing server profile scores. This release does not upload local
  campaign scores, mint reward events, or implement referral payouts. Local route
  records and daily training results are labelled separately in the interface.
- Authentication and authorisation paths, response privacy, ties, HTTP methods,
  failure states, and read-only database requests are covered by
  `node tests/mission-control-server.cjs`. The deployed endpoint was checked for
  successful public responses and rejection of a forged Telegram signature.

No database policies or schema were changed. Existing RLS remains enabled on all
three game tables. The advisor still reports the pre-existing public execute
privilege on `rls_auto_enable()`; this release does not use that function. See
[Supabase's SECURITY DEFINER guidance](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).


## Rewards / lives Edge Function (2026-10-07)

`server/rewards/` is the mutating counterpart to read-only `mission-control`.

Deploy as Edge Function name **`rewards`** with env:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (never commit)
- optional `REFERRAL_DAILY_CAP` (default 40)

Contract (POST JSON, Telegram `initData` required except GET probe):

| action | purpose |
|--------|---------|
| `player` | upsert/read profile; applies 12h life restore |
| `life.complete` | idempotent chapter reward via `event_key` (default `life:N:complete`) |
| `rewards.verify` | generic verified reward ledger insert + points |
| `lives.spend` | idempotent life spend (`event_key`) |
| `referrals.claim` | inviter +1 with daily cap; rejects self-referral / duplicates |

Rules enforced server-side: initData Ed25519 verify (10 min), unique `(telegram_id, event_key)`, LIFE #9 sets `final_balance` + `balance_locked_at`, no further point increases after lock.

Client: `rewards-client.js` treats `localStorage` as cache. Without deploy / without Telegram initData the game keeps provisional local awards (unchanged UX).

Tests: `node tests/rewards-server.cjs` (no live secrets).

## Overnight note (2026-10-07)

Rewards Edge Function was **not** deployed: no `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` available in the agent environment. Client daily missions prepare a `rewards.verify` payload and stay in DEMO local-claim mode until the owner deploys.

## Daily retention (2026-10-07)

`server/rewards/daily.mjs` (imported by `core.mjs`) adds actions:
`daily.status`, `streak.checkin`, `cipher.solve`, `youtube.redeem`.

- **Login streak**: UTC days, rewards 3/5/7/10/12/15/25 ⭐ (day 7+ capped at 25), reset after a miss;
  one shield per ISO week auto-saves exactly one missed day. Table `login_streaks`; paid once/day via `streak:<day>`.
- **Moon Signal cipher**: lore word chosen per UTC day by HMAC(`CIPHER_SECRET`, day) from the server list;
  clients only get Morse. 5 attempts/day via atomic `cipher_attempt()` RPC (`cipher_attempts` table); +15 ⭐ once via `cipher:<day>`.
- **YouTube code words**: table `youtube_codes` (expiry, active, 1–50 ⭐, server-capped); once per code per player via `yt:<id>`.
  Admin guide: `server/youtube-codes.md`. Seed `MOONTEST` is a TEST code.
- Migration: `server/migrations/20261007_daily_retention.sql` (additive, RLS on, no anon access).
- Tests: `node tests/daily-server.cjs`.

## Referrals (2026-10-07)
- Invite link: `https://t.me/<bot>?startapp=ref_<telegram_id>` (bot username in `<meta name="mkty-bot">`, index.html).
- `start_param` is read only from Ed25519-verified initData. `players.referred_by` is set once, only while the invitee has `story_life=0`; self-invites, unknown inviters and A↔B loops are ignored.
- When the invitee's first `life.complete` for LIFE #1 is recorded, the invitee gets +200 (`referral:invitee:life1`) and the inviter +200 (`referral_events` source `life1`, reward key `referral:<invitee>:life1`). Inviter payouts share the `REFERRAL_DAILY_CAP` (rows/day, default 40); locked (LIFE #9) balances are not credited.
- `referrals.stats` → `{invited, activated, earned, today, daily_cap}`. `referrals.claim` now requires the referral to actually be referred by the caller.
- Tests: `node tests/referrals-server.cjs`.
