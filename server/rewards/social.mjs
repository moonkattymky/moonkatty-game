/* Social verification for Daily Missions.
   - Telegram: real channel membership via Bot API getChatMember (TELEGRAM_BOT_TOKEN). Pays once.
   - X / TikTok: personal code flow. Player posts/comments their code (e.g. MKTY-7F3A) and pastes a link
     or handle; an allowlisted admin approves in admin.html. Reward only on approval:
     "follow" once per platform, "daily" (post/reply/comment with code) once per UTC day per platform.
   - YouTube subscription via Google OAuth is prepared behind YOUTUBE_OAUTH_ENABLED (see youtube.mjs).
   Opening a link never pays. */
export const TELEGRAM_CHANNEL_URL='https://t.me/moonkattymkty';
export const SOCIAL_POINTS={telegram_follow:5,x_follow:5,x_daily:5,tiktok_follow:5,tiktok_daily:5};
export const SOCIAL_PENDING_MAX=3; // per player, all platforms, anti-spam
const MEMBER=new Set(['member','administrator','creator']);

/** '@channel' from a t.me link (public channels only). */
export function channelFromUrl(u){
 const m=/^https?:\/\/(?:www\.)?(?:t\.me|telegram\.me)\/([A-Za-z][A-Za-z0-9_]{3,31})\/?$/.exec(String(u||'').trim());
 if(!m)throw Error('channel');
 return '@'+m[1];
}

export async function playerCode(telegram_id,secret){
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret||'mkty-social-code'),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const mac=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode('social-code:'+telegram_id)));
 return 'MKTY-'+[...mac.slice(0,2)].map(b=>b.toString(16).padStart(2,'0')).join('').toUpperCase();
}

