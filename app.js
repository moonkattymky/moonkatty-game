
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
 window.MKTYI18n?.setLanguage(code);
 show('home');window.MKTYCampaign?.render();
}
langs.forEach(([code,flag,name])=>{
 const b=document.createElement('button'); b.className='lang'; b.textContent=`${flag} ${name}`;
 b.onclick=()=>setLang(code); $('languages').appendChild(b);
});
$('settingsBtn').onclick=()=>show('language');
// Delayed callbacks belong to the mission that created them.
const missionDelays=new Map();
let activeCinematic=null;
let missionClockResumedAt=0;
document.addEventListener('visibilitychange',()=>{missionClockResumedAt=performance.now();});
function missionTimeout(n,callback,delay){
 let remaining=delay,last=performance.now();
 const handle=setInterval(()=>{const now=performance.now(),dt=Math.min(100,now-Math.max(last,missionClockResumedAt));last=now;
  if(!$('mission'+n)?.classList.contains('active')){clearInterval(handle);return;}
  if(document.hidden||window.MKTYExperience?.paused)return;
  remaining-=dt;if(remaining<=0){clearInterval(handle);callback();}
 },50);return handle;
}
function laterInMission(n,callback,delay){
 const handles=missionDelays.get(n)||new Set();missionDelays.set(n,handles);
 const handle=missionTimeout(n,()=>{handles.delete(handle);if($('mission'+n)?.classList.contains('active'))callback();},delay);handles.add(handle);return handle;
}
function clearMissionDelays(n){missionDelays.get(n)?.forEach(clearTimeout);missionDelays.delete(n);}
function leaveMission(id){
 const n=Number(id.replace('mission',''));clearMissionDelays(n);
 if(n===1){cancelAnimationFrame(l1MoveFrame);stopLife1Stick(null);clearInterval(signalHoldTimer);signalHoldTimer=null;clearInterval(memoryCodeTimer);memoryCodeTimer=null;repairShowing=false;}
 if(n===2){stopCrewTask2();crewSyncReady2=false;$('showCrewSync2').disabled=false;}
 if(n===3)clearLaunchPlayback3();
 if(n===4){descentActive4=false;cancelAnimationFrame(descentTimer);descentTimer=null;releaseDescentControls();}
 if(n===5)stopReactor5();
 if(n===6){launchActive6=false;clearInterval(launchTimer);launchTimer=null;}
 if(n===7){stopVoid7();$('asteroidField').replaceChildren();asteroids7=[];}
 if(n===8){clearInterval(phaseTimer8);phaseTimer8=null;pulseReady8=false;}
 if(n===9){clearInterval(finalTimer9);finalTimer9=null;syncReady9=finalReady9=false;}
}
function show(id){
 if(activeCinematic&&activeCinematic.id!==id)activeCinematic.cleanup();
 window.MKTYCampaign?.save();
 document.querySelectorAll('.mission-screen.active').forEach(s=>{if(s.id!==id)leaveMission(s.id);});
 document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
 $(id).classList.add('active');window.scrollTo(0,0);window.MKTYCampaign?.onScreen(id);window.MKTYExperience?.onScreen(id);
 if(id==='mission1'){refreshLife1Geometry();l1LastFrame=0;cancelAnimationFrame(l1MoveFrame);l1MoveFrame=requestAnimationFrame(life1MoveLoop);}
}
function openMission(){
 const video=$('life1Video'); if(video) video.pause();
 $('crewBadge').textContent=crewCode;
 show('mission1');
 resetLife1Mission();window.MKTYCampaign?.restore(1);
}
function startLife1(){
 tg?.HapticFeedback?.impactOccurred('medium');
 playLifeCinematic(1,openMission);
}
$('enterBtn').onclick=startLife1;
let life1Stage=0, energyCollected=0, repairCells=0, targetFrequency=64;

// LIFE #1 mobile exploration controller
let l1PX=50,l1PY=68,l1MoveX=0,l1MoveY=0,l1MoveFrame=0,l1Near=null;
let l1Direction='down',l1WalkDistance=0,l1Walking=false,l1LastFrame=0;
const l1Player=$('life1Player'),l1Joy=$('life1Joystick'),l1Stick=$('life1Stick'),l1Action=$('life1ActionBtn');
const l1Sprite=l1Player.querySelector('.l1-player-sprite'),l1RenderCache={};
let l1Geometry={width:1,height:1,obstacles:[]},l1NearbyAt=0;
function refreshLife1Geometry(){
 const world=$('life1World').getBoundingClientRect();if(!world.width||!world.height)return;
 l1Geometry={width:world.width,height:world.height,obstacles:[...document.querySelectorAll('#life1World .l1-obstacle')].map(el=>{
  const r=el.getBoundingClientRect();el.style.zIndex=String(Math.round((r.bottom-world.top)/world.height*100));
  return {left:(r.left+3-world.left)/world.width*100,right:(r.right-3-world.left)/world.width*100,top:(r.top+r.height*.36-world.top)/world.height*100,bottom:(r.bottom-2-world.top)/world.height*100};
 })};
 document.querySelectorAll('#life1World .l1-hotspot').forEach(el=>{const r=el.getBoundingClientRect();el.style.zIndex=String(Math.round((r.bottom-world.top)/world.height*100));});
}
new ResizeObserver(refreshLife1Geometry).observe($('life1World'));
function renderLife1Player(){
 if(!l1Player)return;
 if(l1RenderCache.x!==l1PX){l1Player.style.left=l1PX+'%';l1RenderCache.x=l1PX;}
 if(l1RenderCache.y!==l1PY){l1Player.style.top=l1PY+'%';l1Player.style.zIndex=String(Math.round(l1PY));l1RenderCache.y=l1PY;}
 if(l1RenderCache.walking!==l1Walking){l1Player.classList.toggle('walking',l1Walking);l1RenderCache.walking=l1Walking;}
 if(l1RenderCache.direction!==l1Direction){l1Player.dataset.direction=l1Direction;l1RenderCache.direction=l1Direction;}
 const row={down:0,up:1,left:2,right:3}[l1Direction];
 const frame=l1Walking?Math.floor(l1WalkDistance/8)%6:0;
 const position=(frame*20)+'% '+(row*100/3)+'%';
 if(l1RenderCache.frame!==position){l1Sprite.style.backgroundPosition=position;l1RenderCache.frame=position;}
}
function l1DistanceTo(el){
 if(!el||!l1Player)return 999;
 const w=$('life1World').getBoundingClientRect(),a=l1Player.getBoundingClientRect(),b=el.getBoundingClientRect();
 const ax=a.left+a.width/2,ay=a.top+a.height/2,bx=b.left+b.width/2,by=b.top+b.height/2;
 return Math.hypot(ax-bx,ay-by)/Math.max(1,Math.min(w.width,w.height));
}
function updateLife1Nearby(){
 const world=$('life1World').getBoundingClientRect(),player=l1Player.getBoundingClientRect();
 const ax=(player.left+player.right)/2,ay=(player.top+player.bottom)/2;
 const candidates=[...document.querySelectorAll('.l1-hotspot')].filter(x=>!x.disabled&&!x.classList.contains('collected'));
 let best=null,bestD=.24;
 candidates.forEach(x=>{const r=x.getBoundingClientRect(),d=Math.hypot(ax-(r.left+r.right)/2,ay-(r.top+r.bottom)/2)/Math.max(1,Math.min(world.width,world.height));if(d<bestD){best=x;bestD=d;}});
 if(l1Near!==best){l1Near?.classList.remove('nearby');best?.classList.add('nearby');}
 l1Near=best;
 if(l1Action){const action=best?.classList.contains('energy')?'COLLECT':best?.id==='repairTerminal'?'REPAIR':best?.id==='antennaHotspot'?'TUNE':'ACTION';if(l1Action.dataset.action!==action){l1Action.disabled=!best;l1Action.classList.toggle('ready',!!best);l1Action.textContent=action;l1Action.dataset.action=action;}}
 $('repairTerminal').classList.toggle('quest-target',life1Stage===1);$('antennaHotspot').classList.toggle('quest-target',life1Stage===2);
}
function life1Blocked(px,py){
 // Geometry is measured on resize, never once per obstacle on every frame.
 return l1Geometry.obstacles.some(r=>px>r.left&&px<r.right&&py>r.top&&py<r.bottom);
}
function life1MoveLoop(now){
 const dt=l1LastFrame?Math.min((now-l1LastFrame)/1000,.04):0;
 l1LastFrame=now;
 if(!$('mission1').classList.contains('active'))return;
 const active=!document.hidden&&!window.MKTYExperience?.paused&&$('repairPanel').hidden&&$('antennaPanel').hidden&&$('life1Complete').hidden;
 if(!active){if(l1Walking||l1MoveX||l1MoveY)stopLife1Stick(null);l1MoveFrame=requestAnimationFrame(life1MoveLoop);return;}
 const magnitude=Math.hypot(l1MoveX,l1MoveY);
 l1Walking=false;
 if(active&&magnitude>.08){
  const world=l1Geometry,speed=88;
  const scale=Math.max(1,magnitude),vx=l1MoveX/scale,vy=l1MoveY/scale;
  // Normalize in screen pixels: diagonal speed and 60/120 Hz displays agree.
  const nx=Math.max(7,Math.min(90,l1PX+vx*speed*dt/world.width*100));
  const ny=Math.max(18,Math.min(88,l1PY+vy*speed*dt/world.height*100));
  const oldX=l1PX,oldY=l1PY;
  if(Math.abs(vx)>Math.abs(vy))l1Direction=vx<0?'left':'right';
  else l1Direction=vy<0?'up':'down';
  // Resolve axes independently so MoonKatty slides naturally along obstacles.
  if(!life1Blocked(nx,l1PY))l1PX=nx;
  if(!life1Blocked(l1PX,ny))l1PY=ny;
  const traveled=Math.hypot((l1PX-oldX)*world.width/100,(l1PY-oldY)*world.height/100);
  l1Walking=traveled>.01;
  if(l1Walking)l1WalkDistance+=traveled;
 }
 renderLife1Player();
 if(magnitude>.08&&now-l1NearbyAt>=90){updateLife1Nearby();l1NearbyAt=now;}
 l1MoveFrame=requestAnimationFrame(life1MoveLoop);
}
let l1PointerId=null,l1JoystickActive=false;
// iOS Telegram WebView: once a joystick gesture starts, suppress page scrolling
// even if the finger leaves the joystick element.
document.addEventListener('touchmove',ev=>{if(l1JoystickActive){ev.preventDefault();ev.stopPropagation();}},{passive:false});

