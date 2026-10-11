/* Real operation controller + pacing rules in a socket-free DOM harness.
 * Boards remain board-typed in checkpoints; only failure ownership uses the chapter.
 * No browser, backend, network, or real player data is used. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const R=require('../mission-rules.js'),P=require('../story-plan.js'),root=path.resolve(__dirname,'..');
const clone=value=>structuredClone(value);
function harness(data=new Map()){
 const elements=new Map(),calls=[],spent=[],completed=[],saved=new Map();let active='home',checkpoint=null;
 class Element{
  constructor(id=''){this.id=id;this.dataset={};this.children=[];this.attributes={};this.style={setProperty(){}};this.classes=new Set();this.classList={contains:x=>this.classes.has(x),add:x=>this.classes.add(x),remove:x=>this.classes.delete(x),toggle:(x,on)=>on?this.classes.add(x):this.classes.delete(x)};}
  set innerHTML(value){this.html=value;for(const m of value.matchAll(/id="([^"]+)"/g))get(m[1]);}get innerHTML(){return this.html||'';}
  append(...nodes){this.children.push(...nodes);for(const n of nodes)if(n.id)elements.set(n.id,n);}replaceChildren(...nodes){this.children=nodes;}
  setAttribute(k,v){this.attributes[k]=String(v);}removeAttribute(k){delete this.attributes[k];if(k==='data-story-task')delete this.dataset.storyTask;}
  querySelectorAll(){return [];}querySelector(){return null;}addEventListener(){}focus(){}before(){}
  showModal(){this.open=true;}close(){this.open=false;}click(){if(!this.disabled)this.onclick?.();}
 }
 const get=id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id);};
 const document={body:get('body'),hidden:false,activeElement:null,createElement:()=>new Element(),getElementById:id=>elements.get(id)||null,querySelector:s=>s==='.screen.active'?get(active):null,querySelectorAll:()=>[],addEventListener(){}};
 const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};
 const show=id=>{get(active).classes.delete('active');active=id;get(id).classes.add('active');};
 const window={addEventListener(){}};for(let n=4;n<=9;n++)window['openMission'+n]=()=>show('mission'+n);
 const lives=()=>Number(storage.getItem('mkty_global_lives')??9);
 const context={window,document,localStorage:storage,$:document.getElementById,MissionRules:R,OperationsArt:new Proxy({},{get:()=>()=>''}),show,structuredClone,console,tg:null,setInterval(){},clearInterval(){},setTimeout(){},clearTimeout(){},queueMicrotask(){},getLifeBank:lives,spendGlobalLife:key=>{spent.push(key);if(lives()<=0)return false;storage.setItem('mkty_global_lives',lives()-1);return true;}};
 get('app');vm.createContext(context);
 for(const file of ['pacing.js','operations.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
 const fail=window.MKTYPace.fail;window.MKTYPace.fail=(...args)=>{calls.push(args);return fail(...args);};
 function task(chapter,step,options={}){
  const edition=options.edition||2,plan=P.plan(chapter,edition),base=plan.steps.find(t=>t.id===step);
  assert.equal(base.kind,'board');const task={...base,chapter,art:plan.art,seed:2317,...options};
  task.save=s=>{checkpoint=clone(s);saved.set(chapter+':'+step,checkpoint);};task.complete=s=>{completed.push(clone(s));show('storyPlan');};task.exit=()=>show('storyPlan');return task;
 }
 return {data,storage,get,window,task,calls,spent,completed,saved,lives,show,active:()=>active,checkpoint:()=>clone(checkpoint),open:(t,s=null)=>window.MKTYOps.openTask(t,s),submit:()=>get('opsSubmit').click(),exit:()=>{get('opsMenu').click();get('opsExit').click();}};
}
let assignments=0;
for(const edition of [1,2])for(let chapter=1;chapter<=9;chapter++)for(const step of P.plan(chapter,edition).steps.filter(t=>t.kind==='board'))for(const done1 of [false,true]){
 const h=harness();if(done1)h.storage.setItem('mkty_life1','complete');
 const t=h.task(chapter,step.id,{edition});h.open(t);const initial=h.checkpoint(),board=R.board(t.board,t.round,t.seed),cost=!t.simulation&&!(chapter===1&&!done1);
 assert.equal(initial.n,t.board,'checkpoint retains the board type');assert.equal(h.storage.getItem('mkty_current_chapter'),String(chapter));
 assert.equal(R.solved(board,initial.input),false);h.submit();
 if(board.type==='cipher'){
  assert.equal(h.calls.length,0,'incomplete cipher entry retains its existing non-charge behavior');assert.equal(h.lives(),9);continue;
 }
 assert.equal(h.lives(),9-Number(cost),JSON.stringify({edition,chapter,board:t.board,done1,simulation:t.simulation}));
 assert.deepEqual(h.calls[0],[chapter,t.simulation?'training':'board',`c${chapter}:board:r${t.round}:${t.seed}:0`]);
 assert.deepEqual(h.checkpoint().input,initial.input,'failure never changes the board');assert.equal(h.checkpoint().n,t.board);assert.equal(h.checkpoint().errors,1);
 h.submit();assert.equal(h.lives(),9-2*Number(cost));assert.equal(h.checkpoint().errors,2);
 const beforePause=h.checkpoint();h.get('opsMenu').click();h.submit();assert.deepEqual(h.checkpoint(),beforePause,'paused confirm has no effect');assert.equal(h.calls.length,2);h.get('opsExit').click();
 const checkpoint=h.checkpoint();h.submit();assert.equal(h.calls.length,2,'hidden confirm has no effect');h.open(t,checkpoint);h.submit();
 assert.equal(h.lives(),9-3*Number(cost),'reentry keeps the owning chapter and simulation policy');assert.equal(h.checkpoint().errors,3);assert.equal(h.spent.length,3*Number(cost));
 if(cost){const before=h.lives();h.window.MKTYPace.fail(...h.calls[0]);assert.equal(h.lives(),before,'the same failure key remains idempotent');}
 assignments++;
}
// A reload restores the real board checkpoint; ownership always comes from the current task.
for(const chapter of [1,2,4,9]){
 let h=harness(),t=h.task(chapter,1);h.open(t);h.submit();h.exit();const saved=h.checkpoint(),data=h.data;
 h=harness(data);t=h.task(chapter,1);h.open(t,saved);h.submit();assert.equal(h.checkpoint().errors,2);
 assert.equal(h.lives(),chapter===1||chapter===2?9:7);assert.equal(h.calls[0][0],chapter);
}
// Moving from tutorial/training into an ordinary standalone board must not leak exemptions.
for(const trainingChapter of [1,2,3])for(const board of [4,5,6,7,9]){
 const h=harness(),t=h.task(trainingChapter,1);h.open(t);h.submit();assert.equal(h.lives(),9);
 h.storage.setItem('mkty_life'+(board-1),'complete');h.window.MKTYOps.open(board);h.submit();
 const cp=JSON.parse(h.storage.getItem('mkty_operations_'+board+'_v1'));
 assert.equal(h.calls.at(-1)[0],board);assert.equal(h.calls.at(-1)[1],'board');assert.equal(h.lives(),8);assert.equal(cp.n,board);assert.equal(cp.errors,1);
 h.exit();h.window.MKTYOps.open(board);h.submit();assert.equal(h.lives(),7,'standalone reentry still costs one life per new failure');
 const charged=h.task(9,4);h.open(charged);h.submit();assert.equal(h.calls.at(-1)[0],9);assert.equal(h.lives(),6,'charged assignment after standalone is still charged');
 const training=h.task(2,1);h.open(training);h.submit();assert.equal(h.calls.at(-1)[1],'training');assert.equal(h.lives(),6,'explicit training remains free after charged work');
}
// An explicit simulation flag, rather than chapter number, determines the training exemption.
for(const chapter of [1,2,3,4,9])for(const simulation of [false,true]){
 const h=harness();h.storage.setItem('mkty_life1','complete');const t=h.task(chapter,1,{simulation});h.open(t);h.submit();
 assert.equal(h.lives(),simulation?9:8);assert.equal(h.calls[0][1],simulation?'training':'board');
}
// Solving and completing every board keeps the normal state, callback and no-charge behavior.
for(const board of [4,5,6,7,8,9]){
 const h=harness(),t=h.task(9,1,{board}),b=R.board(board,t.round,t.seed);h.open(t);const cp=h.checkpoint(),p=cp.input;
 if(board===4)p.path=b.path.slice();if(board===5)b.path.forEach(i=>p.turns[i]=0);if(board===6)p.tiles=b.target.slice();
 if(board===7)for(const i of R.solveShield(b,p)){R.toggle(p.lamps,i,b.n);p.history.push(i);}
 if(board===8)p.guess=b.secret.slice();if(board===9)p.order=R.solveSystems(b,p);
 assert(R.validate(b,p));h.open(t,cp);h.submit();assert.equal(h.checkpoint().confirmed,true);assert.equal(h.lives(),9);assert.equal(h.calls.length,0);
 h.submit();assert.equal(h.completed.length,1);assert.equal(h.completed[0].n,board);assert.equal(h.active(),'storyPlan');h.submit();assert.equal(h.completed.length,1,'hidden completion cannot repeat');
}
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');assert.match(html,/operations\.js\?v=20261011-tutorial-lives-1/,'release cache pin changes with the operation controller');
console.log(`PASS: ${assignments} non-cipher assignment cases across both editions; tutorial, simulation, charged replay, reload/reentry, standalone isolation, idempotency and all six successful boards`);
