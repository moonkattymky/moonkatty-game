/* Creator rewards: players submit a link to their own video about MOONKATTY.
   Submissions are stored as pending; only allowlisted admins (ADMIN_TG_IDS secret,
   comma-separated Telegram user ids) can approve/reject and mark view tiers.
   Points are paid through the idempotent reward_events ledger (each event once). */
export const CREATOR_POINTS={base:250,tier_1k:250,tier_10k:500};
export const CREATOR_WEEK_MS=7*24*60*60*1000;
const HASHTAG=/#moonkatty(?![a-z0-9_])/i;

export function parseAdminIds(raw){
 return new Set(String(raw||'').split(/[\s,;]+/).map(s=>s.trim()).filter(s=>/^\d{1,20}$/.test(s)).map(Number).filter(n=>Number.isSafeInteger(n)&&n>0));
}

/** Validate + canonicalise a video URL. Returns {platform,url,url_norm} or throws 'url'. */
export function normalizeVideoUrl(input){
 if(typeof input!=='string')throw Error('url');
 const raw=input.trim();
 if(raw.length<10||raw.length>500||/\s/.test(raw))throw Error('url');
 let u;try{u=new URL(raw);}catch{throw Error('url');}
 if(u.protocol!=='https:'&&u.protocol!=='http:')throw Error('url');
 if(u.username||u.password||(u.port&&u.port!=='443'&&u.port!=='80'))throw Error('url');
 const host=u.hostname.toLowerCase().replace(/^(www\.|m\.|mobile\.|vm\.|vt\.)/,'');
 const sub=u.hostname.toLowerCase();
 const path=u.pathname.replace(/\/+$/,'');
 let m;
 if(host==='youtube.com'||host==='youtu.be'||host==='music.youtube.com'){
  let id=null;
  if(host==='youtu.be')id=path.slice(1);
  else if(path==='/watch')id=u.searchParams.get('v');
  else if((m=path.match(/^\/(shorts|live|embed)\/([^/]+)$/)))id=m[2];
  if(!id||!/^[A-Za-z0-9_-]{11}$/.test(id))throw Error('url');
  return {platform:'youtube',url:'https://www.youtube.com/watch?v='+id,url_norm:'youtube:'+id};
 }
 if(host==='tiktok.com'){
  if((m=path.match(/^\/@([A-Za-z0-9_.]{1,40})\/(video|photo)\/(\d{8,25})$/)))return {platform:'tiktok',url:'https://www.tiktok.com/@'+m[1]+'/'+m[2]+'/'+m[3],url_norm:'tiktok:'+m[3]};
  if(/^(vm|vt)\./.test(sub)&&(m=path.match(/^\/([A-Za-z0-9]{5,20})$/)))return {platform:'tiktok',url:'https://'+sub+'/'+m[1]+'/',url_norm:'tiktok-short:'+m[1]};
  if((m=path.match(/^\/t\/([A-Za-z0-9]{5,20})$/)))return {platform:'tiktok',url:'https://www.tiktok.com/t/'+m[1]+'/',url_norm:'tiktok-short:'+m[1]};
  throw Error('url');
 }
 if(host==='x.com'||host==='twitter.com'){
  if((m=path.match(/^\/([A-Za-z0-9_]{1,15})\/status\/(\d{5,25})(\/video\/\d)?$/))&&!['i','home','search'].includes(m[1].toLowerCase()))return {platform:'x',url:'https://x.com/'+m[1]+'/status/'+m[2],url_norm:'x:'+m[2]};
  throw Error('url');
 }
 if(host==='instagram.com'){
  if((m=path.match(/^(?:\/[A-Za-z0-9_.]{1,30})?\/(reel|reels|p|tv)\/([A-Za-z0-9_-]{5,40})$/)))return {platform:'instagram',url:'https://www.instagram.com/'+(m[1]==='reels'?'reel':m[1])+'/'+m[2]+'/',url_norm:'instagram:'+m[2]};
  throw Error('url');
 }
 throw Error('url');
}

