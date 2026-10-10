/* Chapter 1 presentation only. FieldRules and MKTYField still own every action,
   pause, checkpoint, completion and reward. No persistent presentation state. */
window.MKTYCinematicArt=(()=>{
 'use strict';
 const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const tr=(ru,en)=>window.MKTYI18n?MKTYI18n.tr(ru,en):en;
 const crops=Array.from({length:16},(_,i)=>[i%4*256,Math.floor(i/4)*256,256,256]);
 crops.push([0,1024,256,341]);
 const camera=()=>innerWidth>innerHeight&&innerHeight<=600?{height:600,y:0,mode:'landscape'}:innerHeight<=700?{height:800,y:200,mode:'compact'}:{height:910,y:280,mode:'portrait'};
 function scene(s,b){
  const view=camera();
  const sprite=(id,x,feet,w,h=w)=>{const [cx,cy,cw,ch]=crops[id];return `<svg pointer-events="none" class="lunar-sprite${id===16?' cinematic-cat':''}" data-lunar-sprite="${id}" x="${x-w/2}" y="${feet-h}" width="${w}" height="${h}" viewBox="${cx} ${cy} ${cw} ${ch}" preserveAspectRatio="xMidYMid meet"><g clip-path="url(#cp-clip-${id})"><use href="#cp-atlas"${id===16?' class="cinematic-cat-frames"':''}/></g></svg>`;};
  const label=(x,y,value,color='#ffdda1',size=26)=>`<text x="${x}" y="${y}" text-anchor="middle" fill="${color}" font-size="${size}" font-family="system-ui,sans-serif" font-weight="750">${escape(value)}</text>`;
  const pin=(x,y,value,done=false)=>`<g class="cinematic-pin${done?' powered':''}" pointer-events="none"><circle cx="${x}" cy="${y}" r="22" fill="${done?'#07373e':'#33250c'}" stroke="${done?'#84f3fa':'#ffd277'}" stroke-width="3"/><circle cx="${x}" cy="${y}" r="27" fill="none" stroke="${done?'#69e6f7':'#ffd277'}" stroke-opacity=".25" stroke-width="5"/>${label(x,y+9,value,done?'#b2ffff':'#ffe4a9')}</g>`;
  let a=`<defs><image id="cp-atlas" href="art/cinematic-perimeter-atlas-v1.webp" width="1024" height="1365"/><image id="cp-ground" href="art/cinematic-perimeter-ground-v1.webp" width="600" height="1066"/>${crops.map(([x,y,w,h],i)=>`<clipPath id="cp-clip-${i}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath>`).join('')}<linearGradient id="cp-shade" x2="0" y2="1"><stop stop-color="#051321" stop-opacity=".05"/><stop offset=".8" stop-color="#051321" stop-opacity="0"/><stop offset="1" stop-color="#051321" stop-opacity=".2"/></linearGradient></defs><g pointer-events="none" class="cinematic-environment"><use href="#cp-ground"/><rect width="600" height="${view.height}" fill="url(#cp-shade)"/></g><g class="cinematic-board" transform="translate(0 ${view.y})">`;
  // Ground connections have no interaction geometry. Source order/dependencies
  // are not invented here: all three instruments remain collectible in any order.
  for(const i of [...b.walls,...b.targets])for(const j of [i+1,i+6])if([...b.walls,...b.targets].includes(j)&&(j===i+6||Math.floor(i/6)===Math.floor(j/6))){const x=i%6*100+50,y=Math.floor(i/6)*100+71,xx=j%6*100+50,yy=Math.floor(j/6)*100+71,d=`M${x} ${y}H${xx}V${yy}`;a+=`<g pointer-events="none"><path d="${d}" fill="none" stroke="#111d23" stroke-width="12"/><path d="${d}" fill="none" stroke="#bbc0ba" stroke-width="8"/><path d="${d}" fill="none" stroke="#8b671f" stroke-width="5"/><path d="${d}" fill="none" stroke="#ffd078" stroke-width="3" stroke-dasharray="10 8"/></g>`;}
  // A dotted survey trail leads through existing safe cells. It is guidance,
  // not automatic movement, and never crosses an unscanned fracture.
  if(!s.complete){const goals=s.collected.length===3?[b.exit]:b.targets.filter(i=>!s.collected.includes(i)),queue=[[s.pos]],seen=new Set([s.pos]);let trail=null;for(let q=0;q<queue.length;q++){const path=queue[q],at=path.at(-1);if(goals.includes(at)){trail=path;break;}for(const next of [at-1,at+1,at-6,at+6])if(next>=0&&next<36&&!seen.has(next)&&!b.walls.includes(next)&&(s.scanned||!b.hazards.includes(next))&&Math.abs(at%6-next%6)+Math.abs(Math.floor(at/6)-Math.floor(next/6))===1){seen.add(next);queue.push([...path,next]);}}if(trail?.length>1){const d=trail.map((i,k)=>`${k?'L':'M'}${i%6*100+50} ${Math.floor(i/6)*100+65}`).join(' ');a+=`<path class="cinematic-route" pointer-events="none" d="${d}" fill="none" stroke="#ffd784" stroke-width="5" stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="8 15"/>`;}}
  // Artwork is outside hit groups, so a tall dish cannot steal the next cell.
  let cells='',art='';
  for(let i=0;i<36;i++){
   const x=i%6*100,y=Math.floor(i/6)*100,wall=b.walls.includes(i),target=b.targets.includes(i),hazard=b.hazards.includes(i),done=s.collected.includes(i),adjacent=Math.abs(i%6-s.pos%6)+Math.abs(Math.floor(i/6)-Math.floor(s.pos/6))===1,reachable=!s.complete&&adjacent&&!wall&&(!hazard||s.scanned);
   cells+=`<g data-field-cell="${i}" role="button" tabindex="${wall?-1:0}" aria-label="${i+1}" class="field-map-cell lunar-cell${wall?' obstacle':''}${target?' recovery-target':''}${done?' recovered':''}${i===b.exit?' exit-cell':''}${i===s.pos?' current':''}${reachable?' reachable':''}"><rect class="lunar-hit" x="${x+3}" y="${y+3}" width="94" height="94" rx="8" fill="transparent" stroke="none"/>${reachable?`<path class="lunar-step-marker" pointer-events="none" d="M${x+22} ${y+30}v-8h8m40 0h8v8M${x+22} ${y+70}v8h8m40 0h8v-8" fill="none" stroke="#ffe19b" stroke-width="3" stroke-opacity=".8"/>`:''}</g>`;
   const depth=.76+Math.floor(i/6)*.055;
   if(hazard)art+=`<g pointer-events="none" class="lunar-hazard">${sprite(13,x+50,y+83,96,70)}<path d="M${x+77} ${y+9}l13 22h-26Z" fill="#ffd57a" stroke="#332812" stroke-width="2"/><path d="M${x+77} ${y+15}v7m0 4v1" stroke="#332812" stroke-width="2.5"/>${s.scanned?`<ellipse class="cinematic-survey" cx="${x+50}" cy="${y+52}" rx="38" ry="30" fill="none" stroke="#79f3fa" stroke-width="2" stroke-dasharray="5 5"/>`:''}</g>`;
   if(wall){const k=b.walls.indexOf(i),size=127*depth;art+=`<g class="lunar-prop" data-prop="${['habitat','solar','tanks','cooling','relay','greenhouse','battery','miner'][k]}" pointer-events="none"><g class="lunar-footing"><ellipse cx="${x+52}" cy="${y+84}" rx="37" ry="10" fill="#111b26" opacity=".45"/><path d="M${x+17} ${y+78}l9-7h47l10 7-7 11H25Z" fill="#747e82" stroke="#e5c88b" stroke-width="1.5"/></g>${sprite(k,x+50,y+92,size,size)}</g>`;}
   if(target){const k=b.targets.indexOf(i),size=207*depth,pinY=Math.max(y+95-size+8,y+(view.mode==='compact'?65:8));art+=`<g class="lunar-objective" data-objective="${k}" pointer-events="none"><ellipse cx="${x+50}" cy="${y+84}" rx="44" ry="12" fill="#111b26" opacity=".55"/>${sprite(k+8,x+50,y+92,size,size)}${pin(x+50,pinY,done?'✓':k+1,done)}<path d="M${x+21} ${y+91}h58" stroke="${done?'#6ce6ef':'#ffd57a'}" stroke-width="3"/></g>`;}
   if(i===b.exit){const ready=s.collected.length===3;art+=`<g class="lunar-exit" pointer-events="none">${sprite(11,x+50,y+95,247*depth,247*depth)}<rect class="field-exit-plate" x="${x+11}" y="${y+69}" width="78" height="27" rx="8" fill="#0a2731" stroke="${ready?'#a7fbdf':'#e9bf71'}" stroke-width="2"/>${label(x+50,y+91,tr('ВЫХОД','EXIT'),ready?'#bcffe7':'#ffe4a9',20).replace('<text ','<text class="field-exit-label" ')}</g>`;}
  }
  // Draw floor markers first; stations in row order and the large cat above them.
  a+=cells+`<g class="cinematic-equipment" pointer-events="none">${art}</g>`;
  const px=s.pos%6*100+50,py=Math.floor(s.pos/6)*100+50,catX=px<100?24:px>500?-24:0;
  a+=`<g class="field-vessel lunar-player" pointer-events="none" transform="translate(${px} ${py})"><ellipse cx="${catX+5}" cy="32" rx="42" ry="12" fill="#061321" opacity=".48"/><ellipse cx="${catX}" cy="33" rx="40" ry="11" fill="none" stroke="#fff0bf" stroke-width="2" stroke-opacity=".6"/>${sprite(16,catX,38,143,191)}</g></g>`;
  return `<svg viewBox="0 0 600 ${view.height}" xmlns="http://www.w3.org/2000/svg" aria-label="${escape(tr('Периметр лунной базы','Lunar base perimeter'))}" class="field-svg lunar-worksite cinematic-perimeter" data-renderer="lunar-worksite-v2" data-presentation="cinematic-perimeter-v1" data-camera="${view.mode}">${a}</svg>`;
 }
 // Accessible joystick is a presentation adapter for existing adjacent-cell
 // clicks. It never calls a model mutator, save function or completion callback.
 let previous=null;
 function project(svg){const root=document.getElementById('fieldMission'),map=root?.classList.contains('cinematic-map-view'),view=map?{height:600,y:0,mode:'map'}:camera();svg.setAttribute('viewBox',`0 0 600 ${view.height}`);svg.dataset.camera=view.mode;svg.querySelector('.cinematic-board').setAttribute('transform',`translate(0 ${view.y})`);svg.querySelector('.cinematic-environment').setAttribute('transform',map?'translate(0 -250)':'translate(0 0)');}
 function move(dx,dy){
  const root=document.getElementById('fieldMission'),svg=root?.querySelector('.cinematic-perimeter');
  if(!svg||!root.classList.contains('active')||root.querySelector('dialog[open]'))return;
  const s=window.MKTYField?.snapshot();if(!s||s.n!==1||s.complete)return;
  const x=s.pos%6+dx,y=Math.floor(s.pos/6)+dy;if(x<0||x>5||y<0||y>5)return;
  svg.querySelector(`[data-field-cell="${y*6+x}"]`)?.dispatchEvent(new MouseEvent('click',{bubbles:true}));
 }
 function decorate(){
  const root=document.getElementById('fieldMission');if(!root)return;
  const svg=root.querySelector('.cinematic-perimeter');
  root.classList.toggle('cinematic-mission',!!svg);
  if(!svg){root.querySelector('.cinematic-joystick')?.remove();const nav=root.querySelector('.cinematic-navigation');if(nav){root.querySelector('.field-footer').append(document.getElementById('fieldSubmit'));nav.remove();}root.classList.remove('cinematic-map-view');previous=null;return;}
  const footer=root.querySelector('.field-footer');
  if(!footer.querySelector('.cinematic-navigation')){
   const nav=document.createElement('div');nav.className='cinematic-navigation';
   const map=document.createElement('button');map.className='cinematic-nav-button cinematic-map-button';map.type='button';map.textContent=tr('КАРТА','MAP');map.setAttribute('aria-pressed','false');
   map.addEventListener('click',()=>{const active=root.classList.toggle('cinematic-map-view');map.setAttribute('aria-pressed',String(active));project(root.querySelector('.cinematic-perimeter'));});
   const tasks=document.createElement('button');tasks.className='cinematic-nav-button cinematic-tasks-button';tasks.type='button';tasks.textContent=tr('ЗАДАЧИ','TASKS');tasks.setAttribute('aria-controls','fieldBrief');
   tasks.addEventListener('click',()=>{if(window.MKTYField?.snapshot()?.complete){document.getElementById('fieldReview').scrollIntoView({block:'nearest'});return;}const guide=root.querySelector('.field-guide');guide.open=!guide.open;tasks.setAttribute('aria-expanded',String(guide.open));if(guide.open)guide.scrollIntoView({block:'nearest'});});
   nav.append(map,document.getElementById('fieldSubmit'),tasks);footer.append(nav);
  }
  project(svg);
  const tasks=root.querySelector('.cinematic-tasks-button'),complete=window.MKTYField?.snapshot()?.complete;
  tasks.setAttribute('aria-controls',complete?'fieldReview':'fieldBrief');
  const controls=document.getElementById('fieldControls');
  if(!root.querySelector('.cinematic-joystick')&&!root.querySelector('.field-review:not([hidden])')){
   const joy=document.createElement('button');joy.className='cinematic-joystick';joy.type='button';
   joy.setAttribute('aria-label',tr('Джойстик: нажмите направление или используйте стрелки','Joystick: tap a direction or use arrow keys'));
   joy.innerHTML='<span class="joystick-ring" aria-hidden="true"><i></i><b class="north">⌃</b><b class="south">⌄</b><b class="west">‹</b><b class="east">›</b></span>';
   joy.addEventListener('click',e=>{if(e.detail===0)return;const r=joy.getBoundingClientRect(),x=e.clientX-r.x-r.width/2,y=e.clientY-r.y-r.height/2;if(Math.hypot(x,y)<8)return;Math.abs(x)>Math.abs(y)?move(Math.sign(x),0):move(0,Math.sign(y));});
   joy.addEventListener('keydown',e=>{const d={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(d){e.preventDefault();move(...d);}});
   controls.append(joy);
  }
  const s=window.MKTYField?.snapshot(),key=s&&`${s.seed}:${s.stage}:${s.n}`;
  if(s&&previous?.key===key&&previous.moves<s.moves&&previous.pos!==s.pos&&!matchMedia('(prefers-reduced-motion:reduce)').matches)svg.querySelector('.cinematic-cat')?.classList.add('walking');
  if(s)previous={key,moves:s.moves,pos:s.pos};
 }
 document.addEventListener('DOMContentLoaded',()=>{
  const observer=new MutationObserver(decorate);
  // Watch controller output, not our own classes, to avoid observer feedback.
  const app=document.getElementById('app');if(app)observer.observe(app,{childList:true,subtree:true});
  decorate();
  document.addEventListener('toggle',e=>{if(e.target.matches?.('#fieldMission .field-guide'))document.querySelector('.cinematic-tasks-button')?.setAttribute('aria-expanded',String(e.target.open));},true);
  addEventListener('resize',()=>{const svg=document.querySelector('#fieldWorld>.cinematic-perimeter');if(svg)project(svg);});
 });
 return {scene};
})();
