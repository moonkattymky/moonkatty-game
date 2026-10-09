import Plan from './models/story-plan.mjs';
import Field from './models/field-model.mjs';
import Board from './models/mission-rules.mjs';
import Flight from './models/expedition-model.mjs';
import Codec from './models/trace-codec.mjs';

// Saves are untrusted resume data, never evidence for rewards. Wallet/identity/pending
// operations cannot be written through this API. Revisions prevent silent lost updates.
const saveKey=/^mkty_(story_(plan_[1-9]_v1|history_[1-9])|operations_[1-9]_v1|campaign_checkpoint_[1-9]|field_finale_[89]_v1|legacy_v1|current_chapter|life1_(memory_code|code_[a-z_]+)|life3_(memory_verified|code_[a-z_]+|hint_[a-z_]+)|life9_coordinates|reactor5_checkpoint_v2|liftoff6_checkpoint_v1|expeditions_v1)$/;
export function cleanSnapshot(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('snapshot');
 const out={};for(const [k,v] of Object.entries(value))if(saveKey.test(k)){
  if(typeof v!=='string')throw Error('snapshot');
  out[k]=v;
 }
 // Decode and canonicalize before the compare-and-swap. Never acknowledge a
 // partial save, strip replay evidence, or store expanded traces by accident.
 return snapshotTransport(out,true);
}
function snapshotTransport(snapshot,packed){
 try{return packed?Codec.packSnapshot(snapshot):Codec.unpackSnapshot(snapshot);}
 catch(e){throw Error(/too_large/.test(String(e?.message))?'snapshot_too_large':'snapshot_transport_invalid');}
}
export function validateProof(run,proof){
 // Packing is transport only. Every replay below still uses all original rows,
 // with decoded budgets checked before any physics/action replay can begin.
 if(proof!==undefined&&proof!==null){
  try{proof=Codec.unpackProof(proof);}
  catch(e){throw Error(/too_large/.test(String(e?.message))?'proof_too_large':'proof_transport_invalid');}
 }
 if(run&&(run.challenge_version!==2||run.edition!==2))throw Error('route_upgrade_required');
 if(!run||!proof||proof.route!==run.route||!Array.isArray(proof.tasks)||proof.tasks.length!==8)throw Error('proof_required');
 const p=Plan.fresh(run.life,Number(run.seed),run.edition),plan=Plan.plan(run.life,run.edition),seen=new Set();
 for(const item of proof.tasks){
  if(!Number.isInteger(item?.id)||item.id<0||item.id>7||seen.has(item.id)||!Number.isInteger(item.attempt)||item.attempt<0||item.attempt>10000)throw Error('proof');
  const task=plan.steps[item.id],seed=Plan.seedFor(p,item.id,item.attempt),s=item.state;
  if(!s||!task.requires.every(i=>seen.has(i)))throw Error('proof');
  if(task.kind==='field'){
   const checked=Field.restore(s,run.life,task.fieldStage,seed);
   if(!checked?.complete||!Field.won(checked))throw Error('proof');
   const replay=Field.create(run.life,task.fieldStage,seed,s.mods);
   replayTrace(s.trace,(row)=>Field.act(replay,row[1],row[2]),(row)=>Field.tick(replay,1/60,{x:row[2],y:row[3]}));
   if(!Field.won(replay)||!replay.complete||replay.failed)throw Error('proof');
  }else if(task.kind==='board'){
   if(s.n!==task.board||s.round!==task.round||s.seed!==seed||!s.confirmed)throw Error('proof');
   const b=Board.board(task.board,task.round,seed);if(!Board.validate(b,s.input)||!Board.solved(b,s.input))throw Error('proof');
  }else{
   const checked=Flight.restore(s),r=checked?.run;
   if(!r||r.seed!==seed||r.type!==task.contract||r.tier!==task.tier||r.phase!=='result'||!r.report?.success||!Flight.ready(r)||Flight.distance(r.ship,Flight.BASE)>=105)throw Error('proof');
   const profile=Flight.profile();profile.upgrades.hull=run.life>=7?2:run.life>=4?1:0;profile.upgrades.scanner=run.life>=6?1:0;
   const replay=Flight.create(seed,task.contract,task.tier,profile);if(run.life<=2)replay.ship.invulnerable=2;
   replayTrace(s.trace,row=>{if(!['scan','emp','repair','strip'].includes(row[1]))throw Error('proof');Flight.action(replay,profile,row[1]);},row=>Flight.step(replay,profile,{x:row[2],y:row[3],boost:row[4]===true,action:row[5]===true},.02));
   if(replay.phase!=='result'||!replay.report?.success||!Flight.ready(replay)||Flight.distance(replay.ship,Flight.BASE)>=105)throw Error('proof');
  }
  seen.add(item.id);
 }
 return true;
}
function replayTrace(trace,act,tick){
 if(!Array.isArray(trace)||!trace.length||trace.length>25000)throw Error('proof');let steps=0;
 for(const row of trace){if(!Array.isArray(row))throw Error('proof');
  if(row[0]==='act'){if(typeof row[1]!=='string'||row[1].length>24)throw Error('proof');act(row);}
  else if(row[0]==='tick'){if(!Number.isInteger(row[1])||row[1]<1||!Number.isFinite(row[2])||!Number.isFinite(row[3])||Math.abs(row[2])>1||Math.abs(row[3])>1||(steps+=row[1])>200000)throw Error('proof');for(let i=0;i<row[1];i++)tick(row);}
  else throw Error('proof');
 }
}
export function createCampaign({rpc,pace,clock}){
 return {
  async open(player,body){
   const life=Number(body.life);if(!Number.isInteger(life)||life<1||life>9)throw Error('life');
   if(life>player.story_life)await pace.assertUnlocked(player,life);
   // Clients never choose their challenge, including on explicit restarts.
   // The RPC also generates its own random seed, so an older handler cannot
   // accidentally bless a caller-selected challenge after the migration.
   if(body.reset===true){
    if(typeof body.previous_route!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.previous_route))throw Error('route_changed');
    return rpc('mkty_campaign_restart',{p_id:player.telegram_id,p_life:life,p_previous_route:body.previous_route});
   }
   return rpc('mkty_campaign_route',{p_id:player.telegram_id,p_life:life,p_seed:crypto.getRandomValues(new Uint32Array(1))[0],p_edition:2});
  },
  async verify(player,life,proof){
   const run=await rpc('mkty_campaign_route',{p_id:player.telegram_id,p_life:life});
   if(run&&(run.challenge_version!==2||run.edition!==2))throw Error('route_upgrade_required');
   if(run?.verified_at)return run.route; // Retrying a previously verified completion is safe.
   validateProof(run,proof);
   // Server time is only an additional bound, not proof of human play. Model
   // validation is mandatory even when this elapsed-time check has passed.
   if(clock().getTime()-Date.parse(run.started_at)<30000)throw Error('too_fast');
   await rpc('mkty_campaign_verified',{p_id:player.telegram_id,p_life:life,p_route:run.route});
   return run.route;
  },
  async cloud(player,body,{packed=false}={}){
   let result;
   if(body.snapshot===undefined)result=await rpc('mkty_cloud',{p_id:player.telegram_id});
   else{
    if(!Number.isSafeInteger(body.revision)||body.revision<0)throw Error('snapshot');
    const snapshot=cleanSnapshot(body.snapshot);
    result=await rpc('mkty_cloud',{p_id:player.telegram_id,p_expected:body.revision,p_snapshot:snapshot});
   }
   if(!Number.isSafeInteger(result?.revision)||result.revision<0||
      (body.snapshot!==undefined&&!result.conflict&&result.revision<=body.revision))throw Error('snapshot');
   // Old clients must never download a packed trace they cannot replay. This
   // also applies to the authoritative snapshot returned by a CAS conflict.
   if(result.snapshot!==undefined)return {...result,snapshot:snapshotTransport(result.snapshot,packed)};
   return result;
  }
 };
}
