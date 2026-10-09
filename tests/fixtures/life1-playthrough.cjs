'use strict';
/* Synthetic valid transcript generator, not a human-play claim. */
const M=require('../../life1-model.js');
const DEFAULT_ROUTE=Object.freeze({route:'00000000-0000-4000-8000-000000000571',life:1,edition:2,challenge_version:2,seed:571});
function createTrace(route=DEFAULT_ROUTE,width=360,height=360){
 const proof={version:1,route:route.route,challenge:M.routeKey(route),rules:M.RULES,layout:M.LAYOUT,initial:[width,height],events:[]};
 let state=M.create(route,width,height);
 function emit(op,...args){const e=[op,state.now,...args];proof.events.push(e);state=M.transition(state,e);return state;}
 function at(time,op,...args){if(time<state.now)throw Error('time-reversal');state={...state,now:time};return emit(op,...args);}
 function navigate(id){
  at(state.now+1,'frame',0,0);
  // Breadth-first search on a 1%-coordinate grid with exact model collision tests.
  const start={x:state.x,y:state.y,parent:null},q=[start],seen=new Set([`${start.x},${start.y}`]);let goal=null;
  for(let i=0;i<q.length;i++){
   const p=q[i];if(M.distance({...state,x:p.x,y:p.y},id)<.225){goal=p;break;}
   for(const [dx,dy]of [[-1,0],[1,0],[0,-1],[0,1]]){const x=p.x+dx,y=p.y+dy,k=`${x},${y}`;if(x<7||x>90||y<18||y>88||seen.has(k)||M.blocked(state,x,y))continue;seen.add(k);q.push({x,y,parent:p});}
  }
  if(!goal)throw Error('No path to '+id+' at '+width+'x'+height);
  const path=[];while(goal.parent){path.push(goal);goal=goal.parent;}
  for(const p of path.reverse()){
   const dx=(p.x-state.x)*state.geometry.width/100,dy=(p.y-state.y)*state.geometry.height/100,d=Math.hypot(dx,dy),parts=Math.ceil(d/3.4),dt=d/parts/88*1000;
   for(let i=0;i<parts;i++)at(state.now+dt,'frame',dx/d,dy/d);
  }
  if(M.distance(state,id)>=.24)throw Error('Navigator drift');
 }
 function finish(){
  for(const id of ['1','2','3']){navigate(id);emit('collect',id);}
  navigate('repair');emit('open','repair');for(const n of state.sequence)emit('cell',n);
  navigate('antenna');emit('open','antenna');emit('dial',state.frequency);emit('tune');
  for(let i=0;i<25;i++)at(state.now+120,'hold');
  return {proof,state,body:JSON.stringify(proof)};
 }
 return {proof,get state(){return state;},emit,at,navigate,finish};
}
module.exports={DEFAULT_ROUTE,createTrace};
