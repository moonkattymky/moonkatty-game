/* HTTP byte-budget regressions. No browser, network, or live service is used. */
const assert=require('node:assert/strict');
(async()=>{
 const {createHandler}=await import('../server/rewards/core.mjs');
 let verified=0,fetches=0;
 const handler=createHandler({url:'https://db.test',key:'test-key',verify:async()=>{verified++;throw Error('auth');},fetcher:async()=>{fetches++;throw Error('unexpected database request');}});
 const encoder=new TextEncoder();
 async function call(chunks,{length,textForbidden=true}={}){
  let pulled=0,cancelled=false;
  const stream=new ReadableStream({pull(controller){if(pulled===chunks.length){controller.close();return;}controller.enqueue(chunks[pulled++]);},cancel(){cancelled=true;}},{highWaterMark:0});
  const headers=length===undefined?{}:{'Content-Length':String(length)};
  const request=new Request('https://api.test',{method:'POST',body:stream,duplex:'half',headers});
  if(textForbidden)request.text=()=>{throw Error('must not read unbounded text');};
  const before=verified,response=await handler(request);
  return {status:response.status,body:await response.json(),pulled,cancelled,verified:verified-before};
 }
 const json=pad=>encoder.encode(JSON.stringify({initData:'x',pad}));
 const overhead=json('').byteLength;
 const exact=json('x'.repeat(400000-overhead));assert.equal(exact.byteLength,400000);
 assert.equal((await call([exact])).status,401,'exactly 400000 bytes are accepted for authentication');
 assert.equal((await call([json('x'.repeat(400001-overhead))])).status,413,'one byte over budget is rejected');
 const multi=json('é'.repeat(200000));assert(multi.byteLength>400000);
 for(const length of [undefined,1,400000]){
  const result=await call([multi.slice(0,199999),multi.slice(199999,399999),multi.slice(399999)],{length});
  assert.equal(result.status,413,'UTF-8 bytes override missing or dishonest Content-Length');
  assert.equal(result.verified,0,'oversized requests never authenticate');assert(result.cancelled);
 }
 const stopped=await call([new Uint8Array(200000),new Uint8Array(200001),new Uint8Array(50)]);
 // NUL is valid UTF-8; JSON parsing must only happen after the bounded read.
 assert.equal(stopped.status,413);assert.equal(stopped.pulled,2);assert(stopped.cancelled,'reader cancels without pulling the rest');
 const emptyFlood=await call(Array(400003).fill(new Uint8Array(0)));assert.equal(emptyFlood.status,400);assert(emptyFlood.cancelled);assert.equal(emptyFlood.pulled,400002,'zero-byte chunks cannot create unbounded work or buffered parts');
 const split=json('🐈é');
 assert.equal((await call(Array.from(split,b=>Uint8Array.of(b)))).status,401,'UTF-8 sequences may cross chunks');
 const utfBoundary=json('é'.repeat(Math.floor((400000-overhead)/2))+'x'.repeat((400000-overhead)%2));
 assert.equal(utfBoundary.byteLength,400000);assert.equal((await call([utfBoundary])).status,401);
 const declared=await call([json('small')],{length:400001});assert.equal(declared.status,413);assert.equal(declared.pulled,0);
 const prefix=encoder.encode('{"pad":"'),suffix=encoder.encode('"}');
 for(const invalid of [[0xc3,0x28],[0xed,0xa0,0x80],[0xf0,0x80,0x80,0x80]]){
  const result=await call([prefix,Uint8Array.from(invalid),suffix]);assert.equal(result.status,400);assert.equal(result.verified,0);
 }
 assert.equal((await call([prefix,Uint8Array.of(0xe2,0x82)])).status,400,'truncated UTF-8 is rejected');
 assert.equal((await call([encoder.encode('[]')])).status,400);assert.equal(fetches,0);
 console.log('PASS: streaming 400000-byte body cap, false/missing length, early cancellation, multibyte boundaries and fatal UTF-8');
})().catch(e=>{console.error(e);process.exitCode=1;});
