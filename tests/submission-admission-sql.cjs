/* Exact additive migration on real PostgreSQL SQL/PLpgSQL (PGlite), no live writes.
   Promise.all tests overlapping caller requests; PGlite queues one backend connection.
   This is not a multi-session PostgreSQL lock-contention or load test. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
(async()=>{
 const db=new PGlite();
 const migration='20261009153246_atomic_submission_admission.sql',dir=path.join(__dirname,'../supabase/migrations');
 await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create function public.rls_auto_enable() returns event_trigger language plpgsql as $$begin end$$;");
 await db.exec(fs.readFileSync(path.join(__dirname,'../server/schema.sql'),'utf8'));
 await db.exec(fs.readFileSync(path.join(__dirname,'../server/migrations/20261007_social_verify.sql'),'utf8'));
 for(const file of fs.readdirSync(dir).filter(f=>f.endsWith('.sql')&&f<migration).sort())await db.exec(fs.readFileSync(path.join(dir,file),'utf8'));
 await db.exec('insert into players(telegram_id) select generate_series(1,60)');
 // Historical oversubscription must survive migration unchanged, including rewards.
 await db.exec("insert into creator_submissions(telegram_id,platform,url,url_norm,caption,created_at) values(50,'youtube','legacy1','legacy1','#moonkatty','2026-10-09'),(50,'youtube','legacy2','legacy2','#moonkatty','2026-10-09');insert into social_submissions(telegram_id,platform,kind,proof,proof_norm,code,day,created_at) select 50,'x','daily','legacy'||n,'legacy'||n,'MKTY-TEST','2026-10-10','2026-10-10' from generate_series(1,4) n;insert into reward_events(telegram_id,event_key,event_type,points,verified) values(50,'historical','creator.base',250,true);update players set moon_points=250 where telegram_id=50;");
 const history=async()=>JSON.stringify((await db.query("select (select jsonb_agg(c order by id) from creator_submissions c) creator,(select jsonb_agg(s order by id) from social_submissions s) social,(select jsonb_agg(r order by id) from reward_events r) rewards,(select moon_points from players where telegram_id=50) balance")).rows);
 const before=await history();
 await db.exec(fs.readFileSync(path.join(dir,migration),'utf8'));
 assert.equal(await history(),before,'migration preserves every historical row and balance');
 let now='2026-10-10T12:00:00.000Z';
 const rpc=async(name,b)=>{const entries=Object.entries(b);return (await db.query(`select public.${name}(${entries.map(([k],i)=>`${k}=>$${i+1}`).join(',')}) r`,entries.map(([,v])=>v))).rows[0].r;};
 const creator=(id,n,time=now)=>rpc('mkty_creator_submit',{p_id:id,p_platform:'youtube',p_url:`https://youtu.be/${String(n).padStart(11,'0')}`,p_url_norm:'youtube:'+n,p_caption:'#moonkatty',p_now:time});
 const social=(id,n,platform='x',kind='daily',time=now)=>rpc('mkty_social_submit',{p_id:id,p_platform:platform,p_kind:kind,p_proof:'test:'+n,p_proof_norm:`${platform}:${kind}:${n}`,p_code:'MKTY-TEST',p_now:time});
 const count=async(table,id)=>Number((await db.query(`select count(*) n from ${table} where telegram_id=$1`,[id])).rows[0].n);
 const review=async(entity,id,decision)=>rpc('mkty_review',{p_entity:entity,p_id:id,p_decision:decision,p_kind:'base',p_actor:900,p_points:entity==='creator'?250:5,p_key:entity+':test:'+id,p_type:entity+'.base',p_now:now});
 const oldCreator=(id,n,time=now)=>db.query("insert into creator_submissions(telegram_id,platform,url,url_norm,caption,created_at) values($1,'youtube',$2,$2,'#moonkatty',$3) returning *",[id,'legacy:'+n,time]);
 const oldSocial=(id,n,platform='x',kind='daily',time=now)=>db.query("insert into social_submissions(telegram_id,platform,kind,proof,proof_norm,code,day,created_at) values($1,$2,$3,$4,$4,'MKTY-TEST','1999-01-01',$5) returning *",[id,platform,kind,'legacy:'+n,time]);
 // Distinct canonical inputs racing for the same weekly, daily, follow or pending slot.
 let results=await Promise.all(Array.from({length:20},(_,i)=>creator(1,100+i)));
 assert.equal(results.filter(r=>r.submission).length,1);assert.equal(results.filter(r=>r.error==='weekly').length,19);assert.equal(await count('creator_submissions',1),1);
 const first=results.find(r=>r.submission).submission;
 results=await Promise.all(Array.from({length:20},()=>creator(1,100)));
 assert(results.every(r=>r.duplicate&&r.submission.id===first.id));
 results=await Promise.all(Array.from({length:20},(_,i)=>social(2,200+i)));
 assert.equal(results.filter(r=>r.submission).length,1);assert.equal(results.filter(r=>r.error==='daily_limit').length,19);
 const daily=results.find(r=>r.submission).submission;
 results=await Promise.all(Array.from({length:20},()=>social(2,200)));
 assert(results.every(r=>r.duplicate&&r.submission.id===daily.id));
 results=await Promise.all(Array.from({length:12},(_,i)=>social(3,300+i,'x','follow')));
 assert.equal(results.filter(r=>r.submission).length,1);assert.equal(results.filter(r=>r.error==='already').length,11);
 results=await Promise.all([social(4,400,'x','follow'),social(4,401,'x','daily'),social(4,402,'tiktok','follow'),social(4,403,'tiktok','daily')]);
 assert.equal(results.filter(r=>r.submission).length,3);assert.equal(results.filter(r=>r.error==='pending_limit').length,1);assert.equal(await count('social_submissions',4),3);
 assert.equal((await social(4,400,'x','follow')).duplicate,true,'retry succeeds at pending cap');
 // Other players have independent quotas; global canonical duplicates stay private.
 assert.equal((await creator(5,100)).error,'duplicate_url');assert.equal((await social(5,200)).error,'duplicate_proof');
 assert((await creator(5,500)).submission);assert((await social(5,500)).submission);
 for(const fn of [creator,social]){
  const raced=await Promise.all([fn(30,3000),fn(31,3000)]);
  assert.equal(raced.filter(r=>r.submission).length,1);assert.equal(raced.filter(r=>r.error).length,1);
  assert.equal(raced.find(r=>r.error).submission,undefined,'duplicate response contains no other account data');
 }
 assert.equal((await creator(50,501)).error,'weekly');assert.equal((await social(50,501)).error,'pending_limit');
 // Rejection preserves creator weekly usage, but releases social eligibility.
 await review('creator',first.id,'reject');
 assert.equal((await creator(1,101)).error,'weekly');assert.equal((await creator(1,100)).submission.status,'rejected');
 assert.equal((await creator(1,101,'2026-10-17T12:00:00.000Z')).error,'weekly','inclusive exact seven-day boundary');
 assert((await creator(1,101,'2026-10-17T12:00:00.001Z')).submission);
 await review('social',daily.id,'reject');
 assert.equal((await social(2,200)).submission.status,'rejected');assert.equal((await social(6,200)).error,'duplicate_proof');
 assert((await social(2,201)).submission,'different proof after daily rejection is allowed');
 const follow=(await db.query("select id from social_submissions where telegram_id=3")).rows[0];
 await review('social',follow.id,'reject');assert((await social(3,301,'x','follow')).submission);
 const approved=(await creator(7,700)).submission;await review('creator',approved.id,'approve');
 assert.equal((await creator(7,700)).submission.status,'approved');assert.equal((await creator(7,700)).duplicate,true);
 const followed=(await social(8,800,'x','follow')).submission;await review('social',followed.id,'approve');
 assert.equal((await social(8,801,'x','follow')).error,'already');assert.equal((await social(8,800,'x','follow')).submission.status,'approved');
 // UTC is explicit even with a non-UTC database session and equivalent offset times.
 await db.exec("set time zone 'Pacific/Honolulu'");
 assert.equal((await social(9,900,'x','daily','2026-10-10T23:59:59.999Z')).submission.day,'2026-10-10');
 assert.equal((await social(9,901,'x','daily','2026-10-11T00:00:00.000Z')).submission.day,'2026-10-11');
 assert.equal((await social(9,902,'x','daily','2026-10-10T20:00:00-04:00')).error,'daily_limit');
 assert.equal((await social(9,900,'x','daily','2026-10-11T01:00:00Z')).submission.day,'2026-10-10','retry does not migrate original day');
 await db.exec("set time zone 'UTC'");
 // Both legacy direct inserts and RPCs pass the same guard. Expected direct errors
 // are database errors for older handlers; they remain fail-closed during rollout.
 results=await Promise.allSettled([oldCreator(10,1000),creator(10,1001),oldCreator(10,1002),creator(10,1003)]);
 assert.equal(await count('creator_submissions',10),1);assert(results.some(r=>r.status==='rejected'&&r.reason.message==='weekly'));
 await oldSocial(11,1100);assert.equal((await social(11,1101)).error,'daily_limit');await assert.rejects(()=>oldSocial(11,1102),/daily_limit/);
 const legacy=(await oldSocial(12,1200,'x','follow')).rows[0];assert.equal(legacy.day.toISOString().slice(0,10),'2026-10-10','legacy day is normalized from created_at');
 await assert.rejects(()=>oldSocial(12,1201,'x','follow'),/already/);
 await oldSocial(12,1202,'tiktok','follow');await social(12,1203,'x','daily');await assert.rejects(()=>oldSocial(12,1204,'tiktok','daily'),/pending_limit/);
 // Multi-row legacy INSERT cannot pass every check before adding any row.
 await assert.rejects(()=>db.exec("insert into creator_submissions(telegram_id,platform,url,url_norm,created_at) values(13,'youtube','bulk1','bulk1','2026-10-10'),(13,'youtube','bulk2','bulk2','2026-10-10')"),/weekly/);
 assert.equal(await count('creator_submissions',13),0,'whole failed insert rolls back');
 // Fresh SQL lock state wins over a stale handler player snapshot.
 await db.exec("update players set balance_locked_at=now(),final_balance=moon_points where telegram_id=14");
 assert.equal((await creator(14,1400)).error,'locked');assert.equal((await social(14,1400)).error,'locked');
 await assert.rejects(()=>oldCreator(14,1401),/locked/);await assert.rejects(()=>oldSocial(14,1401),/locked/);
 // Inject a post-admission failure: no half-created rows and retry can succeed.
 await db.exec("create function fail_admission_test() returns trigger language plpgsql as $$begin if new.telegram_id=15 then raise exception 'test outage';end if;return new;end$$;create trigger fail_admission_test after insert on creator_submissions for each row execute function fail_admission_test()");
 await assert.rejects(()=>creator(15,1500),/test outage/);assert.equal(await count('creator_submissions',15),0);
 await db.exec('drop trigger fail_admission_test on creator_submissions');assert((await creator(15,1500)).submission);
 // Unsupported snapshot isolation cannot silently weaken quota checks.
 await db.exec('begin isolation level repeatable read');await assert.rejects(()=>creator(16,1600),/requires read committed/);await db.exec('rollback');
 assert.equal(await count('creator_submissions',16),0);
 // ACLs, SECURITY INVOKER, explicit search path and private RLS are unchanged.
 const functions=['mkty_submission_admission_guard()','mkty_creator_submit(bigint,text,text,text,text,timestamptz)','mkty_social_submit(bigint,text,text,text,text,text,timestamptz)'];
 for(const signature of functions){const r=(await db.query("select has_function_privilege('anon',$1,'EXECUTE') a,has_function_privilege('authenticated',$1,'EXECUTE') b,has_function_privilege('service_role',$1,'EXECUTE') c",['public.'+signature])).rows[0];assert.deepEqual(r,{a:false,b:false,c:true});}
 const security=(await db.query("select proname,prosecdef,provolatile,proconfig from pg_proc where proname in ('mkty_submission_admission_guard','mkty_creator_submit','mkty_social_submit')")).rows;
 assert.equal(security.length,3);for(const f of security){assert.equal(f.prosecdef,false);assert.equal(f.provolatile,'v');assert(f.proconfig.includes('search_path=""'));}
 for(const table of ['creator_submissions','social_submissions']){
  const r=(await db.query("select relrowsecurity from pg_class where oid=$1::regclass",['public.'+table])).rows[0];assert.equal(r.relrowsecurity,true);
  for(const role of ['anon','authenticated']){const p=(await db.query("select has_table_privilege($1,$2,'SELECT,INSERT,UPDATE,DELETE') allowed",[role,'public.'+table])).rows[0];assert.equal(p.allowed,false);}
 }
 await db.exec('set role anon');await assert.rejects(()=>creator(17,1700),/permission denied/);await db.exec('reset role');
 await db.exec('set role authenticated');await assert.rejects(()=>social(17,1700),/permission denied/);await db.exec('reset role');
 await db.exec('set role service_role');assert((await creator(17,1700)).submission);assert((await social(17,1700)).submission);await db.exec('reset role');
 // Production submission modules against SQL, including a committed INSERT whose
 // network response is lost. The server validates before RPC and never falls back
 // to non-atomic table writes or accepts caller-controlled identity/time/status.
 const {createCreator}=await import('../server/rewards/creator.mjs');
 const {createSocial}=await import('../server/rewards/social.mjs');
 let lostReply=false;const calls=[];
 const rest=async(target,opts={})=>{
  calls.push(target);
  if(target.includes('/rpc/')){
   const result=await rpc(target.split('/').pop(),JSON.parse(opts.body));
   if(lostReply){lostReply=false;throw Error('test lost reply');}return result;
  }
  assert.equal(opts.method||'GET','GET','submit must never directly POST a table');
  const table=target.split('/').pop();assert(['creator_submissions','social_submissions','reward_events'].includes(table));
  const rows=(await db.query(`select * from public.${table} where telegram_id=$1 order by created_at desc`,[Number(opts.params.telegram_id.slice(3))])).rows;
  return rows.slice(0,Number(opts.params.limit)||rows.length);
 };
 const creatorApi=createCreator({rest,clock:()=>new Date(now),adminIds:new Set([900])});
 const socialApi=createSocial({rest,clock:()=>new Date(now),isAdmin:u=>u.id===900,secret:'fixture-secret'});
 const body={url:'https://youtu.be/ZZZZZZZZZZZ',caption:'#moonkatty my video',own:true};
 await assert.rejects(()=>creatorApi.submit({telegram_id:18},{...body,own:false}),/own/);
 await assert.rejects(()=>creatorApi.submit({telegram_id:18},{...body,caption:'missing hashtag'}),/hashtag/);
 await assert.rejects(()=>creatorApi.submit({telegram_id:18},{...body,url:'https://example.invalid/video'}),/url/);
 await assert.rejects(()=>socialApi.submit({telegram_id:18},{platform:'x',kind:'daily',proof:'invalid'}),/proof/);
 assert.equal(calls.length,0);
 lostReply=true;await assert.rejects(()=>creatorApi.submit({telegram_id:18},{...body,telegram_id:19,p_now:'2099-01-01',status:'approved'}),/test lost reply/);
 const retried=await creatorApi.submit({telegram_id:18},body);
 assert.equal(retried.duplicate,true);assert.equal(retried.submission.status,'pending');assert.equal(Date.parse(retried.submission.created_at),Date.parse(now));
 assert.equal(await count('creator_submissions',18),1);assert.equal(await count('creator_submissions',19),0);
 const proof={platform:'x',kind:'daily',proof:'https://x.com/fixture/status/900001'};
 lostReply=true;await assert.rejects(()=>socialApi.submit({telegram_id:19},{...proof,day:'2099-01-01',telegram_id:18,status:'approved'}),/test lost reply/);
 const socialRetry=await socialApi.submit({telegram_id:19},proof);
 assert.equal(socialRetry.duplicate,true);assert.equal(socialRetry.submission.status,'pending');assert.equal(socialRetry.submission.day,'2026-10-10');
 assert.equal(await count('social_submissions',19),1);assert.equal(await count('social_submissions',18),0);
 await assert.rejects(()=>creatorApi.submit({telegram_id:14},body),/locked/);
 await assert.rejects(()=>socialApi.submit({telegram_id:14},proof),/locked/);
 // Pending admission never pays: only the explicit reviews above add ledger entries.
 assert.equal(Number((await db.query('select count(*) n from reward_events')).rows[0].n),3);
 assert.equal((await db.query('select moon_points from players where telegram_id=50')).rows[0].moon_points,250);
 assert.equal((await db.query('select count(*)::int n from players where telegram_id not in (7,8,50) and moon_points<>0')).rows[0].n,0);
 console.log('PASS: atomic creator/social SQL admission, overlapping distinct requests/retries, rejected resubmissions, inclusive week/UTC boundaries, cross-account privacy, legacy insert guards, rollback, locked balances and service-only permissions (PGlite single backend)');
 await db.close();
})().catch(e=>{console.error(e);process.exit(1)});
