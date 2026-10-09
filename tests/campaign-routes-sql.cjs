/* Upgrade and trust-boundary regression against real Postgres/WASM; never a live database. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{PGlite}=require('@electric-sql/pglite');
(async()=>{
 const db=new PGlite();await db.exec("create role anon;create role authenticated;create role service_role;create function public.rls_auto_enable() returns event_trigger language plpgsql as $$begin end$$;");
 for(const file of ['server/schema.sql','server/migrations/20261007_social_verify.sql','supabase/migrations/20261007200800_reward_integrity_sessions.sql','supabase/migrations/20261008201825_launch_campaign_integrity.sql'])await db.exec(fs.readFileSync(path.join(__dirname,'..',file),'utf8'));
 await db.exec("insert into players(telegram_id,moon_points,lives,story_life) values(401,500,9,1),(402,0,8,0);insert into reward_events(telegram_id,event_key,event_type,points,verified) values(401,'life:1:complete','life.complete',500,true);insert into mkty_cloud_saves(telegram_id,revision,snapshot) values(402,4,'{\"mkty_story_plan_1_v1\":\"keep original snapshot\"}');");
 const query=async(sql,params=[])=>(await db.query(sql,params)).rows;
 const rpc=async(name,args)=>{const entries=Object.entries(args);return (await query('select public.'+name+'('+entries.map(([k],i)=>k+'=> $'+(i+1)).join(',')+') as r',entries.map(([,v])=>v&&typeof v==='object'?JSON.stringify(v):v)))[0].r;};
 const before=await rpc('mkty_campaign_route',{p_id:402,p_life:1,p_seed:789,p_edition:1});await rpc('mkty_campaign_verified',{p_id:402,p_life:1,p_route:before.route});
 const balances=await query('select * from players order by telegram_id'),events=await query('select * from reward_events'),cloud=await query('select * from mkty_cloud_saves');
 await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261009151834_trusted_campaign_routes.sql'),'utf8'));
 assert.deepEqual(await query('select * from players order by telegram_id'),balances);assert.deepEqual(await query('select * from reward_events'),events);assert.deepEqual(await query('select * from mkty_cloud_saves'),cloud);
 const legacy=await rpc('mkty_campaign_route',{p_id:402,p_life:1,p_seed:42,p_edition:2});assert.equal(legacy.challenge_version,1);assert.equal(legacy.seed,before.seed);assert(legacy.verified_at);
 assert.equal((await rpc('mkty_campaign_verified',{p_id:402,p_life:1,p_route:legacy.route})).error,'proof');
 assert.equal((await rpc('mkty_reward',{p_id:402,p_key:'life:1:complete',p_type:'life.complete',p_points:500,p_meta:{route:legacy.route}})).error,'proof_required');
 assert.equal((await rpc('mkty_reward',{p_id:401,p_key:'life:1:complete',p_type:'life.complete',p_points:500})).inserted,false,'confirmed rewards keep idempotent retries');
 assert.equal((await rpc('mkty_campaign_route',{p_id:402,p_life:1,p_seed:42,p_reset:true})).error,'route_restart_required','old reset API cannot replace a route without an expected UUID');
 const restarts=await Promise.all(Array.from({length:12},()=>rpc('mkty_campaign_restart',{p_id:402,p_life:1,p_previous_route:legacy.route})));
 assert.equal(new Set(restarts.map(x=>x.route)).size,1);const fresh=restarts[0];assert.equal(fresh.challenge_version,2);assert.equal(fresh.edition,2);assert.notEqual(fresh.seed,legacy.seed);assert.equal(fresh.verified_at,null);
 assert.equal((await query('select count(*)::int n from mkty_campaign_route_history'))[0].n,1);
 const resumed=await Promise.all(Array.from({length:12},()=>rpc('mkty_campaign_route',{p_id:402,p_life:1,p_seed:999,p_edition:1})));assert(resumed.every(r=>r.route===fresh.route&&r.seed===fresh.seed&&r.edition===2));
 assert.equal((await rpc('mkty_campaign_restart',{p_id:401,p_life:1,p_previous_route:fresh.route})).error,'route_changed');
 await rpc('mkty_campaign_verified',{p_id:402,p_life:1,p_route:fresh.route});
 const rewards=await Promise.all(Array.from({length:12},()=>rpc('mkty_reward',{p_id:402,p_key:'life:1:complete',p_type:'life.complete',p_points:500,p_meta:{route:fresh.route}})));assert.equal(rewards.filter(x=>x.inserted).length,1);assert.equal((await query('select moon_points from players where telegram_id=402'))[0].moon_points,500);
 // A referral pass unlocks the next chapter before its route can be completed.
 await db.exec('insert into players(telegram_id,moon_points,lives,story_life,referred_by) values(403,0,9,1,401)');
 const skip=await rpc('mkty_reward',{p_id:401,p_key:'chapter:skip:2',p_type:'chapter.skip',p_points:0});assert.equal(skip.inserted,true,'earned referral skips require no campaign proof');
 assert.equal((await query("select relrowsecurity from pg_class where oid='public.mkty_campaign_route_history'::regclass"))[0].relrowsecurity,true);
 for(const role of ['anon','authenticated'])assert.equal((await query("select has_table_privilege($1,'public.mkty_campaign_route_history','select') allowed",[role]))[0].allowed,false);
 await db.close();console.log('PASS: additive upgrade preserves balances/ledger/cloud; legacy verified routes blocked; concurrent restart/payout idempotency; immutable resume; account isolation and private archive RLS');
})().catch(e=>{console.error(e);process.exit(1);});
