
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
let signal=0;
$('beaconBtn').onclick=()=>{
 signal=Math.min(100,signal+25);
 tg?.HapticFeedback?.impactOccurred(signal===100?'heavy':'light');
 $('missionStatus').textContent='Signal strength: '+signal+'%';
 document.querySelector('.beacon').style.opacity=.35+signal/155;
 if(signal===100){
  $('beaconBtn').textContent='SIGNAL LOCKED ✓';
  $('beaconBtn').disabled=true;
  $('missionStatus').textContent='First contact established • +10 Moon Points';
  $('points').textContent='10 ⭐';
  localStorage.setItem('mkty_life1','complete');
 }
};
const saved=localStorage.getItem('mkty_lang');
if(saved) setLang(saved);
