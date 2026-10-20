/* MOONKATTY robot/storage notifications: scheduled sender (OFF by default).
   Called every 5 min by the scheduled job (schedule.sql). It only messages players who opted in from the game
   (Telegram WebApp.requestWriteAccess() + world.notify.optin) and whose ping is due; throttling is enforced in
   Postgres by mkty_notify_due (>= 3 h between pings of one kind, <= 3 pings per player per UTC day).
   Disabled unless NOTIFY_SENDER_ENABLED=1, TELEGRAM_BOT_TOKEN and NOTIFY_CRON_SECRET are all set: then it returns
   {enabled:false} without reading the queue or contacting Telegram. Never logs the token. */
export const MIN_GAP_S=3*3600, DAY_CAP=3, BATCH=50;
const SITE='https://moonkattymky.github.io/moonkatty-game/world3d/';
export const TEXTS={
 ru:{robot:'🤖 Робот вернулся на базу MOONKATTY — забери добычу!',storage:'📦 Склад базы заполнен — забери ресурсы, чтобы роботы не простаивали.',open:'Открыть базу'},
 en:{robot:'🤖 Your robot is back at MOONKATTY base — collect the haul!',storage:'📦 Base storage is full — collect it so your robots keep working.',open:'Open base'}
};
function sameSecret(a,b){if(typeof a!=='string'||typeof b!=='string'||!b)return false;let d=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)d|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return d===0;}
export function messageFor(kind,lang){const t=TEXTS[String(lang||'').slice(0,2)==='ru'?'ru':'en'];return {text:t[kind],reply_markup:{inline_keyboard:[[{text:t.open,web_app:{url:SITE}}]]}};}
export function createNotifySender({enabled=false,token='',cronSecret='',url='',key='',fetcher=fetch,clock=()=>new Date()}){
 const on=enabled===true&&!!token&&!!cronSecret&&!!url&&!!key;
 const db=async(path,body,method='POST')=>{const r=await fetcher(new URL(path,url.endsWith('/')?url:url+'/'),{method,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify(body),signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('database:'+r.status);const t=await r.text();return t?JSON.parse(t):null;};
 return async req=>{
  if(req.method!=='POST')return Response.json({ok:false},{status:405});
  if(!on)return Response.json({ok:true,enabled:false,sent:0});
  if(!sameSecret(req.headers.get('x-mkty-cron-secret'),cronSecret))return Response.json({ok:false},{status:401});
  const due=await db('/rest/v1/rpc/mkty_notify_due',{p_now:clock().toISOString(),p_limit:BATCH,p_min_gap:MIN_GAP_S,p_day_cap:DAY_CAP});
  let sent=0,failed=0,blocked=0;
  for(const d of Array.isArray(due)?due:[]){
   try{const r=await fetcher('https://api.telegram.org/bot'+token+'/sendMessage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:d.telegram_id,...messageFor(d.kind,d.lang)}),signal:AbortSignal.timeout(8000)});
    if(r.ok){sent++;continue;}
    if(r.status===403){blocked++;await db('/rest/v1/mkty_notify_prefs?telegram_id=eq.'+Number(d.telegram_id),{opted_in:false,updated_at:clock().toISOString()},'PATCH');continue;} // user blocked the bot: stop for good
    failed++;
   }catch{failed++;}
  }
  return Response.json({ok:true,enabled:true,due:Array.isArray(due)?due.length:0,sent,failed,blocked});
 };
}
