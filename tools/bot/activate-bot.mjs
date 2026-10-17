#!/usr/bin/env node
/* Activation helper for @MoonKattyGameBot (server/bot). DRY RUN by default: prints what it would do.
   It never runs in CI and the repository never stores a token.

   Secrets are NEVER passed on the command line (they would stay in shell history and
   be visible in the process list). They are read, in this order, from:
     1. an env file: --secrets-file=<path> (default: tools/bot/.env, ignored by git);
     (Not "--env-file": Node 20 intercepts that flag itself, even after the script name.)
     2. variables already present in the environment (e.g. exported in the shell session);
     3. a hidden interactive prompt (input is not echoed) for anything still missing.

   Usage (operator machine only):
     cp tools/bot/.env.example tools/bot/.env   # then fill it in; never commit it
     node tools/bot/activate-bot.mjs            # dry run: shows current webhook + planned calls
     node tools/bot/activate-bot.mjs --apply    # sets webhook, commands and the menu "Играть" button

   Safety: if a webhook already points to a DIFFERENT URL, --apply refuses unless --replace is given. */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import {fileURLToPath} from 'node:url';

const SITE='https://moonkattymky.github.io/moonkatty-game/';
const COMMANDS=[{command:'start',description:'Открыть MOONKATTY'},{command:'terms',description:'Условия использования'},{command:'privacy',description:'Конфиденциальность'},{command:'review',description:'Проверка заданий — для модераторов'}];
const KEYS=['TELEGRAM_BOT_TOKEN','TELEGRAM_WEBHOOK_SECRET','BOT_WEBHOOK_URL'];
const SECRET_KEYS=new Set(['TELEGRAM_BOT_TOKEN','TELEGRAM_WEBHOOK_SECRET']);
const args=process.argv.slice(2);
const apply=args.includes('--apply'),replace=args.includes('--replace');
const here=path.dirname(fileURLToPath(import.meta.url));

// Refuse anything that looks like a secret on the command line.
for(const a of args){
 if(!/^--(apply|replace|secrets-file=.+)$/.test(a)){console.error('Unknown argument. Secrets must not be passed on the command line; use an env file or the prompt.');process.exit(2);}
}

export function parseEnvFile(text){
 const out={};
 for(const line of String(text).split(/\r?\n/)){
  const m=/^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);if(!m||line.trim().startsWith('#'))continue;
  let v=m[2];if(/^(['"]).*\1$/.test(v))v=v.slice(1,-1);else v=v.replace(/\s+#.*$/,'');out[m[1]]=v;
 }
 return out;
}

function readEnvFile(){
 const flag=args.find(a=>a.startsWith('--secrets-file='));
 const file=flag?path.resolve(flag.slice('--secrets-file='.length)):path.join(here,'.env');
 if(!fs.existsSync(file)){if(flag){console.error('Env file not found: '+file);process.exit(2);}return {};}
 try{const mode=fs.statSync(file).mode&0o077;if(mode&&process.platform!=='win32')console.warn('Warning: '+file+' is readable by other users; run: chmod 600 '+file);}catch{}
 return parseEnvFile(fs.readFileSync(file,'utf8'));
}

function ask(question,hidden){
 return new Promise(resolve=>{
  const rl=readline.createInterface({input:process.stdin,output:process.stdout,terminal:true});
  if(hidden){rl._writeToOutput=function(s){if(s.includes(question))rl.output.write(s);};}
  rl.question(question,answer=>{rl.close();if(hidden)process.stdout.write('\n');resolve(answer.trim());});
 });
}

const fileEnv=readEnvFile(),cfg={};
for(const k of KEYS)cfg[k]=fileEnv[k]||process.env[k]||'';
for(const k of KEYS){
 if(cfg[k])continue;
 if(!process.stdin.isTTY){console.error('Missing '+k+'. Put it in tools/bot/.env (see tools/bot/.env.example).');process.exit(2);}
 cfg[k]=await ask(k+(SECRET_KEYS.has(k)?' (hidden): ':': '),SECRET_KEYS.has(k));
}
const {TELEGRAM_BOT_TOKEN:token,TELEGRAM_WEBHOOK_SECRET:secret,BOT_WEBHOOK_URL:url}=cfg;
if(!token||!secret||!url){console.error('Set TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET and BOT_WEBHOOK_URL.');process.exit(2);}
if(!/^\d{5,15}:[A-Za-z0-9_-]{30,}$/.test(token)){console.error('TELEGRAM_BOT_TOKEN has an unexpected format.');process.exit(2);}
if(!/^[A-Za-z0-9_-]{1,256}$/.test(secret)){console.error('TELEGRAM_WEBHOOK_SECRET must be 1-256 chars of A-Z a-z 0-9 _ - (Telegram rule).');process.exit(2);}
if(!/^https:\/\//.test(url)){console.error('BOT_WEBHOOK_URL must start with https://');process.exit(2);}

async function api(method,body){
 let r;try{r=await fetch(`https://api.telegram.org/bot${token}/${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body||{})});}
 catch{throw Error(method+': network error');} // never print the request URL: it contains the token
 const d=await r.json().catch(()=>({}));if(!d.ok)throw Error(method+': '+String(d.description||r.status));return d.result;
}
try{
 const info=await api('getWebhookInfo');
 console.log('Current webhook:',info.url||'(none)','| pending updates:',info.pending_update_count,'| last error:',info.last_error_message||'—');
 const plan=[['setWebhook',{url,secret_token:secret,allowed_updates:['message','callback_query'],drop_pending_updates:false}],['setMyCommands',{commands:COMMANDS}],['setChatMenuButton',{menu_button:{type:'web_app',text:'Играть',web_app:{url:SITE}}}]];
 if(!apply){console.log('DRY RUN. Would call:');for(const [m,b] of plan)console.log(' -',m,JSON.stringify({...b,secret_token:b.secret_token?'***':undefined}));process.exit(0);}
 if(info.url&&info.url!==url&&!replace){console.error('A different webhook is active. Re-run with --replace only if you are sure it is unused.');process.exit(3);}
 for(const [m,b] of plan){await api(m,b);console.log('OK',m);}
 console.log('Done. Send /start to @MoonKattyGameBot to verify.');
}catch(e){console.error(String(e.message||e).split(token).join('***'));process.exit(1);}