function setLife1Stick(clientX,clientY){
 const r=l1Joy.getBoundingClientRect();
 const dx=clientX-(r.left+r.width/2),dy=clientY-(r.top+r.height/2);
 const max=r.width*.31,len=Math.hypot(dx,dy)||1,scale=Math.min(1,max/len);
 const sx=dx*scale,sy=dy*scale;
 l1Stick.style.transform='translate('+sx+'px,'+sy+'px)';
 // Screen coordinates: +X = right, +Y = down. Player uses the same convention.
 const strength=len<5?0:Math.min(1,(len-5)/(max-5));
 l1MoveX=dx/len*strength;
 l1MoveY=dy/len*strength;
}
function stopLife1Stick(pointerId){
 if(pointerId!=null&&l1PointerId!=null&&pointerId!==l1PointerId)return;
 l1PointerId=null;l1JoystickActive=false;l1MoveX=0;l1MoveY=0;l1Walking=false;l1WalkDistance=0;l1Stick.style.transform='translate(0,0)';renderLife1Player();
}
if(l1Joy){
 l1Joy.style.touchAction='none';
 // iOS/Telegram WebView can still turn a downward joystick drag into page scroll.
 // Cancel touch scrolling only while the gesture belongs to the joystick.
 ['touchstart','touchmove'].forEach(type=>l1Joy.addEventListener(type,ev=>{ev.preventDefault();ev.stopPropagation();},{passive:false}));
 l1Joy.addEventListener('pointerdown',ev=>{ev.preventDefault();ev.stopPropagation();l1PointerId=ev.pointerId;l1JoystickActive=true;l1Joy.setPointerCapture?.(ev.pointerId);setLife1Stick(ev.clientX,ev.clientY);},{passive:false});
 l1Joy.addEventListener('pointermove',ev=>{if(ev.pointerId!==l1PointerId)return;ev.preventDefault();ev.stopPropagation();setLife1Stick(ev.clientX,ev.clientY);},{passive:false});
 l1Joy.addEventListener('pointerup',ev=>{ev.preventDefault();stopLife1Stick(ev.pointerId);},{passive:false});
 l1Joy.addEventListener('pointercancel',ev=>stopLife1Stick(ev.pointerId));
 l1Joy.addEventListener('lostpointercapture',()=>stopLife1Stick(null));
}
l1Action?.addEventListener('click',()=>{
 updateLife1Nearby();
 if(!l1Near)return;
 if(l1Near.classList.contains('energy'))collectLife1Energy(l1Near);
 else if(l1Near.id==='repairTerminal'&&life1Stage===1){$('repairPanel').hidden=false;$('repairPanel').scrollIntoView({behavior:'smooth',block:'center'});}
 else if(l1Near.id==='antennaHotspot'&&life1Stage===2){$('antennaPanel').hidden=false;$('antennaPanel').scrollIntoView({behavior:'smooth',block:'center'});}
 updateLife1Nearby();
});
window.addEventListener('blur',()=>stopLife1Stick(null));
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopLife1Stick(null);});
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
 clearMissionDelays(1);repairShowing=false;
 life1Stage=0; energyCollected=0; repairCells=0; targetFrequency=58+Math.floor(Math.random()*22); l1PX=50;l1PY=68;l1Near=null;l1Direction='down';stopLife1Stick(null);renderLife1Player();updateLife1Nearby();
 document.querySelectorAll('.l1-hotspot.energy').forEach(x=>{x.disabled=false;x.classList.remove('collected','revealed','nearby')});
 document.querySelectorAll('.repair-cells button').forEach(x=>{x.disabled=false;x.classList.remove('done')});
 $('repairTerminal').disabled=true;$('antennaHotspot').disabled=true;$('repairPanel').hidden=true;$('antennaPanel').hidden=true;$('life1Complete').hidden=true;clearInterval(signalHoldTimer);signalHoldTimer=null;signalHoldProgress=0;if($('signalHold'))$('signalHold').hidden=true;newRepairSequence();
 $('frequencyDial').value='20';updateSignalStrength();
 $('energyCount').textContent='0/3';$('repairCount').textContent='0/1';$('antennaCount').textContent='0/1';$('repairFill').style.width='0%';
 $('qEnergy').className='active';$('qRepair').className='';$('qAntenna').className='';
 $('missionStatus').textContent='Explore Moon Base Alpha. Use SCAN to reveal nearby energy signatures.';
 const bank=getLifeBank?.()??9;$('life1Lives').textContent=bank+'/9 ❤️';$('l1Points').textContent=(Number(localStorage.getItem('mkty_points')||0))+' ⭐';
}
function canReachLife1(el){
 if(l1DistanceTo(el)<.24)return true;
 $('missionStatus').textContent='Move closer to interact with this station.';return false;
}
function collectLife1Energy(btn){
 if(!btn||btn.disabled||btn.classList.contains('collected')||life1Stage!==0)return;
 if(l1DistanceTo(btn)>=.24){$('missionStatus').textContent='Move closer to collect this energy.';return;}
 window.MKTYExperience?.signal('collect',btn);btn.disabled=true; btn.classList.add('collected'); energyCollected++;
 $('energyCount').textContent=energyCollected+'/3';
 tg?.HapticFeedback?.impactOccurred('light');
 $('missionStatus').textContent='Energy collected • '+energyCollected+'/3';
 if(energyCollected>=3){
  energyCollected=3; $('energyCount').textContent='3/3'; life1Stage=1;
  $('qEnergy').className='done'; $('qRepair').className='active';
  $('repairTerminal').disabled=false;
  $('missionStatus').textContent='Energy restored. Repair the terminal 🔧';
 }
 updateLife1Nearby();window.MKTYCampaign?.save();
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
$('repairTerminal').onclick=()=>{if(life1Stage!==1||!canReachLife1($('repairTerminal')))return;$('repairPanel').hidden=false;$('repairPanel').scrollIntoView({behavior:'smooth',block:'center'});};
$('life1World')?.addEventListener('pointerup',(ev)=>{
 const terminal=ev.target.closest?.('#repairTerminal');
 if(terminal && life1Stage===1&&canReachLife1(terminal)){ev.preventDefault();$('repairPanel').hidden=false;$('repairPanel').scrollIntoView({behavior:'smooth',block:'center'});}
 const antenna=ev.target.closest?.('#antennaHotspot');
 if(antenna && life1Stage===2&&canReachLife1(antenna)){ev.preventDefault();$('antennaPanel').hidden=false;$('antennaPanel').scrollIntoView({behavior:'smooth',block:'center'});}
});
let repairSequence=[],repairInput=[],repairShowing=false,signalHoldTimer=null,signalHoldProgress=0;
function newRepairSequence(){
 repairSequence=Array.from({length:4},()=>Math.floor(Math.random()*3));repairInput=[];repairCells=0;
 $('repairFill').style.width='0%';$('repairSequence').textContent='● ● ● ●';$('repairHint').textContent='Memorize the power sequence, then repeat it.';
 document.querySelectorAll('.repair-cells button').forEach(x=>{x.disabled=false;x.classList.remove('done','cue')});
}
function showRepairSequence(){
 if(repairShowing)return;repairShowing=true;repairInput=[];repairCells=0;$('repairFill').style.width='0%';$('repairHint').textContent='Watch carefully…';
 document.querySelectorAll('.repair-cells button').forEach(x=>x.disabled=true);
 let i=0;const labels=['A','B','C'];
 const step=()=>{
  document.querySelectorAll('.repair-cells button').forEach(x=>x.classList.remove('cue'));
  if(i>=repairSequence.length){$('repairSequence').textContent='● ● ● ●';$('repairHint').textContent='Now repeat the sequence.';document.querySelectorAll('.repair-cells button').forEach(x=>x.disabled=false);repairShowing=false;return;}
  const n=repairSequence[i];$('repairSequence').textContent=labels[repairSequence[0]]+(i>0?' '+labels[repairSequence[1]]:'')+(i>1?' '+labels[repairSequence[2]]:'')+(i>2?' '+labels[repairSequence[3]]:'');
  document.querySelector('[data-cell="'+n+'"]').classList.add('cue');i++;laterInMission(1,step,650);
 };step();
}
$('showRepairSequenceBtn')?.addEventListener('click',showRepairSequence);
document.querySelectorAll('.repair-cells button').forEach(btn=>btn.onclick=()=>{
 if(life1Stage!==1||repairShowing)return;
 const n=Number(btn.dataset.cell),expected=repairSequence[repairInput.length];
 if(n!==expected){
  repairInput=[];repairCells=0;$('repairFill').style.width='0%';$('repairSequence').textContent='● ● ● ●';$('repairHint').textContent='Wrong circuit. Power trace reset — read it again.';tg?.HapticFeedback?.notificationOccurred?.('error');return;
 }
 repairInput.push(n);repairCells=repairInput.length;$('repairFill').style.width=(repairCells/4*100)+'%';tg?.HapticFeedback?.impactOccurred('medium');
 $('repairSequence').textContent=repairInput.map(v=>['A','B','C'][v]).concat(Array(4-repairInput.length).fill('·')).join(' ');
 if(repairCells===4){life1Stage=2;$('repairCount').textContent='1/1';$('qRepair').className='done';$('qAntenna').className='active';$('repairPanel').hidden=true;$('antennaHotspot').disabled=false;$('missionStatus').textContent='Terminal online. Reach COMMS and calibrate the antenna 📡';updateLife1Nearby();window.MKTYCampaign?.save();}
});
$('antennaHotspot').onclick=()=>{if(life1Stage!==2||!canReachLife1($('antennaHotspot')))return;$('antennaPanel').hidden=false;$('antennaPanel').scrollIntoView({behavior:'smooth',block:'center'});};
function updateSignalStrength(){
 const v=Number($('frequencyDial').value),d=Math.abs(v-targetFrequency),strength=Math.max(0,100-d*4);
 $('frequencyValue').textContent=(136+v/10).toFixed(1);if($('signalMeterFill'))$('signalMeterFill').style.width=strength+'%';
 if(signalHoldTimer&&d>3){clearInterval(signalHoldTimer);signalHoldTimer=null;signalHoldProgress=0;$('signalHoldFill').style.width='0%';$('signalHoldText').textContent='0%';$('signalHint').textContent='Signal lost — reacquire the carrier.';}
}
$('frequencyDial').oninput=()=>{updateSignalStrength();window.MKTYCampaign?.save();};
function finishLife1Signal(){
 clearInterval(signalHoldTimer);signalHoldTimer=null;life1Stage=3;$('antennaCount').textContent='1/1';$('qAntenna').className='done';$('antennaPanel').hidden=true;$('missionStatus').textContent='Signal synchronized. Moon Base Alpha is online!';tg?.HapticFeedback?.notificationOccurred?.('success');
 let pts=awardLifePoints(1,500);$('l1Points').textContent=pts+' ⭐';
 laterInMission(1,()=>{$('life1Complete').hidden=false;showLife1MemoryCode();$('life1Complete').scrollIntoView({behavior:'smooth',block:'center'});},300);
}
$('tuneBtn').onclick=()=>{
 if(life1Stage!==2||signalHoldTimer)return;const v=Number($('frequencyDial').value),d=Math.abs(v-targetFrequency);
 if(d>3){$('signalHint').textContent=v<targetFrequency?'Carrier is higher — tune right.':'Carrier is lower — tune left.';tg?.HapticFeedback?.impactOccurred('light');return;}
 signalHoldProgress=0;$('signalHoldFill').style.width='0%';$('signalHoldText').textContent='0%';$('signalHold').hidden=false;$('signalHint').textContent='Carrier acquired. Hold frequency steady for synchronization.';
 signalHoldTimer=setInterval(()=>{if(document.hidden||window.MKTYExperience?.paused)return;const now=Number($('frequencyDial').value);if(Math.abs(now-targetFrequency)>3){updateSignalStrength();return;}signalHoldProgress+=4;$('signalHoldFill').style.width=signalHoldProgress+'%';$('signalHoldText').textContent=signalHoldProgress+'%';if(signalHoldProgress>=100)finishLife1Signal();},120);
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
 const box=$('life1MemoryCode');if(!box)return;
 let until=Number(localStorage.getItem('mkty_life1_code_visible_until')||0);
 if(!localStorage.getItem('mkty_life1_code_presented')){
  until=Date.now()+10000;localStorage.setItem('mkty_life1_code_presented','yes');localStorage.setItem('mkty_life1_code_visible_until',String(until));
 }
 clearInterval(memoryCodeTimer);
 const render=()=>{const left=Math.max(0,Math.ceil((until-Date.now())/1000));box.hidden=!left;$('continueLife2Btn').disabled=left>0;
  $('life1CodeValue').textContent=left?ensureLife1MemoryCode():'';
  $('life1CodeTimer').textContent='VISIBLE FOR '+left+' SECONDS';
  if(!left){clearInterval(memoryCodeTimer);memoryCodeTimer=null;}
 };
 render();if(until>Date.now())memoryCodeTimer=setInterval(render,200);
}
function renderLife3Gate(){
 const lives=getLifeBank(), lock=Number(localStorage.getItem('mkty_life3_code_lock_until')||0), now=Date.now();
 if($('globalLives3'))$('globalLives3').textContent=lives+' / '+MKTY_MAX_LIVES;
 const locked=lock>now;
 if(lock&&!localStorage.getItem('mkty_life3_hint_available'))localStorage.setItem('mkty_life3_hint_available','yes');
 if($('life3MemoryInput'))$('life3MemoryInput').disabled=locked;
 if($('verifyLife1CodeBtn'))$('verifyLife1CodeBtn').disabled=locked;
 if($('life3Cooldown'))$('life3Cooldown').hidden=!locked;
 if($('buyCodeHintBtn')){$('buyCodeHintBtn').hidden=locked||localStorage.getItem('mkty_life3_hint_available')!=='yes';$('buyCodeHintBtn').disabled=lives<=0;}
 if(locked){
  const sec=Math.max(0,Math.ceil((lock-now)/1000)),hh=String(Math.floor(sec/3600)).padStart(2,'0'),mm=String(Math.floor(sec%3600/60)).padStart(2,'0'),ss=String(sec%60).padStart(2,'0');
  $('life3CooldownTimer').textContent=hh+':'+mm+':'+ss;$('life3GateStatus').textContent='Wrong code. One life lost. Retry locked for 1 hour.';
 } else if(localStorage.getItem('mkty_life3_code_lock_until')) {
  localStorage.removeItem('mkty_life3_code_lock_until');$('life3GateStatus').textContent='Retry available. Enter the LIFE #1 code or buy a hint.';
 }
}
function openLife3MemoryGate(){
 show('mission3');resetLaunchConsole3();window.MKTYCampaign?.restore(3);$('paidCodeHint3').hidden=true;$('paidCodeValue3').textContent='';if($('journalCode3'))$('journalCode3').hidden=true;renderLife3Gate();
 clearInterval(gateTimer);gateTimer=setInterval(renderLife3Gate,1000);
}
$('journalCodeBtn')?.addEventListener('click',()=>{
 $('journalCode3').hidden=!$('journalCode3').hidden;
});

function awardLifePoints(n,amount){
 const key='mkty_life'+n,awardKey=key+'_awarded';
 let pts=Number(localStorage.getItem('mkty_points')||0);
 if(localStorage.getItem(awardKey)!=='yes'){pts+=amount;localStorage.setItem('mkty_points',String(pts));localStorage.setItem(awardKey,'yes');}
 localStorage.setItem(key,'complete');window.MKTYExperience?.signal('complete');if($('points'))$('points').textContent=pts+' ⭐';if($('livesProgress')){const done=[1,2,3,4,5,6,7,8,9].filter(x=>localStorage.getItem('mkty_life'+x)==='complete').length;$('livesProgress').textContent=done+' / 9 🌙';}return pts;
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
function startLife2(){
 playLifeCinematic(2,openMission2);
}
function openMission2(){
 stopCrewTask2();activeMate=null;document.querySelectorAll('.crew-task').forEach(x=>x.hidden=true);
 const video=$('life2Video'); if(video)video.pause();
 $('crewBadge2').textContent=crewCode; show('mission2');window.MKTYCampaign?.restore(2);updateCrewScene2();
}
$('continueLife2Btn').onclick=(ev)=>{
 ev?.preventDefault?.();
 ev?.stopPropagation?.();
 if(localStorage.getItem('mkty_life1')!=='complete')return;
 unlockLife2();
 if($('lifeTitle')) $('lifeTitle').textContent='LIFE #2 — THE CREW';
 if($('lifeText')) $('lifeText').textContent='Assemble your crew. Each specialist must pass a challenge.';

 startLife2();
};
if($('life2Card')) $('life2Card').onclick=()=>$('continueLife2Btn').click();

// Telegram WebView-safe direct launcher for LIFE #2.
// Use delegated pointer/touch handling so the completed LIFE #1 button keeps working
// even after returning to the mission or when WebView suppresses a synthetic click.
function launchLife2FromCompletedMission(ev){
 const target=ev.target?.closest?.('#continueLife2Btn');
 if(!target||target.disabled)return;
 if(localStorage.getItem('mkty_life1')!=='complete')return;
 ev.preventDefault();
 ev.stopPropagation();
 tg?.HapticFeedback?.impactOccurred?.('medium');
 startLife2();
}
document.addEventListener('pointerup',launchLife2FromCompletedMission);
$('continueLife2Btn').addEventListener('touchend',launchLife2FromCompletedMission,{passive:false});

let crewCount=0,activeMate=null,nav2X=8,nav2Y=78,nav2Gate=0,nav2Timer=null,nav2RetryTimer=null,nav2Control=0,wire2=[0,0,0,0],scout2Hits=0,scout2Timer=null,crewSync2=[],crewSyncInput2=[],crewSyncReady2=false,engineerChecking2=false;
function updateCrewScene2(){
 $('crewCount2').textContent=crewCount+' / 3';
 document.querySelectorAll('.mate').forEach(btn=>{btn.classList.toggle('selected',btn===activeMate);btn.setAttribute('aria-disabled',String(btn.classList.contains('joined')));});
}
function stopCrewTask2(){cancelAnimationFrame(nav2Timer);clearTimeout(nav2RetryTimer);clearMissionDelays(2);nav2Timer=null;nav2RetryTimer=null;nav2Control=0;stopScout2();engineerChecking2=false;$('testCircuit2').disabled=false;document.querySelectorAll('[data-wire2]').forEach(b=>b.disabled=false);}
$('crewBack2').onclick=()=>{
 stopCrewTask2();activeMate=null;document.querySelectorAll('.crew-task').forEach(task=>task.hidden=true);
 $('crewChallengeTitle').textContent='SELECT A CREW MEMBER TO BEGIN';updateCrewScene2();
};
function completeMate(btn){
 if(!btn||btn.classList.contains('joined'))return;
 window.MKTYExperience?.signal('success',btn);stopCrewTask2();btn.classList.add('joined');crewCount++;activeMate=null;document.querySelectorAll('.crew-task').forEach(x=>x.hidden=true);updateCrewScene2();
 $('crewChallengeTitle').textContent='SPECIALIST RECRUITED ✓';$('crewStatus').textContent='Crew assembled: '+crewCount+' / 3'+(crewCount===3?' • Final sync ready':' • Final sync locked');tg?.HapticFeedback?.notificationOccurred?.('success');
 if(crewCount===3){$('crewFinal2').hidden=false;$('crewChallengeTitle').textContent='FINAL CREW PROTOCOL';}
 window.MKTYCampaign?.save();
}
function resetNav2(){
 cancelAnimationFrame(nav2Timer);nav2X=7;nav2Y=70;nav2Gate=0;nav2Control=0;
 const ship=$('navShip2'),gates=[...document.querySelectorAll('#navField2 .gate')];gates.forEach((g,i)=>{g.classList.remove('cleared');g.classList.toggle('next-gate',i===0);});
 ship.style.left=nav2X+'%';ship.style.top=nav2Y+'%';ship.style.setProperty('--bank','0deg');
 $('navHint2').textContent='Gates cleared: 0 / 3 • Use ▲ / ▼';
 let last=performance.now(),lastHint='';
 const frame=now=>{
  nav2Timer=null;const dt=Math.min(.04,Math.max(0,(now-last)/1000));last=now;
  if($('navigatorTask').hidden||!$('mission2').classList.contains('active'))return;
  if(!document.hidden&&!window.MKTYExperience?.paused){
   nav2X+=8*dt;nav2Y=Math.max(8,Math.min(84,nav2Y+nav2Control*(1.7/.09)*dt));
   ship.style.left=nav2X+'%';ship.style.top=nav2Y+'%';ship.style.setProperty('--bank',(nav2Control*8)+'deg');
   if(nav2Gate<3){const s=ship.getBoundingClientRect(),g=gates[nav2Gate].getBoundingClientRect(),sx=(s.left+s.right)/2,sy=(s.top+s.bottom)/2;
    const hint=sy<g.top-18?'HOLD ▼ TO DESCEND':sy>g.bottom+18?'HOLD ▲ TO CLIMB':'ON COURSE • HOLD ALTITUDE';
    if(hint!==lastHint){lastHint=hint;$('navHint2').textContent=hint;$('navHint2').dataset.aligned=String(hint.startsWith('ON COURSE'));}
    if(sx>=g.left-10&&sx<=g.right+10&&sy>=g.top-18&&sy<=g.bottom+18){gates[nav2Gate].classList.add('cleared');gates[nav2Gate].classList.remove('next-gate');window.MKTYExperience?.signal('gate',gates[nav2Gate]);nav2Gate++;gates[nav2Gate]?.classList.add('next-gate');$('navHint2').textContent='Gates cleared: '+nav2Gate+' / 3';lastHint='';tg?.HapticFeedback?.impactOccurred?.('light');}
    else if(sx>g.right+10){nav2Control=0;ship.style.setProperty('--bank','0deg');$('crewStatus').textContent='Gate missed. Review the flight and try again.';window.MKTYExperience?.flightFailed(2,{gate:nav2Gate+1,cleared:nav2Gate},resetNav2);return;}
   }
   if(nav2X>94){if(nav2Gate===3)completeMate(activeMate);else{nav2Control=0;ship.style.setProperty('--bank','0deg');$('crewStatus').textContent='Gate missed. Review the flight and try again.';window.MKTYExperience?.flightFailed(2,{gate:nav2Gate+1,cleared:nav2Gate},resetNav2);}return;}
  }
  nav2Timer=requestAnimationFrame(frame);
 };nav2Timer=requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)nav2Control=0;});
