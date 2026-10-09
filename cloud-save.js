/* Versioned cross-device resume. Cloud snapshots never contain balances, identity or
   reward queues. Conflicting devices keep both copies until the player chooses. */
(()=>{
 const allowed=/^mkty_(story_(plan_[1-9]_v1|history_[1-9])|operations_[1-9]_v1|campaign_checkpoint_[1-9]|field_finale_[89]_v1|legacy_v1|current_chapter|life1_(memory_code|code_[a-z_]+)|life3_(memory_verified|code_[a-z_]+|hint_[a-z_]+)|life9_coordinates|reactor5_checkpoint_v2|liftoff6_checkpoint_v1|expeditions_v1)$/;
 let loaded=false,loading=null,busy=false,timer=null,applying=false,conflict=null,generation=0,owner='';
 const enabled=()=>!!window.Telegram?.WebApp?.initData,ru=()=>localStorage.getItem('mkty_lang')==='ru';
 function scope(){const current=window.MKTYStorage?.identity()||'guest';if(owner!==current){owner=current;loaded=false;loading=null;conflict=null;generation++;}return current;}
 function snapshot(){const out={},keys=window.MKTYStorage?.keys?.()||Array.from({length:localStorage.length},(_,i)=>localStorage.key(i));for(const k of keys)if(allowed.test(k))out[k]=localStorage.getItem(k);return out;}
 function dirty(){return localStorage.getItem('mkty_cloud_dirty')==='yes';}
 function revision(){return Number(localStorage.getItem('mkty_cloud_revision')||0);}
 const restoreKey='mkty_cloud_restore_pending';
 function status(text,action){let box=document.getElementById('cloudSaveStatus');if(!text){box?.remove();return;}if(!box){box=document.createElement('div');box.id='cloudSaveStatus';box.setAttribute('role','status');box.style.cssText='position:fixed;bottom:calc(10px + env(safe-area-inset-bottom));left:12px;right:12px;max-width:520px;margin:auto;z-index:18000;padding:12px;background:#e6f0f3;color:#183c4b;border:1px solid #6d919e;border-radius:10px;font:13px/1.45 system-ui';document.body.append(box);}box.replaceChildren(document.createTextNode(text));if(action){const b=document.createElement('button');b.type='button';b.style.cssText='display:block;min-height:44px;margin-top:8px';b.textContent=ru()?'Открыть облачное сохранение':'Open cloud save';b.onclick=()=>restoreAfterReload(conflict);box.append(b);}}
 function restoreAfterReload(remote){
  if(!remote)return;
  // Never replace a live controller's checkpoint before pagehide: its final save
  // would immediately overwrite the selected cloud copy with the old run.
  const unavailable=()=>status(ru()?'Сначала восстановите сохранение на устройстве кнопкой «Повторить сохранение», затем откройте облачную копию.':'First restore device saving with “Retry saving”, then open the cloud copy.',true);
  if(window.MKTYStorage?.persistent===false){unavailable();return;}
  try{localStorage.setItem(restoreKey,JSON.stringify(remote));}catch{unavailable();return;}
  if(window.MKTYStorage?.persistent===false){localStorage.removeItem(restoreKey);unavailable();return;}
  location.reload();
 }
 function apply(remote){
  if(!remote)return;applying=true;
  // Retain a recoverable local copy before replacing a divergent device snapshot.
  localStorage.setItem('mkty_cloud_recovery',JSON.stringify(snapshot()));
  const all=Object.keys(snapshot());all.forEach(k=>localStorage.removeItem(k));
  for(const [k,v] of Object.entries(remote.snapshot||{}))if(allowed.test(k)&&typeof v==='string')localStorage.setItem(k,v);
  localStorage.setItem('mkty_cloud_revision',String(remote.revision));localStorage.removeItem('mkty_cloud_dirty');applying=false;conflict=null;status('');
  window.MKTYCampaign?.render?.();
 }
 // This script is loaded before any gameplay controller. Let outgoing controllers
 // finish saving, then restore on the new document before they read their state.
 try{const pending=JSON.parse(localStorage.getItem(restoreKey)||'null');if(pending&&Number.isSafeInteger(pending.revision)&&pending.revision>=0&&pending.snapshot&&typeof pending.snapshot==='object')apply(pending);}catch{}
 localStorage.removeItem(restoreKey);
 async function request(payload){return window.MKTYRewards.authenticatedFetch(window.MKTYRewards.endpoint,{action:'campaign.cloud',...payload});}
 function blocked(remote){conflict=remote;status(ru()?'На другом устройстве есть более новое сохранение. Текущий маршрут сохранён на этом устройстве; облачная копия не перезаписана.':'A newer save exists on another device. This route stays on this device; the cloud copy has not been overwritten.',true);}
 async function load(){
  if(!enabled())return;const account=scope();if(loaded)return;if(loading)return loading;
  loading=(async()=>{try{const r=await request({});if(account!==scope()||!r?.ok)return;
   const remote=Number(r.revision||0),local=revision(),active=document.querySelector('.screen.active')?.id;
   if(remote>local){
    const playing=active&&!['home','language','chapters'].includes(active);
    if(dirty()||playing)blocked(r);else apply(r);
   }
   loaded=true;if(!remote&&Object.keys(snapshot()).length){localStorage.setItem('mkty_cloud_dirty','yes');schedule();}
   else if(dirty()&&!conflict)schedule();
  }catch{status(ru()?'Облако временно недоступно. Маршрут остаётся на этом устройстве.':'Cloud saving is temporarily unavailable. Your route stays on this device.');}finally{loading=null;}})();return loading;
 }
 function schedule(){if(timer||!enabled())return;timer=setTimeout(()=>{timer=null;flush();},8000);}
 function oversized(s){return Object.values(s).some(v=>v.length>=180000)||JSON.stringify(s).length>350000;}
 function sizeWarning(){status(ru()?'Этот маршрут слишком большой для облачного сохранения. Прогресс сохранён только на этом устройстве; не очищайте данные игры и продолжайте здесь.':'This route is too large for cloud saving. Progress is saved only on this device; keep its game data and continue here.');}
 async function flush(){
  if(!enabled())return;const account=scope();await load();if(!loaded||busy||conflict||!dirty())return;
  const localSnapshot=snapshot();
  // Guard older servers that silently drop oversized entries as well.
  if(oversized(localSnapshot)){sizeWarning();return;}
  busy=true;const before=generation;
  let tooLarge=false;
  try{const r=await request({revision:revision(),snapshot:localSnapshot});if(account!==scope())return;
   if(r?.conflict){blocked(r);return;}if(r?.error==='snapshot_too_large'){tooLarge=true;sizeWarning();return;}if(!r?.ok)throw Error('unavailable');
   localStorage.setItem('mkty_cloud_revision',String(r.revision));if(generation===before)localStorage.removeItem('mkty_cloud_dirty');status('');
  }catch{status(ru()?'Сохранено на устройстве. Синхронизация продолжится после восстановления связи.':'Saved on this device. Sync will retry when the connection returns.');}
  finally{busy=false;if(dirty()&&!conflict&&!tooLarge)schedule();}
 }
 window.addEventListener('mkty:storage',e=>{if(applying||!allowed.test(e.detail?.key)||!enabled())return;scope();generation++;localStorage.setItem('mkty_cloud_dirty','yes');schedule();});
 window.addEventListener('online',()=>{loaded=false;flush();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)flush();else{loaded=false;load();}});
 window.MKTYCloud={load,flush,snapshot};
})();
