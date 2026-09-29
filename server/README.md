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
