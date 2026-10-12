'use strict';
// New supplied-callback ABI. Frozen model is reused only for initial challenge,
// native geometry primitives and exact proximity/collision helpers, not replay.
const Original=require('../pr47/life1-model.js');
const N=require('../pr47/life1-native-geometry.js');
const ID='life1-source-callback-dual-geometry-clock-1';
const KINDS=new Set(['scan','stick','frame','refresh','collect','action','pointerup','open','show','cell','dial','tune','hold','delay','pause','resume','close','stop','visibility','leave','screen','nearby','sequence','signal-finish','repair-step','hydrate']);
const fail=code=>{const e=Error(code);e.code=code;throw e;};
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const time=n=>finite(n)&&n>=0&&n<=Number.MAX_SAFE_INTEGER;
const clone=x=>structuredClone(x);
function geometry(a){N.validateEnvelope(...a);const native=N.layout(...a);return {id:N.ID,width:a[0],height:a[1],left:a[2],top:a[3],innerWidth:native.innerWidth,innerHeight:native.innerHeight,obstacles:native.obstacles,spots:native.localSpots.map(p=>({id:p.id,x:p.left+p.width/2,y:p.top+p.height/2})),native};}
function clock(value){if(!value||!['lastFrame','nearbyAt','clockResumedAt'].every(k=>time(value[k])))fail('invalid-source-clock');if(Object.keys(value).some(k=>!['lastFrame','nearbyAt','clockResumedAt','dispatchMs'].includes(k)))fail('invalid-source-clock');return {lastFrame:value.lastFrame,nearbyAt:value.nearbyAt,clockResumedAt:value.clockResumedAt};}
function create({context,initial,clock:initialClock={lastFrame:0,nearbyAt:0,clockResumedAt:0}}){
 const s=clone(Original.createNative(context,...initial));Object.assign(s,clock(initialClock));
 return {...s,document:0,dispatchMs:0,timers:{},showIndex:0};
}
function stop(s){s.moveX=0;s.moveY=0;s.walking=false;s.walkDistance=0;}
function draw(s){s.rng=(s.rng+0x6D2B79F5)>>>0;let t=s.rng;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;}
function sequence(s){s.sequence=Array.from({length:4},()=>Math.floor(draw(s)*3));s.repairInput=[];s.repairCells=0;s.repairDisabled=false;}
function nearby(s){let best=null,d=.24;for(const id of ['1','2','3','repair','antenna']){
 if(id==='repair'?s.stage===0:id==='antenna'?s.stage<2:s.collected.includes(id))continue;
 const player=N.playerRect(s.liveGeometry,s.x,s.y),target=N.spotRect(s.liveGeometry,id,s.highlightedNear,s.collected.includes(id));
 const distance=Math.hypot((player.left+player.right)/2-(target.left+target.right)/2,(player.top+player.bottom)/2-(target.top+target.bottom)/2)/Math.max(1,Math.min(s.liveGeometry.world.width,s.liveGeometry.world.height));if(distance<d){best=id;d=distance;}}
 if(s.near!==best)s.highlightedNear=best;s.near=best;
}
function correction(s){
 if(!Original.blocked(s,s.x,s.y))return false;
 const xs=[s.x,7,90],ys=[s.y,18,88];for(const r of s.geometry.obstacles){xs.push(r.left-.5,r.right+.5);ys.push(r.top-.5,r.bottom+.5);}
 let nearest=null,distance=Infinity;for(const x of xs)for(const y of ys){if(x<7||x>90||y<18||y>88||Original.blocked(s,x,y))continue;const d=Math.hypot((x-s.x)*s.geometry.width,(y-s.y)*s.geometry.height);if(d<distance){distance=d;nearest={x,y};}}
 if(nearest){s.x=nearest.x;s.y=nearest.y;return true;}return false;
}
function recoveryPhase(s){return s.paused&&!s.hidden&&Object.keys(s.timers).length===0&&
 ((s.stage===1&&s.repairOpen&&!s.repairShowing&&s.repairCells>0&&s.repairCells<4)||
 (s.stage===2&&s.antennaOpen&&s.holding&&s.holdProgress>0&&s.holdProgress<100));}
