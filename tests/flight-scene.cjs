/* PR54 core remains byte-exact. The optional Chapter 3 module is executed through
   the real loader, then checked against immutable FieldRules geometry and budgets. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const {fixture,source,root,R}=require('./field-art-module-helper.cjs'),P=require('../story-plan.js');
const BASE='c52df881d4a256dd962073d3eba1298aa1327095',TREE='955e4417b8d658efdb3fa538b8f9a3d9d76d44e6',MARK='data-renderer="launch-window-rebuilt-v1"';
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
assert.equal(sha(source('field-art.js')),'7d292278537c8b58ad85f47b212470f1767d66c6449134584d45224ac135827e','core is byte-exact reviewed PR54');
assert.equal(sha(source('field-model.js')),'94ab25d49258d5ca64cdf391eccdaadd3b3f10370b363295a4c3bd3a58aea7a8','flight rules are byte-exact reviewed baseline');
assert(source('tests/lunar-worksite.cjs').includes("assert(artGzip<15000,'complete shared renderer <15KB gzip')"),'original shared-core 15KB guard is retained');
assert(source('tests/crew-workshop.cjs').includes("assert(gzip<15000,'complete shared renderer <15KB gzip (original PR53 limit)')"),'independent reviewed core guard is retained');
const page=source('index.html'),coreAt=page.indexOf('<script src="field-art.js?'),loaderAt=page.indexOf('<script src="field-art-loader.js?'),controllerAt=page.indexOf('<script src="field-missions.js?');
assert(coreAt>=0&&loaderAt>coreAt&&controllerAt>loaderAt,'synchronous fallback, loader, then actual controller');assert(!/<script[^>]*src=[^>]*art-scenes\//.test(page),'scene is not eagerly downloaded by HTML');
const freeze=o=>{if(o&&typeof o==='object'&&!Object.isFrozen(o)){Object.values(o).forEach(freeze);Object.freeze(o);}return o;};
const attr=(s,k)=>s.match(new RegExp('(?:^|\\s)'+k+'="([^"]*)"'))?.[1];
const expectedPath=(s,t)=>{const env=t.preview?R.condition(s):{wind:t.wind||0,gravity:t.gravity||4};let d='';for(let i=0;i<=40;i++){const q=R.flightPoint(t.angle,t.power,i/10,env,t.preview?s.trim||0:t.trim||0);d+=(i?'L':'M')+q.x+' '+q.y;}return d;};
let scenes=0,maxBytes=0,maxNodes=0,trajectoryPoints=0,exactOtherScenes=0,exactMaps=0,exactMixed=0;const times=[];
(async()=>{
 const f=fixture(),p=f.art.prepareScene(3);f.load();assert.equal(await p,true);assert.equal(f.modules.status(3),'ready');
 function verify(state,chapter=3){
  const s=freeze(structuredClone(state)),json=JSON.stringify(s),t=performance.now(),svg=f.art.scene(s,chapter);times.push(performance.now()-t);assert(svg.includes(MARK),'actual optional renderer, never silent fallback');assert.equal(JSON.stringify(s),json,'deeply frozen game state stays unchanged');assert.equal(f.art.scene(s,chapter),svg,'render is byte-deterministic');assert(!/NaN|undefined/.test(svg));
  assert(/^<svg\b[^>]*viewBox="0 0 600 450"/.test(svg));assert(!/<(?:filter|animate|animateTransform|foreignObject|script)\b|https?:\/\/(?!www.w3.org)/i.test(svg),'bounded static SVG only');assert(!/data-field-(?:cell|action|slider)=/.test(svg),'art adds no controls or input capture');
  const paths=[...svg.matchAll(/<path\b([^>]*\bclass="trajectory-(preview|trail)"[^>]*)\/>/g)],trails=s.complete?s.trails:[...s.trails,{angle:s.angle,power:s.power,preview:true}];assert.equal(paths.length,trails.length);assert.equal(paths.filter(m=>m[2]==='preview').length,s.complete?0:1,'completed third burn has no fourth preview');
  paths.forEach((m,i)=>{const d=attr(m[1],'d');assert.equal(d,expectedPath(s,trails[i]),'every trajectory point exactly matches FieldRules environment and trim');assert.equal((d.match(/[ML]/g)||[]).length,41,'exactly 41 trajectory points');trajectoryPoints+=41;});
  const b=R.layout(s),receiver=svg.match(/<g\b([^>]*\bclass="trajectory-receiver"[^>]*)>/);assert(receiver);assert.equal(attr(receiver[1],'transform'),`translate(${b.target.x} ${b.target.y})`,'capture window center exactly equals active model target');
  const target=svg.match(/<circle\b([^>]*\bclass="trajectory-target"[^>]*)\/>/);assert(target);assert.equal(Number(attr(target[1],'r')),b.target.radius,'capture window radius is model acceptance radius including modifier');
  const relay=svg.match(/<g\b([^>]*\bclass="trajectory-relay"[^>]*)><circle\b([^>]*)\/>/);assert.equal(!!relay,!!b.target.relay,'legacy has no relay; version 2 does');if(relay){assert.equal(attr(relay[1],'transform'),`translate(${b.target.relay.x} ${b.target.relay.y})`);assert.equal(Number(attr(relay[2],'r')),14+((s.mods||{}).radius||0),'relay ring includes the same modifier as model acceptance');}
  const player=svg.match(/<g\b([^>]*\bclass="field-vessel trajectory-player"[^>]*)>/);assert(player);assert.equal(attr(player[1],'transform'),`translate(${b.origin.x} ${b.origin.y}) rotate(${90-s.angle})`,'player origin and heading match current input');
  const ids=[...svg.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size);for(const m of svg.matchAll(/(?:href="#|url\(#)([^"\)]+)/g))assert(ids.includes(m[1]),'SVG reference resolves: '+m[1]);
  const images=[...svg.matchAll(/<image\b[^>]*\bhref="([^"]+)"/g)].map(m=>m[1]);assert.deepEqual(images,['art/life6-orbit-v2.webp','moonkatty-life4-ship.webp'],'uses two existing local imagery resources');
  const bytes=Buffer.byteLength(svg),nodes=(svg.match(/<[a-zA-Z]/g)||[]).length;maxBytes=Math.max(maxBytes,bytes);maxNodes=Math.max(maxNodes,nodes);assert(bytes<15000,'complete SVG output <15KB raw');assert(nodes<100,'scene <100 SVG elements');scenes++;return svg;
 }
 for(const version of [1,2])for(let stage=0;stage<5;stage++)for(const seed of [0,1,7,29,401,777])for(const radius of [0,6]){
  const s=R.create(3,stage,seed,{radius});s.version=version;verify(s);
  for(const [angle,power,trim]of [[15,20,-20],[80,90,20],[40,48,0]]){const extreme=structuredClone(s);extreme.angle=angle;extreme.power=power;extreme.trim=version===2?trim:0;verify(extreme);}
  R.act(s,'angle',15);R.act(s,'power',20);if(version===2)R.act(s,'trim',-20);R.act(s,'burn');verify(s);assert.equal(s.burn,0,'bounded fixture starts with a genuine missed maneuver');
  while(!s.complete){const b=R.layout(s);R.act(s,'angle',b.target.angle);R.act(s,'power',b.target.power);if(version===2)R.act(s,'trim',b.target.trim);verify(s);assert(R.act(s,'burn'));verify(s);}assert.equal(s.burn,3);assert(R.won(s));
 }
 // Worst-case retained miss trail count, different historical weather, and current
 // input intentionally different from hidden target answers.
 const misses=R.create(3,3,401,{radius:6});for(let i=0;i<6;i++){R.act(misses,'angle',15+i);R.act(misses,'power',20+i);R.act(misses,'trim',-20+i);R.act(misses,'burn');}verify(misses);
 const hidden=fixture(),hp=hidden.art.prepareScene(3);hidden.load();await hp;hidden.context.FieldRules.layout=s=>{const b=R.layout(s);for(const t of b.targets)for(const key of ['angle','power','trim'])Object.defineProperty(t,key,{get(){throw new Error('hidden solution accessed: '+key);},enumerable:false});return freeze(b);};assert(hidden.art.scene(freeze(R.create(3,0,401)),3).includes(MARK),'renderer never reads hidden target angle/power/trim');
 // Dynamic localization is read at render time, rather than captured at script load.
 for(const lang of ['en','ru','uk','es','pt','de','fr','it','tr','he','ar','ko','zh']){
  if(lang!=='en')f.run('locales/'+lang+'.js');const strings=f.context.MKTYLocales?.[lang]?.strings||{};f.context.MKTYI18n={t:key=>strings[key]??key};const svg=verify(R.create(3,0,401));const label=String(strings.RELAY??'RELAY').replace(/[&<>"']/g,'');assert(svg.includes('>'+label+'</text>'),lang+' relay label is actual localized copy');
 }
 f.context.MKTYI18n={t:()=>'<script>&"\''};assert(!f.art.scene(R.create(3,0,401),3).includes('<script>'),'localized strings cannot inject SVG');delete f.context.MKTYI18n;
 // Compare exact core output with no identifier normalization, including mixed-call
 // sprite sequencing after optional flight renders. The reviewed core consumes no
 // sprite IDs for mechanism 3, and the optional renderer must preserve that fact.
 const old=fixture({loader:false}),next=fixture(),np=next.art.prepareScene(3);next.load();await np;
 for(let chapter=0;chapter<=9;chapter++)for(let stage=0;stage<5;stage++)for(const seed of [0,401]){
  const flight=R.create(3,stage,seed);old.art.scene(flight,chapter);assert(next.art.scene(flight,chapter).includes(MARK));
  for(let n=1;n<=11;n++)if(n!==3){const s=R.create(n,stage,seed);assert.equal(next.art.scene(s,chapter),old.art.scene(s,chapter),`exact PR54 scene n=${n} chapter=${chapter} stage=${stage}`);exactOtherScenes++;}
  const plan=P.plan(chapter||1,2),done=[0];assert.equal(next.art.map(chapter||1,plan.steps,done,i=>i===1),old.art.map(chapter||1,plan.steps,done,i=>i===1));exactMaps++;
  assert.equal(next.art.sprite(2,30,50,90),old.art.sprite(2,30,50,90),'optional flight rendering never advances shared sprite serial');exactMixed++;
 }
 const files=['field-art.js','field-art-loader.js',...fs.readdirSync(path.join(root,'art-scenes')).filter(n=>n.endsWith('.js')).sort().map(n=>'art-scenes/'+n)];
 const resources=files.map(file=>({file,raw:Buffer.byteLength(source(file)),gzip:zlib.gzipSync(source(file)).length}));
 const core=resources.find(x=>x.file==='field-art.js'),loader=resources.find(x=>x.file==='field-art-loader.js'),scene=resources.find(x=>x.file==='art-scenes/trajectory.js');assert(core.gzip<15000,'original standalone shared core budget, independent from module budgets');
 const cold=[core,loader,scene].reduce((n,x)=>n+x.gzip,0),catalog=resources.reduce((n,x)=>n+x.gzip,0),perSceneCold=resources.filter(x=>x.file.startsWith('art-scenes/')).map(x=>({file:x.file,gzip:core.gzip+loader.gzip+x.gzip}));for(const entry of perSceneCold)assert(entry.gzip<15000,'sum of separately gzipped core + loader + one scene <15000 bytes: '+entry.file);assert(catalog<25000,'entire separately gzipped optional scene catalog plus core/loader <25000 bytes');
 const fallbackSvg=f.core.scene(R.create(3,0,401),3),loadedSvg=f.art.scene(R.create(3,0,401),3),imageRefs=svg=>[...svg.matchAll(/<image\b[^>]*\bhref="([^"]+)"/g)].map(m=>m[1]);
 const fallbackImageFiles=[...new Set(imageRefs(fallbackSvg))].sort(),loadedImageFiles=[...new Set(imageRefs(loadedSvg))].sort(),coldImageFiles=[...new Set([...fallbackImageFiles,...loadedImageFiles])].sort();
 assert.deepEqual(fallbackImageFiles,['art/launch-bridge-v3.webp','moonkatty-life4-ship.webp'],'cold first frame uses the exact reviewed fallback image pair');
 assert.deepEqual(coldImageFiles,['art/launch-bridge-v3.webp','art/life6-orbit-v2.webp','moonkatty-life4-ship.webp'],'cold fallback-to-module transition requests this complete image union');
 const coldImageResources=coldImageFiles.map(file=>({file,bytes:fs.statSync(path.join(root,file)).size})),coldImageBytes=coldImageResources.reduce((n,x)=>n+x.bytes,0);assert(coldImageBytes<600000,'fallback plus loaded scene image union <600000 raw bytes, counted without cache assumptions');
 const p95=times.sort((a,b)=>a-b)[Math.floor(times.length*.95)];assert(p95<15,'source render p95 <15ms; not a browser/device paint claim');
 console.log(JSON.stringify({baseline:BASE,baselineTree:TREE,scenes,trajectoryPoints,maxBytes,maxNodes,renderP95ms:+p95.toFixed(3),exactOtherScenes,exactMaps,exactMixed,resources,perSceneCold,coldGzipBytes:cold,catalogGzipBytes:catalog,coldRawBytes:core.raw+loader.raw+scene.raw,coldScriptRequests:3,catalogScriptRequests:resources.length,coldTransitionImageRequests:coldImageFiles.length,coldTransitionImageBytes:coldImageBytes,coldTransitionImageResources:coldImageResources,fallbackImageRequests:fallbackImageFiles.length,fallbackImageBytes:fallbackImageFiles.reduce((n,file)=>n+fs.statSync(path.join(root,file)).size,0),existingImageRequests:2,existingImageBytes:fs.statSync(path.join(root,'art/life6-orbit-v2.webp')).size+fs.statSync(path.join(root,'moonkatty-life4-ship.webp')).size,limits:'Actual loader and module, immutable source/model checks. Browser/UI/paint are separate CI evidence; no physical-device claim.'},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
