'use strict';
// Test-only, fail-closed source observation seams. Never written into app.js,
// experience.js, campaign.js or index.html. Original statements keep their order.
function replace(source,needle,addition,count=1){
  const hits=source.split(needle).length-1;if(hits!==count)throw Error('Source seam changed: '+needle.slice(0,70)+' ('+hits+')');
  return source.split(needle).join(addition);
}
const call=(op,time='performance.now()',args='')=>`window.__C1Capture?.observe('${op}',${time}${args?','+args:''});`;
function instrument(source,file){
  if(file==='app.js'){
    source=replace(source,'function life1MoveLoop(now){','function life1MoveLoop(now){'+call('frame','now','l1MoveX,l1MoveY'));
    source=replace(source,'if(pointerId!=null&&l1PointerId!=null&&pointerId!==l1PointerId)return;','if(pointerId!=null&&l1PointerId!=null&&pointerId!==l1PointerId)return;'+call('stop'));
    source=replace(source,'missionClockResumedAt=performance.now();','missionClockResumedAt=performance.now();'+call('hidden','missionClockResumedAt','document.hidden'));
    source=replace(source,'last=now;\n  if(!$(\'mission\'+n)',"last=now;if(n===1){"+call('delay','now')+"}\n  if(!$('mission'+n)");
    source=replace(source,"const n=Number(id.replace('mission',''));clearMissionDelays(n);","const n=Number(id.replace('mission',''));if(n===1){"+call('leave')+"}clearMissionDelays(n);");
    source=replace(source,'ensureLife1WalkablePosition();\n}\nnew ResizeObserver','ensureLife1WalkablePosition();window.__C1Capture?.geometry();\n}\nnew ResizeObserver');
    source=replace(source,"window.MKTYExperience?.signal('collect',btn);btn.disabled=true;",call('collect','performance.now()','btn.dataset.energy')+"window.MKTYExperience?.signal('collect',btn);btn.disabled=true;");
    for(const panel of ['repair','antenna']){
      const statement=`$('${panel}Panel').hidden=false;`;
      source=replace(source,statement,statement+call('open','performance.now()',`'${panel}'`),3);
    }
    source=replace(source,'if(repairShowing)return;repairShowing=true;','if(repairShowing)return;'+call('show')+'repairShowing=true;');
    source=replace(source,'const n=Number(btn.dataset.cell),expected=repairSequence[repairInput.length];',call('cell','performance.now()','Number(btn.dataset.cell)')+'const n=Number(btn.dataset.cell),expected=repairSequence[repairInput.length];');
    source=replace(source,"$('frequencyDial').oninput=()=>{updateSignalStrength();","$('frequencyDial').oninput=()=>{"+call('dial','performance.now()',"Number($('frequencyDial').value)")+'updateSignalStrength();');
    source=replace(source," signalHoldProgress=0;$('signalHoldFill').style.width='0%';"," "+call('tune')+"signalHoldProgress=0;$('signalHoldFill').style.width='0%';");
    source=replace(source,'signalHoldTimer=setInterval(()=>{if(document.hidden','signalHoldTimer=setInterval(()=>{'+call('hold')+'if(document.hidden');
    source=replace(source,"$('l1Points').textContent=(Number(localStorage.getItem('mkty_points')||0))+' ⭐';\n}","$('l1Points').textContent=(Number(localStorage.getItem('mkty_points')||0))+' ⭐';window.__C1Capture?.resetFinished();\n}");
  }else if(file==='experience.js'){
    source=replace(source,'  paused=true;MKTYCampaign.save();','  '+call('pause','performance.now()','true')+'paused=true;MKTYCampaign.save();');
    source=replace(source,'function resume(){if(guide.open)','function resume(){'+call('pause','performance.now()','false')+'if(guide.open)');
    source=replace(source,"close.onclick=()=>{if(id==='repairPanel')","close.onclick=()=>{"+call('close','performance.now()',"id==='repairPanel'?'repair':'antenna'")+"if(id==='repairPanel')");
  }else if(file==='campaign.js'){
    source=replace(source,'try{localStorage.setItem(key(current),JSON.stringify(v));}','try{localStorage.setItem(key(current),JSON.stringify(v));if(current===1)window.__C1Capture?.save();}');
  }else throw Error('Unsupported instrumented file '+file);
  return source;
}
module.exports={instrument};
