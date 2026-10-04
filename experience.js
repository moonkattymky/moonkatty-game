/* Shared presentation: active-scene effects, pausable guides and optional control sounds. */
window.MKTYExperience=(()=>{
 const media=matchMedia('(prefers-reduced-motion: reduce)');
 let paused=false,current=0,frameId=0,last=0,time=0,paintAt=0,focusBefore=null;
 let light=localStorage.getItem('mkty_light_fx')==='yes',sound=localStorage.getItem('mkty_control_sound')==='yes';
 let audio=null,lastTone=0,cost=0;
 const scenes=[],bursts=[];
 const guide=document.createElement('dialog');guide.id='chapterGuide';guide.setAttribute('aria-labelledby','guideTitle');
 guide.innerHTML='<span class="eyebrow">MOONKATTY · FLIGHT MANUAL</span><h2 id="guideTitle"></h2><p class="guide-note">Game paused. Your checkpoint is preserved.</p><ol id="guideSteps"></ol><div class="experience-options"></div><div class="guide-actions"><button id="guideResume" class="primary">CONTINUE</button><button id="guideMissions" class="ghost">MISSIONS</button></div>';
 $('app').append(guide);
 const guides=[[],
  ['Explore with the joystick. Use SCAN, then approach each crystal before collecting it.','Approach the terminal, watch the A/B/C sequence and repeat it.','Reach the antenna and hold a strong signal. Remember the ten-digit code at the end.'],
  ['Navigator: hold the arrows to pass all three gates.','Engineer: rotate the pipes. Join the left inlet to the right outlet, then test the circuit.','Scout: tag the moving star three times. Then repeat the five-letter crew sequence.'],
  ['Enter the code from the first chapter. A wrong code costs one life and starts a one-hour wait.','Repeat the four symbols. Adjust the mixture until all indicators are green and total load is 100.','Read the NAV/CORE/COMMS order, then activate the systems before the timer runs out.'],
  ['Hold ▲ to brake or rise, ▼ to descend. Set engine power with the slider.','Use ◀ and ▶ to centre the ship over the landing pad.','Touch down at 14 m/s or less with drift inside ±42. Begin braking before final approach.']
 ];
 const titles=['','THE AWAKENING','THE CREW','THE LAUNCH CODE','THE DESCENT'];
 function updateOptions(){
  document.documentElement.dataset.lightFx=String(light||media.matches);
  document.querySelectorAll('[data-control-sound]').forEach(b=>{b.textContent=sound?'CONTROL SOUND: ON':'CONTROL SOUND: OFF';b.setAttribute('aria-pressed',String(sound));});
  document.querySelectorAll('[data-light-effects]').forEach(b=>{b.textContent=light?'EFFECTS: LIGHT':'EFFECTS: AUTO';b.setAttribute('aria-pressed',String(light));});
  syncVideos();
 }
 function makeOptions(root){
  const soundButton=document.createElement('button'),fx=document.createElement('button');soundButton.type=fx.type='button';soundButton.dataset.controlSound='';fx.dataset.lightEffects='';
  soundButton.onclick=()=>{sound=!sound;localStorage.setItem('mkty_control_sound',sound?'yes':'no');if(sound){try{const Audio=window.AudioContext||window.webkitAudioContext;if(Audio){audio??=new Audio();audio.resume().then(()=>tone('success')).catch(()=>{});}}catch{sound=false;}}updateOptions();};
  fx.onclick=()=>{light=!light;localStorage.setItem('mkty_light_fx',light?'yes':'no');updateOptions();};root.append(soundButton,fx);
 }
 makeOptions(guide.querySelector('.experience-options'));
 const options5=document.createElement('div');options5.className='experience-options';$('reactorOverlay5').querySelector('.reactor-dialog-actions5').before(options5);makeOptions(options5);updateOptions();media.addEventListener('change',updateOptions);
 // Instructions scroll independently so RESUME is always reachable on a phone.
 for(const [dialog,actions,cls] of [[guide,guide.querySelector('.guide-actions'),'guide-copy'],[$('reactorOverlay5').querySelector('.reactor-dialog5'),$('reactorOverlay5').querySelector('.reactor-dialog-actions5'),'reactor-guide-copy5']]){
  const copy=document.createElement('div');copy.className=cls;for(const node of [...dialog.childNodes])if(node!==actions)copy.append(node);dialog.prepend(copy);
 }
 const flightReview=document.createElement('dialog');flightReview.id='flightReview';flightReview.setAttribute('aria-labelledby','flightReviewTitle');
 flightReview.innerHTML='<div class="flight-review-copy"><span class="eyebrow">FLIGHT REVIEW</span><h2 id="flightReviewTitle"></h2><p id="flightReviewReason"></p><div id="flightReviewMetrics"></div><p id="flightReviewHint"></p></div><div class="guide-actions"><button id="flightRetry" class="primary">TRY AGAIN</button><button id="flightMissions" class="ghost">MISSIONS</button></div>';$('app').append(flightReview);
 let retryFlight=null;
 function closeFlightReview(){if(flightReview.open)flightReview.close();retryFlight=null;paused=false;document.body.classList.remove('experience-paused');}
 $('flightRetry').onclick=()=>{const retry=retryFlight;closeFlightReview();retry?.();};$('flightMissions').onclick=()=>{closeFlightReview();show('chapters');};flightReview.addEventListener('cancel',e=>e.preventDefault());
 function flightFailed(chapter,data,retry){
  if(current!==chapter)return;
  paused=true;nav2Control=0;releaseDescentControls();document.body.classList.add('experience-paused');MKTYCampaign.save();retryFlight=retry;
  $('flightReviewTitle').textContent=chapter===2?'CORRIDOR MISSED':'LANDING ABORTED';
  $('flightReviewReason').textContent=chapter===2?'Pass through each highlighted gate in order.':data.velocity>14&&Math.abs(data.drift)>42?'Speed and alignment were outside the safe limits.':data.velocity>14?'Touchdown speed was too high.':'The ship landed outside the safe zone.';
  $('flightReviewHint').textContent=chapter===2?'Hold ▲ or ▼ to align with the next gate. Release when the course indicator turns green.':data.velocity>14?'Begin braking when BRAKE NOW appears. Hold ▲; use the power slider to adjust thrust.':'Use ◀ or ▶ to centre the ship. Keep the marker inside the green alignment zone.';
  const metrics=chapter===2?[['GATES PASSED',data.cleared+' / 3'],['MISSED GATE',String(data.gate).padStart(2,'0')]]:[['TOUCHDOWN SPEED',data.velocity.toFixed(1)+' m/s'],['HORIZONTAL DRIFT',(data.drift>0?'+':'')+Math.round(data.drift)]];
  $('flightReviewMetrics').replaceChildren(...metrics.map(([label,value])=>{const card=document.createElement('div'),small=document.createElement('span'),b=document.createElement('b');small.textContent=label;b.textContent=value;b.setAttribute('translate','no');card.append(small,b);return card;}));
  signal('error');flightReview.showModal();$('flightRetry').focus({preventScroll:true});
 }
 function prepareAudio(){if(!sound)return;try{const Audio=window.AudioContext||window.webkitAudioContext;if(Audio){audio??=new Audio();if(audio.state==='suspended')audio.resume().catch(()=>{});}}catch{}}
 document.addEventListener('pointerdown',prepareAudio,{passive:true});document.addEventListener('keydown',prepareAudio);
 function tone(kind){
  if(!sound||!audio||audio.state!=='running'||performance.now()-lastTone<65)return;lastTone=performance.now();
  const notes=kind==='complete'?[523,659,784]:kind==='error'||kind==='miss'?[180]:kind==='success'||kind==='gate'?[523,784]:[kind==='collect'?880:440];
  notes.forEach((frequency,i)=>{const o=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime+i*.07;o.type='sine';o.frequency.setValueAtTime(frequency,t);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.035,t+.012);g.gain.exponentialRampToValueAtTime(.001,t+.17);o.connect(g);g.connect(audio.destination);o.start(t);o.stop(t+.2);o.onended=()=>{o.disconnect();g.disconnect();};});
 }
 function openGuide(){
  if(current<1||current>4||guide.open||flightReview.open)return;
  if(current===1)memoryCodeTick?.();
  paused=true;MKTYCampaign.save();stopLife1Stick(null);nav2Control=0;releaseDescentControls();document.body.classList.add('experience-paused');focusBefore=document.activeElement;
  $('guideTitle').textContent=titles[current];$('guideSteps').replaceChildren(...guides[current].map((text,i)=>{const li=document.createElement('li'),b=document.createElement('b'),p=document.createElement('p');b.textContent=String(i+1).padStart(2,'0');p.textContent=text;li.append(b,p);return li;}));
  guide.querySelector('.guide-copy').scrollTop=0;guide.showModal();$('guideResume').focus({preventScroll:true});
 }
 function resume(){if(guide.open)guide.close();if(current===1)memoryCodeTick?.(true);paused=false;document.body.classList.remove('experience-paused');last=performance.now();if(focusBefore?.isConnected)focusBefore.focus({preventScroll:true});}
 $('guideResume').onclick=resume;$('guideMissions').onclick=()=>{resume();show('chapters');};guide.addEventListener('cancel',e=>{e.preventDefault();resume();});
 for(let n=1;n<=4;n++){
  const button=$('mission'+n).querySelector('.chapter-menu');button.textContent='Ⅱ';button.setAttribute('aria-label','Pause and mission guide');button.onclick=openGuide;
 }
 for(const id of ['repairPanel','antennaPanel']){
  const close=document.createElement('button');close.type='button';close.className='panel-close';close.textContent='×';close.setAttribute('aria-label','Return to exploration');close.onclick=()=>{if(id==='repairPanel'){clearMissionDelays(1);repairShowing=false;newRepairSequence();}else{clearInterval(signalHoldTimer);signalHoldTimer=null;signalHoldProgress=0;$('signalHold').hidden=true;}$(id).hidden=true;stopLife1Stick(null);updateLife1Nearby();};$(id).prepend(close);
 }
 for(const input of document.querySelectorAll('.fuel-matrix3 input')){
  const label=input.closest('label'),row=document.createElement('div'),advice=document.createElement('small');row.className='mix-fine3';advice.className='mix-advice3';
  for(const delta of [-1,1]){const button=document.createElement('button');button.type='button';button.textContent=delta<0?'−':'+';button.dataset.adjust=String(delta);button.setAttribute('aria-label',(delta<0?'Decrease ':'Increase ')+({mixO2:'Oxygen level',mixFuel:'Fuel level',mixCool:'Coolant level'}[input.id]));button.onclick=()=>{if(paused)return;input.value=String(Math.max(Number(input.min),Math.min(Number(input.max),Number(input.value)+delta)));input.dispatchEvent(new Event('input',{bubbles:true}));};row.append(button);}
  label.append(advice,row);
 }
 updateMix3();
 // Keep inherited English protocol labels intact; add instructions outside those labels.
 document.querySelectorAll('[data-cell],[data-code],[data-ignite3],[data-sync2]').forEach(b=>b.addEventListener('click',()=>{if(!b.disabled)signal('tap',b);}));
 const glowTextures={};
 for(const [name,rgb] of Object.entries({ice:'130,235,255',gold:'255,221,158',dust:'212,216,210'})){
  const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');if(g){const gradient=g.createRadialGradient(32,32,0,32,32,32);gradient.addColorStop(0,'rgba('+rgb+',.9)');gradient.addColorStop(.22,'rgba('+rgb+',.28)');gradient.addColorStop(1,'rgba('+rgb+',0)');g.fillStyle=gradient;g.fillRect(0,0,64,64);}glowTextures[name]=c;
 }
 for(const [n,selector,kind] of [[1,'#life1World','moon'],[2,'#mission2 .crew-world-v2','bridge'],[2,'#navField2','flight'],[3,'#mission3 .command-scene3','console'],[4,'#mission4 .descent-world','landing']]){
  const root=document.querySelector(selector),canvas=document.createElement('canvas');canvas.className='experience-canvas';canvas.setAttribute('aria-hidden','true');root.append(canvas);
  const scene={n,root,canvas,ctx:canvas.getContext('2d'),kind,w:0,h:0,dpr:1};
  const resize=()=>{scene.w=root.clientWidth;scene.h=root.clientHeight;scene.dpr=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.max(1,Math.round(scene.w*scene.dpr));canvas.height=Math.max(1,Math.round(scene.h*scene.dpr));};new ResizeObserver(resize).observe(root);resize();scenes.push(scene);
 }
 const pipeFrame=$('circuit2').parentElement;new ResizeObserver(()=>{if(pipeFrame.clientHeight<2)return;const style=getComputedStyle(pipeFrame),size=Math.max(138,Math.min(pipeFrame.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight),pipeFrame.clientHeight-16));$('circuit2').style.setProperty('--pipe-size',size+'px');}).observe(pipeFrame);
 function glow(ctx,name,x,y,r,alpha){ctx.globalAlpha=alpha;ctx.drawImage(glowTextures[name],x-r,y-r,r*2,r*2);}
 function pos(scene,el){const r=el.getBoundingClientRect(),b=scene.paintRect||scene.root.getBoundingClientRect();return {x:(r.left+r.right)/2-b.left,y:(r.top+r.bottom)/2-b.top,w:r.width,h:r.height};}
 function signal(kind,el){
  tone(kind);
  if(el){el.classList.remove('action-flash');void el.offsetWidth;el.classList.add('action-flash');setTimeout(()=>el.classList.remove('action-flash'),500);}
  if(light||media.matches)return;
  const scene=scenes.find(s=>s.n===current&&s.root.contains(el))||scenes.find(s=>s.n===current&&s.kind!=='bridge');if(!scene)return;
  const p=el?pos(scene,el):{x:scene.w/2,y:scene.h*.55};bursts.push({scene,x:p.x,y:p.y,born:time,kind});if(bursts.length>8)bursts.shift();
 }
 function draw(scene){
  const {ctx,w,h,dpr,kind}=scene;if(!ctx||w<2||h<2||!scene.root.getClientRects().length)return;
  scene.paintRect=scene.root.getBoundingClientRect();
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);ctx.globalCompositeOperation='screen';
  const reduced=light||media.matches,count=reduced?7:cost>5?12:26;
  const motionTime=reduced?0:time;
  for(let i=0;i<count;i++){const x=((i*97.73+motionTime*(kind==='flight'?-18:1.5))%w+w)%w,y=(i*43.97)%(h*(kind==='moon'?.52:1));glow(ctx,'ice',x,y,i%5===0?3:1.4,.1+(.5+.5*Math.sin(motionTime+i))*.18);}
  if(kind==='moon'){
   const p=pos(scene,$('life1Player'));
   if(l1Walking&&!reduced)for(let i=0;i<6;i++){const age=(motionTime*2+i/6)%1;glow(ctx,'dust',p.x-Math.sign(l1MoveX)*age*18,p.y+p.h*.45+age*6,3+age*7,(1-age)*.22);}
   document.querySelectorAll('.energy:not(.collected)').forEach((e,i)=>{const p=pos(scene,e);glow(ctx,'ice',p.x,p.y+8,20+Math.sin(motionTime*2+i)*3,.12);});
  }else if(kind==='flight'){
   const p=pos(scene,$('navShip2'));for(let i=0;i<(reduced?4:12);i++){const age=(motionTime*2+i/12)%1;glow(ctx,i%3?'ice':'gold',p.x-p.w*.37-age*44,p.y+Math.sin(i*3+motionTime*8)*age*4,4+age*6,(1-age)*.65);}
  }else if(kind==='bridge'){
   if(scene.root.offsetHeight>100){glow(ctx,'ice',w*.17,h*.35,w*.23,.15+Math.sin(motionTime)*.04);glow(ctx,'gold',w*.64,h*.64,w*.18,.12);}
  }else if(kind==='console'){
   glow(ctx,'ice',w*.09,h*.76,Math.min(w,h)*.45,.12+Math.sin(motionTime*.8)*.04);
   ctx.globalAlpha=.12;ctx.strokeStyle='#91edf5';ctx.lineWidth=1;ctx.beginPath();for(let x=0;x<w;x+=4){const y=h*.9+Math.sin(x*.045-motionTime*2)*3;if(x)ctx.lineTo(x,y);else ctx.moveTo(x,y);}ctx.stroke();
  }else if(kind==='landing'){
   const p=pos(scene,$('lander')),burn=$('lander').classList.contains('thrusting');
   if(burn){for(let i=0;i<(reduced?4:14);i++){const age=(motionTime*4+i/14)%1;glow(ctx,i%4?'ice':'gold',p.x+Math.sin(i*2.4)*age*10,p.y+p.h*.3+age*38,3+age*8,(1-age)*.5);}}
   if(alt4<500&&!reduced){const proximity=1-alt4/500;for(let i=0;i<18;i++){const a=(motionTime*.4+i/18)%1,sign=i%2?1:-1;glow(ctx,'dust',p.x+sign*a*90,h-30-a*13,7+a*16,proximity*(burn?.2:.08)*(1-a));}}
   const pad=pos(scene,scene.root.querySelector('.landing-zone'));ctx.globalAlpha=.35;ctx.strokeStyle=vel4<=14&&Math.abs(drift4)<=42?'#bbffe1':'#ffe5a5';ctx.lineWidth=1;ctx.setLineDash([3,7]);ctx.beginPath();ctx.moveTo(p.x,p.y+p.h*.4);ctx.lineTo(pad.x,pad.y);ctx.stroke();ctx.setLineDash([]);
  }
  if(!reduced)for(const b of bursts){if(b.scene!==scene)continue;const age=motionTime-b.born;if(age>1)continue;ctx.globalAlpha=(1-age)*.7;ctx.strokeStyle=b.kind==='error'?'#ff957f':'#fff0b6';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(b.x,b.y,8+age*48,0,Math.PI*2);ctx.stroke();for(let i=0;i<10;i++){const a=i*Math.PI/5;glow(ctx,'gold',b.x+Math.cos(a)*age*44,b.y+Math.sin(a)*age*32,3,(1-age)*.7);}}
  ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';scene.paintRect=null;
 }
 function frame(now){
  frameId=0;const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;
  if(!current||current>4||document.hidden)return;
  if(!paused){time+=dt;if(now-paintAt>=(light||media.matches?100:cost>5?33:16)){const began=performance.now();scenes.filter(s=>s.n===current).forEach(draw);cost=cost*.9+(performance.now()-began)*.1;paintAt=now;}while(bursts.length&&time-bursts[0].born>1)bursts.shift();}
  frameId=requestAnimationFrame(frame);
 }
 function onScreen(id){
  if(guide.open)resume();if(flightReview.open)closeFlightReview();current=Number(id.match(/^mission([1-5])$/)?.[1]||0);cancelAnimationFrame(frameId);frameId=0;bursts.length=0;last=performance.now();syncVideos();
  if(current&&current<5&&!document.hidden)frameId=requestAnimationFrame(frame);
 }
 function syncVideos(){const active=document.querySelector('.screen.active');document.querySelectorAll('video').forEach(video=>{if(document.hidden||!active?.contains(video)||video.classList.contains('mk-home-bg')&&(light||media.matches))video.pause();else if(video.classList.contains('mk-home-bg'))video.play().catch(()=>{});});}
 document.addEventListener('visibilitychange',()=>{syncVideos();if(document.hidden){if(current&&current<5&&!flightReview.open)openGuide();cancelAnimationFrame(frameId);frameId=0;}else{last=performance.now();if(current&&current<5&&!frameId)frameId=requestAnimationFrame(frame);}});
 document.querySelectorAll('#mission1 .mission-status,#crewStatus,#life3GateStatus,#descentStatus').forEach(e=>e.setAttribute('role','status'));
 onScreen(document.querySelector('.screen.active')?.id||'home');
 return {onScreen,signal,flightFailed,get paused(){return paused;},get effectsReduced(){return light||media.matches;}};
})();
