// SOURCE ONLY. Pure fixed chapter-9 terminal projection, never an effect executor.
// No localStorage, account/network API, callback, clock mutation, or grant call.
import * as C from './contract.mjs';
import * as StoryModule from '../../story-plan.js';
import {measureFinaleData,freezeFinaleData} from './finale-context-v1.mjs';
import {requirePhaseBudget} from './phase-budget.mjs';
import {preparedOperationsText,preparedOperationsPhase} from './prepared-operations.mjs';
const Story=StoryModule.default||globalThis.StoryPlan;
export const ATOMIC_CONTRACT='fixed-guest-chapter9-phase2-v1';
export const ATOMIC_REWARD=3000;
const LIMIT=65536,WORK=['post-work-1','post-work-2','post-stringify'];
const fail=()=>C.fail('atomic-projection-invalid');
let active=false;
export const validAtomicTime=n=>Number.isSafeInteger(n)&&n>=0&&!Object.is(n,-0);
export function validateAtomicTimestamps(value){
  const keys=['storyAccumulated','report','pace','storyCompleted','lock'];
  if(!C.exact(value,keys)||!keys.every(k=>validAtomicTime(value[k]))||keys.some((k,i)=>i&&value[k]<value[keys[i-1]]))fail();
  return Object.freeze(Object.fromEntries(keys.map(k=>[k,value[k]])));
}
export function validateAtomicBaseline(value){
  if(!C.exact(value,['points','life','awarded','completedAt','finalPoints','lockedAt','operationsText'])||
    !Number.isSafeInteger(value.points)||value.points<0||Object.is(value.points,-0)||!Number.isSafeInteger(value.points+ATOMIC_REWARD)||
    value.life!==null||value.awarded!==null||value.finalPoints!==null||value.lockedAt!==null||
    value.completedAt!==null&&!validAtomicTime(value.completedAt))fail();
  const phase=preparedOperationsPhase(value.operationsText,9);if(phase!==null&&phase!=='core')fail();
  return Object.freeze({...value});
}
// Caller retains post-target until every consumer releases the result. The three
// temporary work slots are reserved/released here. Existing context and admitted
// phase slots may coexist, but phase-workspace/transport hashing must be gone.
export function projectAtomicTerminal(options,budget){
  requirePhaseBudget(budget);
  if(!C.exact(options,['storyText','sourceSeconds','phaseSeconds','baseline','timestamps']))fail();
  const {storyText,sourceSeconds,phaseSeconds,baseline,timestamps}=options;
  const b=validateAtomicBaseline(baseline),t=validateAtomicTimestamps(timestamps);
  if(typeof storyText!=='string'||storyText.length<1||storyText.length*2>LIMIT||
    ![sourceSeconds,phaseSeconds].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0))fail();
  const addedSeconds=sourceSeconds+phaseSeconds;if(!Number.isFinite(addedSeconds))fail();
  if(active)C.fail('atomic-projection-busy');
  const parse=JSON.parse,stringify=JSON.stringify,restore=Story.restore;
  active=true;const owned=new Set();let first=null,second=null,text=null,cleanupError;
  try{
    if(budget.snapshot().reservations['post-target']!==LIMIT)C.fail('allocation-unreserved');
    for(const label of WORK){if(budget.snapshot().reservations[label])C.fail('budget-lifetime');owned.add(label);budget.reserve(label,LIMIT);}
    function decode(input,event){budget.allocate('post-work-1',LIMIT);budget.event(event,{bytes:input.length*2});
      let value;try{value=parse(input);}catch{fail();}measureFinaleData([value],LIMIT);return value;}
    function model(value,event){budget.allocate('post-work-2',LIMIT);budget.event(event);const result=restore(value);
      if(!result)fail();measureFinaleData([result],LIMIT);return result;}
    function encode(value,event){measureFinaleData([value],LIMIT);budget.allocate('post-stringify',LIMIT);budget.event(event);
      const result=stringify(value);if(result.length*2>LIMIT)C.fail('atomic-projection-limit');return result;}
    first=decode(storyText,'atomic-story-original-parse');
    if(!first||first.n!==9||first.edition!==2||first.phase!=='core')fail();
    second=model(first,'atomic-story-first-restore');first=null;budget.event('atomic-story-original-drop');
    if(second.done.length!==8)fail();
    second.coreSeconds+=addedSeconds;if(!Number.isFinite(second.coreSeconds))fail();
    second.createdAt=t.storyAccumulated;
    // The legacy accumulate writer serializes before Story.complete reads and
    // restores again. That intermediate JSON roundtrip intentionally normalizes
    // negative zero, and the second restore intentionally clamps coreSeconds.
    text=encode(second,'atomic-story-intermediate-stringify');second=null;budget.event('atomic-story-first-drop');
    first=decode(text,'atomic-story-intermediate-parse');text=null;budget.event('atomic-story-intermediate-drop');
    second=model(first,'atomic-story-second-restore');first=null;budget.event('atomic-story-second-input-drop');
    second.phase='complete';second.createdAt=t.storyCompleted;
    text=encode(second,'atomic-story-final-stringify');
    const coreSeconds=second.coreSeconds;second=null;budget.event('atomic-story-final-graph-drop');
    budget.allocate('post-target',text.length*2);
    const points=b.points+ATOMIC_REWARD;
    const values={mkty_story_plan_9_v1:text,mkty_spatial_report_9:stringify({version:1,seconds:addedSeconds,phases:3,completedAt:t.report}),
      mkty_field_finale_9_v1:null,mkty_life9_completed_at:String(b.completedAt===null?t.pace:b.completedAt),
      mkty_operations_9_v1:b.operationsText===null?null:preparedOperationsText(9,'complete'),
      mkty_points:String(points),mkty_life9_awarded:'yes',mkty_life9:'complete',
      mkty_final_moon_points:String(points),mkty_points_locked_at:String(t.lock)};
    // All small outputs (excluding the aliased, separately charged story) are
    // covered by the owner's atomic metadata slot.
    return freezeFinaleData({storyText:text,values,coreSeconds,addedSeconds,
      reward:{disposition:'local-demo',entitlement:'life:9:complete',amount:ATOMIC_REWARD,balance:points,finalBalance:points,lockedAt:t.lock},
      presentation:{screen:'result',continueTarget:'chapter9-epilogue',returnTarget:'home'}});
  }finally{
    first=null;second=null;text=null;
    for(const label of WORK.slice().reverse())if(owned.has(label))try{const n=budget.snapshot().reservations[label];if(n)budget.release(label,n);}catch(e){cleanupError??=e;}
    active=false;if(cleanupError)throw cleanupError;
  }
}
