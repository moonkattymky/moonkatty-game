'use strict';
/* Injected with page.evaluate ONLY, after the unmodified application and prototype
 * model have loaded. No manufactured DOMRects or alternate controller physics.
 * Original controller functions run in full; wrappers observe timer/collision
 * calls. This is an experimental recorder, not production trace ingestion. */
module.exports = function installLife1BrowserAdapter({route}) {
  const M = window.Life1Prototype;
  if (!M || window.__life1Parity) throw Error('Missing model or duplicate adapter');
  const PX = 1 / 16; // <= four Chromium 1/64px layout units; never used for booleans.
  const original = {interval: window.setInterval, timeout: window.missionTimeout,
    blocked: window.life1Blocked, frame: window.life1MoveLoop};
  const rng = M.random(M.challengeSeed(route));
  const report = {route, toleranceCssPx: PX, events: [], randomDraws: [], geometry: [],
    probes: [], input: [], collisions: 0, comparisons: 0, failure: null};
  let state, timerKind = null, collisionCalls = null, lastPointer=null, beforeEvent=null;
  $('life1Joystick').addEventListener('pointermove',ev=>{
    const r=$('life1Joystick').getBoundingClientRect();
    lastPointer={trusted:ev.isTrusted,type:ev.pointerType,clientX:ev.clientX,clientY:ev.clientY,
      centerX:r.left+r.width/2,centerY:r.top+r.height/2,width:r.width};
  },{capture:true});
  const copy = value => JSON.parse(JSON.stringify(value));
  const eq = (a, b, label) => {if (JSON.stringify(a) !== JSON.stringify(b)) throw Error(`${label}: model=${JSON.stringify(a)} browser=${JSON.stringify(b)}`);};
  const close = (a, b, limit, label) => {if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a-b) > limit) throw Error(`${label}: model=${a} browser=${b} tolerance=${limit}`);};
  const rect = el => {const r = el.getBoundingClientRect(); return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
  const spot = id => document.querySelector(id==='repair' ? '#repairTerminal' : id==='antenna' ? '#antennaHotspot' : `.energy[data-energy="${id}"]`);
  function snapshot() {
    return {x:l1PX,y:l1PY,moveX:l1MoveX,moveY:l1MoveY,lastFrame:l1LastFrame,nearbyAt:l1NearbyAt,
      direction:l1Direction,walkDistance:l1WalkDistance,walking:l1Walking,stage:life1Stage,
      collected:[...document.querySelectorAll('.energy.collected')].map(e=>e.dataset.energy),
      repairCells,sequence:[...repairSequence],repairInput:[...repairInput],repairShowing,
      repairDisabled:[...document.querySelectorAll('.repair-cells button')].every(e=>e.disabled),
      cellsDisabled:[...document.querySelectorAll('.repair-cells button')].map(e=>e.disabled),
      frequency:targetFrequency,dial:Number($('frequencyDial').value),holdProgress:signalHoldProgress,
      holding:signalHoldTimer!==null,repairOpen:!$('repairPanel').hidden,antennaOpen:!$('antennaPanel').hidden,
      completeVisible:!$('life1Complete').hidden,active:$('mission1').classList.contains('active'),
      paused:!!window.MKTYExperience.paused,hidden:document.hidden,
      near:l1Near?.dataset.energy||(l1Near?.id==='repairTerminal'?'repair':l1Near?.id==='antennaHotspot'?'antenna':null),
      geometry:copy(l1Geometry),world:rect($('life1World')),player:rect($('life1Player')),
      spots:['1','2','3','repair','antenna'].map(id=>({id,...rect(spot(id))})),
      obstacles:[...document.querySelectorAll('#life1World .l1-obstacle')].map(rect)};
  }
  function geometry(v, label) {
    const g = state.geometry, w = v.world;
    close(g.width,w.width,PX,label+'.live width');close(g.height,w.height,PX,label+'.live height');
    close(v.geometry.width,w.width,PX,label+'.cached width');close(v.geometry.height,w.height,PX,label+'.cached height');
    for (let i=0;i<3;i++) {
      const raw=v.obstacles[i];
      // Independently measured DOMRects, not the model's own computed rectangles.
      const native={left:(raw.left+3-w.left)/w.width*100,right:(raw.right-3-w.left)/w.width*100,
        top:(raw.top+raw.height*.36-w.top)/w.height*100,bottom:(raw.bottom-2-w.top)/w.height*100};
      for (const edge of ['left','right','top','bottom']) {
        const dimension=edge==='left'||edge==='right'?w.width:w.height;
        close(g.obstacles[i][edge],native[edge],PX/dimension*100,`${label}.obstacle ${i}.${edge}`);
        close(v.geometry.obstacles[i][edge],native[edge],PX/dimension*100,`${label}.cached obstacle ${i}.${edge}`);
      }
    }
    close(1+state.x/100*g.innerWidth,(v.player.left+v.player.right)/2-w.left,PX,label+'.player center x');
    close(1+state.y/100*g.innerHeight-27.3,(v.player.top+v.player.bottom)/2-w.top,PX,label+'.player center y');
    for (const p of g.spots) {
      const actual=v.spots.find(v=>v.id===p.id);
      close(p.x,(actual.left+actual.right)/2-w.left,PX,label+'.'+p.id+' center x');
      close(p.y,(actual.top+actual.bottom)/2-w.top,PX,label+'.'+p.id+' center y');
      close(M.distance(state,p.id),l1DistanceTo(spot(p.id)),2*PX/Math.min(w.width,w.height),label+'.'+p.id+' distance');
    }
  }
  function compare(label) {
    const v=snapshot(),g=state.geometry;
    const pending=state.active&&(Math.abs(g.width-v.world.width)>1e-8||Math.abs(g.height-v.world.height)>1e-8||
      Math.abs(v.geometry.width-v.world.width)>PX||Math.abs(v.geometry.height-v.world.height)>PX);
    report.pendingLayout=pending?{label,model:[g.width,g.height],live:[v.world.width,v.world.height],cached:[v.geometry.width,v.geometry.height]}:null;
    for (const k of ['x','y']) close(state[k],v[k],PX/(k==='x'?g.width:g.height)*100,label+'.'+k);
    for (const k of ['moveX','moveY','lastFrame','nearbyAt','walkDistance','dial','holdProgress']) close(state[k],v[k],1e-8,label+'.'+k);
    for (const k of ['direction','walking','stage','repairCells','repairShowing','repairDisabled','frequency',
      'holding','repairOpen','antennaOpen','completeVisible','active','paused','hidden','sequence','repairInput']) eq(state[k],v[k],label+'.'+k);
    eq([state.repairDisabled,state.repairDisabled,state.repairDisabled],v.cellsDisabled,label+'.each repair cell disabled');
    eq([...state.collected].sort(),v.collected.sort(),label+'.collected');
    if(!pending){eq(state.near,v.near,label+'.near');if(state.active)geometry(v,label);}
    for (const call of collisionCalls||[]) {
      // Exact decisions at IDENTICAL query coordinates. The geometry tolerance
      // above never forgives a collided/not-collided or proximity disagreement.
      eq(M.blocked(state,call.x,call.y),call.blocked,label+'.collision '+JSON.stringify(call));report.collisions++;
    }
    report.comparisons++;
    return v;
  }
  function nativeDetails() {
    const style=el=>{const c=getComputedStyle(el);return Object.fromEntries(['left','top','right','bottom','width','height','transform','boxSizing','borderTopWidth','borderLeftWidth'].map(k=>[k,c[k]]));};
    const ancestors=[];for(let el=$('life1World');el;el=el.parentElement)ancestors.push({id:el.id,tag:el.tagName,transform:getComputedStyle(el).transform,scrollLeft:el.scrollLeft,scrollTop:el.scrollTop});
    return {dpr:devicePixelRatio,viewport:visualViewport&&{scale:visualViewport.scale,offsetLeft:visualViewport.offsetLeft,offsetTop:visualViewport.offsetTop,pageLeft:visualViewport.pageLeft,pageTop:visualViewport.pageTop},
      scroll:[scrollX,scrollY],world:style($('life1World')),player:style($('life1Player')),
      obstacles:[...document.querySelectorAll('#life1World .l1-obstacle')].map(style),spots:['1','2','3','repair','antenna'].map(id=>({id,...style(spot(id))})),ancestors};
  }
  function rememberFailure(error, event) {
    report.failure ||= {message:error.message,event,previous:copy(beforeEvent),model:copy(state),browser:snapshot(),nativeDetails:nativeDetails()};
    throw error;
  }
  function event(e, execute) {
    if (report.failure) throw Error(report.failure.message);
    if (report.events.length>=12000)throw Error('Browser recorder event budget exceeded');
    beforeEvent=copy(state);let next, error;
    try {next=M.transition(state,e);} catch(e) {error=e;}
    // Still run the original oracle if candidate admission fails, preserving the
    // callback evidence. Never round timestamps or move a callback to model due.
    report.events.push(e);
    try {execute?.();} catch(oracleError) {return rememberFailure(oracleError,e);}
    if (error) return rememberFailure(error,e);
    state=next;
    try {return compare(e[0]);} catch(error) {return rememberFailure(error,e);}
  }
  function seededReset(label, expectedDraws, execute) {
    const prior=Math.random,draws=[];
    Math.random=()=>{const value=rng();draws.push(value);return value;};
    try {execute();} finally {Math.random=prior;report.randomDraws.push({label,draws});}
    eq(draws.length,expectedDraws,label+'.random draw count');
    if(Math.random!==prior)throw Error(label+'.Math.random was not restored');
  }
  window.life1Blocked=function(x,y) {const blocked=original.blocked(x,y);collisionCalls?.push({x,y,blocked});return blocked;};
  window.missionTimeout=function(n,callback,delay) {
    const prior=timerKind;timerKind=n===1?'delay':null;
    try {return original.timeout(n,callback,delay);} finally {timerKind=prior;}
  };
  window.setInterval=function(callback,delay,...args) {
    const kind=timerKind;
    if (!kind) return original.interval(callback,delay,...args);
    return original.interval(function(...callbackArgs) {
      // Playwright clock executes the original interval, including cancellation
      // and recurring cadence. We observe it; we do not invoke timer callbacks.
      event([kind,performance.now()],()=>callback.apply(this,callbackArgs));
    },delay,...args);
  };
  cancelAnimationFrame(l1MoveFrame);
  if(typeof life1MoveFrame!=='undefined')cancelAnimationFrame(life1MoveFrame);
  seededReset('initial Chapter 1 reset',5,()=>resetLife1Mission());
  const w=$('life1World').getBoundingClientRect();state=M.create(route,w.width,w.height);
  window.__life1Parity={report:()=>copy(report)};
  try {compare('initial');} catch(error) {rememberFailure(error,['initial',performance.now()]);}
  report.geometry.push({label:'initial',...snapshot()});
  // Registered after the production observer, so its real cached-geometry /
  // relocation callback runs first. Presentation text may resize this flex world
  // too; do not mistake the pre-observer transient for settled model geometry.
  new ResizeObserver(()=>{
    if(report.failure)return;
    const w=$('life1World').getBoundingClientRect();
    if(!state.active||!w.width||!w.height)return;
    if(Math.abs(l1Geometry.width-w.width)>PX||Math.abs(l1Geometry.height-w.height)>PX)return;
    try {
      if(Math.abs(state.geometry.width-w.width)>1e-8||Math.abs(state.geometry.height-w.height)>1e-8){
        const v=event(['layout',performance.now(),w.width,w.height]);report.geometry.push({label:'native ResizeObserver',...v});
      }else compare('native geometry settled');
    }catch(error){if(!report.failure)rememberFailure(error,['layout-observation',performance.now()]);}
  }).observe($('life1World'));
  function act(op,...args) {
    const e=[op,performance.now(),...args];
    return event(e,()=>{
      switch(op) {
        case 'collect':spot(args[0]).click();break;
        case 'open':spot(args[0]).click();break;
        case 'cell':document.querySelector(`[data-cell="${args[0]}"]`).click();break;
        case 'show':$('showRepairSequenceBtn').click();break;
        case 'dial':$('frequencyDial').value=String(args[0]);$('frequencyDial').dispatchEvent(new Event('input',{bubbles:true}));break;
        case 'tune':{const prior=timerKind;timerKind='hold';try {$('tuneBtn').click();} finally {timerKind=prior;}break;}
        case 'close':{
          const click=()=>document.querySelector(`#${args[0]}Panel .panel-close`).click();
          // Closing repair resets its challenge in unchanged production code.
          // This scoped four-draw reset continues the initial route PRNG stream.
          if(args[0]==='repair')seededReset('terminal challenge reset',4,click);else click();break;
        }
        case 'pause':document.querySelector(args[0]?'#mission1 .chapter-menu':'#guideResume').click();break;
        case 'hidden':
          if(args[0])Object.defineProperty(document,'hidden',{configurable:true,value:true});else delete document.hidden;
          document.dispatchEvent(new Event('visibilitychange'));break;
        case 'leave':show('home');cancelAnimationFrame(l1MoveFrame);break;
        case 'screen-enter':show('mission1');cancelAnimationFrame(l1MoveFrame);break;
        case 'stop':stopLife1Stick(null);break;
        default:throw Error('Not a browser action: '+op);
      }
    });
  }
  window.__life1Parity={
    act,
    frame(axes,timestamp=performance.now()) {
      // The bounded injection lane changes ONLY input axes. The pointer lane
      // omits axes and samples the real control state set by native mouse events.
      if(axes){l1MoveX=axes[0];l1MoveY=axes[1];}
      if(!Number.isFinite(timestamp)||timestamp>performance.now()+1e-8)throw Error('Frame clock is ahead of browser clock');
      const e=['frame',timestamp,l1MoveX,l1MoveY];
      report.input.push({kind:axes?'injected-frame':'real-pointer-axes',timestamp,performanceNow:performance.now(),axes:e.slice(2)});
      collisionCalls=[];cancelAnimationFrame(l1MoveFrame);
      try {return event(e,()=>{original.frame(timestamp);cancelAnimationFrame(l1MoveFrame);});}
      finally {collisionCalls=null;}
    },
    observedStop(reason) {
      // Called after an actual mouse-up, or explicitly labelled synthetic blur /
      // pointercancel. Do not call stopLife1Stick here to hide a release defect.
      report.input.push({kind:reason,timestamp:performance.now(),axes:[l1MoveX,l1MoveY]});
      return event(['stop',performance.now()]);
    },
    layout(label) {
      // ResizeObserver must already have executed the real refresh/recovery.
      // No refreshLife1Geometry call is made by this adapter.
      const w=$('life1World').getBoundingClientRect();
      const v=event(['layout',performance.now(),w.width,w.height]);
      report.geometry.push({label,...v});return v;
    },
    pagehide() {
      // There is no Chapter 1 pagehide -> leave/pause hook. A synthetic pagehide
      // dispatch only exercises registered handlers; it is NOT BFCache/reload.
      const before=snapshot();window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));
      eq(snapshot(),before,'pagehide preserves Chapter 1 controller state');compare('pagehide');
      report.events.push(['observation:pagehide',performance.now()]);
    },
    strictProbes() {
      const failures=[];
      for(let i=0;i<3;i++) for(const source of ['model','browser']) {
        const r=source==='model'?state.geometry.obstacles[i]:l1Geometry.obstacles[i];
        for(const edge of ['left','right','top','bottom']) for(const delta of [-1e-7,0,1e-7]) {
          const horizontal=edge==='left'||edge==='right';
          const x=horizontal?r[edge]+delta:(r.left+r.right)/2,y=horizontal?(r.top+r.bottom)/2:r[edge]+delta;
          const candidate=M.blocked(state,x,y),browser=original.blocked(x,y);
          const probe={kind:'strict-collision',source,i,edge,delta,x,y,candidate,browser};report.probes.push(probe);
          if(candidate!==browser)failures.push(probe);
        }
      }
      // Position assignment here is isolated boundary setup, never a completion
      // shortcut or an expected result. Restore both positions in finally.
      const prior={x:l1PX,y:l1PY,status:$('missionStatus').textContent},p=state.geometry.spots[0],g=state.geometry;
      try {
        for(const offset of [-.125,0,.125]) {
          const x=(p.x+.24*Math.min(g.width,g.height)+offset-1)/g.innerWidth*100,y=(p.y+27.3-1)/g.innerHeight*100;
          l1PX=x;l1PY=y;renderLife1Player();
          const candidate=M.distance({...state,x,y},'1'),browser=l1DistanceTo(spot('1'));
          const reached=canReachLife1(spot('1'));
          // canReach changes presentation copy on failure; restore immediately
          // so this isolated predicate probe does not itself resize the world.
          $('missionStatus').textContent=prior.status;
          eq(reached,browser<.24,'controller strict proximity predicate');
          const probe={kind:'strict-proximity',offset,x,y,candidate,browser,candidateReach:candidate<.24,browserReach:reached,player:rect($('life1Player')),spot:rect(spot('1')),style:{left:$('life1Player').style.left,top:$('life1Player').style.top}};report.probes.push(probe);
          if((candidate<.24)!==reached)failures.push(probe);
        }
      } finally {l1PX=prior.x;l1PY=prior.y;$('missionStatus').textContent=prior.status;renderLife1Player();}
      if(failures.length)rememberFailure(Error(`${failures.length} strict boundary decision mismatches; see probes`),['strict-probes',performance.now()]);
      compare('after strict probes');return report.probes;
    },
    snapshot:()=>({model:copy(state),browser:snapshot(),lastPointer:copy(lastPointer)}),
    layoutSettled:()=>{
      if(report.failure)throw Error(report.failure.message);
      const w=$('life1World').getBoundingClientRect();
      const fresh=state.active&&(Math.abs(state.geometry.width-w.width)>1e-8||Math.abs(state.geometry.height-w.height)>1e-8||
        Math.abs(l1Geometry.width-w.width)>PX||Math.abs(l1Geometry.height-w.height)>PX);
      return !fresh&&!report.pendingLayout;
    },
    check:()=>{const v=compare('explicit check');if(report.pendingLayout)throw Error('Unsettled observed layout: '+JSON.stringify(report.pendingLayout));return v;},
    report:()=>copy(report)
  };
  return {world:rect($('life1World')),model:copy(state)};
};
