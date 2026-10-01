
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

// LIFE #1 mobile exploration controller
let l1PX=50,l1PY=68,l1MoveX=0,l1MoveY=0,l1MoveFrame=0,l1Near=null;
const l1Player=$('life1Player'),l1Joy=$('life1Joystick'),l1Stick=$('life1Stick'),l1Action=$('life1ActionBtn');
function renderLife1Player(){
 if(!l1Player)return;
 l1Player.style.left=l1PX+'%';l1Player.style.top=l1PY+'%';
 l1Player.classList.toggle('walking',Math.abs(l1MoveX)+Math.abs(l1MoveY)>.08);
 if(l1MoveX<-.08)l1Player.classList.add('face-left');else if(l1MoveX>.08)l1Player.classList.remove('face-left');
}
function l1DistanceTo(el){
 if(!el||!l1Player)return 999;
 const w=$('life1World').getBoundingClientRect(),a=l1Player.getBoundingClientRect(),b=el.getBoundingClientRect();
 const ax=a.left+a.width/2,ay=a.top+a.height/2,bx=b.left+b.width/2,by=b.top+b.height/2;
 return Math.hypot(ax-bx,ay-by)/Math.max(1,Math.min(w.width,w.height));
}
function updateLife1Nearby(){
 document.querySelectorAll('.l1-hotspot').forEach(x=>x.classList.remove('nearby'));
 const candidates=[...document.querySelectorAll('.l1-hotspot')].filter(x=>!x.disabled&&!x.classList.contains('collected'));
 let best=null,bestD=.24;
 candidates.forEach(x=>{const d=l1DistanceTo(x);if(d<bestD){best=x;bestD=d;}});
 l1Near=best;
 if(best)best.classList.add('nearby');
 if(l1Action){l1Action.disabled=!best;l1Action.classList.toggle('ready',!!best);l1Action.textContent=best?.classList.contains('energy')?'COLLECT':best?.id==='repairTerminal'?'REPAIR':best?.id==='antennaHotspot'?'TUNE':'ACTION';}
}
function life1Blocked(px,py){
 // Collision rectangles in world-percent coordinates. They match the visible
 // lunar rocks/crate but are slightly padded for the astronaut's suit.
 const blocks=[
  [24,48,45,66], // rock A
  [72,60,91,76], // rock B
  [53,37,72,57]  // cargo crate
 ];
 return blocks.some(([x1,y1,x2,y2])=>px>x1&&px<x2&&py>y1&&py<y2);
}
function life1MoveLoop(){
 if(Math.abs(l1MoveX)+Math.abs(l1MoveY)>.02){
  const speed=.32;
  const nx=Math.max(7,Math.min(90,l1PX+l1MoveX*speed));
  const ny=Math.max(18,Math.min(82,l1PY+l1MoveY*speed));
  // Resolve axes independently so MoonKatty slides naturally along obstacles.
  if(!life1Blocked(nx,l1PY))l1PX=nx;
  if(!life1Blocked(l1PX,ny))l1PY=ny;
  renderLife1Player();updateLife1Nearby();
 }
 l1MoveFrame=requestAnimationFrame(life1MoveLoop);
}
let l1PointerId=null;
function setLife1Stick(clientX,clientY){
 const r=l1Joy.getBoundingClientRect();
 const dx=clientX-(r.left+r.width/2),dy=clientY-(r.top+r.height/2);
 const max=r.width*.31,len=Math.hypot(dx,dy)||1,scale=Math.min(1,max/len);
 const sx=dx*scale,sy=dy*scale;
 l1Stick.style.transform='translate('+sx+'px,'+sy+'px)';
 // Screen coordinates: +X = right, +Y = down. Player uses the same convention.
 l1MoveX=Math.max(-1,Math.min(1,dx/max));
 l1MoveY=Math.max(-1,Math.min(1,dy/max));
 if($('l1Debug'))$('l1Debug').textContent='MOVE • X '+l1MoveX.toFixed(2)+' • Y '+l1MoveY.toFixed(2);
}
function stopLife1Stick(pointerId){
 if(pointerId!=null&&l1PointerId!=null&&pointerId!==l1PointerId)return;
 l1PointerId=null;l1MoveX=0;l1MoveY=0;l1Stick.style.transform='translate(0,0)';if($('l1Debug'))$('l1Debug').textContent='UP • X 0.00 • Y 0.00';renderLife1Player();
}
if(l1Joy){
 l1Joy.style.touchAction='none';
 // iOS/Telegram WebView can still turn a downward joystick drag into page scroll.
 // Cancel touch scrolling only while the gesture belongs to the joystick.
 ['touchstart','touchmove'].forEach(type=>l1Joy.addEventListener(type,ev=>{ev.preventDefault();ev.stopPropagation();},{passive:false}));
 l1Joy.addEventListener('pointerdown',ev=>{ev.preventDefault();ev.stopPropagation();l1PointerId=ev.pointerId;l1Joy.setPointerCapture?.(ev.pointerId);setLife1Stick(ev.clientX,ev.clientY);},{passive:false});
 l1Joy.addEventListener('pointermove',ev=>{if(ev.pointerId!==l1PointerId)return;ev.preventDefault();ev.stopPropagation();setLife1Stick(ev.clientX,ev.clientY);},{passive:false});
 l1Joy.addEventListener('pointerup',ev=>{ev.preventDefault();stopLife1Stick(ev.pointerId);},{passive:false});
 l1Joy.addEventListener('pointercancel',ev=>stopLife1Stick(ev.pointerId));
 l1Joy.addEventListener('lostpointercapture',()=>stopLife1Stick(null));
}
document.querySelectorAll('[data-move1]').forEach(btn=>{
 const vectors={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
 const start=ev=>{ev.preventDefault();ev.stopPropagation();const [x,y]=vectors[btn.dataset.move1];l1MoveX=x;l1MoveY=y;if($('l1Debug'))$('l1Debug').textContent='DPAD '+btn.dataset.move1.toUpperCase()+' • X '+x+' • Y '+y;};
 const stop=ev=>{ev?.preventDefault?.();l1MoveX=0;l1MoveY=0;if($('l1Debug'))$('l1Debug').textContent='DPAD UP • X 0 • Y 0';};
 btn.addEventListener('pointerdown',start,{passive:false});btn.addEventListener('pointerup',stop,{passive:false});btn.addEventListener('pointercancel',stop);btn.addEventListener('pointerleave',stop);
});
l1Action?.addEventListener('click',()=>{
 if(!l1Near)return;
 if(l1Near.classList.contains('energy'))collectLife1Energy(l1Near);
 else if(l1Near.id==='repairTerminal'&&life1Stage===1){$('repairPanel').hidden=false;$('repairPanel').scrollIntoView({behavior:'smooth',block:'center'});}
 else if(l1Near.id==='antennaHotspot'&&life1Stage===2){$('antennaPanel').hidden=false;$('antennaPanel').scrollIntoView({behavior:'smooth',block:'center'});}
 updateLife1Nearby();
});
renderLife1Player();cancelAnimationFrame(l1MoveFrame);life1MoveFrame=requestAnimationFrame(life1MoveLoop);

function life1Scan(){
 const pulse=$('l1ScannerPulse');if(pulse){pulse.classList.remove('run');void pulse.offsetWidth;pulse.classList.add('run');}
 let found=0;
 document.querySelectorAll('.l1-hotspot.energy:not(.collected)').forEach(el=>{
  if(l1DistanceTo(el)<.62){el.classList.add('revealed');found++;setTimeout(()=>{if(!el.classList.contains('nearby')&&!el.classList.contains('collected'))el.classList.remove('revealed');},4500);}
 });
 $('missionStatus').textContent=found?('Scanner: '+found+' energy signature'+(found===1?'':'s')+' nearby. Move closer to collect.'):'Scanner: no energy signature in range. Explore another sector.';
 tg?.HapticFeedback?.impactOccurred?.('light');
}
$('l1ScanBtn')?.addEventListener('click',life1Scan);
function resetLife1Mission(){
 life1Stage=0; energyCollected=0; repairCells=0; targetFrequency=58+Math.floor(Math.random()*22); l1PX=50;l1PY=68;l1Near=null;renderLife1Player();updateLife1Nearby();
 document.querySelectorAll('.l1-hotspot.energy').forEach(x=>{x.disabled=false;x.classList.remove('collected','revealed','nearby')});
 document.querySelectorAll('.repair-cells button').forEach(x=>{x.disabled=false;x.classList.remove('done')});
 $('repairTerminal').disabled=true;$('antennaHotspot').disabled=true;$('repairPanel').hidden=true;$('antennaPanel').hidden=true;$('life1Complete').hidden=true;clearInterval(signalHoldTimer);signalHoldTimer=null;signalHoldProgress=0;if($('signalHold'))$('signalHold').hidden=true;newRepairSequence();
 $('energyCount').textContent='0/3';$('repairCount').textContent='0/1';$('antennaCount').textContent='0/1';$('repairFill').style.width='0%';
 $('qEnergy').className='active';$('qRepair').className='';$('qAntenna').className='';
 $('missionStatus').textContent='Explore Moon Base Alpha. Use SCAN to reveal nearby energy signatures.';
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
let repairSequence=[],repairInput=[],repairShowing=false,signalHoldTimer=null,signalHoldProgress=0;
function newRepairSequence(){
 repairSequence=Array.from({length:4},()=>Math.floor(Math.random()*3));repairInput=[];repairCells=0;
 $('repairFill').style.width='0%';$('repairSequence').textContent='● ● ● ●';$('repairHint').textContent='Memorize the power sequence, then repeat it.';
 document.querySelectorAll('.repair-cells button').forEach(x=>{x.disabled=false;x.classList.remove('done','cue')});
}
function showRepairSequence(){
 if(repairShowing)return;repairShowing=true;repairInput=[];$('repairHint').textContent='Watch carefully…';
 document.querySelectorAll('.repair-cells button').forEach(x=>x.disabled=true);
 let i=0;const labels=['A','B','C'];
 const step=()=>{
  document.querySelectorAll('.repair-cells button').forEach(x=>x.classList.remove('cue'));
  if(i>=repairSequence.length){$('repairSequence').textContent='● ● ● ●';$('repairHint').textContent='Now repeat the sequence.';document.querySelectorAll('.repair-cells button').forEach(x=>x.disabled=false);repairShowing=false;return;}
  const n=repairSequence[i];$('repairSequence').textContent=labels[repairSequence[0]]+(i>0?' '+labels[repairSequence[1]]:'')+(i>1?' '+labels[repairSequence[2]]:'')+(i>2?' '+labels[repairSequence[3]]:'');
  document.querySelector('[data-cell="'+n+'"]').classList.add('cue');i++;setTimeout(step,650);
 };step();
}
$('showRepairSequenceBtn')?.addEventListener('click',showRepairSequence);
document.querySelectorAll('.repair-cells button').forEach(btn=>btn.onclick=()=>{
 if(life1Stage!==1||repairShowing)return;
 const n=Number(btn.dataset.cell),expected=repairSequence[repairInput.length];
 if(n!==expected){
  repairInput=[];repairCells=0;$('repairFill').style.width='0%';$('repairHint').textContent='Wrong circuit. Power trace reset — read it again.';tg?.HapticFeedback?.notificationOccurred?.('error');return;
 }
 repairInput.push(n);repairCells=repairInput.length;$('repairFill').style.width=(repairCells/4*100)+'%';tg?.HapticFeedback?.impactOccurred('medium');
 if(repairCells===4){life1Stage=2;$('repairCount').textContent='1/1';$('qRepair').className='done';$('qAntenna').className='active';$('repairPanel').hidden=true;$('antennaHotspot').disabled=false;$('missionStatus').textContent='Terminal online. Reach COMMS and calibrate the antenna 📡';updateLife1Nearby();}
});
$('antennaHotspot').onclick=()=>{if(life1Stage!==2)return;$('antennaPanel').hidden=false;$('antennaPanel').scrollIntoView({behavior:'smooth',block:'center'});};
function updateSignalStrength(){
 const v=Number($('frequencyDial').value),d=Math.abs(v-targetFrequency),strength=Math.max(0,100-d*4);
 $('frequencyValue').textContent=(136+v/10).toFixed(1);if($('signalMeterFill'))$('signalMeterFill').style.width=strength+'%';
 if(signalHoldTimer&&d>3){clearInterval(signalHoldTimer);signalHoldTimer=null;signalHoldProgress=0;$('signalHoldFill').style.width='0%';$('signalHoldText').textContent='0%';$('signalHint').textContent='Signal lost — reacquire the carrier.';}
}
$('frequencyDial').oninput=updateSignalStrength;
function finishLife1Signal(){
 clearInterval(signalHoldTimer);signalHoldTimer=null;life1Stage=3;$('antennaCount').textContent='1/1';$('qAntenna').className='done';$('antennaPanel').hidden=true;$('missionStatus').textContent='Signal synchronized. Moon Base Alpha is online!';tg?.HapticFeedback?.notificationOccurred?.('success');
 let pts=awardLifePoints(1,500);$('l1Points').textContent=pts+' ⭐';
 setTimeout(()=>{$('life1Complete').hidden=false;$('life1Complete').scrollIntoView({behavior:'smooth',block:'center'});},300);
}
$('tuneBtn').onclick=()=>{
 if(life1Stage!==2||signalHoldTimer)return;const v=Number($('frequencyDial').value),d=Math.abs(v-targetFrequency);
 if(d>3){$('signalHint').textContent=v<targetFrequency?'Carrier is higher — tune right.':'Carrier is lower — tune left.';tg?.HapticFeedback?.impactOccurred('light');return;}
 signalHoldProgress=0;$('signalHold').hidden=false;$('signalHint').textContent='Carrier acquired. Hold frequency steady for synchronization.';
 signalHoldTimer=setInterval(()=>{const now=Number($('frequencyDial').value);if(Math.abs(now-targetFrequency)>3){updateSignalStrength();return;}signalHoldProgress+=4;$('signalHoldFill').style.width=signalHoldProgress+'%';$('signalHoldText').textContent=signalHoldProgress+'%';if(signalHoldProgress>=100)finishLife1Signal();},120);
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

function awardLifePoints(n,amount){
 const key='mkty_life'+n,awardKey=key+'_awarded';
 let pts=Number(localStorage.getItem('mkty_points')||0);
 if(localStorage.getItem(awardKey)!=='yes'){pts+=amount;localStorage.setItem('mkty_points',String(pts));localStorage.setItem(awardKey,'yes');}
 localStorage.setItem(key,'complete');if($('points'))$('points').textContent=pts+' ⭐';if($('livesProgress')){const done=[1,2,3,4,5,6,7,8,9].filter(x=>localStorage.getItem('mkty_life'+x)==='complete').length;$('livesProgress').textContent=done+' / 9 🌙';}return pts;
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
$('continueLife2Btn').onclick=(ev)=>{
 ev?.preventDefault?.();
 ev?.stopPropagation?.();
 if(localStorage.getItem('mkty_life1')!=='complete')return;
 unlockLife2();
 if($('lifeTitle')) $('lifeTitle').textContent='LIFE #2 — THE CREW';
 if($('lifeText')) $('lifeText').textContent='Assemble your crew. Each specialist must pass a challenge.';
 if($('enterBtn')){
  $('enterBtn').textContent='START LIFE #2 🚀';
  $('enterBtn').onclick=startLife2;
 }
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

let crewCount=0,activeMate=null,nav2X=8,nav2Y=78,nav2Gate=0,nav2Timer=null,wire2=[0,0,0,0],scout2Hits=0,scout2Timer=null,crewSync2=[],crewSyncInput2=[];
function completeMate(btn){
 if(!btn||btn.classList.contains('joined'))return;
 btn.classList.add('joined');crewCount++;activeMate=null;document.querySelectorAll('.crew-task').forEach(x=>x.hidden=true);
 $('crewChallengeTitle').textContent='SPECIALIST RECRUITED ✓';$('crewStatus').textContent='Crew assembled: '+crewCount+' / 3'+(crewCount===3?' • Final sync ready':' • Final sync locked');tg?.HapticFeedback?.notificationOccurred?.('success');
 if(crewCount===3){$('crewFinal2').hidden=false;$('crewChallengeTitle').textContent='FINAL CREW PROTOCOL';}
}
function resetNav2(){
 clearInterval(nav2Timer);nav2X=8;nav2Y=78;nav2Gate=0;$('navShip2').style.left=nav2X+'%';$('navShip2').style.top=nav2Y+'%';$('navHint2').textContent='Gates cleared: 0 / 3';
 nav2Timer=setInterval(()=>{if($('navigatorTask').hidden){clearInterval(nav2Timer);return;}nav2X+=1.25;nav2Y+=Math.sin(nav2X/9)*.45;const targets=[[18,34],[48,62],[82,25]];if(nav2Gate<3){const [gx,gy]=targets[nav2Gate];if(Math.abs(nav2X-gx)<5&&Math.abs(nav2Y-gy)<14){nav2Gate++;$('navHint2').textContent='Gates cleared: '+nav2Gate+' / 3';tg?.HapticFeedback?.impactOccurred?.('light');}}if(nav2X>92){clearInterval(nav2Timer);if(nav2Gate===3)completeMate(activeMate);else{$('crewStatus').textContent='Navigator missed a gate. Flight corridor reset.';resetNav2();}}$('navShip2').style.left=nav2X+'%';$('navShip2').style.top=Math.max(8,Math.min(84,nav2Y))+'%';},90);
}
document.querySelectorAll('[data-nav2]').forEach(b=>b.onclick=()=>{nav2Y=Math.max(8,Math.min(84,nav2Y+Number(b.dataset.nav2)*8));});
function resetEngineer2(){wire2=[0,0,0,0];document.querySelectorAll('[data-wire2]').forEach((b,i)=>{b.style.transform='rotate(0deg)';b.classList.remove('live');});$('engineerHint2').textContent='Rotate all junctions. Every segment must align.';}
document.querySelectorAll('[data-wire2]').forEach((b,i)=>b.onclick=()=>{wire2[i]=(wire2[i]+1)%4;b.style.transform='rotate('+(wire2[i]*90)+'deg)';});
$('testCircuit2').onclick=()=>{const target=[1,3,2,0];const ok=wire2.every((v,i)=>v===target[i]);if(ok){document.querySelectorAll('[data-wire2]').forEach(b=>b.classList.add('live'));$('engineerHint2').textContent='Circuit stable ✓';setTimeout(()=>completeMate(activeMate),450);}else{$('engineerHint2').textContent='Open circuit detected. Trace the junctions again.';tg?.HapticFeedback?.notificationOccurred?.('error');}};
function stopScout2(){clearInterval(scout2Timer);scout2Timer=null;}
function buildAnomaly(){
 stopScout2();scout2Hits=0;const grid=$('anomalyGrid');grid.innerHTML='';for(let i=0;i<9;i++){const b=document.createElement('button');b.textContent='·';grid.appendChild(b);}
 const relocate=()=>{grid.querySelectorAll('button').forEach(b=>{b.classList.remove('target');b.textContent='·';b.onclick=null;});const cells=[...grid.querySelectorAll('button')],b=cells[Math.floor(Math.random()*cells.length)];b.classList.add('target');b.textContent='✦';b.onclick=()=>{if(!b.classList.contains('target'))return;scout2Hits++;$('scoutHint2').textContent='Anomalies tagged: '+scout2Hits+' / 3';tg?.HapticFeedback?.impactOccurred?.('medium');if(scout2Hits>=3){stopScout2();completeMate(activeMate);}else relocate();};};
 relocate();scout2Timer=setInterval(relocate,1100);
}
document.querySelectorAll('.mate').forEach(btn=>btn.onclick=()=>{if(btn.classList.contains('joined'))return;stopScout2();clearInterval(nav2Timer);activeMate=btn;document.querySelectorAll('.crew-task').forEach(x=>x.hidden=true);const role=btn.dataset.mate;$('crewChallengeTitle').textContent=role.toUpperCase()+' CHALLENGE';if(role==='Navigator'){$('navigatorTask').hidden=false;resetNav2();}if(role==='Engineer'){$('engineerTask').hidden=false;resetEngineer2();}if(role==='Scout'){$('scoutTask').hidden=false;buildAnomaly();}});
function makeCrewSync2(){crewSync2=Array.from({length:5},()=>['N','E','S'][Math.floor(Math.random()*3)]);crewSyncInput2=[];}
$('showCrewSync2').onclick=()=>{makeCrewSync2();$('crewSyncCode2').textContent=crewSync2.join(' ');$('crewSyncHint2').textContent='Memorize the transmission…';setTimeout(()=>{$('crewSyncCode2').textContent='? ? ? ? ?';$('crewSyncHint2').textContent='Repeat the five-role sequence.';},2400);};
document.querySelectorAll('[data-sync2]').forEach(b=>b.onclick=()=>{if(crewCount!==3||!crewSync2.length)return;const v=b.dataset.sync2;if(v!==crewSync2[crewSyncInput2.length]){crewSyncInput2=[];$('crewSyncHint2').textContent='Sync failed. Receive a new sequence.';makeCrewSync2();tg?.HapticFeedback?.notificationOccurred?.('error');return;}crewSyncInput2.push(v);$('crewSyncHint2').textContent='Synchronized: '+crewSyncInput2.length+' / 5';if(crewSyncInput2.length===5){awardLifePoints(2,500);$('life2Complete').hidden=false;$('crewFinal2').hidden=true;$('crewStatus').textContent='Crew synchronized. Mission ready ✓';tg?.HapticFeedback?.notificationOccurred?.('success');}});
$('life2ReturnBtn').onclick=()=>show('home');

function unlockLife3(){
 if(localStorage.getItem('mkty_life2')!=='complete')return false;
 const life2Card=$('life2Card'),life3Card=$('life3Card'),life3Icon=$('life3Icon'),storyProgress=$('storyProgress');
 life2Card?.classList.add('complete');
 if(life3Card){life3Card.disabled=false;life3Card.classList.remove('locked');life3Card.classList.add('unlocked');}
 if(life3Icon)life3Icon.textContent='3';
 if(storyProgress)storyProgress.style.width='33%';
 return true;
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
$('continueLife3Btn').onclick=(ev)=>{ev?.preventDefault?.();if(!unlockLife3())return;if($('lifeTitle'))$('lifeTitle').textContent='LIFE #3 — THE LAUNCH CODE';if($('lifeText'))$('lifeText').textContent='Decrypt the ship launch authorization sequence.';if($('enterBtn')){$('enterBtn').textContent='START LIFE #3 🚀';$('enterBtn').onclick=startLife3;}startLife3();};
if($('life3Card'))$('life3Card').onclick=()=>$('continueLife3Btn').click();$('life3SkipBtn').onclick=openLife3MemoryGate;
$('verifyLife1CodeBtn').onclick=()=>{const lock=Number(localStorage.getItem('mkty_life3_code_lock_until')||0);if(lock>Date.now())return;const entered=$('life3MemoryInput').value.trim();if(entered===ensureLife1MemoryCode()){clearInterval(gateTimer);$('life3GateStatus').textContent='CODE VERIFIED ✓';localStorage.setItem('mkty_life3_memory_verified','yes');renderMissionArchive();
renderDailyMissions();
renderCrewNetwork();$('life3MemoryGate').hidden=true;$('life3CodeMission').hidden=false;tg?.HapticFeedback?.notificationOccurred?.('success');return;}if(!spendGlobalLife()){$('life3GateStatus').textContent='No lives available. A life restores every 12 hours.';return;}localStorage.setItem('mkty_life3_code_lock_until',String(Date.now()+MKTY_CODE_LOCK_MS));$('life3MemoryInput').value='';tg?.HapticFeedback?.notificationOccurred?.('error');renderLife3Gate();};
$('buyCodeHintBtn').onclick=()=>{if(Number(localStorage.getItem('mkty_life3_code_lock_until')||0)>Date.now())return;if(!spendGlobalLife()){$('life3GateStatus').textContent='No lives available. A life restores every 12 hours.';return;}const code=ensureLife1MemoryCode();$('life3GateStatus').textContent='HINT: first 5 digits are '+code.slice(0,5)+' • remaining digits: '+code.slice(5).replace(/./g,'•');$('life3MemoryInput').focus();};
let launchCode=[],codeInput=[],codeAttempts=3,codeReady=false;
const codeSymbols=['▲','●','◆','■'];
function newLaunchCode(){launchCode=Array.from({length:4},()=>codeSymbols[Math.floor(Math.random()*4)]);codeInput=[];codeReady=false;$('codeSequence').textContent='READY';$('codeStatus').textContent='Attempts: '+codeAttempts;}
$('showCodeBtn').onclick=()=>{newLaunchCode();$('codeSequence').textContent=launchCode.join('  ');$('showCodeBtn').disabled=true;setTimeout(()=>{$('codeSequence').textContent='?  ?  ?  ?';codeReady=true;$('showCodeBtn').disabled=false;},2200);};
document.querySelectorAll('[data-code]').forEach(b=>b.onclick=()=>{if(!codeReady)return;codeInput.push(b.dataset.code);$('codeSequence').textContent=codeInput.join('  ');if(codeInput.length===4){if(codeInput.join('')===launchCode.join('')){codeReady=false;$('codeStatus').textContent='STAGE I COMPLETE ✓';$('launchStage2').hidden=false;$('launchStage2').scrollIntoView({behavior:'smooth',block:'center'});tg?.HapticFeedback?.notificationOccurred?.('success');}else{codeAttempts--;tg?.HapticFeedback?.notificationOccurred?.('error');if(codeAttempts<=0){codeAttempts=3;$('codeStatus').textContent='Security reset. New code generated.';}else $('codeStatus').textContent='Incorrect sequence. Attempts: '+codeAttempts;newLaunchCode();}}});
let ignitionOrder3=[],ignitionInput3=[],launchTimer3=null,launchTime3=100;
function updateMix3(){
 const a=Number($('mixO2').value),b=Number($('mixFuel').value),d=Number($('mixCool').value),total=a+b+d;
 $('mixO2Val').textContent=a;$('mixFuelVal').textContent=b;$('mixCoolVal').textContent=d;$('mixTotal3').textContent=total;
 $('mixHint3').textContent=total===100?'Total stable. Balance profile still required.':total>100?'Overpressure — reduce mixture.':'Insufficient load — increase mixture.';
}
['mixO2','mixFuel','mixCool'].forEach(id=>$(id)?.addEventListener('input',updateMix3));
$('lockMix3')?.addEventListener('click',()=>{
 const a=Number($('mixO2').value),b=Number($('mixFuel').value),d=Number($('mixCool').value);
 if(a+b+d!==100){$('mixHint3').textContent='Total load must equal exactly 100.';return;}
 // Broad enough to solve by reasoning, not pixel hunting: oxygen 25-35, fuel 40-50, coolant remainder.
 if(a<25||a>35||b<40||b>50||d<20||d>35){$('mixHint3').textContent='Matrix unstable. FUEL needs the largest share; O₂ and COOLANT must remain balanced.';tg?.HapticFeedback?.impactOccurred?.('light');return;}
 $('mixHint3').textContent='Fuel matrix stable ✓';$('launchStage3').hidden=false;$('launchStage3').scrollIntoView({behavior:'smooth',block:'center'});tg?.HapticFeedback?.notificationOccurred?.('success');
});
function stopLaunchTimer3(){clearInterval(launchTimer3);launchTimer3=null;}
function resetIgnition3(msg='Awaiting launch order.'){stopLaunchTimer3();ignitionInput3=[];launchTime3=100;$('launchTimerFill3').style.width='100%';$('ignitionHint3').textContent=msg;}
$('showIgnition3')?.addEventListener('click',()=>{
 resetIgnition3('Memorize the ignition order…');ignitionOrder3=['NAV','CORE','COMMS'].sort(()=>Math.random()-.5);$('ignitionOrder3').textContent=ignitionOrder3.join(' → ');
 setTimeout(()=>{$('ignitionOrder3').textContent='? → ? → ?';$('ignitionHint3').textContent='GO — arm all systems before time expires!';launchTimer3=setInterval(()=>{launchTime3-=2;$('launchTimerFill3').style.width=Math.max(0,launchTime3)+'%';if(launchTime3<=0){resetIgnition3('Launch window missed. Receive a new order.');tg?.HapticFeedback?.notificationOccurred?.('error');}},100);},1800);
});
document.querySelectorAll('[data-ignite3]').forEach(b=>b.onclick=()=>{
 if(!launchTimer3||!ignitionOrder3.length)return;const v=b.dataset.ignite3;
 if(v!==ignitionOrder3[ignitionInput3.length]){resetIgnition3('Wrong system. Launch sequence aborted — receive a new order.');tg?.HapticFeedback?.notificationOccurred?.('error');return;}
 ignitionInput3.push(v);$('ignitionHint3').textContent='Armed: '+ignitionInput3.length+' / 3';
 if(ignitionInput3.length===3){stopLaunchTimer3();awardLifePoints(3,750);$('codeStatus').textContent='LAUNCH AUTHORIZED ✓';$('life3Complete').hidden=false;$('launchStage3').hidden=true;tg?.HapticFeedback?.notificationOccurred?.('success');}
});
$('life3ReturnBtn').onclick=()=>show('home');

function unlockLife4(){
 if(localStorage.getItem('mkty_life3')!=='complete')return false;
 const a=$('life3Card'),b=$('life4Card'),i=$('life4Icon'),p=$('storyProgress');a?.classList.add('complete');if(b){b.disabled=false;b.classList.remove('locked');b.classList.add('unlocked');}if(i)i.textContent='4';if(p)p.style.width='44%';return true;
}
$('continueLife4Btn').onclick=(ev)=>{ev?.preventDefault?.();if(!unlockLife4())return;startLife4();};
if($('life4Card'))$('life4Card').onclick=()=>$('continueLife4Btn').click();
let alt4=2400,vel4=28,fuel4=100,drift4=0,driftVel4=0,descentTimer=null,burnHeld4=false,leftHeld4=false,rightHeld4=false,descentActive4=false;
function renderDescent(){
 $('altitude').textContent=Math.max(0,Math.round(alt4));$('velocity').textContent=Math.max(0,vel4.toFixed(1));$('fuel').textContent=Math.max(0,Math.round(fuel4));$('driftRead4').textContent=(drift4>0?'+':'')+Math.round(drift4);
 $('lander').style.transform='translateX('+drift4+'px)';$('lander').style.setProperty('--drift4',drift4+'px');
 $('safeVel4').classList.toggle('safe',vel4<=12);$('safeDrift4').classList.toggle('safe',Math.abs(drift4)<=32);document.querySelector('.landing-zone')?.classList.toggle('safe-zone',vel4<=12&&Math.abs(drift4)<=32);
 $('thrustRead4').textContent=$('thrustDial').value+'%';
}
function startLife4(){playLifeCinematic(4,openMission4);}
function finishDescent4(success){
 descentActive4=false;clearInterval(descentTimer);descentTimer=null;burnHeld4=leftHeld4=rightHeld4=false;$('lander').classList.remove('thrusting');
 if(success){awardLifePoints(4,1000);$('descentStatus').textContent='Touchdown confirmed ✓';$('life4Complete').hidden=false;tg?.HapticFeedback?.notificationOccurred?.('success');}
 else{$('lander').classList.add('crashed');$('descentStatus').textContent='HARD LANDING — velocity or drift outside safe limits. Retrying…';tg?.HapticFeedback?.notificationOccurred?.('error');setTimeout(openMission4,1600);}
}
function openMission4(){
 alt4=2400;vel4=28;fuel4=100;drift4=0;driftVel4=(Math.random()-.5)*1.2;descentActive4=true;$('life4Complete').hidden=true;$('lander').classList.remove('crashed','thrusting');$('descentStatus').textContent='Manual descent active. Control velocity, drift and fuel.';show('mission4');renderDescent();clearInterval(descentTimer);
 descentTimer=setInterval(()=>{
  if(!descentActive4)return;const power=Number($('thrustDial').value)/100;
  vel4+=.22;
  if(burnHeld4&&fuel4>0){vel4=Math.max(0,vel4-(.2+power*.72));fuel4=Math.max(0,fuel4-(.12+power*.18));$('lander').classList.add('thrusting');}else $('lander').classList.remove('thrusting');
  if(leftHeld4&&fuel4>0){driftVel4-=.18;fuel4=Math.max(0,fuel4-.07);}if(rightHeld4&&fuel4>0){driftVel4+=.18;fuel4=Math.max(0,fuel4-.07);}
  driftVel4*=.985;drift4+=driftVel4;drift4=Math.max(-105,Math.min(105,drift4));alt4-=vel4*.48;
  if(fuel4<=0)$('descentStatus').textContent='FUEL DEPLETED — ballistic descent!';
  if(alt4<=0){alt4=0;renderDescent();finishDescent4(vel4<=12&&Math.abs(drift4)<=32);return;}renderDescent();
 },100);
}
function holdControl4(el,setter){
 const on=ev=>{ev.preventDefault();setter(true);el.setPointerCapture?.(ev.pointerId);},off=()=>setter(false);
 el.addEventListener('pointerdown',on);el.addEventListener('pointerup',off);el.addEventListener('pointercancel',off);el.addEventListener('pointerleave',off);
}
holdControl4($('burnBtn'),v=>burnHeld4=v);holdControl4($('leftThruster'),v=>leftHeld4=v);holdControl4($('rightThruster'),v=>rightHeld4=v);
$('thrustDial').oninput=renderDescent;
$('life4ReturnBtn').onclick=()=>show('home');

function unlockLife5(){
 if(localStorage.getItem('mkty_life4')!=='complete')return false;const a=$('life4Card'),b=$('life5Card'),i=$('life5Icon'),p=$('storyProgress');a?.classList.add('complete');if(b){b.disabled=false;b.classList.remove('locked');b.classList.add('unlocked');}if(i)i.textContent='5';if(p)p.style.width='55%';return true;
}
$('continueLife5Btn').onclick=(ev)=>{ev?.preventDefault?.();if(!unlockLife5())return;startLife5();};if($('life5Card'))$('life5Card').onclick=()=>$('continueLife5Btn').click();
let cells5=[0,0,0],stability5=15,temp5=22,stable5=false,reactorTimer5=null,chargeHeld5=false,coolHeld5=false,reactorActive5=false;
function startLife5(){playLifeCinematic(5,openMission5);}
function renderReactor5(){
 $('temp5').textContent=Math.round(temp5);$('stabilityRead5').textContent=Math.round(stability5);$('tempFill5').style.width=Math.min(100,temp5)+'%';$('stabilityNeedle').style.left=Math.max(0,Math.min(100,stability5))+'%';
 $('reactorCore').classList.toggle('warning',temp5>=78);$('reactorCore').classList.toggle('stable',temp5>=45&&temp5<=68&&stability5>=45&&stability5<=55);
 const ready=cells5.every(v=>v>=100)&&temp5>=45&&temp5<=68&&stability5>=45&&stability5<=55;$('stabilizeBtn').disabled=!ready;
}
function openMission5(){
 cells5=[0,0,0];stability5=15;temp5=22;stable5=false;reactorActive5=true;chargeHeld5=coolHeld5=false;clearInterval(reactorTimer5);
 document.querySelectorAll('.energy-cells [data-cell], .energy-cells button[data-cell]').forEach(b=>{b.classList.remove('charged');const bar=b.querySelector('i');if(bar)bar.style.height='0%';});
 $('stabilizeBtn').disabled=true;$('igniteBtn').disabled=true;$('life5Complete').hidden=true;$('ignitionStatus').textContent='Bring all cells online while controlling reactor temperature.';$('reactorCore').classList.remove('online','warning','stable');show('mission5');renderReactor5();
 reactorTimer5=setInterval(()=>{if(!reactorActive5)return;if(chargeHeld5){temp5+=1.15;stability5+=.7;cells5=cells5.map(v=>Math.min(100,v+.85));}else{temp5+=.12;stability5-=.12;}if(coolHeld5){temp5-=1.55;stability5-=.42;}temp5=Math.max(15,Math.min(100,temp5));stability5=Math.max(0,Math.min(100,stability5));
 document.querySelectorAll('.energy-cells button[data-cell]').forEach((b,i)=>{const bar=b.querySelector('i');if(bar)bar.style.height=cells5[i]+'%';b.classList.toggle('charged',cells5[i]>=100);});
 if(temp5>=96){reactorActive5=false;clearInterval(reactorTimer5);$('ignitionStatus').textContent='CORE SCRAM — thermal overload. Restarting reactor…';tg?.HapticFeedback?.notificationOccurred?.('error');setTimeout(openMission5,1600);return;}renderReactor5();},100);
}
function hold5(el,setter){const on=ev=>{ev.preventDefault();setter(true);el.setPointerCapture?.(ev.pointerId);},off=()=>setter(false);el.addEventListener('pointerdown',on);el.addEventListener('pointerup',off);el.addEventListener('pointercancel',off);el.addEventListener('pointerleave',off);}
hold5($('chargeCore5'),v=>chargeHeld5=v);hold5($('coolCore5'),v=>coolHeld5=v);
document.querySelectorAll('.energy-cells button[data-cell]').forEach(btn=>btn.onclick=()=>{const i=Number(btn.dataset.cell);cells5[i]=Math.min(100,cells5[i]+5);temp5=Math.min(100,temp5+2.5);stability5=Math.min(100,stability5+1.5);renderReactor5();});
$('stabilizeBtn').onclick=()=>{if($('stabilizeBtn').disabled)return;stable5=true;reactorActive5=false;clearInterval(reactorTimer5);$('stabilizeBtn').disabled=true;$('igniteBtn').disabled=false;$('ignitionStatus').textContent='Core locked in stable window. IGNITION authorized.';tg?.HapticFeedback?.notificationOccurred?.('success');};
$('igniteBtn').onclick=()=>{if(!stable5)return;$('reactorCore').classList.add('online');$('igniteBtn').disabled=true;awardLifePoints(5,1250);$('ignitionStatus').textContent='Reactor online. Ignition successful ✓';$('life5Complete').hidden=false;tg?.HapticFeedback?.notificationOccurred?.('success');};
$('life5ReturnBtn').onclick=()=>show('home');

function unlockLife6(){
 if(localStorage.getItem('mkty_life5')!=='complete')return false;const a=$('life5Card'),b=$('life6Card'),i=$('life6Icon'),p=$('storyProgress');a?.classList.add('complete');if(b){b.disabled=false;b.classList.remove('locked');b.classList.add('unlocked');}if(i)i.textContent='6';if(p)p.style.width='66%';return true;
}
$('continueLife6Btn').onclick=(ev)=>{ev?.preventDefault?.();if(!unlockLife6())return;startLife6();};if($('life6Card'))$('life6Card').onclick=()=>$('continueLife6Btn').click();
let launchSeconds=30,launchTimer=null,launchOrder6=[],launchIndex6=0,launchFault6=null,faultResolved6=true,nextFaultAt6=21,launchActive6=false;
const launchSystems6=['NAVIGATION','FUEL','CREW','REACTOR'];
const faultTypes6=[{name:'FUEL LINE OVERPRESSURE',answer:'VENT'},{name:'GUIDANCE COMPUTER DESYNC',answer:'RESET'},{name:'REACTOR SENSOR FAILURE',answer:'BYPASS'}];
function startLife6(){playLifeCinematic(6,openMission6);}
function shuffle6(a){return [...a].sort(()=>Math.random()-.5);}
function showFault6(){
 if(!launchActive6||!faultResolved6)return;launchFault6=faultTypes6[Math.floor(Math.random()*faultTypes6.length)];faultResolved6=false;$('launchEmergency6').hidden=false;$('launchAlert6').textContent=launchFault6.name;$('launchAlertHint6').textContent='Choose the correct emergency procedure.';$('launchStatus').textContent='WARNING — resolve flight computer alert!';
}
function openMission6(){
 launchSeconds=30;launchOrder6=shuffle6(launchSystems6);launchIndex6=0;launchFault6=null;faultResolved6=true;nextFaultAt6=21;launchActive6=true;$('launchClock').textContent=30;$('launchClock').classList.remove('danger');$('launchBtn').disabled=true;$('life6Complete').hidden=true;$('launchEmergency6').hidden=true;$('launchOrder6').textContent=launchOrder6.join(' → ');$('launchStatus').textContent='Follow the transmitted procedure. Watch for flight computer alerts.';document.querySelectorAll('[data-launch]').forEach(b=>b.classList.remove('armed','error','ready6'));$('launchShip').classList.remove('lifted');$('launchFlame').classList.remove('active');show('mission6');clearInterval(launchTimer);
 launchTimer=setInterval(()=>{if(!launchActive6)return;launchSeconds--;$('launchClock').textContent=launchSeconds;if(launchSeconds<=10)$('launchClock').classList.add('danger');if(launchSeconds===nextFaultAt6&&launchIndex6<4)showFault6();if(launchSeconds<=0){launchActive6=false;clearInterval(launchTimer);$('launchStatus').textContent='ABORT — launch window missed. Sequence reset.';tg?.HapticFeedback?.notificationOccurred?.('error');setTimeout(openMission6,1400);}},1000);
}
document.querySelectorAll('[data-launch]').forEach(b=>b.onclick=()=>{if(!launchActive6||!faultResolved6)return;const system=b.dataset.launch;if(system!==launchOrder6[launchIndex6]){b.classList.add('error');launchSeconds=Math.max(1,launchSeconds-3);$('launchStatus').textContent='Wrong system — 3 seconds lost.';tg?.HapticFeedback?.impactOccurred?.('medium');return;}b.classList.remove('error');b.classList.add('armed');launchIndex6++;tg?.HapticFeedback?.impactOccurred?.('light');if(launchIndex6===2&&nextFaultAt6>12)nextFaultAt6=Math.min(nextFaultAt6,launchSeconds-2);if(launchIndex6===4&&faultResolved6){$('launchBtn').disabled=false;$('launchStatus').textContent='All systems armed. LAUNCH before T−0!';}});
document.querySelectorAll('[data-response6]').forEach(b=>b.onclick=()=>{if(!launchFault6||faultResolved6)return;if(b.dataset.response6===launchFault6.answer){faultResolved6=true;$('launchEmergency6').hidden=true;$('launchStatus').textContent='Fault cleared ✓ Continue launch procedure.';launchFault6=null;tg?.HapticFeedback?.notificationOccurred?.('success');if(launchIndex6===4)$('launchBtn').disabled=false;}else{launchSeconds=Math.max(1,launchSeconds-5);$('launchAlertHint6').textContent='Incorrect response — 5 seconds lost!';tg?.HapticFeedback?.notificationOccurred?.('error');}});
$('launchBtn').onclick=()=>{if(launchIndex6!==4||!faultResolved6||!launchActive6)return;launchActive6=false;clearInterval(launchTimer);$('launchShip').classList.add('lifted');$('launchFlame').classList.add('active');$('launchBtn').disabled=true;awardLifePoints(6,1500);$('launchStatus').textContent='Liftoff confirmed — orbit achieved ✓';setTimeout(()=>$('life6Complete').hidden=false,900);tg?.HapticFeedback?.notificationOccurred?.('success');};
$('life6ReturnBtn').onclick=()=>show('home');

function unlockLife7(){
 if(localStorage.getItem('mkty_life6')!=='complete')return false;const a=$('life6Card'),b=$('life7Card'),i=$('life7Icon'),p=$('storyProgress');a?.classList.add('complete');if(b){b.disabled=false;b.classList.remove('locked');b.classList.add('unlocked');}if(i)i.textContent='7';if(p)p.style.width='77%';return true;
}
$('continueLife7Btn').onclick=(ev)=>{ev?.preventDefault?.();if(!unlockLife7())return;startLife7();};if($('life7Card'))$('life7Card').onclick=()=>$('continueLife7Btn').click();
let lane7=1,hull7=100,shield7=3,distance7=0,shieldActive7=false,voidTimer=null,spawnTimer7=null,voidActive7=false,asteroids7=[];
function renderVoid(){
 $('hull7').textContent=Math.max(0,Math.round(hull7));$('hullHud7').textContent=Math.max(0,Math.round(hull7));$('hullFill7').style.width=Math.max(0,hull7)+'%';$('shield7').textContent=shield7;$('distance7').textContent=Math.min(100,Math.round(distance7));
 const left=[22,50,78][lane7];$('voidShip').style.left=left+'%';$('shieldBubble7').style.left='calc('+left+'% - 29px)';$('shieldBubble7').classList.toggle('active',shieldActive7);
}
function spawnAsteroid7(){
 if(!voidActive7)return;const field=$('asteroidField'),lane=Math.floor(Math.random()*3),el=document.createElement('span');const big=Math.random()<.22;el.className='asteroid7 '+(big?'big':'small');el.textContent=big?'☄':'●';el.dataset.lane=lane;el.dataset.hit='0';el.style.left=['20%','48%','76%'][lane];const speed=Math.max(1.15,2.5-distance7*.012);el.style.setProperty('--fall7',speed+'s');field.appendChild(el);asteroids7.push(el);
 setTimeout(()=>{if(el.isConnected)el.remove();asteroids7=asteroids7.filter(x=>x!==el);},speed*1000+150);
}
function stopVoid7(){voidActive7=false;clearInterval(voidTimer);clearInterval(spawnTimer7);voidTimer=spawnTimer7=null;}
function crashVoid7(){stopVoid7();$('voidStatus').textContent='HULL FAILURE — emergency reset.';tg?.HapticFeedback?.notificationOccurred?.('error');setTimeout(openMission7,1500);}
function startLife7(){playLifeCinematic(7,openMission7);}
function openMission7(){
 stopVoid7();lane7=1;hull7=100;shield7=3;distance7=0;shieldActive7=false;asteroids7=[];$('asteroidField').innerHTML='';$('life7Complete').hidden=true;$('voidStatus').textContent='Debris field entered. Survive to the transmission gate.';show('mission7');voidActive7=true;renderVoid();
 spawnTimer7=setInterval(spawnAsteroid7,720);
 voidTimer=setInterval(()=>{if(!voidActive7)return;distance7+=.42;const world=$('voidWorld7').getBoundingClientRect(),ship=$('voidShip').getBoundingClientRect();asteroids7.forEach(el=>{if(!el.isConnected||el.dataset.hit==='1')return;const r=el.getBoundingClientRect();const overlap=!(r.right<ship.left+8||r.left>ship.right-8||r.bottom<ship.top+8||r.top>ship.bottom-8);if(overlap){el.dataset.hit='1';el.remove();if(shieldActive7){shieldActive7=false;$('voidStatus').textContent='Shield absorbed asteroid impact.';}else{hull7-=el.classList.contains('big')?34:20;$('voidStatus').textContent='HULL IMPACT! Evade!';$('voidWorld7').classList.remove('hit7');void $('voidWorld7').offsetWidth;$('voidWorld7').classList.add('hit7');tg?.HapticFeedback?.notificationOccurred?.('error');}renderVoid();}});
 if(hull7<=0){crashVoid7();return;}if(distance7>=100){stopVoid7();awardLifePoints(7,1750);$('voidStatus').textContent='Transmission gate reached ✓';$('life7Complete').hidden=false;tg?.HapticFeedback?.notificationOccurred?.('success');return;}renderVoid();},100);
}
$('voidLeft').onclick=()=>{if(!voidActive7)return;lane7=Math.max(0,lane7-1);renderVoid();};$('voidRight').onclick=()=>{if(!voidActive7)return;lane7=Math.min(2,lane7+1);renderVoid();};$('shieldBtn').onclick=()=>{if(!voidActive7||shield7<=0||shieldActive7)return;shield7--;shieldActive7=true;$('voidStatus').textContent='Shield armed — one impact protected.';renderVoid();};
$('life7ReturnBtn').onclick=()=>show('home');

function unlockLife8(){
 if(localStorage.getItem('mkty_life7')!=='complete')return false;const a=$('life7Card'),b=$('life8Card'),i=$('life8Icon'),p=$('storyProgress');a?.classList.add('complete');if(b){b.disabled=false;b.classList.remove('locked');b.classList.add('unlocked');}if(i)i.textContent='8';if(p)p.style.width='88%';return true;
}
$('continueLife8Btn').onclick=(ev)=>{ev?.preventDefault?.();if(!unlockLife8())return;startLife8();};if($('life8Card'))$('life8Card').onclick=()=>$('continueLife8Btn').click();
let targetFreq8=0,targetPhase8=0,pulse8=[],pulseInput8=[],pulseRound8=1,phaseTimer8=null,phaseProgress8=0;
function startLife8(){playLifeCinematic(8,openMission8);}
function openMission8(){
 targetFreq8=25+Math.floor(Math.random()*51);targetPhase8=25+Math.floor(Math.random()*51);pulseInput8=[];pulseRound8=1;phaseProgress8=0;clearInterval(phaseTimer8);phaseTimer8=null;$('freq8').value=20;$('phase8').value=50;$('phasePanel8').hidden=true;$('phaseHold8').hidden=true;$('pulsePanel8').hidden=true;$('coordinates8').hidden=true;$('life8Complete').hidden=true;$('signalPulse').classList.remove('decoded');$('link8').textContent=0;$('signalStatus8').textContent='Sweep the band and locate the strongest transmission.';show('mission8');updateFreq8();updatePhase8();
}
function updateFreq8(){const v=Number($('freq8').value),d=Math.abs(v-targetFreq8),strength=Math.max(0,100-d*4);$('freqRead8').textContent=(140+v/10).toFixed(1)+' MHz';$('strengthFill8').style.width=strength+'%';$('strengthText8').textContent='SIGNAL '+Math.round(strength)+'%';}
$('freq8').oninput=updateFreq8;
$('lockFreq8').onclick=()=>{const d=Math.abs(Number($('freq8').value)-targetFreq8);if(d<=3){$('link8').textContent=30;$('phasePanel8').hidden=false;$('signalStatus8').textContent='Carrier acquired. Stabilize phase.';tg?.HapticFeedback?.notificationOccurred?.('success');}else{$('signalStatus8').textContent=Number($('freq8').value)<targetFreq8?'Signal rises at higher frequency.':'Signal rises at lower frequency.';}};
function updatePhase8(){const v=Number($('phase8').value);$('phaseNeedle8').style.left=v+'%';if(phaseTimer8&&Math.abs(v-targetPhase8)>4){clearInterval(phaseTimer8);phaseTimer8=null;phaseProgress8=0;$('phaseHoldFill8').style.width='0%';$('signalStatus8').textContent='Phase lock lost. Re-align and hold again.';}}
$('phase8').oninput=updatePhase8;
$('lockPhase8').onclick=()=>{if(phaseTimer8)return;const d=Math.abs(Number($('phase8').value)-targetPhase8);if(d>4){$('signalStatus8').textContent=Number($('phase8').value)<targetPhase8?'Phase target is to the right.':'Phase target is to the left.';return;}phaseProgress8=0;$('phaseHold8').hidden=false;$('signalStatus8').textContent='Phase aligned. Hold steady…';phaseTimer8=setInterval(()=>{if(Math.abs(Number($('phase8').value)-targetPhase8)>4){updatePhase8();return;}phaseProgress8+=4;$('phaseHoldFill8').style.width=phaseProgress8+'%';if(phaseProgress8>=100){clearInterval(phaseTimer8);phaseTimer8=null;$('link8').textContent=60;$('pulsePanel8').hidden=false;$('signalStatus8').textContent='Phase synchronized. Decode the transmission.';newPulseRound8();tg?.HapticFeedback?.notificationOccurred?.('success');}},110);};
function newPulseRound8(){const len=3+pulseRound8;pulse8=Array.from({length:len},()=>Math.floor(Math.random()*3));pulseInput8=[];$('pulseRound8').textContent=pulseRound8;showPulse8();}
function showPulse8(){$('pulseDisplay8').textContent=pulse8.map(n=>['◯','△','◇'][n]).join(' ');$('pulseHint8').textContent='Memorize '+pulse8.length+' symbols.';setTimeout(()=>{$('pulseDisplay8').textContent=Array(pulse8.length).fill('?').join(' ');$('pulseHint8').textContent='Repeat the pulse.';},1600+pulse8.length*220);}
$('replayPulse8').onclick=()=>{pulseInput8=[];showPulse8();};
document.querySelectorAll('[data-pulse8]').forEach(b=>b.onclick=()=>{if($('pulsePanel8').hidden||!pulse8.length)return;const v=Number(b.dataset.pulse8);if(v!==pulse8[pulseInput8.length]){pulseInput8=[];$('signalStatus8').textContent='Pattern rejected. Transmission shifted — new pulse generated.';newPulseRound8();tg?.HapticFeedback?.notificationOccurred?.('error');return;}pulseInput8.push(v);$('pulseHint8').textContent='Decoded: '+pulseInput8.length+' / '+pulse8.length;if(pulseInput8.length===pulse8.length){if(pulseRound8<3){pulseRound8++;$('link8').textContent=60+pulseRound8*10;$('signalStatus8').textContent='Layer decoded. Signal complexity increasing…';setTimeout(newPulseRound8,600);}else{const lat=(10+Math.random()*70).toFixed(3),lon=(10+Math.random()*160).toFixed(3);$('link8').textContent=100;$('coordinatesValue8').textContent='LUNA // '+lat+' // '+lon;$('coordinates8').hidden=false;localStorage.setItem('mkty_life9_coordinates',lat+','+lon);awardLifePoints(8,2000);$('signalStatus8').textContent='Signal decoded. Final coordinates received ✓';$('signalPulse').classList.add('decoded');$('life8Complete').hidden=false;tg?.HapticFeedback?.notificationOccurred?.('success');}}});
$('life8ReturnBtn').onclick=()=>show('home');

function unlockLife9(){
 if(localStorage.getItem('mkty_life8')!=='complete')return false;const a=$('life8Card'),b=$('life9Card'),i=$('life9Icon'),p=$('storyProgress');a?.classList.add('complete');if(b){b.disabled=false;b.classList.remove('locked');b.classList.add('unlocked');}if(i)i.textContent='9';if(p)p.style.width='99%';return true;
}
$('continueLife9Btn').onclick=(ev)=>{ev?.preventDefault?.();if(!unlockLife9())return;startLife9();};if($('life9Card'))$('life9Card').onclick=()=>$('continueLife9Btn').click();
let navTarget9=50,syncSeq9=[],syncInput9=[],syncRound9=1,finalSeq9=[],finalInput9=[],coreHealth9=100,finalPower9=100,finalTimer9=null;
function startLife9(){playLifeCinematic(9,openMission9);}
function openMission9(){
 navTarget9=35+Math.floor(Math.random()*31);syncSeq9=[];syncInput9=[];syncRound9=1;finalSeq9=[];finalInput9=[];coreHealth9=100;finalPower9=100;clearInterval(finalTimer9);$('nav9').hidden=false;$('corridor9').hidden=true;$('sync9').hidden=true;$('transmit9').hidden=true;$('life9Complete').hidden=true;$('phase9a').className='active';$('phase9b').className='';$('phase9c').className='';$('core9').textContent=100;$('navDial9').value=10;$('corridorNeedle9').style.left='10%';$('coreHealthFill9').style.width='100%';$('finalPowerFill9').style.width='100%';$('finalStatus9').textContent='Phase I — verify the coordinates from LIFE #8.';$('finalGate').classList.remove('open');$('finalShip').classList.remove('returned');show('mission9');
}
$('verifyCoords9').onclick=()=>{const saved=localStorage.getItem('mkty_life9_coordinates')||'',parts=saved.split(','),a=$('coordLat9').value.trim(),b=$('coordLon9').value.trim();if(parts.length===2&&a===parts[0]&&b===parts[1]){$('corridor9').hidden=false;$('finalStatus9').textContent='Coordinates verified ✓ Stabilize the return corridor.';tg?.HapticFeedback?.notificationOccurred?.('success');}else{$('finalStatus9').textContent='Coordinates rejected. Recheck the LIFE #8 transmission.';coreHealth9=Math.max(70,coreHealth9-5);$('coreHealthFill9').style.width=coreHealth9+'%';tg?.HapticFeedback?.notificationOccurred?.('error');}};
$('navDial9').oninput=()=>{$('corridorNeedle9').style.left=$('navDial9').value+'%';};
function showSync9(){syncInput9=[];const len=3+syncRound9;syncSeq9=Array.from({length:len},()=>Math.floor(Math.random()*3));$('syncRound9').textContent=syncRound9;$('syncHint9').textContent=syncSeq9.map(n=>['A','B','C'][n]).join(' → ');setTimeout(()=>{$('syncHint9').textContent='Repeat core pulse • cycle '+syncRound9+'/3';},1500+len*180);}
$('lockNav9').onclick=()=>{const v=Number($('navDial9').value),d=Math.abs(v-navTarget9);if(d<=3){$('nav9').hidden=true;$('sync9').hidden=false;$('phase9a').className='done';$('phase9b').className='active';$('finalStatus9').textContent='Phase II — damaged core synchronization.';showSync9();tg?.HapticFeedback?.notificationOccurred?.('success');}else{coreHealth9=Math.max(50,coreHealth9-4);$('coreHealthFill9').style.width=coreHealth9+'%';$('core9').textContent=Math.round(coreHealth9);$('finalStatus9').textContent=v<navTarget9?'Corridor vector is higher.':'Corridor vector is lower.';}};
$('replaySync9').onclick=showSync9;
document.querySelectorAll('[data-sync9]').forEach(b=>b.onclick=()=>{if($('sync9').hidden||!syncSeq9.length)return;const v=Number(b.dataset.sync9);if(v!==syncSeq9[syncInput9.length]){coreHealth9-=12;$('coreHealthFill9').style.width=Math.max(0,coreHealth9)+'%';$('core9').textContent=Math.max(0,Math.round(coreHealth9));$('finalStatus9').textContent='Core desynchronized — integrity lost.';tg?.HapticFeedback?.notificationOccurred?.('error');if(coreHealth9<=20){$('finalStatus9').textContent='CORE FAILURE — restarting final mission.';setTimeout(openMission9,1400);return;}showSync9();return;}syncInput9.push(v);$('syncHint9').textContent='Synchronized '+syncInput9.length+' / '+syncSeq9.length;if(syncInput9.length===syncSeq9.length){if(syncRound9<3){syncRound9++;coreHealth9=Math.min(100,coreHealth9+8);$('coreHealthFill9').style.width=coreHealth9+'%';setTimeout(showSync9,500);}else{startFinalTransmit9();}}});
function showFinalCode9(){finalInput9=[];finalSeq9=Array.from({length:6},()=>Math.floor(Math.random()*4));$('finalCode9').textContent=finalSeq9.map(n=>['▲','●','◆','■'][n]).join(' ');setTimeout(()=>{$('finalCode9').textContent='? ? ? ? ? ?';},2600);}
function startFinalTransmit9(){$('sync9').hidden=true;$('transmit9').hidden=false;$('phase9b').className='done';$('phase9c').className='active';$('finalStatus9').textContent='FINAL PHASE — transmit before core power collapses.';finalPower9=100;$('finalPowerFill9').style.width='100%';showFinalCode9();clearInterval(finalTimer9);finalTimer9=setInterval(()=>{finalPower9-=1;$('finalPowerFill9').style.width=Math.max(0,finalPower9)+'%';$('core9').textContent=Math.max(0,Math.round(finalPower9));if(finalPower9<=0){clearInterval(finalTimer9);$('finalStatus9').textContent='POWER LOST — final transmission failed.';setTimeout(openMission9,1400);}},120);}
$('replayFinal9').onclick=()=>{if(finalPower9>20){finalPower9-=15;showFinalCode9();$('finalStatus9').textContent='Code replay costs 15% core power.';}};
document.querySelectorAll('[data-final9]').forEach(b=>b.onclick=()=>{if($('transmit9').hidden||!finalSeq9.length)return;const v=Number(b.dataset.final9);if(v!==finalSeq9[finalInput9.length]){finalPower9=Math.max(0,finalPower9-18);$('finalPowerFill9').style.width=finalPower9+'%';$('finalStatus9').textContent='Transmission rejected — 18% power lost.';showFinalCode9();tg?.HapticFeedback?.notificationOccurred?.('error');return;}finalInput9.push(v);$('finalStatus9').textContent='Return code: '+finalInput9.length+' / 6';if(finalInput9.length===6){clearInterval(finalTimer9);awardLifePoints(9,3000);if($('storyProgress'))$('storyProgress').style.width='100%';$('phase9c').className='done';$('core9').textContent=Math.round(finalPower9);$('finalGate').classList.add('open');$('finalShip').classList.add('returned');$('finalStatus9').textContent='RETURN TRANSMISSION ACCEPTED ✓';setTimeout(()=>$('life9Complete').hidden=false,900);tg?.HapticFeedback?.notificationOccurred?.('success');}});
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
 const savedPoints=Number(localStorage.getItem('mkty_points')||0);

 if($('points')) $('points').textContent=savedPoints+' ⭐';
 if($('livesProgress')) $('livesProgress').textContent=completed.length+' / 9 🌙';

 // The current home UI no longer contains the old life1Card/life2Card/... story cards.
 // Restore completion directly from storage without calling legacy unlock functions.
 if(localStorage.getItem('mkty_life1')==='complete'){
  if($('life1Complete')) $('life1Complete').hidden=false;
  if($('l1Points')) $('l1Points').textContent=savedPoints+' ⭐';
  if($('missionStatus')) $('missionStatus').textContent='Moon Base Alpha is online. LIFE #1 complete.';
 }
 if(completed.length===9 && $('storyProgress')) $('storyProgress').style.width='100%';
 renderFinalMoonPoints();
}

restoreGameProgress();
renderGlobalLivesHome();
renderMissionArchive();

