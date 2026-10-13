// Source-only archive contract. Native WebCrypto, no persistence or gameplay authority.
export const LIMIT = Object.freeze({payload:65536,metadata:4096,page:65536,positions:16,
  quota:8388608,captures:128,head:4096,segment:4096,index:2048,counters:384,
  request:69632,hashInput:66048,transient:393216});
export const ZERO='0'.repeat(64), FORMAT='archive-bytes-v1';
export const own=(x,k)=>Object.hasOwn(x,k);
export const fail=reason=>{throw Error(reason);};
export const int=x=>Number.isSafeInteger(x)&&x>=0;
export const add=(...xs)=>{let n=0;for(const x of xs){if(!int(x)||!Number.isSafeInteger(n+x))fail('counter-overflow');n+=x;}return n;};
// Requests/records are plain data, never accessor-backed objects or custom arrays.
export const exact=(x,keys)=>!!x&&Object.getPrototypeOf(x)===Object.prototype&&Reflect.ownKeys(x).length===keys.length&&keys.every(k=>{const p=Object.getOwnPropertyDescriptor(x,k);return p&&p.enumerable&&own(p,'value');});
const dataArray=a=>Array.isArray(a)&&Object.getPrototypeOf(a)===Array.prototype&&Reflect.ownKeys(a).length===a.length+1&&Array.from({length:a.length},(_,i)=>Object.getOwnPropertyDescriptor(a,String(i))).every(p=>p&&own(p,'value'));
export function utf8Size(s){let n=0;for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(c<128)n++;else if(c<2048)n+=2;else if(c>=0xd800&&c<=0xdbff&&i+1<s.length&&s.charCodeAt(i+1)>=0xdc00&&s.charCodeAt(i+1)<=0xdfff){n+=4;i++;}else n+=3;}return n;}
export const str=(s,max=4096)=>typeof s==='string'&&s.length<=max&&utf8Size(s)<=max;
export const hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
export const utf8=s=>new TextEncoder().encode(s);
export const equalBytes=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
const typedPrototype=Object.getPrototypeOf(Uint8Array.prototype);
const typedGet=Object.fromEntries(['length','buffer','byteOffset','byteLength'].map(k=>[k,Object.getOwnPropertyDescriptor(typedPrototype,k).get]));
export function boundedBytes(p,max=LIMIT.payload){
  if(!(p instanceof Uint8Array))fail('payload-limit');
  // Typed-array size fields can be shadowed with own/prototype properties. Never trust them.
  let length,buffer,offset,bytes;try{length=typedGet.length.call(p);buffer=typedGet.buffer.call(p);offset=typedGet.byteOffset.call(p);bytes=typedGet.byteLength.call(p);}catch{fail('payload-limit');}
  if(length<1||length>max||!(buffer instanceof ArrayBuffer))fail('payload-limit');
  for(let proto=p;proto&&proto!==typedPrototype;proto=Object.getPrototypeOf(proto)){
    if(Object.keys(typedGet).some(k=>own(proto,k)))fail('payload-view-invalid');
  }
  try{new Uint8Array(buffer,offset,bytes);}catch{fail('payload-detached');}return p;
}
export function describe(d){
  if(!exact(d,['format','scope','run','kind','model','components','note'])||d.format!==FORMAT||
    !['scope','run','kind','model'].every(k=>str(d[k],128)&&d[k].length)||!str(d.note)||
    !Array.isArray(d.components)||d.components.length<1||d.components.length>8||!dataArray(d.components))fail('descriptor-invalid');
  let total=12;for(const c of d.components){
    if(!exact(c,['name','encoding','length'])||!str(c.name,128)||!c.name.length||
      !['utf8','utf16le','opaque'].includes(c.encoding)||!int(c.length))fail('component-invalid');total=add(total,8,c.length);
  }
  if(total>LIMIT.quota)fail('artifact-limit');const text=JSON.stringify(d),bytes=utf8Size(text);
  if(bytes>LIMIT.metadata)fail('metadata-limit');return {text,value:JSON.parse(text),bytes,total};
}
export async function hash(bytes,crypto=globalThis.crypto,account=null){
  const n=typeof bytes==='string'?utf8Size(bytes):bytes.byteLength;
  if(n>LIMIT.hashInput)fail('hash-input-limit');account?.reserveHash(n,typeof bytes==='string');
  try{const input=typeof bytes==='string'?utf8(bytes):bytes;account?.hash(n);
    const out=await crypto.subtle.digest('SHA-256',input);return Array.from(new Uint8Array(out),b=>b.toString(16).padStart(2,'0')).join('');
  }finally{account?.releaseHash(n,typeof bytes==='string');}
}
export async function descriptor(value,crypto=globalThis.crypto,account=null){const d=describe(value);return {...d,binding:await hash(d.text,crypto,account)};}
// Base64 encoding is byte framing only; SHA-256 is always native WebCrypto.
const B64='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
export function base64url(bytes){let s='';for(let i=0;i<bytes.length;i+=3){const n=(bytes[i]<<16)|((bytes[i+1]||0)<<8)|(bytes[i+2]||0);s+=B64[(n>>>18)&63]+B64[(n>>>12)&63];if(i+1<bytes.length)s+=B64[(n>>>6)&63];if(i+2<bytes.length)s+=B64[n&63];}return s;}
export function unbase64url(s){if(!/^[A-Za-z0-9_-]*$/.test(s)||s.length%4===1)fail('token-invalid');const out=new Uint8Array(Math.floor(s.length*6/8));let bits=0,n=0,pos=0;for(const c of s){n=(n<<6)|B64.indexOf(c);bits+=6;if(bits>=8){bits-=8;out[pos++]=(n>>>bits)&255;}}if(base64url(out)!==s)fail('token-invalid');return out;}
export const tokenPlaceholder=(type,value)=>type+'.'+base64url(utf8(JSON.stringify(value)))+'.'+'0'.repeat(64);
export async function token(type,value,crypto=globalThis.crypto,account=null){const text=JSON.stringify(value);return type+'.'+base64url(utf8(text))+'.'+await hash(type+'\0'+text,crypto,account);}
export async function untoken(type,t,crypto=globalThis.crypto,account=null,max=2048){
  if(!str(t,max))fail('token-invalid');const p=t.split('.');if(p.length!==3||p[0]!==type||!hex(p[2]))fail('token-invalid');
  let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(unbase64url(p[1]));}catch{fail('token-invalid');}
  if(await hash(type+'\0'+text,crypto,account)!==p[2])fail('token-invalid');try{return JSON.parse(text);}catch{fail('token-invalid');}
}
export const numberToken=n=>{if(!int(n))fail('counter-overflow');return n.toString(16).padStart(14,'0');};
export async function makeHead(d,ordinal,total,root,sealed,crypto=globalThis.crypto,account=null){return {version:1,binding:d.binding,ordinal,total,root,sealed,
  token:await token('h',[d.binding,numberToken(ordinal),numberToken(total),root,sealed?1:0],crypto,account)};}
