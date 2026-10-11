/* In-process rolling-deployment regression: actual pinned old/current handler modules
 * call actual SQL in disposable PGlite through a deliberately small REST adapter.
 * Barriers schedule stale handler prechecks; PGlite has one connection, so these
 * are NOT evidence of PostgreSQL multi-session locking/concurrency or live auth.
 * No HTTP server, sockets, browser, credentials, network, or deployed database. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {createHash,webcrypto}=require('node:crypto');
const {PGlite}=require('@electric-sql/pglite');
const {prerequisiteFiles,admissionMigration,readSql}=require('./submission-admission-fixture.cjs');
if(!globalThis.crypto)globalThis.crypto=webcrypto;

// Fixtures are byte-for-byte modules from current remote base c80afa046714a51aff64e84084050aace90614b9.
// Git blob IDs include Git's length-prefixed object header; no Git executable is needed.
for(const [file,expected] of [
 ['pre-admission-creator-c80afa0.mjs','edd69de60314b65509ce9063a1ac3b331b26f8d0'],
 ['pre-admission-social-c80afa0.mjs','6d183bcedb1de31d32f050a304493f4c9d483362']
]){
 const bytes=fs.readFileSync(path.join(__dirname,'fixtures',file));
 const actual=createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
 assert.equal(actual,expected,'Pinned old handler changed: '+file);
}

const tables=new Set(['players','creator_submissions','social_submissions','reward_events']);
const rpcNames=new Set(['mkty_creator_submit','mkty_social_submit','mkty_review']);
const identifier=s=>{assert.match(s,/^[a-z][a-z0-9_]*$/);return s;};
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
const secret='synthetic-admission-fixture-only';
const admin={id:900};
let nextPlayer=1000,nextProof=10000000,checks=0;

async function createFixture(modules){
 const db=new PGlite();
 let now=new Date('2026-10-11T12:00:00.000Z'),gate=null;
 const calls=[];
 try{
  // Local roles model Supabase's service role, never a live identity or credential.
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls; create function public.rls_auto_enable() returns event_trigger language plpgsql as $$begin end$$;');
  for(const file of prerequisiteFiles)await db.exec(readSql(file));
 }catch(error){await db.close();throw error;}

 async function setTime(value){
  now=new Date(value);assert.ok(Number.isFinite(now.getTime()));
  // Old handlers omit created_at, so pin the database default as well as handler
  // clock. This preserves their exact request bodies rather than adding fields.
  for(const table of ['creator_submissions','social_submissions'])await db.exec(`alter table public.${table} alter column created_at set default '${now.toISOString()}'::timestamptz`);
 }
 await setTime(now);

 function holdNext(predicate){
  assert.equal(gate,null,'Only one controlled barrier may be active');
  const reached=deferred(),released=deferred();
  gate={predicate,reached,released};
  return {reached:reached.promise,release:()=>released.resolve()};
 }
 async function rest(version,resource,options={}){
  const method=(options.method||'GET').toUpperCase();
  const body=options.body?JSON.parse(options.body):null;
  const call={version,resource,method,body,params:options.params||{}};
  calls.push(call);
  if(gate&&gate.predicate(call)){
   const held=gate;gate=null;held.reached.resolve();await held.released.promise;
  }
  const match=/^\/rest\/v1\/(rpc\/)?([a-z][a-z0-9_]*)$/.exec(resource);
  assert.ok(match,'Unexpected in-process resource: '+resource);
  const name=match[2];
  return db.transaction(async tx=>{
   await tx.exec('set local role service_role');
   if(match[1]){
    assert.equal(method,'POST');assert.ok(rpcNames.has(name));
    const entries=Object.entries(body);
    const args=entries.map(([key],i)=>identifier(key)+'=> $'+(i+1)).join(',');
    return (await tx.query(`select public.${name}(${args}) as result`,entries.map(([,value])=>value))).rows[0].result;
   }
   assert.ok(tables.has(name));
   const values=[],param=value=>{values.push(value);return '$'+values.length;};
   if(method==='POST'){
    // No fallback, upsert, swallowed SQL errors, or handler policy in this adapter.
    const entries=Object.entries(body);
    const sql=`insert into public.${name}(${entries.map(([key])=>identifier(key)).join(',')}) values(${entries.map(([,value])=>param(value)).join(',')}) returning to_jsonb(${name}.*) as row`;
    return (await tx.query(sql,values)).rows.map(row=>row.row);
   }
   assert.equal(method,'GET','Only actual admission/moderation request shapes are supported');
   const params=options.params||{};
   const predicates=Object.entries(params).filter(([key])=>!['select','order','limit'].includes(key)).map(([key,value])=>{
    identifier(key);
    const dot=value.indexOf('.'),op=value.slice(0,dot),operand=value.slice(dot+1);
    if(op==='eq')return key+'='+param(operand);
    if(op==='gte')return key+'>='+param(operand);
    if(op==='like')return key+' like '+param(operand.replaceAll('*','%'));
    if(op==='in'){
     assert.ok(operand.startsWith('(')&&operand.endsWith(')'));
     return key+' in ('+operand.slice(1,-1).split(',').map(param).join(',')+')';
    }
    assert.fail('Unsupported synthetic filter: '+value);
   });
   const columns=!params.select||params.select==='*'?'*':params.select.split(',').map(identifier).join(',');
   let sql=`select ${columns} from public.${name}`;
   if(predicates.length)sql+=' where '+predicates.join(' and ');
   if(params.order){
    const [column,direction]=params.order.split('.');identifier(column);assert.ok(['asc','desc'].includes(direction));
    sql+=' order by '+column+' '+direction;
   }
   if(params.limit){assert.ok(Number.isInteger(params.limit)&&params.limit>0);sql+=' limit '+param(params.limit);}
   // SQL JSON conversion matches PostgREST's date/timestamp/JSON row contract.
   return (await tx.query('select to_jsonb(result) as row from ('+sql+') result',values)).rows.map(row=>row.row);
  });
 }
 const unexpectedReward=()=>assert.fail('Admission must never use a non-atomic payout callback');
 const api={};
 for(const version of ['old','new']){
  const common={rest:(...args)=>rest(version,...args),clock:()=>new Date(now),insertReward:unexpectedReward,applyPoints:unexpectedReward};
  api[version]={
   creator:modules[version].creator.createCreator({...common,adminIds:new Set([admin.id])}),
   social:modules[version].social.createSocial({...common,isAdmin:user=>user?.id===admin.id,secret,botToken:'',channel:'@synthetic_fixture',fetcher:()=>assert.fail('Network fetch is forbidden'),youtube:{enabled:false}})
  };
 }
 async function player(){
  const id=++nextPlayer;
  return (await db.query('insert into public.players(telegram_id) values($1) returning to_jsonb(players.*) as player',[id])).rows[0].player;
 }
 async function count(entity,owner){return (await db.query(`select count(*)::int as n from public.${entity}_submissions where telegram_id=$1`,[owner.telegram_id])).rows[0].n;}
 async function snapshot(owner){
  return (await db.query(`select jsonb_build_object(
   'player',(select to_jsonb(p) from public.players p where telegram_id=$1),
   'creator',(select coalesce(jsonb_agg(to_jsonb(c) order by c.id),'[]') from public.creator_submissions c where telegram_id=$1),
   'social',(select coalesce(jsonb_agg(to_jsonb(s) order by s.id),'[]') from public.social_submissions s where telegram_id=$1),
   'rewards',(select coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]') from public.reward_events r where telegram_id=$1)) as state`,[owner.telegram_id])).rows[0].state;
 }
 return {db,api,calls,setTime,holdNext,player,count,snapshot,clock:()=>new Date(now)};
}

function creatorBody(){return {url:'https://x.com/fixture/status/'+(++nextProof),caption:'Synthetic review #MOONKATTY',own:true};}
function socialBody(platform='x',kind='follow'){
 const id=++nextProof;
 return {platform,kind,proof:kind==='follow'?'@cat'+id:platform==='x'?'https://x.com/fixture/status/'+id:'https://www.tiktok.com/@fixture/video/'+id};
}
const boundaries=[
 {label:'creator weekly',entity:'creator',error:'weekly',body:creatorBody},
 ...['x','tiktok'].flatMap(platform=>[
  {label:platform+' follow',entity:'social',error:'already',body:()=>socialBody(platform,'follow')},
  {label:platform+' daily',entity:'social',error:'daily_limit',body:()=>socialBody(platform,'daily')}
 ]),
 {label:'social pending maximum',entity:'social',error:'pending_limit',seed:()=>[socialBody('x','follow'),socialBody('tiktok','follow')],body:which=>socialBody(which?'tiktok':'x','daily')}
];
async function scenario(fixture,spec){
 const owner=await fixture.player();
 const seeds=spec.seed?spec.seed():[];
 for(const body of seeds)await fixture.api.old[spec.entity].submit(owner,body);
 return {owner,bodies:[spec.body(0),spec.body(1)],initial:seeds.length};
}
const isWrite=(version,entity)=>call=>call.version===version&&call.method==='POST'&&call.resource===(version==='old'?'/rest/v1/'+entity+'_submissions':'/rest/v1/rpc/mkty_'+entity+'_submit');
async function expectError(fn,message){await assert.rejects(fn,{message});checks++;}
async function sequential(fixture,spec,versions){
 const {owner,bodies,initial}=await scenario(fixture,spec);
 await fixture.api[versions[0]][spec.entity].submit(owner,bodies[0]);
 await expectError(()=>fixture.api[versions[1]][spec.entity].submit(owner,bodies[1]),spec.error);
 assert.equal(await fixture.count(spec.entity,owner),initial+1,spec.label+' '+versions.join('/'));
 assert.equal((await fixture.snapshot(owner)).rewards.length,0);checks++;
}
async function scheduledOverlap(fixture,spec,versions,migrated){
 const {owner,bodies,initial}=await scenario(fixture,spec);
 const barrier=fixture.holdNext(isWrite(versions[0],spec.entity));
 // Catch immediately, avoiding an unhandled rejection while the other request runs.
 const first=fixture.api[versions[0]][spec.entity].submit(owner,bodies[0]).then(value=>({value}),error=>({error}));
 try{
  await Promise.race([barrier.reached,first.then(result=>{
   assert.fail(spec.label+' completed before the controlled admission barrier: '+(result.error?.message||'unexpected success'));
  })]);
  await fixture.api[versions[1]][spec.entity].submit(owner,bodies[1]);
 }finally{barrier.release();}
 const result=await first;
 if(migrated){assert.equal(result.error?.message,spec.error,spec.label+' '+versions.join('/')+' stale admission fails closed');assert.equal(result.value,undefined);}
 else{assert.ok(result.value,spec.label+' baseline positive control must expose stale-precheck gap');assert.equal(result.error,undefined);}
 assert.equal(await fixture.count(spec.entity,owner),initial+(migrated?1:2));
 assert.equal((await fixture.snapshot(owner)).rewards.length,0);checks++;
}

(async()=>{
 const modules={
  old:{creator:await import('./fixtures/pre-admission-creator-c80afa0.mjs'),social:await import('./fixtures/pre-admission-social-c80afa0.mjs')},
  new:{creator:await import('../server/rewards/creator.mjs'),social:await import('../server/rewards/social.mjs')}
 };
 const f=await createFixture(modules);
 try{
  // Before migration, the pinned old code works sequentially at every boundary;
  // deterministic stale-precheck positive controls demonstrate the original gap.
  for(const spec of boundaries){await sequential(f,spec,['old','old']);await scheduledOverlap(f,spec,['old','old'],false);}

  // New server first is unsupported: missing RPC must propagate, never insert via
  // old table paths. Check existing submissions/balance/ledger remain byte-equivalent.
  const existing=await f.player();
  await f.api.old.creator.submit(existing,creatorBody());
  await f.api.old.social.submit(existing,socialBody());
  const beforeMissing=await f.snapshot(existing);
  for(const [entity,body] of [['creator',creatorBody()],['social',socialBody('tiktok')]]){
   const start=f.calls.length;
   await assert.rejects(()=>f.api.new[entity].submit(existing,body),error=>error.code==='42883'&&error.message.includes('mkty_'+entity+'_submit'));
   const requests=f.calls.slice(start);
   assert.equal(requests.length,1);assert.ok(isWrite('new',entity)(requests[0]));
   assert.equal(requests.filter(call=>call.method==='POST'&&!call.resource.includes('/rpc/')).length,0);
   assert.deepEqual(await f.snapshot(existing),beforeMissing);checks++;
  }

  // Apply the exact additive migration to the SAME database with old rows intact.
  await f.db.exec(readSql(admissionMigration));
  assert.deepEqual(await f.snapshot(existing),beforeMissing,'Migration preserves preexisting submissions and ledger');checks++;
  for(const entity of ['creator','social']){
   const row=beforeMissing[entity][0];
   const body=entity==='creator'?{url:row.url,caption:'#moonkatty',own:true}:{platform:row.platform,kind:row.kind,proof:row.proof};
   const retried=await f.api.new[entity].submit(existing,body);
   assert.equal(retried.duplicate,true);assert.equal(retried.submission.id,row.id);
  }
  assert.deepEqual(await f.snapshot(existing),beforeMissing);checks++;

  // Old-only and both rolling-deployment orders remain bounded. Each scheduled
  // overlap pauses an actual handler immediately before its direct insert/RPC.
  // Old-first has already consumed stale quota reads, exercising the insert guard.
  for(const spec of boundaries){
   for(const versions of [['old','old'],['old','new'],['new','old'],['new','new']]){
    await sequential(f,spec,versions);
    await scheduledOverlap(f,spec,versions,true);
   }
  }

  // Inclusive rolling week and UTC day transitions are shared by old/new code.
  for(const first of ['old','new'])for(const second of ['old','new']){
   const owner=await f.player(),start='2026-10-11T12:00:00.000Z';
   await f.setTime(start);await f.api[first].creator.submit(owner,creatorBody());
   await f.setTime('2026-10-18T12:00:00.000Z');
   await expectError(()=>f.api[second].creator.submit(owner,creatorBody()),'weekly');
   await f.setTime('2026-10-18T12:00:00.001Z');
   await f.api[second].creator.submit(owner,creatorBody());
   assert.equal(await f.count('creator',owner),2);checks++;
   for(const platform of ['x','tiktok']){
    const dailyOwner=await f.player();
    await f.setTime('2026-10-11T23:59:59.999Z');
    await f.api[first].social.submit(dailyOwner,socialBody(platform,'daily'));
    await expectError(()=>f.api[second].social.submit(dailyOwner,socialBody(platform,'daily')),'daily_limit');
    await f.setTime('2026-10-12T00:00:00.000Z');
    await f.api[second].social.submit(dailyOwner,socialBody(platform,'daily'));
    assert.deepEqual((await f.snapshot(dailyOwner)).social.map(row=>row.day),['2026-10-11','2026-10-12']);checks++;
   }
  }
  await f.setTime('2026-10-11T12:00:00.000Z');

  // Actual moderation SQL, not synthetic reward callbacks, prepares all statuses.
  // Retry returns the original row through quota/review states, never a new payout.
  for(const entity of ['creator','social'])for(const status of ['pending','approved','rejected']){
   const owner=await f.player(),body=entity==='creator'?creatorBody():socialBody('x','daily');
   const first=await f.api.new[entity].submit(owner,body);
   assert.equal(first.duplicate,false);
   if(status!=='pending')await f.api.new[entity].adminReview(admin,{id:first.submission.id,decision:status==='approved'?'approve':'reject'});
   const before=await f.snapshot(owner),reward=entity==='creator'?250:5;
   assert.equal(before.player.moon_points,status==='approved'?reward:0);
   assert.equal(before.rewards.length,status==='approved'?1:0);
   const canonicalAlias=entity==='creator'
    ?{...body,url:body.url.replace('https://x.com/','https://twitter.com/')+'?source=retry',caption:'Changed retry caption #MOONKATTY'}
    :{...body,proof:body.proof.replace('https://x.com/','https://twitter.com/')};
   const retries=await Promise.all(Array.from({length:4},(_,index)=>f.api.new[entity].submit(owner,index%2?canonicalAlias:body)));
   for(const retry of retries){assert.equal(retry.duplicate,true);assert.equal(retry.submission.id,first.submission.id);assert.equal(retry.submission.status,status);}
   assert.deepEqual(await f.snapshot(owner),before);checks++;
   await f.setTime('2026-10-20T12:00:00.000Z');
   assert.equal((await f.api.new[entity].submit(owner,canonicalAlias)).duplicate,true);
   assert.deepEqual(await f.snapshot(owner),before,'Late same-owner retry preserves the original submission and payout');
   await f.setTime('2026-10-11T12:00:00.000Z');checks++;
   // Global proof/URL ownership remains private even after approval/rejection.
   const outsider=await f.player(),outsiderBefore=await f.snapshot(outsider);
   await expectError(()=>f.api.new[entity].submit(outsider,body),entity==='creator'?'duplicate_url':'duplicate_proof');
   assert.deepEqual(await f.snapshot(outsider),outsiderBefore);
   if(status==='pending'){
    const approved=await f.api.new[entity].adminReview(admin,{id:first.submission.id,decision:'approve'});
    assert.equal(approved.reward.points,reward);
    const paid=await f.snapshot(owner);
    await expectError(()=>f.api.new[entity].adminReview(admin,{id:first.submission.id,decision:'approve'}),'reviewed');
    assert.equal((await f.api.new[entity].submit(owner,body)).duplicate,true);
    assert.deepEqual(await f.snapshot(owner),paid);checks++;
   }else await expectError(()=>f.api.new[entity].adminReview(admin,{id:first.submission.id,decision:'approve'}),'reviewed');
  }

  // Retrying the same social proof remains safe at the full pending quota, and
  // doesn't reopen review even on a later UTC day (proof uniqueness is global).
  const full=await f.player(),original=socialBody('x','follow');
  await f.api.new.social.submit(full,original);
  await f.api.new.social.submit(full,socialBody('tiktok','follow'));
  await f.api.new.social.submit(full,socialBody('x','daily'));
  const fullBefore=await f.snapshot(full);
  assert.equal((await f.api.new.social.submit(full,original)).duplicate,true);
  await f.setTime('2026-10-20T12:00:00.000Z');
  assert.equal((await f.api.new.social.submit(full,original)).duplicate,true);
  assert.deepEqual(await f.snapshot(full),fullBefore);checks++;

  // Authentication is an explicit injected player boundary here. Body IDs/code/
  // day/status/points cannot choose another owner, mint points, or bypass review.
  // This does not test real Telegram verification, JWTs, gateway auth, or RLS clients.
  for(const version of ['old','new'])for(const entity of ['creator','social']){
   const owner=await f.player(),victim=await f.player();
   const body={...(entity==='creator'?creatorBody():socialBody()),telegram_id:victim.telegram_id,p_id:victim.telegram_id,user:{id:victim.telegram_id},code:'FORGED',day:'1900-01-01',status:'approved',points:999999};
   const start=f.calls.length;
   await f.api[version][entity].submit(owner,body);
   const write=f.calls.slice(start).find(isWrite(version,entity));
   assert.equal(version==='new'?write.body.p_id:write.body.telegram_id,owner.telegram_id);
   const saved=await f.snapshot(owner),row=saved[entity][0];
   assert.equal(row.telegram_id,owner.telegram_id);assert.equal(row.status,'pending');assert.equal(row.points,0);
   assert.equal(saved.player.moon_points,0);assert.equal(saved.rewards.length,0);
   assert.equal(await f.count(entity,victim),0);
   if(entity==='social'){
    assert.equal(row.code,await modules.new.social.playerCode(owner.telegram_id,secret));
    assert.equal(row.day,f.clock().toISOString().slice(0,10));
   }
   // A stale unlocked player object cannot bypass the database balance lock.
   const locked=await f.player();
   await f.db.query('update public.players set balance_locked_at=$2 where telegram_id=$1',[locked.telegram_id,f.clock().toISOString()]);
   await expectError(()=>f.api[version][entity].submit(locked,entity==='creator'?creatorBody():socialBody()),'locked');
   assert.equal(await f.count(entity,locked),0);checks++;
  }
  assert.equal(f.calls.some(call=>!call.resource.startsWith('/rest/v1/')),false);
  console.log(`PASS: ${checks} admission compatibility checks; pinned old/current handlers, missing-migration no-fallback, mixed-version quotas, synthetic stale-read schedules, reviewed retry payout/identity isolation. PGlite is single-connection; no live auth/network or PostgreSQL multi-session concurrency certification.`);
 }finally{await f.db.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
