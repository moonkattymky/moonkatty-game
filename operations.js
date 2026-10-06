/* Chapters 4–9: three distinct, persistent engineering operations before the live mission. */
window.MKTYOps=(()=>{
 'use strict';
 const R=MissionRules,Art=OperationsArt,cache=new Map(),originals={},glyphs=['▲','●','◆','■','✚','⬡'];
 const assets={4:'life4-landing.webp',5:'life5-reactor-v2.webp',6:'life6-launchpad.webp',7:'life7-void.webp',8:'life1-base.webp',9:'orbit-v2.webp'};
 const names={4:['КАРТА СПУСКА','DESCENT SURVEY'],5:['ЭНЕРГОСЕТЬ','POWER GRID'],6:['БАЛАНС КОРАБЛЯ','SHIP BALANCE'],7:['ЗАЩИТНЫЙ КОНТУР','SHIELD ARRAY'],8:['НЕИЗВЕСТНЫЙ СИГНАЛ','UNKNOWN SIGNAL'],9:['ВОЗВРАЩЕНИЕ ЭКИПАЖА','CREW RECOVERY']};
 const stages={4:[['Разведка плато','Plateau survey'],['Поле разломов','Fracture field'],['Посадочный коридор','Landing corridor']],5:[['Питание насосов','Pump supply'],['Контур охлаждения','Cooling circuit'],['Магистраль реактора','Reactor mainline']],6:[['Грузовой отсек','Cargo bay'],['Топливные баки','Fuel tanks'],['Орбитальный модуль','Orbital module']],7:[['Помехи радара','Radar interference'],['Резервный экран','Reserve screen'],['Защита экипажа','Crew protection']],8:[['Позывной','Call sign'],['Ключ ретранслятора','Relay key'],['Адрес источника','Source address']],9:[['Аварийное питание','Emergency power'],['Жизнеобеспечение','Life support'],['Подготовка шлюза','Gate preparation']]};
 const copy={route:['Проложи путь от S до E через все три маяка. Нажимай соседние клетки: обычная стоит 1 топливо, оранжевая — 3. Скалы непроходимы. Предыдущая клетка отменяет ход.','Plot a route from S to E through all three beacons. Tap adjacent cells: normal terrain costs 1 fuel, amber costs 3. Rocks block passage. Tap the previous cell to undo.'],pipes:['Поворачивай сегменты. Соедини вход IN с выходом OUT через все три узла. Голубая линия показывает, куда уже доходит питание.','Rotate segments. Connect IN to OUT through all three nodes. The cyan line shows where power currently reaches.'],cargo:['Поменяй местами два модуля нажатием. Суммы масс во ВСЕХ рядах и столбцах должны совпасть с целями по краям. Подходит любое верное распределение.','Tap two modules to swap them. Mass totals in ALL rows and columns must match the edge targets. Any valid arrangement works.'],shield:['Восстанови все узлы: они должны стать голубыми. Нажатие переключает выбранный узел и его соседей по вертикали и горизонтали.','Restore every node to cyan. A tap toggles that node and its vertical and horizontal neighbors.'],cipher:['Выведи ключ по ответам станции. Символы не повторяются. ● — верный символ на своём месте; ◇ — верный символ на другом месте. Эти числа не указывают конкретные позиции.','Deduce the key from station feedback. Symbols never repeat. ● counts correct positions; ◇ counts correct symbols in other positions. These counts do not identify particular slots.'],systems:['Запусти все системы в подходящем порядке. Карточки расходуют ресурсы и возвращают указанный результат. Запас каждого ресурса ограничен 8. Неудачный порядок можно отменить.','Start every system in a viable order. Cards spend resources and return the shown output. Each resource is capped at 8. Undo a choice if the sequence gets stuck.']};
 const tr=(ru,en)=>window.MKTYI18n?window.MKTYI18n.tr(ru,en):(localStorage.getItem('mkty_lang')==='ru'?ru:en),pair=a=>tr(...a),key=n=>'mkty_operations_'+n+'_v1';
 let s=null,b=null,highlight=[],message='',paused=false,assignment=null;
 const root=document.createElement('section');root.id='operationsDeck';root.className='screen ops-screen';root.setAttribute('translate','no');root.innerHTML=`
  <header class="ops-header"><div><small id="opsEyebrow"></small><h2 id="opsTitle"></h2></div><button id="opsMenu" type="button">☰</button></header>
  <div class="ops-hero"><div><span id="opsStage"></span><strong id="opsStageTitle"></strong><small id="opsJourney"></small></div><b id="opsNumber" aria-hidden="true"></b><div id="opsProgress" class="ops-progress" aria-hidden="true"><i></i><i></i><i></i></div></div>
  <div class="ops-content"><div class="ops-brief"><p id="opsInstructions"></p><div id="opsMetrics" class="ops-metrics"></div></div>
  <div class="ops-instrument"><div class="ops-instrument-head"><span id="opsInstrumentLabel"></span><span id="opsInstrumentState"></span></div><div id="opsScope" hidden></div><div id="opsBoard" class="ops-board" dir="ltr"></div><div class="ops-instrument-foot" aria-hidden="true"><i></i><i></i><i></i><i></i></div></div><div id="opsExtras"></div>
  </div>
  <footer class="ops-footer"><p id="opsStatus" role="status" aria-live="polite"></p><div><button id="opsUndo" type="button"></button><button id="opsReset" type="button"></button><button id="opsHint" type="button"></button></div><button id="opsSubmit" class="primary" type="button"></button></footer>
  <dialog id="opsPause"><h3 id="opsPauseTitle"></h3><p id="opsPauseText"></p><button id="opsResume" class="primary" type="button"></button><button id="opsExit" class="ghost" type="button"></button></dialog>`;
 $('app').append(root);
 const active=()=>root.classList.contains('active');
 function fresh(n){return {version:1,n,seed:Math.floor(Math.random()*0xffffffff),round:0,phase:'planning',input:null,confirmed:false,actions:0,hints:0,errors:0,seconds:0};}
 function read(n){
  try{const raw=localStorage.getItem(key(n));if(cache.has(n)&&JSON.stringify(cache.get(n))===raw)return cache.get(n);const v=JSON.parse(raw||'null');
   if(!v||v.version!==1||v.n!==n||!Number.isInteger(v.seed)||v.seed<0||v.seed>0xffffffff||!Number.isInteger(v.round)||v.round<0||v.round>3||!['planning','core','complete'].includes(v.phase)||typeof v.confirmed!=='boolean')return null;
   if(['actions','hints','errors','seconds'].some(k=>!Number.isFinite(v[k])||v[k]<0||v[k]>1e8))return null;
   if(v.phase==='planning'){if(v.round===3)return null;const board=R.board(n,v.round,v.seed);if(!R.validate(board,v.input)||v.confirmed&&!R.solved(board,v.input))return null;}
   else if(v.round!==3)return null;
   cache.set(n,v);return v;
  }catch{return null;}
 }
 function save(){if(!s)return;if(assignment){assignment.save(structuredClone(s));return;}cache.set(s.n,s);try{localStorage.setItem(key(s.n),JSON.stringify(s));}catch{}}
 function isRun(n){return read(n)?.phase==='core';}
 function pending(n){const v=read(n);return !!v&&v.phase!=='complete';}
 function initBoard(){b=R.board(s.n,s.round,s.seed);s.input=R.initial(b);s.confirmed=false;highlight=[];message='';save();}
 function open(n){
  root.removeAttribute('data-story-task');if(assignment)closeTask();
  if(localStorage.getItem('mkty_life'+(n-1))!=='complete'){show('chapters');return;}
  s=read(n)||fresh(n);cache.set(n,s);renderReplay(n);
  if(s.phase==='core'||s.phase==='complete'){originals[n]();return;}
  b=R.board(n,s.round,s.seed);if(!s.input)initBoard();highlight=[];message='';paused=false;
  localStorage.setItem('mkty_current_chapter',String(n));show('operationsDeck');root.style.setProperty('--ops-art',`url('art/${assets[n]}')`);root.dataset.operationChapter=n;render();save();
 }
 function closeTask(){save();if($('opsPause').open)$('opsPause').close();assignment=null;s=null;b=null;paused=false;}
 function openTask(task,saved){
  if(assignment)closeTask();root.dataset.storyTask=String(task.id);assignment=task;s={...fresh(task.board),seed:task.seed,round:task.round};
  if(saved&&saved.phase==='planning'&&saved.n===task.board&&saved.round===task.round&&Number.isInteger(saved.seed)&&saved.seed>=0&&saved.seed<=0xffffffff&&['actions','hints','errors','seconds'].every(k=>Number.isFinite(saved[k])&&saved[k]>=0)&&typeof saved.confirmed==='boolean'){const candidate=R.board(task.board,task.round,saved.seed);if(R.validate(candidate,saved.input)&&(!saved.confirmed||R.solved(candidate,saved.input)))s=structuredClone(saved);}
  b=R.board(s.n,s.round,s.seed);if(!s.input)s.input=R.initial(b);paused=false;highlight=[];message='';localStorage.setItem('mkty_current_chapter',String(task.chapter));show('operationsDeck');root.style.setProperty('--ops-art',`url('art/${task.art}')`);root.dataset.operationChapter=task.chapter;render();save();
 }
 function restart(n){
  // Leave and save the live simulation BEFORE removing only this chapter's replay checkpoint.
  show('chapters');const old=read(n);if(old?.phase==='complete')try{localStorage.setItem('mkty_operations_report_'+n,JSON.stringify(old));}catch{}
  for(const k of ['mkty_campaign_checkpoint_'+n,...(n===5?['mkty_reactor5_checkpoint_v2']:n===6?['mkty_liftoff6_checkpoint_v1']:[])])localStorage.removeItem(k);
  s=fresh(n);cache.set(n,s);initBoard();open(n);
 }
 function complete(n){const run=read(n);if(run?.phase!=='core')return;run.phase='complete';cache.set(n,run);try{localStorage.setItem(key(n),JSON.stringify(run));}catch{}renderReplay(n);}
 function renderReplay(n){const card=$('life'+n+'Complete');if(!card)return;let button=card.querySelector('.ops-replay');if(!button){button=document.createElement('button');button.type='button';const back=$('life'+n+'ReturnBtn'),actions=document.createElement('div');actions.className='ops-result-actions';button.className=(back?.className||'ghost')+' ops-replay';button.setAttribute('translate','no');button.onclick=()=>restart(n);if(back)actions.append(back);actions.append(button);card.append(actions);}button.textContent=tr('ЕЩЁ РАЗ','REPLAY');button.title=tr('Новый набор задач. Заработанные очки сохраняются.','New challenges. Earned points are preserved.');}
 function button(index,label,cls=''){const el=document.createElement('button');el.type='button';el.className='ops-tile '+cls;el.dataset.opCell=index;el.innerHTML=label;el.disabled=s.confirmed;el.classList.toggle('hinted',highlight.includes(index));el.onclick=()=>act(index);return el;}
 function metric(label,value,good=false){const e=document.createElement('span');e.className=good?'ok':'';e.innerHTML='<small>'+label+'</small><b>'+value+'</b>';return e;}
 function render(){
  if(!s||!b||!active())return;const p=s.input,board=$('opsBoard'),metrics=$('opsMetrics'),extras=$('opsExtras'),focused=document.activeElement?.dataset?.opCell;
  root.dataset.kind=b.type;root.dataset.solved=String(s.confirmed);
  $('opsEyebrow').textContent=tr('ГЛАВА ','CHAPTER ')+s.n+' / 09';$('opsTitle').textContent=pair(names[s.n]);$('opsMenu').setAttribute('aria-label',tr('Пауза и меню','Pause and menu'));
  $('opsStage').textContent=tr('ОПЕРАЦИЯ ','OPERATION ')+(s.round+1)+' / 3';$('opsStageTitle').textContent=pair(stages[s.n][s.round]);$('opsNumber').textContent=String(s.round+1).padStart(2,'0');
  $('opsJourney').textContent=tr('БОРТОВОЙ КОМПЛЕКС / MKTY','ONBOARD SYSTEMS / MKTY');$('opsProgress').querySelectorAll('i').forEach((e,i)=>{e.className=i<s.round?'done':i===s.round?'current':'';});$('opsInstructions').textContent=pair(copy[b.type]);
  $('opsInstrumentLabel').textContent=({route:'TERRAIN / NAV',pipes:'POWER / BUS',cargo:'PAYLOAD / TRIM',shield:'DEFENCE / ARRAY',cipher:'COMMS / DECODE',systems:'RECOVERY / CONTROL'})[b.type];$('opsInstrumentState').textContent=s.confirmed?tr('ПОДТВЕРЖДЕНО','CONFIRMED'):tr('РУЧНОЙ РЕЖИМ','MANUAL CONTROL');$('opsScope').hidden=b.type!=='cipher';$('opsScope').innerHTML=b.type==='cipher'?Art.oscilloscope(p.history.length):'';
  board.replaceChildren();metrics.replaceChildren();extras.replaceChildren();board.style.setProperty('--cols',b.n||b.cols||b.size);board.className='ops-board ops-'+b.type;
  if(b.type==='route'){
   const used=R.routeCost(b,p);metrics.append(metric(tr('ТОПЛИВО','FUEL'),(b.budget-used)+' / '+b.budget),metric(tr('МАЯКИ','BEACONS'),b.beacons.filter(i=>p.path.includes(i)).length+' / 3'));
   for(let i=0;i<b.n*b.n;i++){const rock=b.rocks.includes(i),beacon=b.beacons.indexOf(i),at=p.path.at(-1)===i,visited=p.path.includes(i),label=i===0?'S':i===b.n*b.n-1?'E':rock?'▰':beacon>=0?'◈'+(beacon+1):b.cost[i]===3?'3':'·';
    const e=button(i,Art.routeCell({i,n:b.n,rock,beacon,cost:b.cost[i],current:at}),`${rock?'rock ':''}${b.cost[i]===3?'rough ':''}${visited?'visited ':''}${beacon>=0?'ops-beacon ':''}${at?'current':''}`);e.disabled=s.confirmed||rock;e.setAttribute('aria-label',tr('Клетка ','Cell ')+(i+1)+', '+(rock?tr('скала','rock'):label+', '+tr('расход ','cost ')+b.cost[i]));board.append(e);}
  }else if(b.type==='pipes'){
   const trace=R.pipeTrace(b,p);metrics.append(metric(tr('УЗЛЫ','NODES'),b.beacons.filter(i=>trace.path.includes(i)).length+' / 3'),metric(tr('ВЫХОД','OUTPUT'),trace.success?'ONLINE':'—',trace.success));
   b.ports.forEach((ports,i)=>{const ends=ports.map(d=>(d+p.turns[i])%4),beacon=b.beacons.indexOf(i),e=button(i,Art.pipeCell(ends,i,beacon,b.n*b.n-1),trace.path.includes(i)?'powered':'');e.dataset.ports=ends.join(',');e.setAttribute('aria-label',tr('Сегмент ','Segment ')+(i+1)+', '+ends.join('/'));board.append(e);});
  }else if(b.type==='cargo'){
   board.style.setProperty('--cols',b.cols+1);let matches=0;
   for(let r=0;r<b.rows;r++){for(let c=0;c<b.cols;c++){const i=r*b.cols+c,e=button(i,Art.cargoCell(String.fromCharCode(65+r)+(c+1),p.tiles[i]),p.selected===i?'selected':'');e.setAttribute('aria-label',`${String.fromCharCode(65+r)}${c+1}: ${p.tiles[i]}`);board.append(e);}
    const sum=p.tiles.slice(r*b.cols,r*b.cols+b.cols).reduce((a,b)=>a+b,0),e=document.createElement('div');e.className='ops-sum '+(sum===b.row[r]?'ok':'');e.textContent=sum+' / '+b.row[r];board.append(e);matches+=Number(sum===b.row[r]);}
   for(let c=0;c<b.cols;c++){const sum=p.tiles.filter((_,i)=>i%b.cols===c).reduce((a,b)=>a+b,0),e=document.createElement('div');e.className='ops-sum '+(sum===b.col[c]?'ok':'');e.textContent=sum+' / '+b.col[c];board.append(e);matches+=Number(sum===b.col[c]);}metrics.append(metric(tr('СОВПАДЕНИЯ','MATCHES'),matches+' / '+(b.rows+b.cols)));
  }else if(b.type==='shield'){
   metrics.append(metric(tr('УЗЛЫ ОНЛАЙН','NODES ONLINE'),p.lamps.filter(v=>!v).length+' / '+p.lamps.length),metric(tr('ХОДЫ','MOVES'),p.history.length));
   p.lamps.forEach((v,i)=>{const e=button(i,Art.shieldCell(i,v),v?'jammed':'powered');e.setAttribute('aria-label',tr('Узел ','Node ')+(i+1)+': '+(v?tr('помехи','jammed'):tr('включён','online')));board.append(e);});
  }else if(b.type==='cipher'){
   metrics.append(metric(tr('ПОПЫТКИ','ATTEMPTS'),p.history.length+' / '+b.limit));
   p.guess.forEach((v,i)=>{const e=button(i,`<small class="oa-channel">CH / 0${i+1}</small>${Art.symbol(v===null?-1:v)}`,p.slot===i?'selected':'');e.setAttribute('aria-label',tr('Позиция ','Slot ')+(i+1));board.append(e);});
   const keys=document.createElement('div');keys.className='ops-keys';glyphs.forEach((g,i)=>{const e=document.createElement('button');e.type='button';e.innerHTML=Art.symbol(i)+'<small>0'+(i+1)+'</small>';e.setAttribute('aria-label',g);e.dataset.opGlyph=i;e.disabled=s.confirmed||p.history.length>=b.limit;e.onclick=()=>{p.guess[p.slot]=i;p.slot=(p.slot+1)%b.size;changed();};keys.append(e);});extras.append(keys);
   if(p.revealed.length){const note=document.createElement('p');note.className='ops-keyhint';note.textContent=tr('Подсказка: ','Hint: ')+p.revealed.map(i=>(i+1)+' = '+glyphs[b.secret[i]]).join(' · ');extras.append(note);}
   const history=document.createElement('ol');history.className='ops-history';p.history.forEach((g,i)=>{const f=R.feedback(g,b.secret),row=document.createElement('li');row.dataset.exact=f.exact;row.dataset.near=f.near;row.innerHTML=`<small>${i+1}</small><span>${g.map(v=>glyphs[v]).join(' ')}</span><b>● ${f.exact}　◇ ${f.near}</b>`;history.append(row);});extras.append(history);
   if(p.history.length>=b.limit&&!R.solved(b,p))message=tr('Лимит исчерпан. Начни новый ключ: остальные операции сохранятся.','Attempts used. Start a new key; earlier operations are preserved.');
  }else{
   const stock=R.stock(b,p),resourceNames=tr('ЭНЕРГИЯ,ХЛАДАГЕНТ,ПЛАЗМА','ENERGY,COOLANT,PLASMA').split(',');stock.forEach((v,i)=>metrics.append(metric(resourceNames[i],v+' / 8')));
   const taskNames=tr('НАСОС,ФИЛЬТР,ТУРБИНА,НАВИГАЦИЯ,ГЕРМЕТИЗАЦИЯ,ШЛЮЗ,РЕЗЕРВ,ОБМЕННИК','PUMP,FILTER,TURBINE,NAVIGATION,SEAL,GATE,RESERVE,EXCHANGER').split(',');
   b.tasks.forEach(t=>{const done=p.order.includes(t.id),can=R.canTask(b,p,t),e=button(t.id,`<div class="oa-system-heading">${Art.systemIcon(t.id)}<strong>${taskNames[t.id]}</strong><i class="oa-system-led"></i></div><span>${tr('РАСХОД','COST')} <b>${t.cost.join(' · ')}</b></span><span>${tr('ВОЗВРАТ','RETURN')} <b>${t.gain.join(' · ')}</b></span>`,done?'powered':can?'available':'unavailable');e.disabled=s.confirmed||done;e.setAttribute('aria-label',taskNames[t.id]+', '+(done?tr('готово','done'):can?tr('доступно','available'):tr('недостаточно ресурсов','insufficient resources')));board.append(e);});
   const legend=document.createElement('p');legend.className='ops-keyhint';legend.textContent=resourceNames.join(' · ')+' — '+tr('порядок чисел на карточках','number order on cards');extras.append(legend);
   if(!R.solved(b,p)&&!b.tasks.some(t=>R.canTask(b,p,t)))message=tr('Ресурсов не хватает для продолжения. Отмени последний запуск и выбери другой порядок.','No system can start. Undo the last launch and try a different order.');
  }
  Art.decorate(board,b,p);
  $('opsStatus').textContent=s.confirmed?tr('Операция выполнена. Контрольная точка сохранена.','Operation complete. Checkpoint saved.'):message||tr('Реши задачу и подтверди результат.','Solve the operation, then confirm the result.');
  $('opsUndo').textContent=tr('↶ Отмена','↶ Undo');$('opsReset').textContent=tr('Сброс','Reset');$('opsHint').textContent=tr('Подсказка','Hint');
  $('opsUndo').hidden=!['route','shield','systems'].includes(b.type);$('opsUndo').disabled=s.confirmed;$('opsReset').disabled=s.confirmed;$('opsHint').disabled=s.confirmed;
  $('opsSubmit').textContent=s.confirmed?(s.round===2?tr('ПЕРЕЙТИ К МИССИИ →','START LIVE MISSION →'):tr('СЛЕДУЮЩАЯ ОПЕРАЦИЯ →','NEXT OPERATION →')):b.type==='cipher'?tr('ПРОВЕРИТЬ КЛЮЧ','CHECK KEY'):tr('ПОДТВЕРДИТЬ РЕШЕНИЕ','CONFIRM SOLUTION');
  if(assignment){$('opsEyebrow').textContent=tr('ГЛАВА ','CHAPTER ')+assignment.chapter+' / 09';$('opsTitle').textContent=pair(assignment.title);$('opsStage').textContent=tr('ЭТАП ','STAGE ')+(assignment.id+1)+' / 8';$('opsStageTitle').textContent=tr('БОРТОВАЯ ОПЕРАЦИЯ','ONBOARD OPERATION');$('opsJourney').textContent=tr('ПРОГРЕСС СОХРАНЯЕТСЯ ПОСЛЕ КАЖДОГО ХОДА','EVERY MOVE IS SAVED');$('opsNumber').textContent=String(assignment.id+1).padStart(2,'0');if(s.confirmed)$('opsSubmit').textContent=tr('ЗАВЕРШИТЬ ЭТАП →','COMPLETE STAGE →');}
  if(focused!==undefined)board.querySelector(`[data-op-cell="${focused}"]`)?.focus({preventScroll:true});
 }
 function changed(count=true){if(count)s.actions++;highlight=[];message='';save();render();}
 function reject(ru,en){s.errors++;message=tr(ru,en);save();render();}
 function act(i){
  if(!active()||paused||s.confirmed)return;const p=s.input;
  if(b.type==='route'){if(i===p.path.at(-2)){p.path.pop();changed();return;}if(!R.adjacent(p.path.at(-1),i,b.n)||p.path.includes(i)||b.rocks.includes(i)){reject('Выбери свободную соседнюю клетку.','Choose an unvisited adjacent cell.');return;}if(R.routeCost(b,p)+b.cost[i]>b.budget){reject('Недостаточно топлива. Измени маршрут.','Not enough fuel. Rework the route.');return;}p.path.push(i);}
  else if(b.type==='pipes')p.turns[i]=(p.turns[i]+1)%4;
  else if(b.type==='cargo'){if(p.selected===null)p.selected=i;else{[p.tiles[i],p.tiles[p.selected]]=[p.tiles[p.selected],p.tiles[i]];p.selected=null;}}
  else if(b.type==='shield'){if(p.history.length>=2000){message=tr('Сбрось контур для новой попытки.','Reset the array for a new attempt.');render();return;}R.toggle(p.lamps,i,b.n);p.history.push(i);}
  else if(b.type==='cipher')p.slot=i;
  else{const t=b.tasks.find(t=>t.id===i);if(!R.canTask(b,p,t)){reject('Для этой системы пока недостаточно ресурсов.','This system needs more resources.');return;}p.order.push(i);}
  changed();
 }
 function submit(){
  if(!active()||paused)return;
  if(s.confirmed&&assignment){const task=assignment,record=structuredClone(s);closeTask();task.complete(record);return;}
  if(s.confirmed){s.round++;s.confirmed=false;if(s.round===3){s.phase='core';s.input=null;save();originals[s.n]();return;}initBoard();render();$('opsSubmit').focus({preventScroll:true});return;}
  if(b.type==='cipher'){
   const p=s.input;if(p.history.length>=b.limit)return;
   if(p.guess.some(v=>v===null)||new Set(p.guess).size!==b.size){reject('Заполни все позиции разными символами.','Fill every slot with a different symbol.');return;}
   p.history.push(p.guess.slice());s.actions++;
   const f=R.feedback(p.guess,b.secret);message=tr('На своих местах: ','Correct positions: ')+f.exact+tr('. На других местах: ','. Other positions: ')+f.near+'.';
   if(f.exact!==b.size){save();render();$('opsExtras').querySelector('.ops-history')?.lastElementChild?.scrollIntoView({block:'nearest'});return;}
  }
  if(!R.solved(b,s.input)){reject('Задача ещё не решена. Проверь цели и ограничения.','Not solved yet. Check the goals and constraints.');return;}
  s.confirmed=true;save();render();tg?.HapticFeedback?.notificationOccurred?.('success');
 }
 function undo(){if(paused||s.confirmed)return;const p=s.input;if(b.type==='route'&&p.path.length>1)p.path.pop();else if(b.type==='shield'&&p.history.length)R.toggle(p.lamps,p.history.pop(),b.n);else if(b.type==='systems')p.order.pop();changed();}
 function reset(){if(paused||s.confirmed)return;s.errors++;if(b.type==='cipher'){s.seed=(s.seed+7919)>>>0;b=R.board(s.n,s.round,s.seed);}s.input=R.initial(b);changed();}
 function hint(){
  if(paused||s.confirmed)return;s.hints++;highlight=[];const p=s.input;
  if(b.type==='route'){if(p.path.every((v,i)=>v===b.path[i]))highlight=[b.path[p.path.length]];else message=tr('Отмени ответвление или сбрось маршрут: для подсказки нужен путь от начала карты.','Undo the detour or reset the route to follow a hint from the map entrance.');}
  if(b.type==='pipes')highlight=[b.path.find(i=>p.turns[i]% (b.ports[i].every((v,j,a)=>j===0||Math.abs(v-a[0])===2)?2:4)!==0)].filter(v=>v!==undefined);
  if(b.type==='cargo'){const i=p.tiles.findIndex((v,i)=>v!==b.target[i]);if(i>=0)highlight=[i,p.tiles.indexOf(b.target[i])];}
  if(b.type==='shield')highlight=(R.solveShield(b,p)||[]).slice(0,1);
  if(b.type==='cipher'){const i=Array.from({length:b.size},(_,i)=>i).find(i=>!p.revealed.includes(i));if(i!==undefined)p.revealed.push(i);}
  if(b.type==='systems'){const path=R.solveSystems(b,p);if(path)highlight=path.slice(0,1);else message=tr('Этот порядок зашёл в тупик. Отмени последний запуск.','This order leads to a dead end. Undo the last launch.');}
  if(highlight.length)message=b.type==='cargo'?tr('Поменяй местами два выделенных модуля.','Swap the two highlighted modules.'):b.type==='pipes'?tr('Поверни выделенный сегмент, чтобы продолжить магистраль.','Rotate the highlighted segment to extend the mainline.'):tr('Следующий полезный ход выделен золотым.','A useful next move is highlighted in gold.');save();render();
 }
 function pause(){if(!active()||paused)return;paused=true;save();$('opsPauseTitle').textContent=tr('ОПЕРАЦИЯ ПРИОСТАНОВЛЕНА','OPERATION PAUSED');$('opsPauseText').textContent=tr('Каждый ход сохранён. Можно продолжить с этого места.','Every move is saved. Resume from this exact position.');$('opsResume').textContent=tr('ПРОДОЛЖИТЬ','RESUME');$('opsExit').textContent=assignment?tr('К ПЛАНУ ГЛАВЫ','CHAPTER PLAN'):tr('К ВЫБОРУ ГЛАВ','CHAPTERS');$('opsPause').showModal();$('opsResume').focus();}
 function resume(){if($('opsPause').open)$('opsPause').close();paused=false;}
 $('opsSubmit').onclick=submit;$('opsUndo').onclick=undo;$('opsReset').onclick=reset;$('opsHint').onclick=hint;$('opsMenu').onclick=pause;$('opsResume').onclick=resume;$('opsExit').onclick=()=>{if(assignment){const task=assignment;closeTask();task.exit();return;}resume();save();show('chapters');};$('opsPause').addEventListener('cancel',e=>{e.preventDefault();resume();});
 window.addEventListener('pagehide',save);document.addEventListener('visibilitychange',()=>{if(document.hidden&&active())pause();});window.addEventListener('blur',()=>{if(active())pause();});
 setInterval(()=>{if(active()&&!paused&&!document.hidden&&s?.phase==='planning'){s.seconds++;save();}},1000);
 for(let n=4;n<=9;n++){originals[n]=window['openMission'+n];window['openMission'+n]=()=>open(n);renderReplay(n);}
 queueMicrotask(()=>window.MKTYCampaign?.render());
 return {open,isRun,pending,complete,restart,openTask};
})();
