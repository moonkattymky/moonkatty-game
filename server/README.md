# MOONKATTY backend contract

The client keeps local game progress and cached account data. Confirmed rewards are authorized by the backend after validating Telegram Mini App sign-in or a server-issued game session; local progress is not reward evidence.

Core rules:
- Telegram ID is the player identity.
- 9 global lives; one spent life restores every 12 hours. Every failed board / flight / chapter finale costs 1 life (training and the first LIFE #1 run are free); at 0 lives missions are paused.
- Chapter pacing: after LIFE #N is completed, LIFE #N+1 unlocks at the next 00:00 UTC. `life.complete` for a chapter that is not unlocked yet returns `409 chapter_locked` with `unlock_at`. Completed chapters and completions before `PACING_SINCE` are grandfathered.
- Reward events are idempotent: the same event_key can pay once.
- Invitations are not capped, but inviter payouts are: at most 10 verified referral events per UTC day and 100 overall. The configured daily cap can be lower; the database clamps it to 10.
- Activation and eligible verified activity payouts share those inviter limits. Activity bonuses require the invited player to have completed LIFE #1; the invitee's own activation award is independent of the inviter's cap.
- Self-referrals and duplicate referral events are rejected.
- Completing LIFE #9 atomically records final_balance and balance_locked_at.
- Once balance_locked_at is set, no endpoint may increase that player's Moon Points.
- Daily/community actions must never pay merely because a client button was pressed.
- Moon Points are in-game points with no monetary value. They are not sold or exchanged for money and do not guarantee prizes, payments or property rights. See the published [terms](https://moonkattymky.github.io/moonkatty-game/terms.html).

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
- The public response can contain the player's Telegram display name and profile photo,
  points and completed-chapter count. A player who opts out is shown with a callsign
  and no photo. Telegram IDs are not returned. The display name normally uses the
  Telegram name, with a username fallback if no first or last name is available;
  there is no separate username field in the response.
  Reading standings does not award points; the separate authenticated privacy action
  saves the player's visibility choice. See the published [privacy policy](https://moonkattymky.github.io/moonkatty-game/privacy.html).
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

The deployment and advisor observations from the original 2026-10-05 release are
historical, not a current security assessment. This document update changes no
database policies, configuration or deployed function.


## Rewards / lives Edge Function (current release)

`server/rewards/` is the mutating counterpart to read-only `mission-control`.

Deploy as Edge Function name **`rewards`** with env:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (never commit)
- optional `REFERRAL_DAILY_CAP` (default 10; effective maximum 10 per UTC day and 100 inviter payout events overall)
- `SESSION_SECRET` — independent random value (e.g. `openssl rand -base64 48`) that signs 12-hour game
  sessions; set the **same** value for `rewards`, `telegram-progress`, `mission-control` and `bot`.
  Until it is set, sessions fall back to the service-role key (old behaviour). After it is set, sessions
  signed with the old key are still accepted for the transition; after 12 h set
  `SESSION_LEGACY_FALLBACK=false` to stop accepting them.
- optional `CAMPAIGN_RESET_HOURS` (default 6): minimum time between two new challenges for one chapter.
- optional `LEGACY_ROUTES=off`: stop accepting chapter routes issued before the 2026-10-17 hardening
  (client-chosen seeds). Default: accepted, so in-progress players keep their progress.
- requires migration `supabase/migrations/20261017120000_security_hardening.sql` (RLS on core tables,
  server-issued unique campaign seeds, per-player rate limits, one-time OAuth state). Without it the
  handler still answers, but `campaign.open` fails and rate limits are skipped (fail-open).

Security behaviour (2026-10-17): CORS only for `https://moonkattymky.github.io` (plus localhost for
development); per-player limits — all actions 120/min, proof claims 12/10 min, cloud writes 40/min,
route issue 30/min, submissions 30/10 min — answer `429 {error:"rate_limited",retry_after}`.

Contract (POST JSON, verified Telegram `initData` or a server-issued game session; GET is a public health probe):

| action | purpose |
|--------|---------|
| `player` | upsert/read profile; applies 12h life restore |
| `life.complete` | canonical, idempotent chapter reward; new completions require the account-bound route and verified results of all eight stages |
| `rewards.verify` | rejects client-invented rewards; rewards are issued only through dedicated verified actions |
| `campaign.open` | issue/resume account-bound route challenge; seed hint preserves an existing local route |
| `campaign.cloud` | versioned snapshot load/save with compare-and-swap conflict protection |
| `lives.spend` | idempotent life spend (`event_key`, e.g. `life:fail:c4:board:…`) |
| `chapter.status` | `{next_life, unlock_at, locked, skips}` (also returned as `pace` by `player` / `life.complete`) |
| `chapter.skip` | spend one referral pass (friend completed LIFE #1) to open the next chapter early |
| `referrals.claim` | eligible inviter +1 after invitee LIFE #1, within shared daily/overall caps; rejects self-referral / duplicates |

Rules enforced server-side: initData Ed25519 verify (10 min), unique `(telegram_id, event_key)`, LIFE #9 sets `final_balance` + `balance_locked_at`, no further point increases after lock.

Client: `rewards-client.js` uses per-account storage. Authenticated balances change only after server confirmation; pending operations retry idempotently. Guest play is a local demo. Cloud snapshots exclude wallet and identity keys.

Tests: `node tests/rewards-server.cjs` (no live secrets).

## Daily retention (2026-10-07)

`server/rewards/daily.mjs` (imported by `core.mjs`) adds actions:
`daily.status`, `streak.checkin`, `cipher.solve`, `youtube.redeem`.

- **Login streak**: UTC days, rewards 3/5/7/10/12/15/25 ⭐ (day 7+ capped at 25), reset after a miss;
  one shield per ISO week auto-saves exactly one missed day. Table `login_streaks`; paid once/day via `streak:<day>`.
- **Moon Signal cipher**: lore word chosen per UTC day by HMAC(`CIPHER_SECRET`, day) from the server list;
  clients only get Morse. 5 attempts/day via atomic `cipher_attempt()` RPC (`cipher_attempts` table); +15 ⭐ once via `cipher:<day>`.
- **YouTube code words**: table `youtube_codes` (expiry, active, 1–50 ⭐, server-capped); once per code per player via `yt:<id>`.
  Admin guide: `server/youtube-codes.md`. No codes are seeded.
- Migration: `server/migrations/20261007_daily_retention.sql` (additive, RLS on, no anon access).
- Tests: `node tests/daily-server.cjs`.

## Referrals (2026-10-07)
- Invite link: `https://t.me/<bot>?startapp=ref_<telegram_id>` (bot username in `<meta name="mkty-bot">`, index.html).
- `start_param` is read only from Ed25519-verified initData. `players.referred_by` is set once, only while the invitee has `story_life=0`; self-invites, unknown inviters and A↔B loops are ignored.
- When the invitee's first `life.complete` for LIFE #1 is recorded, the invitee's +200 award (`referral:invitee:life1`) is independent of the inviter's remaining cap. The inviter's eligible +200 award (`referral_events` source `life1`, reward key `referral:<invitee>:life1`) shares the limits below with activity payouts. Locked (LIFE #9) balances are not credited.
- Inviter payouts use `REFERRAL_DAILY_CAP` (default 10, database-clamped to at most 10 per UTC day) and a hard overall limit of 100 payout events. These are event limits, not a promise of 100 rewarded friends. At the cap, another inviter payout is not guaranteed; the friend can still play.
- `referrals.stats` includes `{invited, activated, earned, today, daily_cap, total_cap}`. `referrals.claim` requires the referral to actually be referred by the caller and to have completed LIFE #1.
- Sources: `rewards/core.mjs` (`REFERRAL_DAILY_CAP`, `referralStats`) and `../supabase/migrations/20261009120925_prelaunch_referral_caps.sql` (`mkty_referral`).
- Tests: `node tests/referrals-server.cjs` and `node tests/prelaunch-security.cjs` (synthetic fixtures; not a new production audit).
## Creator rewards (2026-10-07)

Actions on the `rewards` function (`server/rewards/creator.mjs`, table `creator_submissions`, migration `server/migrations/20261007_creator_rewards.sql`):

| action | who | purpose |
|--------|-----|---------|
| `creator.status` | player | own submissions, next allowed time, `is_admin` |
| `creator.submit` | player | `{url, caption, own:true}` → pending; caption must contain `#MOONKATTY`; 1 per rolling 7 days; URL canonicalised (TikTok/YouTube/X/Instagram) and globally unique |
| `admin.creator.list` | admin | `{status}` pending/approved/rejected |
| `admin.creator.review` | admin | `{id, decision:'approve'|'reject'}`; approve pays base points once |
| `admin.creator.tier` | admin | `{id, tier:'1k'|'10k'}`; approved only, each tier once |

Points (server constants): base 250, 1k views +250, 10k views +500; paid via `reward_events` keys `creator:<id>:base|tier_1k|tier_10k` (idempotent), never after balance lock.

Admins: function secret `ADMIN_TG_IDS` (comma-separated Telegram user ids), e.g.
`supabase secrets set ADMIN_TG_IDS=<YOUR_ADMIN_ID> --project-ref lswbmgoeinblzuqzakvi`.
`admin.html` is excluded from GitHub Pages, and the public client no longer links or
redirects to it. Do not use the old `startapp=admin` / More-menu instructions as a
working public review route. Creator moderation requires existing private operator
tooling and server authorization. The separately prepared bot webhook supports
on-demand X/TikTok review, not creator-video tier moderation; see [bot/README.md](bot/README.md).
The presence of that source does not mean the webhook or commands are activated.
Tests: `node tests/creator-server.cjs`.

## Verified social missions (2026-10-07)

Opening a link never pays. `rewards.verify` now rejects `daily.*`, `social.*`, `creator.*` event types (`unverified`).

- `social.telegram.verify` — Bot API `getChatMember(chat_id=@moonkattymkty, user_id)` with `TELEGRAM_BOT_TOKEN`
  (override channel with `TELEGRAM_CHANNEL`). Pays +5 once (`social:telegram:follow`) for
  member/administrator/creator. If the bot can't read members, returns `status:'bot_not_admin'` and pays nothing.
  The bot must be an administrator of the channel (no extra rights needed).
- `social.status` — personal code `MKTY-XXXX` (HMAC of telegram id with `CIPHER_SECRET`), submissions, paid flags.
- `social.submit {platform:x|tiktok, kind:follow|daily, proof}` — pending row in `social_submissions`
  (migration `20261007_social_verify.sql`). follow: once per platform; daily: once per platform per UTC day;
  max 3 pending; each proof once globally.
- `admin.social.list` / `admin.social.review` — ADMIN_TG_IDS only (403 otherwise); approval pays +5
  (`social:<platform>:follow` or `social:<platform>:daily:<day>`), idempotent. Use existing private operator tooling; `admin.html` is not a published Pages route. The prepared bot's `/review` command is available only after its separate activation.
- `social.youtube.verify` — Google OAuth subscription check, disabled until `YOUTUBE_OAUTH_ENABLED=true`
  plus GOOGLE_CLIENT_ID/SECRET, YOUTUBE_CHANNEL_ID, YOUTUBE_REDIRECT_URI. See `youtube-oauth.md`.
Tests: `node tests/social-server.cjs`.

## Launch integrity release

Apply `supabase/migrations/20261008201825_launch_campaign_integrity.sql` before deploying the new rewards engine. It is additive: cloud saves, route challenges, service-role-only RPCs and an atomic YouTube code transaction. Deploy both `rewards` and the `telegram-progress` compatibility wrapper from the same revision. Include `campaign.mjs` and every generated `models/*.mjs` dependency.

The canonical models remain at the repository root. Run `node tools/build-server-models.cjs` after editing them; CI rejects stale generated copies. Campaign validation replays field actions and fixed-step flight physics and solves board predicates server-side. This blocks a bare completion claim or forged terminal flags; it does not claim to distinguish a human from a solver that supplies a valid action history.

Previously confirmed chapter rewards remain valid and idempotent. Old unconfirmed local routes without action histories may require a new route for reward verification; no confirmed achievement or balance is deleted. A legacy local save is adopted into an account namespace only when an existing single-account session identifies its owner. Unattributed guest data stays on the device.

Use `npm test` before publishing. Pages now depends on the reusable full test workflow, stamps `build.json`, then verifies live bytes and APIs. `tools/verify-live.cjs` checks the published SHA and critical files with cache bypass.
