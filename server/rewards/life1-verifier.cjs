'use strict';
/* Source-only prototype. No handler imports this verifier and no SQL policy uses it.
 * trustedRoute MUST be supplied by a trusted route lookup, never copied from body.
 * Caller owns HTTP/decompression limits and account/route binding; this function
 * accepts only an already decoded, bounded JSON string and has no I/O. */
const Model=require('../../life1-model.js');
const LIMITS=Object.freeze({movement:8192,semantic:1024,layouts:128,encodedBytes:192*1024,decodedBytes:512*1024});
const fail=code=>{const e=new Error(code);e.code=code;throw e;};
const utf8Bytes=value=>new TextEncoder().encode(value).byteLength;
function exactKeys(o,keys){return o!==null&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));}
function replayLife1(trustedRoute,body){
 let work={events:0,replayed:0,movement:0,semantic:0,layouts:0,bytes:0};
 try{
  Model.routeKey(trustedRoute);
  // No object input, compressed codecs, counts, claimed results or checkpoints.
  // String length check precedes UTF-8 allocation and JSON.parse.
  if(typeof body!=='string')fail('body-must-be-json-string');
  if(body.length>LIMITS.decodedBytes)fail('decoded-byte-limit');
  work.bytes=utf8Bytes(body);if(work.bytes>LIMITS.decodedBytes)fail('decoded-byte-limit');
  // Prototype v1 is uncompressed JSON, so encoded and decoded bytes are identical.
  if(work.bytes>LIMITS.encodedBytes)fail('encoded-byte-limit');
  let proof;try{proof=JSON.parse(body);}catch{fail('invalid-json');}
  if(!exactKeys(proof,['version','route','challenge','rules','layout','initial','events']))fail('invalid-proof-shape');
  if(proof.version!==1||proof.route!==trustedRoute.route||proof.challenge!==Model.routeKey(trustedRoute)||proof.rules!==Model.RULES||proof.layout!==Model.LAYOUT)fail('identity-mismatch');
  if(!Array.isArray(proof.initial)||proof.initial.length!==2)fail('invalid-initial-layout');
  if(!Array.isArray(proof.events)||proof.events.length>LIMITS.movement+LIMITS.semantic+LIMITS.layouts)fail('event-limit');
  let state=Model.create(trustedRoute,...proof.initial);work.layouts=1;
  // Validate the entire trace and all work budgets BEFORE replay. No truncation.
  for(const e of proof.events){Model.validateEvent(e);work.events++;if(e[0]==='frame'){if(++work.movement>LIMITS.movement)fail('movement-limit');}else if(e[0]==='layout'){if(++work.layouts>LIMITS.layouts)fail('layout-limit');}else if(++work.semantic>LIMITS.semantic)fail('semantic-limit');}
  for(const e of proof.events){const reason=Model.admissible(state,e);if(reason)fail(reason);state=Model.transition(state,e);work.replayed++;}
  return {ok:true,complete:Model.won(state),state,work};
 }catch(e){return {ok:false,complete:false,error:e.code||'invalid-proof',work};}
}
function verifyLife1(trustedRoute,body){const r=replayLife1(trustedRoute,body);return r.ok&&!r.complete?{ok:false,complete:false,error:'incomplete',work:r.work}:r;}
module.exports=Object.freeze({LIMITS,replayLife1,verifyLife1});
