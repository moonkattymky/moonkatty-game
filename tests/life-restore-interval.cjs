/* Execute the production local-life functions verbatim in a pure, isolated clock/storage
   harness. No app/controller rewrite, real player data, browser, server, or network. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const start=source.indexOf('const MKTY_MAX_LIVES=9,'),end=source.indexOf('function ensureLife1MemoryCode(){',start);
assert(start>=0&&end>start,'Read the actual life bank and spend functions from app.js');
const actual=source.slice(start,end),HOUR=3600000,origin=Date.parse('2026-10-11T00:00:00Z');
function harness(saved=new Map()){
 let now=origin;
 const ctx={localStorage:{getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,String(v)),removeItem:k=>saved.delete(k)},Date:{now:()=>now},window:{},renderLife3Gate(){}};
 vm.createContext(ctx);vm.runInContext(actual,ctx,{filename:'app.js:actual-life-bank'});
 return {saved,at:hour=>{now=origin+hour*HOUR;},lives:()=>ctx.getLifeBank(),spend:key=>ctx.spendGlobalLife(key),stamp:()=>Number(saved.get('mkty_life_restore_at'))||0};
}
// Losses 3 and 11 hours later share the first interval; they do NOT each restore
// 12 hours after their own loss, nor restart/delay the first recovery.
let h=harness();assert.equal(h.lives(),9);assert.equal(h.stamp(),0);
for(const hour of [0,3,11]){h.at(hour);assert.equal(h.spend('synthetic:'+hour),true);assert.equal(h.stamp(),origin);}
assert.equal(h.lives(),6);
for(const [hour,lives,stampHour] of [[11.999,6,0],[12,7,12],[15,7,12],[23,7,12],[24,8,24],[35.999,8,24],[36,9,null],[100,9,null]]){
 h.at(hour);assert.equal(h.lives(),lives,'staggered losses at '+hour+'h');assert.equal(h.stamp(),stampHour===null?0:origin+stampHour*HOUR);
}
// A full bank clears the timer. The next loss begins a new interval.
assert.equal(h.spend('synthetic:new-cycle'),true);assert.equal(h.stamp(),origin+100*HOUR);
h.at(111.999);assert.equal(h.lives(),8);h.at(112);assert.equal(h.lives(),9);assert.equal(h.stamp(),0);
// Reload and offline catch-up use the same persisted interval, capped at nine.
h=harness();for(const hour of [0,3,11]){h.at(hour);h.spend('synthetic:offline:'+hour);}
h=harness(h.saved);h.at(25);assert.equal(h.lives(),8);assert.equal(h.stamp(),origin+24*HOUR);
h.at(200);assert.equal(h.lives(),9);assert.equal(h.stamp(),0);
// Spending after a partial recovery cannot reset that existing timer.
h=harness();for(let i=0;i<3;i++)h.spend('synthetic:partial:'+i);
h.at(12);assert.equal(h.lives(),7);h.at(13);h.spend('synthetic:partial:again');assert.equal(h.stamp(),origin+12*HOUR);
h.at(24);assert.equal(h.lives(),7);h.at(36);assert.equal(h.lives(),8);h.at(48);assert.equal(h.lives(),9);
// Zero lives rejects another spend, with exactly one life returned at each boundary.
h=harness();for(let i=0;i<9;i++){h.at(i);assert.equal(h.spend('synthetic:empty:'+i),true);}
assert.equal(h.lives(),0);assert.equal(h.spend('synthetic:empty:blocked'),false);assert.equal(h.stamp(),origin);
for(let n=1;n<=9;n++){h.at(n*12-.0001);assert.equal(h.lives(),n-1);h.at(n*12);assert.equal(h.lives(),n);}
assert.equal(h.stamp(),0);
console.log('PASS: production life functions, staggered losses, exact 12h boundaries, sequential recovery, reload, offline cap, active-timer preservation and empty-bank rejection');
