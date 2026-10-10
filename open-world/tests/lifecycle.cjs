/* Non-browser regression probes for the isolated preview shell.
 * Reads repository sources without altering them. Renderer collision geometry is real;
 * WebGL and DOM calls are stubbed, so this is not visual/browser/device acceptance.
 * Usage: node open-world/tests/lifecycle.cjs /path/to/repository
 */
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const repo=path.resolve(process.argv[2]||process.cwd()),testDir=path.join(repo,'open-world/tests');
const {r,state,sandbox}=new Function('require','__dirname',fs.readFileSync(path.join(testDir,'static.cjs'),'utf8')+'\nreturn {r,state,sandbox};')(require,testDir);
function harness(assetReady=true,intl=Intl){
 const els={};
 function el(id){return els[id]??={id,style:{},dataset:{},classList:{add(){},remove(){}},hidden:false,value:'auto',handlers:{},append(){},setAttribute(){},focus(){},setPointerCapture(){},addEventListener(n,f){this.handlers[n]=f},getBoundingClientRect(){return {left:0,top:0,width:126,height:126}},querySelector(){return el(id+'-p')}};}
 let raf,now=0,nextTimer=0;const events={},timers=new Map();
 const c={console,Math,Map,Set,URL,Intl:intl,performance:{now:()=>now},location:{href:'http://local/?lang=en',reload(){c.reloaded=true;}},clearTimeout:id=>timers.delete(id),setTimeout:(f,ms)=>{const id=++nextTimer;timers.set(id,{f,ms});return id;},requestAnimationFrame:f=>raf=f,addEventListener:(n,f)=>events[n]=f,document:{documentElement:{},body:{dataset:{}},hidden:false,getElementById:el,querySelectorAll:()=>[],createElement:()=>el('option'),addEventListener:(n,f)=>events[n]=f},OpenWorldI18n:{lang:'en',langs:['en'],t:k=>k},MoonCore:sandbox.MoonCore,MoonRenderer:class{constructor(){this.envReady=assetReady;this.characterSprite={ready:assetReady,idleReady:assetReady,directionTextures:{a:{ready:assetReady}}};this.quality='high';this.eye=[0,0,0]}safeSpawn(x,z){return r.safeSpawn(x,z,state);}render(){}blocked(x,z,s,a){return r.blocked(x,z,s,a)}}};
 c.globalThis=c;vm.createContext(c);
 const source=fs.readFileSync(path.join(repo,'open-world/preview.js'),'utf8').replace("Object.defineProperty(root,'OpenWorldPreview'", "root.harness={player,input,keys,advance,jump,renderer}; Object.defineProperty(root,'OpenWorldPreview'");
 vm.runInContext(source,c,{filename:'preview.js'});
 const frame=()=>raf(now+=16);frame();return {c,el,events,timers,frame};
}
const results=[];
{
 const {c,el,frame}=harness();assert(c.OpenWorldPreview.snapshot().ready);
 el('joystick').onpointerdown({pointerId:7,clientX:90,clientY:63,preventDefault(){}});
 c.OpenWorldPreview.pause(true);c.OpenWorldPreview.pause(false);
 const before=c.OpenWorldPreview.snapshot().player;
 el('joystick').onpointermove({pointerId:7,clientX:95,clientY:63});frame();
 const after=c.OpenWorldPreview.snapshot().player;
 assert.equal(after.x,before.x);assert.equal(after.z,before.z);
 el('view').onpointerdown({pointerId:8,clientX:100,clientY:100});
 c.OpenWorldPreview.pause(true);c.OpenWorldPreview.pause(false);
 const yaw=c.OpenWorldPreview.snapshot().camera.yaw;
 el('view').onpointermove({pointerId:8,clientX:400,clientY:100});
 assert.equal(c.OpenWorldPreview.snapshot().camera.yaw,yaw);
 results.push('Pause/resume rejects stale joystick and camera pointers');
}
{
 const {c,el,frame}=harness();
 el('joystick').onpointerdown({pointerId:1,clientX:108,clientY:63,preventDefault(){}});
 el('run').onpointerdown({pointerId:2,preventDefault(){}});frame();
 const speed=c.OpenWorldPreview.snapshot().player.speed;
 assert(speed>5.5);results.push({check:'Full-stick touch sprint exceeds browser assertion',speed});
}
{
 const {c}=harness(),h=c.harness;
 const rock=r.rocks.find(o=>o.h*.81<.7&&!r.blocked(o.x,o.z,state,1.5)&&!r.blocked(o.x-o.s*.98-.3,o.z,state));assert(rock);
 Object.assign(h.player,{x:rock.x-rock.s*.98-.3,z:rock.z,alt:0});h.input.x=h.input.z=0;h.jump();
 for(let i=0;i<23;i++)h.advance(.02);
 h.input.x=1;for(let i=0;i<80&&h.player.x<rock.x&&h.player.alt>0;i++)h.advance(.02);
 assert(h.player.alt>0,'Reached actual low rock while airborne');
 const insideBeforeLanding=r.blocked(h.player.x,h.player.z,state,0);assert(insideBeforeLanding);
 h.input.x=0;for(let i=0;i<100;i++)h.advance(.02);
 const landed={...h.player};assert.equal(landed.alt,0);assert(!r.blocked(landed.x,landed.z,state,0),'Landing recovers to collision-free ground');
 h.input.x=-1;for(let i=0;i<60;i++)h.advance(.02);
 assert(Math.hypot(h.player.x-landed.x,h.player.z-landed.z)>.5,'Walking works after landing recovery');
 results.push({check:'Jump onto actual authored rock recovers without becoming stuck',rock:{x:rock.x,z:rock.z},landed,afterWalking:{...h.player}});
}
{
 const {c,el,timers,frame}=harness(false);
 const timer=[...timers.values()].find(x=>x.ms===45000);assert(timer);timer.f();
 assert.equal(c.document.body.dataset.error,'loadError');assert.equal(el('retry').hidden,false);assert.equal(el('loading').hidden,false);
 const frames=c.OpenWorldPreview.snapshot().stats.frames;frame();assert.equal(c.OpenWorldPreview.snapshot().stats.frames,frames);
 el('retry').onclick();assert(c.reloaded);results.push('Failed readiness becomes a retry screen and stops rendering');
}
{
 const {c,el,frame}=harness();let prevented=false;
 el('view').handlers.webglcontextlost({preventDefault(){prevented=true;}});
 assert(prevented);assert.equal(c.document.body.dataset.error,'contextLost');assert.equal(el('retry').hidden,false);
 const frames=c.OpenWorldPreview.snapshot().stats.frames;c.OpenWorldPreview.pause(false);frame();
 assert(c.OpenWorldPreview.snapshot().paused);assert.equal(c.OpenWorldPreview.snapshot().stats.frames,frames);
 el('retry').onclick();assert(c.reloaded);results.push('Context loss requires reload and cannot Continue on invalid GPU resources');
}
{
 const {c,el,frame}=harness();const errors=[];c.console={...console,error:e=>errors.push(e.message)};
 c.harness.renderer.render=()=>{throw Error('injected render failure');};frame();
 assert.equal(c.document.body.dataset.error,'webgl');assert.equal(el('retry').hidden,false);assert.equal(errors.length,1);
 const frames=c.OpenWorldPreview.snapshot().stats.frames;frame();assert.equal(c.OpenWorldPreview.snapshot().stats.frames,frames);assert.equal(errors.length,1);
 results.push('Render exception reaches one fatal retry screen without repeated exceptions');
}
{
 const {c,el}=harness(true,{});assert(c.OpenWorldPreview.snapshot().ready);assert.equal(el('option').textContent,'EN');
 results.push('Missing Intl.DisplayNames falls back without blocking startup');
}
console.log(JSON.stringify({status:'passed',scope:'Non-browser VM with actual authored collision geometry; no GPU, screenshot, physical-device or CI execution claims',checks:results},null,2));
