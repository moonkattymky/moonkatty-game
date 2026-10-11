/* Native Chromium CI companion. Isolated guest storage and local production files.
 * Intentionally not runnable in environments that deny browser/socket execution.
 * The paused browser clock prevents the daily 2-second poll from masking failures. */
'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),os=require('node:os');
const out=process.env.MKTY_TEST_OUTPUT||fs.mkdtempSync(path.join(os.tmpdir(),'mkty-language-hot-switch-ui-'));fs.mkdirSync(out,{recursive:true});
const report={passed:false,steps:[],scope:'Isolated guest browser; synthetic storage; all external service requests blocked'};
const root=path.resolve(__dirname,'..'),labels={ru:'Русский',en:'English',ar:'العربية',he:'עברית'};
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.svg':'image/svg+xml','.png':'image/png'};
const server=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://local').pathname.replace(/^\/$/,'/index.html'));fs.readFile(file,(error,body)=>{res.writeHead(error?404:200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(error?'':body);});});
let browser,page,holdPacks=false;const held=new Map(),errors=[],remote=[];
const checkpoint=()=>page.evaluate(()=>Object.fromEntries(Array.from({length:localStorage.length},(_,i)=>localStorage.key(i)).filter(k=>k!==null&&k!=='mkty_lang').sort().map(k=>[k,localStorage.getItem(k)])));
async function installSelectionCapture(){await page.evaluate(()=>{const original=setLang;window.setLang=code=>(window.__languagePick=Promise.resolve(original(code)));});}
async function select(code){await page.evaluate(async({code,label})=>{document.getElementById('settingsBtn').click();document.querySelector('[data-hub="language"]').click();const button=[...document.querySelectorAll('#languages button')].find(b=>b.textContent.endsWith(label));if(!button)throw Error('Missing language '+code);button.click();await window.__languagePick;await Promise.resolve();},{code,label:labels[code]});assert.deepEqual(await page.evaluate(()=>({active:MKTYI18n.getLanguage(),html:document.documentElement.lang,saved:localStorage.getItem('mkty_lang')})),{active:code,html:code,saved:code},'picker applies and saves the requested language');}
async function assertUI(flash,video){
 const result=await page.evaluate(({flash,video})=>{
  const errors=[],language=MKTYI18n.getLanguage(),$=id=>document.getElementById(id),state=MKTYDaily._demoStatus();
  const t=(key,vars={})=>{let out=language==='en'?key:MKTYLocales[language].strings[key];if(typeof out!=='string')throw Error('Missing translation '+key);for(const[k,v]of Object.entries(vars))out=out.split('{'+k+'}').join(v);return out;};
  const same=(id,key,vars)=>{if($(id).textContent!==t(key,vars))errors.push({id,actual:$(id).textContent,expected:t(key,vars)});};
  same('dopsMode','DEMO · local preview — rewards verified only in Telegram');same('streakCount','Day {n}',{n:state.streak.streak});same('streakShield',state.streak.shield_available?'🛡 Shield ready — saves 1 missed day this week':'🛡 Shield used this week');
  same('streakBtn',state.streak.claimed_today?'CHECKED IN ✓':'CHECK IN +{n} ⭐',{n:state.streak.next_reward});same('cipherAttempts',state.cipher.solved?'Decoded ✓ +{n} ⭐':'Attempts left: {n} / {m}',{n:state.cipher.solved?15:state.cipher.attempts_left,m:5});same('cipherSubmit',state.cipher.solved?'SIGNAL DECODED ✓':'TRANSMIT ANSWER +{n} ⭐',{n:15});
  if(flash)same('dopsFlash',flash.key,flash.vars);if(video)same('ytMsg',video.key,video.vars);
  for(let n=1;n<=9;n++){const b=$('life'+n+'Complete').querySelector('.story-secondary');if(b.textContent!==t('NEW CHAPTER ROUTE'))errors.push({id:'life'+n+' replay',actual:b.textContent,expected:t('NEW CHAPTER ROUTE')});}
  if(document.documentElement.dir!==(['ar','he'].includes(language)?'rtl':'ltr'))errors.push('direction');
  return errors;
 },{flash,video});assert.deepEqual(result,[]);
}
async function switchMatrix(flash,video){const before=await checkpoint(),inputs=await page.evaluate(()=>['cipherText','ytCode','cipherInput','cipherTape'].map(id=>{const e=document.getElementById(id);return 'value'in e?e.value:e.textContent;}));for(const lang of ['ar','he','en','ru','he','ar','ru','en']){await select(lang);await assertUI(flash,video);assert.deepEqual(await checkpoint(),before,'selection preserves progress/rewards/cooldown/attempts');assert.deepEqual(await page.evaluate(()=>['cipherText','ytCode','cipherInput','cipherTape'].map(id=>{const e=document.getElementById(id);return 'value'in e?e.value:e.textContent;})),inputs);}}
async function waitHeld(code){const until=Date.now()+10000;while(!held.has(code)){if(Date.now()>until)throw Error('Locale request was not held: '+code);await new Promise(r=>setTimeout(r,10));}}
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
 page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'});page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname==='127.0.0.1'){const code=u.pathname.match(/\/locales\/runtime\/(ar|he)\.js$/)?.[1];if(holdPacks&&code){held.set(code,route);return;}return route.continue();}if(u.hostname==='telegram.org')return route.fulfill({contentType:'application/javascript',body:''});remote.push(u.href);return route.abort();});
 await page.addInitScript(()=>{if(!localStorage.getItem('mkty_lang'))localStorage.setItem('mkty_lang','ru');});
 await page.clock.install({time:new Date('2026-10-11T11:59:00Z')});await page.clock.pauseAt(new Date('2026-10-11T12:00:00Z'));
 await page.goto(url);await installSelectionCapture();await assertUI();
 await page.evaluate(()=>{document.getElementById('cipherText').value='M';document.getElementById('cipherText').dispatchEvent(new Event('input'));document.querySelector('[data-morse="."]').click();document.getElementById('ytCode').value='UNSENT';});
 await switchMatrix();report.steps.push('immediate full-picker hot switch preserves daily text, typed word, Morse input and code');
 await page.evaluate(()=>document.getElementById('cipherSubmit').click());const length=await page.evaluate(()=>MKTYDaily._demoStatus().cipher.length);await switchMatrix({key:'Need {n} letters',vars:{n:length}});
 const initialPoints=await page.evaluate(()=>Number(localStorage.getItem('mkty_points')||0));
 await page.evaluate(()=>document.getElementById('streakBtn').click());await switchMatrix({key:'Check-in +{n} ⭐',vars:{n:3}});
 assert.equal(await page.evaluate(()=>Number(localStorage.getItem('mkty_points'))),initialPoints+3);
 await page.evaluate(()=>{const state=MKTYDaily._demoStatus(),from=Object.fromEntries(Object.entries(MKTYDaily.MORSE).map(([k,v])=>[v,k]));document.getElementById('cipherText').value=state.cipher.morse.map(x=>from[x]).join('');document.getElementById('cipherSubmit').click();});
 await switchMatrix({key:'Signal decoded! +{n} ⭐',vars:{n:15}});
 await page.evaluate(()=>{document.getElementById('ytCode').value='MOONTEST';document.getElementById('ytBtn').click();});await switchMatrix({key:'Signal decoded! +{n} ⭐',vars:{n:15}},{key:'Code accepted! +{n} ⭐',vars:{n:5}});
 assert.equal(await page.evaluate(()=>Number(localStorage.getItem('mkty_points'))),initialPoints+23);report.steps.push('one check-in, cipher solve and code redemption total +23; retained result messages follow repeated language switches');
 // Finished original finale: hot-switch all nine CTA labels, then use its real click handler.
 await page.evaluate(()=>{const s=StoryPlan.fresh(1,7100,2);s.done=[0,1,2,3,4,5,6,7];s.phase='core';localStorage.setItem('mkty_story_plan_1_v1',JSON.stringify(s));MKTYStory.complete(1);localStorage.setItem('mkty_life1','complete');localStorage.setItem('mkty_life1_awarded','yes');localStorage.setItem('mkty_life1_code_presented','yes');localStorage.setItem('mkty_campaign_checkpoint_1','synthetic-finale-checkpoint');});
 await switchMatrix({key:'Signal decoded! +{n} ⭐',vars:{n:15}},{key:'Code accepted! +{n} ⭐',vars:{n:5}});
 const completed=await checkpoint();assert.equal(JSON.parse(completed.mkty_story_plan_1_v1).phase,'complete','snapshot reads real logical Storage keys');assert.equal(completed.mkty_campaign_checkpoint_1,'synthetic-finale-checkpoint');await page.evaluate(()=>document.querySelector('#life1Complete .story-secondary').click());
 const replay=await page.evaluate(()=>({plan:MKTYStory.read(1),archive:JSON.parse(localStorage.getItem(localStorage.getItem('mkty_story_archive_latest_1'))),points:localStorage.getItem('mkty_points'),done:localStorage.getItem('mkty_life1'),award:localStorage.getItem('mkty_life1_awarded')}));
 assert.equal(replay.plan.done.length,0);assert.equal(replay.archive.snapshot.mkty_story_plan_1_v1,completed.mkty_story_plan_1_v1);assert.equal(replay.archive.snapshot.mkty_campaign_checkpoint_1,completed.mkty_campaign_checkpoint_1);assert.equal(replay.points,completed.mkty_points);assert.equal(replay.done,'complete');assert.equal(replay.award,'yes');report.steps.push('all nine finale CTA labels translate; chapter1 replay archives the original run and preserves achievements/balance');
 for(const lang of ['ru','en','ar','he']){await select(lang);const before=await checkpoint();await page.reload();await installSelectionCapture();await assertUI();assert.deepEqual(await checkpoint(),before,'reload preserves saved state');}
 report.steps.push('saved RU/EN/AR/HE reloads preserve progress, attempts and rewards');
 // Fresh document, so Arabic/Hebrew packs can be delivered in reverse order.
 await select('ru');await page.reload();await installSelectionCapture();holdPacks=true;
 await page.evaluate(()=>{window.__older=setLang('ar');window.__newer=setLang('he');});await waitHeld('ar');await waitHeld('he');
 await held.get('he').continue();await page.evaluate(()=>window.__newer);await held.get('ar').continue();await page.evaluate(()=>window.__older);holdPacks=false;
 assert.equal(await page.evaluate(()=>MKTYI18n.getLanguage()),'he');assert.equal(await page.evaluate(()=>localStorage.getItem('mkty_lang')),'he');await assertUI();
 assert.deepEqual(errors,[]);assert(!remote.some(x=>x.includes('supabase.co')),'guest switching makes no backend requests');
 report.steps.push('late Arabic pack cannot replace the newer Hebrew selection');report.passed=true;
 console.log('PASS: actual language buttons and production scripts; paused polling, RU/EN/AR/HE, daily input/actions/results, all9 finale CTA labels/click replay, reload and out-of-order pack completion');
})().catch(async error=>{report.failure=error.stack;console.error(error);process.exitCode=1;await page?.screenshot({path:path.join(out,'failure.png'),fullPage:true,animations:'disabled',timeout:5000}).catch(()=>{});}).finally(async()=>{fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({...report,errors,blockedExternalRequests:remote},null,2));for(const route of held.values())await route.abort().catch(()=>{});await browser?.close();await new Promise(resolve=>server.close(resolve));});
