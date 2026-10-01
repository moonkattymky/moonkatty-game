
const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }

// Server-verified Telegram identity. initDataUnsafe is display-only; rewards must trust the server.
const MKTY_AUTH_URL='https://lswbmgoeinblzuqzakvi.supabase.co/functions/v1/telegram-auth';
let mktyServerPlayer=null;
let mktyAuthPromise=null;

async function authenticateMoonkattyPlayer(){
 if(!tg?.initData){
  console.info('MOONKATTY auth: open the game inside Telegram to authenticate.');
  return null;
 }
 try{
  const response=await fetch(MKTY_AUTH_URL,{
   method:'POST',
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify({initData:tg.initData})
  });
  const payload=await response.json().catch(()=>({}));
  if(!response.ok||!payload?.ok||!payload?.player){
   throw new Error(payload?.error||('HTTP '+response.status));
  }
  mktyServerPlayer=payload.player;
  console.info('MOONKATTY auth: Telegram identity verified.');
  return mktyServerPlayer;
 }catch(error){
  console.error('MOONKATTY auth failed:',error);
  return null;
 }
}
mktyAuthPromise=authenticateMoonkattyPlayer();

// MOONKATTY Crew identity
const crewUser = tg?.initDataUnsafe?.user;
const crewId = crewUser?.id || 'guest';
const crewName = crewUser?.first_name || 'Crew';
const crewTag = crewUser?.username ? '@' + crewUser.username : 'Telegram Crew';
const crewCode = crewUser?.id ? 'MKTY-' + String(crewUser.id).slice(-6) : 'MKTY-GUEST';

console.log('MOONKATTY CREW:', {
  name: crewName,
  tag: crewTag,
  crewId: crewCode
});
const langs = [
 ['en','🇬🇧','English'],['ru','🇷🇺','Русский'],['uk','🇺🇦','Українська'],
 ['es','🇪🇸','Español'],['pt','🇵🇹','Português'],['de','🇩🇪','Deutsch'],
 ['fr','🇫🇷','Français'],['it','🇮🇹','Italiano'],['tr','🇹🇷','Türkçe'],['he','🇮🇱','עברית'],['ko','🇰🇷','한국어'],['zh','🇨🇳','中文']
];
const copy = {
 en:['Choose your language','Welcome to the Crew.','ENTER THE MISSION 🚀','LIFE #1 — THE AWAKENING','The signal has been received. The journey to the Moon begins here.'],
 ru:['Выберите язык','Добро пожаловать в Crew.','НАЧАТЬ МИССИЮ 🚀','ЖИЗНЬ #1 — ПРОБУЖДЕНИЕ','Сигнал получен. Путь к Луне начинается здесь.'],
 uk:['Оберіть мову','Ласкаво просимо до Crew.','ПОЧАТИ МІСІЮ 🚀','ЖИТТЯ #1 — ПРОБУДЖЕННЯ','Сигнал отримано. Шлях до Місяця починається тут.'],
 es:['Elige tu idioma','Bienvenido a la Crew.','ENTRAR EN LA MISIÓN 🚀','VIDA #1 — EL DESPERTAR','La señal ha sido recibida. El viaje a la Luna comienza aquí.'],
 pt:['Escolha seu idioma','Bem-vindo à Crew.','ENTRAR NA MISSÃO 🚀','VIDA #1 — O DESPERTAR','O sinal foi recebido. A jornada até a Lua começa aqui.'],
 de:['Wähle deine Sprache','Willkommen bei der Crew.','MISSION STARTEN 🚀','LEBEN #1 — DAS ERWACHEN','Das Signal wurde empfangen. Die Reise zum Mond beginnt hier.'],
 fr:['Choisissez votre langue','Bienvenue dans le Crew.','ENTRER DANS LA MISSION 🚀','VIE #1 — LE RÉVEIL','Le signal a été reçu. Le voyage vers la Lune commence ici.'],
 it:['Scegli la lingua','Benvenuto nella Crew.','INIZIA LA MISSIONE 🚀','VITA #1 — IL RISVEGLIO','Il segnale è stato ricevuto. Il viaggio verso la Luna inizia qui.'],
 tr:['Dilini seç','Crew’a hoş geldin.','GÖREVE BAŞLA 🚀','YAŞAM #1 — UYANIŞ','Sinyal alındı. Ay yolculuğu burada başlıyor.'],
 he:['בחר שפה','ברוכים הבאים לצוות.','התחל את המשימה 🚀','חיים #1 — ההתעוררות','האות התקבל. המסע אל הירח מתחיל כאן.'],
 ko:['언어를 선택하세요','크루에 오신 것을 환영합니다.','미션 시작 🚀','LIFE #1 — 각성','신호를 수신했습니다. 달을 향한 여정이 여기서 시작됩니다.'],
 zh:['选择语言','欢迎加入团队。','开始任务 🚀','LIFE #1 — 觉醒','已接收到信号。前往月球的旅程从这里开始。']
};
const $=id=>document.getElementById(id);
function setLang(code){
 localStorage.setItem('mkty_lang',code);
 document.documentElement.lang=code;
 document.documentElement.dir=code==='he'?'rtl':'ltr';
 const t=copy[code]||copy.en;
 $('chooseText').textContent=t[0]; $('welcome').textContent=t[1]; $('enterBtn').textContent=t[2];
 if($('lifeTitle')) $('lifeTitle').textContent=t[3]; if($('lifeText')) $('lifeText').textContent=t[4];
 $('language').classList.remove('active'); $('home').classList.add('active');
}
langs.forEach(([code,flag,name])=>{
 const b=document.createElement('button'); b.className='lang'; b.textContent=`${flag} ${name}`;
 b.onclick=()=>setLang(code); $('languages').appendChild(b);
});
$('settingsBtn').onclick=()=>{$('home').classList.remove('active');$('language').classList.add('active')};
function show(id){
 document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
 $(id).classList.add('active');
}
let cinematicTimer;
function openMission(){
 clearTimeout(cinematicTimer);
 const video=$('life1Video'); if(video) video.pause();
 $('crewBadge').textContent=crewCode;
 show('mission1');
 resetLife1Mission();
}
$('enterBtn').onclick=()=>{
 tg?.HapticFeedback?.impactOccurred('medium');
 show('life1');
 const video=$('life1Video');
 if(video){ video.currentTime=0; video.play().catch(()=>{}); }
 $('cinematicBar').classList.remove('run');
 void $('cinematicBar').offsetWidth;
 $('cinematicBar').classList.add('run');
 cinematicTimer=setTimeout(openMission,8000);
};
$('skipBtn').onclick=openMission;
$('life1Video')?.addEventListener('ended',openMission);
let life1Stage=0, energyCollected=0, repairCells=0, targetFrequency=64;
function resetLife1Mission(){
 life1Stage=0; energyCollected=0; repairCells=0; targetFrequency=58+Math.floor(Math.random()*22);
 document.querySelectorAll('.l1-hotspot.energy').forEach(x=>{x.disabled=false;x.classList.remove('collected')});
 document.querySelectorAll('.repair-cells button').forEach(x=>{x.disabled=false;x.classList.remove('done')});
 $('repairTerminal').disabled=true;$('antennaHotspot').disabled=true;$('repairPanel').hidden=true;$('antennaPanel').hidden=true;$('life1Complete').hidden=true;
 $('energyCount').textContent='0/3';$('repairCount').textContent='0/1';$('antennaCount').textContent='0/1';$('repairFill').style.width='0%';
 $('qEnergy').className='active';$('qRepair').className='';$('qAntenna').className='';
 $('missionStatus').textContent='Collect 3 energy crystals to restore Moon Base Alpha.';
 const bank=getLifeBank?.()??9;$('life1Lives').textContent=bank+'/9 ❤️';$('l1Points').textContent=(Number(localStorage.getItem('mkty_points')||0))+' ⭐';
}
function collectLife1Energy(btn){
 if(!btn||btn.disabled||btn.classList.contains('collected')||life1Stage!==0)return;
 btn.disabled=true; btn.classList.add('collected'); energyCollected++;
 $('energyCount').textContent=energyCollected+'/3';
 tg?.HapticFeedback?.impactOccurred('light');
 $('missionStatus').textContent='Energy collected • '+energyCollected+'/3';
 if(energyCollected>=3){
  energyCollected=3; $('energyCount').textContent='3/3'; life1Stage=1;
  $('qEnergy').className='done'; $('qRepair').className='active';
  $('repairTerminal').disabled=false;
  $('missionStatus').textContent='Energy restored. Repair the terminal 🔧';
 }
}
document.querySelectorAll('.l1-hotspot.energy').forEach(btn=>{
 btn.type='button'; btn.style.pointerEvents='auto';
 btn.addEventListener('click',()=>collectLife1Energy(btn));
});
$('life1World')?.addEventListener('pointerup',(ev)=>{
 const btn=ev.target.closest?.('.l1-hotspot.energy');
 if(!btn)return;
 ev.preventDefault(); ev.stopPropagation();
 collectLife1Energy(btn);
});
$('repairTerminal').onclick=()=>{if(life1Stage!==1)return;$('repairPanel').hidden=false;$('repairPanel').scrollIntoView({behavior:'smooth',block:'center'});};
$('life1World')?.addEventListener('pointerup',(ev)=>{
 const terminal=ev.target.closest?.('#repairTerminal');
 if(terminal && life1Stage===1){ev.preventDefault();$('repairPanel').hidden=false;$('repairPanel').scrollIntoView({behavior:'smooth',block:'center'});}
 const antenna=ev.target.closest?.('#antennaHotspot');
 if(antenna && life1Stage===2){ev.preventDefault();$('antennaPanel').hidden=false;$('antennaPanel').scrollIntoView({behavior:'smooth',block:'center'});}
});
document.querySelectorAll('.repair-cells button').forEach(btn=>btn.onclick=()=>{
 if(life1Stage!==1||btn.disabled)return;btn.disabled=true;btn.classList.add('done');repairCells++;$('repairFill').style.width=(repairCells/3*100)+'%';tg?.HapticFeedback?.impactOccurred('medium');
 if(repairCells===3){life1Stage=2;$('repairCount').textContent='1/1';$('qRepair').className='done';$('qAntenna').className='active';$('repairPanel').hidden=true;$('antennaHotspot').disabled=false;$('missionStatus').textContent='Terminal online. Activate and tune the antenna 📡';}
});
$('antennaHotspot').onclick=()=>{if(life1Stage!==2)return;$('antennaPanel').hidden=false;$('antennaPanel').scrollIntoView({behavior:'smooth',block:'center'});};
$('frequencyDial').oninput=()=>{$('frequencyValue').textContent=(136+Number($('frequencyDial').value)/10).toFixed(1);};
$('tuneBtn').onclick=()=>{
 if(life1Stage!==2)return;const v=Number($('frequencyDial').value),d=Math.abs(v-targetFrequency);
 if(d>6){$('signalHint').textContent=v<targetFrequency?'Signal weak — tune higher.':'Signal weak — tune lower.';tg?.HapticFeedback?.impactOccurred('light');return;}
 life1Stage=3;$('antennaCount').textContent='1/1';$('qAntenna').className='done';$('antennaPanel').hidden=true;$('missionStatus').textContent='Signal locked. Moon Base Alpha is online!';tg?.HapticFeedback?.notificationOccurred?.('success');
 let pts=Number(localStorage.getItem('mkty_points')||0);if(localStorage.getItem('mkty_life1')!=='complete')pts+=500;localStorage.setItem('mkty_points',String(pts));localStorage.setItem('mkty_life1','complete');$('points').textContent=pts+' ⭐';$('l1Points').textContent=pts+' ⭐';$('livesProgress').textContent='1 / 9 🌙';unlockLife2();
 setTimeout(()=>{$('life1Complete').hidden=false;$('life1Complete').scrollIntoView({behavior:'smooth',block:'center'});},300);
};
$('returnBtn').onclick=()=>show('home');


