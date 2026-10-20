// Applies the friend-help / notify-queue migration on PGlite with a minimal players table (referral graph).
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const {PGlite}=await import('@electric-sql/pglite');const db=new PGlite();
 await db.exec("create role anon; create role authenticated; create role service_role; create table public.players(telegram_id bigint primary key, referred_by bigint);insert into public.players values(1,null),(2,1),(3,1),(4,null),(5,1),(6,1);");
 const sql=fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261020120000_world_social.sql'),'utf8');
 await db.exec(sql);await db.exec(sql); // idempotent re-apply
 const q=async(s,p)=>(await db.query(s,p)).rows[0].r;
 const T="'2026-10-20T10:00:00Z'";
 assert.deepEqual(await q(`select public.mkty_world_help(2,1,${T}) r`),{ok:true,inserted:true}); // invitee helps inviter
 assert.equal((await q(`select public.mkty_world_help(2,1,${T}) r`)).duplicate,true);              // once per day
 assert.deepEqual(await q(`select public.mkty_world_help(1,2,${T}) r`),{ok:true,inserted:true}); // inviter helps invitee
 assert.equal((await q(`select public.mkty_world_help(4,1,${T}) r`)).error,'not_friend');
 assert.equal((await q(`select public.mkty_world_help(2,3,${T}) r`)).error,'not_friend');          // siblings are not friends
 assert.equal((await q(`select public.mkty_world_help(1,1,${T}) r`)).error,'self');
 assert.equal((await q(`select public.mkty_world_help(3,1,${T}) r`)).inserted,true);
 assert.equal((await q(`select public.mkty_world_help(5,1,${T}) r`)).inserted,true);
 assert.equal((await q(`select public.mkty_world_help(6,1,${T}) r`)).error,'target_cap');          // 3 per receiver per day
 assert.equal((await q(`select public.mkty_world_help(6,1,'2026-10-21T00:10:00Z') r`)).inserted,true); // next UTC day
 let c=await q(`select public.mkty_world_help_claim(1,'2026-10-21T01:00:00Z') r`);assert.equal(c.count,4);assert.deepEqual(c.helpers.sort(),[2,3,5,6]);
 assert.equal((await q(`select public.mkty_world_help_claim(1,'2026-10-21T01:00:00Z') r`)).count,0); // consumed once
 assert.equal((await q(`select public.mkty_world_help_claim(2,'2026-10-25T01:00:00Z') r`)).count,0); // expired after 2 days
 // notifications: nothing is queued without opt-in
 assert.equal((await q(`select public.mkty_notify_schedule(2,'robot','2026-10-20T11:00:00Z',${T}) r`)).opted_in,false);
 await db.exec("insert into public.mkty_notify_prefs(telegram_id,opted_in,lang) values(2,true,'ru')");
 assert.equal((await q(`select public.mkty_notify_schedule(2,'robot','2026-10-20T11:00:00Z',${T}) r`)).scheduled,true);
 assert.equal((await q(`select public.mkty_notify_schedule(2,'storage','2026-10-20T10:30:00Z',${T}) r`)).scheduled,true);
 assert.equal((await q(`select public.mkty_notify_schedule(2,'robot','2026-10-25T11:00:00Z',${T}) r`)).error,'due');
 assert.equal((await q(`select public.mkty_notify_schedule(2,'x','2026-10-20T11:00:00Z',${T}) r`)).error,'kind');
 assert.deepEqual(await q(`select public.mkty_notify_due('2026-10-20T10:20:00Z') r`),[]);             // not due yet
 assert.deepEqual(await q(`select public.mkty_notify_due('2026-10-20T10:40:00Z') r`),[{telegram_id:2,kind:'storage',lang:'ru'}]);
 assert.deepEqual(await q(`select public.mkty_notify_due('2026-10-20T10:41:00Z') r`),[]);             // sent once
 assert.equal((await q(`select public.mkty_notify_due('2026-10-20T11:05:00Z') r`)).length,1);        // robot kind
 // throttle: same kind again within 3 h is held back
 await q(`select public.mkty_notify_schedule(2,'robot','2026-10-20T12:00:00Z','2026-10-20T11:10:00Z') r`);
 assert.deepEqual(await q(`select public.mkty_notify_due('2026-10-20T12:01:00Z') r`),[]);
 assert.equal((await q(`select public.mkty_notify_due('2026-10-20T14:06:00Z') r`)).length,1);        // after the gap
 // day cap 3: fourth ping that day is held
 await q(`select public.mkty_notify_schedule(2,'storage','2026-10-20T14:30:00Z','2026-10-20T14:10:00Z') r`);
 assert.deepEqual(await q(`select public.mkty_notify_due('2026-10-20T14:31:00Z') r`),[]);
 // opt-out stops everything
 await db.exec("update public.mkty_notify_prefs set opted_in=false where telegram_id=2");
 assert.deepEqual(await q(`select public.mkty_notify_due('2026-10-21T14:31:00Z') r`),[]);
 const g=(await db.query("select has_function_privilege('anon','public.mkty_world_help(bigint,bigint,timestamptz,integer,integer)','execute') a, has_table_privilege('anon','public.mkty_notify_queue','select') b, has_function_privilege('service_role','public.mkty_notify_due(timestamptz,integer,integer,integer)','execute') c")).rows[0];
 assert.deepEqual(g,{a:false,b:false,c:true});
 console.log('world-social-sql: migration checks passed');
})().catch(e=>{console.error(e);process.exit(1);});
