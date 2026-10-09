'use strict';
const assert=require('node:assert/strict');
const M=require('../life1-model.js'),{createController}=require('./fixtures/life1-controller.cjs'),{DEFAULT_ROUTE:R,createTrace}=require('./fixtures/life1-playthrough.cjs');
let scenarios=0,compared=0;
function close(a,b,label){assert(Math.abs(a-b)<1e-9,`${label}: model=${a}, controller=${b}`);}
function compare(s,c,label){
 const v=c.snapshot();
 for(const k of ['x','y','walkDistance','moveX','moveY','lastFrame','nearbyAt','dial','holdProgress'])close(s[k],v[k],label+'.'+k);
 for(const k of ['direction','walking','stage','repairCells','repairShowing','repairOpen','antennaOpen','completeVisible','active','paused','hidden'])assert.equal(s[k],v[k],label+'.'+k);
 assert.equal(s.repairDisabled,v.cellsDisabled.every(Boolean),label+'.repairDisabled');assert.equal(s.frequency,v.target,label+'.target');assert.equal(s.holding,v.holdActive,label+'.holding');
 assert.deepEqual(s.collected.map(Number).sort(),v.collectedIds,label+'.collected');assert.deepEqual(s.sequence,v.repairSequence,label+'.sequence');assert.deepEqual(s.repairInput,v.repairInput,label+'.input');
 assert.equal(s.near,v.near==='repairTerminal'?'repair':v.near==='antennaHotspot'?'antenna':v.near,label+'.near');
 for(let i=0;i<3;i++)for(const k of ['left','right','top','bottom'])close(s.geometry.obstacles[i][k],v.geometry.obstacles[i][k],label+'.obstacle'+i+'.'+k);
 compared++;
}
function oracle(route=R,width=360,height=360){
 let s=M.create(route,width,height);const c=createController({width,height,random:M.random(M.challengeSeed(route))});
 compare(s,c,'initial');
 function event(e){
  const [op,t,a,b]=e;c.setClock(t);
  switch(op){
   case 'frame':c.frame({now:t,x:a,y:b});break;
   case 'collect':c.collect(Number(a)-1);break;
   case 'open':a==='repair'?c.openRepair():c.openAntenna();break;
   case 'cell':c.cell(a);break;
   case 'dial':c.dial(a);break;
   case 'tune':c.tune();break;
   case 'hold':c.holdTick(t);break;
   case 'pause':c.setPaused(a);if(a)c.release();break;
   case 'hidden':c.setHidden(a);break;
   case 'close':a==='repair'?c.closeRepair():c.closeAntenna();break;
   case 'layout':c.resize(a,b);break;
   case 'leave':c.leave();break;
   case 'screen-enter':c.enter();break;
   case 'show':c.showSequence();break;
   case 'delay':c.delayCallback(t);break;
   case 'stop':c.release();break;
   default:throw Error(op);
  }
  s=M.transition(s,e);compare(s,c,`event ${++event.count} ${JSON.stringify(e)}`);return s;
 }
 event.count=0;scenarios++;return {event,get state(){return s;},controller:c};
}
// Same random numbers enter the original Math.random calls, rather than replacing
// challenge outcomes or modifying production controller logic.
for(const [w,h]of [[292,180],[332,240],[362,360],[402,475],[492,620],[359.375,247.625]])for(const seed of [0,571,0xffffffff]){
 const route={...R,seed},o=oracle(route,w,h),p=createTrace(route,w,h).finish();for(const e of p.proof.events)o.event(e);assert(M.won(o.state));
 // The production completion card appears after six active 50ms callback ticks.
 for(let i=0;i<5;i++)o.event(['delay',o.state.now+50]);assert(!o.state.completeVisible);
 o.event(['pause',o.state.now,true]);for(let i=0;i<8;i++)o.event(['delay',o.state.now+50]);assert(!o.state.completeVisible);
 o.event(['pause',o.state.now,false]);o.event(['delay',o.state.now+50]);assert(o.state.completeVisible);
 const x=o.state.x;o.event(['frame',o.state.now+500,1,1]);assert.equal(o.state.x,x);
}
// Deadzone, 0-first-frame sentinel, normalization, capped variable dt, obstacle
// sliding, bounds and resize recovery: compare source after every submitted frame.
{
 const o=oracle(),rnd=M.random(904);const pattern=[0,8.333333333,16.666666666,40,120,1000];
 o.event(['frame',0,1,0]);o.event(['frame',10,.08,0]);o.event(['frame',50,.0800001,0]);
 for(let i=0;i<1500;i++){
  if(i%137===0)o.event(['layout',o.state.now,...[[292,180],[360,360],[492,620],[359.375,247.625]][Math.floor(i/137)%4]]);
  const inputs=i%9===0?[1,1]:[Math.round(rnd()*2)-1,Math.round(rnd()*2)-1];
  o.event(['frame',o.state.now+pattern[i%pattern.length],...inputs]);
 }
 o.event(['hidden',o.state.now,true]);for(let i=0;i<3;i++)o.event(['frame',o.state.now+1000,1,1]);o.event(['hidden',o.state.now,false]);assert(o.state.paused);o.event(['frame',o.state.now+90000,-1,0]);o.event(['pause',o.state.now,false]);
 o.event(['pause',o.state.now,true]);o.event(['leave',o.state.now]);assert(!o.state.paused);o.event(['frame',o.state.now+1000,1,1]);o.event(['screen-enter',o.state.now]);o.event(['frame',o.state.now+1000,1,1]);
}
// Real watch callbacks, wrong circuit, panel-close regeneration, background clock
// reset, antenna tolerance/loss, close cancellation, pause and exactly25 ticks.
{
 const t=createTrace(),o=oracle();for(const id of ['1','2','3']){t.navigate(id);t.emit('collect',id);}t.navigate('repair');t.emit('open','repair');for(const e of t.proof.events)o.event(e);
 o.event(['cell',o.state.now,(o.state.sequence[0]+1)%3]);
 o.event(['show',o.state.now]);for(let i=0;i<13;i++)o.event(['delay',o.state.now+50]);
 o.event(['hidden',o.state.now+40,true]);o.event(['delay',o.state.now+10]);o.event(['hidden',o.state.now+80,false]);o.event(['delay',o.state.now+10]);assert(o.state.paused);o.event(['pause',o.state.now,false]);
 o.event(['close',o.state.now,'repair']);o.event(['open',o.state.now,'repair']);o.event(['show',o.state.now]);
 o.event(['pause',o.state.now,true]);for(let i=0;i<4;i++)o.event(['delay',o.state.now+50]);o.event(['pause',o.state.now,false]);
 for(let i=0;i<52;i++)o.event(['delay',o.state.now+50]);assert(!o.state.repairShowing);
 for(const n of o.state.sequence.slice())o.event(['cell',o.state.now,n]);
 // Continue a fresh navigator from the verified state via a small local path:
 // top corridor then across/right and up, ending in antenna proximity.
 let guard=0;while(M.distance(o.state,'antenna')>=.24){assert(++guard<300);const dx=o.state.x<73?1:0,dy=o.state.y>45?-1:0;o.event(['frame',o.state.now+40,dx,dy]);}
 o.event(['open',o.state.now,'antenna']);o.event(['dial',o.state.now,o.state.frequency+4]);o.event(['tune',o.state.now]);assert(!o.state.holding);
 o.event(['dial',o.state.now,o.state.frequency+3]);o.event(['tune',o.state.now]);o.event(['hold',o.state.now+120]);
 o.event(['dial',o.state.now,o.state.frequency+4]);assert.equal(o.state.holdProgress,0);
 o.event(['dial',o.state.now,o.state.frequency]);o.event(['tune',o.state.now]);o.event(['hold',o.state.now+120]);o.event(['close',o.state.now,'antenna']);
 o.event(['open',o.state.now,'antenna']);o.event(['tune',o.state.now]);o.event(['hidden',o.state.now,true]);for(let i=0;i<4;i++)o.event(['hold',o.state.now+120]);assert.equal(o.state.holdProgress,0);o.event(['hidden',o.state.now,false]);assert(o.state.paused);o.event(['hold',o.state.now+120]);assert.equal(o.state.holdProgress,0);o.event(['pause',o.state.now,false]);
 for(let i=0;i<24;i++)o.event(['hold',o.state.now+120]);assert.equal(o.state.stage,2);o.event(['hold',o.state.now+120]);assert(M.won(o.state));
 o.event(['leave',o.state.now]);o.event(['screen-enter',o.state.now+1000]);assert.equal(o.state.completeDue,null);assert(!o.state.completeVisible);
}

// Leaving during playback cancels timers but leaves the real cell buttons disabled.
// A screen-only return cannot complete repair until playback completes or close resets it.
{
 const t=createTrace(),o=oracle();for(const id of ['1','2','3']){t.navigate(id);t.emit('collect',id);}t.navigate('repair');t.emit('open','repair');for(const e of t.proof.events)o.event(e);
 o.event(['show',o.state.now]);o.event(['leave',o.state.now]);o.event(['screen-enter',o.state.now]);assert(o.state.repairDisabled);
 for(const n of o.state.sequence.slice())o.event(['cell',o.state.now,n]);assert.equal(o.state.stage,1);
 o.event(['show',o.state.now]);for(let i=0;i<52;i++)o.event(['delay',o.state.now+50]);assert(!o.state.repairDisabled);
 for(const n of o.state.sequence.slice())o.event(['cell',o.state.now,n]);assert.equal(o.state.stage,2);
}
console.log(JSON.stringify({suite:'life1-controller-differential',scenarios,statesCompared:compared,source:'unmodified app.js + experience.js excerpts',browserRun:false}));
