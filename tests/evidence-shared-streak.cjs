'use strict';
// Portable SOURCE-ONLY parity oracle. Complete unchanged daily IIFE, narrow
// existing test DOM, permanently private Map/Date, normal mounted button click.
// Not native input, two real tabs, IndexedDB transactions or durability evidence.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createHash}=require('node:crypto'),{pathToFileURL}=require('node:url');
const root=path.join(__dirname,'..'),source=fs.readFileSync(path.join(root,'daily-retention.js'),'utf8');
const projectorPath=path.join(root,'prototypes/evidence-indexeddb/shared-streak.mjs');
const projectorSource=fs.readFileSync(projectorPath,'utf8');
const helper=fs.readFileSync(path.join(__dirname,'language-hot-switch-helper.cjs'),'utf8');
// Reuse only the existing helper's DOM implementation, without running its
// unrelated controllers or changing its source. Fixed Date/storage are installed
// before the real daily IIFE starts and never replaced through its async tail.
const domSource=helper.slice(helper.indexOf(' const descendant='),helper.indexOf(' const app='));
assert(domSource.startsWith(' const descendant=')&&domSource.includes('const document='));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const markup='<b id="points"></b>'+html.slice(html.indexOf('      <section id="dailyOps"'),html.indexOf('      <section id="communityHub"'));
const DAY='2026-10-12',NEXT='2026-10-13',HASH='37057554f05ddbd593734bd9390e056970b5267918b63491d292b5d227eebddb';
const globals=['localStorage','Date','window','setInterval','setTimeout'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]);
let checks=0;const groups=[],sizes=[];
const eq=(a,b,msg)=>{assert.deepStrictEqual(a,b,msg);checks++;};
const ok=(a,msg)=>{assert(a,msg);checks++;};
const throws=(fn,re)=>{assert.throws(fn,re);checks++;};
const clone=x=>JSON.parse(JSON.stringify(x));
const initial=extras=>JSON.stringify({cday:DAY,streak:0,...extras});
const disk=(dailyText=initial(),points=2100,locked=false)=>new Map([['mkty_daily_demo',dailyText],['mkty_points',String(points)],...(locked?[['mkty_life9','complete']]:[])]);
function declaration(text,kind,name){
  const start=text.indexOf(' '+kind+' '+name+(kind==='function'?'(':' ='));
  assert(start>=0,'missing declaration '+name);const end=text.indexOf('\n',start),line=text.slice(start,end);
  return kind==='const'||line.endsWith(' }')?line:text.slice(start,text.indexOf('\n }',end)+3);
}
function oracle(saved=disk(),day=DAY){
  const writes=[],intervals=[],timers=[],listeners=new Map();
  const time=Date.parse(day+'T00:00:00Z');
  class FixedDate extends Date {constructor(...args){super(...(args.length?args:[time]));}static now(){return time;}}
  const storage=Object.freeze({getItem:key=>saved.get(key)??null,setItem(key,value){value=String(value);writes.push({origin:'daily',key,value});saved.set(key,value);},
    removeItem(key){writes.push({origin:'daily',key,value:null});saved.delete(key);}});
  const ctx={console,Date:FixedDate,localStorage:storage,fixtureMarkup:markup,
    addEventListener:(key,fn)=>listeners.set(key,[...(listeners.get(key)||[]),fn]),
    setInterval:(fn,ms)=>(intervals.push({fn,ms}),intervals.length),setTimeout:(fn,ms)=>(timers.push({fn,ms}),timers.length),clearTimeout(){}};
  ctx.window=ctx;Object.defineProperties(ctx,{Date:{value:FixedDate,writable:false,configurable:false},localStorage:{value:storage,writable:false,configurable:false}});
  vm.createContext(ctx,{codeGeneration:{strings:false,wasm:false}});
  vm.runInContext('const observers=[],writes=[];\n'+domSource+'\ndocument.body.innerHTML=fixtureMarkup;globalThis.document=document;',ctx,{filename:'derived-existing-test-dom'});
  vm.runInContext(source,ctx,{filename:'daily-retention.js'});
  // api() and load() have real Promise continuations. They remain in this realm,
  // with this storage and clock; no transactional claim is made about settlement.
  const settle=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
  const get=id=>ctx.document.getElementById(id);
  return {saved,writes,intervals,timers,ctx,get,settle,click:()=>get('streakBtn').click(),
    write(key,value){writes.push({origin:'fixture',key,value});if(value===null)saved.delete(key);else saved.set(key,String(value));},
    dailyWrites:()=>writes.filter(w=>w.origin==='daily')};
}
(async()=>{
  const P=await import(pathToFileURL(projectorPath).href);
  const group=async(name,fn)=>{await fn();groups.push(name);};
  const project=(dailyText=initial(),points=2100,locked=false,day=DAY)=>P.projectSharedStreak({dailyText,points,locked,day});
  async function mounted(saved=disk(),day=DAY){const h=oracle(saved,day);await h.settle();eq(h.dailyWrites(),[],'mount/load must not change admitted daily envelope');eq(h.intervals.length,1);return h;}
  function same(h,p){eq(h.saved.get('mkty_daily_demo'),p.dailyText);eq(Number(h.saved.get('mkty_points')),p.points);}
  await group('01 pinned daily source and verbatim helper/constants parity',()=>{
    eq(createHash('sha256').update(source).digest('hex'),HASH);eq(P.SHARED_DAILY_SOURCE_SHA256,HASH);eq(P.SHARED_DAILY_LIMIT,4096);
    for(const name of ['SCALE','utcDay','dayNum','isoWeek','locked'])eq(declaration(projectorSource,'const',name),declaration(source,'const',name),name);
    for(const name of ['demo','saveDemo','demoPoints','demoCheckin'])eq(declaration(projectorSource,'function',name),declaration(source,'function',name),name);
    ok(!/\b(?:eval|Function)\s*\(/.test(projectorSource));ok(!/\b(?:async|await)\b/.test(projectorSource));
  });
  await group('02 unlocked mounted click grants actual +3, immutable synchronous projection',async()=>{
    const h=await mounted(),p=project();eq(h.get('streakBtn').disabled,false);h.click();await h.settle();same(h,p);
    eq(p.points,2103);eq(p.delta,3);eq(p.legacyResult,{awarded:true,points:3,shield_used:false});eq(Object.keys(p),['dailyText','points','delta','legacyResult']);
    ok(Object.isFrozen(p)&&Object.isFrozen(p.legacyResult));ok(!(p instanceof Promise));eq(h.get('streakBtn').disabled,true);
    eq(h.dailyWrites().map(w=>w.key),['mkty_daily_demo','mkty_points']);eq(h.get('dopsFlash').textContent,'Check-in +3 ⭐');
    const validation=P.validateSharedDaily(p.dailyText,DAY);ok(validation.claimed);throws(()=>P.validateSharedDaily(p.dailyText,DAY,{initial:true}),/shared-daily-domain/);
  });
  await group('03 fresh locked mount cannot click or claim',async()=>{
    const saved=disk(initial(),5100,true),h=await mounted(saved),before=[...saved];eq(h.get('streakBtn').disabled,true);
    h.click();await h.settle();eq([...saved],before);eq(h.dailyWrites(),[]);eq(h.get('streakBtn').textContent,'BALANCE LOCKED');
  });
  await group('04 stale enabled button claims after terminal lock with nominal3 and actual0',async()=>{
    const h=await mounted(),before=h.saved.get('mkty_daily_demo');eq(h.get('streakBtn').disabled,false);
    h.write('mkty_points','5100');h.write('mkty_life9','complete');h.write('mkty_life9_awarded','yes');h.write('mkty_final_moon_points','5100');h.write('mkty_points_locked_at','1234');
    eq(h.get('streakBtn').disabled,false,'no rerender between terminal fixture writes and normal click');
    const p=project(before,5100,true);h.click();await h.settle();same(h,p);
    eq(p.points,5100);eq(p.delta,0);eq(p.legacyResult,{awarded:true,points:3,shield_used:false});eq(JSON.parse(p.dailyText).last_day,DAY);
    eq(h.dailyWrites().map(w=>w.key),['mkty_daily_demo']);eq(h.get('dopsFlash').textContent,'Check-in +3 ⭐','legacy display is nominal, not actual delta');
    eq(h.saved.get('mkty_final_moon_points'),'5100');eq(h.saved.get('mkty_points_locked_at'),'1234');
  });
  await group('05 stale same-day duplicate mounted click leaves raw text and points unchanged',async()=>{
    const saved=disk(),first=await mounted(saved),stale=await mounted(saved);eq(stale.get('streakBtn').disabled,false);
    first.click();await first.settle();const before=saved.get('mkty_daily_demo'),p=project(before,2103);
    stale.click();await stale.settle();same(stale,p);eq(stale.dailyWrites(),[]);eq(p.delta,0);eq(p.legacyResult,{awarded:false,duplicate:true});
    eq(p.dailyText,before);eq(stale.get('dopsFlash').textContent,'Already checked in today');
    eq(project(before,5103,true).legacyResult,{awarded:false,duplicate:true});
    const raw=' { "cday": "'+DAY+'", "streak": 1, "last_day": "'+DAY+'", "attempts": 99, "codes": [5,"KEEP"] } ';
    const duplicate=project(raw,2103);eq(duplicate.dailyText,raw,'duplicate does not persist normalization');eq(duplicate.delta,0);
    const ready=await mounted(disk());ready.write('mkty_daily_demo',raw);ready.write('mkty_points','2103');
    ready.click();await ready.settle();same(ready,duplicate);eq(ready.dailyWrites(),[]);
    // This is a newly executed legacy duplicate. The shared owner must return its
    // original persisted receipt instead when the logical command is duplicate.
  });
  await group('06 original normalization and unrelated envelope fields preserved',async()=>{
    const text=initial({attempts:99,solved:'yes',codes:['KEEP',4,null,'MOONTEST'],shield_week:'1999-W01',other:{nested:['🌓','x'],flag:true},constructor:'safe',__protoMarker:'keep'});
    const h=await mounted(disk(text)),p=project(text);h.click();await h.settle();same(h,p);
    const d=JSON.parse(p.dailyText);eq(d.attempts,5);eq(d.solved,false);eq(d.codes,['KEEP','MOONTEST']);eq(d.shield_week,'1999-W01');
    eq(d.other,{nested:['🌓','x'],flag:true});eq(d.constructor,'safe');eq(d.__protoMarker,'keep');
    for(const extras of [{attempts:-12,solved:true,codes:'bad'},{attempts:1.5,solved:false,codes:[]},{attempts:2,solved:true,codes:['ONE']}]){
      const raw=initial(extras),v=P.validateSharedDaily(raw,DAY,{initial:true}),ui=await mounted(disk(raw)),out=project(raw);ui.click();await ui.settle();same(ui,out);
      eq(v.dailyText,raw);eq(v.inputBytes,raw.length*2);eq(v.normalizedBytes,v.normalizedText.length*2);ok(Object.isFrozen(v));
      sizes.push({input:v.inputBytes,normalized:v.normalizedBytes,output:out.dailyText.length*2});
    }
    const proto='{"cday":"'+DAY+'","streak":0,"__proto__":{"preserved":true},"constructor":{"safe":true},"prototype":{"also":"kept"},"toJSON":"ordinary-data"}';
    const out=project(proto),ui=await mounted(disk(proto));ui.click();await ui.settle();same(ui,out);eq(JSON.parse(out.dailyText).__proto__,{preserved:true});eq(JSON.parse(out.dailyText).constructor,{safe:true});eq(JSON.parse(out.dailyText).prototype,{also:'kept'});eq(JSON.parse(out.dailyText).toJSON,'ordinary-data');eq({}.preserved,undefined);
  });
  await group('07 qualification: rollover/status writes exist in original but are outside this slice',async()=>{
    const raw=initial(),committed=project(raw),h=oracle(disk(raw),NEXT);await h.settle();eq(h.dailyWrites().map(w=>w.key),['mkty_daily_demo']);
    eq(JSON.parse(h.saved.get('mkty_daily_demo')).cday,NEXT);throws(()=>P.validateSharedDaily(raw,NEXT,{initial:true}),/shared-daily-domain/);
    throws(()=>project(committed.dailyText,2103,false,NEXT),/shared-daily-domain/);
    // Fresh-realm read-only replay supplies the recorded day, not a changed
    // admission clock. Owner policy must look up an existing receipt first.
    eq(project(committed.dailyText,2103,false,DAY).delta,0);
    for(const d of ['',null,'2026-02-30','2026-13-01','2026-10-12T00:00:00Z','26-10-12'])throws(()=>project(raw,2100,false,d),/shared-daily-day/);
    for(const value of [{cday:DAY,streak:0,last_day:null},{cday:DAY,streak:0,last_day:'bad'},{cday:DAY,streak:2,last_day:DAY},
      {cday:DAY,streak:1,last_day:'2026-10-11'},{cday:NEXT,streak:0},{cday:DAY},{cday:DAY,streak:-1}])throws(()=>project(JSON.stringify(value)),/shared-daily-domain/);
  });
  await group('08 raw, normalized and output UTF16 caps; failures preserve input and private UI',async()=>{
    for(const raw of [null,{},'[]','null','false','5','"x"','{bad'])throws(()=>project(raw),/shared-daily-(?:limit|object|json)/);
    const huge=initial({padding:'x'.repeat(2048)}),h=await mounted(),before=[...h.saved];throws(()=>project(huge),/shared-daily-limit/);eq([...h.saved],before);
    const rawBase=initial({padding:''}),rawExact=initial({padding:'x'.repeat(2048-rawBase.length)});eq(rawExact.length*2,4096);
    throws(()=>P.validateSharedDaily(rawExact,DAY,{initial:true}),/shared-daily-limit/,'normalization adds required fields');
    const normalizedBase=initial({attempts:0,solved:false,codes:[],padding:''});
    const normalizedExact=initial({attempts:0,solved:false,codes:[],padding:'x'.repeat(2048-normalizedBase.length)});
    eq(P.validateSharedDaily(normalizedExact,DAY,{initial:true}).normalizedBytes,4096);throws(()=>project(normalizedExact),/shared-daily-limit/,'claim cannot exceed output cap');
    const first=project(normalizedBase),room=2048-first.dailyText.length;
    const max=initial({attempts:0,solved:false,codes:[],padding:'x'.repeat(room)}),out=project(max),ui=await mounted(disk(max));ui.click();await ui.settle();same(ui,out);eq(out.dailyText.length*2,4096);
    const info=P.validateSharedDaily(max,DAY,{initial:true});sizes.push({input:info.inputBytes,normalized:info.normalizedBytes,output:out.dailyText.length*2});
    // Four bytes per astral glyph in UTF-16 representation; not UTF-8 sizing.
    const unicode=initial({padding:'🌓'.repeat(1000)});ok(unicode.length*2>4000);throws(()=>project(unicode),/shared-daily-limit/);
    for(const code of [0xd800,0xdc00]){
      // Actual raw lone-surrogate code units, not their already-expanded escape
      // spelling. Raw fits while canonical JSON would grow almost sixfold.
      const raw='{"cday":"'+DAY+'","streak":0,"padding":"'+String.fromCharCode(code).repeat(1900)+'"}';
      ok(raw.length*2<=4096);ok(JSON.stringify(JSON.parse(raw)).length*2>20000);
      throws(()=>P.validateSharedDaily(raw,DAY,{initial:true}),/shared-daily-limit/);throws(()=>project(raw),/shared-daily-limit/);
    }
    const small='{"cday":"'+DAY+'","streak":0,"padding":"'+String.fromCharCode(0xd800)+'"}';
    const smallOutput=project(small),smallUI=await mounted(disk(small));smallUI.click();await smallUI.settle();same(smallUI,smallOutput);
    const deep='{"cday":"'+DAY+'","streak":0,"opaque":'+'['.repeat(100)+'0'+']'.repeat(100)+'}';
    const deepOutput=project(deep),deepUI=await mounted(disk(deep));deepUI.click();await deepUI.settle();same(deepUI,deepOutput);
    const many=initial({opaque:Object.fromEntries(Array.from({length:150},(_,i)=>['k'+i,0]))});
    const manyOutput=project(many),manyUI=await mounted(disk(many));manyUI.click();await manyUI.settle();same(manyUI,manyOutput);
    throws(()=>project('{"cday":"'+DAY+'","streak":0,"opaque":1e400}'),/shared-daily-object/);
  });
  await group('09 input guards, no ambient writes, async tails retain their own clock/storage',async()=>{
    for(const n of [-1,-0,NaN,Infinity,1.5,Number.MAX_SAFE_INTEGER])throws(()=>project(initial(),n),/shared-daily-points/);
    throws(()=>project(initial(),2100,'complete'),/shared-daily-points/);throws(()=>P.projectSharedStreak({dailyText:initial(),points:2100,locked:false,day:DAY,extra:1}),/shared-daily-input/);
    const max=project(initial(),Number.MAX_SAFE_INTEGER,true);eq(max.delta,0);eq(max.points,Number.MAX_SAFE_INTEGER);
    const a=oracle(disk()),b=oracle(disk(JSON.stringify({cday:NEXT,streak:0})),NEXT);await Promise.all([a.settle(),b.settle()]);eq(a.dailyWrites(),[]);eq(b.dailyWrites(),[]);
    a.click();b.click();await Promise.all([a.settle(),b.settle()]);eq(JSON.parse(a.saved.get('mkty_daily_demo')).last_day,DAY);eq(JSON.parse(b.saved.get('mkty_daily_demo')).last_day,NEXT);
    eq(a.ctx.Date.now(),Date.parse(DAY+'T00:00:00Z'));eq(b.ctx.Date.now(),Date.parse(NEXT+'T00:00:00Z'));eq(a.ctx.localStorage.getItem('mkty_daily_demo'),a.saved.get('mkty_daily_demo'));
    for(const [key,descriptor]of globals)eq(Object.getOwnPropertyDescriptor(globalThis,key),descriptor,key+' was never swapped or changed');
  });
  eq(createHash('sha256').update(fs.readFileSync(path.join(root,'daily-retention.js'))).digest('hex'),HASH,'original source untouched');
  console.log(JSON.stringify({test:'evidence-shared-streak',status:'passed',checks,groups,sizes,qualification:'portable VM/Map/source parity only; no browser, IDB transaction or durability claims'},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