const MKTY_MAX_LIVES=9, MKTY_LIFE_RESTORE_MS=12*60*60*1000, MKTY_CODE_LOCK_MS=60*60*1000;
function getLifeBank(){
 let lives=Number(localStorage.getItem('mkty_global_lives')??MKTY_MAX_LIVES);
 let stamp=Number(localStorage.getItem('mkty_life_restore_at')||0);
 const now=Date.now();
 if(lives<MKTY_MAX_LIVES && stamp){
  const gained=Math.floor((now-stamp)/MKTY_LIFE_RESTORE_MS);
  if(gained>0){lives=Math.min(MKTY_MAX_LIVES,lives+gained);stamp=lives<MKTY_MAX_LIVES?stamp+gained*MKTY_LIFE_RESTORE_MS:0;}
 }
 localStorage.setItem('mkty_global_lives',String(lives));
 if(stamp)localStorage.setItem('mkty_life_restore_at',String(stamp));else localStorage.removeItem('mkty_life_restore_at');
 return lives;
}
function spendGlobalLife(){
 let lives=getLifeBank(); if(lives<=0)return false;
 lives--; localStorage.setItem('mkty_global_lives',String(lives));
 if(!localStorage.getItem('mkty_life_restore_at'))localStorage.setItem('mkty_life_restore_at',String(Date.now()));
 renderLife3Gate(); return true;
}
function ensureLife1MemoryCode(){
 let code=localStorage.getItem('mkty_life1_memory_code');
 if(!/^\d{10}$/.test(code||'')){code=String(Math.floor(Math.random()*1e10)).padStart(10,'0');localStorage.setItem('mkty_life1_memory_code',code);}
 return code;
}
let memoryCodeTimer=null, gateTimer=null;
function showLife1MemoryCode(){
 const code=ensureLife1MemoryCode(); const box=$('life1MemoryCode'); if(!box)return;
 box.hidden=false;$('life1CodeValue').textContent=code;
 let left=10;$('life1CodeTimer').textContent='VISIBLE FOR '+left+' SECONDS';
 clearInterval(memoryCodeTimer);memoryCodeTimer=setInterval(()=>{left--;if(left<=0){clearInterval(memoryCodeTimer);box.hidden=true;}else $('life1CodeTimer').textContent='VISIBLE FOR '+left+' SECONDS';},1000);
}
function renderLife3Gate(){
 const lives=getLifeBank(), lock=Number(localStorage.getItem('mkty_life3_code_lock_until')||0), now=Date.now();
 if($('globalLives3'))$('globalLives3').textContent=lives+' / '+MKTY_MAX_LIVES;
 const locked=lock>now;
 if($('life3MemoryInput'))$('life3MemoryInput').disabled=locked;
 if($('verifyLife1CodeBtn'))$('verifyLife1CodeBtn').disabled=locked;
 if($('life3Cooldown'))$('life3Cooldown').hidden=!locked;
 if($('buyCodeHintBtn'))$('buyCodeHintBtn').hidden=locked;
 if(locked){
  const sec=Math.max(0,Math.ceil((lock-now)/1000)),hh=String(Math.floor(sec/3600)).padStart(2,'0'),mm=String(Math.floor(sec%3600/60)).padStart(2,'0'),ss=String(sec%60).padStart(2,'0');
  $('life3CooldownTimer').textContent=hh+':'+mm+':'+ss;$('life3GateStatus').textContent='Wrong code. One life lost. Retry locked for 1 hour.';
 } else if(localStorage.getItem('mkty_life3_code_lock_until')) {
  localStorage.removeItem('mkty_life3_code_lock_until');$('life3GateStatus').textContent='Retry available. Enter the LIFE #1 code or buy a hint.';
 }
}
function openLife3MemoryGate(){
 show('mission3');$('life3MemoryGate').hidden=false;$('life3CodeMission').hidden=true;renderLife3Gate();
 clearInterval(gateTimer);gateTimer=setInterval(renderLife3Gate,1000);
}

