# Robot / storage notifications (built, sender OFF)

What exists and is live (additive, in the `rewards` function + migration `20261020120000_world_social.sql`):
- In the game (Telegram only, robots panel): **«🔔 Telegram-уведомления»** toggle. Turning it on calls
  `Telegram.WebApp.requestWriteAccess()`; only if the user allows it, `world.notify.optin {on:true}` is stored.
- While opted in, the game reports the next robot return / storage-full time (`world.notify.schedule`); the queue
  keeps one pending ping per kind per player (bounded to 48 h ahead). Opt-out deletes pending pings.
- Throttling (in `mkty_notify_due`): ≥ 3 h between pings of one kind, ≤ 3 pings per player per UTC day,
  opted-in only; a 403 from Telegram (bot blocked) opts the player out.

What is NOT active: the sender function `notify` (this folder) is not deployed, `schedule.sql` is not applied,
and no message is ever sent. The `bot` webhook function is a separate thing and also not deployed.

## To activate (operator, needs the real bot token; never commit or paste it)
1. The bot must be able to message users: they grant it via requestWriteAccess (done in-game) — no webhook needed for
   sending, but `/start` replies need the `bot` webhook (see `server/bot/README.md`).
2. Secrets (Dashboard → Edge Functions → Secrets): `TELEGRAM_BOT_TOKEN` (real token of @MoonKattyGameBot),
   `NOTIFY_CRON_SECRET` (new random value), `NOTIFY_SENDER_ENABLED=1`. `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are automatic.
3. Deploy: `supabase functions deploy notify --no-verify-jwt` (files `server/notify/index.ts`, `core.mjs`).
4. Vault secrets + `schedule.sql` (pg_cron every 5 min). Test with one opted-in tester account first.
Stop: `select cron.unschedule('mkty-notify-every-5-min');` and/or set `NOTIFY_SENDER_ENABLED=0` (function then returns `enabled:false`).
