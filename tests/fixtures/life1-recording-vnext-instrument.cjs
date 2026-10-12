'use strict';
// In-memory fixture transformation only. Exact anchors and compilation fail
// closed; no original controller/CSS file is edited or loaded by the shipped app.
const vm=require('node:vm');
function replace(source,needle,value,count=1){if(source.split(needle).length-1!==count)throw Error('vNext source seam: '+needle.slice(0,90));return source.split(needle).join(value);}
const step=code=>`window.__C1VNext?.step(${code});`;
// Selected callbacks below contain ordinary quoted strings and comments. This
// bounded brace scanner is not a general JS parser; final vm compilation checks
// the transformed source, and frozen anchor counts guard its exact source scope.
function closing(source,start){let depth=0,quote=null,line=false,block=false;for(let i=start;i<source.length;i++){
 const c=source[i],n=source[i+1];if(line){if(c==='\n')line=false;continue;}if(block){if(c==='*'&&n==='/'){block=false;i++;}continue;}
 if(quote){if(c==='\\'){i++;continue;}if(c===quote)quote=null;continue;}
 if(c==='/'&&n==='/'){line=true;i++;continue;}if(c==='/'&&n==='*'){block=true;i++;continue;}
 if(c==='\''||c==='"'||c==='`'){quote=c;continue;}if(c==='{')depth++;if(c==='}'&&--depth===0)return i;
 }throw Error('Unclosed source callback');}
