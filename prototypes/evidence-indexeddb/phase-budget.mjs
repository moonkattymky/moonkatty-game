// SOURCE ONLY. Encoded representation reservations, not JavaScript heap or durability.
import * as C from './contract.mjs';
export const PHASE_BUDGET=Object.freeze({ceiling:1016832,metadata:32768,adapter:C.LIMIT.transient,
  context:65536,raw:65536,phase:327680,packet:16384,chunk:32768,helper:2*C.LIMIT.hashInput});
const MAX=Object.freeze({metadata:32768,adapter:C.LIMIT.transient,'raw-capsule':65536,
  'context-retained':65536,'context-parse':65536,'context-restore':65536,
  'phase-workspace':327680,'private-phase':16384,'stream-candidate':32768,
  'returned-page':32768,'phase-assembly':16384,'helper-framing':C.LIMIT.hashInput,
  'helper-hash':2*C.LIMIT.hashInput,'context-compare-read':2*C.LIMIT.hashInput,
  'callback-scratch':65536,'post-target':65536,'callback-outer-story':65536,'callback-inner-story':65536,
  'post-work-1':65536,'post-work-2':65536,'post-stringify':65536,'native-read':65536,
  'witness-read':65536,'witness-chunk':32768,'recovery-page':16384,'original-read-workspace':196608,
  'reload-page':32768,'reload-chunk':32768,'reload-story-work':65536,
  'reload-binding':12288,'reload-decode':4096,'reload-phase-retained':65536,
  'atomic-retained':32768,'atomic-record-workspace':65536});
const SINGLE=new Set(['raw-capsule','context-retained','context-parse','context-restore','phase-workspace',
  'private-phase','stream-candidate','returned-page','phase-assembly','context-compare-read',
  'callback-scratch','post-target','callback-outer-story','callback-inner-story','post-work-1','post-work-2',
  'post-stringify','native-read','witness-read','witness-chunk','recovery-page','original-read-workspace',
  'reload-page','reload-chunk','reload-story-work','reload-binding','reload-decode','reload-phase-retained',
  'atomic-retained','atomic-record-workspace']);
export function createPhaseBudget({observe}={}){
  if(observe!==undefined&&typeof observe!=='function')C.fail('budget-observer');
  const held=Object.fromEntries(Object.keys(MAX).map(k=>[k,0]));
  held.metadata=MAX.metadata;held.adapter=MAX.adapter;
  let peak=held.metadata+held.adapter,events=0,allocations=0;
  const sum=value=>Object.values(value).reduce((n,v)=>C.add(n,v),0);
  const snapshot=()=>Object.freeze({ceiling:PHASE_BUDGET.ceiling,live:sum(held),peak,
    reservations:Object.freeze({...held}),events,allocations});
  function emit(type,label,bytes,detail){events=Math.min(Number.MAX_SAFE_INTEGER,events+1);
    observe?.(Object.freeze({type,label,bytes,...(detail===undefined?{}:{detail}),...snapshot()}));}
  function valid(label,n){if(!Object.hasOwn(MAX,label)||!C.int(n)||n<1||n>MAX[label])C.fail('transient-budget');}
  function invariant(next){
    const projection=['callback-scratch','callback-outer-story','callback-inner-story','post-work-1','post-work-2','post-stringify','original-read-workspace'].some(k=>next[k]);
    if(projection&&next['atomic-record-workspace'])C.fail('budget-lifetime');
    if(projection&&(next['phase-workspace']||next['private-phase']||next['helper-framing']||next['helper-hash']||
      next['context-compare-read']||next['native-read']||next['witness-read']||next['witness-chunk']))C.fail('budget-lifetime');
    if(next['original-read-workspace']&&(next['post-work-1']||next['post-work-2']||next['post-stringify']))C.fail('budget-lifetime');
    if((next['witness-read']||next['witness-chunk'])&&(next['phase-workspace']||next['private-phase']||
      next['stream-candidate']||next['returned-page']||next['phase-assembly']))C.fail('budget-lifetime');
    if(next['recovery-page']&&(next['raw-capsule']||next['context-retained']||next['phase-workspace']))C.fail('budget-lifetime');
    if(sum(next)>PHASE_BUDGET.ceiling||C.add(next['helper-framing'],next['helper-hash'])>PHASE_BUDGET.helper)C.fail('transient-budget');
    if(next['phase-workspace']&&(next['raw-capsule']||next['context-parse']||next['context-restore']))C.fail('budget-lifetime');
    if(next['context-compare-read']&&(next['helper-framing']||next['helper-hash']))C.fail('budget-lifetime');
    if(next['stream-candidate']&&(next['returned-page']||next['phase-assembly']))C.fail('budget-lifetime');
    if(C.add(next['returned-page'],next['phase-assembly'])>PHASE_BUDGET.chunk)C.fail('budget-lifetime');
  }
  function reserve(label,n){valid(label,n);if(['metadata','adapter'].includes(label)||SINGLE.has(label)&&held[label])C.fail('budget-lifetime');
    const next={...held,[label]:C.add(held[label],n)};if(next[label]>MAX[label])C.fail('transient-budget');invariant(next);
    held[label]=next[label];peak=Math.max(peak,sum(held));emit('reserve',label,n);}
  function release(label,n){valid(label,n);if(['metadata','adapter'].includes(label)||held[label]<n)C.fail('budget-lifetime');
    held[label]-=n;emit('release',label,n);}
  function allocate(label,n){valid(label,n);if(held[label]<n)C.fail('allocation-unreserved');
    allocations=Math.min(Number.MAX_SAFE_INTEGER,allocations+1);emit('allocate',label,n);}
  function event(label,detail){if(typeof label!=='string'||label.length>96)C.fail('budget-event');emit('event',label,0,detail);}
  return Object.freeze({reserve,release,allocate,event,snapshot});
}
export function requirePhaseBudget(account){
  if(!account||!['reserve','release','allocate','event','snapshot'].every(k=>typeof account[k]==='function'))C.fail('budget-capability');
  const s=account.snapshot();if(s?.ceiling!==PHASE_BUDGET.ceiling||s?.reservations?.metadata!==PHASE_BUDGET.metadata||
    s?.reservations?.adapter!==PHASE_BUDGET.adapter)C.fail('budget-capability');return account;
}
