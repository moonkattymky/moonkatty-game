/* MOONKATTY 3D world (chapter 1 "Base Alpha") — server side of the Telegram Mini App port.
   Actions on the rewards function:
     world.state  -> {save:{revision,snapshot}, player, world:{today_earned, daily_cap, claimed:[keys]}}
     world.save   -> {revision, snapshot?, conflict?}  compare-and-swap on mkty_world_saves (separate from 2D campaign saves)
     world.reward -> {awarded, granted, points, player}   idempotent Moon Points via the existing mkty_reward ledger
   Reward amounts are SERVER constants mirrored from world3d/src/game/quests.js + index.js; the client only names
   which reward it earned. Event keys are unique per player (ledger), so every reward pays at most once
   (crystals once per UTC day per crystal). Chapter quests must be claimed in order with a minimum gap.
   Chapter 2 (Oct 2026): quest:c2_* (one-time, in order after chapter 1, min gap; counts toward the daily cap and is
   refused with 'cap' instead of being truncated, so the client keeps it queued for the next day), login (once per UTC
   day) and daily:0..2 (three daily tasks per UTC day; a bare legacy 'daily' takes the next free slot).
   This is client-asserted progress (no replay proof like the 2D campaign), bounded by: fixed amounts, one-time
   keys, quest order, min time between quests, the 300/UTC-day cap on repeatable/small world rewards (one-time chapter quests are exempt so they are never lost), rate limits and balance lock. */
