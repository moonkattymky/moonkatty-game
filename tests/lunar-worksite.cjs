/* Renderer-only invariance, resource, contrast and deterministic-art budgets. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto'),zlib=require('node:zlib'),path=require('node:path');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'field-art.js'),'utf8'),R=require('../field-model.js');
const baseHashes={
 // Client-only release composition: live route handshake and Convoy bounds retained; Echo/Gate terminal recovery included.
 'field-model.js':'5fdb5a58cdb3d48a09da6cc2c63aa3d7f3f3f7a663fa7410b42279d68485b513',
 'field-missions.js':'87ae7505443efcaa76ec1cf8c9b0293493a8d3b32ded761d08f8fae280bbf168',
 'story-plan.js':'fd4683463fc1bcf72862b33478a6d4d1036036632ccff88a049798428d583474',
 'story.js':'82f189960b85d245550e322b4dbd53cb182dfadc60e2a33d164abf45a5e90086',
 'storage.js':'c8a4becffdff791e36ce0a709a8cd8dba2cfa5a4f4e8cde4732ab2565a9261c9',
 'trace-codec.js':'baba00a4cc9a4ab309382220d3e37b7b35ddc925a582012d8d4d622c124ea865',
 'rewards-client.js':'9ac6c53684fc8058e0c3f73be4d0a396749521607c4dbb592584cd3f812d700c',
 'expedition-model.js':'5209ca04232a01204a3ab1019e32a4cef92c5600de2370cd62243a497ba3e571'
};
for(const [file,hash]of Object.entries(baseHashes))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex'),hash,file+' matches the pinned reviewed baseline (with convoy, Echo and closing-gate checkpoint corrections)');
const c={window:{},FieldRules:R};vm.createContext(c);vm.runInContext(source,c);
let scenes=0,maxBytes=0,maxNodes=0;const times=[];
for(let stage=0;stage<4;stage++)for(let seed=0;seed<40;seed++)for(const scanned of [false,true]){
 const s=R.create(1,stage,seed);s.scanned=scanned;if(seed%3===1)s.collected=[R.layout(s).targets[0]];
 const previous=JSON.stringify(s),t=performance.now(),svg=c.window.FieldArt.scene(s,1);times.push(performance.now()-t);
 assert.equal(JSON.stringify(s),previous,'render never mutates gameplay');
 assert.equal(c.window.FieldArt.scene(s,1),svg,'render is deterministic');
 assert(svg.includes('data-renderer="lunar-worksite-v2"'));
 assert(!/<filter|<animate|foreignObject|https?:\/\/(?!www.w3.org)/.test(svg),'no full-frame filters, repeating motion or external requests');
 const images=[...svg.matchAll(/<image[^>]+href="([^"]+)"/g)].map(m=>m[1]);assert.deepEqual(images,['art/lunar-worksite-atlas-v1.webp','art/lunar-worksite-ground-v1.webp'],'exactly two shared static image resources');
 const ids=[...svg.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length,'no duplicate SVG identifiers');
 for(const m of svg.matchAll(/(?:href="#|url\(#)([^"\)]+)/g))assert(ids.includes(m[1]),'every SVG reference resolves: '+m[1]);
 assert.equal((svg.match(/data-field-cell=/g)||[]).length,36);assert.equal((svg.match(/width="94" height="94"/g)||[]).length,36);
 const cells=[...svg.matchAll(/data-field-cell="(\d+)"[^>]*tabindex="(-?\d+)"/g)];
 assert.deepEqual(cells.map(m=>+m[1]),Array.from({length:36},(_,i)=>i));
 for(const m of svg.matchAll(/<g data-field-cell=[\s\S]*?<\/g>/g))assert(!/<svg|<image|<use/.test(m[0]),'atlas artwork cannot enlarge interaction group bounds');
 for(const m of cells)assert.equal(+m[2],R.layout(s).walls.includes(+m[1])?-1:0,'wall keyboard semantics unchanged');
 assert.equal((svg.match(/class="lunar-footing"/g)||[]).length,8,'eight contained structural equipment footings');
 assert.equal(new Set([...svg.matchAll(/data-prop="([^"]+)"/g)].map(m=>m[1])).size,8,'all eight obstacle silhouettes differ');
 assert.equal((svg.match(/class="lunar-objective"/g)||[]).length,3);assert(!/class="lunar-objective"[^>]+opacity=/.test(svg),'objective badge opacity never fades with collected art');assert.equal((svg.match(/class="lunar-hazard"/g)||[]).length,3);
 assert.equal((svg.match(/class="lunar-exit"/g)||[]).length,1);
 const bytes=Buffer.byteLength(svg),nodes=(svg.match(/<[a-zA-Z]/g)||[]).length;maxBytes=Math.max(maxBytes,bytes);maxNodes=Math.max(maxNodes,nodes);
 assert(bytes<48000,'SVG per-redraw source budget <48KB');assert(nodes<650,'SVG DOM budget <650 nodes');
 scenes++;
}
// A next-step cue must not invite the player into an unscanned hazardous tile.
const cueState=R.create(1,0,0);for(const cell of [31,32,26])assert(R.act(cueState,'move',cell));
let cueSvg=c.window.FieldArt.scene(cueState,1),hazardCell=cueSvg.match(/<g data-field-cell="27"[^>]*>/)[0];assert(!hazardCell.includes('reachable'),'unscanned hazard has no legal-next-step cue');
assert(R.act(cueState,'scan'));cueSvg=c.window.FieldArt.scene(cueState,1);hazardCell=cueSvg.match(/<g data-field-cell="27"[^>]*>/)[0];assert(hazardCell.includes('reachable'),'scanned adjacent hazard gets a legal-next-step cue');
const lum=h=>h.match(/../g).map(x=>parseInt(x,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0),contrast=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
const pairs=[['objective','fff2cf','173e52'],['recovered','fff2cf','315b65'],['exit','eff6df','174959']];for(const [name,a,b]of pairs)assert(contrast(a,b)>=4.5,name+' label has >=4.5:1 opaque contrast');
const p95=times.sort((a,b)=>a-b)[Math.floor(times.length*.95)];assert(p95<15,'source renderer p95 <15ms on test runner (not a physical phone benchmark)');
const assets=['lunar-worksite-atlas-v1.webp','lunar-worksite-ground-v1.webp'].map(n=>fs.statSync(path.join(root,'art',n)).size);assert(assets.reduce((a,b)=>a+b,0)<850000,'first-scene image budget <850KB');
const artGzip=zlib.gzipSync(source).byteLength;assert(artGzip<15000,'complete shared renderer <15KB gzip');
console.log(JSON.stringify({scenes,maxBytes,maxNodes,renderP95ms:+p95.toFixed(3),rendererGzipBytes:artGzip,imageBytes:assets.reduce((a,b)=>a+b,0),immutableCoreFiles:Object.keys(baseHashes).length,labelContrast:pairs.map(([name,a,b])=>({name,ratio:+contrast(a,b).toFixed(2)})),limits:'Browser paint/touch is checked separately; no physical Telegram certification.'},null,2));
