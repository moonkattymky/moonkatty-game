// SOURCE ONLY. Immutable invocation observations for a fixed cooperating fixture.
// No restore, delete, native-storage write, reward, DONE, or reload continuation.
import * as C from './contract.mjs';
import {requirePhaseBudget} from './phase-budget.mjs';
import {measureFinaleData,describeFinaleContextDescriptor} from './finale-context-v1.mjs';
import {describeFinalePhaseDescriptor} from './finale-phase-v2.mjs';
const EVENTS=['PREPARED','ISSUED','RETURNED'],WRITER='final-prepared-operations-v1';
const RECORD=['version','session','stage','event','writer','identity','phase','context','previous'];
const PIN=['binding','root','ordinal','total'],HEAD=['version',...PIN,'sealed','token'];
const RECEIPT=['captureIdentity','ordinal','length','root','headToken','sealed','acknowledgement','durability'];
const ITEM=['captureIdentity','descriptor','head','sealed','acknowledgement','durability'];
const FRAME=[65,82,67,72,73,86,69,49];
const fail=reason=>C.fail('invocation-fence-'+reason);
const size=(value,max=32768)=>measureFinaleData([value],max,{nodes:4096});
const samePin=(a,b)=>PIN.every(k=>a[k]===b[k]);
const errorReason=e=>{const p=e&&Object.getOwnPropertyDescriptor(e,'message');return p&&Object.hasOwn(p,'value')&&typeof p.value==='string'?p.value.slice(0,128):'invocation-fence-unavailable';};
function pin(value,phase){
  if(!C.exact(value,PIN)||!C.hex(value.binding)||!C.hex(value.root)||!C.int(value.ordinal)||!C.int(value.total)||
    value.total<21||value.total>(phase?16384:69660)||value.ordinal>(phase?0:2))fail('pin');
  return Object.freeze({...value});
}
function settings(input){
  if(!C.str(input.scope,128)||!input.scope||!(/^[a-f0-9]{32}$/).test(input.session)||
    !((input.chapter===8&&input.phase===1)||(input.chapter===9&&input.phase===2))||!C.hex(input.identity))fail('input');
  return Object.freeze([input.scope,input.session,`${input.chapter}:${input.phase}`,input.identity,
    pin(input.phasePin,true),pin(input.contextPin,false)]);
}
function member(s,name){
  if(name===`fc1:${s[1]}:8`)return 0;if(name===`fc1:${s[1]}:9`)return 1;
  let match=new RegExp(`^fp2:${s[1]}:(8:[01]|9:[012])$`).exec(name);
  if(match)return 2+['8:0','8:1','9:0','9:1','9:2'].indexOf(match[1]);
  match=new RegExp(`^fr1:${s[1]}:(8:1|9:2):(PREPARED|ISSUED|RETURNED)$`).exec(name);
  return match?7+(match[1]==='8:1'?0:3)+EVENTS.indexOf(match[2]):-1;
}
const run=(s,event)=>`fr1:${s[1]}:${s[2]}:${event}`;
function record(s,event,previous){
  if(!EVENTS.includes(event)||(event==='PREPARED'?previous!==null:!C.hex(previous)))fail('record');
  return {version:1,session:s[1],stage:s[2],event,writer:WRITER,identity:s[3],
    phase:{...s[4]},context:{...s[5]},previous};
}
function validateRecord(value,s,event,previous=undefined){
  if(!C.exact(value,RECORD)||value.version!==1||value.session!==s[1]||value.stage!==s[2]||value.event!==event||
    value.writer!==WRITER||value.identity!==s[3]||!samePin(pin(value.phase,true),s[4])||!samePin(pin(value.context,false),s[5])||
    (event==='PREPARED'?value.previous!==null:!C.hex(value.previous))||previous!==undefined&&value.previous!==previous)fail('record');
  if(size(value,1344)>1344)fail('record-limit');return value;
}
function descriptor(s,event,length){return {format:C.FORMAT,scope:s[0],run:run(s,event),kind:'finale-recovery-observation',
  model:'finale-recovery-observation-v1',components:[{name:'observation',encoding:'utf8',length}],note:''};}
