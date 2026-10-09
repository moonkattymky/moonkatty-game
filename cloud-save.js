/* Versioned cross-device resume. Cloud snapshots never contain balances, identity or
   reward queues. Conflicting devices keep both copies until the player chooses. */
(()=>{
 const allowed=/^mkty_(story_(plan_[1-9]_v1|history_[1-9])|operations_[1-9]_v1|campaign_checkpoint_[1-9]|field_finale_[89]_v1|legacy_v1|current_chapter|life1_(memory_code|code_[a-z_]+)|life3_(memory_verified|code_[a-z_]+|hint_[a-z_]+)|life9_coordinates|reactor5_checkpoint_v2|liftoff6_checkpoint_v1|expeditions_v1)$/;
 let loaded=false,loading=null,busy=false,timer=null,applying=false,conflict=null,generation=0,owner='',selectingRestore=false,guardUnreadable=false;
 const enabled=()=>!!window.Telegram?.WebApp?.initData,ru=()=>localStorage.getItem('mkty_lang')==='ru';
 function scope(){const current=window.MKTYStorage?.identity()||'guest';if(owner!==current){owner=current;loaded=false;loading=null;conflict=null;guardUnreadable=false;selectingRestore=false;generation++;}return current;}
 function snapshot(){const out={},all=window.MKTYStorage?.snapshot?.();if(all){for(const [k,v] of Object.entries(all))if(allowed.test(k))out[k]=v;return out;}const keys=window.MKTYStorage?.keys?.()||Array.from({length:localStorage.length},(_,i)=>localStorage.key(i));for(const k of keys)if(allowed.test(k))out[k]=localStorage.getItem(k);return out;}
 const stored=k=>window.MKTYStorage?.readItem?window.MKTYStorage.readItem(k):localStorage.getItem(k);
 function dirty(){return stored('mkty_cloud_dirty')==='yes';}
 function revision(){return Number(stored('mkty_cloud_revision')||0);}
 const restoreKey='mkty_cloud_restore_pending',transactionKey='mkty_cloud_restore_transaction',retryGuardKey='mkty_cloud_restore_retry_guard',codec=window.MKTYTraceCodec;
 function validatedRemote(remote){
  if(!remote||!Number.isSafeInteger(remote.revision)||remote.revision<0||!remote.snapshot||typeof remote.snapshot!=='object'||Array.isArray(remote.snapshot))throw Error('snapshot_transport_invalid');
  return {...remote,snapshot:codec.unpackSnapshot(remote.snapshot)};
 }
 function status(text,action){let box=document.getElementById('cloudSaveStatus');if(!text){box?.remove();return;}if(!box){box=document.createElement('div');box.id='cloudSaveStatus';box.setAttribute('role','status');box.style.cssText='position:fixed;bottom:calc(10px + env(safe-area-inset-bottom));left:12px;right:12px;max-width:520px;margin:auto;z-index:18000;padding:12px;background:#e6f0f3;color:#183c4b;border:1px solid #6d919e;border-radius:10px;font:13px/1.45 system-ui';document.body.append(box);}box.replaceChildren(document.createTextNode(text));if(action){const b=document.createElement('button');b.type='button';b.style.cssText='display:block;min-height:44px;margin-top:8px';b.textContent=ru()?'Открыть облачное сохранение':'Open cloud save';b.onclick=()=>restoreAfterReload(conflict);box.append(b);}}
 function restoreAfterReload(remote){
  if(!remote)return;
  try{remote=validatedRemote(remote);}catch{transportWarning();return;}
  // Never replace a live controller's checkpoint before pagehide: its final save
  // would immediately overwrite the selected cloud copy with the old run.
  const unavailable=()=>status(ru()?'Сначала восстановите сохранение на устройстве кнопкой «Повторить сохранение», затем откройте облачную копию.':'First restore device saving with “Retry saving”, then open the cloud copy.',true);
  if(window.MKTYStorage?.persistent===false){unavailable();return;}
  try{
   let tx=transaction();
   if(tx?.phase==='complete'){finishTransaction();durable();tx=transaction();if(tx)throw Error('storage');}
   stageRestore(remote);
   if(tx){localStorage.setItem(transactionKey,JSON.stringify({...tx,revision:remote.revision,phase:'retry'}));durable();}
  }catch{unavailable();return;}
  if(window.MKTYStorage?.persistent===false){localStorage.removeItem(restoreKey);unavailable();return;}
  selectingRestore=true;location.reload();
 }
 function durable(){if(window.MKTYStorage?.persistent===false)throw Error('storage');}
 function stageRestore(remote){
  // Decode first, then stage a compact copy to avoid needlessly consuming quota.
  remote=validatedRemote(remote);let staged=remote;
  try{staged={...remote,snapshot:codec.packSnapshot(remote.snapshot)};}catch(error){if(error?.message!=='snapshot_too_large')throw error;}
  localStorage.setItem(restoreKey,JSON.stringify(staged));durable();
 }
 function transaction(){
  const value=JSON.parse(stored(transactionKey)||'null');
  if(value&&(!Number.isSafeInteger(value.revision)||value.revision<0||!['applying','complete','local','retry'].includes(value.phase)||typeof value.dirty!=='boolean'||!(value.localRevision===null||typeof value.localRevision==='string')))throw Error('storage');
  return value;
 }
 function recovery(tx){
  const value=JSON.parse(stored(tx?.backup==='latest'?'mkty_cloud_restore_outgoing':'mkty_cloud_recovery')||'null');
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.entries(value).some(([k,v])=>!allowed.test(k)||typeof v!=='string'))throw Error('storage');
  return value;
 }
 function replaceSnapshot(value){
  Object.keys(snapshot()).forEach(k=>localStorage.removeItem(k));
  for(const [k,v] of Object.entries(value))if(allowed.test(k))localStorage.setItem(k,v);
 }
 function recoverTransaction(known){
  const tx=known||transaction();if(!tx||tx.phase!=='applying')return;
  const original=recovery(tx);if(known)localStorage.setItem(transactionKey,JSON.stringify(tx));applying=true;
  try{
   // The storage adapter keeps failed native writes in its memory overlay. Finish
   // the entire rollback so controllers see one coherent outgoing checkpoint.
   replaceSnapshot(original);
   if(tx.localRevision===null)localStorage.removeItem('mkty_cloud_revision');else localStorage.setItem('mkty_cloud_revision',tx.localRevision);
   if(tx.dirty)localStorage.setItem('mkty_cloud_dirty','yes');else localStorage.removeItem('mkty_cloud_dirty');
  }finally{applying=false;}
 }
 function finishTransaction(){
  // The committed marker must survive if removing the pending copy fails. That
  // prevents a later reload from restoring it over newly played local progress.
  try{localStorage.removeItem(restoreKey);durable();localStorage.removeItem(transactionKey);}catch{}
 }
 function apply(remote){
  if(!remote)return;remote=validatedRemote(remote);let tx=transaction();
  if(tx?.phase==='complete'){finishTransaction();if(tx.revision===remote.revision)return;durable();tx=null;}
  if(tx?.phase==='local'){blocked(remote);return;}
  if(tx?.phase==='retry'){
   // Explicit re-selection creates a second outgoing copy after final pagehide
   // saves. Keep the very first recovery copy unchanged through all retries.
   localStorage.setItem('mkty_cloud_restore_outgoing',JSON.stringify(snapshot()));durable();
   tx={...tx,phase:'applying',backup:'latest',localRevision:stored('mkty_cloud_revision'),dirty:dirty()};
   localStorage.setItem(transactionKey,JSON.stringify(tx));durable();
  }
  if(tx&&tx.revision!==remote.revision){recoverTransaction();durable();localStorage.removeItem(transactionKey);durable();tx=null;}
  if(!tx){
   stageRestore(remote);
   tx={revision:remote.revision,phase:'applying',localRevision:stored('mkty_cloud_revision'),dirty:dirty()};
   // Create the first outgoing copy once, before any live key is changed. A retry
   // reuses it even if the prior document left only some native writes on disk.
   localStorage.setItem('mkty_cloud_recovery',JSON.stringify(snapshot()));durable();
   localStorage.setItem(transactionKey,JSON.stringify(tx));durable();
  }else recovery(tx);
  applying=true;
  try{
   durable();replaceSnapshot(remote.snapshot);durable();
   localStorage.setItem('mkty_cloud_revision',String(remote.revision));localStorage.removeItem('mkty_cloud_dirty');durable();
   localStorage.setItem(transactionKey,JSON.stringify({...tx,phase:'complete'}));durable();
  }catch(error){recoverTransaction(tx);throw error;}finally{applying=false;}
  finishTransaction();conflict=null;status('');window.MKTYCampaign?.render?.();
 }
 function overlayRetryGuard(value){
  if(!value||!value.tx||value.tx.phase!=='local'||!Number.isSafeInteger(value.tx.revision)||value.tx.revision<0||typeof value.dirty!=='boolean'||!(value.localRevision===null||typeof value.localRevision==='string')||!value.snapshot||typeof value.snapshot!=='object'||Array.isArray(value.snapshot)||Object.entries(value.snapshot).some(([k,v])=>!allowed.test(k)||typeof v!=='string'))throw Error('storage');
  applying=true;
  try{
   replaceSnapshot(value.snapshot);
   if(value.localRevision===null)localStorage.removeItem('mkty_cloud_revision');else localStorage.setItem('mkty_cloud_revision',value.localRevision);
   if(value.dirty)localStorage.setItem('mkty_cloud_dirty','yes');else localStorage.removeItem('mkty_cloud_dirty');
   localStorage.setItem(transactionKey,JSON.stringify(value.tx));
  }finally{applying=false;}
 }
 function restoreRetryGuard(value){
  overlayRetryGuard(value);durable();localStorage.removeItem(retryGuardKey);durable();
 }
 // Before an explicit retry flushes any live key, commit one coherent local guard.
 // If the later phase-marker write fails, this copy survives the next document.
 window.MKTYStorage?.setRetryGuard?.(()=>{
  if(guardUnreadable){const prior=stored(retryGuardKey);if(prior)overlayRetryGuard(JSON.parse(prior));else recoverTransaction();guardUnreadable=false;}
  const tx=transaction();if(!tx||tx.phase==='complete')return null;
  return {key:retryGuardKey,value:JSON.stringify({tx:{...tx,phase:'local'},snapshot:snapshot(),localRevision:stored('mkty_cloud_revision'),dirty:dirty()})};
 });
 // Run before gameplay controllers read their checkpoints. An interrupted restore
 // always recovers its first outgoing snapshot before another document can play.
 scope();
 let guarded;try{guarded=stored(retryGuardKey);}catch{guardUnreadable=true;transportWarning();}
 if(guardUnreadable){/* Never confuse an unreadable recovery guard with an absent one. */}
 else if(guarded){try{restoreRetryGuard(JSON.parse(guarded));const pending=JSON.parse(stored(restoreKey)||'null');if(pending)blocked(validatedRemote(pending));}catch(error){if(error?.message==='storage_read')guardUnreadable=true;transportWarning();}}
 else try{
  const tx=transaction(),pending=JSON.parse(stored(restoreKey)||'null');
  if(tx?.phase==='complete')finishTransaction();
  else if(tx?.phase==='local'){if(pending)blocked(validatedRemote(pending));}
  else if(pending)apply(pending);
  else if(tx){recoverTransaction();if(window.MKTYStorage?.persistent!==false)localStorage.setItem(transactionKey,JSON.stringify({...tx,phase:'local'}));transportWarning();}
 }catch{try{recoverTransaction();}catch{guardUnreadable=true;}transportWarning();}
 async function request(payload){
  const account=scope(),protocol=await window.MKTYRewards.traceProtocol?.();if(account!==scope())throw Error('account_changed');
  const packed=protocol===codec.PROTOCOL;
  if(payload.snapshot){
   durable();const snapshot=packed?codec.packSnapshot(payload.snapshot):codec.unpackSnapshot(payload.snapshot);
   if(!packed&&oversized(snapshot))throw Error('snapshot_too_large');
   payload={...payload,snapshot};
  }
  const result=await window.MKTYRewards.authenticatedFetch(window.MKTYRewards.endpoint,{...payload,action:packed?'campaign.cloud.v2':'campaign.cloud',...(packed?{protocol}:{})});
  if(account!==scope())throw Error('account_changed');
  if(!result?.ok)throw Error(result?.error==='action'||result?.error==='protocol'?'transport_unsupported':result?.error||'unavailable');
  if(packed&&result.protocol!==codec.PROTOCOL)throw Error('transport_unsupported');
  if(!Number.isSafeInteger(result.revision)||result.revision<0||(!result.conflict&&payload.snapshot&&result.revision<=payload.revision))throw Error('snapshot_transport_invalid');
  return payload.snapshot&&!result.conflict?result:validatedRemote(result);
 }
 function blocked(remote){conflict=remote;status(ru()?'На другом устройстве есть более новое сохранение. Текущий маршрут сохранён на этом устройстве; облачная копия не перезаписана.':'A newer save exists on another device. This route stays on this device; the cloud copy has not been overwritten.',true);}
 async function load(){
  if(!enabled())return;if(guardUnreadable){storageWarning();return;}const account=scope();if(loaded)return;if(loading)return loading;
  loading=(async()=>{try{const r=await request({});if(account!==scope()||!r?.ok)return;
   const remote=Number(r.revision||0),local=revision(),active=document.querySelector('.screen.active')?.id;
   if(remote>local){
    const playing=active&&!['home','language','chapters'].includes(active);
    if(dirty()||playing)blocked(r);else apply(r);
   }
   loaded=true;if(!remote&&Object.keys(snapshot()).length){localStorage.setItem('mkty_cloud_dirty','yes');schedule();}
   else if(dirty()&&!conflict)schedule();
  }catch(error){if(account!==scope())return;if(conflict){blocked(conflict);return;}if(['trace_invalid','trace_too_large','snapshot_transport_invalid','snapshot_too_large','transport_unsupported'].includes(error?.message))transportWarning();else status(ru()?'Облако временно недоступно. Маршрут остаётся на этом устройстве.':'Cloud saving is temporarily unavailable. Your route stays on this device.');}finally{if(account===scope())loading=null;}})();return loading;
 }
 function schedule(){if(timer||!enabled())return;timer=setTimeout(()=>{timer=null;flush();},8000);}
 function oversized(s){return Object.values(s).some(v=>codec.utf8Bytes(v)>=codec.LIMITS.snapshotEntryBytes)||codec.utf8Bytes(JSON.stringify(s))>codec.LIMITS.snapshotBytes;}
 function transportWarning(){status(ru()?'Формат облачного сохранения пока не удалось проверить. Прогресс остаётся на этом устройстве; не очищайте данные игры и повторите позже.':'The cloud save format could not be verified. Progress stays on this device; keep the game data and retry later.');}
 function storageWarning(){status(ru()?'Сначала восстановите сохранение на устройстве кнопкой «Повторить сохранение». Облачная копия не перезаписана.':'Restore device saving with “Retry saving” before syncing. Your cloud copy has not been overwritten.');}
 function sizeWarning(){status(ru()?'Этот маршрут слишком большой для облачного сохранения. Прогресс сохранён только на этом устройстве; не очищайте данные игры и продолжайте здесь.':'This route is too large for cloud saving. Progress is saved only on this device; keep its game data and continue here.');}
 async function flush(){
  if(!enabled())return;if(window.MKTYStorage?.persistent===false){storageWarning();return;}const account=scope();await load();if(account!==scope()||!loaded||busy||conflict)return;
  let localSnapshot;try{durable();if(!dirty())return;localSnapshot=snapshot();durable();}catch{storageWarning();return;}
  busy=true;const before=generation;
  let tooLarge=false;
  try{const r=await request({revision:revision(),snapshot:localSnapshot});if(account!==scope())return;
   if(r?.conflict){blocked(r);return;}
   durable();localStorage.setItem('mkty_cloud_revision',String(r.revision));if(generation===before)localStorage.removeItem('mkty_cloud_dirty');status('');
  }catch(error){if(account!==scope())return;
   if(['storage','storage_read'].includes(error?.message)){tooLarge=true;storageWarning();}
   else if(['snapshot_too_large','trace_too_large','body_too_large'].includes(error?.message)){tooLarge=true;sizeWarning();}
   else if(['transport_unsupported','snapshot_transport_invalid','trace_invalid'].includes(error?.message)){tooLarge=true;transportWarning();}
   else status(ru()?'Сохранено на устройстве. Синхронизация продолжится после восстановления связи.':'Saved on this device. Sync will retry when the connection returns.');
  }
  finally{busy=false;if(!conflict&&!tooLarge)try{if(dirty())schedule();}catch{storageWarning();}}
 }
 function pauseInterruptedRestore(afterRetry=false){
  const tx=transaction();if(!tx||tx.phase==='complete'||(!afterRetry&&tx.phase!=='applying'))return false;
  localStorage.setItem(transactionKey,JSON.stringify({...tx,phase:'local'}));durable();
  localStorage.removeItem(retryGuardKey);durable();return true;
 }
 window.addEventListener('mkty:storage-retry',()=>{
  if(applying||window.MKTYStorage?.persistent===false)return;
  // Retry has durably flushed the complete memory overlay, including any play
  // since rollback. Do not let the old pending remote replace that local work.
  try{if(pauseInterruptedRestore(true)){const pending=JSON.parse(stored(restoreKey)||'null');if(pending)blocked(validatedRemote(pending));}}catch{transportWarning();}
 });
 window.addEventListener('mkty:storage',e=>{
  if(applying||!allowed.test(e.detail?.key)||!enabled())return;scope();generation++;localStorage.setItem('mkty_cloud_dirty','yes');
  if(!selectingRestore&&window.MKTYStorage?.persistent!==false){
   // Only interrupted restores need this small marker update. Once durable local
   // play advances, a stale pending cloud copy requires an explicit choice again.
   try{pauseInterruptedRestore();}catch{}
  }
  schedule();
 });
 window.addEventListener('online',()=>{loaded=false;flush();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)flush();else{loaded=false;load();}});
 window.MKTYCloud={load,flush,snapshot};
})();
