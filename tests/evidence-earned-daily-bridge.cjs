'use strict';
// Portable protocol/source test: VM DOM and input/owner/frame doubles only.
// isTrusted fields below are protocol data, NOT evidence of native user input.
// No browser, listener, IndexedDB or durability claim is made by this test.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createHash}=require('node:crypto'),{pathToFileURL}=require('node:url');
const root=path.join(__dirname,'..'),fixture=path.join(__dirname,'fixtures/evidence-earned-daily');
const source=fs.readFileSync(path.join(root,'daily-retention.js'),'utf8'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const originalMarkup=html.slice(html.indexOf('      <section id="dailyOps"'),html.indexOf('      <section id="communityHub"'));
const helper=fs.readFileSync(path.join(__dirname,'language-hot-switch-helper.cjs'),'utf8');
const domSource=helper.slice(helper.indexOf(' const descendant='),helper.indexOf(' const app='));
const DAY='2026-10-13',NEXT='2026-10-14',SESSION='d'.repeat(32),HASH='37057554f05ddbd593734bd9390e056970b5267918b63491d292b5d227eebddb';
const initial=extra=>JSON.stringify({cday:DAY,streak:0,opaque:{keep:['x',7]},...extra});
const copy=value=>JSON.parse(JSON.stringify(value)),tick=()=>new Promise(resolve=>setTimeout(resolve,0));
let checks=0;const groups=[],peaks=[];
const eq=(a,b,message)=>{assert.deepStrictEqual(a,b,message);checks++;},ok=(value,message)=>{assert(value,message);checks++;};
const throws=(fn,re)=>{assert.throws(fn,re);checks++;};
async function eventually(predicate){for(let n=0;n<100;n++){if(predicate())return;await tick();}throw Error('portable fixture did not settle');}
(async()=>{
  const M=await import(pathToFileURL(path.join(fixture,'daily.mjs')).href);
  const B=await import(pathToFileURL(path.join(fixture,'daily-bridge.mjs')).href);
  const P=await import(pathToFileURL(path.join(root,'prototypes/evidence-indexeddb/shared-streak.mjs')).href);
  const group=async(name,fn)=>{await fn();groups.push(name);};
  function realm({deferSource=false}={}){
    const registrations=new WeakMap(),intervals=[],timeouts=[];
    let realmWindow=null;
    class Target{
      addEventListener(type,fn,options){const target=this===realmWindow?ctx:this;let list=registrations.get(target);if(!list)registrations.set(target,list=[]);list.push({type,fn,capture:options===true||!!options?.capture,once:!!options?.once});}
      removeEventListener(type,fn){const target=this===realmWindow?ctx:this,list=registrations.get(target)||[];registrations.set(target,list.filter(r=>r.type!==type||r.fn!==fn));}
      dispatchEvent(ev){return deliver(this,ev);}
    }
    const ctx={console,Date,EventTarget:Target,fixtureMarkup:originalMarkup,URL,location:{href:B.DAILY_FRAME_URL},
      setInterval:(fn,ms)=>(intervals.push({fn,ms}),intervals.length),setTimeout:(fn,ms)=>(timeouts.push({fn,ms}),setTimeout(fn,ms)),
      clearTimeout,clearInterval(){}};
    Object.setPrototypeOf(ctx,Target.prototype);ctx.window=ctx;
    vm.createContext(ctx,{codeGeneration:{strings:false,wasm:false}});
    realmWindow=vm.runInContext('window',ctx);
    vm.runInContext('const observers=[],writes=[];\n'+domSource+'\ndocument.body.innerHTML=fixtureMarkup;globalThis.document=document;globalThis.TestElement=Element;',ctx);
    // Derive the same small test DOM, routing events through an explicit test
    // EventTarget. Original daily-retention.js bytes are evaluated unchanged.
    Object.setPrototypeOf(ctx.TestElement.prototype,Target.prototype);
    delete ctx.TestElement.prototype.addEventListener;delete ctx.TestElement.prototype.dispatchEvent;
    Object.setPrototypeOf(ctx.document,Target.prototype);ctx.document.addEventListener=Target.prototype.addEventListener;
    function deliver(target,ev){
      ev.target??=target;ev.isTrusted??=false;ev.preventDefault??=()=>{ev.defaultPrevented=true;};
      ev.stopImmediatePropagation??=()=>{ev.stopped=true;};
      let chain=[target];for(let n=target.parentElement;n;n=n.parentElement)chain.push(n);
      if(target!==ctx){if(!chain.includes(ctx.document))chain.push(ctx.document);chain.push(ctx);}
      const call=(at,capture)=>{for(const r of [...(registrations.get(at)||[])]){
        if(ev.stopped)break;if(r.type!==ev.type||r.capture!==capture)continue;
        if(r.once)Target.prototype.removeEventListener.call(at,r.type,r.fn);r.fn.call(at,ev);
      }};
      for(const at of [...chain].reverse())call(at,true);
      for(const at of ev.bubbles===false?[target]:chain)call(at,false);
      return !ev.defaultPrevented;
    }
    const append=ctx.document.head.appendChild.bind(ctx.document.head);
    let pendingSource=null;
    const evaluate=script=>{ctx.document.currentScript=script;try{vm.runInContext(source,ctx,{filename:'daily-retention.js'});}catch(error){deliver(ctx,{type:'error',error});}finally{ctx.document.currentScript=null;}
      setTimeout(()=>deliver(script,{type:'load',bubbles:false}),0);};
    ctx.document.head.appendChild=script=>{append(script);if(deferSource)pendingSource=script;else evaluate(script);return script;};
    const child=M.createDailyChild(realmWindow);Object.defineProperty(ctx,'earnedDailyChild',{value:child});
    return {ctx,child,intervals,timeouts,get:id=>ctx.document.getElementById(id),
      input:(id='streakBtn',trusted=true,type='click')=>deliver(ctx.document.getElementById(id),{type,isTrusted:trusted}),
      error:message=>deliver(ctx,{type:'error',message}),deliver,hasPendingSource:()=>!!pendingSource,
      flushSource:()=>{const script=pendingSource;pendingSource=null;evaluate(script);}};
  }
  async function harness(options={}){
    const R=realm(options),events=[],changes=[],calls={checkin:0,retry:0,runOwner:0};let clock=DAY;
    let revision=0,token='head-0',state=options.locked?'READY':'ACTIVE',reason=null,receipt=null;
    let values={mkty_daily_demo:options.dailyText||initial(),mkty_points:options.locked?'5100':'2100',...(options.locked?{mkty_life9:'complete'}:{})};
    const ticket=Object.freeze({version:1,id:'streak:'+DAY,principal:'guest:portable',scope:'portable-earned',session:SESSION,day:DAY,revision:0,head:{head:{ordinal:0,token:'head-0'},descriptor:{run:'portable'}}});
    const owner={
      view:()=>({state,reason,busy:false,revision,head:{head:{token,ordinal:revision}},values,lastReceipt:receipt}),
      checkin:async t=>{calls.checkin++;eq(copy(t),copy(ticket));return perform();},
      retry:async()=>{calls.retry++;return perform();}
    };
    let abort=!!options.abort,hold=options.hold||null;
    async function perform(){
      if(hold){const h=hold;hold=null;await h;}
      if(abort){abort=false;state='UNSAVED';reason='transaction-aborted';return owner.view();}
      if(clock!==DAY){state='BLOCKED';reason='shared-day-rollover';return owner.view();}
      const out=P.projectSharedStreak({dailyText:values.mkty_daily_demo,points:Number(values.mkty_points),locked:values.mkty_life9==='complete',day:DAY});
      values={...values,mkty_daily_demo:out.dailyText,mkty_points:String(out.points)};token='head-'+(++revision);
      receipt={id:ticket.id,revision,delta:out.delta,legacyResult:out.legacyResult};state=values.mkty_life9==='complete'?'READY':'ACTIVE';reason=null;return owner.view();
    }
    const listeners=new Map();
    const frame={tagName:'IFRAME',isConnected:true,hidden:true,contentWindow:R.ctx,contentDocument:R.ctx.document,
      addEventListener(type,fn){listeners.set(type,[...(listeners.get(type)||[]),fn]);},removeEventListener(type,fn){listeners.set(type,(listeners.get(type)||[]).filter(f=>f!==fn));},
      set src(value){R.ctx.location.href=value;setTimeout(()=>{for(const fn of [...(listeners.get('load')||[])])fn();},0);}
    };
    const bridge=B.createDailyBridge({frame,day:DAY,session:SESSION,owner,readCanonical:owner.view,admissionDay:()=>clock,
      captureAllowed:()=>options.allowed!==false,runOwner:async(label,fn)=>{
        calls.runOwner++;eq(R.child.facts().privateEntries,0);ok(R.child.facts().quiesced);events.push({type:'owner-lane',label});return fn();
      },onChange:f=>changes.push({state:f.state,bytes:f.bridgeBytes}),onEvent:event=>{
        events.push(event);if(event.type==='capture'&&options.rolloverAfter)clock=NEXT;
        if(event.type==='capture'&&options.changeHead)token='unexpected';options.onEvent?.(event);
      }});
    const mounted=bridge.mount({ticket:options.locked?null:options.ticket||ticket,values});
    if(options.deferSource)await eventually(R.hasPendingSource);else await mounted;
    return {...R,bridge,frame,events,changes,calls,owner,ticket,mounted,
      setClock:value=>{clock=value;},terminal:()=>{values={...values,mkty_points:'5100',mkty_life9:'complete'};state='READY';token='head-'+(++revision);},
      replace:()=>{frame.contentDocument={};for(const fn of [...(listeners.get('load')||[])])fn();},
      async finish(){await eventually(()=>!['DRAINING','SAVING'].includes(bridge.facts().state));peaks.push(bridge.facts().bridgePeakBytes);return bridge.facts();},
      close:()=>bridge.dispose()};
  }
  await group('01 original source and exact original dailyOps markup pins',()=>{
    eq(createHash('sha256').update(source).digest('hex'),HASH);eq(M.DAILY_SOURCE_HASH,HASH);eq(B.DAILY_SOURCE_HASH,HASH);
    eq(createHash('sha256').update(originalMarkup).digest('hex'),'dc792083f16233e50b1c077eeed03ac29a39bc63a23f5cf21248d3495a0d982a');
    eq(M.DAILY_SOURCE_INTEGRITY,'sha256-'+Buffer.from(HASH,'hex').toString('base64'));
    const childHTML=fs.readFileSync(path.join(fixture,'daily.html'),'utf8');ok(childHTML.includes(originalMarkup));
    eq((childHTML.match(/<script/g)||[]).length,1);ok(childHTML.includes('connect-src \'none\''));
    const bridgeSource=fs.readFileSync(path.join(fixture,'daily-bridge.mjs'),'utf8');
    ok(!/\.click\s*\(|dispatchEvent\s*\(|\beval\s*\(/.test(bridgeSource));eq(M.BRIDGE_LIMIT,24576);
  });
  await group('02 full unchanged IIFE through capture, real next-task fence, and owner readback',async()=>{
    const h=await harness();eq(h.bridge.facts().state,'PREPARED');eq(h.get('streakBtn').disabled,false);
    h.bridge.expose(true);h.input();eq(h.bridge.facts().state,'DRAINING');eq(h.calls.checkin,0,'no owner invocation during event dispatch');
    const f=await h.finish();eq(f.state,'SAVED');eq(f.originalClicks,1);eq(f.expected.delta,3);eq(f.expected.pointsText,'2103');
    eq(f.expected.nominalFlash,'Check-in +3 ⭐');eq(f.expected.taskFence,'next-task');eq(f.expected.writes.map(w=>w.key),['mkty_daily_demo','mkty_points']);
    eq(f.expected.dailyText,h.owner.view().values.mkty_daily_demo);eq(copy(f.receipt.legacyResult),{awarded:true,points:3,shield_used:false});
    eq(f.lastInput,{isTrusted:true,target:'streakBtn',prevented:false});ok(f.quiesced);eq(f.privateEntries,0);
    const order=h.events.map(e=>e.type);ok(order.indexOf('capture')<order.indexOf('drain'));ok(order.indexOf('quiesce')<order.indexOf('dispatch'));ok(order.indexOf('dispatch')<order.indexOf('readback'));
    ok(Object.isFrozen(f.expected)&&Object.isFrozen(f.expected.writes));ok(f.bridgePeakBytes<=24576);h.close();
  });
  await group('03 stale enabled original button after pause sees locked refreshed canonical reads',async()=>{
    const h=await harness();h.bridge.pause();eq(h.bridge.facts().privateEntries,0);eq(h.get('streakBtn').disabled,false);
    h.terminal();h.intervals[0].fn();ok(h.bridge.facts().timerSuppressed>0);h.bridge.expose(true);eq(h.get('streakBtn').disabled,false);
    h.input();const f=await h.finish();eq(f.state,'SAVED');eq(f.expected.delta,0);eq(f.expected.pointsText,'5100');
    eq(f.expected.nominalFlash,'Check-in +3 ⭐');eq(f.expected.writes.map(w=>w.key),['mkty_daily_demo']);eq(f.receipt.legacyResult.points,3);
    eq(f.buttonText,'BALANCE LOCKED');eq(f.originalClicks,1);h.close();
  });
  await group('04 fresh locked mount has no ticket and source naturally disables claim',async()=>{
    const h=await harness({locked:true});eq(h.bridge.facts().state,'PREPARED');eq(h.get('streakBtn').disabled,true);
    h.bridge.expose(true);h.input();await tick();eq(h.calls.checkin,0);eq(h.bridge.facts().originalClicks,0);h.close();
  });
  await group('05 untrusted and non-checkin controls never enter original source handler',async()=>{
    const h=await harness();h.bridge.expose(true);h.input('streakBtn',false);h.input('cipherSubmit');h.input('cipherText',true,'input');h.input('ytBtn');
    await tick();eq(h.bridge.facts().state,'PREPARED');eq(h.bridge.facts().originalClicks,0);eq(h.calls.checkin,0);eq(h.get('dopsFlash').textContent,'');
    const no=harness({allowed:false});h.close();const blocked=await no;blocked.bridge.expose(true);blocked.input();eq(blocked.bridge.facts().state,'BLOCKED');eq(blocked.calls.checkin,0);blocked.close();
  });
  await group('06 abort preserves exact expected result; retry never repeats original handler',async()=>{
    const h=await harness({abort:true});h.bridge.expose(true);h.input();const failed=await h.finish();eq(failed.state,'UNSAVED');
    const before=JSON.stringify(failed.expected);eq(failed.privateEntries,0);ok(h.frame.hidden);h.intervals[0].fn();
    throws(()=>h.ctx.MKTYDaily.reload(),/callback-quiesced/);throws(()=>h.ctx.MKTYDaily._demoStatus(),/callback-quiesced/);
    h.deliver(h.ctx,{type:'mkty:language'});h.input();eq(h.bridge.facts().originalClicks,1);
    await h.bridge.retry();const f=h.bridge.facts();eq(f.state,'SAVED');eq(JSON.stringify(f.expected),before);eq(f.originalClicks,1);eq(f.retries,1);
    eq(h.calls.checkin,1);eq(h.calls.retry,1);ok(f.timerSuppressed>0);h.close();
  });
  await group('07 pending owner has no child map/callback entry across interval delivery',async()=>{
    let release;const hold=new Promise(resolve=>{release=resolve;});const h=await harness({hold});h.bridge.expose(true);h.input();
    await eventually(()=>h.bridge.facts().state==='SAVING');eq(h.bridge.facts().privateEntries,0);h.intervals[0].fn();
    eq(h.bridge.facts().timerSuppressed,1);eq(h.get('dopsFlash').textContent,'Check-in +3 ⭐');ok(h.frame.hidden);
    release();eq((await h.finish()).state,'SAVED');h.close();
  });
  await group('08 real admission-day refusal before and after source capture',async()=>{
    const before=await harness();before.bridge.expose(true);before.setClock(NEXT);before.input();eq(before.bridge.facts().state,'BLOCKED');
    eq(before.bridge.facts().originalClicks,0);eq(before.calls.checkin,0);before.close();
    const after=await harness({rolloverAfter:true});after.bridge.expose(true);after.input();const f=await after.finish();
    eq(f.state,'BLOCKED');eq(f.originalClicks,1);eq(f.expected.pointsText,'2103');ok(f.reason.includes('shared-day-rollover'));eq(f.receipt,null);after.close();
  });
  await group('09 unexpected head, replacement, error and disposal quarantine',async()=>{
    const changed=await harness({changeHead:true});changed.bridge.expose(true);changed.input();eq((await changed.finish()).state,'BLOCKED');
    eq(changed.calls.checkin,0);ok(changed.bridge.facts().expected);changed.close();
    const error=await harness();error.error('deliberate fixture fault');eq(error.bridge.facts().state,'BLOCKED');eq(error.calls.checkin,0);error.close();
    const replaced=await harness();replaced.replace();eq(replaced.bridge.facts().state,'BLOCKED');eq(replaced.calls.checkin,0);replaced.close();
    const gone=await harness();gone.bridge.expose(true);gone.input();gone.close();await tick();await tick();eq(gone.calls.checkin,0);eq(gone.bridge.facts().state,'DISPOSED');eq(gone.bridge.facts().privateEntries,0);
    let release;const pending=await harness({hold:new Promise(resolve=>{release=resolve;})});pending.bridge.expose(true);pending.input();
    await eventually(()=>pending.bridge.facts().state==='SAVING');pending.error('fault while owner pending');release();await tick();await tick();
    eq(pending.bridge.facts().state,'BLOCKED');ok(pending.frame.hidden);ok(!pending.events.some(e=>e.type==='saved'));pending.close();
    let releaseRemoved;const removed=await harness({hold:new Promise(resolve=>{releaseRemoved=resolve;})});removed.bridge.expose(true);removed.input();
    await eventually(()=>removed.bridge.facts().state==='SAVING');removed.frame.isConnected=false;releaseRemoved();await tick();await tick();
    eq(removed.bridge.facts().state,'BLOCKED');ok(removed.frame.hidden);removed.close();
    const late=await harness({deferSource:true});late.close();await late.mounted;late.flushSource();await tick();
    eq(late.bridge.facts().state,'DISPOSED');eq(late.intervals.length,0);eq(late.calls.checkin,0);eq(late.bridge.facts().privateEntries,0);
  });
  await group('10 bounded representations, invalid input refusal and no parent-global swaps',async()=>{
    throws(()=>M.measureBridge({x:'x'.repeat(13000)}),/limit/);throws(()=>M.fixedDailyDate(Date,'2026-02-30'),/day/);
    throws(()=>M.narrowDailyValues({mkty_daily_demo:initial({huge:'x'.repeat(2100)}),mkty_points:'2100'},DAY),/daily-limit/);
    throws(()=>M.narrowDailyValues({mkty_daily_demo:initial(),mkty_points:'NaN'},DAY),/points/);
    const descriptors=['Date','localStorage','setTimeout','setInterval'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]);
    const h=await harness();eq(h.ctx.Date.now(),Date.parse(DAY+'T00:00:00Z'));ok(!Object.getOwnPropertyDescriptor(h.ctx,'Date').configurable);
    ok(!Object.getOwnPropertyDescriptor(h.ctx,'localStorage').writable);throws(()=>h.ctx.localStorage.clear(),/clear-forbidden/);eq(h.bridge.facts().state,'BLOCKED');h.close();
    for(const [key,descriptor]of descriptors)eq(Object.getOwnPropertyDescriptor(globalThis,key),descriptor);
    const huge=await harness({dailyText:initial({huge:'x'.repeat(2100)})});eq(huge.bridge.facts().state,'BLOCKED');eq(huge.calls.checkin,0);huge.close();
    const bare=JSON.stringify({cday:DAY,streak:0,padding:''});
    const rawExact=JSON.stringify({cday:DAY,streak:0,padding:'x'.repeat(2048-bare.length)});eq(rawExact.length*2,4096);
    const normalized=await harness({dailyText:rawExact});eq(normalized.bridge.facts().state,'BLOCKED');ok(normalized.bridge.facts().reason.includes('limit'));normalized.close();
    const large=await harness({ticket:{day:DAY,session:SESSION,revision:0,padding:'x'.repeat(5000)}});eq(large.bridge.facts().state,'BLOCKED');eq(large.calls.checkin,0);large.close();
    const reserve=await harness({dailyText:initial({padding:'x'.repeat(1850)}),ticket:{day:DAY,session:SESSION,revision:0,padding:'x'.repeat(3750)}});
    eq(reserve.bridge.facts().state,'PREPARED');reserve.bridge.expose(true);reserve.input();const refused=await reserve.finish();
    eq(refused.state,'BLOCKED');ok(refused.reason.includes('limit'));eq(refused.privateEntries,0);eq(reserve.calls.checkin,0);reserve.close();
  });
  eq(createHash('sha256').update(fs.readFileSync(path.join(root,'daily-retention.js'))).digest('hex'),HASH);
  console.log(JSON.stringify({test:'evidence-earned-daily-bridge',status:'passed',checks,groups,bridgePeak:Math.max(...peaks),
    qualification:'portable unchanged-source VM, frame/input/owner protocol doubles; no native browser, input, transaction or durability evidence'},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
