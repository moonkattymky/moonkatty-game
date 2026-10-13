'use strict';
// Synthetic portable codec tests only. No account/native storage/controller claim.
const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const Field=require('../field-model.js');let checks=0;
const eq=(a,b)=>{assert.deepStrictEqual(a,b);checks++;},ok=v=>{assert(v);checks++;};
const throws=(f,re=/legacy-|budget-|allocation-/)=>{assert.throws(f,re);checks++;};
const clone=v=>structuredClone(v);
(async()=>{
  const L=await import(pathToFileURL(path.resolve(__dirname,'../prototypes/evidence-indexeddb/legacy-adoption-codec.mjs')));
  const {createPhaseBudget}=await import(pathToFileURL(path.resolve(__dirname,'../prototypes/evidence-indexeddb/phase-budget.mjs')));
  const guards=()=>({version:1,origin:'closed-original-field-guest-fixture',principal:'guest:portable-codec',epoch:1,
    identity:'guest',initData:'',durable:true,exclusive:true,sourceClosed:true,overlay:false,legacyOwnerRaw:null,
    cloudRaw:Object.fromEntries(L.LEGACY_CLOUD_KEYS.map(k=>[k,null])),unattributedPendingPresent:false});
  const raw=()=>{const baseSeed=997,cp=Field.create(11,4,(baseSeed+2*7919)>>>0);cp.trace=[['act','wait',0]];Field.act(cp,'wait',0);
    const r=Object.fromEntries(L.LEGACY_KEYS.map(k=>[k,null]));Object.assign(r,{
      mkty_story_plan_9_v1:JSON.stringify({version:1,edition:2,n:9,seed:12,phase:'core',done:[7,6,5,4,3,2,1,0],tasks:{opaque:'untouched'},coreSeconds:11,createdAt:1700000000000}),
      mkty_field_finale_9_v1:JSON.stringify({version:1,n:9,phase:2,seed:baseSeed,seconds:8,checkpoint:cp,unknown:{note:'raw envelope retained'}}),
      mkty_operations_9_v1:' {"version":1,"n":9,"seed":81,"round":3,"phase":"core","confirmed":false,"actions":23,"hints":3,"errors":2,"seconds":10.5,"input":{"opaque":[1,2]},"unknown":"retained"} ',
      mkty_points:'0000042',mkty_daily_demo:' \ud800\udfff\u0000\r\nnot normalized ',mkty_current_chapter:'9'});return r;};
  const clean=b=>eq(b.snapshot().live,425984);
  function frame(cap,b,next=false){const total=(next?L.nextInfo:L.legacyInfo)(cap).byteLength,out=new Uint8Array(total);
    for(let off=0;off<total;off+=32768){const n=Math.min(32768,total-off);b.reserve('stream-candidate',n);
      try{const p=(next?L.copyNextRange:L.copyLegacyRange)(cap,off,n,b);ok((next?L.compareNextRange:L.compareLegacyRange)(cap,off,p));out.set(p,off);}
      finally{b.release('stream-candidate',n);}}return out;}
  function mutateCheckpoint(r,fn){const s=JSON.parse(r.mkty_field_finale_9_v1);fn(s.checkpoint,s);r.mkty_field_finale_9_v1=JSON.stringify(s);return r;}
  function refused(r,g=guards()){const b=createPhaseBudget();throws(()=>L.admitLegacyBundle(r,g,Field,b));clean(b);}
  const b=createPhaseBudget(),r=raw(),saved=clone(r),cap=L.admitLegacyBundle(r,guards(),Field,b);
  eq(L.LEGACY_KEYS.length,12);eq(L.legacyInfo(cap).principal,'guest:portable-codec');eq(L.legacyInfo(cap).epoch,1);
  for(const key of L.LEGACY_KEYS)eq(L.rawValue(cap,key),r[key]);
  r.mkty_points='mutated outside';eq(L.rawValue(cap,'mkty_points'),saved.mkty_points);ok(Object.isFrozen(cap));
  throws(()=>L.rawValue(cap,'mkty_pending_v2_123'));throws(()=>L.assertLegacyBudget(cap,createPhaseBudget()));
  const sourceBytes=frame(cap,b);eq(sourceBytes.length,622+Object.values(saved).reduce((n,x)=>n+(x===null?0:x.length*2),0));
  for(let offset=0;offset<sourceBytes.length;offset+=17){const n=Math.min(17,sourceBytes.length-offset);b.reserve('stream-candidate',n);
    try{eq(L.copyLegacyRange(cap,offset,n,b),sourceBytes.slice(offset,offset+n));}finally{b.release('stream-candidate',n);}}
  throws(()=>L.copyLegacyRange(cap,0,10,b),/allocation-unreserved/);throws(()=>L.copyLegacyRange(cap,0,32769,b));
  const changed=sourceBytes.slice(0,15);changed[0]^=1;eq(L.compareLegacyRange(cap,0,changed),false);

  const view=L.controllerCheckpoint(cap,b);ok(Object.isFrozen(view.value));ok(Object.isFrozen(view.value.trace));
  eq(view.value.trace,[['act','wait',0]]);throws(()=>L.controllerCheckpoint(cap,b),/budget-lifetime/);
  const preflight=L.prepareLegacyWait(cap,Field,b),actual=clone(view.value);actual.trace.push(['act','wait',0]);Field.act(actual,'wait',0);
  const next=L.matchLegacyWait(preflight,actual);eq(L.matchLegacyWait(preflight,actual),next);
  eq(L.nextInfo(next).checkpointBytes,JSON.stringify(actual).length*2);
  eq(L.compareNextCheckpoint(next,actual,b),true);eq(L.compareNextCheckpoint(next,{...actual,seconds:actual.seconds+1},b),false);
  eq(L.compareNextCheckpoint(next,Object.fromEntries(Object.entries(actual).reverse()),b),false);
  throws(()=>L.copyNextRange(preflight,0,1,b));
  const nextBytes=frame(next,b,true);L.disposeLegacy(preflight);eq(b.snapshot().reservations['post-target'],32768);
  actual.turn++;const recoveredViewExpected=clone(view.value);view.release();
  const nextView=L.controllerCheckpoint(next,b);eq(nextView.value.turn,recoveredViewExpected.turn+1);
  eq(nextView.value.trace,[...recoveredViewExpected.trace,['act','wait',0]]);nextView.release();
  L.disposeLegacy(next);eq(b.snapshot().reservations['post-target'],0);L.disposeLegacy(cap);L.disposeLegacy(cap);clean(b);
  throws(()=>L.legacyInfo(cap));eq(saved.mkty_field_finale_9_v1,raw().mkty_field_finale_9_v1);

  // Cold source assembly is separately reserved; parse returns only a raw cap.
  {const q=createPhaseBudget(),x=raw(),seen=[];const c=L.captureLegacyBundle((key,accept)=>{
    eq(q.snapshot().reservations['context-retained'],65536);q.reserve('native-read',65536);
    let value;try{seen.push(key);value=x[key];accept(value);}finally{value=null;q.release('native-read',65536);}
  },guards(),Field,q);eq(seen,L.LEGACY_KEYS);eq(L.rawValue(c,'mkty_points'),x.mkty_points);L.disposeLegacy(c);clean(q);}
  {const q=createPhaseBudget();let reads=0;throws(()=>L.captureLegacyBundle((key,accept)=>{reads++;q.reserve('native-read',65536);
    let value;try{value='x'.repeat(65536);accept(value);}finally{value=null;q.release('native-read',65536);}},guards(),Field,q));eq(reads,1);clean(q);}
  {const q=createPhaseBudget();throws(()=>L.captureLegacyBundle(()=>{throw Error('native-unreadable');},guards(),Field,q),/native-unreadable/);clean(q);}
  {const q=createPhaseBudget();throws(()=>L.captureLegacyBundle((key,accept)=>accept(null),guards(),Field,q),/reader-lease/);clean(q);}
  {const q=createPhaseBudget(),x=raw();x.mkty_points='x'.repeat(30000);x.mkty_daily_demo='y'.repeat(30000);let rejectedUnderR=false;
    throws(()=>L.captureLegacyBundle((key,accept)=>{q.reserve('native-read',65536);let value;
      try{value=x[key];try{accept(value);}catch(e){rejectedUnderR=q.snapshot().reservations['native-read']===65536;throw e;}}
      finally{value=null;q.release('native-read',65536);}},guards(),Field,q),/bundle-limit/);eq(rejectedUnderR,true);clean(q);}
  const cold=createPhaseBudget();cold.reserve('atomic-retained',32768);cold.reserve('context-parse',sourceBytes.length);
  const decoded=L.decodeLegacyBundle(sourceBytes,guards(),Field,cold);for(const k of L.LEGACY_KEYS)eq(L.rawValue(decoded,k),saved[k]);
  throws(()=>L.controllerCheckpoint(decoded,cold));cold.release('context-parse',sourceBytes.length);
  cold.reserve('context-parse',nextBytes.length);const decodedNext=L.decodeLegacyWait(nextBytes,decoded,Field,cold);
  cold.release('context-parse',nextBytes.length);eq(frame(decodedNext,cold,true),nextBytes);
  L.disposeLegacy(decodedNext);L.disposeLegacy(decoded);cold.release('atomic-retained',32768);clean(cold);

  for(const key of L.LEGACY_KEYS.slice(5,11))for(const value of ['', '0','null','complete']){const x=raw();x[key]=value;refused(x);}
  for(const value of [null,'','09',' 9','8']){const x=raw();x.mkty_current_chapter=value;refused(x);}
  for(const key of L.LEGACY_KEYS){const x=raw();delete x[key];refused(x);}
  {const x=raw();x.extra=null;refused(x);}
  {const x=raw();Object.defineProperty(x,'mkty_points',{get(){throw Error('getter-called');},enumerable:true});refused(x);}
  for(const key of ['identity','initData','origin','principal']){const g=guards();g[key]='bad';refused(raw(),g);}
  for(const key of ['durable','exclusive','sourceClosed']){const g=guards();g[key]=false;refused(raw(),g);}
  for(const key of ['overlay','unattributedPendingPresent']){const g=guards();g[key]=true;refused(raw(),g);}
  for(const key of L.LEGACY_CLOUD_KEYS){const g=guards();g.cloudRaw[key]='';refused(raw(),g);}
  for(const val of ['', '0','null','123']){const g=guards();g.legacyOwnerRaw=val;refused(raw(),g);}
  for(const val of [0,-1,1.5,Number.MAX_SAFE_INTEGER+1]){const g=guards();g.epoch=val;refused(raw(),g);}
  {const g=guards();delete g.sourceClosed;refused(raw(),g);}

  for(const [key,val]of [['version',2],['edition',1],['n',8],['phase','complete'],['seed',-1],['done',[0,1,2,3,4,5,6,6]]]){
    const x=raw(),s=JSON.parse(x.mkty_story_plan_9_v1);s[key]=val;x.mkty_story_plan_9_v1=JSON.stringify(s);refused(x);}
  for(const value of ['{','null','[]','"unavailable"']){const x=raw();x.mkty_story_plan_9_v1=value;refused(x);}
  for(const [key,val]of [['version',2],['n',8],['seed',-1],['round',2],['phase','planning'],['phase','complete'],['confirmed',0],['actions',-1],['seconds',1e8+1]]){
    const x=raw(),s=JSON.parse(x.mkty_operations_9_v1);s[key]=val;x.mkty_operations_9_v1=JSON.stringify(s);refused(x);}
  {const x=raw();x.mkty_operations_9_v1=null;const q=createPhaseBudget(),c=L.admitLegacyBundle(x,guards(),Field,q);eq(L.rawValue(c,'mkty_operations_9_v1'),null);L.disposeLegacy(c);clean(q);}
  for(const [key,val]of [['version',1],['n',10],['stage',3],['seed',1],['complete',true],['failed',true],['home',3],['stability',5],['turn',1000],['moves',Number.MAX_SAFE_INTEGER],['errors',Number.MAX_SAFE_INTEGER+1]])refused(mutateCheckpoint(raw(),cp=>{cp[key]=val;}));
  for(const key of ['trace','mods','notice','selected','detections'])refused(mutateCheckpoint(raw(),cp=>{delete cp[key];}));
  for(const [key,val]of [['version',2],['n',8],['phase',1],['seconds',-1],['seed',-1]])refused(mutateCheckpoint(raw(),(cp,s)=>{s[key]=val;}));
  // Preserve field presence and -0 at all depths; original JSON restore loses -0.
  {const x=raw();x.mkty_field_finale_9_v1=x.mkty_field_finale_9_v1.replace('"selected":0','"selected":-0');refused(x);}
  {const x=mutateCheckpoint(raw(),cp=>{cp.unknown={n:0};});x.mkty_field_finale_9_v1=x.mkty_field_finale_9_v1.replace('"unknown":{"n":0}','"unknown":{"n":-0}');refused(x);}
  eq(L.sameLegacyValue({x:-0},{x:0}),false);eq(L.sameLegacyValue({x:1,y:2},{y:2,x:1}),true);eq(L.sameLegacyValue({x:undefined},{}),false);
  {const x=mutateCheckpoint(raw(),cp=>{cp.mods.extra=1;});refused(x);}
  {const x=mutateCheckpoint(raw(),cp=>{cp.trace.push({str:'\ud800',unknown:[1,2]});cp.failed=false;});const q=createPhaseBudget(),c=L.admitLegacyBundle(x,guards(),Field,q);eq(L.rawValue(c,'mkty_field_finale_9_v1'),x.mkty_field_finale_9_v1);L.disposeLegacy(c);clean(q);}
  {const x=mutateCheckpoint(raw(),cp=>{cp.moves=Number.MAX_SAFE_INTEGER-1;cp.errors=Number.MAX_SAFE_INTEGER;});const q=createPhaseBudget(),c=L.admitLegacyBundle(x,guards(),Field,q),p=L.prepareLegacyWait(c,Field,q);L.disposeLegacy(p);L.disposeLegacy(c);clean(q);}

  for(const mutate of [cp=>cp.seconds++,cp=>cp.trace[0][2]=1,cp=>cp.trace.push(['act','wait',0]),cp=>cp.home++,cp=>cp.errors++]){
    const q=createPhaseBudget(),c=L.admitLegacyBundle(raw(),guards(),Field,q),p=L.prepareLegacyWait(c,Field,q),v=L.controllerCheckpoint(c,q),a=clone(v.value);
    a.trace.push(['act','wait',0]);Field.act(a,'wait',0);mutate(a);throws(()=>L.matchLegacyWait(p,a));v.release();L.disposeLegacy(p);L.disposeLegacy(c);clean(q);}
  // A 12-row gate log shifts exactly as original rules; trace never shifts.
  {const x=mutateCheckpoint(raw(),cp=>{cp.log=Array.from({length:12},(_,i)=>({a:'wait',t:i,d:5}));});const q=createPhaseBudget(),c=L.admitLegacyBundle(x,guards(),Field,q),p=L.prepareLegacyWait(c,Field,q),v=L.controllerCheckpoint(c,q),a=clone(v.value);
    a.trace.push(['act','wait',0]);Field.act(a,'wait',0);const n=L.matchLegacyWait(p,a);eq(a.log.length,12);eq(a.trace.length,v.value.trace.length+1);L.disposeLegacy(p);v.release();L.disposeLegacy(n);L.disposeLegacy(c);clean(q);}

  // Raw UTF16 strings at the exact full-bundle limit, including lone surrogates.
  {const x=raw(),used=622+Object.values(x).reduce((n,v)=>n+(v===null?0:v.length*2),0);x.mkty_points+='\ud800'.repeat((65536-used)/2);
    const q=createPhaseBudget(),c=L.admitLegacyBundle(x,guards(),Field,q);eq(L.legacyInfo(c).byteLength,65536);const bytes=frame(c,q);L.disposeLegacy(c);clean(q);
    q.reserve('atomic-retained',32768);q.reserve('context-parse',65536);const d=L.decodeLegacyBundle(bytes,guards(),Field,q);
    eq(L.rawValue(d,'mkty_points'),x.mkty_points);eq(q.snapshot().peak+32768,1015808);q.release('context-parse',65536);L.disposeLegacy(d);q.release('atomic-retained',32768);clean(q);
    x.mkty_points+='x';refused(x);}
  {const x=raw();x.mkty_field_finale_9_v1=' '.repeat(16385);refused(x);}
  {const x=mutateCheckpoint(raw(),cp=>{cp.extra='x'.repeat(4096);});refused(x);}
  for(const target of [7678,7680,7682]){
    const x=mutateCheckpoint(raw(),cp=>{cp.extra='';cp.extra='x'.repeat((target-JSON.stringify(cp).length*2)/2);});
    if(target>7680)refused(x);else{const q=createPhaseBudget(),c=L.admitLegacyBundle(x,guards(),Field,q);
      eq(L.legacyInfo(c).checkpointBytes,target);const p=L.prepareLegacyWait(c,Field,q),v=L.controllerCheckpoint(c,q),a=clone(v.value);
      a.trace.push(['act','wait',0]);Field.act(a,'wait',0);const n=L.matchLegacyWait(p,a);ok(L.nextInfo(n).checkpointBytes<=8192);
      L.disposeLegacy(p);v.release();L.disposeLegacy(n);L.disposeLegacy(c);clean(q);}
  }
  for(const target of [16384,16386]){const x=raw(),s=JSON.parse(x.mkty_field_finale_9_v1);s.padding='';
    s.padding='x'.repeat((target-JSON.stringify(s).length*2)/2);x.mkty_field_finale_9_v1=JSON.stringify(s);
    if(target>16384)refused(x);else{const q=createPhaseBudget(),c=L.admitLegacyBundle(x,guards(),Field,q);eq(L.rawValue(c,'mkty_field_finale_9_v1').length*2,target);L.disposeLegacy(c);clean(q);}}
  {const x=raw();x.mkty_story_plan_9_v1='['.repeat(65)+'0'+']'.repeat(65);refused(x);}
  {const x=raw();x.mkty_story_plan_9_v1=JSON.stringify({a:Array(4097).fill(0)});refused(x);}
  // Literal lone surrogates expand during canonical measurement, before restore.
  {const x=mutateCheckpoint(raw(),cp=>{cp.extra='\ud800'.repeat(1000);});x.mkty_field_finale_9_v1=x.mkty_field_finale_9_v1.replaceAll('\\ud800','\ud800');refused(x);}

  for(const offset of [0,8,12,16,20,28,32,34,36,40,44]){const bytes=sourceBytes.slice();bytes[offset]^=128;const q=createPhaseBudget();
    q.reserve('context-parse',bytes.length);throws(()=>L.decodeLegacyBundle(bytes,guards(),Field,q));q.release('context-parse',bytes.length);clean(q);}
  {const q=createPhaseBudget();q.reserve('context-parse',sourceBytes.length);const g=guards();g.overlay=true;throws(()=>L.decodeLegacyBundle(sourceBytes,g,Field,q));q.release('context-parse',sourceBytes.length);clean(q);}

  // Every admission reservation failure, including a throwing post-mutation
  // observer, cleans only its own acquisitions and leaves the floor intact.
  for(const label of ['context-retained','callback-scratch','callback-outer-story','callback-inner-story','context-restore','post-target','post-work-1']){
    const base=createPhaseBudget(),q={...base,reserve(k,n){if(k===label)throw Error('injected');return base.reserve(k,n);}};
    throws(()=>L.admitLegacyBundle(raw(),guards(),Field,q),/injected/);clean(base);
    let once=false;const observed=createPhaseBudget({observe:e=>{if(!once&&e.type==='reserve'&&e.label===label){once=true;throw Error('observer-injected');}}});
    throws(()=>L.admitLegacyBundle(raw(),guards(),Field,observed),/observer-injected/);clean(observed);
    const base2=createPhaseBudget(),allocation={...base2,allocate(k,n){if(k===label)throw Error('allocate-injected');return base2.allocate(k,n);}};
    throws(()=>L.admitLegacyBundle(raw(),guards(),Field,allocation),/allocate-injected/);clean(base2);
  }
  for(const label of ['reload-story-work','reload-decode']){const base=createPhaseBudget(),q={...base,reserve(k,n){if(k===label)throw Error('decoder-injected');return base.reserve(k,n);}};
    q.reserve('context-parse',sourceBytes.length);throws(()=>L.decodeLegacyBundle(sourceBytes,guards(),Field,q),/decoder-injected/);q.release('context-parse',sourceBytes.length);clean(base);}
  {const q=createPhaseBudget();throws(()=>L.decodeLegacyBundle(sourceBytes,guards(),Field,q),/frame-lease/);clean(q);}
  for(const label of ['callback-scratch','callback-outer-story','callback-inner-story','context-restore','post-target','post-work-1']){
    let once=false;const q=createPhaseBudget({observe:e=>{if(!once&&e.type==='release'&&e.label===label){once=true;throw Error('release-injected');}}});
    throws(()=>L.admitLegacyBundle(raw(),guards(),Field,q),/release-injected/);clean(q);
  }
  for(const label of ['context-retained','post-target','reload-phase-retained']){
    let armed=false;const q=createPhaseBudget({observe:e=>{if(armed&&e.type==='release'&&e.label===label){armed=false;throw Error('dispose-injected');}}});
    const c=L.admitLegacyBundle(raw(),guards(),Field,q);let p,v;if(label==='post-target')p=L.prepareLegacyWait(c,Field,q);
    if(label==='reload-phase-retained')v=L.controllerCheckpoint(c,q);armed=true;
    throws(()=>label==='context-retained'?L.disposeLegacy(c):label==='post-target'?L.disposeLegacy(p):v.release(),/dispose-injected/);
    if(label==='context-retained')throws(()=>L.rawValue(c,'mkty_points'));if(v)throws(()=>v.value);
    if(p)L.disposeLegacy(p);if(v)v.release();L.disposeLegacy(c);clean(q);
  }
  for(const operation of ['getter','prepare','match','decode']){
    let armed=false,count=0;const q=createPhaseBudget({observe:e=>{if(armed&&e.type==='release'&&e.label===(operation==='decode'?'post-work-1':'phase-workspace')&&++count===(operation==='decode'?2:1)){armed=false;throw Error('workspace-release');}}});
    const c=L.admitLegacyBundle(raw(),guards(),Field,q);let p,a;
    if(operation==='match'){p=L.prepareLegacyWait(c,Field,q);const v=L.controllerCheckpoint(c,q);a=clone(v.value);v.release();a.trace.push(['act','wait',0]);Field.act(a,'wait',0);}
    if(operation==='decode')q.reserve('context-parse',nextBytes.length);
    armed=true;throws(()=>operation==='getter'?L.controllerCheckpoint(c,q):operation==='prepare'?L.prepareLegacyWait(c,Field,q):operation==='match'?L.matchLegacyWait(p,a):L.decodeLegacyWait(nextBytes,c,Field,q),/workspace-release/);
    if(operation==='decode')q.release('context-parse',nextBytes.length);if(p)L.disposeLegacy(p);L.disposeLegacy(c);clean(q);
  }
  for(const value of [undefined,null,0,false])for(const type of ['reserve','release']){
    let once=false;const q=createPhaseBudget({observe:e=>{if(!once&&e.type===type&&e.label==='callback-scratch'){once=true;throw value;}}});
    let caught=false;try{L.admitLegacyBundle(raw(),guards(),Field,q);}catch(e){caught=true;eq(e,value);}eq(caught,true);clean(q);
  }
  {let releases=0;const q=createPhaseBudget({observe:e=>{if(e.type==='release'){releases++;throw Error('every-release');}}});
    throws(()=>L.admitLegacyBundle(raw(),guards(),Field,q),/every-release/);eq(releases,7);clean(q);}
  {const q=createPhaseBudget(),c=L.admitLegacyBundle(raw(),guards(),Field,q),held=q.snapshot().live;let blocked=false;
    const original=q.reserve; // Frozen budget remains untouched; wrapper differs and is refused.
    throws(()=>L.controllerCheckpoint(c,{...q,reserve:original}));eq(q.snapshot().live,held);L.disposeLegacy(c);clean(q);}
  console.log(`PASS legacy adoption codec: ${checks} checks; exact12 lossless UTF16, strict admission, actual WAIT capability, cleanup, cold peak1,015,808.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
