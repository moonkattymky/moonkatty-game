// SOURCE ONLY. In-page retired chapter-8 integrity, assuming SHA-256 collision
// resistance. Neither literal retained-string equality nor gameplay authority.
import * as C from './contract.mjs';
import {requirePhaseBudget} from './phase-budget.mjs';
const KEY='mkty_story_plan_8_v1',MAX=65536,CHUNK=32768,HELPER=C.LIMIT.hashInput;
// Fixed ASCII framing, LE uint32 fields and fixed chunk boundaries are versioned.
// Init: DOMAIN, tag=0, session, totalBytes, chunkBytes.
// Link: DOMAIN, tag=1, session, totalBytes, ordinal, offsetBytes, lengthBytes,
// previous SHA-256's 32 bytes, then this chunk's exact UTF-16LE code units.
const DOMAIN='MKTY_RETIRED_STORY_UTF16LE_SHA256_V1\0'+KEY+'\0';
// Weak associations contain only bounded numbers, never a retired string,
// caller wrapper, context, account closure, or previous digest history.
const witnesses=new WeakMap(),sessions=new WeakMap();
let nextSession=0,busy=false;
const status=(value,reason)=>Object.freeze({status:value,...(reason?{reason}:{})});
const stale=()=>C.fail('witness-stale');
const idleLabels=new Set(['metadata','adapter','raw-capsule','context-retained','post-target']);
const code=e=>{try{const d=Object.getOwnPropertyDescriptor(e,'message');return d&&Object.hasOwn(d,'value')?d.value:'';}catch{return '';}};
function options(input,verify){
  const keys=verify?['witness','readNative','budget','current']:['key','text','budget','current'];
  if(!C.exact(input,Object.hasOwn(input||{},'crypto')?[...keys,'crypto']:keys))C.fail('witness-input');
  // All mutable caller fields, including witness primitives, are captured before
  // the first observer or current hook. No full string is placed in metadata.
  const {budget,current,crypto=globalThis.crypto}=input;
  if(typeof current!=='function')C.fail('witness-input');
  if(verify){
    const {witness,readNative}=input;
    if(!C.exact(witness,['key','length','digest'])||!Object.isFrozen(witness)||typeof readNative!=='function')C.fail('witness-input');
    const {key,length,digest}=witness,association=witnesses.get(witness);
    if(key!==KEY||!C.int(length)||length>MAX||length%2||!C.hex(digest)||!association||sessions.get(budget)!==association)C.fail('witness-input');
    return {budget,current,crypto,key,length,digest,session:association,readNative,text:null};
  }
  const {key,text}=input;
  if(key!==KEY||typeof text!=='string'||text.length*2>MAX)C.fail('witness-input');
  return {budget,current,crypto,key,length:text.length*2,text};
}
async function run(input,verify){
  // Realm-wide, including different accounts and synchronous observer reentry.
  // This fence stays held until the last native promise and all releases settle.
  if(busy)return status('busy','witness-busy');busy=true;
  let o=null,account=null,baseline=null,text=null,chunk=null,frame=null,rawDigest=null;
  let result=null,phase='setup';const owned=Object.create(null);
  function current(){if(o.current()!==true)stale();}
  function slots(){
    const s=account.snapshot();
    if(s.ceiling!==1016832||Object.keys(s.reservations).length!==Object.keys(baseline).length||
      Object.keys(baseline).some(k=>s.reservations[k]!==baseline[k]+(owned[k]||0)))C.fail('witness-budget');
  }
  function reserve(label,n){
    slots();owned[label]=n;
    // A reservation observer may throw after the real account acquired its slot.
    // Cleanup consults its bounded scalar before releasing, including this case.
    account.reserve(label,n);slots();account.allocate(label,n);slots();
  }
  function release(label){
    const n=owned[label];if(!n)return;
    const actual=account.snapshot().reservations[label],base=baseline[label];
    delete owned[label];
    if(actual===base+n)account.release(label,n);
    else if(actual!==base)C.fail('witness-budget');
  }
  function clean(){
    // Drop every full value BEFORE observers can see its reservation released.
    chunk=null;frame=null;rawDigest=null;
    let failure=null;
    for(const label of ['helper-hash','helper-framing','witness-chunk'])try{release(label);}catch(e){failure ||= e;}
    if(failure)throw failure;
  }
  try{
    o=options(input,verify);input=null;text=o.text;o.text=null;
    // Snapshot the capability methods too; observer mutation cannot redirect an
    // already admitted operation to an uncharged account or another digest.
    const b=o.budget,methods={};
    for(const name of ['reserve','release','allocate','event','snapshot']){const fn=b?.[name];if(typeof fn!=='function')C.fail('budget-capability');methods[name]=fn.bind(b);}
    account=requirePhaseBudget(methods);baseline=account.snapshot().reservations;
    if(Object.keys(baseline).some(k=>baseline[k]&&!idleLabels.has(k))||
      (!verify&&baseline['post-target']!==MAX))C.fail('witness-budget');
    const subtle=o.crypto?.subtle,digest=subtle?.digest;
    if(typeof digest!=='function')C.fail('witness-crypto');
    current();slots();
    if(!verify){
      let session=sessions.get(b);
      if(session===undefined){if(nextSession===0xffffffff)C.fail('witness-session-limit');session=++nextSession;sessions.set(b,session);}
      o.session=session;
    }else{
      reserve('witness-read',MAX);current();slots();phase='read';
      try{text=await o.readNative(KEY);}finally{current();slots();}
      if(typeof text!=='string'||text.length*2!==o.length||text.length*2>MAX){result=status('mismatch','witness-length');}
    }
    if(!result){
      let previous=null,offset=0,ordinal=0;
      // Even empty text has a domain/key/session/total-bound initialization hash.
      for(let init=true;init||offset<o.length;init=false){
        const size=init?0:Math.min(CHUNK,o.length-offset),header=DOMAIN.length+1+(init?12:20+32),bytes=header+size;
        phase='setup';
        if(size){
          reserve('witness-chunk',CHUNK);chunk=new Uint8Array(size);
          for(let i=0;i<size;i+=2){const unit=text.charCodeAt((offset+i)/2);chunk[i]=unit&255;chunk[i+1]=unit>>>8;}
        }
        reserve('helper-framing',HELPER);frame=new Uint8Array(bytes);
        let p=0;for(;p<DOMAIN.length;p++)frame[p]=DOMAIN.charCodeAt(p);frame[p++]=init?0:1;
        let view=new DataView(frame.buffer);
        for(const n of (init?[o.session,o.length,CHUNK]:[o.session,o.length,ordinal,offset,size])){view.setUint32(p,n,true);p+=4;}
        if(!init){for(let i=0;i<32;i++)frame[p++]=parseInt(previous.slice(i*2,i*2+2),16);frame.set(chunk,p);}
        view=null;reserve('helper-hash',HELPER);current();slots();phase='hash';
        try{rawDigest=await digest.call(subtle,'SHA-256',frame);}finally{current();slots();}
        if(!(rawDigest instanceof ArrayBuffer)||rawDigest.byteLength!==32)C.fail('witness-crypto');
        previous='';for(const byte of new Uint8Array(rawDigest))previous+=byte.toString(16).padStart(2,'0');
        clean();current();slots();if(!init){offset+=size;ordinal++;}
      }
      if(verify)result=previous===o.digest?status('verified'):status('mismatch','witness-digest');
      else{result=Object.freeze({key:KEY,length:o.length,digest:previous});witnesses.set(result,o.session);}
    }
  }catch(e){
    const reason=code(e);
    result=reason==='witness-stale'?status('stale',reason):
      status((phase==='read'||phase==='hash')&&!['witness-budget','budget-lifetime','allocation-unreserved'].includes(reason)?'retry':'refused',
        phase==='read'?'witness-read-failed':phase==='hash'?'witness-hash-failed':reason||'witness-refused');
  }finally{
    input=null;text=null;if(o)o.text=null;
    try{clean();release('witness-read');if(baseline)slots();}catch{result=status('refused','witness-budget');}
    if(o&&result?.status!=='stale')try{current();}catch{result=status('stale','witness-stale');}
    o=null;busy=false;
  }
  return result;
}
// Both return promises. Derive requires the caller's already owned, validated,
// directly compared 65,536-byte post-target slot. Witness.length is BYTE length.
// Keep the exact frozen witness object and its original account in this page.
export const deriveRetiredStoryWitness=input=>run(input,false);
export const verifyRetiredStoryWitness=input=>run(input,true);
