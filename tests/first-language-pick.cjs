// First launch: picking a language whose pack is not loaded yet must re-render text composed at render
// time (home CTA, social tasks). Regression: new players saw "START CAMPAIGN" / "OPEN ↗" / "Follow" in English.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..');
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.json':'application/json'};
const server=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://a').pathname.replace(/^\/$/,'/index.html'));fs.readFile(file,(err,b)=>{res.writeHead(err?404:200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(err?'':b);});});
const english=/START CAMPAIGN|OPEN ↗|SHARE ↗|^Follow ·|Post or reply on X|Comment your code/;
(async()=>{await new Promise(r=>server.listen(0,r));const url='http://localhost:'+server.address().port;
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});
 try{for(const [code,label] of [['ru','Русский'],['de','Deutsch'],['ar','العربية'],['zh','中文']]){
  const p=await browser.newPage({viewport:{width:390,height:844},hasTouch:true}),errors=[];p.on('pageerror',e=>errors.push(String(e)));
  await p.route('https://telegram.org/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
  await p.goto(url,{waitUntil:'load'});assert(!(await p.evaluate(c=>!!window.MKTYLocales?.[c],code)),code+' pack must not be preloaded on first launch');
  await p.locator('#languages button',{hasText:label}).click();
  await p.waitForFunction(c=>!!window.MKTYLocales?.[c]&&window.MKTYI18n.getLanguage()===c,code);await p.waitForTimeout(150);
  const left=await p.evaluate(rx=>{rx=new RegExp(rx);const out=[];const w=document.createTreeWalker(document.getElementById('home'),NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){const t=n.textContent.trim();if(rx.test(t))out.push(t.slice(0,40));}return out;},english.source);
  assert.deepEqual(left,[],code+': English left after first language pick: '+left.join(' | '));
  assert.notEqual(await p.locator('#enterBtn').textContent(),'START CAMPAIGN · 9 CHAPTERS');
  assert.deepEqual(errors,[]);await p.close();
  console.log('ok',code);
 }}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
