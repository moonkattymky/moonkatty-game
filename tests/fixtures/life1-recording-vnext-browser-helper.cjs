'use strict';
// Test-only browser sources. Import/bundle do not start a browser or server.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const base=path.join(root,'prototypes/life1-capture');
function bundle(){
 const sources={},dependencies={};
 function include(filename){
  const file=fs.realpathSync(filename);
  if(!file.startsWith(base+path.sep))throw Error('vNext fixture module outside prototype: '+filename);
  const id=path.relative(base,file).split(path.sep).join('/');if(Object.hasOwn(sources,id))return id;
  const source=fs.readFileSync(file,'utf8');sources[id]=source;dependencies[id]={};
  for(const match of source.matchAll(/\brequire\(\s*(['"])([^'"]+)\1\s*\)/g)){
   const request=match[2];if(!request.startsWith('./')&&!request.startsWith('../'))throw Error('Unsupported browser fixture dependency: '+request);
   dependencies[id][request]=include(path.resolve(path.dirname(file),request));
  }
  return id;
 }
 const native=include(path.join(base,'pr47/life1-native-geometry.js'));
 const model=include(path.join(base,'pr47/life1-model.js'));
 const recorder=include(path.join(base,'vnext/recorder.cjs'));
 return `(function(){const sources=${JSON.stringify(sources)},dependencies=${JSON.stringify(dependencies)},cache={};function load(id){if(cache[id])return cache[id].exports;if(!Object.hasOwn(sources,id))throw Error('Unknown vNext fixture module '+id);const m=cache[id]={exports:{}};new Function('module','exports','require',sources[id])(m,m.exports,request=>{const next=dependencies[id][request];if(!next)throw Error('Unknown vNext fixture dependency '+request);return load(next);});return m.exports;}window.Life1NativeGeometry=load(${JSON.stringify(native)});window.Life1Prototype=load(${JSON.stringify(model)});window.LocalLife1VNextRecorder=load(${JSON.stringify(recorder)});})();\n`+
  fs.readFileSync(path.join(base,'vnext/controller-adapter.js'),'utf8')+'\n'+
  `(${installNativeDiagnostics.toString()})(${nativeCheck.toString()},${geometrySnapshot.toString()});`;
}
// Strict raw DOMRect checks use the actual source read's envelope. The last
// recorded live geometry need not equal a DOM layout changed after that read.
// This does not replace either cache or live source reads with a settled poll.
function nativeCheck(observedWorld){
 const N=Life1NativeGeometry,capture=__C1VNext,source=capture.source(),errors=[];
 if(devicePixelRatio!==1||scrollX!==0||scrollY!==0||(visualViewport&&(visualViewport.scale!==1||visualViewport.offsetLeft!==0||visualViewport.offsetTop!==0)))throw Error('Unsupported native DPR/zoom/page scroll');
 for(let el=$('life1World');el;el=el.parentElement){const c=getComputedStyle(el);if(el.scrollLeft||el.scrollTop||c.transform!=='none'||Number(c.zoom)!==1)throw Error('Unsupported native ancestor transform/scroll: '+el.id);}
 const rect=el=>{const r=el.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
 const eq=(a,b,label)=>{for(const k of ['left','top','right','bottom','width','height'])if(!Object.is(a[k],b[k]))errors.push(label+'.'+k+': '+a[k]+' !== '+b[k]);};
 const world=observedWorld||rect($('life1World')),native=N.layout(world.width,world.height,world.left,world.top);
 eq(native.world,rect($('life1World')),'world');eq(N.playerRect(native,source.x,source.y),rect($('life1Player')),'player');
 [...document.querySelectorAll('#life1World .l1-obstacle')].forEach((el,i)=>eq(native.rawObstacles[i],rect(el),'obstacle'+i));
 for(const id of ['1','2','3','repair','antenna']){
  const el=id==='repair'?$('repairTerminal'):id==='antenna'?$('antennaHotspot'):document.querySelector('.energy[data-energy="'+id+'"]');
  eq(N.spotRect(native,id,source.highlightedNear,source.collected.includes(id)),rect(el),'target'+id);
 }
 if(errors.length)throw Error('Exact native geometry mismatch: '+errors.join(','));
 return {world:native.world,checkedRawFields:true};
}
function geometrySnapshot(){
 const rect=el=>{const r=el.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
 const mission=$('mission1'),status=$('missionStatus'),recorded=window.__C1VNext?.state(),style=getComputedStyle(mission);
 return {snapshotMs:performance.now(),world:rect($('life1World')),sourceCache:{width:l1Geometry.width,height:l1Geometry.height,obstacles:l1Geometry.obstacles},
  recorded:recorded?{document:recorded.document,dispatchMs:recorded.dispatchMs,lastFrame:recorded.lastFrame,nearbyAt:recorded.nearbyAt,clockResumedAt:recorded.clockResumedAt,geometry:recorded.geometry,liveWorld:recorded.liveGeometry.world}:null,
  status:{text:status.textContent,rect:rect(status)},stage:life1Stage,
  animation:{reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,name:style.animationName,transform:style.transform,
   active:mission.getAnimations().map(a=>({name:a.animationName||null,playState:a.playState,currentTime:a.currentTime,startTime:a.startTime}))}};
}
function installNativeDiagnostics(check,snapshot){
 const capture=window.__C1VNext;if(!capture)throw Error('Missing vNext capture');
 const diagnostics=window.__C1VNextNative={checks:0,liveReads:0,cacheReads:0,callbacks:[],firstFailure:null,lastObservedLive:null,staleCacheFrames:[],firstResumedFrames:[]};
 let depth=0,lastEntry=-1,lastDocument=-1,awaitResumedFrame=false;
 const clone=value=>JSON.parse(LocalLife1VNextRecorder.encode(value));
 const remember=error=>{if(!diagnostics.firstFailure)diagnostics.firstFailure={error:error.message,status:capture.status(),snapshot:snapshot()};};
 function after(kind,args){
  const status=capture.status();if(!status.recording||status.pendingCallback)return;
  try{
   if(status.fault)throw Error('vNext recording refused: '+JSON.stringify(status.fault));
   const compared=capture.compare();if(!compared.ok)throw Error('Exact source/model mismatch: '+compared.errors.join(','));
   const state=capture.state(),wire=JSON.parse(capture.wire()),entry=wire.entries.at(-1);
   if(lastDocument!==state.document){lastDocument=state.document;if(!diagnostics.lastObservedLive)diagnostics.lastObservedLive=check().world;}
   const live=diagnostics.lastObservedLive;
   for(const key of ['left','top','right','bottom','width','height'])if(!Object.is(state.liveGeometry.world[key],live[key]))throw Error('Last observed live mismatch: '+key);
   diagnostics.checks++;
   if(entry[2]!==lastEntry){
    lastEntry=entry[2];
    const steps=entry[0]==='callback'?entry[5]:entry[7]||[],frames=steps.filter(step=>step[0]==='frame');
    if(kind==='frame'&&(frames.length!==1||!Object.is(frames[0][1],args[0])||!Object.is(state.lastFrame,args[0])))throw Error('Original RAF argument was not retained exactly');
    const observation={document:entry[1],sequence:entry[2],dispatchMs:entry[3],kind:entry[0]==='callback'?entry[4]:'document',frames:clone(frames),sourceLastFrame:state.lastFrame,sourceNearbyAt:state.nearbyAt,cacheHeight:state.geometry.height,liveHeight:state.liveGeometry.world.height,paused:state.paused};
    diagnostics.callbacks.push(observation);
    if(steps.some(step=>step[0]==='pause'&&step[1]===false))awaitResumedFrame=true;
    if(frames.length&&awaitResumedFrame){diagnostics.firstResumedFrames.push(observation);awaitResumedFrame=false;}
    if(frames.length&&(!Object.is(state.geometry.width,state.liveGeometry.world.width)||!Object.is(state.geometry.height,state.liveGeometry.world.height)))diagnostics.staleCacheFrames.push(observation);
   }
  }catch(error){remember(error);}
 }
 window.__C1VNext=Object.freeze({...capture,
  wrap(kind,fn){const wrapped=capture.wrap(kind,fn);return function(...args){const outer=depth++===0;try{return wrapped.apply(this,args);}finally{depth--;if(outer)after(kind,args);}};},
  live(world){const result=capture.live(world);if(capture.status().recording&&capture.status().pendingCallback){try{diagnostics.lastObservedLive=check(world).world;diagnostics.liveReads++;}catch(error){remember(error);}}return result;},
  step(value){const result=capture.step(value);if(value[0]==='cache'&&capture.status().recording){try{
   const expected=Life1NativeGeometry.layout(...value.slice(1));
   for(const key of ['width','height'])if(!Object.is(l1Geometry[key],expected.world[key]))throw Error('Exact native cache mismatch: '+key);
   for(let i=0;i<3;i++)for(const key of ['left','right','top','bottom'])if(!Object.is(l1Geometry.obstacles[i][key],expected.obstacles[i][key]))throw Error('Exact native collision edge mismatch: '+i+'.'+key);
   diagnostics.cacheReads++;
  }catch(error){remember(error);}}return result;},
  restore(){const result=capture.restore();after();return result;}
 });
}
module.exports={bundle,nativeCheck,geometrySnapshot,installNativeDiagnostics};
