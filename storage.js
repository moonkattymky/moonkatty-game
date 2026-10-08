/* One storage boundary for every legacy controller. Account namespaces are selected
   before any game script runs; they are isolation, never authentication. The server
   remains authoritative. Keep the Storage API so older controllers cannot bypass it. */
(()=>{
 'use strict';
 let native=null,persistent=true;const memory=new Map();
 try{native=window.localStorage;native.getItem('mkty_lang');}catch{persistent=false;}
 const shared=new Set(['mkty_lang','mkty_control_sound','mkty_light_fx']);
 function identity(){try{const u=JSON.parse(new URLSearchParams(window.Telegram?.WebApp?.initData||'').get('user'));return /^\d+$/.test(String(u?.id))?String(u.id):'guest';}catch{return 'guest';}}
 const rawGet=k=>{if(memory.has(k))return memory.get(k);try{return native?.getItem(k)??null;}catch{fail();return null;}};
 function rawSet(k,v){memory.set(k,v);try{if(!native)throw Error('storage');v===null?native.removeItem(k):native.setItem(k,v);memory.delete(k);return true;}catch{fail();return false;}}
 function fail(){const changed=persistent;persistent=false;if(changed)queueMicrotask(notice);}
 function physical(k){k=String(k);return !k.startsWith('mkty_')||shared.has(k)||/^mkty_pending_v2_/.test(k)||identity()==='guest'?k:'mkty_account_v3_'+identity()+':'+k;}
 function keys(){const all=new Set(memory.keys());try{for(let i=0;i<native.length;i++)all.add(native.key(i));}catch{fail();}return [...all].filter(k=>rawGet(k)!==null);}
 // Only migrate an old save whose existing session already identifies its owner.
 // Unattributed guest saves stay intact; a new account restores achievements from the server.
 const owner=identity();
 if(owner!=='guest'&&!rawGet('mkty_legacy_owner_v3')){
  let known=false;try{const owners=Array.from({length:sessionStorage.length},(_,i)=>sessionStorage.key(i)).filter(k=>k?.startsWith('mkty_session_v1_'));known=owners.length===1&&owners[0]==='mkty_session_v1_'+owner&&!!JSON.parse(sessionStorage.getItem(owners[0])||'null')?.token;}catch{}
  if(known){let ok=true;for(const k of keys())if(k.startsWith('mkty_')&&!shared.has(k)&&!/^mkty_(account_v3_|pending_v2_|legacy_owner)/.test(k))ok=rawSet('mkty_account_v3_'+owner+':'+k,rawGet(k))&&ok;if(ok)rawSet('mkty_legacy_owner_v3',owner);}
 }
 const api={
  getItem:k=>rawGet(physical(k)),setItem:(k,v)=>{const old=rawGet(physical(k));rawSet(physical(k),String(v));if(old!==String(v))window.dispatchEvent(new CustomEvent('mkty:storage',{detail:{key:String(k)}}));},removeItem:k=>{const old=rawGet(physical(k));rawSet(physical(k),null);if(old!==null)window.dispatchEvent(new CustomEvent('mkty:storage',{detail:{key:String(k)}}));},
  key:i=>{const prefix='mkty_account_v3_'+identity()+':';return keys().filter(k=>identity()==='guest'?!k.startsWith('mkty_account_v3_'):k.startsWith(prefix)||shared.has(k)).map(k=>k.startsWith(prefix)?k.slice(prefix.length):k)[i]??null;},
  clear(){const all=[];for(let i=0;i<this.length;i++)all.push(this.key(i));all.forEach(k=>this.removeItem(k));},
  get length(){let n=0;while(this.key(n)!==null)n++;return n;},
  get persistent(){return persistent;},identity,
  retry(){try{if(!native)native=Object.getOwnPropertyDescriptor(Window.prototype,'localStorage')?.get?.call(window);native.setItem('mkty_storage_probe','1');native.removeItem('mkty_storage_probe');for(const [k,v] of memory)v===null?native.removeItem(k):native.setItem(k,v);memory.clear();persistent=true;}catch{persistent=false;}notice();return persistent;}
 };
 window.MKTYStorage=api;
 Object.defineProperty(window,'localStorage',{configurable:true,get:()=>api});
 function notice(){
  if(!document.body)return;let box=document.getElementById('storageRecovery');
  if(persistent){box?.remove();return;}
  if(!box){box=document.createElement('div');box.id='storageRecovery';box.setAttribute('role','alert');box.style.cssText='position:fixed;z-index:20000;top:env(safe-area-inset-top,0px);left:8px;right:8px;max-width:580px;margin:auto;padding:12px 14px;background:#fff1cf;color:#372b16;border:1px solid #af873c;border-radius:8px;font:13px/1.4 system-ui;box-shadow:0 4px 20px #0005';document.body.append(box);}
  const ru=rawGet('mkty_lang')==='ru';box.replaceChildren();const text=document.createElement('span');text.textContent=ru?'Память устройства недоступна. Изменения пока хранятся только в открытой игре. Не закрывайте её до восстановления сохранения. ':'Device storage is unavailable. Changes are kept only in this open game. Restore saving before closing it. ';const button=document.createElement('button');button.type='button';button.textContent=ru?'Повторить сохранение':'Retry saving';button.style.cssText='min-height:44px;padding:8px 12px';button.onclick=()=>api.retry();box.append(text,button);
 }
 document.addEventListener('DOMContentLoaded',notice);window.addEventListener('mkty:language',notice);
})();
