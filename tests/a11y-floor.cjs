/* Launch accessibility floor: no HTML text below 11px and no HTML control below 44×44px.
   1) static: every CSS font-size / font shorthand / clamp() minimum outside SVG rules is >= 11px;
   2) browser: home, chapters and every chapter (plan, first stage intro + play, finale) at 390×844, 320×568, 568×320. */
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..'),MIN_FONT=11,MIN_TAP=44;
// ---- static CSS scan
const bad=[];
for(const f of fs.readdirSync(root).filter(f=>f.endsWith('.css'))){const css=fs.readFileSync(path.join(root,f),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
 for(const m of css.matchAll(/([^{}]*)\{([^{}]*)\}/g)){const sel=m[1].trim();if(/\bsvg\b|\btext\b|tspan|^(from|to|\d+%)/i.test(sel))continue;
  for(const d of m[2].matchAll(/(font-size|font)\s*:\s*([^;}]+)/g)){const val=d[2];const sizes=d[1]==='font'?[...val.matchAll(/(?<![\d.])(\d+(?:\.\d+)?)px(?=[\/\s])/g)].map(x=>+x[1]):[...val.matchAll(/(\d+(?:\.\d+)?)px/g)].map(x=>+x[1]);
   for(const v of sizes)if(v>0&&v<MIN_FONT)bad.push(`${f}: ${sel.slice(0,60)} { ${d[0].trim()} }`);}}}
assert.deepEqual(bad,[],'CSS font sizes below '+MIN_FONT+'px:\n'+bad.join('\n'));
assert(/href="touch\.css\?v=/.test(fs.readFileSync(path.join(root,'index.html'),'utf8')),'touch.css must be linked');
// ---- browser scan
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.json':'application/json'};
const server=http.createServer((req,res)=>{const file=path.join(root,decodeURIComponent(new URL(req.url,'http://a').pathname).replace(/^\/$/,'/index.html'));fs.readFile(file,(err,b)=>{res.writeHead(err?404:200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(err?'':b);});});
const metrics=([minFont,minTap])=>{const out=[];const act=document.querySelector('dialog[open]')||document.querySelector('.screen.active');if(!act)return out;
 const visible=e=>{const r=e.getBoundingClientRect();if(!r.width||!r.height)return false;const cs=getComputedStyle(e);return cs.visibility!=='hidden'&&cs.display!=='none'&&+cs.opacity>0.05&&e.offsetParent!==null;};
 for(const e of act.querySelectorAll('*')){if(e.closest('svg')||!visible(e))continue;
  const own=[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim().length>0);const fs=parseFloat(getComputedStyle(e).fontSize);
  if(own&&fs>0&&fs<minFont-0.05)out.push(`font ${fs}px: ${e.tagName}.${e.className} "${e.textContent.trim().slice(0,30)}"`);
  if(e.matches('button,[role=button],a.sv-link')&&!e.disabled){const r=e.getBoundingClientRect();if(r.width<minTap-0.5||r.height<minTap-0.5)out.push(`tap ${r.width|0}x${r.height|0}: ${e.tagName}#${e.id}.${e.className} "${(e.textContent||e.getAttribute('aria-label')||'').trim().slice(0,30)}"`);}}
 return out;};
(async()=>{await new Promise(r=>server.listen(0,r));const url='http://localhost:'+server.address().port+'/';
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});const fails=[];let checks=0;
 try{for(const [w,h] of [[390,844],[320,568],[568,320]]){
  const ctx=await browser.newContext({viewport:{width:w,height:h},isMobile:true,hasTouch:true});const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(String(e)));
  await p.route('https://telegram.org/js/telegram-web-app.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
  await p.route('**/functions/v1/**',r=>r.fulfill({status:503,contentType:'application/json',body:'{"ok":false}'}));
  await p.route('**/*.mp4',r=>r.fulfill({status:204,body:''}));
  await p.addInitScript(()=>{if(sessionStorage.getItem('a11y'))return;sessionStorage.setItem('a11y','1');localStorage.setItem('mkty_lang','en');localStorage.setItem('mkty_test_no_pacing','yes');});
  await p.goto(url);await p.waitForTimeout(600);
  const rec=async tag=>{await p.waitForTimeout(250);const out=await p.evaluate(metrics,[MIN_FONT,MIN_TAP]);checks++;for(const o of out)fails.push(`${w}x${h} ${tag}: ${o}`);};
  await p.evaluate(()=>show('home'));await rec('home');const dailyInk=await p.locator('.dops-title small').evaluateAll(es=>es.map(e=>({font:parseFloat(getComputedStyle(e).fontSize),color:getComputedStyle(e).color})));assert(dailyInk.length>0&&dailyInk.every(x=>x.font>=13&&x.color==='rgb(184, 202, 219)'),'daily instructions keep readable size and contrast');await p.evaluate(()=>show('chapters'));await rec('chapters');
  for(let n=1;n<=9;n++)for(const step of ['plan',0,'finale']){
   await p.evaluate(([n,step])=>{document.querySelectorAll('dialog[open]').forEach(d=>d.close());show('chapters');for(let i=1;i<=9;i++){if(i<n)localStorage.setItem('mkty_life'+i,'complete');else localStorage.removeItem('mkty_life'+i);}
    localStorage.setItem('mkty_life1_code_presented','yes');localStorage.setItem('mkty_life3_memory_verified','yes');localStorage.setItem('mkty_legacy_v1',JSON.stringify({version:1,lead:'scout',airlock:'cargo',events:{1:'scan',3:'shield',4:'north',5:'vent',6:'clear',7:'rescue',9:'wait'}}));
    for(let k=1;k<=9;k++)localStorage.removeItem('mkty_field_'+k+'_v1');const s=StoryPlan.fresh(n,900+n,2);if(step==='finale')s.done=[0,1,2,3,4,5,6,7];localStorage.setItem('mkty_story_plan_'+n+'_v1',JSON.stringify(s));MKTYStory.menu(n);},[n,step]);
   if(step==='plan'){await rec(`c${n}-plan`);continue;}
   if(step==='finale')await p.locator('#storyCore').click();else await p.locator('[data-story-step="0"]').click();
   await rec(`c${n}-${step}-intro`);
   for(let k=0;k<3;k++){const clicked=await p.evaluate(()=>{for(const id of ['fieldResume','skipBtn','opResume','expResume']){const e=document.getElementById(id);if(e&&e.offsetParent){e.click();return id;}}const d=document.querySelector('dialog[open]');if(d){const bt=[...d.querySelectorAll('button')].find(x=>x.offsetParent&&!/exit|plan|cancel|back|chapters/i.test(x.id+x.innerText));if(bt){bt.click();return bt.id||'dlg';}}return null;});if(!clicked)break;await p.waitForTimeout(400);}
   await rec(`c${n}-${step}`);}
  assert.deepEqual(errors,[],`${w}x${h} page errors`);await ctx.close();}
 }finally{await browser.close();server.close();}
 assert.deepEqual([...new Set(fails)],[],'a11y floor violations');
 console.log(`a11y floor OK: CSS >= ${MIN_FONT}px, ${checks} screens across 3 viewports with text >= ${MIN_FONT}px and controls >= ${MIN_TAP}px`);
})().catch(e=>{console.error(e.message.slice(0,4000));process.exit(1);});
