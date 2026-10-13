// Source-only fixture format, deliberately not a production completion decoder.
import * as C from './contract.mjs';
export const SYNTHETIC_LIMIT=Object.freeze({bytes:196608,summary:4096,paddingByte:120});
const HEADER=Object.freeze([65,82,67,72,73,86,69,49]);

// Exact JSON UTF-8 size without building escaped strings. Lone surrogates use
// JSON's six-byte escape; valid surrogate pairs stay four-byte UTF-8.
function quotedJSONSize(text){
  let n=2;
  for(let i=0;i<text.length;i++){
    const c=text.charCodeAt(i);
    if(c===34||c===92||[8,9,10,12,13].includes(c))n+=2;
    else if(c<32)n+=6;
    else if(c>=0xd800&&c<=0xdbff&&i+1<text.length&&text.charCodeAt(i+1)>=0xdc00&&text.charCodeAt(i+1)<=0xdfff){n+=4;i++;}
    else if(c>=0xd800&&c<=0xdfff)n+=6;
    else n+=c<128?1:c<2048?2:3;
  }
  return n;
}
// Exact ordinary data avoids getters, custom serialization and arbitrary graphs.
export function describeSyntheticSummary(value){
  if(!C.exact(value,['version','resultId','completedSteps','label'])||value.version!==1||
    !C.str(value.resultId,128)||!value.resultId.length||!C.int(value.completedSteps)||!C.str(value.label,2048))C.fail('summary-invalid');
  const length=C.utf8Size('{"version":1,"resultId":,"completedSteps":,"label":}')+
    quotedJSONSize(value.resultId)+String(value.completedSteps).length+quotedJSONSize(value.label);
  if(length>SYNTHETIC_LIMIT.summary)C.fail('summary-limit');
  const summary=Object.freeze({version:1,resultId:value.resultId,completedSteps:value.completedSteps,label:value.label});
  const text=JSON.stringify(summary);
  if(C.utf8Size(text)!==length)C.fail('summary-invalid');
  return {summary,text,length};
}

// Bound the fixed descriptor BEFORE the existing general serializer allocates.
// With two fixed components, empty note, and <=128-byte scope/run, even all
// escaped identifiers fit the existing 4096-byte descriptor slot.
export function describeSyntheticDescriptor(value){
  if(!C.exact(value,['format','scope','run','kind','model','components','note'])||value.format!==C.FORMAT||
    !C.str(value.scope,128)||!value.scope.length||!C.str(value.run,128)||!value.run.length||
    value.kind!=='synthetic-completion'||value.model!=='synthetic-completion-v1'||value.note!=='')C.fail('synthetic-admission');
  const parts=value.components;
  if(!Array.isArray(parts)||Object.getPrototypeOf(parts)!==Array.prototype||parts.length!==2||Reflect.ownKeys(parts).length!==3||
    ![0,1].every(i=>Object.hasOwn(Object.getOwnPropertyDescriptor(parts,String(i))||{},'value')))C.fail('synthetic-admission');
  for(let i=0;i<2;i++)if(!C.exact(parts[i],['name','encoding','length'])||parts[i].name!==(i===0?'summary':'padding')||
    parts[i].encoding!=='utf8'||!C.int(parts[i].length)||parts[i].length<1||
    parts[i].length>(i===0?SYNTHETIC_LIMIT.summary:SYNTHETIC_LIMIT.bytes))C.fail('synthetic-admission');
  return C.describe(value);
}

// Fixed, pure, in-place admission. No decoding, padding encoding, whole-byte copy,
// retention or caller-supplied predicate; the private summary encoding is reused.
export function admitSyntheticCompletion(bytes,descriptor,summaryBytes){
  C.boundedBytes(bytes,SYNTHETIC_LIMIT.bytes);C.boundedBytes(summaryBytes,SYNTHETIC_LIMIT.summary);
  const d=describeSyntheticDescriptor(descriptor),parts=d.value.components;
  if(d.value.kind!=='synthetic-completion'||d.value.model!=='synthetic-completion-v1'||d.value.note!==''||parts.length!==2||
    parts[0].name!=='summary'||parts[1].name!=='padding'||parts.some(p=>p.encoding!=='utf8')||
    parts[0].length!==summaryBytes.length||parts[1].length<1||bytes.length!==d.total)C.fail('synthetic-admission');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(bytes.length<29||HEADER.some((b,i)=>bytes[i]!==b)||view.getUint32(8,true)!==2)C.fail('synthetic-admission');
  let offset=12;
  for(let i=0;i<2;i++){
    const n=parts[i].length;
    if(offset+8>bytes.length||view.getBigUint64(offset,true)!==BigInt(n))C.fail('synthetic-admission');
    offset+=8;if(offset+n>bytes.length)C.fail('synthetic-admission');
    for(let j=0;j<n;j++)if(bytes[offset+j]!== (i===0?summaryBytes[j]:SYNTHETIC_LIMIT.paddingByte))C.fail('synthetic-admission');
    offset+=n;
  }
  if(offset!==bytes.length)C.fail('synthetic-admission');
  return true;
}

// Fixture construction is caller-owned and is outside the gate's ownership budget.
// It creates one framed artifact directly, never a capture-sized padding string.
export function makeSyntheticCompletion({scope,run,summary,totalBytes=SYNTHETIC_LIMIT.bytes}){
  const s=describeSyntheticSummary(summary),padding=totalBytes-28-s.length;
  if(!C.int(totalBytes)||totalBytes>SYNTHETIC_LIMIT.bytes||padding<1)C.fail('synthetic-size');
  const descriptor={format:C.FORMAT,scope,run,kind:'synthetic-completion',model:'synthetic-completion-v1',
    components:[{name:'summary',encoding:'utf8',length:s.length},{name:'padding',encoding:'utf8',length:padding}],note:''};
  describeSyntheticDescriptor(descriptor);
  const bytes=new Uint8Array(totalBytes),view=new DataView(bytes.buffer);
  bytes.set(HEADER);view.setUint32(8,2,true);view.setBigUint64(12,BigInt(s.length),true);
  bytes.set(C.utf8(s.text),20);view.setBigUint64(20+s.length,BigInt(padding),true);
  bytes.fill(SYNTHETIC_LIMIT.paddingByte,28+s.length);
  return {descriptor,bytes,summary:s.summary};
}