function unlockLife2(){
 const done=localStorage.getItem('mkty_life1')==='complete';
 if(!done)return;
 const life1Card=$('life1Card'), life2Card=$('life2Card'), life2Icon=$('life2Icon'), storyProgress=$('storyProgress');
 life1Card?.classList.add('complete');
 if(life2Card){
  life2Card.disabled=false;
  life2Card.classList.remove('locked');
  life2Card.classList.add('unlocked');
 }
 if(life2Icon)life2Icon.textContent='2';
 if(storyProgress)storyProgress.style.width='22%';
}
let life2Timer;
function startLife2(){
 show('life2');
 const video=$('life2Video');
 if(video){video.currentTime=0;video.play().catch(()=>{});}
 $('life2Bar').classList.remove('run'); void $('life2Bar').offsetWidth; $('life2Bar').classList.add('run');
 clearTimeout(life2Timer); life2Timer=setTimeout(openMission2,10000);
}
function openMission2(){
 clearTimeout(life2Timer);
 const video=$('life2Video'); if(video)video.pause();
 $('crewBadge2').textContent=crewCode; show('mission2');
}
$('continueLife2Btn').onclick=()=>{
 unlockLife2();
 $('lifeTitle').textContent='LIFE #2 — THE CREW';
 $('lifeText').textContent='Assemble your crew. Each specialist must pass a challenge.';
 $('enterBtn').textContent='START LIFE #2 🚀';
 $('enterBtn').onclick=startLife2;
 startLife2();
};
if($('life2Card')) $('life2Card').onclick=()=>$('continueLife2Btn').click();

// Telegram WebView-safe direct launcher for LIFE #2.
// Use delegated pointer/touch handling so the completed LIFE #1 button keeps working
// even after returning to the mission or when WebView suppresses a synthetic click.
function launchLife2FromCompletedMission(ev){
 const target=ev.target?.closest?.('#continueLife2Btn');
 if(!target)return;
 if(localStorage.getItem('mkty_life1')!=='complete')return;
 ev.preventDefault();
 ev.stopPropagation();
 tg?.HapticFeedback?.impactOccurred?.('medium');
 startLife2();
}
document.addEventListener('pointerup',launchLife2FromCompletedMission);
$('continueLife2Btn').addEventListener('touchend',launchLife2FromCompletedMission,{passive:false});

$('life2SkipBtn').onclick=openMission2;
$('life2Video')?.addEventListener('ended',openMission2);

let crewCount=0, activeMate=null, powerStep=1;
function completeMate(btn){
 if(!btn||btn.classList.contains('joined'))return;
 btn.classList.add('joined'); crewCount++; activeMate=null;
 document.querySelectorAll('.crew-task').forEach(x=>x.hidden=true);
 $('crewChallengeTitle').textContent='SPECIALIST RECRUITED ✓';
 $('crewStatus').textContent='Crew assembled: '+crewCount+' / 3';
 tg?.HapticFeedback?.notificationOccurred?.('success');
 if(crewCount===3){
  localStorage.setItem('mkty_life2','complete');
  $('life2Complete').hidden=false; $('points').textContent='30 ⭐'; unlockLife3();
 }
}
document.querySelectorAll('.mate').forEach(btn=>btn.onclick=()=>{
 if(btn.classList.contains('joined'))return;
 activeMate=btn; document.querySelectorAll('.crew-task').forEach(x=>x.hidden=true);
 const role=btn.dataset.mate; $('crewChallengeTitle').textContent=role.toUpperCase()+' CHALLENGE';
 if(role==='Navigator')$('navigatorTask').hidden=false;
 if(role==='Engineer'){powerStep=1;document.querySelectorAll('[data-power]').forEach(x=>x.classList.remove('powered'));$('engineerTask').hidden=false;}
 if(role==='Scout'){buildAnomaly();$('scoutTask').hidden=false;}
});
$('navLockBtn').onclick=()=>{
 const v=Number($('navDial').value);
 if(v>=62&&v<=72)completeMate(activeMate);
 else{$('crewStatus').textContent=v<62?'Vector too low — adjust right.':'Vector too high — adjust left.';tg?.HapticFeedback?.impactOccurred('light');}
};
document.querySelectorAll('[data-power]').forEach(b=>b.onclick=()=>{
 const n=Number(b.dataset.power);
 if(n===powerStep){b.classList.add('powered');powerStep++;if(powerStep===4)completeMate(activeMate);}
 else{powerStep=1;document.querySelectorAll('[data-power]').forEach(x=>x.classList.remove('powered'));$('crewStatus').textContent='Power sequence reset. Try again.';}
});
function buildAnomaly(){
 const grid=$('anomalyGrid');grid.innerHTML='';const target=Math.floor(Math.random()*9);
 for(let i=0;i<9;i++){const b=document.createElement('button');b.textContent='·';b.onclick=()=>{if(i===target){b.textContent='✦';completeMate(activeMate);}else{b.textContent='×';$('crewStatus').textContent='Empty sector. Keep scanning.';}};grid.appendChild(b);}
}
$('life2ReturnBtn').onclick=()=>show('home');

