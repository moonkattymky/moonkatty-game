const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('fs');
const path=require('node:path'),http=require('node:http'),root=path.resolve(__dirname,'..'),out=process.env.MKTY_TEST_OUTPUT||'/tmp/mkty-first-three';fs.mkdirSync(out,{recursive:true});const server=http.createServer((req,res)=>{const name=new URL(req.url,'http://local').pathname,f=path.join(root,name==='/'?'index.html':name);fs.readFile(f,(e,b)=>{res.writeHead(e?404:200,{'Content-Type':({'.html':'text/html','.css':'text/css','.js':'application/javascript'})[path.extname(f)]||'application/octet-stream'});res.end(e?'':b);});});let browser;
const report={url:'http://127.0.0.1:8200/',chapters:{},errors:[],bad:[],findings:[]};
(async()=>{await new Promise(r=>server.listen(0,r));report.url='http://localhost:'+server.address().port;browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,ignoreHTTPSErrors:true});page.setDefaultTimeout(6000);page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.url().includes('moonkattymky.github.io')&&r.status()>=400)report.bad.push([r.url(),r.status()]);});await page.route('https://telegram.org/**',r=>r.fulfill({body:''}));await page.clock.install({time:new Date('2026-10-04T08:00Z')});await page.clock.pauseAt(new Date('2026-10-04T08:00Z'));await page.addInitScript(require('./story-finale-fixture.cjs'));await page.goto(report.url,{waitUntil:'domcontentloaded',timeout:25000});await page.waitForFunction(()=>typeof openMission==='function');await page.evaluate(()=>setLang('ru'));
const run=ms=>page.clock.runFor(ms);const click=s=>page.locator(s).click();const val=async id=>Number.parseFloat(await page.locator('#'+id).innerText());
async function slider(id,value){await page.locator('#'+id).evaluate((e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);}
async function snap(name){await page.screenshot({path:out+'/'+name+'.png'});}
async function readyArt(n){const r=await page.locator('#mission'+n).evaluate(async root=>{const urls=new Set();for(const el of [root,...root.querySelectorAll('*')])for(const pseudo of [null,'::before','::after']){const b=getComputedStyle(el,pseudo).backgroundImage;for(const m of b.matchAll(/url\(["']?(.*?)["']?\)/g))urls.add(m[1]);}return await Promise.all([...urls].map(async url=>{const i=new Image();i.src=url;try{await i.decode();return {url,ok:true};}catch{return {url,ok:false};}}));});report['art'+n]=r;}
let held=null;async function hold(id){if(id===held)return;if(held)await page.mouse.up();held=null;if(id){const b=await page.locator('#'+id).boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();held=id;}}
async function visibility(hidden){await page.evaluate(h=>{if(h)Object.defineProperty(document,'hidden',{configurable:true,value:true});else delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));},hidden);if(!hidden&&await page.locator('#chapterGuide').isVisible())await page.locator('#guideResume').click();}
function checkpoint(){fs.writeFileSync(out+'/journey.json',JSON.stringify(report,null,2));}
async function completed(n){assert.equal(await page.evaluate(n=>localStorage.getItem('mkty_life'+n),n),'complete');report.chapters[n].passed=true;report.chapters[n].points=await page.evaluate(()=>Number(localStorage.getItem('mkty_points')));await snap('live-complete-'+n);checkpoint();console.log('Completed',n);}
async function next(n){await click('#continueLife'+n+'Btn');assert(await page.locator('#life'+n).evaluate(el=>el.classList.contains('active')));await click('#life'+n+'SkipBtn');await run(350);}
async function solvePipes(){
 const moves=await page.locator('#circuit2 button').evaluateAll(buttons=>{
  const ports=buttons.map(b=>b.dataset.ports.split(',').map(Number)),dirs=[[-1,0],[0,1],[1,0],[0,-1]];
  function route(i,entry,seen,moves){
   for(let rot=0;rot<4;rot++){const p=ports[i].map(d=>(d+rot)%4);if(!p.includes(entry))continue;const exit=p.find(d=>d!==entry),next=[...moves,[i,rot]];
    if(i===5&&exit===1)return next;const [dr,dc]=dirs[exit],r=Math.floor(i/3)+dr,c=i%3+dc,j=r*3+c;
    if(r<0||r>2||c<0||c>2||seen.has(j))continue;const result=route(j,(exit+2)%4,new Set([...seen,j]),next);if(result)return result;
   }return null;
  }return route(3,3,new Set([3]),[]);
 });assert(moves,'Visible pipe layout has no solution');
 for(const [i,turns] of moves)for(let turn=0;turn<turns;turn++)await click('[data-wire2="'+i+'"]');
 assert(await page.locator('#circuit2').evaluate(e=>e.classList.contains('connected')));
}
// 1 — real controls, real on-screen sequence; no internal mission state is assigned.
report.chapters[1]={};await click('#enterBtn');await click('#skipBtn');await readyArt(1);await run(350);await snap('live-ready-1');
const start=await page.locator('#life1Player').evaluate(e=>({x:parseFloat(e.style.left),y:parseFloat(e.style.top)}));
const joy=await page.locator('#life1Joystick').boundingBox();await page.mouse.move(joy.x+joy.width*.5,joy.y+joy.height*.5);await page.mouse.down();await page.mouse.move(joy.x+joy.width*.8,joy.y+joy.height*.5);await run(500);await page.mouse.up();const moved=await page.locator('#life1Player').evaluate(e=>parseFloat(e.style.left));assert(moved>start.x);await run(300);assert.equal(await page.locator('#life1Player').evaluate(e=>parseFloat(e.style.left)),moved);report.chapters[1].joystickDirectionAndRelease=true;
await click('.l1-hotspot.energy.e1');assert.equal(await page.locator('#energyCount').innerText(),'0/3');
async function approach(selector){
 for(let attempts=0;attempts<100;attempts++){
  const step=await page.evaluate(selector=>{
   const target=document.querySelector(selector);if(l1DistanceTo(target)<.225)return null;
   const w=$('life1World').getBoundingClientRect(),t=target.getBoundingClientRect(),p=$('life1Player').getBoundingClientRect();
   const gx=(t.left+t.right)/2-w.left,gy=(t.top+t.bottom)/2-w.top,offset=p.height*.35;
   const q=[[l1PX,l1PY,[]]],visited=new Set();
   while(q.length){const [x,y,path]=q.shift();if(Math.hypot(x*w.width/100-gx,y*w.height/100-offset-gy)<Math.min(w.width,w.height)*.205)return {target:path[0],position:[l1PX,l1PY],size:[w.width,w.height]};
    for(const [dx,dy] of [[-4,0],[4,0],[0,-4],[0,4]]){const nx=x+dx,ny=y+dy,k=Math.round(nx)+','+Math.round(ny);if(nx<7||nx>90||ny<18||ny>88||visited.has(k)||life1Blocked(nx,ny)||life1Blocked(x+dx/2,y+dy/2))continue;visited.add(k);q.push([nx,ny,[...path,[nx,ny]]]);}
   }throw new Error('No walkable path');
  },selector);if(!step)return;
  const dx=(step.target[0]-step.position[0])*step.size[0]/100,dy=(step.target[1]-step.position[1])*step.size[1]/100,len=Math.hypot(dx,dy),j=await page.locator('#life1Joystick').boundingBox();
  await page.mouse.move(j.x+j.width/2,j.y+j.height/2);await page.mouse.down();await page.mouse.move(j.x+j.width/2+dx/len*j.width*.31,j.y+j.height/2+dy/len*j.width*.31);await run(Math.ceil(len/88*1000));await page.mouse.up();
 }throw new Error('Joystick path did not reach target');
}
for(const i of [1,2,3]){await approach('.energy.e'+i);await click('.energy.e'+i);assert.equal(await page.locator('#energyCount').innerText(),i+'/3');if(i===1){await page.reload();await click('#enterBtn');assert.equal(await page.locator('#energyCount').innerText(),'1/3');}}
report.chapters[1].proximityAndResume=true;
await approach('#repairTerminal');await click('#repairTerminal');await click('#showRepairSequenceBtn');await run(2100);const repair=(await page.locator('#repairSequence').innerText()).split(/\s+/);await run(600);await click('[data-cell="'+((repair[0].charCodeAt(0)-65+1)%3)+'"]');assert.equal(await page.locator('#repairFill').evaluate(e=>e.style.width),'0%');for(const c of repair)await click('[data-cell="'+(c.charCodeAt(0)-65)+'"]');
await approach('#antennaHotspot');await click('#antennaHotspot');for(let x=40;x<=90;x+=2){await slider('frequencyDial',x);if(await page.locator('#signalMeterFill').evaluate(e=>parseFloat(e.style.width))>=92)break;}await click('#tuneBtn');await run(3400);await completed(1);report.chapters[1].tenDigitCodeVisible=await page.evaluate(()=>!!$('life1MemoryCode')&&!$('life1MemoryCode').hidden);if(!report.chapters[1].tenDigitCodeVisible)report.findings.push('L1: the ten-digit memory-code element is absent at completion');
const memoryCode=await page.locator('#life1CodeValue').innerText();assert.match(memoryCode,/^\d{10}$/);await run(10100);assert(await page.locator('#life1MemoryCode').isHidden());
// 2 — three specialists and final role sequence.
await next(2);report.chapters[2]={};await readyArt(2);await snap('live-ready-2');await click('[data-mate="Navigator"]');await readyArt(2);
const xBefore=await page.locator('#navShip2').evaluate(e=>e.style.left);await visibility(true);await run(900);await visibility(false);const xAfter=await page.locator('#navShip2').evaluate(e=>e.style.left);report.chapters[2].pausedWhenHidden=xBefore===xAfter;assert.equal(xBefore,xAfter);
for(let step=0;step<160;step++){
 if(await page.locator('[data-mate="Navigator"]').evaluate(e=>e.classList.contains('joined')))break;
 const d=await page.evaluate(()=>{const gates=[...document.querySelectorAll('#navField2 .gate:not(.cleared)')],g=gates[0]?.getBoundingClientRect(),s=$('navShip2').getBoundingClientRect();return g?(g.top+g.bottom-s.top-s.bottom)/2:0;});
 const wanted=Math.abs(d)<10?null:d<0?'[data-nav2="-1"]':'[data-nav2="1"]';
 if(wanted){const id=await page.locator(wanted).evaluate(e=>{if(!e.id)e.id='auditNav'+e.dataset.nav2;return e.id;});await hold(id);}else await hold(null);
 await run(180);
}
await hold(null);assert(await page.locator('[data-mate="Navigator"]').evaluate(e=>e.classList.contains('joined')));await click('[data-mate="Engineer"]');await click('#testCircuit2');report.chapters[2].wrongCircuitRejected=!(await page.locator('[data-mate="Engineer"]').evaluate(e=>e.classList.contains('joined')));await solvePipes();await click('#testCircuit2');await run(550);await click('[data-mate="Scout"]');for(let i=0;i<3;i++)await click('#anomalyGrid .target');
await click('#showCrewSync2');const seq=(await page.locator('#crewSyncCode2').innerText()).trim().split(/\s+/);await run(2500);for(const s of seq)await click('[data-sync2="'+s+'"]');await completed(2);
// 3 — journal, one-hour lock, four symbols, mixture and ignition sequence.
await next(3);report.chapters[3]={};await readyArt(3);await snap('live-ready-3');await page.locator('#life3MemoryInput').fill(memoryCode);await click('#verifyLife1CodeBtn');await click('#showCodeBtn');const symbols=await page.locator('#codeSequence>span').allTextContents();await run(2300);for(const s of symbols)await click('[data-code="'+s+'"]');assert.equal(await page.locator('#mission3').getAttribute('data-phase'),'fuel');await snap('live-fuel-3');assert(await page.locator('#lockMix3').isDisabled());assert.equal(await page.locator('#mission3').getAttribute('data-phase'),'fuel');await slider('mixO2',30);await slider('mixFuel',45);await slider('mixCool',25);await page.reload();await click('#enterBtn');assert.equal(await page.locator('#mission3').getAttribute('data-phase'),'fuel');assert.equal(await page.locator('#mixFuel').inputValue(),'45');await click('#lockMix3');report.chapters[3].mixtureRequiresAdjustment=true;await click('#showIgnition3');const ignition=await page.locator('#ignitionOrder3>span').allTextContents();await run(1900);for(const s of ignition)await click('[data-ignite3="'+s+'"]');await completed(3);
assert.deepEqual(report.errors,[]);console.log('PASS first three finales',JSON.stringify(report.chapters));
})().catch(e=>{report.failure={message:e.message,stack:e.stack};fs.writeFileSync(out+'/journey.json',JSON.stringify(report,null,2));console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
