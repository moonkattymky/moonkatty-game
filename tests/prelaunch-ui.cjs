const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{chromium}=require('playwright');
const root=path.join(__dirname,'..'),out=process.env.MKTY_TEST_OUTPUT||'/tmp/mkty-prelaunch-ui';fs.mkdirSync(out,{recursive:true});
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.webp':'image/webp'};
const server=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://a').pathname.replace(/^\/$/,'/index.html'));fs.readFile(file,(e,b)=>{res.writeHead(e?404:200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(e?'':b);});});
(async()=>{await new Promise(r=>server.listen(0,r));const base='http://localhost:'+server.address().port,b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});try{
 const p=await b.newPage();const errors=[];p.on('pageerror',e=>errors.push(String(e)));
 for(const size of [{width:320,height:480},{width:390,height:844},{width:1365,height:900}]){await p.setViewportSize(size);for(const file of ['terms.html','privacy.html']){assert.equal((await p.goto(base+'/'+file)).status(),200);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,file+' fits '+size.width);assert.equal(await p.locator('article').count(),2);for(const href of await p.locator('a[href]').evaluateAll(a=>a.map(x=>x.getAttribute('href')))){if(!href.startsWith('http')&&!href.startsWith('#'))assert.equal((await p.request.get(base+'/'+href)).status(),200);}
 if(size.width===390)await p.screenshot({path:out+'/'+file+'.png',fullPage:true});}}
 await p.route('https://telegram.org/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
 await p.addInitScript(()=>{localStorage.setItem('mkty_lang','ru');});await p.goto(base);await p.waitForFunction(()=>window.MKTYHub&&window.MKTYI18n);
 for(const lang of ['en','ru','uk','es','pt','de','fr','it','tr','he','ar','ko','zh']){
  await p.evaluate(lang=>setLang(lang),lang);await p.waitForTimeout(200);await p.evaluate(()=>MKTYHub.open('more'));
  assert.equal(await p.locator('#hubBody a[href="terms.html"]').count(),1);assert.equal(await p.locator('#hubBody a[href="privacy.html"]').count(),1);
  const text=await p.locator('#hubBody').innerText();assert(!/MKTY|Solana|Phantom|airdrop/.test(text.replace(/MKTY-XXXX/g,'')),lang+' has no token promotion');
 }
 for(const file of ['app.js','social.js']){const source=fs.readFileSync(path.join(root,file),'utf8');assert(source.includes('https://www.youtube.com/@moonkattymky'));assert(!source.includes('youtube.com/@moonkattymkty'));}
 const workflow=fs.readFileSync(path.join(root,'.github/workflows/deploy-pages.yml'),'utf8');assert(workflow.includes('|admin.html|'),'admin page excluded from deployed artifact');
 assert.deepEqual(errors,[]);console.log('PASS: legal pages at 3 viewports, working local links, 13-language More screen without token promotion and corrected social URLs');
 }finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>server.close());