window.addEventListener('blur',()=>{nav2Control=0;});
document.querySelectorAll('[data-nav2]').forEach(b=>{const start=ev=>{ev.preventDefault();nav2Control=Number(b.dataset.nav2);b.setPointerCapture?.(ev.pointerId);};const stop=()=>{nav2Control=0;};b.onpointerdown=start;b.onpointerup=stop;b.onpointercancel=stop;b.onpointerleave=stop;b.onlostpointercapture=stop;b.onclick=e=>{if(e.detail===0)nav2Y=Math.max(8,Math.min(84,nav2Y+Number(b.dataset.nav2)*4));};});
let engineerTiles2=null,engineerSolved2=false;
const pipeDirections2=[[-1,0],[0,1],[1,0],[0,-1]];
function pipePorts2(tile){return tile.base.map(p=>(p+tile.rotation)%4);}
function engineerReach2(){
 const reached=new Set();if(!engineerTiles2||!pipePorts2(engineerTiles2[3]).includes(3))return reached;
 const queue=[3];reached.add(3);
 while(queue.length){const i=queue.shift(),row=Math.floor(i/3),col=i%3;
  for(const p of pipePorts2(engineerTiles2[i])){const [dr,dc]=pipeDirections2[p],r=row+dr,c=col+dc,j=r*3+c;
   if(r<0||r>2||c<0||c>2||reached.has(j))continue;
   if(pipePorts2(engineerTiles2[j]).includes((p+2)%4)){reached.add(j);queue.push(j);}
  }
 }return reached;
}
function updateEngineerRoute2(){
 const reached=engineerReach2();engineerSolved2=reached.has(5)&&pipePorts2(engineerTiles2[5]).includes(1);
 const grid=$('circuit2');
 if(grid.children.length!==9){grid.replaceChildren(...Array.from({length:9},(_,i)=>{const b=document.createElement('button');b.type='button';b.dataset.wire2=i;b.onclick=()=>{if(window.MKTYExperience?.paused||engineerChecking2)return;engineerTiles2[i].rotation=(engineerTiles2[i].rotation+1)%4;updateEngineerRoute2();window.MKTYExperience?.signal('tap',b);window.MKTYCampaign?.save();};return b;}));}
 [...grid.children].forEach((b,i)=>{
  const ports=pipePorts2(engineerTiles2[i]);b.classList.toggle('live',reached.has(i));b.dataset.ports=ports.join(',');b.setAttribute('aria-label','Junction '+(i+1)+' • rotate clockwise');
  const points=['25 0','50 25','25 50','0 25'];
  b.innerHTML='<svg viewBox="0 0 50 50" aria-hidden="true"><path class="pipe-bed" d="M'+points[ports[0]]+' L25 25 L'+points[ports[1]]+'"/><path class="pipe-flow" d="M'+points[ports[0]]+' L25 25 L'+points[ports[1]]+'"/><circle cx="25" cy="25" r="4"/></svg><span>'+String(i+1).padStart(2,'0')+'</span>';
 });
 $('routeProgress2').style.width=(engineerSolved2?100:reached.size/9*85)+'%';$('circuit2').classList.toggle('connected',engineerSolved2);
 $('engineerHint2').textContent=engineerSolved2?'Power route complete — test the circuit.':'Rotate the pipes. Connect the left inlet to the right outlet.';
}
function resetEngineer2(){
 if(!engineerTiles2){
  const paths=[[3,0,1,2,5],[3,6,7,8,5],[3,0,1,4,7,8,5],[3,6,7,4,1,2,5]],path=paths[Math.floor(Math.random()*paths.length)];
  engineerTiles2=Array.from({length:9},()=>({base:Math.random()<.5?[0,2]:[0,1],rotation:Math.floor(Math.random()*4)}));
  path.forEach((index,k)=>{const direction=other=>{const diff=other-index;return diff===-3?0:diff===1?1:diff===3?2:3;};engineerTiles2[index]={base:[k===0?3:direction(path[k-1]),k===path.length-1?1:direction(path[k+1])],rotation:Math.floor(Math.random()*4)};});
  // Guarantee an unsolved entry instead of occasionally generating a free win.
  while(pipePorts2(engineerTiles2[3]).includes(3))engineerTiles2[3].rotation=(engineerTiles2[3].rotation+1)%4;
 }
 updateEngineerRoute2();
}
$('testCircuit2').onclick=()=>{
 if(!engineerTiles2||window.MKTYExperience?.paused||engineerChecking2)return;
 if(engineerSolved2){engineerChecking2=true;$('testCircuit2').disabled=true;document.querySelectorAll('[data-wire2]').forEach(b=>b.disabled=true);$('engineerHint2').textContent='CORE → COMMS power route stable ✓';window.MKTYExperience?.signal('success',$('circuit2'));const mate=activeMate;laterInMission(2,()=>{if(activeMate===mate&&!$('engineerTask').hidden&&engineerSolved2)completeMate(mate);},450);}
 else{$('engineerHint2').textContent='Open circuit. Every connected pipe must meet its neighbour.';window.MKTYExperience?.signal('error',$('testCircuit2'));}
};
function stopScout2(){clearInterval(scout2Timer);scout2Timer=null;}
function buildAnomaly(){
 stopScout2();scout2Hits=0;const grid=$('anomalyGrid');grid.innerHTML='';for(let i=0;i<9;i++){const b=document.createElement('button');b.textContent='·';grid.appendChild(b);}
 const relocate=()=>{grid.querySelectorAll('button').forEach(b=>{b.classList.remove('target');b.textContent='·';b.setAttribute('aria-label','No signal');b.onclick=null;});const cells=[...grid.querySelectorAll('button')],b=cells[Math.floor(Math.random()*cells.length)];b.classList.add('target');b.textContent='✦';b.setAttribute('aria-label','Signal detected');b.onclick=()=>{if(!b.classList.contains('target')||window.MKTYExperience?.paused)return;window.MKTYExperience?.signal('collect',b);scout2Hits++;$('scoutHint2').textContent='Anomalies tagged: '+scout2Hits+' / 3';tg?.HapticFeedback?.impactOccurred?.('medium');if(scout2Hits>=3){stopScout2();completeMate(activeMate);}else relocate();};};
 relocate();scout2Timer=setInterval(()=>{if(!document.hidden&&!window.MKTYExperience?.paused)relocate();},1100);
}
document.querySelectorAll('.mate').forEach(btn=>btn.onclick=()=>{if(btn.classList.contains('joined'))return;stopCrewTask2();activeMate=btn;document.querySelectorAll('.crew-task').forEach(x=>x.hidden=true);const role=btn.dataset.mate;$('crewChallengeTitle').textContent=role.toUpperCase()+' CHALLENGE';if(role==='Navigator'){$('navigatorTask').hidden=false;resetNav2();}if(role==='Engineer'){$('engineerTask').hidden=false;resetEngineer2();}if(role==='Scout'){$('scoutTask').hidden=false;buildAnomaly();}updateCrewScene2();});
function makeCrewSync2(){crewSync2=Array.from({length:5},()=>['N','E','S'][Math.floor(Math.random()*3)]);crewSyncInput2=[];}
$('showCrewSync2').onclick=()=>{clearMissionDelays(2);crewSyncReady2=false;$('showCrewSync2').disabled=true;document.querySelectorAll('[data-sync2]').forEach(b=>b.disabled=true);makeCrewSync2();$('crewSyncCode2').textContent=crewSync2.join(' ');$('crewSyncHint2').textContent='Memorize the transmission…';laterInMission(2,()=>{crewSyncReady2=true;$('showCrewSync2').disabled=false;document.querySelectorAll('[data-sync2]').forEach(b=>b.disabled=false);$('crewSyncCode2').textContent='? ? ? ? ?';$('crewSyncHint2').textContent='Repeat the five-role sequence.';},2400);};
document.querySelectorAll('[data-sync2]').forEach(b=>b.onclick=()=>{if(crewCount!==3||!crewSync2.length||!crewSyncReady2)return;const v=b.dataset.sync2;if(v!==crewSync2[crewSyncInput2.length]){crewSyncInput2=[];$('crewSyncHint2').textContent='Sync failed. Receive a new sequence.';crewSyncReady2=false;makeCrewSync2();tg?.HapticFeedback?.notificationOccurred?.('error');return;}crewSyncInput2.push(v);$('crewSyncHint2').textContent='Synchronized: '+crewSyncInput2.length+' / 5';if(crewSyncInput2.length===5){crewSyncReady2=false;awardLifePoints(2,500);$('life2Complete').hidden=false;$('crewFinal2').hidden=true;$('crewStatus').textContent='Crew synchronized. Mission ready ✓';tg?.HapticFeedback?.notificationOccurred?.('success');}});
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
 const id='life'+n,screen=$(id),video=$('life'+n+'Video'),bar=$(n===1?'cinematicBar':'life'+n+'Bar'),skip=$(n===1?'skipBtn':'life'+n+'SkipBtn');
 if(!screen||!video){onDone();return;}
 if(activeCinematic?.id===id)return;
 show(id);let finished=false,last=performance.now(),remaining=n===1?8000:n===2?10000:20000,watchdog;
 const cleanup=()=>{finished=true;clearInterval(watchdog);video.pause();video.removeEventListener('ended',finish);video.removeEventListener('error',finish);document.removeEventListener('visibilitychange',visibility);if(skip?.onclick===finish)skip.onclick=null;if(activeCinematic?.cleanup===cleanup)activeCinematic=null;};
 const finish=()=>{if(finished)return;const visible=screen.classList.contains('active');cleanup();if(visible)onDone();};
 const visibility=()=>{last=performance.now();if(finished||!screen.classList.contains('active'))return;if(bar)bar.style.animationPlayState=document.hidden?'paused':'running';if(document.hidden)video.pause();else video.play().catch(()=>{});};
 activeCinematic={id,cleanup};video.addEventListener('ended',finish);video.addEventListener('error',finish);document.addEventListener('visibilitychange',visibility);if(skip)skip.onclick=finish;
 watchdog=setInterval(()=>{const now=performance.now(),dt=Math.min(250,Math.max(0,now-last));last=now;if(document.hidden)return;if(!screen.classList.contains('active')){cleanup();return;}remaining-=dt;if(remaining<=0)finish();},250);
 if(bar){bar.style.animationPlayState='running';bar.classList.remove('run');void bar.offsetWidth;bar.classList.add('run');}
 video.currentTime=0;video.play().catch(()=>{});
}
function startLife3(){playLifeCinematic(3,openLife3MemoryGate);}
$('continueLife3Btn').onclick=(ev)=>{ev?.preventDefault?.();if(!unlockLife3())return;if($('lifeTitle'))$('lifeTitle').textContent='LIFE #3 — THE LAUNCH CODE';if($('lifeText'))$('lifeText').textContent='Decrypt the ship launch authorization sequence.';startLife3();};
if($('life3Card'))$('life3Card').onclick=()=>$('continueLife3Btn').click();
$('verifyLife1CodeBtn').onclick=()=>{const lock=Number(localStorage.getItem('mkty_life3_code_lock_until')||0);if(lock>Date.now())return;const entered=$('life3MemoryInput').value.trim();if(!/^\d{10}$/.test(entered)){$('life3GateStatus').textContent='Enter all 10 digits. No life has been spent.';return;}if(entered===ensureLife1MemoryCode()){clearInterval(gateTimer);$('life3GateStatus').textContent='CODE VERIFIED ✓';localStorage.setItem('mkty_life3_memory_verified','yes');renderMissionArchive();
renderDailyMissions();
renderCrewNetwork();$('life3MemoryInput').blur();setLaunchPhase3('signal');newLaunchCode();$('codeStatus').textContent='Attempts remaining: '+codeAttempts;window.MKTYCampaign?.save();tg?.HapticFeedback?.notificationOccurred?.('success');return;}if(!spendGlobalLife()){$('life3GateStatus').textContent='No lives available. A life restores every 12 hours.';return;}localStorage.setItem('mkty_life3_hint_available','yes');localStorage.setItem('mkty_life3_code_lock_until',String(Date.now()+MKTY_CODE_LOCK_MS));$('life3MemoryInput').value='';tg?.HapticFeedback?.notificationOccurred?.('error');renderLife3Gate();};
$('life3MemoryInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&$('mission3').classList.contains('active')&&$('mission3').dataset.phase==='access'&&!$('verifyLife1CodeBtn').disabled&&!window.MKTYExperience?.paused){e.preventDefault();$('verifyLife1CodeBtn').click();}});
$('buyCodeHintBtn').onclick=()=>{
 if(Number(localStorage.getItem('mkty_life3_code_lock_until')||0)>Date.now()||localStorage.getItem('mkty_life3_hint_available')!=='yes')return;
 if(!spendGlobalLife()){$('life3GateStatus').textContent='No lives available. A life restores every 12 hours.';return;}
 localStorage.removeItem('mkty_life3_hint_available');renderLife3Gate();
 $('paidCodeHint3').hidden=false;$('paidCodeValue3').textContent=ensureLife1MemoryCode();
 laterInMission(3,()=>{$('paidCodeHint3').hidden=true;$('paidCodeValue3').textContent='';},10000);
};
let launchCode=[],codeInput=[],codeAttempts=3,codeReady=false,codeRevealTimer3=null;
const codeSymbols=['▲','●','◆','■'];
let ignitionOrder3=[],ignitionInput3=[],launchTimer3=null,ignitionRevealTimer3=null,launchTime3=100;
function paintLaunchSlots3(id,values,count,empty='?'){
 const slots=Array.from({length:count},(_,i)=>{const span=document.createElement('span');span.textContent=values[i]??empty;span.classList.toggle('filled',values[i]!=null);return span;});$(id).replaceChildren(...slots);
}
function setLaunchPhase3(phase){
 $('mission3').dataset.phase=phase;$('mission3').dataset.transmitting='false';
 $('life3MemoryGate').hidden=phase!=='access';$('life3CodeMission').hidden=phase==='access'||phase==='complete';
 $('launchStage1').hidden=phase!=='signal';$('launchStage2').hidden=phase!=='fuel';$('launchStage3').hidden=phase!=='ignition';$('life3Complete').hidden=phase!=='complete';
 const phases=['access','signal','fuel','ignition'],current=phase==='complete'?4:phases.indexOf(phase);
 $('launchStageCount3').textContent=String(Math.min(current+1,4)).padStart(2,'0')+' / 04';
 document.querySelectorAll('[data-phase3]').forEach((item,i)=>{item.classList.toggle('current',i===current);item.classList.toggle('done',i<current);if(i===current)item.setAttribute('aria-current','step');else item.removeAttribute('aria-current');});
 $('life3CodeMission').scrollTop=0;
}
function clearLaunchPlayback3(){clearTimeout(codeRevealTimer3);codeRevealTimer3=null;clearInterval(gateTimer);gateTimer=null;codeReady=false;stopLaunchTimer3();}
function resetLaunchConsole3(){
 clearLaunchPlayback3();codeAttempts=3;newLaunchCode();resetIgnition3();setLaunchPhase3('access');
 $('life3MemoryInput').value='';$('life3GateStatus').textContent='Authorization required.';
 $('mixO2').value=String(45+Math.floor(Math.random()*11));$('mixFuel').value=String(20+Math.floor(Math.random()*11));$('mixCool').value=String(40+Math.floor(Math.random()*11));updateMix3();
 $('codeHint').textContent='Watch the four-symbol sequence. Then reproduce it.';$('codeStatus').textContent='Attempts remaining: 3';
}
function newLaunchCode(){
 clearTimeout(codeRevealTimer3);codeRevealTimer3=null;launchCode=Array.from({length:4},()=>codeSymbols[Math.floor(Math.random()*4)]);codeInput=[];codeReady=false;
 paintLaunchSlots3('codeSequence',[],4,'·');$('showCodeBtn').disabled=false;document.querySelectorAll('[data-code]').forEach(b=>{b.disabled=true;b.classList.remove('entered');});
}
$('showCodeBtn').onclick=()=>{
 if($('mission3').dataset.phase!=='signal')return;newLaunchCode();paintLaunchSlots3('codeSequence',launchCode,4);$('showCodeBtn').disabled=true;$('mission3').dataset.transmitting='true';$('codeHint').textContent='Memorize the four symbols…';$('codeStatus').textContent='Attempts remaining: '+codeAttempts;
 codeRevealTimer3=missionTimeout(3,()=>{codeRevealTimer3=null;if($('mission3').dataset.phase!=='signal')return;paintLaunchSlots3('codeSequence',[],4);codeReady=true;$('showCodeBtn').disabled=false;$('mission3').dataset.transmitting='false';$('codeHint').textContent='Repeat the sequence using the four keys.';document.querySelectorAll('[data-code]').forEach(b=>b.disabled=false);},2200);
};
document.querySelectorAll('[data-code]').forEach(b=>b.onclick=()=>{
 if(!codeReady||$('mission3').dataset.phase!=='signal')return;codeInput.push(b.dataset.code);paintLaunchSlots3('codeSequence',codeInput,4);b.classList.add('entered');
 if(codeInput.length===4){
  if(codeInput.join('')===launchCode.join('')){codeReady=false;setLaunchPhase3('fuel');updateMix3();window.MKTYCampaign?.save();tg?.HapticFeedback?.notificationOccurred?.('success');}
  else{codeAttempts--;tg?.HapticFeedback?.notificationOccurred?.('error');const reset=codeAttempts<=0;if(reset)codeAttempts=3;newLaunchCode();$('codeStatus').textContent=reset?'Security reset. New code generated.':'Incorrect sequence. Attempts: '+codeAttempts;$('codeHint').textContent='Receive a new transmission and try again.';}
 }
});
function updateMix3(){
 const a=Number($('mixO2').value),b=Number($('mixFuel').value),d=Number($('mixCool').value),total=a+b+d;
 $('mixO2Val').textContent=a;$('mixFuelVal').textContent=b;$('mixCoolVal').textContent=d;$('mixTotal3').textContent=total;
 const limits=[[25,35],[40,50],[20,35]],values=[a,b,d];
 document.querySelectorAll('.fuel-matrix3 label').forEach((label,i)=>{label.style.setProperty('--mix-level',values[i]+'%');label.classList.toggle('stable',values[i]>=limits[i][0]&&values[i]<=limits[i][1]);});
 document.querySelectorAll('.fuel-matrix3 label').forEach((label,i)=>{const advice=label.querySelector('.mix-advice3');if(advice){const message=values[i]<limits[i][0]?'↑ INCREASE':values[i]>limits[i][1]?'↓ REDUCE':'✓ IN RANGE';if(advice.dataset.state!==message){advice.textContent=message;advice.dataset.state=message;}}});
 const stable=total===100&&a>=25&&a<=35&&b>=40&&b<=50&&d>=20&&d<=35;$('lockMix3').disabled=!stable;$('mixStability3').textContent=stable?'STABLE':'ADJUST';$('mixTotal3').parentElement.classList.toggle('stable',stable);
 $('mixHint3').textContent=stable?'Fuel matrix stable. Ready to lock.':total===100?'Total stable. Adjust the three stability indicators.':total>100?'Overpressure — reduce mixture.':'Insufficient load — increase mixture.';
}
['mixO2','mixFuel','mixCool'].forEach(id=>$(id)?.addEventListener('input',()=>{updateMix3();window.MKTYCampaign?.save();}));
$('lockMix3')?.addEventListener('click',()=>{
 if($('mission3').dataset.phase!=='fuel')return;
 const a=Number($('mixO2').value),b=Number($('mixFuel').value),d=Number($('mixCool').value);
 if(a+b+d!==100){$('mixHint3').textContent='Total load must equal exactly 100.';return;}
 // Broad enough to solve by reasoning, not pixel hunting: oxygen 25-35, fuel 40-50, coolant remainder.
 if(a<25||a>35||b<40||b>50||d<20||d>35){$('mixHint3').textContent='Matrix unstable. FUEL needs the largest share; O₂ and COOLANT must remain balanced.';tg?.HapticFeedback?.impactOccurred?.('light');return;}
 $('mixHint3').textContent='Fuel matrix stable ✓';setLaunchPhase3('ignition');resetIgnition3();window.MKTYCampaign?.save();tg?.HapticFeedback?.notificationOccurred?.('success');
});
function stopLaunchTimer3(){clearInterval(launchTimer3);clearTimeout(ignitionRevealTimer3);launchTimer3=null;ignitionRevealTimer3=null;$('showIgnition3').disabled=false;}
function renderLaunchTime3(){$('launchTimerFill3').style.width=Math.max(0,launchTime3)+'%';$('launchSeconds3').textContent=(Math.max(0,launchTime3)/20).toFixed(1).padStart(4,'0');$('mission3').dataset.timeLow=String(launchTime3<30);}
function resetIgnition3(msg='Awaiting launch order.'){stopLaunchTimer3();ignitionInput3=[];launchTime3=100;renderLaunchTime3();paintLaunchSlots3('ignitionOrder3',[],3);$('ignitionHint3').textContent=msg;document.querySelectorAll('[data-ignite3]').forEach(b=>{b.disabled=true;b.classList.remove('armed');});}
$('showIgnition3')?.addEventListener('click',()=>{
 if($('mission3').dataset.phase!=='ignition')return;
 resetIgnition3('Memorize the ignition order…');ignitionOrder3=['NAV','CORE','COMMS'].sort(()=>Math.random()-.5);paintLaunchSlots3('ignitionOrder3',ignitionOrder3,3);$('showIgnition3').disabled=true;
 ignitionRevealTimer3=missionTimeout(3,()=>{ignitionRevealTimer3=null;if($('mission3').dataset.phase!=='ignition')return;paintLaunchSlots3('ignitionOrder3',[],3);$('showIgnition3').disabled=false;document.querySelectorAll('[data-ignite3]').forEach(b=>b.disabled=false);$('ignitionHint3').textContent='GO — arm all systems before time expires!';launchTimer3=setInterval(()=>{if(document.hidden||window.MKTYExperience?.paused)return;launchTime3-=2;renderLaunchTime3();if(launchTime3<=0){resetIgnition3('Launch window missed. Receive a new order.');tg?.HapticFeedback?.notificationOccurred?.('error');}},100);},1800);
});
document.querySelectorAll('[data-ignite3]').forEach(b=>b.onclick=()=>{
 if(!launchTimer3||!ignitionOrder3.length||$('mission3').dataset.phase!=='ignition')return;const v=b.dataset.ignite3;
 if(v!==ignitionOrder3[ignitionInput3.length]){resetIgnition3('Wrong system. Launch sequence aborted — receive a new order.');tg?.HapticFeedback?.notificationOccurred?.('error');return;}
 ignitionInput3.push(v);b.classList.add('armed');b.disabled=true;$('ignitionHint3').textContent='Armed: '+ignitionInput3.length+' / 3';
 if(ignitionInput3.length===3){stopLaunchTimer3();awardLifePoints(3,750);setLaunchPhase3('complete');tg?.HapticFeedback?.notificationOccurred?.('success');}
});
$('life3ReturnBtn').onclick=()=>show('home');

function unlockLife4(){
 if(localStorage.getItem('mkty_life3')!=='complete')return false;
 const a=$('life3Card'),b=$('life4Card'),i=$('life4Icon'),p=$('storyProgress');a?.classList.add('complete');if(b){b.disabled=false;b.classList.remove('locked');b.classList.add('unlocked');}if(i)i.textContent='4';if(p)p.style.width='44%';return true;
}
$('continueLife4Btn').onclick=(ev)=>{ev?.preventDefault?.();if(!unlockLife4())return;startLife4();};
if($('life4Card'))$('life4Card').onclick=()=>$('continueLife4Btn').click();
let alt4=2400,vel4=28,fuel4=100,drift4=0,driftVel4=0,descentTimer=null,burnHeld4=false,downHeld4=false,leftHeld4=false,rightHeld4=false,descentActive4=false;
const descentWorld4=$('lander').parentElement;
let descentBounds4={height:1,width:1,shipWidth:96,shipHeight:64},descentAdvice4='';
function measureDescent4(){if(!descentWorld4.clientWidth)return;descentBounds4={height:descentWorld4.clientHeight,width:descentWorld4.clientWidth,shipWidth:$('lander').offsetWidth,shipHeight:$('lander').offsetHeight};}
new ResizeObserver(measureDescent4).observe(descentWorld4);
function renderDescent(readouts=true){
 if(readouts){
 $('altitude').textContent=Math.max(0,Math.round(alt4));$('velocity').textContent=vel4.toFixed(1);$('fuel').textContent=Math.max(0,Math.round(fuel4));$('driftRead4').textContent=(drift4>0?'+':'')+Math.round(drift4);
 }
 const ship=$('lander');
 const startY=12, endY=Math.max(startY,descentBounds4.height-descentBounds4.shipHeight-34);
 const landY=startY+(1-Math.max(0,Math.min(2400,alt4))/2400)*(endY-startY);
 ship.style.transform='translateX(calc(-50% + '+drift4+'px)) rotate('+Math.max(-8,Math.min(8,driftVel4*5))+'deg)';ship.style.top=landY+'px';ship.style.setProperty('--drift4',drift4+'px');
 if(readouts){
 $('safeVel4').classList.toggle('safe',vel4<=14);$('safeDrift4').classList.toggle('safe',Math.abs(drift4)<=42);document.querySelector('.landing-zone')?.classList.toggle('safe-zone',vel4<=14&&Math.abs(drift4)<=42);
 $('thrustRead4').textContent=$('thrustDial').value+'%';
 const flight=alt4>700?'approach':alt4>180?'braking':'final';
 if($('mission4').dataset.flight!==flight){$('mission4').dataset.flight=flight;if($('landingPhase4'))$('landingPhase4').textContent=alt4>700?'APPROACH':alt4>180?'BRAKING ZONE':'FINAL APPROACH';}
 if($('landingVector4'))$('landingVector4').style.setProperty('--vector',Math.max(-42,Math.min(42,drift4))+'%');
 if(descentActive4){
  const deceleration=1.8+Number($('thrustDial').value)*.092;
  const brakeDistance=Math.max(0,(vel4*vel4-196)*2.5/(2*deceleration))+Math.max(65,vel4*2);
  const advice=fuel4<=0?'FUEL EMPTY • NO THRUST':Math.abs(drift4)>42?(drift4>0?'STEER ◀ TO THE LANDING PAD':'STEER ▶ TO THE LANDING PAD'):vel4>14&&alt4<brakeDistance?'BRAKE NOW • HOLD ▲':vel4<0?'RISING • RELEASE ▲':alt4<180?'FINAL APPROACH • KEEP SPEED ≤ 14':'DESCENDING • SAVE FUEL FOR BRAKING';
  if(advice!==descentAdvice4){descentAdvice4=advice;$('descentStatus').textContent=advice;}
  $('mission4').dataset.brake=String(vel4>14&&alt4<brakeDistance&&fuel4>0);
 }
 }
}
function startLife4(){playLifeCinematic(4,openMission4);}
function finishDescent4(success){
 descentActive4=false;cancelAnimationFrame(descentTimer);descentTimer=null;burnHeld4=downHeld4=leftHeld4=rightHeld4=false;$('lander').classList.remove('thrusting');
 if(success){awardLifePoints(4,1000);$('descentStatus').textContent='Touchdown confirmed ✓';$('life4Complete').hidden=false;tg?.HapticFeedback?.notificationOccurred?.('success');}
 else{localStorage.removeItem('mkty_campaign_checkpoint_4');$('lander').classList.add('crashed');$('descentStatus').textContent='Landing aborted. Review the flight and try again.';tg?.HapticFeedback?.notificationOccurred?.('error');window.MKTYExperience?.flightFailed(4,{velocity:vel4,drift:drift4,fuel:fuel4},openMission4);}
}
function openMission4(){
 clearMissionDelays(4);
 alt4=2400;vel4=18;fuel4=100;drift4=0;driftVel4=(Math.random()-.5)*.35;descentActive4=true;descentAdvice4='';$('life4Complete').hidden=true;$('lander').classList.remove('crashed','thrusting');$('descentStatus').textContent='Manual descent active. Control velocity, drift and fuel.';show('mission4');measureDescent4();renderDescent();cancelAnimationFrame(descentTimer);
 let last=performance.now(),hud=0;
 const frame=now=>{
  descentTimer=null;const dt=Math.min(.04,Math.max(0,(now-last)/1000));last=now;
  if(!descentActive4||!$('mission4').classList.contains('active'))return;
  if(!document.hidden&&!window.MKTYExperience?.paused){
   const power=Number($('thrustDial').value)/100,step=dt/.1;
   vel4+=.10*step;
   if(burnHeld4&&fuel4>0){vel4=Math.max(-16,vel4-(.28+power*.92)*step);fuel4=Math.max(0,fuel4-(.12+power*.18)*step);$('lander').classList.add('thrusting');}else $('lander').classList.remove('thrusting');
   if(downHeld4)vel4=Math.min(45,vel4+.22*step);
   if(leftHeld4&&fuel4>0){driftVel4-=.11*step;fuel4=Math.max(0,fuel4-.07*step);}if(rightHeld4&&fuel4>0){driftVel4+=.11*step;fuel4=Math.max(0,fuel4-.07*step);}
   driftVel4*=Math.pow(.94,step);drift4+=driftVel4*step;
   const driftLimit=Math.max(0,Math.min(105,(descentBounds4.width-descentBounds4.shipWidth)/2-8));
   drift4=Math.max(-driftLimit,Math.min(driftLimit,drift4));alt4=Math.min(2400,alt4-vel4*.25*step);
   hud+=dt;if(alt4<=0){alt4=0;renderDescent();finishDescent4(vel4<=14&&Math.abs(drift4)<=42);return;}renderDescent(hud>=.1);if(hud>=.1)hud=0;
  }
  descentTimer=requestAnimationFrame(frame);
 };descentTimer=requestAnimationFrame(frame);window.MKTYCampaign?.restore(4);
}

function holdControl4(el,setter){
 const on=ev=>{ev.preventDefault();setter(true);el.setPointerCapture?.(ev.pointerId);},off=()=>setter(false);
 el.addEventListener('pointerdown',on);el.addEventListener('pointerup',off);el.addEventListener('pointercancel',off);el.addEventListener('lostpointercapture',off);
 el.addEventListener('keydown',e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();setter(true);}});el.addEventListener('keyup',e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();setter(false);}});el.addEventListener('blur',off);
}
holdControl4($('burnBtn'),v=>burnHeld4=v);holdControl4($('downThruster4'),v=>downHeld4=v);holdControl4($('leftThruster'),v=>leftHeld4=v);holdControl4($('rightThruster'),v=>rightHeld4=v);
function releaseDescentControls(){burnHeld4=downHeld4=leftHeld4=rightHeld4=false;}
window.addEventListener('blur',releaseDescentControls);
document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseDescentControls();});
window.addEventListener('resize',()=>{if($('mission4').classList.contains('active'))renderDescent();});
$('thrustDial').oninput=renderDescent;
$('life4ReturnBtn').onclick=()=>show('home');

