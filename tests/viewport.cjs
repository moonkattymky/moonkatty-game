const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..');
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.json':'application/json'};
const server=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://a').pathname.replace(/^\/$/,'/index.html'));fs.readFile(file,(err,b)=>{res.writeHead(err?404:200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(err?'':b);});});
const mock=([version,fullscreenOk,vh])=>{const ev={},calls=[];window.__tgCalls=calls;window.__tgEv=ev;const cmp=(a,b)=>{a=a.split('.').map(Number);b=b.split('.').map(Number);for(let i=0;i<2;i++){if((a[i]||0)!==(b[i]||0))return (a[i]||0)>(b[i]||0);}return true;};
 const w={initData:'',initDataUnsafe:{},version,platform:'ios',viewportHeight:vh,viewportStableHeight:vh,isFullscreen:false,
  safeAreaInset:{top:47,bottom:34,left:0,right:0},contentSafeAreaInset:{top:46,bottom:0,left:0,right:0},
  isVersionAtLeast:v=>cmp(version,v),ready(){calls.push('ready')},expand(){calls.push('expand')},
  requestFullscreen(){if(!cmp(version,'8.0'))throw new Error('unsupported');calls.push('fullscreen');if(fullscreenOk){w.isFullscreen=true;setTimeout(()=>(ev.fullscreenChanged||[]).forEach(f=>f()),0);}},
  disableVerticalSwipes(){if(!cmp(version,'7.7'))throw new Error('unsupported');calls.push('noswipe')},
  setHeaderColor(){calls.push('header')},setBackgroundColor(){calls.push('bg')},setBottomBarColor(){calls.push('bottom')},
  onEvent(n,f){(ev[n]=ev[n]||[]).push(f)},HapticFeedback:{impactOccurred(){}}};window.Telegram={WebApp:w};};
(async()=>{await new Promise(r=>server.listen(0,r));const url='http://localhost:'+server.address().port;
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});
 try{for(const [w,h] of [[390,844],[320,568]])for(const [ver,fs] of [['8.0',true],['7.0',false]]){
  const ctx=await browser.newContext({viewport:{width:w,height:h},isMobile:true,hasTouch:true,deviceScaleFactor:2});const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(String(e)));
  await p.route('https://telegram.org/js/telegram-web-app.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
  await p.route('**/functions/v1/**',r=>r.fulfill({status:503,contentType:'application/json',body:'{"ok":false}'}));
  await p.addInitScript(mock,[ver,fs,h]);await p.goto(url);await p.waitForTimeout(100);
  const tag=`${w}x${h} v${ver}`,calls=await p.evaluate(()=>window.__tgCalls);
  assert(calls.includes('ready')&&calls.includes('expand'),tag+' ready/expand');
  assert.equal(calls.includes('fullscreen'),ver==='8.0',tag+' fullscreen guard');assert.equal(calls.includes('noswipe'),ver==='8.0',tag+' swipes guard');
  for(const n of ['viewportChanged','fullscreenChanged','safeAreaChanged','contentSafeAreaChanged'])assert(await p.evaluate(n=>!!(window.__tgEv[n]||[]).length,n),tag+' listens '+n);
  const m=await p.evaluate(()=>{const a=document.getElementById('app').getBoundingClientRect();return {app:a.height,top:getComputedStyle(document.getElementById('app')).paddingTop,doc:document.documentElement.scrollHeight,body:getComputedStyle(document.body).overflow,fs:document.documentElement.classList.contains('mk-tg-fullscreen')}});
  assert.equal(Math.round(m.app),h,tag+' app fills viewport');assert.equal(m.body,'hidden');assert(m.doc<=h+1,tag+' document does not scroll '+m.doc);
  assert.equal(m.fs,ver==='8.0',tag+' fullscreen class');assert.equal(m.top,ver==='8.0'?'46px':'0px',tag+' content safe area');
  // Viewport change (keyboard/expand) is applied from Telegram stable height.
  await p.evaluate(()=>{Telegram.WebApp.viewportStableHeight=500;window.__tgEv.viewportChanged.forEach(f=>f({isStateStable:true}));});
  assert.equal(await p.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--mk-full-h').trim()),'500px');
  await p.evaluate(h=>{Telegram.WebApp.viewportStableHeight=h;window.__tgEv.viewportChanged.forEach(f=>f());},h);
  // Joystick: touchmove is cancelled, page and #app never move.
  await p.evaluate(()=>show('mission1'));await p.waitForTimeout(100);
  const joy=await p.evaluate(()=>{const j=document.querySelector('#mission1 .l1-joystick');const r=j.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,ta:getComputedStyle(j).touchAction}});
  assert.equal(joy.ta,'none');
  const before=await p.evaluate(()=>[scrollY,document.getElementById('app').scrollTop]);
  const cancelled=await p.evaluate(({x,y})=>{const j=document.elementFromPoint(x,y);const t=(dy)=>new Touch({identifier:1,target:j,clientX:x,clientY:y+dy});
   j.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,cancelable:true,touches:[t(0)],targetTouches:[t(0)],changedTouches:[t(0)]}));
   const res=[];for(const dy of [20,40,-40]){const e=new TouchEvent('touchmove',{bubbles:true,cancelable:true,touches:[t(dy)],targetTouches:[t(dy)],changedTouches:[t(dy)]});j.dispatchEvent(e);res.push(e.defaultPrevented);}return res;},joy);
  assert.deepEqual(cancelled,[true,true,true],tag+' joystick touchmove cancelled');
  await p.touchscreen.tap(joy.x,joy.y);
  assert.deepEqual(await p.evaluate(()=>[scrollY,document.getElementById('app').scrollTop]),before,tag+' no jerk');
  // Non-game screen still scrolls inside #app; touchmove there is not cancelled.
  await p.evaluate(()=>show('rules'));await p.waitForTimeout(50);
  const sc=await p.evaluate(()=>{const a=document.getElementById('app');a.scrollTop=0;const can=a.scrollHeight>a.clientHeight;a.scrollTop=120;
   const tgt=document.querySelector('#rules').firstElementChild;const t=(y)=>new Touch({identifier:2,target:tgt,clientX:100,clientY:y});
   tgt.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,touches:[t(400)],changedTouches:[t(400)]}));const e=new TouchEvent('touchmove',{bubbles:true,cancelable:true,touches:[t(300)],changedTouches:[t(300)]});tgt.dispatchEvent(e);
   return {can,top:a.scrollTop,prevented:e.defaultPrevented};});
  if(sc.can){assert(sc.top>0,tag+' rules scrolls');assert.equal(sc.prevented,false,tag+' rules touch scroll allowed');}
  await p.evaluate(()=>show('home'));await p.screenshot({path:`/tmp/viewport-${w}x${h}-v${ver}.png`});
  assert.deepEqual(errors,[],tag+' page errors');await ctx.close();console.log('ok',tag,sc.can?'(rules scrollable)':'');}
 console.log('viewport tests passed');}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);process.exit(1);});
