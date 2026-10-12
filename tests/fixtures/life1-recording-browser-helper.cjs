'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
function bundle(){
 const base=path.join(root,'prototypes/life1-capture');
 const modules={native:fs.readFileSync(path.join(base,'pr47/life1-native-geometry.js'),'utf8'),model:fs.readFileSync(path.join(base,'pr47/life1-model.js'),'utf8'),
  callback:fs.readFileSync(path.join(base,'prototype/source-callback-model.cjs'),'utf8'),recorder:fs.readFileSync(path.join(base,'prototype/chapter1-recorder.cjs'),'utf8')};
 return `(function(){const source=${JSON.stringify(modules)},cache={};function load(name){if(cache[name])return cache[name].exports;const m=cache[name]={exports:{}};const req=p=>load(p.includes('native-geometry')?'native':p.includes('life1-model')?'model':p.includes('source-callback')?'callback':(()=>{throw Error('Unknown test module '+p)})());new Function('module','exports','require',source[name])(m,m.exports,req);return m.exports;}window.Life1NativeGeometry=load('native');window.Life1Prototype=load('model');window.LocalLife1Recorder=load('recorder');})();\n`+
  fs.readFileSync(path.join(base,'controller-adapter.js'),'utf8');
}
// This callback runs only inside a later explicitly authorized browser fixture.
function nativeCheck(){
 const s=__C1Capture.state(),N=Life1NativeGeometry,errors=[];
 if(devicePixelRatio!==1||scrollX!==0||scrollY!==0||(visualViewport&&(visualViewport.scale!==1||visualViewport.offsetLeft!==0||visualViewport.offsetTop!==0)))throw Error('Unsupported native DPR/zoom/page scroll');
 for(let el=$('life1World');el;el=el.parentElement){const c=getComputedStyle(el);if(el.scrollLeft||el.scrollTop||c.transform!=='none'||Number(c.zoom)!==1)throw Error('Unsupported native ancestor transform/scroll: '+el.id);}
 const rect=el=>{const r=el.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
 const eq=(a,b,label)=>{for(const k of ['left','top','right','bottom','width','height'])if(!Object.is(a[k],b[k]))errors.push(label+'.'+k);};
 eq(s.liveGeometry.world,rect($('life1World')),'world');eq(N.playerRect(s.liveGeometry,s.x,s.y),rect($('life1Player')),'player');
 [...document.querySelectorAll('#life1World .l1-obstacle')].forEach((el,i)=>eq(s.liveGeometry.rawObstacles[i],rect(el),'obstacle'+i));
 for(const id of ['1','2','3','repair','antenna']){
  const el=id==='repair'?$('repairTerminal'):id==='antenna'?$('antennaHotspot'):document.querySelector('.energy[data-energy="'+id+'"]');
  eq(N.spotRect(s.liveGeometry,id,s.highlightedNear,s.collected.includes(id)),rect(el),'target'+id);
 }
 const controller=__C1Capture.compare();if(!controller.ok)errors.push(...controller.errors);
 if(errors.length)throw Error('Exact native geometry/controller mismatch: '+errors.join(','));
 return {world:rect($('life1World')),checkedRawFields:true};
}
module.exports={bundle,nativeCheck};
