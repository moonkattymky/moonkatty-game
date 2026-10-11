/* Local psql transport/cleanup unit tests using a pipe-only fake process. No SQL. */
const assert=require('node:assert/strict');
const path=require('node:path');
const {PsqlSession}=require('./postgres/psql-session.cjs');
const fake=()=>new PsqlSession('unit',process.env,{command:process.execPath,args:[path.join(__dirname,'postgres/fake-psql-fixture.cjs')],timeoutMs:1000});
(async()=>{
 let session=fake();
 try{
  assert.deepEqual(await session.query('SUCCESS;'),{lines:['{"ok":true}'],sqlstate:'00000',message:''});
  assert.deepEqual(await session.query('FAIL;',{allowError:true}),{lines:[],sqlstate:'P0001',message:'weekly'});
  assert.equal((await session.query('SUCCESS;')).message,'','successful query ignores stale psql error message');
  assert.deepEqual((await session.query('CHUNKED;')).lines,['{"ok":true}'],'framing survives chunk boundaries');
  const pending=session.query('HANG;');const rejected=assert.rejects(pending,/session closed/);
  await assert.rejects(session.query('SUCCESS;'),/one in-flight/);
  await session.close();await rejected;
 }finally{await session.close();}
 session=fake();
 try{await assert.rejects(session.query('FAIL;'),/psql exited \(3\)[\s\S]*synthetic SQL failure/);}finally{await session.close();}
 session=fake();
 try{await assert.rejects(session.query('EXIT;'),/psql exited \(2\)/);}finally{await session.close();}
 session=new PsqlSession('deadline',process.env,{command:process.execPath,args:[path.join(__dirname,'postgres/fake-psql-fixture.cjs')],timeoutMs:100});
 try{await assert.rejects(session.query('HANG;'),/deadline/);}finally{await session.close();}
 session=new PsqlSession('missing',process.env,{command:'/nonexistent/mkty-psql'});
 try{await assert.rejects(session.query('SUCCESS;'),/cannot start psql/);}finally{await session.close();}
 console.log('PASS: psql framing, expected/fatal SQL errors, one-in-flight-query guard, missing executable, bounded timeout and process cleanup (pipe-only fixture)');
})().catch(error=>{console.error(error);process.exitCode=1;});
