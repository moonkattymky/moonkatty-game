// TEST ONLY. One trusted original daily click, then one unchanged shared-owner
// command. Fulfilled promises never imply native commit/readback success.
import {BRIDGE_LIMIT,DAILY_SOURCE_HASH,measureBridge,narrowDailyValues,fixedDailyDate} from './daily.mjs';
import {validateSharedDaily} from '../../../prototypes/evidence-indexeddb/shared-streak.mjs';
export {BRIDGE_LIMIT,DAILY_SOURCE_HASH};
export const DAILY_FRAME_URL=new URL('./daily.html',import.meta.url).href;
const generations=new WeakMap();let nextGeneration=0;
const task=()=>new Promise(resolve=>globalThis.setTimeout(resolve,0)); // Real task, not guessed microtask counts.
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const fail=reason=>{throw new Error('daily-bridge-'+reason);};
const stable=state=>state==='ACTIVE'||state==='READY';
export function createDailyBridge({frame,day,session,owner,readCanonical,admissionDay,captureAllowed,runOwner,onChange=()=>{},onEvent=()=>{}}){
  fixedDailyDate(Date,day);
  if(frame?.tagName!=='IFRAME'||typeof session!=='string'||!/^[a-f0-9]{32}$/.test(session)||
    ![readCanonical,admissionDay,captureAllowed,runOwner,onChange,onEvent].every(f=>typeof f==='function')||
    !owner||!['view','checkin','retry'].every(k=>typeof owner[k]==='function'))fail('arguments');
  const generation=++nextGeneration;generations.set(frame,generation);
  let state='NEW',reason=null,child=null,childWindow=null,childDocument=null,childBytes=0;
  let ticket=null,mountValues=null,basis=null,expected=null,receipt=null,lastInput=null,originalClicks=0,retries=0;
  let bridgeBytes=0,bridgePeakBytes=0,exposed=false,disposed=false,operation=false,mounting=false;
  let errors=[],loadGuard=null;
  const live=()=>!disposed&&generations.get(frame)===generation&&frame.isConnected!==false&&
    (!childWindow||frame.contentWindow===childWindow&&frame.contentDocument===childDocument&&childWindow.earnedDailyChild===child);
  function retained(extra=null){return {day,session,generation,state,reason,ticket,mountValues,basis,expected,receipt,lastInput,
    originalClicks,retries,errors,extra};}
  function account(extra=null){
    const bytes=measureBridge(retained(extra))+childBytes;
    if(bytes>BRIDGE_LIMIT)fail('limit');bridgeBytes=bytes;bridgePeakBytes=Math.max(bridgePeakBytes,bytes);return bytes;
  }
  function facts(){const c=child?.facts();
    return Object.freeze({state,reason,mounted:!!child&&state!=='MOUNTING',ready:['PREPARED','PAUSED'].includes(state),
      exposed,paused:state==='PAUSED',pending:['DRAINING','SAVING','UNSAVED'].includes(state),committed:state==='SAVED',
      originalClicks,retries,privateBytes:c?.privateBytes??0,privateEntries:c?.privateEntries??0,
      bridgeBytes,bridgePeakBytes,bridgeLimit:BRIDGE_LIMIT,expected,receipt,quiesced:c?.quiesced??true,
      timerTicks:c?.timerTicks??0,timerSuppressed:c?.timerSuppressed??0,callbacksSuppressed:c?.callbacksSuppressed??0,
      sourceHash:DAILY_SOURCE_HASH,frameGeneration:generation,errors:Object.freeze([...errors,...(c?.errors??[])]),
      lastInput:lastInput?Object.freeze({...lastInput}):c?.lastInput??null,
      buttonText:c?.buttonText??'',buttonDisabled:c?.buttonDisabled??true});
  }
  function event(type,detail={}){onEvent(Object.freeze({type,frameGeneration:generation,...detail}));}
  function update(){account();onChange(facts());}
  function hidden(){exposed=false;frame.hidden=true;}
  function block(error){if(disposed||state==='BLOCKED')return;
    reason=String(error?.message||error).slice(0,160);state='BLOCKED';hidden();
    if(errors.length<4)errors.push(reason);
    mountValues=null;
    // Refused oversized representations are discarded, never truncated or
    // retained outside the cap. No owner dispatch/retry is possible afterward.
    if(reason.includes('limit')){ticket=null;basis=null;expected=null;receipt=null;}
    try{child?.dispose();}catch{}childBytes=child?.facts().bytes??0;
    try{update();event('blocked',{reason});}catch{}
  }
  function requireLive(){if(!live())fail('frame-replaced');}
  function canonical(){
    // The complete view is borrowed only within this synchronous function. Its
    // story projection is owned/accounted by the owner, never cloned here.
    const view=readCanonical();
    if(!view||!stable(view.state)||view.busy||typeof view.head?.head?.token!=='string')fail('owner-unavailable');
    const values=narrowDailyValues(view.values,day);
    validateSharedDaily(values.mkty_daily_demo,day);
    return {values,token:view.head.head.token,revision:view.revision};
  }
  function sameBasis(){
    const now=canonical();
    if(!basis||now.token!==basis.token||now.revision!==basis.revision||
      now.values.mkty_points!==basis.pointsText||(now.values.mkty_life9==='complete')!==basis.locked)fail('basis-changed');
  }
  function accept(ev,identity){
    try{
      requireLive();
      if(!['PREPARED','PAUSED'].includes(state)||!exposed||!ticket||originalClicks||!ev.isTrusted||
        identity.session!==session||identity.day!==day||identity.generation!==generation||
        !captureAllowed()||admissionDay()!==day)fail(admissionDay()!==day?'day-rollover':'capture-refused');
      let current=canonical();
      const prior=JSON.parse(current.values.mkty_daily_demo);
      basis=freeze({token:current.token,revision:current.revision,pointsText:current.values.mkty_points,
        locked:current.values.mkty_life9==='complete',claimed:prior.last_day===day});
      child.refresh(current.values);current=null;
      originalClicks++;lastInput=freeze({isTrusted:true,target:'streakBtn',prevented:false});
      state='DRAINING';hidden();update();
      event('capture',{trusted:true,target:'streakBtn',baselinePoints:Number(basis.pointsText),locked:basis.locked,basisToken:basis.token});
      // This task is scheduled during native capture; it cannot run before the
      // original delegated listener and its offline Promise/load tail finish.
      void afterDispatch();return true;
    }catch(error){lastInput=freeze({isTrusted:ev.isTrusted===true,target:ev.target?.id||'',prevented:true});block(error);return false;}
  }
  function validatePacket(packet){
    if(!packet.buttonDisabled)fail('source-unsettled');
    const delta=Number(packet.pointsText)-Number(basis.pointsText),keys=packet.writes.map(w=>w.key);
    const wanted=basis.claimed?[]:basis.locked?['mkty_daily_demo']:['mkty_daily_demo','mkty_points'];
    if(JSON.stringify(keys)!==JSON.stringify(wanted)||packet.nominalFlash!==(basis.claimed?'Already checked in today':'Check-in +3 ⭐')||
      delta!==(basis.claimed||basis.locked?0:3))fail('source-output');
    narrowDailyValues({mkty_daily_demo:packet.dailyText,mkty_points:packet.pointsText,mkty_life9:basis.locked?'complete':null},day);
    validateSharedDaily(packet.dailyText,day);
    for(const write of packet.writes)if(write.value!==(write.key==='mkty_daily_demo'?packet.dailyText:packet.pointsText))fail('source-writes');
    return freeze({...packet,delta,basisToken:basis.token,taskFence:'next-task'});
  }
  async function afterDispatch(){
    await task();if(disposed)return;
    try{
      requireLive();if(state!=='DRAINING')fail('drain-state');
      let packet=child.drain();childBytes=child.facts().bytes;
      expected=validatePacket(packet);packet=null;account();
      if(!child.facts().quiesced||child.facts().privateEntries)fail('private-cache-live');
      event('drain',{writes:expected.writes.length,nominalFlash:expected.nominalFlash,delta:expected.delta});
      event('quiesce',{privateEntries:0});update();
      await dispatch(false);
    }catch(error){block(error);}
  }
  function observe(view){
    requireLive();if(state!=='SAVING')fail('publication-state');
    if(view?.state==='UNSAVED'){
      state='UNSAVED';reason=String(view.reason||'unsaved').slice(0,160);update();event('unsaved',{reason});return;
    }
    if(!view||!stable(view.state)||view.busy)fail(view?.reason||'owner-not-committed');
    const r=view.lastReceipt,legacy=r?.legacyResult;
    if(!r||r.id!==ticket.id||r.delta!==expected.delta||!Number.isSafeInteger(r.revision)||r.revision<=basis.revision||
      view.values?.mkty_daily_demo!==expected.dailyText||view.values?.mkty_points!==expected.pointsText||
      (basis.claimed?legacy?.awarded!==false||legacy?.duplicate!==true:
        legacy?.awarded!==true||legacy?.points!==3||legacy?.shield_used!==false))fail('readback-mismatch');
    if(expected.nominalFlash!==(legacy.awarded?'Check-in +'+legacy.points+' ⭐':'Already checked in today'))fail('receipt-flash');
    // Owner only returns ACTIVE/READY after its native completion receipt and
    // authenticated journal readback. Copy the small daily receipt, not view.
    account(r);if(!child.showCommitted())fail('publication-guard');receipt=freeze(JSON.parse(JSON.stringify(r)));
    state='SAVED';reason=null;frame.hidden=false;exposed=false;update();
    event('readback',{revision:r.revision,delta:r.delta});event('saved',{revision:r.revision,delta:r.delta});
  }
  async function dispatch(retry){
    if(operation)return facts();operation=true;
    try{
      requireLive();if(!expected||!ticket||child.facts().privateEntries||!child.facts().quiesced)fail('dispatch-guard');
      state='SAVING';reason=null;hidden();update();
      await runOwner(retry?'daily-retry':'daily-checkin',async()=>{
        requireLive();if(!retry)sameBasis();
        event('dispatch',{retry,originalClicks});
        const result=await (retry?owner.retry():owner.checkin(ticket));
        if(disposed||state==='BLOCKED')return;
        requireLive();
        observe(result);
      });
    }catch(error){block(error);}finally{operation=false;}
    return facts();
  }
  async function mount(options){
    if(state!=='NEW')fail('mount-once');mounting=true;state='MOUNTING';hidden();
    try{
      if(options.ticket){
        if(measureBridge(options.ticket)>8192)fail('ticket-limit');
        if(options.ticket.day!==day||options.ticket.session!==session||options.ticket.revision!==0)fail('ticket');
        ticket=freeze(JSON.parse(JSON.stringify(options.ticket)));
      }
      mountValues=narrowDailyValues(options.values,day);options=null;validateSharedDaily(mountValues.mkty_daily_demo,day);update();
      await new Promise((resolve,reject)=>{
        const timeout=globalThis.setTimeout(()=>{cleanup();reject(new Error('daily-bridge-frame-timeout'));},10000);
        const cleanup=()=>{globalThis.clearTimeout(timeout);frame.removeEventListener('load',loaded);frame.removeEventListener('error',failed);};
        const loaded=()=>{cleanup();resolve();},failed=()=>{cleanup();reject(new Error('daily-bridge-frame-load'));};
        frame.addEventListener('load',loaded,{once:true});frame.addEventListener('error',failed,{once:true});frame.src=DAILY_FRAME_URL;
      });
      requireLive();
      if(frame.contentWindow.location.href!==DAILY_FRAME_URL)fail('frame-route');
      childWindow=frame.contentWindow;childDocument=frame.contentDocument;child=childWindow.earnedDailyChild;
      if(!child)fail('child-missing');
      loadGuard=()=>{if(!mounting)block(new Error('daily-bridge-frame-replaced'));};frame.addEventListener('load',loadGuard);
      const initialized=child.initialize({day,session,generation,values:mountValues,isCurrent:live,capture:accept,
        changed:bytes=>{childBytes=bytes;account();},faulted:reason=>block(new Error(reason))});mountValues=null;account();
      await initialized;await task();requireLive();child.settled();
      if(!ticket&&!child.facts().buttonDisabled)fail('unadmitted-enabled');
      state='PREPARED';mounting=false;update();event('mounted',{ticket:!!ticket});return facts();
    }catch(error){mountValues=null;mounting=false;block(error);return facts();}
  }
  function expose(show){
    try{requireLive();if(!['PREPARED','PAUSED'].includes(state))return false;
      exposed=!!show;frame.hidden=!show;child.expose(show);update();return true;
    }catch(error){block(error);return false;}
  }
  function pause(){
    try{requireLive();if(!['PREPARED','PAUSED'].includes(state))return false;
      child.pause();state='PAUSED';hidden();update();event('pause',{privateEntries:0});return true;
    }catch(error){block(error);return false;}
  }
  async function retry(){if(disposed||state!=='UNSAVED'||operation)return facts();retries++;return dispatch(true);}
  function dispose(){if(disposed)return;disposed=true;state='DISPOSED';reason=null;hidden();
    if(generations.get(frame)===generation)generations.delete(frame);
    if(loadGuard)frame.removeEventListener('load',loadGuard);child?.dispose();
    ticket=null;mountValues=null;basis=null;expected=null;receipt=null;childBytes=child?.facts().bytes??0;update();}
  account();return Object.freeze({mount,expose,pause,retry,facts,dispose});
}
