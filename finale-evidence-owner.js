/* Optional, unactivated evidence-storage seam. No game/reward/controller hooks.
 * The injected envelope adapter validates capture state, not server provenance.
 * Unknown stored data is kept for recovery and never silently reinterpreted.
 */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory;else root.MKTYFinaleEvidenceOwner=factory;})(typeof globalThis!=='undefined'?globalThis:this,deps=>{
 'use strict';const {codec,storyPlan,envelopes}=deps;
 if(!codec||!storyPlan||!envelopes)throw TypeError('codec, storyPlan and envelopes are required');
 const FORMAT='mkty-finale-evidence',VERSION=1,ENCODING='mkty-trace-v1/json',own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k),object=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
 const clone=(v,max=codec.LIMITS.proofBytes,error='proof_too_large')=>JSON.parse(codec.stringify(v,max,error));
 const equal=(a,b)=>codec.stringify(a)===codec.stringify(b),freeze=v=>{if(v&&typeof v==='object'&&!Object.isFrozen(v)){for(const x of Object.values(v))freeze(x);Object.freeze(v);}return v;};
 const fail=code=>{throw Error(code);};
 const storyKey=n=>'mkty_story_plan_'+n+'_v1',sourceKey=n=>'mkty_field_finale_'+n+'_v1';
 function failure(error,snapshot,source,candidate){return {ok:false,error:String(error?.message||error),recordingOnly:true,retainedSnapshot:snapshot,retainedSource:source,candidate,persisted:false,mayRetireCapturedCheckpoint:false};}
 function encode(envelope){
  const checked=envelopes.restore(envelope);if(!checked.ok)fail(checked.error);
  // Pre-pack: the surrounding snapshot codec sees this payload as an opaque string.
  const payload=codec.stringify(codec.packProof({finale:checked.candidate}),codec.LIMITS.transportBytes,'proof_too_large');
  return freeze({format:FORMAT,version:VERSION,encoding:ENCODING,payload});
 }
 function inspect(plan){
  if(!object(plan)||!own(plan,'finaleEvidence'))return {kind:'absent'};
  const stored=plan.finaleEvidence;
  if(!object(stored)||stored.format!==FORMAT||stored.version!==VERSION||stored.encoding!==ENCODING||Object.keys(stored).some(k=>!['format','version','encoding','payload'].includes(k)))return {kind:'opaque',stored};
  try{
   if(typeof stored.payload!=='string')fail('evidence_payload_invalid');
   if(codec.utf8Bytes(stored.payload)>codec.LIMITS.transportBytes)fail('proof_too_large');
   const decoded=codec.unpackProof(JSON.parse(stored.payload));
   if(!object(decoded)||Object.keys(decoded).length!==1||!own(decoded,'finale'))fail('evidence_payload_invalid');
   const checked=envelopes.restore(decoded.finale);if(!checked.ok)fail(checked.error);
   if(checked.candidate.chapter!==plan.n)fail('evidence_chapter_mismatch');
   return {kind:'known',stored,envelope:checked.candidate,summary:checked.summary,authority:'not-established'};
  }catch(error){return {kind:'unreadable',stored,error:String(error?.message||error)};}
 }
 function prepareCapture({snapshot,source,mode='packed'}){
  let candidate;
  try{
   if(!object(snapshot)||!object(source)||![8,9].includes(source.chapter)||!['raw','packed'].includes(mode))fail('capture_input_invalid');
   const key=storyKey(source.chapter),activeKey=sourceKey(source.chapter),original=snapshot[key],activeValue=snapshot[activeKey];
   if(typeof original!=='string'||typeof activeValue!=='string')fail('capture_source_missing');
   const plan=JSON.parse(original),active=JSON.parse(activeValue);
   if(!storyPlan.restore(plan)||plan.n!==source.chapter||plan.edition!==2)fail('capture_plan_invalid');
   if(!object(active)||active.version!==1||active.n!==source.chapter||active.seed!==source.baseSeed||active.phase!==source.phase||!equal(active.checkpoint,source.checkpoint))fail('capture_source_mismatch');
   const stored=inspect(plan);if(stored.kind==='opaque'||stored.kind==='unreadable')fail('evidence_'+stored.kind);
   let prior;
   if(stored.kind==='absent'){const fresh=envelopes.begin({chapter:source.chapter,baseSeed:source.baseSeed,context:source.context,phase:source.phase});if(!fresh.ok)fail(fresh.error);prior=fresh.candidate;}
   else{prior=stored.envelope;if(prior.baseSeed!==source.baseSeed||!equal(prior.context,source.context))fail('evidence_context_mismatch');}
   const reduced=envelopes.captureCompleted(prior,{index:source.phase,checkpoint:source.checkpoint,provenance:source.provenance});
   if(!reduced.ok)fail(reduced.error);candidate=reduced.candidate;
   const wrapper=encode(candidate),nextPlan={...plan,finaleEvidence:wrapper};
   // Exercise the actual ordinary owner read + JSON write, not just codec transport.
   const ownerRoundtrip=JSON.parse(JSON.stringify(storyPlan.restore(nextPlan)));
   if(!equal(ownerRoundtrip.finaleEvidence,wrapper))fail('owner_drops_evidence');
   const value=JSON.stringify(nextPlan),next={...snapshot,[key]:value};
   const packed=codec.packSnapshot(next),raw=codec.unpackSnapshot(next);
   if(mode==='raw'&&(Object.values(raw).some(v=>codec.utf8Bytes(v)>=codec.LIMITS.snapshotEntryBytes)||codec.utf8Bytes(codec.stringify(raw))>codec.LIMITS.snapshotBytes))fail('snapshot_too_large');
   const copiedSnapshot=clone(next,codec.LIMITS.decodedSnapshotBytes,'snapshot_too_large');
   const retirementRecord=candidate.completed.find(p=>p.index===reduced.capturedIndex);
   return freeze({ok:true,recordingOnly:true,candidate,summary:envelopes.summary(candidate),change:reduced.change,retirementRecord,source:clone(source),expected:{story:original,active:activeValue},sourceKey:activeKey,write:{key,value},wrapper,previousSnapshot:clone(snapshot,codec.LIMITS.decodedSnapshotBytes,'snapshot_too_large'),snapshot:copiedSnapshot,transportSnapshot:clone(mode==='packed'?packed:raw,codec.LIMITS.decodedSnapshotBytes,'snapshot_too_large'),mode,persisted:false,mayRetireCapturedCheckpoint:false,
    sizes:{payloadBytes:codec.utf8Bytes(wrapper.payload),rawEntryBytes:codec.utf8Bytes(value),packedEntryBytes:codec.utf8Bytes(packed[key]),rawSnapshotBytes:codec.utf8Bytes(codec.stringify(next)),packedSnapshotBytes:codec.utf8Bytes(codec.stringify(packed))}});
  }catch(error){return failure(error,snapshot,source,candidate);}
 }
 function acknowledge(prepared,{storage,persistent,source}={}){
  if(!prepared?.ok)return failure('prepared_capture_required',undefined,source);
  try{
   const value=storage.getItem(prepared.write.key),active=storage.getItem(prepared.sourceKey);
   if(active!==prepared.expected.active)fail('source_changed');
   if(!source||!equal(source,prepared.source))fail('source_changed');
   const args={key:prepared.write.key,value,persistent:persistent===true,source};
   const result=prepared.change==='duplicate'?envelopes.acknowledgeRetirementRecovery(prepared,args):envelopes.acknowledgePersistence(prepared,args);
   return {...result,recordingOnly:true,sourceKey:prepared.sourceKey,expectedSourceValue:prepared.expected.active,retainedSnapshot:prepared.previousSnapshot,retainedSource:source};
  }catch(error){return failure(error,prepared.previousSnapshot,source,prepared.candidate);}
 }
 function persist(prepared,{storage,isPersistent,source}={}){
  if(!prepared?.ok)return failure('prepared_capture_required',undefined,source);
  try{
   // Synchronous compare/write/read-back only. Cross-tab atomic CAS is not claimed.
   if(storage.getItem(prepared.write.key)!==prepared.expected.story||storage.getItem(prepared.sourceKey)!==prepared.expected.active)fail('source_changed');
   if(!source||!equal(source,prepared.source))fail('source_changed');
   storage.setItem(prepared.write.key,prepared.write.value);
   return acknowledge(prepared,{storage,persistent:typeof isPersistent==='function'&&isPersistent()===true,source});
  }catch(error){return failure(error,prepared.previousSnapshot,source,prepared.candidate);}
 }
 // Retirement is a scoped acknowledgement for a future caller, never deletion here.
 return Object.freeze({FORMAT,VERSION,ENCODING,encode,inspect,prepareCapture,persist,acknowledge});
});
