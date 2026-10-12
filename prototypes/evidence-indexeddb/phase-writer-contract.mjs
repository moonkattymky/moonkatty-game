// SOURCE ONLY. Fixed original-handler observations, not leases, replay or rewards authority.
import * as C from './contract.mjs';
import * as FieldModule from '../../field-model.js';
import {describeContext,measureFinaleData,validateContextRewrite} from './finale-context-v1.mjs';
import {requirePhaseBudget} from './phase-budget.mjs';
const Field=FieldModule.default||globalThis.FieldRules;
const SEQUENCE=Object.freeze({8:Object.freeze([10,3]),9:Object.freeze([9,6,11])});
const STAGES=Object.freeze(['dispatch','open','entry-navigation','entry-confirm','epilogue']);
const LIMIT=Object.freeze({small:8192,metadata:32768,source:16384,story:65536});
const KEYS=new Set(['mkty_points','mkty_global_lives','mkty_life_restore_at','mkty_current_chapter','mkty_legacy_v1',
  'mkty_life9_coordinates','mkty_final_moon_points','mkty_points_locked_at','mkty_lang','mkty_control_sound',
  'mkty_light_fx','mkty_expeditions_v1','mkty_daily_demo','mkty_pace_skip_9',...([8,9].flatMap(n=>[
    `mkty_life${n}`,`mkty_life${n}_awarded`,`mkty_life${n}_completed_at`,`mkty_spatial_report_${n}`,
    `mkty_pace_ack_${n}`,`mkty_operations_${n}_v1`,`mkty_campaign_checkpoint_${n}`]))]);
const fail=code=>C.fail('phase-writer-'+code),uint=n=>Number.isInteger(n)&&n>=0&&n<=0xffffffff;
const timestamp=n=>Number.isSafeInteger(n)&&n>=0&&!Object.is(n,-0);
function bound(text,max=LIMIT.small){if(typeof text!=='string'||text.length*2>max)fail('limit');return text;}
function data(value){if(!value||Object.getPrototypeOf(value)!==Object.prototype)fail('input');
  const out={};for(const k of Reflect.ownKeys(value)){const p=Object.getOwnPropertyDescriptor(value,k);
    if(typeof k!=='string'||!p?.enumerable||!Object.hasOwn(p,'value'))fail('input');
    Object.defineProperty(out,k,{value:p.value,enumerable:true,writable:true,configurable:true});}return out;}
function json(text,max){bound(text,max);try{return JSON.parse(text);}catch{fail('json');}}
function smallMap(value={}){const out=data(value);for(const [key,val]of Object.entries(out)){
    if(!KEYS.has(key)||val!==null&&typeof val!=='string')fail('key');if(val!==null)bound(val);}
  measureFinaleData([out],LIMIT.small);return out;}
// legacy.js:17 normalizes on each setter; it is not an arbitrary merge.
function legacy(text){let v;try{v=JSON.parse(text);}catch{}const choices={1:['scan','antenna'],3:['shield','record'],
  4:['north','south'],5:['vent','keep'],6:['clear','tow'],7:['rescue','hide'],9:['wait','go']};
  return v?.version===1?{version:1,lead:['navigator','engineer','scout'].includes(v.lead)?v.lead:null,
    airlock:['crew','cargo'].includes(v.airlock)?v.airlock:null,echo:['answer','silent'].includes(v.echo)?v.echo:null,
    decodeNoise:Number.isFinite(v.decodeNoise)?v.decodeNoise:null,events:Object.fromEntries(Object.entries(v.events||{})
      .filter(([n,c])=>choices[n]?.includes(c)))}:{version:1,lead:null,airlock:null,echo:null,decodeNoise:null,events:{}};}
// Only the five fixed finale mechanics; precision is a bounded source observation.
function modifiers(s,n,m,precisionCount){const out={},e=s.events||{},add=(k,v,max)=>{out[k]=Math.min(max,(out[k]||0)+v);};
  if(s.lead==='navigator'){if(m===3)out.radius=4;if(m===11)out.preview=1;}
  if(s.lead==='engineer'&&m===6)out.repair=6;if(s.lead==='scout'&&m===10)out.charges=1;
  if(m===9&&n===9&&s.airlock==='crew')out.cells=1;
  if(m===11){let stability=Math.min(20,precisionCount*2);if(s.airlock==='cargo')stability+=10;if(stability)out.stability=stability;if(s.echo==='answer')out.charges=1;}
  if(m===10&&e[1]==='antenna')add('charges',1,3);if(m===6&&e[5]==='keep')add('repair',4,10);
  if(m===9){if(e[6]==='tow')add('cells',1,2);if(e[9]==='go')add('cells',1,2);}
  if(m===11){if(e[3]==='record')add('stability',5,40);if(e[7]==='rescue')add('stability',5,40);
    if(e[9]==='wait')add('stability',5,40);if(e[7]==='hide')add('charges',1,3);}return Field.cleanMods(out);}