function unlockLife5(){
 if(localStorage.getItem('mkty_life4')!=='complete')return false;const a=$('life4Card'),b=$('life5Card'),i=$('life5Icon'),p=$('storyProgress');a?.classList.add('complete');if(b){b.disabled=false;b.classList.remove('locked');b.classList.add('unlocked');}if(i)i.textContent='5';if(p)p.style.width='55%';return true;
}
$('continueLife5Btn').onclick=(ev)=>{ev?.preventDefault?.();if(!unlockLife5())return;startLife5();};if($('life5Card'))$('life5Card').onclick=()=>$('continueLife5Btn').click();
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
 clearMissionDelays(6);
 launchSeconds=30;launchOrder6=shuffle6(launchSystems6);launchIndex6=0;launchFault6=null;faultResolved6=true;nextFaultAt6=21;launchActive6=true;$('launchClock').textContent=30;$('launchClock').classList.remove('danger');$('launchBtn').disabled=true;$('life6Complete').hidden=true;$('launchEmergency6').hidden=true;$('launchOrder6').textContent=launchOrder6.join(' → ');$('launchStatus').textContent='Follow the transmitted procedure. Watch for flight computer alerts.';document.querySelectorAll('[data-launch]').forEach(b=>{b.disabled=false;b.classList.remove('armed','error','ready6');});$('launchShip').classList.remove('lifted');$('launchFlame').classList.remove('active');show('mission6');clearInterval(launchTimer);
 launchTimer=setInterval(()=>{if(!launchActive6||document.hidden)return;launchSeconds--;$('launchClock').textContent=launchSeconds;if(launchSeconds<=10)$('launchClock').classList.add('danger');if(launchSeconds===nextFaultAt6&&launchIndex6<4)showFault6();if(launchSeconds<=0){launchActive6=false;clearInterval(launchTimer);$('launchStatus').textContent='ABORT — launch window missed. Sequence reset.';tg?.HapticFeedback?.notificationOccurred?.('error');laterInMission(6,openMission6,1400);}},1000);
}
document.querySelectorAll('[data-launch]').forEach(b=>b.onclick=()=>{if(!launchActive6||!faultResolved6)return;const system=b.dataset.launch;if(system!==launchOrder6[launchIndex6]){b.classList.add('error');launchSeconds=Math.max(1,launchSeconds-3);$('launchStatus').textContent='Wrong system — 3 seconds lost.';tg?.HapticFeedback?.impactOccurred?.('medium');return;}b.classList.remove('error');b.classList.add('armed');b.disabled=true;launchIndex6++;tg?.HapticFeedback?.impactOccurred?.('light');if(launchIndex6===2&&nextFaultAt6>12)nextFaultAt6=Math.min(nextFaultAt6,launchSeconds-2);if(launchIndex6===4&&faultResolved6){$('launchBtn').disabled=false;$('launchStatus').textContent='All systems armed. LAUNCH before T−0!';}});
document.querySelectorAll('[data-response6]').forEach(b=>b.onclick=()=>{if(!launchFault6||faultResolved6)return;if(b.dataset.response6===launchFault6.answer){faultResolved6=true;$('launchEmergency6').hidden=true;$('launchStatus').textContent='Fault cleared ✓ Continue launch procedure.';launchFault6=null;tg?.HapticFeedback?.notificationOccurred?.('success');if(launchIndex6===4)$('launchBtn').disabled=false;}else{launchSeconds=Math.max(1,launchSeconds-5);$('launchAlertHint6').textContent='Incorrect response — 5 seconds lost!';tg?.HapticFeedback?.notificationOccurred?.('error');}});
$('launchBtn').onclick=()=>{if(launchIndex6!==4||!faultResolved6||!launchActive6)return;launchActive6=false;clearInterval(launchTimer);$('launchShip').classList.add('lifted');$('launchFlame').classList.add('active');$('launchBtn').disabled=true;awardLifePoints(6,1500);$('launchStatus').textContent='Liftoff confirmed — orbit achieved ✓';laterInMission(6,()=>$('life6Complete').hidden=false,900);tg?.HapticFeedback?.notificationOccurred?.('success');};
$('life6ReturnBtn').onclick=()=>show('home');

