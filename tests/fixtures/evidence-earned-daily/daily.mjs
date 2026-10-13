// TEST ONLY: permanent, isolated realm bindings. No original source rewriting.
// DOM/IIFE closure and native callback machinery are not claimed as heap bounds.
export const DAILY_SOURCE_HASH='37057554f05ddbd593734bd9390e056970b5267918b63491d292b5d227eebddb';
export const DAILY_SOURCE_INTEGRITY='sha256-NwV1VPBd29WTc0vZOQ4FaXC1JnkYtjSR0pK10ifuvds=';
export const BRIDGE_LIMIT=24576; // Remaining8192 belongs to the main fixture cache.
const KEYS=['mkty_daily_demo','mkty_points','mkty_life9'];
const fail=reason=>{throw new Error('daily-bridge-'+reason);};
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
export function measureBridge(value){
  // Count the JSON UTF16 representation without constructing another string.
  let units=0,nodes=0;const seen=new Set(),add=n=>{units+=n;if(units*2>BRIDGE_LIMIT)fail('limit');};
  function str(s){add(2);for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);
    if(c===34||c===92||[8,9,10,12,13].includes(c))add(2);
    else if(c<32)add(6);
    else if(c>=0xd800&&c<=0xdbff&&s.charCodeAt(i+1)>=0xdc00&&s.charCodeAt(i+1)<=0xdfff){add(2);i++;}
    else add(c>=0xd800&&c<=0xdfff?6:1);
  }}
  function visit(v,depth=0){
    if(++nodes>4096||depth>64)fail('limit');
    if(v===null){add(4);return;}if(typeof v==='string'){str(v);return;}
    if(typeof v==='boolean'){add(v?4:5);return;}
    if(typeof v==='number'&&Number.isFinite(v)){add(String(v).length);return;}
    if(!v||typeof v!=='object'||seen.has(v))fail('representation');
    const array=Array.isArray(v);seen.add(v);add(2);let i=0;
    for(const key of Object.keys(v)){
      const p=Object.getOwnPropertyDescriptor(v,key);if(!p||!Object.hasOwn(p,'value'))fail('representation');
      if(i++)add(1);if(!array){str(key);add(1);}visit(p.value,depth+1);
    }seen.delete(v);
  }visit(value);return units*2;
}
export function narrowDailyValues(values,day){
  if(!values||typeof values!=='object')fail('values');
  const out=Object.fromEntries(KEYS.map(key=>[key,values[key]??null]));
  if(typeof out.mkty_daily_demo!=='string'||out.mkty_daily_demo.length*2>4096)fail('daily-limit');
  if(typeof out.mkty_points!=='string'||!/^(0|[1-9]\d*)$/.test(out.mkty_points)||!Number.isSafeInteger(Number(out.mkty_points)))fail('points');
  if(out.mkty_life9!==null&&out.mkty_life9!=='complete')fail('lock');
  let daily;try{daily=JSON.parse(out.mkty_daily_demo);}catch{fail('daily-json');}
  if(!daily||Array.isArray(daily)||daily.cday!==day||![0,1].includes(daily.streak)||
    (Object.hasOwn(daily,'last_day')?(daily.last_day!==day||daily.streak!==1):daily.streak!==0))fail('daily-domain');
  measureBridge(daily);measureBridge(out);return out;
}
export function fixedDailyDate(NativeDate,day){
  if(typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day))fail('day');
  const time=NativeDate.parse(day+'T00:00:00Z');
  if(!Number.isFinite(time)||new NativeDate(time).toISOString().slice(0,10)!==day)fail('day');
  return class FixedDate extends NativeDate{constructor(...args){super(...(args.length?args:[time]));}static now(){return time;}};
}
export function createDailyChild(win){
  const doc=win.document,NativeDate=win.Date,proto=win.EventTarget.prototype;
  const add=proto.addEventListener,remove=proto.removeEventListener;
  const timeout=win.setTimeout.bind(win),interval=win.setInterval.bind(win);
  const clearTimeout=win.clearTimeout.bind(win),clearInterval=win.clearInterval.bind(win);
  let initialized=false,disposed=false,retiring=false,gate=false,armed=false,writing=false,identity=null;
  let isCurrent=()=>false,capture=()=>false,changed=()=>{},faulted=()=>{};
  let privateMap=new Map(),writes=[],errors=[],timerTicks=0,timerSuppressed=0,callbacksSuppressed=0;
  let phase='NEW',epoch=0,sourceDepth=0,authorizedEvent=null,lastInput=null,sourceLoaded=false;
  let sourceScript=null,sourceRegistrationElement=null,rejectLoad=null;
  const timers=new Map(),registrations=[];
  const current=()=>!disposed&&isCurrent()&&phase!=='BLOCKED';
  const blockedInput=ev=>{ev.preventDefault();ev.stopImmediatePropagation();};
  const count=k=>Math.min(1000000000,k+1);
  function representation(extra=null){return {identity,phase,privateValues:Object.fromEntries(privateMap),writes,errors,
    timerCount:timers.size,listenerTypes:registrations.map(r=>r.type),timerTicks,timerSuppressed,callbacksSuppressed,lastInput,extra};}
  function measure(extra=null){const bytes=measureBridge(representation(extra));changed(bytes);return bytes;}
  function quarantine(){doc.body.dataset.quarantine='true';}
  function quiesce(){gate=false;armed=false;writing=false;authorizedEvent=null;epoch++;quarantine();}
  function clear(){privateMap.clear();writes=[];measure();}
  function fault(reason){if(disposed||phase==='BLOCKED')return;
    quiesce();phase='BLOCKED';if(errors.length<4)errors.push(String(reason).slice(0,160));privateMap.clear();writes=[];
    measure();faulted(String(reason).slice(0,160));
  }
  const storage=Object.freeze({
    getItem(key){if((!retiring&&(!current()||!gate))||!KEYS.includes(key)||!privateMap.has(key))fail('read-quiesced');return privateMap.get(key);},
    setItem(key,value){try{
      if(!current()||!writing||!gate||!['mkty_daily_demo','mkty_points'].includes(key)||typeof value!=='string')fail('write-guard');
      if(writes.length>=2||writes.some(w=>w.key===key))fail('write-count');
      if(key==='mkty_daily_demo'?value.length*2>4096:!/^\d{1,16}$/.test(value)||!Number.isSafeInteger(Number(value)))fail('write-limit');
      const next={key,value};measure(next);privateMap.set(key,value);writes.push(freeze(next));measure();
    }catch(error){fault(error.message);throw error;}},
    removeItem(){fault('daily-bridge-remove-forbidden');fail('remove-forbidden');},
    clear(){fault('daily-bridge-clear-forbidden');fail('clear-forbidden');}
  });
  function sourceEntry(){return sourceDepth>0||!!sourceRegistrationElement&&doc.currentScript===sourceRegistrationElement;}
  function callSource(fn){sourceDepth++;try{return fn();}finally{sourceDepth--;}}
  function timer(set,clearNative,fn,ms,args){
    if(!sourceEntry())return set(fn,ms,...args);
    if(disposed||!current()||!gate)fail('callback-disposed');
    if(set!==interval||ms!==2000||timers.size)fail('timer-contract');
    if(typeof fn!=='function')fail('timer-string');const registration=epoch;
    const id=set(()=>{timerTicks=count(timerTicks);
      if(!current()||!gate||writing||registration!==epoch){timerSuppressed=count(timerSuppressed);measure();return;}
      try{callSource(()=>fn(...args));}catch(error){fault(error.message);throw error;}
    },ms);timers.set(id,clearNative);return id;
  }
  function installCallbacks(){
    // Original source callbacks retain their exact bodies. Only fresh-realm
    // entry gates are wrapped; parent timers and all field clocks stay native.
    proto.addEventListener=function(type,fn,options){
      // Browser/test instrumentation may install its own input interceptors
      // after a stale frame is re-exposed. It is not original source authority.
      if(!sourceEntry())return add.call(this,type,fn,options);
      if(disposed||!current()||!gate)fail('callback-disposed');
      const supported=this===win&&type==='mkty:language'||this===doc.getElementById('dailyOps')&&type==='click'||this===doc.getElementById('cipherText')&&type==='input';
      if(!supported||registrations.some(r=>r.target===this&&r.type===type))fail('listener-contract');
      if(!fn)return add.call(this,type,fn,options);const target=this,registration=epoch;
      const wrapped=function(ev){
        if(!current()||!gate||registration!==epoch&&ev!==authorizedEvent){callbacksSuppressed=count(callbacksSuppressed);return;}
        if(type==='click'&&ev!==authorizedEvent){callbacksSuppressed=count(callbacksSuppressed);return;}
        return callSource(()=>typeof fn==='function'?fn.call(this,ev):fn.handleEvent(ev));
      };registrations.push({target,type,fn,wrapped,options});return add.call(this,type,wrapped,options);
    };
    proto.removeEventListener=function(type,fn,options){const r=registrations.find(r=>r.target===this&&r.type===type&&r.fn===fn);
      return remove.call(this,type,r?.wrapped??fn,options);};
    Object.defineProperties(win,{
      setTimeout:{value:(fn,ms,...args)=>timer(timeout,clearTimeout,fn,ms,args),writable:false,configurable:false},
      setInterval:{value:(fn,ms,...args)=>timer(interval,clearInterval,fn,ms,args),writable:false,configurable:false},
      clearTimeout:{value:id=>{timers.delete(id);clearTimeout(id);},writable:false,configurable:false},
      clearInterval:{value:id=>{timers.delete(id);clearInterval(id);},writable:false,configurable:false},
      // Exported reload/_demoStatus are callback entry points too. They are never
      // used to execute a claim, and cannot enter a quiesced or disposed realm.
      MKTYDaily:{configurable:false,get:()=>dailyExports,set:value=>{
        if(disposed||!current()||!gate)fail('callback-disposed');
        if(dailyExports)fail('exports-replaced');dailyExports=Object.freeze({MORSE:value.MORSE,
          reload:(...args)=>{if(!current()||!gate)fail('callback-quiesced');return value.reload(...args);},
          _demoStatus:(...args)=>{if(!current()||!gate)fail('callback-quiesced');return value._demoStatus(...args);}});
      }}
    });
  }
  let dailyExports=null;
  function input(ev){
    const target=ev.target?.closest?.('#streakBtn'),allowed=current()&&armed&&target&&!target.disabled;
    if(ev.type!=='click'){if(!allowed)blockedInput(ev);return;}
    lastInput={isTrusted:ev.isTrusted===true,target:ev.target?.id||'',prevented:true};
    if(!allowed||!ev.isTrusted){blockedInput(ev);measure();return;}
    try{
      // Parent refreshes only the raw read cache here, before original listener.
      if(!capture(ev,{...identity})){blockedInput(ev);measure();return;}
      armed=false;gate=true;writing=true;phase='RUNNING';authorizedEvent=ev;
      lastInput.prevented=false;quarantine();measure();
    }catch(error){blockedInput(ev);fault(error.message);}
  }
  function initialize(options){
    if(initialized||disposed)fail('initialize-once');initialized=true;
    if(doc.readyState!=='complete')fail('document-not-complete');
    const {day,session,generation}=options;
    if(typeof session!=='string'||!/^[a-f0-9]{32}$/.test(session)||!Number.isSafeInteger(generation))fail('identity');
    identity=freeze({day,session,generation});isCurrent=options.isCurrent;capture=options.capture;
    changed=options.changed;faulted=options.faulted;
    privateMap=new Map(Object.entries(narrowDailyValues(options.values,day)));options=null;
    Object.defineProperties(win,{Date:{value:fixedDailyDate(NativeDate,day),writable:false,configurable:false},
      localStorage:{value:storage,writable:false,configurable:false}});
    if(win.Telegram?.WebApp?.initData||win.MKTYRewards)fail('online-forbidden');
    for(const type of ['click','input','change','keydown','keyup','pointerdown','pointerup','submit'])add.call(win,type,input,true);
    for(const type of ['error','unhandledrejection'])add.call(win,type,ev=>{
      ev.preventDefault();fault(ev.error?.message||ev.reason?.message||ev.message||'daily-bridge-child-error');
    },true);
    phase='LOADING';gate=true;installCallbacks();measure();
    return new Promise((resolve,reject)=>{
      const script=doc.createElement('script');sourceScript=script;sourceRegistrationElement=script;rejectLoad=reject;
      script.src='/daily-retention.js';script.integrity=DAILY_SOURCE_INTEGRITY;
      script.crossOrigin='anonymous';
      add.call(script,'load',()=>{if(disposed)return;sourceLoaded=true;sourceScript=null;rejectLoad=null;resolve();},{once:true});
      add.call(script,'error',()=>{fault('daily-bridge-source-load');reject(new Error('daily-bridge-source-load'));},{once:true});
      doc.head.appendChild(script);
    });
  }
  function settled(){
    if(!current()||!sourceLoaded||!dailyExports||writes.length||errors.length||registrations.length!==3||timers.size!==1||!doc.getElementById('streakPips').children.length)fail('mount-unsettled');
    phase='PREPARED';measure();return facts();
  }
  function refresh(values){if(!current()||!armed||writing)fail('refresh-guard');
    const narrowed=narrowDailyValues(values,identity.day);measure(narrowed);privateMap=new Map(Object.entries(narrowed));writes=[];measure();}
  function expose(show){if(!current()||!['PREPARED','PAUSED'].includes(phase))return false;
    armed=!!show;doc.body.dataset.quarantine=show?'false':'true';measure();return true;}
  function pause(){if(!current()||!['PREPARED','PAUSED'].includes(phase))return false;
    quiesce();phase='PAUSED';clear();return true;}
  function drain(){
    if(!current()||phase!=='RUNNING'||!writing||errors.length)fail('drain-guard');
    // Quiesce before taking/clearing output. No source callback can observe the
    // empty map while the owner owns its workspace or an exact-byte retry.
    quiesce();phase='QUIESCED';
    const packet=freeze({dailyText:privateMap.get('mkty_daily_demo'),pointsText:privateMap.get('mkty_points'),
      writes:writes.map(w=>({...w})),nominalFlash:doc.getElementById('dopsFlash').textContent,
      buttonText:doc.getElementById('streakBtn').textContent,buttonDisabled:doc.getElementById('streakBtn').disabled});
    measure(packet);clear();return packet;
  }
  function facts(){return freeze({phase,privateBytes:measureBridge(Object.fromEntries(privateMap)),privateEntries:privateMap.size,
    bytes:measureBridge(representation()),quiesced:!gate,timerTicks,timerSuppressed,callbacksSuppressed,
    errors:[...errors],lastInput:lastInput?{...lastInput}:null,sourceHash:DAILY_SOURCE_HASH,
    sourceLoaded,buttonText:doc.getElementById('streakBtn')?.textContent||'',buttonDisabled:!!doc.getElementById('streakBtn')?.disabled});}
  function showCommitted(){if(!current()||phase!=='QUIESCED')return false;doc.body.dataset.quarantine='false';return true;}
  function dispose(){if(disposed)return;
    const drainFirst=phase==='RUNNING'||phase==='LOADING'&&sourceLoaded;quiesce();disposed=true;phase='DISPOSED';
    sourceScript?.remove();sourceScript=null;rejectLoad?.(new Error('daily-bridge-disposed'));rejectLoad=null;
    for(const [id,clearNative]of timers)clearNative(id);timers.clear();
    for(const r of registrations)remove.call(r.target,r.type,r.wrapped,r.options);registrations.length=0;
    // A dispose during the original async tail revokes all new callbacks and
    // writes immediately. Its already-running offline load may finish reads in
    // this dead realm until the next real task. No owner work is dispatched.
    if(drainFirst){retiring=true;timeout(()=>{retiring=false;privateMap.clear();writes=[];measure();},0);}
    else{privateMap.clear();writes=[];}measure();}
  return Object.freeze({initialize,settled,refresh,expose,pause,drain,facts,showCommitted,dispose});
}
if(typeof window!=='undefined'&&window.document&&window.location.pathname===new URL('./daily.html',import.meta.url).pathname){
  Object.defineProperty(window,'earnedDailyChild',{value:createDailyChild(window),writable:false,configurable:false});
}
