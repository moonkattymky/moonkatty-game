'use strict';
/* Keyboard-equivalent controller regression, deliberately socket/browser free.
 * Input events stand in for native range changes; button click events stand in
 * for native keyboard activation. No completion or correct pin is pre-seeded.
 * This does not prove native Arrow/Home/End behavior, focus order, accessible
 * name computation, screen-reader announcements, visible reachability or touch. */
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {fixture,lockBearings,BASELINE,BASELINE_SHA256,R,clone}=require('./triangulation-controller-helper.cjs');
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(BASELINE)).digest('hex'),BASELINE_SHA256,'Frozen live-tree 8fa209e31d1b9cfa875df197263cd5152963501e controller is unchanged');
const report={suite:'triangulation-keyboard-controller',baselineSha256:BASELINE_SHA256,browser:false,sockets:false,nativeKeyboardSemanticsTested:false,scenarios:0};
function scenario(name,callback){callback();report.scenarios++;console.log('PASS '+name);}
function coordinates(h,x,y){h.rangeInput('pinX',x);h.rangeInput('pinY',y);}
function markerValues(h,x,y){assert.equal(Number(h.range('pinX').value),x);assert.equal(Number(h.range('pinY').value),y);}
function noStateChange(h,callback,label){const before=h.snapshot(),count=h.saves.length;callback();assert.deepEqual(h.snapshot(),before,label);assert.equal(h.saves.length,count,label+' must not save ignored actions');}
function replayMatches(snapshot){
 const replay=R.create(snapshot.n,snapshot.stage,snapshot.seed);
 for(const row of snapshot.trace){assert.equal(row[0],'act');R.act(replay,row[1],row[2]);}
 const actual=clone(snapshot);delete actual.trace;assert.deepEqual(actual,replay,'Saved controller trace must replay to the same production-model state');
}
scenario('same fixture reproduces baseline keyboard-only missing-pin blocker',()=>{
 const h=fixture({source:BASELINE});h.resume();lockBearings(h);
 assert.equal(h.range('pinX'),null);assert.equal(h.range('pinY'),null);
 assert.deepEqual(h.$('fieldControls').querySelectorAll('[data-field-slider]').map(node=>node.dataset.fieldSlider),['angle']);
 const world=h.$('fieldWorld'),svg=world.querySelector('svg');
 for(const key of ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','Enter',' '])svg.dispatchEvent({type:'keydown',key,code:key,bubbles:true});
 assert.equal(h.snapshot().pin,null,'Existing keyboard path cannot create a marker');h.submit();
 assert.equal(h.snapshot().notice,'intersection');assert.equal(h.snapshot().complete,false);assert(!R.won(h.snapshot()));
 // Positive control: the identical baseline fixture can win using its original pointer path.
 const source=R.layout(h.snapshot()).source;h.pointer(source.x,source.y);h.submit();assert(h.snapshot().complete&&R.won(h.snapshot()));
});
scenario('candidate renders named native ranges and linked instructions without placing a pin',()=>{
 for(const lang of ['en','ru']){
  const h=fixture({lang});assert.equal(h.snapshot().pin,null);
  for(const [name,label,min,max,value]of [['pinX',lang==='en'?'MARKER X':'МЕТКА X',0,600,300],['pinY',lang==='en'?'MARKER Y':'МЕТКА Y',0,450,225]]){
   const input=h.range(name);assert(input,'New marker range must be rendered: '+name);
   assert.equal(input.tagName,'INPUT');assert.equal(input.getAttribute('type'),'range');
   assert.equal(input.getAttribute('aria-label'),label);assert.equal(input.getAttribute('min'),String(min));assert.equal(input.getAttribute('max'),String(max));assert.equal(input.getAttribute('step'),'1');
   assert.equal(input.getAttribute('dir'),'ltr');assert.equal(Number(input.value),value);assert.equal(input.disabled,false);
   const hint=input.getAttribute('aria-describedby');assert(hint,'Marker needs linked instructions');assert(h.$(hint).textContent.trim().length>30);
  }
  assert.equal(h.snapshot().pin,null);assert.equal(h.saved().pin,null);assert.deepEqual(h.snapshot().trace,[]);
  const source=R.layout(h.snapshot()).source;assert.notDeepEqual(source,{x:300,y:225},'Fixture midpoint is not populated from the hidden source');
 }
});
scenario('axis inputs use existing pin action, preserve the other coordinate and retain focused nodes',()=>{
 const h=fixture();h.resume();
 let input=h.rangeInput('pinX',301);assert.deepEqual(h.snapshot().pin,{x:301,y:225});assert.equal(h.document.activeElement,input);assert.equal(input.isConnected,true);assert.equal(h.range('pinX'),input);
 assert.deepEqual(h.snapshot().trace.at(-1),['act','pin',{x:301,y:225}]);
 input=h.rangeInput('pinY',226);assert.deepEqual(h.snapshot().pin,{x:301,y:226});assert.equal(h.document.activeElement,input);assert.equal(h.range('pinY'),input);markerValues(h,301,226);
 assert.equal(h.$('fieldControls').querySelector('[data-field-read="pinX"]').textContent,'301');assert.equal(h.$('fieldControls').querySelector('[data-field-read="pinY"]').textContent,'226');
 assert.deepEqual(h.saved(),h.snapshot());replayMatches(h.snapshot());
 // Starts from no pin using the other axis first, without reading the hidden source.
 const yFirst=fixture();yFirst.resume();yFirst.rangeInput('pinY',224);assert.deepEqual(yFirst.snapshot().pin,{x:300,y:224});
});
scenario('all bearings, marker placement, submit, save and Continue are achievable via controls',()=>{
 for(const stage of [0,1,2,3,4])for(const seed of [0,1,7,42,99]){
  const h=fixture({stage,seed});h.resume();lockBearings(h);assert.equal(h.snapshot().pin,null);
  const target=R.layout(h.snapshot()).source;coordinates(h,Math.round(target.x),Math.round(target.y));
  assert.equal(h.snapshot().complete,false,'Moving a marker alone does not auto-submit');h.submit();
  const complete=h.snapshot();assert(complete.complete&&R.won(complete));assert.deepEqual(h.saved(),complete);assert.equal(complete.errors,0);
  assert.equal(complete.trace.filter(row=>row[1]==='pin').length,2);assert(!complete.trace.some(row=>['pinX','pinY'].includes(row[1])),'New UI does not invent model actions');replayMatches(complete);
  for(const name of ['pinX','pinY'])assert.equal(h.range(name).disabled,true,'Completed marker controls are disabled');
  h.submit();assert.deepEqual(h.completions,[complete],'Continue receives the earned checkpoint once');
 }
});
scenario('missing bearings, missing marker and distant marker are still rejected',()=>{
 const h=fixture();h.resume();const source=R.layout(h.snapshot()).source;
 coordinates(h,Math.round(source.x),Math.round(source.y));h.submit();assert.equal(h.snapshot().notice,'all-bearings');assert.equal(h.snapshot().complete,false);
 lockBearings(h);coordinates(h,0,0);h.submit();assert.equal(h.snapshot().notice,'intersection');assert.equal(h.snapshot().complete,false);assert(!R.won(h.snapshot()));
 const noPin=fixture();noPin.resume();lockBearings(noPin);noPin.submit();assert.equal(noPin.snapshot().pin,null);assert.equal(noPin.snapshot().notice,'intersection');assert.equal(noPin.snapshot().complete,false);
});
scenario('pointer placement preserves original coordinates and updates ranges without replacing focus',()=>{
 const candidate=fixture(),baseline=fixture({source:BASELINE});candidate.resume();baseline.resume();
 for(const point of [{x:413.25,y:138.5},{x:0,y:0},{x:600,y:450},{x:-40,y:500}]){
  const focused=candidate.range('pinX');focused.focus();candidate.pointer(point.x,point.y);baseline.pointer(point.x,point.y);
  assert.deepEqual(candidate.snapshot(),baseline.snapshot(),'Original SVG transform and model clamp stay equivalent');
  // This adapter records the controller's value assignment; native range step
  // sanitization (fractional pointer coordinates) still needs browser coverage.
  const pin=candidate.snapshot().pin;assert.equal(Number(candidate.range('pinX').value),pin.x);assert.equal(Number(candidate.range('pinY').value),pin.y);
  assert.equal(candidate.document.activeElement,focused);assert.equal(candidate.range('pinX'),focused);
 }
 candidate.pointer(413.25,138.5);const exactY=candidate.snapshot().pin.y;assert.notEqual(exactY,Math.round(exactY));candidate.rangeInput('pinX',420);assert.deepEqual(candidate.snapshot().pin,{x:420,y:exactY},'X input preserves exact fractional pointer Y');
 candidate.rangeInput('pinY',140);assert.deepEqual(candidate.snapshot().pin,{x:420,y:140});
});
scenario('range bounds are declared and boundary input reaches all map corners',()=>{
 const h=fixture();h.resume();
 for(const [x,y]of [[0,0],[600,450],[0,450],[600,0]]){coordinates(h,x,y);assert.deepEqual(h.snapshot().pin,{x,y});markerValues(h,x,y);assert.deepEqual(h.saved().pin,{x,y});}
 // Browser clamping/step behavior is intentionally not simulated; model clamping
 // is separately exercised by the pointer case above.
});
scenario('paused, inactive and completed input cannot change checkpoint or trace',()=>{
 const h=fixture();noStateChange(h,()=>{h.rangeInput('pinX',301);h.rangeInput('pinY',226);},'Initial paused input ignored');markerValues(h,300,225);
 h.resume();coordinates(h,200,200);h.pause();noStateChange(h,()=>{h.rangeInput('pinX',301);h.rangeInput('pinY',226);h.pointer(300,225);},'Paused input ignored');
 markerValues(h,200,200);h.resume();h.inactive();noStateChange(h,()=>{h.rangeInput('pinX',302);h.rangeInput('pinY',227);h.pointer(350,200);},'Inactive input ignored');
 markerValues(h,200,200);h.active();lockBearings(h);const source=R.layout(h.snapshot()).source;coordinates(h,Math.round(source.x),Math.round(source.y));h.submit();
 const complete=h.snapshot();noStateChange(h,()=>{h.rangeInput('pinX',0);h.rangeInput('pinY',0);h.pointer(0,0);},'Completed input ignored');assert.deepEqual(h.snapshot(),complete);markerValues(h,complete.pin.x,complete.pin.y);
});
scenario('partial and earned-complete checkpoints restore with coordinates and trace unchanged',()=>{
 for(const complete of [false,true]){
  const h=fixture({seed:42,stage:4});h.resume();lockBearings(h);
  if(complete){const source=R.layout(h.snapshot()).source;coordinates(h,Math.round(source.x),Math.round(source.y));h.submit();}
  else h.pointer(387.25,142.75);
  const snapshot=h.snapshot();h.pause();h.hide();assert.deepEqual(h.saved(),snapshot);
  // New VM simulates a fresh controller document; saved state is earned above.
  const reboot=fixture({seed:42,stage:4,saved:h.saved()});assert.deepEqual(reboot.snapshot(),snapshot);assert.deepEqual(reboot.saved(),snapshot);markerValues(reboot,snapshot.pin.x,snapshot.pin.y);
  for(const name of ['pinX','pinY'])assert.equal(reboot.range(name).disabled,complete);
  reboot.resume();if(complete){reboot.submit();assert.deepEqual(reboot.completions,[snapshot]);}
  else{reboot.rangeInput('pinX',388);assert.deepEqual(reboot.snapshot().pin,{x:388,y:snapshot.pin.y});assert.deepEqual(reboot.snapshot().trace.slice(0,-1),snapshot.trace);}
 }
});
console.log(JSON.stringify({...report,passed:true,fullControlWins:25,limitations:['native keyboard defaults','browser focus order and layout','screen readers','physical touch']}));