function unlockLife7(){
 if(localStorage.getItem('mkty_life6')!=='complete')return false;const a=$('life6Card'),b=$('life7Card'),i=$('life7Icon'),p=$('storyProgress');a?.classList.add('complete');if(b){b.disabled=false;b.classList.remove('locked');b.classList.add('unlocked');}if(i)i.textContent='7';if(p)p.style.width='77%';return true;
}
$('continueLife7Btn').onclick=(ev)=>{ev?.preventDefault?.();if(!unlockLife7())return;startLife7();};if($('life7Card'))$('life7Card').onclick=()=>$('continueLife7Btn').click();
let lane7=1,hull7=100,shield7=3,distance7=0,shieldActive7=false,voidTimer=null,spawnTimer7=null,voidActive7=false,asteroids7=[];
function renderVoid(){
 $('hull7').textContent=Math.max(0,Math.round(hull7));$('hullHud7').textContent=Math.max(0,Math.round(hull7));$('hullFill7').style.width=Math.max(0,hull7)+'%';$('shield7').textContent=shield7;$('distance7').textContent=Math.min(100,Math.round(distance7));
 const left=[22,50,78][lane7];$('voidShip').style.left=left+'%';$('shieldBubble7').style.left=left+'%';$('shieldBubble7').classList.toggle('active',shieldActive7);$('shieldBtn').disabled=shield7<=0||shieldActive7;
}
function spawnAsteroid7(){
 if(!voidActive7||document.hidden)return;const field=$('asteroidField'),lane=Math.floor(Math.random()*3),el=document.createElement('span');const big=Math.random()<.22;el.className='asteroid7 '+(big?'big':'small');el.setAttribute('aria-hidden','true');el.dataset.lane=lane;el.dataset.hit='0';el.style.left=['22%','50%','78%'][lane];const speed=Math.max(1.15,2.5-distance7*.012);el.style.setProperty('--fall7',speed+'s');field.appendChild(el);asteroids7.push(el);
 el.addEventListener('animationend',()=>{el.remove();asteroids7=asteroids7.filter(x=>x!==el);},{once:true});
}
function stopVoid7(){voidActive7=false;clearInterval(voidTimer);clearInterval(spawnTimer7);voidTimer=spawnTimer7=null;}
function crashVoid7(){stopVoid7();$('voidStatus').textContent='HULL FAILURE — emergency reset.';tg?.HapticFeedback?.notificationOccurred?.('error');laterInMission(7,openMission7,1500);}
function startLife7(){playLifeCinematic(7,openMission7);}
function openMission7(){
 clearMissionDelays(7);
 stopVoid7();lane7=1;hull7=100;shield7=3;distance7=0;shieldActive7=false;asteroids7=[];$('asteroidField').innerHTML='';$('life7Complete').hidden=true;$('voidStatus').textContent='Debris field entered. Survive to the transmission gate.';show('mission7');voidActive7=true;renderVoid();
 spawnTimer7=setInterval(spawnAsteroid7,720);
 voidTimer=setInterval(()=>{if(!voidActive7||document.hidden)return;distance7+=.42;const world=$('voidWorld7').getBoundingClientRect(),ship=$('voidShip').getBoundingClientRect();asteroids7.forEach(el=>{if(!el.isConnected||el.dataset.hit==='1')return;const r=el.getBoundingClientRect();const overlap=!(r.right<ship.left+8||r.left>ship.right-8||r.bottom<ship.top+8||r.top>ship.bottom-8);if(overlap){el.dataset.hit='1';el.remove();if(shieldActive7){shieldActive7=false;$('voidStatus').textContent='Shield absorbed asteroid impact.';}else{hull7-=el.classList.contains('big')?34:20;$('voidStatus').textContent='HULL IMPACT! Evade!';$('voidWorld7').classList.remove('hit7');void $('voidWorld7').offsetWidth;$('voidWorld7').classList.add('hit7');tg?.HapticFeedback?.notificationOccurred?.('error');}renderVoid();}});
 if(hull7<=0){crashVoid7();return;}if(distance7>=100){stopVoid7();awardLifePoints(7,1750);$('voidStatus').textContent='Transmission gate reached ✓';$('life7Complete').hidden=false;tg?.HapticFeedback?.notificationOccurred?.('success');return;}renderVoid();},100);
}
$('voidLeft').onclick=()=>{if(!voidActive7)return;lane7=Math.max(0,lane7-1);renderVoid();};$('voidRight').onclick=()=>{if(!voidActive7)return;lane7=Math.min(2,lane7+1);renderVoid();};$('shieldBtn').onclick=()=>{if(!voidActive7||shield7<=0||shieldActive7)return;shield7--;shieldActive7=true;$('voidStatus').textContent='Shield armed — one impact protected.';renderVoid();};
$('life7ReturnBtn').onclick=()=>show('home');

