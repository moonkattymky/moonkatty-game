/* One simulation clock drives every moving layer. Decorative detail has a fixed budget. */
const Void7FX={create({world,canvas,ship,bubble}){
 const ctx=canvas.getContext('2d',{alpha:true}),environment=world.querySelector('.v7-environment'),lanes=[.22,.5,.78];
 let w=1,h=1,shipW=72,shipH=48,cost=0,latest=null;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),sector=s=>Math.min(2,Math.floor(s.distance/(100/3)));
 const time=s=>s.elapsed+(s.phase==='approach'?s.phaseTime:0);
 const motes=Array.from({length:42},(_,i)=>({x:((i*73+19)%101)/101,y:((i*31+7)%97)/97,z:(i%3+1)/3}));
 const rock=new Image();rock.src='art/life7-asteroid-v2.webp';rock.onload=()=>{if(latest&&world.closest('.screen.active'))draw(latest);};
 function glow(color){const image=document.createElement('canvas');image.width=image.height=160;const c=image.getContext('2d');if(c){const g=c.createRadialGradient(80,80,0,80,80,80);g.addColorStop(0,color);g.addColorStop(1,'transparent');c.fillStyle=g;c.fillRect(0,0,160,160);}return image;}
 const cyan=glow('#80f6edbc'),gold=glow('#ffe0a688'),blue=glow('#589dff80');
 function resize(){w=Math.max(1,world.clientWidth);h=Math.max(1,world.clientHeight);shipW=ship.offsetWidth||72;shipH=shipW*343/520;const dpr=Math.min(devicePixelRatio||1,1.75);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx?.setTransform(dpr,0,0,dpr,0,0);}
 const geometry=()=>({w,h,shipW,shipH,shipY:h*.78});
 const rockSize=r=>r.big?clamp(w*.125,34,46):clamp(w*.098,26,36);
 const rockY=r=>{const size=rockSize(r);return-size/2+(h+size)*clamp(r.age/r.duration,0,1);};
 function threats(s){
  return lanes.map((_,lane)=>{
   let eta=Infinity,progress=0;
   for(const r of s.rocks){if(r.lane!==lane)continue;const size=rockSize(r),radius=size*.33,y=rockY(r),clear=h*.78+shipH*.23+radius;
    if(r.age>=0&&y>clear)continue;
    const seconds=(h*.78-shipH*.23-radius-y)/((h+size)/r.duration)+Math.max(0,-r.age);
    if(seconds<eta){eta=seconds;progress=clamp(r.age/r.duration,0,1);}
   }
   return {active:Number.isFinite(eta),critical:eta<=.7,eta,progress};
  });
 }
 function layout(s){
  latest=s;const reduced=window.MKTYExperience?.effectsReduced,p=s.phase==='complete'?1:s.phase==='approach'&&!reduced?clamp(s.phaseTime/2.4,0,1):0,arrival=p*p*(3-2*p);
  const x=(s.x+(.5-s.x)*arrival)*w,y=(.78-.43*arrival)*h,t=time(s),bank=reduced?0:clamp((lanes[s.lane]-s.x)*100,-12,12);
  ship.style.transform=`translate3d(${x-shipW/2}px,${y-shipH/2}px,0) rotate(${bank}deg) scale(${1-arrival*.62})`;
  ship.style.setProperty('--v7-engine',s.phase==='flight'?'1':s.phase==='approach'?'.7':'.25');
  environment.style.transform=reduced?'none':`translate3d(${(.5-s.x)*13}px,${Math.sin(t*.13)*3}px,0) scale(${1.045+s.distance*.0002})`;
  bubble.style.transform=`translate3d(${x-shipW*.68}px,${y-shipW*.68}px,0)`;bubble.style.width=bubble.style.height=shipW*1.36+'px';bubble.classList.toggle('armed',s.shieldActive);
  bubble.style.setProperty('--shield-angle',(reduced?0:t*13)+'deg');
  for(const r of s.rocks){const size=rockSize(r);r.el.style.width=r.el.style.height=size+'px';r.el.style.visibility=r.age<0?'hidden':'visible';r.el.style.transform=`translate3d(${lanes[r.lane]*w-size/2}px,${rockY(r)-size/2}px,0) rotate(${r.rotation+(reduced?0:Math.max(0,r.age)*r.spin)}deg)`;}
 }
 function gate(c,s,reduced){
  const gy=h*.35,r=Math.min(w*.32,h*.25),arrival=s.phase==='complete'?1:clamp(s.phaseTime/2.4,0,1),spin=reduced||s.phase==='complete'?.45:s.phaseTime*.22;
  c.save();c.translate(w*.5,gy);c.globalCompositeOperation='screen';c.globalAlpha=.35+arrival*.35;c.drawImage(cyan,-r*1.7,-r*1.25,r*3.4,r*2.5);c.globalAlpha=1;c.globalCompositeOperation='source-over';
  c.fillStyle='#08293d7a';c.beginPath();c.ellipse(0,0,r*.87,r*.5,0,0,Math.PI*2);c.fill();
  for(let i=0;i<5;i++){c.strokeStyle=['#0b2b42','#efdaa9','#9cece6','#426774','#d4fbef'][i];c.lineWidth=[7,2,1,3,1][i];c.beginPath();c.ellipse(0,i===0?4:0,r*(1-i*.055),r*.59*(1-i*.055),0,0,Math.PI*2);c.stroke();}
  for(let i=0;i<12;i++){const a=i*Math.PI/6,px=Math.cos(a)*r,py=Math.sin(a)*r*.59;c.save();c.translate(px,py);c.rotate(Math.atan2(Math.cos(a)*.59,-Math.sin(a)));c.fillStyle=i%3?'#3f6570':'#f5daa8';c.fillRect(-4,-2,8,4);c.restore();}
  c.strokeStyle='#f0fff4';c.lineWidth=3;c.beginPath();c.ellipse(0,0,r*.92,r*.54,0,-Math.PI/2,-Math.PI/2+Math.PI*2*arrival);c.stroke();
  c.strokeStyle='#a8f6e575';c.lineWidth=1;c.setLineDash([r*.12,r*.1]);c.lineDashOffset=-spin*r;c.beginPath();c.ellipse(0,0,r*.69,r*.4,0,0,Math.PI*2);c.stroke();c.setLineDash([]);
  for(let i=0;i<3;i++){const a=spin+i*Math.PI*2/3;c.globalAlpha=.85;c.drawImage(cyan,Math.cos(a)*r*.92-9,Math.sin(a)*r*.54-9,18,18);}c.restore();
 }
 function draw(s){
  latest=s;if(!ctx)return;const started=performance.now(),c=ctx,reduced=window.MKTYExperience?.effectsReduced,low=reduced||cost>5,t=reduced?0:time(s),x=s.x*w,y=h*.78,n=sector(s),live=s.phase==='flight';
  c.clearRect(0,0,w,h);c.save();
  // Distant rocks stay outside the playable lanes.
  if(rock.complete&&rock.naturalWidth&&!low&&h>180){for(let i=0;i<4;i++){const size=Math.min(84,w*.23)*(i%2?.72:1),px=i%2?w+size*.15:-size*.15,py=((i*.29+t*.008)%1)*(h+size)-size*.5;c.save();c.globalAlpha=.28;c.translate(px,py);c.rotate(i*1.7+t*.025);c.drawImage(rock,-size/2,-size/2,size,size);c.restore();}}
  c.globalCompositeOperation='screen';c.globalAlpha=n===1?.18:.12;c.drawImage(n===1?gold:blue,-w*.5,h*.08,w*1.2,h*.7);c.globalAlpha=1;c.globalCompositeOperation='source-over';
  c.strokeStyle='#b9edff26';c.lineWidth=1;c.setLineDash([3,14]);c.lineDashOffset=-t*17;
  for(const p of [.08,.36,.64,.92]){c.beginPath();c.moveTo(p*w,68);c.lineTo(p*w,h-28);c.stroke();}c.setLineDash([]);
  const light=c.createLinearGradient(0,h*.3,0,h);light.addColorStop(0,'#95e8ff00');light.addColorStop(1,'#98dfff18');c.fillStyle=light;c.fillRect((lanes[s.lane]-.1)*w,h*.3,w*.2,h*.7);
  if(live){
   const danger=threats(s);
   for(let i=0;i<3;i++){
    if(!danger[i].active)continue;const px=lanes[i]*w,critical=danger[i].critical&&i===s.lane,r=w*.083;
    c.strokeStyle=critical?'#ffbd96b0':'#ffe0a460';c.lineWidth=critical?2:1;c.beginPath();c.moveTo(px-r,y-shipH*.2);c.lineTo(px-r,y+shipH*.25);c.lineTo(px-r+6,y+shipH*.25);c.moveTo(px+r,y-shipH*.2);c.lineTo(px+r,y+shipH*.25);c.lineTo(px+r-6,y+shipH*.25);c.stroke();
    if(critical){c.globalAlpha=.17;c.drawImage(gold,px-r*2,y-r*2,r*4,r*4);c.globalAlpha=1;}
   }
  }
  if(!reduced&&live){
   for(const m of motes.slice(0,low?18:42)){const my=(m.y*h+t*(8+m.z*36))%h;c.strokeStyle=`rgba(207,239,255,${.12+m.z*.2})`;c.lineWidth=m.z;c.beginPath();c.moveTo(m.x*w,my);c.lineTo(m.x*w,my+2+m.z*6);c.stroke();}
   c.globalCompositeOperation='screen';c.globalAlpha=.55;c.drawImage(cyan,x-shipW*.5,y+shipH*.02,shipW,shipH*1.8);c.globalAlpha=1;
   for(const off of [-.22,.22]){const px=x+shipW*off,py=y+shipH*.23,len=shipH*(.85+Math.sin(t*16+off)*.09),plume=c.createLinearGradient(0,py,0,py+len);plume.addColorStop(0,'#edfffff0');plume.addColorStop(.3,'#75dfff9a');plume.addColorStop(1,'#2cb7ff00');c.fillStyle=plume;c.beginPath();c.moveTo(px-shipW*.038,py);c.quadraticCurveTo(px-shipW*.065,py+len*.45,px,py+len);c.quadraticCurveTo(px+shipW*.065,py+len*.45,px+shipW*.038,py);c.fill();}
   const steering=clamp((lanes[s.lane]-s.x)*12,-1,1);if(Math.abs(steering)>.02){const side=steering>0?-1:1;c.globalAlpha=Math.abs(steering)*.7;c.drawImage(cyan,x+side*shipW*.44-shipW*.17,y-shipH*.18,shipW*.34,shipH*.45);c.globalAlpha=1;}
   c.globalCompositeOperation='source-over';
  }
  if(s.checkpointFor>0&&!reduced){const a=1-s.checkpointFor/2;c.globalAlpha=Math.sin(a*Math.PI)*.6;c.strokeStyle='#c9ffe6';c.lineWidth=2;c.beginPath();c.ellipse(w*.5,h*(.25+a*.8),w*.43,12+a*28,0,0,Math.PI*2);c.stroke();c.globalAlpha=1;}
  if(s.phase==='approach'||s.phase==='complete')gate(c,s,reduced);
  if(s.flash>0&&!reduced){
   const impact=s.impact||{x:s.x,y:.78},px=impact.x*w,py=impact.y*h,age=1-s.flash;c.save();c.globalAlpha=s.flash;c.strokeStyle=s.flashKind==='shield'?'#b0ffff':'#ffc393';c.lineWidth=2;c.beginPath();c.arc(px,py,shipW*(.45+age*.9),0,Math.PI*2);c.stroke();c.globalCompositeOperation='screen';c.drawImage(s.flashKind==='shield'?cyan:gold,px-shipW,py-shipW,shipW*2,shipW*2);c.globalCompositeOperation='source-over';
   if(!low)for(let i=0;i<10;i++){const a=i*2.3999,r=age*shipW*(.7+(i%3)*.22);c.fillStyle=s.flashKind==='shield'?'#c2fff6':'#ffdfae';c.fillRect(px+Math.cos(a)*r,py+Math.sin(a)*r+age*age*12,1.4+(i%2),1.4+(i%2));}c.restore();
  }
  c.restore();cost=cost*.9+(performance.now()-started)*.1;
 }
 return {resize,layout,draw,geometry,rockSize,rockY,threats};
}};
