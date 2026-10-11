/* Small persistent psql driver. No database npm dependency and no shell execution. */
const {spawn}=require('node:child_process');
const {randomUUID}=require('node:crypto');

function fixtureEnvironment(source=process.env){
 if(source.MKTY_PG_TEST_DISPOSABLE!=='1')throw Error('Set MKTY_PG_TEST_DISPOSABLE=1 only for the documented disposable fixture cluster');
 const port=source.MKTY_PG_TEST_PORT||'5432';
 if(!/^\d+$/.test(port)||Number(port)<1||Number(port)>65535)throw Error('Invalid MKTY_PG_TEST_PORT');
 // Never inherit a live database URL, libpq service, host, credentials or options.
 const env=Object.fromEntries(Object.entries(source).filter(([key])=>!/^PG|DATABASE_URL/.test(key)));
 return {...env,PGHOST:'127.0.0.1',PGPORT:port,PGDATABASE:'moonkatty_admission_test',PGUSER:'postgres',
  PGPASSWORD:'mkty-local-fixture-only',PGPASSFILE:'/dev/null',PGSERVICEFILE:'/dev/null',PGSSLMODE:'disable',
  PGCONNECT_TIMEOUT:'5',PGOPTIONS:'-c statement_timeout=15000 -c lock_timeout=12000 -c idle_in_transaction_session_timeout=20000 -c timezone=UTC'};
}

class PsqlSession{
 constructor(name,env,{command='psql',args=[],timeoutMs=20000}={}){
  this.name=name;this.timeoutMs=timeoutMs;this.buffer='';this.stderr='';this.pending=null;this.failure=null;
  this.child=spawn(command,[...args,'-X','--no-password','--quiet','--no-align','--tuples-only','--set=ON_ERROR_STOP=1','--file=-'],{
   env:{...env,PGAPPNAME:`mkty-admission-${name}`},stdio:['pipe','pipe','pipe']});
  this.closed=new Promise(resolve=>this.child.once('close',(code,signal)=>{
   this.fail(Error(`${name}: psql exited (${code??signal})\n${this.stderr}`));resolve();
  }));
  this.child.once('error',e=>this.fail(Error(`${name}: cannot start psql: ${e.message}`)));
  this.child.stdin.on('error',e=>this.fail(Error(`${name}: psql input: ${e.message}`)));
  this.child.stderr.on('data',chunk=>{this.stderr=(this.stderr+chunk).slice(-12000);});
  this.child.stdout.on('data',chunk=>this.consume(chunk.toString()));
 }
 fail(error){
  this.failure||=error;
  if(this.pending){clearTimeout(this.pending.timer);this.pending.reject(this.failure);this.pending=null;}
 }
 consume(chunk){
  this.buffer+=chunk;
  if(this.buffer.length>1024*1024){this.fail(Error(`${this.name}: psql output limit`));this.child.kill('SIGKILL');return;}
  let index;
  while((index=this.buffer.indexOf('\n'))!==-1){
   const line=this.buffer.slice(0,index).replace(/\r$/,'');this.buffer=this.buffer.slice(index+1);
   const p=this.pending;if(!p)continue;
   if(line.startsWith(p.marker+' ')){
    clearTimeout(p.timer);this.pending=null;
    const match=line.slice(p.marker.length+1).match(/^([0-9A-Z]{5})(?: (.*))?$/);
    if(!match){p.reject(Error(`${this.name}: invalid psql status: ${line}`));continue;}
    p.resolve({lines:p.lines,sqlstate:match[1],message:match[1]==='00000'?'':match[2]||''});
   }else if(line.trim()){
    p.lines.push(line);
    if((p.bytes+=line.length)>1024*1024){this.fail(Error(`${this.name}: psql result limit`));this.child.kill('SIGKILL');return;}
   }
  }
 }
 query(sql,{allowError=false}={}){
  if(this.failure)return Promise.reject(this.failure);
  if(this.pending)return Promise.reject(Error(`${this.name}: only one in-flight query per backend`));
  // Expected errors are allowed only for a single direct INSERT, never fixture setup.
  const marker='MKTY_'+randomUUID().replaceAll('-','');
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{this.fail(Error(`${this.name}: query deadline exceeded`));this.child.kill('SIGKILL');},this.timeoutMs);
   this.pending={marker,resolve,reject,timer,lines:[],bytes:0};
   this.child.stdin.write(`\\set ON_ERROR_STOP ${allowError?'off':'on'}\n${sql}\n\\echo ${marker} :SQLSTATE :LAST_ERROR_MESSAGE\n\\set ON_ERROR_STOP on\n`);
  });
 }
 async close(){
  this.fail(Error(`${this.name}: session closed`));
  this.child.stdin.destroy();this.child.kill('SIGTERM');
  const timer=setTimeout(()=>this.child.kill('SIGKILL'),1000);
  try{await this.closed;}finally{clearTimeout(timer);}
 }
}
module.exports={PsqlSession,fixtureEnvironment};