function unlockLife8(){
 if(localStorage.getItem('mkty_life7')!=='complete')return false;const a=$('life7Card'),b=$('life8Card'),i=$('life8Icon'),p=$('storyProgress');a?.classList.add('complete');if(b){b.disabled=false;b.classList.remove('locked');b.classList.add('unlocked');}if(i)i.textContent='8';if(p)p.style.width='88%';return true;
}
$('continueLife8Btn').onclick=(ev)=>{ev?.preventDefault?.();if(!unlockLife8())return;startLife8();};if($('life8Card'))$('life8Card').onclick=()=>$('continueLife8Btn').click();
let targetFreq8=0,targetPhase8=0,pulse8=[],pulseInput8=[],pulseRound8=1,phaseTimer8=null,phaseProgress8=0,pulseReady8=false;
function setSignalStage8(stage){$('mission8').dataset.stage=stage;$('frequencyPanel8').hidden=stage!=='frequency';$('lockFreq8').hidden=stage!=='frequency';$('phasePanel8').hidden=stage!=='phase';$('pulsePanel8').hidden=stage!=='pulse';}
function startLife8(){playLifeCinematic(8,openMission8);}
function openMission8(){
 clearMissionDelays(8);
 setSignalStage8('frequency');pulseReady8=false;targetFreq8=25+Math.floor(Math.random()*51);targetPhase8=25+Math.floor(Math.random()*51);pulseInput8=[];pulseRound8=1;phaseProgress8=0;clearInterval(phaseTimer8);phaseTimer8=null;$('freq8').value=20;$('phase8').value=50;document.querySelector('.phase-scope8').style.setProperty('--phase-target',targetPhase8+'%');$('phasePanel8').hidden=true;$('phaseHold8').hidden=true;$('pulsePanel8').hidden=true;$('coordinates8').hidden=true;$('life8Complete').hidden=true;$('signalPulse').classList.remove('decoded');$('link8').textContent=0;$('signalStatus8').textContent='Sweep the band and locate the strongest transmission.';show('mission8');updateFreq8();updatePhase8();
}
function updateFreq8(){const v=Number($('freq8').value),d=Math.abs(v-targetFreq8),strength=Math.max(0,100-d*4);$('freqRead8').textContent=(140+v/10).toFixed(1)+' MHz';$('strengthFill8').style.width=strength+'%';$('strengthText8').textContent='SIGNAL '+Math.round(strength)+'%';}
$('freq8').oninput=updateFreq8;
$('lockFreq8').onclick=()=>{const d=Math.abs(Number($('freq8').value)-targetFreq8);if(d<=3){$('link8').textContent=30;setSignalStage8('phase');$('signalStatus8').textContent='Carrier acquired. Stabilize phase.';tg?.HapticFeedback?.notificationOccurred?.('success');}else{$('signalStatus8').textContent=Number($('freq8').value)<targetFreq8?'Signal rises at higher frequency.':'Signal rises at lower frequency.';}};
function updatePhase8(){const v=Number($('phase8').value);$('phaseNeedle8').style.left=v+'%';if(phaseTimer8&&Math.abs(v-targetPhase8)>4){clearInterval(phaseTimer8);phaseTimer8=null;phaseProgress8=0;$('phaseHoldFill8').style.width='0%';$('signalStatus8').textContent='Phase lock lost. Re-align and hold again.';}}
$('phase8').oninput=updatePhase8;
$('lockPhase8').onclick=()=>{if(phaseTimer8)return;const d=Math.abs(Number($('phase8').value)-targetPhase8);if(d>4){$('signalStatus8').textContent=Number($('phase8').value)<targetPhase8?'Phase target is to the right.':'Phase target is to the left.';return;}phaseProgress8=0;$('phaseHold8').hidden=false;$('signalStatus8').textContent='Phase aligned. Hold steady…';phaseTimer8=setInterval(()=>{if(document.hidden)return;if(Math.abs(Number($('phase8').value)-targetPhase8)>4){updatePhase8();return;}phaseProgress8+=4;$('phaseHoldFill8').style.width=phaseProgress8+'%';if(phaseProgress8>=100){clearInterval(phaseTimer8);phaseTimer8=null;$('link8').textContent=60;setSignalStage8('pulse');$('signalStatus8').textContent='Phase synchronized. Decode the transmission.';newPulseRound8();tg?.HapticFeedback?.notificationOccurred?.('success');}},110);};
function newPulseRound8(){const len=3+pulseRound8;pulse8=Array.from({length:len},()=>Math.floor(Math.random()*3));pulseInput8=[];$('pulseRound8').textContent=pulseRound8;showPulse8();}
function showPulse8(){
 clearMissionDelays(8);pulseReady8=false;pulseInput8=[];
 document.querySelectorAll('[data-pulse8]').forEach(b=>b.disabled=true);$('replayPulse8').disabled=true;
 paintLaunchSlots3('pulseDisplay8',pulse8.map(n=>['◯','△','◇'][n]),pulse8.length);
 $('pulseHint8').textContent='Memorize '+pulse8.length+' symbols.';
 laterInMission(8,()=>{paintLaunchSlots3('pulseDisplay8',[],pulse8.length);pulseReady8=true;$('replayPulse8').disabled=false;document.querySelectorAll('[data-pulse8]').forEach(b=>b.disabled=false);$('pulseHint8').textContent='Repeat the pulse.';},1600+pulse8.length*220);
}
$('replayPulse8').onclick=()=>{pulseInput8=[];showPulse8();};
document.querySelectorAll('[data-pulse8]').forEach(b=>b.onclick=()=>{if($('pulsePanel8').hidden||!pulse8.length||!pulseReady8)return;const v=Number(b.dataset.pulse8);if(v!==pulse8[pulseInput8.length]){pulseInput8=[];$('signalStatus8').textContent='Pattern rejected. Transmission shifted — new pulse generated.';newPulseRound8();tg?.HapticFeedback?.notificationOccurred?.('error');return;}pulseInput8.push(v);$('pulseHint8').textContent='Decoded: '+pulseInput8.length+' / '+pulse8.length;paintLaunchSlots3('pulseDisplay8',pulseInput8.map(n=>['◯','△','◇'][n]),pulse8.length);if(pulseInput8.length===pulse8.length){pulseReady8=false;document.querySelectorAll('[data-pulse8]').forEach(b=>b.disabled=true);$('replayPulse8').disabled=true;if(pulseRound8<3){pulseRound8++;$('link8').textContent=60+pulseRound8*10;$('signalStatus8').textContent='Layer decoded. Signal complexity increasing…';laterInMission(8,newPulseRound8,600);}else{const lat=(10+Math.random()*70).toFixed(3),lon=(10+Math.random()*160).toFixed(3);$('link8').textContent=100;$('coordinatesValue8').textContent='LUNA // '+lat+' // '+lon;$('coordinates8').hidden=false;localStorage.setItem('mkty_life9_coordinates',lat+','+lon);awardLifePoints(8,2000);$('signalStatus8').textContent='Signal decoded. Final coordinates received ✓';$('signalPulse').classList.add('decoded');setSignalStage8('complete');$('life8Complete').hidden=false;tg?.HapticFeedback?.notificationOccurred?.('success');}}});
$('life8ReturnBtn').onclick=()=>show('home');

