// SOURCE ONLY: an exact unchanged-writer predicate, never a storage target source.
import * as C from './contract.mjs';
import * as StoryModule from '../../story-plan.js';
import {measureFinaleData} from './finale-context-v1.mjs';
import {requirePhaseBudget} from './phase-budget.mjs';
const Story=StoryModule.default||globalThis.StoryPlan;
const LIMIT=65536,WORK=['post-work-1','post-work-2','post-stringify'];
let active=false;
const fail=()=>C.fail('story-rewrite-invalid'),limit=()=>C.fail('story-rewrite-limit');
const timestamp=n=>Number.isSafeInteger(n)&&n>=0&&!Object.is(n,-0);
const finite=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
function textBound(text){if(typeof text!=='string')fail();if(text.length<1||text.length*2>LIMIT)limit();}
function capture(options){
  const common=['kind','observedText','before','after'];
  if(!options||!Object.getOwnPropertyDescriptor(options,'kind')?.value)fail();
  const kind=Object.getOwnPropertyDescriptor(options,'kind').value;
  const keys=kind==='entry'?common:kind==='accumulated'?[...common,'addedSeconds']:
    kind==='complete'?[...common,'addedSeconds','firstTimestamp']:null;
  if(!keys||!C.exact(options,keys))fail();
  const {observedText,before,after,addedSeconds,firstTimestamp}=options;
  textBound(observedText);
  if(!timestamp(before)||!timestamp(after)||after<before||
    kind!=='entry'&&!finite(addedSeconds)||kind==='complete'&&
    (!timestamp(firstTimestamp)||firstTimestamp<before||firstTimestamp>after))fail();
  return Object.freeze({kind,observedText,before,after,addedSeconds,firstTimestamp});
}
// Call only after delegated storage.setItem and its synchronous observers return.
// The caller already owns the retained original, provisional target and original
// callback slots. Options are plain exact data, captured before any budget hook.
// Raw entry uses this function; an admitted archive uses validateContextRewrite.
export function validateStoryRewrite(storyText,chapter,options,account){
  textBound(storyText);if(![8,9].includes(chapter))fail();
  const input=capture(options),{kind,observedText,before,after,addedSeconds,firstTimestamp}=input;
  if(!account||typeof account!=='object')C.fail('budget-capability');
  if(active)C.fail('story-rewrite-busy');
  // Capture the actual primitives before observers may replace ambient methods.
  const parse=JSON.parse,stringify=JSON.stringify,restore=Story.restore;
  active=true;
  let first=null,second=null,serialized=null,createdAt,cleanupError;
  const owned=new Set();
  try{
    requirePhaseBudget(account);
    const held=account.snapshot().reservations;
    for(const label of WORK)if(held[label])C.fail('budget-lifetime');
    for(const label of ['post-target','callback-outer-story','callback-inner-story','callback-scratch'])
      if(held[label]!==LIMIT)C.fail('allocation-unreserved');
    account.allocate('context-retained',storyText.length*2);
    account.allocate('post-target',observedText.length*2);
    account.allocate('metadata',256);
    // A reserve may notify after changing the counter. Track intent before the
    // call so even a throwing observer is cleaned up using its actual counter.
    for(const label of WORK){owned.add(label);account.reserve(label,LIMIT);}
    function graph(label,event,text){
      account.allocate(label,LIMIT);account.event(event,{bytes:text.length*2});
      try{return parse(text);}catch{fail();}
    }
    function restored(value,event){
      account.allocate('post-work-2',LIMIT);account.event(event);
      const result=restore(value);if(!result)fail();measureFinaleData([result],LIMIT);return result;
    }
    function encode(value,event){
      // Measure before allocation, including the original opaque supported data.
      measureFinaleData([value],LIMIT);account.allocate('post-stringify',LIMIT);account.event(event);
      const result=stringify(value);textBound(result);return result;
    }
    first=graph('post-work-1','story-observed-parse',observedText);
    if(!first||typeof first!=='object'||Array.isArray(first))fail();
    createdAt=first.createdAt;
    if(!timestamp(createdAt)||createdAt<before||createdAt>after||
      kind==='complete'&&createdAt<firstTimestamp)fail();
    first=null;account.event('story-observed-drop');
    // Only the timestamp primitive may survive this boundary. Nothing else from
    // observedText is used to build the independent expected value.
    first=graph('post-work-1','story-original-parse',storyText);
    measureFinaleData([first],LIMIT);
    if(!first||first.n!==chapter||first.edition!==2||
      !(kind==='entry'?['operations','core']:['core']).includes(first.phase))fail();
    second=restored(first,'story-first-restore');
    first=null;account.event('story-original-drop');
    if(second.done.length!==8)fail();
    if(kind==='entry')second.phase='core';
    else{
      const sum=second.coreSeconds+addedSeconds;if(!finite(sum))fail();
      second.coreSeconds=sum;
    }
    second.createdAt=kind==='complete'?firstTimestamp:createdAt;
    if(kind==='complete'){
      // Mirror the real intervening writer/read JSON roundtrip, including -0.
      // Drop R1 before parsing, then drop text before allocating the second R2.
      serialized=encode(second,'story-intermediate-stringify');
      second=null;account.event('story-first-drop');
      first=graph('post-work-1','story-intermediate-parse',serialized);
      serialized=null;account.event('story-intermediate-drop');
      second=restored(first,'story-second-restore');
      first=null;account.event('story-second-input-drop');
      second.phase='complete';second.createdAt=createdAt;
    }
    serialized=encode(second,'story-final-stringify');
    if(serialized!==observedText)C.fail('story-rewrite-mismatch');
    return Object.freeze({kind,chapter,createdAt,coreSeconds:second.coreSeconds,bytes:serialized.length*2});
  }finally{
    first=null;second=null;serialized=null;
    // Release all owned slots even if reserve/release observation itself throws.
    for(const label of WORK.slice().reverse())if(owned.has(label)){
      try{const n=account.snapshot().reservations[label];if(n)account.release(label,n);}
      catch(error){cleanupError??=error;}
    }
    active=false;if(cleanupError)throw cleanupError;
  }
}
