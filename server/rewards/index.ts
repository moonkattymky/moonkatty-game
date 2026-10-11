import {createHandler} from './core.mjs';
// Mutating reward / life APIs. Requires service-role key + Telegram-verified initData.
// Explicitly enable the reviewed lossless save/proof transport in source.
// Rollback must retain the codec reader; never revert to a pre-codec handler.
// GET is a minimal public health probe ({ok,service}); it lists no actions or player data.
Deno.serve(createHandler({url:Deno.env.get('SUPABASE_URL'),key:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),traceTransport:true}));
