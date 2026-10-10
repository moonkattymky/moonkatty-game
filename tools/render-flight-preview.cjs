#!/usr/bin/env node
/* GitHub Actions only. Adapted from render-crew-preview.cjs. Serves the two actual
   source trees without replacing controllers, renderers, rules, or local scripts.
   Only initial local fixtures, the clock, and optional-module network timing vary.
   Usage in CI: node tools/render-flight-preview.cjs --before=/absolute/PR54 --out=/absolute/output */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
// Keep this before requiring Playwright or constructing a server: local browser and
// listener execution are deliberately unavailable, including accidental invocations.
assert.equal(process.env.GITHUB_ACTIONS,'true','Browser/listener execution is restricted to the approved GitHub Actions workflow');
const {execFileSync}=require('node:child_process'),{setTimeout:delay}=require('node:timers/promises');
const {chromium}=require('playwright'),R=require('../field-model.js'),assertReachable=require('../tests/field-control-helper.cjs');
const BASE='c52df881d4a256dd962073d3eba1298aa1327095',TREE='955e4417b8d658efdb3fa538b8f9a3d9d76d44e6',MARKER='launch-window-rebuilt-v1';
const args=process.argv.slice(2),get=k=>args.find(a=>a.startsWith('--'+k+'='))?.slice(k.length+3);
const after=path.resolve(__dirname,'..'),beforeArg=get('before'),out=path.resolve(get('out')||'/tmp/moonkatty-flight-preview');
assert(beforeArg,'--before must identify the exact PR54 checkout');
const before=path.resolve(beforeArg),git=(cwd,...a)=>execFileSync('git',a,{cwd,encoding:'utf8'}).trim();
assert.equal(git(before,'rev-parse','HEAD'),BASE,'baseline is the exact reviewed PR54 commit');
assert.equal(git(before,'rev-parse','HEAD^{tree}'),TREE,'baseline is the exact reviewed PR54 tree');
assert.equal(git(before,'status','--porcelain'),'','baseline checkout has no source changes');
assert.deepEqual(fs.readFileSync(path.join(before,'field-model.js')),fs.readFileSync(path.join(after,'field-model.js')),'both real controllers use the identical FieldRules model');
fs.mkdirSync(out,{recursive:true});
const variants=[['before',before],['after',after]],views=[[390,844],[320,568]],languages=['ru','en','ar'];
const report={baseline:BASE,baselineTree:TREE,renderer:MARKER,
 purpose:'Real Chapter 3 gameplay, 48 source-comparison screenshots, and optional-module lifecycle checks. No deployment or authenticated traffic.',
 semantics:'Actual MKTYStory.menu entry followed by native Start, Resume, range keyboard input, Execute, Pause, Escape, Exit, checkpoint Resume, and Complete. Every gameplay input is checked against the unchanged FieldRules model. The application and optional module load from the real source files; no renderer/controller/rules substitution.',
 limits:'Chromium portrait emulation, not physical-device, Telegram-client, GPU, or human-playtime certification. Pure source-render resource limits are checked separately by flight-scene.cjs.',
 screenshots:[],checks:[],geometry:[],navigation:[],graphics:[],transitions:[],lifecycle:[],failures:[],externalRequestsBlocked:0,
 network:{method:'Actual BrowserContext request, response, requestfinished and requestfailed events. Sizes are response.body() decoded-body bytes measured only after requestfinished, excluding headers and transport overhead. The CI source server sends Cache-Control: no-store with no Content-Encoding; these are uncompressed CI response bytes, not production transfer estimates. Actual repeated responses remain counted and summed. The separately reported deduplicated cold image union is comparable to the source-suite unique-asset cap and is not a total download count. External responses are intercepted by the preview isolation policy and counted separately.',contexts:[]}};
