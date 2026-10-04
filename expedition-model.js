/* Deterministic, browser-independent flight rules. No campaign rewards are changed. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ExpeditionRules = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const SIZE = 3200, BASE = {x:1600,y:2880}, TYPES = ['rescue','salvage','survey'];
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
  function random(seed) { let a=seed>>>0;return ()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;}; }
  function profile() { return {parts:0,wins:0,flights:0,rescued:0,upgrades:{hull:0,engine:0,scanner:0},records:[0,0,0]}; }
  const maxHull = p => 100+p.upgrades.hull*25;
  const price = (p,k) => [80,140,220][p.upgrades[k]]||0;
  const unlocked = p => p.wins>=3?3:p.wins>=1?2:1;
  function create(seed,type,tier,p) {
    const rng=random(seed), jitter=v=>v+(rng()-.5)*240;
    const points=[
      {id:'relay-a',kind:'relay',x:jitter(820),y:jitter(2020)},
      {id:'relay-b',kind:'relay',x:jitter(2470),y:jitter(1430)},
      {id:'relay-c',kind:'relay',x:jitter(970),y:jitter(600)},
      {id:'pod-a',kind:'pod',x:jitter(2320),y:jitter(2230)},
      {id:'pod-b',kind:'pod',x:jitter(1200),y:jitter(1100)},
      {id:'wreck',kind:'wreck',x:jitter(2100),y:jitter(570)},
      {id:'cache-a',kind:'cache',x:jitter(470),y:jitter(1450)},
      {id:'cache-b',kind:'cache',x:jitter(2760),y:jitter(780)},
      {id:'service',kind:'service',x:jitter(1730),y:jitter(1730)}
    ].map(p=>({...p,done:false,seen:false,work:0}));
    const rocks=[];
    for(let i=0;i<82+tier*12;i++) {
      const rock={x:150+rng()*2900,y:180+rng()*2700,r:24+rng()*46,rotation:rng()*6.28};
      // Every interaction has a clear approach and the launch area is safe.
      if(distance(rock,BASE)<330||points.some(p=>distance(rock,p)<180))continue;
      rocks.push(rock);
    }
    const fields=[{x:450,y:700,r:230},{x:2820,y:1760,r:210},{x:1750,y:1100,r:165}];
    const drones=Array.from({length:tier+1},(_,i)=>({id:i,x:650+i*710,y:850+(i%2)*700,homeX:650+i*710,homeY:850+(i%2)*700,disabled:0,aim:0,cooldown:3+i,targetX:0,targetY:0}));
    return {seed:seed>>>0,type,tier,phase:'flight',time:0,ship:{...BASE,vx:0,vy:0,angle:0,hull:maxHull(p),energy:100,invulnerable:0},points,rocks,fields,drones,shots:[],cargo:0,rescued:0,emp:0,scan:0,alert:0,scanWave:0,pulse:0,damage:0,target:null,notice:'launch',noticeUntil:7,interacting:null,report:null};
  }
  const primary = (r,p) => r.type==='rescue'?p.kind==='pod':r.type==='salvage'?['relay-a','relay-b','wreck'].includes(p.id):p.kind==='relay';
  const ready = r => r.type==='rescue'?r.points.filter(p=>p.kind==='pod'&&p.done).length===2:r.type==='salvage'?r.points.find(p=>p.id==='wreck').done:r.points.filter(p=>p.kind==='relay'&&p.done).length===3;
  const relays = r => r.points.filter(p=>p.kind==='relay'&&p.done).length;
  const locked = (r,p) => p.kind==='wreck'&&relays(r)<2;
  function target(r) {
    if(r.target==='base')return {...BASE,id:'base',kind:'base'};
    const selected=r.points.find(p=>p.id===r.target&&!p.done);
    if(selected)return selected;
    if(ready(r))return {...BASE,id:'base',kind:'base'};
    return r.points.filter(p=>!p.done&&primary(r,p)&&!locked(r,p)).sort((a,b)=>distance(a,r.ship)-distance(b,r.ship))[0];
  }
  function near(r) {
    if(distance(r.ship,BASE)<105)return {...BASE,id:'base',kind:'base'};
    return r.points.filter(p=>!p.done&&distance(p,r.ship)<105).sort((a,b)=>distance(a,r.ship)-distance(b,r.ship))[0]||null;
  }
  function notice(r,text) {r.notice=text;r.noticeUntil=r.time+5;}
  function hit(r,amount) {if(r.ship.invulnerable>0)return;r.ship.hull=Math.max(0,r.ship.hull-amount);r.ship.invulnerable=.8;r.damage=.4;notice(r,'damage');}
  function step(r,p,input,dt) {
    if(r.phase!=='flight')return null;
    dt=clamp(dt,0,.04);r.time+=dt;
    const s=r.ship;
    for(const key of ['emp','scan','scanWave','pulse','damage','alert'])r[key]=Math.max(0,r[key]-dt);
    s.invulnerable=Math.max(0,s.invulnerable-dt);
    let ix=input.x||0,iy=input.y||0;const mag=Math.hypot(ix,iy);if(mag>1){ix/=mag;iy/=mag;}
    const boost=!!input.boost&&mag>.1&&s.energy>2;
    const speed=(155+p.upgrades.engine*25)*(boost?1.7:1);
    s.energy=clamp(s.energy+(boost?-25:14)*dt,0,100);
    s.vx+=(ix*speed-s.vx)*Math.min(1,dt*7);s.vy+=(iy*speed-s.vy)*Math.min(1,dt*7);
    s.x=clamp(s.x+s.vx*dt,60,SIZE-60);s.y=clamp(s.y+s.vy*dt,60,SIZE-60);
    if(Math.hypot(s.vx,s.vy)>12){const a=Math.atan2(s.vx,-s.vy);let d=((a-s.angle+Math.PI*3)%(Math.PI*2))-Math.PI;s.angle+=d*Math.min(1,dt*9);}
    for(const rock of r.rocks) {
      const d=distance(s,rock),radius=rock.r+19;
      if(d<radius){const ax=(s.x-rock.x)/(d||1),ay=(s.y-rock.y)/(d||1);s.x=rock.x+ax*(radius+1);s.y=rock.y+ay*(radius+1);s.vx*=.25;s.vy*=.25;hit(r,10+r.tier*2);}
    }
    for(const f of r.fields)if(distance(f,s)<f.r){s.hull=Math.max(0,s.hull-dt*(4+r.tier));notice(r,'radiation');}
    r.points.forEach(o=>{if(distance(o,s)<330+p.upgrades.scanner*90)o.seen=true;});
    for(const d of r.drones) {
      d.disabled=Math.max(0,d.disabled-dt);if(d.disabled)continue;
      const chasing=distance(d,s)<(r.alert>0?1000:530)&&distance(s,BASE)>300;
      if(d.aim>0) {
        d.aim=Math.max(0,d.aim-dt);
        if(!d.aim){const a=Math.atan2(d.targetY-d.y,d.targetX-d.x);r.shots.push({x:d.x,y:d.y,vx:Math.cos(a)*320,vy:Math.sin(a)*320,life:2.3});d.cooldown=2.4-r.tier*.25;}
      } else {
        d.cooldown=Math.max(0,d.cooldown-dt);
        const tx=chasing?s.x:d.homeX+Math.sin(r.time*.2+d.id)*130,ty=chasing?s.y:d.homeY+Math.cos(r.time*.2+d.id)*130;
        const dd=Math.hypot(tx-d.x,ty-d.y);
        if(dd>(chasing?240:5)){d.x+=(tx-d.x)/dd*(chasing?(r.alert>0?110:65)+r.tier*8:38)*dt;d.y+=(ty-d.y)/dd*(chasing?(r.alert>0?110:65)+r.tier*8:38)*dt;}
        if(chasing&&d.cooldown===0){d.aim=.95;d.targetX=s.x+s.vx*.45;d.targetY=s.y+s.vy*.45;}
      }
    }
    r.shots=r.shots.filter(b=>{b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;if(distance(b,s)<24){hit(r,12+r.tier*3);return false;}return b.life>0;});
    const n=near(r);r.interacting=null;
    // Moving away or taking evasive action preserves completed salvage work.
    if(input.action&&n&&Math.hypot(s.vx,s.vy)<65) {
      if(n.kind==='base'){if(ready(r))return finish(r,p,true);notice(r,'incomplete');}
      else if(locked(r,n))notice(r,'locked');
      else {
        r.interacting=n.id;n.work=Math.min(1,n.work+dt/(n.kind==='wreck'?4:2.4));
        if(n.work>=1){n.done=true;r.target=null;
          if(n.kind==='pod'){r.alert=18;r.rescued++;r.cargo+=15;notice(r,'rescued');}
          if(n.kind==='cache'){r.cargo+=30;notice(r,'salvaged');}
          if(n.kind==='relay'){r.cargo+=10;notice(r,'relay');r.points.filter(p=>distance(p,n)<900).forEach(p=>p.seen=true);}
          if(n.kind==='wreck'){r.alert=25;r.cargo+=65;notice(r,'blackbox');}
          if(n.kind==='service'){s.hull=Math.min(maxHull(p),s.hull+45);s.energy=100;notice(r,'repaired');}
        }
      }
    }
    if(s.hull<=0)return finish(r,p,false);
    return null;
  }
  function action(r,p,kind) {
    if(r.phase!=='flight')return false;
    if(['repair','strip'].includes(kind)){const point=near(r);if(point?.kind!=='service'||Math.hypot(r.ship.vx,r.ship.vy)>65)return false;point.done=true;point.work=1;if(kind==='repair'){r.ship.hull=Math.min(maxHull(p),r.ship.hull+45);r.ship.energy=100;notice(r,'repaired');}else{r.cargo+=40;notice(r,'salvaged');}return true;}
    if(kind==='scan'&&r.scan===0&&r.ship.energy>=15){r.ship.energy-=15;r.scan=5;r.scanWave=1.3;r.points.filter(o=>distance(o,r.ship)<850+p.upgrades.scanner*180).forEach(p=>p.seen=true);notice(r,'scanned');return true;}
    if(kind==='emp'&&r.emp===0&&r.ship.energy>=35){r.ship.energy-=35;r.emp=7;r.pulse=.65;r.drones.filter(d=>distance(d,r.ship)<370).forEach(d=>{d.disabled=6;d.aim=0;d.cooldown=2;});r.shots=r.shots.filter(b=>distance(b,r.ship)>370);notice(r,'emp');return true;}
    return false;
  }
  function finish(r,p,success,abort=false) {
    if(r.phase!=='flight')return r.report;
    if((success||abort)&&distance(r.ship,BASE)>=105)return null;
    if(success&&!ready(r))return null;
    const reward=success?70+r.tier*25+r.cargo:abort?Math.floor(r.cargo*.35):0;
    r.phase='result';r.report={success,abort,reward,time:Math.round(r.time),cargo:r.cargo,rescued:success||abort?r.rescued:0,tier:r.tier};
    p.parts+=reward;p.flights++;p.rescued+=r.report.rescued;
    if(success){p.wins++;p.records[r.tier-1]=Math.max(p.records[r.tier-1],reward);}
    return r.report;
  }
  function buy(p,key) {if(!Object.hasOwn(p.upgrades,key))return false;const cost=price(p,key);if(!cost||p.parts<cost)return false;p.parts-=cost;p.upgrades[key]++;return true;}
  // One storage envelope makes settlement and the completed flight atomic.
  function restore(data) {
    const clean={version:1,profile:profile(),run:null};
    const int=(n,a,b)=>Number.isInteger(n)&&n>=a&&n<=b;
    const num=(n,a,b)=>Number.isFinite(n)&&n>=a&&n<=b;
    if(!data||data.version!==1||!data.profile)return clean;
    const p=data.profile;
    for(const k of ['parts','wins','flights','rescued'])if(int(p[k],0,1e8))clean.profile[k]=p[k];
    for(const k of ['hull','engine','scanner'])if(int(p.upgrades?.[k],0,3))clean.profile.upgrades[k]=p.upgrades[k];
    clean.profile.records=[0,1,2].map(i=>int(p.records?.[i],0,1e6)?p.records[i]:0);
    const r=data.run;
    if(!r||!int(r.seed,0,4294967295)||!TYPES.includes(r.type)||!int(r.tier,1,3)||!['flight','result'].includes(r.phase))return clean;
    const original=create(r.seed,r.type,r.tier,clean.profile),s=r.ship;
    if(!s||!['x','y'].every(k=>num(s[k],0,SIZE))||!['vx','vy'].every(k=>num(s[k],-600,600))||!num(s.hull,0,maxHull(clean.profile))||!num(s.energy,0,100)||!num(s.angle,-1000,1000)||!num(s.invulnerable,0,1)||!num(r.time,0,1e7)||!int(r.cargo,0,300)||!int(r.rescued,0,2))return clean;
    if(!Array.isArray(r.points)||r.points.length!==original.points.length||r.points.some((o,i)=>o.id!==original.points[i].id||typeof o.done!=='boolean'||typeof o.seen!=='boolean'||!num(o.work,0,1)))return clean;
    original.points.forEach((o,i)=>Object.assign(o,{done:r.points[i].done,seen:r.points[i].seen,work:r.points[i].work}));
    if(!Array.isArray(r.drones)||r.drones.length!==original.drones.length||r.drones.some(d=>!['x','y','targetX','targetY'].every(k=>num(d[k],-1000,4200))||!num(d.aim,0,1)||!num(d.disabled,0,6)||!num(d.cooldown,0,10)))return clean;
    original.drones.forEach((d,i)=>{for(const k of ['x','y','targetX','targetY','aim','disabled','cooldown'])d[k]=r.drones[i][k];});
    if(!Array.isArray(r.shots)||r.shots.length>20||r.shots.some(b=>!['x','y'].every(k=>num(b[k],-1000,4200))||!['vx','vy'].every(k=>num(b[k],-350,350))||!num(b.life,0,2.3)))return clean;
    original.shots=r.shots.map(b=>({...b}));
    for(const k of ['emp','scan','scanWave','pulse','damage','alert']){if(!num(r[k],0,k==='alert'?25:7))return clean;original[k]=r[k];}
    Object.assign(original,{ship:{...s},time:r.time,cargo:r.cargo,rescued:r.rescued,phase:r.phase,target:r.target==='base'||original.points.some(p=>p.id===r.target)?r.target:null});
    if(r.phase==='result') {
      const report=r.report;
      if(!report||typeof report.success!=='boolean'||typeof report.abort!=='boolean'||!int(report.reward,0,500)||!int(report.time,0,1e7)||!int(report.rescued,0,2))return clean;
      original.report={...report};
    }
    original.notice='resumed';original.noticeUntil=r.time+5;clean.run=original;return clean;
  }
  return {SIZE,BASE,TYPES,clamp,distance,random,profile,create,maxHull,price,unlocked,primary,ready,relays,locked,target,near,step,action,finish,buy,restore};
});
