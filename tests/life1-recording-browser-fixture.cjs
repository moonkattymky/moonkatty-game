'use strict';
// PREPARED ONLY in the current environment. Call main only in a later authorized
// Chromium/loopback environment. Importing this file never starts either.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const {instrument}=require('./fixtures/life1-recording-instrument.cjs');
const {bundle,nativeCheck,geometrySnapshot,installGeometryDiagnostics}=require('./fixtures/life1-recording-browser-helper.cjs');
const M=require('../prototypes/life1-capture/pr47/life1-model.js');
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
 const assert=require('node:assert/strict'),http=require('node:http'),{chromium}=require('playwright');
 const out=process.env.MKTY_TEST_OUTPUT||fs.mkdtempSync('/tmp/mkty-life1-recording-browser-');fs.mkdirSync(out,{recursive:true});
 const lane=process.env.MKTY_C1_NATIVE_LANE||'reload';
 assert(['reload','mixed-clock'].includes(lane),'known browser fixture lane');
 const report={base:'eaa09304c773129d8b06ec4c85a542e123e13450',lane,cases:[],failures:[],nativeTimingIntervals:[],limits:[],runtimeReady:false,authoritativeAdmission:false};
 const server=http.createServer((req,res)=>{const r=responseFor(req.url,req.method);res.writeHead(r.status,{'Content-Type':r.type||'text/plain','Cache-Control':'no-store'});res.end(r.body||'');});
 let browser;const deadline=setTimeout(()=>{console.error('Chapter 1 recorder browser fixture exceeded 180 seconds');process.exit(1);},180000);deadline.unref();
 try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});
  async function pageFor(seed,clocked){
   const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,reducedMotion:'reduce',serviceWorkers:'block'});
   await ctx.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
   await ctx.routeWebSocket('**/*',ws=>ws.close());const p=await ctx.newPage();p.setDefaultTimeout(8000);
   p.on('pageerror',e=>report.failures.push(e.message));await p.addInitScript({content:bundle()});
   await p.addInitScript(require('./story-finale-fixture.cjs'));
   await p.addInitScript(seed=>{localStorage.setItem('mkty_lang','en');localStorage.setItem('mkty_test_no_pacing','yes');for(const [k,v]of Object.entries(seed||{}))if(!localStorage.getItem(k))localStorage.setItem(k,v);},seed);
   if(clocked){await p.clock.install({time:new Date('2026-10-12T00:00:00Z')});await p.clock.pauseAt(new Date('2026-10-12T00:00:00Z'));}
   return {ctx,p};
  }
  async function enter(p,clocked){
   await p.goto(origin,{waitUntil:'domcontentloaded'});
   // Scoped deterministic test reset only; production Math.random is unchanged.
   await p.evaluate(context=>{const original=window.resetLife1Mission;window.resetLife1Mission=function(){const prior=Math.random;Math.random=Life1Prototype.random(Life1Prototype.challengeSeed(context));try{return original();}finally{Math.random=prior;}};},context);
   await p.locator('#enterBtn').click();if(await p.locator('#skipBtn').isVisible())await p.locator('#skipBtn').click();
   if(clocked)await p.clock.runFor(350);else await p.waitForTimeout(350);
  }
  async function checked(p,label){
   const status=await p.evaluate(()=>__C1Capture.status());
   if(status.fault&&report.geometryObservations){
    report.geometryObservations.push({label:label+' fault',snapshot:await p.evaluate(geometrySnapshot)});
    report.firstGeometryRefusal=await p.evaluate(()=>window.__C1GeometryDiagnostics?.firstRefusal||null);
   }
   assert.equal(status.fault,null,label+': '+JSON.stringify(status));
   const geometry=await p.evaluate(nativeCheck);return {label,geometry};
  }
  if(lane==='mixed-clock'){
   // Native diagnostic: never replace the supplied RAF timestamp with the
   // arrival clock, quantize either observation, or alter the controller dt.
   const native=await pageFor({},false);await enter(native.p,false);
   await native.p.evaluate(context=>{__C1Capture.armFresh(context);show('mission1');resetLife1Mission();},context);
   for(let i=0;i<3;i++){
    await native.p.waitForTimeout(35);await native.p.locator('#mission1 .chapter-menu').click();
    await native.p.waitForTimeout(25);await native.p.locator('#guideResume').click();
   }
   await native.p.waitForTimeout(100);
   const observed=await native.p.evaluate(()=>({status:__C1Capture.status(),journal:__C1Capture.clockJournal(),wire:__C1Capture.wire()}));
   assert(observed.journal.some(e=>e.frameTimestamp!==null),'native RAF observations captured');
   if(observed.status.fault)assert.equal(observed.status.fault.error,'local-time-reordered','only the characterized two-clock blocker is expected');
   fs.writeFileSync(path.join(out,'native-mixed-clock-observations.json'),JSON.stringify(observed,null,2)+'\n');
   report.cases.push({kind:'native-dispatch-and-physics-clock-diagnostic',accepted:observed.journal.length,observedRefusal:observed.status.fault,gatePassed:false});
   report.limits.push('Diagnostic only: the frozen single-time model cannot admit every legitimate dispatch/RAF ordering. An observed ordering refusal is recorded, not hidden; its absence in this bounded sample is not admission evidence.');
   await native.ctx.close();assert.deepEqual(report.failures,[]);return;
  }
  // Real new documents and original DOM/controller callbacks under an explicit
  // Playwright clock. This is not a measurement of native browser timer cadence.
  report.geometryObservations=[];
  const installDiagnostics=p=>p.evaluate(`(${installGeometryDiagnostics.toString()})(${geometrySnapshot.toString()})`);
  const observeGeometry=async(p,label)=>report.geometryObservations.push({label,snapshot:await p.evaluate(geometrySnapshot)});
  const {ctx,p}=await pageFor({},true);await enter(p,true);
  await installDiagnostics(p);await observeGeometry(p,'before armed show/reset');
  await p.evaluate(context=>{__C1Capture.armFresh(context);show('mission1');resetLife1Mission();},context);
  await observeGeometry(p,'after armed show/reset');
  await p.clock.runFor(32);await checked(p,'fresh');
  async function approach(selector){
   for(let attempts=0;attempts<150;attempts++){
    const step=await p.evaluate(selector=>{
     const target=document.querySelector(selector);if(l1DistanceTo(target)<.22)return null;
     const w=$('life1World').getBoundingClientRect(),t=target.getBoundingClientRect(),player=$('life1Player').getBoundingClientRect(),gx=(t.left+t.right)/2-w.left,gy=(t.top+t.bottom)/2-w.top,offset=player.height*.35;
     const q=[[l1PX,l1PY,[]]],visited=new Set();
     while(q.length){const [x,y,path]=q.shift();if(Math.hypot(x*w.width/100-gx,y*w.height/100-offset-gy)<Math.min(w.width,w.height)*.205)return {target:path[0],position:[l1PX,l1PY],size:[w.width,w.height]};
      for(const [dx,dy]of [[-4,0],[4,0],[0,-4],[0,4]]){const nx=x+dx,ny=y+dy,k=Math.round(nx)+','+Math.round(ny);if(nx<7||nx>90||ny<18||ny>88||visited.has(k)||life1Blocked(nx,ny)||life1Blocked(x+dx/2,y+dy/2))continue;visited.add(k);q.push([nx,ny,[...path,[nx,ny]]]);}}
     throw Error('No walkable path');
    },selector);if(!step)return;
    const dx=(step.target[0]-step.position[0])*step.size[0]/100,dy=(step.target[1]-step.position[1])*step.size[1]/100,len=Math.hypot(dx,dy),j=await p.locator('#life1Joystick').boundingBox();
    await p.mouse.move(j.x+j.width/2,j.y+j.height/2);await p.mouse.down();await p.mouse.move(j.x+j.width/2+dx/len*j.width*.31,j.y+j.height/2+dy/len*j.width*.31);
    await p.clock.runFor(Math.ceil(len/88*1000));await p.mouse.up();await p.clock.runFor(16);await checked(p,'joystick step');
   }throw Error('Joystick path not reached');
  }
  for(const id of ['1','2','3']){
   await approach('.energy.e'+id);await observeGeometry(p,'before collect '+id);
   await p.locator('.energy.e'+id).click();await observeGeometry(p,'after collect '+id+' before clock advance');
   await p.clock.runFor(32);await checked(p,'collect '+id);
  }
  await approach('#repairTerminal');await p.locator('#repairTerminal').click();await p.locator('#showRepairSequenceBtn').click();await p.clock.runFor(2100);
  const sequence=(await p.locator('#repairSequence').innerText()).trim().split(/\s+/).map(s=>s.charCodeAt(0)-65);assert.equal(sequence.length,4);
  await p.clock.runFor(550);for(const n of sequence.slice(0,2))await p.locator('[data-cell="'+n+'"]').click();
  await p.locator('#mission1 .chapter-menu').click();await checked(p,'paused repair');
  const repairPrefix=await p.evaluate(()=>__C1Capture.wire());await p.reload();await p.locator('#enterBtn').click();await p.clock.runFor(350);
  await installDiagnostics(p);
  assert.equal((await p.evaluate(()=>__C1Capture.restore())).ok,true);await checked(p,'repair hydrated');
  assert.equal(await p.evaluate(()=>repairCells),2);assert.equal(await p.evaluate(()=>MKTYExperience.paused),true);
  assert.deepEqual((await p.evaluate(()=>JSON.parse(__C1Capture.wire()).entries)).slice(0,JSON.parse(repairPrefix).entries.length),JSON.parse(repairPrefix).entries);
  await p.locator('#guideResume').click();for(const n of sequence.slice(2))await p.locator('[data-cell="'+n+'"]').click();
  await approach('#antennaHotspot');await p.locator('#antennaHotspot').click();
  // Playwright 1.58.2 fill(range) sets value and dispatches events directly.
  // Use the native keyboard range path instead, with no page-side assignment.
  const dial=p.locator('#frequencyDial');await dial.press('Home');assert.equal(await dial.inputValue(),'0');
  let tuned=false;
  for(let value=0;value<=100;value++){
   await checked(p,'keyboard antenna range '+value);
   if(await p.locator('#signalMeterFill').evaluate(e=>parseFloat(e.style.width))>=92){tuned=true;break;}
   if(value<100){await dial.press('ArrowRight');assert.equal(await dial.inputValue(),String(value+1),'native range advances exactly one step');}
  }
  assert(tuned,'native keyboard range finds the displayed carrier');
  await p.locator('#tuneBtn').click();await p.clock.runFor(1200);await p.locator('#mission1 .chapter-menu').click();await checked(p,'paused hold');
  const holdProgress=await p.evaluate(()=>signalHoldProgress);assert(holdProgress>0&&holdProgress<100);
  const seed=await p.evaluate(()=>Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('mkty_')).map(k=>[k,localStorage.getItem(k)])));
  const holdPrefix=await p.evaluate(()=>__C1Capture.wire());await p.reload();await p.locator('#enterBtn').click();await p.clock.runFor(350);
  await installDiagnostics(p);
  assert.equal((await p.evaluate(()=>__C1Capture.restore())).ok,true);await checked(p,'hold hydrated');assert.equal(await p.evaluate(()=>signalHoldProgress),holdProgress);
  assert.deepEqual((await p.evaluate(()=>JSON.parse(__C1Capture.wire()).entries)).slice(0,JSON.parse(holdPrefix).entries.length),JSON.parse(holdPrefix).entries);
  await p.clock.runFor(240);assert.equal(await p.evaluate(()=>signalHoldProgress),holdProgress);await p.locator('#guideResume').click();await p.clock.runFor(2500);
  assert.equal(await p.evaluate(()=>life1Stage),3);await checked(p,'completed after real reloads');
  report.cases.push({kind:'real-page-reload-under-virtual-clock',repairCells:2,holdProgress,originalPrefixesPreserved:true});await ctx.close();
  // Separate native callback observation lane. Movement RAF is cancelled only
  // while the recovered antenna modal blocks movement; this is not a full
  // native frame/timer interleaving or complete-play certification.
  const native=await pageFor(seed,false);await enter(native.p,false);
  await installDiagnostics(native.p);
  await native.p.evaluate(()=>{cancelAnimationFrame(l1MoveFrame);cancelAnimationFrame(window.life1MoveFrame);});
  assert.equal((await native.p.evaluate(()=>__C1Capture.restore())).ok,true);await checked(native.p,'native modal hydrated');
  await native.p.locator('#guideResume').click();await native.p.waitForFunction(()=>life1Stage===3,{},{timeout:8000});
  const wire=JSON.parse(await native.p.evaluate(()=>__C1Capture.wire())),times=wire.entries.slice(JSON.parse(holdPrefix).entries.length).filter(e=>e[0]==='event'&&e[1][0]==='hold').map(e=>e[1][1]);
  report.nativeTimingIntervals=times.slice(1).map((t,i)=>t-times[i]);assert(report.nativeTimingIntervals.length>5);await checked(native.p,'native hold completion');
  report.cases.push({kind:'native-hold-callbacks-with-modal-movement-raf-cancelled',callbacks:times.length});await native.ctx.close();
  report.limits.push('Native mixed RAF/performance.now chronology remains a separate unvalidated gate.','No physical phone, Telegram, active-unpaused recovery or authoritative admission result.');
  assert.deepEqual(report.failures,[]);
 }catch(error){report.failures.push(error.stack||error.message);process.exitCode=1;}
 finally{clearTimeout(deadline);await browser?.close();await new Promise(resolve=>server.close(resolve));fs.writeFileSync(path.join(out,'life1-recording-browser.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));}
}
module.exports={main,responseFor,bundle};
if(require.main===module)main();
