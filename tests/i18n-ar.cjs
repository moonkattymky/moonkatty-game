// Arabic (ar) locale completeness: every key present in the other packs exists in ar,
// placeholders survive, sub-packs (creator/daily/leaderboard) include ar, RTL + picker wired.
const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const ctx={};ctx.globalThis=ctx;ctx.window=ctx;vm.createContext(ctx);
const files=['ru','uk','es','pt','de','fr','it','tr','he','ar','ko','zh'].map(c=>'locales/'+c+'.js').concat(['locales/daily-retention.js','locales/creator.js','locales/leaderboard.js','locales/social.js','locales/pacing.js']);
for(const f of files)vm.runInContext(read(f),ctx,{filename:f});
const L=ctx.MKTYLocales;assert(L.ar&&L.ar.strings,'ar pack missing');
const ar=L.ar.strings;const others=['es','pt','de','fr','it','tr','he','ko','zh'];
const missing=new Set();
for(const c of others)for(const k of Object.keys(L[c].strings))if(!(k in ar))missing.add(c+': '+k);
assert.deepStrictEqual([...missing],[],'ar is missing keys');
for(const k of Object.keys(L.he.prefixes))assert(k in L.ar.prefixes,'ar prefix missing: '+k);
const arabic=/[\u0600-\u06FF]/;let untranslated=[];
for(const [k,v] of Object.entries(ar)){
 assert.strictEqual(typeof v,'string');assert(v.trim().length>0||k.trim()==='','empty ar value: '+k);
 for(const ph of k.match(/\{\w+\}/g)||[])assert(v.includes(ph),'placeholder '+ph+' lost in: '+k);
 if(k.endsWith(' ')&&!v.endsWith(' '))assert.fail('trailing space lost: '+JSON.stringify(k));
 if(/[a-z]{4,}/i.test(k)&&!/^mkty_/.test(k)&&!arabic.test(v)&&v===k)untranslated.push(k);
}
// Only protocol codes / brand tokens may stay identical to English.
const allowed=new Set(['NAV','ENG','MOONKATTY / LIFE #6','+5 ⭐ · TikTok']);
untranslated=untranslated.filter(k=>!allowed.has(k));
assert.deepStrictEqual(untranslated,[],'ar values identical to English');
const comma=['ENERGY,COOLANT,PLASMA','PUMP,FILTER,TURBINE,NAVIGATION,SEAL,GATE,RESERVE,EXCHANGER'];
for(const k of comma)assert.strictEqual(ar[k].split(',').length,k.split(',').length,'comma list length: '+k);
const i18n=read('i18n.js'),app=read('app.js'),html=read('index.html');
assert(/PACK_LANGS = \[[^\]]*'ar'/.test(i18n),'ar not in PACK_LANGS');
assert(/RTL_LANGS = \['he','ar'\]/.test(i18n),'ar not RTL');
for(const block of ['dynamics','moonPointFix','tokenFix'])assert(new RegExp('const '+block+' = \\{[\\s\\S]*?\\n  ar: ').test(i18n),'ar missing in '+block);
assert(app.includes("['ar','🌙','العربية']"),'ar missing in language picker');
assert(/\n ar:\['/.test(app),'ar intro copy missing');
assert(html.includes('locales/ar.js'),'index.html does not load locales/ar.js');
console.log('PASS ar locale:',Object.keys(ar).length,'strings,',Object.keys(L.ar.prefixes).length,'prefixes');
