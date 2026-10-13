// SOURCE ONLY: one explicitly new guest, one terminal and one first-day checkin.
// No player storage, callback, migration, account, server or production entrypoint.
import * as C from './contract.mjs';
import {finaleSession,freezeFinaleData,measureFinaleData} from './finale-context-v1.mjs';
import {requirePhaseBudget} from './phase-budget.mjs';
import {recoverFinaleContext,recoverFinaleContextAndPhase} from './context-reload.mjs';
import {projectAtomicTerminal,validateAtomicTimestamps} from './atomic-terminal-projection.mjs';
import {createSharedLog,SHARED_LOG_CONTRACT} from './shared-log.mjs';
import {projectSharedStreak} from './shared-streak.mjs';
import {equalShared as equal,boundedShared as bounded,copyShared as copy,sharedWorkspace as workspace,
  validateSharedManifest,validateSharedPhasePin,matchSharedDependencies,accountSharedDaily} from './shared-dependencies.mjs';
export {SHARED_LOG_CONTRACT};
const RETAINED=32768,TARGET=65536,TERMINAL='life:9:complete';
const COMMON=['version','contract','principal','scope','session','revision'];
const HEAD=['version','binding','ordinal','total','root','sealed','token'];
const RETRY=new Set(['busy','retry-pending','transaction-aborted','native-quota','logical-quota','open-blocked','open-timeout',
  'operation-timeout','terminal-unobserved','connection-closed','storage-unavailable','indexeddb-unavailable',
  'webcrypto-unavailable','webcrypto-sha256-unavailable','allocation-refused','shared-contention']);
