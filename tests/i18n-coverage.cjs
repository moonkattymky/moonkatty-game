// Every locale must cover every UI string key (main packs + social/daily-retention/pacing/creator/leaderboard bundles),
// with no broken glyphs (U+FFFD), leaked MT placeholders (⟦P3…) or code fragments.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const dir=path.join(__dirname,'..','locales');
const LANGS=['ru','uk','es','pt','de','fr','it','tr','he','ar','ko','zh'];
const BUNDLES=['daily-retention','creator','leaderboard','social','pacing'];
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
for(const f of [...LANGS,...BUNDLES])assert(html.includes(`locales/${f}.js`),`index.html loads locales/${f}.js`);
const root={};const ctx=vm.createContext(root);
for(const f of [...LANGS,...BUNDLES])vm.runInContext(fs.readFileSync(path.join(dir,f+'.js'),'utf8'),ctx,{filename:f+'.js'});
const L=root.MKTYLocales;
const all=new Set();for(const l of LANGS){assert(L[l]&&L[l].strings,`locale ${l} loaded`);for(const k of Object.keys(L[l].strings))all.add(k);}
for(const b of BUNDLES){const src=fs.readFileSync(path.join(dir,b+'.js'),'utf8');for(const l of LANGS)assert(new RegExp(`"${l}"\\s*:`).test(src),`${b}.js has a "${l}" section`);}
const BAD=/[\uFFFD⟦⟧⟎⟁]|localStorage|\{\\f/;
let fails=[];
for(const l of LANGS){const s=L[l].strings;
 const miss=[...all].filter(k=>!(k in s));if(miss.length)fails.push(`${l}: ${miss.length} missing keys, e.g. ${JSON.stringify(miss.slice(0,5))}`);
 const bad=Object.entries(s).filter(([k,v])=>BAD.test(k)||BAD.test(String(v))).map(([k])=>k);if(bad.length)fails.push(`${l}: ${bad.length} broken values, e.g. ${JSON.stringify(bad.slice(0,5))}`);
 const empty=Object.entries(s).filter(([k,v])=>typeof v!=='string'||(k.trim()&&!v.trim())).map(([k])=>k);if(empty.length)fails.push(`${l}: empty values ${JSON.stringify(empty.slice(0,5))}`);
 for(const [k,v] of Object.entries(L[l].prefixes||{}))if(BAD.test(k+v))fails.push(`${l}: broken prefix ${k}`);
 const ph=k=>(k.match(/\{[a-z]+\}/g)||[]).sort().join();for(const [k,v] of Object.entries(s))if(ph(k)!==ph(v))fails.push(`${l}: placeholder mismatch in ${JSON.stringify(k)}`);
}
// JSON sources must match the runtime packs.
for(const l of LANGS){const j=JSON.parse(fs.readFileSync(path.join(dir,l+'.json'),'utf8')).strings;for(const [k,v] of Object.entries(j))if(BAD.test(k+v))fails.push(`${l}.json: broken ${JSON.stringify(k)}`);}
// German must not just copy English for real words (allow brand/technical tokens).
const DE_ALLOW=new Set(['Hangar','Mission','NAV','NAVIGATOR','Navigator','ONLINE','START','TERMINAL','TERMINAL OFFLINE','Scanner','Signal','SIGNAL','SIMULATION','SIMULATOR','SYNC','Pilot','Pause','WIND','Code','Videos','Community','LIDAR 2 × 2','ZONE ± 42','NAVIGATION','Check-in +{n} ⭐']);
const deCopies=Object.entries(L.de.strings).filter(([k,v])=>k===v&&/[A-Za-z]{4}/.test(k)&&!/^[A-Z0-9 .:/·+%#—–-]*(MKTY|MOONKATTY|LIFE|UTC|TON|ID|XP|OK|MHz)[A-Z0-9 .:/·+%#—–-]*$/.test(k)&&!DE_ALLOW.has(k)).map(x=>x[0]);
if(deCopies.length>40)fails.push(`de: ${deCopies.length} values copied from English, e.g. ${JSON.stringify(deCopies.slice(0,8))}`);
if(fails.length){console.error(fails.join('\n'));process.exit(1);}
console.log(`i18n coverage OK: ${LANGS.length} locales × ${all.size} keys, no broken glyphs (de English copies: ${deCopies.length})`);
