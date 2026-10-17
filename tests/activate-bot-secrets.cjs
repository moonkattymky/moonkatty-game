/* tools/bot/activate-bot.mjs never takes secrets from the command line and never echoes them.
   Only failure paths that exit before any network call are executed (no Telegram requests). */
'use strict';
const assert=require('node:assert/strict'),{spawnSync,execFileSync}=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const root=path.resolve(__dirname,'..'),script=path.join(root,'tools/bot/activate-bot.mjs');
const fakeToken='123456789:'+'A'.repeat(35),fakeSecret='synthetic_webhook_secret';
const env={...process.env};for(const k of ['TELEGRAM_BOT_TOKEN','TELEGRAM_WEBHOOK_SECRET','BOT_WEBHOOK_URL'])delete env[k];
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mkty-activate-'));
const run=(args,extraEnv={})=>spawnSync(process.execPath,[script,...args],{env:{...env,...extraEnv},input:'',encoding:'utf8',timeout:10000});
const file=(name,text)=>{const p=path.join(dir,name);fs.writeFileSync(p,text,{mode:0o600});return p;};
try{
 for(const args of [['--token='+fakeToken],[fakeToken],['--apply',fakeToken],['--secret='+fakeSecret]]){
  const r=run(args);assert.equal(r.status,2,args.join(' '));assert.match(r.stderr,/must not be passed on the command line/);
  assert(!(r.stdout+r.stderr).includes(fakeToken)&&!(r.stdout+r.stderr).includes(fakeSecret),'secrets are never echoed');
 }
 const empty=run(['--secrets-file='+file('empty.env','')]);assert.equal(empty.status,2);assert.match(empty.stderr,/Missing TELEGRAM_BOT_TOKEN/);
 const missing=run(['--secrets-file='+path.join(dir,'nope.env')]);assert.equal(missing.status,2);assert.match(missing.stderr,/Env file not found/);
 const bad='12:short-token-value';
 const malformed=run(['--secrets-file='+file('bad.env',`TELEGRAM_BOT_TOKEN=${bad}\nTELEGRAM_WEBHOOK_SECRET=${fakeSecret}\nBOT_WEBHOOK_URL=https://example.test/bot\n`)]);
 assert.equal(malformed.status,2);assert.match(malformed.stderr,/unexpected format/);assert(!(malformed.stdout+malformed.stderr).includes(bad)&&!(malformed.stdout+malformed.stderr).includes(fakeSecret));
 const insecure=run(['--secrets-file='+file('url.env',`TELEGRAM_BOT_TOKEN=${fakeToken}\nTELEGRAM_WEBHOOK_SECRET=${fakeSecret}\nBOT_WEBHOOK_URL=http://example.test/bot\n`)]);
 assert.equal(insecure.status,2);assert.match(insecure.stderr,/must start with https/);assert(!(insecure.stdout+insecure.stderr).includes(fakeToken));
 // Environment variables work too (e.g. exported in the shell); validation still precedes any request.
 const viaEnv=run([],{TELEGRAM_BOT_TOKEN:fakeToken,TELEGRAM_WEBHOOK_SECRET:'bad secret!',BOT_WEBHOOK_URL:'https://example.test/bot'});
 assert.equal(viaEnv.status,2);assert.match(viaEnv.stderr,/TELEGRAM_WEBHOOK_SECRET must be/);assert(!(viaEnv.stdout+viaEnv.stderr).includes(fakeToken));
 // Real env files stay out of git; only the example is tracked.
 for(const p of ['tools/bot/.env','server/.env','.env','prod.env','.env.local'])assert.equal(spawnSync('git',['check-ignore','-q',p],{cwd:root}).status,0,p+' is ignored by git');
 for(const p of ['tools/bot/.env.example','server/.env.example'])assert.equal(spawnSync('git',['check-ignore','-q',p],{cwd:root}).status,1,p+' stays tracked');
 const readme=fs.readFileSync(path.join(root,'server/bot/README.md'),'utf8');assert(!/activate-bot\.mjs\s+\S*\d{5,}:/.test(readme),'docs never show a token argument');
 console.log('PASS: activate-bot refuses CLI secrets, validates env-file/env input without echoing secrets, real .env files are git-ignored (no network)');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
