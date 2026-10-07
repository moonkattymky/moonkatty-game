const assert=require('assert/strict'),R=require('../field-model.js'),{route,crewOrder,convoyPlan,decodeStep,gateStep}=require('./field-rules.cjs');
module.exports=async function solveField(p,options={}){
 const click=s=>p.locator(s).click(),snapshot=()=>p.evaluate(()=>MKTYField.snapshot()),a=(name,value)=>click('[data-field-action="'+name+'"]'+(value===undefined?'':'[data-value="'+value+'"]'));
 for(let k=0;k<3&&await p.locator('#legacyDialog').isVisible();k++){await p.locator('#legacyDialog [data-legacy-choice]').first().click();await p.waitForTimeout(50);}
 if(await p.locator('#fieldDialog').isVisible())await click('#fieldResume');
 let s=await snapshot(),b=R.layout(s),n=s.n;
 if(n===1||n===7){if(n===1)await a('scan');for(const target of [...b.targets,b.exit]){let attempts=0;while((s=await snapshot()).pos!==target&&attempts++<150){const next=route(s,target)[0];if(n===7){let waits=0;while(R.watched({...s,turn:s.turn+1},next)&&waits++<4){await a('wait');s=await snapshot();}}await click('[data-field-cell="'+next+'"]');}assert(attempts<150);}}
 if(n===2)for(const i of crewOrder(s)){await click('[data-field-cell="'+i+'"]');await a('role',b.jobs[i].role);await click('#fieldSubmit');}
 if(n===3)while(!(s=await snapshot()).complete){const burn=s.burn;b=R.layout(s);await p.locator('[data-field-slider="angle"]').fill(String(b.target.angle));await p.locator('[data-field-slider="power"]').fill(String(b.target.power));if(s.version===2)await p.locator('[data-field-slider="trim"]').fill(String(b.target.trim));await click('#fieldSubmit');assert.equal((await snapshot()).burn,burn+1,'Maneuver was rejected');}
 if(n===4)for(const site of s.version===2&&b.requiredSites===2?[b.safe,b.backup]:[b.safe]){await click('[data-field-cell="'+site+'"]');await a('scan');await a('sample');await click('#fieldSubmit');}
 if(n===5)while(!(s=await snapshot()).complete){b=R.layout(s);if(s.version===2){await a('diagnose');await a('isolate',b.fault);}for(let i=0;i<3;i++)await p.locator('[data-field-slider="valve"][data-index="'+i+'"]').fill(String(b.target[i]));await click('#fieldSubmit');}
 if(n===6){const held=new Set();async function steer(x,y){const next=new Set([...(x>.25?['ArrowRight']:x<-.25?['ArrowLeft']:[]),...(y>.25?['ArrowDown']:y<-.25?['ArrowUp']:[])]);for(const k of held)if(!next.has(k))await p.keyboard.up(k);for(const k of next)if(!held.has(k))await p.keyboard.down(k);held.clear();next.forEach(k=>held.add(k));}
  for(const bay of b.bays){let safety=0;while(s.docked<b.bays.indexOf(bay)+1&&safety++<900){s=await snapshot();const d=R.distance(s.ship,bay),dx=bay.x-s.ship.x,dy=bay.y-s.ship.y;if(d<24){await steer(0,0);await a('brake');await p.clock.runFor(120);await click('#fieldSubmit');s=await snapshot();continue;}const div=Math.max(Math.abs(dx),Math.abs(dy),1);await steer(dx/div,dy/div);if(d<65&&Math.hypot(s.ship.vx,s.ship.vy)>32)await a('brake');await p.clock.runFor(140);}assert(safety<900,'Docking route failed');}await steer(0,0);}
 if(n===8){for(let i=0;i<3;i++){await a('station',i);await p.locator('[data-field-slider="angle"]').fill(String(Math.round(b.bearings[i])));await a('sample');}const svg=p.locator('#fieldWorld > svg'),box=await svg.boundingBox();await svg.click({position:{x:b.source.x/600*box.width,y:b.source.y/450*box.height}});await click('#fieldSubmit');}
 if(n===9)for(const step of convoyPlan(s)){if(step[0]==='gate')await a('gate');else{await a('select',step[1]);await click('[data-field-cell="'+step[2]+'"]');}}

 if(n===10){let g=0;while(!(s=await snapshot()).complete&&g++<60){const st=decodeStep(s);if(st[0]==='answer'){await a('answer');continue;}await a('tune',st[1]);if(st[2])await a('filter');await click('#fieldSubmit');}}
 if(n===11){let g=0;while(!(s=await snapshot()).complete&&g++<60){const st=gateStep(s);if(st==='launch')await click('#fieldSubmit');else await a(st);}}
 s=await snapshot();assert(s.complete&&R.won(s),'Field not complete '+n);if(options.finish!==false)await click('#fieldSubmit');return s;
};