function source(text,chapter,phase,seed,hasCheckpoint){const s=json(text,LIMIT.source);
  if(!C.exact(s,['version','n','phase','seed','seconds',...(hasCheckpoint?['checkpoint']:[])])||s.version!==1||
    s.n!==chapter||s.phase!==phase||s.seed!==seed||!Number.isFinite(s.seconds)||s.seconds<0)fail('source');return s;}

// Input refs belong to the parent's already reserved immutable raw/context capsule.
// The constructor drops source/checkpoint graphs after deriving bounded metadata.
export function createPhaseWriterContract(input){
  const args=data(input),allowed=['stage','chapter','phase','baseSeed','sourceText','checkpoint','legacyText',
    'precisionCount','context','budget','now','isCurrent','preState','projectAfterRead'];
  input=null;if(Object.keys(args).some(k=>!allowed.includes(k)))fail('input');
  const {stage,chapter,phase,baseSeed,budget:account,now=Date.now,isCurrent,precisionCount=0}=args;
  const projectAfterRead=args.projectAfterRead??(callback=>callback());
  if(typeof projectAfterRead!=='function')fail('input');
  const budget=requirePhaseBudget(account),sequence=SEQUENCE[chapter],mechanic=sequence?.[phase];
  if(!STAGES.includes(stage)||![8,9].includes(chapter)||!Number.isInteger(phase)||!mechanic||!uint(baseSeed)||(!Number.isInteger(precisionCount)||precisionCount<0||precisionCount>64)||typeof now!=='function'||
    typeof isCurrent!=='function'||(stage.startsWith('entry-')&&(chapter!==9||phase!==0))||
    stage==='epilogue'&&(chapter!==9||phase!==2))fail('input');
  const sourceKey=`mkty_field_finale_${chapter}_v1`,storyKey=`mkty_story_plan_${chapter}_v1`,seed=(baseSeed+phase*7919)>>>0;
  let context=args.context??null,expected=[],small=smallMap(args.preState),latestStory=null,targetReserved=false;
  let state='ready',blocked=null,busy=false,cursor=0,before=null,lastTimestamp=null,firstTimestamp=null,provisional=false,drained=false;
  let addedSeconds=0,nextSourceText=null,sourceTarget=undefined,legacyText=args.legacyText??null;
  if(legacyText!==null)bound(legacyText,LIMIT.small);
  let sLegacy=legacy(legacyText);const set=(key,value)=>expected.push(Object.freeze({op:'set',key,value}));
  const dynamic=(key,type)=>expected.push(Object.freeze({op:'set',key,type}));
  const final=stage==='dispatch'&&phase===sequence.length-1,storyWrites=final||stage==='entry-confirm';
  if(storyWrites){const info=describeContext(context).summary;
    if(info.chapter!==chapter||info.baseSeed!==baseSeed||info.storyKey!==storyKey||info.sourceKey!==sourceKey)fail('context');}
  if(stage==='open'){
    const s=source(args.sourceText,chapter,phase,baseSeed,false),cp=Field.create(mechanic,4,seed,modifiers(sLegacy,chapter,mechanic,precisionCount));
    cp.trace=[];s.checkpoint=cp;nextSourceText=bound(JSON.stringify(s),LIMIT.source);
    set('mkty_current_chapter',String(chapter));set(sourceKey,nextSourceText);set(sourceKey,nextSourceText);
  }else if(stage==='dispatch'){
    // No original callback/projection is live yet. Charge the temporary original-model reconstruction.
    budget.reserve('post-work-1',LIMIT.story);let checked=null,s=null;
    try{budget.allocate('post-work-1',LIMIT.story);measureFinaleData([args.checkpoint],LIMIT.source);
      s=source(args.sourceText,chapter,phase,baseSeed,true);
      if(JSON.stringify(s.checkpoint)!==JSON.stringify(args.checkpoint))fail('checkpoint');
      checked=Field.restore(args.checkpoint,mechanic,4,seed);
      if(!checked?.complete||!Field.won(checked)||checked.version!==2||
        JSON.stringify(checked.mods)!==JSON.stringify(modifiers(sLegacy,chapter,mechanic,precisionCount)))fail('checkpoint');
      addedSeconds=s.seconds+checked.seconds;if(!Number.isFinite(addedSeconds)||addedSeconds<0)fail('seconds');
      if(mechanic===10){sLegacy.echo=checked.choice;legacyText=JSON.stringify(sLegacy);set('mkty_legacy_v1',legacyText);
        sLegacy.decodeNoise=Math.round(checked.noise);legacyText=JSON.stringify(sLegacy);set('mkty_legacy_v1',legacyText);}
      delete s.checkpoint;s.seconds=addedSeconds;s.phase++;
      if(!final){nextSourceText=bound(JSON.stringify(s),LIMIT.source);set(sourceKey,nextSourceText);}
    }finally{s=null;checked=null;budget.release('post-work-1',LIMIT.story);}
    if(final){dynamic(storyKey,'accumulated');
      if(chapter===8){const point=Field.layout(Field.create(8,4,baseSeed)).source;
        set('mkty_life9_coordinates',(point.y/5).toFixed(3)+','+(point.x/4).toFixed(3));}
      dynamic(`mkty_spatial_report_${chapter}`,'report');expected.push(Object.freeze({op:'remove',key:sourceKey,value:null}));
      dynamic(`mkty_life${chapter}_completed_at`,'timestamp');dynamic(storyKey,'complete');
      set('mkty_points',chapter===8?'2100':'5100');set(`mkty_life${chapter}_awarded`,'yes');
      set(`mkty_life${chapter}`,'complete');set(`mkty_life${chapter}`,'complete');
      if(chapter===8)set('mkty_current_chapter','8');else{set('mkty_final_moon_points','5100');dynamic('mkty_points_locked_at','timestamp');}}
  }else if(stage==='entry-confirm'){set('mkty_pace_ack_9','yes');dynamic(storyKey,'entry');}
  else set('mkty_current_chapter',String(chapter));
  // Fixed worst-case metadata envelope, including every future small target. Source
  // values alias raw-capsule slots; story values live only in post-target.
  let rows=expected.map(row=>row.key===sourceKey?{op:row.op,key:row.key}:row);
  let scalars={stage,chapter,phase,baseSeed,mechanic,sourceKey,storyKey,addedSeconds,legacyText,
    cursor:11,before:Number.MAX_SAFE_INTEGER,lastTimestamp:Number.MAX_SAFE_INTEGER,firstTimestamp:Number.MAX_SAFE_INTEGER};
  let future={...small};let smallPeak=measureFinaleData([future],LIMIT.small);
  for(const row of expected)if(row.key!==sourceKey&&row.key!==storyKey){future[row.key]=row.type==='timestamp'?String(Number.MAX_SAFE_INTEGER):
    row.type==='report'?JSON.stringify({version:1,seconds:addedSeconds,phases:sequence.length,completedAt:Number.MAX_SAFE_INTEGER}):row.value;
    smallPeak=Math.max(smallPeak,measureFinaleData([future],LIMIT.small));}
  scalars.precisionCount=precisionCount;
  const metadataBytes=measureFinaleData([rows,scalars],LIMIT.metadata)+smallPeak+512;
  if(metadataBytes>LIMIT.metadata)fail('metadata');rows=null;scalars=null;future=null;sLegacy=null;budget.allocate('metadata',metadataBytes);
  // These raw source/checkpoint input references must not survive constructor scope through args.
  for(const key of Object.keys(args))delete args[key];
  if(storyWrites){budget.reserve('post-target',LIMIT.story);targetReserved=true;}
  function block(code){blocked??=code;state='blocked';drained=false;fail(blocked);}
  function current(){if(blocked)fail(blocked);let value;try{value=isCurrent();}catch{block('stale');}
    if(blocked)fail(blocked);if(value!==true)block('stale');}
  function enter(){if(busy)block('reentrant');if(blocked||state==='released')fail(blocked||'released');busy=true;}
  function clock(){const value=now();if(!timestamp(value)||before!==null&&value<before)block('clock');return value;}
  function stamp(value,after){if(!timestamp(value)||value<before||value>after||lastTimestamp!==null&&value<lastTimestamp)block('timestamp');
    lastTimestamp=value;return value;}
  function begin(){enter();try{if(state!=='ready')block('stage');current();before=clock();current();state='active';return view();}
    catch(error){if(!blocked)blocked='begin';state='blocked';throw error;}finally{busy=false;}}
  function handleWrite(operation,forward){enter();try{
    if(state!=='active'||typeof forward!=='function')block('stage');current();
    const op=data(operation),row=expected[cursor];
    if(Object.keys(op).some(k=>!['op','key','value'].includes(k))||!row||op.op!==row.op||op.key!==row.key)block('operation');
    const value=op.op==='remove'?null:bound(op.value,row.key===storyKey?LIMIT.story:row.key===sourceKey?LIMIT.source:LIMIT.small);
    if(op.op==='remove'&&op.value!==undefined&&op.value!==null)block('operation');
    if(row.type==='timestamp'){
      if(!/^(0|[1-9]\d*)$/.test(value))block('timestamp');stamp(Number(value),clock());
    }else if(row.type==='report'){
      const report=json(value,LIMIT.small),at=stamp(report?.completedAt,clock());
      if(value!==JSON.stringify({version:1,seconds:addedSeconds,phases:sequence.length,completedAt:at}))block('report');
    }else if(!row.type&&value!==row.value)block('value');
    if(row.key!==storyKey&&row.key!==sourceKey)measureFinaleData([{...small,[row.key]:value}],LIMIT.small);
    current();const result=forward();
    if(row.key===storyKey){
      // Forward has already returned. Replace, never retain, the previous target.
      latestStory=value;provisional=true;current();budget.allocate('post-target',LIMIT.story);
      const options={kind:row.type,observedText:latestStory,before,after:clock(),
        ...(row.type==='entry'?{}:{addedSeconds}),...(row.type==='complete'?{firstTimestamp}:{})};
      const info=projectAfterRead(()=>validateContextRewrite(context,options,budget));current();stamp(info.createdAt,options.after);
      if(row.type==='accumulated')firstTimestamp=info.createdAt;provisional=false;
    }else{current();if(row.key===sourceKey)sourceTarget=value;else small[row.key]=value;}
    if(blocked)fail(blocked);current();cursor++;drained=false;return result;
  }catch(error){if(!blocked)blocked='write';state='blocked';drained=false;throw error;}finally{busy=false;}}
  function finish(){enter();try{current();if(state!=='active'||cursor!==expected.length||provisional)block('incomplete');
    clock();state='finished';return Object.freeze({...view(),nextSourceText,legacyText});
  }catch(error){if(!blocked)blocked='finish';state='blocked';throw error;}finally{busy=false;}}
  function smallTargets(){if(busy||state!=='finished'||!drained||blocked)fail(blocked||'targets-not-drained');return Object.freeze({...small});}
  function drain(readNative,isPersistent){enter();let reserved=false,native=null;
    try{if(state!=='finished'||provisional||typeof readNative!=='function'||typeof isPersistent!=='function')block('stage');drained=false;current();
      if(isPersistent()!==true)return Object.freeze({ok:false,reason:'persistence'});
      budget.reserve('native-read',LIMIT.story);reserved=true;
      for(const key of [...Object.keys(small),...(sourceTarget===undefined?[]:[sourceKey]),...(latestStory===null?[]:[storyKey])]){
        current();budget.allocate('native-read',LIMIT.story);
        try{native=readNative(key);}catch{return Object.freeze({ok:false,reason:'native-read'});}
        if(native!==null&&(typeof native!=='string'||native.length*2>(key===storyKey?LIMIT.story:key===sourceKey?LIMIT.source:LIMIT.small)))block('native-bound');
        if(native!==(key===storyKey?latestStory:key===sourceKey?sourceTarget:small[key]))block('native-mismatch');native=null;current();
      }
      if(isPersistent()!==true)return Object.freeze({ok:false,reason:'persistence'});current();drained=true;
      return Object.freeze({ok:true,operations:cursor,keys:Object.keys(small).length+(sourceTarget===undefined?0:1)+(latestStory===null?0:1)});
    }finally{native=null;if(reserved)budget.release('native-read',LIMIT.story);busy=false;}}
  function withStoryTarget(callback){enter();try{current();if(!drained||provisional||latestStory===null||typeof callback!=='function')block('story-target');
      const complete=result=>{if(blocked)fail(blocked);current();return result;};
      const result=callback(latestStory);if(result&&typeof result.then==='function')return Promise.resolve(result).then(complete).finally(()=>{busy=false;});
      complete(result);busy=false;return result;
    }catch(error){busy=false;throw error;}}
  function release(){if(busy)block('reentrant');if(state==='released')return;busy=true;try{latestStory=null;context=null;expected=null;small=null;sourceTarget=undefined;nextSourceText=null;legacyText=null;
      if(targetReserved){targetReserved=false;budget.release('post-target',LIMIT.story);}state='released';
    }finally{busy=false;}}
  function view(){return Object.freeze({stage,chapter,phase,state,blocked,cursor,expectedOperations:expected?.length??0,
    provisional,drained,busy,metadataBytes:state==='released'?0:metadataBytes,storyBytes:latestStory?.length*2||0,addedSeconds});}
  return Object.freeze({begin,handleWrite,finish,drain,view,smallTargets,withStoryTarget,release});
}
