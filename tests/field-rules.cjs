const R=require('../field-model.js'),assert=require('assert/strict');
function route(s,target){const b=R.layout(s),q=[[s.pos]],seen=new Set([s.pos]);while(q.length){const path=q.shift(),p=path.at(-1);if(p===target)return path.slice(1);for(const v of [p-6,p+6,p-1,p+1])if(v>=0&&v<36&&!b.walls.includes(v)&&!seen.has(v)&&Math.abs(v%6-p%6)+Math.abs(Math.floor(v/6)-Math.floor(p/6))===1){seen.add(v);q.push([...path,v]);}}throw Error('Disconnected mission');}
function crewOrder(s){const jobs=R.layout(s).jobs,done=s.jobs.slice(),order=[];while(done.length<6){const i=jobs.findIndex((j,i)=>!done.includes(i)&&j.requires.every(k=>done.includes(k)));assert(i>=0);done.push(i);order.push(i);}return order;}
function convoyPlan(s){const key=x=>x.ships.join(',')+'/'+x.gate,q=[[structuredClone(s),[]]],seen=new Set([key(s)]);for(let at=0;at<q.length;at++){const [cur,route]=q[at];if(cur.complete)return route;const candidates=[];if(!cur.gate&&cur.ships[1]===R.layout(cur).gateNode)candidates.push(['gate']);for(let i=0;i<3;i++)for(let j=0;j<=8;j++)candidates.push(['move',i,j]);for(const a of candidates){const next=structuredClone(cur);if(a[0]==='gate')R.act(next,'gate');else{R.act(next,'select',a[1]);R.act(next,'move',a[2]);}const k=key(next);if(!seen.has(k)){seen.add(k);q.push([next,[...route,a]]);}}}throw Error('Convoy has no solution');}
function solve(s){let b=R.layout(s);
 if(s.n===1||s.n===7){R.act(s,'scan');for(const target of [...b.targets,b.exit]){let safety=0;while(s.pos!==target&&safety++<100){const next=route(s,target)[0];if(s.n===7){let waits=0;while(R.watched({...s,turn:s.turn+1},next)&&waits++<4)R.act(s,'wait');}R.act(s,'move',next);}assert(safety<100);}}
 if(s.n===2)for(const i of crewOrder(s)){R.act(s,'select',i);R.act(s,'role',b.jobs[i].role);R.act(s,'assign');}
 if(s.n===3)while(!s.complete){b=R.layout(s);R.act(s,'angle',b.target.angle);R.act(s,'power',b.target.power);R.act(s,'burn');}
 if(s.n===4){R.act(s,'select',b.safe);R.act(s,'scan');R.act(s,'sample');R.act(s,'land');}
 if(s.n===5){b.target.forEach((v,i)=>R.act(s,'valve',[i,v]));R.act(s,'stabilize');}
 if(s.n===6){for(const target of b.bays){s.ship.x=target.x;s.ship.y=target.y;s.ship.vx=s.ship.vy=0;R.act(s,'dock');}}
 if(s.n===8){for(let i=0;i<3;i++){R.act(s,'station',i);R.act(s,'angle',Math.round(b.bearings[i]));R.act(s,'sample');}R.act(s,'pin',b.source);R.act(s,'locate');}
 if(s.n===9)for(const a of convoyPlan(s)){if(a[0]==='gate')R.act(s,'gate');else{R.act(s,'select',a[1]);R.act(s,'move',a[2]);}}
 assert(s.complete&&R.won(s),'Unsolved chapter '+s.n);assert(R.restore(s,s.n,s.stage,s.seed));return s;
}
if(require.main===module){let runs=0;for(let n=1;n<=9;n++)for(let stage=0;stage<5;stage++)for(let seed=1;seed<=40;seed++){const s=R.create(n,stage,seed);assert(!s.complete);assert(R.restore(s,n,stage,seed));const forged={...s,complete:true};assert.equal(R.restore(forged,n,stage,seed),null);solve(s);runs++;}
 const dock=R.create(6,3,7);R.act(dock,'dock');assert.equal(dock.docked,0);for(let i=0;i<300;i++)R.tick(dock,.016,{x:1,y:0});assert(dock.ship.x>80&&dock.integrity>=25);const bad=R.create(8,2,9);R.act(bad,'locate');assert(!bad.complete);bad.angles=[NaN,2,3];assert.equal(R.restore(bad,8,2,9),null);console.log(JSON.stringify({solvedSpatialMissions:runs,forgedCompletionsRejected:true,dockingPhysics:true}));}
module.exports={route,solve,crewOrder,convoyPlan};
