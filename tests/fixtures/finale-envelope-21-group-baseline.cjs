'use strict';
/* Pure preparation API only. No storage, network, controller, reward, or seed issuance.
 * A successful reduction is a candidate, not a persisted or authoritative proof.
 */
const SEQUENCES=Object.freeze({8:Object.freeze([10,3]),9:Object.freeze([9,6,11])});
module.exports=function createPhaseEnvelopeAdapter({field,codec}){
 if(!field||!codec)throw new TypeError('field and codec dependencies are required');
 const FORMAT='mkty-phased-finale',VERSION=1;
 const bytes=v=>codec.stringify(v,codec.LIMITS.proofBytes,'proof_too_large');
 const copy=v=>JSON.parse(bytes(v));
 const equal=(a,b)=>bytes(a)===bytes(b);
 const freeze=v=>{if(v&&typeof v==='object'&&!Object.isFrozen(v)){for(const x of Object.values(v))freeze(x);Object.freeze(v);}return v;};
 const uint=v=>Number.isInteger(v)&&v>=0&&v<=0xffffffff;
 const integer=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
 const attempt=cp=>cp.attempt===undefined?0:cp.attempt;
 const fail=code=>{throw Error(code);};
 const isObject=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
 function summary(e){const missing=[],untraced=[];for(let i=0;i<e.phase;i++){const p=e.completed.find(p=>p.index===i);if(!p)missing.push(i);else if(!Array.isArray(p.checkpoint.trace)||!p.checkpoint.trace.length)untraced.push(i);}return freeze({finished:e.phase===SEQUENCES[e.chapter].length,evidenceComplete:e.phase===SEQUENCES[e.chapter].length&&!missing.length&&!untraced.length,missingPhases:missing,missingTracePhases:untraced,authority:'not-established'});}
 function identity(e){if(!isObject(e)||e.format!==FORMAT||e.version!==VERSION||![8,9].includes(e.chapter)||e.edition!==2||!uint(e.baseSeed)||!integer(e.phase,0,SEQUENCES[e.chapter].length)||!isObject(e.context)||!Array.isArray(e.completed)||!(e.active===null||isObject(e.active)))fail('envelope_invalid');}
 function validateCheckpoint(e,index,cp,{completed=false}={}){
  identity(e);if(!integer(index,0,SEQUENCES[e.chapter].length-1)||!isObject(cp)||!integer(attempt(cp),0,10000))fail('checkpoint_invalid');
  const mechanic=SEQUENCES[e.chapter][index],seed=(e.baseSeed+index*7919)>>>0;
  if(!field.restore(cp,mechanic,4,seed))fail('checkpoint_invalid');
  if(completed&&(!cp.complete||!field.won(cp)))fail('checkpoint_incomplete');
  // Format validation is lossless and bounded; no replay/provenance claims.
  if(cp.trace!==undefined)codec.unpackTrace(cp.trace);
  return {mechanic,fieldStage:4,seed,modelVersion:cp.version,attempt:attempt(cp)};
 }
 function phaseRecord(e,index,cp,provenance,completed){if(!isObject(provenance))fail('provenance_invalid');return {index,...validateCheckpoint(e,index,cp,{completed}),checkpoint:copy(cp),provenance:copy(provenance)};}
 function validateEnvelope(e){identity(e);let prior=-1;for(const p of e.completed){if(!isObject(p)||!integer(p.index,0,e.phase-1)||p.index<=prior)fail('phase_order');const expected=phaseRecord(e,p.index,p.checkpoint,p.provenance,true);if(!equal(p,expected))fail('phase_record_invalid');prior=p.index;}
  if(e.active){if(e.phase>=SEQUENCES[e.chapter].length||e.active.index!==e.phase)fail('active_phase_invalid');if(!equal(e.active,phaseRecord(e,e.phase,e.active.checkpoint,e.active.provenance,false)))fail('phase_record_invalid');}
  // Existing codec performs recursive trace, decoded-proof and packed-proof budgets.
  codec.packProof({finale:e});return e;
 }
 function success(e,change,extras={}){validateEnvelope(e);return freeze({ok:true,candidate:freeze(copy(e)),change,summary:summary(e),persisted:false,...extras});}
 function failure(error,previous,checkpoint){return {ok:false,error:String(error?.message||error),previous,retainedCheckpoint:checkpoint,persisted:false};}
 function begin({chapter,baseSeed,context,phase=0}){try{return success({format:FORMAT,version:VERSION,chapter,edition:2,baseSeed,context:copy(context),phase,completed:[],active:null},'begin');}catch(e){return failure(e,null);}}
 function restore(value){try{return success(value,'restore');}catch(e){return failure(e,value);}}
 function traceExtends(prior,next){if(prior===undefined)return true;if(!Array.isArray(prior)||!Array.isArray(next)||next.length<prior.length)return false;
  return prior.every((row,i)=>equal(row,next[i])||(i===prior.length-1&&row[0]==='tick'&&next[i]?.[0]==='tick'&&row.length===next[i].length&&next[i][1]>=row[1]&&equal(row.slice(2),next[i].slice(2))));
 }
 function recordActive(previous,{index,checkpoint,provenance}){try{validateEnvelope(previous);if(index!==previous.phase||index>=SEQUENCES[previous.chapter].length)fail('phase_order');const active=phaseRecord(previous,index,checkpoint,provenance,false),old=previous.active;let change='active';
   if(old){if(!equal(old.provenance,active.provenance))fail('provenance_changed');if(!equal(old.checkpoint.mods??{},checkpoint.mods??{}))fail('modifiers_changed');if(old.checkpoint.version!==checkpoint.version)fail('model_version_changed');
    if(active.attempt===old.attempt){if(!traceExtends(old.checkpoint.trace,checkpoint.trace))fail('trace_regression');if(checkpoint.seconds<old.checkpoint.seconds)fail('time_regression');}
    else{if(old.checkpoint.complete)fail('retry_invalid');if(active.attempt!==old.attempt+1||!Array.isArray(checkpoint.trace)||checkpoint.trace.length||checkpoint.seconds!==0||checkpoint.complete)fail('retry_invalid');change='retry';}
   }
   return success({...copy(previous),active},change,{replacedAttempt:change==='retry'?copy(old):null});
  }catch(e){return failure(e,previous,checkpoint);}}
 function captureCompleted(previous,{index,checkpoint,provenance}){try{validateEnvelope(previous);const record=phaseRecord(previous,index,checkpoint,provenance,true),prior=previous.completed.find(p=>p.index===index);
   if(prior){if(!equal(prior,record))fail('completed_phase_conflict');return success(previous,'duplicate',{capturedIndex:index});}
   if(index!==previous.phase)fail('phase_order');
   if(previous.active){const a=previous.active;if(a.attempt!==record.attempt)fail('attempt_changed');if(!equal(a.provenance,record.provenance))fail('provenance_changed');if(!equal(a.checkpoint.mods??{},checkpoint.mods??{}))fail('modifiers_changed');if(a.checkpoint.version!==checkpoint.version)fail('model_version_changed');if(!traceExtends(a.checkpoint.trace,checkpoint.trace))fail('trace_regression');if(checkpoint.seconds<a.checkpoint.seconds)fail('time_regression');}
   return success({...copy(previous),phase:index+1,completed:[...copy(previous.completed),record],active:null},'capture',{capturedIndex:index});
  }catch(e){return failure(e,previous,checkpoint);}}
 function preparePersistence(reduction,{snapshot,targetKey,property='finaleEvidence',mode='packed',proofBase,ownerRoundtrip}={}){try{
   if(!reduction?.ok)fail('reduction_required');const e=reduction.candidate;validateEnvelope(e);
   if(!isObject(snapshot)||!['packed','raw'].includes(mode)||!['mkty_field_finale_'+e.chapter+'_v1','mkty_story_plan_'+e.chapter+'_v1'].includes(targetKey)||property!=='finaleEvidence')fail('persistence_target_invalid');
   if(typeof snapshot[targetKey]!=='string')fail('persistence_target_missing');
   const target=JSON.parse(snapshot[targetKey]);if(!isObject(target)||target.n!==e.chapter)fail('persistence_target_invalid');
   if(summary(e).finished&&targetKey!=='mkty_story_plan_'+e.chapter+'_v1')fail('final_story_target_required');
   if(targetKey==='mkty_field_finale_'+e.chapter+'_v1'&&target.seed!==e.baseSeed)fail('persistence_target_invalid');
   if(Object.hasOwn(target,property)){
    const stored=validateEnvelope(target[property]);
    if(stored.chapter!==e.chapter||stored.baseSeed!==e.baseSeed||!equal(stored.context,e.context)||stored.phase>e.phase||stored.completed.some(p=>!e.completed.some(q=>q.index===p.index&&equal(p,q))))fail('storage_evidence_conflict');
    if(stored.active){const next=e.active?.index===stored.active.index?e.active:e.completed.find(p=>p.index===stored.active.index);if(!next)fail('storage_evidence_conflict');
     if(next.attempt<stored.active.attempt||next.attempt>stored.active.attempt+1||!equal(next.provenance,stored.active.provenance)||!equal(next.checkpoint.mods??{},stored.active.checkpoint.mods??{})||next.modelVersion!==stored.active.modelVersion)fail('storage_evidence_conflict');
     if(next.attempt===stored.active.attempt&&(!traceExtends(stored.active.checkpoint.trace,next.checkpoint.trace)||next.checkpoint.seconds<stored.active.checkpoint.seconds))fail('storage_evidence_conflict');
    }
   }
   const proposed={...target,[property]:e};
   if(targetKey==='mkty_story_plan_'+e.chapter+'_v1'){
    if(typeof ownerRoundtrip!=='function')fail('storage_preservation_contract_required');
    const reread=ownerRoundtrip(copy(proposed));if(!isObject(reread)||!Object.hasOwn(reread,property)||!equal(reread[property],e))fail('owner_drops_evidence');
   }
   const value=codec.stringify(proposed,codec.LIMITS.decodedEntryBytes,'snapshot_too_large'),next={...snapshot,[targetKey]:value};
   // Both original full snapshot and proposed insertion are checked, not just the finale.
   const packedSnapshot=codec.packSnapshot(next),rawSnapshot=codec.unpackSnapshot(next);
   if(mode==='raw'&&(Object.values(rawSnapshot).some(v=>codec.utf8Bytes(v)>=codec.LIMITS.snapshotEntryBytes)||codec.utf8Bytes(codec.stringify(rawSnapshot))>codec.LIMITS.snapshotBytes))fail('snapshot_too_large');
   let proof=null,packedProof=null;if(proofBase!==undefined){if(!isObject(proofBase)||Object.hasOwn(proofBase,'finale'))fail('proof_base_invalid');proof={...copy(proofBase),finale:e};packedProof=codec.packProof(proof);if(mode==='raw')codec.stringify(proof,codec.LIMITS.transportBytes,'proof_too_large');}
   const retirementRecord=['capture','duplicate'].includes(reduction.change)?e.completed.find(p=>p.index===reduction.capturedIndex)||null:null;
   return freeze({ok:true,candidate:e,change:reduction.change,retirementRecord,summary:summary(e),persisted:false,write:{key:targetKey,value},snapshot:JSON.parse(codec.stringify(next,codec.LIMITS.decodedSnapshotBytes,'snapshot_too_large')),transportSnapshot:copy(mode==='packed'?packedSnapshot:rawSnapshot),proof,packedProof,transportProof:mode==='packed'?packedProof:proof,mode});
  }catch(error){return {ok:false,error:String(error?.message||error),candidate:reduction?.candidate,retainedSnapshot:snapshot,persisted:false};}}
 function acknowledgePersistence(prepared,{key,value,persistent}={}){
  if(!prepared?.ok||!prepared.write)return {ok:false,error:'prepared_write_required',persisted:false};
  if(persistent!==true||key!==prepared.write.key||value!==prepared.write.value)return {ok:false,error:'persistence_unconfirmed',candidate:prepared.candidate,persisted:false};
  // Caller supplies an actual read-back and persistence state. This function does no IO.
  return freeze({ok:true,candidate:prepared.candidate,summary:prepared.summary,persisted:true,mayRetireCapturedCheckpoint:prepared.change==='capture',authority:'not-established'});
 }
 function acknowledgeRetirementRecovery(prepared,{key,value,persistent,source}={}){
  const acknowledged=acknowledgePersistence(prepared,{key,value,persistent});
  if(!acknowledged.ok)return {...acknowledged,mayRetireCapturedCheckpoint:false,retainedSource:source};
  try{
   const e=prepared.candidate,record=prepared.retirementRecord;
   if(prepared.change!=='duplicate'||!record)fail('duplicate_capture_required');
   if(!isObject(source)||source.chapter!==e.chapter||source.baseSeed!==e.baseSeed||source.phase!==record.index||!isObject(source.context)||!equal(source.context,e.context))fail('retirement_source_mismatch');
   const actual=phaseRecord(e,source.phase,source.checkpoint,source.provenance,true);
   if(!equal(actual,record))fail('retirement_source_mismatch');
   return freeze({...acknowledged,mayRetireCapturedCheckpoint:true,retirementRecovery:true,retirementScope:{chapter:e.chapter,baseSeed:e.baseSeed,phase:record.index,context:copy(e.context),checkpoint:copy(record.checkpoint),provenance:copy(record.provenance)},authority:'not-established'});
  }catch(error){return {ok:false,error:String(error?.message||error),candidate:prepared.candidate,persisted:true,mayRetireCapturedCheckpoint:false,retainedSource:source,authority:'not-established'};}
 }
 function checkTransportEnvelope(body){try{const serialized=codec.stringify(body,codec.LIMITS.transportBytes,'body_too_large');return freeze({ok:true,serialized,bytes:codec.utf8Bytes(serialized),sent:false});}catch(error){return {ok:false,error:String(error?.message||error),retainedBody:body,sent:false};}}
 return Object.freeze({FORMAT,VERSION,SEQUENCES,begin,restore,recordActive,captureCompleted,preparePersistence,acknowledgePersistence,acknowledgeRetirementRecovery,checkTransportEnvelope,validateCheckpoint,summary});
};
