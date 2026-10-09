/* Authoritative Moon Points / lives / life-complete. Browser storage is cache only.
   Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in the Edge Function env.
   Telegram initData verified with Ed25519 (same contract as mission-control). */
import {issueSession,verifySession} from './session.mjs';
import {profileFields} from './profile.mjs';
import {createCampaign} from './campaign.mjs';
import {createDaily} from './daily.mjs';
import {createCreator,parseAdminIds} from './creator.mjs';
import {createSocial,channelFromUrl,TELEGRAM_CHANNEL_URL} from './social.mjs';
import {youtubeConfig,authUrl,isSubscribed,YT_SUBSCRIBE_POINTS} from './youtube.mjs';
const ENV=k=>(typeof Deno!=='undefined'&&Deno.env?.get?.(k))||'';
// PUBLIC_KEY is Telegram's published production Ed25519 key for third-party initData validation (public, not a secret).
// Bot id is taken from the TELEGRAM_BOT_TOKEN secret prefix when present.
const BOT_ID=(/^(\d{5,15}):/.exec((typeof Deno!=='undefined'&&Deno.env?.get?.('TELEGRAM_BOT_TOKEN'))||'')||[])[1]||'8659740610',PUBLIC_KEY='e7bf03a2fa4602af4580703d88dda5bb59f32ed8b02a56c187fe7d34caed242d';
import {createPace} from './pace.mjs';
const LIFE_RESTORE_MS=12*60*60*1000, MAX_LIVES=9, LIFE1_MIN_MS=90*1000;
const REFERRAL_BONUS=200, REFERRAL_INVITEE_BONUS=200; // paid once, only after the invitee completes LIFE #1
export function parseReferrer(start_param){const m=/^ref_([1-9][0-9]{0,15})$/.exec(start_param||'');const id=m?Number(m[1]):0;return Number.isSafeInteger(id)&&id>0?id:null;}
const REFERRAL_DAILY_CAP=Number((typeof Deno!=='undefined'&&Deno.env?.get?.('REFERRAL_DAILY_CAP'))||10);
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
 const sp=p.get('start_param');
 return {id:user.id,username:user.username||null,first_name:user.first_name||null,last_name:user.last_name||null,photo_url:user.photo_url||null,start_param:sp&&/^[A-Za-z0-9_-]{1,64}$/.test(sp)?sp:null};
}

const LIFE_REWARDS={1:500,2:500,3:750,4:1000,5:1250,6:1500,7:1750,8:2000,9:3000};

function restHeaders(key,extra={}){
 return {apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'return=representation',...extra};
}

