#!/usr/bin/env node
/* Activation helper for @MoonKattyGameBot (server/bot). DRY RUN by default: prints what it would do.
   It never runs in CI and the repository never stores a token.

   Usage (operator machine only):
     TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... \
     BOT_WEBHOOK_URL=https://<project>.supabase.co/functions/v1/bot \
     node tools/bot/activate-bot.mjs            # dry run: shows current webhook + planned calls
     node tools/bot/activate-bot.mjs --apply    # sets webhook, commands and the menu "Играть" button

   Safety: if a webhook already points to a DIFFERENT URL, --apply refuses unless --replace is given. */
const SITE='https://moonkattymky.github.io/moonkatty-game/';
const COMMANDS=[{command:'start',description:'Открыть MOONKATTY'},{command:'terms',description:'Условия использования'},{command:'privacy',description:'Конфиденциальность'},{command:'review',description:'Проверка заданий — для модераторов'}];
const {TELEGRAM_BOT_TOKEN:token,TELEGRAM_WEBHOOK_SECRET:secret,BOT_WEBHOOK_URL:url}=process.env;
const apply=process.argv.includes('--apply'),replace=process.argv.includes('--replace');
if(!token||!secret||!url){console.error('Set TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET and BOT_WEBHOOK_URL.');process.exit(2);}
async function api(method,body){const r=await fetch(`https://api.telegram.org/bot${token}/${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body||{})});const d=await r.json();if(!d.ok)throw Error(method+': '+d.description);return d.result;}
const info=await api('getWebhookInfo');
console.log('Current webhook:',info.url||'(none)','| pending updates:',info.pending_update_count,'| last error:',info.last_error_message||'—');
const plan=[['setWebhook',{url,secret_token:secret,allowed_updates:['message','callback_query'],drop_pending_updates:false}],['setMyCommands',{commands:COMMANDS}],['setChatMenuButton',{menu_button:{type:'web_app',text:'Играть',web_app:{url:SITE}}}]];
if(!apply){console.log('DRY RUN. Would call:');for(const [m,b] of plan)console.log(' -',m,JSON.stringify({...b,secret_token:b.secret_token?'***':undefined}));process.exit(0);}
if(info.url&&info.url!==url&&!replace){console.error('A different webhook is active. Re-run with --replace only if you are sure it is unused.');process.exit(3);}
for(const [m,b] of plan){await api(m,b);console.log('OK',m);}
console.log('Done. Send /start to @MoonKattyGameBot to verify.');
