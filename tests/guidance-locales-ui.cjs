/* CI browser regression for localized mission guidance. Run with:
 * MKTY_TEST_OUTPUT=/tmp/guidance-locales node tests/guidance-locales-ui.cjs
 * Isolated guest contexts, real locale-loader/i18n and DOM controls, no live services.
 * Prerequisite/checkpoint fixtures isolate presentation; gameplay solvers have separate coverage.
 * Screenshots are diagnostic evidence, never artwork or pixel-comparison baselines. */
'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),os=require('node:os');
const assertFieldControlReachable=require('./field-control-helper.cjs');
const root=path.resolve(__dirname,'..');
const out=process.env.MKTY_TEST_OUTPUT||fs.mkdtempSync(path.join(os.tmpdir(),'mkty-guidance-locales-'));
fs.mkdirSync(out,{recursive:true});
const languages=[['en','English'],['ru','Русский'],['uk','Українська'],['es','Español'],['pt','Português'],['de','Deutsch'],['fr','Français'],['it','Italiano'],['tr','Türkçe'],['he','עברית'],['ar','العربية'],['ko','한국어'],['zh','中文']];
const viewports=[{width:320,height:480},{width:390,height:640}];
// Explicit frozen regression scope: deleting a source call or a bundle key must not shrink coverage.
const requiredKeys=[
  "CHAPTER COMPLETE",
  "EIGHT STAGES COMPLETE",
  "NEXT OBJECTIVE",
  "Chapter finale",
  "VERIFYING ROUTE…",
  "ROUTE UNAVAILABLE",
  "RESUME STAGE →",
  "START STAGE →",
  "Results are saved. You can reopen the finale.",
  "Preparation complete. The final mission is available.",
  "Other available stages are on the map and in the list below.",
  "Stage ",
  "Route unavailable",
  "Getting a verified route. Stages unlock after the server response is saved.",
  "This route is archived on this device. Choose a new verified route to earn its reward. Confirmed achievements and balance are preserved.",
  "The route or archive could not be saved. Restore device saving, then retry.",
  "Could not get a verified route. Progress is preserved. Check your connection and retry.",
  "KEEP ARCHIVE AND START A NEW ROUTE",
  "RETRY CONNECTION",
  "CHECKING REWARD…",
  "RETRY REWARD SYNC",
  "The reward queue could not be read. Restore device saving and retry. Your current route is preserved.",
  "This chapter reward is awaiting sync. Retry reward sync before starting a new route. Your current route is preserved.",
  "DOWNLOAD SAVED ROUTE",
  "S → three beacons → E. Tap neighboring cells; the previous cell undoes a move.",
  "IN → three nodes → OUT. Tap segments to rotate them.",
  "Match every total to its target. Tap two modules to swap them.",
  "Switch every node on. A tap toggles it and its vertical and horizontal neighbors.",
  "Choose a slot, then a symbol. No repeats; ● = exact positions, ◇ = other positions.",
  "Start every system. Select available cards; undo a step if resources run short.",
  "FULL OBJECTIVE & CONTROLS",
  "Result confirmed. Continue using the button below the board.",
  "SOLVE → CONFIRM",
  "Recover 3 sources → exit. Scan, then tap an adjacent cell.",
  "Complete 6 jobs. Station → specialist → assign.",
  "Complete 3 maneuvers. Adjust the trajectory with the sliders → execute.",
  "Safe landing site: select → scan → sample → confirm.",
  "Balance every loop with the valves → confirm the load.",
  "Dock 1 → 2 → 3. Hold arrows / WASD; Space brakes. Speed <12.",
  "Recover 3 packages → exit. Tap an adjacent cell to move; wait for patrols.",
  "3 bearings → source. Array → bearing → lock; mark the beam intersection.",
  "Bring 3 ships home. Select ship → adjacent node; the engineer opens GATE.",
  "Recover 6 fragments. Band → listen; the red band is interference.",
  "Bring 3 ships through. Align both apertures with the axis → send a ship.",
  "Diagnose → bypass → valves → confirm. Validate each load.",
  "Objective complete. Record your result using the button below.",
  "Up",
  "Left",
  "Down",
  "Right"
];
assert.equal(requiredKeys.length,50);
assert.equal(new Set(requiredKeys).size,50);
const boardHints={
 4:'S → three beacons → E. Tap neighboring cells; the previous cell undoes a move.',
 5:'IN → three nodes → OUT. Tap segments to rotate them.',
 6:'Match every total to its target. Tap two modules to swap them.',
 7:'Switch every node on. A tap toggles it and its vertical and horizontal neighbors.',
 8:'Choose a slot, then a symbol. No repeats; ● = exact positions, ◇ = other positions.',
 9:'Start every system. Select available cards; undo a step if resources run short.'
};
const fieldHints={
 1:'Recover 3 sources → exit. Scan, then tap an adjacent cell.',
 2:'Complete 6 jobs. Station → specialist → assign.',
 3:'Complete 3 maneuvers. Adjust the trajectory with the sliders → execute.',
 4:'Safe landing site: select → scan → sample → confirm.',
 5:'Diagnose → bypass → valves → confirm. Validate each load.',
 6:'Dock 1 → 2 → 3. Hold arrows / WASD; Space brakes. Speed <12.',
 7:'Recover 3 packages → exit. Tap an adjacent cell to move; wait for patrols.',
 8:'3 bearings → source. Array → bearing → lock; mark the beam intersection.',
 9:'Bring 3 ships home. Select ship → adjacent node; the engineer opens GATE.',
 10:'Recover 6 fragments. Band → listen; the red band is interference.',
 11:'Bring 3 ships through. Align both apertures with the axis → send a ship.'
};
const fieldSubmitKeys={1:'REACH THE EXIT',2:'ASSIGN SPECIALIST',3:'EXECUTE MANEUVER',4:'CONFIRM LANDING SITE',5:'CONFIRM BALANCE',6:'DOCK',7:'REACH THE EXIT',8:'CONFIRM SOURCE',9:'BRING ALL SHIPS HOME',10:'LISTEN ON BAND',11:'SEND A SHIP'};
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{
 const file=path.resolve(root,'.'+new URL(req.url,'http://local').pathname.replace(/^\/$/,'/index.html'));
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(error,body)=>{res.writeHead(error?404:200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(error?'':body);});
});
let browser,context,page,origin,lang,strings,viewport;
const report={languages:[],layouts:[],screenshots:[],errors:[],badLocalResponses:[],blockedExternalRequests:[],scrolls:[]};
let renderedKeys=new Set();
const normalized=value=>String(value).replace(/\s+/gu,' ').trim();
const label=()=>`${lang} ${viewport.width}×${viewport.height}`;
function expected(key){
 if(lang==='en')return key;
 assert(Object.hasOwn(strings,key),`${label()}: loaded ${lang} runtime pack lacks ${JSON.stringify(key)}`);
 assert.equal(typeof strings[key],'string',`${lang}: non-string translation for ${key}`);
 assert(strings[key].trim(),`${lang}: empty translation for ${key}`);
 return strings[key];
}
async function text(selector,key,{suffix='',attribute}={}){
 const locator=page.locator(selector),actual=attribute?await locator.getAttribute(attribute):await locator.textContent();
 assert.equal(normalized(actual),normalized(expected(key)+suffix),`${label()} ${selector}${attribute?' ['+attribute+']':''}`);
 if(requiredKeys.includes(key))renderedKeys.add(key);
 if(lang!=='en'&&requiredKeys.includes(key))assert.notEqual(normalized(actual),normalized(key+suffix),`${label()} ${selector}: English fallback`);
 return actual;
}
async function screenshot(name){
 const file=`${lang}-${viewport.width}x${viewport.height}-${name}.png`;
 await page.screenshot({path:path.join(out,file)});report.screenshots.push(file);
}
async function noOverflow(){
 const sizes=await page.evaluate(()=>({document:document.documentElement.scrollWidth,app:document.getElementById('app').scrollWidth,width:innerWidth}));
 assert.equal(sizes.document,sizes.width,`${label()}: document overflow ${JSON.stringify(sizes)}`);
 assert(sizes.app<=sizes.width,`${label()}: app overflow ${JSON.stringify(sizes)}`);
}
// Full text line boxes, not just element centers, must fit every clipping ancestor.
// The existing control helper separately enforces complete 44px targets and five-point hit testing.
async function readableState(locator){
 return locator.evaluate(e=>{
  const rect=r=>({left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height});
  const box=e.getBoundingClientRect(),clip={left:0,top:0,right:innerWidth,bottom:innerHeight},ancestors=[];
  for(let a=e;a;a=a.parentElement){const style=getComputedStyle(a),r=a.getBoundingClientRect(),x=/auto|scroll|hidden|clip/.test(style.overflowX),y=/auto|scroll|hidden|clip/.test(style.overflowY);
   if(x){clip.left=Math.max(clip.left,r.left+a.clientLeft);clip.right=Math.min(clip.right,r.left+a.clientLeft+a.clientWidth);}
   if(y){clip.top=Math.max(clip.top,r.top+a.clientTop);clip.bottom=Math.min(clip.bottom,r.top+a.clientTop+a.clientHeight);}
   if(x||y)ancestors.push({id:a.id,className:a.className,overflowX:style.overflowX,overflowY:style.overflowY,scrollLeft:a.scrollLeft,scrollTop:a.scrollTop,scrollWidth:a.scrollWidth,scrollHeight:a.scrollHeight,clientWidth:a.clientWidth,clientHeight:a.clientHeight,box:rect(r)});
  }
  const walker=document.createTreeWalker(e,NodeFilter.SHOW_TEXT),lines=[];let node;
  while((node=walker.nextNode())){if(!node.textContent.trim())continue;const range=document.createRange();range.selectNodeContents(node);for(const r of range.getClientRects())if(r.width&&r.height){const hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);lines.push({...rect(r),uncovered:hit===e||e.contains(hit),hit:hit?{id:hit.id,tagName:hit.tagName,className:hit.getAttribute('class'),footer:hit.closest('footer')?.className||null}:null});}}
  return {target:e.id,fieldMechanic:Number(e.closest('#fieldMission')?.dataset.chapter)||null,windowScroll:{x:scrollX,y:scrollY},box:rect(box),clip,ancestors,lines,fontSize:parseFloat(getComputedStyle(e).fontSize),text:e.textContent,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth};
 });
}
function scrollableMovement(before,after){
 assert.equal(after.ancestors.length,before.ancestors.length,`${label()}: scrolling must not change the clipping tree`);
 assert.deepEqual(after.windowScroll,before.windowScroll,`${label()}: the locked document must not be programmatically scrolled`);
 for(let i=0;i<before.ancestors.length;i++){
  const a=before.ancestors[i],b=after.ancestors[i];
  assert.equal(b.id,a.id,`${label()}: scrolling must preserve ancestor identity`);
  for(const [offset,overflow,extent,size] of [['scrollTop','overflowY','scrollHeight','clientHeight'],['scrollLeft','overflowX','scrollWidth','clientWidth']]){
   if(Math.abs(b[offset]-a[offset])<=.5)continue;
   assert(/^(auto|scroll)$/.test(a[overflow])&&a[extent]>a[size],`${label()}: moved ancestor must support user scrolling: ${JSON.stringify({before:a,after:b,offset})}`);
  }
 }
}
async function readable(target,{scroll=true}={}){
 const locator=typeof target==='string'?page.locator(target):target;
 let state=await readableState(locator);
 if(scroll){
  const before=state;let mode='native-center',prepared=null,wheel=null;
  // Preserve a real-input regression for the original English phone failure: the
  // old nearest-scroll step could leave the reminder underneath the sticky footer.
  if(lang==='en'&&viewport.width===320&&viewport.height===480&&before.target==='fieldControlHint'&&before.fieldMechanic===2){
   await locator.scrollIntoViewIfNeeded();prepared=await readableState(locator);scrollableMovement(before,prepared);
   if(prepared.lines.some(r=>!r.uncovered&&r.hit?.footer)){
    wheel=await locator.evaluate(e=>{
     let scroller=e.parentElement;
     while(scroller&&(!/^(auto|scroll)$/.test(getComputedStyle(scroller).overflowY)||scroller.scrollHeight<=scroller.clientHeight))scroller=scroller.parentElement;
     if(!scroller)return null;
     const r=scroller.getBoundingClientRect(),t=e.getBoundingClientRect(),top=Math.max(0,r.top+scroller.clientTop),bottom=Math.min(innerHeight,r.top+scroller.clientTop+scroller.clientHeight);
     const x=Math.max(0,r.left)+Math.min(r.width,innerWidth)/2,y=top+(bottom-top)/4,hit=document.elementFromPoint(x,y);
     return {scroller:scroller.id,x,y,delta:Math.round((t.top+t.bottom)/2-(top+bottom)/2),hit:hit?.id||hit?.tagName,inside:hit===scroller||scroller.contains(hit)};
    });
    assert(wheel&&wheel.inside&&wheel.delta>0,`${label()}: a genuine scrollport must receive the uncovering wheel gesture: ${JSON.stringify(wheel)}`);
    await page.mouse.move(wheel.x,wheel.y);await page.mouse.wheel(0,wheel.delta);
    // Wheel scrolling is compositor-asynchronous. Poll using Node timers because
    // the game's virtual clock is paused; never replace a failed gesture with scrollTop.
    const deadline=Date.now()+2000;
    do{state=await readableState(locator);if(state.lines.length&&state.lines.every(r=>r.uncovered))break;await new Promise(resolve=>setTimeout(resolve,25));}while(Date.now()<deadline);
    mode='wheel';
   }
  }
  if(mode!=='wheel'){
   // Center in the existing scrollport, accounting for sticky sibling overlays
   // that scrollIntoViewIfNeeded does not consider. No styles or geometry change.
   await locator.evaluate(e=>e.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'}));
   state=await readableState(locator);
  }
  report.scrolls.push({lang,...viewport,mode,wheel,before,prepared,after:state});
  scrollableMovement(prepared||before,state);
  if(mode==='wheel')assert(state.ancestors.some((a,i)=>Math.abs(a.scrollTop-prepared.ancestors[i].scrollTop)>.5),`${label()}: real wheel input must change the user-scrollable panel offset`);
 }
 const detail=`${label()} readable ${await locator.getAttribute('id')||await locator.getAttribute('class')||'text'} ${JSON.stringify(state)}`;
 assert(state.box.width>0&&state.box.height>0,detail);
 assert(state.fontSize>=11,`minimum 11px type: ${detail}`);
 assert(state.lines.length>0,`visible text required: ${detail}`);
 for(const r of state.lines){
  assert(r.left>=Math.max(state.box.left,state.clip.left)-.5&&r.right<=Math.min(state.box.right,state.clip.right)+.5&&r.top>=Math.max(state.box.top,state.clip.top)-.5&&r.bottom<=Math.min(state.box.bottom,state.clip.bottom)+.5,`unclipped text: ${detail}`);
  assert(r.uncovered,`text covered by another layer: ${detail}`);
 }
}
async function reachable(target,{disabled=false}={}){
 const locator=typeof target==='string'?page.locator(target):target;
 await locator.scrollIntoViewIfNeeded();
 if(!disabled)await locator.click({trial:true});
 await assertFieldControlReachable(locator,`${label()} ${await locator.getAttribute('id')||await locator.getAttribute('data-field-action')||'control'}`);
 if((await locator.textContent()).trim())await readable(locator,{scroll:false});
}
async function focusNext(selector,previous){
 await page.locator(previous).focus();await page.keyboard.press('Tab');
 const state=await page.locator(selector).evaluate(e=>({active:document.activeElement===e,visible:e.matches(':focus-visible'),width:parseFloat(getComputedStyle(e).outlineWidth),style:getComputedStyle(e).outlineStyle}));
 assert(state.active&&state.visible&&state.width>=2&&state.style!=='none',`${label()} keyboard focus ${selector}: ${JSON.stringify(state)}`);
}
async function plan(chapter=1,done=[],phase='operations'){
 await page.evaluate(({chapter,done,phase})=>{
  show('chapters');document.querySelectorAll('dialog[open]').forEach(d=>d.close());
  const s=StoryPlan.fresh(chapter,400+chapter,2);s.done=done;s.phase=phase;
  localStorage.setItem('mkty_story_plan_'+chapter+'_v1',JSON.stringify(s));
  MKTYStory.menu(chapter);document.getElementById('app').scrollTop=0;
 },{chapter,done,phase});
}
async function exitBoard(){await page.locator('#opsMenu').click();await page.locator('#opsExit').click();}
async function planViews(){
 const chapters=lang==='en'&&viewport.width===320?[1,2,3,4,5,6,7,8,9]:[1,9];
 for(const chapter of chapters){
  await plan(chapter);await text('#storyNextLabel','NEXT OBJECTIVE',{suffix:' · 01 / 08'});await text('#storyNext','START STAGE →');
  await text('#storyNextHint','Other available stages are on the map and in the list below.');
  const title=await page.evaluate(n=>StoryPlan.plan(n,2).steps[0].title[1],chapter);
  await text('#storyNextTitle',title);
  assert.equal(await page.locator('#storyPlan').getAttribute('dir'),['he','ar'].includes(lang)?'rtl':'ltr');
  assert.equal(await page.locator('[data-story-step]:enabled').count(),2);
  assert.equal(await page.locator('[data-map-step][tabindex="0"]').count(),2);
  const mapLabel=await page.locator('[data-map-step="0"]').getAttribute('aria-label');
  assert.equal(mapLabel,expected('Stage ')+'1: '+expected(title)+'. '+expected('Ready to begin'));renderedKeys.add('Stage ');
  // The main next action must be above the artwork and immediately onscreen, without scrolling.
  const next=await page.locator('#storyNext').boundingBox(),map=await page.locator('#storySpatialMap').boundingBox();
  assert(next&&map&&next.y>=0&&next.y+next.height<=viewport.height&&next.y+next.height<map.y,`${label()} chapter ${chapter}: next action is immediately visible`);
  for(const s of ['#storyNextLabel','#storyNextTitle','#storyNextHint'])await readable(s);
  await reachable('#storyNext');await noOverflow();
 }
 await screenshot('chapter-plan');
 // Enter the real Chapter 1 board using keyboard, make a move, leave and resume the saved checkpoint.
 await plan(1,[0]);await focusNext('#storyNext','#storyBack');await page.keyboard.press('Enter');
 assert.equal(await page.locator('.screen.active').getAttribute('id'),'operationsDeck');
 const cell=page.locator('[data-op-cell="0"]');await cell.focus();await page.keyboard.press('Enter');
 assert.equal(await page.evaluate(()=>document.activeElement?.dataset.opCell),'0');
 const saved=await page.evaluate(()=>MKTYStory.read(1).tasks[1].checkpoint.input);
 await exitBoard();await text('#storyNext','RESUME STAGE →');await text('#storyNextLabel','NEXT OBJECTIVE',{suffix:' · 02 / 08'});
 await reachable('#storyNext');await page.locator('#storyNext').click();
 assert.deepEqual(await page.evaluate(()=>MKTYStory.read(1).tasks[1].checkpoint.input),saved);
 await exitBoard();await page.locator('#storyBack').click();assert.equal(await page.locator('.screen.active').getAttribute('id'),'chapters');
 const all=[0,1,2,3,4,5,6,7];
 for(const phase of ['operations','complete']){
  await plan(1,all,phase);await text('#storyNextLabel',phase==='complete'?'CHAPTER COMPLETE':'EIGHT STAGES COMPLETE');
  await text('#storyNextTitle','Chapter finale');await text('#storyNext',phase==='complete'?'OPEN CHAPTER FINALE':'START FINAL MISSION →');
  await text('#storyNextHint',phase==='complete'?'Results are saved. You can reopen the finale.':'Preparation complete. The final mission is available.');
  await readable('#storyNextHint');await reachable('#storyNext');
 }
 report.layouts.push({lang,...viewport,kind:'chapter-plan',chapters,states:['fresh','keyboard-entry','saved-resume','finale-ready','complete']});
}
async function routeAndRewardViews(){
 await page.evaluate(()=>{window.guidanceOriginalRewards=window.MKTYRewards;});
 try{
  for(const error of ['unavailable','storage','route_changed']){
   await plan();
   await page.evaluate(()=>{
    window.MKTYRewards={...guidanceOriginalRewards,requiresRoute:()=>true,routeReady:()=>false,pendingCompletion:()=>false,prepareRoute:()=>new Promise((_resolve,reject)=>{window.guidanceRejectRoute=reject;})};
    window.guidanceRoute=MKTYStory.open(1);
   });
   await text('#storyNext','VERIFYING ROUTE…');await text('#storyNextHint','Getting a verified route. Stages unlock after the server response is saved.');
   assert(await page.locator('#storyNext').isDisabled());await reachable('#storyNext',{disabled:true});await readable('#storyNextHint');
   assert.equal(await page.locator('[data-map-step][aria-disabled="true"]').count(),8);
   assert.equal(await page.locator('[data-map-step][tabindex="0"]').count(),0);
   const aria=await page.locator('[data-map-step="0"]').getAttribute('aria-label');
   assert(aria.endsWith('. '+expected('Route unavailable')));renderedKeys.add('Route unavailable');
   await page.evaluate(async message=>{guidanceRejectRoute(new Error(message));await guidanceRoute;},error);
   await text('#storyNext','ROUTE UNAVAILABLE');
   const key=error==='storage'?'The route or archive could not be saved. Restore device saving, then retry.':error==='route_changed'?'This route is archived on this device. Choose a new verified route to earn its reward. Confirmed achievements and balance are preserved.':'Could not get a verified route. Progress is preserved. Check your connection and retry.';
   await text('#storyNextHint',key);await readable('#storyNextHint');
   await text('#storyReplay',error==='route_changed'?'KEEP ARCHIVE AND START A NEW ROUTE':'RETRY CONNECTION');await reachable('#storyReplay');
   if(error==='route_changed'){await text('#storyArchive','DOWNLOAD SAVED ROUTE');await reachable('#storyArchive');}
   await noOverflow();await page.evaluate(()=>{window.MKTYRewards=guidanceOriginalRewards;});
  }
  await plan();
  await page.evaluate(()=>{
   window.guidancePending=true;
   window.MKTYRewards={...guidanceOriginalRewards,pendingCompletion:()=>guidancePending,syncPlayer:()=>new Promise(resolve=>{window.guidanceFinishSync=resolve;})};
   MKTYStory.menu(1);
  });
  await text('#storyReplay','RETRY REWARD SYNC');await text('#storySave','This chapter reward is awaiting sync. Retry reward sync before starting a new route. Your current route is preserved.');
  await readable('#storySave');await reachable('#storyReplay');await page.locator('#storyReplay').click();
  await text('#storyReplay','CHECKING REWARD…');assert(await page.locator('#storyReplay').isDisabled());await reachable('#storyReplay',{disabled:true});
  await page.evaluate(()=>{guidancePending=false;guidanceFinishSync();});
  await page.waitForFunction(()=>document.getElementById('storyReplay').dataset.rewardRetry==='false');
  await page.evaluate(()=>{guidancePending=null;MKTYStory.menu(1);});
  await text('#storySave','The reward queue could not be read. Restore device saving and retry. Your current route is preserved.');await readable('#storySave');
  await screenshot('route-reward-status');
 }finally{
  await page.evaluate(()=>{window.MKTYRewards=guidanceOriginalRewards;show('chapters');});
 }
 report.layouts.push({lang,...viewport,kind:'route-reward',states:['loading','connection-error','storage-error','archived','reward-pending','reward-checking','reward-storage-error']});
}
async function openBoard(n,solved=false){
 await page.evaluate(({n,solved})=>{
  const R=MissionRules,chapter=({4:4,5:1,6:2,7:7,8:8,9:9})[n],c=StoryPlan.plan(chapter,2),b=R.board(n,0,107);
  const task={...c.steps[1],chapter,board:n,round:0,seed:107,art:c.art,save:s=>{window.guidanceBoardCheckpoint=s;},complete:s=>{window.guidanceBoardResult=s;show('chapters');},exit:()=>show('chapters')};
  let saved=null;
  if(solved){
   const input=R.initial(b);
   if(n===4)input.path=b.path.slice();
   if(n===5)input.turns.fill(0);
   if(n===6)input.tiles=b.target.slice();
   if(n===7){input.history=R.solveShield(b,input);for(const i of input.history)R.toggle(input.lamps,i,b.n);}
   if(n===8)input.guess=b.secret.slice();
   if(n===9)input.order=R.solveSystems(b,input);
   if(!R.validate(b,input)||n!==8&&!R.solved(b,input))throw Error('Invalid operation presentation fixture '+n);
   saved={version:1,n,seed:107,round:0,phase:'planning',input,confirmed:false,actions:0,hints:0,errors:0,seconds:0};
  }
  window.guidanceBoardResult=null;MKTYOps.openTask(task,saved);
 },{n,solved});
}
async function boardViews(){
 const boards=viewport.width===320?[4,5,6,7,8,9]:[5,8,9];
 for(const n of boards){
  await openBoard(n);await text('#opsGuideTitle','FULL OBJECTIVE & CONTROLS');await text('#opsControlHint',boardHints[n]);
  await text('#opsInstrumentState','SOLVE → CONFIRM');await text('#opsStatus','Solve the operation, then confirm the result.');
  await text('#opsSubmit',n===8?'CHECK KEY':'CONFIRM SOLUTION');
  assert.equal(await page.locator('#opsBoard').getAttribute('aria-describedby'),'opsControlHint');
  assert.equal(await page.locator('#opsBoard').evaluate(e=>getComputedStyle(e).direction),'ltr');
  await readable('#opsControlHint');const hint=await page.locator('#opsControlHint').boundingBox(),board=await page.locator('#opsBoard').boundingBox();
  assert(hint.y+hint.height<=board.y+.5,`${label()} board ${n}: reminder precedes the board`);
  await page.locator('#opsGuideTitle').click();assert(await page.locator('#opsInstructions').isVisible());await page.locator('#opsGuideTitle').click();
  await readable('#opsInstrumentState');await readable('#opsStatus');
  for(const selector of ['#opsReset','#opsHint','#opsSubmit'])await reachable(selector);
  await focusNext('#opsHint','#opsReset');await noOverflow();
  if(n===8)await screenshot('board-'+n);
  if(![5,8].includes(n))continue;
  // A validated solved checkpoint is still unconfirmed. The real Confirm handler must render success.
  await openBoard(n,true);await page.locator('#opsSubmit').click();
  assert.equal(await page.locator('#operationsDeck').getAttribute('data-solved'),'true');
  await text('#opsInstrumentState','CONFIRMED');await text('#opsStatus','Operation complete. Checkpoint saved.');
  await text('#opsControlHint','Result confirmed. Continue using the button below the board.');await text('#opsSubmit','COMPLETE STAGE →');
  await readable('#opsControlHint');await readable('#opsStatus');await reachable('#opsSubmit');
  if(n===8)await screenshot('board-confirmed');
  await page.locator('#opsSubmit').focus();await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(()=>guidanceBoardResult?.confirmed),true);
  assert.equal(await page.locator('.screen.active').getAttribute('id'),'chapters');
 }
 report.layouts.push({lang,...viewport,kind:'boards',boards,states:['instructions','keyboard-focus','unconfirmed','confirmed','complete-stage']});
}
async function openField(n,{legacy=false,complete=false,core=false}={}){
 await page.evaluate(({n,legacy,complete,core})=>{
  const chapter=Math.min(n,9),c=StoryPlan.plan(chapter,2),title=n===10?['Расшифровка «Эха»','Echo decoding']:n===11?['Закрывающийся шлюз','The closing gate']:c.steps[0].title;
  const task={id:0,chapter,mechanic:n,fieldStage:0,seed:32,title,core,save:s=>{window.guidanceFieldCheckpoint=s;},complete:s=>{window.guidanceFieldResult=s;show('chapters');},exit:()=>show('chapters')};
  let saved=null;
  if(legacy){saved=FieldRules.create(n,0,32);saved.version=1;}
  if(complete)saved=window.guidanceCompletedField;
  window.guidanceFieldResult=null;MKTYField.open(task,saved);document.getElementById('app').scrollTop=0;
 },{n,legacy,complete,core});
 await text('#fieldResume','CONTINUE');await text('#fieldExit','CHAPTER PLAN');
 await reachable('#fieldResume');await reachable('#fieldExit');await page.locator('#fieldResume').click();
}
async function fieldViews(){
 const mechanics=viewport.width===320?[1,2,3,4,5,6,7,8,9,10,11]:[1,3,5,6];
 for(const n of mechanics){
  await openField(n);await text('#fieldControlHint',fieldHints[n]);await text('#fieldGuideTitle','OBJECTIVE & CONTROLS');
  await text('#fieldSubmit',fieldSubmitKeys[n]);await text('#fieldPause','Pause',{attribute:'aria-label'});
  assert.equal(await page.locator('#fieldWorld').getAttribute('aria-describedby'),'fieldControlHint');
  await readable('#fieldControlHint');
  const boxes=await page.evaluate(()=>{const a=document.getElementById('fieldWorld').getBoundingClientRect(),b=document.getElementById('fieldControlHint').getBoundingClientRect();return {overlap:Math.min(a.right,b.right)>Math.max(a.left,b.left)&&Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top)};});
  assert(!boxes.overlap,`${label()} field ${n}: reminder must not cover the scene`);
  await page.locator('#fieldGuideTitle').click();assert(await page.locator('#fieldBrief').isVisible());await page.locator('#fieldGuideTitle').click();
  const controls=page.locator('#fieldControls button,#fieldControls input');
  for(let i=0;i<await controls.count();i++)await reachable(controls.nth(i));
  if(n===3||n===8){
   const key=n===3?'ANGLE':'BEARING';await text('[data-field-slider="angle"]',key,{attribute:'aria-label'});
   const slider=page.locator('[data-field-slider="angle"]'),before=Number(await slider.inputValue());
   await slider.focus();await page.keyboard.press('ArrowRight');assert.equal(Number(await slider.inputValue()),before+1,`${label()}: slider ArrowRight remains physical right in RTL`);
  }
  if(n===6){
   for(const [direction,key] of [['up','Up'],['left','Left'],['down','Down'],['right','Right']]){
    await text(`[data-field-steer="${direction}"]`,key,{attribute:'aria-label'});
    assert.equal(await page.getByRole('button',{name:expected(key),exact:true}).count(),1);
   }
   assert.equal(await page.locator('.field-steering').evaluate(e=>getComputedStyle(e).direction),'ltr');
   const left=await page.locator('[data-field-steer="left"]').boundingBox(),right=await page.locator('[data-field-steer="right"]').boundingBox();assert(left.x<right.x,'physical steering order remains LTR');
   await focusNext('[data-field-steer="up"]','#fieldGuideTitle');
   const before=await page.evaluate(()=>MKTYField.snapshot().ship.x);
   await page.keyboard.down('ArrowRight');await page.clock.runFor(160);await page.keyboard.up('ArrowRight');
   assert((await page.evaluate(()=>MKTYField.snapshot().ship.x))>before,`${label()}: ArrowRight moves the actual vessel`);
   const speed=await page.evaluate(()=>Math.hypot(MKTYField.snapshot().ship.vx,MKTYField.snapshot().ship.vy));
   await page.keyboard.press('Space');assert((await page.evaluate(()=>Math.hypot(MKTYField.snapshot().ship.vx,MKTYField.snapshot().ship.vy)))<speed,`${label()}: Space brakes`);
  }
  await reachable('#fieldSubmit',{disabled:await page.locator('#fieldSubmit').isDisabled()});await noOverflow();
  await readable('#fieldControlHint');if([5,6].includes(n))await screenshot('field-'+n);
  await page.locator('#fieldPause').click();await page.locator('#fieldExit').click();
 }
 // Legacy thermal checkpoints use a different reminder and remain localized.
 await openField(5,{legacy:true});await text('#fieldControlHint','Balance every loop with the valves → confirm the load.');await readable('#fieldControlHint');
 await page.locator('#fieldPause').click();await page.locator('#fieldExit').click();
 // Complete a real trajectory through sliders and Confirm, including the final saved-result CTA.
 await openField(3);
 for(let burn=0;burn<3;burn++){
  const target=await page.evaluate(()=>FieldRules.layout(MKTYField.snapshot()).target);
  for(const key of ['angle','power','trim'])await page.locator(`[data-field-slider="${key}"]`).fill(String(target[key]));
  await page.locator('#fieldSubmit').click();assert.equal(await page.evaluate(()=>MKTYField.snapshot().burn),burn+1);
 }
 assert.equal(await page.locator('#fieldMission').getAttribute('data-complete'),'true');
 await text('#fieldControlHint','Objective complete. Record your result using the button below.');
 await text('#fieldNotice','Objective complete. Record this result in the chapter plan.');await text('#fieldSubmit','COMPLETE STAGE →');
 await readable('#fieldControlHint');await readable('#fieldNotice');await reachable('#fieldSubmit');await screenshot('field-confirmed');
 await page.evaluate(()=>{window.guidanceCompletedField=MKTYField.snapshot();});
 await page.locator('#fieldSubmit').focus();await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>guidanceFieldResult?.complete),true);
 await openField(3,{complete:true,core:true});await text('#fieldSubmit','CONTINUE OPERATION →');await reachable('#fieldSubmit');await page.locator('#fieldSubmit').click();
 report.layouts.push({lang,...viewport,kind:'fields',mechanics,states:['short-guidance','expanded-rules','controls','keyboard-labels','legacy-thermal','confirmed','stage-and-core-CTA']});
}
(async()=>{
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
 for(const [code,name] of languages){
  lang=code;viewport=viewports[0];renderedKeys=new Set();const packRequests=[];
  context=await browser.newContext({viewport,hasTouch:true,reducedMotion:'reduce',serviceWorkers:'block'});page=await context.newPage();page.setDefaultTimeout(10000);
  page.on('pageerror',error=>report.errors.push({lang:code,message:error.message}));
  page.on('response',response=>{if(response.url().startsWith(origin+'/')&&response.status()>=400)report.badLocalResponses.push({lang:code,url:response.url(),status:response.status()});});
  // Deny every off-origin request, including fonts, Telegram SDK and reward services.
  // Empty local fixtures ensure no third-party request is sent or guest credentials supplied.
  await context.route('**/*',route=>{
   const url=route.request().url();
   if(!url.startsWith(origin+'/')){report.blockedExternalRequests.push({lang:code,url});return route.fulfill({status:200,contentType:route.request().resourceType()==='stylesheet'?'text/css':'application/javascript',body:''});}
   if(/\/locales\/runtime\//.test(url))packRequests.push(url);
   if(/\.mp4(?:\?|$)/.test(url))return route.fulfill({status:204,body:''});
   return route.continue();
  });
  await page.addInitScript(()=>{
   // Calendar pacing and authentication are not localization prerequisites.
   localStorage.setItem('mkty_test_no_pacing','yes');
   localStorage.setItem('mkty_life1_code_presented','yes');localStorage.setItem('mkty_life3_memory_verified','yes');
   localStorage.setItem('mkty_legacy_v1',JSON.stringify({version:1,lead:'scout',airlock:'crew',events:{1:'scan',3:'shield',4:'north',5:'vent',6:'clear',7:'rescue',9:'wait'}}));
  });
  await page.clock.install({time:new Date('2026-10-09T11:59:00Z')});await page.clock.pauseAt(new Date('2026-10-09T12:00:00Z'));
  await page.goto(origin);await page.waitForFunction(()=>window.MKTYLocaleLoader&&window.MKTYI18n&&window.MKTYStory&&window.MKTYOps&&window.MKTYField);
  assert.equal(await page.evaluate(()=>localStorage.getItem('mkty_lang')),null,'fresh guest starts at actual language picker');
  assert.equal(await page.evaluate(c=>Boolean(window.MKTYLocales?.[c]),code),false,'selected runtime pack must not already be loaded');
  await page.locator('#languages button').filter({hasText:name}).click();
  await page.waitForFunction(c=>MKTYI18n.getLanguage()===c&&(c==='en'||MKTYI18n.hasLocale(c)),code);
  assert.equal(await page.locator('html').getAttribute('lang'),code);
  assert.equal(await page.locator('html').getAttribute('dir'),['he','ar'].includes(code)?'rtl':'ltr');
  assert.equal(await page.evaluate(()=>window.Telegram?.WebApp?.initData||''),'','isolated guest cannot authenticate');
  strings=await page.evaluate(c=>window.MKTYLocales?.[c]?.strings||{},code);
  assert.deepEqual([...new Set(packRequests.map(url=>new URL(url).pathname))],code==='en'?[]:[`/locales/runtime/${code}.js`],'real loader fetches only the selected locale');
  for(const key of requiredKeys){
   const value=expected(key);assert(!/[\uFFFD⟦⟧]/u.test(value),`${code}: damaged translation ${key}`);
   // Branding and physical control tokens may occur inside translated sentences, but no
   // required sentence/label is a brand-only token or may be copied wholesale from English.
   if(code!=='en')assert.notEqual(normalized(value),normalized(key),`${code}: English fallback for ${JSON.stringify(key)}`);
   assert.equal(await page.evaluate(key=>MKTYI18n.t(key),key),value,`${code}: loaded i18n returns the runtime-pack value`);
  }
  for(viewport of viewports){
   await page.setViewportSize(viewport);
   await planViews();await routeAndRewardViews();await boardViews();await fieldViews();
  }
  assert.deepEqual(requiredKeys.filter(key=>!renderedKeys.has(key)),[],`${code}: required strings must reach their real production DOM paths`);
  // Parser-time reload must also choose the saved locale without reverting to English.
  await page.reload();await page.waitForFunction(c=>window.MKTYStory&&MKTYI18n.getLanguage()===c,code);await plan();
  await text('#storyNext','START STAGE →');await text('#storyNextHint','Other available stages are on the map and in the list below.');
  report.languages.push({code,requiredKeys:requiredKeys.length,renderedKeys:renderedKeys.size,packRequests,initialPicker:true,persistedReload:true});
  fs.writeFileSync(path.join(out,'guidance-locales.json'),JSON.stringify(report,null,2));
  await context.close();context=null;page=null;
  console.log(`PASS ${code}: 50 runtime translations, real guidance/status/keyboard views at both compact sizes`);
 }
 assert(report.scrolls.some(s=>s.mode==='wheel'&&s.lang==='en'&&s.width===320&&s.after.fieldMechanic===2),'original compact English footer occlusion must be resolved by genuine wheel input');
 assert.deepEqual(report.errors,[],'no browser page errors');assert.deepEqual(report.badLocalResponses,[],'no failed local app/locale/assets');
 console.log('PASS: all 13 languages, real lazy and saved locale loading, all 50 guidance strings, 6 boards, 11 fields, RTL, keyboard and unclipped compact controls');
})().catch(async error=>{
 report.failure={lang,viewport,message:error.stack};console.error(error);process.exitCode=1;
 await page?.screenshot({path:path.join(out,'guidance-locales-failure.png'),fullPage:true}).catch(()=>{});
}).finally(async()=>{
 fs.writeFileSync(path.join(out,'guidance-locales.json'),JSON.stringify(report,null,2));
 await context?.close();await browser?.close();
 if(server.listening)await new Promise(resolve=>server.close(resolve));
});
