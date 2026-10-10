#!/usr/bin/env node
/* GitHub Actions only. Actual unmodified Chapter 2 controllers, seeded local state,
   local source checkouts, isolated browser contexts, and zero external account traffic.
   Based on render-visual-preview.cjs; it does not inject scene SVG or stub controllers.
   Usage in CI: node tools/render-crew-preview.cjs --before=/absolute/PR53 --out=/absolute/output */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
assert.equal(process.env.GITHUB_ACTIONS,'true','Browser/listener execution is restricted to the approved GitHub Actions workflow');
const {chromium}=require('playwright'),R=require('../field-model.js'),assertReachable=require('../tests/field-control-helper.cjs');
const args=process.argv.slice(2),get=k=>args.find(a=>a.startsWith('--'+k+'='))?.slice(k.length+3);
const after=path.resolve(__dirname,'..'),before=get('before'),out=path.resolve(get('out')||'/tmp/moonkatty-crew-preview');
assert(before,'--before must identify the exact PR53 checkout');fs.mkdirSync(out,{recursive:true});
const variants=[['before',path.resolve(before)],['after',after]],views=[[390,844],[320,568]],languages=['ru','en','ar'];
const report={baseline:'2e15ef6417b92996f5678550a9b2319c53931f4b',purpose:'Real Chapter 2 scene and controller browser checks; local seeded fixtures, no deployment, account, reward or authenticated traffic.',semantics:'Enter Chapter 2 through MKTYStory.menu(2), then actual Start, crew council, Resume, station, specialist, Assign, Pause, Escape, Exit, Resume and Complete controls. Expected transitions come from the unchanged FieldRules model. Only initial local fixture state and the clock are seeded; no renderer/controller replacement.',screenshots:[],checks:[],geometry:[],labelBounds:[],navigation:[],graphics:[],transitions:[],failures:[],externalRequestsBlocked:0};
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
let browser,origin;
async function pageFor(variant,lang,view){
 const ctx=await browser.newContext({viewport:{width:view[0],height:view[1]},deviceScaleFactor:1,hasTouch:true,reducedMotion:'reduce',locale:lang});
 await ctx.route('**/*',route=>{
  const u=new URL(route.request().url());
  if(u.origin===origin&&u.pathname.startsWith('/'+variant+'/'))return route.continue();
  report.externalRequestsBlocked++;
  return route.fulfill({status:200,contentType:u.pathname.endsWith('.js')?'application/javascript':'application/json',body:u.pathname.endsWith('.js')?'':'{"ok":false,"preview":true}'});
 });
 const p=await ctx.newPage();p.setDefaultTimeout(10000);
 p.on('pageerror',e=>report.failures.push(`${variant}/${lang}/${view}: ${e.message}`));
 await p.addInitScript(lang=>{localStorage.setItem('mkty_lang',lang);localStorage.setItem('mkty_test_no_pacing','yes');localStorage.setItem('mkty_life1_code_presented','yes');},lang);
 await p.clock.install({time:new Date('2026-10-10T06:59:00Z')});await p.clock.pauseAt(new Date('2026-10-10T07:00:00Z'));
 await p.goto(origin+'/'+variant+'/',{waitUntil:'load'});
 await p.waitForFunction(()=>window.MKTYStory&&window.MKTYField&&window.MKTYI18n);
 await p.evaluate(l=>setLang(l),lang);await p.waitForFunction(l=>MKTYI18n.getLanguage()===l&&(l==='en'||!!window.MKTYLocales?.[l]),lang);
 await p.evaluate(async()=>Promise.all(['art/station-details-v2.webp','art/lunar-worksite-atlas-v1.webp','art/lunar-worksite-ground-v1.webp','art/life2-crew.webp'].map(async src=>{const i=new Image();i.src=src;await i.decode();})));
 return {ctx,p};
}
async function enter(p){
 await p.evaluate(()=>{show('chapters');localStorage.setItem('mkty_story_plan_2_v1',JSON.stringify(StoryPlan.fresh(2,401,2)));MKTYStory.menu(2);document.getElementById('app').scrollTop=0;});
 await p.locator('#storyNext').click();
 // This is the real first-time crew-council choice, in an isolated local fixture.
 if(await p.locator('#legacyDialog').isVisible())await p.locator('[data-legacy-choice="navigator"]').click();
 await p.locator('#fieldResume').click();
 assert.equal((await p.evaluate(()=>MKTYField.snapshot())).n,2,'actual Chapter 2 controller opened');
}
async function capture(p,variant,lang,view,screen){
 await p.evaluate(()=>{document.getElementById('app').scrollTop=0;document.getElementById('fieldMission').scrollTop=0;window.scrollTo(0,0);});
 const assets=await p.evaluate(async()=>{
  await document.fonts.ready;const root=document.querySelector('.screen.active'),urls=new Set();
  for(const i of root.querySelectorAll('img,svg image')){const href=i.currentSrc||i.getAttribute('href')||i.getAttribute('src');if(href)urls.add(new URL(href,location.href).href);}
  for(const e of [root,...root.querySelectorAll('*')])for(const pseudo of [null,'::before','::after'])for(const m of getComputedStyle(e,pseudo).backgroundImage.matchAll(/url\(["']?(.*?)["']?\)/g))urls.add(m[1]);
  return Promise.all([...urls].map(async url=>{const i=new Image();i.src=url;try{await i.decode();return {url,ok:true};}catch{return {url,ok:false};}}));
 });
 check(assets.every(a=>a.ok),`${variant}/${lang}/${screen} every displayed image decoded`);
 await p.clock.runFor(64);await p.waitForLoadState('networkidle');
 const file=`${variant}-${lang}-${view[0]}x${view[1]}-${screen}.png`;await p.screenshot({path:path.join(out,file),animations:'disabled'});
 report.screenshots.push({variant,lang,width:view[0],height:view[1],screen,file});
}
async function layout(p,label){
 const data=await p.evaluate(()=>{
  const root=document.getElementById('fieldMission'),visible=e=>{const b=e.getBoundingClientRect(),s=getComputedStyle(e);return b.width>0&&b.height>0&&s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)>.05;};
  const controls=[...root.querySelectorAll('button:not(:disabled),summary')].filter(visible).map(e=>{const b=e.getBoundingClientRect();return {id:e.id||e.className,w:b.width,h:b.height,l:b.left,r:b.right};});
  const copy=[];for(const el of root.querySelectorAll('*')){if(el.closest('svg')||!visible(el))continue;for(const node of el.childNodes){if(node.nodeType!==3||!node.textContent.trim())continue;const range=document.createRange();range.selectNodeContents(node);for(const b of range.getClientRects())copy.push({id:el.id||el.className,size:parseFloat(getComputedStyle(el).fontSize),l:b.left,r:b.right});}}
  return {width:innerWidth,scroll:document.documentElement.scrollWidth,controls,copy,dir:document.documentElement.dir};
 });
 check(data.scroll<=data.width+1,label+' no horizontal document overflow');
 for(const c of data.controls){check(c.w>=43.5&&c.h>=43.5,label+' '+c.id+' HTML control >=44px');check(c.l>=-.5&&c.r<=data.width+.5,label+' '+c.id+' HTML control within horizontal viewport');}
 for(const c of data.copy){check(c.size===0||c.size>=10.95,label+' '+c.id+' HTML copy >=11px');check(c.l>=-1&&c.r<=data.width+1,label+' '+c.id+' HTML text within horizontal viewport');}
}
async function graphics(p,label,variant){
 const t=performance.now(),g=await p.evaluate(()=>{
  const svg=document.querySelector('#fieldWorld>svg'),state=MKTYField.snapshot(),json=JSON.stringify(state),first=FieldArt.scene(state,2);
  for(let i=0;i<80;i++)FieldArt.scene(state,2);
  const ids=[...svg.querySelectorAll('[id]')].map(e=>e.id);
  return {renderer:svg.dataset.renderer||'PR53',nodes:svg.querySelectorAll('*').length,images:[...svg.querySelectorAll('image')].map(e=>e.getAttribute('href')),filters:svg.querySelectorAll('filter').length,uniqueIds:new Set(ids).size===ids.length,unchanged:json===JSON.stringify(state),deterministic:first===FieldArt.scene(state,2),cellCount:svg.querySelectorAll('[data-field-cell]').length};
 });g.batch80SourceWallMs=+(performance.now()-t).toFixed(2);g.timingNote='Unmocked Node clock, includes protocol overhead; not GPU/phone paint timing';report.graphics.push({label,...g});
 check(g.cellCount===6,label+' six native station controls');
 if(variant==='after'){check(g.renderer==='crew-workshop-rebuilt-v1',label+' rebuilt scene mounted by real controller');check(g.nodes<400&&g.filters===0&&g.uniqueIds,label+' DOM/resource identifiers stay bounded');check(g.unchanged&&g.deterministic,label+' rendering immutable and deterministic');check(g.batch80SourceWallMs<1000,label+' 80 source renders within 1s including protocol');}
}
async function targets(p,label,variant){
 const boxes=await p.locator('#fieldWorld [data-field-cell]').evaluateAll(es=>es.map(e=>{const b=e.getBoundingClientRect(),r=e.querySelector('rect').getBoundingClientRect(),s=e.getBBox(),rect=e.querySelector('rect').getBBox();return {id:e.dataset.fieldCell,w:b.width,h:b.height,rw:r.width,rh:r.height,x:s.x,y:s.y,sw:s.width,sh:s.height,rx:rect.x,ry:rect.y,rsw:rect.width,rsh:rect.height};}));report.geometry.push({label,boxes});
 if(variant==='after')for(const b of boxes){check(b.w>=44&&b.h>=44,label+' station '+b.id+' portrait target >=44px');check(Math.abs(b.w-b.rw)<.1&&Math.abs(b.h-b.rh)<.1&&b.x===b.rx&&b.y===b.ry&&b.sw===108&&b.sh===110,label+' station '+b.id+' exact original rectangle bounds');}
}
async function labels(p,label){
 const boxes=await p.locator('#fieldWorld .crew-station').evaluateAll(es=>es.flatMap(e=>{const plate=e.querySelector('rect'),r=plate.getBBox();return [...e.querySelectorAll('text')].map(t=>{const b=t.getBBox(),style=getComputedStyle(t);return {fontSize:style.fontSize,fontFamily:style.fontFamily,fontWeight:style.fontWeight,id:e.dataset.station,text:t.textContent,x:b.x,right:b.x+b.width,y:b.y,bottom:b.y+b.height,plateLeft:r.x,plateRight:r.x+r.width,plateTop:r.y,plateBottom:r.y+r.height};});}));
 report.labelBounds.push({label,boxes});
 check(boxes.length===12,label+' twelve legible station number/role labels');
 for(const b of boxes)check(b.x>=b.plateLeft-.5&&b.right<=b.plateRight+.5&&b.y>=b.plateTop-1&&b.bottom<=b.plateBottom+1,label+' station '+b.id+' translated label stays on opaque plate: '+JSON.stringify(b));
}
async function exercise(p,label,variant,lang,view){
 const snap=()=>p.evaluate(()=>MKTYField.snapshot());
 async function step(name,value,perform){
  const previous=await snap(),expected=structuredClone(previous);expected.trace??=[];expected.trace.push(['act',name,value??null]);const accepted=R.act(expected,name,value);
  await perform();const actual=await snap();assert.deepEqual(actual,expected,label+' real '+name+' transition matches unchanged model');
  report.transitions.push({label,action:name,value:value??null,accepted,selected:actual.selected,jobs:actual.jobs.slice(),energy:actual.energy,moves:actual.moves,errors:actual.errors,notice:actual.notice});return actual;
 }
 const select=async(id,key)=>{
  // Assign may leave the panel scrolled beneath the sticky header. Return to the
  // board with ordinary wheel input, then prove all five target points are clear.
  // Do this before the model snapshot: advancing the fixture clock may legitimately
  // tick the controller's elapsed time while a user navigates the scroll panel.
  const before=await p.locator('#app').evaluate(e=>e.scrollTop);let after=before,attempts=0;
  if(after>.5)await p.mouse.move(view[0]/2,view[1]/2);
  while(after>.5&&attempts<8){
   await p.mouse.wheel(0,-view[1]*2);await p.clock.runFor(64);
   after=await p.locator('#app').evaluate(e=>e.scrollTop);attempts++;
  }
  const geometry=await p.locator('#fieldWorld').evaluate(e=>{
   const b=e.getBoundingClientRect(),h=document.querySelector('#fieldMission .field-head').getBoundingClientRect();
   return {board:{top:b.top,bottom:b.bottom},header:{top:h.top,bottom:h.bottom}};
  });
  const navigation={label,id,before,after,attempts,input:'mouse.wheel',...geometry};report.navigation.push(navigation);
  check(after<=.5,label+' native wheel returns the app to the board: '+JSON.stringify(navigation));
  return step('select',id,async()=>{
   const cell=p.locator(`[data-field-cell="${id}"]`);
   if(variant==='after')await assertReachable(cell,label+' station '+id);
   if(key){await cell.focus();await p.keyboard.press(key);}else await cell.click();
  });
 };
 const role=id=>step('role',id,()=>p.locator(`[data-field-action="role"][data-value="${id}"]`).click());
 const assign=()=>step('assign',undefined,async()=>{const button=p.locator('#fieldSubmit');await button.scrollIntoViewIfNeeded();if(variant==='after')await assertReachable(button,label+' assign');await button.click();});
 // Every real station is selectable. Alternating mouse, Enter and Space also exercise
 // focus restoration after the controller replaces the SVG, without direct DOM clicks.
 for(let i=0;i<6;i++)await select(i,i%3===1?'Enter':i%3===2?'Space':undefined);
 const initial=await snap(),jobs=R.layout(initial).jobs,blocked=jobs.findIndex(j=>j.requires.length),ready=jobs.findIndex(j=>!j.requires.length);
 await select(blocked);await role(jobs[blocked].role);let s=await assign();check(s.notice==='dependency'&&s.jobs.length===0,label+' dependency rejection remains real');
 await select(ready);await role((jobs[ready].role+1)%3);s=await assign();check(s.notice==='specialist'&&s.jobs.length===0,label+' wrong-specialist rejection remains real');
 await role(jobs[ready].role);await capture(p,variant,lang,view,'chapter2-selected');
 // The native pause dialog can be dismissed by Escape; no hidden action occurs.
 const paused=await snap();await p.locator('#fieldPause').click();await p.keyboard.press('Escape');assert.deepEqual(await snap(),paused,label+' pause/Escape preserves gameplay');
 let count=0;
 while(!(s=await snap()).complete){
  const b=R.layout(s),id=b.jobs.findIndex((j,i)=>!s.jobs.includes(i)&&j.requires.every(k=>s.jobs.includes(k))&&s.energy>=j.cost);assert(id>=0,label+' valid dependency order');
  await select(id,count%2?'Enter':undefined);await role(b.jobs[id].role);await assign();count++;
  if(count===1){await assign();check((await snap()).jobs.length===1,label+' repeated assign does not repeat a completed job');}
  if(count===2){
   await capture(p,variant,lang,view,'chapter2-partial');const saved=await snap();
   await p.locator('#fieldPause').click();await p.locator('#fieldExit').click();check(await p.locator('#storyPlan').isVisible(),label+' Exit returns to Chapter 2 plan');
   await p.locator('#storyNext').click();await p.locator('#fieldResume').click();assert.deepEqual(await snap(),saved,label+' real checkpoint restore preserves jobs, energy, errors and trace');
  }
 }
 check(s.jobs.length===6&&s.moves===6&&s.complete&&R.won(s),label+' all six actual controller assignments complete');
 await capture(p,variant,lang,view,'chapter2-complete');
 if(variant==='after'){await layout(p,label+'/complete');await targets(p,label+'/complete',variant);}
 await p.locator('#fieldSubmit').click();
 check(await p.locator('#storyPlan').isVisible(),label+' completion returns to plan');
 const completed=await p.evaluate(()=>JSON.parse(localStorage.getItem('mkty_story_plan_2_v1')));
 check(completed.done.includes(0)&&completed.tasks[0].proof.complete,label+' real completion callback saved the won stage');
}
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
 for(const [variant]of variants)for(const lang of languages)for(const view of views){
  const label=`${variant}/${lang}/${view.join('x')}`;let ctx;
  try{const page=await pageFor(variant,lang,view);ctx=page.ctx;const p=page.p;await enter(p);await capture(p,variant,lang,view,'chapter2-initial');await graphics(p,label,variant);await targets(p,label,variant);if(variant==='after'){await layout(p,label+'/initial');await labels(p,label);}if(lang==='ar')check(await p.locator('html').getAttribute('dir')==='rtl',label+' Arabic direction retained');await exercise(p,label,variant,lang,view);}
  catch(e){report.failures.push(label+': '+e.stack);}finally{if(ctx)await ctx.close();}
 }
 // All thirteen supported locales at both narrow portrait sizes. These additional
 // fixtures validate real localized DOM geometry without expanding the screenshot set.
 for(const lang of ['en','ru','uk','es','pt','de','fr','it','tr','he','ar','ko','zh'])for(const view of views){
  const label=`all-locales/${lang}/${view.join('x')}`;let ctx;
  try{const page=await pageFor('after',lang,view);ctx=page.ctx;await enter(page.p);await layout(page.p,label);await targets(page.p,label,'after');await labels(page.p,label);if(['ar','he'].includes(lang))check(await page.p.locator('html').getAttribute('dir')==='rtl',label+' RTL retained');}
  catch(e){report.failures.push(label+': '+e.stack);}finally{if(ctx)await ctx.close();}
 }
 check(report.screenshots.length===48,'48 before/after real-gameplay screenshots across RU/EN/AR and both portrait sizes');
 check(report.failures.length===0,'no browser fixture or controller assertion failures');
})().catch(e=>{report.failures.push(e.stack);process.exitCode=1;}).finally(async()=>{
 if(browser)await browser.close();server.close();
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
 const pairs=report.screenshots.filter(s=>s.variant==='after'&&report.screenshots.some(b=>b.variant==='before'&&b.lang===s.lang&&b.width===s.width&&b.screen===s.screen));
 fs.writeFileSync(path.join(out,'index.html'),'<!doctype html><meta charset="utf-8"><title>Chapter 2 real-controller comparison</title><style>body{margin:24px;background:#102538;color:#edf4ef;font:16px system-ui}section{margin:32px 0}.pair{display:flex;flex-wrap:wrap;gap:20px}figure{margin:0}img{max-width:100%;border:1px solid #668295}figcaption{margin:8px 0;color:#ead5a3}</style><h1>Chapter 2 · real-controller source previews</h1><p>Before: exact PR53 commit 2e15ef6. After: rebuilt crew scene. Seeded local state; no production or authenticated traffic. Not physical-device certification. Read report.json for controller transitions, checks and any failures.</p>'+pairs.map(s=>`<section><h2>${s.screen} · ${s.lang} · ${s.width}×${s.height}</h2><div class="pair"><figure><figcaption>BEFORE · PR53</figcaption><img src="${s.file.replace(/^after/,'before')}"></figure><figure><figcaption>AFTER · rebuilt crew</figcaption><img src="${s.file}"></figure></div></section>`).join(''));
 console.log(JSON.stringify({screenshots:report.screenshots.length,checks:report.checks.length,controllerTransitions:report.transitions.length,failures:report.failures,out},null,2));if(report.failures.length)process.exitCode=1;
});
