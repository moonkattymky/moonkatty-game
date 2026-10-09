/* Real replay fixture and Postgres/WASM. Only Telegram identity is mocked. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{PGlite}=require('@electric-sql/pglite');
(async()=>{
 const db=new PGlite();
 await db.exec('create role anon;create role authenticated;create role service_role;create function public.rls_auto_enable() returns event_trigger language plpgsql as $$begin end$$;');
 for(const file of ['server/schema.sql','server/migrations/20261007_social_verify.sql',...fs.readdirSync(path.join(__dirname,'../supabase/migrations')).sort().map(f=>'supabase/migrations/'+f)])await db.exec(fs.readFileSync(path.join(__dirname,'..',file),'utf8'));
 const {createHandler}=await import('../server/rewards/core.mjs'),{validateProof}=await import('../server/rewards/campaign.mjs');
 const {default:Codec}=await import('../server/rewards/models/trace-codec.mjs');
 const golden=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/chapter1-proof.json')));
 let clock=new Date('2026-11-02T12:00Z'),calls=[];
 const query=async(sql,args=[])=>(await db.query(sql,args)).rows;
 const fetcher=async(url,opt={})=>{
  const u=new URL(url),name=u.pathname.split('/').pop(),body=opt.body?JSON.parse(opt.body):null,method=opt.method||'GET';
  try{
   if(u.pathname.includes('/rpc/')){
    calls.push({name,body});const entries=Object.entries(body);
    const rows=await query(`select public.${name}(${entries.map(([k],i)=>k+'=> $'+(i+1)).join(',')}) as r`,entries.map(([,v])=>v&&typeof v==='object'?JSON.stringify(v):v));
    return Response.json(rows[0].r);
   }
   assert(['players','reward_events','referral_events'].includes(name));
   const values=[],param=value=>{values.push(value);return '$'+values.length;};
   const filters=[...u.searchParams].filter(([k])=>!['select','limit','on_conflict','order'].includes(k)).map(([k,v])=>{
    assert.match(k,/^[a-z_]+$/);if(v==='is.null')return k+' is null';
    const [operator,...rest]=v.split('.');return k+({eq:'=',gte:'>=',gt:'>'}[operator]||'=')+param(rest.join('.'));
   }),where=filters.length?' where '+filters.join(' and '):'';let sql;
   if(method==='GET')sql=`select * from public.${name}${where}`;
   if(method==='PATCH')sql=`update public.${name} set ${Object.entries(body).map(([k,v])=>k+'='+param(v)).join(',')}${where} returning *`;
   if(method==='POST'){const entries=Object.entries(body);sql=`insert into public.${name}(${entries.map(([k])=>k).join(',')}) values(${entries.map(([,v])=>param(v)).join(',')}) on conflict do nothing returning *`;}
   return Response.json(await query(sql,values));
  }catch(e){return Response.json({error:e.message},{status:500});}
 };
 const handler=createHandler({url:'https://db.test',key:'test-key',fetcher,verify:async id=>({id:Number(id)}),clock:()=>clock});
 const call=async(id,action,extra={})=>{
  const response=await handler(new Request('https://api.test',{method:'POST',body:JSON.stringify({initData:String(id),action,...extra})}));
  return {status:response.status,...await response.json()};
 };
 const v2=(id,action,extra={})=>call(id,action+'.v2',{protocol:Codec.PROTOCOL,...extra});
 const saved=async id=>(await query('select * from mkty_cloud_saves where telegram_id=$1',[id]))[0];
 const player=await call(801,'player');assert.equal(player.capabilities.trace_codec,Codec.PROTOCOL);
 const session=await call(801,'session');assert.equal(session.capabilities.trace_codec,Codec.PROTOCOL);
 const tokenRequest=await handler(new Request('https://api.test',{method:'POST',body:JSON.stringify({session:session.session.token,action:'player'})}));
 assert.equal((await tokenRequest.json()).capabilities.trace_codec,Codec.PROTOCOL,'signed sessions advertise the same capability');
 const callCount=calls.length;
 for(const action of ['campaign.cloud.v2','life.complete.v2'])for(const protocol of [undefined,'mkty-trace-v99']){
  const rejected=await call(999,action,{protocol,life:1,revision:0,snapshot:{mkty_current_chapter:'9'}});
  assert.equal(rejected.error,'protocol');assert.equal(rejected.status,400);assert.equal(rejected.protocol,Codec.PROTOCOL);
 }
 assert.equal(calls.length,callCount,'bad protocol is rejected before any RPC');
 assert.equal((await query('select count(*)::int n from players where telegram_id=999'))[0].n,0);
 const empty=await v2(801,'campaign.cloud');assert.equal(empty.protocol,Codec.PROTOCOL);assert.equal(empty.revision,0);assert.deepEqual(empty.snapshot,{});

 const longTrace=Array.from({length:18000},()=>['tick',1,0,0]);
 const raw={mkty_story_plan_1_v1:JSON.stringify({seed:123,state:{trace:longTrace},note:'保留 🐈',nested:{evidence:['keep',0,false]}}),mkty_operations_1_v1:'{old arbitrary saved string',mkty_life1_memory_code:'001234',mkty_current_chapter:'1'};
 assert(Codec.utf8Bytes(raw.mkty_story_plan_1_v1)>180000,'fixture exceeds the old uncompressed entry cap');
 const first=await v2(801,'campaign.cloud',{revision:0,snapshot:{...raw,mkty_points:'999999'}});
 assert.equal(first.ok,true,JSON.stringify(first));assert.equal(first.revision,1);assert.equal(first.protocol,Codec.PROTOCOL);
 const stored=await saved(801);assert.deepEqual(stored.snapshot,Codec.packSnapshot(raw));assert(!('mkty_points' in stored.snapshot));
 assert(Codec.utf8Bytes(stored.snapshot.mkty_story_plan_1_v1)<180000);
 assert((await query('select octet_length(snapshot::text) bytes from mkty_cloud_saves where telegram_id=801'))[0].bytes<500000,'unchanged SQL cap fits compact saves');
 const legacyRead=await call(801,'campaign.cloud');assert.equal(legacyRead.protocol,undefined);assert.deepEqual(legacyRead.snapshot,raw,'legacy clients receive complete raw evidence');
 const compactRead=await v2(801,'campaign.cloud');assert.deepEqual(compactRead.snapshot,stored.snapshot);assert.equal(compactRead.protocol,Codec.PROTOCOL);
 const compactConflict=await v2(801,'campaign.cloud',{revision:0,snapshot:{mkty_current_chapter:'2'}});
 assert.equal(compactConflict.conflict,true);assert.equal(compactConflict.revision,1);assert.equal(compactConflict.protocol,Codec.PROTOCOL);assert.deepEqual(compactConflict.snapshot,stored.snapshot);
 const legacyConflict=await call(801,'campaign.cloud',{revision:0,snapshot:{mkty_current_chapter:'2'}});
 assert.equal(legacyConflict.conflict,true);assert.deepEqual(legacyConflict.snapshot,raw);
 assert.deepEqual(await saved(801),stored,'CAS conflicts do not mutate revision, data or timestamps');
 const prefixTail={...raw,mkty_story_plan_1_v1:JSON.stringify({...JSON.parse(raw.mkty_story_plan_1_v1),state:{trace:[...Codec.packTrace(longTrace.slice(0,-3)),...longTrace.slice(-3)]}})};
 assert.equal(JSON.parse(prefixTail.mkty_story_plan_1_v1).state.trace[0][0],'mkty-trace');
 const appended=await v2(803,'campaign.cloud',{revision:0,snapshot:prefixTail});assert.equal(appended.revision,1);
 assert.deepEqual((await saved(803)).snapshot,Codec.packSnapshot(raw),'packed prefix plus raw tail is canonicalized losslessly');
 assert.deepEqual((await call(803,'campaign.cloud')).snapshot,raw);
 // Both transport versions can resume old arbitrary values without interpreting them as JSON evidence.
 const oldWrite=await call(801,'campaign.cloud',{revision:1,snapshot:{mkty_operations_1_v1:'not JSON: keep exactly',mkty_life1_memory_code:'000005'}});
 assert.equal(oldWrite.revision,2);assert.deepEqual((await v2(801,'campaign.cloud')).snapshot,{mkty_operations_1_v1:'not JSON: keep exactly',mkty_life1_memory_code:'000005'});
 const baseline=await saved(801);
 const invalids=[
  [{mkty_story_plan_1_v1:JSON.stringify({trace:[['mkty-trace',999,1,1,'AAAA']]})},'snapshot_transport_invalid',400],
  [{mkty_story_plan_1_v1:'x'.repeat(180000)},'snapshot_too_large',413],
  [{mkty_story_plan_1_v1:'é'.repeat(90000)},'snapshot_too_large',413],
  [{mkty_story_plan_1_v1:'"'.repeat(179999)},'snapshot_too_large',413],
  [{mkty_current_chapter:2},'snapshot',400]
 ];
 for(const [snapshot,error,status] of invalids){
  const before=calls.filter(x=>x.name==='mkty_cloud').length;
  const rejected=await v2(801,'campaign.cloud',{revision:2,snapshot});assert.equal(rejected.error,error,JSON.stringify(rejected));assert.equal(rejected.status,status);assert.equal(rejected.protocol,Codec.PROTOCOL);
  assert.equal(calls.filter(x=>x.name==='mkty_cloud').length,before,'invalid transformations never reach CAS');assert.deepEqual(await saved(801),baseline);
 }
 await call(804,'player');
 await query('insert into mkty_cloud_saves(telegram_id,revision,snapshot) values(804,7,$1)',[JSON.stringify(raw)]);
 const preUpgrade=await saved(804);
 assert.deepEqual((await v2(804,'campaign.cloud')).snapshot,Codec.packSnapshot(raw),'old raw database snapshots can be downloaded through v2');
 assert.deepEqual((await call(804,'campaign.cloud')).snapshot,raw);assert.deepEqual(await saved(804),preUpgrade,'reads never silently rewrite an old save');
 const corrupt={mkty_story_plan_1_v1:JSON.stringify({trace:[['mkty-trace',99,1,1,'AAAA']]})};
 await query('update mkty_cloud_saves set snapshot=$1 where telegram_id=804',[JSON.stringify(corrupt)]);
 const corrupted=await saved(804);
 for(const result of [await call(804,'campaign.cloud'),await v2(804,'campaign.cloud')]){
  assert.equal(result.status,400);assert.equal(result.error,'snapshot_transport_invalid');assert.equal(result.snapshot,undefined,'malformed saved evidence never becomes an acknowledged empty snapshot');
 }
 assert.deepEqual(await saved(804),corrupted);

 // Seed the known real action transcript only in this isolated fixture database.
 const opened=await call(801,'campaign.open',{life:1});assert.equal(opened.route.challenge_version,2);
 await query('update mkty_campaign_routes set seed=$1 where telegram_id=801 and life=1',[golden.route.seed]);
 const second=await call(802,'campaign.open',{life:1});
 const legacyOpened=await call(803,'campaign.open',{life:1});
 await query('update mkty_campaign_routes set seed=$1 where telegram_id=803 and life=1',[golden.route.seed]);
 clock=new Date(clock.getTime()+600000);
 const proof={...structuredClone(golden.proof),route:opened.route.route},packedProof=Codec.packProof(proof);
 const flightTrace=proof.tasks.find(t=>t.id===2).state.trace;
 packedProof.tasks.find(t=>t.id===2).state.trace=[...Codec.packTrace(flightTrace.slice(0,-3)),...flightTrace.slice(-3)];
 assert.equal(packedProof.tasks.find(t=>t.id===2).state.trace[0][0],'mkty-trace');
 assert.deepEqual(Codec.unpackProof(packedProof),proof);
 assert.equal(validateProof({...golden.route,challenge_version:2,route:opened.route.route},packedProof),true,'actual field/flight replay accepts packed fixture');
 const missing=await v2(801,'life.complete',{life:1});assert.equal(missing.error,'proof_required');assert.equal(missing.protocol,Codec.PROTOCOL);
 const forged=structuredClone(packedProof);forged.tasks[0].state.trace=Codec.packTrace([]);
 const forgedResult=await v2(801,'life.complete',{life:1,proof:forged});assert.equal(forgedResult.error,'proof');assert.equal(forgedResult.protocol,Codec.PROTOCOL);
 const noFlight=structuredClone(packedProof);noFlight.tasks.find(t=>t.id===2).state.trace=Codec.packTrace([]);
 assert.equal((await call(801,'life.complete',{life:1,proof:noFlight})).error,'proof','legacy transport is not a trust shortcut');
 assert.equal((await v2(802,'life.complete',{life:1,proof:packedProof})).error,'proof_required','packed receipts remain account-bound');
 const rebound={...packedProof,route:second.route.route};assert.equal((await v2(802,'life.complete',{life:1,proof:rebound})).error,'proof','rewriting UUID cannot rebind another challenge');
 const malformed=structuredClone(packedProof);malformed.tasks[0].state.trace=[['mkty-trace',999,1,1,'AAAA']];
 assert.equal((await v2(801,'life.complete',{life:1,proof:malformed})).error,'proof_transport_invalid');
 const verbose=Array.from({length:19000},()=>['tick',1,0,0,false,false]);
 const compressed=Codec.packTrace(verbose),overBudget=structuredClone(packedProof);
 overBudget.tasks[0].state.trace=compressed;overBudget.tasks[2].state.trace=compressed;
 const oversized=await v2(801,'life.complete',{life:1,proof:overBudget});assert.equal(oversized.status,413,JSON.stringify(oversized));assert.equal(oversized.error,'proof_too_large');
 assert.equal((await query('select moon_points from players where telegram_id=801'))[0].moon_points,0);
 assert.equal((await query('select verified_at from mkty_campaign_routes where telegram_id=801 and life=1'))[0].verified_at,null,'rejected transport never verifies a route');
 const paid=await v2(801,'life.complete',{life:1,proof:packedProof});assert.equal(paid.status,200,JSON.stringify(paid));assert.equal(paid.player.moon_points,500);assert.equal(paid.awarded,true);assert.equal(paid.protocol,Codec.PROTOCOL);
 const retry=await call(801,'life.complete',{life:1});assert.equal(retry.awarded,false);assert.equal(retry.player.moon_points,500);
 const retryV2=await v2(801,'life.complete',{life:1});assert.equal(retryV2.awarded,false);assert.equal(retryV2.protocol,Codec.PROTOCOL);
 const legacyPaid=await call(803,'life.complete',{life:1,proof:{...packedProof,route:legacyOpened.route.route}});
 assert.equal(legacyPaid.player?.moon_points,500,JSON.stringify(legacyPaid));assert.equal(legacyPaid.protocol,undefined);
 // A pre-verified route still supports a lost-response retry without a proof.
 await query('update mkty_campaign_routes set verified_at=$1 where telegram_id=802 and life=1',[clock.toISOString()]);
 assert.equal((await v2(802,'life.complete',{life:1})).awarded,true);
 await db.close();
 console.log('PASS: compact cloud CAS/storage, legacy expanded reads/conflicts, protocol negotiation, unchanged invalid saves, real packed proof replay, account isolation and idempotent rewards');
})().catch(e=>{console.error(e);process.exitCode=1;});