function unlockLife3(){
 if(localStorage.getItem('mkty_life2')!=='complete')return;
 $('life2Card').classList.add('complete');
 $('life3Card').disabled=false;$('life3Card').classList.remove('locked');$('life3Card').classList.add('unlocked');
 $('life3Icon').textContent='3';$('storyProgress').style.width='33%';
}
function playLifeCinematic(n,onDone){
 const screen=$('life'+n),video=$('life'+n+'Video'),bar=$('life'+n+'Bar'),skip=$('life'+n+'SkipBtn');
 if(!screen||!video){onDone();return;}
 show('life'+n); let finished=false;
 const finish=()=>{if(finished)return;finished=true;video.pause();video.removeEventListener('ended',finish);skip?.removeEventListener('click',finish);onDone();};
 video.currentTime=0; video.addEventListener('ended',finish,{once:true}); skip?.addEventListener('click',finish,{once:true});
 if(bar){bar.classList.remove('run');void bar.offsetWidth;bar.classList.add('run');}
 video.play().catch(()=>{});
}
function startLife3(){playLifeCinematic(3,openLife3MemoryGate);}
$('continueLife3Btn').onclick=()=>{unlockLife3();$('lifeTitle').textContent='LIFE #3 — THE LAUNCH CODE';$('lifeText').textContent='Decrypt the ship launch authorization sequence.';$('enterBtn').textContent='START LIFE #3 🚀';$('enterBtn').onclick=startLife3;show('home');};
$('life3Card').onclick=()=>$('continueLife3Btn').click();$('life3SkipBtn').onclick=openLife3MemoryGate;
$('verifyLife1CodeBtn').onclick=()=>{const lock=Number(localStorage.getItem('mkty_life3_code_lock_until')||0);if(lock>Date.now())return;const entered=$('life3MemoryInput').value.trim();if(entered===ensureLife1MemoryCode()){clearInterval(gateTimer);$('life3GateStatus').textContent='CODE VERIFIED ✓';localStorage.setItem('mkty_life3_memory_verified','yes');renderMissionArchive();
renderDailyMissions();
renderCrewNetwork();$('life3MemoryGate').hidden=true;$('life3CodeMission').hidden=false;tg?.HapticFeedback?.notificationOccurred?.('success');return;}if(!spendGlobalLife()){$('life3GateStatus').textContent='No lives available. A life restores every 12 hours.';return;}localStorage.setItem('mkty_life3_code_lock_until',String(Date.now()+MKTY_CODE_LOCK_MS));$('life3MemoryInput').value='';tg?.HapticFeedback?.notificationOccurred?.('error');renderLife3Gate();};
$('buyCodeHintBtn').onclick=()=>{if(Number(localStorage.getItem('mkty_life3_code_lock_until')||0)>Date.now())return;if(!spendGlobalLife()){$('life3GateStatus').textContent='No lives available. A life restores every 12 hours.';return;}const code=ensureLife1MemoryCode();$('life3GateStatus').textContent='HINT: first 5 digits are '+code.slice(0,5)+' • remaining digits: '+code.slice(5).replace(/./g,'•');$('life3MemoryInput').focus();};
let launchCode=[],codeInput=[],codeAttempts=3,codeReady=false;
const codeSymbols=['▲','●','◆','■'];
function newLaunchCode(){launchCode=Array.from({length:4},()=>codeSymbols[Math.floor(Math.random()*4)]);codeInput=[];codeReady=false;$('codeSequence').textContent='READY';$('codeStatus').textContent='Attempts: '+codeAttempts;}
$('showCodeBtn').onclick=()=>{newLaunchCode();$('codeSequence').textContent=launchCode.join('  ');$('showCodeBtn').disabled=true;setTimeout(()=>{$('codeSequence').textContent='?  ?  ?  ?';codeReady=true;$('showCodeBtn').disabled=false;},2200);};
document.querySelectorAll('[data-code]').forEach(b=>b.onclick=()=>{if(!codeReady)return;codeInput.push(b.dataset.code);$('codeSequence').textContent=codeInput.join('  ');if(codeInput.length===4){if(codeInput.join('')===launchCode.join('')){codeReady=false;localStorage.setItem('mkty_life3','complete');$('codeStatus').textContent='ACCESS GRANTED ✓';$('points').textContent='60 ⭐';$('life3Complete').hidden=false;unlockLife4();tg?.HapticFeedback?.notificationOccurred?.('success');}else{codeAttempts--;tg?.HapticFeedback?.notificationOccurred?.('error');if(codeAttempts<=0){codeAttempts=3;$('codeStatus').textContent='Security reset. New code generated.';}else $('codeStatus').textContent='Incorrect sequence. Attempts: '+codeAttempts;newLaunchCode();}}});
$('life3ReturnBtn').onclick=()=>show('home');

function unlockLife4(){
 if(localStorage.getItem('mkty_life3')!=='complete')return;
 $('life3Card').classList.add('complete');$('life4Card').disabled=false;$('life4Card').classList.remove('locked');$('life4Card').classList.add('unlocked');$('life4Icon').textContent='4';$('storyProgress').style.width='44%';
}
$('continueLife4Btn').onclick=()=>{unlockLife4();$('lifeTitle').textContent='LIFE #4 — THE DESCENT';$('lifeText').textContent='Take manual control and land the ship safely.';$('enterBtn').textContent='START LIFE #4 🚀';$('enterBtn').onclick=startLife4;show('home');};
$('life4Card').onclick=()=>$('continueLife4Btn').click();
let alt4=2400,vel4=28,fuel4=100,drift4=0,descentTimer;
function renderDescent(){$('altitude').textContent=Math.max(0,Math.round(alt4));$('velocity').textContent=Math.max(0,Math.round(vel4));$('fuel').textContent=Math.max(0,Math.round(fuel4));$('lander').style.transform='translateX('+drift4+'px)';}
function startLife4(){playLifeCinematic(4,openMission4);}
function openMission4(){alt4=2400;vel4=28;fuel4=100;drift4=0;$('life4Complete').hidden=true;$('descentStatus').textContent='Stabilize descent and reach the landing zone.';show('mission4');renderDescent();clearInterval(descentTimer);descentTimer=setInterval(()=>{alt4-=vel4*2;vel4+=.8;if(alt4<=0){clearInterval(descentTimer);if(vel4<=12&&Math.abs(drift4)<=45){localStorage.setItem('mkty_life4','complete');$('descentStatus').textContent='Touchdown confirmed ✓';$('points').textContent='100 ⭐';$('life4Complete').hidden=false;unlockLife5();tg?.HapticFeedback?.notificationOccurred?.('success');}else{$('descentStatus').textContent='Hard landing — retry the descent.';tg?.HapticFeedback?.notificationOccurred?.('error');setTimeout(openMission4,1400);}}renderDescent();},500);}
$('burnBtn').onclick=()=>{if(fuel4<=0)return;const power=Number($('thrustDial').value)/100;fuel4-=4+power*4;vel4=Math.max(3,vel4-(3+power*7));tg?.HapticFeedback?.impactOccurred('medium');renderDescent();};
$('leftThruster').onclick=()=>{if(fuel4>0){drift4=Math.max(-90,drift4-18);fuel4-=2;renderDescent();}};
$('rightThruster').onclick=()=>{if(fuel4>0){drift4=Math.min(90,drift4+18);fuel4-=2;renderDescent();}};
$('life4ReturnBtn').onclick=()=>show('home');

