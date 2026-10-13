// SOURCE ONLY. Pure first-day DEMO check-in projection for the two-action fixture.
// No persistent storage, DOM, callback, user-code evaluation or global mutation.
// Source declarations below are byte-pinned by the portable parity test. The
// caller owns all resource reservations and must discard rejected projections.
import {exact,fail} from './contract.mjs';
import {measureFinaleData} from './finale-context-v1.mjs';
export const SHARED_DAILY_LIMIT=4096; // UTF-16 representation bytes, not UTF-8.
export const SHARED_DAILY_SOURCE_SHA256='37057554f05ddbd593734bd9390e056970b5267918b63491d292b5d227eebddb';
const NativeDate=Date;
const refuse=reason=>fail('shared-daily-'+reason);
function boundedText(text){
  if(typeof text!=='string'||text.length*2>SHARED_DAILY_LIMIT)refuse('limit');
  return text.length*2;
}
// Raw code units can contain lone surrogates whose canonical JSON spelling is
// six times larger. Refuse that expansion before making a second parsed graph
// or allocating serialized text. Prototype-named JSON data stays ordinary data.
// The first graph can measure up to6x raw bytes on rejection; caller's64KiB
// workspace covers it before any second graph. Structural bounds below cannot
// exclude finite JSON that fits2048 raw code units; nonfinite parsed numbers
// are outside this ordinary-data fixture and refuse without normalization.
function boundedData(value){
  try{return measureFinaleData([value],SHARED_DAILY_LIMIT,{restrictedKeys:false,nodes:2048,depth:2048,keys:2048,array:2048});}
  catch(error){if(error.message==='finale-context-limit')refuse('limit');refuse('object');}
}
function fixedDay(day){
  if(typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day))refuse('day');
  const time=NativeDate.parse(day+'T00:00:00Z');
  if(!Number.isFinite(time)||new NativeDate(time).toISOString().slice(0,10)!==day)refuse('day');
  return time;
}
function parsed(text){
  boundedText(text);let value;try{value=JSON.parse(text);}catch{refuse('json');}
  if(!value||Object.getPrototypeOf(value)!==Object.prototype)refuse('object');
  boundedData(value);return value;
}
function makeDemo(dailyText,points,isLocked,day){
  const time=fixedDay(day),values=new Map([['mkty_daily_demo',dailyText],['mkty_points',String(points)],['mkty_life9',isLocked?'complete':null]]);
  const localStorage=Object.freeze({
    getItem(key){if(!values.has(key))refuse('private-key');return values.get(key);},
    setItem(key,value){if(key!=='mkty_daily_demo'&&key!=='mkty_points')refuse('private-key');
      if(typeof value!=='string')refuse('private-value');
      if(key==='mkty_daily_demo')boundedText(value);else if(value.length>32)refuse('limit');values.set(key,value);}
  });
  // These bindings stay private for the complete synchronous call. No ambient
  // Date/storage replacement is performed, even briefly or on an exception.
  class Date extends NativeDate {constructor(...args){super(...(args.length?args:[time]));}static now(){return time;}}
  const $=()=>null;
 const SCALE = [3,5,7,10,12,15,25], CIPHER_POINTS = 15, MAX_ATTEMPTS = 5;
 const utcDay = (d = Date.now()) => new Date(d).toISOString().slice(0, 10);
 const dayNum = s => Math.floor(Date.parse(s + 'T00:00:00Z') / 864e5);
 const isoWeek = s => { const d = new Date(s + 'T00:00:00Z'); const wd = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - wd + 3); const y = d.getUTCFullYear(); const f = new Date(Date.UTC(y, 0, 4)); return y + '-W' + String(1 + Math.round(((d - f) / 864e5 - 3 + ((f.getUTCDay() + 6) % 7)) / 7)).padStart(2, '0'); };
 const locked = () => localStorage.getItem('mkty_life9') === 'complete';
 function demo() {
  let d;try{d=JSON.parse(localStorage.getItem('mkty_daily_demo')||'{}');}catch{}
  if(!d||typeof d!=='object'||Array.isArray(d))d={};
  d.attempts=Number.isInteger(d.attempts)?Math.max(0,Math.min(MAX_ATTEMPTS,d.attempts)):0;
  d.streak=Number.isSafeInteger(d.streak)&&d.streak>=0?d.streak:0;
  d.solved=d.solved===true;d.codes=Array.isArray(d.codes)?d.codes.filter(x=>typeof x==='string'):[];
  if(typeof d.last_day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(d.last_day)||!Number.isFinite(dayNum(d.last_day)))delete d.last_day;
  return d;
 }
 function saveDemo(d) { localStorage.setItem('mkty_daily_demo', JSON.stringify(d)); }
 function demoPoints(n) { if (locked() || n <= 0) return; const p = Number(localStorage.getItem('mkty_points') || 0) + n; localStorage.setItem('mkty_points', String(p)); if ($('points')) $('points').textContent = p + ' ⭐'; }
 function demoCheckin() {
  const d = demo(), today = utcDay(); if (d.last_day === today) return { awarded: false, duplicate: true };
  const week = isoWeek(today), gap = d.last_day ? dayNum(today) - dayNum(d.last_day) : 99; let streak = 1, shield = false;
  if (gap === 1) streak = (d.streak || 0) + 1; else if (gap === 2 && d.shield_week !== week) { streak = (d.streak || 0) + 1; shield = true; d.shield_week = week; }
  d.streak = streak; d.last_day = today; saveDemo(d); const pts = SCALE[Math.min(streak, 7) - 1]; demoPoints(pts);
  return { awarded: true, points: pts, shield_used: shield };
 }
  return {normalize:demo,checkin:demoCheckin,daily:()=>values.get('mkty_daily_demo'),points:()=>Number(values.get('mkty_points'))};
}
function validateDomain(value,day,initial){
  const claimed=Object.hasOwn(value,'last_day');
  if(!Object.hasOwn(value,'cday')||!Object.hasOwn(value,'streak')||value.cday!==day||initial&&claimed)refuse('domain');
  if(claimed?(value.last_day!==day||value.streak!==1):value.streak!==0)refuse('domain');
  return claimed;
}
// Initial admission must explicitly contain cday and streak=0 and omit last_day.
// A later envelope can be only that same state or the same-day streak=1 claim.
// Other fields retain the original demo() normalization and property ordering.
// Returning measured text sizes lets the owner charge raw and serialized copies
// explicitly; these sizes do not purport to measure JS heap or object overhead.
export function validateSharedDaily(dailyText,day,{initial=false}={}){
  fixedDay(day);if(typeof initial!=='boolean')refuse('domain');
  const value=parsed(dailyText),claimed=validateDomain(value,day,initial);
  const normalized=makeDemo(dailyText,0,false,day).normalize();
  validateDomain(normalized,day,initial);boundedData(normalized);
  const normalizedText=JSON.stringify(normalized),normalizedBytes=boundedText(normalizedText);
  return Object.freeze({dailyText,normalizedText,claimed,inputBytes:dailyText.length*2,normalizedBytes});
}
export function projectSharedStreak(options){
  if(!exact(options,['dailyText','points','locked','day']))refuse('input');
  const {dailyText,points,locked,day}=options;
  if(!Number.isSafeInteger(points)||points<0||Object.is(points,-0)||typeof locked!=='boolean')refuse('points');
  validateSharedDaily(dailyText,day);
  const privateDemo=makeDemo(dailyText,points,locked,day),legacyResult=privateDemo.checkin();
  const after=privateDemo.points(),output=privateDemo.daily();
  if(!Number.isSafeInteger(after)||after<points)refuse('points');
  validateSharedDaily(output,day);
  // A fresh locked UI cannot admit a command. A previously admitted ticket can
  // reach this pure projector after the lock. Original claim/nominal points=3
  // survive, while actual delta=0 is reported independently. An owner-level
  // duplicate returns its stored receipt, not this fresh legacy duplicate result.
  return Object.freeze({dailyText:output,points:after,delta:after-points,legacyResult:Object.freeze(legacyResult)});
}
