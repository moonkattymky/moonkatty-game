/* Reactor light rig. One canvas, bounded particles, cached glow textures.
   The canvas uses the same camera and coordinates as the SVG artwork. */
function createReactor5Effects(root) {
 const canvas = $('reactorEffects5');
 const gallery = $('reactorGallery5');
 const ctx = canvas.getContext('2d', {alpha:true});
 const media = matchMedia('(prefers-reduced-motion: reduce)');
 const orbits = [...root.querySelectorAll('.reactor-orbit5')];
 const wave = $('reactorWavePath5');
 const TAU = Math.PI * 2;
 let width=0,height=0,dpr=1,time=0,angle=0,speed=.13,energy=0,lastWave=-1,visible=false;
 let pulses=[],detail=1,costAverage=0;
 let camera={x:144,y:0,w:1160,h:1086};
 const observer = new ResizeObserver(resize);
 function resize() {
  width=gallery.clientWidth;height=gallery.clientHeight;
  dpr=Math.min(window.devicePixelRatio||1,1.75);
  const compact=height<200&&width/height>1.5;
  camera=compact?{x:144,y:130,w:1160,h:780}:{x:144,y:0,w:1160,h:1086};
  root.querySelector('.reactor-art5').setAttribute('viewBox',`${camera.x} ${camera.y} ${camera.w} ${camera.h}`);
  gallery.dataset.compact=String(compact);
  if(width<1||height<1)return;
  const w=Math.round(width*dpr),h=Math.round(height*dpr);
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
 }
 function sprite(color) {
  const c=document.createElement('canvas');c.width=c.height=96;
  const g=c.getContext('2d');if(!g)return c;
  const fill=g.createRadialGradient(48,48,0,48,48,48);
  fill.addColorStop(0,`rgba(${color},.95)`);fill.addColorStop(.1,`rgba(${color},.7)`);
  fill.addColorStop(.38,`rgba(${color},.18)`);fill.addColorStop(1,`rgba(${color},0)`);
  g.fillStyle=fill;g.fillRect(0,0,96,96);return c;
 }
 const cyan=sprite('133,239,255'),gold=sprite('255,215,144'),ice=sprite('221,255,248');
 function glow(texture,x,y,r,alpha) {
  ctx.globalAlpha=alpha;ctx.drawImage(texture,x-r,y-r,r*2,r*2);
 }
 function signal(kind) {
  window.MKTYExperience?.signal(kind);
  if(!visible)return;
  pulses.push({kind,born:time});
  if(pulses.length>5)pulses.shift();
 }
 function draw(s,dt=0) {
  if(!visible||!width||!height)return;
  const began=performance.now();
  const reduced=media.matches||window.MKTYExperience?.effectsReduced;
  const charging=s.phase==='charge'&&(s.chargeHeld||s.chargeTap>0)&&!(s.coolHeld||s.coolTap>0);
  const cooling=s.phase==='charge'&&(s.coolHeld||s.coolTap>0);
  const total=s.cells.reduce((a,b)=>a+b,0)/300;
  const target=s.phase==='online'?1:s.phase==='startup'?.72+s.startup*.11:s.phase==='fault'?.06:.12+total*.36+(charging?.3:0);
  energy+=(target-energy)*(1-Math.exp(-dt*4));
  if(!reduced)time+=dt;
  const desired=s.phase==='startup'?1.05:s.phase==='online'?.4:charging?.65:s.phase==='ignite'?.45:.13;
  speed+=(desired-speed)*(1-Math.exp(-dt*3));if(!reduced)angle+=speed*dt;
  orbits[0].style.transform=`rotate(${angle}rad)`;orbits[1].style.transform=`rotate(${-angle*.67}rad)`;
  // A small signal trace is derived from the current energy/field, not random telemetry.
  if(time-lastWave>.05||reduced){
   let path='';const amp=1+energy*4.2+(s.phase==='balance'?Math.min(3,Math.abs(s.field-50)/8):0);
   for(let x=0;x<=160;x+=4){const y=9+Math.sin(x*.095-time*3)*Math.sin(x*.024+time*.6)*amp;path+=(x?'L':'M')+x+' '+y.toFixed(1);}
   wave.setAttribute('d',path);lastWave=time;
  }
  if(!ctx)return;
  ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);
  const scale=Math.min(width/camera.w,height/camera.h);
  ctx.setTransform(dpr*scale,0,0,dpr*scale,dpr*((width-camera.w*scale)/2-camera.x*scale),dpr*(height-camera.h*scale)/2-camera.y*scale);
  ctx.translate(724,480);
  ctx.globalCompositeOperation='screen';
  glow(cyan,0,0,320,.16+energy*.26);
  glow(ice,0,0,145,.1+energy*.3);
  // Luminous ribbons sit inside the glass; the mechanical casing stays circular.
  ctx.save();ctx.beginPath();ctx.arc(0,0,145,0,TAU);ctx.clip();
  for(let j=0;j<6;j++){
   ctx.beginPath();
   for(let k=0;k<=80;k++){
    const a=k/80*TAU,twist=time*(.18+j*.025)+j*1.04;
    const r=48+j*14+Math.sin(a*3+twist*2)*8+Math.cos(a*2-twist)*5;
    const x=Math.cos(a+twist)*r,y=Math.sin(a+twist)*r*.76;
    if(k)ctx.lineTo(x,y);else ctx.moveTo(x,y);
   }
   ctx.closePath();ctx.strokeStyle=j%2?'#acfcf2':'#54d9ff';
   ctx.lineWidth=j%3?1.4:2.4;ctx.globalAlpha=(.12+energy*.34)*(j%2?1:.6);ctx.stroke();
  }
  if(!reduced)for(let i=0;i<(detail===1?42:22);i++){
   const a=i*2.39996+time*(.2+(i%4)*.06),r=36+(i*19.13)%100;
   const life=.35+.65*(.5+.5*Math.sin(time*1.3+i));
   glow(i%7===0?gold:ice,Math.cos(a)*r,Math.sin(a)*r,3+(i%3)*1.1,(.16+energy*.5)*life);
  }
  ctx.restore();
  // Power travels toward the core from the active feed. Cooling flows away.
  if(!reduced&&(charging||cooling)){
   const count=detail===1?22:12;
   for(let i=0;i<count;i++){
    const p=(time*(cooling?.35:.65)+i/count)%1;
    const sector=cooling?i%3:s.selected;
    const a=-Math.PI/2+sector*TAU/3+(i%5-2)*.052;
    const r=cooling?205+p*190:400-p*240;
    const x=Math.cos(a)*r,y=Math.sin(a)*r;
    glow(cooling?cyan:gold,x,y,cooling?16:7,Math.sin(p*Math.PI)*(cooling?.35:.75));
    if(!cooling){ctx.globalAlpha=Math.sin(p*Math.PI)*.45;ctx.strokeStyle='#ffe2a2';ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(a)*15,y+Math.sin(a)*15);ctx.stroke();}
   }
  }
  // Light catches the machined outer ring as its status changes.
  for(let i=0;i<3;i++){
   const a=-Math.PI/2+i*TAU/3+.9;
   glow(s.temp>78?gold:cyan,Math.cos(a)*238,Math.sin(a)*238,38,.12+s.cells[i]/100*.3);
  }
  if(!reduced&&detail===1)for(let i=0;i<14;i++){
   const x=Math.sin(i*12.97)*440,y=((i*71-time*(4+i%3))%700+700)%700-350;
   glow(i%3?cyan:gold,x,y,3.5,.1+energy*.14);
  }
  // A single soft pressure wave for a confirmed action, never a strobing flash.
  pulses=pulses.filter(p=>time-p.born<1.3);
  if(!reduced)for(const p of pulses){
   const t=(time-p.born)/1.3,progress=1-Math.pow(1-t,3),r=145+progress*200;
   ctx.globalAlpha=(1-t)*.56;ctx.strokeStyle=p.kind==='miss'||p.kind==='fault'?'#ffc18c':'#befff0';ctx.lineWidth=1+4*(1-t);
   ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.stroke();
   glow(p.kind==='miss'||p.kind==='fault'?gold:ice,0,0,210+progress*70,(1-t)*.28);
  }
  ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  const cost=performance.now()-began;costAverage=costAverage*.95+cost*.05;
  // Bound optional detail on slower devices; simulation and input keep every frame.
  if(costAverage>7)detail=0;else if(costAverage<3)detail=1;
 }
 return {
  start(){visible=true;time=0;angle=0;energy=0;lastWave=-1;pulses=[];observer.observe(gallery);resize();},
  stop(){visible=false;observer.disconnect();pulses=[];},
  draw,signal,
  get reduced(){return media.matches||window.MKTYExperience?.effectsReduced;}
 };
}
