/* PROTOTYPE ONLY. Pure Chapter 1 controller model. Not loaded by the game.
 * Variable frame dt and explicit timer callbacks mirror app.js; there is no fixed-step loop.
 * This establishes transcript consistency, never human play or wall-clock attestation. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.Life1Prototype=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 const RULES='life1-variable-dt-prototype-1',LAYOUT='life1-css-f3ec07d7-prototype-1';
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 function fail(code){const e=new Error(code);e.code=code;throw e;}
 const finite=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
 function routeKey(route){
  if(!route||route.life!==1||route.edition!==2||route.challenge_version!==2||typeof route.route!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(route.route)||!Number.isInteger(route.seed)||route.seed<0||route.seed>0xffffffff)fail('invalid-trusted-route');
  return `${RULES}|${LAYOUT}|${route.route}|${route.life}|${route.edition}|${route.challenge_version}|${route.seed}`;
 }
 // Domain-separated deterministic challenge. This hash is not a signature or authentication.
 function challengeSeed(route){let h=2166136261;for(const c of routeKey(route))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
 function random(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
 function draw(s){s.rng=(s.rng+0x6D2B79F5)>>>0;let t=s.rng;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;}
 function sequence(s){s.sequence=Array.from({length:4},()=>Math.floor(draw(s)*3));s.repairInput=[];s.repairCells=0;s.repairDisabled=false;}
 function layout(width,height){
  // Declared BORDER-BOX dimensions, not caller-supplied object rectangles. 1px border,
  // border-box sizing, square props, fixed object sizes, no layout rounding emulation.
  if(!finite(width,64,4096)||!finite(height,64,4096))fail('invalid-layout-dimensions');
  const w=width-2,h=height-2;
  const obstacles=[[.26,.51,.17],[.74,.63,.14],[.56,.41,.13]].map(([x,y,size])=>{
   const left=1+x*w,top=1+y*h,side=size*w;
   return Object.freeze({left:(left+3)/width*100,right:(left+side-3)/width*100,top:(top+side*.36)/height*100,bottom:(top+side-2)/height*100});
  });
  const spots=[{id:'1',x:1+.10*w+26,y:1+.80*h-31},{id:'2',x:1+.29*w+26,y:1+.48*h-31},{id:'3',x:1+.94*w-26,y:1+.59*h-31},{id:'repair',x:1+.88*w-37,y:1+.96*h-42.5},{id:'antenna',x:1+.96*w-36,y:1+.16*h+47}].map(Object.freeze);
  return Object.freeze({id:LAYOUT,width,height,innerWidth:w,innerHeight:h,obstacles:Object.freeze(obstacles),spots:Object.freeze(spots)});
 }
 function blocked(s,x,y){return s.geometry.obstacles.some(r=>x>r.left&&x<r.right&&y>r.top&&y<r.bottom);}
 function distance(s,id){const g=s.geometry,p=g.spots.find(p=>p.id===id);if(!p)return 999;
  return Math.hypot(1+s.x/100*g.innerWidth-p.x,1+s.y/100*g.innerHeight-27.3-p.y)/Math.max(1,Math.min(g.width,g.height));
 }
 function stop(s){s.moveX=0;s.moveY=0;s.walking=false;s.walkDistance=0;}
 function nearby(s){let best=null,d=.24;for(const p of s.geometry.spots){if(p.id==='repair'?s.stage===0:p.id==='antenna'?s.stage<2:s.collected.includes(p.id))continue;const v=distance(s,p.id);if(v<d){best=p.id;d=v;}}s.near=best;}
 function walkable(s){
  if(!blocked(s,s.x,s.y))return;
  const xs=[s.x,7,90],ys=[s.y,18,88];for(const r of s.geometry.obstacles){xs.push(r.left-.5,r.right+.5);ys.push(r.top-.5,r.bottom+.5);}
  let nearest=null,dist=Infinity;
  for(const x of xs)for(const y of ys){if(x<7||x>90||y<18||y>88||blocked(s,x,y))continue;const d=Math.hypot((x-s.x)*s.geometry.width,(y-s.y)*s.geometry.height);if(d<dist){dist=d;nearest={x,y};}}
  if(nearest){s.x=nearest.x;s.y=nearest.y;stop(s);nearby(s);}
 }
 function create(route,width=360,height=360){
  const s={rules:RULES,layout:LAYOUT,route:route.route,geometry:layout(width,height),rng:challengeSeed(route),now:0,lastFrame:0,nearbyAt:0,x:50,y:68,moveX:0,moveY:0,direction:'down',walkDistance:0,walking:false,near:null,stage:0,collected:[],repairCells:0,sequence:[],repairInput:[],repairShowing:false,repairDisabled:false,showIndex:0,showRemaining:0,showLast:0,showDue:null,clockResumedAt:0,frequency:0,dial:20,holdProgress:0,holding:false,holdDue:null,repairOpen:false,antennaOpen:false,completeVisible:false,completeDue:null,completeRemaining:0,completeLast:0,active:true,paused:false,hidden:false};
  s.frequency=58+Math.floor(draw(s)*22);sequence(s);nearby(s);return s;
 }
 const ARITY=Object.freeze({frame:4,collect:3,open:3,cell:3,dial:3,tune:2,hold:2,pause:3,hidden:3,close:3,layout:4,leave:2,'screen-enter':2,show:2,delay:2,stop:2});
 function validateEvent(e){
  if(!Array.isArray(e)||typeof e[0]!=='string'||!Object.hasOwn(ARITY,e[0])||e.length!==ARITY[e[0]]||!finite(e[1],0,Number.MAX_SAFE_INTEGER))fail('invalid-event');
  const [op,,a,b]=e;
  if(op==='frame'&&(!finite(a,-1,1)||!finite(b,-1,1)))fail('invalid-frame-input');
  if(op==='collect'&&!['1','2','3'].includes(a))fail('invalid-energy');
  if((op==='open'||op==='close')&&!['repair','antenna'].includes(a))fail('invalid-panel');
  if(op==='cell'&&(!Number.isInteger(a)||a<0||a>2))fail('invalid-cell');
  if(op==='dial'&&(!Number.isInteger(a)||a<0||a>100))fail('invalid-dial');
  if((op==='pause'||op==='hidden')&&typeof a!=='boolean')fail('invalid-pause');
  if(op==='layout'&&(!finite(a,64,4096)||!finite(b,64,4096)))fail('invalid-layout-dimensions');
  return e;
 }
 // Admission of plausible UI actions is intentionally separate from the controller's
 // permissive onclick functions (which can be invoked directly with a closed panel).
 function admissible(s,e){
  const [op,,arg]=e;
  if(['frame','layout','hidden','stop'].includes(op))return null;
  if(op==='screen-enter')return s.active?'already-active':null;
  if(!s.active)return 'mission-inactive';
  if(op==='pause'||op==='leave')return null;
  if(op==='hold')return s.holding?null:'hold-not-started';
  if(op==='delay')return s.repairShowing||s.completeDue!==null?null:'delay-not-scheduled';
  if(s.hidden||s.paused)return 'ui-inactive';
  if(op==='collect')return s.stage===0&&!s.collected.includes(arg)&&!s.repairOpen&&!s.antennaOpen&&distance(s,arg)<.24?null:'energy-unreachable';
  if(op==='open')return s.stage===(arg==='repair'?1:2)&&distance(s,arg)<.24?null:'station-unreachable';
  if(op==='close')return s[arg+'Open']?null:'panel-not-open';
  if(op==='cell'||op==='show')return s.stage===1&&s.repairOpen&&!s.repairShowing&&(op==='show'||!s.repairDisabled)?null:'repair-unavailable';
  if(op==='dial')return s.stage===2&&s.antennaOpen?null:'antenna-unavailable';
  if(op==='tune')return s.stage===2&&s.antennaOpen&&!s.holding?null:'antenna-unavailable';
  return null;
 }
 function transition(previous,event){
  validateEvent(event);const [op,time,a,b]=event;if(time<previous.now)fail('time-reordered');
  const s={...previous,now:time};
  if(op==='frame'){
   s.moveX=a;s.moveY=b;const dt=s.lastFrame?Math.min((time-s.lastFrame)/1000,.04):0;s.lastFrame=time;
   if(!s.active)return s;
   if(s.hidden||s.paused||s.repairOpen||s.antennaOpen||s.completeVisible){if(s.walking||s.moveX||s.moveY)stop(s);return s;}
   const mag=Math.hypot(a,b);s.walking=false;
   if(mag>.08){const g=s.geometry,scale=Math.max(1,mag),vx=a/scale,vy=b/scale,nx=clamp(s.x+vx*88*dt/g.width*100,7,90),ny=clamp(s.y+vy*88*dt/g.height*100,18,88),ox=s.x,oy=s.y;
    s.direction=Math.abs(vx)>Math.abs(vy)?vx<0?'left':'right':vy<0?'up':'down';
    if(!blocked(s,nx,s.y))s.x=nx;if(!blocked(s,s.x,ny))s.y=ny;
    const traveled=Math.hypot((s.x-ox)*g.width/100,(s.y-oy)*g.height/100);s.walking=traveled>.01;if(s.walking)s.walkDistance+=traveled;
   }
   if(mag>.08&&time-s.nearbyAt>=90){nearby(s);s.nearbyAt=time;}
  }else if(op==='collect'){
   if(s.stage!==0||s.collected.includes(a)||distance(s,a)>=.24)return s;
   s.collected=[...s.collected,a];if(s.collected.length===3)s.stage=1;nearby(s);
  }else if(op==='open'){
   if(s.stage===(a==='repair'?1:2)&&distance(s,a)<.24)s[a+'Open']=true;
  }else if(op==='cell'){
   if(s.stage!==1||s.repairShowing||s.repairDisabled)return s;
   if(a!==s.sequence[s.repairInput.length]){s.repairInput=[];s.repairCells=0;return s;}
   s.repairInput=[...s.repairInput,a];s.repairCells=s.repairInput.length;
   if(s.repairCells===4){s.stage=2;s.repairOpen=false;nearby(s);}
  }else if(op==='show'){
   if(s.repairShowing)return s;s.repairShowing=true;s.repairDisabled=true;s.repairInput=[];s.repairCells=0;s.showIndex=1;s.showRemaining=650;s.showLast=time;s.showDue=time+50;
  }else if(op==='delay'){
   if(s.completeDue!==null){
    if(time<s.completeDue)fail('completion-callback-early');
    const dt=Math.min(100,time-Math.max(s.completeLast,s.clockResumedAt));s.completeLast=time;s.completeDue=time+50;
    if(!s.active){s.completeDue=null;return s;}if(s.hidden||s.paused)return s;
    s.completeRemaining-=dt;if(s.completeRemaining<=0){s.completeVisible=true;s.completeDue=null;}return s;
   }
   if(!s.repairShowing||s.showDue===null)return s;if(time<s.showDue)fail('sequence-callback-early');
   const dt=Math.min(100,time-Math.max(s.showLast,s.clockResumedAt));s.showLast=time;s.showDue=time+50;
   if(!s.active){s.showDue=null;return s;}if(s.hidden||s.paused)return s;
   s.showRemaining-=dt;if(s.showRemaining<=0){if(s.showIndex>=4){s.repairShowing=false;s.repairDisabled=false;s.showDue=null;}else{s.showIndex++;s.showRemaining=650;}}
  }else if(op==='dial'){
   s.dial=a;if(s.holding&&Math.abs(a-s.frequency)>3){s.holding=false;s.holdDue=null;s.holdProgress=0;}
  }else if(op==='tune'){
   if(s.stage!==2||s.holding||Math.abs(s.dial-s.frequency)>3)return s;s.holding=true;s.holdProgress=0;s.holdDue=time+120;
  }else if(op==='hold'){
   if(!s.holding)return s;if(time<s.holdDue)fail('hold-callback-early');s.holdDue=time+120;
   if(s.hidden||s.paused)return s;
   if(Math.abs(s.dial-s.frequency)>3){s.holding=false;s.holdDue=null;s.holdProgress=0;return s;}
   s.holdProgress+=4;if(s.holdProgress>=100){s.holding=false;s.holdDue=null;s.stage=3;s.antennaOpen=false;s.completeDue=time+50;s.completeLast=time;s.completeRemaining=300;}
  }else if(op==='close'){
   if(a==='repair'){s.repairShowing=false;s.showDue=null;sequence(s);}else{s.holding=false;s.holdDue=null;s.holdProgress=0;}
   s[a+'Open']=false;stop(s);nearby(s);
  }else if(op==='pause'){s.paused=a;if(a)stop(s);
  }else if(op==='hidden'){s.hidden=a;s.clockResumedAt=time;if(a){stop(s);if(s.active)s.paused=true;}
  }else if(op==='layout'){s.geometry=layout(a,b);walkable(s);
  }else if(op==='leave'){s.active=false;s.paused=false;stop(s);s.holding=false;s.holdDue=null;s.repairShowing=false;s.showDue=null;s.completeDue=null;
  // Screen-only return mirrors show('mission1'), never openMission/reset/legacy restore.
  }else if(op==='screen-enter'){s.active=true;s.paused=false;s.lastFrame=0;walkable(s);
  }else if(op==='stop')stop(s);
  return s;
 }
 function won(s){return s.stage===3&&s.collected.length===3&&s.repairCells===4&&s.holdProgress===100;}
 return Object.freeze({RULES,LAYOUT,ARITY,routeKey,challengeSeed,random,layout,create,validateEvent,transition,admissible,blocked,distance,won});
});