function validateDescriptor(value,s,event,total){
  if(!C.int(total)||total<21||total>692)fail('descriptor');
  const expected=descriptor(s,event,total-20);
  if(size(value,896)>896||JSON.stringify(value)!==JSON.stringify(expected))fail('descriptor');
  const d=C.describe(value);if(d.bytes>1024||d.total!==total)fail('descriptor');return d;
}
function canonicalMatch(value,text){
  let offset=0;
  const part=fragment=>{if(!text.startsWith(fragment,offset))fail('canonical');offset+=fragment.length;};
  function object(value,keys){part('{');let first=true;for(const key of keys){if(!first)part(',');first=false;
    part('"'+key+'":');const v=value[key];if(v&&typeof v==='object')object(v,PIN);
    else part(typeof v==='string'?'"'+v+'"':String(v));}part('}');}
  object(value,RECORD);return offset===text.length;
}
function decode(bytes,s,event,previous){
  C.boundedBytes(bytes,692);if(bytes.length<21||FRAME.some((n,i)=>bytes[i]!==n))fail('frame');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),length=bytes.length-20;
  if(view.getUint32(8,true)!==1||view.getBigUint64(12,true)!==BigInt(length)||length>672)fail('frame');
  // No general UTF-8 decoder or temporary text-encode copy: this record is ASCII.
  let text='';for(let i=20;i<bytes.length;i++){if(bytes[i]>127)fail('ascii');text+=String.fromCharCode(bytes[i]);}
  if(text.length*2>1344)fail('record-limit');let value;try{value=JSON.parse(text);}catch{fail('record');}
  validateRecord(value,s,event,previous);if(!canonicalMatch(value,text))fail('canonical');
  return {value,text};
}
function acquire(budget,label,n){
  if(budget.snapshot().reservations[label]!==0)fail('workspace-busy');
  try{budget.reserve(label,n);budget.allocate(label,n);}
  catch(error){if(budget.snapshot().reservations[label]===n){try{budget.release(label,n);}catch{}}throw error;}
}
function release(budget,label,n){const held=budget.snapshot().reservations[label];if(held===n)budget.release(label,n);else if(held!==0)fail('workspace-ownership');}
function hashAccount(budget){let framing=0,hashing=0;return {
  reserve(_name,n){acquire(budget,'helper-framing',n);framing=n;},
  release(_name,n){if(framing!==n)fail('workspace-ownership');framing=0;release(budget,'helper-framing',n);},
  reserveHash(n,text){acquire(budget,'helper-hash',n*(text?2:1));hashing=n*(text?2:1);},
  releaseHash(n,text){if(hashing!==n*(text?2:1))fail('workspace-ownership');hashing=0;release(budget,'helper-hash',n*(text?2:1));},hash(){}
};}
function idle(coordinator,budget){const held=budget.snapshot().reservations;return coordinator.physicalBusy===false&&
  coordinator.retainedBytes===0&&!['stream-candidate','returned-page','phase-assembly','helper-framing','helper-hash',
    'recovery-page','original-read-workspace','callback-scratch','callback-outer-story','callback-inner-story','post-work-1','post-work-2','post-stringify'].some(k=>held[k]);}
function requestSize(q){const {payload,...metadata}=q;return size(metadata);}
function context(value,scope){
  if(!C.exact(value,['scope','generation','sourceIdentity'])||value.scope!==scope||!C.int(value.generation)||
    !C.str(value.sourceIdentity,4096)||!value.sourceIdentity)fail('identity');return Object.freeze({...value});
}
const identityText=(s,c)=>JSON.stringify(['invocation-fence-identity-v1',s[0],c.generation,c.sourceIdentity,s[1],
  Number(s[2][0]),Number(s[2][2])]);