function unlockLife5(){
 if(localStorage.getItem('mkty_life4')!=='complete')return;
 $('life4Card').classList.add('complete');$('life5Card').disabled=false;$('life5Card').classList.remove('locked');$('life5Card').classList.add('unlocked');$('life5Icon').textContent='5';$('storyProgress').style.width='55%';
}
$('continueLife5Btn').onclick=()=>{unlockLife5();$('lifeTitle').textContent='LIFE #5 — IGNITION';$('lifeText').textContent='Bring the lunar reactor online.';$('enterBtn').textContent='START LIFE #5 🔥';$('enterBtn').onclick=startLife5;show('home');};
$('life5Card').onclick=()=>$('continueLife5Btn').click();
let cells5=[0,0,0],stability5=15,stable5=false;
function startLife5(){playLifeCinematic(5,openMission5);}
function openMission5(){cells5=[0,0,0];stability5=15;stable5=false;document.querySelectorAll('[data-cell]').forEach(b=>{b.classList.remove('charged');b.querySelector('i').style.height='0%';});$('stabilizeBtn').disabled=true;$('igniteBtn').disabled=true;$('life5Complete').hidden=true;$('ignitionStatus').textContent='Charge the energy cells.';$('reactorCore').classList.remove('online');show('mission5');}
document.querySelectorAll('[data-cell]').forEach(btn=>btn.onclick=()=>{const i=Number(btn.dataset.cell);if(cells5[i]>=100)return;cells5[i]=Math.min(100,cells5[i]+25);btn.querySelector('i').style.height=cells5[i]+'%';tg?.HapticFeedback?.impactOccurred('light');if(cells5[i]===100)btn.classList.add('charged');if(cells5.every(v=>v===100)){$('stabilizeBtn').disabled=false;$('ignitionStatus').textContent='Cells charged. Stabilize the reactor core.';}});
$('stabilizeBtn').onclick=()=>{stability5=20+Math.floor(Math.random()*61);$('stabilityNeedle').style.left=stability5+'%';const ok=stability5>=45&&stability5<=55;if(ok){stable5=true;$('stabilizeBtn').disabled=true;$('igniteBtn').disabled=false;$('ignitionStatus').textContent='Core stable. Ready for ignition.';tg?.HapticFeedback?.notificationOccurred?.('success');}else{$('ignitionStatus').textContent=stability5<45?'Core underpowered — stabilize again.':'Core overload — stabilize again.';tg?.HapticFeedback?.impactOccurred('medium');}};
$('igniteBtn').onclick=()=>{if(!stable5)return;$('reactorCore').classList.add('online');$('igniteBtn').disabled=true;localStorage.setItem('mkty_life5','complete');$('points').textContent='150 ⭐';$('ignitionStatus').textContent='Reactor online. Ignition successful ✓';$('life5Complete').hidden=false;unlockLife6();tg?.HapticFeedback?.notificationOccurred?.('success');};
$('life5ReturnBtn').onclick=()=>show('home');

function unlockLife6(){
 if(localStorage.getItem('mkty_life5')!=='complete')return;
 $('life5Card').classList.add('complete');$('life6Card').disabled=false;$('life6Card').classList.remove('locked');$('life6Card').classList.add('unlocked');$('life6Icon').textContent='6';$('storyProgress').style.width='66%';
}
$('continueLife6Btn').onclick=()=>{unlockLife6();$('lifeTitle').textContent='LIFE #6 — LIFTOFF';$('lifeText').textContent='Complete the launch sequence before time runs out.';$('enterBtn').textContent='START LIFE #6 🚀';$('enterBtn').onclick=startLife6;show('home');};
$('life6Card').onclick=()=>$('continueLife6Btn').click();
let launchStep=1,launchSeconds=30,launchTimer;
function startLife6(){playLifeCinematic(6,openMission6);}
function openMission6(){launchStep=1;launchSeconds=30;$('launchClock').textContent=30;$('launchClock').classList.remove('danger');$('launchBtn').disabled=true;$('life6Complete').hidden=true;$('launchStatus').textContent='Complete the pre-flight checklist.';document.querySelectorAll('[data-launch]').forEach(b=>b.classList.remove('armed','error'));$('launchShip').classList.remove('lifted');show('mission6');clearInterval(launchTimer);launchTimer=setInterval(()=>{launchSeconds--;$('launchClock').textContent=launchSeconds;if(launchSeconds<=10)$('launchClock').classList.add('danger');if(launchSeconds<=0){clearInterval(launchTimer);$('launchStatus').textContent='Launch window missed — sequence reset.';tg?.HapticFeedback?.notificationOccurred?.('error');setTimeout(openMission6,1200);}},1000);}
document.querySelectorAll('[data-launch]').forEach(b=>b.onclick=()=>{const n=Number(b.dataset.launch);if(n!==launchStep){b.classList.add('error');$('launchStatus').textContent='Wrong sequence. Check procedure.';tg?.HapticFeedback?.impactOccurred('medium');return;}b.classList.add('armed');launchStep++;tg?.HapticFeedback?.impactOccurred('light');if(launchStep===5){$('launchBtn').disabled=false;$('launchStatus').textContent='All systems armed. LAUNCH!';}});
$('launchBtn').onclick=()=>{if(launchStep!==5)return;clearInterval(launchTimer);$('launchShip').classList.add('lifted');$('launchFlame').classList.add('active');$('launchBtn').disabled=true;localStorage.setItem('mkty_life6','complete');$('points').textContent='210 ⭐';$('launchStatus').textContent='Liftoff confirmed — orbit achieved ✓';setTimeout(()=>{$('life6Complete').hidden=false;unlockLife7();},900);tg?.HapticFeedback?.notificationOccurred?.('success');};
$('life6ReturnBtn').onclick=()=>show('home');

