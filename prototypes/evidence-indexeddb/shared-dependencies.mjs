// SOURCE ONLY. Bounded correspondence checks copied narrowly from atomic-terminal;
// archived context/phase admission and terminal game semantics remain unchanged.
import * as C from './contract.mjs';
import * as FieldModule from '../../field-model.js';
import {describeContext,measureFinaleData,freezeFinaleData} from './finale-context-v1.mjs';
import {describeFinalePhaseDescriptor} from './finale-phase-v2.mjs';
import {validateAtomicBaseline,validateAtomicTimestamps} from './atomic-terminal-projection.mjs';
import {validateSharedDaily} from './shared-streak.mjs';
const Field=FieldModule.default||globalThis.FieldRules;
const fail=reason=>C.fail(reason||'shared-correspondence');
export function equalShared(a,b){if(Object.is(a,b))return true;
  if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
  const ka=Object.keys(a),kb=Object.keys(b);return ka.length===kb.length&&ka.every((k,i)=>k===kb[i]&&equalShared(a[k],b[k]));}
export function boundedShared(value,limit=16340){measureFinaleData([value],limit,{restrictedKeys:true});return value;}
export function copyShared(value,limit=16340){boundedShared(value,limit);return freezeFinaleData(JSON.parse(JSON.stringify(value)));}
export function sharedWorkspace(budget,work){const label='atomic-record-workspace',before=budget.snapshot().reservations[label];
  if(before)fail('budget-lifetime');
  try{budget.reserve(label,65536);budget.allocate(label,65536);return work();}
  finally{const n=budget.snapshot().reservations[label]-before;if(n>0)budget.release(label,n);}}
