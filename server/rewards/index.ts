import {createHandler} from './core.mjs';
// Mutating reward / life APIs. Requires service-role key + Telegram-verified initData.
// This release is decoder-only, independent of existing environment settings.
// Compact-write activation requires a separately reviewed source release.
// GET is a minimal public health probe ({ok,service}); it lists no actions or player data.
Deno.serve(createHandler({url:Deno.env.get('SUPABASE_URL'),key:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),traceTransport:false}));
