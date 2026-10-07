import {createHandler} from './core.mjs';
// GET: public standings (verified Telegram name/photo, or callsign for hidden players).
// POST verifies Telegram's Ed25519 signature, refreshes the caller's display_name/photo_url,
// optionally sets leaderboard_hidden ({action:'privacy',hidden}), and adds the personal rank.
Deno.serve(createHandler({url:Deno.env.get('SUPABASE_URL'),key:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}));
