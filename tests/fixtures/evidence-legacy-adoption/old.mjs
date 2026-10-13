// TEST ONLY. No injected partial checkpoint. The original save closure writes it.
import '/story-plan.js';
import '/field-model.js';
const S=window.__legacyNative,$=id=>document.getElementById(id),SOURCE='mkty_field_finale_9_v1';
const counters={award:0,reward:0,original:0,complete:0},inputs=[],loads=[];
const tripwire=kind=>()=>{counters[kind]++;throw Error('Forbidden old '+kind);};
window.Telegram={WebApp:{initData:''}};
window.openMission8=tripwire('original');window.openMission9=tripwire('original');window.awardLifePoints=tripwire('award');
window.MKTYRewards={completeLife:tripwire('reward'),call:tripwire('reward')};
window.show=id=>{document.querySelectorAll('.screen').forEach(el=>el.classList.toggle('active',el.id===id));window.MKTYField?.onScreen(id);};
window.MKTYStory=Object.freeze({read(n){return JSON.parse(localStorage.getItem('mkty_story_plan_'+n+'_v1'));}});
const story={...StoryPlan.fresh(9,998877,2),createdAt:1467890123456,phase:'core',done:[0,1,2,3,4,5,6,7],tasks:{},coreSeconds:123.25,unknown:{source:'synthetic prior tasks',units:'界🌙\ud800'}};
const values={mkty_story_plan_9_v1:JSON.stringify(story,null,2),[SOURCE]:JSON.stringify({version:1,n:9,phase:2,seed:481517,seconds:37.75,unknown:{preserve:'envelope bytes'}}),
  mkty_points:'004237.500',mkty_daily_demo:' {"last_day":"2026-09-29","streak":7,"attempts":1,"solved":false,"codes":["ORIGINAL"],"opaque":"界🌙\\ud800"} ',
  mkty_operations_9_v1:' {"version":1,"n":9,"seed":419377,"round":3,"phase":"core","input":[7,2,9],"confirmed":true,"actions":43,"hints":3,"errors":4,"seconds":91.75,"opaque":"preserve this spelling"} ',
  mkty_current_chapter:'9',mkty_lang:'en',mkty_control_sound:'no',mkty_story_history_1:'synthetic unrelated history sentinel',
  'mkty_account_v3_314159:mkty_points':'foreign account sentinel',mkty_pending_v2_314159:'foreign queue sentinel'};
for(const [key,value] of Object.entries(values))localStorage.setItem(key,value);
async function script(src){loads.push(src);await new Promise((resolve,reject)=>{const el=document.createElement('script');el.src=src;el.onload=resolve;el.onerror=()=>reject(Error('old-script-load:'+src));document.head.append(el);});}
try {
  await script('/field-art.js');await script('/field-missions.js');await script('/chapter-space.js');
  document.addEventListener('click',e=>{if(e.target.closest('#fieldMission')){if(inputs.length>=32)throw Error('old-input-limit');inputs.push({trusted:e.isTrusted,target:e.target.id,action:e.target.closest('[data-field-action]')?.dataset.fieldAction||null});}},{capture:true});
  $('oldStart').onclick=()=>{MKTYSpatialFinale.open(9);$('oldStatus').textContent='Original chapter-space callback is active.';};
  window.H={facts(){return {counters:{...counters},inputs:structuredClone(inputs),loads:[...loads],checkpoint:MKTYField.snapshot(),source:S.inspect(SOURCE),storage:structuredClone(S.rows),syntheticPrerequisites:true,partialCheckpointInjected:false,legacyLoaded:!!window.MKTYLegacy};}};
  window.legacyOldReady=true;
}catch(error){window.legacyOldError=String(error.stack||error);window.legacyOldReady=true;}
