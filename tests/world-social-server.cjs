// Friend help + notify opt-in actions on the rewards handler (synthetic fake PostgREST, no live secrets).
const assert=require('node:assert/strict');
(async()=>{
 const {createHandler}=await import('../server/rewards/core.mjs');
 let now=Date.parse('2026-10-20T10:00:00Z');
 const players=new Map([[1,{telegram_id:1,first_name:'Ann',moon_points:100,lives:9,story_life:1,referred_by:null}],[2,{telegram_id:2,first_name:'Bob',display_name:'Bobby',moon_points:50,lives:9,story_life:1,referred_by:1}],[3,{telegram_id:3,first_name:'Cat',moon_points:0,lives:9,story_life:0,referred_by:null}]]);
 const help=[],prefs=new Map(),queue=new Map(),calls=[];
 const J=(x,s=200)=>new Response(JSON.stringify(x),{status:s});
 const day=()=>new Date(now).toISOString().slice(0,10);
 const fetcher=async(url,opts={})=>{
  const u=new URL(url),p=u.pathname,m=(opts.method||'GET').toUpperCase(),b=opts.body?JSON.parse(opts.body):null,sp=k=>u.searchParams.get(k),eq=k=>sp(k)&&Number(sp(k).slice(3));
  calls.push(m+' '+p);
  if(p.endsWith('/players')){
   if(m==='GET'){if(sp('referred_by'))return J([...players.values()].filter(x=>x.referred_by===eq('referred_by')));const x=players.get(eq('telegram_id'));return J(x?[x]:[]);}
   if(m==='PATCH'){const x=players.get(eq('telegram_id'));Object.assign(x,b);return J([x]);}
  }
  if(p.endsWith('/rpc/mkty_restore_lives'))return J(players.get(b.p_id)||[...players.values()][0]);
  if(p.endsWith('/rpc/mkty_rate_limit'))return J({allowed:true});
  if(p.endsWith('/mkty_world_help')&&m==='GET')return J(help.filter(h=>(!sp('helper_id')||h.helper_id===eq('helper_id'))&&(!sp('target_id')||h.target_id===eq('target_id'))&&h.day===sp('day').slice(3)));
  if(p.endsWith('/rpc/mkty_world_help')){const a=players.get(b.p_helper),t=players.get(b.p_target);if(b.p_helper===b.p_target)return J({error:'self'});if(!a||!t||(a.referred_by!==t.telegram_id&&t.referred_by!==a.telegram_id))return J({error:'not_friend'});const d=b.p_now.slice(0,10);if(help.some(h=>h.helper_id===a.telegram_id&&h.target_id===t.telegram_id&&h.day===d))return J({ok:true,inserted:false,duplicate:true});help.push({helper_id:a.telegram_id,target_id:t.telegram_id,day:d});return J({ok:true,inserted:true});}
  if(p.endsWith('/rpc/mkty_world_help_claim')){const mine=help.filter(h=>h.target_id===b.p_target&&!h.c);mine.forEach(h=>h.c=1);return J({count:mine.length,helpers:mine.map(h=>h.helper_id)});}
  if(p.endsWith('/mkty_notify_prefs')){if(m==='POST'){prefs.set(b.telegram_id,b);return new Response(null,{status:201});}const x=prefs.get(eq('telegram_id'));return J(x?[x]:[]);}
  if(p.endsWith('/mkty_notify_queue')&&m==='DELETE'){for(const k of [...queue.keys()])if(k.startsWith(eq('telegram_id')+':'))queue.delete(k);return new Response(null,{status:204});}
  if(p.endsWith('/rpc/mkty_notify_schedule')){if(!prefs.get(b.p_id)?.opted_in)return J({ok:true,scheduled:false,opted_in:false});if(b.p_due===null){queue.delete(b.p_id+':'+b.p_kind);return J({ok:true,scheduled:false});}queue.set(b.p_id+':'+b.p_kind,b.p_due);return J({ok:true,scheduled:true});}
  if(p.includes('/rpc/'))return J({});
  return J([]);
 };
 const h=createHandler({url:'https://x.supabase.co',key:'k',fetcher,verify:async(d)=>({id:Number(d),first_name:'P'+d}),clock:()=>new Date(now),rateLimit:true,sessionSecret:'test-session-secret-not-real'});
 const call=async(uid,action,extra={})=>{const r=await h(new Request('https://x/rewards',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://moonkattymky.github.io'},body:JSON.stringify({initData:String(uid),action,...extra})}));return {status:r.status,...await r.json()};};
 const pts=()=>[...players.values()].map(x=>x.moon_points).join(',');const before=pts();
 let r=await call(2,'world.friends');assert.equal(r.ok,true);assert.deepEqual(r.friends,[{id:1,name:'P1',helped:false}].map(f=>({...f,name:r.friends[0].name})));assert.equal(r.friends.length,1);
 r=await call(1,'world.friends');assert.deepEqual(r.friends.map(f=>f.id),[2]);
 r=await call(2,'world.help',{friend_id:1});assert.equal(r.inserted,true);
 r=await call(2,'world.help',{friend_id:1});assert.equal(r.duplicate,true);
 r=await call(2,'world.friends');assert.equal(r.friends[0].helped,true);assert.equal(r.given_today,1);
 r=await call(1,'world.friends');assert.equal(r.received_today,1);
 r=await call(3,'world.help',{friend_id:1});assert.equal(r.status,400);assert.equal(r.error,'friend');
 r=await call(2,'world.help',{friend_id:'x'});assert.equal(r.error,'friend');
 r=await call(1,'world.help.claim');assert.deepEqual([r.count,r.helpers],[1,[2]]);
 r=await call(1,'world.help.claim');assert.equal(r.count,0);
 assert.equal(pts(),before,'friend help pays no Moon Points');
 // notifications: schedule is a no-op until opted in; sender reported off
 r=await call(2,'world.notify.status');assert.deepEqual([r.opted_in,r.sender],[false,'off']);
 r=await call(2,'world.notify.schedule',{robot_in:600});assert.equal(r.robot,false);
 r=await call(2,'world.notify.optin',{on:true,lang:'ru'});assert.equal(r.opted_in,true);
 r=await call(2,'world.notify.schedule',{robot_in:600,storage_in:3600});assert.deepEqual([r.robot,r.storage],[true,true]);assert.equal(queue.get('2:robot'),'2026-10-20T10:10:00.000Z');
 r=await call(2,'world.notify.schedule',{robot_in:999999});assert.equal(r.error,'due');
 r=await call(2,'world.notify.schedule',{robot_in:null});assert.equal(queue.has('2:robot'),false);
 r=await call(2,'world.notify.optin',{on:false});assert.equal(r.opted_in,false);assert.equal(queue.size,0);
 assert.ok(!calls.some(c=>/api\.telegram\.org/.test(c)),'no Telegram messages are sent by the rewards function');
 console.log('world-social-server: friend help + notify opt-in checks passed');
})().catch(e=>{console.error(e);process.exit(1);});
