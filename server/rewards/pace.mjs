/* Chapter pacing: one new chapter per UTC day. After LIFE #N is completed, LIFE #N+1 unlocks at the next
   00:00 UTC (same day boundary as Daily Missions). Grandfathering: completions recorded before PACING_SINCE,
   completions without a timestamp, and chapters already completed are never locked.
   Early unlock: each invited friend who completes LIFE #1 grants one skip (event_type chapter.skip). */
export const PACING_SINCE=Date.parse('2026-10-07T10:30:00Z');
export function nextUtcMidnight(ms){const d=new Date(ms);return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()+1);}
/** Pure unlock rule shared with tests. completedAt: ms of LIFE #(n-1) completion or null. */
export function unlockAt({life,storyLife,completedAt,skipped=false,since=PACING_SINCE}){
 if(life<=1||storyLife>=life||skipped)return 0;
 if(!Number.isFinite(completedAt)||completedAt<since)return 0;
 return nextUtcMidnight(completedAt);
}
export function createPace({rest,clock,insertReward}){
 async function completion(player,life){
  if(life<1)return null;
  const rows=await rest('/rest/v1/reward_events',{params:{select:'created_at',telegram_id:'eq.'+player.telegram_id,event_key:'eq.life:'+life+':complete',event_type:'eq.life.complete',limit:1}});
  const t=Date.parse(rows?.[0]?.created_at||'');return Number.isFinite(t)?t:null;
 }
 async function skipped(player,life){
  const rows=await rest('/rest/v1/reward_events',{params:{select:'id',telegram_id:'eq.'+player.telegram_id,event_key:'eq.chapter:skip:'+life,event_type:'eq.chapter.skip',limit:1}});
  return !!rows?.[0];
 }
 async function skipsAvailable(player){
  const invited=await rest('/rest/v1/players',{params:{select:'telegram_id,story_life',referred_by:'eq.'+player.telegram_id}});
  const used=await rest('/rest/v1/reward_events',{params:{select:'id',telegram_id:'eq.'+player.telegram_id,event_type:'eq.chapter.skip'}});
  const earned=(invited||[]).filter(r=>Number(r.story_life)>=1&&Number(r.telegram_id)!==Number(player.telegram_id)).length;
  return Math.max(0,earned-(used?.length||0));
 }
 async function lockedUntil(player,life){
  const storyLife=Number(player.story_life||0);
  if(life<=1||storyLife>=life)return 0;
  const at=unlockAt({life,storyLife,completedAt:await completion(player,life-1)});
  if(!at||clock().getTime()>=at)return 0;
  return await skipped(player,life)?0:at;
 }
 async function status(player){
  const next=Math.min(9,Number(player.story_life||0)+1),done=Number(player.story_life||0)>=9;
  const at=done?0:await lockedUntil(player,next);
  return {next_life:done?null:next,unlock_at:at?new Date(at).toISOString():null,locked:!!at,skips:await skipsAvailable(player),server_time:clock().toISOString()};
 }
 async function assertUnlocked(player,life){const at=await lockedUntil(player,life);if(at){const e=Error('chapter_locked');e.unlock_at=new Date(at).toISOString();throw e;}}
 async function skip(player,life){
  life=Number(life);if(!Number.isInteger(life)||life<2||life>9)throw Error('life');
  if(Number(player.story_life||0)+1!==life)throw Error('life');
  if(!await lockedUntil(player,life))return {skipped:false,already_open:true};
  if(await skipsAvailable(player)<1)throw Error('no_skips');
  const {inserted}=await insertReward(player,'chapter:skip:'+life,'chapter.skip',0);
  return {skipped:inserted,already_open:false};
 }
 return {status,assertUnlocked,skip,lockedUntil};
}
