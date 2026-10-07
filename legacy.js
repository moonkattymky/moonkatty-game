/* Campaign legacy: crew decisions (chapter 2), the Echo contact (finale 8) and earlier precision shape later stages and the finale-9 epilogue.
   Stored on this device in localStorage.mkty_legacy_v1. Every effect is a small bounded modifier validated by FieldRules.cleanMods. */
window.MKTYLegacy=(()=>{
 'use strict';
 const KEY='mkty_legacy_v1',tr=(ru,en)=>window.MKTYI18n?window.MKTYI18n.tr(ru,en):(localStorage.getItem('mkty_lang')==='ru'?ru:en);
 const LEADS=['navigator','engineer','scout'];
 function read(){try{const v=JSON.parse(localStorage.getItem(KEY));if(v&&v.version===1)return {version:1,lead:LEADS.includes(v.lead)?v.lead:null,airlock:['crew','cargo'].includes(v.airlock)?v.airlock:null,echo:['answer','silent'].includes(v.echo)?v.echo:null,decodeNoise:Number.isFinite(v.decodeNoise)?v.decodeNoise:null};}catch{}return {version:1,lead:null,airlock:null,echo:null,decodeNoise:null};}
 function set(k,v){const s=read();s[k]=v;try{localStorage.setItem(KEY,JSON.stringify(s));}catch{}return s;}
 function precise(){let count=0,total=0;for(let n=1;n<=8;n++){try{const p=JSON.parse(localStorage.getItem('mkty_story_plan_'+n+'_v1'));for(const t of Object.values(p?.tasks||{}))if(t?.performance){total++;if(t.performance.precise===true)count++;}}catch{}}return {count,total};}
 /** Modifiers for a story/finale stage. Training (daily) stages never receive campaign modifiers. */
 function mods(chapter,mechanic){const s=read(),m={};
  if(mechanic===2&&chapter===2&&s.lead)m.role=LEADS.indexOf(s.lead);
  if(s.lead==='navigator'){if(mechanic===3&&chapter>=3)m.radius=4;if(mechanic===11)m.preview=1;}
  if(s.lead==='engineer'){if(mechanic===5)m.tolerance=.6;if(mechanic===6)m.repair=6;}
  if(s.lead==='scout'&&mechanic===10)m.charges=1;
  if(mechanic===9&&chapter===9&&s.airlock==='crew')m.cells=1;
  if(mechanic===11){let stability=Math.min(20,precise().count*2);if(s.airlock==='cargo')stability+=10;if(stability)m.stability=stability;let charges=(m.charges||0)+(s.echo==='answer'?1:0);if(charges)m.charges=charges;}
  return m;}
 // ---------- decision dialog (shares the field-mission dialog look) ----------
 const dlg=document.createElement('dialog');dlg.id='legacyDialog';dlg.className='legacy-dialog';dlg.setAttribute('aria-labelledby','legacyTitle');
 dlg.innerHTML='<div class="legacy-art" aria-hidden="true"></div><small id="legacyKicker" class="legacy-kicker"></small><h2 id="legacyTitle"></h2><p id="legacyText"></p><div id="legacyOptions" class="legacy-options"></div>';
 document.body.append(dlg);dlg.addEventListener('cancel',e=>e.preventDefault());
 function ask({kicker,title,text,art,options},done){dlg.querySelector('.legacy-art').style.backgroundImage=`url('art/${art}')`;dlg.dataset.kind=art;$l('legacyKicker').textContent=kicker;$l('legacyTitle').textContent=title;$l('legacyText').textContent=text;
  $l('legacyOptions').innerHTML=options.map(o=>`<button type="button" data-legacy-choice="${o.id}"><strong>${o.label}</strong><small>${o.detail}</small></button>`).join('');
  $l('legacyOptions').querySelectorAll('button').forEach(b=>b.onclick=()=>{dlg.close();done(b.dataset.legacyChoice);});if(!dlg.open)dlg.showModal();}
 function $l(id){return document.getElementById(id);}
 const council=done=>ask({art:'crew-bridge-v3.webp',kicker:tr('ГЛАВА 02 · СОВЕТ ЭКИПАЖА','CHAPTER 02 · CREW COUNCIL'),title:tr('Кто возглавит экспедицию?','Who leads the expedition?'),text:tr('Moonkatty выбирает ведущего специалиста. Его работы в этой главе стоят на 1 энергию меньше, а опыт пригодится позже — выбор нельзя изменить.','Moonkatty picks a lead specialist. Their jobs in this chapter cost 1 less power, and their expertise pays off later. This choice is final.'),
  options:[{id:'navigator',label:tr('Штурман','Navigator'),detail:tr('Шире окна захвата в манёврах (гл. 3, 8) и подсказка окна в финальном шлюзе.','Wider capture windows in burns (ch. 3, 8) and a window countdown at the final gate.')},{id:'engineer',label:tr('Инженер','Engineer'),detail:tr('Шире допуск тепловых контуров (гл. 5) и усиленный ремонт при стыковке (гл. 6, 9).','Wider thermal tolerance (ch. 5) and stronger docking repairs (ch. 6, 9).')},{id:'scout',label:tr('Разведчик','Scout'),detail:tr('Дополнительный фильтр помех при расшифровке сигнала «Эхо» (гл. 8).','An extra interference filter while decoding the Echo signal (ch. 8).')}]},v=>{set('lead',v);done();});
 const airlock=done=>ask({art:'life2-crew.webp',kicker:tr('ГЛАВА 02 · АВАРИЯ ШЛЮЗА','CHAPTER 02 · AIRLOCK FAILURE'),title:tr('Шлюз грузового отсека заклинило','The cargo-bay airlock has jammed'),text:tr('За дверью техник Мира и последний контейнер с запасами. Воздуха хватит, чтобы открыть шлюз только один раз.','Behind the door are technician Mira and the last supply container. There is air to cycle the lock only once.'),
  options:[{id:'crew',label:tr('Спасти Миру','Rescue Mira'),detail:tr('Мира присоединится к экипажу: +1 энергия конвою в финале и место в эпилоге.','Mira joins the crew: +1 convoy power in the finale and a place in the epilogue.')},{id:'cargo',label:tr('Спасти запасы','Save the supplies'),detail:tr('Запасы укрепят финальный шлюз: +10 к его стабильности.','The supplies reinforce the final gate: +10 gate stability.')}]},v=>{set('airlock',v);done();});
 /** Before a chapter-2 story field stage: council first, the airlock event before the third stage. Returns true when a decision is shown. */
 function before(task,go){if(!task?.legacy||task.daily||task.chapter!==2)return false;const s=read();if(!s.lead){council(go);return true;}if(task.fieldStage>=2&&!s.airlock){airlock(go);return true;}return false;}
 function epilogue(done){const s=read(),p=precise(),lead={navigator:tr('Штурман','Navigator'),engineer:tr('Инженер','Engineer'),scout:tr('Разведчик','Scout')}[s.lead]||tr('не назначен','not assigned');
  const lines=[[tr('Ведущий специалист','Lead specialist'),lead],[tr('Техник Мира','Technician Mira'),s.airlock==='crew'?tr('вернулась домой с экипажем','came home with the crew'):s.airlock==='cargo'?tr('осталась на станции — запасы удержали шлюз','stayed behind; the supplies held the gate'):tr('судьба неизвестна','fate unknown')],[tr('Станция «Эхо»','Echo station'),s.echo==='answer'?tr('ответила и прикрыла переход','answered and shielded the crossing'):s.echo==='silent'?tr('осталась тайной','remains a mystery'):tr('не обнаружена','not contacted')],[tr('Точные операции','Precise operations'),p.count+' / '+p.total]];
  ask({art:'orbit-v2.webp',kicker:tr('ГЛАВА 09 · ЭПИЛОГ','CHAPTER 09 · EPILOGUE'),title:tr('Moonkatty вернулась домой','Moonkatty is home'),text:tr('Шлюз закрылся за последним кораблём. Вот как ваши решения изменили путь домой:','The gate closed behind the last ship. This is how your decisions shaped the way home:'),options:[{id:'done',label:tr('ЗАВЕРШИТЬ ПУТЕШЕСТВИЕ','COMPLETE THE JOURNEY'),detail:''}]},()=>done());
  const list=document.createElement('dl');list.className='legacy-epilogue';list.innerHTML=lines.map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');$l('legacyOptions').before(list);dlg.addEventListener('close',()=>list.remove(),{once:true});}
 return {read,set,mods,before,epilogue,precise,council,airlock};
})();
