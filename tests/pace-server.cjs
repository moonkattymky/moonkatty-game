const {atomicFixture}=require('./atomic-rpc-fixture.cjs');
/* Chapter pacing (one chapter per UTC day), referral skips, life loss on failure — server side. */
const assert=require('node:assert/strict');
(async()=>{
 const {createHandler}=await import('../server/rewards/core.mjs');
 const {unlockAt,nextUtcMidnight,PACING_SINCE}=await import('../server/rewards/pace.mjs');
 // Pure rule
 const t=Date.parse('2026-10-10T21:30:00Z');
 assert.equal(nextUtcMidnight(t),Date.parse('2026-10-11T00:00:00Z'));
 assert.equal(nextUtcMidnight(Date.parse('2026-10-10T00:00:00Z')),Date.parse('2026-10-11T00:00:00Z'));
 assert.equal(unlockAt({life:2,storyLife:1,completedAt:t}),Date.parse('2026-10-11T00:00:00Z'));
 assert.equal(unlockAt({life:1,storyLife:0,completedAt:null}),0,'LIFE #1 always open');
 assert.equal(unlockAt({life:5,storyLife:5,completedAt:t}),0,'completed chapters never relock');
 assert.equal(unlockAt({life:5,storyLife:4,completedAt:PACING_SINCE-1}),0,'grandfathered pre-pacing completion');
 assert.equal(unlockAt({life:5,storyLife:4,completedAt:null}),0,'no timestamp: grandfathered');
 assert.equal(unlockAt({life:5,storyLife:4,completedAt:t,skipped:true}),0);

 let now=Date.parse('2026-10-10T10:00:00Z');
 const db={players:new Map(),rewards:[],referrals:[]};
 const eq=(u,k)=>u.searchParams.get(k)?.replace(/^eq\./,'');
 const fetcher=async(url,opts={})=>{
  const u=new URL(url),path=u.pathname,method=(opts.method||'GET').toUpperCase(),body=opts.body?JSON.parse(opts.body):null;
  if(path.endsWith('/players')){
   if(method==='GET'){const id=eq(u,'telegram_id'),ref=eq(u,'referred_by');let rows=[...db.players.values()];if(id)rows=rows.filter(r=>String(r.telegram_id)===id);if(ref)rows=rows.filter(r=>String(r.referred_by)===ref);return new Response(JSON.stringify(rows));}
   if(method==='POST'){const row={telegram_id:body.telegram_id,moon_points:0,lives:9,story_life:0,next_life_at:null,final_balance:null,balance_locked_at:null,referred_by:null};db.players.set(row.telegram_id,row);return new Response(JSON.stringify([row]));}
   if(method==='PATCH'){const cur=db.players.get(Number(eq(u,'telegram_id')));Object.assign(cur,body);return new Response(JSON.stringify([cur]));}
  }
  if(path.endsWith('/reward_events')){
   if(method==='GET'){const tid=Number(eq(u,'telegram_id')),key=eq(u,'event_key'),type=eq(u,'event_type');return new Response(JSON.stringify(db.rewards.filter(r=>r.telegram_id===tid&&(!key||r.event_key===key)&&(!type||r.event_type===type))));}
   if(method==='POST'){if(db.rewards.some(r=>r.telegram_id===body.telegram_id&&r.event_key===body.event_key))return new Response('{}',{status:409});const row={...body,id:db.rewards.length+1,created_at:new Date(now).toISOString()};db.rewards.push(row);return new Response(JSON.stringify([row]));}
  }
  if(path.endsWith('/referral_events')){if(method==='GET')return new Response('[]');return new Response('[{}]');}
  return new Response('no',{status:404});
 };
 const handler=createHandler({url:'https://example.supabase.co',key:'k',verify:async d=>({id:Number(d),start_param:null}),fetcher:atomicFixture(fetcher),clock:()=>new Date(now)});
 const call=async(id,action,extra={})=>{const r=await handler(new Request('https://x',{method:'POST',body:JSON.stringify({initData:String(id),action,...extra})}));return {status:r.status,...await r.json()};};

 // Fresh player: LIFE #1 open, completes, LIFE #2 locked until next 00:00 UTC
 let r=await call(7,'player');assert.equal(r.pace.next_life,1);assert.equal(r.pace.locked,false);
 r=await call(7,'life.complete',{life:1});assert.equal(r.awarded,true);assert.equal(r.pace.next_life,2);assert.equal(r.pace.unlock_at,'2026-10-11T00:00:00.000Z');assert.equal(r.pace.locked,true);
 r=await call(7,'life.complete',{life:2});assert.equal(r.status,409);assert.equal(r.error,'chapter_locked');assert.equal(r.unlock_at,'2026-10-11T00:00:00.000Z');
 assert.equal(db.players.get(7).moon_points,500,'no reward for locked chapter');
 // Client-chosen event keys cannot dodge the canonical completion record
 r=await call(7,'life.complete',{life:2,event_key:'life:2:other'});assert.equal(r.error,'chapter_locked');
 r=await call(7,'rewards.verify',{event_key:'chapter:skip:2',event_type:'chapter.skip',points:0});assert.equal(r.status,400);
 r=await call(7,'lives.spend',{event_key:'chapter:skip:2'});assert.equal(r.status,400);
 // Replaying LIFE #1 (already complete) stays idempotent and never locks
 r=await call(7,'life.complete',{life:1});assert.equal(r.ok,true);assert.equal(r.awarded,false);
 // One second before midnight: still locked; at midnight: open
 now=Date.parse('2026-10-10T23:59:59Z');r=await call(7,'life.complete',{life:2});assert.equal(r.error,'chapter_locked');
 now=Date.parse('2026-10-11T00:00:00Z');r=await call(7,'life.complete',{life:2});assert.equal(r.awarded,true);assert.equal(r.pace.unlock_at,'2026-10-12T00:00:00.000Z');
 // Completing late in a UTC day still gives the next chapter at the following midnight
 now=Date.parse('2026-10-12T23:50:00Z');r=await call(7,'life.complete',{life:3});assert.equal(r.awarded,true);assert.equal(r.pace.unlock_at,'2026-10-13T00:00:00.000Z');

 // Referral skip: no skips without an activated friend
 r=await call(7,'chapter.skip',{life:4});assert.equal(r.error,'no_skips');
 await call(8,'player');db.players.get(8).referred_by=7;r=await call(7,'player');assert.equal(r.pace.skips,0,'friend must complete LIFE #1');
 await call(8,'life.complete',{life:1});r=await call(7,'player');assert.equal(r.pace.skips,1);
 r=await call(7,'chapter.skip',{life:5});assert.equal(r.status,400,'only the next chapter can be skipped');
 r=await call(7,'chapter.skip',{life:4});assert.equal(r.skipped,true);assert.equal(r.pace.locked,false);assert.equal(r.pace.skips,0);
 r=await call(7,'life.complete',{life:4});assert.equal(r.awarded,true);
 r=await call(7,'chapter.skip',{life:5});assert.equal(r.error,'no_skips','one skip per activated referral');

 // Grandfathering: existing player already at LIFE #6 with pre-pacing history
 db.players.set(9,{telegram_id:9,moon_points:9000,lives:9,story_life:6,next_life_at:null,final_balance:null,balance_locked_at:null,referred_by:null});
 db.rewards.push({telegram_id:9,event_key:'life:6:complete',event_type:'life.complete',points:1500,created_at:'2026-10-06T12:00:00Z'});
 r=await call(9,'player');assert.equal(r.pace.locked,false);
 r=await call(9,'life.complete',{life:3});assert.equal(r.ok,true,'completed chapters never relock');
 r=await call(9,'life.complete',{life:7});assert.equal(r.awarded,true);assert.equal(r.pace.locked,true);

 // Life loss on failure: global lives, 12h restore, 0 lives blocks
 for(let i=0;i<9;i++){r=await call(9,'lives.spend',{event_key:'life:fail:c8:board:'+i});assert.equal(r.spent,true);}
 assert.equal(r.player.lives,0);
 r=await call(9,'lives.spend',{event_key:'life:fail:c8:board:x'});assert.equal(r.error,'no_lives');
 r=await call(9,'lives.spend',{event_key:'life:fail:c8:board:3'});assert.equal(r.duplicate,true,'same failure never charged twice');
 now+=12*3600e3;r=await call(9,'player');assert.equal(r.player.lives,1);
 console.log('PASS: chapter pacing (UTC day unlock, locked rewards rejected, grandfathering, referral skips) and life loss');
})().catch(e=>{console.error(e);process.exit(1);});
