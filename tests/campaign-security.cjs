/* Real validated UI transcript + real Postgres RPCs; only Telegram identity is mocked. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{PGlite}=require('@electric-sql/pglite');
(async()=>{const db=new PGlite();await db.exec("create role anon;create role authenticated;create role service_role;create function public.rls_auto_enable() returns event_trigger language plpgsql as $$begin end$$;");for(const file of ['server/schema.sql','server/migrations/20261007_social_verify.sql','supabase/migrations/20261007200800_reward_integrity_sessions.sql','supabase/migrations/20261008201825_launch_campaign_integrity.sql'])await db.exec(fs.readFileSync(path.join(__dirname,'..',file),'utf8'));
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
await call(301,'player');const opened=await call(301,'campaign.open',{life:1,seed:golden.route.seed,edition:2});assert(opened.ok);clock=new Date(clock.getTime()+600000);const proof={...golden.proof,route:opened.route.route};
assert.equal((await call(301,'life.complete',{life:1})).error,'proof_required');
const forged=structuredClone(proof);forged.tasks[0].state.trace=[];assert.equal((await call(301,'life.complete',{life:1,proof:forged})).error,'proof','terminal flags do not substitute for replayed actions');
const flight=structuredClone(proof);flight.tasks.find(t=>t.id===2).state.trace=[];assert.equal((await call(301,'life.complete',{life:1,proof:flight})).error,'proof','forged successful flight is rejected');
const omitted=structuredClone(proof);omitted.tasks.pop();assert.equal((await call(301,'life.complete',{life:1,proof:omitted})).error,'proof_required');
await call(302,'player');const other=await call(302,'campaign.open',{life:1,seed:golden.route.seed,edition:2});assert.notEqual(other.route.route,proof.route);assert.equal((await call(302,'life.complete',{life:1,proof})).error,'proof_required','another player cannot reuse a route receipt');
const good=await call(301,'life.complete',{life:1,proof});assert.equal(good.player?.moon_points,500,JSON.stringify(good));assert.equal((await call(301,'life.complete',{life:1})).awarded,false);
assert.deepEqual(cleanSnapshot({mkty_points:'9999',mkty_life1:'complete',mkty_life1_memory_code:'1234567890'}),{mkty_life1_memory_code:'1234567890'});
const savedCloud=await call(302,'campaign.cloud',{revision:0,snapshot:{mkty_life1_memory_code:'1234567890'}});assert.equal(savedCloud.revision,1);
const rejectedCloud=await call(302,'campaign.cloud',{revision:1,snapshot:{mkty_story_plan_1_v1:'x'.repeat(180000),mkty_current_chapter:'1'}});assert.equal(rejectedCloud.status,413);assert.equal(rejectedCloud.error,'snapshot_too_large');
const unchangedCloud=await call(302,'campaign.cloud');assert.equal(unchangedCloud.revision,1);assert.deepEqual(unchangedCloud.snapshot,{mkty_life1_memory_code:'1234567890'},'rejected oversized upload never replaces the previous cloud save');
const bad=structuredClone(golden);bad.proof.tasks[2].state.trace=[['tick',1e9,0,0,false,false]];assert.throws(()=>validateProof(bad.route,bad.proof),/proof/);
assert.equal((await call(302,'life.complete',{life:1,proof:'x'.repeat(410000)})).status,413);
await db.close();console.log('PASS: missing/forged/cross-account proofs rejected, actual UI action/physics replay accepted, atomic payout once, bounded input and protected cloud keys');})().catch(e=>{console.error(e);process.exit(1)});
