// 3D world (Telegram port) server actions: world.state / world.save / world.reward. Synthetic fake PostgREST, no live secrets.
const assert=require('node:assert/strict');
(async()=>{
 const {createHandler}=await import('../server/rewards/core.mjs');
 const {worldRewardSpec,WORLD_QUESTS}=await import('../server/rewards/world.mjs');
 let now=Date.parse('2026-10-18T10:00:00Z');
 const db={player:null,events:[],save:{revision:0,snapshot:{}}};
 const J=(x,s=200)=>new Response(JSON.stringify(x),{status:s});
 const fetcher=async(url,opts={})=>{
  const u=new URL(url),p=u.pathname,m=(opts.method||'GET').toUpperCase(),b=opts.body?JSON.parse(opts.body):null;
  if(p.endsWith('/players')){
   if(m==='GET')return J(db.player?[db.player]:[]);
   if(m==='POST'){db.player={telegram_id:b.telegram_id,moon_points:0,lives:9,story_life:0,created_at:new Date(now).toISOString()};return J([db.player]);}
   if(m==='PATCH'){Object.assign(db.player,b);return J([db.player]);}
  }
  if(p.endsWith('/reward_events')&&m==='GET'){const like=u.searchParams.get('event_key');assert.equal(like,'like.world3d:*');return J(db.events.filter(e=>e.event_key.startsWith('world3d:')));}
  if(p.endsWith('/rpc/mkty_restore_lives'))return J(db.player);
  if(p.endsWith('/rpc/mkty_rate_limit'))return J({allowed:true});
  if(p.endsWith('/rpc/mkty_reward')){
   if(db.events.find(e=>e.event_key===b.p_key))return J({inserted:false,player:db.player});
   if(db.player.balance_locked_at&&b.p_points>0)return J({error:'locked'});
   db.events.push({event_key:b.p_key,event_type:b.p_type,points:b.p_points,created_at:b.p_now});db.player.moon_points+=b.p_points;return J({inserted:true,player:db.player});
  }
  if(p.endsWith('/rpc/mkty_world_save')){
   if(b.p_snapshot==null)return J({revision:db.save.revision,snapshot:db.save.snapshot});
   if(b.p_expected!==db.save.revision)return J({conflict:true,revision:db.save.revision,snapshot:db.save.snapshot});
   db.save={revision:db.save.revision+1,snapshot:b.p_snapshot};return J({revision:db.save.revision});
  }
  if(p.includes('/rpc/'))return J({});
  return J([]);
 };
 const h=createHandler({url:'https://x.supabase.co',key:'k',fetcher,verify:async()=>({id:42,first_name:'Pilot'}),clock:()=>new Date(now),rateLimit:true,sessionSecret:'test-session-secret-not-real'});
 const call=async(action,extra={})=>{const r=await h(new Request('https://x/rewards',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://moonkattymky.github.io'},body:JSON.stringify({initData:'x',action,...extra})}));return {status:r.status,...await r.json()};};
 // spec table
 assert.equal(worldRewardSpec('quest:launch',{stars:3,day:'d'}).points,45);
 assert.equal(worldRewardSpec('quest:launch',{stars:99,day:'d'}).points,45);
 assert.throws(()=>worldRewardSpec('quest:hack'));assert.throws(()=>worldRewardSpec('crystal:10',{day:'d'}));assert.throws(()=>worldRewardSpec('points:9999'));
 let r=await call('world.state');assert.equal(r.ok,true);assert.equal(r.save.revision,0);assert.equal(r.world.daily_cap,300);
 // save CAS
 r=await call('world.save',{revision:0,snapshot:{v:2,ch1:{done:['power']}}});assert.equal(r.revision,1);
 r=await call('world.save',{revision:0,snapshot:{v:2}});assert.equal(r.conflict,true);assert.deepEqual(r.snapshot.ch1.done,['power']);
 r=await call('world.save',{revision:1,snapshot:{big:'x'.repeat(70000)}});assert.equal(r.status,413);
 // order enforced
 r=await call('world.reward',{reason:'quest:canyon'});assert.equal(r.status,400);assert.equal(r.error,'order');
 r=await call('world.reward',{reason:'quest:power'});assert.equal(r.awarded,true);assert.equal(r.granted,15);assert.equal(r.player.moon_points,15);
 r=await call('world.reward',{reason:'quest:power'});assert.equal(r.awarded,false);assert.equal(r.duplicate,true);assert.equal(db.player.moon_points,15);
 now+=2000;r=await call('world.reward',{reason:'quest:canyon'});assert.equal(r.error,'too_fast');
 now+=10000;r=await call('world.reward',{reason:'quest:canyon'});assert.equal(r.granted,20);
 // sub rewards + daily crystals, cap 300
 r=await call('world.reward',{reason:'mine:power:0:perfect'});assert.equal(r.granted,10);
 r=await call('world.reward',{reason:'secret:ledge'});assert.equal(r.granted,15);
 r=await call('world.reward',{reason:'crystal:3'});assert.equal(r.granted,3);
 r=await call('world.reward',{reason:'crystal:3'});assert.equal(r.duplicate,true);
 for(const [id] of WORLD_QUESTS.slice(2)){now+=9000;r=await call('world.reward',{reason:'quest:'+id,stars:3});assert.equal(r.ok,true,id+' '+r.error);}
 assert.equal(db.player.moon_points,15+20+10+15+3+25+30+30+35+45+30+50);
 // next UTC day: crystal again
 now+=86400000;r=await call('world.reward',{reason:'crystal:3'});assert.equal(r.granted,3);
 // cap: pre-fill today's ledger
 db.events.push({event_key:'world3d:d:fill',points:298,created_at:new Date(now).toISOString()});
 r=await call('world.reward',{reason:'crystal:4'});assert.equal(r.granted,0);assert.equal(r.capped,true);
 // lives.spend cannot squat world keys
 r=await call('lives.spend',{event_key:'world3d:c1:q:home'});assert.equal(r.error,'event_key');
 // locked balance
 now+=86400000;db.player.balance_locked_at=new Date(now).toISOString();r=await call('world.reward',{reason:'crystal:5'});assert.equal(r.error,'locked');
 console.log('world-server: all checks passed');
})().catch(e=>{console.error(e);process.exit(1);});
