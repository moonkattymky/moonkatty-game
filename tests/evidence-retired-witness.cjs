'use strict';
// Socket-free UTF-16 witness tests only. No native storage/IDB/gameplay proof.
const assert=require('node:assert/strict'),{webcrypto,createHash}=require('node:crypto');
const KEY='mkty_story_plan_8_v1',DOMAIN=Buffer.from('MKTY_RETIRED_STORY_UTF16LE_SHA256_V1\0'+KEY+'\0','ascii');
let checks=0;const groups=[];
const eq=(a,b)=>{assert.deepStrictEqual(a,b);checks++;},ok=x=>{assert(x);checks++;};
const group=async(name,work)=>{await work();groups.push(name);};
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
// Independent Node oracle: whole diagnostic Buffers are test-only, never helper
// functional state. Buffer UTF-16LE preserves isolated surrogate code units.
function oracle(text,session){
  const words=values=>{const b=Buffer.alloc(values.length*4);values.forEach((n,i)=>b.writeUInt32LE(n,i*4));return b;};
  const bytes=Buffer.from(text,'utf16le'),frames=[Buffer.concat([DOMAIN,Buffer.from([0]),words([session,bytes.length,32768])])];
  let previous=createHash('sha256').update(frames[0]).digest();
  for(let offset=0,ordinal=0;offset<bytes.length;offset+=32768,ordinal++){
    const chunk=bytes.subarray(offset,offset+32768);
    const frame=Buffer.concat([DOMAIN,Buffer.from([1]),words([session,bytes.length,ordinal,offset,chunk.length]),previous,chunk]);
    previous=createHash('sha256').update(frame).digest();frames.push(frame);
  }
  return {digest:previous.toString('hex'),frames};
}
(async()=>{
  const W=await import('../prototypes/evidence-indexeddb/retired-story-witness.mjs'),B=await import('../prototypes/evidence-indexeddb/phase-budget.mjs');
  const derive=W.deriveRetiredStoryWitness,verify=W.verifyRetiredStoryWitness;
  function budget(observe){return B.createPhaseBudget({observe});}
  function owner(observe,base=false){const b=budget(observe);if(base){b.reserve('raw-capsule',65536);b.reserve('context-retained',65536);}b.reserve('post-target',65536);return b;}
  const idle=(b,base)=>eq(b.snapshot().reservations,base);
  const deriveArgs=(b,text,extra={})=>({key:KEY,text,budget:b,crypto:webcrypto,current:()=>true,...extra});
  const verifyArgs=(b,witness,text,extra={})=>({witness,readNative:()=>text,budget:b,crypto:webcrypto,current:()=>true,...extra});
  const recording=frames=>({subtle:{digest(algorithm,bytes){eq(algorithm,'SHA-256');frames.push(Buffer.from(bytes));return webcrypto.subtle.digest(algorithm,bytes);}}});
  await group('fixed frames and exact UTF-16 oracle, including code-unit/chunk boundaries',async()=>{
    const vectors=['','a','a\0b',' \n{"x":1}\t','\ud800','\udc00','\ufffd','\ud800x\udc00',
      'x'.repeat(16383),'x'.repeat(16384),'x'.repeat(16385),'x'.repeat(16383)+'\ud800\udc00',
      'x'.repeat(32768),'界'.repeat(32768),'🌙'.repeat(16384),'\ud800'.repeat(32768),
      'a'.repeat(16384)+'b'.repeat(16384),'b'.repeat(16384)+'a'.repeat(16384)];
    let first=true;
    for(const text of vectors){
      const b=owner(),base=b.snapshot().reservations,frames=[];
      const witness=await derive(deriveArgs(b,text,{crypto:recording(frames)}));
      ok(Object.isFrozen(witness));eq(Object.keys(witness),['key','length','digest']);eq(witness.key,KEY);eq(witness.length,text.length*2);
      const session=frames[0].readUInt32LE(DOMAIN.length+1);if(first){eq(session,1);first=false;}
      const expected=oracle(text,session);eq(witness.digest,expected.digest);eq(frames,expected.frames);idle(b,base);
      let reads=0;
      const answer=await verify(verifyArgs(b,witness,text,{readNative:key=>{eq(key,KEY);reads++;return text;}}));
      eq(answer,{status:'verified'});ok(Object.isFrozen(answer));eq(reads,1);idle(b,base);
      if(text.length){eq((await verify(verifyArgs(b,witness,text.slice(0,-1)))).status,'mismatch');
        const changed=String.fromCharCode(text.charCodeAt(0)^1)+text.slice(1);eq((await verify(verifyArgs(b,witness,changed))).reason,'witness-digest');}
    }
    const b=owner(),a=await derive(deriveArgs(b,'\ud800')),z=await derive(deriveArgs(b,'\ufffd'));
    ok(a.digest!==z.digest);eq((await verify(verifyArgs(b,a,'\ufffd'))).status,'mismatch');
    const p=await derive(deriveArgs(b,'a'.repeat(16384)+'b'.repeat(16384)));
    eq((await verify(verifyArgs(b,p,'b'.repeat(16384)+'a'.repeat(16384)))).status,'mismatch');
  });
  await group('bounds, exact keys, immutable local session association and invalid shapes',async()=>{
    const b=owner(),base=b.snapshot().reservations;
    for(const patch of [{key:'mkty_story_plan_9_v1'},{text:null},{text:'x'.repeat(32769)},{current:null},{unknown:true}]){
      eq((await derive(deriveArgs(b,'abc',patch))).status,'refused');idle(b,base);
    }
    eq((await derive(deriveArgs(budget(),'abc'))).status,'refused');
    const witness=await derive(deriveArgs(b,'abc'));let reads=0;
    for(const invalid of [{...witness},Object.freeze({...witness,key:'mkty_story_plan_9_v1'}),Object.freeze({...witness,digest:'0'.repeat(64)}),Object.freeze({...witness,length:65538})])
      eq((await verify(verifyArgs(b,invalid,'abc',{readNative:()=>{reads++;return 'abc';}}))).status,'refused');
    eq(reads,0);eq((await verify(verifyArgs(owner(),witness,'abc'))).status,'refused');
    for(const value of [null,undefined,42,'','abcd','x'.repeat(32769)])eq((await verify(verifyArgs(b,witness,value))).status,'mismatch');
    const accessor=deriveArgs(b,'abc');Object.defineProperty(accessor,'text',{enumerable:true,get(){throw Error('not-read');}});
    eq((await derive(accessor)).status,'refused');idle(b,base);
    const other=await derive(deriveArgs(owner(),'abc'));ok(other.digest!==witness.digest);
  });
  await group('no full UTF-8, parse, stringify or normalization path',async()=>{
    const b=owner(),text=' \n'+('界\ud800\udc00\udc00').repeat(8000),saved=[global.TextEncoder,global.TextDecoder,JSON.parse,JSON.stringify];
    const forbidden=()=>{throw Error('full-text-conversion');};let witness,answer;
    try{global.TextEncoder=global.TextDecoder=forbidden;JSON.parse=JSON.stringify=forbidden;
      witness=await derive(deriveArgs(b,text));answer=await verify(verifyArgs(b,witness,text));
    }finally{[global.TextEncoder,global.TextDecoder,JSON.parse,JSON.stringify]=saved;}
    ok(!!witness.digest);eq(answer.status,'verified');
    let hashes=0;eq((await verify(verifyArgs(b,witness,'x'.repeat(32769),{crypto:{subtle:{digest(){hashes++;throw Error('must-not-hash');}}}}))).status,'mismatch');eq(hashes,0);
  });
  await group('full independent current context, held native/chunk/hash ownership, exact ceiling',async()=>{
    const currentContext='雪'.repeat(32768),currentTarget='月'.repeat(32768);
    eq(currentContext.length*2,65536);eq(currentTarget.length*2,65536);ok(currentContext!==currentTarget);
    const b=owner(undefined,true),base=b.snapshot().reservations,text='界'.repeat(32768),witness=await derive(deriveArgs(b,text));
    const before=b.snapshot().live;eq(before,622592);
    let calls=0;const wait=deferred(),started=deferred(),seen=[];
    const crypto={subtle:{async digest(a,bytes){calls++;seen.push(b.snapshot());if(calls===2){started.resolve();await wait.promise;}return webcrypto.subtle.digest(a,bytes);}}};
    let reads=0;const pending=verify(verifyArgs(b,witness,text,{crypto,readNative:()=>{reads++;eq(b.snapshot().reservations['witness-read'],65536);return text;}}));
    await started.promise;
    const r=b.snapshot().reservations;eq(r['witness-read'],65536);eq(r['witness-chunk'],32768);eq(r['helper-framing']+r['helper-hash'],132096);
    eq(b.snapshot().live,852992);eq((await verify(verifyArgs(b,witness,text))).status,'busy');
    eq((await derive(deriveArgs(owner(),'parallel'))).status,'busy');eq(reads,1);
    wait.resolve();eq((await pending).status,'verified');eq(calls,3);idle(b,base);ok(seen.every(s=>s.live<=1016832));
    b.release('post-target',65536);eq((await verify(verifyArgs(b,witness,text))).status,'verified');eq(b.snapshot().live,557056);
  });
  await group('every native read/digest await rejects an epoch change, including rejected awaits',async()=>{
    const text='x'.repeat(32768),b=owner(),base=b.snapshot().reservations,witness=await derive(deriveArgs(b,text));
    for(const verifyMode of [false,true])for(const failAt of [0,1,2])for(const reject of [false,true]){
      let live=true,calls=0;const gate=deferred(),started=deferred();
      const crypto={subtle:{async digest(a,bytes){const n=calls++;if(n===failAt){started.resolve();await gate.promise;if(reject)throw Error('native-digest');}return webcrypto.subtle.digest(a,bytes);}}};
      const args=verifyMode?verifyArgs(b,witness,text,{current:()=>live,crypto}):deriveArgs(b,text,{current:()=>live,crypto});
      const pending=(verifyMode?verify:derive)(args);await started.promise;live=false;
      eq((await derive(deriveArgs(owner(),'while-stale'))).status,'busy');gate.resolve();
      eq((await pending).status,'stale');eq(calls,failAt+1);idle(b,base);
    }
    for(const reject of [false,true]){
      let live=true;const gate=deferred();
      const pending=verify(verifyArgs(b,witness,text,{current:()=>live,readNative:()=>gate.promise}));
      live=false;if(reject)gate.reject(Error('native-read'));else gate.resolve(text);
      eq((await pending).status,'stale');idle(b,base);
    }
    let reads=0;eq((await verify(verifyArgs(b,witness,text,{current:()=>false,readNative:()=>{reads++;return text;}}))).status,'stale');eq(reads,0);
  });
  await group('read/hash errors settle before read-only retry and delayed hash cannot overlap',async()=>{
    const b=owner(),base=b.snapshot().reservations,witness=await derive(deriveArgs(b,'abc'));
    eq((await verify(verifyArgs(b,witness,'abc',{readNative:()=>{throw Error('read');}}))).status,'retry');idle(b,base);
    for(const crypto of [{subtle:{digest(){throw Error('sync');}}},{subtle:{digest:()=>Promise.reject(Error('async'))}},{subtle:{digest:()=>Promise.resolve(new ArrayBuffer(33))}}]){
      eq((await verify(verifyArgs(b,witness,'abc',{crypto}))).status,'retry');idle(b,base);
      eq((await verify(verifyArgs(b,witness,'abc'))).status,'verified');
    }
    const gate=deferred();let reads=0;
    const pending=verify(verifyArgs(b,witness,'abc',{crypto:{subtle:{digest:()=>gate.promise}},readNative:()=>{reads++;return 'abc';}}));
    await Promise.resolve();eq((await verify(verifyArgs(b,witness,'abc'))).status,'busy');eq(reads,1);
    gate.reject(Error('late'));eq((await pending).status,'retry');idle(b,base);
    eq((await verify(verifyArgs(b,witness,'xyz'))).status,'mismatch');eq((await verify(verifyArgs(b,witness,'xyz'))).status,'mismatch');
    // Helpers never rebase. The manager, not this pure checker, permanently blocks
    // after mismatch even if external bytes later return to their earlier value.
    eq((await verify(verifyArgs(b,witness,'abc'))).status,'verified');
  });
  await group('observer reentry, input capture, forbidden lifetimes and failure cleanup',async()=>{
    let armed=false,args,nested=[],b;
    b=owner(event=>{if(!armed)return;if(event.type==='reserve'){
      args.text='changed';args.key='other';args.crypto=null;args.current=()=>false;
      nested.push(derive(deriveArgs(b,'reentrant')));
    }});
    const base=b.snapshot().reservations,frames=[];args=deriveArgs(b,'captured',{crypto:recording(frames)});armed=true;
    const witness=await derive(args);armed=false;ok(!!witness.digest);for(const p of nested)eq((await p).status,'busy');idle(b,base);
    eq(witness.digest,oracle('captured',frames[0].readUInt32LE(DOMAIN.length+1)).digest);
    for(const [label,n]of [['phase-workspace',327680],['private-phase',16384],['context-parse',65536],['context-restore',65536],['context-compare-read',132096],['native-read',65536],['callback-scratch',65536],['returned-page',32768],['recovery-page',16384]]){
      const x=owner();x.reserve(label,n);const before=x.snapshot().reservations;
      eq((await derive(deriveArgs(x,'x'))).status,'refused');idle(x,before);
    }
    for(const failureType of ['reserve','allocate','release']){
      let fail=true;const x=owner(event=>{if(fail&&event.label==='helper-framing'&&event.type===failureType){fail=false;throw Error('observer');}}),before=x.snapshot().reservations;
      ok(['refused','retry'].includes((await derive(deriveArgs(x,'abc'))).status));idle(x,before);
      ok(!!(await derive(deriveArgs(x,'abc'))).digest);idle(x,before);
    }
    let switched=false;const x=owner(event=>{if(event.type==='reserve'&&event.label==='helper-hash')switched=true;}),before=x.snapshot().reservations;
    eq((await derive(deriveArgs(x,'abc',{current:()=>!switched}))).status,'stale');idle(x,before);
  });
  console.log(JSON.stringify({test:'evidence-retired-witness',status:'pass',groups:groups.length,checks,groupNames:groups,
    sourceOnly:true,nativeStorage:'not-run',gameplayAuthority:false,ceiling:1016832,witnessPeak:852992,
    limitations:['SHA-256 collision-resistance assumption','In-page fixed witness only; no reload authority','Encoded representation reservations, not JavaScript heap/RSS','Manager owns irreversible mismatch blocking']}));
})().catch(error=>{console.error(error);process.exitCode=1;});
