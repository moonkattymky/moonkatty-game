/* Isolated native browser fixture: real index and all shipped controllers/model/art/CSS, synthetic task only.
 * Requests are fulfilled from this checkout; no server, Telegram, account or rewards backend.
 * This fixture never marks campaign prerequisites complete. Gameplay starts from R.create(). */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),origin='https://triangulation.test';
const baseline='tests/fixtures/triangulation-baseline-field-missions.js';
const baselineHash='87ae7505443efcaa76ec1cf8c9b0293493a8d3b32ded761d08f8fae280bbf168';
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml'};
const bootstrap=`
window.__inputEvents=[];window.__completed=[];window.__exits=0;
for(const type of ['pointerdown','touchstart','mousedown','keydown','input'])document.addEventListener(type,e=>__inputEvents.push({type,key:e.key,trusted:e.isTrusted,slider:e.target.dataset?.fieldSlider,action:e.target.dataset?.fieldAction,id:e.target.id}),true);
const home=document.createElement('section');home.id='fixtureHome';home.className='screen';home.innerHTML='<button id="fixtureReopen">Reopen saved operation</button>';document.getElementById('app').append(home);
window.__fixtureOpen=()=>{const saved=JSON.parse(localStorage.getItem('triangulation-fixture-save')||'null');MKTYField.open({chapter:8,id:0,fieldStage:2,seed:7319,title:['Триангуляция','Triangulation'],save:s=>localStorage.setItem('triangulation-fixture-save',JSON.stringify(s)),complete:s=>{__completed.push(s);show('fixtureHome');},exit:()=>{__exits++;show('fixtureHome');}},saved);};
document.getElementById('fixtureReopen').onclick=__fixtureOpen;
__fixtureOpen();`;
module.exports=async function fixture(browser,{baseline:useBaseline=false,lang='en',width=390,height=844}={}){
 if(useBaseline)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,baseline))).digest('hex'),baselineHash,'captured baseline is byte-identical to pre-fix controller');
 const context=await browser.newContext({viewport:{width,height},hasTouch:true,reducedMotion:'reduce',serviceWorkers:'block'}),page=await context.newPage(),errors=[],blocked=[];
 page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install({time:new Date('2026-10-11T12:00:00Z')});await page.clock.pauseAt(new Date('2026-10-11T12:00:01Z'));
 await page.addInitScript(language=>localStorage.setItem('mkty_lang',language),lang);
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.origin!==origin){blocked.push(url.href);if(url.hostname==='telegram.org')return route.fulfill({contentType:'application/javascript',body:''});return route.abort();}
  const source=url.pathname==='/'?'/index.html':useBaseline&&url.pathname==='/field-missions.js'?'/'+baseline:url.pathname;
  const file=path.resolve(root,'.'+source);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});
  return route.fulfill({contentType:mime[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});
 });
 async function open(){await page.evaluate(()=>mktyAuthPromise);await page.waitForFunction(language=>MKTYI18n.getLanguage()===language&&(language==='en'||MKTYI18n.hasLocale(language)),lang);await page.evaluate(bootstrap);await page.locator('#fieldDialog[open]').waitFor();}
 await page.goto(origin);await open();
 return {page,context,errors,blocked,open};
};
