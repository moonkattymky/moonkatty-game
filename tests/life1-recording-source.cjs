'use strict';
// Source checks only: importing the browser fixture must not load a browser or
// socket module, start a server, or execute its main function.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),Module=require('node:module');
const root=path.resolve(__dirname,'..'),base=path.join(root,'prototypes/life1-capture');
const manifest=JSON.parse(fs.readFileSync(path.join(base,'source-manifest.json'),'utf8'));
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
for(const row of [...manifest.runtimeReference,...manifest.frozenDependencies])assert.equal(hash(row.path),row.sha256,'unchanged reference '+row.path);
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert(!html.includes('controller-adapter')&&!html.includes('LocalLife1Recorder')&&!html.includes('life1-capture'),'runtime loader is unchanged and inactive');
const {instrument}=require('./fixtures/life1-recording-instrument.cjs');
for(const file of ['app.js','experience.js','campaign.js']){
 const source=fs.readFileSync(path.join(root,file),'utf8'),modified=instrument(source,file);
 assert.notEqual(modified,source);new vm.Script(modified,{filename:file});
 assert.throws(()=>instrument('',file),/Source seam changed/,'anchors fail closed');
}
const load=Module._load;
let browser;
try{
 Module._load=function(id,...rest){assert(!['http','node:http','net','node:net','playwright'].includes(id),'import must not load network/browser: '+id);return load.call(this,id,...rest);};
 browser=require('./life1-recording-browser-fixture.cjs');
}finally{Module._load=load;}
new vm.Script(browser.bundle(),{filename:'test-only-browser-bundle.js'});
assert.equal(browser.responseFor('/app.js').status,200);
assert(browser.responseFor('/app.js').body.includes(Buffer.from('__C1Capture')));
assert.equal(browser.responseFor('/index.html').body.toString(),html);
assert.equal(browser.responseFor('/app.js','HEAD').body.length,0);
for(const url of ['/server/rewards/index.cjs','/tests/life1-recording-source.cjs','/prototypes/life1-capture/controller-adapter.js','/.git/config','/api/rewards','/%00'])assert.notEqual(browser.responseFor(url).status,200,url);
assert.equal(browser.responseFor('/app.js','POST').status,405);
assert.equal(browser.responseFor('/%xx').status,400);
const source=fs.readFileSync(path.join(__dirname,'life1-recording-browser-fixture.cjs'),'utf8');
assert(source.includes('if(require.main===module)main();'));
assert(source.includes('frameTimestamp')||source.includes('dispatch-and-physics'));
assert(source.includes("gatePassed:false"),'native mixed-clock diagnostic must not claim admission');
assert(/id="frequencyDial"[^>]*type="range"[^>]*min="0"[^>]*max="100"/.test(html),'keyboard fixture matches the existing native range bounds');
assert(!source.includes('.fill('),'fixture must not use direct-value fill for the antenna range');
assert(source.includes("dial.press('Home')")&&source.includes("dial.press('ArrowRight')"),'fixture exercises the ordinary keyboard range path');
assert(source.includes("native range advances exactly one step")&&source.includes("await checked(p,'keyboard antenna range '"),'range stepping retains strict value, geometry and replay assertions');
const diagnostics=require('./fixtures/life1-recording-browser-helper.cjs');
new vm.Script(`(${diagnostics.installGeometryDiagnostics.toString()})(${diagnostics.geometrySnapshot.toString()})`);
assert(source.includes("'before collect '+id")&&source.includes("'after collect '+id+' before clock advance'"));
assert(!/refreshLife1Geometry|requestAnimationFrame|setTimeout|\.clock\./.test(diagnostics.geometrySnapshot.toString()+diagnostics.installGeometryDiagnostics.toString()),'diagnostic callbacks neither refresh nor wait/advance clocks');
let calls=0,snapshots=0;const seen=[],capture={observe(...args){calls++;seen.push(args);return calls;},status:()=>({fault:calls>=2?{error:'unsettled-live-size'}:null}),wire:()=>JSON.stringify({entries:[['event',['frame',1,0,0]]]})};
const sandbox={window:{__C1Capture:capture},performance:{now:()=>100},snapshot:()=>{snapshots++;return {exact:true};}};
vm.runInNewContext(`(${diagnostics.installGeometryDiagnostics.toString()})(snapshot);window.__C1Capture.observe('frame',1,-0,0);window.__C1Capture.observe('frame',2,0,0);window.__C1Capture.observe('frame',3,0,0);`,sandbox);
assert.equal(calls,3);assert(Object.is(seen[0][2],-0),'diagnostics forward exact input');assert.equal(snapshots,1);assert.equal(sandbox.window.__C1GeometryDiagnostics.firstRefusal.event[1],2,'retain only the first refusal');
const report={test:'life1-recording-source',baseCommit:manifest.baseCommit,baseTree:manifest.baseTree,referenceHashesChecked:manifest.runtimeReference.length+manifest.frozenDependencies.length,instrumentedSourcesCompile:3,browserBundleCompiles:true,browserMainExecuted:false};
if(process.env.MKTY_TEST_OUTPUT){fs.mkdirSync(process.env.MKTY_TEST_OUTPUT,{recursive:true});fs.writeFileSync(path.join(process.env.MKTY_TEST_OUTPUT,'source-report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report));
