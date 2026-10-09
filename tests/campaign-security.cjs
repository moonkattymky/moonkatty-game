/* Real validated UI transcript + real Postgres RPCs; only Telegram identity is mocked. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{PGlite}=require('@electric-sql/pglite');
(async()=>{const db=new PGlite();await db.exec("create role anon;create role authenticated;create role service_role;create function public.rls_auto_enable() returns event_trigger language plpgsql as $$begin end$$;");for(const file of ['server/schema.sql','server/migrations/20261007_social_verify.sql','supabase/migrations/20261007200800_reward_integrity_sessions.sql','supabase/migrations/20261008201825_launch_campaign_integrity.sql','supabase/migrations/20261009151834_trusted_campaign_routes.sql'])await db.exec(fs.readFileSync(path.join(__dirname,'..',file),'utf8'));
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
const h=createHandler({url:'https://db.test',key:'test-key',fetcher,verify:async id=>({id:Number(id)}),clock:()=>clock});
const call=async(id,action,extra={})=>{const r=await h(new Request('https://api.test',{method:'POST',body:JSON.stringify({initData:String(id),action,...extra})}));return {status:r.status,...await r.json()};};
await call(301,'player');const opened=await call(301,'campaign.open',{life:1,seed:golden.route.seed,edition:2});assert(opened.ok);assert.equal(opened.route.challenge_version,2);assert.equal(opened.route.edition,2);assert.notEqual(Number(opened.route.seed),golden.route.seed,'caller seed is ignored');
// Install the recorded UI fixture seed only in the isolated test database. Production
// provides no seed override; this keeps the positive model replay test deterministic.
await db.query('update public.mkty_campaign_routes set seed=$1 where telegram_id=301 and life=1',[golden.route.seed]);clock=new Date(clock.getTime()+600000);const proof={...golden.proof,route:opened.route.route};
assert.equal((await call(301,'life.complete',{life:1})).error,'proof_required');
const forged=structuredClone(proof);forged.tasks[0].state.trace=[];assert.equal((await call(301,'life.complete',{life:1,proof:forged})).error,'proof','terminal flags do not substitute for replayed actions');
const flight=structuredClone(proof);flight.tasks.find(t=>t.id===2).state.trace=[];assert.equal((await call(301,'life.complete',{life:1,proof:flight})).error,'proof','forged successful flight is rejected');
const omitted=structuredClone(proof);omitted.tasks.pop();assert.equal((await call(301,'life.complete',{life:1,proof:omitted})).error,'proof_required');
await call(302,'player');const other=await call(302,'campaign.open',{life:1,seed:golden.route.seed,edition:2});assert.notEqual(other.route.route,proof.route);assert.notEqual(other.route.seed,opened.route.seed,'identical requested seeds receive independent challenges');assert.equal((await call(302,'life.complete',{life:1,proof})).error,'proof_required','another player cannot reuse a route receipt');
clock=new Date(clock.getTime()+120000);const rebound={...proof,route:other.route.route};assert.equal((await call(302,'life.complete',{life:1,proof:rebound})).error,'proof','changing the UUID cannot rebind a valid transcript to another issued challenge');
const good=await call(301,'life.complete',{life:1,proof});assert.equal(good.player?.moon_points,500,JSON.stringify(good));assert.equal((await call(301,'life.complete',{life:1})).awarded,false);
assert.deepEqual(cleanSnapshot({mkty_points:'9999',mkty_life1:'complete',mkty_life1_memory_code:'1234567890'}),{mkty_life1_memory_code:'1234567890'});
const savedCloud=await call(302,'campaign.cloud',{revision:0,snapshot:{mkty_life1_memory_code:'1234567890'}});assert.equal(savedCloud.revision,1);
const rejectedCloud=await call(302,'campaign.cloud',{revision:1,snapshot:{mkty_story_plan_1_v1:'x'.repeat(180000),mkty_current_chapter:'1'}});assert.equal(rejectedCloud.status,413);assert.equal(rejectedCloud.error,'snapshot_too_large');
const unchangedCloud=await call(302,'campaign.cloud');assert.equal(unchangedCloud.revision,1);assert.deepEqual(unchangedCloud.snapshot,{mkty_life1_memory_code:'1234567890'},'rejected oversized upload never replaces the previous cloud save');
const bad=structuredClone(golden);bad.route.challenge_version=2;bad.proof.tasks[2].state.trace=[['tick',1e9,0,0,false,false]];assert.throws(()=>validateProof(bad.route,bad.proof),/proof/);
assert.equal((await call(302,'life.complete',{life:1,proof:'x'.repeat(410000)})).status,413);
// Legacy routes retain their original data and cannot authorize new payout,
// including an old verified_at timestamp. Already confirmed rewards remain retries.
await call(303,'player');await db.query("insert into public.mkty_campaign_routes(telegram_id,life,seed,edition,verified_at) values(303,1,123,2,$1)",[clock.toISOString()]);
const legacy=await call(303,'campaign.open',{life:1,seed:555,edition:1});assert.equal(legacy.route.seed,123);assert.equal(legacy.route.challenge_version,1);
clock=new Date(clock.getTime()+120000);assert.equal((await call(303,'life.complete',{life:1,proof})).error,'route_upgrade_required');
const reset=await call(303,'campaign.open',{life:1,seed:123,edition:1,reset:true,previous_route:legacy.route.route});assert.equal(reset.route.challenge_version,2);assert.equal(reset.route.edition,2);assert.notEqual(reset.route.seed,123);
assert.equal((await call(303,'campaign.open',{life:1,reset:true,previous_route:legacy.route.route})).route.route,reset.route.route,'lost response retry does not reset twice');
const history=(await db.query('select * from public.mkty_campaign_route_history where route=$1',[legacy.route.route])).rows[0];assert.equal(history.seed,123);assert.equal(history.challenge_version,1);
// Simulate the exact verify/reset/payout interleaving under real SQL.
await db.query('select public.mkty_campaign_verified(303,1,$1)',[reset.route.route]);
const replaced=await call(303,'campaign.open',{life:1,reset:true,previous_route:reset.route.route});
const stale=(await db.query("select public.mkty_reward(303,'life:1:complete','life.complete',500,$1,$2) as r",[JSON.stringify({route:reset.route.route}),clock.toISOString()])).rows[0].r;assert.equal(stale.error,'proof_required');
assert.equal((await db.query('select moon_points from public.players where telegram_id=303')).rows[0].moon_points,0);
assert.equal((await db.query('select public.mkty_campaign_verified(303,1,$1) as r',[reset.route.route])).rows[0].r.error,'proof');
for(const signature of ['mkty_campaign_restart(bigint,integer,uuid,timestamptz)','mkty_campaign_route(bigint,integer,bigint,integer,boolean,timestamptz)','mkty_campaign_verified(bigint,integer,uuid,timestamptz)','mkty_reward(bigint,text,text,integer,jsonb,timestamptz)'])for(const role of ['anon','authenticated'])assert.equal((await db.query("select has_function_privilege($1,$2,'execute') as allowed",[role,'public.'+signature])).rows[0].allowed,false);
await db.close();console.log('PASS: missing/forged/cross-account proofs rejected, actual UI action/physics replay accepted, atomic payout once, bounded input and protected cloud keys');})().catch(e=>{console.error(e);process.exit(1)});