function unlockLife7(){
 if(localStorage.getItem('mkty_life6')!=='complete')return;
 $('life6Card').classList.add('complete');$('life7Card').disabled=false;$('life7Card').classList.remove('locked');$('life7Card').classList.add('unlocked');$('life7Icon').textContent='7';$('storyProgress').style.width='77%';
}
$('continueLife7Btn').onclick=()=>{unlockLife7();$('lifeTitle').textContent='LIFE #7 — THE VOID';$('lifeText').textContent='Cross the debris field and protect the ship.';$('enterBtn').textContent='START LIFE #7 🌌';$('enterBtn').onclick=startLife7;show('home');};
$('life7Card').onclick=()=>$('continueLife7Btn').click();
let lane7=1,hull7=100,shield7=3,distance7=0,shieldActive7=false,voidTimer;
function renderVoid(){ $('hull7').textContent=hull7;$('shield7').textContent=shield7;$('distance7').textContent=distance7;$('voidShip').style.left=(20+lane7*30)+'%';}
function spawnDebris(){const field=$('asteroidField');field.innerHTML='';const danger=Math.floor(Math.random()*3);for(let i=0;i<3;i++){const d=document.createElement('span');d.textContent=i===danger?'☄':'·';d.className=i===danger?'danger-debris':'';field.appendChild(d);}return danger;}
function startLife7(){playLifeCinematic(7,openMission7);}
function openMission7(){lane7=1;hull7=100;shield7=3;distance7=0;shieldActive7=false;$('life7Complete').hidden=true;$('voidStatus').textContent='Unknown debris field ahead.';show('mission7');renderVoid();clearInterval(voidTimer);let danger=spawnDebris();voidTimer=setInterval(()=>{distance7+=10;if(lane7===danger){if(shieldActive7){shieldActive7=false;$('voidStatus').textContent='Shield absorbed impact.';}else{hull7-=25;$('voidStatus').textContent='Hull impact! Change course.';tg?.HapticFeedback?.notificationOccurred?.('error');}}if(hull7<=0){clearInterval(voidTimer);$('voidStatus').textContent='Hull lost — emergency reset.';setTimeout(openMission7,1200);return;}if(distance7>=100){clearInterval(voidTimer);localStorage.setItem('mkty_life7','complete');$('points').textContent='280 ⭐';$('voidStatus').textContent='Transmission gate reached ✓';$('life7Complete').hidden=false;unlockLife8();tg?.HapticFeedback?.notificationOccurred?.('success');return;}danger=spawnDebris();renderVoid();},1200);}
$('voidLeft').onclick=()=>{lane7=Math.max(0,lane7-1);renderVoid();};$('voidRight').onclick=()=>{lane7=Math.min(2,lane7+1);renderVoid();};$('shieldBtn').onclick=()=>{if(shield7<=0||shieldActive7)return;shield7--;shieldActive7=true;$('voidStatus').textContent='Shield armed for next impact.';renderVoid();};
$('life7ReturnBtn').onclick=()=>show('home');

function unlockLife8(){
 if(localStorage.getItem('mkty_life7')!=='complete')return;
 $('life7Card').classList.add('complete');$('life8Card').disabled=false;$('life8Card').classList.remove('locked');$('life8Card').classList.add('unlocked');$('life8Icon').textContent='8';$('storyProgress').style.width='88%';
}
$('continueLife8Btn').onclick=()=>{unlockLife8();$('lifeTitle').textContent='LIFE #8 — THE SIGNAL';$('lifeText').textContent='Decode the unknown transmission.';$('enterBtn').textContent='START LIFE #8 📡';$('enterBtn').onclick=startLife8;show('home');};
$('life8Card').onclick=()=>$('continueLife8Btn').click();
let targetFreq8=0,targetPhase8=0,pulse8=[],pulseInput8=[];
function startLife8(){playLifeCinematic(8,openMission8);}
function openMission8(){targetFreq8=25+Math.floor(Math.random()*51);targetPhase8=25+Math.floor(Math.random()*51);pulse8=Array.from({length:5},()=>Math.floor(Math.random()*3));pulseInput8=[];$('freq8').value=20;$('phase8').value=50;$('phasePanel8').hidden=true;$('pulsePanel8').hidden=true;$('life8Complete').hidden=true;$('signalPulse').classList.remove('decoded');$('link8').textContent=0;$('signalStatus8').textContent='Find the transmission frequency.';show('mission8');updateFreq8();}
function updateFreq8(){const v=Number($('freq8').value);$('freqRead8').textContent=(140+v/10).toFixed(1)+' MHz';}
$('freq8').oninput=updateFreq8;
$('lockFreq8').onclick=()=>{const d=Math.abs(Number($('freq8').value)-targetFreq8);if(d<=5){$('link8').textContent=33;$('phasePanel8').hidden=false;$('signalStatus8').textContent='Frequency locked. Align phase.';tg?.HapticFeedback?.notificationOccurred?.('success');}else{$('signalStatus8').textContent=Number($('freq8').value)<targetFreq8?'Signal weak — tune higher.':'Signal weak — tune lower.';}};
$('lockPhase8').onclick=()=>{const d=Math.abs(Number($('phase8').value)-targetPhase8);if(d<=6){$('link8').textContent=66;$('pulsePanel8').hidden=false;$('signalStatus8').textContent='Phase locked. Memorize the pulse.';$('pulseDisplay8').textContent=pulse8.map(n=>['◯','△','◇'][n]).join(' ');setTimeout(()=>{$('pulseDisplay8').textContent='? ? ? ? ?';},2600);tg?.HapticFeedback?.notificationOccurred?.('success');}else{$('signalStatus8').textContent=Number($('phase8').value)<targetPhase8?'Phase drifting right.':'Phase drifting left.';}};
document.querySelectorAll('[data-pulse8]').forEach(b=>b.onclick=()=>{if($('pulsePanel8').hidden)return;pulseInput8.push(Number(b.dataset.pulse8));if(pulseInput8.length===5){const ok=pulseInput8.every((v,i)=>v===pulse8[i]);if(ok){$('link8').textContent=100;localStorage.setItem('mkty_life8','complete');$('points').textContent='360 ⭐';$('signalStatus8').textContent='Signal decoded. Coordinates received ✓';$('signalPulse').classList.add('decoded');$('life8Complete').hidden=false;unlockLife9();tg?.HapticFeedback?.notificationOccurred?.('success');}else{pulseInput8=[];$('signalStatus8').textContent='Pattern rejected. Watch the pulse again.';$('pulseDisplay8').textContent=pulse8.map(n=>['◯','△','◇'][n]).join(' ');setTimeout(()=>{$('pulseDisplay8').textContent='? ? ? ? ?';},2200);tg?.HapticFeedback?.notificationOccurred?.('error');}}});
$('life8ReturnBtn').onclick=()=>show('home');

