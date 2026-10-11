/* Real production locale-loader/i18n/daily/story scripts; synthetic state, no sockets.
 * Run against an unchanged checkout with MKTY_LANGUAGE_TEST_ROOT for before evidence. */
'use strict';
const assert=require('node:assert/strict');
const {harness,P}=require('./language-hot-switch-helper.cjs');
const languages=['ru','ar','he','en','he','ru','ar','en'];
const snapshots=h=>JSON.stringify([...h.saved].filter(([k])=>k!=='mkty_lang').sort(([a],[b])=>a.localeCompare(b)));
const expected=(h,key,vars={})=>{const lang=h.ctx.MKTYI18n.getLanguage();let text=lang==='en'?key:h.ctx.MKTYLocales[lang].strings[key];assert.equal(typeof text,'string',lang+' missing existing translation '+key);for(const[k,v]of Object.entries(vars))text=text.split('{'+k+'}').join(v);return text;};
const same=(h,id,key,vars)=>assert.equal(h.get(id).textContent,expected(h,key,vars),`${h.ctx.MKTYI18n.getLanguage()} #${id}`);
function daily(h){
 const state=h.ctx.MKTYDaily._demoStatus(),s=state.streak,c=state.cipher;
 same(h,'dopsMode','DEMO · local preview — rewards verified only in Telegram');
 same(h,'streakCount','Day {n}',{n:s.streak});
 same(h,'streakShield',s.shield_available?'🛡 Shield ready — saves 1 missed day this week':'🛡 Shield used this week');
 same(h,'streakBtn',s.claimed_today?'CHECKED IN ✓':'CHECK IN +{n} ⭐',{n:s.next_reward});
 same(h,'cipherAttempts',c.solved?'Decoded ✓ +{n} ⭐':'Attempts left: {n} / {m}',{n:c.solved?c.points:c.attempts_left,m:5});
 same(h,'cipherSubmit',c.solved?'SIGNAL DECODED ✓':c.attempts_left<=0?'NO ATTEMPTS — NEW SIGNAL AT 00:00 UTC':'TRANSMIT ANSWER +{n} ⭐',{n:c.points});
 assert.equal(h.get('streakBtn').disabled,s.claimed_today);
 assert.equal(h.get('cipherSubmit').disabled,c.solved||c.attempts_left<=0);
}
async function switchPreserved(h,check=()=>{}){
 const before=snapshots(h),input=h.get('cipherText').value,code=h.get('ytCode').value,morse=h.get('cipherInput').textContent,tape=h.get('cipherTape').textContent,intervals=h.intervals.length;
 for(const lang of languages){await h.select(lang);assert.equal(h.ctx.MKTYI18n.getLanguage(),lang);assert.equal(h.document.documentElement.dir,['ar','he'].includes(lang)?'rtl':'ltr');assert.equal(snapshots(h),before,'language refresh must not mutate gameplay/storage');assert.equal(h.get('cipherText').value,input);assert.equal(h.get('ytCode').value,code);assert.equal(h.get('cipherInput').textContent,morse);assert.equal(h.get('cipherTape').textContent,tape);assert.equal(h.intervals.length,intervals);check();}
}
const tests={
 async daily(){
  let h=harness();await h.flush();daily(h);
  h.saved.set('mkty_global_lives','7');h.saved.set('mkty_next_life_at','1791766800000');
  h.get('cipherText').value='M';h.get('cipherText').dispatchEvent({type:'input'});h.get('dailyOps').querySelector('[data-morse="."]').click();h.get('ytCode').value='UNSENT';
  await switchPreserved(h,()=>daily(h));
  h.get('cipherSubmit').click();await h.flush();const length=h.ctx.MKTYDaily._demoStatus().cipher.length;
  await switchPreserved(h,()=>{daily(h);same(h,'dopsFlash','Need {n} letters',{n:length});});
  const beforePoints=Number(h.saved.get('mkty_points')||0);h.get('streakBtn').click();await h.flush();assert.equal(Number(h.saved.get('mkty_points')),beforePoints+3);
  await switchPreserved(h,()=>{daily(h);same(h,'dopsFlash','Check-in +{n} ⭐',{n:3});});
  h.get('streakBtn').click();await h.flush();assert.equal(Number(h.saved.get('mkty_points')),beforePoints+3,'disabled repeat check-in never awards twice');
  h.get('cipherText').value='X'.repeat(length);h.get('cipherSubmit').click();await h.flush();assert.equal(h.ctx.MKTYDaily._demoStatus().cipher.attempts_left,4);
  await switchPreserved(h,()=>{daily(h);same(h,'dopsFlash','Wrong word — signal distorted');});
  const from=Object.fromEntries(Object.entries(h.ctx.MKTYDaily.MORSE).map(([k,v])=>[v,k]));h.get('cipherText').value=h.ctx.MKTYDaily._demoStatus().cipher.morse.map(x=>from[x]).join('');h.get('cipherSubmit').click();await h.flush();assert.equal(h.ctx.MKTYDaily._demoStatus().cipher.solved,true);
  await switchPreserved(h,()=>{daily(h);same(h,'dopsFlash','Signal decoded! +{n} ⭐',{n:15});});
  for(const [code,key,points]of [['','Enter the code word from the video',0],['BADCODE','Unknown or expired code',0],['MOONTEST','Code accepted! +{n} ⭐',5],['MOONTEST','You already used this code',0]]){
   const old=Number(h.saved.get('mkty_points'));h.get('ytCode').value=code;h.get('ytBtn').click();await h.flush();assert.equal(Number(h.saved.get('mkty_points')),old+points);await switchPreserved(h,()=>{daily(h);same(h,'ytMsg',key,{n:5});});
  }
  assert.equal(Number(h.saved.get('mkty_points')),beforePoints+23);
  for(const lang of ['ru','en','ar','he']){await h.select(lang);const before=snapshots(h);h=harness(h.saved);await h.flush();daily(h);assert.equal(snapshots(h),before,'reload preserves claimed/solved/results/lives/cooldown');}
 },
 async replay(){
  const h=harness();await h.flush();const buttons=Array.from({length:9},(_,i)=>h.get('life'+(i+1)+'Complete').children.at(-1));
  const s=P.fresh(1,1234,2);s.done=[0,1,2,3,4,5,6,7];s.phase='core';s.coreSeconds=37;h.saved.set('mkty_story_plan_1_v1',JSON.stringify(s));h.ctx.MKTYStory.complete(1);h.saved.set('mkty_life1','complete');h.saved.set('mkty_life1_awarded','yes');h.saved.set('mkty_points','500');h.saved.set('mkty_campaign_checkpoint_1','synthetic-checkpoint');
  h.show('mission1');await h.flush();await switchPreserved(h,()=>{buttons.forEach(b=>assert.equal(b.textContent,expected(h,'NEW CHAPTER ROUTE')));assert.equal(h.active(),'mission1');});
  const original=h.saved.get('mkty_story_plan_1_v1');buttons[0].click();await h.flush();assert.equal(h.active(),'storyPlan');assert.equal(h.ctx.MKTYStory.read(1).done.length,0);assert.equal(h.ctx.MKTYStory.read(1).edition,2);assert.equal(h.saved.get('mkty_points'),'500');assert.equal(h.saved.get('mkty_life1'),'complete');assert.equal(h.saved.get('mkty_life1_awarded'),'yes');
  const archive=h.saved.get('mkty_story_archive_latest_1'),record=JSON.parse(h.saved.get(archive));assert.equal(record.snapshot.mkty_story_plan_1_v1,original);assert.equal(record.snapshot.mkty_campaign_checkpoint_1,'synthetic-checkpoint');
  await switchPreserved(h,()=>buttons.forEach(b=>assert.equal(b.textContent,expected(h,'NEW CHAPTER ROUTE'))));
  for(const lang of ['ru','en','ar','he']){await h.select(lang);const reloaded=harness(h.saved);await reloaded.flush();for(let n=1;n<=9;n++)assert.equal(reloaded.get('life'+n+'Complete').children.at(-1).textContent,expected(reloaded,'NEW CHAPTER ROUTE'));assert.equal(reloaded.saved.get(archive),h.saved.get(archive));}
 },
 async ordering(){
  const h=harness();await h.flush();const events=[];h.ctx.addEventListener('mkty:language',()=>events.push(h.ctx.MKTYI18n.getLanguage()));
  h.storage.setItem('mkty_lang','ar');const first=h.ctx.MKTYI18n.setLanguage('ar');h.storage.setItem('mkty_lang','he');const last=h.ctx.MKTYI18n.setLanguage('he');
  assert.equal(h.ctx.MKTYI18n.getLanguage(),'ru','keep the active pack while loading');
  h.load('he');await last;await h.flush();assert.equal(h.ctx.MKTYI18n.getLanguage(),'he');h.load('ar');await first;await h.flush();assert.equal(h.ctx.MKTYI18n.getLanguage(),'he','a late superseded pack must not override the latest selection');assert.deepEqual(events,['he']);daily(h);
  const repeated=harness();await repeated.flush();const repeatFirst=repeated.ctx.MKTYI18n.setLanguage('ar'),repeatLast=repeated.ctx.MKTYI18n.setLanguage('ar');assert.equal(repeated.scripts.filter(s=>s.src?.includes('/ar.js')).length,1);repeated.load('ar');await Promise.all([repeatFirst,repeatLast]);await repeated.flush();assert.equal(repeated.ctx.MKTYI18n.getLanguage(),'ar');daily(repeated);
  const c=harness(new Map([['mkty_lang','en']]));await c.flush();const pending=c.ctx.MKTYI18n.setLanguage('ar');c.ctx.MKTYI18n.setLanguage('en');c.load('ar');await pending;await c.flush();assert.equal(c.ctx.MKTYI18n.getLanguage(),'en','switching back to a loaded language cancels an old load');
  const failed=harness();await failed.flush();const old=failed.ctx.MKTYI18n.setLanguage('ar'),latest=failed.ctx.MKTYI18n.setLanguage('he');failed.scripts.find(s=>s.src?.includes('/he.js')).onerror();await latest;failed.load('ar');await old;await failed.flush();assert.equal(failed.ctx.MKTYI18n.getLanguage(),'ru','failed latest choice does not revive an older choice');await failed.select('he');assert.equal(failed.ctx.MKTYI18n.getLanguage(),'he');daily(failed);
 },
 async selection(){
  const h=harness();await h.flush();for(const code of languages){await h.selectApp(code);daily(h);assert.equal(h.saved.get('mkty_lang'),code);assert.equal(h.ctx.MKTYI18n.getLanguage(),code);assert.equal(h.active(),'home');}
  const startup=harness(new Map([['mkty_lang','ar']]),{preloadSaved:false});await startup.flush();const newer=startup.ctx.setLang('he');startup.load('he');await newer;startup.load('ar');await startup.flush();assert.equal(startup.ctx.MKTYI18n.getLanguage(),'he','an initial pending saved-pack load cannot overwrite a later selection');daily(startup);
  const failed=harness();await failed.flush();const request=failed.ctx.setLang('he');failed.scripts.find(s=>s.src?.includes('/he.js')).onerror();await request;await failed.flush();
  // Existing app behavior is explicitly documented, not claimed as fixed here:
  // preference/hero/lang change immediately even if fetching the new pack fails.
  assert.equal(failed.ctx.MKTYI18n.getLanguage(),'ru');assert.equal(failed.saved.get('mkty_lang'),'he');assert.equal(failed.document.documentElement.lang,'he');
  await failed.selectApp('he');daily(failed);assert.equal(failed.ctx.MKTYI18n.getLanguage(),'he');
 },
 async requests(){
  const h=harness();await h.flush();const calls=[];let release;
  const status={ok:true,...h.ctx.MKTYDaily._demoStatus(),demo:false};h.ctx.Telegram={WebApp:{initData:'synthetic-test-only'}};h.ctx.MKTYRewards={call:async(action,payload)=>{calls.push({action,payload});if(action==='daily.status')return status;if(action==='streak.checkin')return new Promise(resolve=>{release=()=>{status.streak.claimed_today=true;resolve({awarded:true,points:3});};});throw Error('Unexpected action '+action);}};
  await h.ctx.MKTYDaily.reload();await h.flush();assert.equal(calls.length,1);h.get('streakBtn').click();await h.flush();assert.equal(calls.length,2);assert.equal(h.get('streakBtn').disabled,true);
  await switchPreserved(h,()=>{same(h,'dopsMode','SERVER VERIFIED · Telegram');assert.equal(h.get('streakBtn').disabled,true);});assert.equal(calls.length,2,'switches are pure renders, not status/reward requests');
  release();await h.flush();assert.equal(calls.length,3);await switchPreserved(h,()=>same(h,'dopsFlash','Check-in +{n} ⭐',{n:3}));assert.equal(calls.length,3);assert.equal(h.get('dailyOps').events.get('click').length,1,'no duplicate handlers after repeated switching');
 }
};
(async()=>{let failed=0;for(const[name,run]of Object.entries(tests)){if(process.argv[2]&&process.argv[2]!==name)continue;try{await run();console.log('PASS language hot-switch: '+name);}catch(error){failed++;console.error('FAIL language hot-switch: '+name+'\n'+error.stack);}}if(failed)process.exitCode=1;})().catch(error=>{console.error(error);process.exitCode=1;});
