// SOURCE ONLY. Two fixed synthetic prerequisites, never planning or earned proof.
import * as C from './contract.mjs';
// The canonical complete record is 270 UTF-16 bytes (core is 262). The original
// operations cache can retain both parsed records across awaits; s/run alias them.
// A separate two-record scratch allowance covers a pagehide save's serialized
// argument and facade old-value read even outside the original callback lease.
export const PREPARED_OPERATIONS_BYTES=270;
export const PREPARED_OPERATIONS_CACHE_BYTES=2*PREPARED_OPERATIONS_BYTES;
export const PREPARED_OPERATIONS_SCRATCH_BYTES=2*PREPARED_OPERATIONS_BYTES;
export function preparedOperationsText(chapter,phase='core'){
  if(![8,9].includes(chapter)||!['core','complete'].includes(phase))C.fail('phase-operations-input');
  return `{"version":1,"n":${chapter},"seed":731,"round":3,"phase":"${phase}","input":null,"confirmed":false,"actions":0,"hints":0,"errors":0,"seconds":0}`;
}
// Byte equality validates the entire fixed schema, property order, numbers and
// bounds without parsing an arbitrary record or retaining a second data graph.
export function preparedOperationsPhase(text,chapter){
  if(![8,9].includes(chapter))C.fail('phase-operations-input');
  if(text===null)return null;
  if(typeof text!=='string'||text.length*2>PREPARED_OPERATIONS_BYTES)C.fail('phase-operations-prestate');
  for(const phase of ['core','complete'])if(text===preparedOperationsText(chapter,phase))return phase;
  C.fail('phase-operations-prestate');
}
