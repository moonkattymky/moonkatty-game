/* Authoritative Moon Points / lives / life-complete. Browser storage is cache only.
   Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in the Edge Function env.
   Telegram initData verified with Ed25519 (same contract as mission-control). */
import {createDaily} from './daily.mjs';
const BOT_ID='8659740610',PUBLIC_KEY='e7bf03a2fa4602af4580703d88dda5bb59f32ed8b02a56c187fe7d34caed242d';
const LIFE_RESTORE_MS=12*60*60*1000, MAX_LIVES=9;
const REFERRAL_DAILY_CAP=Number((typeof Deno!=='undefined'&&Deno.env?.get?.('REFERRAL_DAILY_CAP'))||40);
const enc=new TextEncoder(),cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'GET, POST, OPTIONS'};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});

export async function verifyTelegram(initData,now=Date.now(),publicKey=PUBLIC_KEY){
 if(typeof initData!=='string'||initData.length>10000)throw Error('auth');
 const p=new URLSearchParams(initData);
 if(new Set(p.keys()).size!==[...p.keys()].length)throw Error('auth');
 const signature=p.get('signature'),raw=p.get('user'),date=Number(p.get('auth_date'));
 if(!signature||!raw||!Number.isInteger(date)||date>now/1000+60||now/1000-date>600)throw Error('auth');
 const fields=[...p].filter(([k])=>k!=='hash'&&k!=='signature').sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>k+'='+v).join('\n');
 const key=await crypto.subtle.importKey('raw',Uint8Array.from(publicKey.match(/../g),x=>parseInt(x,16)),{name:'Ed25519'},false,['verify']);
 const sig=signature.replace(/-/g,'+').replace(/_/g,'/');
 const bytes=Uint8Array.from(atob(sig+'='.repeat((4-sig.length%4)%4)),x=>x.charCodeAt(0));
 if(!await crypto.subtle.verify('Ed25519',key,bytes,enc.encode(BOT_ID+':WebAppData\n'+fields)))throw Error('auth');
 const user=JSON.parse(raw);if(!Number.isSafeInteger(user?.id)||user.id<=0)throw Error('auth');
 return {id:user.id,username:user.username||null,first_name:user.first_name||null};
}

const LIFE_REWARDS={1:500,2:500,3:750,4:1000,5:1250,6:1500,7:1750,8:2000,9:3000};

function restHeaders(key,extra={}){
 return {apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'return=representation',...extra};
}

