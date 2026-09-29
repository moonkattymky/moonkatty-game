
const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }

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
 ['fr','🇫🇷','Français'],['it','🇮🇹','Italiano'],['tr','🇹🇷','Türkçe'],['he','🇮🇱','עברית']
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
 he:['בחר שפה','ברוכים הבאים לצוות.','התחל את המשימה 🚀','חיים #1 — ההתעוררות','האות התקבל. המסע אל הירח מתחיל כאן.']
};
const $=id=>document.getElementById(id);
function setLang(code){
 localStorage.setItem('mkty_lang',code);
 document.documentElement.lang=code;
 document.documentElement.dir=code==='he'?'rtl':'ltr';
 const t=copy[code]||copy.en;
 $('chooseText').textContent=t[0]; $('welcome').textContent=t[1]; $('enterBtn').textContent=t[2];
 $('lifeTitle').textContent=t[3]; $('lifeText').textContent=t[4];
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
let life1Stage=0, tuneAttempts=0, missionLives=3, missionSeconds=120, missionClockTimer, targetFrequency=0;
function randomizeFrequency(){
 targetFrequency=18+Math.floor(Math.random()*65);
 $('frequencyTarget').style.left=(targetFrequency-6)+'%';
 $('frequencyDial').value=50;
 updateFrequencyDial();
}
function updateFrequencyDial(){
 const v=Number($('frequencyDial').value);
 $('frequencyNeedle').style.left=v+'%';
 $('frequencyValue').textContent=(137+v/10).toFixed(1);
}
$('frequencyDial').addEventListener('input',updateFrequencyDial);
function renderSurvival(){
 $('life1Lives').textContent='LIVES '+('♥'.repeat(missionLives))+('♡'.repeat(3-missionLives));
 const m=String(Math.floor(missionSeconds/60)).padStart(2,'0'), s=String(missionSeconds%60).padStart(2,'0');
 $('missionClock').textContent=m+':'+s;
 $('missionClock').classList.toggle('danger',missionSeconds<=30);
}
function loseLife(reason){
 missionLives=Math.max(0,missionLives-1); renderSurvival();
 tg?.HapticFeedback?.notificationOccurred?.('error');
 $('missionStatus').textContent=reason+' Life lost.';
 if(missionLives===0){
  clearInterval(missionClockTimer);
  $('missionStatus').textContent='Mission failed. Reinitializing survival systems…';
  setTimeout(resetLife1Mission,1200);
 }
}
function resetLife1Mission(){
 missionLives=3; missionSeconds=120; tuneAttempts=0; setLife1Step(0); renderSurvival(); randomizeFrequency();
 $('tuneBtn').disabled=false; $('tuneBtn').textContent='LOCK FREQUENCY 📡';
 $('beaconBtn').hidden=true; $('beaconBtn').disabled=false; $('beaconBtn').textContent='APPROACH BEACON 🚀';
 $('scannerPuzzle').classList.remove('solved'); $('scannerFill').style.width='0%';
 $('frequencyNeedle').style.left='5%'; $('missionStatus').textContent='Search the surface for the signal source.';
 startMissionClock();
}
function startMissionClock(){
 clearInterval(missionClockTimer);
 missionClockTimer=setInterval(()=>{
  if(!$('mission1').classList.contains('active'))return;
  missionSeconds--; renderSurvival();
  if(missionSeconds<=0){clearInterval(missionClockTimer);loseLife('Oxygen window expired.');missionSeconds=120;startMissionClock();}
 },1000);
}
function setLife1Step(stage){
 life1Stage=stage;
 ['stepExplore','stepTune','stepReach','stepActivate'].forEach((id,i)=>{
  $(id).classList.toggle('active',i===stage);
  $(id).classList.toggle('done',i<stage);
 });
}
$('worldBeacon').onclick=()=>{
 if(life1Stage!==0)return;
 tg?.HapticFeedback?.impactOccurred('light');
 setLife1Step(1);
 $('missionStatus').textContent='Signal source found. Tune the scanner frequency.';
 document.querySelector('.beacon').classList.add('discovered');
};
$('tuneBtn').onclick=()=>{
 if(life1Stage!==1)return;
 tuneAttempts++;
 const chosen=Number($('frequencyDial').value);
 const distance=Math.abs(chosen-targetFrequency);
 tg?.HapticFeedback?.impactOccurred(distance<=6?'medium':'light');
 if(distance>6){
  const direction=chosen<targetFrequency?'higher':'lower';
  $('missionStatus').textContent='Weak signal. Try a '+direction+' frequency.';
  if(tuneAttempts%3===0) loseLife('Scanner overload.');
  return;
 }
 setLife1Step(2);
 $('scannerPuzzle').classList.add('solved');
 $('tuneBtn').textContent='FREQUENCY LOCKED ✓';
 $('tuneBtn').disabled=true;
 $('beaconBtn').hidden=false;
 $('missionStatus').textContent='Frequency locked. Reach the beacon.';
};
$('beaconBtn').onclick=()=>{
 if(life1Stage===2){
  setLife1Step(3);
  $('beaconBtn').textContent='ACTIVATE SIGNAL ⚡';
  $('missionStatus').textContent='Beacon reached. Activate first contact.';
  $('scannerFill').style.width='75%';
  tg?.HapticFeedback?.impactOccurred('medium');
  return;
 }
 if(life1Stage!==3)return;
 $('scannerFill').style.width='100%';
 tg?.HapticFeedback?.impactOccurred('heavy');
 $('beaconBtn').textContent='SIGNAL LOCKED ✓';
 $('beaconBtn').disabled=true;
 $('missionStatus').textContent='First contact established • +10 Moon Points';
 clearInterval(missionClockTimer);
 $('points').textContent='10 ⭐';
 localStorage.setItem('mkty_life1','complete');
 unlockLife2();
 setTimeout(()=>{$('life1Complete').hidden=false;$('life1Complete').scrollIntoView({behavior:'smooth',block:'center'});},350);
};
$('returnBtn').onclick=()=>show('home');
const saved=localStorage.getItem('mkty_lang');
if(saved) setLang(saved);
unlockLife2();
