/* Nine persistent chapter plans. Existing chapter controllers remain the final missions. */
window.MKTYStory=(()=>{
 'use strict';
 const P=StoryPlan,$=id=>document.getElementById(id),tr=(ru,en)=>window.MKTYI18n?window.MKTYI18n.tr(ru,en):(localStorage.getItem('mkty_lang')==='ru'?ru:en),pair=a=>tr(...a);
 const original={},entry={1:'openMission',2:'openMission2',3:'openLife3MemoryGate',4:'openMission4',5:'openMission5',6:'openMission6',7:'openMission7',8:'openMission8',9:'openMission9'};
 const key=n=>'mkty_story_plan_'+n+'_v1',done=n=>localStorage.getItem('mkty_life'+n)==='complete';let current=0,storageOK=true,navigation=0,routeState='idle',request=null;
 const root=document.createElement('section');root.id='storyPlan';root.className='screen story-plan';root.setAttribute('translate','no');root.dir='ltr';root.innerHTML=`<header class="story-head"><div><small id="storyEyebrow"></small><h1 id="storyTitle"></h1></div><button id="storyBack"></button></header><div class="story-cover"><span id="storyCoverLabel"></span><strong id="storyCoverNumber"></strong><p id="storyBrief"></p></div><div id="storySpatialMap" class="story-spatial-map"></div><div class="story-body"><div class="story-stats"><div><strong id="storyProgress"></strong><span id="storyProgressLabel"></span></div><div><strong id="storyTime"></strong><span id="storyTimeLabel"></span></div><div><strong id="storyTarget"></strong><span id="storyTargetLabel"></span></div></div><p id="storyHint" class="story-hint"></p><p id="storyRisk" class="story-risk" role="note"></p><div id="storySteps" class="story-steps"></div><button id="storyCore" class="story-primary"></button><button id="storyReplay" class="story-secondary"></button><button id="storyArchive" class="story-secondary" hidden></button><p id="storySave" class="story-save" role="status"></p></div>`;$('app').append(root);if($('expeditionEntry').compareDocumentPosition($('enterBtn'))&Node.DOCUMENT_POSITION_FOLLOWING)$('expeditionEntry').before($('enterBtn'));$('enterBtn').setAttribute('translate','no');
 function read(n){try{return P.restore(JSON.parse(localStorage.getItem(key(n))));}catch{return null;}}
 function write(s){try{localStorage.setItem(key(s.n),JSON.stringify(s));storageOK=window.MKTYStorage?.persistent!==false;return storageOK;}catch{storageOK=false;return false;}}
 function pending(n){const s=read(n);return !!s&&s.phase!=='complete';}
 function elapsed(s){let legacy=0;try{legacy=JSON.parse(localStorage.getItem('mkty_operations_'+s.n+'_v1'))?.seconds||0;}catch{}const finale=window.MKTYSpatialFinale?.read(s.n);const activeFinale=finale?(finale.seconds+(finale.checkpoint?.seconds||0)):0;return s.coreSeconds+legacy+activeFinale+Object.values(s.tasks).reduce((sum,t)=>sum+(t.seconds||0)+(t.checkpoint?.seconds||t.checkpoint?.run?.time||0),0);}
 function timeLabel(value){const v=Math.floor(value);return Math.floor(v/60)+':'+String(v%60).padStart(2,'0');}
 const requiresRoute=()=>window.MKTYRewards?.requiresRoute?.()===true;
 const account=()=>window.MKTYRewards?.accountScope?.()||'guest';
 const ready=n=>!requiresRoute()||window.MKTYRewards?.routeReady?.(n,read(n))===true;
 const checkpointKeys=n=>['mkty_operations_'+n+'_v1','mkty_campaign_checkpoint_'+n,'mkty_field_finale_'+n+'_v1',...(n===5?['mkty_reactor5_checkpoint_v2']:n===6?['mkty_liftoff6_checkpoint_v1']:[])];
 function archive(n){
  // Preserve the complete original run, including finale checkpoints, before a
  // replacement. Each archive has its own key; a later replay cannot erase it.
  const snapshot={};for(const k of [key(n),...checkpointKeys(n)]){const value=localStorage.getItem(k);if(value!==null)snapshot[k]=value;}
  if(!Object.keys(snapshot).length)return true;
  try{const data=JSON.stringify({version:1,chapter:n,account:account(),snapshot}),pointer='mkty_story_archive_latest_'+n,prior=localStorage.getItem(pointer);
   if(prior&&localStorage.getItem(prior)===data)return true;
   const name='mkty_story_archive_'+n+'_'+Date.now()+'_'+crypto.getRandomValues(new Uint32Array(1))[0];
   localStorage.setItem(name,data);if(window.MKTYStorage?.persistent===false||localStorage.getItem(name)!==data)return false;
   localStorage.setItem(pointer,name);return window.MKTYStorage?.persistent!==false;
  }catch{return false;}
 }
 function exportArchive(){const name=localStorage.getItem('mkty_story_archive_latest_'+current),data=name&&localStorage.getItem(name);if(!data)return;const url=URL.createObjectURL(new Blob([data],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='moonkatty-chapter-'+current+'-saved-route.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function onScreen(id){if(id!=='storyPlan'){navigation++;request=null;}}
 function ensureRoute(n,reset=false){
  const owner=account();if(request?.n===n&&request.owner===owner)return request.promise;
  if(reset&&!archive(n)){routeState='storage';render();return Promise.resolve(false);}
  const job={n,owner,token:++navigation,promise:null};request=job;routeState='loading';render();
  const active=()=>request===job&&navigation===job.token&&current===n&&owner===account()&&root.classList.contains('active');
  job.promise=(async()=>{try{
   const route=await window.MKTYRewards.prepareRoute(n,reset);
   if(!active())return false;
   let previous=read(n),state=previous;
   const matches=state&&state.seed===Number(route.seed)&&state.edition===2;
   const progressed=(localStorage.getItem(key(n))!==null&&!state)||(state&&(state.done.length||Object.keys(state.tasks).length||state.phase!=='operations'||state.coreSeconds))||checkpointKeys(n).some(k=>localStorage.getItem(k)!==null);
   if(!reset&&!matches&&progressed){routeState=archive(n)?'legacy':'storage';render();return false;}
   if(reset||!matches){state=P.fresh(n,Number(route.seed),2);if(!write(state)){routeState='storage';render();return false;}
    if(reset)for(const k of checkpointKeys(n))localStorage.removeItem(k);
   }
   if(!ready(n)){routeState='error';render();return false;}
   routeState='ready';render();if(state.phase==='core')openCore(n);return true;
  }catch(error){if(active()){routeState=['route_upgrade_required','route_changed'].includes(error.message)?(archive(n)?'legacy':'storage'):error.message==='storage'?'storage':'error';render();}return false;
  }finally{if(request===job)request=null;}})();return job.promise;
 }
 function open(n){
  if(n>1&&!done(n-1)){show('chapters');return;}
  if(window.MKTYPace&&!MKTYPace.gate(n))return;
  if(n===3&&!done(3)&&localStorage.getItem('mkty_life3_memory_verified')!=='yes'){original[3]();return;}
  // The existing ten-second code reveal must remain reachable immediately after chapter 1.
  if(n===1&&done(1)&&typeof remainingLife1CodeTime==='function'&&remainingLife1CodeTime()>0){original[1]();return;}
  current=n;localStorage.setItem('mkty_current_chapter',String(n));
  if(requiresRoute()){show('storyPlan');return ensureRoute(n);}
  let s=read(n);if(!s){s=P.fresh(n,crypto.getRandomValues(new Uint32Array(1))[0]);write(s);}routeState='ready';
  if(s.phase==='complete'){if(s.edition===1){openCore(n);return;}show('storyPlan');render();return;}if(s.phase==='core'){openCore(n);return;}
  show('storyPlan');render();
 }

 function menu(n){current=n;root.dir=window.MKTYI18n?.isRtl?.()?'rtl':'ltr';localStorage.setItem('mkty_current_chapter',String(n));show('storyPlan');render();}
 function render(){if(!current)return;const s=read(current)||P.fresh(current,0,2),blocked=requiresRoute()&&(!ready(current)||['loading','legacy','storage','error'].includes(routeState));const c=P.plan(current,s.edition||1);root.style.setProperty('--story-art',`url('art/${c.art}')`);$('storyEyebrow').textContent=tr('ГЛАВА ','CHAPTER ')+String(current).padStart(2,'0')+' / 09';$('storyTitle').textContent=pair(c.title);$('storyBack').textContent=tr('← Главы','← Chapters');$('storyCoverLabel').textContent=tr('ПЛАН ОПЕРАЦИИ','OPERATION PLAN');$('storyCoverNumber').textContent=String(current).padStart(2,'0');$('storyBrief').textContent=pair(c.brief);$('storyProgress').textContent=s.done.length+' / 8';$('storyProgressLabel').textContent=tr('ЭТАПЫ','STAGES');$('storyTime').textContent=timeLabel(elapsed(s));$('storyTimeLabel').textContent=tr('АКТИВНОЕ ВРЕМЯ','ACTIVE TIME');$('storyTarget').textContent=c.minutes.join('–');$('storyTargetLabel').textContent=tr('МИН · ЦЕЛЕВОЙ ТЕМП','MIN · PACING TARGET');$('storyHint').textContent=s.phase==='complete'?tr('Расширенная глава завершена. Все результаты сохранены.','Expanded chapter complete. All results are saved.'):tr('Выполните восемь этапов, затем финальную миссию. Доступные параллельные задачи можно решать в любом порядке.','Complete eight stages, then the final mission. Available parallel tasks can be completed in either order.');
  {const risk=$('storyRisk'),T=(en,v={})=>{let x=window.MKTYI18n?.t?MKTYI18n.t(en):en;for(const [k,val] of Object.entries(v))x=x.split('{'+k+'}').join(val);return x;},L=typeof getLifeBank==='function'?getLifeBank():9;risk.hidden=!window.MKTYPace||MKTYPace.bypass()||s.phase==='complete';risk.classList.toggle('free',current===1&&!done(1));risk.textContent=current===1&&!done(1)?T('🎓 Tutorial chapter: failures in your first LIFE #1 cost no lives. Lives: {n} / 9',{n:L}):T('⚠️ A failed board, flight or finale costs 1 ❤️ · training is free · Lives: {n} / 9',{n:L});}
  $('storySpatialMap').innerHTML=FieldArt.map(current,c.steps,s.done,i=>P.available(s,i));$('storySpatialMap').querySelectorAll('[data-map-step]').forEach(el=>{el.onclick=()=>{const id=Number(el.dataset.mapStep);if(!blocked&&P.available(s,id))openTask(current,id);};el.onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();el.click();}};});$('storyReplay').hidden=!done(current)&&!blocked;$('storyReplay').disabled=routeState==='loading';$('storyReplay').textContent=tr('НОВЫЙ МАРШРУТ ГЛАВЫ ↻','NEW CHAPTER ROUTE ↻');$('storySteps').replaceChildren(...c.steps.map(task=>{const b=document.createElement('button'),completed=s.done.includes(task.id),available=P.available(s,task.id),cp=s.tasks[task.id]?.checkpoint;b.type='button';b.dataset.storyStep=task.id;b.className='story-step '+(completed?'done':available?'available':'locked');b.disabled=blocked||!available;const type=task.kind==='field'?tr('ПОЛЕВАЯ ОПЕРАЦИЯ','FIELD OPERATION'):task.kind==='board'?({4:tr('НАВИГАЦИЯ','NAVIGATION'),5:tr('ЭНЕРГИЯ','POWER'),6:tr('ГРУЗ','PAYLOAD'),7:tr('ЗАЩИТА','DEFENCE'),8:tr('ДЕШИФРОВКА','DECODING'),9:tr('РЕСУРСЫ','RESOURCES')})[task.board]:task.simulation?tr('СИМУЛЯТОР','SIMULATION'):tr('ДИСТАНЦИОННЫЙ ВЫЛЕТ','REMOTE FLIGHT');b.innerHTML=`<span class="story-step-number">${completed?'✓':String(task.id+1).padStart(2,'0')}</span><span class="story-step-copy"><small>${type}</small><strong>${pair(task.title)}</strong><em>${completed?(s.tasks[task.id]?.performance?.precise?tr('Точное выполнение · без ошибок','Precise execution · no errors'):s.tasks[task.id]?.performance?tr('Завершено · коррекции: ','Completed · corrections: ')+s.tasks[task.id].performance.errors:tr('Завершено','Completed')):available?(cp?tr('Продолжить с сохранения','Resume saved progress'):tr('Готово к началу','Ready to begin')):tr('Сначала этапы ','Requires stages ')+task.requires.map(i=>String(i+1).padStart(2,'0')).join(' + ')}</em></span><span class="story-step-arrow">${completed?'':available?'↗':'—'}</span>`;b.onclick=()=>openTask(current,task.id);return b;}));
  $('storyCore').disabled=blocked||s.done.length!==8;$('storyCore').textContent=s.phase==='complete'?tr('ОТКРЫТЬ ФИНАЛ ГЛАВЫ','OPEN CHAPTER FINALE'):s.done.length===8?tr('ПЕРЕЙТИ К ФИНАЛЬНОЙ МИССИИ →','START FINAL MISSION →'):tr('ФИНАЛ ПОСЛЕ ВОСЬМИ ЭТАПОВ','FINALE AFTER EIGHT STAGES');$('storySave').textContent=storageOK?tr('Каждый ход и вылет сохраняются на этом устройстве. Указанный темп — ориентир первого прохождения, а не таймер.','Every move and flight is saved on this device. Pacing is a first-play target, not a timer.'):tr('Хранилище недоступно. Прогресс текущего этапа может не сохраниться.','Storage unavailable. This stage may not be saved.');
  if(blocked){$('storyHint').textContent=routeState==='loading'?tr('Получаем проверенный маршрут. Этапы откроются после сохранения ответа сервера.','Getting a verified route. Stages unlock after the server response is saved.'):routeState==='legacy'?tr('Этот маршрут сохранён в архиве на устройстве. Для награды выберите новый проверенный маршрут. Подтверждённые достижения и баланс сохранены.','This route is archived on this device. Choose a new verified route to earn its reward. Confirmed achievements and balance are preserved.'):routeState==='storage'?tr('Не удалось сохранить маршрут или архив. Восстановите сохранение на устройстве и повторите.','The route or archive could not be saved. Restore device saving, then retry.'):tr('Не удалось получить проверенный маршрут. Прогресс сохранён. Проверьте соединение и повторите.','Could not get a verified route. Progress is preserved. Check your connection and retry.');
   $('storyReplay').textContent=routeState==='legacy'?tr('СОХРАНИТЬ АРХИВ И НАЧАТЬ НОВЫЙ МАРШРУТ','KEEP ARCHIVE AND START A NEW ROUTE'):tr('ПОВТОРИТЬ ПОДКЛЮЧЕНИЕ','RETRY CONNECTION');}
  $('storyArchive').hidden=!localStorage.getItem('mkty_story_archive_latest_'+current);$('storyArchive').textContent=tr('СКАЧАТЬ СОХРАНЁННЫЙ МАРШРУТ','DOWNLOAD SAVED ROUTE');
 }
 function descriptor(n,id){if(!ready(n)||requiresRoute()&&routeState!=='ready')return null;const owner=account(),s=read(n),c=P.plan(n,s?.edition||1),task=c?.steps[id];if(!s||!task||!P.available(s,id))return null;const record=s.tasks[id]||{},attempt=Number.isInteger(record.attempt)?record.attempt:0;return {...task,chapter:n,art:c.art,seed:P.seedFor(s,id,attempt),save:checkpoint=>owner===account()&&read(n)?.seed===s.seed&&checkpointTask(n,id,checkpoint),complete:checkpoint=>{if(owner===account()&&read(n)?.seed===s.seed)finishTask(n,id,checkpoint);},exit:()=>{if(owner===account())menu(n);},retry:()=>{if(owner===account()&&read(n)?.seed===s.seed)retryFlight(n,id);}};}
 function openTask(n,id){const task=descriptor(n,id),token=navigation,owner=account(),screen=document.querySelector('.screen.active');if(!task)return;if(window.MKTYPace&&!task._risk){MKTYPace.risky(n,()=>{if(token!==navigation||owner!==account()||current!==n||document.querySelector('.screen.active')!==screen||!ready(n))return;task._risk=true;startTask(task,n,id);},task.simulation?'training':'phase');return;}startTask(task,n,id);}
 function startTask(task,n,id){if(!ready(n))return;const state=read(n);if(!state||task.seed!==P.seedFor(state,id,state.tasks[id]?.attempt||0))return;const saved=state.tasks[id]?.checkpoint;if(task.kind==='board')MKTYOps.openTask(task,saved);else if(task.kind==='field')MKTYField.open({...task,legacy:true},saved);else MKTYExpedition.openStory(task,saved);}
 function checkpointTask(n,id,checkpoint){const s=read(n);if(!s||!ready(n)||!P.available(s,id))return false;s.tasks[id]={...(s.tasks[id]||{}),kind:P.plan(n,s.edition||1).steps[id].kind,checkpoint};return write(s);}
 function finishTask(n,id,checkpoint){const s=read(n),task=descriptor(n,id);if(!s||!task)return;let seconds=0,hints=0,errors=0,performance=null;
  if(task.kind==='board'){if(checkpoint?.n!==task.board||checkpoint.round!==task.round||!Number.isInteger(checkpoint.seed))return;const b=MissionRules.board(task.board,task.round,checkpoint.seed);if(!MissionRules.validate(b,checkpoint.input)||!MissionRules.solved(b,checkpoint.input)||!checkpoint.confirmed)return;seconds=checkpoint.seconds;hints=checkpoint.hints;errors=checkpoint.errors;}
  else if(task.kind==='field'){const checked=FieldRules.restore(checkpoint,n,task.fieldStage,task.seed);if(!checked||!checked.complete||!FieldRules.won(checked))return;seconds=checked.seconds;errors=checked.errors;performance=FieldRules.performance(checked);}else{const checked=ExpeditionRules.restore(checkpoint),r=checked.run;if(!r||r.seed!==task.seed||r.type!==task.contract||r.tier!==task.tier||r.phase!=='result'||!r.report.success||!ExpeditionRules.ready(r)||ExpeditionRules.distance(r.ship,ExpeditionRules.BASE)>=105)return;seconds=r.time+(s.tasks[id]?.seconds||0);}
  s.done.push(id);s.tasks[id]={kind:task.kind,seconds,hints,errors,proof:checkpoint,...(performance?{performance}:{}),attempt:s.tasks[id]?.attempt||0};write(s);menu(n);
 }
 function retryFlight(n,id){const s=read(n);if(!s||!P.available(s,id))return;if(window.MKTYPace&&!MKTYPace.gate(n)&&!done(n))return;const previous=s.tasks[id]||{};s.tasks[id]={kind:'flight',attempt:(previous.attempt||0)+1,seconds:(previous.seconds||0)+(previous.checkpoint?.run?.time||0)};write(s);openTask(n,id);}
 function openCore(n,confirmed){if(!ready(n))return;const s=read(n);if(!s||s.done.length!==8){menu(n);return;}if(!confirmed&&window.MKTYPace&&s.phase!=='complete'&&!done(n)){const token=navigation,owner=account(),screen=document.querySelector('.screen.active');MKTYPace.risky(n,()=>{if(token===navigation&&owner===account()&&current===n&&document.querySelector('.screen.active')===screen)openCore(n,true);});return;}if(s.phase!=='complete'){s.phase='core';write(s);}original[n]();if(done(n)&&s.edition!==2&&(n<=3||!MKTYOps.pending(n)))complete(n);}
 function complete(n){const s=read(n);if(!s||s.done.length!==8||s.phase==='complete')return;s.phase='complete';write(s);}
 function coreReady(n){const s=read(n);return !!s&&ready(n)&&s.done.length===8;}
 function replay(n){
  if(request)return request.promise;
  current=n;show('storyPlan');
  if(requiresRoute())return ensureRoute(n,true);
  if(!archive(n)){routeState='storage';render();return;}
  for(const k of checkpointKeys(n))localStorage.removeItem(k);write(P.fresh(n,crypto.getRandomValues(new Uint32Array(1))[0],2));routeState='ready';menu(n);
 }
 $('storyArchive').onclick=exportArchive;
 $('storyReplay').onclick=()=>routeState==='legacy'||ready(current)?replay(current):ensureRoute(current);
 $('storyBack').onclick=()=>show('chapters');$('storyCore').onclick=()=>openCore(current);
 for(let n=1;n<=9;n++){const card=$('life'+n+'Complete'),button=document.createElement('button');button.className='story-secondary';button.setAttribute('translate','no');button.textContent=tr('НОВЫЙ МАРШРУТ ГЛАВЫ','NEW CHAPTER ROUTE');button.onclick=()=>replay(n);card?.append(button);original[n]=window[entry[n]];window[entry[n]]=()=>open(n);}
 const summary=document.createElement('div');summary.className='story-campaign-summary';summary.setAttribute('translate','no');$('chapterList').before(summary);
 function overview(){summary.innerHTML=`<strong>${tr('НОВЫЕ МИРЫ / 9 ГЛАВ','NEW WORLDS / 9 CHAPTERS')}</strong><span>${tr('9 пространств · 9 игровых специальностей','9 spaces · 9 mission disciplines')}</span><small>${tr('Одна новая глава в день: следующая открывается в 00:00 UTC. Вся история — около 9 дней.','One new chapter per day: the next one opens at 00:00 UTC. The full story takes about 9 days.')}</small>`;}
 overview();new MutationObserver(overview).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 setInterval(()=>{const active=document.querySelector('.screen.active'),n=Number(active?.id.match(/^mission([1-9])$/)?.[1]);if(!n||document.hidden||active.dataset.paused==='true'||window.MKTYExperience?.paused||document.querySelector('dialog[open]'))return;const s=read(n);if(!s||s.phase!=='core')return;s.coreSeconds++;write(s);},1000);
 queueMicrotask(()=>MKTYCampaign.render());return {open,menu,onScreen,pending,complete,coreReady,read,replay,isRun:n=>{const s=read(n);return s?.edition===2&&s.phase==='core';},afterCode:()=>{if(!coreReady(3))open(3);}};
})();
