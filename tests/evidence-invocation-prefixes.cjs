'use strict';
// Independent SOURCE-ONLY storage evidence. No invocation-journal status is used
// to infer the native write order, exact prefix image, or number of compatible cuts.
const assert = require('node:assert/strict');
const H = require('./evidence-invocation-original-helper.cjs');
let checks = 0;
const eq = (a,b,message) => {assert.deepStrictEqual(a,b,message);checks++;};
const ok = (value,message) => {assert(value,message);checks++;};
const key = n => 'mkty_field_finale_' + n + '_v1';
const story = n => 'mkty_story_plan_' + n + '_v1';
const expected = n => n === 8 ? [
 'set:'+story(n),'set:mkty_life9_coordinates','set:mkty_spatial_report_8','remove:'+key(n),
 'set:mkty_life8_completed_at','set:'+H.opKey(n),'set:'+story(n),'set:mkty_points',
 'set:mkty_life8_awarded','set:mkty_life8','set:mkty_life8','set:mkty_current_chapter'
] : [
 'set:'+story(n),'set:mkty_spatial_report_9','remove:'+key(n),'set:mkty_life9_completed_at',
 'set:'+H.opKey(n),'set:'+story(n),'set:mkty_points','set:mkty_life9_awarded',
 'set:mkty_life9','set:mkty_life9','set:mkty_final_moon_points','set:mkty_points_locked_at'
];
const evidence=[];
eq(H.verifySources(),12);
for(const chapter of [8,9])for(const operations of ['prepared','absent']) {
 let normal=H.originalFinalVM({chapter,operations});normal.ready();normal.clear();
 const before=normal.image();normal.invoke();
 const writes=normal.logical.map(row=>({...row})),after=normal.image(),overlay=normal.snapshot();
 const images=H.prefixImages(before,writes);
 const order=expected(chapter).filter(entry=>operations==='prepared'||entry!=='set:'+H.opKey(chapter));
 eq(writes.map(row=>row.op+':'+row.key),order,'literal original final-dispatch sequence');
 eq(writes.length,operations==='prepared'?12:11);
 eq(normal.native,writes,'successful logical writes exactly reach native storage');
 eq(after.mkty_points,chapter===8?'2100':'5100');
 eq(after['mkty_life'+chapter+'_awarded'],'yes');
 eq(JSON.parse(after[story(chapter)]).phase,'complete');
 eq(after[key(chapter)],undefined);
 eq(normal.counts(),{callbacks:1,awards:1,opens:1});
 if(operations==='prepared')eq(after[H.opKey(chapter)],H.opText(chapter,'complete'));else eq(after[H.opKey(chapter)],undefined);
 // Equal-image/no-op boundaries are externally labelled ambiguity, never an executed cursor.
 const duplicate=chapter===8?(operations==='prepared'?[10,11,12]:[9,10,11]):(operations==='prepared'?[9,10]:[8,9]);
 eq(H.compatibleCuts(images,images[duplicate[0]]),duplicate);
 normal.discard();normal=null;
 for(let cut=0;cut<=writes.length;cut++) {
  let failed=H.originalFinalVM({chapter,operations});failed.ready();failed.clear();
  if(cut<writes.length)failed.cut(cut);
  failed.invoke();
  eq(failed.logical,writes,'native failure is swallowed; original callback finishes in RAM');
  eq(failed.counts(),{callbacks:1,awards:1,opens:1});
  eq(failed.persistent(),cut===writes.length);
  eq(failed.snapshot(),overlay,'logical RAM target matches successful original handler');
  const persisted=failed.image();
  eq(persisted,images[cut],'native failure image equals independently applied successful-write prefix');
  eq(failed.native.length,cut===writes.length?writes.length:cut+1);
  const compatible=H.compatibleCuts(images,persisted);ok(compatible.includes(cut));
  if(cut===0)eq(persisted,before,'exact pre-state also follows a full callback that ran in RAM');
  const remove=writes.findIndex(row=>row.op==='remove');
  const points=writes.findIndex(row=>row.key==='mkty_points');
  if(cut===remove+1){eq(persisted[key(chapter)],undefined);eq(persisted.mkty_points,before.mkty_points);eq(persisted['mkty_life'+chapter+'_awarded'],undefined);}
  if(cut===points+1){eq(persisted.mkty_points,after.mkty_points);eq(persisted['mkty_life'+chapter+'_awarded'],undefined);}
  // The new realm receives ONLY persisted bytes. No old facade, task or overlay is passed.
  failed.discard();failed=null;
  const reboot=H.originalFinalVM({chapter,operations,diskImage:persisted});
  eq(reboot.counts(),{callbacks:0,awards:0,opens:0});eq(reboot.logical,[]);eq(reboot.native,[]);
  eq(reboot.snapshot(),persisted,'reload has no original RAM overlay');eq(reboot.image(),persisted);
  evidence.push({chapter,operations,cut,compatibleCuts:compatible,provenance:cut===writes.length?'successful native end':'native failure; original returned with volatile overlay'});
 }
 // Synthetic interrupted-execution images have provenance distinct from native failures.
 for(const [cut,image] of images.entries()) {
  const reboot=H.originalFinalVM({chapter,operations,diskImage:image});
  eq(reboot.image(),image);eq(reboot.logical,[]);eq(reboot.counts().callbacks,0);
  ok(H.compatibleCuts(images,image).includes(cut));
 }
}
// A failed flush can preserve a later value for the same key and is not necessarily
// any original callback prefix. Do not invent a suffix-repair cursor from this image.
{
 const normal=H.originalFinalVM();normal.ready();normal.clear();const before=normal.image();normal.invoke();
 const images=H.prefixImages(before,normal.logical);
 const failed=H.originalFinalVM();failed.ready();failed.clear();failed.cut(0);failed.invoke();
 failed.clear();failed.cut(3);eq(failed.retry(),false);
 eq(JSON.parse(failed.image().mkty_story_plan_8_v1).phase,'complete');
 eq(H.compatibleCuts(images,failed.image()),[],'midflush image skips accumulated-story persistence');
 eq(failed.counts().callbacks,1);eq(failed.image().mkty_points,'100');
}
eq(H.verifySources(),12);
console.log(JSON.stringify({status:'passed',suite:'independent original final prefixes',checks,
 preparedNativeFailures:evidence.filter(x=>x.operations==='prepared'&&x.cut<12).length,
 absentNativeFailures:evidence.filter(x=>x.operations==='absent'&&x.cut<11).length,
 successfulEnds:4,syntheticRestoredPrefixImages:50,
 limits:'SOURCE-ONLY; Map native storage; synthetic preparations and prior progress; no account, browser, server or real crash',evidence}));
