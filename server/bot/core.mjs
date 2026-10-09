/* First-game commands and on-demand moderation. No unsolicited messages.
   Configure a separate webhook secret; a bot token alone does not authenticate updates. */
import {issueSession} from '../rewards/session.mjs';
import {parseAdminIds} from '../rewards/creator.mjs';
const SITE='https://moonkattymky.github.io/moonkatty-game/';
export const COMMANDS=[{command:'start',description:'Открыть MOONKATTY'},{command:'terms',description:'Условия использования'},{command:'privacy',description:'Конфиденциальность'},{command:'review',description:'Проверка заданий — для модераторов'}];
function sameSecret(a,b){if(typeof a!=='string'||typeof b!=='string'||!b)return false;let diff=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return diff===0;}
export function createBotHandler({token,webhookSecret,serviceKey,rewardsHandler,adminIds='',fetcher=fetch,clock=()=>new Date()}){
 const admins=adminIds instanceof Set?adminIds:parseAdminIds(adminIds);
 const result=(status=200)=>Response.json({ok:status===200},{status});
 async function api(method,body){const r=await fetcher('https://api.telegram.org/bot'+token+'/'+method,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(8000)});const d=await r.json();if(!r.ok||!d.ok)throw Error('telegram_unavailable');return d.result;}
 const send=(id,text,reply_markup)=>api('sendMessage',{chat_id:id,text,...(reply_markup?{reply_markup}:{})});
 async function rewardCall(user,action,body={}){const {token:session}=await issueSession(user,serviceKey,clock().getTime());const r=await rewardsHandler(new Request('https://internal/rewards',{method:'POST',body:JSON.stringify({session,action,...body})}));return {status:r.status,...await r.json()};}
 return async req=>{
  if(req.method!=='POST')return result(405);
  if(!token||!webhookSecret||!serviceKey||!rewardsHandler)return result(503);
  if(!sameSecret(req.headers.get('x-telegram-bot-api-secret-token'),webhookSecret))return result(401);
  let update;try{const raw=await req.text();if(raw.length>100000)return result(413);update=JSON.parse(raw);}catch{return result(400);}
  try{
   const cb=update.callback_query;
   if(cb){
    const user=cb.from,id=user?.id,m=/^social:(\d+):(approve|reject)$/.exec(cb.data||'');
    if(!Number.isSafeInteger(id)||!admins.has(id)||cb.message?.chat?.type!=='private'||cb.message.chat.id!==id||!m){await api('answerCallbackQuery',{callback_query_id:cb.id,text:'Нет доступа',show_alert:true});return result();}
    const out=await rewardCall(user,'admin.social.review',{id:Number(m[1]),decision:m[2]});
    const text=out.ok?(m[2]==='approve'?'Задание принято.':'Задание отклонено.'):out.error==='reviewed'?'Задание уже проверено.':'Проверка не выполнена. Попробуйте позже.';
    await api('answerCallbackQuery',{callback_query_id:cb.id,text,show_alert:true});
    if(out.ok||out.error==='reviewed')await api('editMessageReplyMarkup',{chat_id:id,message_id:cb.message.message_id,reply_markup:{inline_keyboard:[]}});
    return result();
   }
   const msg=update.message,user=msg?.from,id=user?.id;
   if(!Number.isSafeInteger(id)||msg?.chat?.type!=='private'||msg.chat.id!==id||user.is_bot)return result();
   const command=/^\/(start|terms|privacy|review)(?:@MoonKattyGameBot)?(?:\s|$)/i.exec(msg.text||'')?.[1]?.toLowerCase();
   if(command==='start')await send(id,'Добро пожаловать в MOONKATTY: 9 LIVES! Девять глав лунной экспедиции. Moon Points — игровые очки без денежной стоимости. Игра для пользователей от 18 лет. Условия: /terms · Конфиденциальность: /privacy',{inline_keyboard:[[{text:'Играть 🚀',web_app:{url:SITE}}]]});
   if(command==='terms')await send(id,'Условия использования: '+SITE+'terms.html');
   if(command==='privacy')await send(id,'Политика конфиденциальности: '+SITE+'privacy.html\nДля запроса доступа, исправления или удаления данных свяжитесь с администратором официального сообщества. Не публикуйте документы и секреты в общем чате.');
   if(command==='review'){
    if(!admins.has(id)){await send(id,'Команда доступна только модераторам.');return result();}
    const out=await rewardCall(user,'admin.social.list',{status:'pending'});
    if(!out.ok){await send(id,'Список заданий временно недоступен.');return result();}
    const rows=out.submissions||[];if(!rows.length)await send(id,'Заданий на проверке нет.');
    // Bounded batch prevents a command from flooding the chat; repeat after processing.
    for(const s of rows.slice(0,10))await send(id,'Задание №'+s.id+' · '+s.platform+' / '+s.kind+'\nЛичный код: '+s.code+'\nДоказательство: '+s.proof+'\nПроверяйте действие и принадлежность доказательства игроку. Ник сам по себе не подтверждает подписку.',{inline_keyboard:[[{text:'✅ Принять',callback_data:'social:'+s.id+':approve'},{text:'❌ Отклонить',callback_data:'social:'+s.id+':reject'}]]});
   }
   return result();
  }catch{return result(503);}
 };
}
