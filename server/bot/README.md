# First-game bot

This is a webhook implementation for `@MoonKattyGameBot`, not an activated bot.
It responds only to incoming private messages and verified Telegram callbacks.
Commands: `/start`, `/terms`, `/privacy`, `/review` (allowlisted moderators only).
`/review` sends at most 10 pending X/TikTok submission cards per request. Callback
decisions use the same authenticated rewards handler and atomic review RPC as the
existing admin UI. Duplicate decisions never issue another reward.

Deploy `index.ts`, `core.mjs`, and the complete `../rewards/` dependency graph as a
Supabase Edge Function with JWT verification disabled, because authentication is
the `X-Telegram-Bot-Api-Secret-Token` webhook header, not a Supabase JWT. Do not
activate until the client legal pages and referral migration are published.

Required environment variables: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`
(independent random secret), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`SESSION_SECRET` (same value as the rewards function), `CIPHER_SECRET`, `ADMIN_TG_IDS`. Use secret storage, never the repository.
Missing configuration returns 503. Never replace an existing webhook without
checking its current URL and purpose; merge with another bot implementation if
one already exists. Configure Telegram `setWebhook` with the matching secret token,
then register `COMMANDS` with `setMyCommands`. Test `/start`, legal links and review
with the real bot after activation. Set `privacy.html` in BotFather separately.

Moderation is on demand. This does not implement automatic notifications, creator
video tier approvals, data-deletion automation, or chapter-reminder scheduling.
Creator moderation remains accessible through private operator tooling; admin.html
is excluded from Pages. Hiding a page is not a substitute for server authorization.

## Why the bot does not answer `/start` (2026-10-14 audit)

The `/start` handler with the web_app **«Играть»** button already exists in `core.mjs` (covered by
`tests/bot-server.cjs`). The bot is silent because this function has not been deployed and no
webhook points at it. Activation checklist (operator, with the real token; never commit it):

1. Deploy: `supabase functions deploy bot --no-verify-jwt` (bundle `server/bot` + `server/rewards`).
2. Set secrets (Dashboard → Edge Functions → Secrets, or `supabase secrets set ...`):
   `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `ADMIN_TG_IDS`, `CIPHER_SECRET`, `SESSION_SECRET`
   (same value as the rewards function). `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided
   by the platform automatically.
3. Dry run, then apply with the activation helper below (secrets come from `tools/bot/.env`, never argv):
   `node tools/bot/activate-bot.mjs` → `node tools/bot/activate-bot.mjs --apply`.
   The script shows the current webhook first and refuses to replace a different one without `--replace`.
4. Send `/start` to @MoonKattyGameBot and check the «Играть» button opens the game.

## Activation helper (`tools/bot/activate-bot.mjs`)

Run only on the operator's own machine, never in CI. Secrets are **not** accepted as
command-line arguments (they would remain in shell history and the process list):

```sh
cp tools/bot/.env.example tools/bot/.env   # fill in; the file is ignored by git
chmod 600 tools/bot/.env
node tools/bot/activate-bot.mjs            # dry run: current webhook + planned calls
node tools/bot/activate-bot.mjs --apply    # setWebhook (with secret_token), commands, menu button
```

Alternatives: `--secrets-file=/path/to/file`, or leave values out and type them at the
hidden prompt (input is not echoed). The dry run masks the webhook secret; errors never
print the token. `--apply` refuses to overwrite a different existing webhook unless
`--replace` is given.
