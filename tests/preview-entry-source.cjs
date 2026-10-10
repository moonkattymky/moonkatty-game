/* Reviewed production boundaries for optional preview hosting. No browser/network. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const hashes={
  "app.js": "6ff60f10b51ceebd9f5919902ebc28794bdb317c17f1e2a5ce7b773286e1310d",
  "storage.js": "c8a4becffdff791e36ce0a709a8cd8dba2cfa5a4f4e8cde4732ab2565a9261c9",
  "cloud-save.js": "ed7a169ca5cb62c6436f25bc858794ca9b29155e73a3fb33da8b4515ea97da71",
  "rewards-client.js": "9ac6c53684fc8058e0c3f73be4d0a396749521607c4dbb592584cd3f812d700c",
  "story.js": "82f189960b85d245550e322b4dbd53cb182dfadc60e2a33d164abf45a5e90086",
  "story-plan.js": "fd4683463fc1bcf72862b33478a6d4d1036036632ccff88a049798428d583474",
  "field-model.js": "94ab25d49258d5ca64cdf391eccdaadd3b3f10370b363295a4c3bd3a58aea7a8",
  "field-missions.js": "87ae7505443efcaa76ec1cf8c9b0293493a8d3b32ded761d08f8fae280bbf168",
  "expedition.js": "ea241b53d6dc50e93a5051155a034495d854b125a35f5fc8478fceba8912da35",
  "pacing.js": "017ee7c539b7755cf5082e5f2a2507274214d4055a4dee74d75b78090698d11c",
  "server/rewards/index.ts": "ce7b2ea12f9ea1e7cddc46383a90298457065357afd3d7e28ed28ab470a8f4c4",
  "server/rewards/core.mjs": "a2546e45ac81691e61583da47426c3b39ba833ef706214400f603616d9242a03",
  "server/rewards/campaign.mjs": "eaa67e2e4ba4753d15fb45e94cf2e10489c659756bd10ec3da4699329e0e9326",
  "server/rewards/models/field-model.mjs": "4bca76e0605f5e549ec4f07e91ef89470b7cb6dc80979b6069545ce6ddc0dbba",
  "graphics-preview/index.html": "e53823f9a85936988d34077bdb904f547c60d2d908e090e610afd684da04949a",
  "graphics-preview/world.css": "e1feac708b376349e63d89b3ccff53bc322c7c231ea862d346e3cdc1388894fd",
  "graphics-preview/scene.js": "75070efc6d60b7f586d28755b0232c94d165bb042db1ac25ac9529a55ec24786",
  "graphics-preview/art/earth.webp": "fc617c8bc5f8e229046dae41d216a10de79e0e3503b0c664e8b2b086984b765c",
  "graphics-preview/art/regolith.webp": "e59688577b0d09644a426e7ccf5656626028500904e9a14352d3d4a1c534f933",
  "graphics-preview/vendor/three-r170.module.min.js": "08fd7545d13d2c7fb65ab691530a802dafefd638596501854f267d0fb13c39e7",
  "graphics-preview/vendor/THREE-LICENSE.txt": "4c40a1ef62450b857c3b2aaf294936304cd552d965fbcd9d32d4c5bcf4ba4454"
};
for(const [p,sha]of Object.entries(hashes))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex'),sha,p+' stays byte-identical to the reviewed source');
const index=read('index.html'),host=read('preview-entry.js'),embedded=read('graphics-preview/embed.html');
assert(index.includes('id="preview3DEntry"'));assert(!/<iframe|(?:src|href)="graphics-preview\//.test(index),'root loads no 3D document/module/texture');
assert(!/initData|localStorage|MKTYRewards|authenticatedFetch|fetch\(/.test(host),'host does not copy auth, touch campaign storage or call game APIs');
assert(host.includes("document.getElementById('home')?.classList.contains('active')"));
assert(host.includes('event.origin!==location.origin||event.source!==frame.contentWindow'),'current frame and origin are required');
assert(host.includes("frame.referrerPolicy='no-referrer'"));assert(host.includes('frame?.contentWindow?.MKTYOpenWorld?.dispose()'));
assert(!embedded.includes('telegram-web-app.js'));assert.equal((embedded.match(/data-preview-return/g)||[]).length,2);assert(!embedded.includes('href="../"'));
const expected=read('graphics-preview/index.html').replace('  <script src="https://telegram.org/js/telegram-web-app.js" defer></script>','  <meta name="referrer" content="no-referrer">\n  <script src="embed.js?v=20261010-3d-test-1" defer></script>').replaceAll('href="../"','href="#return" data-preview-return').replace('Escape — пауза.','Escape — вернуться в основную игру.');
assert.equal(embedded,expected,'embedded page only removes the second SDK bridge and intercepts return links');
const world=read('graphics-preview/world.js');assert(world.includes('if(closed){renderer.dispose();return;}'),'late scene startup cannot restart a closed preview');
assert(world.includes('Object.freeze({snapshot,pause:suspend,dispose})'));assert(world.includes('if(paused)pause();else canvas.focus'));
assert(zlib.gzipSync(host).length<5000,'small initial host script, no bundled 3D');
const live=read('tools/verify-live.cjs');for(const p of ['preview-entry.js','preview-entry.css','graphics-preview/embed.html','graphics-preview/embed.js','graphics-preview/world.js','graphics-preview/scene.js','graphics-preview/vendor/three-r170.module.min.js','graphics-preview/art/earth.webp','graphics-preview/art/regolith.webp'])assert(live.includes("'"+p+"'"),'deployment verifies '+p);
console.log('PASS: '+Object.keys(hashes).length+' unchanged production/art files, lazy auth-free host, embedded return/SDK boundary, lifecycle guards and live-byte coverage');