/** Validate proof. follow: profile handle or profile URL; daily: link to the post / comment. */
export function normalizeProof(platform,kind,input){
 if(typeof input!=='string')throw Error('proof');
 const raw=input.trim();
 if(raw.length<2||raw.length>500||/\s/.test(raw))throw Error('proof');
 let m;
 if(kind==='follow'){
  const h=raw.replace(/^https?:\/\/(www\.|m\.)?(x\.com|twitter\.com|tiktok\.com)\//i,'').replace(/^@/,'').replace(/[/?].*$/,'').replace(/^@/,'');
  const ok=platform==='x'?/^[A-Za-z0-9_]{1,15}$/.test(h):/^[A-Za-z0-9_.]{2,24}$/.test(h);
  if(!ok)throw Error('proof');
  return {proof:'@'+h,proof_norm:platform+':follow:'+h.toLowerCase()};
 }
 let u;try{u=new URL(raw);}catch{throw Error('proof');}
 if(u.protocol!=='https:'||u.username||u.password)throw Error('proof');
 const host=u.hostname.toLowerCase().replace(/^(www\.|m\.|mobile\.)/,''),path=u.pathname.replace(/\/+$/,'');
 if(platform==='x'){
  if((host==='x.com'||host==='twitter.com')&&(m=path.match(/^\/([A-Za-z0-9_]{1,15})\/status\/(\d{5,25})$/)))return {proof:'https://x.com/'+m[1]+'/status/'+m[2],proof_norm:'x:status:'+m[2]};
  throw Error('proof');
 }
 if(platform==='tiktok'){
  if(host==='tiktok.com'&&(m=path.match(/^\/@([A-Za-z0-9_.]{1,40})\/video\/(\d{8,25})$/))){
   const cid=u.searchParams.get('comment_id')||u.searchParams.get('cid')||'';
   return {proof:'https://www.tiktok.com/@'+m[1]+'/video/'+m[2]+(cid&&/^\d{5,25}$/.test(cid)?'?comment_id='+cid:''),proof_norm:'tiktok:'+m[2]+':'+(/^\d{5,25}$/.test(cid)?cid:u.href.toLowerCase())};
  }
  if(/^(vm|vt)\.tiktok\.com$/.test(u.hostname.toLowerCase())&&(m=path.match(/^\/([A-Za-z0-9]{5,20})$/)))return {proof:'https://'+u.hostname.toLowerCase()+'/'+m[1]+'/',proof_norm:'tiktok-short:'+m[1]};
  throw Error('proof');
 }
 throw Error('platform');
}

export function createSocial({rest,clock,insertReward,applyPoints,isAdmin,secret,botToken,channel,fetcher=fetch,youtube}){
 const day=()=>clock().toISOString().slice(0,10);
 const tid=p=>'eq.'+p.telegram_id;
 const pub=r=>({id:r.id,platform:r.platform,kind:r.kind,proof:r.proof,day:r.day,status:r.status,points:Number(r.points||0),created_at:r.created_at,reviewed_at:r.reviewed_at||null});

 async function telegramMembership(user_id){
  if(!botToken)return {state:'not_configured'};
  let r,body;
  try{
   r=await fetcher('https://api.telegram.org/bot'+botToken+'/getChatMember?chat_id='+encodeURIComponent(channel)+'&user_id='+encodeURIComponent(user_id),{signal:AbortSignal.timeout(8000)});
   body=await r.json().catch(()=>({}));
  }catch{return {state:'telegram_unavailable'};}
  if(!body?.ok){
   const d=String(body?.description||'');
   // Bot is not an admin / not in the channel / channel misconfigured: never pay, report clearly.
   if(/member list is inaccessible|not enough rights|bot is not a member|chat not found|CHAT_ADMIN_REQUIRED|forbidden/i.test(d)||r?.status===400||r?.status===403)return {state:'bot_not_admin',detail:d.slice(0,120)};
   return {state:'telegram_unavailable',detail:d.slice(0,120)};
  }
  const st=body.result?.status;
  const member=MEMBER.has(st)||(st==='restricted'&&body.result?.is_member===true);
  return {state:member?'member':'not_member',member_status:st};
 }

 async function mine(p){
  const rows=await rest('/rest/v1/social_submissions',{params:{select:'*',telegram_id:tid(p),order:'created_at.desc',limit:30}});
  const ev=await rest('/rest/v1/reward_events',{params:{select:'event_key',telegram_id:tid(p),event_key:'like.social:*'}});
  const keys=new Set((ev||[]).map(r=>r.event_key));
  const today=day();
  return {
   code:await playerCode(p.telegram_id,secret),channel,points:SOCIAL_POINTS,today,
   telegram:{verified:keys.has('social:telegram:follow')},
   youtube:{oauth_enabled:!!youtube?.enabled},
   submissions:(rows||[]).map(pub),
   paid:{x_follow:keys.has('social:x:follow'),tiktok_follow:keys.has('social:tiktok:follow'),x_daily:keys.has('social:x:daily:'+today),tiktok_daily:keys.has('social:tiktok:daily:'+today)}
  };
 }

 async function verifyTelegram(p){
  if(p.balance_locked_at)throw Error('locked');
  const m=await telegramMembership(p.telegram_id);
  if(m.state!=='member')return {verified:false,status:m.state,channel,awarded:false,points:0,player:p};
  const pts=SOCIAL_POINTS.telegram_follow;
  const {inserted}=await insertReward(p,'social:telegram:follow','social.telegram_follow',pts);
  const player=inserted?await applyPoints(p,pts):p;
  return {verified:true,status:'member',channel,awarded:inserted,duplicate:!inserted,points:inserted?pts:0,player};
 }

 async function submit(p,body){
  if(p.balance_locked_at)throw Error('locked');
  const platform=body.platform,kind=body.kind;
  if(platform!=='x'&&platform!=='tiktok')throw Error('platform');
  if(kind!=='follow'&&kind!=='daily')throw Error('kind');
  const {proof,proof_norm}=normalizeProof(platform,kind,body.proof);
  const today=day();
  const rows=await rest('/rest/v1/social_submissions',{params:{select:'id,platform,kind,day,status',telegram_id:tid(p)}})||[];
  if(rows.filter(r=>r.status==='pending').length>=SOCIAL_PENDING_MAX)throw Error('pending_limit');
  const same=rows.filter(r=>r.platform===platform&&r.kind===kind&&r.status!=='rejected');
  if(kind==='follow'&&same.length)throw Error('already');
  if(kind==='daily'&&same.some(r=>r.day===today))throw Error('daily_limit');
  const code=await playerCode(p.telegram_id,secret);
  let row;
  try{
   const out=await rest('/rest/v1/social_submissions',{method:'POST',body:JSON.stringify({telegram_id:p.telegram_id,platform,kind,proof,proof_norm,code,day:today,status:'pending'})});
   row=Array.isArray(out)?out[0]:out;
  }catch(e){const msg=String(e.message||e);if(msg==='duplicate'||msg.includes('23505'))throw Error('duplicate_proof');throw e;}
  return {submission:pub(row),...await mine(p)};
 }

 async function adminList(user,body){
  if(!isAdmin(user))throw Error('forbidden');
  const status=['pending','approved','rejected'].includes(body.status)?body.status:'pending';
  const rows=await rest('/rest/v1/social_submissions',{params:{select:'*',status:'eq.'+status,order:status==='pending'?'created_at.asc':'reviewed_at.desc',limit:50}})||[];
  const ids=[...new Set(rows.map(r=>r.telegram_id))];
  const players=ids.length?await rest('/rest/v1/players',{params:{select:'telegram_id,username,first_name',telegram_id:'in.('+ids.join(',')+')'}}):[];
  const byId=new Map((players||[]).map(x=>[Number(x.telegram_id),x]));
  return {submissions:rows.map(r=>({...pub(r),code:r.code,telegram_id:r.telegram_id,username:byId.get(Number(r.telegram_id))?.username||null,first_name:byId.get(Number(r.telegram_id))?.first_name||null})),points:SOCIAL_POINTS};
 }

 async function adminReview(user,body){
  if(!isAdmin(user))throw Error('forbidden');
  const id=Number(body.id);if(!Number.isSafeInteger(id)||id<=0)throw Error('submission');
  const sub=(await rest('/rest/v1/social_submissions',{params:{select:'*',id:'eq.'+id,limit:1}}))?.[0];
  if(!sub)throw Error('submission');
  if(body.decision!=='approve'&&body.decision!=='reject')throw Error('decision');
  if(sub.status!=='pending')throw Error('reviewed');
  const key='social:'+sub.platform+':'+sub.kind+(sub.kind==='daily'?':'+sub.day:'');
  const r=await rest('/rest/v1/rpc/mkty_review',{method:'POST',body:JSON.stringify({p_entity:'social',p_id:id,p_decision:body.decision,p_kind:'base',p_actor:user.id,p_points:SOCIAL_POINTS[sub.platform+'_'+sub.kind]||0,p_key:key,p_type:'social.'+sub.platform+'_'+sub.kind,p_now:clock().toISOString()})});
  if(r.error)throw Error(r.error);return {...r,submission:pub(r.submission)};
 }

 return {telegramMembership,mine,verifyTelegram,submit,adminList,adminReview};
}