const fail=reason=>C.fail(reason);
const summary=p=>({coreSeconds:p.coreSeconds,addedSeconds:p.addedSeconds,reward:p.reward,presentation:p.presentation});
export function createSharedGuestOwner({adapter,scope,session,principal,budget,crypto=globalThis.crypto,admissionDay}){
  requirePhaseBudget(budget);
  if(!C.str(scope,128)||!scope||!finaleSession(session)||typeof principal!=='string'||!/^guest:[a-zA-Z0-9_-]{1,64}$/.test(principal))fail('shared-principal');
  if(typeof admissionDay!=='function')fail('shared-clock');
  const identity={scope,session,principal,contract:SHARED_LOG_CONTRACT};
  const log=createSharedLog({adapter,scope,session,principal,budget,crypto});
  if(budget.snapshot().reservations['atomic-retained'])fail('budget-lifetime');
  try{budget.reserve('atomic-retained',RETAINED);budget.allocate('atomic-retained',RETAINED);}
  catch(error){const n=budget.snapshot().reservations['atomic-retained'];if(n)try{budget.release('atomic-retained',n);}catch{}throw error;}
  let state='NEW',reason=null,busy=false,disposed=false,head=null,manifest=null,current=null,effects=[];
  let projection=null,projectionHeld=false,intent=null,proposal=null,incoming=null,unknown=false,lastReceipt=null;
  function account(...extra){
    const small=projection?{...summary(projection),values:Object.fromEntries(Object.entries(projection.values).filter(([k])=>k!=='mkty_story_plan_9_v1'))}:null;
    const bytes=measureFinaleData([identity,head,manifest,current,effects,intent,proposal,incoming,lastReceipt,small,...extra],RETAINED,{restrictedKeys:true});
    budget.allocate('atomic-retained',RETAINED);budget.event('shared-retained-state',{bytes,limit:RETAINED});
  }
  function releaseProjection(){projection=null;
    if(projectionHeld){projectionHeld=false;const n=budget.snapshot().reservations['post-target'];if(n)budget.release('post-target',n);}}
  function values(){if(!current)return null;
    return Object.freeze({...projection?.values,mkty_points:String(current.points),mkty_daily_demo:current.dailyText});}
  function view(){return Object.freeze({state,reason,busy,revision:head?.head.ordinal??null,head,manifest,
    projection,values:values(),lastReceipt,retryEnabled:state==='UNSAVED'&&!busy,continueEnabled:state==='READY'&&!busy,budget:budget.snapshot()});}
  function baseRecord(revision){return {version:1,contract:SHARED_LOG_CONTRACT,principal,scope,session,revision};}
  function recordShape(record,revision,adoption=false){
    bounded(record);
    if(!C.exact(record,[...COMMON,...(adoption?['manifest']:['command','stateAfter','receipt'])])||
      !equal(Object.fromEntries(COMMON.map(k=>[k,record[k]])),baseRecord(revision)))fail('shared-record-order');
  }
  function eligible(){if(admissionDay()!==manifest.dailyDay)fail('shared-day-rollover');}
  async function dependencies(pin=null){
    budget.allocate('metadata',8192);budget.event('shared-dependency-caller',{bytes:measureFinaleData([identity,state],4096)+4096,limit:8192});
    const lease=pin?await recoverFinaleContextAndPhase({adapter,contextPin:manifest.contextPin,phasePin:pin,budget,crypto}):
      await recoverFinaleContext({adapter,contextPin:manifest.contextPin,budget,crypto});
    try{const timestamps=matchSharedDependencies(manifest,lease,budget);return {lease,timestamps};}
    catch(error){lease.dispose();throw error;}
  }
  async function read(pin,ordinal){const lease=await log.readRecord(pin,ordinal);
    try{incoming=lease.record;account();return incoming;}
    finally{lease.dispose();}}
  function commandShape(command){
    bounded(command,8192);
    if(command?.kind==='terminal'){
      if(!C.exact(command,['id','kind','phasePin','timestamps'])||command.id!==TERMINAL)fail('shared-command');
      validateSharedPhasePin(command.phasePin,scope,session);validateAtomicTimestamps(command.timestamps);
    }else if(command?.kind==='daily'){
      if(!C.exact(command,['id','kind','ticket'])||command.id!==`streak:${manifest.dailyDay}`)fail('shared-command');
      const t=command.ticket;
      if(!C.exact(t,['version','id','principal','scope','session','day','revision','head'])||t.version!==1||t.id!==command.id||t.principal!==principal||
        t.scope!==scope||t.session!==session||t.day!==manifest.dailyDay||t.revision!==0||t.head?.head?.ordinal!==0)fail('shared-ticket');
      if(!equal(t.head.descriptor,head.descriptor))fail('shared-ticket');
    }else fail('shared-command');
  }
  async function checkTicket(command){
    const lease=await log.readRecord(command.ticket.head,0);
    try{const r=lease.record;recordShape(r,0,true);if(!equal(r.manifest,manifest))fail('shared-ticket');}
    finally{lease.dispose();}
  }
  async function reduce(command,revision){
    commandShape(command);if(effects.some(e=>e.command.id===command.id))fail('shared-command-duplicate');
    let stateAfter,receipt;
    if(command.kind==='daily'){
      await checkTicket(command);
      workspace(budget,()=>{
        const out=projectSharedStreak({dailyText:current.dailyText,points:current.points,locked:current.locked,day:manifest.dailyDay});
        accountSharedDaily(current.dailyText,manifest.dailyDay,budget,{stage:'projection',outputBytes:out.dailyText.length*2});
        stateAfter={points:out.points,locked:current.locked,dailyText:out.dailyText};
        receipt={id:command.id,revision,delta:out.delta,legacyResult:out.legacyResult};account(stateAfter,receipt);
      });
    }else{
      if(current.locked)fail('shared-terminal-state');releaseProjection();
      const dep=await dependencies(command.phasePin);
      try{
        if(!equal(dep.timestamps,command.timestamps))fail('shared-command-conflict');
        if(budget.snapshot().reservations['post-target'])fail('budget-lifetime');
        try{budget.reserve('post-target',TARGET);projectionHeld=true;budget.allocate('post-target',TARGET);}
        catch(error){projectionHeld=budget.snapshot().reservations['post-target']>0;throw error;}
        projection=projectAtomicTerminal({storyText:dep.lease.storyText,sourceSeconds:manifest.source.seconds,phaseSeconds:dep.lease.phase.summary.seconds,
          baseline:{...manifest.baseline,points:current.points},timestamps:command.timestamps},budget);
        stateAfter={points:projection.reward.balance,locked:true,dailyText:current.dailyText};
        receipt={id:command.id,revision,delta:3000,result:summary(projection)};account(stateAfter,receipt);
      }finally{dep.lease.dispose();}
    }
    return freezeFinaleData({stateAfter,receipt});
  }
  async function refresh(){
    releaseProjection();incoming=null;effects=[];current=null;lastReceipt=null;
    head=await log.head();account();
    if(!head){manifest=null;state='NEW';return;}
    let record=await read(head,0);recordShape(record,0,true);manifest=record.manifest;incoming=null;record=null;account();
    validateSharedManifest(manifest,identity,budget);
    const dep=await dependencies();dep.lease.dispose();
    current=freezeFinaleData({points:manifest.baseline.points,locked:false,dailyText:manifest.dailyText});account();
    for(let ordinal=1;ordinal<=head.head.ordinal;ordinal++){
      record=await read(head,ordinal);recordShape(record,ordinal);
      const reduced=await reduce(record.command,ordinal);
      if(!equal(reduced.stateAfter,record.stateAfter)||!equal(reduced.receipt,record.receipt))fail('shared-effect-mismatch');
      effects.push(freezeFinaleData({command:record.command,receipt:record.receipt}));current=record.stateAfter;lastReceipt=record.receipt;
      incoming=null;record=null;account();
    }
    state=current.locked?'READY':'ACTIVE';reason=null;
  }
  function existing(){
    if(intent?.kind==='adoption'){
      if(!manifest)return false;if(!equal(manifest,intent.manifest))fail('shared-adoption-conflict');return true;
    }
    const found=effects.find(e=>e.command.id===intent?.id);if(!found)return false;
    if(!equal(found.command,intent))fail('shared-command-conflict');lastReceipt=found.receipt;return true;
  }
  function complete(){intent=null;proposal=null;unknown=false;reason=null;account();}
  function receiptMatches(result){
    const r=result.receipt,p=result.proposalPin,h=result.currentHead;
    return r?.acknowledgement==='idb-transaction-complete'&&r.durability==='strict'&&r.captureIdentity?.scope===scope&&
      r.captureIdentity.run===p?.descriptor?.run&&r.ordinal===p?.head?.ordinal&&r.length===16384&&r.root===p.head.root&&
      r.headToken===p.head.token&&r.sealed===p.head.sealed&&C.exact(h,HEAD)&&h.version===1&&h.binding===p.head.binding&&
      Number.isInteger(h.ordinal)&&h.ordinal>=p.head.ordinal&&h.ordinal<=2&&h.total===(h.ordinal+1)*16384&&
      h.sealed===(h.ordinal===2)&&C.hex(h.root)&&C.str(h.token,2048)&&
      (h.ordinal!==p.head.ordinal||h.token===p.head.token);
  }
  async function observeResult(result){
    if(result?.status==='outcomeUnknown'){
      if(!adapter.retainedBytes)fail('shared-retry-capability');unknown=true;fail('terminal-unobserved');
    }
    if(result?.status==='committed'||result?.status==='duplicate'){
      if(adapter.retainedBytes||!receiptMatches(result))fail('shared-acknowledgement');unknown=false;proposal=null;result=null;
      await refresh();if(!existing())fail('shared-readback-missing');complete();return true;
    }
    if(result?.status==='conflict'){unknown=false;proposal=null;return false;}
    unknown=adapter.retainedBytes>0;fail(result?.reason||'shared-storage-result');
  }
  async function persist(){
    for(let attempt=0;attempt<3;attempt++){
      await refresh();if(existing()){complete();return;}
      if(adapter.physicalBusy||adapter.retainedBytes)fail('retry-pending');
      if(intent.kind==='adoption'){
        if(head)fail('shared-adoption-conflict');manifest=intent.manifest;validateSharedManifest(manifest,identity,budget);eligible();
        const dep=await dependencies();dep.lease.dispose();proposal=freezeFinaleData({...baseRecord(0),manifest});
      }else{
        if(!manifest)fail('shared-not-adopted');eligible();
        if(head.head.ordinal>=2)fail('shared-capacity');
        const reduced=await reduce(intent,head.head.ordinal+1);
        proposal=freezeFinaleData({...baseRecord(head.head.ordinal+1),command:intent,...reduced});
        // Speculative story is never the published canonical projection.
        releaseProjection();
      }
      account();eligible();
      // Prototype-only cutoff covers both new commands. Already dispatched
      // transactions are observed normally even if they finish after midnight.
      const day=manifest.dailyDay;
      const result=await log.append(proposal,head,()=>!disposed&&admissionDay()===day);
      if(await observeResult(result))return;
    }
    fail('shared-contention');
  }
  async function execute(work){
    if(disposed||busy)return view();busy=true;reason=null;
    try{await work();}
    catch(error){reason=error instanceof RangeError?'allocation-refused':error?.message||'shared-storage-result';state=RETRY.has(reason)?'UNSAVED':'BLOCKED';
      incoming=null;try{releaseProjection();}catch(cleanup){reason=cleanup?.message||'shared-cleanup';state='BLOCKED';}}
    finally{busy=false;}return view();
  }
  const blocked=()=>disposed||busy||unknown||adapter.retainedBytes||adapter.physicalBusy;
  function pendingCall(kind,value){
    if(!intent)return null;
    let same=false;
    try{workspace(budget,()=>{const candidate=copy(value,kind==='adoption'?16340:8192);
      same=intent.kind===kind&&equal(candidate,kind==='adoption'?intent.manifest:kind==='daily'?intent.ticket:intent.phasePin);});}catch{}
    // Exact repeats retain the original command; another action cannot displace
    // an unresolved known abort/quota result merely because no lease is held.
    return same?retry():Promise.resolve(view());
  }
  function adopt(value){if(blocked())return Promise.resolve(view());const repeat=pendingCall('adoption',value);if(repeat)return repeat;return execute(async()=>{
    const copied=workspace(budget,()=>copy(value));validateSharedManifest(copied,identity,budget);
    intent=freezeFinaleData({kind:'adoption',manifest:copied});proposal=null;account();await persist();
  });}
  async function admitDaily(){if(blocked()||intent)return null;let ticket=null;
    await execute(async()=>{
      await refresh();if(!manifest)fail('shared-not-adopted');
      if(current.locked)fail('shared-daily-locked');if(effects.some(e=>e.command.kind==='daily'))fail('shared-daily-claimed');eligible();
      ticket=freezeFinaleData({version:1,id:`streak:${manifest.dailyDay}`,principal,scope,session,day:manifest.dailyDay,revision:head.head.ordinal,head});account(ticket);
    });return ticket;
  }
  function checkin(ticket){if(blocked())return Promise.resolve(view());const repeat=pendingCall('daily',ticket);if(repeat)return repeat;return execute(async()=>{
    const captured=workspace(budget,()=>copy(ticket,8192));intent=freezeFinaleData({id:captured.id,kind:'daily',ticket:captured});proposal=null;account();await persist();
  });}
  function submitTerminal(pin){if(blocked())return Promise.resolve(view());const repeat=pendingCall('terminal',pin);if(repeat)return repeat;return execute(async()=>{
    const captured=workspace(budget,()=>copy(pin,4096));validateSharedPhasePin(captured,scope,session);
    // Keep the private pin charged across reload and evidence authentication.
    intent=freezeFinaleData({id:TERMINAL,kind:'terminal',phasePin:captured,timestamps:null});proposal=null;account();
    await resolveTerminalIntent();await persist();
  });}
  async function resolveTerminalIntent(){
    if(intent?.kind!=='terminal'||intent.timestamps!==null)return;
    // A transient read can fail before the tuple is resolved. Keep the captured
    // pin and reauthenticate that evidence on retry; no new clock or pin enters.
    await refresh();if(!manifest)fail('shared-not-adopted');
    releaseProjection();const dep=await dependencies(intent.phasePin);
    try{intent=freezeFinaleData({...intent,timestamps:dep.timestamps});account();}finally{dep.lease.dispose();}
  }
  function retry(){if(disposed||busy||!intent)return Promise.resolve(view());return execute(async()=>{
    if(unknown){
      if(adapter.physicalBusy)fail('busy');
      // Reads may be refused by the unchanged adapter while it owns the retry
      // lease. Midnight must never turn that into an insertion-capable retry.
      if(admissionDay()!==manifest?.dailyDay){
        try{await refresh();existing();}catch(error){if(error.message!=='retry-pending')throw error;}
        fail('shared-rollover-retained');
      }
      const day=manifest.dailyDay;
      if(await observeResult(await log.retry(()=>!disposed&&admissionDay()===day)))return;
    }
    await resolveTerminalIntent();await persist();
  });}
  function recover(){if(disposed||busy)return Promise.resolve(view());return execute(async()=>{
    if(unknown||adapter.retainedBytes||adapter.physicalBusy)fail('retry-pending');
    await resolveTerminalIntent();await refresh();if(intent){if(existing())complete();else fail('shared-contention');}
  });}
  function dispose(){
    if(busy||unknown||adapter.retainedBytes||adapter.physicalBusy)fail('shared-owner-busy');if(disposed)return;
    let error;try{releaseProjection();}catch(e){error=e;}
    head=null;manifest=null;current=null;effects=[];intent=null;proposal=null;incoming=null;lastReceipt=null;disposed=true;state='DISPOSED';
    try{budget.release('atomic-retained',RETAINED);}catch(e){error??=e;}if(error)throw error;
  }
  return Object.freeze({adopt,admitDaily,checkin,submitTerminal,retry,recover,view,dispose});
}
