/* Real loader/module regression. No browser, listener, substituted renderer, or model changes. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const {fixture,source,root,R}=require('./field-art-module-helper.cjs'),P=require('../story-plan.js');
const BASE='b51fa73edd882cf696d6cfdecca92081022289cd',TREE='afb488d13c1e91d7a1769aa8158543114991201c',MARK='data-renderer="landing-survey-rebuilt-v1"';
const sha=x=>crypto.createHash('sha256').update(x).digest('hex'),freeze=o=>{if(o&&typeof o==='object'&&!Object.isFrozen(o)){Object.values(o).forEach(freeze);Object.freeze(o);}return o;};
const pins={'field-art.js':'7d292278537c8b58ad85f47b212470f1767d66c6449134584d45224ac135827e','art-scenes/trajectory.js':'607ec0058e4cfa135bf1b4c3a76f0336132e098e1b2c167014fc708e411e691c','field-model.js':'94ab25d49258d5ca64cdf391eccdaadd3b3f10370b363295a4c3bd3a58aea7a8','field-missions.js':'f0c8c011d84f507070c3b5a821cee95cfc757562f141044089fd91d1520092c8','story-plan.js':'fd4683463fc1bcf72862b33478a6d4d1036036632ccff88a049798428d583474','story.js':'56e308ab4dac53df7a37f3df8714535ec19afbae8766bdbbc17fb28c0e0e3a6f'};
for(const [file,pin]of Object.entries(pins))assert.equal(sha(source(file)),pin,file+' remains byte-exact reviewed PR55');
assert(source('tests/lunar-worksite.cjs').includes("assert(artGzip<15000,'complete shared renderer <15KB gzip')"),'original core budget retained');
const attr=(s,k)=>s.match(new RegExp('(?:^|\\s)'+k+'="([^"]*)"'))?.[1],images=svg=>[...new Set([...svg.matchAll(/<image\b[^>]*\bhref="([^"]+)"/g)].map(m=>m[1]))].sort();
async function load(f,n){const p=f.art.prepareScene(n),script=f.scripts.at(-1);assert(script,'actual loader appended module script');const file=new URL(script.src).pathname.replace(/^\/game\//,'');f.run(file,script);script.onload();assert.equal(await p,true);assert.equal(f.modules.status(n),'ready');return file;}
let scenes=0,hiddenChecks=0,exactOtherScenes=0,exactMaps=0,exactMixed=0,maxBytes=0,maxNodes=0;const times=[];
(async()=>{
 const f=fixture();assert.equal(await load(f,4),'art-scenes/landing.js');f.context.FieldRules.layout=s=>freeze(R.layout(s));
 const verify=(state,chapter=4)=>{
  const s=freeze(structuredClone(state)),json=JSON.stringify(s),t=performance.now(),svg=f.art.scene(s,chapter);times.push(performance.now()-t);
  assert(svg.includes(MARK),'real optional landing renderer, never silent fallback');assert.equal(JSON.stringify(s),json,'deep-frozen state untouched');assert.equal(f.art.scene(s,chapter),svg,'render byte deterministic');
  assert(/^<svg\b[^>]*viewBox="0 0 600 600"/.test(svg));assert(!/NaN|undefined|Infinity|<(?:filter|animate|animateTransform|foreignObject|script)\b|https?:\/\/(?!www.w3.org)/i.test(svg),'bounded static local SVG');
  const cells=[...svg.matchAll(/<g\b([^>]*\bdata-field-cell="(\d+)"[^>]*)><rect\b([^>]*)\/>\s*<\/g>/g)];assert.equal(cells.length,36,'exactly 36 native cell groups');assert.equal((svg.match(/data-field-cell=/g)||[]).length,36);assert(!/data-field-(?:action|slider)=/.test(svg),'no added action controls');
  cells.forEach((m,i)=>{assert.equal(+m[2],i);assert.equal(attr(m[1],'role'),'button');assert.equal(attr(m[1],'tabindex'),'0');assert.equal(attr(m[1],'aria-label'),'Pad '+(i+1));assert.deepEqual(['x','y','width','height','rx'].map(k=>+attr(m[3],k)),[i%6*100+4,Math.floor(i/6)*100+4,92,92,5],'exact original 100-unit cell / +4 / 92 / rx5 rectangle');});
  const b=R.layout(s),selected=s.version===2?b.footprint:[s.selected],sites=s.version===2?s.sites:s.complete?[s.pad]:[],confirmed=sites.flatMap(i=>s.version===2?R.footprint(i):[i]);
  const art=[...svg.matchAll(/<g class="landing-cell([^"]*)" data-survey-cell="(\d+)"/g)];assert.equal(art.length,36);assert.deepEqual(art.filter(m=>m[1].includes(' selected')).map(m=>+m[2]),selected.slice().sort((a,b)=>a-b),'selected cells exactly match model footprint');assert.deepEqual(art.filter(m=>m[1].includes(' confirmed')).map(m=>+m[2]),confirmed.slice().sort((a,b)=>a-b),'confirmed cells exactly match accepted sites');
  assert.equal((svg.match(/class="landing-selection"/g)||[]).length,selected.length?1:0);assert.equal((svg.match(/class="landing-confirmed"/g)||[]).length,sites.length);
  const ids=[...svg.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size);for(const m of svg.matchAll(/(?:href="#|url\(#)([^"\)]+)/g))assert(ids.includes(m[1]),'SVG reference resolves: '+m[1]);
  assert.deepEqual(images(svg),['art/lunar-worksite-atlas-v1.webp','art/lunar-worksite-ground-v1.webp']);
  maxBytes=Math.max(maxBytes,Buffer.byteLength(svg));maxNodes=Math.max(maxNodes,(svg.match(/<[a-zA-Z]/g)||[]).length);assert(Buffer.byteLength(svg)<60000,'complete SVG <60KB raw');assert((svg.match(/<[a-zA-Z]/g)||[]).length<650,'bounded SVG element count <650');scenes++;return svg;
 };
 const mods=[{},...['radius','tolerance','repair','role','cells','charges','stability','preview','scanned','wind','strength','site'].map((key,i)=>({[key]:[6,1,10,2,2,3,40,1,1,3,10,1][i]})),{radius:6,wind:3,strength:10,site:1}];
 for(const version of [1,2])for(let stage=0;stage<5;stage++)for(const seed of [0,1,401,777])for(const m of mods){
  const s=R.create(4,stage,seed,m);s.version=version;verify(s);
  for(const selected of [0,4,5,28,29,30,35]){s.selected=selected;verify(s);}
  s.selected=R.layout(s).safe;R.act(s,'scan');verify(s);R.act(s,'sample');verify(s);assert(R.act(s,'land'));verify(s);
  if(!s.complete){R.act(s,'select',R.layout(s).backup);verify(s);R.act(s,'scan');verify(s);R.act(s,'sample');verify(s);assert(R.act(s,'land'));verify(s);}
  assert(R.won(s),'matrix fixtures finish under unchanged model rules');
 }
 // Every possible selected anchor, including invalid 2x2 edges and legacy cells.
 for(const version of [1,2])for(let selected=0;selected<36;selected++){const s=R.create(4,4,401,{site:1,wind:3,strength:10});s.version=version;s.selected=selected;s.scans=Array.from({length:36},(_,i)=>i);s.samples=s.scans.slice();verify(s);}
 // Guard every unrevealed property with a throwing getter. The actual loader's
 // silent-fallback path must fail the marker assertion if the module reads one.
 for(const version of [1,2])for(let stage=0;stage<5;stage++)for(const mode of ['unseen','scanned','partial','sampled']){
  const h=fixture();await load(h,4);const s=R.create(4,stage,401,{wind:3,strength:10});s.version=version;s.selected=R.layout(s).safe;
  if(mode!=='unseen')R.act(s,'scan');if(mode==='sampled')R.act(s,'sample');if(mode==='partial')s.samples=s.scans.slice(0,1);
  const baseline=h.art.scene(freeze(s),4),original=R.layout(s);
  h.context.FieldRules.layout=()=>{
   const b=structuredClone(original);for(const key of ['safe','backup'])Object.defineProperty(b,key,{get(){throw new Error('hidden solution read: '+key);},enumerable:false});
   b.tiles.forEach((tile,i)=>{for(const key of ['slope','wind','strength'])if(!s.scans.includes(i)||key==='strength'&&!s.samples.includes(i))Object.defineProperty(tile,key,{get(){throw new Error('hidden reading '+i+'/'+key);},enumerable:false});});return freeze(b);
  };
  assert.equal(h.art.scene(s,4),baseline,'throwing hidden layout values cannot affect any output, including colors');hiddenChecks++;
  // Differential proof also catches hidden-dependent art that survives try/catch.
  h.context.FieldRules.layout=()=>{const b=structuredClone(original);b.safe=(b.safe+11)%36;b.backup=(b.backup+17)%36;b.tiles.forEach((tile,i)=>{if(!s.scans.includes(i)){tile.slope=9871;tile.wind=9872;}if(!s.samples.includes(i))tile.strength=9873;});return freeze(b);};
  assert.equal(h.art.scene(s,4),baseline,'changing hidden values changes neither text nor color cues');hiddenChecks++;
 }
 const old=fixture(),next=fixture();await load(old,3);await load(next,3);await load(next,4);
 for(let chapter=0;chapter<=9;chapter++)for(let stage=0;stage<5;stage++)for(const seed of [0,401]){
  const landing=R.create(4,stage,seed);old.art.scene(landing,chapter);assert(next.art.scene(landing,chapter).includes(MARK));
  for(let n=1;n<=11;n++)if(n!==4){const s=R.create(n,stage,seed);assert.equal(next.art.scene(s,chapter),old.art.scene(s,chapter),`exact PR55 output n=${n} chapter=${chapter} stage=${stage}`);exactOtherScenes++;}
  const plan=P.plan(chapter||1,2);assert.equal(next.art.map(chapter||1,plan.steps,[0],i=>i===1),old.art.map(chapter||1,plan.steps,[0],i=>i===1));exactMaps++;
  assert.equal(next.art.sprite(2,30,50,90),old.art.sprite(2,30,50,90),'landing consumes no shared private sprite IDs; never normalize ordering');exactMixed++;
 }
 // Discover actual loader URLs, then recursively inventory the scene directory.
 // An unmanifested/nested .js cannot evade the catalog budget.
 const manifest=fixture(),entries=[];for(let n=0;n<=11;n++){const before=manifest.scripts.length,p=manifest.art.prepareScene(n);if(manifest.scripts.length===before){assert.equal(await p,false);continue;}const script=manifest.scripts.at(-1),file=new URL(script.src).pathname.replace(/^\/game\//,'');entries.push({n,file});manifest.run(file,script);script.onload();assert.equal(await p,true);}
 const walk=dir=>fs.readdirSync(path.join(root,dir),{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(dir+'/'+e.name):e.name.endsWith('.js')?[dir+'/'+e.name]:[]);
 assert.deepEqual(entries.map(e=>e.n),[3,4],'fixed trusted catalog');assert.deepEqual(walk('art-scenes').sort(),entries.map(e=>e.file).sort(),'recursive module inventory equals actual manifest');
 const resources=['field-art.js','field-art-loader.js',...entries.map(e=>e.file)].map(file=>({file,raw:Buffer.byteLength(source(file)),gzip:zlib.gzipSync(source(file)).length})),[core,loader]=resources;
 assert(core.gzip<15000,'original standalone shared renderer <15KB gzip');const perSceneCold=resources.slice(2).map(r=>({file:r.file,gzip:core.gzip+loader.gzip+r.gzip,raw:core.raw+loader.raw+r.raw}));for(const r of perSceneCold)assert(r.gzip<15000,'separately gzipped core + loader + actual module <15KB: '+r.file);const catalog=resources.reduce((sum,r)=>sum+r.gzip,0);assert(catalog<25000,'complete recursive actual manifest catalog <25KB gzip');
 const fallbackImages=new Set(),loadedImages=new Set(),coldImageTransitions=[];for(const chapter of [0,4])for(const site of [0,1]){const s=R.create(4,0,401,{site}),fallback=images(f.core.scene(s,chapter)),loaded=images(f.art.scene(s,chapter)),files=[...new Set([...fallback,...loaded])].sort();fallback.forEach(x=>fallbackImages.add(x));loaded.forEach(x=>loadedImages.add(x));coldImageTransitions.push({chapter,site,files,requests:files.length,bytes:files.reduce((n,file)=>n+fs.statSync(path.join(root,file)).size,0)});}
 const maxColdImageBytes=Math.max(...coldImageTransitions.map(r=>r.bytes));assert(maxColdImageBytes<1350000,'each real fallback-to-landing unique image union <1,350,000 raw bytes');
 const coldImageResources=[...new Set([...fallbackImages,...loadedImages])].sort().map(file=>({file,bytes:fs.statSync(path.join(root,file)).size})),coldImageBytes=coldImageResources.reduce((n,r)=>n+r.bytes,0);assert(coldImageResources.every(r=>r.bytes>0),'every distinct cold image exists and has measured raw bytes');
 const p95=times.sort((a,b)=>a-b)[Math.floor(times.length*.95)];assert(p95<15,'Node source render p95 <15ms; not browser paint performance');
 console.log(JSON.stringify({baseline:BASE,baselineTree:TREE,pins,scenes,hiddenChecks,maxBytes,maxNodes,renderP95ms:+p95.toFixed(3),exactOtherScenes,exactMaps,exactMixed,manifest:entries,resources,perSceneCold,catalogGzipBytes:catalog,catalogScriptRequests:resources.length,coldImageTransitions,maxColdImageBytes,allVariantRawImageUnionRequests:coldImageResources.length,allVariantRawImageUnionBytes:coldImageBytes,coldImageResources,limits:'Source-only immutable renderer/model/sequence tests. Browser/mobile evidence is generated separately by the CI-only landing preview.'},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
