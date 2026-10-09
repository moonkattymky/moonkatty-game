/* A green deployment is insufficient: compare live bytes with the checked-out artifact. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),site='https://moonkattymky.github.io/moonkatty-game/';
const files=['index.html','app.js','storage.js','cloud-save.js','rewards-client.js','story.js','story-plan.js','field-model.js','field-missions.js','expedition.js','expedition-model.js','locale-loader.js','mission-control.js','mission-control.css','void7.css','art/station-details-v2.webp','social.js','growth.js','terms.html','privacy.html','legal.css','locales/runtime/ru.js','art/moonkatty-game-mark.webp'];
const version=fs.readFileSync(path.join(root,'index.html'),'utf8').match(/name="mkty-release" content="([^"]+)"/)[1];
async function get(url){const nonce=Date.now()+'-'+crypto.randomBytes(5).toString('hex');const r=await fetch(url+(url.includes('?')?'&':'?')+'verify='+nonce,{cache:'no-store',headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(url+': HTTP '+r.status);return Buffer.from(await r.arrayBuffer());}
async function verify(){
 for(const file of files){const b=await get(site+file);if(!b.equals(fs.readFileSync(path.join(root,file))))throw Error('Published file differs: '+file);}
 const build=JSON.parse(await get(site+'build.json'));if(build.version!==version||process.env.GITHUB_SHA&&build.sha!==process.env.GITHUB_SHA)throw Error('Published version/SHA differs');
 const base='https://lswbmgoeinblzuqzakvi.supabase.co/functions/v1/';
 for(const name of ['rewards','telegram-progress','mission-control']){const body=JSON.parse(await get(base+name));if(body.ok!==true||(name==='mission-control'?!Array.isArray(body.entries):body.version!==version))throw Error('API health/version: '+name);}
 console.log('PASS: published SHA, '+files.length+' exact files, station art and live APIs');
}
(async()=>{for(let attempt=1;attempt<=8;attempt++){try{await verify();return;}catch(e){if(attempt===8)throw e;console.log('Waiting for publication ('+attempt+'/8): '+e.message);await new Promise(r=>setTimeout(r,15000));}}})().catch(e=>{console.error(e.message);process.exitCode=1;});