export function createHandler({url,key,fetcher=fetch,verify=verifyTelegram,clock=()=>new Date(),referralDailyCap=REFERRAL_DAILY_CAP,cipherSecret=(typeof Deno!=='undefined'&&Deno.env?.get?.('CIPHER_SECRET'))||''}){
 async function rest(path,opts={}){
  const target=new URL(path,url.endsWith('/')?url:url+'/');
  if(opts.params)for(const [k,v] of Object.entries(opts.params))target.searchParams.set(k,String(v));
  const r=await fetcher(target,{method:opts.method||'GET',headers:restHeaders(key,opts.headers||{}),body:opts.body,signal:AbortSignal.timeout(8000)});
  if(r.status===409)throw Error('duplicate');
  if(!r.ok){const t=await r.text().catch(()=>'');throw Error('database:'+r.status+':'+t.slice(0,200));}
  if(r.status===204)return null;
  const text=await r.text();return text?JSON.parse(text):null;
 }

 async function ensurePlayer(user){
  const rows=await rest('/rest/v1/players',{params:{select:'*',telegram_id:'eq.'+user.id,limit:1}});
  if(rows?.[0])return restoreLives(rows[0]);
  const created=await rest('/rest/v1/players',{method:'POST',headers:{Prefer:'return=representation,resolution=merge-duplicates'},body:JSON.stringify({telegram_id:user.id,username:user.username,first_name:user.first_name,moon_points:0,lives:MAX_LIVES,story_life:0})});
  return Array.isArray(created)?created[0]:created;
 }

 async function restoreLives(player){
  const now=clock();
  let lives=Number(player.lives), next=player.next_life_at?new Date(player.next_life_at):null;
  if(lives<MAX_LIVES && next && now>=next){
   const gained=Math.floor((now-next)/LIFE_RESTORE_MS)+1;
   lives=Math.min(MAX_LIVES,lives+gained);
   next=lives<MAX_LIVES?new Date(next.getTime()+gained*LIFE_RESTORE_MS):null;
   await rest('/rest/v1/players',{method:'PATCH',params:{telegram_id:'eq.'+player.telegram_id},body:JSON.stringify({lives,next_life_at:next?next.toISOString():null,updated_at:now.toISOString()})});
   player={...player,lives,next_life_at:next?next.toISOString():null};
  }
  return player;
 }

 function publicPlayer(p){
  return {
   telegram_id:p.telegram_id,
   moon_points:p.moon_points,
   lives:p.lives,
   next_life_at:p.next_life_at||null,
   story_life:p.story_life,
   final_balance:p.final_balance??null,
   balance_locked_at:p.balance_locked_at||null
  };
 }

 async function insertReward(player,event_key,event_type,points){
  if(player.balance_locked_at && points>0)throw Error('locked');
  // Idempotent: unique (telegram_id, event_key)
  try{
   const rows=await rest('/rest/v1/reward_events',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({telegram_id:player.telegram_id,event_key,event_type,points,verified:true})});
   return {inserted:true,row:Array.isArray(rows)?rows[0]:rows};
  }catch(e){
   const msg=String(e.message||e);
   if(msg==='duplicate'||msg.includes('23505')||msg.toLowerCase().includes('duplicate')||msg.includes('409')){
    const existing=await rest('/rest/v1/reward_events',{params:{select:'*',telegram_id:'eq.'+player.telegram_id,event_key:'eq.'+event_key,limit:1}});
    return {inserted:false,row:existing?.[0]||null};
   }
   throw e;
  }
 }

 async function applyPoints(player,delta){
  if(delta===0)return player;
  if(player.balance_locked_at && delta>0)throw Error('locked');
  const moon_points=Math.max(0,Number(player.moon_points)+delta);
  const patch={moon_points,updated_at:clock().toISOString()};
  const rows=await rest('/rest/v1/players',{method:'PATCH',params:{telegram_id:'eq.'+player.telegram_id},body:JSON.stringify(patch)});
  return Array.isArray(rows)?{...player,...rows[0]}:{...player,...patch};
 }

 async function lifeComplete(player,life,event_key){
  life=Number(life);
  if(!Number.isInteger(life)||life<1||life>9)throw Error('life');
  const points=LIFE_REWARDS[life];
  const key=event_key||('life:'+life+':complete');
  const {inserted}=await insertReward(player,key,'life.complete',points);
  let next=player;
  if(inserted){
   next=await applyPoints(player,points);
   const story_life=Math.max(Number(next.story_life||0),life);
   const patch={story_life,updated_at:clock().toISOString()};
   if(life===9 && !next.balance_locked_at){
    patch.final_balance=Number(next.moon_points);
    patch.balance_locked_at=clock().toISOString();
   }
   const rows=await rest('/rest/v1/players',{method:'PATCH',params:{telegram_id:'eq.'+player.telegram_id},body:JSON.stringify(patch)});
   next=Array.isArray(rows)?{...next,...rows[0]}:{...next,...patch};
  }else{
   // already paid — refresh
   const rows=await rest('/rest/v1/players',{params:{select:'*',telegram_id:'eq.'+player.telegram_id,limit:1}});
   next=rows?.[0]||player;
  }
  return {player:next,awarded:inserted,points:inserted?points:0,event_key:key};
 }

 async function spendLife(player,event_key){
  const key=event_key||('life:spend:'+clock().toISOString());
  // Idempotent spend marker (0 points) so retries don't double-charge lives
  const existing=await rest('/rest/v1/reward_events',{params:{select:'id',telegram_id:'eq.'+player.telegram_id,event_key:'eq.'+key,limit:1}});
  if(existing?.[0]){
   const rows=await rest('/rest/v1/players',{params:{select:'*',telegram_id:'eq.'+player.telegram_id,limit:1}});
   return {player:rows?.[0]||player,spent:false,duplicate:true};
  }
  player=await restoreLives(player);
  if(Number(player.lives)<=0)throw Error('no_lives');
  const lives=Number(player.lives)-1;
  // next_life_at = when the NEXT life will restore (12h from now if no timer yet)
  const next_life_at=player.next_life_at||new Date(clock().getTime()+LIFE_RESTORE_MS).toISOString();
  await insertReward(player,key,'life.spend',0);
  const rows=await rest('/rest/v1/players',{method:'PATCH',params:{telegram_id:'eq.'+player.telegram_id},body:JSON.stringify({lives,next_life_at,updated_at:clock().toISOString()})});
  const next=Array.isArray(rows)?{...player,...rows[0]}:{...player,lives,next_life_at};
  return {player:next,spent:true,duplicate:false};
 }

 async function verifyReward(player,event_key,event_type,points){
  if(typeof event_key!=='string'||event_key.length<3||event_key.length>200)throw Error('event_key');
  if(typeof event_type!=='string'||event_type.length<2||event_type.length>64)throw Error('event_type');
  points=Number(points);
  if(!Number.isInteger(points)||points<0||points>5000)throw Error('points');
  // Reject client-invented life.complete amounts — those go through lifeComplete
  if(event_type==='life.complete')throw Error('use_life_complete');
  const {inserted}=await insertReward(player,event_key,event_type,points);
  let next=player;
  if(inserted && points>0) next=await applyPoints(player,points);
  else {
   const rows=await rest('/rest/v1/players',{params:{select:'*',telegram_id:'eq.'+player.telegram_id,limit:1}});
   next=rows?.[0]||player;
  }
  return {player:next,awarded:inserted,points:inserted?points:0,event_key};
 }

 async function claimReferral(player,referral_id,source_event_key){
  referral_id=Number(referral_id);
  if(!Number.isSafeInteger(referral_id)||referral_id<=0||referral_id===player.telegram_id)throw Error('referral');
  if(typeof source_event_key!=='string'||source_event_key.length<3)throw Error('source');
  // daily cap
  const since=new Date(clock()); since.setUTCHours(0,0,0,0);
  const dayRows=await rest('/rest/v1/referral_events',{params:{select:'id',inviter_id:'eq.'+player.telegram_id,created_at:'gte.'+since.toISOString()}});
  if((dayRows?.length||0)>=referralDailyCap)throw Error('cap');
  try{
   await rest('/rest/v1/referral_events',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({inviter_id:player.telegram_id,referral_id,source_event_key,points:1})});
  }catch(e){
   const msg=String(e.message||e);
   if(msg==='duplicate'||msg.includes('23505')||msg.toLowerCase().includes('duplicate')||msg.includes('409')){
    const rows=await rest('/rest/v1/players',{params:{select:'*',telegram_id:'eq.'+player.telegram_id,limit:1}});
    return {player:rows?.[0]||player,awarded:false,duplicate:true};
   }
   throw e;
  }
  const event_key='referral:'+referral_id+':'+source_event_key;
  const {inserted}=await insertReward(player,event_key,'referral.claim',1);
  let next=player;
  if(inserted) next=await applyPoints(player,1);
  return {player:next,awarded:inserted,duplicate:false};
 }

 const daily=createDaily({rest,clock,insertReward,applyPoints,secret:cipherSecret});
 return async request=>{
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(request.method==='GET'){
   // Health / contract probe — no secrets leaked
   return json({ok:true,service:'rewards',actions:['player','life.complete','rewards.verify','lives.spend','referrals.claim','daily.status','cipher.solve','streak.checkin','youtube.redeem']});
  }
  if(request.method!=='POST')return json({ok:false,error:'method'},405);
  if(!url||!key)return json({ok:false,error:'unavailable'},503);
  let body;
  try{
   if(Number(request.headers.get('Content-Length'))>12000)return json({ok:false,error:'body'},413);
   const raw=await request.text();
   if(raw.length>12000)return json({ok:false,error:'body'},413);
   body=JSON.parse(raw);
  }catch{return json({ok:false,error:'body'},400);}
  let user;
  try{user=await verify(body.initData);}catch{return json({ok:false,error:'auth'},401);}
  try{
   let player=await ensurePlayer(user);
   const action=body.action||'player';
   if(action==='player')return json({ok:true,player:publicPlayer(player)});
   if(action==='life.complete'){
    const result=await lifeComplete(player,body.life,body.event_key);
    return json({ok:true,...result,player:publicPlayer(result.player)});
   }
   if(action==='rewards.verify'){
    const result=await verifyReward(player,body.event_key,body.event_type,body.points);
    return json({ok:true,...result,player:publicPlayer(result.player)});
   }
   if(action==='lives.spend'){
    const result=await spendLife(player,body.event_key);
    return json({ok:true,...result,player:publicPlayer(result.player)});
   }
   if(action==='referrals.claim'){
    const result=await claimReferral(player,body.referral_id,body.source_event_key);
    return json({ok:true,...result,player:publicPlayer(result.player)});
   }
   if(action==='daily.status')return json({ok:true,...await daily.status(player),player:publicPlayer(player)});
   if(action==='cipher.solve'){const r=await daily.solveCipher(player,body.answer);return json({ok:true,...r,player:publicPlayer(r.player)});}
   if(action==='streak.checkin'){const r=await daily.checkin(player);return json({ok:true,...r,player:publicPlayer(r.player)});}
   if(action==='youtube.redeem'){const r=await daily.redeemCode(player,body.code);return json({ok:true,...r,player:publicPlayer(r.player)});}
   return json({ok:false,error:'action'},400);
  }catch(e){
   const msg=String(e.message||e);
   if(msg==='locked')return json({ok:false,error:'locked'},409);
   if(msg==='no_lives')return json({ok:false,error:'no_lives'},409);
   if(msg==='no_attempts')return json({ok:false,error:'no_attempts'},429);
   if(msg==='answer'||msg==='code')return json({ok:false,error:msg},400);
   if(msg==='cap')return json({ok:false,error:'cap'},429);
   if(msg==='life'||msg==='event_key'||msg==='event_type'||msg==='points'||msg==='referral'||msg==='source'||msg==='use_life_complete')return json({ok:false,error:msg},400);
   return json({ok:false,error:'unavailable'},503);
  }
 };
}