function unlockLife9(){
 if(localStorage.getItem('mkty_life8')!=='complete')return;
 $('life8Card').classList.add('complete');$('life9Card').disabled=false;$('life9Card').classList.remove('locked');$('life9Card').classList.add('unlocked');$('life9Icon').textContent='9';$('storyProgress').style.width='99%';
}
$('continueLife9Btn').onclick=()=>{unlockLife9();$('lifeTitle').textContent='LIFE #9 — THE RETURN';$('lifeText').textContent='The final coordinates lead home.';$('enterBtn').textContent='START FINAL LIFE 🌙';$('enterBtn').onclick=startLife9;show('home');};
$('life9Card').onclick=()=>$('continueLife9Btn').click();
let navTarget9=50,syncSeq9=[],syncInput9=[],finalSeq9=[],finalInput9=[];
function startLife9(){playLifeCinematic(9,openMission9);}
function openMission9(){navTarget9=35+Math.floor(Math.random()*31);syncSeq9=Array.from({length:4},()=>Math.floor(Math.random()*3));finalSeq9=Array.from({length:4},()=>Math.floor(Math.random()*4));syncInput9=[];finalInput9=[];$('nav9').hidden=false;$('sync9').hidden=true;$('transmit9').hidden=true;$('life9Complete').hidden=true;$('phase9a').className='active';$('phase9b').className='';$('phase9c').className='';$('core9').textContent=100;$('navDial9').value=10;$('finalStatus9').textContent='Phase I — align the return corridor.';$('finalGate').classList.remove('open');show('mission9');}
$('lockNav9').onclick=()=>{const v=Number($('navDial9').value),d=Math.abs(v-navTarget9);if(d<=5){$('nav9').hidden=true;$('sync9').hidden=false;$('phase9a').className='done';$('phase9b').className='active';$('core9').textContent=72;$('finalStatus9').textContent='Phase II — synchronize the core.';$('syncHint9').textContent=syncSeq9.map(n=>['A','B','C'][n]).join(' → ');setTimeout(()=>{$('syncHint9').textContent='Repeat the sequence.';},2400);tg?.HapticFeedback?.notificationOccurred?.('success');}else{$('core9').textContent=Math.max(55,Number($('core9').textContent)-5);$('finalStatus9').textContent=v<navTarget9?'Corridor is right — increase vector.':'Corridor is left — decrease vector.';}};
document.querySelectorAll('[data-sync9]').forEach(b=>b.onclick=()=>{syncInput9.push(Number(b.dataset.sync9));const i=syncInput9.length-1;if(syncInput9[i]!==syncSeq9[i]){syncInput9=[];$('syncHint9').textContent='Sync lost. Watch again: '+syncSeq9.map(n=>['A','B','C'][n]).join(' → ');tg?.HapticFeedback?.notificationOccurred?.('error');return;}if(syncInput9.length===syncSeq9.length){$('sync9').hidden=true;$('transmit9').hidden=false;$('phase9b').className='done';$('phase9c').className='active';$('core9').textContent=48;$('finalStatus9').textContent='Phase III — transmit the return code.';$('finalCode9').textContent=finalSeq9.map(n=>['▲','●','◆','■'][n]).join(' ');setTimeout(()=>{$('finalCode9').textContent='? ? ? ?';},2500);}});
document.querySelectorAll('[data-final9]').forEach(b=>b.onclick=()=>{finalInput9.push(Number(b.dataset.final9));const i=finalInput9.length-1;if(finalInput9[i]!==finalSeq9[i]){finalInput9=[];$('core9').textContent=Math.max(10,Number($('core9').textContent)-8);$('finalStatus9').textContent='Transmission rejected. Code replaying.';$('finalCode9').textContent=finalSeq9.map(n=>['▲','●','◆','■'][n]).join(' ');setTimeout(()=>{$('finalCode9').textContent='? ? ? ?';},2000);tg?.HapticFeedback?.notificationOccurred?.('error');return;}if(finalInput9.length===finalSeq9.length){localStorage.setItem('mkty_life9','complete');$('points').textContent='450 ⭐';$('storyProgress').style.width='100%';$('phase9c').className='done';$('core9').textContent=100;$('finalGate').classList.add('open');$('finalShip').classList.add('returned');$('finalStatus9').textContent='Return transmission accepted ✓';setTimeout(()=>{$('life9Complete').hidden=false;},900);tg?.HapticFeedback?.notificationOccurred?.('success');}});
$('life9ReturnBtn').onclick=()=>show('home');








const saved=localStorage.getItem('mkty_lang');
if(saved) setLang(saved);
unlockLife2();
function renderGlobalLivesHome(){
 if(!$('globalLivesHome'))return;
 const lives=getLifeBank();$('globalLivesHome').textContent=lives+' / '+MKTY_MAX_LIVES+' ❤️';
 const stamp=Number(localStorage.getItem('mkty_life_restore_at')||0);
 if(lives>=MKTY_MAX_LIVES||!stamp){$('lifeRestoreHome').textContent='FULL';return;}
 const left=Math.max(0,stamp+MKTY_LIFE_RESTORE_MS-Date.now()),sec=Math.ceil(left/1000);
 const hh=String(Math.floor(sec/3600)).padStart(2,'0'),mm=String(Math.floor(sec%3600/60)).padStart(2,'0'),ss=String(sec%60).padStart(2,'0');
 $('lifeRestoreHome').textContent='NEXT +1  '+hh+':'+mm+':'+ss;
}
setInterval(renderGlobalLivesHome,1000);

const COMMUNITY_LINKS={
 telegram:'https://t.me/moonkattymkty',
 youtube:'https://www.youtube.com/@moonkattymkty',
 x:'https://x.com/moonkattymkty',
 tiktok:'https://www.tiktok.com/@moonkattymkty'
};
function openCommunity(platform){
 const url=COMMUNITY_LINKS[platform];
 if(!url){if($('communityStatus'))$('communityStatus').textContent=platform.toUpperCase()+' • official link pending';return;}
 if(tg?.openLink)tg.openLink(url);else window.open(url,'_blank','noopener');
}
document.querySelectorAll('[data-community]').forEach(btn=>btn.addEventListener('click',()=>openCommunity(btn.dataset.community)));

const REFERRAL_DAILY_CAP=40;
function referralCode(){return crewUser?.id?String(crewUser.id):'guest';}
function referralLink(){
 const bot='MOONKATTY_BOT'; // replace with the final official Telegram bot username before launch
 return 'https://t.me/'+bot+'?start=ref_'+referralCode();
}
function referralStats(){
 try{return JSON.parse(localStorage.getItem('mkty_referral_stats')||'{"total":0,"activeToday":0,"earnedToday":0}')}catch{return{total:0,activeToday:0,earnedToday:0}}
}
function renderCrewNetwork(){
 const s=referralStats(),earned=Math.min(REFERRAL_DAILY_CAP,Number(s.earnedToday)||0);
 if($('referralLink'))$('referralLink').textContent=referralLink();
 if($('refTotal'))$('refTotal').textContent=Number(s.total)||0;
 if($('refActive'))$('refActive').textContent=Number(s.activeToday)||0;
 if($('refEarned'))$('refEarned').textContent=earned+' ⭐';
 if($('refDailyCap'))$('refDailyCap').textContent=earned+' / '+REFERRAL_DAILY_CAP+' ⭐';
 if($('refCapBar'))$('refCapBar').style.width=(earned/REFERRAL_DAILY_CAP*100)+'%';
 const locked=moonPointsLocked();
 if($('shareReferralBtn')){$('shareReferralBtn').disabled=locked;$('shareReferralBtn').textContent=locked?'FINAL BALANCE LOCKED 🔒':'INVITE CREW 🚀';}
}
$('copyReferralBtn')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(referralLink());$('copyReferralBtn').textContent='COPIED ✓';setTimeout(()=>{$('copyReferralBtn').textContent='COPY';},1400);}catch{}});
$('shareReferralBtn')?.addEventListener('click',()=>{if(moonPointsLocked())return;const url=referralLink(),text='Join my MOONKATTY crew 🚀🌙';if(navigator.share)navigator.share({title:'MOONKATTY',text,url}).catch(()=>{});else window.open('https://t.me/share/url?url='+encodeURIComponent(url)+'&text='+encodeURIComponent(text),'_blank');});

