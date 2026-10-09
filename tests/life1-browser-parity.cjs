#!/usr/bin/env node
'use strict';
/* Ordinary Playwright test: importing this module is socket/browser-free. Only
 * main() starts the local random-port server and Chromium. Not run during local
 * authoring where browser/socket execution is prohibited. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {DEFAULT_ROUTE}=require('./fixtures/life1-playthrough.cjs');
const Model=require('../life1-model.js');
const Verifier=require('../server/rewards/life1-verifier.cjs');
const installAdapter=require('./fixtures/life1-browser-adapter.cjs');
const ROOT=path.resolve(__dirname,'..');
const VIEWPORTS=Object.freeze([
  {name:'compact',viewport:{width:320,height:568}},
  {name:'small',viewport:{width:360,height:640}},
  {name:'portrait',viewport:{width:390,height:844}},
  {name:'large',viewport:{width:520,height:1000}},
  // Only #app's containing width is constrained. World/obstacle/hotspot/player
  // styles remain the production styles; this is not a physical-device profile.
  {name:'fractional',viewport:{width:430,height:932},containerWidth:387.375}
]);
const RATES=Object.freeze([30,60,120]);
const MIME={'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json',
  '.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.mp4':'video/mp4','.woff2':'font/woff2'};
function localAsset(raw,method='GET') {
  if(!['GET','HEAD'].includes(method))return null;
  let name;try{name=decodeURIComponent(new URL(raw,'http://fixture.invalid').pathname);}catch{return null;}
  if(name==='/')name='/index.html';
  if(name.split('/').some(part=>part.startsWith('.'))||!MIME[path.extname(name)])return null;
  const file=path.resolve(ROOT,'.'+name);
  if(!file.startsWith(ROOT+path.sep))return null;
  // Tests and server source are not served; the model is injected by Playwright.
  if(/^\/(tests|server|tools|docs|supabase|node_modules)\//.test(name)||['/life1-model.js','/life1-native-geometry.js'].includes(name))return null;
  return file;
}
function allowedRequest(url,method,origin) {
  let parsed;try{parsed=new URL(url);}catch{return false;}
  return parsed.origin===origin&&!!localAsset(url,method);
}
// Preserve every obstacle edge in CI's bounded log tail. These are observations,
// not input to the model. Source/candidate geometry must remain independent.
function summarizeFailure(entry,browserVersion) {
  const failure=entry.adapter?.failure,v=failure?.browser,g=failure?.model?.geometry,w=v?.world;
  return {scenario:entry.name,browserVersion,config:entry.config,error:entry.error?.message,event:failure?.event,
    modelPosition:failure?.model&&[failure.model.x,failure.model.y],browserPosition:v&&[v.x,v.y],
    world:w,dimensions:v&&{cached:[v.geometry.width,v.geometry.height],live:[w.width,w.height]},
    obstacles:v?.obstacles?.slice(0,3).map((raw,i)=>({i,raw,model:g?.obstacles[i],cached:v.geometry.obstacles[i],
      native:{left:(raw.left+3-w.left)/w.width*100,right:(raw.right-3-w.left)/w.width*100,
        top:(raw.top+raw.height*.36-w.top)/w.height*100,bottom:(raw.bottom-2-w.top)/w.height*100}})),
    nativeDetails:failure?.nativeDetails,player:v?.player,spots:v?.spots,proximity:entry.adapter?.probes?.filter(p=>p.kind==='strict-proximity'),
    boundary:entry.adapter?.probes?.find(p=>p.kind==='strict-collision'?p.candidate!==p.browser:p.candidateReach!==p.browserReach),
    animation:entry.afterAnimation&&{atEntry:entry.atEntry,afterAnimation:entry.afterAnimation,passiveSamples:entry.passiveAnimationSamples},pageErrors:entry.pageErrors.slice(0,2)};
}
async function main() {
  const {chromium}=require('playwright');
  const output=process.env.MKTY_TEST_OUTPUT||fs.mkdtempSync('/tmp/mkty-life1-browser-');fs.mkdirSync(output,{recursive:true});
  const report={suite:'life1-browser-parity',profile:Model.NATIVE_PROFILE,browserExecution:'started',clock:'Playwright virtual clock + explicit Chapter 1 frames',
    physicalDeviceCoverage:false,productionFilesModified:false,scenarios:[],blockedRequests:[],failed:0};
  let browser;
  const server=http.createServer((req,res)=>{
    const file=localAsset(req.url,req.method);
    if(!file){res.writeHead(403);res.end();return;}
    fs.readFile(file,(error,bytes)=>{res.writeHead(error?404:200,{'Content-Type':MIME[path.extname(file)],'Cache-Control':'no-store'});res.end(req.method==='HEAD'||error?'':bytes);});
  });
  const save=()=>fs.writeFileSync(path.join(output,'life1-browser-parity.json'),JSON.stringify(report,null,2));
  async function scenario(name,config,body,{ordinaryMotion=false}={}) {
    const entry={name,config,passed:false,pageErrors:[]};report.scenarios.push(entry);let context,page;
    try {
      context=await browser.newContext({viewport:config.viewport,deviceScaleFactor:1,hasTouch:false,
        reducedMotion:ordinaryMotion?'no-preference':'reduce',serviceWorkers:'block'});
      page=await context.newPage();page.setDefaultTimeout(6000);
      page.on('pageerror',error=>entry.pageErrors.push(error.message));
      await page.route('**/*',route=>{
        const request=route.request();
        if(allowedRequest(request.url(),request.method(),report.origin))return route.continue();
        const url=new URL(request.url());report.blockedRequests.push({scenario:name,origin:url.origin,path:url.pathname,method:request.method()});
        return route.abort('blockedbyclient');
      });
      await page.routeWebSocket('**/*',socket=>socket.close());
      const start=new Date('2026-10-04T08:00:00.000Z');
      await page.clock.install({time:new Date(start.getTime()-1000)});await page.clock.pauseAt(start);
      await page.addInitScript(require('./story-finale-fixture.cjs'));
      await page.addInitScript(()=>{localStorage.setItem('mkty_test_no_pacing','yes');localStorage.setItem('mkty_lang','en');});
      await page.goto(report.origin+'/',{waitUntil:'load',timeout:30000});
      await page.evaluate(async fixture=>{
        await document.fonts.ready;
        if(fixture.containerWidth)document.getElementById('app').style.width=fixture.containerWidth+'px';
        if(fixture.worldSize){const world=document.getElementById('life1World');Object.assign(world.style,{width:fixture.worldSize+'px',height:fixture.worldSize+'px',minHeight:'0px',flex:'none'});}
        // Seeded prerequisite records isolate the finale, just as first-three.cjs.
        // show() is screen-only entry; no checkpoint restore/reset is asserted.
        show('mission1');cancelAnimationFrame(l1MoveFrame);
        // app.js's initial registration uses a legacy second handle name. Both
        // queued registrations must be cancelled before controlled frames begin.
        if(typeof life1MoveFrame!=='undefined')cancelAnimationFrame(life1MoveFrame);
        await Promise.all([...document.querySelectorAll('link[rel="stylesheet"][href]')].map(link=>link.sheet?null:new Promise((resolve,reject)=>{link.addEventListener('load',resolve,{once:true});link.addEventListener('error',reject,{once:true});})));
      },{containerWidth:config.containerWidth||null,worldSize:config.worldSize||null});
      if(ordinaryMotion) {
        await body(page,entry); // Dedicated observation, no forced refresh/adaptor.
      } else {
        await page.addScriptTag({path:path.join(ROOT,'life1-native-geometry.js')});
        await page.addScriptTag({path:path.join(ROOT,'life1-model.js')});
        entry.initial=await page.evaluate(installAdapter,{route:{...DEFAULT_ROUTE,seed:config.seed??571,life1_profile:Model.NATIVE_PROFILE}});
        await settle(page);
        await body(page,entry);
        await settle(page);await page.evaluate(()=>window.__life1Parity.check());
        const recorded=await page.evaluate(()=>{const state=window.__life1Parity.snapshot().model;return {state,report:window.__life1Parity.report()};});
        entry.adapter=recorded.report;
        if(entry.complete){
          // All observed full-quest events are verified, with no filtering of
          // unknown observations, no supplied checkpoint and no state shortcut.
          const a=entry.adapter,proof={version:a.profile.version,route:a.route.route,challenge:Model.routeKey(a.route),rules:a.profile.rules,layout:a.profile.layout,initial:a.initial,events:a.events};
          const verified=Verifier.verifyLife1(a.route,JSON.stringify(proof));
          assert.equal(verified.ok,true,'Native recorded quest must pass pure verifier: '+verified.error);
          assert.equal(verified.complete,true);assert.deepEqual(verified.state,recorded.state);
          entry.verifiedReplay={complete:verified.complete,work:verified.work};
        }
        assert.equal(entry.adapter.failure,null,'Recorded asynchronous divergence');assert.equal(entry.adapter.pendingLayout,null,'Final layout must settle');
      }
      assert.deepEqual(entry.pageErrors,[],'Unhandled application/browser adapter errors');entry.passed=true;
    } catch(error) {
      entry.error={message:error.message,stack:error.stack};report.failed++;
      if(page){
        entry.adapter=await page.evaluate(()=>window.__life1Parity?.report()).catch(()=>null);
        await page.screenshot({path:path.join(output,name+'.png'),fullPage:true,timeout:5000}).catch(()=>{});
      }
    } finally {await context?.close();save();console.log(`${entry.passed?'PASS':'FAIL'} ${name}${entry.error?': '+entry.error.message:''}`);}
  }
  const framePlans=new WeakMap();
  const settle=page=>page.waitForFunction(()=>window.__life1Parity.layoutSettled(),null,{polling:50,timeout:6000});
  const action=async(page,op,...args)=>{framePlans.delete(page);const result=await page.evaluate(({op,args})=>window.__life1Parity.act(op,...args),{op,args});await settle(page);return result;};
  const snap=page=>page.evaluate(()=>window.__life1Parity.snapshot());
  async function advanceTo(page,target) {
    const now=await page.evaluate(()=>performance.now()),delta=Math.ceil(target)-now;
    assert(delta>=0,'Explicit timeline moved behind Playwright clock');if(delta)await page.clock.runFor(delta);
  }
  async function frame(page,ms,axes) {
    // Playwright 1.58 rounds runFor endpoints UP to integer milliseconds. Drive
    // the clock to ceil(absolute target), then pass the unrounded target to the
    // real controller. Never accumulate ceil(1000 / Hz) into 34/17/9ms frames.
    const now=await page.evaluate(()=>({clock:performance.now(),model:window.__life1Parity.snapshot().model.now}));
    const prior=framePlans.get(page),base=prior!=null&&now.clock<=Math.ceil(prior)&&now.model<=prior?prior:now.clock;
    const target=base+ms;framePlans.set(page,target);await advanceTo(page,target);
    return page.evaluate(({axes,target})=>window.__life1Parity.frame(axes,target),{axes,target});
  }
  async function navigate(page,id) {
    await settle(page);await frame(page,1,[0,0]);
    // Replan after every earned interaction/observed resize. The model supplies
    // candidate geometry, never oracle rectangles or expected source positions.
    const path=await page.evaluate(id=>{
      const M=window.Life1Prototype,s=window.__life1Parity.snapshot().model;
      const start={x:s.x,y:s.y,gx:0,gy:0,parent:null},queue=[start],seen=new Set(['0,0']);let goal;
      for(let i=0;i<queue.length;i++){
        const p=queue[i];if(M.distance({...s,x:p.x,y:p.y},id)<.21){goal=p;break;}
        for(const [dx,dy]of [[-1,0],[1,0],[0,-1],[0,1]]){
          const gx=p.gx+dx,gy=p.gy+dy,x=s.x+gx,y=s.y+gy,key=`${gx},${gy}`;
          if(x<7||x>90||y<18||y>88||seen.has(key)||M.blocked(s,x,y))continue;
          seen.add(key);queue.push({x,y,gx,gy,parent:p});
        }
        if(queue.length>10000)throw Error('Navigation search budget exceeded');
      }
      if(!goal)throw Error('No candidate path to '+id);
      const path=[];while(goal.parent){path.push({x:goal.x,y:goal.y});goal=goal.parent;}return path.reverse();
    },id);
    for(const point of path){
      const s=(await snap(page)).model,dx=(point.x-s.x)*s.geometry.width/100,dy=(point.y-s.y)*s.geometry.height/100;
      const distance=Math.hypot(dx,dy);if(distance<1e-9)continue;
      const parts=Math.ceil(distance/3.4);for(let n=0;n<parts;n++)await frame(page,distance/parts/88*1000,[dx/distance,dy/distance]);
    }
    const distance=await page.evaluate(id=>window.Life1Prototype.distance(window.__life1Parity.snapshot().model,id),id);
    assert(distance<.24,'Candidate navigation must genuinely reach '+id);
  }
  async function earnRepair(page) {
    for(const id of ['1','2','3']){
      await navigate(page,id);
      if(id==='1'){
        // Real movement triggers the ordinary nearby refresh; no class or
        // transform is forced by the fixture. Probe the native 1.08 state.
        await frame(page,100,[.1,0]);await action(page,'stop');
        assert.equal((await snap(page)).browser.near,'1','first target is genuinely nearby');
        await page.evaluate(()=>window.__life1Parity.strictProbes());
      }
      await action(page,'collect',id);
      if(id==='1')await page.evaluate(()=>window.__life1Parity.strictProbes()); // native collected .25 state
    }
    await navigate(page,'repair');await action(page,'open','repair');
  }
  async function joystick(page,hz,entry) {
    await page.locator('#life1Joystick').scrollIntoViewIfNeeded();
    const b=await page.locator('#life1Joystick').boundingBox();assert(b&&b.width>0);
    const center={x:b.x+b.width/2,y:b.y+b.height/2},radius=b.width*.31;
    await page.mouse.move(center.x,center.y);await page.mouse.down();
    await page.mouse.move(center.x+4,center.y);
    let s=await snap(page);assert.equal(s.browser.moveX,0,'Real joystick 4px dead zone');assert.equal(s.browser.moveY,0);
    await frame(page,1000/hz);
    const dx=radius*.6,dy=-radius*.6;
    await page.mouse.move(center.x+dx,center.y+dy);
    s=await snap(page);assert.equal(s.lastPointer.trusted,true,'Browser dispatched a trusted pointer event');
    const actualX=s.lastPointer.clientX-s.lastPointer.centerX,actualY=s.lastPointer.clientY-s.lastPointer.centerY;
    const length=Math.hypot(actualX,actualY),strength=Math.min(1,(length-5)/(radius-5));
    // Independent pointer-to-axis check, then use the observed vector for replay.
    assert(Math.abs(s.browser.moveX-actualX/length*strength)<1e-4,'Native pointer X axis mapping');
    assert(Math.abs(s.browser.moveY-actualY/length*strength)<1e-4,'Native pointer Y axis mapping');
    entry.pointer={rectangle:b,requestedDelta:[dx,dy],pointerEvent:s.lastPointer,observedAxes:[s.browser.moveX,s.browser.moveY]};
    for(let i=0;i<8;i++)await frame(page,1000/hz);
    // Release outside the pad exercises pointer capture, without forced clicks.
    await page.mouse.move(center.x+radius*2,center.y);await page.mouse.up();
    await page.evaluate(()=>window.__life1Parity.observedStop('native mouseup outside joystick'));
    for(let i=0;i<3;i++)await frame(page,1000/hz);
  }
  async function resize(page,config) {
    const previous=await page.evaluate(()=>({width:l1Geometry.width,height:l1Geometry.height}));
    await page.setViewportSize({width:config.viewport.width<=360?520:320,height:config.viewport.height<=640?1000:568});
    await page.waitForFunction(previous=>{
      const w=document.getElementById('life1World').getBoundingClientRect();
      return (Math.abs(w.width-previous.width)>.1||Math.abs(w.height-previous.height)>.1)&&Math.abs(l1Geometry.width-w.width)<.001&&Math.abs(l1Geometry.height-w.height)<.001;
    },previous,{polling:50,timeout:6000});
    await page.evaluate(()=>window.__life1Parity.layout('real viewport resize + native ResizeObserver'));
  }
  try {
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
    report.origin='http://127.0.0.1:'+server.address().port;
    browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
    report.browserVersion=browser.version();assert.equal(report.browserVersion,'145.0.7632.6','Native profile requires its reviewed browser engine');
    for(const config of VIEWPORTS)for(const hz of RATES)await scenario(`${config.name}-${hz}hz`,{...config,hz},async(page,entry)=>{
      await frame(page,0,[0,0]);
      for(const [axes,count] of [[[1,0],30],[[0,-1],30],[[-1,-1],12],[[0,1],12],[[.08,0],2],[[.0800001,0],2]])
        for(let i=0;i<count;i++)await frame(page,1000/hz,axes);
      await frame(page,1000,[1,1]); // A long gap still caps movement dt at 40ms.
      await action(page,'stop');await joystick(page,hz,entry);await resize(page,config);
      await frame(page,1000/hz,[-1,1]);
    });
    // Keep strict boundary failures separate, so a legitimate quantization
    // discrepancy does not prevent the movement/timer matrix from running.
    for(const config of VIEWPORTS)await scenario(`${config.name}-strict-boundaries`,config,async page=>{
      await page.evaluate(()=>window.__life1Parity.strictProbes());
    });
    // Deliberately constrained containing blocks exercise reset ordering, not
    // phone layouts. All object CSS and the real reset remain unchanged.
    for(const [size,target] of [[200,'2'],[64,'1']])await scenario(`reset-nearby-${size}`,{viewport:{width:390,height:844},worldSize:size},async page=>{
      let current=await snap(page);assert.equal(current.model.near,target);assert.equal(current.browser.near,target);
      assert.equal(current.model.highlightedNear,null);assert.deepEqual(current.browser.highlighted,[]);
      await frame(page,100,[.1,0]);current=await snap(page);
      assert.equal(current.model.near,target);assert.equal(current.model.highlightedNear,null);
      assert.deepEqual(current.browser.highlighted,[],'same logical target does not restore a cleared visual class');
    });
    for(const [i,config] of [VIEWPORTS[0],VIEWPORTS[2],VIEWPORTS[4]].entries())await scenario(`${config.name}-full-quest`,{...config,seed:[0,571,0xffffffff][i]},async(page,entry)=>{
      await earnRepair(page);const s=await snap(page);
      for(const cell of s.browser.sequence)await action(page,'cell',cell);
      await navigate(page,'antenna');await action(page,'open','antenna');
      await action(page,'dial',s.browser.frequency);await action(page,'tune');
      for(let tick=0;tick<24;tick++)await page.clock.runFor(120);
      assert.equal((await snap(page)).browser.stage,2);assert.equal((await snap(page)).browser.holdProgress,96);
      await page.clock.runFor(120);
      assert.equal((await snap(page)).browser.stage,3);assert.equal((await snap(page)).browser.holdProgress,100);
      await page.clock.runFor(250);assert.equal((await snap(page)).browser.completeVisible,false);
      await action(page,'pause',true);await page.clock.runFor(400);assert.equal((await snap(page)).browser.completeVisible,false);
      await action(page,'pause',false);await page.clock.runFor(50);assert.equal((await snap(page)).browser.completeVisible,true);
      await frame(page,1000,[1,1]);entry.complete=true;
    });
    await scenario('puzzles-and-lifecycle',VIEWPORTS[2],async page=>{
      await earnRepair(page);
      let s=await snap(page);await action(page,'cell',(s.browser.sequence[0]+1)%3);assert.equal((await snap(page)).browser.repairCells,0);
      await action(page,'show');await page.clock.runFor(650);await action(page,'hidden',true);
      const prefix=(await snap(page)).model.showIndex;await page.clock.runFor(400);assert.equal((await snap(page)).model.showIndex,prefix);
      await action(page,'hidden',false);assert.equal((await snap(page)).browser.paused,true);
      await action(page,'pause',false);await action(page,'close','repair');await action(page,'open','repair');
      await action(page,'show');await action(page,'leave');await page.clock.runFor(1000);await action(page,'screen-enter');
      assert.equal((await snap(page)).browser.repairDisabled,true);
      s=await snap(page);await action(page,'cell',s.browser.sequence[0]);assert.equal((await snap(page)).browser.repairCells,0);
      await action(page,'show');await page.clock.runFor(2600);assert.equal((await snap(page)).browser.repairDisabled,false);
      s=await snap(page);for(const cell of s.browser.sequence)await action(page,'cell',cell);
      await navigate(page,'antenna');await action(page,'open','antenna');
      s=await snap(page);const target=s.browser.frequency;
      await action(page,'dial',target+4);await action(page,'tune');assert.equal((await snap(page)).browser.holding,false);
      await action(page,'dial',target+3);await action(page,'tune');await page.clock.runFor(120);assert.equal((await snap(page)).browser.holdProgress,4);
      await action(page,'dial',target+4);assert.equal((await snap(page)).browser.holdProgress,0);
      await action(page,'dial',target);await action(page,'tune');await page.clock.runFor(120);await action(page,'close','antenna');
      await action(page,'open','antenna');await action(page,'tune');await action(page,'hidden',true);await page.clock.runFor(360);
      assert.equal((await snap(page)).browser.holdProgress,0);await action(page,'hidden',false);await page.clock.runFor(120);
      assert.equal((await snap(page)).browser.holdProgress,0);await action(page,'pause',false);
      await page.evaluate(()=>window.__life1Parity.pagehide());
      await page.clock.runFor(24*120);assert.equal((await snap(page)).browser.holdProgress,96);
      await page.clock.runFor(120);assert.equal((await snap(page)).browser.stage,3);
      await action(page,'leave');await page.clock.runFor(1000);await action(page,'screen-enter');
      assert.equal((await snap(page)).browser.completeVisible,false);await page.clock.runFor(1000);assert.equal((await snap(page)).browser.completeVisible,false);
    });
    await scenario('ordinary-motion-entry-cache',VIEWPORTS[2],async(page,entry)=>{
      const measure=()=>page.evaluate(()=>({cached:{...l1Geometry},world:JSON.parse(JSON.stringify($('life1World').getBoundingClientRect())),transform:getComputedStyle($('mission1')).transform}));
      entry.atEntry=await measure();
      // CSS animation uses the browser rendering timeline, not a fabricated
      // transform or manually refreshed cache. This is an ordinary-motion gate.
      await page.waitForFunction(()=>getComputedStyle(document.getElementById('mission1')).transform==='none',null,{polling:50,timeout:6000});
      entry.afterAnimation=await measure();
      // Diagnostics only: preserve the immediate assertion below, but also
      // observe four later real rendering opportunities. Playwright's Node-side
      // delay does not advance/rewrite the page's frozen virtual clock, call the
      // production refresh, or rely on its cancelled Chapter 1 animation frame.
      entry.passiveAnimationSamples=[];
      for(let i=0;i<4;i++){await page.waitForTimeout(50);entry.passiveAnimationSamples.push(await measure());}
      assert(Math.abs(entry.afterAnimation.cached.width-entry.afterAnimation.world.width)<=1/16,'Entry animation left cached width stale');
      assert(Math.abs(entry.afterAnimation.cached.height-entry.afterAnimation.world.height)<=1/16,'Entry animation left cached height stale');
    },{ordinaryMotion:true});
    report.browserExecution='finished';save();
    // One bounded row per failed scenario, including the ordinary-motion case.
    // The previous first-three/first-probe sample hid its cache measurements and
    // made it impossible to derive all independent native collision boundaries.
    for(const entry of report.scenarios.filter(s=>!s.passed))
      console.error('PARITY_FAILURE '+JSON.stringify(summarizeFailure(entry,report.browserVersion)));
    assert.equal(report.failed,0,`${report.failed}/${report.scenarios.length} browser parity scenarios failed; report: ${output}`);
    console.log(JSON.stringify({suite:report.suite,passed:report.scenarios.length,output}));
  } finally {await browser?.close();await new Promise(resolve=>server.close(resolve));save();}
}
module.exports={VIEWPORTS,RATES,localAsset,allowedRequest,summarizeFailure,main};
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
