#!/usr/bin/env node
/* Real PostgreSQL, exactly two independent writer sessions. Never a load test.
   Invocation and disposable-service safety: docs/POSTGRES_ADMISSION_CONTENTION.md. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {setTimeout:delay}=require('node:timers/promises');
const {PsqlSession,fixtureEnvironment}=require('./psql-session.cjs');
const migration='20261009153246_atomic_submission_admission.sql';
const root=path.join(__dirname,'../..');
const now='2026-10-10T12:00:00.000Z';
const literal=value=>"'"+String(value).replaceAll("'","''")+"'";

function fixtureSql(){
 const dir=path.join(root,'supabase/migrations');
 const files=['server/schema.sql','server/migrations/20261007_social_verify.sql',
  ...fs.readdirSync(dir).filter(f=>f.endsWith('.sql')&&f<=migration).sort().map(f=>'supabase/migrations/'+f)];
 return `CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger LANGUAGE plpgsql AS $$BEGIN END$$;
 ${files.map(file=>fs.readFileSync(path.join(root,file),'utf8')).join('\n')}
 INSERT INTO public.players(telegram_id) SELECT generate_series(1,100);`;
}

function bootstrapSql(){
 return `BEGIN;
 DO $$BEGIN
  IF current_database()<>'moonkatty_admission_test' THEN RAISE EXCEPTION 'wrong fixture database'; END IF;
  IF EXISTS(SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema')
   OR EXISTS(SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema')
   OR EXISTS(SELECT FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema')
  THEN RAISE EXCEPTION 'fixture database must be empty; recreate the disposable service'; END IF;
 END$$;
 ${fixtureSql()}
 COMMIT;`;
}

function writer(entity,id,key,{legacy=false,platform='x',kind='daily'}={}){
 const common={entity,id,key,legacy,platform,kind};
 let sql;
 if(entity==='creator'){
  sql=legacy
   ?`INSERT INTO public.creator_submissions(telegram_id,platform,url,url_norm,caption,created_at) VALUES(${id},'youtube',${literal('https://example.invalid/'+key)},${literal(key)},'#moonkatty',${literal(now)}) RETURNING jsonb_build_object('submission',to_jsonb(creator_submissions),'duplicate',false);`
   :`SELECT public.mkty_creator_submit(${id},'youtube',${literal('https://example.invalid/'+key)},${literal(key)},'#moonkatty',${literal(now)});`;
 }else{
  sql=legacy
   ?`INSERT INTO public.social_submissions(telegram_id,platform,kind,proof,proof_norm,code,day,created_at) VALUES(${id},${literal(platform)},${literal(kind)},${literal('fixture:'+key)},${literal(key)},'MKTY-TEST','1999-01-01',${literal(now)}) RETURNING jsonb_build_object('submission',to_jsonb(social_submissions),'duplicate',false);`
   :`SELECT public.mkty_social_submit(${id},${literal(platform)},${literal(kind)},${literal('fixture:'+key)},${literal(key)},'MKTY-TEST',${literal(now)});`;
 }
 return {...common,sql};
}

function scenarios(){
 const result=[];let id=0;
 const quotas=[['creator','weekly',{}],['social','daily_limit',{}],['social','already',{kind:'follow'}],['social','pending_limit',{platform:'tiktok',kind:'follow'}]];
 for(const [entity,error,options] of quotas){
  for(const [firstLegacy,secondLegacy] of [[false,false],[true,false],[false,true]]){
   for(const release of ['COMMIT','ROLLBACK']){
    const player=++id,key=`${entity}-${player}`;
    result.push({name:`${error}: ${firstLegacy?'INSERT':'RPC'} -> ${secondLegacy?'INSERT':'RPC'} ${release}`,release,error,mode:'quota',
     first:writer(entity,player,key+'-a',{...options,legacy:firstLegacy}),
     second:writer(entity,player,key+'-b',{...options,legacy:secondLegacy}),
     seeds:error==='pending_limit'?[writer('social',player,key+'-seed-follow',{kind:'follow'}),writer('social',player,key+'-seed-daily')]:[]});
   }
  }
 }
 for(const entity of ['creator','social']){
  for(const mode of ['retry','private']){
   for(const release of ['COMMIT','ROLLBACK']){
    const firstId=++id,secondId=mode==='private'?++id:firstId,key=`${entity}-${mode}-${firstId}`;
    result.push({name:`${entity} ${mode} duplicate ${release}`,mode,release,seeds:[],
     error:entity==='creator'?'duplicate_url':'duplicate_proof',
     first:writer(entity,firstId,key),second:writer(entity,secondId,key)});
   }
  }
 }
 return result;
}

function one(result){
 assert.equal(result.sqlstate,'00000',result.message);
 assert.equal(result.lines.length,1,`expected one JSON result: ${result.lines.join('\n')}`);
 return JSON.parse(result.lines[0]);
}
function admitted(result,request){
 assert(result.submission,JSON.stringify(result));assert.equal(result.duplicate,false);
 assert.equal(result.submission.telegram_id,request.id);
 assert.equal(result.submission.status,'pending');assert.equal(result.submission.points,0);
 assert.equal(result.submission[request.entity==='creator'?'url_norm':'proof_norm'],request.key);
 assert.equal(Date.parse(result.submission.created_at),Date.parse(now));
 if(request.entity==='social')assert.equal(result.submission.day,'2026-10-10');
}

function observeSql(pid){
 return `SELECT pg_stat_clear_snapshot();
 SELECT jsonb_build_object('pid',a.pid,'state',a.state,'wait_type',a.wait_event_type,'wait_event',a.wait_event,
  'blockers',pg_blocking_pids(a.pid),'query',a.query,'transaction_open',a.xact_start IS NOT NULL,
  'waiting_locks',(SELECT coalesce(jsonb_agg(jsonb_build_object('type',l.locktype,'mode',l.mode)), '[]'::jsonb) FROM pg_locks l WHERE l.pid=a.pid AND NOT l.granted),
  'holder_player_lock',EXISTS(SELECT FROM pg_locks l WHERE l.pid=pg_backend_pid() AND l.relation='public.players'::regclass AND l.mode='RowShareLock' AND l.granted))
 FROM pg_stat_activity a WHERE a.pid=${pid};`;
}

async function proveWait(holder,contender,pidA,pidB,pending,label,playerLock){
 const deadline=Date.now()+8000;let observed;
 while(Date.now()<deadline){
  if(pending.done)throw Error(`${label}: contender completed before an observed lock wait; ${JSON.stringify(pending.result)}`);
  observed=one(await holder.query(observeSql(pidB)));
  if(observed.state==='active'&&observed.wait_type==='Lock'&&observed.blockers.includes(pidA)&&observed.waiting_locks.length){
   assert(observed.transaction_open);
   assert(observed.query.includes(contender.sql.trim()),'waiting statement is the intended writer');
   if(playerLock)assert(observed.holder_player_lock,'holder must own the player relation lock');
   assert.equal(pending.done,false,'contender must still be blocked before release');
   console.log(`WAIT ${label}: backend ${pidB} blocked by ${pidA}; ${observed.wait_event}; ${JSON.stringify(observed.waiting_locks)}`);
   return;
  }
  await delay(25);
 }
 throw Error(`${label}: no PostgreSQL lock wait observed: ${JSON.stringify(observed)}`);
}

async function runCase(a,b,pidA,pidB,test){
 for(const seed of test.seeds)admitted(one(await b.query(seed.sql)),seed);
 await a.query('BEGIN ISOLATION LEVEL READ COMMITTED; SET LOCAL ROLE service_role;');
 assert.equal(one(await a.query('SELECT to_jsonb(current_user);')),'service_role');
 const first=one(await a.query(test.first.sql));admitted(first,test.first);
 // The holder also observes server state: no third polling connection is needed.
 await a.query('RESET ROLE;');
 const pending={done:false};
 const completed=b.query(test.second.sql,{allowError:test.second.legacy}).then(result=>{pending.done=true;pending.result=result;return result;},error=>{pending.done=true;pending.error=error;throw error;});
 // A failed wait assertion still closes both sessions; avoid an unhandled rejection.
 completed.catch(()=>{});
 await proveWait(a,test.second,pidA,pidB,pending,test.name,test.mode!=='private');
 await a.query(test.release+';');
 const raw=await completed;
 if(test.release==='ROLLBACK')admitted(one(raw),test.second);
 else if(test.mode==='retry'){
  const retried=one(raw);assert.equal(retried.duplicate,true);
  assert.deepEqual(retried.submission,first.submission,'identical retry returns the unchanged owner row');
 }else if(test.second.legacy){
  assert.equal(raw.sqlstate,'P0001');assert.equal(raw.message,test.error);
  assert.deepEqual(raw.lines,[],'failed legacy insert returns no submission');
 }else assert.deepEqual(one(raw),{error:test.error},'quota/private duplicate response exposes no submission');
 const table=test.first.entity+'_submissions',keyColumn=test.first.entity==='creator'?'url_norm':'proof_norm';
 const stored=one(await a.query(`SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY id),'[]'::jsonb) FROM public.${table} s WHERE telegram_id IN (${test.first.id},${test.second.id});`));
 assert.equal(stored.length,test.seeds.length+1,'exactly one contested admission survives');
 const winner=test.release==='ROLLBACK'?test.second:test.first;
 assert(stored.some(row=>row.telegram_id===winner.id&&row[keyColumn]===winner.key));
 if(test.release==='ROLLBACK')assert(!stored.some(row=>row.id===first.submission.id),'rolled-back row cannot survive');
 console.log('PASS '+test.name);
}

async function main(){
 const env=fixtureEnvironment();const sessions=[];
 const stop=()=>{for(const session of sessions){session.fail(Error('contention test interrupted or exceeded 150s'));session.child.kill('SIGTERM');}};
 const timer=setTimeout(stop,150000);
 process.once('SIGINT',stop);process.once('SIGTERM',stop);
 try{
  const a=new PsqlSession('holder',env);sessions.push(a);
  const info=one(await a.query("SELECT jsonb_build_object('version',current_setting('server_version_num')::int,'database',current_database(),'host',inet_server_addr()::text,'pid',pg_backend_pid(),'isolation',current_setting('transaction_isolation'));"));
  assert(info.version>=170000&&info.version<180000,'CI fixture requires PostgreSQL 17');
  assert.equal(info.database,'moonkatty_admission_test');assert.equal(info.isolation,'read committed');
  console.log(`PostgreSQL ${info.version}, disposable database ${info.database}; exact migration ${migration}`);
  await a.query(bootstrapSql());
  const b=new PsqlSession('contender',env);sessions.push(b);
  await b.query('SET ROLE service_role; SET default_transaction_isolation=\'read committed\';');
  const second=one(await b.query("SELECT jsonb_build_object('pid',pg_backend_pid(),'role',current_user,'isolation',current_setting('transaction_isolation'));"));
  assert.equal(second.role,'service_role');assert.equal(second.isolation,'read committed');
  const pidB=second.pid;assert.notEqual(info.pid,pidB,'writer sessions must be independent backends');
  const cases=scenarios();
  for(const test of cases)await runCase(a,b,info.pid,pidB,test);
  const rewards=one(await a.query("SELECT jsonb_build_object('events',(SELECT count(*) FROM public.reward_events),'paid',(SELECT count(*) FROM public.players WHERE moon_points<>0));"));
  assert.deepEqual(rewards,{events:0,paid:0},'pending admissions must never pay rewards');
  console.log(`PASS: ${cases.length} genuine two-backend lock waits, post-commit rechecks and rollback release; correctness only, no capacity claim`);
 }finally{
  clearTimeout(timer);process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);
  await Promise.all(sessions.map(session=>session.close()));
 }
}
module.exports={bootstrapSql,fixtureSql,writer,scenarios,admitted,observeSql,one};
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
