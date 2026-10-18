/* MOONKATTY 3D world (chapter 1 "Base Alpha") — server side of the Telegram Mini App port.
   Actions on the rewards function:
     world.state  -> {save:{revision,snapshot}, player, world:{today_earned, daily_cap, claimed:[keys]}}
     world.save   -> {revision, snapshot?, conflict?}  compare-and-swap on mkty_world_saves (separate from 2D campaign saves)
     world.reward -> {awarded, granted, points, player}   idempotent Moon Points via the existing mkty_reward ledger
   Reward amounts are SERVER constants mirrored from world3d/src/game/quests.js + index.js; the client only names
   which reward it earned. Event keys are unique per player (ledger), so every reward pays at most once
   (crystals once per UTC day per crystal). Chapter quests must be claimed in order with a minimum gap.
   This is client-asserted progress (no replay proof like the 2D campaign), bounded by: fixed amounts, one-time
   keys, quest order, min time between quests, the 300/UTC-day cap on repeatable/small world rewards (one-time chapter quests are exempt so they are never lost), rate limits and balance lock. */
export const WORLD_DAILY_CAP=300;
export const WORLD_QUESTS=[['power',15],['canyon',20],['crystals',25],['parts',30],['dish',30],['reactor',35],['launch',30],['secret',30],['home',50]];
export const WORLD_SECRETS=['ledge','hub','cave','canyon','launch','echo'];
export const WORLD_CRYSTALS=10, WORLD_PARTS=3, WORLD_MINE=3, QUEST_GAP_MS=8000, SPRINT_STAR_PTS=5;
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
 if((m=/^crystal:(\d{1,2})$/.exec(reason))&&Number(m[1])<WORLD_CRYSTALS)return {key:'world3d:d:'+day+':crystal:'+Number(m[1]),type:'world3d.crystal',points:3};
 if((m=/^part:(\d)$/.exec(reason))&&Number(m[1])<WORLD_PARTS)return {key:'world3d:c1:part:'+m[1],type:'world3d.part',points:5};
 if((m=/^mine:(power|ore):(\d):(ok|perfect)$/.exec(reason))&&Number(m[2])<WORLD_MINE)return {key:'world3d:c1:mine:'+m[1]+':'+m[2],type:'world3d.mine',points:m[3]==='perfect'?10:5};
 if((m=/^secret:([a-z]{2,10})$/.exec(reason))&&WORLD_SECRETS.includes(m[1]))return {key:'world3d:c1:secret:'+m[1],type:'world3d.secret',points:15};
 throw Error('reason');
}
export function createWorld({rest,rpc,insertReward,clock,dailyCap=WORLD_DAILY_CAP}){
 async function events(player){
  return await rest('/rest/v1/reward_events',{params:{select:'event_key,points,created_at',telegram_id:'eq.'+player.telegram_id,event_key:'like.world3d:*',order:'created_at.asc',limit:500}})||[];
 }
 const todayEarned=(rows,now)=>{const since=utcDay(now);return rows.filter(r=>!String(r.event_key).startsWith('world3d:c1:q:')&&r.created_at&&utcDay(new Date(r.created_at))===since).reduce((a,r)=>a+Number(r.points||0),0);};
 return {
  async state(player){
   const [save,rows]=await Promise.all([rpc('mkty_world_save',{p_id:player.telegram_id}),events(player)]);
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
   const rows=await events(player),have=new Map(rows.map(r=>[r.event_key,r]));
   if(have.has(spec.key)){const r=have.get(spec.key);return {awarded:false,granted:0,duplicate:true,key:spec.key,player,today_earned:todayEarned(rows,now),daily_cap:dailyCap,recorded:Number(r.points||0)};}
   if(spec.quest!==undefined){
    for(let i=0;i<spec.quest;i++)if(!have.has('world3d:c1:q:'+WORLD_QUESTS[i][0]))throw Error('order');
    if(spec.quest>0){const prev=have.get('world3d:c1:q:'+WORLD_QUESTS[spec.quest-1][0]);if(now.getTime()-Date.parse(prev.created_at)<QUEST_GAP_MS)throw Error('too_fast');}
   }
   const earned=todayEarned(rows,now),granted=spec.quest!==undefined?spec.points:Math.max(0,Math.min(spec.points,dailyCap-earned));
   const result=await insertReward(player,spec.key,spec.type,granted,{reason:body.reason});
   return {awarded:!!result.inserted,granted:result.inserted?granted:0,capped:granted<spec.points,key:spec.key,player:result.player,today_earned:earned+(result.inserted&&spec.quest===undefined?granted:0),daily_cap:dailyCap};
  }
 };
}