export function createHandler({url,key,fetcher=fetch,verify=verifyTelegram,clock=()=>new Date(),referralDailyCap=REFERRAL_DAILY_CAP,cipherSecret=(typeof Deno!=='undefined'&&Deno.env?.get?.('CIPHER_SECRET'))||'',adminIds=(typeof Deno!=='undefined'&&Deno.env?.get?.('ADMIN_TG_IDS'))||'',botToken=ENV('TELEGRAM_BOT_TOKEN'),telegramChannel=ENV('TELEGRAM_CHANNEL')||channelFromUrl(TELEGRAM_CHANNEL_URL),tgFetcher=fetch,youtube=youtubeConfig({YOUTUBE_OAUTH_ENABLED:ENV('YOUTUBE_OAUTH_ENABLED'),GOOGLE_CLIENT_ID:ENV('GOOGLE_CLIENT_ID'),GOOGLE_CLIENT_SECRET:ENV('GOOGLE_CLIENT_SECRET'),YOUTUBE_CHANNEL_ID:ENV('YOUTUBE_CHANNEL_ID'),YOUTUBE_REDIRECT_URI:ENV('YOUTUBE_REDIRECT_URI')}),ytFetcher=fetch}){
 async function rest(path,opts={}){
  const target=new URL(path,url.endsWith('/')?url:url+'/');
  if(opts.params)for(const [k,v] of Object.entries(opts.params))target.searchParams.set(k,String(v));
  const r=await fetcher(target,{method:opts.method||'GET',headers:restHeaders(key,opts.headers||{}),body:opts.body,signal:AbortSignal.timeout(8000)});
  if(r.status===409)throw Error('duplicate');
  if(!r.ok)throw Error('database:'+r.status);
  if(r.status===204)return null;
  const text=await r.text();return text?JSON.parse(text):null;
 }

 async function ensurePlayer(user){
  const rows=await rest('/rest/v1/players',{params:{select:'*',telegram_id:'eq.'+user.id,limit:1}});
  if(rows?.[0]){await refreshProfile(user,rows[0]);return attachReferrer(await restoreLives(rows[0]),user);}
  const created=await rest('/rest/v1/players',{method:'POST',headers:{Prefer:'return=representation,resolution=ignore-duplicates'},body:JSON.stringify({telegram_id:user.id,username:user.username,first_name:user.first_name,...profileFields(user),moon_points:0,lives:MAX_LIVES,story_life:0})});
  const row=Array.isArray(created)?created[0]:created;
  return attachReferrer(row||(await rest('/rest/v1/players',{params:{select:'*',telegram_id:'eq.'+user.id,limit:1}}))[0],user);
 }

 // Signed start_param ref_<id>: attach once, only before LIFE #1, never self, inviter must exist.
 async function attachReferrer(player,user){
  const inviter=parseReferrer(user.start_param);
  if(!inviter||player.referred_by||inviter===player.telegram_id||Number(player.story_life||0)>0)return player;
  const inv=await rest('/rest/v1/players',{params:{select:'telegram_id,referred_by',telegram_id:'eq.'+inviter,limit:1}});
  if(!inv?.[0]||Number(inv[0].referred_by)===player.telegram_id)return player;
  const rows=await rest('/rest/v1/players',{method:'PATCH',params:{telegram_id:'eq.'+player.telegram_id,referred_by:'is.null',story_life:'eq.0'},body:JSON.stringify({referred_by:inviter,updated_at:clock().toISOString()})});
  return Array.isArray(rows)&&rows[0]?{...player,...rows[0]}:player;
 }

 // Paid exactly once when the invitee's LIFE #1 completion is first recorded server-side.
 async function rpc(name,params){
  const out=await rest('/rest/v1/rpc/'+name,{method:'POST',body:JSON.stringify({...params,p_now:clock().toISOString()})});
  if(out?.error){const e=Error(out.error);if(out.unlock_at)e.unlock_at=out.unlock_at;throw e;}
  return out;
 }
 async function payReferralBonus(invitee){return rpc('mkty_referral',{p_invitee:invitee.telegram_id,p_inviter:Number(invitee.referred_by),p_source:'life1',p_activation:true,p_cap:referralDailyCap});}

 async function referralStats(player){
  const invited=await rest('/rest/v1/players',{params:{select:'telegram_id,story_life',referred_by:'eq.'+player.telegram_id}});
  const paid=await rest('/rest/v1/referral_events',{params:{select:'points,created_at',inviter_id:'eq.'+player.telegram_id}});
  const since=new Date(clock()); since.setUTCHours(0,0,0,0);
  return {invited:invited?.length||0,activated:(invited||[]).filter(r=>Number(r.story_life)>=1).length,earned:(paid||[]).reduce((a,r)=>a+Number(r.points||0),0),today:(paid||[]).filter(r=>new Date(r.created_at||0)>=since).length,daily_cap:Math.max(0,Math.min(10,referralDailyCap)),total_cap:100,bonus:REFERRAL_BONUS,invitee_bonus:REFERRAL_INVITEE_BONUS,referred_by:player.referred_by?true:false};
 }

 // Leaderboard identity refresh on every verified session; never blocks gameplay.
 async function refreshProfile(user,row){const f=profileFields(user);if(row.display_name===f.display_name&&row.photo_url===f.photo_url)return;try{await rest('/rest/v1/players',{method:'PATCH',params:{telegram_id:'eq.'+user.id},headers:{Prefer:'return=minimal'},body:JSON.stringify(f)});Object.assign(row,f);}catch{}}

 async function restoreLives(player){return rpc('mkty_restore_lives',{p_id:player.telegram_id});}

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

 async function insertReward(player,event_key,event_type,points,meta={}){
  const result=await rpc('mkty_reward',{p_id:player.telegram_id,p_key:event_key,p_type:event_type,p_points:points,p_meta:meta});
  Object.assign(player,result.player);return result;
 }
 // The RPC already writes the ledger and balance atomically. Refresh, never add again.
 async function applyPoints(player){return (await rest('/rest/v1/players',{params:{select:'*',telegram_id:'eq.'+player.telegram_id,limit:1}}))?.[0]||player;}
 async function lifeComplete(player,life,proof){
  life=Number(life);if(!Number.isInteger(life)||life<1||life>9)throw Error('life');
  if(life>Number(player.story_life||0)+1)throw Error('life');
  const event_key='life:'+life+':complete';
  if(life>Number(player.story_life||0))await pace.assertUnlocked(player,life);
  // Anti-bot floor: LIFE #1 (video + several tasks) cannot honestly be finished within 90 s of the first launch.
  // The client keeps the completion queued and retries, so a real player never loses the reward.
  if(life===1&&!Number(player.story_life||0)){const born=Date.parse(player.created_at||'');if(Number.isFinite(born)&&clock().getTime()-born<LIFE1_MIN_MS)throw Error('too_fast');}
  if(life>Number(player.story_life||0))await campaign.verify(player,life,proof);
  const result=await insertReward(player,event_key,'life.complete',LIFE_REWARDS[life]);
  let next=result.player,referral=null;
  // Retry a missed referral transaction even if the chapter was already recorded.
  if(life===1&&next.referred_by){const r=await payReferralBonus(next);next=r.invitee;referral={invitee_points:r.invitee_points||0,inviter_paid:r.inviter_paid};}
  return {player:next,awarded:result.inserted,points:result.inserted?LIFE_REWARDS[life]:0,event_key,...(referral?{referral}:{})};
 }
 async function spendLife(player,event_key){
  if(typeof event_key!=='string'||event_key.length<3||event_key.length>200||/^(chapter:|life:[1-9]:complete$|referral:|daily:|cipher:|streak:|youtube:|creator:)/.test(event_key))throw Error('event_key');
  const r=await insertReward(player,event_key,'life.spend',0);
  return {player:r.player,spent:r.inserted,duplicate:!r.inserted};
 }
 async function verifyReward(player){
  if(player.balance_locked_at)throw Error('locked');
  // There is deliberately no public "arbitrary points" action. All rewards need a verified path.
  throw Error('unverified');
 }
 async function claimReferral(player,referral_id,source_event_key){
  referral_id=Number(referral_id);
  if(!Number.isSafeInteger(referral_id)||referral_id<=0||referral_id===player.telegram_id)throw Error('referral');
  if(typeof source_event_key!=='string'||source_event_key.length<3||source_event_key.length>200)throw Error('source');
  const r=await rpc('mkty_referral',{p_invitee:referral_id,p_inviter:player.telegram_id,p_source:source_event_key,p_activation:false,p_cap:referralDailyCap});
  return {player:r.player,awarded:r.awarded,duplicate:!r.awarded};
 }

 const pace=createPace({rest,clock,insertReward});
 const campaign=createCampaign({rpc,pace,clock});
 const daily=createDaily({rest,clock,insertReward,applyPoints,secret:cipherSecret});

 const creator=createCreator({rest,clock,insertReward,applyPoints,adminIds:adminIds instanceof Set?adminIds:parseAdminIds(adminIds)});
 const social=createSocial({rest,clock,insertReward,applyPoints,isAdmin:creator.isAdmin,secret:cipherSecret,botToken,channel:telegramChannel,fetcher:tgFetcher,youtube});
 return async request=>{
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(request.method==='GET'){
   // Health / contract probe — no secrets leaked
   return json({ok:true,service:'rewards',version:'20261009-prelaunch-1',configuration_ready:!!cipherSecret.trim()});
  }
  if(request.method!=='POST')return json({ok:false,error:'method'},405);
  if(!url||!key)return json({ok:false,error:'unavailable'},503);
  let body;
  try{
   if(Number(request.headers.get('Content-Length'))>400000)return json({ok:false,error:'body'},413);
   const raw=await request.text();
   if(raw.length>400000)return json({ok:false,error:'body'},413);
   body=JSON.parse(raw);if(!body||typeof body!=='object'||Array.isArray(body))throw Error('body');
  }catch{return json({ok:false,error:'body'},400);}
  let user;
  try{user=body.session?await verifySession(body.session,key,clock().getTime()):await verify(body.initData);}catch{return json({ok:false,error:'auth'},401);}
  try{
   let player=await ensurePlayer(user);
   const action=body.action||'player';
   if(action==='session'){if(body.session)throw Error('auth');return json({ok:true,session:await issueSession(user,key,clock().getTime()),player:publicPlayer(player),pace:await pace.status(player)});}
   if(action==='player')return json({ok:true,player:publicPlayer(player),pace:await pace.status(player)});
   if(action==='chapter.status')return json({ok:true,pace:await pace.status(player),player:publicPlayer(player)});
   if(action==='chapter.skip'){const r=await pace.skip(player,body.life);return json({ok:true,...r,pace:await pace.status(player),player:publicPlayer(player)});}
   if(action==='campaign.open')return json({ok:true,route:await campaign.open(player,body)});
   if(action==='campaign.cloud')return json({ok:true,...await campaign.cloud(player,body)});
   if(action==='life.complete'){
    const result=await lifeComplete(player,body.life,body.proof);
    return json({ok:true,...result,player:publicPlayer(result.player),pace:await pace.status(result.player)});
   }
   if(action==='rewards.verify'){
    const result=await verifyReward(player,body.event_key,body.event_type,body.points);
    return json({ok:true,...result,player:publicPlayer(result.player)});
   }
   if(action==='lives.spend'){
    const result=await spendLife(player,body.event_key);
    return json({ok:true,...result,player:publicPlayer(result.player)});
   }
   if(action==='referrals.stats')return json({ok:true,referrals:await referralStats(player),player:publicPlayer(player)});
   if(action==='referrals.claim'){
    const result=await claimReferral(player,body.referral_id,body.source_event_key);
    return json({ok:true,...result,player:publicPlayer(result.player)});
   }
   if(action==='daily.status')return json({ok:true,...await daily.status(player),player:publicPlayer(player)});
   if(action==='cipher.solve'){const r=await daily.solveCipher(player,body.answer);return json({ok:true,...r,player:publicPlayer(r.player)});}
   if(action==='streak.checkin'){const r=await daily.checkin(player);return json({ok:true,...r,player:publicPlayer(r.player)});}
   if(action==='youtube.redeem'){const r=await daily.redeemCode(player,body.code);return json({ok:true,...r,player:publicPlayer(r.player)});}
   if(action==='creator.status')return json({ok:true,...await creator.mine(player),is_admin:creator.isAdmin(user),player:publicPlayer(player)});
   if(action==='creator.submit')return json({ok:true,...await creator.submit(player,body),player:publicPlayer(player)});
   if(action==='admin.creator.list')return json({ok:true,...await creator.adminList(user,body)});
   if(action==='admin.creator.review')return json({ok:true,...await creator.adminReview(user,body)});
   if(action==='admin.creator.tier')return json({ok:true,...await creator.adminTier(user,body)});
   if(action==='social.status')return json({ok:true,...await social.mine(player),is_admin:creator.isAdmin(user),player:publicPlayer(player)});
   if(action==='social.telegram.verify'){const r=await social.verifyTelegram(player);return json({ok:true,...r,player:publicPlayer(r.player)});}
   if(action==='social.submit')return json({ok:true,...await social.submit(player,body),player:publicPlayer(player)});
   if(action==='social.youtube.verify'){
    if(!youtube.enabled)return json({ok:false,error:'disabled'},409);
    if(!body.code)return json({ok:true,auth_url:authUrl(youtube,'yt_'+player.telegram_id)});
    if(player.balance_locked_at)throw Error('locked');
    let sub=false;try{sub=await isSubscribed(youtube,String(body.code),ytFetcher);}catch{return json({ok:false,error:'oauth'},400);}
    if(!sub)return json({ok:true,verified:false,awarded:false,player:publicPlayer(player)});
    const {inserted}=await insertReward(player,'social:youtube:follow','social.youtube_follow',YT_SUBSCRIBE_POINTS);
    const p2=inserted?await applyPoints(player,YT_SUBSCRIBE_POINTS):player;
    return json({ok:true,verified:true,awarded:inserted,points:inserted?YT_SUBSCRIBE_POINTS:0,player:publicPlayer(p2)});
   }
   if(action==='admin.social.list')return json({ok:true,...await social.adminList(user,body)});
   if(action==='admin.social.review')return json({ok:true,...await social.adminReview(user,body)});
   return json({ok:false,error:'action'},400);
  }catch(e){
   const msg=String(e.message||e);
   if(msg==='locked')return json({ok:false,error:'locked'},409);
   if(msg==='no_lives')return json({ok:false,error:'no_lives'},409);
   if(msg==='chapter_locked')return json({ok:false,error:'chapter_locked',unlock_at:e.unlock_at||null},409);
   if(msg==='too_fast')return json({ok:false,error:'too_fast'},409);
   if(msg==='no_skips')return json({ok:false,error:'no_skips'},409);
   if(msg==='no_attempts')return json({ok:false,error:'no_attempts'},429);
   if(msg==='answer'||msg==='code')return json({ok:false,error:msg},400);
   if(msg==='forbidden')return json({ok:false,error:'forbidden'},403);
   if(msg==='weekly')return json({ok:false,error:'weekly'},429);
   if(msg==='duplicate_url'||msg==='reviewed'||msg==='not_approved')return json({ok:false,error:msg},409);
   if(msg==='url'||msg==='hashtag'||msg==='own'||msg==='submission'||msg==='decision'||msg==='tier')return json({ok:false,error:msg},400);
   if(msg==='already'||msg==='duplicate_proof')return json({ok:false,error:msg},409);
   if(msg==='daily_limit'||msg==='pending_limit')return json({ok:false,error:msg},429);
   if(msg==='proof_required')return json({ok:false,error:msg},409);
   if(msg==='snapshot')return json({ok:false,error:msg},400);
   if(msg==='snapshot_too_large')return json({ok:false,error:msg},413);
   if(msg==='proof'||msg==='platform'||msg==='kind'||msg==='unverified')return json({ok:false,error:msg},400);
   if(msg==='cap')return json({ok:false,error:'cap'},429);
   if(msg==='life'||msg==='event_key'||msg==='event_type'||msg==='points'||msg==='referral'||msg==='source'||msg==='use_life_complete')return json({ok:false,error:msg},400);
   return json({ok:false,error:'unavailable'},503);
  }
 };
}
