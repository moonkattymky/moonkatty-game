/* Spatial mission rules. Deterministic state, no timers or DOM dependencies. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FieldRules=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 const kinds=['','rover','crew','trajectory','survey','thermal','docking','stealth','signal','convoy','decode','gate'];
 function random(seed){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
 function createLegacy(n,stage,seed){const rnd=random(seed),s={version:1,n,stage,seed:seed>>>0,kind:kinds[n],seconds:0,moves:0,errors:0,complete:false,notice:'intro',selected:0};
  if(n===1||n===7){s.pos=30;s.collected=[];s.turn=0;s.energy=4;s.alert=0;s.scanned=false;s.pos=layout(s).start;}
  if(n===2){s.jobs=[];s.crew=0;s.energy=3;s.selected=0;}
  if(n===3){s.angle=40;s.power=48;s.burn=0;s.trails=[];}
  if(n===4){s.scans=[];s.pad=null;s.samples=[];s.selected=0;}
  if(n===5){s.valves=[25,50,75];s.stable=0;}
  if(n===6){s.ship={x:80,y:370,vx:0,vy:0};s.docked=0;s.integrity=100;s.hold=0;s.impacts=0;}
  if(n===8){s.angles=[20,150,270];s.station=0;s.samples=[false,false,false];s.pin=null;}
  if(n===9){s.ships=[[0,1,2],[0,2,1],[2,0,1],[1,0,2]][stage%4].slice();s.selected=0;s.gate=false;s.cells=3;s.evacuated=[];}
  return s;
 }
 function layoutLegacy(s){const rnd=random(s.seed),n=s.n,t=s.stage;
  if(n===1||n===7){const rotation=(s.seed+t)%4,flip=((s.seed>>>2)+t)%2,transform=i=>{let x=i%6,y=Math.floor(i/6);if(flip)x=5-x;for(let j=0;j<rotation;j++)[x,y]=[5-y,x];return y*6+x;};const walls=[7,8,10,13,16,19,22,25];return {size:6,start:transform(30),walls:walls.map(transform),targets:(t%2?[2,15,33]:[9,17,27]).map(transform),exit:transform(5),cover:[0,6,12,18,24,30,31,32,33,34,35,5,11,17,23,29].map(transform),hazards:n===1?[9,20,27].map(transform):[],watchers:[{at:transform(14),dir:(s.turn+1+rotation)%4},{at:transform(21),dir:(s.turn+3+rotation)%4}]};}
  if(n===2){const roles=[1,0,2,1,2,0],permutation=[0,1,2,3,4,5].map(i=>(i+t*2)%6),jobs=[];roles.forEach((role,i)=>jobs[permutation[i]]={role:(role+t)%3,requires:(i===0||i===1?[]:i===2?[0]:i===3?[1]:i===4?[2,3]:[4]).map(j=>permutation[j]),cost:i===2?2:1,gain:i===0||i===1?2:i===3?1:0});return {jobs};}
  if(n===3){const targets=Array.from({length:3},(_,i)=>{const angle=35+Math.floor(rnd()*34),power=43+Math.floor(rnd()*21),p=trajectory(angle,power);return{...p,angle,power,radius:22-Math.min(t,3)*2};});return {origin:{x:70,y:390},target:targets[s.burn]||targets[2],targets};}
  if(n===4){const safe=(s.seed%4)*6+8,tiles=Array.from({length:36},(_,i)=>({slope:2+Math.floor(rnd()*13),wind:3+Math.floor(rnd()*19),strength:35+Math.floor(rnd()*60)}));tiles[safe]={slope:2,wind:6,strength:92};tiles[(safe+11)%36]={slope:4,wind:9,strength:85};return{tiles,safe,requiredStrength:70+t*3,maxWind:12-t,maxSlope:5};}
  if(n===5){const target=[35+Math.floor(rnd()*31),35+Math.floor(rnd()*31),35+Math.floor(rnd()*31)];return {target,desired:thermal(target),tolerance:3.5-Math.min(t,3)*.4};}
  if(n===6){const bays=t%2?[{x:115,y:100},{x:435,y:90},{x:470,y:345}]:[{x:470,y:345},{x:435,y:90},{x:115,y:100}];return{bays,target:bays[s.docked]||bays[2],walls:[{x:235,y:185,w:125,h:85}],accel:70+t*8};}
  if(n===8){const source={x:210+rnd()*190,y:115+rnd()*165},stations=[{x:65,y:365},{x:525,y:365},{x:290,y:48}];return{source,stations,bearings:stations.map(a=>(Math.atan2(source.y-a.y,source.x-a.x)*180/Math.PI+360)%360),tolerance:7-Math.min(t,3)};}
  if(n===9)return {nodes:[{x:75,y:350},{x:75,y:225},{x:75,y:100},{x:240,y:335},{x:245,y:100},{x:360,y:245},{x:420,y:95},{x:485,y:320},{x:530,y:170}],edges:[[0,3],[1,3],[1,4],[2,4],t%4===2?[3,4]:[3,5],[4,5],t%4===3?[3,6]:[4,6],[5,7],[6,8],[7,8]],charger:5,gateNode:t%2?7:6,destination:8};
  return {};
 }
 function trajectory(angle,power){const a=angle*Math.PI/180,t=4;return{x:70+Math.cos(a)*power*1.8*t,y:390-Math.sin(a)*power*1.8*t+64};}
 function thermal(v){return[.7*v[0]+.2*v[1]+.1*v[2],.15*v[0]+.65*v[1]+.2*v[2],.2*v[0]+.15*v[1]+.65*v[2]];}
 function watched(s,at){const b=layout(s);if(b.cover.includes(at))return false;return b.watchers.some(w=>{const x=at%6,y=Math.floor(at/6),wx=w.at%6,wy=Math.floor(w.at/6);return w.dir===0?x===wx&&y<wy:w.dir===1?y===wy&&x>wx:w.dir===2?x===wx&&y>wy:y===wy&&x<wx;});}
 function signal(s,i){const b=layout(s),delta=Math.abs(((s.angles[i]-b.bearings[i]+540)%360)-180);return Math.round(clamp(100-delta*3,0,100));}
 function reject(s,notice){s.errors++;s.notice=notice;return false;}
 function actLegacy(s,action,value){if(!s||s.complete)return false;if(['angle','power'].includes(action)&&!Number.isFinite(Number(value)))return false;if(action==='valve'&&(!Array.isArray(value)||!Number.isFinite(Number(value[1]))))return false;const b=layout(s);s.notice='working';
  if(s.n===1||s.n===7){
   if(action==='scan'){s.scanned=true;s.notice='scan';return true;}
   if(action==='wait'){s.turn++;s.moves++;s.notice='wait';return true;}
   if(action==='pulse'){if(s.energy<1)return reject(s,'energy');s.energy--;s.alert=0;s.turn++;s.notice='pulse';return true;}
   if(action!=='move'||!Number.isInteger(value)||value<0||value>=36)return false;
   if(Math.abs(value%6-s.pos%6)+Math.abs(Math.floor(value/6)-Math.floor(s.pos/6))!==1||b.walls.includes(value))return reject(s,'blocked');
   if(s.n===1&&b.hazards.includes(value)&&!s.scanned)return reject(s,'scan-first');
   s.pos=value;s.turn++;s.moves++;
   if(s.n===7&&watched(s,value)){s.alert++;s.notice='detected';if(s.alert>=3){s.pos=b.start;s.alert=0;s.errors++;s.notice='checkpoint';}}
   if(b.targets.includes(s.pos)&&!s.collected.includes(s.pos)){s.collected.push(s.pos);s.energy=Math.min(4,s.energy+1);s.notice='collected';}
   if(s.pos===b.exit){if(s.collected.length===3)s.complete=true;else s.notice='missing';}return true;
  }
  if(s.n===2){if(action==='select'){s.selected=clamp(value|0,0,5);return true;}if(action==='role'){s.crew=clamp(value|0,0,2);return true;}if(action!=='assign')return false;const job=b.jobs[s.selected];if(s.jobs.includes(s.selected))return false;if(!job.requires.every(i=>s.jobs.includes(i)))return reject(s,'dependency');if(s.crew!==job.role)return reject(s,'specialist');if(s.energy<job.cost)return reject(s,'energy');s.energy+=job.gain-job.cost;s.jobs.push(s.selected);s.moves++;s.notice='assigned';s.complete=s.jobs.length===6;return true;}
  if(s.n===3){if(action==='angle'||action==='power'){s[action]=clamp(Number(value),action==='angle'?15:20,action==='angle'?80:90);return true;}if(action!=='burn')return false;const p=trajectory(s.angle,s.power);s.trails=[...s.trails.slice(-3),{angle:s.angle,power:s.power,hit:distance(p,b.target)<=b.target.radius}];s.moves++;if(distance(p,b.target)>b.target.radius)return reject(s,'trajectory-miss');s.burn++;s.complete=s.burn===3;s.notice='burn-ok';return true;}
  if(s.n===4){if(action==='select'){s.selected=clamp(value|0,0,35);return true;}if(action==='scan'){for(let i=0;i<36;i++)if(Math.floor(i/6)===Math.floor(s.selected/6)&&!s.scans.includes(i))s.scans.push(i);s.moves++;s.notice='scan';return true;}if(action==='sample'){if(!s.scans.includes(s.selected))return reject(s,'scan-first');if(!s.samples.includes(s.selected))s.samples.push(s.selected);s.notice='sample';return true;}if(action!=='land')return false;const a=b.tiles[s.selected];if(!s.samples.includes(s.selected))return reject(s,'sample-first');if(a.slope>b.maxSlope||a.wind>b.maxWind||a.strength<b.requiredStrength)return reject(s,'unsafe-pad');s.pad=s.selected;s.complete=true;s.moves++;return true;}
  if(s.n===5){if(action==='valve'&&Array.isArray(value)&&Number.isInteger(value[0])&&value[0]>=0&&value[0]<3){s.valves[value[0]]=clamp(Number(value[1]),0,100);s.moves++;return true;}if(action!=='stabilize')return false;if(thermal(s.valves).some((v,i)=>Math.abs(v-b.desired[i])>b.tolerance))return reject(s,'thermal-range');s.complete=true;s.notice='balanced';return true;}
  if(s.n===6){if(action==='brake'){s.ship.vx*=.2;s.ship.vy*=.2;s.moves++;return true;}if(action!=='dock')return false;if(distance(s.ship,b.target)>30)return reject(s,'approach');if(Math.hypot(s.ship.vx,s.ship.vy)>12)return reject(s,'slow');s.docked++;s.moves++;s.ship.vx=s.ship.vy=0;s.integrity=Math.min(100,s.integrity+12+(s.mods?.repair||0));s.complete=s.docked===3;s.notice='docked';return true;}
  if(s.n===8){if(action==='station'){s.station=clamp(value|0,0,2);return true;}if(action==='angle'){s.angles[s.station]=clamp(Number(value),0,359);s.samples[s.station]=false;return true;}if(action==='sample'){if(signal(s,s.station)<100-b.tolerance*3)return reject(s,'weak-signal');s.samples[s.station]=true;s.moves++;s.notice='bearing';return true;}if(action==='pin'&&value&&Number.isFinite(value.x)&&Number.isFinite(value.y)){s.pin={x:clamp(value.x,0,600),y:clamp(value.y,0,450)};return true;}if(action!=='locate')return false;if(!s.samples.every(Boolean))return reject(s,'all-bearings');if(!s.pin||distance(s.pin,b.source)>32)return reject(s,'intersection');s.complete=true;s.notice='source';return true;}
  if(s.n===9){if(action==='select'){s.selected=clamp(value|0,0,2);return true;}if(action==='gate'){if(s.ships[1]!==b.gateNode)return reject(s,'engineer-gate');if(s.gate){s.notice='gate';return true;}if(s.cells<1)return reject(s,'energy');s.cells--;s.gate=true;s.notice='gate';return true;}if(action!=='move'||!Number.isInteger(value)||value<0||value>8)return false;const at=s.ships[s.selected];if(at===8)return false;if(!b.edges.some(([a,z])=>a===at&&z===value||z===at&&a===value))return reject(s,'blocked');if(value===8&&!s.gate)return reject(s,'gate-closed');if(s.selected===2&&value===6)return reject(s,'cargo-clearance');if(value!==8&&s.ships.some((v,i)=>i!==s.selected&&v===value))return reject(s,'occupied');s.ships[s.selected]=value;s.moves++;if(value===5&&!s.evacuated.includes(s.selected)){s.cells++;s.evacuated.push(s.selected);}s.complete=s.ships.every(v=>v===8);return true;}
  return false;
 }
 function tick(s,dt,input={}){if(s.complete||s.failed)return;s.seconds+=clamp(dt,0,.05);if(s.n!==6)return;const b=layout(s),p=s.ship,d=clamp(dt,0,.04),mag=Math.max(1,Math.hypot(input.x||0,input.y||0));p.vx+=(input.x||0)/mag*b.accel*d;p.vy+=(input.y||0)/mag*b.accel*d;p.vx*=Math.exp(-.9*d);p.vy*=Math.exp(-.9*d);p.x=clamp(p.x+p.vx*d,25,575);p.y=clamp(p.y+p.vy*d,25,425);for(const w of b.walls)if(p.x>w.x-14&&p.x<w.x+w.w+14&&p.y>w.y-14&&p.y<w.y+w.h+14){const edges=[{d:Math.abs(p.x-w.x+14),x:w.x-15,y:p.y},{d:Math.abs(p.x-w.x-w.w-14),x:w.x+w.w+15,y:p.y},{d:Math.abs(p.y-w.y+14),x:p.x,y:w.y-15},{d:Math.abs(p.y-w.y-w.h-14),x:p.x,y:w.y+w.h+15}].sort((a,b)=>a.d-b.d);p.x=edges[0].x;p.y=edges[0].y;const hit=Math.hypot(p.vx,p.vy);p.vx*=.1;p.vy*=.1;s.integrity=Math.max(0,s.integrity-hullDamage(hit));s.impacts++;s.notice='impact';if(s.integrity<=0){s.integrity=0;s.failed=true;s.notice='hull-breach';return;}}}
 /* Hull damage scales with impact speed: a careful scrape costs 6%, a full-speed ram 18%. Docking repairs 12%, so the hull can reach 0 and the attempt fails. */
 function hullDamage(speed){return Math.round(clamp(6+speed*.15,6,18));}
 function restoreLegacy(v,n,stage,seed){if(!v||v.version!==1||v.n!==n||v.stage!==stage||v.seed!==(seed>>>0)||v.kind!==kinds[n]||!Number.isFinite(v.seconds)||v.seconds<0||typeof v.complete!=='boolean'||!Number.isInteger(v.moves)||v.moves<0||!Number.isInteger(v.errors)||v.errors<0)return null;const s=createLegacy(n,stage,seed),ints=(a,max,len)=>Array.isArray(a)&&(len===undefined||a.length===len)&&a.every(x=>Number.isInteger(x)&&x>=0&&x<=max)&&a.length<=36,nums=(a,len)=>Array.isArray(a)&&a.length===len&&a.every(x=>Number.isFinite(x)&&x>=0&&x<=100);
  if((n===1||n===7)&&(!Number.isInteger(v.pos)||v.pos<0||v.pos>35||!ints(v.collected,35)||new Set(v.collected).size!==v.collected.length||!v.collected.every(i=>layout(s).targets.includes(i))||!Number.isInteger(v.turn)||v.turn<0||!Number.isFinite(v.alert)||v.alert<0||v.alert>2||!Number.isFinite(v.energy)||v.energy<0||v.energy>4))return null;
  if(n===2&&(!Number.isInteger(v.selected)||v.selected<0||v.selected>5||!Number.isInteger(v.crew)||v.crew<0||v.crew>2||!ints(v.jobs,5)||new Set(v.jobs).size!==v.jobs.length||!v.jobs.every(i=>layout(s).jobs[i].requires.every(j=>v.jobs.includes(j)))||!Number.isFinite(v.energy)||v.energy<0||v.energy>10))return null;
  if(n===3&&(!Number.isInteger(v.burn)||v.burn<0||v.burn>3||!Number.isFinite(v.angle)||v.angle<15||v.angle>80||!Number.isFinite(v.power)||v.power<20||v.power>90||!Array.isArray(v.trails)||v.trails.length>4||v.trails.some(t=>!Number.isFinite(t.angle)||!Number.isFinite(t.power))))return null;
  if(n===4&&(!Number.isInteger(v.selected)||v.selected<0||v.selected>35||v.pad!==null&&(!Number.isInteger(v.pad)||v.pad<0||v.pad>35)||!ints(v.scans,35)||!ints(v.samples,35)||!v.samples.every(i=>v.scans.includes(i))))return null;
  if(n===5&&!nums(v.valves,3))return null;
  if(n===6&&(!v.ship||!['x','y','vx','vy'].every(k=>Number.isFinite(v.ship[k]))||v.ship.x<25||v.ship.x>575||v.ship.y<25||v.ship.y>425||Math.abs(v.ship.vx)>200||Math.abs(v.ship.vy)>200||!Number.isInteger(v.docked)||v.docked<0||v.docked>3||!Number.isFinite(v.integrity)||v.integrity<0||v.integrity>100||v.failed!==undefined&&typeof v.failed!=='boolean'||v.failed&&v.integrity>0))return null;
  if(n===8&&(!Array.isArray(v.angles)||v.angles.length!==3||v.angles.some(x=>!Number.isFinite(x)||x<0||x>359)||!Array.isArray(v.samples)||v.samples.length!==3||v.samples.some(x=>typeof x!=='boolean')||!Number.isInteger(v.station)||v.station<0||v.station>2||v.pin&&(!Number.isFinite(v.pin.x)||!Number.isFinite(v.pin.y)||v.pin.x<0||v.pin.x>600||v.pin.y<0||v.pin.y>450)))return null;
  if(n===9&&(!Number.isInteger(v.selected)||v.selected<0||v.selected>2||!ints(v.ships,8,3)||typeof v.gate!=='boolean'||!Number.isFinite(v.cells)||v.cells<0||v.cells>6||!ints(v.evacuated,2)||new Set(v.evacuated).size!==v.evacuated.length))return null;
  const result={...s,...JSON.parse(JSON.stringify(v))};if(v.complete&&!won(result))return null;return result;
 }
 function wonLegacy(s){const b=layout(s);if(s.n===1||s.n===7)return s.collected.length===3&&s.pos===b.exit;if(s.n===2)return s.jobs.length===6;if(s.n===3)return s.burn===3;if(s.n===4){const t=b.tiles[s.pad];return !!t&&s.samples.includes(s.pad)&&t.slope<=b.maxSlope&&t.wind<=b.maxWind&&t.strength>=b.requiredStrength;}if(s.n===5)return thermal(s.valves).every((v,i)=>Math.abs(v-b.desired[i])<=b.tolerance);if(s.n===6)return s.docked===3;if(s.n===8)return s.samples.every(Boolean)&&s.angles.every((_,i)=>signal(s,i)>=100-b.tolerance*3)&&s.pin&&distance(s.pin,b.source)<=32;if(s.n===9)return s.gate&&s.ships.every(v=>v===8);return false;}

 // Format 2 deepens new assignments; format-1 checkpoints retain their exact rules.
 const footprint=i=>Number.isInteger(i)&&i>=0&&i<30&&i%6<5?[i,i+1,i+6,i+7]:[];
 const condition=(s,burn=s.burn)=>s.version===2?{wind:((s.seed+burn*13+s.stage*7)%31)-15,gravity:[3.2,5,6.2][(burn+s.stage)%3]}:{wind:0,gravity:4};
 function flightPoint(angle,power,time,env={wind:0,gravity:4},trim=0){const a=angle*Math.PI/180;return{x:70+Math.cos(a)*power*1.8*time+env.wind*(time/4)**2+trim*Math.max(0,time-2)**2,y:390-Math.sin(a)*power*1.8*time+env.gravity*time*time};}
 /* Cross-chapter consequences (crew lead, rescued crew, Echo contact, earlier precision) arrive as small bounded modifiers. */
 const MODS={radius:[0,6],tolerance:[0,1],repair:[0,10],role:[0,2],cells:[0,2],charges:[0,3],stability:[0,40],preview:[0,1],scanned:[0,1],wind:[0,3],strength:[0,10],site:[0,1]};
 function cleanMods(m){const o={};if(m&&typeof m==='object')for(const [k,[a,z]]of Object.entries(MODS))if(Number.isFinite(m[k])&&m[k]>=a&&m[k]<=z&&(k==='role'||m[k]!==0))o[k]=m[k];return o;}
 const GATE_BASE=70,decodeNeed=6,gateShips=3;
 function create(n,stage,seed,mods){const s=createLegacy(n,stage,seed);s.version=2;s.detections=0;s.mods=cleanMods(mods);if(n===9)s.cells+=s.mods.cells||0;if(n===1&&s.mods.scanned)s.scanned=true;
  if(n===10){s.turn=0;s.band=2;s.fragments=0;s.noise=0;s.charges=2+(s.mods.charges||0);s.filter=false;s.log=[];s.event=null;s.choice=null;}
  if(n===11){s.turn=0;s.home=0;s.stability=GATE_BASE+(s.mods.stability||0);s.charges=1+(s.mods.charges||0);s.log=[];}
if(n===3)s.trim=0;if(n===4)s.sites=[];if(n===5){s.load=0;s.diagnosed=false;s.isolated=-1;}if(n===9)s.surveyed=[0,1,2];return s;}
 function noisy(s){if(s.noise>=100&&!s.complete){s.noise=100;s.failed=true;s.notice='signal-lost';}}
 function layout(s){const b=layoutLegacy(s);if(s.version!==2)return b;
  if(s.n===3){b.targets=b.targets.map((t,i)=>{const trim=(s.seed+i*7+s.stage*3)%25-12;return {...t,trim,...flightPoint(t.angle,t.power,4,condition(s,i),trim),relay:flightPoint(t.angle,t.power,2,condition(s,i))};});b.target=b.targets[s.burn]||b.targets[2];b.condition=condition(s);}
  if(s.n===4){const zones=Array.from({length:30},(_,i)=>i).filter(i=>footprint(i).length===4),safe=zones[(s.seed+s.stage*7)%zones.length],alternatives=zones.filter(i=>Math.abs(i%6-safe%6)+Math.abs(Math.floor(i/6)-Math.floor(safe/6))>=4&&!footprint(i).some(j=>footprint(safe).includes(j))),backup=alternatives[(s.seed+s.stage)%alternatives.length];for(const i of [...footprint(safe),...footprint(backup)])b.tiles[i]={slope:2+i%2,wind:4+i%3,strength:89+i%6};b.safe=safe;b.backup=backup;b.requiredSites=s.stage>=2?2:1;b.footprint=footprint(s.selected);}
  const m=s.mods||{};if(s.n===2&&Number.isInteger(m.role))b.jobs=b.jobs.map(j=>j.role===m.role?{...j,cost:Math.max(0,j.cost-1)}:j);
  if(s.n===3&&m.radius){b.targets=b.targets.map(t=>({...t,radius:t.radius+m.radius}));b.target=b.targets[s.burn]||b.targets[2];}
  if(s.n===4){b.maxWind+=m.wind||0;b.requiredStrength-=m.strength||0;b.site=m.site||0;}
  if(s.n===10){const r=random((s.seed^0x5eed1)>>>0),start=Math.floor(r()*5),step=1+Math.floor(r()*4),jstart=Math.floor(r()*5);let jstep=1+Math.floor(r()*4);if(jstep===step)jstep=jstep%4+1;const carrier=t=>(start+step*(t+2))%5,jam=t=>(jstart+jstep*t)%5;Object.assign(b,{bands:5,need:decodeNeed,eventAt:3,carrier,jam,preamble:[carrier(-2),carrier(-1)],step});}
  if(s.n===11){const r=random((s.seed^0x6a7e)>>>0),offset0=1+Math.floor(r()*3),rot=r()<.5?1:3,offset=t=>(offset0+rot*t)%8,aligned=t=>offset(t)%4===0;let wait=0;while(!aligned(s.turn+wait)&&wait<8)wait++;Object.assign(b,{sectors:8,ships:gateShips,offset,aligned,rot,nextWindow:wait,costs:{wait:5,launch:2,hit:15}});}
  if(s.n===5){const rnd=random((s.seed+Math.min(s.load,2)*997)>>>0);b.target=Array.from({length:3},()=>30+Math.floor(rnd()*41));b.desired=thermalLoad(b.target,Math.min(s.load,2));b.fault=(s.seed+s.stage+Math.min(s.load,2))%3;b.mode=Math.min(s.load,2);b.tolerance+=m.tolerance||0;}
  return b;
 }
 function thermalLoad(v,load){const matrices=[[[.7,.2,.1],[.15,.65,.2],[.2,.15,.65]],[[.55,.3,.15],[.1,.7,.2],[.25,.2,.55]],[[.6,.15,.25],[.25,.6,.15],[.15,.25,.6]]];return matrices[load%3].map(row=>row.reduce((sum,a,i)=>sum+a*v[i],0));}
 function readouts(s){if(s.version!==2)return thermal(s.valves);const b=layout(s),v=thermalLoad(s.valves,Math.min(s.load,2));if(s.isolated!==b.fault)v[b.fault]+=14;return v;}
 function validSite(s,i){const b=layout(s),cells=footprint(i);return cells.length===4&&cells.every(j=>s.scans.includes(j)&&s.samples.includes(j)&&b.tiles[j].slope<=b.maxSlope&&b.tiles[j].wind<=b.maxWind&&b.tiles[j].strength>=b.requiredStrength);}
 function act(s,action,value){if(!s||s.complete||s.failed)return false;if(s.version!==2)return actLegacy(s,action,value);const b=layout(s);
  if(s.n===10){
   if(action==='tune'){if(!Number.isInteger(value)||value<0||value>4)return false;s.band=value;return true;}
   if(action==='filter'){if(s.filter){s.notice='filter';return true;}if(s.charges<1)return reject(s,'energy');s.charges--;s.filter=true;s.notice='filter';return true;}
   if(action==='answer'||action==='silent'){if(s.event!=='echo')return false;s.event=null;s.choice=action;if(action==='answer')s.noise=Math.min(99,s.noise+12);else s.charges++;s.notice='echo-'+action;return true;}
   if(action!=='listen')return false;if(s.event)return reject(s,'echo-pending');const c=b.carrier(s.turn),j=b.jam(s.turn),got=s.band===c&&(c!==j||s.filter);
   s.log=[...s.log,{t:s.turn,band:s.band,c,j,got,f:s.filter}].slice(-12);s.moves++;s.turn++;
   if(got){s.fragments++;s.noise+=7;s.notice='fragment';}else if(s.band===c){s.noise+=6;s.notice='jammed';}else{s.noise+=15;s.errors++;s.notice='carrier-miss';}
   s.filter=false;if(s.fragments>=decodeNeed){s.complete=true;s.notice='decoded';return true;}if(s.fragments===3&&!s.choice&&got)s.event='echo';noisy(s);return true;}
  if(s.n===11){const before=s.stability;
   if(action==='wait'){s.turn++;s.moves++;s.stability-=b.costs.wait;s.notice='gate-wait';}
   else if(action==='boost'){if(s.charges<1)return reject(s,'energy');s.charges--;s.turn++;s.moves++;s.notice='gate-boost';}
   else if(action==='launch'){s.moves++;if(b.aligned(s.turn)){s.home++;s.turn++;s.stability-=b.costs.launch;s.notice='ship-through';s.complete=s.home>=gateShips;}else{s.stability-=b.costs.hit;s.errors++;s.impacts=(s.impacts||0)+1;s.notice='gate-hit';}}
   else return false;s.log=[...s.log,{a:action,t:s.turn,d:before-s.stability}].slice(-12);if(!s.complete&&s.stability<=0){s.stability=0;s.failed=true;s.notice='gate-collapse';}return true;}
  if(s.n===3&&action==='trim'){if(!Number.isFinite(Number(value)))return false;s.trim=clamp(Number(value),-20,20);return true;}
  if(s.n===3&&action==='burn'){const env=condition(s),p=flightPoint(s.angle,s.power,4,env,s.trim),mid=flightPoint(s.angle,s.power,2,env,s.trim),hit=distance(p,b.target)<=b.target.radius&&distance(mid,b.target.relay)<=14+((s.mods||{}).radius||0);s.trails=[...s.trails.slice(-3),{angle:s.angle,power:s.power,trim:s.trim,hit,...env}];s.moves++;if(!hit)return reject(s,'trajectory-miss');s.burn++;s.complete=s.burn===3;s.notice='burn-ok';return true;}
  if(s.n===4){if(action==='select'){s.selected=clamp(value|0,0,35);return true;}const cells=footprint(s.selected);if(!cells.length)return reject(s,'footprint-edge');if(action==='scan'){s.scans=[...new Set([...s.scans,...cells])];s.moves++;s.notice='scan';return true;}if(action==='sample'){if(!cells.every(i=>s.scans.includes(i)))return reject(s,'scan-first');s.samples=[...new Set([...s.samples,...cells])];s.moves++;s.notice='sample';return true;}if(action==='land'){if(!cells.every(i=>s.samples.includes(i)))return reject(s,'sample-first');if(!validSite(s,s.selected))return reject(s,'unsafe-pad');if(s.sites.some(i=>footprint(i).some(j=>cells.includes(j))))return reject(s,'separate-pad');s.sites.push(s.selected);s.pad=s.sites[0];s.moves++;s.complete=s.sites.length>=b.requiredSites;s.notice=s.complete?'sites-ready':'backup-pad';return true;}return false;}
  if(s.n===5){if(action==='diagnose'){s.diagnosed=true;s.notice='diagnosed';return true;}if(action==='isolate'){if(!s.diagnosed)return reject(s,'diagnose-first');if(value!==b.fault)return reject(s,'wrong-loop');s.isolated=value;s.notice='isolated';return true;}if(action==='stabilize'){if(s.isolated!==b.fault)return reject(s,'isolate-first');if(readouts(s).some((v,i)=>Math.abs(v-b.desired[i])>b.tolerance))return reject(s,'thermal-range');s.load++;s.moves++;s.complete=s.load===3;if(!s.complete){s.diagnosed=false;s.isolated=-1;}s.notice=s.complete?'balanced':'load-changed';return true;}}
  if(s.n===9&&action==='move'){if(s.selected===2&&value>2&&value<8&&!s.surveyed.includes(value))return reject(s,'scout-first');const ok=actLegacy(s,action,value);if(ok&&s.selected===0&&!s.surveyed.includes(value))s.surveyed.push(value);return ok;}
  const nextTurn=s.turn+1,ok=actLegacy(s,action,value);if(s.n===7&&action==='move'&&ok&&watched({...s,turn:nextTurn},value))s.detections++;return ok;
 }
 function restore(v,n,stage,seed){if(v?.version===1)return restoreLegacy(v,n,stage,seed);if(v?.version!==2||typeof v.complete!=='boolean')return null;const base=restoreLegacy({...v,version:1,complete:false},n,stage,seed);if(!base)return null;const s={...base,...JSON.parse(JSON.stringify(v))},ints=(a,max)=>Array.isArray(a)&&a.every(i=>Number.isInteger(i)&&i>=0&&i<=max)&&new Set(a).size===a.length;
  if(!Number.isInteger(s.detections)||s.detections<0)return null;if(s.mods===undefined)s.mods={};if(!s.mods||typeof s.mods!=='object'||JSON.stringify(cleanMods(s.mods))!==JSON.stringify(s.mods))return null;
  const I=(v,a,z)=>Number.isInteger(v)&&v>=a&&v<=z;
  // The sixth fragment wins before noisy() clamps failure. It adds 7 below 100;
  // six hits total 42 and jams/misses/answer add multiples of 3, so the maximum
  // completed noise is 105. Answer's 99 cap occurs at three fragments and cannot
  // lead to completion. Only 102/105 extend the existing finite 0..100 envelope.
  if(n===10&&(!I(s.turn,0,1000)||!I(s.band,0,4)||!I(s.fragments,0,decodeNeed)||!Number.isFinite(s.noise)||s.noise<0||s.noise>100&&(!s.complete||![102,105].includes(s.noise))||!I(s.charges,0,8)||typeof s.filter!=='boolean'||!Array.isArray(s.log)||s.log.length>12||![null,'echo'].includes(s.event)||![null,'answer','silent'].includes(s.choice)||s.event&&s.choice||s.failed!==undefined&&typeof s.failed!=='boolean'||s.failed&&s.noise<100))return null;
  // A final launch spends 2 from positive stability and wins before collapse.
  // Every cost is integer, so newly accepted negatives must stay on the exact
  // starting modifier's numeric lattice. Integer starts permit only -1.
  const gateStart=GATE_BASE+(s.mods.stability||0),gateBelow=gateStart-Math.ceil(gateStart);
  if(n===11&&(!I(s.turn,0,1000)||!I(s.home,0,gateShips)||!Number.isFinite(s.stability)||s.stability<0&&(!s.complete||![gateBelow,gateBelow-1].includes(s.stability))||s.stability>GATE_BASE+40||!I(s.charges,0,8)||!Array.isArray(s.log)||s.log.length>12||s.failed!==undefined&&typeof s.failed!=='boolean'||s.failed&&s.stability>0))return null;
  if(n===3&&(!Number.isFinite(s.trim)||Math.abs(s.trim)>20||s.trails.some(t=>!Number.isFinite(t.trim)||Math.abs(t.trim)>20||!Number.isFinite(t.wind)||Math.abs(t.wind)>15||![3.2,5,6.2].includes(t.gravity))))return null;
  if(n===4&&(!ints(s.sites,34)||s.pad!==(s.sites[0]??null)||s.sites.length>layout(s).requiredSites||s.sites.some(i=>!validSite(s,i))||s.sites.length>1&&footprint(s.sites[0]).some(i=>footprint(s.sites[1]).includes(i))))return null;
  if(n===5&&(!Number.isInteger(s.load)||s.load<0||s.load>3||typeof s.diagnosed!=='boolean'||!Number.isInteger(s.isolated)||s.isolated< -1||s.isolated>2||s.isolated!==-1&&!s.diagnosed))return null;
  if(n===9&&(!ints(s.surveyed,8)||![0,1,2].every(i=>s.surveyed.includes(i))))return null;
  if(s.complete&&!won(s))return null;return s;
 }
 function won(s){if(s.version!==2)return wonLegacy(s);if(s.n===10)return s.fragments>=decodeNeed&&!s.event&&!s.failed;if(s.n===11)return s.home>=gateShips&&!s.failed;if(s.n===4)return s.sites.length===layout(s).requiredSites&&s.sites.every(i=>validSite(s,i));if(s.n===5)return s.load===3&&s.isolated===layout(s).fault&&readouts(s).every((v,i)=>Math.abs(v-layout(s).desired[i])<=layout(s).tolerance);return wonLegacy(s);}
 function progress(s){const b=layout(s);return s.n===1||s.n===7?[s.collected.length,3]:s.n===2?[s.jobs.length,6]:s.n===3?[s.burn,3]:s.n===4?[s.version===2?s.sites.length:Number(s.complete),b.requiredSites||1]:s.n===5?[s.version===2?s.load:Number(s.complete),s.version===2?3:1]:s.n===6?[s.docked,3]:s.n===8?[s.samples.filter(Boolean).length,3]:s.n===10?[s.fragments,decodeNeed]:s.n===11?[s.home,gateShips]:[s.ships.filter(i=>i===8).length,3];}
 function performance(s){return {errors:s.errors,impacts:s.impacts||0,detections:s.detections||0,moves:s.moves,precise:s.errors===0&&!(s.impacts||s.detections),seconds:s.seconds};}
 return {hullDamage,cleanMods,GATE_BASE,create,layout,act,tick,restore,won,signal,thermal,trajectory,watched,random,clamp,distance,kinds,footprint,condition,flightPoint,readouts,validSite,progress,performance};
});
