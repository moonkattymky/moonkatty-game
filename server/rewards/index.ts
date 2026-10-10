import {createHandler} from './core.mjs';
// Mutating reward / life APIs. Requires service-role key + Telegram-verified initData.
// Compact writes are opt-in only after every deployed reader supports decoding.
// GET is a minimal public health probe ({ok,service}); it lists no actions or player data.
Deno.serve(createHandler({url:Deno.env.get('SUPABASE_URL'),key:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),traceTransport:Deno.env.get('MKTY_TRACE_TRANSPORT_V1')==='on'}));
