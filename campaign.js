/* Campaign navigation and local checkpoints for all playable chapters. */
window.MKTYCampaign=(()=>{
 const titles=['THE AWAKENING','THE CREW','THE LAUNCH CODE','THE DESCENT','IGNITION','LIFTOFF','THE VOID','THE SIGNAL','THE RETURN'];
 const key=n=>'mkty_campaign_checkpoint_'+n;
 const done=n=>localStorage.getItem('mkty_life'+n)==='complete';
 const unlocked=n=>n===1||done(n-1);
 let current=0,restoring=false;
 const tr=(ru,en)=>window.MKTYI18n?window.MKTYI18n.tr(ru,en):(localStorage.getItem('mkty_lang')==='ru'?ru:en);
 function read(n){try{const v=JSON.parse(localStorage.getItem(key(n))||'null');return v?.version===1?v:null;}catch{return null;}}
 function save(){
  if(restoring||!current||current===5||current===6)return;
  if(done(current)&&!window.MKTYOps?.isRun(current)&&!window.MKTYStory?.isRun(current)){localStorage.removeItem(key(current));return;}
  if(current===7){window.Void7?.save();return;}
  let v={version:1};
  if(current>=8){v=window.MKTYContinuation?.save(current);if(!v){localStorage.removeItem(key(current));return;}}
  if(current===1)Object.assign(v,{stage:life1Stage,x:l1PX,y:l1PY,energy:[...document.querySelectorAll('.energy.collected')].map(e=>e.dataset.energy),frequency:targetFrequency,dial:Number($('frequencyDial').value)});
  if(current===2)Object.assign(v,{joined:[...document.querySelectorAll('.mate.joined')].map(e=>e.dataset.mate),pipes:engineerTiles2});
  if(current===3)Object.assign(v,{phase:$('mission3').dataset.phase,mix:['mixO2','mixFuel','mixCool'].map(id=>Number($(id).value))});
  if(current===4){if(!descentActive4||alt4<=0){localStorage.removeItem(key(4));return;}Object.assign(v,{alt:alt4,velocity:vel4,fuel:fuel4,drift:drift4,driftVelocity:driftVel4,power:Number($('thrustDial').value)});}
  try{localStorage.setItem(key(current),JSON.stringify(v));}catch{/* Continue playing if device storage is full. */}
 }
 function review(n){
  if(n===7)return;
  if(n>=8){window.MKTYContinuation?.review(n);return;}
  if(n===1){
   life1Stage=3;energyCollected=3;repairCells=4;
   document.querySelectorAll('.l1-hotspot').forEach(e=>{e.disabled=true;if(e.classList.contains('energy'))e.classList.add('collected');});
   $('energyCount').textContent='3/3';$('repairCount').textContent=$('antennaCount').textContent='1/1';
   ['qEnergy','qRepair','qAntenna'].forEach(id=>$(id).className='done');
   $('missionStatus').textContent='Signal synchronized. Moon Base Alpha is online!';updateLife1Nearby();
   $('life1Complete').hidden=false;showLife1MemoryCode();
  }
  if(n===2){crewCount=3;document.querySelectorAll('.mate').forEach(e=>e.classList.add('joined'));$('crewFinal2').hidden=true;$('life2Complete').hidden=false;updateCrewScene2();}
  if(n===3){clearLaunchPlayback3();setLaunchPhase3('complete');}
  if(n===4){descentActive4=false;cancelAnimationFrame(descentTimer);releaseDescentControls();alt4=0;vel4=0;renderDescent();$('mission4').dataset.brake='false';$('landingPhase4').textContent='TOUCHDOWN';$('descentStatus').textContent='Touchdown confirmed ✓';$('life4Complete').hidden=false;}
 }
 function restore(n){
  if(n===7)return; // Chapter 7 owns version-2 restoration and legacy migration.
  restoring=true;
  try{
   if(done(n)&&!window.MKTYOps?.isRun(n)&&!window.MKTYStory?.isRun(n)){review(n);return;}
   if(n===3&&localStorage.getItem('mkty_life3_memory_verified')==='yes')setLaunchPhase3('signal');
   const v=read(n);if(!v)return;
   if(n>=8){if(window.MKTYContinuation?.restore(n,v))window.MKTYExperience?.pause();return;}
   if(n===1&&[0,1,2].includes(v.stage)&&Array.isArray(v.energy)&&v.energy.every(x=>['1','2','3'].includes(x))&&Number.isFinite(v.x)&&Number.isFinite(v.y)){
    const collected=new Set(v.energy);if(v.stage>0&&collected.size!==3)return;
    life1Stage=v.stage;energyCollected=collected.size;l1PX=Math.max(7,Math.min(90,v.x));l1PY=Math.max(18,Math.min(88,v.y));
    if(Number.isFinite(v.frequency)&&v.frequency>=58&&v.frequency<=79)targetFrequency=v.frequency;
    if(Number.isFinite(v.dial)&&v.dial>=0&&v.dial<=100)$('frequencyDial').value=String(v.dial);updateSignalStrength();
    document.querySelectorAll('.energy').forEach(e=>{e.disabled=collected.has(e.dataset.energy);e.classList.toggle('collected',e.disabled);});
    $('energyCount').textContent=energyCollected+'/3';$('repairCount').textContent=(v.stage===2?'1':'0')+'/1';
    ['qEnergy','qRepair','qAntenna'].forEach((id,i)=>$(id).className=i<v.stage?'done':i===v.stage?'active':'');
    $('repairTerminal').disabled=v.stage!==1;$('antennaHotspot').disabled=v.stage!==2;
    $('missionStatus').textContent=v.stage===1?'Energy restored. Repair the terminal 🔧':v.stage===2?'Terminal online. Reach COMMS and calibrate the antenna 📡':'Explore Moon Base Alpha. Use SCAN to reveal nearby energy signatures.';
    ensureLife1WalkablePosition();renderLife1Player();updateLife1Nearby();
   }
   if(n===2&&Array.isArray(v.joined)&&v.joined.every(x=>['Navigator','Engineer','Scout'].includes(x))){
    if(Array.isArray(v.pipes)&&v.pipes.length===9&&v.pipes.every(t=>t&&Array.isArray(t.base)&&t.base.length===2&&t.base[0]!==t.base[1]&&t.base.every(p=>Number.isInteger(p)&&p>=0&&p<4)&&Number.isInteger(t.rotation)&&t.rotation>=0&&t.rotation<4))engineerTiles2=v.pipes;
    const joined=new Set(v.joined);crewCount=joined.size;document.querySelectorAll('.mate').forEach(e=>e.classList.toggle('joined',joined.has(e.dataset.mate)));$('crewFinal2').hidden=crewCount!==3;updateCrewScene2();
   }
   if(n===3&&['access','signal','fuel','ignition'].includes(v.phase)&&Array.isArray(v.mix)&&v.mix.length===3&&v.mix.every(x=>Number.isFinite(x)&&x>=0&&x<=100)){
    if(localStorage.getItem('mkty_life3_memory_verified')==='yes')setLaunchPhase3(v.phase==='access'?'signal':v.phase);
    ['mixO2','mixFuel','mixCool'].forEach((id,i)=>$(id).value=v.mix[i]);updateMix3();
   }
   if(n===4&&['alt','velocity','fuel','drift','driftVelocity','power'].every(k=>Number.isFinite(v[k]))&&v.alt>0&&v.alt<=2400&&v.velocity>=-16&&v.velocity<=200&&v.fuel>=0&&v.fuel<=100&&Math.abs(v.drift)<=105&&Math.abs(v.driftVelocity)<=10&&v.power>=0&&v.power<=100){
    alt4=v.alt;vel4=v.velocity;fuel4=v.fuel;drift4=v.drift;driftVel4=v.driftVelocity;$('thrustDial').value=v.power;renderDescent();
   }
  }finally{restoring=false;}
 }
 function needsCode(){return done(1)&&remainingLife1CodeTime()>0&&localStorage.getItem('mkty_life3_memory_verified')!=='yes';}
 function destination(){
  if(needsCode())return 1;
  const last=Number(localStorage.getItem('mkty_current_chapter'));
  if(last>=1&&last<=9&&unlocked(last)&&(!done(last)||window.MKTYOps?.pending(last)||window.MKTYStory?.pending(last)))return last;
  return [1,2,3,4,5,6,7,8,9].find(n=>!done(n)&&unlocked(n))||0;
 }
 function openChapter(n,cinematic=false){
  if(!Number.isInteger(n)||n<1||n>9||!unlocked(n))return;
  if(n>1&&needsCode())n=1;
  const open=[null,openMission,openMission2,openLife3MemoryGate,openMission4,openMission5,openMission6,openMission7,openMission8,openMission9];
  const intro=[null,startLife1,startLife2,startLife3,startLife4,startLife5,startLife6,startLife7,startLife8,startLife9];
  if(cinematic&&!done(n))intro[n]();else open[n]();
 }
 function render(){
  const n=destination();
  $('enterBtn').textContent=n?(n===1&&!done(1)&&!read(1)&&!window.MKTYStory?.pending(1)?tr('НАЧАТЬ КАМПАНИЮ · 9 ГЛАВ','START CAMPAIGN · 9 CHAPTERS'):tr('ПРОДОЛЖИТЬ ГЛАВУ ','CONTINUE CHAPTER ')+n):tr('ВЫБРАТЬ ГЛАВУ','CHOOSE A CHAPTER');
  $('enterBtn').onclick=()=>n?openChapter(n,!localStorage.getItem('mkty_current_chapter')):show('chapters');
  const list=$('chapterList');list.replaceChildren(...titles.map((title,i)=>{
   const n=i+1;const b=document.createElement('button');b.className='chapter-card';b.dataset.chapter=String(n);b.style.setProperty('--chapter-art',"url('art/"+['life1-base.webp','crew-bridge-v3.webp','launch-bridge-v3.webp','life4-landing.webp','life5-reactor-v2.webp','life6-launchpad.webp','life7-void.webp','life1-base.webp','orbit-v2.webp'][i]+"')");b.disabled=!unlocked(n);
   const number=document.createElement('b');number.textContent=String(n).padStart(2,'0');
   const body=document.createElement('span'),name=document.createElement('strong'),status=document.createElement('small');name.textContent=title;
   status.textContent=window.MKTYStory&&!window.MKTYStory.read(n)&&done(n)?tr('ДОСТУПЕН НОВЫЙ ПЛАН','NEW CHAPTER PLAN'):window.MKTYStory?.pending(n)?tr('ПРОДОЛЖИТЬ ПЛАН ГЛАВЫ','CONTINUE CHAPTER PLAN'):window.MKTYOps?.pending(n)?tr('ПРОДОЛЖИТЬ','CONTINUE'):done(n)?(n>=4?tr('ЗАВЕРШЕНО • ПОВТОР','COMPLETE • REPLAY'):tr('ЗАВЕРШЕНО • ПРОСМОТР','COMPLETE • VIEW')):unlocked(n)?tr('ПРОДОЛЖИТЬ','CONTINUE'):tr('ЗАВЕРШИТЕ ПРЕДЫДУЩУЮ ГЛАВУ','COMPLETE THE PREVIOUS CHAPTER');body.append(name,status);if(window.StoryPlan){const pacing=document.createElement('small');pacing.className='story-card-pacing';pacing.setAttribute('translate','no');pacing.textContent=tr('8 этапов + финал','8 stages + finale');body.append(pacing);}b.append(number,body);b.onclick=()=>openChapter(n);return b;
  }).filter(Boolean));
 }
 function onScreen(id){
  const n=Number(id.match(/^(?:mission|life)([1-9])$/)?.[1]||0);
  current=id.startsWith('mission')?n:0;
  if(n>=1&&n<=9)localStorage.setItem('mkty_current_chapter',String(n));
  if(id==='home'||id==='chapters')render();
 }
 $('missionsBtn').onclick=()=>show('chapters');$('chaptersBack').onclick=()=>show('home');
 for(const n of [1,2,3,4,7,8,9]){
  const b=document.createElement('button');b.type='button';b.className='chapter-menu';b.textContent='☰';b.setAttribute('aria-label','Missions');b.onclick=()=>show('chapters');$('mission'+n).querySelector('header').append(b);
 }
 document.querySelector('.mk-life-teaser').onclick=()=>show('chapters');
 window.addEventListener('pagehide',save);document.addEventListener('visibilitychange',()=>{if(document.hidden)save();});
 setInterval(()=>{if(!document.hidden)save();},1000);
 render();return {save,restore,onScreen,render,openChapter};
})();
