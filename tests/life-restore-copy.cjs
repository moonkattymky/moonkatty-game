/* Four actual source surfaces and asynchronous source/runtime translations, no sockets. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {keys,legacyKeys,clauses}=require('./life-restore-copy-fixture.json');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
const langs=['ru','uk','es','pt','de','fr','it','tr','he','ar','ko','zh'];
const bundles=['daily-retention','creator','leaderboard','social','pacing','guidance'];
function actualKeys(read){
 const html=read('index.html'),hub=read('mission-control.js'),pace=read('pacing.js');
 const rules=html.match(/<strong>9 LIVES<\/strong><p>([^<]+)<\/p>/);
 const faq=hub.match(/class="more-faq"[^]*?<p>\$\{tr\(("(?:\\.|[^"\\])*"),("(?:\\.|[^"\\])*")\)\}/);
 const dialogs=[...pace.matchAll(/\$\('paceText'\)\.textContent=T\('([^']+)'\)/g)].map(match=>match[1]);
 assert(rules&&faq,'Rules and FAQ callsites must remain discoverable');
 assert.equal(dialogs.length,3,'chapter, no-lives and risk dialog surfaces are explicit');
 return {keys:[dialogs[1],dialogs[2],rules[1],JSON.parse(faq[2])],ru:JSON.parse(faq[1])};
}
assert.deepEqual(actualKeys(read).keys,keys,'All four active source paragraphs use the frozen corrected copy');
for(const key of keys)assert(key.includes('Lives restore one at a time: 1 life every 12 hours, up to 9.'));
for(const [i,file] of ['pacing.js','pacing.js','index.html','mission-control.js'].entries()){
 const changed=actualKeys(f=>f===file?read(f).replace(keys[i],keys[i]+' SOURCE ONLY SENTINEL'):read(f));
 assert.notDeepEqual(changed.keys,keys,'A source-only change cannot silently shrink dictionary coverage: '+file);
}
const source=vm.createContext({}),feature=vm.createContext({});
for(const name of [...langs,...bundles])vm.runInContext(read('locales/'+name+'.js'),source);
vm.runInContext(read('locales/pacing.js'),feature);
assert.equal(actualKeys(read).ru,feature.MKTYLocales.ru.strings[keys[3]],'Russian FAQ fallback matches the source bundle');
for(const lang of langs){
 const strings=source.MKTYLocales[lang].strings,[sentence,oldClauses,separator]=clauses[lang];
 assert.equal(Object.keys(feature.MKTYLocales[lang].strings).length,34,'30 legacy keys plus exactly four additions: '+lang);
 for(const [i,key] of keys.entries()){
  assert(Object.hasOwn(strings,key),lang+' missing source key '+key);
  assert.notEqual(strings[key],key,lang+' has no English fallback');
  assert(strings[key].includes(sentence),lang+' exact sequential restoration clause');
  assert(!/[\uFFFD⟦⟧]/u.test(strings[key]),lang+' undamaged text');
  assert.deepEqual(strings[key].match(/\{\w+\}/g)||[],key.match(/\{\w+\}/g)||[],lang+' placeholders');
  const legacy=feature.MKTYLocales[lang].strings[legacyKeys[i]];
  assert.equal(legacy.split(oldClauses[i]).length,2,'legacy recovery clause occurs once');
  assert.equal(strings[key],legacy.replace(oldClauses[i],(i===2?separator:'')+sentence),lang+' all unrelated claims remain byte-identical');
 }
}
function context(){
 const scripts=[];
 const ctx={Promise,Event:class{constructor(type){this.type=type;}},MutationObserver:class{disconnect(){}observe(){}},Node:{TEXT_NODE:3,ELEMENT_NODE:1},localStorage:{getItem:()=>null},document:{body:{classList:{toggle(){}}},documentElement:{},getElementById:()=>null,createElement:tag=>({tag}),head:{appendChild:s=>scripts.push(s)},write(){throw Error('No saved locale in fresh context');}},dispatchEvent(){}};
 ctx.window=ctx;vm.createContext(ctx);return {ctx,scripts};
}
function translations(ctx,lang){
 assert.equal(ctx.MKTYI18n.getLanguage(),lang);assert.equal(ctx.document.documentElement.lang,lang);
 assert.equal(ctx.document.documentElement.dir,['ar','he'].includes(lang)?'rtl':'ltr');
 for(const key of keys){
  const expected=lang==='en'?key:source.MKTYLocales[lang].strings[key];
  assert.equal(ctx.MKTYI18n.t(key),expected,lang+' real t()');
  assert.equal(ctx.MKTYI18n.tr(source.MKTYLocales.ru.strings[key],key),expected,lang+' real tr()');
 }
}
(async()=>{
 for(const lang of langs){
  const {ctx,scripts}=context();vm.runInContext(read('locale-loader.js'),ctx);vm.runInContext(read('i18n.js'),ctx);translations(ctx,'en');
  const pending=ctx.MKTYI18n.setLanguage(lang);assert.equal(typeof pending?.then,'function');
  assert.equal(ctx.MKTYI18n.getLanguage(),'en','unloaded selection remains pending');
  const script=scripts.find(s=>s.tag==='script');assert(script?.src.startsWith('locales/runtime/'+lang+'.js?v='));
  vm.runInContext(read('locales/runtime/'+lang+'.js'),ctx);script.onload();await pending;
  assert.equal(JSON.stringify(ctx.MKTYLocales[lang]),JSON.stringify(source.MKTYLocales[lang]),lang+' runtime includes the exact whole source pack and metadata');
  translations(ctx,lang);await ctx.MKTYI18n.setLanguage('en');translations(ctx,'en');
 }
 console.log('PASS: four active paragraphs; 48 additive translations preserve every unrelated clause; exact source/runtime metadata and awaited i18n for 13 languages');
})().catch(error=>{console.error(error);process.exitCode=1;});
