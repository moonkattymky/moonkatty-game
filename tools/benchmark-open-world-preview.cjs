/* Reproducible browser measurements, not a physical-phone performance claim.
   CHROMIUM_PATH=... node tools/benchmark-open-world-preview.cjs /absolute/report.json */
const {chromium}=require('playwright');
const fs=require('fs'),http=require('http'),path=require('path');
const root=path.resolve(__dirname,'..');
const output=path.resolve(process.argv[2]||'/tmp/moonkatty-open-world-performance.json');
let browser,server;
function distribution(values){
  const sorted=values.slice().sort((a,b)=>a-b);
  const percentile=p=>sorted[Math.max(0,Math.ceil(sorted.length*p)-1)]??null;
  return {count:values.length,median:percentile(.5),p95:percentile(.95),max:percentile(1)};
}
(async()=>{
  server=http.createServer((request,response)=>{
    let file=path.join(root,new URL(request.url,'http://localhost').pathname);
    if(file.endsWith('/'))file+='index.html';
    if(!file.startsWith(root+path.sep)){response.writeHead(403);response.end();return;}
    fs.readFile(file,(error,body)=>{
      response.writeHead(error?404:200,{'Content-Type':({'.html':'text/html','.js':'application/javascript','.css':'text/css','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
      response.end(error?'':body);
    });
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,deviceScaleFactor:2});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('https://telegram.org/**',route=>route.fulfill({body:''}));
  const cdp=await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
  await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:500000,uploadThroughput:500000});
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  const start=Date.now();
  await page.goto('http://127.0.0.1:'+server.address().port+'/graphics-preview/');
  await page.waitForFunction(()=>window.MKTYOpenWorld?.snapshot().ready,null,{timeout:90000});
  const coldReadyMs=Date.now()-start;
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
  await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
  await page.waitForTimeout(1800);
  await page.evaluate(()=>{
    window.__benchmarkFrames=[];window.__benchmarkRunning=true;
    let previous=performance.now();
    function sample(now){
      if(!__benchmarkRunning)return;
      __benchmarkFrames.push(now-previous);previous=now;requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  });
  const joystick=await page.locator('#joystick').boundingBox();
  const x=joystick.x+joystick.width/2,y=joystick.y+joystick.height/2,inputMs=[];
  for(let trial=0;trial<6;trial++){
    await page.evaluate(()=>{window.__benchmarkInput={time:performance.now(),position:MKTYOpenWorld.snapshot().position};});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:x+(trial%2?40:-40),y,radiusX:7,radiusY:7,force:1}]});
    await page.waitForFunction(()=>{
      const point=MKTYOpenWorld.snapshot().position,mark=__benchmarkInput;
      if(Math.hypot(point.x-mark.position.x,point.z-mark.position.z)<.025)return false;
      if(mark.elapsed===undefined)mark.elapsed=performance.now()-mark.time;
      return true;
    },null,{timeout:30000});
    inputMs.push(await page.evaluate(()=>__benchmarkInput.elapsed));
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(1000);
  const measured=await page.evaluate(()=>{
    __benchmarkRunning=false;
    const context=document.getElementById('scene').getContext('webgl2'),extension=context.getExtension('WEBGL_debug_renderer_info');
    return {snapshot:MKTYOpenWorld.snapshot(),frameMs:__benchmarkFrames,renderer:extension?context.getParameter(extension.UNMASKED_RENDERER_WEBGL):context.getParameter(context.RENDERER)};
  });
  const report={
    environment:{browser:browser.version(),renderer:measured.renderer,viewport:{width:390,height:844},deviceScaleFactor:2,physicalPhone:false,telegramClient:false,concurrentWebGLWorkloads:0},
    coldLoad:{readyMs:coldReadyMs,cache:false,downloadBytesPerSecond:500000,latencyMs:150,cpuSlowdown:4},
    interactive:{cpuSlowdown:1,inputMs,firstMovementMs:distribution(inputMs),frameIntervalMs:distribution(measured.frameMs),frameIntervals:measured.frameMs},
    snapshot:measured.snapshot,errors,
    limits:'Software WebGL on this host. Input includes browser automation dispatch/polling overhead. Frame intervals include stalls. Video container frame rate and these measurements cannot certify Android/iOS Telegram performance.'
  };
  fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2));
  console.log(JSON.stringify({output,coldReadyMs,input:report.interactive.firstMovementMs,frames:report.interactive.frameIntervalMs,errors}));
  if(errors.length)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();server?.close();});
