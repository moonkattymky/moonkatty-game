'use strict';
/* Non-browser contract checks only. Never calls runner.main(), listens on a port,
 * imports Playwright, or runs the injected adapter. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const Module=require('node:module'),load=Module._load;
Module._load=function(id,...args){assert(!/^playwright(?:-core)?$/.test(id),'Importing contract must not import browser launcher');return load.call(this,id,...args);};
let runner;try{runner=require('./life1-browser-parity.cjs');}finally{Module._load=load;}
const install=require('./fixtures/life1-browser-adapter.cjs'),root=path.resolve(__dirname,'..');
let checks=0;function test(label,fn){fn();checks++;console.log('PASS '+label);}
test('Import-only runner and adapter parse without browser side effects',()=>{
  assert.equal(typeof runner.main,'function');new vm.Script('('+install.toString()+')');
});
test('Frame matrix is explicitly 30/60/120Hz and includes compact/large/fractional layouts',()=>{
  assert.deepEqual(runner.RATES,[30,60,120]);assert.equal(runner.VIEWPORTS.length,5);
  assert(runner.VIEWPORTS.some(v=>v.viewport.width===320));assert(runner.VIEWPORTS.some(v=>v.viewport.width===520));
  assert(runner.VIEWPORTS.some(v=>v.containerWidth%1!==0&&Number.isFinite(v.containerWidth)));
});
test('Only local static GET/HEAD assets can be served',()=>{
  for(const file of ['/','/app.js?v=1','/chapters-1-4.css','/art/moonkatty-walk.webp','/locales/runtime/en.json'])assert(runner.localAsset(file),file);
  assert(runner.localAsset('/index.html','HEAD'));
  for(const file of ['/.git/config','/%2eenv','/server/rewards/index.ts','/tests/first-three.cjs','/node_modules/playwright/index.js','/api/rewards','/life1-model.js','/docs/prototypes/life1-replay.md','/%zz'])assert.equal(runner.localAsset(file),null,file);
  assert.equal(runner.localAsset('/app.js','POST'),null);
});
test('Network boundary rejects live hosts, alternate ports and API mutations',()=>{
  const origin='http://127.0.0.1:12345';assert(runner.allowedRequest(origin+'/app.js','GET',origin));
  for(const [url,method] of [['https://telegram.org/js/telegram-web-app.js','GET'],['https://example.supabase.co/functions/v1/rewards','POST'],['http://127.0.0.1:12346/app.js','GET'],[origin+'/api/rewards','POST'],[origin+'/app.js','POST']])assert.equal(runner.allowedRequest(url,method,origin),false,url);
});
test('Source prototype production contract is unchanged',()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'docs/prototypes/life1-source-manifest.json')));
  for(const [file,want]of Object.entries(manifest.sha256))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex'),want,file);
});
test('Candidate model is injected only by tests, never the runtime loader',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');assert(!html.includes('life1-model.js'));
  const driver=fs.readFileSync(path.join(__dirname,'life1-browser-parity.cjs'),'utf8');
  assert(driver.includes("addScriptTag({path:path.join(ROOT,'life1-model.js')})"));
  assert(driver.includes("server.listen(0,'127.0.0.1'"));assert(driver.includes("serviceWorkers:'block'"));assert(driver.includes('routeWebSocket'));
});
test('Adapter does not manufacture rectangles, repair outcomes or source geometry refresh',()=>{
  const code=install.toString();
  assert(!/getBoundingClientRect\s*=/.test(code));assert(!/refreshLife1Geometry\s*\(/.test(code));
  assert(!/(?:life1Stage|repairCells|targetFrequency|signalHoldProgress)\s*=(?!=)/.test(code));
  assert(code.includes("eq(M.blocked(state,call.x,call.y),call.blocked"));assert(code.includes('candidate<.24'));
  assert(code.includes("if(typeof life1MoveFrame!=='undefined')cancelAnimationFrame(life1MoveFrame)"));
});
console.log(JSON.stringify({suite:'life1-browser-contract',passed:checks,browserRun:false,socketRun:false}));
