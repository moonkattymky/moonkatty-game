/* Real Postgres engine (PGlite), exact release migration, no production writes. */
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const {PGlite}=require('@electric-sql/pglite');
(async()=>{
 const db=new PGlite();
 await db.exec("create role anon;create role authenticated;create role service_role;create function public.rls_auto_enable() returns event_trigger language plpgsql as $$begin end$$;");
 await db.exec(fs.readFileSync(path.join(__dirname,'../server/schema.sql'),'utf8'));
 await db.exec(fs.readFileSync(path.join(__dirname,'../server/migrations/20261007_social_verify.sql'),'utf8'));
 await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261007200800_reward_integrity_sessions.sql'),'utf8'));
 await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261008201825_launch_campaign_integrity.sql'),'utf8'));
 await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261009120925_prelaunch_referral_caps.sql'),'utf8'));
 await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261009151834_trusted_campaign_routes.sql'),'utf8'));
 await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261009153246_atomic_submission_admission.sql'),'utf8'));
 const {createHandler}=await import('../server/rewards/core.mjs');
 const {issueSession,verifySession}=await import('../server/rewards/session.mjs');
 let clock=new Date('2026-10-08T12:00Z');
 const fetcher=async(url,opt={})=>{
  const u=new URL(url),name=u.pathname.split('/').pop(),b=opt.body?JSON.parse(opt.body):null,m=opt.method||'GET';
  try{
   if(u.pathname.includes('/rpc/')){const entries=Object.entries(b);const rows=(await db.query(`select public.${name}(${entries.map(([k],i)=>k+'=> $'+(i+1)).join(',')}) as result`,entries.map(([,v])=>typeof v==='object'?JSON.stringify(v):v))).rows;return Response.json(rows[0].result);}
   assert(['players','reward_events','referral_events'].includes(name));
   const values=[],param=v=>{values.push(v);return '$'+values.length;};
   const wh=[...u.searchParams].filter(([k])=>!['select','limit','on_conflict','order'].includes(k)).map(([k,v])=>{assert.match(k,/^[a-z_]+$/);if(v==='is.null')return k+' is null';const [op,...rest]=v.split('.');return k+({eq:'=',gte:'>=',gt:'>'}[op]||'=')+param(rest.join('.'));});
   const where=wh.length?' where '+wh.join(' and '):'';let q;
   if(m==='GET')q=`select * from public.${name}${where}`;
   if(m==='PATCH')q=`update public.${name} set ${Object.entries(b).map(([k,v])=>k+'='+param(v)).join(',')}${where} returning *`;
   if(m==='POST'){const entries=Object.entries(b);q=`insert into public.${name}(${entries.map(x=>x[0]).join(',')}) values(${entries.map(x=>param(x[1])).join(',')}) on conflict do nothing returning *`;}
   const r=await db.query(q,values);return Response.json(r.rows);
  }catch(e){return Response.json({error:e.message},{status:500});}
 };
 const handler=createHandler({url:'https://db.test',key:'test-key',fetcher,verify:async data=>{if(!/^user:\d+$/.test(data))throw Error('auth');return {id:Number(data.slice(5))};},clock:()=>clock});
 const call=async(id,action,extra={})=>{if(action==='life.complete'&&Number.isInteger(extra.life)&&extra.life>=1&&extra.life<=9)await db.query("insert into public.mkty_campaign_routes(telegram_id,life,seed,edition,challenge_version,verified_at) select telegram_id,$2,1,2,2,$3 from public.players where telegram_id=$1 on conflict do nothing",[id,extra.life,clock.toISOString()]);const r=await handler(new Request('https://api.test',{method:'POST',body:JSON.stringify({initData:'user:'+id,action,...extra})}));return {status:r.status,...await r.json()};};
 const sql=q=>db.query(q);
 const rpc=(id,key,type,points,meta={})=>db.query('select public.mkty_reward($1,$2,$3,$4,$5,$6) as r',[id,key,type,points,JSON.stringify(meta),clock.toISOString()]).then(r=>r.rows[0].r);
 await call(101,'player');
 for(let i=0;i<2;i++){const r=await call(101,'rewards.verify',{event_key:'invented:'+i,event_type:'game.win',points:5000});assert.equal(r.error,'unverified');}
 assert.equal((await call(101,'life.complete',{life:9})).error,'life');
 assert.equal((await call(101,'life.complete',{life:1})).error,'too_fast','LIFE #1 cannot be claimed seconds after the first launch');
await db.exec("update public.players set created_at='2026-10-01T00:00Z';alter table public.players alter column created_at set default '2026-10-01T00:00Z'");
assert.equal((await call(101,'life.complete',{life:1})).player.moon_points,500);
 assert.equal((await call(101,'life.complete',{life:1})).awarded,false);
 assert.equal((await call(101,'life.complete',{life:2})).error,'chapter_locked');
 clock=new Date(clock.getTime()+86400000);assert.equal((await call(101,'life.complete',{life:2})).player.story_life,2);
 // Concurrent distinct events and replay: journal and balance remain equal.
 await Promise.all(Array.from({length:40},(_,i)=>rpc(101,'verified:'+i,'daily.test',i+1)));
 await Promise.all(Array.from({length:20},()=>rpc(101,'one-only','daily.test',70)));
 let p=(await sql('select moon_points from players where telegram_id=101')).rows[0];
 assert.equal(p.moon_points,1000+820+70);
 assert.equal((await sql('select sum(points)::int as total from reward_events where telegram_id=101')).rows[0].total,p.moon_points);
 // Fail the balance UPDATE after an event INSERT. PostgreSQL rolls back both.
 await call(102,'player');await db.exec("create function fail_balance() returns trigger language plpgsql as $$begin if new.telegram_id=102 and new.moon_points>0 then raise exception 'test outage';end if;return new;end$$;create trigger fail_balance before update on players for each row execute function fail_balance();");
 assert.equal((await call(102,'life.complete',{life:1})).status,503);
 assert.equal((await sql('select count(*)::int as n from reward_events where telegram_id=102')).rows[0].n,0);
 await db.exec('drop trigger fail_balance on players');
 assert.equal((await call(102,'life.complete',{life:1})).player.moon_points,500);
 // Lives race and duplicate spends cannot overdraft or charge twice.
 const spent=await Promise.all(Array.from({length:12},(_,i)=>rpc(102,'failure:'+i,'life.spend',0)));
 assert.equal(spent.filter(x=>x.inserted).length,9);assert.equal((await rpc(102,'failure:0','life.spend',0)).inserted,false);
 assert.equal((await sql('select lives from players where telegram_id=102')).rows[0].lives,0);
 clock=new Date(clock.getTime()+43200000);assert.equal((await call(102,'player')).player.lives,1);
 // Verified referral source only, atomic reward on both sides, retry once.
 await call(103,'player');await db.exec('update players set referred_by=101 where telegram_id=103');
 assert.equal((await call(101,'referrals.claim',{referral_id:103,source_event_key:'fiction'})).error,'source');
 const completion=await call(103,'life.complete',{life:1});assert.equal(completion.player.moon_points,700);
 const before=(await call(101,'player')).player.moon_points;
 await call(103,'life.complete',{life:1});assert.equal((await call(101,'player')).player.moon_points,before);
 const source=await call(101,'referrals.claim',{referral_id:103,source_event_key:'life:1:complete'});assert.equal(source.awarded,true);
 assert.equal((await call(101,'referrals.claim',{referral_id:103,source_event_key:'life:1:complete'})).awarded,false);
 // Atomic moderation payout and final cipher attempt: forced failure leaves no half-state.
 await call(105,'player');
 const sub=(await db.query("insert into creator_submissions(telegram_id,platform,url,url_norm,caption) values(105,'youtube','https://youtu.be/test','https://youtu.be/test','#moonkatty') returning id")).rows[0].id;
 const review=()=>db.query("select mkty_review('creator',$1,'approve','base',900,250,$2,'creator.base',$3) as r",[sub,'creator:'+sub+':base',clock.toISOString()]);
 await db.exec("create or replace function fail_balance() returns trigger language plpgsql as $$begin if new.telegram_id=105 and new.moon_points>0 then raise exception 'test outage';end if;return new;end$$;create trigger fail_balance before update on players for each row execute function fail_balance();");
 await assert.rejects(review);
 assert.equal((await db.query('select status from creator_submissions where id=$1',[sub])).rows[0].status,'pending');
 await db.exec('drop trigger fail_balance on players');assert.equal((await review()).rows[0].r.reward.points,250);
 await db.exec("insert into cipher_attempts(telegram_id,day,attempts) values(105,'2026-10-20',4);create trigger fail_balance before update on players for each row execute function fail_balance();");
 const cipher=()=>db.query("select mkty_cipher(105,'2026-10-20',true,5,$1) as r",[clock.toISOString()]);
 await assert.rejects(cipher);assert.equal((await sql("select attempts from cipher_attempts where telegram_id=105")).rows[0].attempts,4);
 await db.exec('drop trigger fail_balance on players');assert.equal((await cipher()).rows[0].r.points,15);assert.equal((await cipher()).rows[0].r.awarded,false);
 // Full sequential campaign, server lock and post-final idempotency.
 for(let n=3;n<=9;n++){clock=new Date(clock.getTime()+86400000);assert.equal((await call(101,'life.complete',{life:n})).ok,true);}
 const final=await call(101,'player');assert.equal(final.player.final_balance,final.player.moon_points);assert(final.player.balance_locked_at);
 assert.equal((await call(101,'life.complete',{life:9})).awarded,false);
 assert.equal((await rpc(101,'later','daily.test',1)).error,'locked');
 // Legacy recorded chapters never pay under a second namespace.
 await call(104,'player');await db.exec('update players set story_life=2,moon_points=520 where telegram_id=104');
 assert.equal((await call(104,'life.complete',{life:1})).player.moon_points,520);
 // Privileges: no public/anon/authenticated access to privileged RPCs.
 const privileges=(await sql("select has_function_privilege('anon','public.mkty_reward(bigint,text,text,integer,jsonb,timestamptz)','EXECUTE') a,has_function_privilege('authenticated','public.mkty_reward(bigint,text,text,integer,jsonb,timestamptz)','EXECUTE') b,has_function_privilege('service_role','public.mkty_reward(bigint,text,text,integer,jsonb,timestamptz)','EXECUTE') c")).rows[0];assert.deepEqual(privileges,{a:false,b:false,c:true});
 // Bounded sessions survive a whole campaign session, fail expired/tampered/wrong secret.
 const t=Date.now(),session=await issueSession({id:101},'test-key',t);
 assert.equal((await verifySession(session.token,'test-key',t+3600000)).id,101);
 await assert.rejects(()=>verifySession(session.token,'test-key',t+12*3600000));
 await assert.rejects(()=>verifySession(session.token+'x','test-key',t));await assert.rejects(()=>verifySession(session.token,'wrong-key',t));
 const totals=(await sql('select count(*)::int as n from players p where telegram_id<>104 and moon_points<>(select coalesce(sum(points),0) from reward_events r where r.telegram_id=p.telegram_id)')).rows[0];assert.equal(totals.n,0);
 console.log('PASS: real SQL atomic awards, 40 concurrent events, 20 replays, injected rollback, chapter sequence/pacing/final lock, lives, referrals, permissions and bounded sessions');await db.close();
})().catch(e=>{console.error(e);process.exit(1)});
