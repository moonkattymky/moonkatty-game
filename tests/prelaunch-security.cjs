const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{PGlite}=require('@electric-sql/pglite');
(async()=>{
 const {playerCode}=await import('../server/rewards/social.mjs');const {cipherWord}=await import('../server/rewards/daily.mjs');
 for(const secret of [undefined,'','   ']){await assert.rejects(playerCode(1,secret),/unavailable/);await assert.rejects(cipherWord('2026-10-09',secret),/unavailable/);}
 const db=new PGlite();await db.exec("create role anon;create role authenticated;create role service_role;create function public.rls_auto_enable() returns event_trigger language plpgsql as $$begin end$$;");
 for(const file of ['server/schema.sql','server/migrations/20261007_social_verify.sql',...fs.readdirSync(path.join(__dirname,'../supabase/migrations')).map(x=>'supabase/migrations/'+x).sort()])await db.exec(fs.readFileSync(path.join(__dirname,'..',file),'utf8'));
 await db.exec("insert into players(telegram_id,story_life) values(1,1),(2,1),(3,1);insert into players(telegram_id,story_life,referred_by) select n,1,1 from generate_series(1000,1110) n");
 const pay=(id,now='2026-10-09T12:00Z')=>db.query("select mkty_referral($1,1,'life1',true,10000,$2) as r",[id,now]).then(x=>x.rows[0].r);
 const concurrent=await Promise.all(Array.from({length:12},(_,i)=>pay(1000+i)));
 assert.equal(concurrent.filter(x=>x.inviter_paid).length,10,'hard daily cap survives concurrent callers requesting 10000');
 assert.equal((await db.query('select moon_points from players where telegram_id=1')).rows[0].moon_points,2000);
 assert.equal((await pay(1000)).inviter_paid,false,'replay never pays again');
 assert.equal((await pay(1012,'2026-10-10T00:00Z')).inviter_paid,true,'UTC day reset');
 // Seed previously earned events, retaining all player balances. The 100th event is last.
 await db.exec("insert into referral_events(inviter_id,referral_id,source_event_key,points,created_at) select 1,n,'historical',0,'2026-10-01T00:00Z' from generate_series(1020,1107) n");
 const total=await Promise.all([pay(1013,'2026-10-11T00:00Z'),pay(1014,'2026-10-11T00:00Z')]);
 assert.equal(total.filter(x=>x.inviter_paid).length,1);assert.equal((await db.query('select count(*)::int n from referral_events where inviter_id=1')).rows[0].n,100);
 assert(total.every(x=>x.invitee_points===200),'invitee bonus remains independent of inviter cap');
 await db.exec("insert into players(telegram_id,story_life,referred_by) values(2000,0,1);insert into reward_events(telegram_id,event_key,event_type,points,verified) values(2000,'social:test','social.test',5,true)");
 const early=(await db.query("select mkty_referral(2000,1,'social:test',false,10,'2026-10-12T00:00Z') r")).rows[0].r;assert.equal(early.error,'source','even activity payouts require LIFE #1');
 for(const role of ['anon','authenticated'])assert.equal((await db.query("select has_function_privilege($1,'public.mkty_referral(bigint,bigint,text,boolean,integer,timestamptz)','EXECUTE') ok",[role])).rows[0].ok,false);
 await db.close();console.log('PASS: missing secrets fail closed, concurrent daily/total referral caps, UTC reset, replay and pre-LIFE #1 rejection');
})().catch(e=>{console.error(e);process.exitCode=1});
