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
`CIPHER_SECRET`, `ADMIN_TG_IDS`. Use secret storage, never the repository.
Missing configuration returns 503. Never replace an existing webhook without
checking its current URL and purpose; merge with another bot implementation if
one already exists. Configure Telegram `setWebhook` with the matching secret token,
then register `COMMANDS` with `setMyCommands`. Test `/start`, legal links and review
with the real bot after activation. Set `privacy.html` in BotFather separately.

Moderation is on demand. This does not implement automatic notifications, creator
video tier approvals, data-deletion automation, or chapter-reminder scheduling.
Creator moderation remains accessible through private operator tooling; admin.html
is excluded from Pages. Hiding a page is not a substitute for server authorization.
