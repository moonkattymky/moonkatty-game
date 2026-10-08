const {atomicFixture}=require('./atomic-rpc-fixture.cjs');
const assert=require('node:assert/strict'),{webcrypto}=require('node:crypto');
(async()=>{
 const {createHandler,verifyTelegram,parseReferrer}=await import('../server/rewards/core.mjs');
 const keys=await webcrypto.subtle.generateKey({name:'Ed25519'},true,['sign','verify']);
 const pub=Buffer.from(await crypto.subtle.exportKey('raw',keys.publicKey)).toString('hex');
 const now=Date.now();
 const signed=async(id,start)=>{
  const o={auth_date:String(Math.floor(now/1000)),user:JSON.stringify({id,first_name:'P'+id})};if(start)o.start_param=start;
  const p=new URLSearchParams(o);
  const fields=[...p].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>k+'='+v).join('\n');
  p.set('signature',Buffer.from(await crypto.subtle.sign('Ed25519',keys.privateKey,new TextEncoder().encode('8659740610:WebAppData\n'+fields))).toString('base64url'));
  return p.toString();
 };
 assert.equal(parseReferrer('ref_42'),42);assert.equal(parseReferrer('ref_0'),null);assert.equal(parseReferrer('ref_x'),null);assert.equal(parseReferrer(null),null);
 // generic fake PostgREST with eq./is.null/gte. filters
 const tables={players:[],reward_events:[],referral_events:[]};
 const match=(row,u)=>[...u.searchParams].every(([k,v])=>{if(['select','limit'].includes(k))return true;
  if(v==='is.null')return row[k]==null; if(v.startsWith('eq.'))return String(row[k])===v.slice(3); if(v.startsWith('gte.'))return new Date(row[k])>=new Date(v.slice(4)); return true;});
 const uniq={players:['telegram_id'],reward_events:['telegram_id','event_key'],referral_events:['inviter_id','referral_id','source_event_key']};
 let fakeTime=now;
 const fetcher=async(url,opts={})=>{
  const u=new URL(url),t=u.pathname.split('/').pop(),m=(opts.method||'GET').toUpperCase(),body=opts.body?JSON.parse(opts.body):null,rows=tables[t];
  if(!rows)return new Response('no',{status:404});
  if(m==='GET')return new Response(JSON.stringify(rows.filter(r=>match(r,u))));
  if(m==='POST'){if(rows.some(r=>uniq[t].every(k=>r[k]===body[k])))return new Response('{}',{status:409});
   const row={referred_by:null,next_life_at:null,final_balance:null,balance_locked_at:null,...body,created_at:new Date(fakeTime-600000).toISOString()};rows.push(row);return new Response(JSON.stringify([row]));}
  if(m==='PATCH'){const hit=rows.filter(r=>match(r,u));hit.forEach(r=>Object.assign(r,body));return new Response(JSON.stringify(hit));}
 };
 const handler=createHandler({url:'https://example.supabase.co',key:'k',verify:x=>verifyTelegram(x,now,pub),fetcher:atomicFixture(fetcher),clock:()=>new Date(fakeTime),referralDailyCap:2});
 const call=async(id,start,action,extra={})=>(await handler(new Request('https://x',{method:'POST',body:JSON.stringify({initData:await signed(id,start),action,...extra})}))).json();
 const pl=id=>tables.players.find(p=>p.telegram_id===id);

 {const probe=await (await handler(new Request('https://x'))).json();assert.equal(probe.ok,true);assert.equal(probe.actions,undefined,'GET probe must not list actions');}
 await call(100,null,'player');                       // inviter exists
 // self-referral ignored
 await call(100,'ref_100','player'); assert.equal(pl(100).referred_by,null);
 // unknown inviter ignored
 await call(201,'ref_999','player'); assert.equal(pl(201).referred_by,null);
 // valid attribution, no points yet
 await call(200,'ref_100','player'); assert.equal(pl(200).referred_by,100);
 assert.equal(pl(100).moon_points,0); assert.equal(pl(200).moon_points,0);
 // cannot be re-attributed to another inviter
 await call(300,null,'player'); await call(200,'ref_300','player'); assert.equal(pl(200).referred_by,100);
 // mutual loop blocked: 100 cannot become referred by 200
 await call(100,'ref_200','player'); assert.equal(pl(100).referred_by,null);
 // forged client claim cannot pay for a non-referral
 const forged=await call(300,null,'referrals.claim',{referral_id:201,source_event_key:'video:1'}); assert.equal(forged.error,'referral');
 // LIFE #1 completion pays both once
 const l1=await call(200,null,'life.complete',{life:1});
 assert.equal(l1.player.moon_points,500+200); assert.equal(l1.referral.inviter_paid,true); assert.equal(pl(100).moon_points,200);
 const l1b=await call(200,null,'life.complete',{life:1}); assert.equal(l1b.awarded,false);
 assert.equal(pl(100).moon_points,200); assert.equal(pl(200).moon_points,700);
 // LIFE #2 pays no referral
 await call(200,null,'life.complete',{life:2}); assert.equal(pl(100).moon_points,200);
 // after LIFE #1 a player can no longer be attributed
 await call(300,null,'life.complete',{life:1}); await call(300,'ref_100','player'); assert.equal(pl(300).referred_by,null);
 // daily cap (2): third activation today pays invitee but not inviter
 for(const id of [401,402]){await call(id,'ref_100','player');await call(id,null,'life.complete',{life:1});}
 assert.equal(pl(100).moon_points,400); assert.equal(pl(402).moon_points,700);
 // inviter's own LIFE#1 (not referred) pays only 500
 await call(100,null,'life.complete',{life:1}); assert.equal(pl(100).moon_points,900);
 const st=await call(100,null,'referrals.stats');
 assert.deepEqual([st.referrals.invited,st.referrals.activated,st.referrals.earned,st.referrals.today],[3,3,400,2]);
 // next UTC day: cap resets
 fakeTime=now+26*3600e3;
 // (signature auth_date checked against fixed now, so keep using same verify clock)
 await call(403,'ref_100','player'); await call(403,null,'life.complete',{life:1}); assert.equal(pl(100).moon_points,1100);
 // stats for a guest without referrals
 const s2=await call(201,null,'referrals.stats'); assert.equal(s2.referrals.invited,0);
 console.log('PASS: referrals — signed start_param attribution, no self/loop/re-attribution, paid once after LIFE #1, daily cap, stats');
})().catch(e=>{console.error(e);process.exitCode=1;});
