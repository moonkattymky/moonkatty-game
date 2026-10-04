/* Versioned checkpoints for the already-playable chapters beyond the flight deck.
   Keep chapter 8–9 puzzle inputs and damage; completion never awards twice. */
window.MKTYContinuation=(()=>{
 const finite=(v,min,max)=>Number.isFinite(v)&&v>=min&&v<=max;
 const integer=(v,min,max)=>Number.isInteger(v)&&finite(v,min,max);
 const sequence=(v,length,max)=>Array.isArray(v)&&v.length===length&&v.every(n=>integer(n,0,max));
 const prefix=(input,pattern)=>Array.isArray(input)&&input.length<pattern.length&&input.every((n,i)=>n===pattern[i]);
 const enable=(selector,enabled)=>document.querySelectorAll(selector).forEach(b=>b.disabled=!enabled);
 function save(n){
  if(n===8)return {version:1,stage:$('mission8').dataset.stage,frequency:Number($('freq8').value),phase:Number($('phase8').value),targetFrequency:targetFreq8,targetPhase:targetPhase8,round:pulseRound8,pattern:pulse8.slice(),input:pulseInput8.slice(),ready:pulseReady8};
  if(n===9){
   if(coreHealth9<=20||finalPower9<=0)return null;
   return {version:1,stage:$('mission9').dataset.stage,target:navTarget9,dial:Number($('navDial9').value),latitude:$('coordLat9').value,longitude:$('coordLon9').value,round:syncRound9,health:coreHealth9,power:finalPower9,sync:syncSeq9.slice(),syncInput:syncInput9.slice(),syncReady:syncReady9,final:finalSeq9.slice(),finalInput:finalInput9.slice(),finalReady:finalReady9};
  }
  return null;
 }
 function review(n){
  clearMissionDelays(n);
  if(n===8){clearInterval(phaseTimer8);phaseTimer8=null;pulseReady8=false;setSignalStage8('complete');$('link8').textContent='100';$('coordinates8').hidden=false;$('coordinatesValue8').textContent='LUNA // '+(localStorage.getItem('mkty_life9_coordinates')||'—').replace(',',' // ');$('signalPulse').classList.add('decoded');$('signalStatus8').textContent='Signal decoded. Final coordinates received ✓';}
  if(n===9){clearInterval(finalTimer9);finalTimer9=null;syncReady9=finalReady9=false;setFinalStage9('complete');['nav9','sync9','transmit9'].forEach(id=>$(id).hidden=true);['phase9a','phase9b','phase9c'].forEach(id=>$(id).className='done');$('finalGate').classList.add('open');$('finalShip').classList.add('returned');$('finalStatus9').textContent='RETURN TRANSMISSION ACCEPTED ✓';}
  $('life'+n+'Complete').hidden=false;
 }
 function restore(n,v){
  if(n===8){
   if(!['frequency','phase','pulse'].includes(v.stage)||!finite(v.frequency,0,100)||!finite(v.phase,0,100)||!integer(v.targetFrequency,25,75)||!integer(v.targetPhase,25,75)||!integer(v.round,1,3))return false;
   targetFreq8=v.targetFrequency;targetPhase8=v.targetPhase;pulseRound8=v.round;$('freq8').value=v.frequency;$('phase8').value=v.phase;document.querySelector('.phase-scope8').style.setProperty('--phase-target',targetPhase8+'%');updateFreq8();updatePhase8();setSignalStage8(v.stage);
   $('link8').textContent=v.stage==='frequency'?'0':v.stage==='phase'?'30':String(60+(v.round-1)*10);
   if(v.stage==='phase')$('signalStatus8').textContent='Carrier acquired. Stabilize phase.';
   if(v.stage==='pulse'){
    $('signalStatus8').textContent='Phase synchronized. Decode the transmission.';
    if(sequence(v.pattern,3+v.round,2)&&prefix(v.input,v.pattern)){
     pulse8=v.pattern.slice();pulseInput8=v.input.slice();$('pulseRound8').textContent=pulseRound8;
     if(v.ready===true){pulseReady8=true;paintLaunchSlots3('pulseDisplay8',pulseInput8.map(n=>['◯','△','◇'][n]),pulse8.length);enable('[data-pulse8]',true);$('replayPulse8').disabled=false;$('pulseHint8').textContent='Decoded: '+pulseInput8.length+' / '+pulse8.length;}
     else showPulse8();
    }else newPulseRound8();
   }
   return true;
  }
  if(n===9){
   if(!['coordinates','corridor','sync','transmit'].includes(v.stage)||!integer(v.target,35,65)||!finite(v.dial,0,100)||!integer(v.round,1,3)||!finite(v.health,21,100)||!finite(v.power,.01,100)||typeof v.latitude!=='string'||v.latitude.length>30||typeof v.longitude!=='string'||v.longitude.length>30)return false;
   navTarget9=v.target;syncRound9=v.round;coreHealth9=v.health;finalPower9=v.power;$('coordLat9').value=v.latitude;$('coordLon9').value=v.longitude;$('navDial9').value=v.dial;document.querySelector('.corridor-meter9').style.setProperty('--corridor-target',navTarget9+'%');$('corridorNeedle9').style.left=v.dial+'%';$('coreHealthFill9').style.width=coreHealth9+'%';$('core9').textContent=Math.round(coreHealth9);setFinalStage9(v.stage);
   if(v.stage==='corridor'){$('corridor9').hidden=false;$('finalStatus9').textContent='Coordinates verified ✓ Stabilize the return corridor.';}
   if(v.stage==='sync'){
    $('nav9').hidden=true;$('sync9').hidden=false;$('phase9a').className='done';$('phase9b').className='active';$('finalStatus9').textContent='Phase II — damaged core synchronization.';
    if(v.syncReady===true&&sequence(v.sync,3+v.round,2)&&prefix(v.syncInput,v.sync)){
     syncSeq9=v.sync.slice();syncInput9=v.syncInput.slice();syncReady9=true;$('syncRound9').textContent=syncRound9;paintLaunchSlots3('syncSequence9',syncInput9.map(n=>['A','B','C'][n]),syncSeq9.length);enable('[data-sync9]',true);$('replaySync9').disabled=false;$('syncHint9').textContent='Synchronized '+syncInput9.length+' / '+syncSeq9.length;
    }else showSync9();
   }
   if(v.stage==='transmit'){
    $('nav9').hidden=true;$('phase9a').className='done';startFinalTransmit9();finalPower9=v.power;$('finalPowerFill9').style.width=finalPower9+'%';$('core9').textContent=Math.round(finalPower9);
    if(v.finalReady===true&&sequence(v.final,6,3)&&prefix(v.finalInput,v.final)){
     clearMissionDelays(9);finalSeq9=v.final.slice();finalInput9=v.finalInput.slice();finalReady9=true;paintLaunchSlots3('finalCode9',finalInput9.map(n=>['▲','●','◆','■'][n]),6);enable('[data-final9]',true);$('replayFinal9').disabled=false;
    }
   }
   return true;
  }
  return false;
 }
 return {save,restore,review};
})();
