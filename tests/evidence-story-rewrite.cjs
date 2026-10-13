'use strict';
// Socket-free original-source oracle; diagnostic histories exist only in tests.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const Story=require('../story-plan.js'),F=require('./evidence-finale-controller-fixture.cjs');
const root=path.resolve(__dirname,'..'),source=f=>fs.readFileSync(path.join(root,f),'utf8');
const SESSION='0123456789abcdef0123456789abcdef',LIMIT=65536;
let checks=0;const groups=[],measurements=[];
const eq=(a,b)=>{assert.deepStrictEqual(a,b);checks++;},ok=x=>{assert(x);checks++;};
const throws=(fn,re=/story-rewrite-|finale-context-|budget-|allocation-unreserved/)=>{assert.throws(fn,re);checks++;};
function oracle(text,n=8,sourceSeconds=17.25,entry=false){
  const p=F.phases.find(p=>p.chapter===n&&p.index===(n===8?1:2)),key=F.storyKey(n),disk=new Map([[key,text],
    [F.sourceKey(n),JSON.stringify({version:1,n,phase:p.index,seed:(p.seed-p.index*7919)>>>0,seconds:sourceSeconds})]]),writes=[];
  let clock=1791828000000,task;
  const localStorage={getItem:k=>disk.get(k)??null,setItem(k,v){disk.set(k,String(v));if(k===key)writes.push(String(v));},removeItem:k=>disk.delete(k)};
  class Clock extends Date{static now(){return clock++;}}
  const c={console,localStorage,Date:Clock,Uint32Array,show(){},openMission8(){},openMission9(){},
    MKTYField:{open(t){task=t;}},MKTYLegacy:{epilogue(){}},crypto:{getRandomValues:a=>a},
    awardLifePoints(n){c.MKTYStory.complete(n);}};c.window=c;c.globalThis=c;vm.createContext(c);
  for(const file of ['story-plan.js','field-model.js'])vm.runInContext(source(file),c,{filename:file});
  const originalFunctions=source('story.js').split('\n').filter(s=>/^ function (read|write|openCore|complete)\(/.test(s)).join('\n');
  vm.runInContext(`MKTYStory=(()=>{const P=StoryPlan,key=n=>'mkty_story_plan_'+n+'_v1',ready=()=>true,
    done=()=>false,menu=()=>{throw Error('unexpected menu');},original={8(){},9(){}};let storageOK=true;
    ${originalFunctions}\nreturn {read,write,openCore,complete};})();`,c,{filename:'unchanged-story-functions'});
  vm.runInContext(source('chapter-space.js'),c,{filename:'chapter-space.js'});
  if(!entry)c.MKTYSpatialFinale.open(n);
  const before=Clock.now();if(entry)c.MKTYStory.openCore(n,true);else task.complete(p.state);const after=Clock.now();
  assert.equal(writes.length,entry?1:2);
  return {writes,before,after,addedSeconds:sourceSeconds+p.state.seconds};
}
(async()=>{
  const X=await import('../prototypes/evidence-indexeddb/finale-context-v1.mjs');
  const R=await import('../prototypes/evidence-indexeddb/story-rewrite.mjs'),B=await import('../prototypes/evidence-indexeddb/phase-budget.mjs');
  const group=async(name,fn)=>{await fn();groups.push(name);};
  function setup(text,n=8,{admit=true,hook}={}){
    const events=[],account=B.createPhaseBudget({observe(e){events.push(e);hook?.(e);}});
    account.reserve('raw-capsule',LIMIT);account.reserve('context-retained',LIMIT);
    const capsule=admit?X.admitContext({scope:'fixture:story-rewrite',session:SESSION,storyText:text,binding:{version:1,session:SESSION,
      chapter:n,edition:2,baseSeed:0,storyKey:F.storyKey(n),sourceKey:F.sourceKey(n),route:'spatial-finale'}},account):null;
    for(const label of ['post-target','callback-outer-story','callback-inner-story','callback-scratch'])account.reserve(label,LIMIT);
    return {account,capsule,events,run:options=>capsule?X.validateContextRewrite(capsule,options,account):R.validateStoryRewrite(text,n,options,account)};
  }
  function opts(h,index=0){return {kind:index?'complete':'accumulated',observedText:h.writes[index],before:h.before,after:h.after,
    addedSeconds:h.addedSeconds,...(index?{firstTimestamp:JSON.parse(h.writes[0]).createdAt}:{})};}
  function clean(h){for(const label of ['post-work-1','post-work-2','post-stringify'])eq(h.account.snapshot().reservations[label],0);}
  await group('unchanged entry and final callbacks, opaque retention, clamp and exact writer order',()=>{
    for(const n of [8,9])for(const seconds of [0,17.25,10000001,Number.MAX_VALUE]){
      const p=F.plan(n);p.coreSeconds=1e7;p.ignored='drop';p.finaleEvidence={version:99,payload:['opaque','界🌙\ud800']};
      p.tasks[0]={ignored:'drop',proof:{opaque:'kept'},checkpoint:{seconds:0,run:{time:2},opaque:true},
        performance:{errors:0,impacts:0,detections:0,moves:0,seconds:0,precise:true,opaque:'kept'}};
      const text=JSON.stringify(p),o=oracle(text,n,seconds),h=setup(text,n);
      for(const index of [0,1]){const result=h.run(opts(o,index));eq(result.bytes,o.writes[index].length*2);ok(Object.isFrozen(result));
        eq(Object.keys(result),['kind','chapter','createdAt','coreSeconds','bytes']);eq(result.coreSeconds,index?1e7:1e7+o.addedSeconds);clean(h);}
      const output=JSON.parse(o.writes[1]);eq(output.finaleEvidence,p.finaleEvidence);eq(output.tasks[0].proof,p.tasks[0].proof);
      eq(output.tasks[0].performance.opaque,'kept');eq(output.ignored,undefined);eq(output.tasks[0].ignored,undefined);
      eq(h.account.snapshot().peak,1015808);measurements.push({n,seconds,peak:h.account.snapshot().peak,bytes:o.writes.map(s=>s.length*2)});
    }
    {const text=JSON.stringify({...F.plan(8),coreSeconds:Number.MAX_VALUE}),o=oracle(text),h=setup(text);
      for(const index of [0,1])eq(h.run(opts(o,index)).coreSeconds,index?1e7:1e7+o.addedSeconds);clean(h);}
    for(const phase of ['operations','core']){
      const p={...F.plan(9),phase},text=JSON.stringify(p),o=oracle(text,9,0,true),h=setup(text,9,{admit:phase==='core'});
      const result=h.run({kind:'entry',observedText:o.writes[0],before:o.before,after:o.after});eq(result.kind,'entry');eq(result.coreSeconds,0);clean(h);
    }
  });
  await group('raw UTF16 cap and near-cap opaque ASCII, BMP, astral and lone units',()=>{
    const base=JSON.stringify(F.plan(8)),raw=base+' '.repeat(LIMIT/2-base.length);
    const h=setup(raw),o=oracle(raw);eq(h.run(opts(o)).bytes,o.writes[0].length*2);clean(h);
    for(const unit of ['x','界','🌙','\ud800']){
      const text=JSON.stringify({...F.plan(8),finaleEvidence:{payload:unit.repeat(unit.length===2?8000:unit==='\ud800'?5300:32000)}}),a=oracle(text),b=setup(text);
      for(const index of [0,1])b.run(opts(a,index));clean(b);ok(b.account.snapshot().peak<=1016832);
    }
    throws(()=>R.validateStoryRewrite(raw+' ',8,opts(o),h.account),/story-rewrite-limit/);
    throws(()=>h.run({...opts(o),observedText:' '.repeat(LIMIT/2+1)}),/story-rewrite-limit/);clean(h);
  });
  await group('negative zero is preserved in original context and normalized by writer JSON roundtrip',()=>{
    const text=JSON.stringify({...F.plan(8),coreSeconds:0,tasks:{0:{proof:{zero:0},performance:{errors:0,impacts:0,detections:0,moves:0,seconds:0,precise:true}}}})
      .replace('"coreSeconds":0','"coreSeconds":-0').replace('"zero":0','"zero":-0').replace('"errors":0','"errors":-0');
    const o=oracle(text,8,-0),h=setup(text);for(const index of [0,1])h.run(opts(o,index));ok(X.matchesContextText(h.capsule,text));
    eq(JSON.parse(o.writes[1]).tasks[0].proof.zero,0);
    const labels=h.events.filter(e=>e.type==='event').map(e=>e.label),drop=labels.lastIndexOf('story-first-drop');
    ok(drop<labels.lastIndexOf('story-intermediate-parse'));ok(labels.lastIndexOf('story-intermediate-drop')<labels.lastIndexOf('story-second-restore'));clean(h);
  });
  await group('wrong fields, normalization, timestamps, chapter and options reject without adopting target',()=>{
    const text=JSON.stringify(F.plan(8)),o=oracle(text),h=setup(text),good=opts(o,1);
    for(const mutate of [v=>{v.seed++;},v=>{v.phase='core';},v=>{v.tasks={0:{proof:{forged:true}}};},v=>{v.coreSeconds++;},
      v=>{v.finaleEvidence='forged';},v=>{v.extra=true;},v=>{v.createdAt=o.before-1;},v=>{v.createdAt=o.after+1;},
      v=>{v.createdAt=-0;},v=>{v.createdAt=1.5;},v=>{v.createdAt='1791828000000';}]){
      const value=JSON.parse(good.observedText);mutate(value);throws(()=>h.run({...good,observedText:JSON.stringify(value)}));clean(h);
    }
    for(const change of [{before:o.after+1},{after:o.before-1},{before:-1},{after:Infinity},{firstTimestamp:o.after+1},
      {firstTimestamp:o.before-1},{firstTimestamp:o.after},{addedSeconds:-1},{addedSeconds:NaN},{kind:'unknown'},{extra:true}]){throws(()=>h.run({...good,...change}));clean(h);}
    for(const observedText of ['null','[]','{',' '+good.observedText,JSON.stringify(Object.fromEntries(Object.entries(JSON.parse(good.observedText)).reverse()))])throws(()=>h.run({...good,observedText}));
    const getter={...good};Object.defineProperty(getter,'observedText',{get(){throw Error('getter invoked');},enumerable:true});throws(()=>h.run(getter));
    throws(()=>R.validateStoryRewrite(text,9,good,h.account));eq(h.run(good).createdAt,JSON.parse(good.observedText).createdAt);clean(h);
  });
  await group('captured inputs, same- and different-account reentry, reserved allocation labels and observer failures',()=>{
    const text=JSON.stringify(F.plan(8)),o=oracle(text),options=opts(o,1),other=setup(text);let armed=false,h,reentered=0;
    h=setup(text,8,{hook(e){if(!armed)return;
      if(e.type==='reserve'&&e.label==='post-work-1'){options.observedText='forged';options.before=-1;options.addedSeconds=999;
        throws(()=>h.run(opts(o)),/story-rewrite-busy/);throws(()=>other.run(opts(o)),/story-rewrite-busy/);reentered++;}
    }});armed=true;eq(h.run(options).createdAt,JSON.parse(o.writes[1]).createdAt);eq(reentered,1);clean(h);clean(other);
    const events=h.events.filter(e=>e.type==='event').map(e=>e.label);ok(events.indexOf('story-observed-drop')<events.indexOf('story-original-parse'));
    for(const label of ['post-work-1','post-work-2','post-stringify'])ok(h.events.some(e=>e.type==='allocate'&&e.label===label&&e.reservations[label]===LIMIT));
    for(const [type,label]of [['reserve','post-work-1'],['reserve','post-work-2'],['reserve','post-stringify'],['event','story-observed-drop'],['event','story-second-restore'],['release','post-stringify']]){
      let on=false;const a=setup(text,8,{hook(e){if(on&&e.type===type&&e.label===label)throw Error('observer-boom');}});on=true;
      throws(()=>a.run(opts(o,1)),/observer-boom/);clean(a);on=false;eq(a.run(opts(o,1)).bytes,o.writes[1].length*2);clean(a);
    }
    const a=setup(text),restore=Story.restore;Story.restore=()=>{throw Error('restore-boom');};
    try{throws(()=>a.run(opts(o)),/restore-boom/);}finally{Story.restore=restore;}clean(a);
    const b=setup(text),parse=JSON.parse;JSON.parse=()=>{throw Error('parse-boom');};
    try{throws(()=>b.run(opts(o)),/story-rewrite-invalid/);}finally{JSON.parse=parse;}clean(b);
    const blocked=setup(text);blocked.account.reserve('post-work-1',LIMIT);
    throws(()=>blocked.run(opts(o)),/budget-lifetime/);eq(blocked.account.snapshot().reservations['post-work-1'],LIMIT);blocked.account.release('post-work-1',LIMIT);
    const unreserved=B.createPhaseBudget();throws(()=>R.validateStoryRewrite(text,8,opts(o),unreserved),/allocation-unreserved/);
  });
  const report={test:'evidence-story-rewrite',status:'pass',groups:groups.length,checks,groupNames:groups,measurements,
    cap:LIMIT,peak:1015808,sharedCeiling:1016832,qualification:'Unchanged source in synthetic VM, no browser/native storage/rewards authority; encoded slots, not heap/RSS'};
  if(process.env.MKTY_STORY_REWRITE_REPORT)fs.writeFileSync(process.env.MKTY_STORY_REWRITE_REPORT,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
})().catch(error=>{console.error(error);process.exitCode=1;});
