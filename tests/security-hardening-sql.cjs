/* Security hardening (audit 2026-10-17) against real SQL in a disposable PGlite database:
   RLS/revoke on player tables, per-player rate limits, one-time OAuth state, plus the
   rewards handler's rate limit (429), origin-restricted CORS and SESSION_SECRET rotation.
   Only Telegram identity is mocked. No sockets, deployment or external requests. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{PGlite}=require('@electric-sql/pglite');
const root=path.join(__dirname,'..'),source=f=>fs.readFileSync(path.join(root,f),'utf8');
const files=['server/schema.sql','server/migrations/20261007_social_verify.sql','supabase/migrations/20261007200800_reward_integrity_sessions.sql','supabase/migrations/20261008201825_launch_campaign_integrity.sql','supabase/migrations/20261017120000_security_hardening.sql'];
(async()=>{
 const db=new PGlite();await db.exec("create role anon;create role authenticated;create role service_role;create function public.rls_auto_enable() returns event_trigger language plpgsql as $$begin end$$;");
 for(const f of files)await db.exec(source(f));
 const one=async(sql,params=[])=>(await db.query(sql,params)).rows[0];

 // 1. RLS on every player table; anon/authenticated have no table or function access.
 const tables=['players','reward_events','referral_events','mkty_rate_limits','mkty_oauth_states','mkty_campaign_routes'];
 for(const t of tables)assert.equal((await one("select relrowsecurity from pg_class where oid=('public.'||$1)::regclass",[t])).relrowsecurity,true,'RLS enabled: '+t);
 for(const role of ['anon','authenticated']){
  for(const t of tables){
   await db.exec('set role '+role);
   await assert.rejects(()=>db.query('select * from public.'+t+' limit 1'),/permission denied/,role+' cannot read '+t);
   await db.exec('reset role');
  }
  for(const fn of ["mkty_campaign_issue(1,1,1)","mkty_rate_limit(1,'[]'::jsonb)","mkty_oauth_state_issue(1,'x')","mkty_oauth_state_consume(1,'x')"]){
   await db.exec('set role '+role);
   await assert.rejects(()=>db.query('select public.'+fn),/permission denied/,role+' cannot execute '+fn);
   await db.exec('reset role');
  }
 }
 // The schema file used for fresh installs carries the same RLS block.
 const schema=source('server/schema.sql');
 for(const t of ['players','reward_events','referral_events'])assert.match(schema,new RegExp('alter table '+t+' enable row level security'));
 assert.match(schema,/revoke all on players, reward_events, referral_events from public, anon, authenticated;/);

 // 2. Fixed-window per-player rate limit.
 const t0=new Date('2026-11-01T12:00:00Z'),at=s=>new Date(t0.getTime()+s*1000).toISOString();
 const limit=async(id,rules,s)=>(await one('select public.mkty_rate_limit($1,$2::jsonb,$3) r',[id,JSON.stringify(rules),at(s)])).r;
 const rules=[{bucket:'all',limit:100,window:60},{bucket:'proof',limit:2,window:600}];
 assert.equal((await limit(1,rules,0)).allowed,true);assert.equal((await limit(1,rules,1)).allowed,true);
 const denied=await limit(1,rules,2);assert.deepEqual({a:denied.allowed,b:denied.bucket},{a:false,b:'proof'});assert(denied.retry_after>=590&&denied.retry_after<=600,JSON.stringify(denied));
 assert.equal((await limit(2,rules,2)).allowed,true,'limits are per player');
 assert.equal((await limit(1,rules,601)).allowed,true,'a new window opens after the period');
 for(const bad of [[],[{bucket:'Bad!',limit:1,window:1}],[{bucket:'x',limit:0,window:1}],[{bucket:'x',limit:1,window:0}]])assert.equal((await limit(1,bad,0)).error,'rate_rules');

 // 3. One-time OAuth state: bound to the player, single use, expires.
 const st=n=>('s'+n).padEnd(43,'A');
 const issue=async(id,state,s=0)=>(await one('select public.mkty_oauth_state_issue($1,$2,$3) r',[id,state,at(s)])).r;
 const consume=async(id,state,s=0)=>(await one('select public.mkty_oauth_state_consume($1,$2,600,$3) r',[id,state,at(s)])).r.valid;
 assert.equal((await issue(7,'short')).error,'oauth_state');
 assert.equal((await issue(7,st(1))).ok,true);
 assert.equal(await consume(8,st(1),5),false,'another player cannot use the state');
 assert.equal(await consume(7,st(1),5),true);assert.equal(await consume(7,st(1),6),false,'single use');
 assert.equal((await issue(7,st(2),10)).ok,true);assert.equal(await consume(7,st(2),10+601),false,'expired after 10 minutes');
 for(let i=3;i<=7;i++)await issue(9,st(i),i);
 assert.equal((await issue(9,st(8),20)).error,'no_attempts','at most 5 open states per player');

 // 4. Handler: 429 from the real SQL limiter, fail-open without it, CORS and sessions.
 const {createHandler}=await import('../server/rewards/core.mjs'),{verifySession,issueSession}=await import('../server/rewards/session.mjs');
 let clock=new Date(t0.getTime()+3600e3),breakLimiter=false;const rpcs=[];
 const fetcher=async(url,opt={})=>{const u=new URL(url),name=u.pathname.split('/').pop(),b=opt.body?JSON.parse(opt.body):null,m=opt.method||'GET';try{
  if(u.pathname.includes('/rpc/')){rpcs.push(name);if(breakLimiter&&name==='mkty_rate_limit')return Response.json({message:'function missing'},{status:404});const e=Object.entries(b),rows=(await db.query(`select public.${name}(${e.map(([k],i)=>k+'=> $'+(i+1)).join(',')}) as r`,e.map(([,v])=>v&&typeof v==='object'?JSON.stringify(v):v))).rows;return Response.json(rows[0].r);}
  assert(['players','reward_events','referral_events'].includes(name));const values=[],param=v=>{values.push(v);return '$'+values.length;};
  const wh=[...u.searchParams].filter(([k])=>!['select','limit','on_conflict','order'].includes(k)).map(([k,v])=>{if(v==='is.null')return k+' is null';const [op,...r]=v.split('.');return k+({eq:'=',gte:'>=',gt:'>'}[op]||'=')+param(r.join('.'));}),where=wh.length?' where '+wh.join(' and '):'';let q;
  if(m==='GET')q=`select * from public.${name}${where}`;
  if(m==='PATCH')q=`update public.${name} set ${Object.entries(b).map(([k,v])=>k+'='+param(v)).join(',')}${where} returning *`;
  if(m==='POST'){const e=Object.entries(b);q=`insert into public.${name}(${e.map(x=>x[0]).join(',')}) values(${e.map(x=>param(x[1])).join(',')}) on conflict do nothing returning *`;}
  return Response.json((await db.query(q,values)).rows);
 }catch(e){return Response.json({error:e.message},{status:500});}};
 const serviceKey='synthetic-service-key',sessionSecret='synthetic-session-secret-0123456789abcdef';
 const base={url:'https://db.test',key:serviceKey,fetcher,verify:async id=>({id:Number(id)}),clock:()=>clock,sessionSecret,rateLimit:true,rateRules:{all:{limit:100,window:60},open:{limit:2,window:60}}};
 const h=createHandler(base);
 const call=async(handler,body,headers={})=>{const r=await handler(new Request('https://api.test',{method:'POST',headers,body:JSON.stringify(body)}));return {status:r.status,headers:r.headers,...await r.json()};};
 await call(h,{initData:'501',action:'player'});
 assert.equal((await call(h,{initData:'501',action:'campaign.open',life:1})).ok,true);
 assert.equal((await call(h,{initData:'501',action:'campaign.open',life:1})).ok,true);
 const tooMany=await call(h,{initData:'501',action:'campaign.open',life:1});
 assert.equal(tooMany.status,429);assert.equal(tooMany.error,'rate_limited');assert(Number(tooMany.headers.get('Retry-After'))>=1);assert.equal(tooMany.retry_after,Number(tooMany.headers.get('Retry-After')));
 assert.equal((await call(h,{initData:'502',action:'campaign.open',life:1})).ok,true,'another player is not affected');
 assert.equal((await call(h,{initData:'501',action:'player'})).ok,true,'light actions only count towards the overall budget');
 clock=new Date(clock.getTime()+61000);assert.equal((await call(h,{initData:'501',action:'campaign.open',life:1})).ok,true,'window resets');
 breakLimiter=true;for(let i=0;i<4;i++)assert.equal((await call(h,{initData:'501',action:'campaign.open',life:1})).ok,true,'fails open if the migration is missing');breakLimiter=false;
 assert.equal((await call(createHandler({...base,rateLimit:false}),{initData:'503',action:'player'})).ok,true);
 // CORS: only the GitHub Pages origin (and localhost for development) is reflected.
 for(const [origin,allowed] of [['https://moonkattymky.github.io','https://moonkattymky.github.io'],['http://127.0.0.1:4173','http://127.0.0.1:4173'],['https://evil.example','https://moonkattymky.github.io'],['https://moonkattymky.github.io.evil.example','https://moonkattymky.github.io']]){
  const pre=await h(new Request('https://api.test',{method:'OPTIONS',headers:{Origin:origin}}));assert.equal(pre.status,204);assert.equal(pre.headers.get('Access-Control-Allow-Origin'),allowed);assert.equal(pre.headers.get('Vary'),'Origin');
  const r=await call(h,{initData:'504',action:'player'},{Origin:origin});assert.equal(r.headers.get('Access-Control-Allow-Origin'),allowed);
 }
 // SESSION_SECRET: new sessions are signed with it, never with the service key.
 const issued=await call(h,{initData:'505',action:'session'});assert.equal(issued.ok,true);
 assert.equal((await verifySession(issued.session.token,sessionSecret,clock.getTime())).id,505);
 await assert.rejects(()=>verifySession(issued.session.token,serviceKey,clock.getTime()),/auth/);
 assert.equal((await call(h,{session:issued.session.token,action:'player'})).ok,true);
 // Transition: an old session signed with the service key still works, until the fallback is switched off.
 const legacy=(await issueSession({id:506},serviceKey,clock.getTime())).token;
 assert.equal((await call(h,{session:legacy,action:'player'})).ok,true,'legacy sessions keep working during the rollout');
 const strict=createHandler({...base,sessionLegacyFallback:false});
 assert.equal((await call(strict,{session:legacy,action:'player'})).status,401,'SESSION_LEGACY_FALLBACK=false refuses old sessions');
 assert.equal((await call(strict,{session:issued.session.token,action:'player'})).ok,true);
 // Without SESSION_SECRET nothing changes compared with the previous release.
 const unset=createHandler({...base,sessionSecret:''}),old=await call(unset,{initData:'507',action:'session'});
 assert.equal((await verifySession(old.session.token,serviceKey,clock.getTime())).id,507);
 const health=await (await h(new Request('https://api.test'))).json();assert.equal(health.session_secret_configured,true);assert(!JSON.stringify(health).includes(sessionSecret));
 assert.equal((await (await unset(new Request('https://api.test'))).json()).session_secret_configured,false);
 await db.close();
 console.log('PASS: RLS/revoke on player tables and new tables, per-player SQL rate limits (429, fail-open), one-time OAuth state, origin-restricted CORS, SESSION_SECRET with transition fallback (isolated DB, no network)');
})().catch(e=>{console.error(e);process.exitCode=1;});