function arrow(source,needle,kind,count=1){
 const starts=[];for(let at=source.indexOf(needle);at>=0;at=source.indexOf(needle,at+needle.length))starts.push(at);
 if(starts.length!==count)throw Error('vNext callback seam: '+needle);
 for(const at of starts.reverse()){
  const brace=at+needle.lastIndexOf('{'),end=closing(source,brace),arrowAt=at+needle.lastIndexOf('=>');
  let begin=arrowAt-1;if(source[begin]!==')')throw Error('Expected bounded callback parameter list');let depth=1;while(depth){begin--;if(source[begin]===')')depth++;if(source[begin]==='(')depth--;}
  source=source.slice(0,begin)+`window.__C1VNext.wrap('${kind}',`+source.slice(begin,end+1)+')'+source.slice(end+1);
 }return source;
}
function instrument(source,file){
 if(file==='app.js'){
  source=replace(source,'l1MoveY=dy/len*strength;','l1MoveY=dy/len*strength;'+step("['input',l1MoveX,l1MoveY]"));
  source=replace(source,'function life1MoveLoop(now){','function life1MoveLoop(now){'+step("['frame',now,l1MoveX,l1MoveY]"));
  source=replace(source,'l1NearbyAt=now;','l1NearbyAt=now;'+step("['nearby-at',now]"));
  source=replace(source,'if(pointerId!=null&&l1PointerId!=null&&pointerId!==l1PointerId)return;','if(pointerId!=null&&l1PointerId!=null&&pointerId!==l1PointerId)return;'+step("['stop']"));
  source=replace(source,"const w=$('life1World').getBoundingClientRect(),a=l1Player.getBoundingClientRect(),b=el.getBoundingClientRect();","const w=$('life1World').getBoundingClientRect(),a=l1Player.getBoundingClientRect(),b=el.getBoundingClientRect();window.__C1VNext?.live(w);");
  source=replace(source,"const world=$('life1World').getBoundingClientRect(),player=l1Player.getBoundingClientRect();","const world=$('life1World').getBoundingClientRect(),player=l1Player.getBoundingClientRect();window.__C1VNext?.live(world);"+step("['nearby']"));
  source=replace(source," document.querySelectorAll('#life1World .l1-hotspot').forEach", " window.__C1VNext?.live(world);"+step("['cache',world.width,world.height,world.left,world.top]")+"document.querySelectorAll('#life1World .l1-hotspot').forEach");
  source=replace(source,"window.MKTYExperience?.signal('collect',btn);btn.disabled=true;",step("['collect',btn.dataset.energy]")+"window.MKTYExperience?.signal('collect',btn);btn.disabled=true;");
  for(const panel of ['repair','antenna'])source=replace(source,`$('${panel}Panel').hidden=false;`,`$('${panel}Panel').hidden=false;`+step(`['open','${panel}']`),3);
  source=replace(source,'if(repairShowing)return;repairShowing=true;','if(repairShowing)return;'+step("['show']")+'repairShowing=true;');
  source=replace(source,' const step=()=>{',' const step=()=>{'+step("['cue']"));
  source=replace(source,'function newRepairSequence(){','function newRepairSequence(){'+step("['sequence']"));
  source=replace(source,'const n=Number(btn.dataset.cell),expected=repairSequence[repairInput.length];',step("['cell',Number(btn.dataset.cell)]")+'const n=Number(btn.dataset.cell),expected=repairSequence[repairInput.length];');
  source=replace(source,"$('frequencyDial').oninput=()=>{updateSignalStrength();","$('frequencyDial').oninput=()=>{"+step("['dial',Number($('frequencyDial').value)]")+'updateSignalStrength();');
  source=replace(source," signalHoldProgress=0;$('signalHoldFill').style.width='0%';"," "+step("['tune']")+"signalHoldProgress=0;$('signalHoldFill').style.width='0%';");
  source=replace(source,'signalHoldTimer=setInterval(()=>{if(document.hidden','signalHoldTimer=setInterval(()=>{'+step("['hold',Number($('frequencyDial').value)]")+'if(document.hidden');
  source=replace(source,'function finishLife1Signal(){','function finishLife1Signal(){'+step("['finish']"));
  source=replace(source,"laterInMission(1,()=>{$('life1Complete').hidden=false;","laterInMission(1,()=>{"+step("['card']")+"$('life1Complete').hidden=false;");
  source=replace(source,'last=now;\n  if(!$(\'mission\'+n)',"last=now;if(n===1){"+step("['timer-tick',handle,now]")+"}\n  if(!$('mission'+n)");
  source=replace(source,' },50);return handle;',' },50);if(n===1){'+step("['timer-start',handle,repairShowing?'repair':'complete',delay,last]")+'}return handle;');
  source=replace(source,'function clearMissionDelays(n){','function clearMissionDelays(n){if(n===1){'+step("['timer-cancel',[...(missionDelays.get(n)||[])]]")+'}');
  source=replace(source,"const n=Number(id.replace('mission',''));clearMissionDelays(n);","const n=Number(id.replace('mission',''));if(n===1){"+step("['leave']")+'}clearMissionDelays(n);');
  source=replace(source,"if(id==='mission1'){refreshLife1Geometry();","if(id==='mission1'){"+step("['screen-enter']")+'refreshLife1Geometry();');
  source=replace(source,'missionClockResumedAt=performance.now();','missionClockResumedAt=performance.now();'+step("['hidden',document.hidden,missionClockResumedAt]"));
  const names={life1Scan:'scan',setLife1Stick:'stick',refreshLife1Geometry:'refresh',life1MoveLoop:'frame',stopLife1Stick:'stop',updateLife1Nearby:'nearby',collectLife1Energy:'collect',showRepairSequence:'show',newRepairSequence:'sequence',finishLife1Signal:'signal-finish',leaveMission:'leave',show:'screen',resetLife1Mission:'reset'};
  source=replace(source,'new ResizeObserver(refreshLife1Geometry)',Object.entries(names).map(([name,kind])=>`${name}=window.__C1VNext.wrap('${kind}',${name});`).join('\n')+'\nnew ResizeObserver(refreshLife1Geometry)');
  for(const [needle,kind,count] of [
   ['const handle=setInterval(()=>{','delay',1],['signalHoldTimer=setInterval(()=>{','hold',1],
   ["l1Action?.addEventListener('click',()=>{",'action',1],
   ["$('life1World')?.addEventListener('pointerup',(ev)=>{",'pointerup',2],
   ["$('repairTerminal').onclick=()=>{",'open',1],["$('antennaHotspot').onclick=()=>{",'open',1],
   ["document.querySelectorAll('.repair-cells button').forEach(btn=>btn.onclick=()=>{",'cell',1],
   ["$('frequencyDial').oninput=()=>{",'dial',1],["$('tuneBtn').onclick=()=>{",'tune',1],
   ["document.addEventListener('visibilitychange',()=>{missionClockResumedAt=",'visibility',1]])source=arrow(source,needle,kind,count);
 }else if(file==='experience.js'){
  source=replace(source,'  paused=true;MKTYCampaign.save();','  '+step("['pause',true]")+'paused=true;MKTYCampaign.save();');
  source=replace(source,'function resume(){if(guide.open)','function resume(){'+step("['pause',false]")+'if(guide.open)');
  source=replace(source," $('guideResume').onclick=resume;"," openGuide=window.__C1VNext.wrap('pause',openGuide);resume=window.__C1VNext.wrap('resume',resume);\n $('guideResume').onclick=resume;");
  source=replace(source,"close.onclick=()=>{if(id==='repairPanel')","close.onclick=()=>{"+step("['close',id==='repairPanel'?'repair':'antenna']")+"if(id==='repairPanel')");
  source=arrow(source,'close.onclick=()=>{','close');
 }else if(file==='campaign.js')source=replace(source,'try{localStorage.setItem(key(current),JSON.stringify(v));}','try{localStorage.setItem(key(current),JSON.stringify(v));if(current===1)window.__C1VNext?.save();}');
 else throw Error('Unsupported vNext source '+file);
 new vm.Script(source,{filename:'vnext-'+file});return source;
}
module.exports={instrument};