export const WORLD_DAILY_CAP=300;
export const WORLD_QUESTS=[['power',15],['canyon',20],['crystals',25],['parts',30],['dish',30],['reactor',35],['launch',30],['secret',30],['home',50]];
export const WORLD_SECRETS=['ledge','hub','cave','canyon','launch','echo'];
export const WORLD_CRYSTALS=10, WORLD_PARTS=3, WORLD_MINE=3, QUEST_GAP_MS=8000, SPRINT_STAR_PTS=5;
// chapter 2: amounts are server-side (15-50 range like chapter 1, scaled by the quest weight in world3d/src/game/ch2.js)
export const WORLD_QUESTS2=[['c2_collect',15],['c2_home',15],['c2_send',15],['c2_upgrade',25],['c2_help',20],['c2_daily',15],['c2_deliver',25],['c2_l3',35],['c2_storm',50],['c2_streak',40],['c2_museum',40]];
export const WORLD_LOGIN_PTS=5, WORLD_DAILY_PTS=8, WORLD_DAILY_TASKS=3;
const CH1_DONE_KEY='world3d:c1:q:'+WORLD_QUESTS[WORLD_QUESTS.length-1][0];
const MAX_SNAPSHOT=60000;
const utcDay=d=>d.toISOString().slice(0,10);
// Parse a client reward reason into {key,type,points,quest?}. Unknown reasons are rejected.
export function worldRewardSpec(reason,{stars=0,day}={}){
 if(typeof reason!=='string'||reason.length>48)throw Error('reason');
 let m;
 if((m=/^quest:([a-z]{3,10})$/.exec(reason))){
  const i=WORLD_QUESTS.findIndex(q=>q[0]===m[1]);if(i<0)throw Error('reason');
  const s=Math.max(0,Math.min(3,Number.isInteger(stars)?stars:0));
  return {key:'world3d:c1:q:'+m[1],type:'world3d.quest',points:WORLD_QUESTS[i][1]+(m[1]==='launch'?s*SPRINT_STAR_PTS:0),quest:i};
 }
 if((m=/^quest:(c2_[a-z0-9]{1,10})$/.exec(reason))){
  const i=WORLD_QUESTS2.findIndex(q=>q[0]===m[1]);if(i<0)throw Error('reason');
  return {key:'world3d:c2:q:'+m[1],type:'world3d.quest2',points:WORLD_QUESTS2[i][1],quest2:i,ch2:true};
 }
 if(reason==='login')return {key:'world3d:d:'+day+':login',type:'world3d.login',points:WORLD_LOGIN_PTS,ch2:true};
 if((m=/^daily:(\d)$/.exec(reason))&&Number(m[1])<WORLD_DAILY_TASKS)return {key:'world3d:d:'+day+':daily:'+m[1],type:'world3d.daily',points:WORLD_DAILY_PTS,ch2:true};
 if(reason==='daily')return {key:null,slotPrefix:'world3d:d:'+day+':daily:',type:'world3d.daily',points:WORLD_DAILY_PTS,ch2:true};
 if((m=/^crystal:(\d{1,2})$/.exec(reason))&&Number(m[1])<WORLD_CRYSTALS)return {key:'world3d:d:'+day+':crystal:'+Number(m[1]),type:'world3d.crystal',points:3};
 if((m=/^part:(\d)$/.exec(reason))&&Number(m[1])<WORLD_PARTS)return {key:'world3d:c1:part:'+m[1],type:'world3d.part',points:5};
 if((m=/^mine:(power|ore):(\d):(ok|perfect)$/.exec(reason))&&Number(m[2])<WORLD_MINE)return {key:'world3d:c1:mine:'+m[1]+':'+m[2],type:'world3d.mine',points:m[3]==='perfect'?10:5};
 if((m=/^secret:([a-z]{2,10})$/.exec(reason))&&WORLD_SECRETS.includes(m[1]))return {key:'world3d:c1:secret:'+m[1],type:'world3d.secret',points:15};
 throw Error('reason');
}
export function createWorld({rest,rpc,insertReward,clock,dailyCap=WORLD_DAILY_CAP}){
 async function events(player,day){
  // bounded: one-time chapter keys (world3d:c1:*, world3d:c2:*) + today's repeatable keys (world3d:d:<day>:*)
  const q=(like)=>rest('/rest/v1/reward_events',{params:{select:'event_key,points,created_at',telegram_id:'eq.'+player.telegram_id,event_key:'like.'+like,order:'created_at.asc',limit:500}});
  const [a,b]=await Promise.all([q('world3d:c*'),q('world3d:d:'+utcDay(day)+':*')]);
  return [...(a||[]),...(b||[])];
 }
 const todayEarned=(rows,now)=>{const since=utcDay(now);return rows.filter(r=>!String(r.event_key).startsWith('world3d:c1:q:')&&r.created_at&&utcDay(new Date(r.created_at))===since).reduce((a,r)=>a+Number(r.points||0),0);};
 return {
  async state(player){
   const [save,rows]=await Promise.all([rpc('mkty_world_save',{p_id:player.telegram_id}),events(player,clock())]);
   const now=clock();
   return {save:{revision:Number(save?.revision||0),snapshot:save?.snapshot||{}},world:{today_earned:todayEarned(rows,now),daily_cap:dailyCap,day:utcDay(now),claimed:rows.map(r=>r.event_key)}};
  },
  async save(player,body){
   if(!Number.isSafeInteger(body.revision)||body.revision<0)throw Error('snapshot');
   const s=body.snapshot;
   if(!s||typeof s!=='object'||Array.isArray(s))throw Error('snapshot');
   const text=JSON.stringify(s);if(text.length>MAX_SNAPSHOT)throw Error('snapshot_too_large');
   const r=await rpc('mkty_world_save',{p_id:player.telegram_id,p_expected:body.revision,p_snapshot:JSON.parse(text)});
   if(!Number.isSafeInteger(r?.revision))throw Error('snapshot');
   return r.conflict?{conflict:true,revision:r.revision,snapshot:r.snapshot}:{revision:r.revision};
  },
  async reward(player,body){
   const now=clock(),spec=worldRewardSpec(body.reason,{stars:body.stars,day:utcDay(now)});
   const rows=await events(player,now),have=new Map(rows.map(r=>[r.event_key,r]));
   if(spec.slotPrefix){let i=0;while(i<WORLD_DAILY_TASKS&&have.has(spec.slotPrefix+i))i++;spec.key=spec.slotPrefix+(i<WORLD_DAILY_TASKS?i:WORLD_DAILY_TASKS-1);}
   if(have.has(spec.key)){const r=have.get(spec.key);return {awarded:false,granted:0,duplicate:true,key:spec.key,player,today_earned:todayEarned(rows,now),daily_cap:dailyCap,recorded:Number(r.points||0)};}
   if(spec.quest!==undefined){
    for(let i=0;i<spec.quest;i++)if(!have.has('world3d:c1:q:'+WORLD_QUESTS[i][0]))throw Error('order');
    if(spec.quest>0){const prev=have.get('world3d:c1:q:'+WORLD_QUESTS[spec.quest-1][0]);if(now.getTime()-Date.parse(prev.created_at)<QUEST_GAP_MS)throw Error('too_fast');}
   }
   if(spec.ch2&&!have.has(CH1_DONE_KEY))throw Error('order'); // chapter 2 opens after the chapter 1 finale
   if(spec.quest2!==undefined){
    for(let i=0;i<spec.quest2;i++)if(!have.has('world3d:c2:q:'+WORLD_QUESTS2[i][0]))throw Error('order');
    const prev=have.get(spec.quest2>0?'world3d:c2:q:'+WORLD_QUESTS2[spec.quest2-1][0]:CH1_DONE_KEY);if(now.getTime()-Date.parse(prev.created_at)<QUEST_GAP_MS)throw Error('too_fast');
   }
   const earned=todayEarned(rows,now);
   if(spec.quest2!==undefined&&dailyCap-earned<spec.points)throw Error('cap'); // never truncate a one-time quest: retry on a later day
   const granted=spec.quest!==undefined?spec.points:Math.max(0,Math.min(spec.points,dailyCap-earned));
   const result=await insertReward(player,spec.key,spec.type,granted,{reason:body.reason});
   return {awarded:!!result.inserted,granted:result.inserted?granted:0,capped:granted<spec.points,key:spec.key,player:result.player,today_earned:earned+(result.inserted&&spec.quest===undefined?granted:0),daily_cap:dailyCap};
  }
 };
}