function pinShape(pin){
  if(!C.exact(pin,['descriptor','head'])||!C.exact(pin.head,['version','binding','ordinal','total','root','sealed','token']))fail('shared-pin');
  const d=C.describe(pin.descriptor),h=pin.head;
  if(h.version!==1||!C.hex(h.binding)||!C.hex(h.root)||h.sealed!==true||!C.int(h.ordinal)||h.total!==d.total||!C.str(h.token,2048))fail('shared-pin');
  boundedShared(pin,4096);return pin;
}
function validateGameContext(value){
  boundedShared(value,4096);
  if(!C.exact(value,['legacy','precision','modifiers'])||!C.exact(value.legacy,['version','lead','airlock','echo','decodeNoise','events'])||
    !C.exact(value.precision,['count','total']))fail('shared-game-context');
  const l=value.legacy,p=value.precision;
  if(l.version!==1||![null,'navigator','engineer','scout'].includes(l.lead)||![null,'crew','cargo'].includes(l.airlock)||
    ![null,'answer','silent'].includes(l.echo)||l.decodeNoise!==null&&!Number.isFinite(l.decodeNoise)||!l.events||Object.getPrototypeOf(l.events)!==Object.prototype||
    !C.int(p.count)||!C.int(p.total)||p.count>p.total||p.total>64)fail('shared-game-context');
  const allowed={1:['scan','antenna'],3:['shield','record'],4:['north','south'],5:['vent','keep'],6:['clear','tow'],7:['rescue','hide'],9:['wait','go']};
  if(Object.entries(l.events).some(([n,c])=>!allowed[n]?.includes(c)))fail('shared-game-context');
  const m={};if(l.lead==='navigator')m.preview=1;
  let stability=Math.min(20,p.count*2);if(l.airlock==='cargo')stability+=10;if(stability)m.stability=stability;
  if(l.echo==='answer')m.charges=1;
  const add=(k,n,max)=>{m[k]=Math.min(max,(m[k]||0)+n);};
  if(l.events[3]==='record')add('stability',5,40);if(l.events[7]==='rescue')add('stability',5,40);if(l.events[9]==='wait')add('stability',5,40);if(l.events[7]==='hide')add('charges',1,3);
  if(!equalShared(Field.cleanMods(value.modifiers),value.modifiers)||!equalShared(Field.cleanMods(m),value.modifiers))fail('shared-modifier-mismatch');
}
// Six conservatively simultaneous daily representations plus fixed scalars fit
// the existing workspace. Counts are encoded representations, never JS heap.
export function accountSharedDaily(text,day,budget,{initial=false,stage='admission',outputBytes=0}={}){
  const {inputBytes,normalizedBytes}=validateSharedDaily(text,day,{initial});
  const conservativeBytes=6*Math.max(inputBytes,normalizedBytes,outputBytes)+4096;
  if(budget.snapshot().reservations['atomic-record-workspace']!==65536||conservativeBytes>65536)fail('budget-lifetime');
  budget.allocate('atomic-record-workspace',conservativeBytes);
  budget.event('shared-daily-workspace',{stage,inputBytes,normalizedBytes,outputBytes,copies:6,scalarAllowance:4096,conservativeBytes,limit:65536});
}
export function validateSharedManifest(value,{scope,session,principal,contract},budget){
  boundedShared(value);
  if(!C.exact(value,['version','contract','principal','scope','session','contextPin','source','gameContext','baseline','entry','dailyDay','dailyText'])||
    value.version!==1||value.contract!==contract||value.scope!==scope||value.session!==session||value.principal!==principal)fail('shared-manifest');
  const e=value.entry;
  if(!C.exact(e,['origin','accountScope','initData','pendingQueueText'])||e.origin!=='new-disposable-guest'||e.accountScope!=='guest'||e.initData!==''||e.pendingQueueText!==null)fail('shared-adoption-refused');
  pinShape(value.contextPin);const d=value.contextPin.descriptor;
  if(d.scope!==scope||d.run!==`fc1:${session}:9`||d.model!=='finale-chapter-context-v1')fail('shared-context-mismatch');
  const s=value.source;
  if(!C.exact(s,['version','n','phase','seed','seconds'])||s.version!==1||s.n!==9||s.phase!==2||!Number.isInteger(s.seed)||s.seed<0||s.seed>0xffffffff||
    !Number.isFinite(s.seconds)||s.seconds<0||Object.is(s.seconds,-0))fail('shared-source');
  validateAtomicBaseline(value.baseline);
  if(value.baseline.completedAt!==null||value.baseline.points!==2100)fail('shared-adoption-refused');
  validateGameContext(value.gameContext);
  sharedWorkspace(budget,()=>accountSharedDaily(value.dailyText,value.dailyDay,budget,{initial:true}));return value;
}
export function validateSharedPhasePin(pin,scope,session){
  pinShape(pin);describeFinalePhaseDescriptor(pin.descriptor);
  if(pin.descriptor.scope!==scope||pin.descriptor.run!==`fp2:${session}:9:2`)fail('shared-phase-mismatch');return pin;
}
export function matchSharedDependencies(manifest,lease,budget){
  const s=describeContext(lease.context).summary,m=manifest.source;
  if(s.chapter!==9||s.baseSeed!==m.seed||s.session!==manifest.session||s.route!=='spatial-finale')fail('shared-context-mismatch');
  if(!lease.phase)return null;
  return sharedWorkspace(budget,()=>{
    const p=lease.phase,b=p.binding,source=JSON.parse(p.sourceText),g=manifest.gameContext;boundedShared(source,16384);
    if(!['version','n','phase','seed','seconds'].every(k=>Object.is(source[k],m[k]))||b.chapter!==9||b.phase!==2||b.mechanic!==11||
      b.baseSeed!==m.seed||b.seed!==((m.seed+2*7919)>>>0)||!equalShared(p.checkpoint.mods,g.modifiers)||
      !equalShared(b.provenance.legacyAtCapture,g.legacy)||!equalShared(b.provenance.precisionAtCapture,g.precision))fail('shared-command-mismatch');
    // New fixture evidence freezes this tuple in the earned callback before its
    // first archive await. Old phases are unsupported; never synthesize a clock.
    if(!Object.hasOwn(b.provenance,'terminalIntent'))fail('shared-terminal-intent-missing');
    return validateAtomicTimestamps(b.provenance.terminalIntent);
  });
}
