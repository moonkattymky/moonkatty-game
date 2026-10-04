/* New spatial finales are opt-in with the new chapter route. Legacy saves keep their original finale. */
window.MKTYSpatialFinale=(()=>{
 const original={8:openMission8,9:openMission9},key=n=>'mkty_field_finale_'+n+'_v1';
 const tr=(ru,en)=>localStorage.getItem('mkty_lang')==='ru'?ru:en;
 const sequences={8:[{mechanic:8,title:['Обнаружить станцию «Эхо»','Locate Echo station']},{mechanic:3,title:['Доставить зонд к источнику','Deliver the probe to the source']}],9:[{mechanic:9,title:['Провести экипаж через шлюз','Guide the crew through the gate']},{mechanic:6,title:['Собрать корабль возвращения','Assemble the return vessel']},{mechanic:3,title:['Последний манёвр домой','Final homebound maneuver']}]};
 function read(n){if(!sequences[n])return null;try{const v=JSON.parse(localStorage.getItem(key(n)));if(v?.version===1&&v.n===n&&Number.isInteger(v.phase)&&v.phase>=0&&v.phase<sequences[n].length&&Number.isInteger(v.seed)&&v.seed>=0&&v.seed<=0xffffffff&&Number.isFinite(v.seconds)&&v.seconds>=0)return v;}catch{}return null;}
 function write(s){try{localStorage.setItem(key(s.n),JSON.stringify(s));}catch{}}
 function open(n){if(MKTYStory.read(n)?.edition!==2)return original[n]();if(localStorage.getItem('mkty_life'+n)==='complete'&&MKTYStory.read(n)?.phase==='complete')return original[n]();let session=read(n);if(!session){session={version:1,n,phase:0,seed:crypto.getRandomValues(new Uint32Array(1))[0],seconds:0};write(session);}const p=sequences[n][session.phase],seed=(session.seed+session.phase*7919)>>>0;
  MKTYField.open({chapter:n,id:session.phase,fieldStage:4,mechanic:p.mechanic,title:p.title,core:true,phaseCount:sequences[n].length,seed,
   save:checkpoint=>{const current=read(n);if(!current||current.phase!==session.phase)return;current.checkpoint=checkpoint;write(current);},
   complete:checkpoint=>{const checked=FieldRules.restore(checkpoint,p.mechanic,4,seed);if(!checked?.complete||!FieldRules.won(checked))return;session.seconds+=checked.seconds;delete session.checkpoint;session.phase++;if(session.phase<sequences[n].length){write(session);open(n);return;}
    const story=MKTYStory.read(n);if(story){story.coreSeconds+=session.seconds;localStorage.setItem('mkty_story_plan_'+n+'_v1',JSON.stringify(story));}
    if(n===8&&!localStorage.getItem('mkty_life9_coordinates')){const source=FieldRules.layout(FieldRules.create(8,4,session.seed)).source;localStorage.setItem('mkty_life9_coordinates',(source.y/5).toFixed(3)+','+(source.x/4).toFixed(3));}
    localStorage.setItem('mkty_spatial_report_'+n,JSON.stringify({version:1,seconds:session.seconds,phases:sequences[n].length,completedAt:Date.now()}));localStorage.removeItem(key(n));awardLifePoints(n,n===8?2000:3000);original[n]();},
   exit:()=>show('chapters')},session.checkpoint);
 }
 window.openMission8=()=>open(8);window.openMission9=()=>open(9);
 return {open,read};
})();
