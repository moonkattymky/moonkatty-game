/* Bounded decorative renderer. Positions and hit tests use the same geometry. */
const Void7FX={create({world,canvas,ship,bubble}){
 const ctx=canvas.getContext('2d',{alpha:true}),lanes=[.22,.5,.78];let w=1,h=1,shipW=72,shipH=48;
 const motes=Array.from({length:38},(_,i)=>({x:((i*73+19)%101)/101,y:((i*31+7)%97)/97,z:(i%3+1)/3}));
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function resize(){w=Math.max(1,world.clientWidth);h=Math.max(1,world.clientHeight);shipW=ship.offsetWidth||72;shipH=shipW*343/520;const dpr=Math.min(devicePixelRatio||1,1.75);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx?.setTransform(dpr,0,0,dpr,0,0);}
 const geometry=()=>({w,h,shipW,shipH,shipY:h*.78});
 const rockSize=r=>r.big?clamp(w*.125,34,46):clamp(w*.098,26,36);
 const rockY=r=>{const size=rockSize(r);return-size/2+(h+size)*clamp(r.age/r.duration,0,1);};
 function layout(s){
  const reduced=window.MKTYExperience?.effectsReduced,x=s.x*w,y=h*.78,bank=reduced?0:clamp((lanes[s.lane]-s.x)*100,-12,12);
  ship.style.transform=`translate3d(${x-shipW/2}px,${y-shipH/2}px,0) rotate(${bank}deg)`;
  ship.style.setProperty('--v7-engine',s.phase==='flight'?'1':s.phase==='approach'?'.7':'.25');
  bubble.style.transform=`translate3d(${x-shipW*.68}px,${y-shipW*.68}px,0)`;bubble.style.width=bubble.style.height=shipW*1.36+'px';bubble.classList.toggle('armed',s.shieldActive);
  for(const r of s.rocks){const size=rockSize(r);r.el.style.width=r.el.style.height=size+'px';r.el.style.visibility=r.age<0?'hidden':'visible';r.el.style.transform=`translate3d(${lanes[r.lane]*w-size/2}px,${rockY(r)-size/2}px,0) rotate(${r.rotation+(reduced?0:Math.max(0,r.age)*r.spin)}deg)`;}
 }
 function draw(s){
  if(!ctx)return;const c=ctx,reduced=window.MKTYExperience?.effectsReduced,t=reduced?0:s.elapsed,x=s.x*w,y=h*.78;
  c.clearRect(0,0,w,h);c.save();
  // Dashed lane boundaries and a quiet illuminated corridor: no baked-in game geometry.
  c.strokeStyle='#b9edff27';c.lineWidth=1;c.setLineDash([3,14]);c.lineDashOffset=-t*17;
  for(const p of [.08,.36,.64,.92]){c.beginPath();c.moveTo(p*w,68);c.lineTo(p*w,h-28);c.stroke();}c.setLineDash([]);
  const glow=c.createLinearGradient(0,h*.3,0,h);glow.addColorStop(0,'#95e8ff00');glow.addColorStop(1,'#98dfff16');c.fillStyle=glow;c.fillRect((lanes[s.lane]-.1)*w,h*.3,w*.2,h*.7);
  if(!reduced&&s.phase==='flight'){
   for(const m of motes){const my=(m.y*h+t*(12+m.z*32))%h;c.strokeStyle=`rgba(207,239,255,${.12+m.z*.2})`;c.lineWidth=m.z;c.beginPath();c.moveTo(m.x*w,my);c.lineTo(m.x*w,my+3+m.z*6);c.stroke();}
   // Exhaust uses a small fixed number of layered tapered plumes.
   c.globalCompositeOperation='screen';for(const off of [-.22,.22]){const px=x+shipW*off,py=y+shipH*.23,len=shipH*(.9+Math.sin(t*16+off)*.12);const plume=c.createLinearGradient(0,py,0,py+len);plume.addColorStop(0,'#edffffdd');plume.addColorStop(.25,'#75dfff9a');plume.addColorStop(1,'#2cb7ff00');c.fillStyle=plume;c.beginPath();c.moveTo(px-shipW*.045,py);c.quadraticCurveTo(px-shipW*.08,py+len*.45,px,py+len);c.quadraticCurveTo(px+shipW*.08,py+len*.45,px+shipW*.045,py);c.fill();}c.globalCompositeOperation='source-over';
  }
  if(s.phase==='approach'||s.phase==='complete'){
   const gy=h*.35,r=Math.min(w*.3,h*.22),arrival=s.phase==='complete'?1:Math.min(1,s.phaseTime/2.4);
   const halo=c.createRadialGradient(w*.5,gy,r*.25,w*.5,gy,r*1.5);halo.addColorStop(0,'#94f3e343');halo.addColorStop(1,'#6de5ee00');c.fillStyle=halo;c.fillRect(w*.5-r*1.5,gy-r*1.5,r*3,r*3);
   for(let i=0;i<3;i++){c.strokeStyle=i===0?'#f7deaccf':'#a4f5e5a0';c.lineWidth=i===0?2:1;c.beginPath();c.ellipse(w*.5,gy,r*(1-i*.14),r*.58*(1-i*.14),0,0,Math.PI*2);c.stroke();}
   c.strokeStyle='#e9fff5';c.lineWidth=3;c.beginPath();c.ellipse(w*.5,gy,r,r*.58,0,-Math.PI/2,-Math.PI/2+Math.PI*2*arrival);c.stroke();
   for(let i=0;i<8;i++){const a=i*Math.PI/4;c.fillStyle=i%2?'#c4fff0':'#ffe4b8';c.beginPath();c.arc(w*.5+Math.cos(a)*r,gy+Math.sin(a)*r*.58,2.5,0,Math.PI*2);c.fill();}
  }
  if(s.flash>0&&!reduced){c.globalAlpha=s.flash;c.strokeStyle=s.flashKind==='shield'?'#b0ffff':'#ffc393';c.lineWidth=2;const r=shipW*(.6+(1-s.flash)*.8);c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.stroke();c.globalAlpha=1;}
  c.restore();
 }
 return {resize,layout,draw,geometry,rockSize,rockY};
}};
