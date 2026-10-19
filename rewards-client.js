/* Confirmed server balances are never replaced by optimistic Telegram rewards.
   Guest play is a local demo. Pending operations survive reload and retry idempotently. */
(() => {
 const ENDPOINT='https://lswbmgoeinblzuqzakvi.supabase.co/functions/v1/rewards';
 const LIFE_REWARDS={1:500,2:500,3:750,4:1000,5:1250,6:1500,7:1750,8:2000,9:3000};
 let lastPlayer=null,serverReady=null,session=null,opening=null,syncing=null,lastError='',sessionScope='',syncScope='',capabilityScope='',traceCapability,sessionGeneration=-1,syncGeneration=-1;
 const codec=()=>window.MKTYTraceCodec;
 function learnCapabilities(body,account){if(body?.ok&&account===scope()){capabilityScope=account;traceCapability=body.capabilities?.trace_codec===codec().PROTOCOL;}}
 const initData=()=>window.Telegram?.WebApp?.initData||'';
 let observedScope='',accountGeneration=0;
 const scope=()=>{let account;try{account=String(JSON.parse(new URLSearchParams(initData()).get('user')).id);}catch{account='telegram';}
  if(account!==observedScope){observedScope=account;accountGeneration++;}return account;
 };
 const accountContext=()=>({account:scope(),generation:accountGeneration});
 const isCurrent=context=>context.account===scope()&&context.generation===accountGeneration;
 const pendingKey=(account=scope())=> 'mkty_pending_v2_'+account;
 // An unavailable read is not an empty queue. Keep edits separately until the
 // original queue can be read and saving is durable again, including removals
 // acknowledged by the server while storage is unavailable.
 const pendingEdits=new Map(),unreadableQueues=new Set(),invalidQueues=new Set();
 const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
 const validQueue=all=>Array.isArray(all)&&all.every(item=>record(item)&&typeof item.id==='string'&&item.id.length>0&&['life.complete','lives.spend'].includes(item.action)&&record(item.payload)&&typeof item.payload.event_key==='string'&&item.payload.event_key.length>0&&(item.action!=='life.complete'||Number.isInteger(item.payload.life)&&item.payload.life>=1&&item.payload.life<=9));
 function storedQueue(account){
  try{
   const key=pendingKey(account),raw=window.MKTYStorage?.readItem?window.MKTYStorage.readItem(key):localStorage.getItem(key);let all;
   try{all=JSON.parse(raw||'[]');}catch{throw Error('queue_format');}
   // Older v2 writers also supplied string IDs/event keys; proof was optional.
   // An incomplete row is not permission to rewrite or partially drain its queue.
   if(!validQueue(all))throw Error('queue_format');
   unreadableQueues.delete(account);invalidQueues.delete(account);return all;
  }catch(error){
   if(error?.message==='queue_format'){invalidQueues.add(account);unreadableQueues.delete(account);}
   else{unreadableQueues.add(account);invalidQueues.delete(account);}throw error;
  }
 }
 function mergeQueue(all,edits){
  all=all.slice();
  for(const edit of edits||[]){
   if(edit.kind==='remove')all=all.filter(item=>item?.id!==edit.id);
   else if(edit.kind==='proof')all=all.map(item=>item?.id===edit.id?{...item,payload:{...item.payload,proof:edit.proof}}:item);
   else if(!all.some(item=>item?.id===edit.item.id))all.push(edit.item);
  }
  return all;
 }
 function read(account=scope()){
  let all=[];try{all=storedQueue(account);}catch{}
  const items=mergeQueue(all,pendingEdits.get(account));if(!validQueue(items))invalidQueues.add(account);return items;
 }
 // false is a verified clear queue; null means replay must wait for a readable
 // queue. Include memory-only edits and never inspect another account's queue.
 function pendingCompletion(n){
  if(!initData())return false;
  const account=scope();let items;
  try{items=mergeQueue(storedQueue(account),pendingEdits.get(account));}catch{return null;}
  if(!validQueue(items)){invalidQueues.add(account);return null;}if(account!==scope())return null;
  return items.some(item=>item.action==='life.complete'&&item.payload.life===Number(n));
 }
 function persistQueue(account){
  let all;try{all=storedQueue(account);}catch{return false;}
  const edits=pendingEdits.get(account);if(!edits)return true;
  if(window.MKTYStorage?.persistent===false)return false;
  try{
   // Never truncate the base: even a long ordinary offline backlog must survive
   // an unrelated enqueue, proof update or acknowledged removal.
   const merged=mergeQueue(all,edits);if(!validQueue(merged)){invalidQueues.add(account);return false;}
   const serialized=JSON.stringify(merged);localStorage.setItem(pendingKey(account),serialized);
   if(window.MKTYStorage?.persistent===false)return false;
   if(JSON.stringify(storedQueue(account))!==serialized)throw Error('storage_write');
   pendingEdits.delete(account);return true;
  }catch{return false;}
 }
 function editQueue(account,edit){
  const edits=pendingEdits.get(account)||[];edits.push(edit);pendingEdits.set(account,edits);
  persistQueue(account);if(account===scope())renderStatus();
 }
 const queue=(action,payload,account=scope())=>editQueue(account,{kind:'add',item:{id:payload.event_key,action,payload}});
 const remove=(id,account=scope())=>editQueue(account,{kind:'remove',id});
 const saveProof=(id,proof,account=scope())=>editQueue(account,{kind:'proof',id,proof});
 function renderStatus(){
  if(!initData())return;
  const account=scope(),items=read(account),invalid=invalidQueues.has(account),memoryOnly=pendingEdits.has(account)||unreadableQueues.has(account)||(items.length&&window.MKTYStorage?.persistent===false);let el=document.getElementById('rewardSyncStatus');
  if(!el){el=document.createElement('button');el.id='rewardSyncStatus';el.className='reward-sync-status';el.type='button';el.setAttribute('aria-live','polite');el.onclick=()=>syncPlayer();document.body.appendChild(el);}
  const ru=(localStorage.getItem('mkty_lang')||'en')==='ru';const L=(en,ru_)=>window.MKTYI18n?.t?window.MKTYI18n.t(en,{ru:ru_}):(ru?ru_:en);
  el.hidden=!items.length&&!lastError&&!memoryOnly&&!invalid;
  const memoryMessage=L('Reward changes are kept only in this open game. Restore device saving before closing it.','Изменения наград пока хранятся только в открытой игре. Восстановите сохранение на устройстве, прежде чем закрывать её.');
  const msg=invalid?(L('Saved reward data has an unreadable format. Reward sync is paused. Keep the game data.','Не удалось прочитать формат сохранённых данных наград. Синхронизация наград приостановлена. Не очищайте данные игры.'))+(memoryOnly?' '+memoryMessage:''):memoryOnly?memoryMessage:
   lastError==='auth'?(L('Session expired. Reopen the game — progress is saved.','Сессия истекла. Закройте и снова откройте игру — прогресс сохранён.')):
   lastError==='route_upgrade_required'||lastError==='proof_required'||lastError==='proof'?(items.some(item=>item?.action==='life.complete')?(L('The reward is not yet verified. Your current route is preserved. Tap to retry sync and keep the game data.','Награда пока не подтверждена. Текущий маршрут сохранён. Нажмите для повтора синхронизации и не очищайте данные игры.')):(L('Replay the chapter route to verify its reward. Confirmed achievements are preserved.','Для подтверждения награды повторите этапы через «Новый маршрут главы». Подтверждённые достижения сохранены.'))):
   ['transport_unsupported','proof_too_large','trace_too_large','body_too_large'].includes(lastError)?(L('Completion evidence is saved on this device. The server cannot currently accept its size or format; keep the game data and retry later.','Доказательство прохождения сохранено на устройстве. Сервер пока не может принять его размер или формат; сохраните данные игры и повторите позже.')):
   lastError==='trace_invalid'||lastError==='proof_transport_invalid'?(L('Completion evidence is saved, but its format could not be verified. Keep the game data.','Доказательство прохождения сохранено, но его формат не удалось проверить. Не очищайте данные игры.')):
   lastError==='chapter_locked'?(L('Chapter completed. Reward awaits the scheduled unlock.','Глава пройдена. Награда ожидает открытия по расписанию.')):
   (L('Progress saved · reward awaiting sync. Tap to retry.','Прогресс сохранён · награда ожидает синхронизации. Нажмите для повтора.'));
  el.textContent=msg;
 }
 async function post(url,payload,signal){
  // Older Telegram WebViews support AbortController but not AbortSignal.timeout.
  // Keep the timeout active until the response body has also finished downloading.
  let serialized;
  if((payload.action==='life.complete'||payload.action==='life.complete.v2')&&payload.proof!==undefined){
   // A short trace can stay raw when packing is larger. Ordinary JSON.stringify
   // would erase its negative-zero axes/action values; keep those exact as well.
   const envelope={...payload};delete envelope.proof;const head=JSON.stringify(envelope);
   serialized=head.slice(0,-1)+(head.length>2?',':'')+'"proof":'+codec().stringify(payload.proof,codec().LIMITS.proofBytes,'proof_too_large')+'}';
  }else serialized=JSON.stringify(payload);
  if(codec().utf8Bytes(serialized)>codec().LIMITS.transportBytes)return {ok:false,error:'body_too_large'};
  const controller=signal?null:new AbortController();
  const timeout=controller?setTimeout(()=>controller.abort(),12000):null;
  try{
   const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:serialized,signal:signal||controller.signal,cache:'no-store'});
   const body=await r.json().catch(()=>({ok:false,error:'unavailable'}));
   if(!r.ok&&!body.error)body.error=r.status===401?'auth':'unavailable';return body;
  }finally{if(timeout!==null)clearTimeout(timeout);}
 }
 async function authPayload(){
  const data=initData();if(!data)return {};
  const context=accountContext(),currentScope=context.account;if(sessionScope!==currentScope||sessionGeneration!==context.generation){session=null;opening=null;lastPlayer=null;serverReady=null;sessionScope=currentScope;sessionGeneration=context.generation;capabilityScope='';traceCapability=undefined;}
  if(!session){try{session=JSON.parse(sessionStorage.getItem('mkty_session_v1_'+currentScope)||'null');}catch{}}
  if(session?.token&&session.expires_at>Date.now()+30000)return {session:session.token};
  if(!opening){
   const job=(async()=>{
    const r=await post(ENDPOINT,{initData:data,action:'session'});
    if(!isCurrent(context))return {};
    if(r.ok&&r.session){learnCapabilities(r,currentScope);session=r.session;try{sessionStorage.setItem('mkty_session_v1_'+currentScope,JSON.stringify(session));}catch{}return {session:session.token};}
    return {initData:data};
   })().finally(()=>{if(opening===job)opening=null;});opening=job;
  }
  return opening;
 }
 async function authenticatedFetch(url,payload={},signal){
  const context=accountContext(),currentScope=context.account,auth=await authPayload();
  if(!isCurrent(context))return {ok:false,error:'account_changed'};
  const result=await post(url,{...payload,...auth},signal);
  if(!isCurrent(context)||(result?.player?.telegram_id!=null&&String(result.player.telegram_id)!==currentScope))return {ok:false,error:'account_changed'};
  if(url===ENDPOINT&&payload.action==='player')learnCapabilities(result,currentScope);
  if(payload.action==='campaign.cloud.v2'||payload.action==='life.complete.v2'){
   if(result?.error==='action'||result?.error==='protocol'||(result?.ok&&result.protocol!==codec().PROTOCOL)){capabilityScope=currentScope;traceCapability=false;return {ok:false,error:'transport_unsupported'};}
  }
  if(result?.error==='auth'){session=null;try{sessionStorage.removeItem('mkty_session_v1_'+currentScope);}catch{}}
  return result;
 }
 async function traceProtocol(){
  const context=accountContext(),account=context.account;await authPayload();if(!isCurrent(context))return null;
  if(capabilityScope!==account||traceCapability===undefined){const result=await authenticatedFetch(ENDPOINT,{action:'player'});if(!result?.ok)return null;}
  return isCurrent(context)&&capabilityScope===account&&traceCapability===true?codec().PROTOCOL:null;
 }
 // Snapshot-bearing requests share an account-scoped lane through response-body
 // parsing and cache application. Arrival order or a request-start counter cannot
 // tell us the server's commit order. Another account has its own independent lane.
 const playerRequests=new Map();
 function call(action,payload={}){
  if(!initData()){serverReady=false;return Promise.resolve(null);}
  const context=accountContext();
  // campaign.open returns a route only. Keep superseding route work responsive;
  // its identity checks live in prepareRoute and it must never apply a snapshot.
  if(action==='campaign.open')return performCall(action,payload,context,false);
  const previous=playerRequests.get(context.account)||Promise.resolve();
  const result=previous.then(()=>performCall(action,payload,context,true));
  const settled=result.then(()=>{},()=>{});playerRequests.set(context.account,settled);
  settled.then(()=>{if(playerRequests.get(context.account)===settled)playerRequests.delete(context.account);});
  return result;
 }
 async function performCall(action,payload,context,applySnapshot){
  if(!isCurrent(context))return {ok:false,error:'account_changed'};
  try{
   if(action==='life.complete'){
    const protocol=await traceProtocol();if(!isCurrent(context))return {ok:false,error:'account_changed'};
    payload={...payload,...(payload.proof?{proof:protocol?codec().packProof(payload.proof):codec().unpackProof(payload.proof)}:{})};
    if(protocol){action='life.complete.v2';payload.protocol=protocol;}
   }
   const body=await authenticatedFetch(ENDPOINT,{...payload,action});
   if(!isCurrent(context)||(body?.player?.telegram_id!=null&&String(body.player.telegram_id)!==context.account))return {ok:false,error:'account_changed'};
   if(!body?.ok){
    // This error is an authoritative zero-life result. Apply it inside the lane,
    // rather than letting a delayed app callback overwrite a later restoration.
    if(applySnapshot&&action==='lives.spend'&&body?.error==='no_lives')localStorage.setItem('mkty_global_lives','0');
    lastError=body?.error||'unavailable';serverReady=false;renderStatus();return body;
   }
   serverReady=true;lastError='';
   if(applySnapshot&&body.player){lastPlayer=body.player;applyCache(body.player);}
   if(applySnapshot&&body.pace){localStorage.setItem('mkty_pace_server',JSON.stringify(body.pace));window.MKTYPace?.setServer?.(body.pace);}
   renderStatus();return body;
  }catch(error){
   if(!isCurrent(context))return {ok:false,error:'account_changed'};
   // An abort is not proof of a server rollback. Leave retryable intents queued;
   // release this lane so one failed connection cannot block further local play.
   serverReady=false;lastError=['trace_invalid','trace_too_large','proof_too_large'].includes(error?.message)?error.message:'unavailable';renderStatus();return {ok:false,error:lastError};
  }
 }
 function applyCache(p){
  if(!p)return;
  if(typeof p.moon_points==='number')localStorage.setItem('mkty_points',String(p.moon_points));
  if(typeof p.lives==='number')localStorage.setItem('mkty_global_lives',String(p.lives));
  if(p.next_life_at)localStorage.setItem('mkty_life_restore_at',String(Math.max(0,(Date.parse(p.next_life_at)||0)-12*3600e3)));
  else if(p.lives>=9)localStorage.removeItem('mkty_life_restore_at');
  for(let i=1;i<=Number(p.story_life||0);i++){localStorage.setItem('mkty_life'+i,'complete');localStorage.setItem('mkty_life'+i+'_awarded','yes');}
  if(p.balance_locked_at){localStorage.setItem('mkty_points_locked_at',String(Date.parse(p.balance_locked_at)));localStorage.setItem('mkty_final_moon_points',String(p.final_balance??p.moon_points));}
  else {localStorage.removeItem('mkty_points_locked_at');localStorage.removeItem('mkty_final_moon_points');}
  const el=document.getElementById('points');if(el)el.textContent=(p.balance_locked_at?(p.final_balance??p.moon_points)+' ⭐ 🔒':p.moon_points+' ⭐');
  window.dispatchEvent(new CustomEvent('mkty:player',{detail:{story_life:p.story_life}}));
 }
 async function syncPlayer(){
  const context=accountContext(),account=context.account;if(syncing&&syncScope===account&&syncGeneration===context.generation)return syncing;syncScope=account;syncGeneration=context.generation;
  const job=(async()=>{
   persistQueue(account);
   const body=await call('player');if(!isCurrent(context))return null;if(!body?.ok)return lastPlayer;
   await window.MKTYCloud?.load?.();if(!isCurrent(context))return null;
   const items=read(account);
   if(unreadableQueues.has(account)||invalidQueues.has(account)){renderStatus();return lastPlayer;}
   for(const item of items){
    if(!isCurrent(context))return null;
    if(item.action==='life.complete'){const proof=await proofFor(item.payload.life);if(!isCurrent(context))return null;if(proof){saveProof(item.id,proof,account);item.payload.proof=proof;}}
    if(item.action==='life.complete'&&item.payload.life>Number(lastPlayer?.story_life||0)+1)continue;
    const r=await call(item.action,item.payload);if(!isCurrent(context))break;
    // A spent-out account cannot settle this failed-attempt charge. It must not
    // permanently block unrelated earned chapter rewards behind it in the queue.
    if(item.action==='lives.spend'&&r?.error==='no_lives'){remove(item.id,account);continue;}
    if(!r?.ok)break;remove(item.id,account);
   }
   return lastPlayer;
  })().catch(()=>{
   if(!isCurrent(context))return null;
   // Cloud/proof work can fail outside the transport wrapper. Keep every intent
   // retryable and resolve event-triggered syncs without leaking a rejection.
   serverReady=false;lastError='unavailable';renderStatus();return lastPlayer;
  }).finally(()=>{if(syncing===job)syncing=null;});syncing=job;return job;
 }
 async function completeLife(n,amount){
  const context=accountContext(),account=context.account,key='mkty_life'+n,event_key='life:'+n+':complete';localStorage.setItem(key,'complete');
  let pts=Number(localStorage.getItem('mkty_points')||0);
  if(!initData()){
   if(localStorage.getItem(key+'_awarded')!=='yes'){pts+=amount??LIFE_REWARDS[n]??0;localStorage.setItem('mkty_points',String(pts));localStorage.setItem(key+'_awarded','yes');}
   return {pts,source:'cache',player:null};
  }
  // Persist the intent before proofFor can wait for the network. An app close at
  // that point must still leave a retryable completion on the next launch.
  queue('life.complete',{life:n,event_key},account);
  const proof=await proofFor(n);if(!isCurrent(context))return {source:'account-changed',pending:true};
  if(proof)saveProof(event_key,proof,account);
  const body=await call('life.complete',{life:n,event_key,proof});
  if(!isCurrent(context)||body?.error==='account_changed')return {source:'account-changed',pending:true};
  if(body?.ok&&body.player){remove(event_key,account);localStorage.setItem(key+'_awarded','yes');return {pts:body.player.moon_points,source:body.awarded?'server':'server-idempotent',player:body.player};}
  return {pts:Number(localStorage.getItem('mkty_points')||0),source:'pending',pending:true,error:body?.error,player:null};
 }
 async function spendLife(event_key){
  const context=accountContext(),account=context.account,key=event_key||'life:spend:'+Date.now();
  if(!initData())return {ok:true,source:'cache'};
  queue('lives.spend',{event_key:key},account);const body=await call('lives.spend',{event_key:key});
  if(!isCurrent(context)||body?.error==='account_changed')return {ok:false,source:'account-changed',pending:true};
  if(body?.ok){remove(key,account);return {ok:body.spent||body.duplicate,source:'server',player:body.player,lives:body.player.lives};}
  if(body?.error==='no_lives'){remove(key,account);return {ok:false,source:'server',lives:0};}
  return {ok:true,source:'pending',pending:true};
 }

 const routeJobs=new Map(),routeRequests=new Map();
 // Security (audit 2026-10-17): the server issues the chapter challenge (seed).
 // The client never proposes a seed; it adopts the server route before play.
 // Older backends also issue a random seed when none is sent, so this stays
 // compatible with the currently deployed handler.
 function storedRoute(n,account=scope()){let route;try{route=JSON.parse(localStorage.getItem('mkty_proof_route_'+n)||'null');}catch{}return validRoute(route,n,account)?route:null;}
 function validRoute(route,n,account){return !!route&&typeof route==='object'&&typeof route.route==='string'&&route.route.length>0&&(route.life===undefined||Number(route.life)===Number(n))&&(route.telegram_id===undefined||String(route.telegram_id)===String(account))&&Number.isInteger(Number(route.seed))&&Number(route.seed)>=0&&Number(route.seed)<=0xffffffff&&[1,2].includes(route.edition||1);}
 function routeReady(n,p=window.MKTYStory?.read(n)){
  if(!initData())return true;
  const route=storedRoute(n);return !!p&&!!route&&Number(route.seed)===p.seed&&(route.edition||1)===(p.edition||1);
 }
 async function prepareRoute(n,reset=false){
  if(!initData())return null;
  if(reset&&pendingCompletion(n)!==false)return null;
  const context=accountContext(),account=context.account,p=window.MKTYStory?.read(n);
  const cached=storedRoute(n,account);
  // Reuse the saved receipt when it matches the local plan, or when no plan exists yet.
  if(!reset&&cached&&(!p||(Number(cached.seed)===p.seed&&(cached.edition||1)===(p.edition||1))))return cached;
  // The local plan identity stays part of the job key: a changed plan supersedes older work.
  const owner=account+':'+n,jobKey=owner+':'+context.generation+':'+(p?p.seed+':'+(p.edition||1):'none')+':'+reset;
  const existing=routeJobs.get(jobKey);if(existing&&routeRequests.get(owner)===existing.request)return existing.job;
  const request={};routeRequests.set(owner,request);
  const job=(async()=>{
   const body=await call('campaign.open',{life:n,edition:2,reset});
   // A late open belongs to its original account and request, never a newer one.
   if(!isCurrent(context)||routeRequests.get(owner)!==request)return null;
   if(body?.ok&&validRoute(body.route,n,account)){const route=body.route;localStorage.setItem('mkty_proof_route_'+n,JSON.stringify(route));return route;}
   if(body?.error)throw Error(body.error);
   return null;
  })().finally(()=>{if(routeJobs.get(jobKey)?.job===job)routeJobs.delete(jobKey);if(routeRequests.get(owner)===request)routeRequests.delete(owner);});
  routeJobs.set(jobKey,{job,request});return job;
 }
 async function proofFor(n){
  try{const p=window.MKTYStory?.read(n);if(!p||p.done.length!==8)return undefined;const route=await prepareRoute(n);if(!route)return undefined;
   // Only a proof for the exact issued challenge can be accepted by the server.
   if(Number(route.seed)!==p.seed||(route.edition||1)!==(p.edition||1))return undefined;
   const tasks=p.done.slice().sort((a,b)=>a-b).map(id=>({id,attempt:p.tasks[id]?.attempt||0,state:p.tasks[id]?.proof}));
   if(tasks.some(t=>!t.state))return undefined;return {route:route.route,tasks};
  }catch{return undefined;}
 }
 window.MKTYRewards={prepareRoute,proofFor,routeReady,requiresRoute:()=>!!initData(),pendingCompletion,accountScope:scope,endpoint:ENDPOINT,traceProtocol,syncPlayer,completeLife,spendLife,call,authPayload,authenticatedFetch,getLastPlayer:()=>lastPlayer,isServerReady:()=>serverReady,LIFE_REWARDS};
 window.addEventListener('mkty:storage-retry',()=>{
  const accounts=new Set([...pendingEdits.keys(),...unreadableQueues,...invalidQueues]);for(const account of accounts)persistQueue(account);
  renderStatus();if(initData()&&accounts.has(scope()))syncPlayer().catch(()=>renderStatus());
 });
 window.addEventListener('online',()=>syncPlayer());
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncPlayer();});
 window.addEventListener('mkty:language',renderStatus);
})();
