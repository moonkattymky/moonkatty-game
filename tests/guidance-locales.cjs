/* Actual source callsites + actual asynchronous locale-loader/i18n runtime, without sockets. */
'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),vm=require('node:vm');
const {LANGS,BUNDLES,SCOPES,scopedKeys,missing,readSource}=require('./guidance-locale-helper.cjs');
const read=readSource(path.resolve(__dirname,'..')),keys=scopedKeys(read),tag='20261019-sync-i18n-1';
assert(read('field-missions.css').includes('grid-template-columns:repeat(4,minmax(44px,1fr)) minmax(44px,max-content)'), 'Docking arrows retain 44px targets while the localized brake label gets its intrinsic width');
assert(read('index.html').includes('field-missions.css?v=20261011-marker-keyboard-1'), 'The corrected control layout has a new public cache pin');
assert(read('field-missions.css').includes('#fieldMission[data-kind=docking]{grid-template-columns:minmax(0,1fr) minmax(0,1.1fr)}'), 'Landscape docking columns fit the actual app width');
assert(read('field-missions.css').includes('#fieldMission[data-kind=docking] .field-steering button{flex:1 1 44px;min-width:44px}'), 'Landscape steering can wrap without undersized targets');
const source=vm.createContext({});
for(const name of [...LANGS,...BUNDLES])vm.runInContext(read('locales/'+name+'.js'),source,{filename:name+'.js'});
assert.deepEqual(missing(source.MKTYLocales,keys),[],'All scoped source callsites need translations, even if absent from every existing pack');
assert(keys.length>=51,'The original guidance, recovery and movement scope must not shrink silently');
for(const key of ['NEXT OBJECTIVE','RETRY CONNECTION','RETRY REWARD SYNC','FULL OBJECTIVE & CONTROLS','SOLVE → CONFIRM','Up','Left','Down','Right'])assert(keys.some(row=>row.key===key),'Required source surface: '+key);
// Guard against the old union-of-packs blind spot: a new callsite in every scoped region
// must fail coverage even when it is missing from ALL language dictionaries.
for(const [file,label,start] of SCOPES){
 const marker='Source-only coverage sentinel: '+label,modified=scopedKeys(f=>f!==file?read(f):read(f).replace(start,start+`\n tr('Новая строка',${JSON.stringify(marker)});\n`));
 assert(modified.some(row=>row.key===marker),label+' mutation is discovered from source');
 assert.equal(missing(source.MKTYLocales,modified).filter(s=>s.includes(marker)).length,LANGS.length,label+' missing-from-all regression');
}
const bundle=vm.createContext({});vm.runInContext(read('locales/guidance.js'),bundle);
const additions=bundle.MKTYLocales;
for(const lang of LANGS){
 assert.equal(Object.keys(additions[lang].strings).length,54,lang+' has exactly the 46 gaps + four movement labels + four marker controls');
 const baseline=vm.createContext({});for(const name of [...LANGS,...BUNDLES.filter(x=>x!=='guidance')])vm.runInContext(read('locales/'+name+'.js'),baseline);
 for(const [key,value] of Object.entries(baseline.MKTYLocales[lang].strings))assert.equal(source.MKTYLocales[lang].strings[key],value,lang+' preserves old translation '+key);
 for(const [key,value] of Object.entries(additions[lang].strings)){
  assert(keys.some(row=>row.key===key),lang+' no unrelated new key '+key);
  assert(!Object.hasOwn(baseline.MKTYLocales[lang].strings,key),lang+' no existing translation overridden');
  assert.equal(typeof value,'string');assert(value.trim());assert.notEqual(value,key,lang+' cannot silently copy English: '+key);
  assert(!/[\uFFFD⟦⟧]|localStorage/.test(value),lang+' malformed translation '+key);
  assert.deepEqual(value.match(/\{\w+\}/g)||[],key.match(/\{\w+\}/g)||[],lang+' placeholders '+key);
  assert.deepEqual(value.match(/\d+/g)||[],key.match(/\d+/g)||[],lang+' numeric instructions '+key);
  assert.equal(value.endsWith(' '),key.endsWith(' '),lang+' trailing space '+key);
  assert.equal((value.match(/→/g)||[]).length,(key.match(/→/g)||[]).length,lang+' action order arrows '+key);
  for(const token of key.match(/\b(?:S|E|IN|OUT|WASD|GATE)\b|●|◇|<12/g)||[])assert(value.includes(token),lang+' technical label '+token);
  if(lang==='ru')assert.equal(value,keys.find(row=>row.key===key).ru,'Russian source remains verbatim');
 }
}
function context(selected='en'){
 const scripts=[],events=[],writes=[],classes={};
 const ctx={console,Promise,localStorage:{getItem:()=>selected},Event:class{constructor(type){this.type=type;}},MutationObserver:class{disconnect(){}observe(){}},Node:{TEXT_NODE:3,ELEMENT_NODE:1},document:{body:{classList:{toggle:(k,v)=>classes[k]=v}},documentElement:{},getElementById:()=>null,createElement:tag=>({tag}),head:{appendChild:s=>scripts.push(s)},write:s=>writes.push(s)},dispatchEvent:e=>{events.push(e.type);return true;}};
 ctx.window=ctx;vm.createContext(ctx);return {ctx,scripts,events,writes,classes};
}
function runtime(ctx,lang){vm.runInContext(read('locales/runtime/'+lang+'.js'),ctx,{filename:lang+'.js'});}
function assertTranslations(ctx,lang){
 assert.equal(ctx.MKTYI18n.getLanguage(),lang);assert.equal(ctx.document.documentElement.lang,lang);
 assert.equal(ctx.document.documentElement.dir,['ar','he'].includes(lang)?'rtl':'ltr');
 for(const {key,ru} of keys){
  const expected=lang==='en'?key:source.MKTYLocales[lang].strings[key];
  assert.equal(ctx.MKTYI18n.t(key),expected,lang+' actual t(): '+key);
  assert.equal(ctx.MKTYI18n.tr(ru||'unused fallback',key),expected,lang+' actual tr(): '+key);
 }
}
(async()=>{
 for(const lang of LANGS){
  const c=context();vm.runInContext(read('locale-loader.js'),c.ctx);vm.runInContext(read('i18n.js'),c.ctx);
  assertTranslations(c.ctx,'en');assert(!c.ctx.MKTYI18n.hasLocale(lang));
  const pending=c.ctx.MKTYI18n.setLanguage(lang);assert.equal(typeof pending?.then,'function');
  assert.equal(c.ctx.MKTYI18n.getLanguage(),'en','language stays active until the requested pack loads');
  const scripts=c.scripts.filter(s=>s.tag==='script');assert.equal(scripts.length,1);assert.equal(scripts[0].src,`locales/runtime/${lang}.js?v=${tag}`);
  runtime(c.ctx,lang);scripts[0].onload();await pending;
  assert(c.ctx.MKTYI18n.hasLocale(lang));assert.equal(JSON.stringify(c.ctx.MKTYLocales[lang]),JSON.stringify(source.MKTYLocales[lang]),lang+' generated runtime matches the source bundle');
  assertTranslations(c.ctx,lang);assert.equal(c.events.filter(e=>e==='mkty:language').length,2,'initial English plus loaded language event');
  await c.ctx.MKTYI18n.setLanguage(lang);assertTranslations(c.ctx,lang);assert.equal(c.scripts.filter(s=>s.tag==='script').length,1,'repeat selection reuses the loaded pack');
  await c.ctx.MKTYI18n.setLanguage('en');assertTranslations(c.ctx,'en');
  // Parser-time saved language must reference the same fresh pack and render directly.
  const saved=context(lang);vm.runInContext(read('locale-loader.js'),saved.ctx);assert.equal(saved.writes[0],`<script src="locales/runtime/${lang}.js?v=${tag}"><\/script>`);
  runtime(saved.ctx,lang);vm.runInContext(read('i18n.js'),saved.ctx);assertTranslations(saved.ctx,lang);
 }
 // A failed fetch must leave English usable; retry creates a fresh load and then translates.
 const retry=context();vm.runInContext(read('locale-loader.js'),retry.ctx);vm.runInContext(read('i18n.js'),retry.ctx);
 const failed=retry.ctx.MKTYI18n.setLanguage('ar');retry.scripts.find(s=>s.tag==='script').onerror();await failed;assertTranslations(retry.ctx,'en');
 const recovered=retry.ctx.MKTYI18n.setLanguage('ar'),scripts=retry.scripts.filter(s=>s.tag==='script');assert.equal(scripts.length,2);runtime(retry.ctx,'ar');scripts[1].onload();await recovered;assertTranslations(retry.ctx,'ar');
 assert(read('index.html').includes(`locale-loader.js?v=${tag}`),'HTML invalidates the loader cache too');
 console.log(`PASS: ${keys.length} scoped source keys, 54 additions × 12 packs; actual awaited t/tr for 13 languages, saved preferences, retry and RTL; old translations unchanged`);
})().catch(error=>{console.error(error);process.exitCode=1;});
