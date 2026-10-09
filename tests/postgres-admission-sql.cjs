/* SQL/fixture validation only. PGlite is serial and does NOT run the contention test. */
const assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite');
const {fixtureSql,bootstrapSql,scenarios,admitted,observeSql,one}=require('./postgres/submission-admission.cjs');
const {fixtureEnvironment}=require('./postgres/psql-session.cjs');
(async()=>{
 assert.throws(()=>fixtureEnvironment({}),/DISPOSABLE/);
 for(const port of ['0','65536','5432 host=example.com','postgres://live'])assert.throws(()=>fixtureEnvironment({MKTY_PG_TEST_DISPOSABLE:'1',MKTY_PG_TEST_PORT:port}),/PORT/);
 const env=fixtureEnvironment({MKTY_PG_TEST_DISPOSABLE:'1',MKTY_PG_TEST_PORT:'55432',PGHOST:'live.example',PGHOSTADDR:'203.0.113.1',PGSERVICE:'live',PGOPTIONS:'unsafe',PGPASSWORD:'secret',DATABASE_URL:'postgres://live',PATH:'/usr/bin'});
 assert.equal(env.PGHOST,'127.0.0.1');assert.equal(env.PGPORT,'55432');assert.equal(env.PGDATABASE,'moonkatty_admission_test');
 assert.equal(env.PGHOSTADDR,undefined);assert.equal(env.PGSERVICE,undefined);assert.equal(env.DATABASE_URL,undefined);
 assert.equal(env.PGPASSWORD,'mkty-local-fixture-only');assert.equal(env.PGPASSFILE,'/dev/null');assert.equal(env.PATH,'/usr/bin');
 assert.match(bootstrapSql(),/current_database\(\)<>'moonkatty_admission_test'/);
 assert.match(bootstrapSql(),/fixture database must be empty/);
 assert.throws(()=>one({lines:[],sqlstate:'00000'}),/expected one/);
 assert.throws(()=>one({lines:['{}'],sqlstate:'P0001',message:'failure'}),/failure/);
 const db=new PGlite();
 try{
  // PGlite fixes its database name. Adapt only that equality for this serial
  // companion; the real psql runner always uses the literal disposable name.
  const database=(await db.query('SELECT current_database() name')).rows[0].name;
  const bootstrap=bootstrapSql().replace("current_database()<>'moonkatty_admission_test'",
   "current_database()<>'"+database.replaceAll("'","''")+"'");
  assert(bootstrap.includes(fixtureSql()));
  await db.exec(bootstrap);
  await assert.rejects(()=>db.exec(bootstrap),/fixture database must be empty/);
  await db.exec('ROLLBACK');
  // Parse the real monitoring SQL too; PGlite need not expose an activity row.
  const pid=(await db.query('SELECT pg_backend_pid() pid')).rows[0].pid;
  await db.exec(observeSql(pid));
  const cases=scenarios();assert.equal(cases.length,32);
  const query=async sql=>(await db.query(sql)).rows[0];
  const result=async sql=>Object.values(await query(sql))[0];
  for(const test of cases){
   await db.exec('SET ROLE service_role');
   for(const seed of test.seeds)admitted(await result(seed.sql),seed);
   await db.exec('BEGIN ISOLATION LEVEL READ COMMITTED');
   const first=await result(test.first.sql);admitted(first,test.first);
   await db.exec(test.release);
   // Deliberately sequential here: real overlap is exclusively the psql CI suite.
   if(test.release==='COMMIT'&&test.mode==='quota'&&test.second.legacy){
    await assert.rejects(()=>result(test.second.sql),error=>error.code==='P0001'&&error.message===test.error);
   }else{
    const second=await result(test.second.sql);
    if(test.release==='ROLLBACK')admitted(second,test.second);
    else if(test.mode==='retry'){assert.equal(second.duplicate,true);assert.deepEqual(second.submission,first.submission);}
    else assert.deepEqual(second,{error:test.error});
   }
   const {n}=await query(`SELECT count(*)::int n FROM public.${test.first.entity}_submissions WHERE telegram_id IN (${test.first.id},${test.second.id})`);
   assert.equal(n,test.seeds.length+1,test.name);
   await db.exec('RESET ROLE');
  }
  assert.equal((await query('SELECT count(*)::int n FROM public.reward_events')).n,0);
  console.log('PASS: disposable connection safeguards, exact PostgreSQL fixture SQL and 32 scenario expectations (PGlite serial; contention NOT executed)');
 }finally{await db.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
