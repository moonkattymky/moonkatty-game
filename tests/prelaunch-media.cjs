const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const name=new URL(req.url,'http://test').pathname.replace(/^\//,'');const file=path.join(root,name||'index.html');fs.readFile(file,(e,bytes)=>{res.writeHead(e?404:200,{'Content-Type':({'.mp4':'video/mp4','.html':'text/html','.js':'application/javascript','.css':'text/css','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream'});res.end(e?'':bytes);});});
(async()=>{await new Promise(r=>server.listen(0,r));const base='http://localhost:'+server.address().port;const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});try{
 const p=await b.newPage();await p.route('https://telegram.org/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));await p.goto(base);
 const movies=await p.locator('.life-video source').evaluateAll(ss=>ss.map(s=>s.getAttribute('src')));assert.equal(movies.length,9);
 assert(movies.includes('life-2-prelaunch.mp4')&&movies.includes('life-3-prelaunch.mp4'));assert(!movies.includes('life-2.mp4')&&!movies.includes('life-3.mp4'));
 for(const old of ['life-2.mp4','life-3.mp4'])assert(!fs.existsSync(path.join(root,old)),'old promotional film removed');
 for(const movie of movies){
  assert.equal((await p.request.get(base+'/'+movie)).status(),200,movie);
  await p.goto(base+'/'+movie);await p.locator('video').waitFor();
  await p.evaluate(async()=>{const v=document.querySelector('video');v.muted=true;await v.play();});
  await p.waitForFunction(()=>{const v=document.querySelector('video');return v.currentTime>.2&&v.readyState>=2;},null,{timeout:15000});
  const meta=await p.evaluate(()=>{const v=document.querySelector('video');return {duration:v.duration,width:v.videoWidth,height:v.videoHeight,error:v.error?.code||null};});
  assert.equal(meta.error,null,movie);assert.equal(meta.width,540);assert.equal(meta.height,960);assert(meta.duration>=8&&meta.duration<=11,movie+' duration');
  if(movie.includes('-prelaunch'))await p.waitForFunction(()=>document.querySelector('video').ended,null,{timeout:15000});
  console.log('PASS playback '+movie);
 }
 console.log('PASS: all nine chapter videos decode; neutral LIFE #2/#3 play to completion');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