export async function headToken(t,crypto=globalThis.crypto,account=null){const a=await untoken('h',t,crypto,account);
  if(!Array.isArray(a)||a.length!==5||!hex(a[0])||!a.slice(1,3).every(x=>typeof x==='string'&&/^[a-f0-9]{14}$/.test(x))||!hex(a[3])||![0,1].includes(a[4]))fail('head-invalid');
  const ordinal=parseInt(a[1],16),total=parseInt(a[2],16);if(!int(ordinal)||!int(total))fail('head-invalid');return {binding:a[0],ordinal,total,root:a[3],sealed:!!a[4]};
}
export async function chain(d,q,payload,crypto=globalThis.crypto,account=null){
  const prefix='segment\0'+JSON.stringify([FORMAT,d.binding,q.ordinal,q.offset,q.previousRoot,payload.length])+'\0';
  const n=add(utf8Size(prefix),payload.length);if(n>LIMIT.hashInput)fail('hash-input-limit');
  // Reservation precedes framing allocation; hash() reserves native digest's copy separately.
  account?.reserve('framing',n);try{const input=new Uint8Array(n);input.set(utf8(prefix));input.set(payload,n-payload.length);return await hash(input,crypto,account);}finally{account?.release('framing',n);}
}
export function snapshotRequest(q){
  const keys=['descriptor','expectedHead','ordinal','offset','previousRoot','payload'];
  if(!exact(q,own(q||{},'seal')?[...keys,'seal']:keys))fail('request-invalid');boundedBytes(q.payload);
  if(!int(q.ordinal)||q.ordinal>=Number.MAX_SAFE_INTEGER||!int(q.offset)||!hex(q.previousRoot))fail('position-invalid');
  if(q.expectedHead!==null&&!str(q.expectedHead,2048))fail('token-invalid');
  if(own(q,'seal')&&(!exact(q.seal,['totalBytes','root'])||!int(q.seal.totalBytes)||!hex(q.seal.root)))fail('seal-invalid');
  const d=describe(q.descriptor),end=add(q.offset,q.payload.length);if(end>d.total)fail('declared-length');
  const metadataBytes=utf8Size(JSON.stringify({...q,payload:undefined}));if(metadataBytes>LIMIT.metadata)fail('metadata-limit');
  // Payload copy is performed by the adapter only after its reservation succeeds.
  return {d,end,metadataBytes,requestBytes:add(metadataBytes,q.payload.length),request:{...q,descriptor:d.value,...(own(q,'seal')?{seal:{...q.seal}}:{})}};
}
export const keyOf=(scope,run)=>JSON.stringify([scope,run]);
export const segmentKey=(key,ordinal)=>key+'#'+ordinal;
export function metadataCharges(d,sequence){const {scope,run}=d.value,key=keyOf(scope,run);
  const indexBytes=add(utf8Size(JSON.stringify(keyOf(scope,String(sequence)))),utf8Size(JSON.stringify({version:1,key,sequence})));
  return {head:add(d.bytes,d.bytes,d.bytes,LIMIT.head),index:Math.max(LIMIT.index,indexBytes),counters:add(LIMIT.counters,utf8Size(JSON.stringify(scope)))};
}
export function frame(components){
  if(!Array.isArray(components)||components.length<1||components.length>8)fail('components-invalid');let size=12;const parts=[];
  for(const c of components){if(typeof c.text!=='string'||!['utf8','utf16le'].includes(c.encoding))fail('encoding-invalid');
    const length=c.encoding==='utf8'?utf8Size(c.text):c.text.length*2;size=add(size,8,length);if(size>LIMIT.quota)fail('artifact-limit');parts.push({name:c.name,encoding:c.encoding,length});}
  if(parts.every(c=>c.length===0))fail('empty-artifact');const out=new Uint8Array(size),view=new DataView(out.buffer);out.set(utf8('ARCHIVE1'));view.setUint32(8,parts.length,true);let offset=12;
  for(let i=0;i<parts.length;i++){view.setBigUint64(offset,BigInt(parts[i].length),true);offset+=8;
    if(parts[i].encoding==='utf8')out.set(utf8(components[i].text),offset);else for(let j=0;j<components[i].text.length;j++)view.setUint16(offset+j*2,components[i].text.charCodeAt(j),true);offset+=parts[i].length;}
  return {bytes:out,components:parts,assemblyAllocatedBytes:size};
}
export function unframe(bytes,value){
  const d=describe(value);boundedBytes(bytes,LIMIT.quota);const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(bytes.length!==d.total||bytes.length<12||!equalBytes(bytes.subarray(0,8),utf8('ARCHIVE1'))||view.getUint32(8,true)!==d.value.components.length)fail('frame-invalid');
  let offset=12;const components=[];for(const c of d.value.components){if(offset+8>bytes.length||view.getBigUint64(offset,true)!==BigInt(c.length))fail('frame-length');offset+=8;
    if(offset+c.length>bytes.length||!['utf8','utf16le'].includes(c.encoding)||(c.encoding==='utf16le'&&c.length%2))fail('encoding-unsupported');
    const part=bytes.subarray(offset,offset+c.length);let text='';if(c.encoding==='utf8'){try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(part);}catch{fail('encoding-not-reversible');}if(!equalBytes(utf8(text),part))fail('encoding-not-reversible');}
    else for(let i=0;i<c.length;i+=2)text+=String.fromCharCode(view.getUint16(offset+i,true));components.push({...c,text});offset+=c.length;}
  if(offset!==bytes.length)fail('frame-length');return components;
}
