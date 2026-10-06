const assert=require('node:assert/strict'),{webcrypto}=require('node:crypto');
(async()=>{
 const {createHandler,verifyTelegram}=await import('../server/rewards/core.mjs');
 const keys=await webcrypto.subtle.generateKey({name:'Ed25519'},true,['sign','verify']);
 const pub=Buffer.from(await crypto.subtle.exportKey('raw',keys.publicKey)).toString('hex');
 const now=Date.now();
 const signed=async(extra={})=>{
  const p=new URLSearchParams({auth_date:String(Math.floor(now/1000)),user:JSON.stringify({id:42,first_name:'Pilot'}),...extra});
  const fields=[...p].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>k+'='+v).join('\n');
  p.set('signature',Buffer.from(await crypto.subtle.sign('Ed25519',keys.privateKey,new TextEncoder().encode('8659740610:WebAppData\n'+fields))).toString('base64url'));
  return p.toString();
 };
 const data=await signed();
 assert.equal((await verifyTelegram(data,now,pub)).id,42);

 // In-memory fake PostgREST
 const db={players:new Map(),rewards:[],referrals:[]};
 const fetcher=async(url,opts={})=>{
  const u=new URL(url), path=u.pathname, method=(opts.method||'GET').toUpperCase();
  const body=opts.body?JSON.parse(opts.body):null;
  if(path.endsWith('/players')){
   if(method==='GET'){
    const id=u.searchParams.get('telegram_id')?.replace('eq.','');
    const row=id?db.players.get(Number(id)):null;
    return new Response(JSON.stringify(row?[row]:[]));
   }
   if(method==='POST'){
    const row={telegram_id:body.telegram_id,username:body.username,first_name:body.first_name,moon_points:0,lives:9,story_life:0,next_life_at:null,final_balance:null,balance_locked_at:null};
    db.players.set(row.telegram_id,row);
    return new Response(JSON.stringify([row]));
   }
   if(method==='PATCH'){
    const id=Number(u.searchParams.get('telegram_id')?.replace('eq.',''));
    const cur=db.players.get(id); Object.assign(cur,body); db.players.set(id,cur);
    return new Response(JSON.stringify([cur]));
   }
  }
  if(path.endsWith('/reward_events')){
   if(method==='GET'){
    const tid=Number(u.searchParams.get('telegram_id')?.replace('eq.',''));
    const key=u.searchParams.get('event_key')?.replace('eq.','');
    const hit=db.rewards.filter(r=>r.telegram_id===tid&&(!key||r.event_key===key));
    return new Response(JSON.stringify(hit));
   }
   if(method==='POST'){
    if(db.rewards.some(r=>r.telegram_id===body.telegram_id&&r.event_key===body.event_key))return new Response('{}',{status:409});
    db.rewards.push({...body,id:db.rewards.length+1});
    return new Response(JSON.stringify([body]));
   }
  }
  if(path.endsWith('/referral_events')){
   if(method==='GET')return new Response(JSON.stringify(db.referrals));
   if(method==='POST'){
    if(db.referrals.some(r=>r.inviter_id===body.inviter_id&&r.referral_id===body.referral_id&&r.source_event_key===body.source_event_key))return new Response('{}',{status:409});
    db.referrals.push(body); return new Response(JSON.stringify([body]));
   }
  }
  return new Response('no',{status:404});
 };

 const handler=createHandler({url:'https://example.supabase.co',key:'service-test-key',verify:x=>verifyTelegram(x,now,pub),fetcher,clock:()=>new Date(now),referralDailyCap:40});

 const get=await handler(new Request('https://x')); assert.equal(get.status,200); assert.equal((await get.json()).service,'rewards');
 assert.equal((await handler(new Request('https://x',{method:'POST',body:'{}'}))).status,401);

 const player1=await (await handler(new Request('https://x',{method:'POST',body:JSON.stringify({initData:data,action:'player'})}))).json();
 assert.equal(player1.ok,true); assert.equal(player1.player.moon_points,0); assert.equal(player1.player.lives,9);

 const life1=await (await handler(new Request('https://x',{method:'POST',body:JSON.stringify({initData:data,action:'life.complete',life:1})}))).json();
 assert.equal(life1.awarded,true); assert.equal(life1.player.moon_points,500); assert.equal(life1.player.story_life,1);

 const life1b=await (await handler(new Request('https://x',{method:'POST',body:JSON.stringify({initData:data,action:'life.complete',life:1,event_key:'life:1:complete'})}))).json();
 assert.equal(life1b.awarded,false); assert.equal(life1b.player.moon_points,500); // idempotent

 const spend=await (await handler(new Request('https://x',{method:'POST',body:JSON.stringify({initData:data,action:'lives.spend',event_key:'hint:1'})}))).json();
 assert.equal(spend.spent,true); assert.equal(spend.player.lives,8);

 const spend2=await (await handler(new Request('https://x',{method:'POST',body:JSON.stringify({initData:data,action:'lives.spend',event_key:'hint:1'})}))).json();
 assert.equal(spend2.duplicate,true); assert.equal(spend2.player.lives,8);

 // lock on life 9
 for(const life of [2,3,4,5,6,7,8,9]){
  const r=await (await handler(new Request('https://x',{method:'POST',body:JSON.stringify({initData:data,action:'life.complete',life})}))).json();
  assert.equal(r.ok,true);
 }
 const locked=db.players.get(42);
 assert.ok(locked.balance_locked_at);
 assert.equal(locked.final_balance,locked.moon_points);

 const afterLock=await (await handler(new Request('https://x',{method:'POST',body:JSON.stringify({initData:data,action:'rewards.verify',event_key:'daily:x',event_type:'daily',points:10})}))).json();
 assert.equal(afterLock.ok,false); assert.equal(afterLock.error,'locked');

 assert.equal((await handler(new Request('https://x',{method:'PUT'}))).status,405);
 assert.equal((await handler(new Request('https://x',{method:'OPTIONS'}))).status,204);
 console.log('PASS: auth, player bootstrap, life.complete idempotent, lives.spend idempotent, LIFE#9 lock, reject post-lock rewards');
})().catch(e=>{console.error(e);process.exitCode=1;});
