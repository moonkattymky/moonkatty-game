/* Adapter for existing narrow REST unit fixtures. Real SQL semantics are independently
   exercised by integrity-sql.cjs (Postgres/WASM), including rollback and concurrency. */
exports.atomicFixture=fetcher=>async function call(url,opts={}){
 const u=new URL(url),name=u.pathname.split('/').pop();if(!u.pathname.includes('/rpc/mkty_'))return fetcher(url,opts);
 const b=JSON.parse(opts.body),now=Date.parse(b.p_now),res=x=>new Response(JSON.stringify(x));
 async function rest(table,method='GET',params={},body){const q=new URL('/rest/v1/'+table,u);for(const [k,v]of Object.entries(params))q.searchParams.set(k,v);const r=await fetcher(q,{method,body:body?JSON.stringify(body):undefined,headers:{Prefer:'return=representation,resolution=merge-duplicates'}});if(!r.ok)throw Error('fixture:'+table+':'+r.status);return r.json();}
 const player=async id=>(await rest('players','GET',{telegram_id:'eq.'+id}))[0];
 const patch=(id,body)=>rest('players','PATCH',{telegram_id:'eq.'+id},body);
 const events=(id,key)=>rest('reward_events','GET',{telegram_id:'eq.'+id,...(key?{event_key:'eq.'+key}:{})});
 async function restore(id){let p=await player(id);if(p.lives<9&&p.next_life_at&&Date.parse(p.next_life_at)<=now){const n=Math.floor((now-Date.parse(p.next_life_at))/43200000)+1;p=(await patch(id,{lives:Math.min(9,p.lives+n),next_life_at:p.lives+n>=9?null:new Date(Date.parse(p.next_life_at)+n*43200000).toISOString()}))[0];}return p;}
 async function reward(id,key,type,points,meta={}){
  let p=await player(id);const e=(await events(id,key))[0];if(e)return {inserted:false,row:e,player:p};if(p.balance_locked_at&&points)return {error:'locked'};
  const n=Number(key.split(':')[1]);
  if(type==='life.complete'){if(n<=p.story_life)return {inserted:false,player:p};if(n!==p.story_life+1)return {error:'life'};}
  if(type==='life.spend'){p=await restore(id);if(p.lives<=0)return {error:'no_lives'};}
  const row=(await rest('reward_events','POST',{}, {telegram_id:id,event_key:key,event_type:type,points,verified:true,created_at:b.p_now}))[0];
  const change={moon_points:Number(p.moon_points)+points};
  if(type==='life.complete'){change.story_life=n;if(n===9)Object.assign(change,{final_balance:change.moon_points,balance_locked_at:b.p_now});}
  if(type==='life.spend')Object.assign(change,{lives:p.lives-1,next_life_at:p.next_life_at||new Date(now+43200000).toISOString()});
  p=(await patch(id,change))[0];
  if(type==='daily.cipher')await rest('cipher_attempts','PATCH',{telegram_id:'eq.'+id,day:'eq.'+key.split(':')[1]},{solved:true,solved_at:b.p_now});
  if(type==='daily.streak')await rest('login_streaks','POST',{},meta);
  return {inserted:true,row,player:p};
 }

 // These reward-focused fixtures represent gameplay already verified by the campaign
 // service. The real campaign boundary is exercised by campaign-security/integrity SQL.
 if(name==='mkty_campaign_route')return res({life:b.p_life,route:'00000000-0000-4000-8000-000000000001',seed:1,edition:2,started_at:'2026-01-01T00:00Z',verified_at:b.p_now});
 if(name==='mkty_youtube'){
  const day=b.p_now.slice(0,10),p=await player(b.p_id),fails=await rest('reward_events','GET',{telegram_id:'eq.'+b.p_id,event_type:'eq.daily.youtube_fail',event_key:'like.ytfail:'+day+':*'});
  if(fails.length>=10)return res({error:'no_attempts'});
  const row=(await rest('youtube_codes','GET',{code:'eq.'+b.p_code,active:'is.true',limit:1}))[0];
  if(!row||(row.starts_at&&row.starts_at>b.p_now)||(row.expires_at&&row.expires_at<=b.p_now)){await reward(b.p_id,'ytfail:'+day+':'+crypto.randomUUID(),'daily.youtube_fail',0);return res({valid:false,awarded:false,attempts_left:9-fails.length,player:p});}
  const pts=Math.max(0,Math.min(50,Number(row.points)||0)),r=await reward(b.p_id,'yt:'+row.id,'daily.youtube_code',pts);if(r.error)return res(r);return res({valid:true,awarded:r.inserted,duplicate:!r.inserted,points:r.inserted?pts:0,player:r.player});
 }
 if(name==='mkty_restore_lives')return res(await restore(b.p_id));
 if(name==='mkty_reward')return res(await reward(b.p_id,b.p_key,b.p_type,b.p_points,b.p_meta));
 if(name==='mkty_review'){
  const table=b.p_entity+'_submissions',sub=(await rest(table,'GET',{id:'eq.'+b.p_id}))[0];
  if(!sub)return res({error:'submission'});
  if(b.p_kind==='base'&&sub.status!=='pending')return res({error:'reviewed'});
  const owner=await player(sub.telegram_id);let r={};if(b.p_decision==='approve'&&!owner.balance_locked_at)r=await reward(sub.telegram_id,b.p_key,b.p_type,b.p_points);
  const pts=r.inserted?b.p_points:0,change={status:b.p_decision==='approve'?'approved':'rejected',points:Number(sub.points||0)+pts};
  if(b.p_kind==='base')Object.assign(change,{reviewed_at:b.p_now,reviewed_by:b.p_actor});else change[b.p_kind+'_at']=b.p_now;
  const updated=(await rest(table,'PATCH',{id:'eq.'+b.p_id},change))[0];
  return res({submission:updated,reward:{awarded:!!r.inserted,points:pts,duplicate:!r.inserted,...(owner.balance_locked_at?{reason:'locked'}:{})}});
 }
 if(name==='mkty_cipher'){
  const p=await player(b.p_id),c=(await rest('cipher_attempts','GET',{telegram_id:'eq.'+b.p_id,day:'eq.'+b.p_day}))[0];
  if(c?.solved)return res({correct:true,awarded:false,duplicate:true,attempts_left:b.p_max-c.attempts,player:p});
  if(p.balance_locked_at)return res({error:'locked'});
  const used=await rest('rpc/cipher_attempt','POST',{}, {p_telegram_id:b.p_id,p_day:b.p_day,p_max:b.p_max});
  if(used===-1)return res({error:'no_attempts'});
  const r=b.p_correct?await reward(b.p_id,'cipher:'+b.p_day,'daily.cipher',15):{};
  return res({correct:b.p_correct,awarded:!!r.inserted,points:b.p_correct?15:0,attempts_left:b.p_max-used,player:await player(b.p_id)});
 }
 if(name==='mkty_referral'){
  let a=await player(b.p_invitee),p=await player(b.p_inviter);if(!a||!p||a.referred_by!==b.p_inviter)return res({error:'referral'});
  if(!b.p_activation){const source=(await events(b.p_invitee,b.p_source))[0];if(!source?.verified||!source.points)return res({error:'source'});}
  let own={};if(b.p_activation&&!a.balance_locked_at)own=await reward(b.p_invitee,'referral:invitee:life1','referral.invitee',200);
  const all=await rest('referral_events','GET',{inviter_id:'eq.'+b.p_inviter}),source=b.p_activation?'life1':b.p_source;
  let paid={};if(!p.balance_locked_at&&!all.some(x=>x.referral_id===b.p_invitee&&x.source_event_key===source)&&all.filter(x=>Date.parse(x.created_at)>=Date.parse(b.p_now.slice(0,10))).length<b.p_cap){
   const pts=b.p_activation?200:1;await rest('referral_events','POST',{}, {inviter_id:b.p_inviter,referral_id:b.p_invitee,source_event_key:source,points:pts,created_at:b.p_now});paid=await reward(b.p_inviter,'referral:'+b.p_invitee+':'+source,b.p_activation?'referral.inviter':'referral.claim',pts);
  }
  return res({invitee:await player(b.p_invitee),player:await player(b.p_inviter),invitee_points:own.inserted?200:0,inviter_paid:!!paid.inserted,awarded:!!paid.inserted});
 }
 throw Error('unknown fixture RPC '+name);
};
