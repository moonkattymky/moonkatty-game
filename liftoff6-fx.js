/* Flight presentation: compositor-driven ship at display refresh rate,
   bounded canvas effects at 30 Hz, and cached lunar surface lighting. */
window.Liftoff6FX=(()=>{
 function create({scene,canvas,ship,environment,target}){
  const ctx=canvas.getContext('2d'),stars=Array.from({length:48},(_,i)=>({x:(i*.61803398875)%1,y:(i*.38196601125)%1,size:i%5===0?1.3:.65}));
  let width=1,height=1,dpr=1,size=110,hud=45,bank=0,x=0,y=0,phase='',orbital=0;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const glowTexture=document.createElement('canvas');glowTexture.width=glowTexture.height=64;
  const g=glowTexture.getContext('2d');if(g){const light=g.createRadialGradient(32,32,0,32,32,32);light.addColorStop(0,'#f4ffff');light.addColorStop(.14,'#b8f5ffe0');light.addColorStop(.42,'#61ccff50');light.addColorStop(1,'#50baff00');g.fillStyle=light;g.fillRect(0,0,64,64);}
  const moon=document.createElement('canvas');moon.width=1024;moon.height=384;
  const m=moon.getContext('2d');if(m){
   m.save();m.beginPath();m.ellipse(512,410,680,370,0,0,Math.PI*2);m.clip();
   const rock=m.createLinearGradient(0,40,0,384);rock.addColorStop(0,'#dce8ef');rock.addColorStop(.10,'#b7c9d4');rock.addColorStop(.45,'#6d8da1');rock.addColorStop(1,'#1a3e58');m.fillStyle=rock;m.fillRect(0,0,1024,384);
   for(let i=0;i<90;i++){
    const cx=(i*197.13)%1024,cy=62+(i*97.71)%340,r=4+(i*13.31)%42;
    m.fillStyle='#102b4624';m.beginPath();m.ellipse(cx,cy,r,r*.32,0,0,Math.PI*2);m.fill();
    m.strokeStyle='#edf8ff28';m.lineWidth=1.5;m.beginPath();m.ellipse(cx,cy-2,r,r*.32,0,Math.PI,Math.PI*2);m.stroke();
   }
   m.restore();m.strokeStyle='#e9faffb0';m.lineWidth=2;m.beginPath();m.ellipse(512,410,680,370,0,Math.PI,Math.PI*2);m.stroke();
  }
  function resize(){
   width=scene.clientWidth;height=scene.clientHeight;if(!width||!height)return;
   dpr=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
   size=Math.max(56,Math.min(142,width*.32,(height-65)*1.45));hud=scene.querySelector('.lf-telemetry').offsetHeight;
   ship.style.width=size+'px';ship.style.left=ship.style.top='0';
  }
  function pose(s,dt,reduced){
   const flight=['flight','orbit','complete'].includes(s.phase)||s.phase==='abort'&&s.failedStage==='flight';
   const rise=clamp(s.alt/500,0,1);orbital=s.phase==='orbit'?clamp(s.phaseTime/3,0,1):s.phase==='complete'?1:0;
   x=s.x/100*width;y=Math.min((flight?.69-rise*.23:.71)*height,height-hud-14-size*.33);
   const desired=reduced?0:clamp(s.vx*.65,-12,12);bank+=(desired-bank)*(dt?1-Math.exp(-dt*9):1);
   const settle=reduced?0:Math.sin(s.elapsed*2.1)*.6*(s.phase==='flight'?1:0);
   ship.style.transform='translate3d('+(x-size/2)+'px,'+(y-size*.3298+settle)+'px,0) rotate('+bank+'deg) scale('+(1-orbital*.22)+')';
   scene.style.setProperty('--engine',String(flight?s.throttle/80:s.phase==='ignition'?.2+s.hold/4:s.phase==='countdown'?.9:.12));
   scene.style.setProperty('--orbit',String(clamp((s.alt-220)/1800,0,.94)));
   environment.style.transform='translate3d(0,'+(rise*height*.06)+'px,0) scale('+(1.04+rise*.12)+')';environment.style.opacity=String(1-clamp((s.alt-500)/1500,0,1));
   if(phase!==s.phase){phase=s.phase;scene.dataset.flight=String(flight);}
  }
  function glow(px,py,r,alpha){ctx.globalAlpha=alpha;ctx.drawImage(glowTexture,px-r,py-r,r*2,r*2);}
  function draw(s,{left=false,right=false,reduced=false,detail=1}={}){
   if(!ctx||!width||!height)return;
   const flight=['flight','orbit','complete'].includes(s.phase)||s.phase==='abort'&&s.failedStage==='flight';
   const time=reduced?0:s.elapsed,power=s.phase==='flight'?s.throttle/100:s.phase==='orbit'?(1-orbital)*.35:s.phase==='ignition'?s.hold/4:s.phase==='countdown'?.7:0;
   ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
   // The pad recedes into a curved lunar horizon without stretching either artwork.
   const horizon=clamp((s.alt-1600)/1400,0,1);
   if(horizon>0){ctx.globalAlpha=horizon*.88;ctx.drawImage(moon,-width*.12,height*(.70+orbital*.08),width*1.24,height*.55);ctx.globalAlpha=1;}
   if(flight){
    for(const star of stars){ctx.fillStyle='#d4f0ff';ctx.globalAlpha=(.17+star.size*.11)*clamp(s.alt/850,0,1);ctx.fillRect(star.x*width,(star.y*height+time*(star.size*.45))%height,star.size,star.size);}
    ctx.globalAlpha=1;
   }
   if(s.phase==='flight'||s.phase==='abort'&&s.failedStage==='flight'){
    const ahead=700,py=alt=>y-(alt-s.alt)/ahead*height;
    // The entire band has the exact same ±14% safety envelope as flight physics.
    ctx.beginPath();for(let d=-200;d<=900;d+=25){const px=(target(s.alt+d)-14)/100*width;if(d===-200)ctx.moveTo(px,py(s.alt+d));else ctx.lineTo(px,py(s.alt+d));}
    for(let d=900;d>=-200;d-=25)ctx.lineTo((target(s.alt+d)+14)/100*width,py(s.alt+d));ctx.closePath();
    const lane=ctx.createLinearGradient(0,0,0,height);lane.addColorStop(0,'#91f4e207');lane.addColorStop(.65,s.offCourse>1?'#ffc38e24':'#8aefd11c');lane.addColorStop(1,'#6be5d005');ctx.fillStyle=lane;ctx.fill();
    ctx.lineWidth=1;ctx.strokeStyle=s.offCourse>1?'#ffd3a699':'#a7f4d67a';ctx.setLineDash([5,8]);
    for(const side of [-14,14]){ctx.beginPath();for(let d=-200;d<=900;d+=25){const px=(target(s.alt+d)+side)/100*width;if(d===-200)ctx.moveTo(px,py(s.alt+d));else ctx.lineTo(px,py(s.alt+d));}ctx.stroke();}ctx.setLineDash([]);
    for(let alt=Math.floor((s.alt-150)/160)*160;alt<s.alt+900;alt+=160){const cy=py(alt);if(cy<30||cy>height-hud)continue;const cx=target(alt)/100*width;ctx.strokeStyle='#baf6dc66';ctx.beginPath();ctx.moveTo(cx-4,cy+3);ctx.lineTo(cx,cy);ctx.lineTo(cx+4,cy+3);ctx.stroke();}
    const next=(s.gates+1)*1000,gy=py(next),gx=target(next)/100*width;
    if(s.gates<3&&gy>-30&&gy<height){
     const radius=width*.14,depth=Math.min(16,height*.055),ready=s.speed>=35&&s.speed<=110&&s.temp<=92;
     ctx.save();ctx.strokeStyle=ready?'#b5ffd9':'#ffd4a4';ctx.lineWidth=2.5;ctx.shadowColor=ready?'#7deac5':'#ffc47b';ctx.shadowBlur=reduced?0:10;
     ctx.beginPath();ctx.ellipse(gx,gy,radius,depth,0,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;
     for(const side of [-1,1]){ctx.fillStyle='#e6fff2';ctx.fillRect(gx+side*radius-2,gy-5,4,10);}
     ctx.fillStyle='#e4fff0';ctx.font='bold 10px monospace';ctx.textAlign='center';ctx.fillText(String(s.gates+1).padStart(2,'0'),gx,gy-depth-8);ctx.restore();
    }
    // In-scene alignment reticle, so attention can stay on the spacecraft.
    ctx.strokeStyle=s.offCourse>0?'#ffc697aa':'#cdf8e57a';ctx.lineWidth=1;
    const r=size*.48;for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(x+side*r,y-7);ctx.lineTo(x+side*(r+5),y-7);ctx.lineTo(x+side*(r+5),y+7);ctx.lineTo(x+side*r,y+7);ctx.stroke();}
   }
   ctx.globalCompositeOperation='screen';
   if(power>0){
    const radians=bank*Math.PI/180;
    for(const side of [-1,1]){
     const ox=side*size*.21,oy=size*.17,ex=x+ox*Math.cos(radians)-oy*Math.sin(radians),ey=y+ox*Math.sin(radians)+oy*Math.cos(radians);
     ctx.save();ctx.translate(ex,ey);ctx.rotate(radians);
     const length=18+power*size*.58,widthJet=3+power*3,flicker=reduced?1:1+Math.sin(time*29+side)*.045;
     const flame=ctx.createLinearGradient(0,0,0,length);flame.addColorStop(0,'#f5ffffe8');flame.addColorStop(.18,'#b6f2ffb0');flame.addColorStop(.58,'#53c9ff65');flame.addColorStop(1,'#3796ff00');ctx.fillStyle=flame;
     ctx.globalAlpha=.55;ctx.beginPath();ctx.moveTo(-widthJet,0);ctx.quadraticCurveTo(-widthJet*1.3,length*.45,0,length*flicker);ctx.quadraticCurveTo(widthJet*1.3,length*.45,widthJet,0);ctx.fill();
     glow(0,2,14+power*13,.18+power*.32);
     const count=reduced?0:Math.round(10*detail);for(let i=0;i<count;i++){const t=(time*1.6+i/count)%1;glow(Math.sin(i*3.7)*t*5,t*length,3+t*6,(1-t)*power*.22);}
     ctx.restore();
    }
   }
   if(s.phase==='flight'&&!reduced&&(left||right)){
    const side=left?1:-1;for(let i=0;i<5;i++){const t=(time*4+i/5)%1;glow(x+side*size*(.36+t*.23),y+size*.025,3+t*4,(1-t)*.55);}
   }
   if(s.alt<400&&power>0&&!reduced){const energy=power*(1-s.alt/400);for(let i=0;i<Math.round(20*detail);i++){const t=(time*.65+i/20)%1,side=i%2?1:-1;glow(width*.5+side*t*width*.48,height*.85-t*height*.07,10+t*30,(1-t)*energy*.17);}}
   if(s.phase==='flight'&&!reduced)for(let i=0;i<Math.round(16*detail);i++){const sx=(i*79.7)%width,sy=(i*43.9+time*s.speed*.24)%height;ctx.globalAlpha=.16;ctx.strokeStyle='#c0e6ff';ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(sx,sy+2+s.speed*.035);ctx.stroke();}
   if(s.flash>.05&&!reduced){ctx.globalAlpha=s.flash*.4;ctx.strokeStyle='#d7ffcf';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,y,30+(1-s.flash)*85,15+(1-s.flash)*40,0,0,Math.PI*2);ctx.stroke();}
   ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  }
  return {resize,pose,draw,reset(){bank=0;phase='';}};
 }
 return {create};
})();
