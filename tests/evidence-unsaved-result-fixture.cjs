'use strict';
// Socket-free preparation and copy/scope checks. Never starts a browser.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createHash} = require('node:crypto');
const root = path.resolve(__dirname, '..');
const directory = 'tests/fixtures/evidence-unsaved-result/';
const LANGUAGES = Object.freeze(['en','ru','uk','es','pt','de','fr','it','tr','he','ar','ko','zh']);
const sha = value => createHash('sha256').update(value).digest('hex');
const moduleFiles=Object.freeze(['adapter','contract','coordinator','synthetic-completion','finale-completion','unsaved-result-gate',
  'context-stream','finale-context-v1','finale-phase-v2','phase-budget','phase-writer-contract','precision-observation',
  'retired-story-witness','story-rewrite','prepared-operations'].map(name=>'prototypes/evidence-indexeddb/'+name+'.mjs'));
function prepare() {
  const copy = JSON.parse(fs.readFileSync(path.join(root,directory,'copy.json'),'utf8'));
  assert.deepEqual(Object.keys(copy),LANGUAGES);
  const keys = Object.keys(copy.en), labels = {};
  for (const language of LANGUAGES) {
    assert.deepEqual(Object.keys(copy[language]),keys,language + ' has complete fixture copy');
    for (const [key,value] of Object.entries(copy[language])) {
      assert.equal(typeof value,'string'); assert(value.trim().length && value.length <= 256,language + ':' + key);
      assert(!/[<>]/.test(value),'copy is text only');
    }
    if (language !== 'en') {
      const context = vm.createContext({}); context.window = context; context.globalThis = context;
      vm.runInContext(fs.readFileSync(path.join(root,'locales',language + '.js'),'utf8'),context);
      assert.equal(copy[language].continue,context.MKTYLocales[language].strings.CONTINUE,'reuse exact existing CONTINUE label');
      labels[language] = {path:'locales/' + language + '.js',key:'CONTINUE'};
    }
  }
  assert.equal(copy.en.warning,'The unsaved result is kept only while this page remains open. Closing this page before the result is saved may lose it.');
  assert.equal(copy.en.unsaved,'Result not saved yet');
  const storage = fs.readFileSync(path.join(root,'storage.js'),'utf8');
  assert(storage.includes("'" + copy.en.retry + "'")); assert(storage.includes("'" + copy.ru.retry + "'"));
  const files = ['index.html','fixture.css','fixture.mjs','copy.json','README.md'];
  const sourceHashes = Object.fromEntries(files.map(file => [directory + file,sha(fs.readFileSync(path.join(root,directory,file)))]));
  const html = fs.readFileSync(path.join(root,directory,'index.html'),'utf8');
  const script = fs.readFileSync(path.join(root,directory,'fixture.mjs'),'utf8');
  const css = fs.readFileSync(path.join(root,directory,'fixture.css'),'utf8');
  assert(html.includes('type="module" src="/fixture/fixture.mjs"'));
  assert(html.includes('aria-live="polite"')); assert(html.includes('translate="no"'));
  assert(css.includes('min-height: 44px')); assert(css.includes('min-width: 44px')); assert(css.includes(':focus-visible'));
  assert(!/deleteDatabase|\.clearDataForOrigin|location\.(?:assign|replace)|localStorage\.clear/.test(script));
  assert(!/from ['"][^'"]*(?:game|reward|server|story-plan|field-model)/.test(script));
  const native = 'tests/fixtures/evidence-indexeddb/native-harness.js';
  sourceHashes[native] = sha(fs.readFileSync(path.join(root,native)));
  assert.equal(sourceHashes[native],'9d22a89077d380c3701b6fd5d4fca2eb282a8a61c28494555c6968d07b989df2','reuse unchanged reviewed terminal harness');
  sourceHashes['tests/evidence-unsaved-result-fixture.cjs'] = sha(fs.readFileSync(__filename));
  const modules=new Set([...moduleFiles,'field-model.js','trace-codec.js','story-plan.js']);
  for(const file of modules){
    const bytes=fs.readFileSync(path.join(root,file));sourceHashes[file]=sha(bytes);
    for(const line of bytes.toString().split('\n').filter(line=>line.startsWith('import '))){
      const match=line.match(/\bfrom\s*['"]([^'"]+)['"]/);assert(match,'Known static fixture import');
      assert(match[1].startsWith('.'),'Only relative first-party module imports');
      assert(modules.has(path.posix.normalize(path.posix.join(path.posix.dirname(file),match[1]))),'Fixture route missing import: '+file+' -> '+match[1]);
    }
  }
  return {copy,sourceHashes,qualifications:{syntheticOnly:true,localeCount:LANGUAGES.length,rtl:['ar','he'],standardLabelSources:labels,
    retrySources:{en:'storage.js',ru:'storage.js'},translationReview:'fixture copy; no claim of professional linguistic review',
    noGameOrRewardActions:true,noArchiveDeletion:true,nativeBrowser:'not run by preparation'}};
}
module.exports = {prepare,LANGUAGES,root,directory,sha,moduleFiles};
if (require.main === module) {const result = prepare(); console.log('PASS: portable synthetic gate fixture: ' + result.qualifications.localeCount + ' complete dictionaries; exact existing labels; source isolation. Native Chromium not run.');}
