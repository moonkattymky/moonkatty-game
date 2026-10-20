// MOONKATTY notification sender (scheduled). OFF unless NOTIFY_SENDER_ENABLED=1. Not deployed yet — see README.md.
import {createNotifySender} from './core.mjs';
const env=(k:string)=>Deno.env.get(k)||'';
Deno.serve(createNotifySender({enabled:env('NOTIFY_SENDER_ENABLED')==='1',token:env('TELEGRAM_BOT_TOKEN'),cronSecret:env('NOTIFY_CRON_SECRET'),url:env('SUPABASE_URL'),key:env('SUPABASE_SERVICE_ROLE_KEY')}));