const DAILY_REWARDS={watch:5,like:5,share:10};
function dailyKey(){return new Date().toISOString().slice(0,10);}
function dailyState(){
 const key='mkty_daily_'+dailyKey();try{return JSON.parse(localStorage.getItem(key)||'{}')}catch{return{}}
}
function saveDailyState(state){localStorage.setItem('mkty_daily_'+dailyKey(),JSON.stringify(state));}
function secondsToUtcReset(){const n=new Date(),t=new Date(n);t.setUTCHours(24,0,0,0);return Math.max(0,Math.ceil((t-n)/1000));}
function dailyMissionDestination(type){
 if(type==='watch')return COMMUNITY_LINKS.youtube;
 if(type==='like')return COMMUNITY_LINKS.x;
 if(type==='share')return COMMUNITY_LINKS.telegram;
 return '';
}
function openDailyMission(type){
 const url=dailyMissionDestination(type);
 if(!url)return;
 if(type==='share'){
  const text='Join MOONKATTY 🚀🌙';
  const shareUrl='https://t.me/share/url?url='+encodeURIComponent(COMMUNITY_LINKS.telegram)+'&text='+encodeURIComponent(text);
  if(tg?.openTelegramLink)tg.openTelegramLink(shareUrl);else window.open(shareUrl,'_blank','noopener');
  return;
 }
 if(tg?.openLink)tg.openLink(url);else window.open(url,'_blank','noopener');
}

function renderDailyMissions(){
 const state=dailyState();let done=0,locked=moonPointsLocked();
 document.querySelectorAll('.daily-task').forEach(card=>{const type=card.dataset.daily,ok=state[type]==='verified';card.classList.toggle('done',ok);const b=card.querySelector('.daily-action');if(ok){done++;b.textContent='CLAIMED ✓';b.disabled=true;}else if(locked){b.disabled=true;b.textContent='BALANCE LOCKED';}else{b.disabled=false;b.textContent=type==='share'?'SHARE':'OPEN';}});
 if($('dailyProgress'))$('dailyProgress').textContent=done+' / 3';
 if($('dailyReward'))$('dailyReward').classList.toggle('ready',done===3);
 const sec=secondsToUtcReset(),hh=String(Math.floor(sec/3600)).padStart(2,'0'),mm=String(Math.floor(sec%3600/60)).padStart(2,'0'),ss=String(sec%60).padStart(2,'0');
 if($('dailyReset'))$('dailyReset').textContent='RESET '+hh+':'+mm+':'+ss;
}
document.querySelectorAll('.daily-action').forEach(btn=>btn.onclick=()=>{
 const card=btn.closest('.daily-task'),type=card.dataset.daily;if(moonPointsLocked())return;openDailyMission(type);
 // Placeholder until official community URLs/API verification are connected.
 if(type==='share' && navigator.share){navigator.share({title:'MOONKATTY',text:'Join the MOONKATTY mission 🚀🌙'}).catch(()=>{});}
 $('dailyProgress').textContent='VERIFYING…';
 setTimeout(()=>renderDailyMissions(),700);
});
setInterval(renderDailyMissions,1000);

function renderMissionArchive(){
 let count=0;
 const life1=localStorage.getItem('mkty_life1')==='complete';
 const verified=localStorage.getItem('mkty_life3_memory_verified')==='yes';
 const finale=localStorage.getItem('mkty_life9')==='complete';
 if(life1){count++;$('intelSignal')?.classList.remove('locked');$('intelSignal')?.classList.add('found');if($('intelSignalState'))$('intelSignalState').textContent='10-DIGIT KEY RECOVERED';}
 if(verified){count++;$('intelMemory')?.classList.remove('locked');$('intelMemory')?.classList.add('found');if($('intelMemoryState'))$('intelMemoryState').textContent='IDENTITY CONFIRMED';}
 if(finale){count++;$('intelMoon')?.classList.remove('locked');$('intelMoon')?.classList.add('found');if($('intelMoonState'))$('intelMoonState').textContent='TRUTH UNLOCKED';}
 if($('archiveCount'))$('archiveCount').textContent=count+' / 3';
}

function moonPointsLocked(){return localStorage.getItem('mkty_life9')==='complete';}
function lockFinalMoonPoints(){
 if(!moonPointsLocked())return;
 if(!localStorage.getItem('mkty_final_moon_points')){
  const shown=parseInt(($('points')?.textContent||'0').replace(/\D/g,''),10)||0;
  localStorage.setItem('mkty_final_moon_points',String(shown));
  localStorage.setItem('mkty_points_locked_at',String(Date.now()));
 }
}
function renderFinalMoonPoints(){
 if(!moonPointsLocked())return;
 lockFinalMoonPoints();
 const final=Number(localStorage.getItem('mkty_final_moon_points')||0);
 if($('points'))$('points').textContent=final+' ⭐ 🔒';
}
$('rulesBtn')?.addEventListener('click',()=>show('rules'));
$('rulesCloseBtn')?.addEventListener('click',()=>show('home'));
$('rulesBackBtn')?.addEventListener('click',()=>show('home'));

function restoreGameProgress(){
 const completed=[1,2,3,4,5,6,7,8,9].filter(n=>localStorage.getItem('mkty_life'+n)==='complete');
 // mkty_points is the canonical earned-points balance. Do not overwrite it with
 // the old prototype 10/20/30 story calculation on reload.
 const savedPoints=Number(localStorage.getItem('mkty_points')||0);
 if($('points')) $('points').textContent=savedPoints+' ⭐';
 if($('livesProgress')) $('livesProgress').textContent=completed.length+' / 9 🌙';
 unlockLife2();unlockLife3();unlockLife4();unlockLife5();unlockLife6();unlockLife7();unlockLife8();unlockLife9();
 if(localStorage.getItem('mkty_life1')==='complete'){
  if($('life1Complete')) $('life1Complete').hidden=false;
  if($('l1Points')) $('l1Points').textContent=savedPoints+' ⭐';
 }
 if(completed.length===9 && $('storyProgress')) $('storyProgress').style.width='100%';
 renderFinalMoonPoints();
}

restoreGameProgress();
renderGlobalLivesHome();
renderMissionArchive();