function environment(options){
  const keys=['coordinator','budget','scope','session','chapter','phase','identity','expectedContext','contextPin','phasePin','isCurrent','sessionMetadataBytes'];
  if(!C.exact(options,C.own(options??{},'crypto')?[...keys,'crypto']:keys))fail('input');
  const s=settings(options),expected=context(options.expectedContext,s[0]),budget=requirePhaseBudget(options.budget);
  const coordinator=options.coordinator,crypto=options.crypto??globalThis.crypto,sessionMetadataBytes=options.sessionMetadataBytes;
  if(!coordinator||typeof options.sessionMetadataBytes!=='function')fail('capability');
  let metadataPeak=0,checking=false;
  // These are representation slots, not a heap estimate. The fixed 256 covers
  // scalar flags/counters and the operation's small arrays/property-name rows.
  function charge(values=[],textBytes=0,extraBytes=0){
    if(checking)fail('reentrant');checking=true;
    try{
      const added=C.add(size([s,expected,...values],5120),textBytes,extraBytes,256);
      if(added>5120)fail('metadata-limit');const existing=sessionMetadataBytes();
      if(!C.int(existing)||C.add(existing,added)>32768)fail('metadata-limit');
      budget.allocate('metadata',existing+added);metadataPeak=Math.max(metadataPeak,added);return added;
    }finally{checking=false;}
  }
  options=null;charge();
  return {s,expected,budget,coordinator,crypto,charge,hash:hashAccount(budget),peak:()=>metadataPeak};
}
export function createInvocationFence(options){
  const env=environment(options),isCurrent=options.isCurrent;options=null;
  const {s,expected,budget,coordinator,crypto,charge,hash}=env;
  // Captured separately: never keep the caller's option bag/raw/context capsule.
  if(typeof isCurrent!=='function'||!['appendSegment','readSegments','retry','recover'].every(k=>typeof coordinator[k]==='function'))fail('capability');
  let state='NEW',reason=null,busy=false,checking=false,lastRoot=null,pending=null,frame=null;
  let candidateHeld=false,pageHeld=false,invoked=false,returnedObserved=false,recordedEvent=null;
  const current=()=>{if(checking)fail('reentrant');checking=true;try{if(isCurrent()!==true)fail('stale');}finally{checking=false;}};
  const account=(values=[],textBytes=0,extraBytes=0)=>charge([pending??lastRoot,...values],textBytes,extraBytes);
  const view=()=>Object.freeze({state,reason,busy,invoked,returnedObserved,recordedEvent,
    invocationAllowed:state==='ARMED'&&!busy,playEnabled:false,continueEnabled:false,
    metadataPeak:env.peak(),candidateBytes:candidateHeld?2048:0,returnedPageBytes:pageHeld?1024:0});
  function block(code,unresolved=false){state=unresolved?'UNRESOLVED':'BLOCKED';reason=code;return view();}
  function dropCandidate(){frame=null;if(candidateHeld){candidateHeld=false;release(budget,'stream-candidate',2048);}}
  async function boundary(work){current();try{return await work();}finally{current();}}
  async function verifyIdentity(){let text=identityText(s,expected);account([],text.length*2);
    const identity=await boundary(()=>C.hash(text,crypto,hash));text=null;if(identity!==s[3])fail('identity');}
  async function requireAbsentJournal(){
    let cursor=null,watermark=null,seen=0,members=0;
    do{
      let page=null,owned=false;
      try{
        acquire(budget,'returned-page',16384);owned=true;account([cursor]);
        page=await boundary(()=>coordinator.recover({scope:s[0],cursor,maxHeads:1,maxBytes:8192}));
        if(!C.exact(page,['status','heads','watermark','nextCursor'])||page.status!=='page'||
          !Array.isArray(page.heads)||Object.getPrototypeOf(page.heads)!==Array.prototype||page.heads.length>1||
          Reflect.ownKeys(page.heads).length!==page.heads.length+1||!C.int(page.watermark)||page.watermark>128||
          watermark!==null&&page.watermark!==watermark||page.nextCursor!==null&&!C.str(page.nextCursor,2048)||
          page.heads.length===0&&page.nextCursor!==null)fail('discovery');
        size(page,16384);watermark=page.watermark;cursor=page.nextCursor;
        if(page.heads.length){
          if(++seen>128)fail('discovery');const item=page.heads[0];
          if(!C.exact(item,ITEM)||!C.exact(item.captureIdentity,['scope','run'])||item.captureIdentity.scope!==s[0]||
            !C.str(item.captureIdentity.run,128))fail('discovery');
          const name=item.captureIdentity.run,id=member(s,name);
          if(id<0||(members&(1<<id)))fail('unsupported-or-duplicate-member');members|=1<<id;
          if(!C.exact(item.head,HEAD)||item.sealed!==true||item.head.sealed!==true||item.acknowledgement!=='idb-transaction-complete'||item.durability!=='strict')fail('discovery');
          if(name.startsWith(`fr1:${s[1]}:${s[2]}:`))fail('existing-journal-inspection-only');
          let described=id<2?describeFinaleContextDescriptor(item.descriptor):id<7?describeFinalePhaseDescriptor(item.descriptor):
            validateDescriptor(item.descriptor,[s[0],s[1],id<10?'8:1':'9:2'],EVENTS[(id-7)%3],item.head.total);
          account([described]);if(described.value.scope!==s[0]||described.value.run!==name||described.total!==item.head.total||
            item.head.version!==1||!C.hex(item.head.binding)||!C.hex(item.head.root)||!C.int(item.head.ordinal)||
            !C.str(item.head.token,512))fail('discovery');described=null;
        }
      }finally{page=null;if(owned){owned=false;release(budget,'returned-page',16384);}}
      account([cursor]);if((seen<watermark)!==(cursor!==null)||seen>watermark)fail('incomplete-discovery');
      if(cursor!==null){const decoded=await boundary(()=>C.untoken('r',cursor,crypto,hash));account([cursor,decoded]);
        if(!C.exact(decoded,['scope','W','next'])||decoded.scope!==s[0]||decoded.W!==watermark||decoded.next!==seen+1)fail('discovery-cursor');}
    }while(cursor!==null);
    if(seen!==watermark)fail('incomplete-discovery');
  }
  function frameRecord(event,previous){
    let value=record(s,event,previous);validateRecord(value,s,event,previous);
    let text=JSON.stringify(value);if(text.length*2>1344||!/^[\x00-\x7f]*$/.test(text))fail('record-limit');
    account([value],text.length*2);acquire(budget,'stream-candidate',2048);candidateHeld=true;
    budget.allocate('stream-candidate',text.length+20+text.length);
    frame=new Uint8Array(text.length+20);frame.set(FRAME);const view=new DataView(frame.buffer);
    view.setUint32(8,1,true);view.setBigUint64(12,BigInt(text.length),true);
    // Direct ASCII copying uses less than the allowed temporary encode schedule.
    for(let i=0;i<text.length;i++)frame[20+i]=text.charCodeAt(i);
    if(frame.length>692)fail('frame-limit');value=null;text=null;
  }
  async function prepareAppend(event,previous){
    frameRecord(event,previous);let value=descriptor(s,event,frame.length-20),d0=validateDescriptor(value,s,event,frame.length);
    account([value,d0]);d0=null;
    let d=await boundary(()=>C.descriptor(value,crypto,hash));account([value,d]);
    const binding=d.binding;d=null;
    // The descriptor value stays in the sole request graph, not another text.
    let q={descriptor:value,expectedHead:null,ordinal:0,offset:0,previousRoot:C.ZERO,payload:frame};
    account([binding],0,requestSize(q));const root=await boundary(()=>C.chain({binding},q,frame,crypto,hash));
    q.seal={totalBytes:frame.length,root};pending=[event,previous,binding,null,frame.length];
    value=null;
    // Adapter result envelopes are admitted BEFORE await. This narrow caller
    // response slot includes receipt/currentHead/contextCurrent; larger replies
    // fail closed even when the underlying adapter supports a wider envelope.
    const qBytes=requestSize(q),responseBound=2218+2*(JSON.stringify(s[0]).length-2+run(s,event).length);
    account([],0,qBytes+responseBound);
    let result;try{result=await boundary(()=>coordinator.appendSegment(q,expected));
      const resultBytes=size(result,responseBound);account([],0,qBytes+resultBytes);return result;
    }finally{q=null;pending[3]=root;}
  }
  function acknowledge(result){
    const p=pending,r=result?.receipt,h=result?.currentHead;
    if(!C.exact(result,['status','receipt','currentHead','contextCurrent'])||result.contextCurrent!==true||
      !['committed','duplicate'].includes(result.status)||!C.exact(r,RECEIPT)||!C.exact(r.captureIdentity,['scope','run'])||
      r.captureIdentity.scope!==s[0]||r.captureIdentity.run!==run(s,p[0])||r.ordinal!==0||r.length!==p[4]||
      r.root!==p[3]||r.sealed!==true||r.acknowledgement!=='idb-transaction-complete'||r.durability!=='strict'||
      !C.exact(h,HEAD)||h.version!==1||h.binding!==p[2]||h.root!==p[3]||h.ordinal!==0||h.total!==p[4]||h.sealed!==true||
      typeof h.token!=='string'||h.token.length>512||r.headToken!==h.token)fail('acknowledgement');
    return h.token;
  }
  async function verifyToken(token){
    account([token]);const decoded=await boundary(()=>C.headToken(token,crypto,hash));account([token,decoded]);
    if(decoded.binding!==pending[2]||decoded.root!==pending[3]||decoded.total!==pending[4]||decoded.ordinal!==0||decoded.sealed!==true)fail('head');
  }
  async function readback(token){
    dropCandidate();if(coordinator.physicalBusy!==false||coordinator.retainedBytes!==0)fail('physical-pending');
    const p=pending;let page=null,parsed=null;
    try{
      acquire(budget,'returned-page',1024);pageHeld=true;account([token]);
      page=await boundary(()=>coordinator.readSegments({captureIdentity:{scope:s[0],run:run(s,p[0])},throughHead:token,afterOrdinal:-1,maxBytes:1024}));
      if(!C.exact(page,['status','segments','payloadBytes','throughHead','nextCursor'])||page.status!=='page'||page.throughHead!==token||
        page.nextCursor!==null||page.payloadBytes!==p[4]||!Array.isArray(page.segments)||page.segments.length!==1||
        Object.getPrototypeOf(page.segments)!==Array.prototype||Reflect.ownKeys(page.segments).length!==2)fail('readback');
      const segment=page.segments[0];if(!C.exact(segment,['ordinal','offset','length','root','payload'])||segment.ordinal!==0||
        segment.offset!==0||segment.length!==p[4]||segment.root!==p[3])fail('readback');
      C.boundedBytes(segment.payload,692);if(segment.payload.length!==p[4])fail('readback');
      // Regenerate exact expected fields from the immutable original pins. The
      // canonical text comparison is independent of the adapter's root checks.
      page=null;token=null;parsed=decode(segment.payload,s,p[0],p[1]);account([parsed.value],parsed.text.length*2);
      parsed=null;
      const root=await boundary(()=>C.chain({binding:p[2]},{ordinal:0,offset:0,previousRoot:C.ZERO},segment.payload,crypto,hash));
      if(root!==p[3])fail('readback');return true;
    }finally{parsed=null;page=null;if(pageHeld){pageHeld=false;release(budget,'returned-page',1024);}}
  }
  async function write(event){
    const previous=event==='PREPARED'?null:lastRoot;
    try{
      current();if(!idle(coordinator,budget))return block('physical-or-workspace-busy');
      if(event==='PREPARED'){await verifyIdentity();await requireAbsentJournal();}current();if(!idle(coordinator,budget))return block('physical-or-workspace-busy');account();
      let result=await prepareAppend(event,previous);const status=result?.status;
      if(status==='outcomeUnknown'){result=null;return block('append-outcome-unknown',true);}
      if(status!=='committed'){result=null;return block(status==='duplicate'?'duplicate-inspection-only':status==='conflict'?'immutable-conflict':'append-refused');}
      let token=acknowledge(result);result=null;await verifyToken(token);const reading=readback(token);token=null;await reading;
      current();if(!idle(coordinator,budget))return block('physical-or-workspace-busy');
      lastRoot=pending[3];pending=null;recordedEvent=event;state=event==='ISSUED'?'ARMED':event;reason=null;account();return view();
    }catch(error){return block(errorReason(error),coordinator.retainedBytes>0||coordinator.physicalBusy!==false);}
    finally{try{dropCandidate();}finally{busy=false;}}
  }
  function start(event,required){if(busy)return Promise.resolve(view());if(state!==required)return Promise.resolve(view());busy=true;return write(event).then(()=>view());}
  function invoke(original){
    if(busy||state!=='ARMED')return false;busy=true;
    try{
      account();current();if(typeof original!=='function'||!idle(coordinator,budget)||pending||candidateHeld||pageHeld)fail('invoke-unavailable');current();
      // Consume before calling untrusted original code: throw/reentry never
      // restores a capability. Its own native writes remain its responsibility.
      state='INVOKED';invoked=true;let value=original();
      if(value&&typeof value.then==='function'){value=null;fail('async-original');}
      value=null;returnedObserved=true;account();current();reason=null;return true;
    }catch(error){block(errorReason(error));throw error;}
    finally{busy=false;}
  }
  async function retry(){
    if(busy||state!=='UNRESOLVED'||!pending)return view();busy=true;
    try{
      current();if(coordinator.physicalBusy!==false||!C.int(coordinator.retainedBytes)||coordinator.retainedBytes<1)return view();
      account([],0,2496);let result=await boundary(()=>coordinator.retry());account([result]);
      if(result?.status==='outcomeUnknown')return block('append-outcome-unknown',true);
      if(!['committed','duplicate'].includes(result?.status))return block('retry-inspection-only',coordinator.retainedBytes>0);
      let token=acknowledge(result);result=null;await verifyToken(token);const reading=readback(token);token=null;await reading;recordedEvent=pending[0];
      lastRoot=pending[3];pending=null;return block('retry-inspection-only');
    }catch(error){return block(errorReason(error),coordinator.retainedBytes>0||coordinator.physicalBusy!==false);}
    finally{try{dropCandidate();}finally{busy=false;}}
  }
  return Object.freeze({prepare:()=>start('PREPARED','NEW'),issue:()=>start('ISSUED','PREPARED'),invoke,
    recordReturned:()=>returnedObserved?start('RETURNED','INVOKED'):Promise.resolve(view()),retry:()=>retry().then(()=>view()),view});
}
export async function inspectInvocationFence(options){
  let env,isCurrent;
  const result=(classification,reason=null,extra={})=>Object.freeze({classification,reason,invocationAllowed:false,
    playEnabled:false,continueEnabled:false,inspectionOnly:true,...extra});
  try{env=environment(options);isCurrent=options.isCurrent;}catch(error){return result('unsupported/conflicting',errorReason(error));}
  options=null;const {s,expected,budget,coordinator,crypto,charge,hash}=env;
  if(typeof isCurrent!=='function'||!['recover','readSegments'].every(k=>typeof coordinator[k]==='function'))return result('unavailable','capability');
  let cursor=null,watermark=null,seen=0,members=0,phaseFound=false,contextFound=false,legacy=false;
  const roots=[null,null,null],previous=[null,null,null];let checking=false;
  const current=()=>{if(checking)fail('reentrant');checking=true;try{if(isCurrent()!==true)fail('stale');}finally{checking=false;}};
  const account=(values=[],textBytes=0)=>charge([roots,previous,...(budget.snapshot().reservations['recovery-page']?[]:[cursor]),...values],textBytes);
  async function boundary(work){current();try{return await work();}finally{current();}}
  async function archive(item,event){
    if(!C.exact(item,ITEM)||!C.exact(item.captureIdentity,['scope','run'])||item.captureIdentity.scope!==s[0]||
      !C.exact(item.head,HEAD)||item.head.version!==1||item.sealed!==true||item.head.sealed!==true||
      item.acknowledgement!=='idb-transaction-complete'||item.durability!=='strict')fail('archive');
    let head=item.head;
    let d;
    if(event!==null)d=validateDescriptor(item.descriptor,s,event,head.total);
    else if(item.captureIdentity.run===`fc1:${s[1]}:${s[2][0]}`){
      d=describeFinaleContextDescriptor(item.descriptor);if(!samePin(head,s[5]))fail('context-pin');
    }else{
      d=describeFinalePhaseDescriptor(item.descriptor);if(!samePin(head,s[4]))fail('phase-pin');
    }
    if(d.value.scope!==s[0]||d.value.run!==item.captureIdentity.run||d.total!==head.total||!C.hex(head.binding)||!C.hex(head.root)||
      !C.int(head.ordinal)||head.ordinal>(event===null?2:0)||!C.str(head.token,512))fail('archive');
    account([d]);if(await boundary(()=>C.hash(d.text,crypto,hash))!==head.binding)fail('descriptor-binding');
    d=null;account();let decoded=await boundary(()=>C.headToken(head.token,crypto,hash));
    account([decoded]);if(!samePin(decoded,head)||decoded.sealed!==true)fail('head');
    const capturedRun=item.captureIdentity.run,total=head.total,finalRoot=head.root,binding=head.binding,ordinalLimit=head.ordinal;
    let token=head.token;d=null;item=null;head=null;decoded=null;
    let offset=0,ordinal=0,prior=C.ZERO,recordPrevious=null;
    do{
      const pageBytes=event===null?32768:1024;let page=null,parsed=null,owned=false;
      try{
        acquire(budget,'returned-page',pageBytes);owned=true;account([token,finalRoot,binding,prior]);
        page=await boundary(()=>coordinator.readSegments({captureIdentity:{scope:s[0],run:capturedRun},throughHead:token,
          afterOrdinal:ordinal-1,maxBytes:pageBytes}));
        if(!C.exact(page,['status','segments','payloadBytes','throughHead','nextCursor'])||page.status!=='page'||page.throughHead!==token||
          !Array.isArray(page.segments)||Object.getPrototypeOf(page.segments)!==Array.prototype||page.segments.length!==1||
          Reflect.ownKeys(page.segments).length!==2)fail('readback');
        const segment=page.segments[0];if(!C.exact(segment,['ordinal','offset','length','root','payload'])||segment.ordinal!==ordinal||
          segment.offset!==offset||!C.int(segment.length)||segment.length<1||segment.length!==page.payloadBytes||!C.hex(segment.root))fail('readback');
        C.boundedBytes(segment.payload,pageBytes);if(segment.payload.length!==segment.length||offset+segment.length>total)fail('readback');
        const last=offset+segment.length===total;
        if(last?page.nextCursor!==null:!C.exact(page.nextCursor,['captureIdentity','throughHead','afterOrdinal'])||
          !C.exact(page.nextCursor.captureIdentity,['scope','run'])||page.nextCursor.captureIdentity.scope!==s[0]||
          page.nextCursor.captureIdentity.run!==capturedRun||page.nextCursor.throughHead!==token||page.nextCursor.afterOrdinal!==ordinal)fail('readback');
        let actual=await boundary(()=>C.chain({binding},{ordinal,offset,previousRoot:prior},segment.payload,crypto,hash));
        if(actual!==segment.root||last&&actual!==finalRoot)fail('readback');
        prior=actual;actual=null;
        if(event!==null){
          if(!last||ordinal!==0)fail('receipt-segments');page=null;token=null;
          parsed=decode(segment.payload,s,event);account([parsed.value,finalRoot,binding,capturedRun,prior],parsed.text.length*2);recordPrevious=parsed.value.previous;parsed=null;
        }
        offset+=segment.length;ordinal++;
      }finally{parsed=null;page=null;if(owned){owned=false;release(budget,'returned-page',pageBytes);}}
    }while(offset<total);
    if(ordinal!==ordinalLimit+1||prior!==finalRoot)fail('readback');return {root:finalRoot,previous:recordPrevious};
  }
  try{
    current();if(!idle(coordinator,budget)||['raw-capsule','context-retained','phase-workspace'].some(k=>budget.snapshot().reservations[k]))return result('unavailable','physical-or-workspace-busy');
    let text=identityText(s,expected);account([],text.length*2);
    if(await boundary(()=>C.hash(text,crypto,hash))!==s[3])fail('identity');text=null;
    do{
      let page=null,item=null,owned=false;
      try{
        acquire(budget,'recovery-page',16384);owned=true;
        page=await boundary(()=>coordinator.recover({scope:s[0],cursor,maxHeads:1,maxBytes:8192}));
        if(!C.exact(page,['status','heads','watermark','nextCursor'])||page.status!=='page'||!Array.isArray(page.heads)||
          Object.getPrototypeOf(page.heads)!==Array.prototype||page.heads.length>1||Reflect.ownKeys(page.heads).length!==page.heads.length+1||
          !C.int(page.watermark)||page.watermark>128||watermark!==null&&page.watermark!==watermark||
          page.nextCursor!==null&&!C.str(page.nextCursor,2048)||page.heads.length===0&&page.nextCursor!==null)fail('discovery');
        size(page,16384);watermark=page.watermark;cursor=page.nextCursor;item=page.heads[0]??null;
        if(item&&++seen>128)fail('discovery');
        page=null;
      if(item){
        const capturedRun=item.captureIdentity?.run;
        if(typeof capturedRun!=='string')fail('archive');
        const id=member(s,capturedRun);if(id>=0){if(members&(1<<id))fail('duplicate-member');members|=1<<id;}
        const event=EVENTS.find(event=>capturedRun===run(s,event));
        if(event){const index=EVENTS.indexOf(event);if(roots[index]!==null)fail('duplicate');
          const reading=archive(item,event);item=null;const observation=await reading;roots[index]=observation.root;previous[index]=observation.previous;
        }else if(capturedRun===`fc1:${s[1]}:${s[2][0]}`){
          if(contextFound)fail('duplicate');const reading=archive(item,null);item=null;await reading;contextFound=true;
        }else if(capturedRun===`fp2:${s[1]}:${s[2]}`){
          if(phaseFound)fail('duplicate');const reading=archive(item,null);item=null;await reading;phaseFound=true;
        }else if(new RegExp(`^fr1:${s[1]}:(?:8:1|9:2):(?:PREPARED|ISSUED|RETURNED)$`).test(capturedRun)){
          // Other fixed final's membership is not evidence for this action. Its
          // own inspector verifies those payloads; this pass never adopts them.
        }else if(capturedRun.startsWith('fr'))fail('foreign-or-unsupported');
        else if(!new RegExp(`^(?:fc1:${s[1]}:[89]|fp2:${s[1]}:(?:8:[01]|9:[012]))$`).test(capturedRun))legacy=true;
        item=null;account();
      }
      }finally{item=null;page=null;if(owned){owned=false;release(budget,'recovery-page',16384);}}
      account();if((seen<watermark)!==(cursor!==null)||seen>watermark)fail('incomplete-discovery');
      if(cursor!==null){const decoded=await boundary(()=>C.untoken('r',cursor,crypto,hash));account([decoded]);
        if(!C.exact(decoded,['scope','W','next'])||decoded.scope!==s[0]||decoded.W!==watermark||decoded.next!==seen+1)fail('discovery-cursor');}
    }while(cursor!==null);
    if(seen!==watermark)fail('incomplete-discovery');
    current();if(!idle(coordinator,budget))return result('unavailable','physical-or-workspace-busy');
    const extra={watermark,membershipOnly:true,metadataPeak:env.peak()};
    if(legacy)return result(roots.some(Boolean)?'unsupported/conflicting':'absent/legacy-unattributed','legacy-evidence',extra);
    if(!roots.some(Boolean))return result('absent/legacy-unattributed',null,extra);
    if(!contextFound||!phaseFound||!roots[0]||roots[2]&&!roots[1])return result('incomplete/unverified','missing-dependency',extra);
    if(previous[0]!==null||roots[1]&&previous[1]!==roots[0]||roots[2]&&previous[2]!==roots[1])return result('unsupported/conflicting','dependency-mismatch',extra);
    return result(roots[2]?'returned-observation':roots[1]?'issued/no-return-observed':'prepared-only',null,extra);
  }catch(error){const reason=errorReason(error);return result(reason.includes('stale')?'unavailable':'incomplete/unverified',reason,
    {watermark,membershipOnly:true,metadataPeak:env.peak()});}
}
