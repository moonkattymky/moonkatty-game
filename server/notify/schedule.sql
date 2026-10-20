-- Scheduled job for the notification sender. NOT applied by the migrations: run it only when activating
-- notifications (see README.md). Uses pg_cron + pg_net and two Vault secrets so no key is stored in the job text.
--   select vault.create_secret('<project url>/functions/v1/notify','mkty_notify_url');
--   select vault.create_secret('<random value, same as NOTIFY_CRON_SECRET>','mkty_notify_cron_secret');
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule('mkty-notify-every-5-min','*/5 * * * *',$$
 select net.http_post(
  url:=(select decrypted_secret from vault.decrypted_secrets where name='mkty_notify_url'),
  headers:=jsonb_build_object('Content-Type','application/json','x-mkty-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='mkty_notify_cron_secret')),
  body:='{}'::jsonb,timeout_milliseconds:=20000);
$$);
-- Stop: select cron.unschedule('mkty-notify-every-5-min');
