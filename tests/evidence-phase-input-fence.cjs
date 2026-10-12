'use strict';
// SOURCE-VM event-routing evidence, NOT native browser/touch/default-action proof.
// Execute the unchanged real controller/model using an existing small DOM adapter.
const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {fixture}=require('./triangulation-controller-helper.cjs');
let checks=0;
const equal=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
function route(h){
  const d=h.document,w=h.context,Events=Object.getPrototypeOf(d);
  d.defaultView=w;
  Events.addEventListener=function(type,fn,options={}){
    const rows=this.listeners.get(type)||[];rows.push({fn,capture:options===true||!!options.capture,passive:!!options.passive});this.listeners.set(type,rows);
  };
  Events.dispatchEvent=function(e){
    const path=[];for(let n=this;n;n=n===w?null:n===d?w:n.parentElement||d)path.push(n);
    e.target=this;e.bubbles??=true;e.cancelable??=true;e.defaultPrevented=false;e.stopped=false;e.immediate=false;
    e.preventDefault=()=>{if(e.cancelable)e.defaultPrevented=true;};e.stopPropagation=()=>{e.stopped=true;};
    e.stopImmediatePropagation=()=>{e.immediate=true;e.stopped=true;};e.composedPath=()=>path.slice();
    const invoke=(n,capture)=>{for(const row of n.listeners.get(e.type)||[]){
      const r=typeof row==='function'?{fn:row,capture:false}:row;
      if(r.capture===capture)r.fn.call(n,e);if(e.immediate)break;
    }if(!capture&&!e.immediate)n['on'+e.type]?.(e);};
    for(const n of path.slice().reverse()){invoke(n,true);if(e.stopped)return !e.defaultPrevented;}
    for(const n of path){invoke(n,false);if(e.stopped||!e.bubbles)break;}
    return !e.defaultPrevented;
  };
  return (target,type,init={})=>{const event={type,...init};target.dispatchEvent(event);return event;};
}
(async()=>{
  const {installPhaseInputFence}=await import(pathToFileURL(path.join(__dirname,'fixtures/evidence-phase-session/input-fence.mjs')).href);
  const h=fixture(),fire=route(h),d=h.document,field=h.$('fieldMission'),dialog=h.$('fieldDialog');
  let view={playEnabled:false},throws=false;
  const fence=installPhaseInputFence({document:d,readView:()=>{if(throws)throw Error('stale owner');return view;}});
  equal(Object.keys(fence),['diagnostics'],'no uninstall or override');
  assert.throws(()=>installPhaseInputFence({document:d,readView:()=>({playEnabled:true})}),/already installed/);checks++;
  const initial=h.snapshot(),saves=h.saves.length;
  for(const bad of [false,0,1,'true',undefined]){
    view={playEnabled:bad};equal(fire(h.$('fieldResume'),'click').defaultPrevented,true,'strict readiness');
    fire(h.$('fieldSubmit'),'click');equal(h.snapshot(),initial,'original resume/submit suppressed');equal(dialog.open,true);
  }
  equal(h.saves.length,saves,'blocked handlers cannot save');
  for(const type of ['pointerdown','pointermove','pointerup','pointercancel','lostpointercapture','touchstart','touchmove','touchend','touchcancel','mousedown','mouseup','click','keydown','keyup','keypress','beforeinput','input','change']){
    equal(fire(h.$('fieldResume'),type,{key:'Enter'}).defaultPrevented,true,type+' fenced');
  }
  let reached=0;dialog.addEventListener('cancel',()=>reached++);
  fire(dialog,'cancel',{bubbles:false});fire(h.$('fieldResume'),'keydown',{key:'Escape',code:'Escape'});
  equal(reached,0,'nonbubbling dialog cancel captured before original resume');equal(dialog.open,true);
  // External fixture controls remain reachable even if field still has active class.
  for(const id of ['phaseRetry','phaseContinue','paceGo','paceCancel','legacyDone']){
    const b=d.createElement('button');b.id=id;d.body.append(b);b.onclick=()=>reached++;
    equal(fire(b,'click').defaultPrevented,false,id+' click allowed');
    equal(fire(b,'keydown',{key:'Enter',code:'Enter'}).defaultPrevented,false,id+' activation key allowed');
  }
  equal(reached,5);
  view={playEnabled:true};fire(h.$('fieldResume'),'click');equal(dialog.open,false,'original resume runs when ready');
  fire(h.$('fieldSubmit'),'click');equal(h.snapshot().trace.at(-1)[1],'locate','original submit executes model action');
  view={playEnabled:false};const afterSubmit=h.snapshot();fire(h.$('fieldSubmit'),'click');equal(h.snapshot(),afterSubmit,'already resumed controller still fenced');
  const range=h.range('angle');range.focus();const beforeRange=h.snapshot();range.value=17;
  equal(fire(range,'input',{cancelable:false}).defaultPrevented,false,'cannot cancel already-applied native value');
  equal(range.value,'17','fence does not roll back a control value');equal(h.snapshot(),beforeRange,'noncancelable input handler still suppressed');
  equal(d.activeElement,range,'focused range retained');
  equal(fire(range,'touchmove',{cancelable:false}).defaultPrevented,false,'partial touch cannot cancel browser default');
  equal(fire(range,'keydown',{key:'ArrowRight',code:'ArrowRight'}).defaultPrevented,true,'focused range keys fenced');
  view={playEnabled:true};fire(range,'input');equal(h.snapshot().angles[0],17,'original range input resumes');equal(d.activeElement,range);
  h.pause();view={playEnabled:false};throws=true;fire(h.$('fieldResume'),'click');equal(dialog.open,true,'throwing stale view fails closed');
  equal(fence.diagnostics().readFailures,1);throws=false;view=null;fire(dialog,'cancel');equal(dialog.open,true,'missing view fails closed');
  view={playEnabled:true};fire(dialog,'cancel');equal(dialog.open,false,'original cancel/resume restored when ready');
  // Actual global docking controller keyboard callbacks, observed via real tick traces.
  let frame;h.context.requestAnimationFrame=fn=>(frame=fn,1);h.context.cancelAnimationFrame=()=>{frame=null;};
  h.context.MKTYField.open({chapter:6,id:0,fieldStage:3,seed:21,title:['Test','Test'],save(){},exit(){},complete(){}},null);
  fire(h.$('fieldResume'),'click');view={playEnabled:false};
  for(const target of [d,h.context,d.body])equal(fire(target,'keydown',{key:'ArrowRight',code:'ArrowRight'}).defaultPrevented,true,'global arrow blocked');
  for(const type of ['keydown','keyup','keypress'])for(const code of ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD','Space'])
    equal(fire(d.body,type,{code}).defaultPrevented,true,'global '+type+'/'+code+' blocked');
  for(const t of [100,120,140])frame(t);
  equal(h.snapshot().trace.every(row=>row[0]!=='tick'||row[2]===0),true,'blocked arrow never reaches real held-key state');
  view={playEnabled:true};fire(d.body,'keydown',{key:'ArrowRight',code:'ArrowRight'});frame(160);
  equal(h.snapshot().trace.at(-1)[2],1,'ready arrow reaches actual global handler');
  fire(d.body,'keyup',{key:'ArrowRight',code:'ArrowRight'});frame(180);equal(h.snapshot().trace.at(-1)[2],0,'ready release reaches global handler');
  view={playEnabled:false};field.classList.remove('active');equal(fire(d.body,'keydown',{code:'ArrowRight'}).defaultPrevented,false,'inactive field does not own document keys');
  const diag=fence.diagnostics();equal(diag.nonCancelable,2);equal(Object.isFrozen(diag),true);assert(JSON.stringify(diag).length<160);checks++;
  equal([...d.listeners.values()].flat().filter(x=>x.capture).every(x=>x.passive===false),true,'capture listeners are nonpassive');
  console.log(JSON.stringify({checks,diagnostics:diag,evidence:'unchanged source VM, modeled event routing',nativeDefaults:'not tested; values/touch defaults cannot be rolled back'}));
})().catch(error=>{console.error(error);process.exitCode=1;});
