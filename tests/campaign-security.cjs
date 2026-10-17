/* Real validated UI transcript + real Postgres RPCs; only Telegram identity is mocked. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{PGlite}=require('@electric-sql/pglite');
(async()=>{const db=new PGlite();await db.exec("create role anon;create role authenticated;create role service_role;create function public.rls_auto_enable() returns event_trigger language plpgsql as $$begin end$$;");for(const file of ['server/schema.sql','server/migrations/20261007_social_verify.sql','supabase/migrations/20261007200800_reward_integrity_sessions.sql','supabase/migrations/20261008201825_launch_campaign_integrity.sql','supabase/migrations/20261017120000_security_hardening.sql'])await db.exec(fs.readFileSync(path.join(__dirname,'..',file),'utf8'));
const {createHandler}=await import('../server/rewards/core.mjs'),{validateProof,cleanSnapshot}=await import('../server/rewards/campaign.mjs');const golden=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/chapter1-proof.json')));let clock=new Date('2026-11-01T12:00Z');
const fetcher=async(url,opt={})=>{const u=new URL(url),name=u.pathname.split('/').pop(),b=opt.body?JSON.parse(opt.body):null,m=opt.method||'GET';try{
 if(u.pathname.includes('/rpc/')){const entries=Object.entries(b),rows=(await db.query(`select public.${name}(${entries.map(([k],i)=>k+'=> $'+(i+1)).join(',')}) as r`,entries.map(([,v])=>v&&typeof v==='object'?JSON.stringify(v):v))).rows;return Response.json(rows[0].r);}
 assert(['players','reward_events','referral_events'].includes(name));const values=[],param=v=>{values.push(v);return '$'+values.length;};
 const wh=[...u.searchParams].filter(([k])=>!['select','limit','on_conflict','order'].includes(k)).map(([k,v])=>{assert.match(k,/^[a-z_]+$/);if(v==='is.null')return k+' is null';const [op,...r]=v.split('.');return k+({eq:'=',gte:'>=',gt:'>'}[op]||'=')+param(r.join('.'));}),where=wh.length?' where '+wh.join(' and '):'';let q;
 if(m==='GET')q=`select * from public.${name}${where}`;
 if(m==='PATCH')q=`update public.${name} set ${Object.entries(b).map(([k,v])=>k+'='+param(v)).join(',')}${where} returning *`;
 if(m==='POST'){const e=Object.entries(b);q=`insert into public.${name}(${e.map(x=>x[0]).join(',')}) values(${e.map(x=>param(x[1])).join(',')}) on conflict do nothing returning *`;}
 return Response.json((await db.query(q,values)).rows);
}catch(e){return Response.json({error:e.message},{status:500});}};
// Server-issued challenges (audit 2026-10-17): seeds come from seedSource only. The queue
// lets this test force the recorded golden seed and deliberate cross-account collisions.
const seeds=[];const seedSource=()=>seeds.length?seeds.shift():1000+Math.floor(Math.random()*1e6);
const base={url:'https://db.test',key:'test-key',fetcher,verify:async id=>({id:Number(id)}),clock:()=>clock,seedSource};
const h=createHandler(base),strict=createHandler({...base,legacyRoutes:false});
const call=async(id,action,extra={},handler=h)=>{const r=await handler(new Request('https://api.test',{method:'POST',body:JSON.stringify({initData:String(id),action,...extra})}));return {status:r.status,...await r.json()};};
await call(301,'player');seeds.push(golden.route.seed);
// A client-proposed seed is ignored: the server issues the challenge.
const opened=await call(301,'campaign.open',{life:1,seed:12345,edition:1});assert(opened.ok,JSON.stringify(opened));
assert.equal(opened.route.seed,golden.route.seed);assert.equal(opened.route.edition,2);assert.equal(opened.route.challenge_version,2);assert.equal(opened.route.issued,undefined);clock=new Date(clock.getTime()+600000);const proof={...golden.proof,route:opened.route.route};
assert.equal((await call(301,'life.complete',{life:1})).error,'proof_required');
const forged=structuredClone(proof);forged.tasks[0].state.trace=[];assert.equal((await call(301,'life.complete',{life:1,proof:forged})).error,'proof','terminal flags do not substitute for replayed actions');
const flight=structuredClone(proof);flight.tasks.find(t=>t.id===2).state.trace=[];assert.equal((await call(301,'life.complete',{life:1,proof:flight})).error,'proof','forged successful flight is rejected');
const omitted=structuredClone(proof);omitted.tasks.pop();assert.equal((await call(301,'life.complete',{life:1,proof:omitted})).error,'proof_required');
await call(302,'player');
// Cross-account replay: even if the generator produced 301's seed again, the unique
// (life,seed,edition) index refuses it and the server issues a different seed.
seeds.push(golden.route.seed,golden.route.seed+7);
const other=await call(302,'campaign.open',{life:1,seed:golden.route.seed,edition:2});assert(other.ok,JSON.stringify(other));
assert.notEqual(other.route.route,proof.route);assert.equal(other.route.seed,golden.route.seed+7,'seed collision is retried with a fresh server seed');
assert.equal((await call(302,'life.complete',{life:1,proof})).error,'proof_required','another player cannot reuse a route receipt');
const replayed={...structuredClone(golden.proof),route:other.route.route};
assert.equal((await call(302,'life.complete',{life:1,proof:replayed})).error,'proof','a recorded run of another account does not replay on a different server seed');
// Reset is limited for an unrewarded chapter: the same challenge comes back until 6 h passed.
seeds.push(4242);const early=await call(302,'campaign.open',{life:1,reset:true});
assert.equal(early.route.route,other.route.route);assert.equal(early.route.seed,other.route.seed);assert.equal(early.route.reset_limited,true);assert(early.route.reset_available_at);
seeds.length=0;const plain=await call(302,'campaign.open',{life:1});assert.equal(plain.route.route,other.route.route,'an ordinary open returns the issued route');
// Generator stuck on taken seeds: bounded retries, then a clean failure (no shared route).
await call(303,'player');seeds.push(golden.route.seed,golden.route.seed,golden.route.seed,golden.route.seed);
const stuck=await call(303,'campaign.open',{life:1});assert.equal(stuck.ok,false);assert.equal(stuck.error,'unavailable');
// Routes created before the hardening (challenge_version 1) stay valid by default so
// in-progress players keep their progress; LEGACY_ROUTES=off refuses them.
for(const id of [304,305]){await call(id,'player');await db.query("insert into public.mkty_campaign_routes(telegram_id,life,seed,edition,started_at,challenge_version) values($1,1,$2,2,$3,1)",[id,golden.route.seed,new Date(clock.getTime()-600000).toISOString()]);}
const legacyRoute=async id=>(await db.query('select route from public.mkty_campaign_routes where telegram_id=$1 and life=1',[id])).rows[0].route;
const upgrade=await call(304,'life.complete',{life:1,proof:{...golden.proof,route:await legacyRoute(304)}},strict);assert.equal(upgrade.status,409);assert.equal(upgrade.error,'route_upgrade_required');
const grandfathered=await call(305,'life.complete',{life:1,proof:{...golden.proof,route:await legacyRoute(305)}});assert.equal(grandfathered.player?.moon_points,500,JSON.stringify(grandfathered));
const good=await call(301,'life.complete',{life:1,proof});assert.equal(good.player?.moon_points,500,JSON.stringify(good));assert.equal((await call(301,'life.complete',{life:1})).awarded,false);
// A rewarded chapter may be replayed right away (no further payout is possible).
seeds.push(777001);const replay=await call(301,'campaign.open',{life:1,reset:true});assert.equal(replay.route.seed,777001);assert.notEqual(replay.route.route,proof.route);assert.equal(replay.route.reset_limited,undefined);
// After the reset window an unrewarded chapter gets a fresh challenge.
clock=new Date(clock.getTime()+6*3600e3+1000);seeds.push(888002);const later=await call(302,'campaign.open',{life:1,reset:true});
assert.equal(later.route.seed,888002);assert.notEqual(later.route.route,other.route.route);assert.equal(later.route.reset_limited,undefined);
assert.deepEqual(cleanSnapshot({mkty_points:'9999',mkty_life1:'complete',mkty_life1_memory_code:'1234567890'}),{mkty_life1_memory_code:'1234567890'});
const bad=structuredClone(golden);bad.proof.tasks[2].state.trace=[['tick',1e9,0,0,false,false]];assert.throws(()=>validateProof(bad.route,bad.proof),/proof/);
assert.equal((await call(302,'life.complete',{life:1,proof:'x'.repeat(410000)})).status,413);
await db.close();console.log('PASS: server-issued unique seeds (client seed ignored, collisions retried, reset limited), missing/forged/cross-account proofs and replays rejected, legacy routes grandfathered or refused by flag, actual UI action/physics replay accepted, atomic payout once, bounded input and protected cloud keys');})().catch(e=>{console.error(e);process.exit(1)});
