/* A green deployment is insufficient: compare live bytes with the checked-out artifact. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),site='https://moonkattymky.github.io/moonkatty-game/';
const files=['index.html','storage.js','cloud-save.js','rewards-client.js','story.js','story-plan.js','field-model.js','mission-control.js','void7.css','art/station-details-v2.webp'];
const nonce=Date.now()+'-'+crypto.randomBytes(5).toString('hex');
async function get(url){const r=await fetch(url+(url.includes('?')?'&':'?')+'verify='+nonce,{cache:'no-store',headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(url+': HTTP '+r.status);return Buffer.from(await r.arrayBuffer());}
(async()=>{
 for(const file of files){const b=await get(site+file);if(!b.equals(fs.readFileSync(path.join(root,file))))throw Error('Published file differs: '+file);}
 const build=JSON.parse(await get(site+'build.json'));if(process.env.GITHUB_SHA&&build.sha!==process.env.GITHUB_SHA)throw Error('Published SHA differs');
 const base='https://lswbmgoeinblzuqzakvi.supabase.co/functions/v1/';
 for(const name of ['rewards','mission-control']){const body=JSON.parse(await get(base+name));if(body.ok!==true||name==='mission-control'&&!Array.isArray(body.entries))throw Error('API health: '+name);}
 console.log('PASS: published SHA, '+files.length+' exact files, station art and live APIs');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
