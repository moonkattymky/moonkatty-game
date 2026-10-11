/* Source-owned scope: adding text to these guidance/recovery surfaces must add translations.
   This intentionally does not infer requirements from the union of locale dictionaries. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const LANGS=['ru','uk','es','pt','de','fr','it','tr','he','ar','ko','zh'];
const BUNDLES=['daily-retention','creator','leaderboard','social','pacing','guidance'];
const SCOPES=[
 ['story.js','chapter guidance and recovery',' function renderNext(',' function descriptor('],
 ['operations.js','board guidance catalog',' const guidance=',' const tr='],
 ['operations.js','board guidance and status',' function render(){','  board.replaceChildren();'],
 ['field-missions.js','field guidance catalog',' const controlHints=',' const notices='],
 ['field-missions.js','field controls and movement names',' function controls(){',' function telemetry(){'],
 ['field-missions.js','field completion guidance',"  $('fieldObjective').innerHTML=","  $('fieldReview').hidden="]
];
const literal=String.raw`(?:'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")`;
const pairs=new RegExp(String.raw`(?:\btr\(\s*|\[\s*)(${literal})\s*,\s*(${literal})`,'g');
const singles=new RegExp(String.raw`\b(?:t|T)\(\s*(${literal})`,'g');
function scopedKeys(read){
 const out=new Map();
 for(const [file,label,start,end] of SCOPES){
  const source=read(file),a=source.indexOf(start),b=source.indexOf(end,a+start.length);
  assert(a>=0&&b>a,`${file}: missing ${label} boundaries; review the scoped source extractor`);
  assert.equal(source.indexOf(start,a+start.length),-1,`${file}: ambiguous ${label} start`);
  const scope=source.slice(a,b),add=(key,ru)=>{assert.equal(typeof key,'string');const old=out.get(key);if(old&&ru&&old.ru)assert.equal(old.ru,ru,`${key}: conflicting Russian source`);out.set(key,{key,ru:ru||old?.ru,file,scope:label});};
  for(const match of scope.matchAll(pairs)){const ru=vm.runInNewContext(match[1]),key=vm.runInNewContext(match[2]);if(/[\u0400-\u04ff]/.test(ru))add(key,ru);}
  for(const match of scope.matchAll(singles))add(vm.runInNewContext(match[1]));
 }
 return [...out.values()];
}
function missing(packs,keys){return LANGS.flatMap(lang=>keys.filter(({key})=>!Object.hasOwn(packs[lang]?.strings||{},key)).map(({key,file})=>`${lang}: ${file}: ${JSON.stringify(key)}`));}
function readSource(root){return file=>fs.readFileSync(path.join(root,file),'utf8');}
module.exports={LANGS,BUNDLES,SCOPES,scopedKeys,missing,readSource};
