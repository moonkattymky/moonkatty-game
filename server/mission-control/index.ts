import {createHandler} from './core.mjs';
// GET exposes only anonymised standings. POST verifies Telegram's Ed25519 signature
// before including a personal rank. This endpoint performs no database mutations.
Deno.serve(createHandler({url:Deno.env.get('SUPABASE_URL'),key:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}));
