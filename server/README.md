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
