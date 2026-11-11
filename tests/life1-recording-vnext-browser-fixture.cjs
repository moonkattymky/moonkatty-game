'use strict';
// PREPARED SOURCE ONLY unless explicitly selected in authorized native CI.
// Importing this file starts no browser/server. Production files stay untouched.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const {instrument}=require('./fixtures/life1-recording-vnext-instrument.cjs');
const {bundle,nativeCheck,geometrySnapshot}=require('./fixtures/life1-recording-vnext-browser-helper.cjs');
const M=require('../prototypes/life1-capture/pr47/life1-model.js');
const R=require('../prototypes/life1-capture/vnext/recorder.cjs');
const context={life1_profile:M.NATIVE_PROFILE,route:'00000000-0000-4000-8000-000000000571',life:1,edition:2,challenge_version:2,seed:571};
function responseFor(url,method='GET'){
 let name;try{name=decodeURIComponent(new URL(url,'http://local').pathname);}catch{return {status:400};}
 if(!['GET','HEAD'].includes(method))return {status:405};if(name==='/')name='/index.html';
 if(!/^\/(?:[^/]+|(?:art|locales\/runtime)\/[^/]+)$/.test(name)||name.split('/').some(x=>x.startsWith('.')))return {status:403};
 const file=path.resolve(root,'.'+name);if(!file.startsWith(root+path.sep))return {status:403};
 const types={'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.webp':'image/webp','.png':'image/png','.mp4':'video/mp4'};
 if(!types[path.extname(file)])return {status:403};if(path.extname(file)==='.mp4')return {status:204};
 if(!fs.existsSync(file))return {status:404};const real=fs.realpathSync(file);if(!real.startsWith(root+path.sep))return {status:403};
 let body=fs.readFileSync(real);if(['app.js','campaign.js','experience.js'].includes(path.basename(file)))body=Buffer.from(instrument(body.toString('utf8'),path.basename(file)));
 return {status:200,type:types[path.extname(file)],body:method==='HEAD'?Buffer.alloc(0):body};
}
async function main(){
 const http=require('node:http'),{chromium}=require('playwright');
 const lane=process.env.MKTY_C1_NATIVE_LANE||'vnext';assert.equal(lane,'vnext','separately selected vNext lane');
 const out=process.env.MKTY_TEST_OUTPUT||fs.mkdtempSync('/tmp/mkty-life1-vnext-browser-');fs.mkdirSync(out,{recursive:true});
 const report={base:'eaa09304c773129d8b06ec4c85a542e123e13450',lane,format:R.FORMAT,cases:[],failures:[],geometryObservations:[],nativeTimingIntervals:[],
  gatePassed:false,oldMixedClockGatePassed:false,runtimeReady:false,authoritativeAdmission:false,limits:[
   'Native Chromium fixture only; no physical phone, Telegram, active-unpaused recovery, human timing, trusted storage or authoritative admission claim.',
   'The old mixed-clock diagnostic remains gatePassed:false; this separately versioned callback format does not change that result.',
   'The reduced-motion, unit-DPR, untransformed geometry profile is explicit. No layout-settlement barrier or timer/RAF replacement is used.'
  ]};
 const server=http.createServer((req,res)=>{const r=responseFor(req.url,req.method);res.writeHead(r.status,{'Content-Type':r.type||'text/plain','Cache-Control':'no-store'});res.end(r.body||'');});
 let browser;const deadline=setTimeout(()=>{console.error('vNext native fixture exceeded 180 seconds');process.exit(1);},180000);deadline.unref();
 const write=(name,value)=>fs.writeFileSync(path.join(out,name),R.encode(value)+'\n');
 try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});
  report.browserVersion=browser.version();
  async function checked(p,label){
   const observed=await p.evaluate(()=>({status:__C1VNext.status(),diagnostics:__C1VNextNative.firstFailure,compared:__C1VNext.compare()}));
   report.geometryObservations.push({label,snapshot:await p.evaluate(geometrySnapshot)});
   assert.equal(observed.status.fault,null,label+': '+JSON.stringify(observed.status));
   assert.equal(observed.diagnostics,null,label+': '+JSON.stringify(observed.diagnostics));
   assert.equal(observed.compared.ok,true,label+': '+JSON.stringify(observed.compared));
   await p.evaluate(nativeCheck);
  }
  async function captureDocument(p,name){
   const evidence=await p.evaluate(()=>({status:__C1VNext.status(),wire:__C1VNext.wire(),diagnostics:__C1VNextNative}));
   write(name+'.json',evidence);return evidence;
  }
  async function enter(p,fresh){
   await p.evaluate(({context,fresh})=>{
    const original=window.resetLife1Mission;
    window.resetLife1Mission=function(){const prior=Math.random;Math.random=Life1Prototype.random(Life1Prototype.challengeSeed(context));try{return original();}finally{Math.random=prior;}};
    if(fresh){const armed=__C1VNext.armFresh(context);if(!armed.ok)throw Error(armed.error);}
   },{context,fresh});
   await p.locator('#enterBtn').click();
   if(await p.locator('#skipBtn').isVisible())await p.locator('#skipBtn').click();
   // This awaits original screen navigation, never geometry/cache settlement.
   await p.waitForFunction(()=>$('mission1').classList.contains('active'));
  }
  async function runMission(reloads){
   const kind=reloads?'paused-repair-and-40-percent-hold-reloads':'ordinary-native-completion';
   const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,reducedMotion:'reduce',serviceWorkers:'block'});
   await ctx.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
   await ctx.routeWebSocket('**/*',ws=>ws.close());const p=await ctx.newPage();p.setDefaultTimeout(8000);
   p.on('pageerror',error=>report.failures.push(kind+': '+error.message));
   // One init script fixes order without relying on Playwright's ordering of
   // separately registered scripts. Random seeding is confined to initial reset.
   await p.addInitScript({content:bundle()+'\n('+require('./story-finale-fixture.cjs').toString()+')();\n'+
    "localStorage.setItem('mkty_lang','en');localStorage.setItem('mkty_test_no_pacing','yes');localStorage.setItem('mkty_current_chapter','1');"});
   const prefixes=[],documents=[];
   try{
    await p.goto(origin,{waitUntil:'domcontentloaded'});await enter(p,true);await checked(p,kind+' fresh');
    async function approach(selector){
     for(let attempts=0;attempts<150;attempts++){
      const next=await p.evaluate(selector=>{
       const target=document.querySelector(selector),w=$('life1World').getBoundingClientRect(),t=target.getBoundingClientRect(),player=$('life1Player').getBoundingClientRect();
       const gx=(t.left+t.right)/2-w.left,gy=(t.top+t.bottom)/2-w.top,px=(player.left+player.right)/2-w.left,py=(player.top+player.bottom)/2-w.top;
       if(Math.hypot(px-gx,py-gy)/Math.max(1,Math.min(w.width,w.height))<.22)return null;
       const offset=player.height*.35,q=[[l1PX,l1PY,[]]],visited=new Set();
       while(q.length){const [x,y,route]=q.shift();if(Math.hypot(x*w.width/100-gx,y*w.height/100-offset-gy)<Math.min(w.width,w.height)*.205)return {target:route[0],position:[l1PX,l1PY],size:[w.width,w.height]};
        for(const [dx,dy]of [[-4,0],[4,0],[0,-4],[0,4]]){const nx=x+dx,ny=y+dy,key=Math.round(nx)+','+Math.round(ny);if(nx<7||nx>90||ny<18||ny>88||visited.has(key)||life1Blocked(nx,ny)||life1Blocked(x+dx/2,y+dy/2))continue;visited.add(key);q.push([nx,ny,[...route,[nx,ny]]]);}}
       throw Error('No walkable native joystick path');
      },selector);if(!next)return;
      assert(next.target,'nonempty joystick path');
      const dx=(next.target[0]-next.position[0])*next.size[0]/100,dy=(next.target[1]-next.position[1])*next.size[1]/100,len=Math.hypot(dx,dy),j=await p.locator('#life1Joystick').boundingBox();
      await p.mouse.move(j.x+j.width/2,j.y+j.height/2);await p.mouse.down();
      try{
       await p.mouse.move(j.x+j.width/2+dx/len*j.width*.31,j.y+j.height/2+dy/len*j.width*.31);
       // Await earned source-controller movement under the untouched RAF. No
       // supplied dt, position assignment, injected frame, or wall-time rounding.
       await p.waitForFunction(({position,size,dx,dy,len})=>{
        if(__C1VNext.status().fault||__C1VNextNative.firstFailure)throw Error('Native capture failed during movement');
        return ((l1PX-position[0])*size[0]/100*dx+(l1PY-position[1])*size[1]/100*dy)/len>=len;
       },{...next,dx,dy,len},{polling:'raf',timeout:3000});
      }finally{await p.mouse.up();}
      await checked(p,kind+' joystick step');
     }throw Error('Native joystick target not reached');
    }
    async function reloadPaused(label,expected){
     await checked(p,kind+' paused '+label);
     // Snapshot the exact durable prefix in one JS task. Ordinary paused RAFs
     // continue after this point; their later, unsaved suffix is not fabricated.
     const before=await p.evaluate(()=>{const saved=__C1VNext.save();return {saved,wire:__C1VNext.wire(),durable:localStorage.getItem(__C1VNext.KEY),source:__C1VNext.source()};});
     assert.equal(before.saved.ok,true);assert.equal(before.wire,before.durable);
     documents.push(await captureDocument(p,kind+'-'+label+'-before-reload'));
     await p.reload({waitUntil:'domcontentloaded'});
     // The original pagehide save may append later complete paused callbacks.
     // Hydrate its real durable prefix, while proving the earlier prefix stayed
     // byte-exact. Do not erase pagehide events or freeze the native RAF.
     const persisted=await p.evaluate(()=>localStorage.getItem(__C1VNext.KEY));
     const earlier=JSON.parse(before.wire),old=JSON.parse(persisted);
     assert.deepEqual(old.entries.slice(0,earlier.entries.length),earlier.entries,'pre-pagehide prefix remains intact');
     assert.equal(R.inspect(persisted).ok,true);prefixes.push(persisted);
     write(kind+'-'+label+'-durable-prefix.json',{wire:persisted});
     await enter(p,false);
     await p.locator('#mission1 .chapter-menu').click();
     const restored=await p.evaluate(()=>__C1VNext.restore());assert.equal(restored.ok,true,label+': '+JSON.stringify(restored));
     await checked(p,kind+' hydrated '+label);
     const after=await p.evaluate(()=>({wire:__C1VNext.wire(),source:__C1VNext.source()})),wire=JSON.parse(after.wire);
     assert.deepEqual(wire.entries.slice(0,old.entries.length),old.entries,'unaltered complete source prefix');
     assert.equal(after.source.paused,true);for(const [key,value]of Object.entries(expected))assert.equal(after.source[key],value,label+' '+key);
     assert.equal(wire.entries[old.entries.length][0],'document');assert.equal(wire.entries[old.entries.length][1],old.entries.at(-1)[1]+1);
     if(label==='hold'){
      // Await two actual paused hold deliveries; this tests pause guards, not
      // layout settlement or synthetic elapsed play. Every callback is retained.
      await p.waitForFunction(()=>__C1VNextNative.callbacks.filter(callback=>callback.kind==='hold').length>=2);
      assert.equal(await p.evaluate(()=>signalHoldProgress),40,'paused rearmed native ticks earn no hold progress');
      await checked(p,kind+' paused rearmed hold ticks');
     }
     await p.locator('#guideResume').click();
     await p.waitForFunction(()=>__C1VNextNative.firstResumedFrames.length>0);
     await checked(p,kind+' first resumed frame '+label);
    }
    for(const id of ['1','2','3']){
     await approach('.energy.e'+id);await checked(p,kind+' before collect '+id);
     await p.locator('.energy.e'+id).click();await checked(p,kind+' collect '+id);
    }
    await approach('#repairTerminal');await p.locator('#repairTerminal').click();await p.locator('#showRepairSequenceBtn').click();
    await p.waitForFunction(()=>/^[ABC] [ABC] [ABC] [ABC]$/.test($('repairSequence').textContent));
    const sequence=(await p.locator('#repairSequence').innerText()).trim().split(/\s+/).map(s=>s.charCodeAt(0)-65);assert.equal(sequence.length,4);
    await p.waitForFunction(()=>!repairShowing);
    for(const n of sequence.slice(0,2))await p.locator('[data-cell="'+n+'"]').click();
    if(reloads){await p.locator('#mission1 .chapter-menu').click();await reloadPaused('repair',{repairCells:2,repairShowing:false,repairOpen:true});}
    for(const n of sequence.slice(2))await p.locator('[data-cell="'+n+'"]').click();await checked(p,kind+' repair complete');
    await approach('#antennaHotspot');await p.locator('#antennaHotspot').click();
    const dial=p.locator('#frequencyDial');await dial.press('Home');assert.equal(await dial.inputValue(),'0');let tuned=false;
    for(let value=0;value<=100;value++){
     await checked(p,kind+' native range '+value);
     if(await p.locator('#signalMeterFill').evaluate(el=>parseFloat(el.style.width))>=92){tuned=true;break;}
     if(value<100){await dial.press('ArrowRight');assert.equal(await dial.inputValue(),String(value+1));}
    }
    assert(tuned,'native keyboard range reaches displayed carrier');
    if(reloads)await p.evaluate(()=>{
     const text=$('signalHoldText'),button=document.querySelector('#mission1 .chapter-menu');
     if(!text||!button||window.__C1VNextPauseAt40)throw Error('Missing or duplicate bounded pause input observer');
     const control=window.__C1VNextPauseAt40={state:'watching',mutations:0,error:null,holdDispatchMs:null,pauseDispatchMs:null,
      disconnect(){observer.disconnect();if(control.state==='watching')control.state='cancelled';}};
     const reject=reason=>{observer.disconnect();control.state='failed';control.error=reason;};
     // MutationObserver delivery is after the original hold callback (including
     // recorder commit) completes. This synchronizes the requested pause input,
     // not layout settlement, and invokes the original pause/save/stop handler.
     // No source progress, timestamps, timer registrations or RAFs are changed.
     const observer=new MutationObserver(records=>{
      control.mutations+=records.length;if(control.mutations>32){reject('pause-observation-bound');return;}
      const displayed=text.textContent;
      if(displayed!=='40%'){
       if(/^\d+%$/.test(displayed)&&Number(displayed.slice(0,-1))>40)reject('missed-exact-40-percent');
       return;
      }
      observer.disconnect();
      if(__C1VNext.status().pendingCallback||__C1VNext.status().fault||signalHoldProgress!==40){reject('hold-callback-not-complete');return;}
      control.holdDispatchMs=__C1VNext.state().dispatchMs;control.state='triggered';
      button.click();
      control.pauseDispatchMs=__C1VNext.state().dispatchMs;
      if(!MKTYExperience.paused||signalHoldProgress!==40){reject('original-pause-input-not-applied');return;}
      control.state='paused';
     });
     observer.observe(text,{childList:true,characterData:true,subtree:true});
    });
    await p.locator('#tuneBtn').click();
    if(reloads){
     // The default test timeout bounds observation lifetime; finally disconnects
     // on every failure path. The observer also disconnects before clicking.
     await p.waitForFunction(()=>{
      const control=window.__C1VNextPauseAt40;
      if(control.state==='failed')throw Error(control.error);
      return control.state==='paused'&&MKTYExperience.paused;
     });
     const pauseInput=await p.evaluate(()=>({state:__C1VNextPauseAt40.state,mutations:__C1VNextPauseAt40.mutations,
      holdDispatchMs:__C1VNextPauseAt40.holdDispatchMs,pauseDispatchMs:__C1VNextPauseAt40.pauseDispatchMs,progress:signalHoldProgress}));
     assert.equal(pauseInput.progress,40,'exact 40% native hold checkpoint; no tolerance or forced progress');
     write(kind+'-hold-pause-input.json',pauseInput);
     await reloadPaused('hold',{holdProgress:40,holding:true,antennaOpen:true});
    }
    await p.waitForFunction(()=>life1Stage===3&&!$('life1Complete').hidden,{},{timeout:10000});
    await checked(p,kind+' complete');
    const final=await captureDocument(p,kind+'-complete');documents.push(final);
    const verified=R.inspect(final.wire);assert.equal(verified.ok,true);assert.equal(verified.recording.state.stage,3);assert.equal(verified.recording.state.completeVisible,true);
    assert.deepEqual(verified.recording.wire.capacity,R.DEFAULT,'ordinary completion uses unchanged default recording bounds');
    const callbackEntries=verified.recording.wire.entries.filter(entry=>entry[0]==='callback');
    const holds=callbackEntries.filter(entry=>entry[5].some(step=>step[0]==='hold'));
    const intervals=holds.slice(1).flatMap((entry,i)=>entry[1]===holds[i][1]?[entry[3]-holds[i][3]]:[]);report.nativeTimingIntervals.push({kind,intervals});
    const nativeFrames=documents.flatMap(document=>document.diagnostics.callbacks.filter(callback=>callback.frames.length));assert(nativeFrames.length>0);
    assert(nativeFrames.some(callback=>!Object.is(callback.dispatchMs,callback.frames[0][1])),'raw dispatch and supplied RAF clocks remain separately observed');
    for(const document of documents){assert.equal(document.diagnostics.firstFailure,null);assert(document.diagnostics.checks>0);assert(document.diagnostics.liveReads>0);}
    report.cases.push({kind,gatePassed:true,repairCellsBeforeReload:reloads?2:null,holdProgressBeforeReload:reloads?40:null,reloads:prefixes.length,
     originalPrefixesPreserved:true,usage:verified.recording.usage,frames:nativeFrames.length,rawClockArgumentsPreserved:true,cacheAndLiveExact:true,
     staleCacheFrames:documents.flatMap(document=>document.diagnostics.staleCacheFrames).length});
   }catch(error){try{await captureDocument(p,kind+'-failure');}catch{}throw error;}
   finally{try{if(!p.isClosed())await p.evaluate(()=>window.__C1VNextPauseAt40?.disconnect());}finally{await ctx.close();}}
  }
  await runMission(false);await runMission(true);assert.deepEqual(report.failures,[]);report.gatePassed=true;
 }catch(error){report.failures.push(error.stack||error.message);process.exitCode=1;}
 finally{
  clearTimeout(deadline);await browser?.close();if(server.listening)await new Promise(resolve=>server.close(resolve));
  write('life1-recording-vnext-browser.json',report);console.log(JSON.stringify(report));
 }
}
module.exports={main,responseFor,bundle};
if(require.main===module)main();