function beginDocument(previous,raw){
 if(!recoveryPhase(previous))fail('unsupported-recovery-phase');
 if(!time(raw.dispatchMs))fail('invalid-document-clock');const s=clone(previous);
 Object.assign(s,clock(raw),{document:s.document+1,dispatchMs:raw.dispatchMs,now:raw.dispatchMs});return s;
}
// Projection grammar fixes callback ownership/order. Geometry observations are
// retained verbatim; every geometry-consuming source step must follow its read.
const GRAMMAR={
 scan:/^$/,stick:/^input$/,
 frame:/^frame(?: stop| nearby nearby-at)?$/,
 refresh:/^cache(?: stop nearby)?$/,
 collect:/^(?:collect nearby)?$/,
 action:/^nearby(?: (?:collect nearby |open )?nearby)?$/,
 pointerup:/^(?:collect nearby|open)?$/,
 open:/^(?:open)?$/,show:/^(?:show cue timer-start)?$/,
 cell:/^(?:cell(?: nearby)?)?$/,dial:/^dial$/,tune:/^(?:tune)?$/,
 hold:/^hold(?: finish timer-start)?$/,delay:/^timer-tick(?: cue(?: timer-start)?| card)?$/,
 pause:/^(?:pause stop)?$/,resume:/^pause$/,close:/^close(?: timer-cancel sequence)? stop nearby$/,
 stop:/^(?:stop)?$/,visibility:/^hidden$/,leave:/^(?:leave timer-cancel stop)?$/,
 screen:/^(?:leave timer-cancel stop)?(?: ?pause)?(?: ?screen-enter cache(?: stop nearby)?)?$/,
 nearby:/^nearby$/,sequence:/^sequence$/,hydrate:/^stop cache(?: stop nearby)?(?: hold-rearm)?$/
};
function grammar(callback){
 const ops=callback.steps.filter(x=>Array.isArray(x)&&x[0]!=='live').map(x=>x[0]).join(' ');
 if(!GRAMMAR[callback.kind]?.test(ops))fail('callback-kind-grammar');
 for(let i=0;i<callback.steps.length;i++){
  const op=callback.steps[i][0];
  if(['cache','nearby','collect'].includes(op)||(op==='open'&&callback.kind!=='action')){
   if(callback.steps[i-1]?.[0]!=='live')fail('missing-source-geometry-read');
   if(op==='cache'&&!callback.steps[i].slice(1).every((n,j)=>Object.is(n,callback.steps[i-1][j+1])))fail('refresh-read-mismatch');
  }
 }
}
function transition(previous,callback){
 if(!callback||!KINDS.has(callback.kind)||!time(callback.dispatchMs)||callback.dispatchMs<previous.dispatchMs||!Array.isArray(callback.steps))fail('invalid-callback');
 grammar(callback);if(callback.kind==='scan'&&callback.steps.length!==3-previous.collected.length)fail('scan-read-count');if(callback.kind==='hydrate'&&callback.steps.filter(x=>x[0]==='hold-rearm').length!==(previous.holding?1:0))fail('hydrate-rearm-required');const s=clone(previous),required={nearby:0,nearbyAt:0,stop:0,cue:0,finish:0,card:0,sequence:0,cancel:0,register:[]};let frames=0,actionNear=null;
 s.dispatchMs=callback.dispatchMs;s.now=callback.dispatchMs;
 const requireCount=k=>{if(required[k]<1)fail('untriggered-'+k);required[k]--;};
 for(const step of callback.steps){
  if(!Array.isArray(step)||typeof step[0]!=='string')fail('invalid-step');const [op,a,b,c,d]=step;
  const arity={input:3,live:5,cache:5,frame:4,nearby:1,'nearby-at':2,stop:1,collect:2,open:2,show:1,cue:1,cell:2,dial:2,tune:1,hold:2,finish:1,card:1,close:2,sequence:1,pause:2,hidden:3,leave:1,'screen-enter':1,'timer-start':5,'timer-tick':3,'timer-cancel':2,'hold-rearm':1}[op];
  if(step.length!==arity)fail('invalid-step-arity');
  if(op==='input'){if(!finite(a)||!finite(b)||Math.abs(a)>1||Math.abs(b)>1)fail('invalid-source-input');s.moveX=a;s.moveY=b;}
  else if(op==='live'){s.liveGeometry=N.layout(...step.slice(1));s.view={left:c,top:d};}
  else if(op==='cache'){s.geometry=geometry(step.slice(1));if(correction(s)){required.stop++;required.nearby++;}}
  else if(op==='frame'){
   if(!time(a)||!finite(b)||!finite(c)||Math.abs(b)>1||Math.abs(c)>1)fail('invalid-frame');frames++;
   s.moveX=b;s.moveY=c;const dt=s.lastFrame?Math.min((a-s.lastFrame)/1000,.04):0;s.lastFrame=a;
   if(!s.active)continue;
   if(s.hidden||s.paused||s.repairOpen||s.antennaOpen||s.completeVisible){if(s.walking||b||c)required.stop++;continue;}
   const magnitude=Math.hypot(b,c);s.walking=false;
   if(magnitude>.08){const world=s.geometry,scale=Math.max(1,magnitude),vx=b/scale,vy=c/scale;
    const nx=Math.max(7,Math.min(90,s.x+vx*88*dt/world.width*100)),ny=Math.max(18,Math.min(88,s.y+vy*88*dt/world.height*100)),oldX=s.x,oldY=s.y;
    s.direction=Math.abs(vx)>Math.abs(vy)?vx<0?'left':'right':vy<0?'up':'down';
    if(!Original.blocked(s,nx,s.y))s.x=nx;if(!Original.blocked(s,s.x,ny))s.y=ny;
    const traveled=Math.hypot((s.x-oldX)*world.width/100,(s.y-oldY)*world.height/100);s.walking=traveled>.01;if(s.walking)s.walkDistance+=traveled;
   }
   if(magnitude>.08&&a-s.nearbyAt>=90){required.nearby++;required.nearbyAt++;}
  }
  else if(op==='nearby'){nearby(s);if(callback.kind==='action'&&actionNear===null)actionNear={id:s.near};if(required.nearby)required.nearby--;}
  else if(op==='nearby-at'){if(!required.nearbyAt||required.nearby||!time(a)||!frames||!Object.is(a,s.lastFrame))fail('invalid-nearby-clock');s.nearbyAt=a;required.nearbyAt--;}
  else if(op==='stop'){if((callback.kind==='refresh'||(callback.kind==='frame'&&s.active&&!s.hidden&&!s.paused&&!s.repairOpen&&!s.antennaOpen&&!s.completeVisible))&&!required.stop)fail('untriggered-stop');stop(s);if(required.stop)required.stop--;}
  else if(op==='collect'){
   if(!['1','2','3'].includes(a)||s.stage!==0||s.collected.includes(a)||(callback.kind==='action'&&s.near!==a)||Original.distance(s,a)>=.24)fail('collect-source-guard');
   s.collected.push(a);if(s.collected.length===3)s.stage=1;required.nearby++;
  }
  else if(op==='open'){if(!['repair','antenna'].includes(a)||s.stage!==(a==='repair'?1:2)||(callback.kind==='action'?s.near!==a:Original.distance(s,a)>=.24))fail('open-source-guard');s[a+'Open']=true;}
  else if(op==='show'){if(s.repairShowing)fail('show-source-guard');s.repairShowing=true;s.repairDisabled=true;s.repairInput=[];s.repairCells=0;s.showIndex=0;required.cue++;}
  else if(op==='cue'){requireCount('cue');if(s.showIndex>=4){s.repairShowing=false;s.repairDisabled=false;}else{s.showIndex++;required.register.push('repair');}}
  else if(op==='cell'){
   if(!Number.isInteger(a)||a<0||a>2||s.stage!==1||s.repairShowing)fail('cell-source-guard');
   if(a!==s.sequence[s.repairInput.length]){s.repairInput=[];s.repairCells=0;}else{s.repairInput.push(a);s.repairCells=s.repairInput.length;if(s.repairCells===4){s.stage=2;s.repairOpen=false;required.nearby++;}}
  }
  else if(op==='dial'){if(!Number.isInteger(a)||a<0||a>100)fail('invalid-dial');s.dial=a;if(s.holding&&Math.abs(a-s.frequency)>3){s.holding=false;s.holdProgress=0;}}
  else if(op==='tune'){if(s.stage!==2||s.holding||Math.abs(s.dial-s.frequency)>3)fail('tune-source-guard');s.holding=true;s.holdProgress=0;}
  else if(op==='hold'){
   if(!s.holding||!Object.is(a,s.dial))fail('hold-source-guard');if(s.hidden||s.paused)continue;
   if(Math.abs(a-s.frequency)>3){s.holding=false;s.holdProgress=0;continue;}s.holdProgress+=4;if(s.holdProgress>=100)required.finish++;
  }
  else if(op==='finish'){requireCount('finish');s.holding=false;s.stage=3;s.antennaOpen=false;required.register.push('complete');}
  else if(op==='card'){requireCount('card');s.completeVisible=true;}
  else if(op==='close'){if(!['repair','antenna'].includes(a))fail('invalid-panel');s[a+'Open']=false;if(a==='repair'){s.repairShowing=false;required.cancel++;required.sequence++;}else{s.holding=false;s.holdProgress=0;}required.stop++;required.nearby++;}
  else if(op==='sequence'){if(callback.kind==='close')requireCount('sequence');sequence(s);}
  else if(op==='pause'){if(typeof a!=='boolean')fail('invalid-pause');s.paused=a;if(a)required.stop++;}
  else if(op==='hidden'){if(typeof a!=='boolean'||!time(b))fail('invalid-visibility');s.hidden=a;s.clockResumedAt=b;}
  else if(op==='leave'){s.active=false;s.paused=false;s.holding=false;s.repairShowing=false;required.cancel++;required.stop++;}
  else if(op==='screen-enter'){s.active=true;s.paused=false;s.lastFrame=0;}
  else if(op==='timer-start'){
   if(!Number.isSafeInteger(a)||a<0||Object.hasOwn(s.timers,a)||!['repair','complete'].includes(b)||c!==(b==='repair'?650:300)||!time(d)||required.register.shift()!==b)fail('timer-registration');
   s.timers[a]={owner:b,remaining:c,last:d};
  }
  else if(op==='timer-tick'){
   const timer=s.timers[a];if(!timer||!time(b)||b<timer.last)fail('timer-tick');
   const dt=Math.min(100,b-Math.max(timer.last,s.clockResumedAt));timer.last=b;
   if(!s.active){delete s.timers[a];continue;}if(s.hidden||s.paused)continue;
   timer.remaining-=dt;if(timer.remaining<=0){delete s.timers[a];required[timer.owner==='repair'?'cue':'card']++;}
  }
  else if(op==='timer-cancel'){if(!Array.isArray(a)||a.some(id=>!Number.isSafeInteger(id)))fail('timer-cancel');if(a.length!==Object.keys(s.timers).length||new Set(a).size!==a.length)fail('timer-cancel-incomplete');if(required.cancel)required.cancel--;for(const id of a){if(!Object.hasOwn(s.timers,id))fail('timer-cancel-owner');delete s.timers[id];}}
  else if(op==='hold-rearm'){if(callback.kind!=='hydrate'||!s.holding||!s.paused||s.stage!==2)fail('hold-rearm-source-guard');}
 }
 if(callback.kind==='action'&&actionNear?.id&&callback.steps.filter(x=>x[0]==='nearby').length<2)fail('action-missing-final-nearby');
 if(callback.kind==='pause'&&callback.steps.some(x=>x[0]==='pause'&&x[1]!==true)||['resume','screen'].includes(callback.kind)&&callback.steps.some(x=>x[0]==='pause'&&x[1]!==false))fail('pause-owner');
 if(callback.kind==='frame'&&frames!==1)fail('frame-callback-grammar');
 if(Object.values(required).some(v=>Array.isArray(v)?v.length:v))fail('incomplete-callback-effects');
 return s;
}
module.exports=Object.freeze({ID,Original,N,create,transition,beginDocument,recoveryPhase});
