import {createTestAdapter} from '/prototypes/evidence-indexeddb/adapter.mjs';
import {createCoordinator} from '/prototypes/evidence-indexeddb/coordinator.mjs';
import {createPhaseBudget} from '/prototypes/evidence-indexeddb/phase-budget.mjs';
import {inspectInvocationFence} from '/prototypes/evidence-indexeddb/invocation-fence.mjs';
import {audit,initialContext,SCOPE,SESSION} from './shared.mjs';
const S=window.__fenceNative,N=window.__nativeHarness;
if (!S||!N||window.MKTYStorage||window.H) throw Error('Inspection must be a new source-only realm');
let adapter,coordinator,options,budget;
window.I={
  async setup(expected) {
    if(adapter)throw Error('One inspection setup');
    const context=initialContext();adapter=createTestAdapter({scope:SCOPE});
    const opened=await adapter.open();if(opened.status!=='open')throw Error('Inspection adapter '+opened.reason);
    coordinator=createCoordinator(adapter,()=>context);budget=createPhaseBudget();
    options={coordinator,budget,scope:SCOPE,session:SESSION,chapter:expected.chapter,phase:expected.phase,
      identity:expected.identity,expectedContext:context,contextPin:expected.contextPin,phasePin:expected.phasePin,
      isCurrent:()=>true,sessionMetadataBytes:()=>0,crypto};
    S.mode='inspection';return I.facts();
  },
  inspect:()=>inspectInvocationFence(options),
  audit:()=>audit(coordinator),
  facts:()=>({native:S.snapshot(),nativeWrites:structuredClone(S.rows),nativeEvents:structuredClone(N.log),
    noFacade:window.MKTYStorage===undefined,noOriginal:window.MKTYSpatialFinale===undefined,noClosure:window.H===undefined,
    physicalBusy:adapter?.physicalBusy,retainedBytes:adapter?.retainedBytes,budget:budget?.snapshot(),errors:S.errors})
};
window.invocationInspectionReady=true;
