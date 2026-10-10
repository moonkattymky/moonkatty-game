/* Source-only Chapter 2 guards. Browser hit testing and real controller execution live
   in tools/render-crew-preview.cjs and its dedicated GitHub Actions workflow. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),zlib=require('node:zlib'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),R=require('../field-model.js'),P=require('../story-plan.js');
const BASE='2e15ef6417b92996f5678550a9b2319c53931f4b',HASH='ee8ff656ce8a71a3c4eb35afb7a37ca5e336005cf1e92beb9d127e1a9729f219';
const source=fs.readFileSync(path.join(root,'field-art.js'),'utf8'),fixture=fs.readFileSync(path.join(__dirname,'fixtures/pr53-field-art.js'),'utf8');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
assert.equal(sha(fixture),HASH,'comparison fixture is the exact git-show export from PR53');
let baseline=fixture,baselineSource='SHA-256 pinned fixture (shallow checkout)';
try {baseline=execFileSync('git',['show',BASE+':field-art.js'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']});baselineSource='git show '+BASE+':field-art.js';}
catch(error){assert(/bad object|invalid object|not a valid object|not a git repository|exists on disk, but not in|does not exist in/.test(String(error.stderr)),String(error.stderr||error));}
assert.equal(baseline,fixture,'available git object and checked-in comparison fixture agree exactly');
const load=text=>{const c={window:{},FieldRules:R};vm.createContext(c);vm.runInContext(text,c);return c.window.FieldArt;};
const old=load(baseline),art=load(source);
// Exact comparison includes sprite serials; no geometry, copy or identifiers are normalized.
let unchangedScenes=0,unchangedMaps=0;
for(let n=1;n<=11;n++)for(let chapter=0;chapter<=9;chapter++){
 if(n===2)continue;
 for(let stage=0;stage<4;stage++)for(const seed of [0,7,401]){
  const s=R.create(n,stage,seed);
  assert.equal(art.scene(s,chapter),old.scene(s,chapter),`PR53 exact scene n=${n}, chapter=${chapter}, stage=${stage}, seed=${seed}`);unchangedScenes++;
 }
}
for(let n=1;n<=9;n++)for(const edition of [1,2])for(const done of [[],[0],[0,1,2,3,4,5,6,7]]){
 const p=P.plan(n,edition),available=i=>!done.includes(i)&&p.steps[i].requires.every(j=>done.includes(j));
 assert.equal(art.map(n,p.steps,done,available),old.map(n,p.steps,done,available),`PR53 exact map chapter=${n}, edition=${edition}, done=${done}`);unchangedMaps++;
}
// A crew redraw historically consumed six sprite IDs. Later legacy output must remain
// byte-identical even when maps, crew scenes and direct sprite calls interleave.
const mixedOld=load(baseline),mixedNew=load(source);let exactMixedCalls=0;
for(let stage=0;stage<4;stage++)for(let chapter=0;chapter<=9;chapter++){
 const crew=R.create(2,stage,401);mixedOld.scene(crew,chapter);mixedNew.scene(crew,chapter);
 for(const n of [1,3,4,5,6,7,8,9,10,11]){const s=R.create(n,stage,7);assert.equal(mixedNew.scene(s,chapter),mixedOld.scene(s,chapter),'exact post-crew mixed scene n='+n);exactMixedCalls++;}
 const p=P.plan(chapter||1,2);assert.equal(mixedNew.map(chapter||1,p.steps,[],i=>i<2),mixedOld.map(chapter||1,p.steps,[],i=>i<2),'exact post-crew mixed map');exactMixedCalls++;
 assert.equal(mixedNew.sprite(2,100,50,90),mixedOld.sprite(2,100,50,90),'exact post-crew public sprite namespace');exactMixedCalls++;
}
const positions=[[140,100],[430,100],[145,230],[430,230],[300,330],[480,365]];
const resources=['art/lunar-worksite-atlas-v1.webp','art/lunar-worksite-ground-v1.webp','art/life2-crew.webp'].sort();
const attr=(text,key)=>text.match(new RegExp('(?:^|\\s)'+key+'="([^"]*)"'))?.[1];
const freeze=o=>{Object.values(o).forEach(v=>{if(v&&typeof v==='object')freeze(v);});return Object.freeze(o);};
let scenes=0,maxBytes=0,maxNodes=0;const times=[];
function verify(s){
 const immutable=freeze(structuredClone(s)),before=JSON.stringify(immutable),t=performance.now(),svg=art.scene(immutable,2);times.push(performance.now()-t);
 assert.equal(JSON.stringify(immutable),before,'render never mutates a deeply frozen state');
 assert.equal(art.scene(immutable,2),svg,'complete crew markup is deterministic without serial normalization');
 assert(svg.includes('data-renderer="crew-workshop-rebuilt-v1"'),'Chapter 2 uses the rebuilt renderer');
 assert(!/<filter\b|<animate\b|<animateTransform\b|<foreignObject\b|https?:\/\/(?!www.w3.org)/i.test(svg),'no filters, motion, foreign objects or external resources');
 const ids=[...svg.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length,'unique SVG ids');
 for(const m of svg.matchAll(/(?:href="#|url\(#)([^"\)]+)/g))assert(ids.includes(m[1]),'resolved SVG reference '+m[1]);
 const images=[...svg.matchAll(/<image\b[^>]*\bhref="([^"]+)"/g)].map(m=>m[1]);
 assert.deepEqual([...new Set(images)].sort(),resources,'only the three approved, existing local artwork resources');
 assert(images.length<=3,'resources are shared by references, not duplicated image elements');
 const groups=[...svg.matchAll(/<g\b([^>]*\bdata-field-cell="(\d+)"[^>]*)>([\s\S]*?)<\/g>/g)];
 assert.deepEqual(groups.map(m=>+m[2]),[0,1,2,3,4,5],'all six original native hit groups in original order');
 for(const [all,attrs,id,body]of groups){
  const i=+id,rect=body.trim();assert(/^<rect\b[^>]*\/>$/.test(rect),'only a transparent rectangle may be inside an interactive group');
  assert.equal(attr(attrs,'role'),'button');assert.equal(attr(attrs,'tabindex'),'0');assert.equal(attr(attrs,'aria-label'),'Station '+(i+1));
  assert.equal(attr(rect,'fill'),'transparent');assert.equal(+attr(rect,'width'),108);assert.equal(+attr(rect,'height'),110);
  const transform=attr(attrs,'transform'),translate=transform?.match(/^translate\((-?[\d.]+)[, ]+(-?[\d.]+)\)$/);
  assert(!transform||translate,'hit transforms only translate; no scale, rotate or skew');
  const [dx,dy]=translate?[+translate[1],+translate[2]]:[0,0];
  assert.equal(+attr(rect,'x')+dx,positions[i][0]-54);assert.equal(+attr(rect,'y')+dy,positions[i][1]-52);
  assert(!/pointer-events="none"/.test(attrs),'native hit group remains interactive');
 }
 const bytes=Buffer.byteLength(svg),nodes=(svg.match(/<[a-zA-Z]/g)||[]).length;
 maxBytes=Math.max(maxBytes,bytes);maxNodes=Math.max(maxNodes,nodes);
 assert(bytes<40000,'crew source per redraw <40 KB');assert(nodes<400,'crew DOM <400 nodes');scenes++;
}
for(let stage=0;stage<4;stage++)for(let seed=0;seed<12;seed++)for(const role of [undefined,0,1,2]){
 const s=R.create(2,stage,seed,role===undefined?undefined:{role});verify(s);
 while(s.jobs.length<6){const b=R.layout(s),i=b.jobs.findIndex((j,i)=>!s.jobs.includes(i)&&j.requires.every(k=>s.jobs.includes(k))&&s.energy>=j.cost);assert(i>=0,'legal crew route exists');R.act(s,'select',i);R.act(s,'role',b.jobs[i].role);assert(R.act(s,'assign'));verify(s);}
 assert(s.complete&&R.won(s),'all six stations complete using unchanged model rules');
}
const languages=['en','ru','uk','es','pt','de','fr','it','tr','he','ar','ko','zh'];let localizedScenes=0;
for(const lang of languages){
 const c={window:{},FieldRules:R};vm.createContext(c);
 if(lang!=='en')vm.runInContext(fs.readFileSync(path.join(root,'locales',lang+'.js'),'utf8'),c);
 const strings=c.window.MKTYLocales?.[lang]?.strings||{};
 c.MKTYI18n=c.window.MKTYI18n={t:key=>strings[key]??key};vm.runInContext(source,c);
 for(const version of [1,2])for(let stage=0;stage<4;stage++){
  const s=R.create(2,stage,401);s.version=version;const svg=c.window.FieldArt.scene(s,2);
  assert.equal((svg.match(/data-field-cell=/g)||[]).length,6,lang+' retains native controls');
  assert.equal((svg.match(/class="crew-station"/g)||[]).length,6,lang+' retains distinct station artwork');
  for(const role of ['NAV','ENG','SCT'])assert(svg.includes('>'+String(strings[role]??role).replace(/[&<>"']/g,'')+'</text>'),lang+' renders actual localized '+role);
  assert(!/NaN|undefined/.test(svg),lang+' has finite complete markup');localizedScenes++;
 }
}
const luminance=h=>h.match(/../g).map(x=>parseInt(x,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
const labelContrast=[];for(const ink of ['fff3d6','f0f5e9'])for(const plate of ['173f53','315d65']){assert(source.includes('#'+ink)&&source.includes('#'+plate),'contrast samples are present in renderer');const ratio=contrast(ink,plate);assert(ratio>=4.5,'opaque crew label contrast >=4.5:1');labelContrast.push({ink,plate,ratio:+ratio.toFixed(2)});}
const assetBytes=resources.reduce((sum,file)=>sum+fs.statSync(path.join(root,file)).size,0);assert(assetBytes<1250000,'three shared existing textures <1.25 MB total');
const p95=times.sort((a,b)=>a-b)[Math.floor(times.length*.95)];assert(p95<15,'source-render p95 <15 ms; not a paint or physical-device benchmark');
const gzip=zlib.gzipSync(source).byteLength;
// This duplicates, never replaces or relaxes, the reviewed PR53 shared-renderer guard.
assert(gzip<15000,'complete shared renderer <15KB gzip (original PR53 limit)');
assert.equal(sha(fs.readFileSync(path.join(root,'tests/lunar-worksite.cjs'))),'5c3a3d3728b4c077421f0d5a562ecf88061ccb98fd291abe9285ffc27a1332e0','reviewed release-composition hash pins and unchanged 15 KB artwork guard');
console.log(JSON.stringify({baseline:BASE,baselineSource,unchangedScenes,unchangedMaps,exactMixedCalls,localizedScenes,labelContrast,crewScenes:scenes,maxBytes,maxNodes,renderP95ms:+p95.toFixed(3),rendererGzipBytes:gzip,existingAssetBytes:assetBytes,limits:'Source-only checks. Real DOM/controller, paint, multilingual layout and touch geometry are separate GitHub CI checks; no physical-device certification.'},null,2));
