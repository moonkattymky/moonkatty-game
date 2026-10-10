const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),scripts=[...html.matchAll(/<script src="([^"]+)"/g)].map(x=>x[1]);
assert(!scripts.some(x=>/^(game|app|storage|cloud-save|rewards-client|growth|ads|payments)\.js$/.test(x)));
const upstream=JSON.parse(fs.readFileSync(path.join(root,'UPSTREAM-PROVENANCE.json'),'utf8'));
for(const file of upstream.files){const bytes=fs.readFileSync(path.join(root,file.path));if(file.path!=='renderer.js'){assert.equal(bytes.length,file.bytes,file.path);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),file.sha256,file.path+' keeps upstream identity');}}
for(const asset of fs.readdirSync(path.join(root,'assets'))){assert(!asset.includes('sculpted-cat'));assert(fs.statSync(path.join(root,'assets',asset)).size>100);}
let serial=10;const gl=new Proxy({getShaderParameter:()=>true,getProgramParameter:()=>true,getParameter:()=>4096,getExtension:()=>null,getAttribLocation:()=>0,getUniformLocation:()=>({}),checkFramebufferStatus:()=>1},{get:(o,k)=>k in o?o[k]:/^create/.test(k)?()=>({}):/^[A-Z_0-9]+$/.test(k)?(o[k]=serial++):()=>{}});
const context2d=new Proxy({measureText:t=>({width:t.length*14}),createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}}),getImageData:()=>({data:new Uint8ClampedArray(1024*1024*4)})},{get:(o,k)=>k in o?o[k]:()=>{}});
const canvas=()=>({width:960,height:540,clientWidth:960,clientHeight:540,getContext:type=>type==='2d'?context2d:gl});
const sandbox={console,Math,Float32Array,Uint16Array,Uint8Array,Map,Set,performance,URLSearchParams,location:{search:'?lang=en'},navigator:{language:'en'},Intl,document:{createElement:()=>canvas()},devicePixelRatio:1};sandbox.globalThis=sandbox;vm.createContext(sandbox);
for(const file of scripts.filter(x=>x!=='preview.js'))vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),sandbox,{filename:file,timeout:30000});
assert.deepEqual(Object.keys(sandbox.MoonCore).filter(x=>/save|award|interact|build|solve|tick|claim|initial|sanitize|upgrade/i.test(x)),[]);
assert(Object.isFrozen(sandbox.MoonCore));
const r=new sandbox.MoonRenderer(canvas()),state={chapter:1,collected:[],cells:[],tools:[],beacons:[],buildings:[],cards:{},recorder:false,signal:false,supply:false},p={x:0,z:12,yaw:0,speed:0,alt:0};
assert(r.meshes.terrain1);assert(!r.meshes.terrain2,'Only first zone terrain is allocated');
const spawn=r.safeSpawn(p.x,p.z,state);assert(!r.blocked(spawn.x,spawn.z,state));
r.render(state,p,0,.016,0,0,false);assert(r.queue.length>50,'Spatial 3D scene submits geometry');
assert.equal(sandbox.MoonCharacterAtlas.idle.image,'assets/moonkatty-idle-v44.webp');
for(const direction of ['up','down','left','right'])assert(sandbox.MoonCharacterWalkAtlas[direction]);
assert.equal(sandbox.OpenWorldI18n.langs.length,13);
for(const lang of sandbox.OpenWorldI18n.langs){const c={location:{search:'?lang='+lang},navigator:{language:'en'},URLSearchParams};c.globalThis=c;vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(root,'preview-i18n.js'),'utf8'),c);assert.equal(c.OpenWorldI18n.lang,lang);for(const k of ['title','run','jump','action','pause','notice'])assert.notEqual(c.OpenWorldI18n.t(k),k);}
for(const file of ['preview.js','visual-core.js'])assert(!/localStorage|sessionStorage|fetch\(|XMLHttpRequest|sendBeacon|Supabase|MKTYRewards/.test(fs.readFileSync(path.join(root,file),'utf8')),'Preview isolation');
console.log(JSON.stringify({status:'passed',scripts:scripts.length,firstZoneOnly:true,renderQueue:r.queue.length,meshCount:Object.keys(r.meshes).length,languages:13,source:upstream.source||upstream.repository||'UPSTREAM-PROVENANCE.json'}));
