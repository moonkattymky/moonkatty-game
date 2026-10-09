import {createBotHandler} from './core.mjs';
import {createHandler} from '../rewards/core.mjs';
const env=(key:string)=>Deno.env.get(key)||'';
Deno.serve(createBotHandler({token:env('TELEGRAM_BOT_TOKEN'),webhookSecret:env('TELEGRAM_WEBHOOK_SECRET'),serviceKey:env('SUPABASE_SERVICE_ROLE_KEY'),adminIds:env('ADMIN_TG_IDS'),rewardsHandler:createHandler({url:env('SUPABASE_URL'),key:env('SUPABASE_SERVICE_ROLE_KEY')})}));
