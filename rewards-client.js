/* Confirmed server balances are never replaced by optimistic Telegram rewards.
   Guest play is a local demo. Pending operations survive reload and retry idempotently. */
(() => {
 const ENDPOINT='https://lswbmgoeinblzuqzakvi.supabase.co/functions/v1/rewards';
 const LIFE_REWARDS={1:500,2:500,3:750,4:1000,5:1250,6:1500,7:1750,8:2000,9:3000};
 let lastPlayer=null,serverReady=null,session=null,opening=null,syncing=null,lastError='';
 const initData=()=>window.Telegram?.WebApp?.initData||'';
 const scope=()=>{try{return String(JSON.parse(new URLSearchParams(initData()).get('user')).id);}catch{return 'telegram';}};
 const pendingKey=()=> 'mkty_pending_v2_'+scope();
 const read=()=>{try{return JSON.parse(localStorage.getItem(pendingKey())||'[]').filter(x=>x&&['life.complete','lives.spend'].includes(x.action)).slice(0,100);}catch{return [];}};
 const write=x=>{localStorage.setItem(pendingKey(),JSON.stringify(x));renderStatus();};
 const queue=(action,payload)=>{const all=read(),id=payload.event_key;if(!all.some(x=>x.id===id))write([...all,{id,action,payload}]);};
 const remove=id=>write(read().filter(x=>x.id!==id));
 function renderStatus(){
  if(!initData())return;
  const items=read();let el=document.getElementById('rewardSyncStatus');
  if(!el){el=document.createElement('button');el.id='rewardSyncStatus';el.className='reward-sync-status';el.type='button';el.setAttribute('aria-live','polite');el.onclick=()=>syncPlayer();document.body.appendChild(el);}
  const ru=(localStorage.getItem('mkty_lang')||'en')==='ru';
  el.hidden=!items.length&&!lastError;
  const msg=lastError==='auth'?(ru?'Сессия истекла. Закройте и снова откройте игру — прогресс сохранён.':'Session expired. Reopen the game — progress is saved.'):
   lastError==='chapter_locked'?(ru?'Глава пройдена. Награда ожидает открытия по расписанию.':'Chapter completed. Reward awaits the scheduled unlock.'):
   (ru?'Прогресс сохранён · награда ожидает синхронизации. Нажмите для повтора.':'Progress saved · reward awaiting sync. Tap to retry.');
  el.textContent=msg;
 }
 async function post(url,payload,signal){
  const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:signal||AbortSignal.timeout(12000),cache:'no-store'});
  const body=await r.json().catch(()=>({ok:false,error:'unavailable'}));
  if(!r.ok&&!body.error)body.error=r.status===401?'auth':'unavailable';return body;
 }
 async function authPayload(){
  const data=initData();if(!data)return {};
  if(!session){try{session=JSON.parse(sessionStorage.getItem('mkty_session_v1_'+scope())||'null');}catch{}}
  if(session?.token&&session.expires_at>Date.now()+30000)return {session:session.token};
  if(!opening)opening=(async()=>{
   const r=await post(ENDPOINT,{initData:data,action:'session'});
   if(r.ok&&r.session){session=r.session;try{sessionStorage.setItem('mkty_session_v1_'+scope(),JSON.stringify(session));}catch{};return {session:session.token};}
   return {initData:data};
  })().finally(()=>opening=null);
  return opening;
 }
 async function authenticatedFetch(url,payload={},signal){
  const result=await post(url,{...payload,...await authPayload()},signal);
  if(result?.error==='auth'){session=null;try{sessionStorage.removeItem('mkty_session_v1_'+scope());}catch{}}
  return result;
 }
 async function call(action,payload={}){
  if(!initData()){serverReady=false;return null;}
  try{
   const body=await authenticatedFetch(ENDPOINT,{...payload,action});
   if(!body?.ok){lastError=body?.error||'unavailable';serverReady=false;renderStatus();return body;}
   serverReady=true;lastError='';
   if(body.player){lastPlayer=body.player;applyCache(body.player);}
   if(body.pace){localStorage.setItem('mkty_pace_server',JSON.stringify(body.pace));window.MKTYPace?.setServer?.(body.pace);}
   renderStatus();return body;
  }catch{serverReady=false;lastError='unavailable';renderStatus();return {ok:false,error:'unavailable'};}
 }
 function applyCache(p){
  if(!p)return;
  if(typeof p.moon_points==='number')localStorage.setItem('mkty_points',String(p.moon_points));
  if(typeof p.lives==='number')localStorage.setItem('mkty_global_lives',String(p.lives));
  if(p.next_life_at)localStorage.setItem('mkty_life_restore_at',String(Date.parse(p.next_life_at)||0));
  else if(p.lives>=9)localStorage.removeItem('mkty_life_restore_at');
  for(let i=1;i<=Number(p.story_life||0);i++){localStorage.setItem('mkty_life'+i,'complete');localStorage.setItem('mkty_life'+i+'_awarded','yes');}
  if(p.balance_locked_at){localStorage.setItem('mkty_points_locked_at',String(Date.parse(p.balance_locked_at)));localStorage.setItem('mkty_final_moon_points',String(p.final_balance??p.moon_points));}
  else {localStorage.removeItem('mkty_points_locked_at');localStorage.removeItem('mkty_final_moon_points');}
  const el=document.getElementById('points');if(el)el.textContent=(p.balance_locked_at?(p.final_balance??p.moon_points)+' ⭐ 🔒':p.moon_points+' ⭐');
  window.dispatchEvent(new CustomEvent('mkty:player',{detail:{story_life:p.story_life}}));
 }
 async function syncPlayer(){
  if(syncing)return syncing;
  syncing=(async()=>{
   const body=await call('player');if(!body?.ok)return lastPlayer;
   for(const item of read()){
    if(item.action==='life.complete'&&item.payload.life>Number(lastPlayer?.story_life||0)+1)continue;
    const r=await call(item.action,item.payload);if(!r?.ok)break;remove(item.id);
   }
   return lastPlayer;
  })().finally(()=>syncing=null);return syncing;
 }
 async function completeLife(n,amount){
  const key='mkty_life'+n,event_key='life:'+n+':complete';localStorage.setItem(key,'complete');
  let pts=Number(localStorage.getItem('mkty_points')||0);
  if(!initData()){
   if(localStorage.getItem(key+'_awarded')!=='yes'){pts+=amount??LIFE_REWARDS[n]??0;localStorage.setItem('mkty_points',String(pts));localStorage.setItem(key+'_awarded','yes');}
   return {pts,source:'cache',player:null};
  }
  queue('life.complete',{life:n,event_key});
  const body=await call('life.complete',{life:n,event_key});
  if(body?.ok&&body.player){remove(event_key);localStorage.setItem(key+'_awarded','yes');return {pts:body.player.moon_points,source:body.awarded?'server':'server-idempotent',player:body.player};}
  return {pts:Number(localStorage.getItem('mkty_points')||0),source:'pending',pending:true,error:body?.error,player:null};
 }
 async function spendLife(event_key){
  const key=event_key||'life:spend:'+Date.now();
  if(!initData())return {ok:true,source:'cache'};
  queue('lives.spend',{event_key:key});const body=await call('lives.spend',{event_key:key});
  if(body?.ok){remove(key);return {ok:body.spent||body.duplicate,source:'server',player:body.player,lives:body.player.lives};}
  if(body?.error==='no_lives'){remove(key);return {ok:false,source:'server',lives:0};}
  return {ok:true,source:'pending',pending:true};
 }
 window.MKTYRewards={endpoint:ENDPOINT,syncPlayer,completeLife,spendLife,call,authPayload,authenticatedFetch,getLastPlayer:()=>lastPlayer,isServerReady:()=>serverReady,LIFE_REWARDS};
 window.addEventListener('online',()=>syncPlayer());
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncPlayer();});
 window.addEventListener('mkty:language',renderStatus);
})();
