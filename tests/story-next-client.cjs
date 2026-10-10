/* Production chapter UI, deterministic DOM/route harness; browser geometry is covered separately. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),P=require('../story-plan.js');
function harness({trusted=false,lang='en',risk=false}={}){
 const elements=new Map(),data=new Map([['mkty_lang',lang]]),launches=[],requests=[],risks=[];let active='home',verified=false,dialog=false;
 class Element{
  constructor(id=''){this.id=id;this.dataset={};this.attributes={};this.children=[];this.classes=new Set();this.style={setProperty(){}};this.classList={contains:x=>this.classes.has(x),add:x=>this.classes.add(x),remove:x=>this.classes.delete(x),toggle(){}};}
  set innerHTML(value){this.html=value;for(const m of value.matchAll(/id="([^"]+)"/g))get(m[1]);this.mapNodes=[...value.matchAll(/data-map-step="(\d+)"/g)].map(m=>{const e=new Element();e.dataset.mapStep=m[1];return e;});}
  get innerHTML(){return this.html||'';}setAttribute(k,v){this.attributes[k]=String(v);}getAttribute(k){return this.attributes[k];}compareDocumentPosition(){return 0;}before(){}append(...nodes){this.children.push(...nodes);for(const n of nodes)if(n.id)elements.set(n.id,n);}replaceChildren(...nodes){this.children=nodes;}querySelectorAll(){return this.mapNodes||[];}click(){if(!this.disabled)this.onclick?.();}dispatchEvent(e){if(e.type==='click')this.onclick?.();}remove(){}
 }
 const get=id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id);};
 const document={getElementById:get,createElement:()=>new Element(),documentElement:get('html'),querySelector:s=>s==='.screen.active'?get(active):s==='dialog[open]'&&dialog?get('dialog'):null};
 const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};
 const window={MKTYStorage:{persistent:true},MKTYCampaign:{render(){}},MKTYRewards:{requiresRoute:()=>trusted,routeReady:()=>verified,accountScope:()=>101,prepareRoute:()=>new Promise((resolve,reject)=>requests.push({resolve:r=>{verified=true;resolve(r);},reject}))}};
 const show=id=>{window.MKTYStory?.onScreen(id);get(active).classes.delete('active');active=id;get(id).classes.add('active');};get(active).classes.add('active');
 const launch=(task,saved)=>{launches.push({task,saved});show(task.kind==='board'?'operationsDeck':task.kind==='field'?'fieldMission':'expeditionFlight');};
 window.MKTYPace={gate:()=>true,bypass:()=>!risk,risky:(_n,go)=>{if(!risk)return go();dialog=true;risks.push(()=>{dialog=false;go();});}};
 const context={window,document,localStorage:storage,StoryPlan:P,FieldArt:{map:(_n,steps)=>steps.map(t=>`<g data-map-step="${t.id}"></g>`).join('')},MKTYPace:window.MKTYPace,show,console,crypto:require('node:crypto').webcrypto,Node:{DOCUMENT_POSITION_FOLLOWING:4},MouseEvent:class{constructor(type){this.type=type;}},MutationObserver:class{observe(){}},setInterval(){},queueMicrotask(){},URL,Blob,setTimeout,remainingLife1CodeTime:()=>0,MKTYOps:{openTask:launch},MKTYField:{open:launch},MKTYExpedition:{openStory:launch}};
 for(const [i,name]of ['openMission','openMission2','openLife3MemoryGate','openMission4','openMission5','openMission6','openMission7','openMission8','openMission9'].entries())window[name]=()=>show('mission'+(i+1));
 vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../story.js'),'utf8'),context);
 const seed=s=>storage.setItem('mkty_story_plan_'+s.n+'_v1',JSON.stringify(s));
 return {get,seed,storage,launches,requests,risks,window,show,active:()=>active,nodes:()=>get('storySpatialMap').mapNodes,press:(node,key,repeat=false)=>node.onkeydown({key,repeat,preventDefault(){}})};
}
(async()=>{
 for(const lang of ['en','ru']){
  const h=harness({lang});await h.window.MKTYStory.open(1);assert.equal(h.get('storyNext').disabled,false);assert.match(h.get('storyNext').textContent,lang==='ru'?/НАЧАТЬ/:/START/);assert.match(h.get('storyNextLabel').textContent,/01 \/ 08/);
  assert.equal(h.get('storySteps').children.filter(x=>!x.disabled).length,2);assert.equal(h.nodes().filter(x=>x.getAttribute('tabindex')==='0').length,2);
  for(const node of h.nodes()){assert.match(node.getAttribute('aria-label'),lang==='ru'?/^Этап /:/^Stage /);assert(node.getAttribute('aria-label').length>20);}
  h.get('storyNext').click();h.get('storyNext').click();assert.equal(h.launches.length,1,'repeat taps cannot reopen the task after navigation');assert.equal(h.launches[0].task.id,0);
  h.launches[0].task.exit();h.get('storyBack').click();h.get('storyNext').click();assert.equal(h.active(),'chapters');assert.equal(h.launches.length,1,'hidden plan cannot navigate after Back');
  // Prefer an available save, while keeping its fresh parallel alternative reachable.
  const saved=P.fresh(1,17,2);saved.tasks[1]={checkpoint:{seconds:23,marker:'saved-board'}};saved.tasks[2]={checkpoint:{seconds:999,marker:'locked-flight'}};h.seed(saved);h.window.MKTYStory.menu(1);
  assert.match(h.get('storyNextLabel').textContent,/02 \/ 08/);assert.match(h.get('storyNext').textContent,lang==='ru'?/ПРОДОЛЖИТЬ/:/RESUME/);h.get('storyNext').click();assert.equal(h.launches.at(-1).task.id,1);assert.equal(h.launches.at(-1).saved.marker,'saved-board');
  h.launches.at(-1).task.exit();h.press(h.nodes()[0],' ',true);assert.equal(h.launches.length,2,'held keyboard key does not repeat launches');h.press(h.nodes()[0],' ');assert.equal(h.launches.at(-1).task.id,0,'parallel choice remains keyboard accessible');h.launches.at(-1).task.exit();
  saved.done=[0,1];h.seed(saved);h.window.MKTYStory.menu(1);assert.match(h.get('storyNextLabel').textContent,/03 \/ 08/);h.get('storyNext').click();assert.equal(h.launches.at(-1).task.id,2,'completed prerequisites unlock the existing next task');h.launches.at(-1).task.exit();
  saved.done=[0,1,2,3,4,5,6,7];h.seed(saved);h.window.MKTYStory.menu(1);assert.equal(h.get('storyNext').textContent,h.get('storyCore').textContent);assert.equal(h.get('storyNext').disabled,false);assert(h.nodes().every(x=>x.getAttribute('aria-disabled')==='true'));h.get('storyNext').click();assert.equal(h.active(),'mission1');assert.equal(h.window.MKTYStory.read(1).phase,'core');
  saved.phase='complete';h.seed(saved);h.window.MKTYStory.menu(1);assert.match(h.get('storyNext').textContent,lang==='ru'?/ОТКРЫТЬ/:/OPEN/);h.get('storyNext').click();assert.equal(h.active(),'mission1');assert.equal(h.window.MKTYStory.read(1).phase,'complete','review does not restart a completed chapter');
 }
 let h=harness({trusted:true});const pending=h.window.MKTYStory.open(1);h.window.MKTYStory.open(1);assert.equal(h.requests.length,1);assert.equal(h.get('storyNext').disabled,true);assert.equal(h.get('storySpatialMap').getAttribute('aria-busy'),'true');
 for(const node of h.nodes()){assert.equal(node.getAttribute('aria-disabled'),'true');assert.equal(node.getAttribute('tabindex'),'-1');node.click();h.press(node,'Enter');}h.get('storyNext').click();assert.equal(h.launches.length,0);
 h.requests[0].resolve({seed:93});await pending;assert.equal(h.get('storyNext').disabled,false);assert.equal(h.get('storySpatialMap').getAttribute('aria-busy'),'false');h.get('storyNext').click();assert.equal(h.launches.length,1);
 h=harness({trusted:true});const failed=h.window.MKTYStory.open(1);h.requests[0].reject(new Error('unavailable'));await failed;assert(h.get('storyNext').disabled);assert.match(h.get('storyNextHint').textContent,/connection/);assert(h.nodes().every(x=>x.getAttribute('tabindex')==='-1'));
 h=harness({trusted:true});const abandoned=h.window.MKTYStory.open(1);h.get('storyBack').click();h.requests[0].resolve({seed:94});await abandoned;assert.equal(h.active(),'chapters');assert.equal(h.window.MKTYStory.read(1),null,'late registration cannot return from Back');
 h=harness({risk:true});await h.window.MKTYStory.open(1);h.get('storyNext').click();h.get('storyNext').click();h.nodes()[1].click();assert.equal(h.risks.length,1,'an open risk dialog cannot be duplicated by repeated plan actions');h.show('chapters');h.risks[0]();assert.equal(h.launches.length,0,'late risk confirmation cannot override navigation');
 console.log('PASS: RU/EN next objective, saved priority, parallel keyboard choices, prerequisites/finale/review, repeat taps, Back, blocked route accessibility and late registration/confirmation guards');
})().catch(e=>{console.error(e);process.exitCode=1;});
