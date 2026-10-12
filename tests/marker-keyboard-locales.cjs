/* Four Chapter 8 keyboard marker strings; source-owned coverage and real lazy i18n, no sockets. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),os=require('node:os'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {LANGS,BUNDLES,scopedKeys,missing,readSource}=require('./guidance-locale-helper.cjs');
const {keys,translations,legacyGuidanceSha256,legacyPackSha256}=require('./marker-keyboard-locales-fixture.json');
const root=path.resolve(__dirname,'..'),read=readSource(root),source=vm.createContext({}),guidance=vm.createContext({});
const sha=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
assert.equal(keys.length,4);assert.equal(new Set(keys).size,4);
assert.deepEqual(Object.keys(translations),LANGS,'Every non-English locale has an explicit fixture');
for(const name of [...LANGS,...BUNDLES])vm.runInContext(read('locales/'+name+'.js'),source,{filename:name+'.js'});
vm.runInContext(read('locales/guidance.js'),guidance);
for(const lang of LANGS){
 const full=JSON.parse(JSON.stringify(source.MKTYLocales[lang])),feature=JSON.parse(JSON.stringify(guidance.MKTYLocales[lang]));
 assert.equal(translations[lang].length,4,lang+' exactly four added translations');
 assert.equal(Object.keys(feature.strings).length,54,lang+' keeps all 50 guidance keys plus exactly four additions');
 for(const [i,key] of keys.entries()){
  const value=feature.strings[key];
  assert.equal(value,translations[lang][i],lang+' frozen marker wording, axes and directions: '+key);
  assert.equal(full.strings[key],value,lang+' no later bundle overrides the marker translation');
  assert.equal(typeof value,'string');assert(value.trim());assert.notEqual(value,key,lang+' no English fallback');
  assert(!/[\uFFFD⟦⟧]|localStorage/.test(value),lang+' undamaged translation');
  assert.deepEqual(value.match(/\{\w+\}/g)||[],key.match(/\{\w+\}/g)||[],lang+' placeholders');
  assert.deepEqual(value.match(/\d+/g)||[],key.match(/\d+/g)||[],lang+' preserves 0/600 and 0/450 coordinate ranges');
  assert.deepEqual(value.match(/X|Y|Tab/g)||[],key.match(/X|Y|Tab/g)||[],lang+' preserves axis labels and Tab order');
  delete full.strings[key];delete feature.strings[key];
 }
 // Frozen before adding marker controls. These include metadata and every old key/value,
 // so a lost key, replacement translation, reordered source, or metadata change fails.
 assert.equal(sha(feature),legacyGuidanceSha256[lang],lang+' original 50 guidance translations remain byte-identical');
 assert.equal(sha(full),legacyPackSha256[lang],lang+' every old translation and locale metadata remain byte-identical');
}
const callsites=scopedKeys(read);
for(const [i,key] of keys.entries()){
 const row=callsites.find(row=>row.key===key);
 assert(row,'Source callsite must exist for '+key);
 assert.equal(row.file,'field-missions.js');assert.equal(row.ru,translations.ru[i],'Exact Russian source fallback');
 const mutated=scopedKeys(file=>file==='field-missions.js'?read(file).replace(key,key+' SOURCE ONLY SENTINEL'):read(file));
 assert(!mutated.some(row=>row.key===key),'Changing the source key must invalidate its original coverage: '+key);
 assert.equal(missing(source.MKTYLocales,mutated).filter(value=>value.includes(key+' SOURCE ONLY SENTINEL')).length,LANGS.length,'Missing-from-all source mutation is caught for '+key);
}
assert.deepEqual(missing(source.MKTYLocales,callsites),[]);
// Run the actual generator twice in an isolated temporary tree. Never modify committed packs.
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'mkty-marker-locale-build-'));
try{
 fs.mkdirSync(path.join(temp,'tools'));fs.mkdirSync(path.join(temp,'locales'));
 fs.copyFileSync(path.join(root,'tools/build-runtime-locales.cjs'),path.join(temp,'tools/build-runtime-locales.cjs'));
 for(const name of [...LANGS,...BUNDLES])fs.copyFileSync(path.join(root,'locales',name+'.js'),path.join(temp,'locales',name+'.js'));
 for(let pass=0;pass<2;pass++){
  execFileSync(process.execPath,[path.join(temp,'tools/build-runtime-locales.cjs')],{stdio:'pipe'});
  for(const lang of LANGS)assert.equal(fs.readFileSync(path.join(temp,'locales/runtime',lang+'.js'),'utf8'),read('locales/runtime/'+lang+'.js'),lang+' actual runtime build is deterministic, pass '+(pass+1));
 }
}finally{fs.rmSync(temp,{recursive:true,force:true});}
function context(selected='en'){
 const scripts=[],writes=[];
 const ctx={Promise,Event:class{constructor(type){this.type=type;}},MutationObserver:class{disconnect(){}observe(){}},Node:{TEXT_NODE:3,ELEMENT_NODE:1},localStorage:{getItem:()=>selected},document:{body:{classList:{toggle(){}}},documentElement:{},getElementById:()=>null,createElement:tag=>({tag}),head:{appendChild:s=>scripts.push(s)},write:s=>writes.push(s)},dispatchEvent(){}};
 ctx.window=ctx;vm.createContext(ctx);return {ctx,scripts,writes};
}
function runtime(ctx,lang){vm.runInContext(read('locales/runtime/'+lang+'.js'),ctx,{filename:lang+'.js'});}
function assertTranslations(ctx,lang){
 assert.equal(ctx.MKTYI18n.getLanguage(),lang);assert.equal(ctx.document.documentElement.lang,lang);
 assert.equal(ctx.document.documentElement.dir,['ar','he'].includes(lang)?'rtl':'ltr');
 for(const [i,key] of keys.entries()){
  const expected=lang==='en'?key:translations[lang][i];
  assert.equal(ctx.MKTYI18n.t(key),expected,lang+' actual t(): '+key);
  assert.equal(ctx.MKTYI18n.tr(translations.ru[i],key),expected,lang+' actual tr(): '+key);
 }
}
(async()=>{
 for(const lang of LANGS){
  const {ctx,scripts}=context();vm.runInContext(read('locale-loader.js'),ctx);vm.runInContext(read('i18n.js'),ctx);assertTranslations(ctx,'en');
  const pending=ctx.MKTYI18n.setLanguage(lang);assert.equal(typeof pending?.then,'function');
  assert.equal(ctx.MKTYI18n.getLanguage(),'en','unloaded selection remains pending');
  const script=scripts.find(s=>s.tag==='script');assert(script?.src.startsWith('locales/runtime/'+lang+'.js?v='));
  runtime(ctx,lang);script.onload();await pending;assertTranslations(ctx,lang);
  assert.equal(JSON.stringify(ctx.MKTYLocales[lang]),JSON.stringify(source.MKTYLocales[lang]),lang+' whole runtime matches source translations and metadata');
  await ctx.MKTYI18n.setLanguage(lang);assertTranslations(ctx,lang);assert.equal(scripts.filter(s=>s.tag==='script').length,1,'repeat selection reuses the pack');
  await ctx.MKTYI18n.setLanguage('en');assertTranslations(ctx,'en');
  const saved=context(lang);vm.runInContext(read('locale-loader.js'),saved.ctx);assert(saved.writes[0].startsWith('<script src="locales/runtime/'+lang+'.js?v='));
  runtime(saved.ctx,lang);vm.runInContext(read('i18n.js'),saved.ctx);assertTranslations(saved.ctx,lang);
 }
 console.log('PASS: four marker source callsites; 48 exact translations, all legacy keys/metadata preserved; deterministic runtime generation; awaited and saved-locale t/tr in 13 languages, including RTL');
})().catch(error=>{console.error(error);process.exitCode=1;});