function unlockLife9(){
 if(localStorage.getItem('mkty_life8')!=='complete')return false;const a=$('life8Card'),b=$('life9Card'),i=$('life9Icon'),p=$('storyProgress');a?.classList.add('complete');if(b){b.disabled=false;b.classList.remove('locked');b.classList.add('unlocked');}if(i)i.textContent='9';if(p)p.style.width='99%';return true;
}
$('continueLife9Btn').onclick=(ev)=>{ev?.preventDefault?.();if(!unlockLife9())return;startLife9();};if($('life9Card'))$('life9Card').onclick=()=>$('continueLife9Btn').click();
let navTarget9=50,syncSeq9=[],syncInput9=[],syncRound9=1,finalSeq9=[],finalInput9=[],coreHealth9=100,finalPower9=100,finalTimer9=null,syncReady9=false,finalReady9=false;
function setFinalStage9(stage){$('mission9').dataset.stage=stage;}
function startLife9(){playLifeCinematic(9,openMission9);}
function openMission9(){
 clearMissionDelays(9);
 syncReady9=finalReady9=false;setFinalStage9('coordinates');$('coordLat9').value='';$('coordLon9').value='';$('savedCoords9').textContent=(localStorage.getItem('mkty_life9_coordinates')||'—').replace(',',' / ');navTarget9=35+Math.floor(Math.random()*31);syncSeq9=[];syncInput9=[];syncRound9=1;finalSeq9=[];finalInput9=[];coreHealth9=100;finalPower9=100;clearInterval(finalTimer9);$('nav9').hidden=false;$('corridor9').hidden=true;$('sync9').hidden=true;$('transmit9').hidden=true;$('life9Complete').hidden=true;$('phase9a').className='active';$('phase9b').className='';$('phase9c').className='';$('core9').textContent=100;$('navDial9').value=10;document.querySelector('.corridor-meter9').style.setProperty('--corridor-target',navTarget9+'%');$('corridorNeedle9').style.left='10%';$('coreHealthFill9').style.width='100%';$('finalPowerFill9').style.width='100%';$('finalStatus9').textContent='Phase I — verify the coordinates from LIFE #8.';$('finalGate').classList.remove('open');$('finalShip').classList.remove('returned');show('mission9');
}
$('verifyCoords9').onclick=()=>{const saved=localStorage.getItem('mkty_life9_coordinates')||'',parts=saved.split(','),a=$('coordLat9').value.trim(),b=$('coordLon9').value.trim();if(parts.length===2&&a===parts[0]&&b===parts[1]){$('corridor9').hidden=false;setFinalStage9('corridor');$('finalStatus9').textContent='Coordinates verified ✓ Stabilize the return corridor.';tg?.HapticFeedback?.notificationOccurred?.('success');}else{$('finalStatus9').textContent='Coordinates rejected. Recheck the LIFE #8 transmission.';coreHealth9=Math.max(70,coreHealth9-5);$('coreHealthFill9').style.width=coreHealth9+'%';$('core9').textContent=coreHealth9;tg?.HapticFeedback?.notificationOccurred?.('error');}};
$('navDial9').oninput=()=>{$('corridorNeedle9').style.left=$('navDial9').value+'%';};
function showSync9(){
 clearMissionDelays(9);syncReady9=false;syncInput9=[];const len=3+syncRound9;
 syncSeq9=Array.from({length:len},()=>Math.floor(Math.random()*3));$('syncRound9').textContent=syncRound9;
 paintLaunchSlots3('syncSequence9',syncSeq9.map(n=>['A','B','C'][n]),len);
 $('syncHint9').textContent='Memorize '+len+' symbols.';$('replaySync9').disabled=true;document.querySelectorAll('[data-sync9]').forEach(b=>b.disabled=true);
 laterInMission(9,()=>{paintLaunchSlots3('syncSequence9',[],len);syncReady9=true;$('replaySync9').disabled=false;document.querySelectorAll('[data-sync9]').forEach(b=>b.disabled=false);$('syncHint9').textContent='Repeat core pulse • cycle '+syncRound9+'/3';},1500+len*180);
}
$('lockNav9').onclick=()=>{const v=Number($('navDial9').value),d=Math.abs(v-navTarget9);if(d<=3){setFinalStage9('sync');$('nav9').hidden=true;$('sync9').hidden=false;$('phase9a').className='done';$('phase9b').className='active';$('finalStatus9').textContent='Phase II — damaged core synchronization.';showSync9();tg?.HapticFeedback?.notificationOccurred?.('success');}else{coreHealth9=Math.max(50,coreHealth9-4);$('coreHealthFill9').style.width=coreHealth9+'%';$('core9').textContent=Math.round(coreHealth9);$('finalStatus9').textContent=v<navTarget9?'Corridor vector is higher.':'Corridor vector is lower.';}};
$('replaySync9').onclick=showSync9;
document.querySelectorAll('[data-sync9]').forEach(b=>b.onclick=()=>{if($('sync9').hidden||!syncSeq9.length||!syncReady9)return;const v=Number(b.dataset.sync9);if(v!==syncSeq9[syncInput9.length]){coreHealth9-=12;$('coreHealthFill9').style.width=Math.max(0,coreHealth9)+'%';$('core9').textContent=Math.max(0,Math.round(coreHealth9));$('finalStatus9').textContent='Core desynchronized — integrity lost.';tg?.HapticFeedback?.notificationOccurred?.('error');if(coreHealth9<=20){syncReady9=false;document.querySelectorAll('[data-sync9]').forEach(b=>b.disabled=true);$('replaySync9').disabled=true;$('finalStatus9').textContent='CORE FAILURE — restarting final mission.';laterInMission(9,openMission9,1400);return;}showSync9();return;}syncInput9.push(v);$('syncHint9').textContent='Synchronized '+syncInput9.length+' / '+syncSeq9.length;paintLaunchSlots3('syncSequence9',syncInput9.map(n=>['A','B','C'][n]),syncSeq9.length);if(syncInput9.length===syncSeq9.length){syncReady9=false;document.querySelectorAll('[data-sync9]').forEach(b=>b.disabled=true);$('replaySync9').disabled=true;if(syncRound9<3){syncRound9++;coreHealth9=Math.min(100,coreHealth9+8);$('coreHealthFill9').style.width=coreHealth9+'%';$('core9').textContent=coreHealth9;laterInMission(9,showSync9,500);}else{startFinalTransmit9();}}});
function showFinalCode9(){
 clearMissionDelays(9);finalReady9=false;finalInput9=[];finalSeq9=Array.from({length:6},()=>Math.floor(Math.random()*4));
 paintLaunchSlots3('finalCode9',finalSeq9.map(n=>['▲','●','◆','■'][n]),6);$('replayFinal9').disabled=true;document.querySelectorAll('[data-final9]').forEach(b=>b.disabled=true);
 laterInMission(9,()=>{paintLaunchSlots3('finalCode9',[],6);finalReady9=true;$('replayFinal9').disabled=false;document.querySelectorAll('[data-final9]').forEach(b=>b.disabled=false);},2600);
}
function startFinalTransmit9(){setFinalStage9('transmit');$('sync9').hidden=true;$('transmit9').hidden=false;$('phase9b').className='done';$('phase9c').className='active';$('finalStatus9').textContent='FINAL PHASE — transmit before core power collapses.';finalPower9=100;$('finalPowerFill9').style.width='100%';showFinalCode9();clearInterval(finalTimer9);finalTimer9=setInterval(()=>{if(document.hidden)return;finalPower9-=1;$('finalPowerFill9').style.width=Math.max(0,finalPower9)+'%';$('core9').textContent=Math.max(0,Math.round(finalPower9));if(finalPower9<=0){finalReady9=false;clearMissionDelays(9);document.querySelectorAll('[data-final9]').forEach(b=>b.disabled=true);$('replayFinal9').disabled=true;clearInterval(finalTimer9);finalTimer9=null;$('finalStatus9').textContent='POWER LOST — final transmission failed.';laterInMission(9,openMission9,1400);}},120);}
$('replayFinal9').onclick=()=>{if(finalReady9&&finalPower9>20){finalPower9-=15;showFinalCode9();$('finalStatus9').textContent='Code replay costs 15% core power.';}};
document.querySelectorAll('[data-final9]').forEach(b=>b.onclick=()=>{if($('transmit9').hidden||!finalSeq9.length||!finalReady9||finalPower9<=0)return;const v=Number(b.dataset.final9);if(v!==finalSeq9[finalInput9.length]){finalPower9=Math.max(0,finalPower9-18);$('finalPowerFill9').style.width=finalPower9+'%';$('finalStatus9').textContent='Transmission rejected — 18% power lost.';showFinalCode9();tg?.HapticFeedback?.notificationOccurred?.('error');return;}finalInput9.push(v);$('finalStatus9').textContent='Return code: '+finalInput9.length+' / 6';paintLaunchSlots3('finalCode9',finalInput9.map(n=>['▲','●','◆','■'][n]),6);if(finalInput9.length===6){finalReady9=false;clearMissionDelays(9);document.querySelectorAll('[data-final9]').forEach(b=>b.disabled=true);$('replayFinal9').disabled=true;clearInterval(finalTimer9);finalTimer9=null;awardLifePoints(9,3000);if($('storyProgress'))$('storyProgress').style.width='100%';$('phase9c').className='done';$('core9').textContent=Math.round(finalPower9);$('finalGate').classList.add('open');$('finalShip').classList.add('returned');$('finalStatus9').textContent='RETURN TRANSMISSION ACCEPTED ✓';laterInMission(9,()=>{setFinalStage9('complete');$('life9Complete').hidden=false;},900);tg?.HapticFeedback?.notificationOccurred?.('success');}});
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