const MONITORED=['field-art.js','field-art-loader.js','art-scenes/trajectory.js','art/launch-bridge-v3.webp','art/life6-orbit-v2.webp','moonkatty-life4-ship.webp'];
const COLD_IMAGES=MONITORED.slice(3),networkByContext=new WeakMap(),networkByPage=new WeakMap();
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.json':'application/json','.mp4':'video/mp4'};
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://localhost'),m=u.pathname.match(/^\/(before|after)(\/.*)?$/),variant=variants.find(v=>v[0]===m?.[1]);
 if(!variant){res.writeHead(404);return res.end();}
 let rel;try{rel=decodeURIComponent(m[2]||'/');}catch{res.writeHead(400);return res.end();}
 const file=path.resolve(variant[1],'.'+(rel==='/'?'/index.html':rel));
 if(file!==variant[1]&&!file.startsWith(variant[1]+path.sep)){res.writeHead(403);return res.end();}
 fs.readFile(file,(e,b)=>{res.writeHead(e?404:200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(e?'':b);});
});
const check=(ok,message)=>{assert(ok,message);report.checks.push(message);};
const snap=p=>p.evaluate(()=>MKTYField.snapshot());
const marker=p=>p.locator('#fieldWorld>svg').getAttribute('data-renderer');
const moduleStatus=p=>p.evaluate(()=>MKTYFieldArtModules.status(3));
let browser,origin;
// Driver-side polling still works while the in-page gameplay clock is frozen.
async function until(read,predicate,message){
 const end=performance.now()+10000;let value;
 do{value=await read();if(predicate(value))return value;await delay(25);}while(performance.now()<end);
 assert.fail(message+'; last value: '+JSON.stringify(value));
}
// Cleanup cannot replace the original assertion or prevent writing its report.
// Promise.race also observes a late rejection after the bounded wait expires.
async function cleanup(label,work){
 try{const finished=await Promise.race([Promise.resolve().then(work).then(()=>true),delay(3000,false,{ref:false})]);
  if(!finished)report.failures.push(label+': cleanup exceeded 3 seconds');
 }catch(e){report.failures.push(label+': cleanup failed: '+e.stack);}
}
function measureNetwork(ctx,variant,lang,view){
 const data={id:report.network.contexts.length+1,variant,lang,width:view[0],height:view[1],
  attempted:0,localAttempted:0,externalIntercepted:0,responses:0,httpFailedResponses:0,finished:0,transportFailed:0,byResourceType:{},statusCounts:{},resources:[]};
 const m={data,phase:'initial-load',entries:0,records:new Map(),pending:new Set()};
 report.network.contexts.push(data);networkByContext.set(ctx,m);
 ctx.on('request',request=>{
  data.attempted++;const u=new URL(request.url()),local=u.origin===origin&&u.pathname.startsWith('/'+variant+'/');
  if(local)data.localAttempted++;else data.externalIntercepted++;
  const kind=request.resourceType();data.byResourceType[kind]=(data.byResourceType[kind]||0)+1;
  const resource=local?u.pathname.slice(variant.length+2):null;
  if(MONITORED.includes(resource)){
   const record={resource,url:request.url(),phase:m.phase,resourceType:kind,responseStatus:null,finished:false,transportFailure:null,decodedBodyBytes:null};
   m.records.set(request,record);data.resources.push(record);
  }
 });
 ctx.on('response',response=>{
  data.responses++;const status=response.status();data.statusCounts[status]=(data.statusCounts[status]||0)+1;
  if(status>=400)data.httpFailedResponses++;
  const record=m.records.get(response.request());if(record)record.responseStatus=status;
 });
 ctx.on('requestfinished',request=>{
  data.finished++;const record=m.records.get(request);if(!record)return;
  record.finished=true;
  const read=(async()=>{try{
   const response=await request.response();if(!response){record.sizeUnavailable='No response object';return;}
   record.decodedBodyBytes=(await response.body()).byteLength;
  }catch(e){record.sizeUnavailable=e.message;}})();
  m.pending.add(read);read.then(()=>m.pending.delete(read));
 });
 ctx.on('requestfailed',request=>{
  data.transportFailed++;const record=m.records.get(request);
  if(record)record.transportFailure=request.failure()?.errorText||'Unknown transport failure';
 });
 return m;
}
function resourceCounts(records,resource){
 const rows=records.filter(r=>r.resource===resource),successful=rows.filter(r=>r.finished&&r.responseStatus>=200&&r.responseStatus<300),sizes=[...new Set(successful.filter(r=>r.decodedBodyBytes!==null).map(r=>r.decodedBodyBytes))].sort((a,b)=>a-b);
 return{resource,attempted:rows.length,responses:rows.filter(r=>r.responseStatus!==null).length,
  httpFailedResponses:rows.filter(r=>r.responseStatus>=400).length,transportFailed:rows.filter(r=>r.transportFailure!==null).length,
  finished:rows.filter(r=>r.finished).length,successfulFinished:successful.length,
  measuredCompletedResponses:rows.filter(r=>r.decodedBodyBytes!==null).length,
  completedResponseBodyBytes:rows.filter(r=>r.decodedBodyBytes!==null).reduce((sum,r)=>sum+r.decodedBodyBytes,0),successfulBodySizeVariants:sizes};
}
function finalizeNetwork(){
 for(const context of report.network.contexts){
  context.monitoredResources=MONITORED.map(resource=>resourceCounts(context.resources,resource));
  const cold=context.resources.filter(r=>['initial-load','cold-chapter3-transition'].includes(r.phase)),members=COLD_IMAGES.map(resource=>resourceCounts(cold,resource));
  const observed=members.filter(r=>r.successfulFinished>0),measured=observed.every(r=>r.successfulBodySizeVariants.length===1&&cold.filter(x=>x.resource===r.resource&&x.finished&&x.responseStatus>=200&&x.responseStatus<300).every(x=>x.decodedBodyBytes!==null));
  context.coldTransitionImageUnion={scope:'Initial document load through first Chapter 3 scene capture, or first Chapter 3 entry in a lifecycle case. Only observed successful members contribute, each distinct resource once; failed and unrequested members remain explicit.',members,
   observedSuccessfulMembers:observed.length,allThreeObserved:observed.length===COLD_IMAGES.length,allSuccessfulSizesMeasured:measured,
   distinctDecodedBodyBytes:measured?observed.reduce((sum,r)=>sum+r.successfulBodySizeVariants[0],0):null};
 }
 const contexts=report.network.contexts,records=contexts.flatMap(c=>c.resources);
 report.network.summary={contexts:contexts.length,...Object.fromEntries(['attempted','localAttempted','externalIntercepted','responses','httpFailedResponses','finished','transportFailed'].map(k=>[k,contexts.reduce((sum,c)=>sum+c[k],0)])),
  monitoredResources:MONITORED.map(resource=>resourceCounts(records,resource))};
}
async function closeContext(ctx,label){
 const m=networkByContext.get(ctx);
 if(m)await cleanup(label+'/response sizes',()=>Promise.all([...m.pending]));
 await cleanup(label+'/context',()=>ctx.close());
}
async function pageFor(variant,lang,view){
 const ctx=await browser.newContext({viewport:{width:view[0],height:view[1]},deviceScaleFactor:1,hasTouch:true,reducedMotion:'reduce',locale:lang,serviceWorkers:'block'});
 const measurement=measureNetwork(ctx,variant,lang,view);
 await ctx.route('**/*',route=>{
  const u=new URL(route.request().url());
  if(u.origin===origin&&u.pathname.startsWith('/'+variant+'/'))return route.continue();
  report.externalRequestsBlocked++;
  return route.fulfill({status:200,contentType:u.pathname.endsWith('.js')?'application/javascript':'application/json',body:u.pathname.endsWith('.js')?'':'{"ok":false,"preview":true}'});
 });
 const p=await ctx.newPage();networkByPage.set(p,measurement);p.setDefaultTimeout(10000);
 p.on('pageerror',e=>report.failures.push(`${variant}/${lang}/${view}: ${e.message}`));
 await p.addInitScript(lang=>{localStorage.setItem('mkty_lang',lang);localStorage.setItem('mkty_test_no_pacing','yes');localStorage.setItem('mkty_life1_code_presented','yes');localStorage.setItem('mkty_life3_memory_verified','yes');},lang);
 await p.clock.install({time:new Date('2026-10-10T06:59:00Z')});await p.clock.pauseAt(new Date('2026-10-10T07:00:00Z'));
 await p.goto(origin+'/'+variant+'/',{waitUntil:'load'});
 await until(()=>p.evaluate(()=>!!(window.MKTYStory&&window.MKTYField&&window.MKTYI18n)),Boolean,'actual application ready');
 await p.evaluate(l=>setLang(l),lang);
 await until(()=>p.evaluate(l=>MKTYI18n.getLanguage()===l&&(l==='en'||!!window.MKTYLocales?.[l]),lang),Boolean,'requested runtime locale ready');
 // Initial isolated campaign records only. Subsequent checkpoints and completion
 // are written exclusively by the production controller and story callbacks.
 await p.evaluate(()=>{for(const n of [3,4])localStorage.setItem('mkty_story_plan_'+n+'_v1',JSON.stringify(StoryPlan.fresh(n,401,2)));show('chapters');});
 return {ctx,p};
}
async function enter(p,n=3,{resume=true,ready=false}={}){
 const measurement=networkByPage.get(p);
 if(measurement)measurement.phase=n===3&&measurement.entries++===0?'cold-chapter3-transition':'chapter-'+n+'-reentry';
 await p.evaluate(n=>{MKTYStory.menu(n);document.getElementById('app').scrollTop=0;},n);
 await p.locator('#storyNext').click();
 check((await snap(p)).n===n,'actual Chapter '+n+' controller opened from its story plan');
 check((await snap(p)).stage===0,'fixture enters the actual first field stage');
 check(!await p.locator('#legacyDialog').isVisible(),'Chapter '+n+' stage 0 has no legacy decision dialog');
 check(await p.locator('#fieldDialog').isVisible(),'actual field briefing opens before Resume');
 if(ready){await until(()=>moduleStatus(p),s=>s==='ready','optional trajectory module ready');await until(()=>marker(p),s=>s===MARKER,'rebuilt trajectory mounted behind briefing');}
 if(resume)await p.locator('#fieldResume').click();
}
async function exitToPlan(p){
 if(!await p.locator('#fieldDialog').isVisible())await p.locator('#fieldPause').click();
 await p.locator('#fieldExit').click();
 check(await p.locator('#storyPlan').isVisible(),'native Exit returns to the story plan');
}
async function step(p,label,name,value,perform){
 const previous=await snap(p),expected=structuredClone(previous);
 expected.trace??=[];expected.trace.push(['act',name,value??null]);const accepted=R.act(expected,name,value);
 await perform();const actual=await snap(p);
 assert.deepEqual(actual,expected,label+' native '+name+' transition matches unchanged FieldRules exactly');
 report.transitions.push({label,action:name,value:value??null,accepted,burn:actual.burn,angle:actual.angle,power:actual.power,trim:actual.trim,moves:actual.moves,errors:actual.errors,notice:actual.notice,complete:actual.complete});
 return actual;
}
async function range(p,label,key,target,verifyReachability=true){
 const control=p.locator(`[data-field-slider="${key}"]`);
 await control.focus();
 await control.scrollIntoViewIfNeeded();
 // Check after focus/scroll, including every overflow ancestor and five physical
 // hit points. An input hidden beneath the sticky footer must fail, never force.
 if(verifyReachability)report.geometry.push({label:label+'/'+key,...await assertReachable(control,label+' '+key+' range')});
 const bounds=await control.evaluate(e=>({min:+e.min,max:+e.max,value:+e.value,step:+e.step}));
 assert.equal(bounds.step,1);assert(Number.isInteger(target)&&target>=bounds.min&&target<=bounds.max);
 assert.equal(bounds.value,(await snap(p))[key],label+' range value equals model before native input');
 let value=bounds.value;
 // Home/End and vertical arrows are native range interactions, including in RTL.
 // Select the shortest route without programmatic value writes or event dispatch.
 const routes=[{cost:Math.abs(target-value),start:value},{cost:1+target-bounds.min,start:bounds.min,key:'Home'},{cost:1+bounds.max-target,start:bounds.max,key:'End'}].sort((a,b)=>a.cost-b.cost);
 if(routes[0].key&&routes[0].start!==value){value=routes[0].start;await step(p,label,key,value,()=>p.keyboard.press(routes[0].key));}
 while(value!==target){const direction=target>value?1:-1;value+=direction;await step(p,label,key,value,()=>p.keyboard.press(direction>0?'ArrowUp':'ArrowDown'));}
 assert.equal(await control.inputValue(),String(target),label+' native range reaches exact requested value');
 check(await control.evaluate(e=>document.activeElement===e),label+' '+key+' retains native keyboard focus');
}
async function burn(p,label,variant){
 const button=p.locator('#fieldSubmit');await button.scrollIntoViewIfNeeded();
 if(variant==='after')report.geometry.push({label:label+'/execute',...await assertReachable(button,label+' Execute')});
 return step(p,label,'burn',undefined,()=>button.click());
}
async function nativeWheelAudit(p,label){
 const before=await snap(p);
 // This independent short-portrait audit uses no focus, scrollIntoView, DOM
 // scrolling writes, or forced clicks. Normal controller tests remain separate.
 for(const selector of ['[data-field-slider="angle"]','[data-field-slider="power"]','[data-field-slider="trim"]','#fieldSubmit']){
  const control=p.locator(selector),attempts=[];
  const read=()=>control.evaluate(e=>{
   const box=r=>({left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height});
   const intersection=(a,b)=>({left:Math.max(a.left,b.left),top:Math.max(a.top,b.top),right:Math.min(a.right,b.right),bottom:Math.min(a.bottom,b.bottom)});
   const clip=el=>{
    let r={left:0,top:0,right:innerWidth,bottom:innerHeight};
    for(let a=el.parentElement;a;a=a.parentElement){const s=getComputedStyle(a),b=a.getBoundingClientRect();
     if(/auto|scroll|hidden|clip/.test(s.overflowX)){r.left=Math.max(r.left,b.left+a.clientLeft);r.right=Math.min(r.right,b.left+a.clientLeft+a.clientWidth);}
     if(/auto|scroll|hidden|clip/.test(s.overflowY)){r.top=Math.max(r.top,b.top+a.clientTop);r.bottom=Math.min(r.bottom,b.top+a.clientTop+a.clientHeight);}
    }return r;
   };
   const deck=e.closest('.field-deck'),panel=deck||document.getElementById('app'),header=document.querySelector('#fieldMission .field-head'),footer=document.querySelector('#fieldMission .field-footer');
   const target=box(e.getBoundingClientRect()),head=box(header.getBoundingClientRect()),foot=box(footer.getBoundingClientRect());
   const visible=clip(e),area=intersection(box(panel.getBoundingClientRect()),clip(panel));
   if(deck){visible.top=Math.max(visible.top,head.bottom);visible.bottom=Math.min(visible.bottom,foot.top);area.top=Math.max(area.top,head.bottom);area.bottom=Math.min(area.bottom,foot.top);}
   const wheelArea=deck?area:intersection(head,area);
   return{target,clip:visible,wheelArea,panel:{id:panel.id||panel.className,scrollTop:panel.scrollTop,scrollHeight:panel.scrollHeight,clientHeight:panel.clientHeight},header:head,footer:foot,
    appScrollTop:document.getElementById('app').scrollTop,deckScrollTop:document.querySelector('#fieldMission .field-deck').scrollTop};
  });
  const wheel=async(g,delta,phase)=>{
   const a=g.wheelArea;assert(a.right>a.left&&a.bottom>a.top,label+' '+selector+' has a visible native wheel area');
   await p.mouse.move((a.left+a.right)/2,(a.top+a.bottom)/2);await p.mouse.wheel(0,delta);await p.clock.runFor(64);
   const after=await read();attempts.push({phase,delta,before:g,after});return after;
  };
  let g=await read();
  for(let i=0;g.panel.scrollTop>.5&&i<12;i++)g=await wheel(g,-220,'rewind-panel');
  check(g.panel.scrollTop<=.5,label+' '+selector+' native wheel resets its scroll panel');
  for(let i=0;i<12;i++){
   const t=g.target,c=g.clip;if(t.top>=c.top-.5&&t.bottom<=c.bottom+.5)break;
   const distance=t.top<c.top?t.top-c.top-4:t.bottom-c.bottom+4;
   const next=await wheel(g,Math.sign(distance)*Math.min(220,Math.max(8,Math.abs(distance))),'reveal-control');
   const moved=Math.abs(next.panel.scrollTop-g.panel.scrollTop)+Math.abs(next.appScrollTop-g.appScrollTop)+Math.abs(next.deckScrollTop-g.deckScrollTop);g=next;if(moved<.1)break;
  }
  // Record navigation even when the one final, unchanged strict assertion fails.
  report.navigation.push({label,selector,input:'mouse.wheel only',attempts,final:g});
  report.geometry.push({label:label+'/native-wheel/'+selector,...await assertReachable(control,label+' native-wheel '+selector)});
 }
 const after=await snap(p),first=structuredClone(before),last=structuredClone(after);delete first.seconds;delete last.seconds;
 assert.deepEqual(last,first,label+' wheel-only navigation changes no gameplay input or trace');
 check(true,label+' every slider and Execute passes native-wheel five-point reachability');
}
async function capture(p,variant,lang,view,screen){
 await p.evaluate(()=>{document.getElementById('app').scrollTop=0;document.getElementById('fieldMission').scrollTop=0;document.querySelector('#fieldMission .field-deck').scrollTop=0;window.scrollTo(0,0);});
 const assets=await p.evaluate(async()=>{
  await document.fonts.ready;const root=document.querySelector('.screen.active'),urls=new Set();
  for(const i of root.querySelectorAll('img,svg image')){const href=i.currentSrc||i.getAttribute('href')||i.getAttribute('src');if(href)urls.add(new URL(href,location.href).href);}
  for(const e of [root,...root.querySelectorAll('*')])for(const pseudo of [null,'::before','::after'])for(const m of getComputedStyle(e,pseudo).backgroundImage.matchAll(/url\(["']?(.*?)["']?\)/g))urls.add(m[1]);
  return Promise.all([...urls].map(async url=>{const i=new Image();i.src=url;try{await i.decode();return{url,ok:true};}catch{return{url,ok:false};}}));
 });
 check(assets.every(a=>a.ok),`${variant}/${lang}/${screen} every displayed image decoded: ${JSON.stringify(assets.filter(a=>!a.ok))}`);
 if(variant==='after')check(await marker(p)===MARKER,`${variant}/${lang}/${screen} screenshot uses the loaded module, never fallback`);
 await p.clock.runFor(64);await p.waitForLoadState('networkidle');
 const file=`${variant}-${lang}-${view[0]}x${view[1]}-${screen}.png`;
 await p.screenshot({path:path.join(out,file),animations:'disabled'});
 report.screenshots.push({variant,lang,width:view[0],height:view[1],screen,file,state:await snap(p)});
 if(screen==='chapter3-initial')networkByPage.get(p).phase='gameplay-after-initial-capture';
}
async function layout(p,label){
 const data=await p.evaluate(()=>{
  const root=document.getElementById('fieldMission'),visible=e=>{const b=e.getBoundingClientRect(),s=getComputedStyle(e);return b.width>0&&b.height>0&&s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)>.05;};
  const controls=[...root.querySelectorAll('button:not(:disabled),summary,input[type=range]')].filter(visible).map(e=>{const b=e.getBoundingClientRect();return{id:e.id||e.dataset.fieldSlider||e.className,w:b.width,h:b.height,l:b.left,r:b.right};});
  const copy=[];for(const el of root.querySelectorAll('*')){if(el.closest('svg')||!visible(el))continue;for(const node of el.childNodes){if(node.nodeType!==3||!node.textContent.trim())continue;const range=document.createRange();range.selectNodeContents(node);for(const b of range.getClientRects())copy.push({id:el.id||el.className,size:parseFloat(getComputedStyle(el).fontSize),l:b.left,r:b.right});}}
  return{width:innerWidth,scroll:document.documentElement.scrollWidth,controls,copy,dir:document.documentElement.dir};
 });
 check(data.scroll<=data.width+1,label+' no horizontal document overflow');
 for(const c of data.controls){check(c.w>=43.5&&c.h>=43.5,label+' '+c.id+' native control >=44px');check(c.l>=-.5&&c.r<=data.width+.5,label+' '+c.id+' control within horizontal viewport');}
 for(const c of data.copy){check(c.size===0||c.size>=10.95,label+' '+c.id+' HTML copy >=11px');check(c.l>=-1&&c.r<=data.width+1,label+' '+c.id+' copy within horizontal viewport');}
 report.geometry.push({label,...data});
}
async function graphics(p,label){
 const s=await snap(p),b=R.layout(s),g=await p.locator('#fieldWorld>svg').evaluate(svg=>({
  renderer:svg.dataset.renderer,nodes:svg.querySelectorAll('*').length,filters:svg.querySelectorAll('filter').length,
  ids:[...svg.querySelectorAll('[id]')].map(e=>e.id),images:[...svg.querySelectorAll('image')].map(e=>e.getAttribute('href')),
  preview:[...svg.querySelectorAll('.trajectory-preview')].map(e=>e.getAttribute('d')),
  trails:[...svg.querySelectorAll('.trajectory-trail')].map(e=>e.getAttribute('d')),
  receiver:svg.querySelector('.trajectory-receiver')?.getAttribute('transform'),radius:svg.querySelector('.trajectory-target')?.getAttribute('r'),
  relay:svg.querySelector('.trajectory-relay')?.getAttribute('transform'),relayRadius:svg.querySelector('.trajectory-relay circle')?.getAttribute('r'),
  labels:[...svg.querySelectorAll('text')].map(e=>{const b=e.getBBox();return{text:e.textContent,x:b.x,y:b.y,w:b.width,h:b.height};})
 }));
 check(g.renderer===MARKER,label+' rebuilt module is mounted');
 check(g.nodes<400&&g.filters===0&&new Set(g.ids).size===g.ids.length,label+' bounded scene DOM, no SVG filters, unique resource ids');
 assert.equal(g.receiver,`translate(${b.target.x} ${b.target.y})`,label+' capture center exactly matches FieldRules');
 assert.equal(+g.radius,b.target.radius,label+' capture radius exactly matches FieldRules');
 if(b.target.relay){assert.equal(g.relay,`translate(${b.target.relay.x} ${b.target.relay.y})`,label+' relay center exactly matches FieldRules');assert.equal(+g.relayRadius,14+(s.mods.radius||0),label+' relay radius exactly matches acceptance rules');}
 const points=(trail,preview)=>Array.from({length:41},(_,i)=>R.flightPoint(trail.angle,trail.power,i/10,preview?R.condition(s):{wind:trail.wind||0,gravity:trail.gravity||4},preview?s.trim||0:trail.trim||0));
 function exactPath(actual,expected,description){
  assert(actual&&!/NaN|undefined|Infinity/.test(actual),description+' finite path');
  assert.deepEqual((actual.match(/[ML]/g)||[]),Array.from({length:41},(_,i)=>i?'L':'M'),description+' original 41-point sample structure');
  assert.deepEqual(actual.match(/[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi).map(Number),expected.flatMap(q=>[q.x,q.y]),description+' exact model flight coordinates');
 }
 assert.equal(g.preview.length,s.complete?0:1,label+' completed stage has no fourth predicted maneuver');
 if(!s.complete)exactPath(g.preview[0],points(s,true),label+' preview');
 assert.equal(g.trails.length,s.trails.length,label+' recorded trails count equals accepted/rejected attempts');
 g.trails.forEach((d,i)=>exactPath(d,points(s.trails[i],false),label+' stored trail '+i));
 report.graphics.push({label,...g,burn:s.burn,complete:s.complete});
}
async function exercise(p,label,variant,lang,view){
 const rebuilt=variant==='after';
 assert.equal((await snap(p)).version,2,label+' real new Chapter 3 assignments use the current rules');
 assert.equal(await p.locator('[data-field-slider]').count(),3,label+' angle, impulse and post-relay trim native sliders');
 // A deliberately poor native setting must miss, preserve its flight trail, and
 // increment the real correction count. Then recover without resetting anything.
 for(const [key,value]of [['angle',15],['power',20],['trim',-20]])await range(p,label,key,value,rebuilt);
 let s=await burn(p,label,variant);
 check(s.notice==='trajectory-miss'&&s.burn===0&&s.errors===1&&!s.trails.at(-1).hit,label+' failed maneuver uses the exact existing model');
 let target=R.layout(s).target;
 for(const key of ['angle','power','trim'])await range(p,label,key,target[key],rebuilt);
 if(rebuilt)await graphics(p,label+'/selected');
 await capture(p,variant,lang,view,'chapter3-selected');
 const paused=await snap(p);await p.locator('#fieldPause').click();await p.keyboard.press('Escape');
 assert.deepEqual(await snap(p),paused,label+' Pause/Escape changes no gameplay state');
 for(let i=0;i<3;i++){
  s=await snap(p);target=R.layout(s).target;
  for(const key of ['angle','power','trim'])await range(p,label,key,target[key],rebuilt);
  s=await burn(p,label,variant);
  check(s.burn===i+1&&s.trails.at(-1).hit,label+' native successful maneuver '+(i+1));
  if(rebuilt)await graphics(p,label+'/burn-'+(i+1));
  if(i===1){
   await capture(p,variant,lang,view,'chapter3-partial');const saved=await snap(p);
   await exitToPlan(p);await p.locator('#storyNext').click();await p.locator('#fieldResume').click();
   assert.deepEqual(await snap(p),saved,label+' actual checkpoint restore preserves every state and trace field');
  }
 }
 check(s.burn===3&&s.moves===4&&s.errors===1&&s.complete&&R.won(s),label+' exactly three successful maneuvers complete after one recoverable miss');
 await capture(p,variant,lang,view,'chapter3-complete');
 if(rebuilt){await layout(p,label+'/complete');await graphics(p,label+'/complete');}
 const complete=await snap(p);await p.locator('#fieldSubmit').click();
 check(await p.locator('#storyPlan').isVisible(),label+' actual Complete returns to the chapter plan');
 const saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('mkty_story_plan_3_v1')));
 check(saved.done.includes(0)&&saved.tasks[0].proof.complete,label+' real completion callback records won stage');
 assert.deepEqual(saved.tasks[0].proof,complete,label+' real proof is the full completed checkpoint');
}
// These routes delay/fail the actual optional script response. No substitute code is
// fulfilled, and the local source server still serves every successful response.
async function moduleGate(p,{failFirst=false}={}){
 let release,seen=0,closing=false;const held=new Promise(r=>release=r),requests=[];
 await p.route('**/art-scenes/trajectory.js*',async route=>{
  try{
   seen++;requests.push(route.request().url());
   if(failFirst&&seen===1)return await route.fulfill({status:503,contentType:'application/javascript',body:''});
   if(!failFirst&&seen===1)await held;
   if(closing)return await route.abort('aborted');
   await route.continue();
  }catch(e){if(!closing)report.failures.push('unexpected optional-module route error: '+e.stack);}
 });
 return{release:()=>release(),count:()=>seen,requests,
  dispose:async()=>{closing=true;release();await p.unrouteAll({behavior:'wait'});}};
}
async function lifecycleCase(name,work){
 let ctx,gate;
 try{const page=await pageFor('after','en',[320,568]);ctx=page.ctx;gate=await moduleGate(page.p,{failFirst:name==='failed-load-recovery'});await work(page.p,gate);report.lifecycle.push({name,passed:true,moduleRequests:gate.requests});}
 catch(e){report.failures.push('lifecycle/'+name+': '+e.stack);report.lifecycle.push({name,passed:false,moduleRequests:gate?.requests||[],error:e.message});}
 finally{
  // Release and drain the page's route handlers before closing their context.
  // If teardown is interrupted, the handler catches its own terminal rejection.
  if(gate)await cleanup('lifecycle/'+name+'/routes',()=>gate.dispose());
  if(ctx)await closeContext(ctx,'lifecycle/'+name);
 }
}
async function lifecycle(){
 await lifecycleCase('delayed-before-resume',async(p,gate)=>{
  await enter(p,3,{resume:false});await until(()=>moduleStatus(p),s=>s==='loading','held optional request loading');
  check(await marker(p)!==MARKER,'delayed before Resume uses reviewed fallback');const state=await snap(p);
  gate.release();await until(()=>marker(p),s=>s===MARKER,'optional scene repaints the same paused task');
  assert.deepEqual(await snap(p),state,'before Resume readiness preserves the complete paused state');
  check(await p.locator('#fieldDialog').isVisible(),'readiness never closes the briefing');
  await p.locator('#fieldResume').click();await range(p,'delayed-before-resume','angle',state.angle+1);
  assert.equal(gate.count(),1,'one delayed script request');
 });
 await lifecycleCase('delayed-after-resume',async(p,gate)=>{
  await enter(p);await until(()=>moduleStatus(p),s=>s==='loading','held request remains loading after Resume');
  const slider=p.locator('[data-field-slider="angle"]');await slider.scrollIntoViewIfNeeded();await slider.focus();
  const state=await snap(p),scene=await p.locator('#fieldWorld').innerHTML();
  gate.release();await until(()=>moduleStatus(p),s=>s==='ready','late module registered');
  assert.deepEqual(await snap(p),state,'late readiness preserves active gameplay and trace');
  assert.equal(await p.locator('#fieldWorld').innerHTML(),scene,'late readiness does not replace active SVG under the player');
  check(await slider.evaluate(e=>document.activeElement===e),'late readiness preserves native slider focus');
  check(!await p.locator('#fieldDialog').isVisible(),'late readiness does not reopen the briefing');
  await range(p,'delayed-after-resume','angle',state.angle+1);
  check(await marker(p)===MARKER,'next normal native input uses the now-ready module');await graphics(p,'delayed-after-resume');
 });
 await lifecycleCase('failed-load-recovery',async(p,gate)=>{
  await enter(p,3,{resume:false});await until(()=>moduleStatus(p),s=>s==='failed','HTTP 503 becomes recoverable failure');
  check(await marker(p)!==MARKER,'failed load keeps reviewed fallback available');
  await p.locator('#fieldResume').click();const state=await snap(p);await range(p,'failed-load-fallback','angle',state.angle+1);
  const saved=await snap(p);await exitToPlan(p);await enter(p,3,{resume:false,ready:true});
  assert.deepEqual(await snap(p),saved,'reopened retry preserves exact saved state');
  assert.equal(gate.count(),2,'one failure and one bounded native-reopen retry');
  await p.locator('#fieldResume').click();await range(p,'failed-load-recovered','power',saved.power+1);await graphics(p,'failed-load-recovered');
 });
 await lifecycleCase('rapid-navigation-other-chapter',async(p,gate)=>{
  await enter(p,3,{resume:false});await until(()=>moduleStatus(p),s=>s==='loading','request held before navigation');
  await exitToPlan(p);await enter(p,4,{resume:false});
  const state=await snap(p),scene=await p.locator('#fieldWorld').innerHTML(),title=await p.locator('#fieldDialogTitle').innerText();
  gate.release();await until(()=>moduleStatus(p),s=>s==='ready','old Chapter 3 request finishes after Chapter 4 opens');
  assert.deepEqual(await snap(p),state,'stale ready callback never changes newer Chapter 4 state');
  assert.equal(await p.locator('#fieldWorld').innerHTML(),scene,'stale callback never replaces another chapter scene');
  assert.equal(await p.locator('#fieldDialogTitle').innerText(),title,'stale callback never alters newer briefing');
  await exitToPlan(p);await enter(p,3,{ready:true});check((await snap(p)).n===3,'returning to Chapter 3 uses ready art normally');
  assert.equal(gate.count(),1,'cross-chapter navigation does not duplicate module loading');
 });
 await lifecycleCase('rapid-reopen-same-chapter',async(p,gate)=>{
  await enter(p,3,{resume:false});await until(()=>moduleStatus(p),s=>s==='loading','first request is in flight');
  for(let i=0;i<2;i++){await exitToPlan(p);await enter(p,3,{resume:false});}
  const state=await snap(p);assert.equal(gate.count(),1,'rapid opens share one pending real request');
  gate.release();await until(()=>marker(p),s=>s===MARKER,'only newest paused task receives ready scene');
  assert.deepEqual(await snap(p),state,'rapid reopen keeps latest task state intact');
  await p.locator('#fieldResume').click();await range(p,'rapid-reopen','trim',state.trim+1);
 });
 await lifecycleCase('timeout-then-recovery',async(p,gate)=>{
  await enter(p,3,{resume:false});await until(()=>moduleStatus(p),s=>s==='loading','slow request held');const state=await snap(p);
  await p.clock.runFor(5001);await until(()=>moduleStatus(p),s=>s==='failed','real five-second optional timeout');
  assert.deepEqual(await snap(p),state,'timed-out module does not mutate paused state');
  check(await marker(p)!==MARKER,'timeout keeps fallback scene');gate.release();
  // Let the removed script finish before using the controller's bounded retry.
  await p.waitForLoadState('networkidle');
  check(await moduleStatus(p)==='failed','stale timed-out response cannot register itself');
  await exitToPlan(p);await enter(p,3,{resume:false,ready:true});
  assert.deepEqual(await snap(p),state,'timeout recovery preserves saved checkpoint');assert.equal(gate.count(),2);
 });
}
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
 for(const [variant]of variants)for(const lang of languages)for(const view of views){
  const label=`${variant}/${lang}/${view.join('x')}`;let ctx;
  try{const page=await pageFor(variant,lang,view);ctx=page.ctx;const p=page.p;
   await enter(p,3,{ready:variant==='after'});await capture(p,variant,lang,view,'chapter3-initial');
   if(variant==='after'){await layout(p,label+'/initial');await graphics(p,label+'/initial');}
   if(variant==='after'&&view[0]===320)await nativeWheelAudit(p,label);
   if(lang==='ar')check(await p.locator('html').getAttribute('dir')==='rtl',label+' Arabic document direction retained');
   await exercise(p,label,variant,lang,view);
  }catch(e){report.failures.push(label+': '+e.stack);}finally{if(ctx)await closeContext(ctx,label);}
 }
 await lifecycle();
 const expected=variants.flatMap(([variant])=>languages.flatMap(lang=>views.flatMap(([width,height])=>['initial','selected','partial','complete'].map(state=>`${variant}-${lang}-${width}x${height}-chapter3-${state}.png`))));
 assert.deepEqual(report.screenshots.map(s=>s.file).sort(),expected.sort(),'all 48 unique before/after gameplay screenshots exist');
 check(report.lifecycle.length===6&&report.lifecycle.every(c=>c.passed),'all six real-browser optional-module lifecycle cases passed');
 check(report.failures.length===0,'no browser, controller, geometry or loader assertions failed');
})().catch(e=>{report.failures.push(e.stack);process.exitCode=1;}).finally(async()=>{
 if(browser)await cleanup('browser',()=>browser.close());server.close();
 finalizeNetwork();
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
 const pairs=report.screenshots.filter(s=>s.variant==='after'&&report.screenshots.some(b=>b.variant==='before'&&b.lang===s.lang&&b.width===s.width&&b.screen===s.screen));
 fs.writeFileSync(path.join(out,'index.html'),'<!doctype html><meta charset="utf-8"><title>Chapter 3 real-gameplay comparison</title><style>body{margin:24px;background:#102538;color:#edf4ef;font:16px system-ui}section{margin:32px 0}.pair{display:flex;flex-wrap:wrap;gap:20px}figure{margin:0}img{max-width:100%;border:1px solid #668295}figcaption{margin:8px 0;color:#ead5a3}</style><h1>Chapter 3 · actual gameplay</h1><p>Before: exact PR54 commit '+BASE+'. After: the loaded launch-window module. Four states × RU/EN/AR × two portrait sizes × two actual source trees = 48 screenshots. Seeded local state, no production or authenticated traffic. Chromium emulation, not physical-device certification.</p><p><a href="report.json">Read the model transitions, geometry, six delayed/failure/navigation checks, and any failures</a>.</p><p>Result: '+(report.failures.length?'FAILED ('+report.failures.length+' errors)':'PASSED')+'</p>'+pairs.map(s=>`<section><h2>${s.screen} · ${s.lang} · ${s.width}×${s.height}</h2><div class="pair"><figure><figcaption>BEFORE · reviewed PR54</figcaption><img src="${s.file.replace(/^after/,'before')}" alt="Before ${s.screen}"></figure><figure><figcaption>AFTER · loaded launch-window module</figcaption><img src="${s.file}" alt="After ${s.screen}"></figure></div></section>`).join(''));
 console.log(JSON.stringify({screenshots:report.screenshots.length,checks:report.checks.length,controllerTransitions:report.transitions.length,lifecycle:report.lifecycle,network:report.network.summary,failures:report.failures,out},null,2));
 if(report.failures.length)process.exitCode=1;
});
