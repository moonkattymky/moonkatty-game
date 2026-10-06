import {createHandler} from './core.mjs';
// Mutating reward / life APIs. Requires service-role key + Telegram-verified initData.
// GET is a public contract probe only (no player data).
Deno.serve(createHandler({url:Deno.env.get('SUPABASE_URL'),key:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}));
