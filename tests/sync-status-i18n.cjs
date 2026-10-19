// Save/sync status boxes live outside #app (no MutationObserver translation), so their copy must go through
// MKTYI18n.t() with a key in locales/sync-status.js for every UI language (not just RU/EN).
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.join(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const LANGS=['ru','uk','es','pt','de','fr','it','tr','he','ar','ko','zh'],FILES=['cloud-save.js','rewards-client.js','storage.js'];
const ctx=vm.createContext({});vm.runInContext(read('locales/sync-status.js'),ctx);const P=ctx.MKTYLocales;
const unesc=s=>s.replace(/\\'/g,"'");let keys=0;
for(const f of FILES){const src=read(f);
 assert(!/(?<![A-Za-z_.])ru\(?\)?\?'/.test(src),f+': no RU/EN-only ternaries left');
 for(const m of src.matchAll(/(?<![A-Za-z_.])L\('((?:[^'\\]|\\.)*)','((?:[^'\\]|\\.)*)'\)/g)){const en=unesc(m[1]),ru=unesc(m[2]);keys++;
  for(const l of LANGS){const v=P[l]?.strings?.[en];assert(typeof v==='string'&&v.trim(),`${f}: ${l} missing ${JSON.stringify(en.slice(0,50))}`);
   if(l!=='ru')assert.notEqual(v.trim(),en.trim(),`${l} copies English for ${JSON.stringify(en.slice(0,40))}`);}
  assert.equal(P.ru.strings[en],ru,`${f}: ru pack matches the inline RU fallback for ${JSON.stringify(en.slice(0,40))}`);}
}
assert(keys>=19,'all status strings routed through L(): '+keys);
// The real i18n runtime resolves them for a non-RU language and keeps EN as the source.
for(const lang of ['uk','de','zh']){
 const c=vm.createContext({console,Promise,localStorage:{getItem:k=>k==='mkty_lang'?lang:null},Event:class{constructor(t){this.type=t;}},MutationObserver:class{disconnect(){}observe(){}},Node:{TEXT_NODE:3,ELEMENT_NODE:1},
  document:{body:{classList:{toggle(){}}},documentElement:{},getElementById:()=>null},window:{dispatchEvent(){}}});
 c.window.MKTYLocaleLoader=null;c.MKTYLocales={};c.globalThis=c;vm.runInContext(read('locales/sync-status.js'),c);c.window=Object.assign(c,{dispatchEvent(){}});
 vm.runInContext(read('i18n.js'),c);const en='Cloud saving is temporarily unavailable. Your route stays on this device.';
 assert.equal(c.MKTYI18n.t(en,{ru:'x'}),P[lang].strings[en],lang+' runtime translation');
}
console.log(`sync-status i18n OK: ${keys} strings × ${LANGS.length} languages, runtime t() resolves uk/de/zh`);
