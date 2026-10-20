/* MOONKATTY 3D world (Telegram port): friend help + notification opt-in/queue. Additive actions on the rewards function:
     world.friends       -> {friends:[{id,name,helped}], given_today, received_today, caps}
     world.help          -> {inserted, duplicate?}      one help per friend per UTC day (friend = referral link either way)
     world.help.claim    -> {count, helpers}            unclaimed helps received; client speeds running robot jobs +10% each
     world.notify.optin  -> {opted_in}                  after Telegram WebApp.requestWriteAccess() was allowed by the user
     world.notify.schedule -> {robot, storage}          next "robot returned" / "storage full" ping (seconds from now; null cancels)
     world.notify.status -> {opted_in, sender}
   No Moon Points are paid here; save v3 and the reward ledger are untouched. The message sender is a separate
   scheduled function (server/notify) and is OFF until activated (see server/notify/README.md). */
export const HELP_TARGET_CAP=3, HELP_GIVER_CAP=10, MAX_FRIENDS=50, NOTIFY_MAX_AHEAD_S=48*3600;
const utcDay=d=>d.toISOString().slice(0,10);
const nameOf=p=>String(p.display_name||p.first_name||'').slice(0,24)||'Pilot';
export function createWorldSocial({rest,rpc,clock,senderEnabled=false}){
 const pid=(v)=>{const n=Number(v);if(!Number.isSafeInteger(n)||n<=0)throw Error('friend');return n;};
 async function friendIds(player){
  const inv=await rest('/rest/v1/players',{params:{select:'telegram_id,display_name,first_name',referred_by:'eq.'+player.telegram_id,order:'created_at.asc',limit:MAX_FRIENDS}});
  const out=[...(inv||[])];
  if(player.referred_by){const up=await rest('/rest/v1/players',{params:{select:'telegram_id,display_name,first_name',telegram_id:'eq.'+Number(player.referred_by),limit:1}});if(up?.[0])out.unshift(up[0]);}
  return out;
 }
 return {
  async friends(player){
   const day=utcDay(clock()),[list,given,got]=await Promise.all([friendIds(player),
    rest('/rest/v1/mkty_world_help',{params:{select:'target_id',helper_id:'eq.'+player.telegram_id,day:'eq.'+day,limit:100}}),
    rest('/rest/v1/mkty_world_help',{params:{select:'helper_id',target_id:'eq.'+player.telegram_id,day:'eq.'+day,limit:100}})]);
   const helped=new Set((given||[]).map(r=>Number(r.target_id)));
   return {friends:list.map(p=>({id:Number(p.telegram_id),name:nameOf(p),helped:helped.has(Number(p.telegram_id))})),given_today:helped.size,received_today:(got||[]).length,caps:{receive:HELP_TARGET_CAP,give:HELP_GIVER_CAP},day};
  },
  async help(player,body){
   const target=pid(body.friend_id);
   const r=await rpc('mkty_world_help',{p_helper:player.telegram_id,p_target:target,p_now:clock().toISOString(),p_target_cap:HELP_TARGET_CAP,p_helper_cap:HELP_GIVER_CAP});
   if(r?.error)throw Error(r.error==='self'||r.error==='not_friend'?'friend':r.error);
   return {inserted:!!r?.inserted,duplicate:!!r?.duplicate};
  },
  async claim(player){const r=await rpc('mkty_world_help_claim',{p_target:player.telegram_id,p_now:clock().toISOString()});return {count:Number(r?.count||0),helpers:Array.isArray(r?.helpers)?r.helpers.map(Number):[]};},
  async optIn(player,body){
   const on=body.on===true,lang=typeof body.lang==='string'&&/^[a-z]{2,3}(-[a-z]{2})?$/i.test(body.lang)?body.lang.toLowerCase():null,now=clock().toISOString();
   await rest('/rest/v1/mkty_notify_prefs',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({telegram_id:player.telegram_id,opted_in:on,lang,opted_at:on?now:null,updated_at:now})});
   if(!on)await rest('/rest/v1/mkty_notify_queue',{method:'DELETE',params:{telegram_id:'eq.'+player.telegram_id,sent_at:'is.null'}});
   return {opted_in:on};
  },
  async schedule(player,body){
   const now=clock(),out={};
   for(const [k,f] of [['robot','robot_in'],['storage','storage_in']]){
    if(!(f in body))continue;const v=body[f];
    if(v!==null&&!(Number.isFinite(v)&&v>=0&&v<=NOTIFY_MAX_AHEAD_S))throw Error('due');
    const r=await rpc('mkty_notify_schedule',{p_id:player.telegram_id,p_kind:k,p_due:v===null?null:new Date(now.getTime()+Math.round(v)*1000).toISOString(),p_now:now.toISOString()});
    if(r?.error)throw Error(r.error==='kind'?'kind':'due');out[k]=!!r?.scheduled;
   }
   return out;
  },
  async status(player){const r=await rest('/rest/v1/mkty_notify_prefs',{params:{select:'opted_in',telegram_id:'eq.'+player.telegram_id,limit:1}});return {opted_in:!!r?.[0]?.opted_in,sender:senderEnabled?'on':'off'};}
 };
}
