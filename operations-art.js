/* Resolution-independent instruments. All meaningful geometry follows the puzzle model. */
window.OperationsArt=(()=>{
 const svg=(body,view='0 0 100 100',cls='')=>`<svg class="${cls}" viewBox="${view}" aria-hidden="true" focusable="false">${body}</svg>`;
 const symbols=[
  '<path d="M50 19 83 78H17Z"/><path d="M50 33 70 69H30Z" class="oa-fine"/>',
  '<circle cx="50" cy="50" r="29"/><path d="M12 50H25M75 50H88M50 12V25M50 75V88" class="oa-fine"/>',
  '<path d="M50 14 86 50 50 86 14 50Z"/><path d="M39 50H61M50 39V61" class="oa-fine"/>',
  '<path d="M22 22H78V78H22Z"/><path d="M30 35V30H35M65 30H70V35M70 65V70H65M35 70H30V65" class="oa-fine"/>',
  '<path d="M40 17H60V40H83V60H60V83H40V60H17V40H40Z"/>',
  '<path d="M50 15 81 32V68L50 85 19 68V32Z"/><path d="M50 28 69 39V61L50 72 31 61V39Z" class="oa-fine"/>'
 ];
 const symbol=(index)=>svg(symbols[index]||'<path d="M39 32Q50 22 61 32T53 51L50 60M50 71V76"/>','0 0 100 100','oa-symbol');
 function routeCell({i,n,rock,beacon,cost,current}){
  const ridges='<path d="M12 64 25 43 32 46 48 19 59 35 70 30 90 63 73 79 38 84Z" fill="#273d46" stroke="#77939b" stroke-width="1.1"/><path d="M12 64 37 61 48 19 55 57 70 30 69 66 90 63 73 79 38 84Z" fill="#142a34"/><path d="M25 43 37 61 32 46M48 19 46 55 55 57M55 57 69 66 73 79M37 61 38 84" fill="none" stroke="#96a9ab" stroke-width=".7"/>';
  const mast='<path d="M39 74H61M45 69 50 42 55 69M50 23V41M40 35Q50 25 60 35M32 27Q50 9 68 27"/><circle cx="50" cy="43" r="4"/>';
  const pad='<path d="M25 64 35 34H65L75 64 65 75H35Z"/><path d="M35 51H65M40 40V64M60 40V64"/>';
  const marker=current?'<path class="oa-craft" d="M50 30 62 62 50 57 38 62Z"/>':'';
  const art=rock?ridges:beacon>=0?`<g class="oa-beacon">${mast}</g>`:i===n*n-1?`<g class="oa-pad">${pad}</g>`:'';
  const label=i===0?'S':i===n*n-1?'E':beacon>=0?'B'+(beacon+1):'';
  return `${svg(art+marker,'0 0 100 100','oa-terrain-object')}<small class="oa-grid-ref">${String(Math.floor(i/n)+1).padStart(2,'0')}.${i%n+1}</small>${label?`<b class="oa-map-label">${label}</b>`:''}${!rock?`<small class="oa-cost">${cost===3?'△ ':''}${cost}</small>`:''}`;
 }
 function pipeCell(ends,i,beacon,last){
  const coords=[[50,0],[100,50],[50,100],[0,50]],a=coords[ends[0]],b=coords[ends[1]],straight=(ends[0]+2)%4===ends[1];
  const d=straight?`M${a.join(' ')}L${b.join(' ')}`:`M${a.join(' ')}L${50+(a[0]-50)*.3} ${50+(a[1]-50)*.3}Q50 50 ${50+(b[0]-50)*.3} ${50+(b[1]-50)*.3}L${b.join(' ')}`;
  const joints=ends.map(k=>`<g transform="rotate(${k*90} 50 50)"><path d="M41 8H59M41 12H59M41 17H59" class="oa-coupling"/><path d="M44 6V20M56 6V20" class="oa-contact"/></g>`).join('');
  return svg(`<path class="oa-trace" d="M11 11H32V25M69 83H86V66M14 64V83H31"/><path class="oa-pipe-shadow" d="${d}"/><path class="oa-pipe-body" d="${d}"/><path class="oa-pipe-core" d="${d}"/><path class="oa-pipe-light" d="${d}"/>${joints}${beacon>=0?'<circle class="oa-node-bezel" cx="50" cy="50" r="14"/><circle class="oa-node-led" cx="50" cy="50" r="6"/>':''}<path class="oa-fastener" d="M7 5V9M5 7H9M91 93H95M93 91V95"/>`,'0 0 100 100','oa-conduit')+`<small class="oa-pipe-label">${i===0?'IN':i===last?'OUT':beacon>=0?'N'+(beacon+1):String(i+1).padStart(2,'0')}</small><small class="oa-rotate">↻</small>`;
 }
 function cargoCell(label,mass){
  return `<small class="oa-bay">${label}</small>`+svg(`<defs><linearGradient id="oaTank${label}" x2="1" y2="0"><stop stop-color="#455866"/><stop offset=".33" stop-color="#c3cbd0"/><stop offset=".6" stop-color="#899ba5"/><stop offset="1" stop-color="#354c5a"/></linearGradient></defs><path class="oa-bay-frame" d="M10 21H90V64H10Z M18 21V64M82 21V64"/><path d="M25 29Q25 18 50 18T75 29V52Q75 64 50 64T25 52Z" fill="url(#oaTank${label})" stroke="#cad9dd" stroke-width=".7"/><ellipse cx="50" cy="29" rx="25" ry="10" fill="#879ca7" stroke="#c2d2d6" stroke-width=".8"/><path d="M25 35Q50 47 75 35M25 48Q50 61 75 48M34 22V57M66 22V57" fill="none" stroke="#263e4c" stroke-width="2"/><rect x="43" y="35" width="14" height="12" rx="1" fill="#223642" stroke="#d1b779" stroke-width="1"/><path d="M16 65H84M22 67V71M78 67V71" stroke="#758e9a" stroke-width="2"/>`,'0 0 100 80','oa-cargo-tank')+`<div class="oa-mass"><span>MASS</span><b>${mass}</b></div>`;
 }
 function shieldCell(i,jammed){
  const ticks=Array.from({length:12},(_,k)=>`<path d="M50 13V18" transform="rotate(${k*30} 50 50)"/>`).join('');
  return svg(`<path class="oa-array-frame" d="M50 7 87 29V71L50 93 13 71V29Z"/><circle class="oa-array-shadow" cx="50" cy="50" r="28"/><circle class="oa-array-ring" cx="50" cy="50" r="27"/><circle class="oa-array-inner" cx="50" cy="50" r="20"/><g class="oa-array-ticks">${ticks}</g><path class="oa-array-mesh" d="M33 37H67M31 46H69M31 55H69M35 64H65M39 32V68M50 30V70M61 32V68"/><path class="oa-array-state" d="${jammed?'M43 43 57 57M57 43 43 57':'M41 51 48 58 61 43'}"/><path class="oa-array-socket" d="M46 1H54V7H46ZM46 93H54V99H46ZM1 46H7V54H1ZM93 46H99V54H93Z"/>`,'0 0 100 100','oa-emitter')+`<small class="oa-emitter-id">${String(i+1).padStart(2,'0')}</small><i class="oa-emitter-led"></i>`;
 }
 const systemShapes=[
  '<circle cx="40" cy="50" r="20"/><path d="M8 43H20M60 43H86V61H74M40 30V16H58M30 60 50 40M30 40 50 60"/>',
  '<path d="M15 40H30L39 20H68V79H39L30 60H15M42 30H61M42 40H61M42 50H61M42 60H61M42 70H61M68 40H88M68 60H88"/>',
  '<circle cx="50" cy="50" r="31"/><circle cx="50" cy="50" r="8"/><path d="M50 19 57 42 74 29M81 50 58 57 71 74M50 81 43 58 26 71M19 50 42 43 29 26"/>',
  '<circle cx="50" cy="50" r="28"/><path d="M50 7V28M50 72V93M7 50H28M72 50H93M35 66 50 31 64 66 50 58Z"/>',
  '<path d="M26 20H74V80H26ZM26 33H74M26 67H74M40 33V67M60 33V67M12 45H26M74 45H88M12 55H26M74 55H88"/>',
  '<path d="M17 79V24L30 13H70L83 24V79M27 79V29L34 23H66L73 29V79M38 38V68M62 38V68M48 38V68M17 79H83"/>',
  '<path d="M17 30H83V75H17ZM27 30V18H39V30M61 30V18H73V30M29 52H43M36 45V59M59 52H73"/>',
  '<path d="M14 32H86M14 68H86M23 23V77M77 23V77M35 32V68M50 32V68M65 32V68M7 43H23M77 55H93"/>'
 ];
 const systemIcon=id=>svg(systemShapes[id]||systemShapes[0],'0 0 100 100','oa-system-icon');
 function layer(board,markup,view,cls){const box=document.createElement('div');box.className=cls;box.setAttribute('aria-hidden','true');box.innerHTML=svg(markup,view);board.prepend(box);}
 function decorate(board,b,p){
  if(b.type==='route'){
   const size=b.n*100;let terrain='';
   for(let k=0;k<14;k++){const x=(k*173+29)%size,y=(k*97+66)%size,r=19+(k*17)%54;terrain+=`<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r*.73}" fill="#233d46" stroke="#91a8a947" stroke-width="2"/><ellipse cx="${x-3}" cy="${y+3}" rx="${r*.78}" ry="${r*.55}" fill="#102b3566" stroke="#b6c1ab24" stroke-width="1"/>`;}
   for(let j=0;j<17;j++){const y=j*size/16;terrain+=`<path d="M0 ${y}C${size*.22} ${y-52} ${size*.22} ${y+57} ${size*.46} ${y+11}S${size*.76} ${y-63} ${size} ${y-14}" fill="none" stroke="#b6c1ab1f" stroke-width="1"/>`;}
   const points=p.path.map(i=>`${(i%b.n)*100+50},${Math.floor(i/b.n)*100+50}`).join(' ');
   layer(board,terrain+`<polyline points="${points}" class="oa-route-shadow"/><polyline points="${points}" class="oa-route-line"/>`,'0 0 '+size+' '+size,'oa-map-ground');
  }
  if(b.type==='shield'){
   const size=b.n*100;let links='';for(let i=0;i<b.n*b.n;i++){const x=i%b.n*100+50,y=Math.floor(i/b.n)*100+50;for(const j of [i%b.n<b.n-1?i+1:-1,i+b.n<b.n*b.n?i+b.n:-1])if(j>=0){const on=!p.lamps[i]&&!p.lamps[j];links+=`<path d="M${x} ${y}L${j%b.n*100+50} ${Math.floor(j/b.n)*100+50}" class="${on?'oa-bus-on':'oa-bus-off'}"/>`;}}
   layer(board,links,'0 0 '+size+' '+size,'oa-array-bus');
   const cells=[...board.querySelectorAll('[data-op-cell]')];
   const preview=index=>cells.forEach(el=>{const i=Number(el.dataset.opCell);el.classList.toggle('oa-linked',index>=0&&(i===index||MissionRules.adjacent(i,index,b.n)));});
   for(const cell of cells){cell.addEventListener('pointerenter',()=>preview(Number(cell.dataset.opCell)));cell.addEventListener('pointerleave',()=>preview(-1));cell.addEventListener('focus',()=>preview(Number(cell.dataset.opCell)));cell.addEventListener('blur',()=>preview(-1));}
  }
 }
 function oscilloscope(attempts){let d='';for(let i=0;i<=320;i++){const y=32+Math.sin(i*.065)*Math.sin(i*.024+attempts*.25)*15+Math.sin(i*.29)*3;d+=(i?'L':'M')+i+' '+y.toFixed(1);}return svg(`<path class="oa-scope-grid" d="M0 16H320M0 32H320M0 48H320M40 0V64M80 0V64M120 0V64M160 0V64M200 0V64M240 0V64M280 0V64"/><path class="oa-scope-zero" d="M0 32H320"/><path class="oa-scope-signal" d="${d}"/>`,'0 0 320 64','oa-scope');}
 // Existing live scenes keep their ship/antenna artwork and gain actual mechanical details.
 const gate=document.getElementById('finalGate');
 if(gate){
  const segments=Array.from({length:12},(_,i)=>`<g transform="rotate(${i*30} 100 100)"><path d="M91 10H109L113 27H87Z" fill="#51636c" stroke="#b5c1c3" stroke-width=".7"/><path d="M94 13H106V24H94Z" fill="#263e4c"/><path d="M96 16H104V21H96Z" class="gate-light"/><path d="M89 32H111V38H89Z" fill="#142c3a" stroke="#8caaaf" stroke-width="1"/><circle cx="89" cy="18" r="1.2" fill="#ced6d1"/><circle cx="111" cy="18" r="1.2" fill="#ced6d1"/></g>`).join('');
  gate.innerHTML=svg(`<defs><linearGradient id="mktyGateMetal" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#e2e5d8"/><stop offset=".24" stop-color="#82969b"/><stop offset=".5" stop-color="#405966"/><stop offset=".78" stop-color="#a9b6b4"/><stop offset="1" stop-color="#506975"/></linearGradient><radialGradient id="mktyGateWell"><stop stop-color="#11263d" stop-opacity=".85"/><stop offset=".55" stop-color="#315d73" stop-opacity=".55"/><stop offset=".9" stop-color="#81becb" stop-opacity=".75"/><stop offset="1" stop-color="#e5f4ed" stop-opacity=".8"/></radialGradient></defs><circle cx="100" cy="100" r="94" fill="#203a4a" stroke="#9dafb5" stroke-width="1"/><circle cx="100" cy="100" r="80" fill="none" stroke="url(#mktyGateMetal)" stroke-width="23"/><circle cx="100" cy="100" r="65" class="gate-iris" fill="url(#mktyGateWell)"/><circle cx="100" cy="100" r="65" class="gate-live" stroke-width="2"/><circle cx="100" cy="100" r="72" fill="none" stroke="#182d3c" stroke-width="2"/><circle cx="100" cy="100" r="58" class="gate-live" stroke-width=".7" stroke-dasharray="2 6"/>${segments}<path d="M53 101Q100 85 147 101M100 48Q85 100 100 152" class="gate-live" stroke-width=".4" opacity=".3"/>`,'0 0 200 200','oa-return-gate');
 }
 const source=document.querySelector('#mission8 .signal-source');
 if(source)source.innerHTML=svg('<g transform="rotate(-24 50 50)"><path d="M38 36H62V63H38Z" fill="#849aa2"/><path d="M6 33H31V66H6ZM69 33H94V66H69Z" fill="#284b61"/><path d="M14 33V66M22 33V66M77 33V66M85 33V66M6 44H31M6 55H31M69 44H94M69 55H94M31 47H38M62 47H69M50 36V19M42 20Q50 28 58 20"/><circle cx="50" cy="19" r="2" fill="#e4d3ad"/><path d="M45 44H55V55H45Z" fill="#18364b"/><path d="M44 64 40 75M56 64 60 75"/></g>');
 const mark=document.querySelector('#mission9 .complete-icon');if(mark)mark.textContent='✓';
 return {routeCell,pipeCell,cargoCell,shieldCell,symbol,systemIcon,decorate,oscilloscope};
})();
