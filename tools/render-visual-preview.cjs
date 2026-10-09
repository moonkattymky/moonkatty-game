#!/usr/bin/env node
/* Local-only deterministic screenshot fixtures. No deployment or authenticated traffic.
   Usage: node tools/render-visual-preview.cjs --before=/absolute/baseline --out=/absolute/output
   These are source-build previews, not evidence of a complete gameplay/security test. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const assertFieldControlReachable=require('../tests/field-control-helper.cjs');
const args=process.argv.slice(2),get=k=>args.find(a=>a.startsWith('--'+k+'='))?.slice(k.length+3);
const after=path.resolve(__dirname,'..'),before=get('before'),out=path.resolve(get('out')||'/tmp/moonkatty-visual-preview');
assert(before,'--before must identify the reviewed PR45 checkout');
fs.mkdirSync(out,{recursive:true});
const variants=[['before',path.resolve(before)],['after',after]],views=[[390,844],[320,568],[568,320]];
const languages=['en','ru','uk','es','pt','de','fr','it','tr','he','ar','ko','zh'];
const report={purpose:'Seeded, local source-build screenshots. No real account or reward traffic.',screenshots:[],checks:[],svgTargetSizes:[],scanControls:[],sceneGraphics:[],failures:[],externalRequestsBlocked:0};
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.json':'application/json'};
const server=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://localhost'),match=u.pathname.match(/^\/(before|after)(\/.*)?$/),variant=variants.find(v=>v[0]===match?.[1]);
  if(!variant){res.writeHead(404);return res.end();}
  let rel;try{rel=decodeURIComponent(match[2]||'/');}catch{res.writeHead(400);return res.end();}
  const file=path.resolve(variant[1],'.'+(rel==='/'?'/index.html':rel));
  if(file!==variant[1]&&!file.startsWith(variant[1]+path.sep)){res.writeHead(403);return res.end();}
  fs.readFile(file,(e,b)=>{res.writeHead(e?404:200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(e?'':b);});
});
let browser;
const check=(ok,message)=>{assert(ok,message);report.checks.push(message);};
async function metrics(p,label){
  const data=await p.evaluate(()=>{
    const active=document.querySelector('.screen.active');
    const visible=e=>{const b=e.getBoundingClientRect(),s=getComputedStyle(e);return b.width>0&&b.height>0&&s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)>.05;};
    const controls=[...active.querySelectorAll('button:not(:disabled),summary')].filter(visible).map(e=>{const b=e.getBoundingClientRect();return {id:e.id||e.className,w:b.width,h:b.height,left:b.left,right:b.right};});
    const copy=[...active.querySelectorAll('*')].filter(e=>!e.closest('svg')&&visible(e)&&[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())).map(e=>({id:e.id||e.className,size:parseFloat(getComputedStyle(e).fontSize)}));
    const copyBounds=[];for(const el of active.querySelectorAll('*')){if(el.closest('svg')||!visible(el)||parseFloat(getComputedStyle(el).fontSize)===0)continue;for(const node of el.childNodes){if(node.nodeType!==3||!node.textContent.trim())continue;const r=document.createRange();r.selectNodeContents(node);for(const box of r.getClientRects())copyBounds.push({id:el.id||el.className,left:box.left,right:box.right});}}
    return {width:innerWidth,scroll:document.documentElement.scrollWidth,controls,copy,copyBounds,dir:document.documentElement.dir};
  });
  check(data.scroll<=data.width+1,label+' has no document horizontal overflow');
  for(const c of data.controls){check(c.w>=43.5&&c.h>=43.5,label+' control '+c.id+' >=44px');check(c.left>=-.5&&c.right<=data.width+.5,label+' control '+c.id+' within horizontal viewport');}
  for(const c of data.copyBounds)check(c.left>=-1&&c.right<=data.width+1,label+' text '+c.id+' within horizontal viewport');
  for(const c of data.copy)check(c.size===0||c.size>=10.95,label+' copy '+c.id+' >=11px');
}
async function home(p){await p.evaluate(()=>{show('home');document.getElementById('app').scrollTop=0;});}
async function plan(p){await p.evaluate(()=>{show('chapters');const s=StoryPlan.fresh(1,401,2);localStorage.setItem('mkty_story_plan_1_v1',JSON.stringify(s));MKTYStory.menu(1);document.getElementById('app').scrollTop=0;});}
async function capture(p,variant,lang,view,screen){
  const artwork=await p.evaluate(async()=>{
    await document.fonts.ready;
    const root=document.querySelector('.screen.active'),urls=new Set();
    for(const image of root.querySelectorAll('img,svg image')){const href=image.currentSrc||image.getAttribute('href')||image.getAttribute('src');if(href)urls.add(new URL(href,location.href).href);}
    for(const el of [root,...root.querySelectorAll('*')])for(const pseudo of [null,'::before','::after'])for(const m of getComputedStyle(el,pseudo).backgroundImage.matchAll(/url\(["']?(.*?)["']?\)/g))urls.add(m[1]);
    return Promise.all([...urls].map(async url=>{const image=new Image();image.src=url;try{await image.decode();return {url,ok:true};}catch{return {url,ok:false};}}));
  });
  check(artwork.every(i=>i.ok),`${variant}/${lang}/${screen} background, SVG and HTML art decoded before capture`);
  // Nested SVG image patterns need a paint turn after their shared asset decodes.
  // Advance only 64ms of the fixture clock; no gameplay action or second tick occurs.
  await p.clock.runFor(64);
  await p.waitForLoadState('networkidle');
  const name=`${variant}-${lang}-${view[0]}x${view[1]}-${screen}.png`;
  await p.screenshot({path:path.join(out,name),animations:'disabled'});
  report.screenshots.push({variant,lang,width:view[0],height:view[1],screen,file:name});
}
async function pageFor(variant,lang,view){
  const ctx=await browser.newContext({viewport:{width:view[0],height:view[1]},deviceScaleFactor:1,hasTouch:true,reducedMotion:'reduce',locale:lang});
  await ctx.route('**/*',async route=>{
    const u=new URL(route.request().url());
    if(u.origin===origin&&u.pathname.startsWith('/'+variant+'/'))return route.continue();
    report.externalRequestsBlocked++;
    return route.fulfill({status:200,contentType:u.pathname.endsWith('.js')?'application/javascript':'application/json',body:u.pathname.endsWith('.js')?'':'{"ok":false,"preview":true}'});
  });
  const p=await ctx.newPage();p.setDefaultTimeout(10000);
  p.on('pageerror',e=>report.failures.push(`${variant}/${lang}/${view}: ${e.message}`));
  await p.addInitScript(lang=>{
    localStorage.setItem('mkty_lang',lang);
    localStorage.setItem('mkty_test_no_pacing','yes');
    localStorage.setItem('mkty_life1_code_presented','yes');
  },lang);
  await p.clock.install({time:new Date('2026-10-09T11:59:00Z')});
  await p.clock.pauseAt(new Date('2026-10-09T12:00:00Z'));
  await p.goto(origin+'/'+variant+'/',{waitUntil:'load'});
  await p.waitForFunction(()=>window.MKTYStory&&window.MKTYField&&window.MKTYI18n);
  await p.evaluate(l=>setLang(l),lang);
  await p.waitForFunction(l=>MKTYI18n.getLanguage()===l&&(l==='en'||!!window.MKTYLocales?.[l]),lang);
  // Prewarm the existing chapter artwork before dynamic SVG pattern insertion.
  await p.evaluate(async variant=>Promise.all(['art/station-details-v2.webp','art/world-rover.webp','art/world-surface.webp','art/life1-base.webp',...(variant==='after'?['art/lunar-worksite-atlas-v1.webp','art/lunar-worksite-ground-v1.webp']:[])].map(async src=>{const image=new Image();image.src=src;await image.decode();})),variant);
  return {ctx,p};
}
let origin;
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
  for(const [variant]of variants)for(const lang of ['ru','en','ar'])for(const view of views){
    const {ctx,p}=await pageFor(variant,lang,view),label=`${variant}/${lang}/${view.join('x')}`;
    try{
      await home(p);await capture(p,variant,lang,view,'home');if(variant==='after'){
        await metrics(p,label+'/home');
        const art=await p.evaluate(()=>{const image=document.querySelector('.mk-home-character'),a=image.getBoundingClientRect(),b=document.querySelector('.mk-home-bottom .stats').getBoundingClientRect();return {ratio:a.width/a.height,naturalRatio:image.naturalWidth/image.naturalHeight,overlap:Math.min(a.right,b.right)>Math.max(a.left,b.left)&&Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top)};});
        check(!art.overlap,label+' astronaut is not covered by the stats deck');
        check(Math.abs(art.ratio-art.naturalRatio)<.01,label+' astronaut keeps native proportions');
        if(view[0]<view[1]&&view[1]>=840){const nav=await p.locator('#home .mk-bottom-nav').boundingBox();check(nav.y+nav.height<=view[1]+1,label+' primary navigation fits the first screen');}
      }
      await plan(p);await capture(p,variant,lang,view,'chapter1-plan');if(variant==='after')await metrics(p,label+'/plan');
      await p.locator('#storyNext').click();await p.locator('#fieldResume').click();
      await capture(p,variant,lang,view,'chapter1-rover');if(variant==='after'){
        await metrics(p,label+'/rover');
        const overlaps=await p.evaluate(()=>{const a=document.querySelector('#fieldTelemetry').getBoundingClientRect(),b=document.querySelector('#fieldMission .field-footer').getBoundingClientRect();return Math.min(a.right,b.right)>Math.max(a.left,b.left)&&Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top);});
        check(!overlaps,label+' rover telemetry is not covered by its sticky footer');
        const graphics=await p.evaluate(()=>{const svg=document.querySelector('.lunar-worksite'),state=MKTYField.snapshot(),before=JSON.stringify(state),times=[];for(let i=0;i<80;i++){const t=performance.now();FieldArt.scene(state,1);times.push(performance.now()-t);}const ids=[...svg.querySelectorAll('[id]')].map(e=>e.id);return {renderer:svg.dataset.renderer,nodes:svg.querySelectorAll('*').length,images:[...svg.querySelectorAll('image')].map(e=>e.getAttribute('href')),props:new Set([...svg.querySelectorAll('[data-prop]')].map(e=>e.dataset.prop)).size,objectives:svg.querySelectorAll('.lunar-objective').length,clippedSprites:svg.querySelectorAll('.lunar-sprite>g[clip-path]').length,filters:svg.querySelectorAll('filter').length,idsUnique:new Set(ids).size===ids.length,stateUnchanged:before===JSON.stringify(state),renderP95ms:times.sort((a,b)=>a-b)[76]};});
        report.sceneGraphics.push({lang,viewport:view,...graphics});
        check(graphics.renderer==='lunar-worksite-v2',label+' uses the replacement playable scene');
        check(graphics.images.length===2&&graphics.props===8&&graphics.objectives===3,label+' uses two shared textures, eight distinct modules and three data instruments');
        check(graphics.idsUnique&&graphics.filters===0&&graphics.nodes<650&&graphics.clippedSprites===16,label+' bounded SVG scene has unique IDs, clipped sprites and no image filters');
        check(graphics.stateUnchanged&&graphics.renderP95ms<15,label+' draw does not mutate state and source generation p95 <15ms (CI runner)');

      }
      const cellSizes=await p.locator('.field-map-cell>rect:first-child').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {width:r.width,height:r.height};}));
      const minimumCell=Math.min(...cellSizes.flatMap(c=>[c.width,c.height]));
      if(variant==='after'){
        const bounds=await p.locator('.field-map-cell').evaluateAll(es=>es.map(e=>{const a=e.getBoundingClientRect(),b=e.querySelector('.lunar-hit').getBoundingClientRect();return {w:a.width,h:a.height,rw:b.width,rh:b.height};}));
        check(bounds.every(b=>Math.abs(b.w-b.rw)<1&&Math.abs(b.h-b.rh)<1),label+' every interactive group has exactly its intended cell bounds');
      }

      report.svgTargetSizes.push({variant,lang,viewport:view,minimumCellPixels:minimumCell,meets44px:minimumCell>=44});
      if(variant==='after'&&view[0]<view[1])check(minimumCell>=44,label+' portrait rover cell target >=44px');
      // Existing short-landscape board scale is reported honestly, not certified as a 44px target.

      // Verify the real enabled scanner, not just its CSS box or a cropped screenshot.
      const scanner=p.locator('[data-field-action="scan"]');
      const scanPaint=await scanner.evaluate(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {enabled:!e.disabled,color:s.color,background:s.backgroundImage,coveredInInitialViewport:hit!==e&&!e.contains(hit),rect:{x:r.x,y:r.y,width:r.width,height:r.height},footerPosition:getComputedStyle(document.querySelector('#fieldMission .field-footer')).position};});
      const rgb=s=>(s.match(/[\d.]+/g)||[]).map(Number),luma=a=>a.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0),contrast=(a,b)=>(Math.max(luma(a),luma(b))+.05)/(Math.min(luma(a),luma(b))+.05);
      const stops=scanPaint.background.match(/rgba?\([^)]+\)/g)||[];
      const minimumContrast=stops.length?Math.min(...stops.map(s=>contrast(rgb(scanPaint.color),rgb(s)))):null;
      report.scanControls.push({variant,lang,viewport:view,...scanPaint,minimumContrast});
      if(variant==='after'){
        check(scanPaint.enabled,label+' scanner is enabled');
        check(minimumContrast!==null&&minimumContrast>=4.5,label+' scanner text contrast >=4.5:1 across gradient');
        if(view[0]===390&&view[1]===844)check(!scanPaint.coveredInInitialViewport,label+' scanner is uncovered on the initial phone screen');
        await scanner.scrollIntoViewIfNeeded();
        await assertFieldControlReachable(scanner,label+' scanner after scroll');
        check(true,label+' full scanner target accepts center and edge hits after scroll');
      }
      await scanner.click();
      check(await p.locator('[data-field-cell]').count()===36,label+' rover redraw retains all 36 cells');
      if(variant==='after')check(await p.locator('.lunar-cell').count()===36,label+' paint hooks remain on the rover cells');
      if(variant==='after'&&lang==='ru'&&view[0]===390&&view[1]===844){
        const initial=await p.evaluate(()=>MKTYField.snapshot()),targets=await p.evaluate(()=>FieldRules.layout(MKTYField.snapshot()).targets);
        for(const goal of targets){
          const route=await p.evaluate(goal=>{const s=MKTYField.snapshot(),b=FieldRules.layout(s),q=[[s.pos]],seen=new Set([s.pos]);while(q.length){const path=q.shift(),at=path.at(-1);if(at===goal)return path.slice(1);for(const n of [at-1,at+1,at-6,at+6])if(n>=0&&n<36&&!seen.has(n)&&!b.walls.includes(n)&&Math.abs(n%6-at%6)+Math.abs(Math.floor(n/6)-Math.floor(at/6))===1){seen.add(n);q.push([...path,n]);}}throw Error('fixture route not found');},goal);
          for(const cell of route){const beforeMove=await p.evaluate(()=>MKTYField.snapshot());await p.locator(`[data-field-cell="${cell}"]`).click();const afterMove=await p.evaluate(()=>MKTYField.snapshot());check(afterMove.pos===cell&&afterMove.moves===beforeMove.moves+1,label+' rendered target '+cell+' executes the original one-step move');}
          const checkpoint=await p.evaluate(()=>MKTYField.snapshot());check(checkpoint.collected.includes(goal),label+' collection state matches the reached data instrument');
          if(goal===targets[0])await capture(p,variant,lang,view,'chapter1-collected');
        }
        check((await p.evaluate(()=>MKTYField.snapshot())).collected.length===3,label+' all three distinct instruments are collectable');
        await capture(p,variant,lang,view,'chapter1-exit-ready');
        check((await p.evaluate(()=>MKTYField.snapshot())).errors===initial.errors,label+' art redraw introduced no move or scan errors');
      }

      await p.locator('#fieldPause').click();await p.locator('#fieldExit').click();
      await p.locator('[data-story-step="1"]').click();
      await capture(p,variant,lang,view,'chapter1-power');
      if(variant==='after')await metrics(p,label+'/power');
      if(lang==='ar')check(await p.locator('html').getAttribute('dir')==='rtl',label+' Arabic direction preserved');
    }catch(e){report.failures.push(label+': '+e.message);}finally{await ctx.close();}
  }
  // Every supported language is exercised at the narrow phone width, including long labels.
  for(const lang of languages){const {ctx,p}=await pageFor('after',lang,[320,568]);try{
    await home(p);await metrics(p,'all-locales/'+lang+'/home');
    await plan(p);await metrics(p,'all-locales/'+lang+'/plan');
  }catch(e){report.failures.push('all-locales/'+lang+': '+e.message);}finally{await ctx.close();}}
  check(report.screenshots.length===74,'74 actual browser screenshots: 72 before/after fixtures plus collected and exit-ready states');
  check(report.failures.length===0,'No fixture page errors or layout assertion failures');
})().catch(e=>{report.failures.push(e.message);process.exitCode=1;}).finally(async()=>{
  if(browser)await browser.close();server.close();
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
  const pairs=report.screenshots.filter(s=>s.variant==='after');
  fs.writeFileSync(path.join(out,'index.html'),'<!doctype html><meta charset="utf-8"><title>MOONKATTY source preview</title><style>body{margin:30px;background:#091f30;color:#eef5f6;font:16px system-ui}h1{font-weight:600}section{margin-block:32px}div{display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap}figure{margin:0}img{max-width:min(100%,568px);border:1px solid #496579}figcaption{margin:8px 0;color:#eace9d}</style><h1>MOONKATTY · actual source-build previews</h1><p>Before: reviewed PR45. After: proposed visual-only branch. Seeded local fixtures, not production or authenticated gameplay.</p>'+pairs.map(s=>`<section><h2>${s.screen} · ${s.lang} · ${s.width}×${s.height}</h2><div><figure><figcaption>BEFORE · PR45</figcaption><img src="${s.file.replace(/^after/,'before')}"></figure><figure><figcaption>AFTER · visual preview</figcaption><img src="${s.file}"></figure></div></section>`).join(''));
  console.log(JSON.stringify({screenshots:report.screenshots.length,checks:report.checks.length,failures:report.failures,out},null,2));
  if(report.failures.length)process.exitCode=1;
});