export function createCreator({rest,clock,insertReward,applyPoints,adminIds}){
 const isAdmin=user=>adminIds.has(Number(user?.id));
 const publicSub=s=>({id:s.id,platform:s.platform,url:s.url,status:s.status,created_at:s.created_at,reviewed_at:s.reviewed_at||null,tier_1k:!!s.tier_1k_at,tier_10k:!!s.tier_10k_at,points:Number(s.points||0)});

 async function mine(player){
  const rows=await rest('/rest/v1/creator_submissions',{params:{select:'*',telegram_id:'eq.'+player.telegram_id,order:'created_at.desc',limit:10}});
  const last=rows?.[0];
  const next=last?new Date(Date.parse(last.created_at)+CREATOR_WEEK_MS):null;
  return {submissions:(rows||[]).map(publicSub),next_submit_at:next&&next>clock()?next.toISOString():null,points:CREATOR_POINTS};
 }

 async function submit(player,body){
  if(player.balance_locked_at)throw Error('locked');
  const v=normalizeVideoUrl(body.url);
  const caption=typeof body.caption==='string'?body.caption.trim():'';
  if(caption.length>2000||!HASHTAG.test(caption))throw Error('hashtag');
  if(body.own!==true)throw Error('own');
  // Admission, quota checks and retries share one database transaction/player lock.
  const r=await rest('/rest/v1/rpc/mkty_creator_submit',{method:'POST',body:JSON.stringify({p_id:player.telegram_id,p_platform:v.platform,p_url:v.url,p_url_norm:v.url_norm,p_caption:caption,p_now:clock().toISOString()})});
  if(r.error)throw Error(r.error);
  return {submission:publicSub(r.submission),duplicate:!!r.duplicate,...await mine(player)};
 }

 async function getSub(id){
  id=Number(id);if(!Number.isSafeInteger(id)||id<=0)throw Error('submission');
  const rows=await rest('/rest/v1/creator_submissions',{params:{select:'*',id:'eq.'+id,limit:1}});
  if(!rows?.[0])throw Error('submission');
  return rows[0];
 }
 async function getPlayer(id){
  const rows=await rest('/rest/v1/players',{params:{select:'*',telegram_id:'eq.'+id,limit:1}});
  if(!rows?.[0])throw Error('submission');
  return rows[0];
 }
 async function pay(sub,kind,points){
  const owner=await getPlayer(sub.telegram_id);
  if(owner.balance_locked_at)return {awarded:false,points:0,reason:'locked'};
  const {inserted}=await insertReward(owner,'creator:'+sub.id+':'+kind,'creator.'+kind,points);
  if(inserted)await applyPoints(owner,points);
  return {awarded:inserted,points:inserted?points:0};
 }
 async function patchSub(sub,patch,cond={}){
  const rows=await rest('/rest/v1/creator_submissions',{method:'PATCH',params:{id:'eq.'+sub.id,...cond},body:JSON.stringify(patch)});
  return Array.isArray(rows)?rows[0]:rows;
 }

 async function adminList(user,body){
  if(!isAdmin(user))throw Error('forbidden');
  const status=['pending','approved','rejected'].includes(body.status)?body.status:'pending';
  const rows=await rest('/rest/v1/creator_submissions',{params:{select:'*',status:'eq.'+status,order:status==='pending'?'created_at.asc':'reviewed_at.desc',limit:50}});
  const ids=[...new Set((rows||[]).map(r=>r.telegram_id))];
  const players=ids.length?await rest('/rest/v1/players',{params:{select:'telegram_id,username,first_name',telegram_id:'in.('+ids.join(',')+')'}}):[];
  const byId=new Map((players||[]).map(p=>[Number(p.telegram_id),p]));
  return {submissions:(rows||[]).map(r=>({...publicSub(r),caption:r.caption||'',telegram_id:r.telegram_id,username:byId.get(Number(r.telegram_id))?.username||null,first_name:byId.get(Number(r.telegram_id))?.first_name||null})),points:CREATOR_POINTS};
 }

 async function adminReview(user,body){
  if(!isAdmin(user))throw Error('forbidden');
  const sub=await getSub(body.id);
  const decision=body.decision;
  if(decision!=='approve'&&decision!=='reject')throw Error('decision');
  if(sub.status!=='pending')throw Error('reviewed');
  const r=await rest('/rest/v1/rpc/mkty_review',{method:'POST',body:JSON.stringify({p_entity:'creator',p_id:sub.id,p_decision:decision,p_kind:'base',p_actor:user.id,p_points:CREATOR_POINTS.base,p_key:'creator:'+sub.id+':base',p_type:'creator.base',p_now:clock().toISOString()})});
  if(r.error)throw Error(r.error);return {...r,submission:publicSub(r.submission)};
 }

 async function adminTier(user,body){
  if(!isAdmin(user))throw Error('forbidden');
  const tier=body.tier==='1k'?'tier_1k':body.tier==='10k'?'tier_10k':null;
  if(!tier)throw Error('tier');
  const sub=await getSub(body.id);
  if(sub.status!=='approved')throw Error('not_approved');
  if(sub[tier+'_at'])return {submission:publicSub(sub),reward:{awarded:false,points:0,duplicate:true}};
  const r=await rest('/rest/v1/rpc/mkty_review',{method:'POST',body:JSON.stringify({p_entity:'creator',p_id:sub.id,p_decision:'approve',p_kind:tier,p_actor:user.id,p_points:CREATOR_POINTS[tier],p_key:'creator:'+sub.id+':'+tier,p_type:'creator.'+tier,p_now:clock().toISOString()})});
  if(r.error)throw Error(r.error);return {...r,submission:publicSub(r.submission)};
 }

 return {isAdmin,mine,submit,adminList,adminReview,adminTier};
}
