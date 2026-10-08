/* Daily retention: Сигнал Луны (Morse cipher), login streak with weekly shield,
   YouTube code words. All rewards are idempotent through reward_events.event_key.
   The plain cipher word never leaves the server; clients only receive Morse. */
export const MORSE={A:'.-',B:'-...',C:'-.-.',D:'-..',E:'.',F:'..-.',G:'--.',H:'....',I:'..',J:'.---',K:'-.-',L:'.-..',M:'--',N:'-.',O:'---',P:'.--.',Q:'--.-',R:'.-.',S:'...',T:'-',U:'..-',V:'...-',W:'.--',X:'-..-',Y:'-.--',Z:'--..'};
// Lore words from the MOONKATTY 9 LIVES story (story-plan.js chapters/steps).
export const CIPHER_WORDS=['SIGNAL','MOON','ORBIT','BEACON','REACTOR','VOID','RETURN','CREW','LIFTOFF','DESCENT','RELAY','ANTENNA','KATTY','ALPHA','LIVES','CORE','GATE','PROBE','HOME','ECHO','LANDER','RADAR','SHIELD','CONVOY','IGNITION','CORRIDOR','ARCHIVE','AWAKENING','STATION','NAVIGATOR'];
export const CIPHER_POINTS=15, CIPHER_MAX_ATTEMPTS=5;
export const STREAK_SCALE=[3,5,7,10,12,15,25]; // day 1..7, then capped at 25
export const YT_MAX_POINTS=50, YT_MAX_FAILS_PER_DAY=10; // anti brute-force for code words
const DAY=86400000;
export const utcDay=d=>new Date(d).toISOString().slice(0,10);
export const dayNum=s=>Math.floor(Date.parse(s+'T00:00:00Z')/DAY);
export const isoWeek=s=>{const d=new Date(s+'T00:00:00Z');const wd=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-wd+3);const y=d.getUTCFullYear();const first=new Date(Date.UTC(y,0,4));return y+'-W'+String(1+Math.round(((d-first)/DAY-3+((first.getUTCDay()+6)%7))/7)).padStart(2,'0');};
export const toMorse=w=>[...w].map(c=>MORSE[c]);
export const streakReward=n=>STREAK_SCALE[Math.min(n,STREAK_SCALE.length)-1];
export const normalizeCode=s=>typeof s==='string'?s.normalize('NFKC').trim().toUpperCase().replace(/[\s\-_.]+/g,''):'';

/** Pure streak transition. row={streak,last_day,shield_week}|null */
export function nextStreak(row,today){
 if(row?.last_day===today)return {already:true,streak:row.streak,shieldUsed:false,shield_week:row.shield_week||null};
 const week=isoWeek(today);
 let streak=1,shieldUsed=false,shield_week=row?.shield_week||null;
 if(row?.last_day){
  const gap=dayNum(today)-dayNum(row.last_day);
  if(gap===1)streak=row.streak+1;
  else if(gap===2&&shield_week!==week){streak=row.streak+1;shieldUsed=true;shield_week=week;}
 }
 return {already:false,streak,shieldUsed,shield_week};
}

export async function cipherWord(day,secret){
 let idx;
 if(secret){
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const mac=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode('cipher:'+day)));
  idx=((mac[0]<<16)|(mac[1]<<8)|mac[2])%CIPHER_WORDS.length;
 }else idx=((dayNum(day)*7)%CIPHER_WORDS.length+CIPHER_WORDS.length)%CIPHER_WORDS.length;
 return CIPHER_WORDS[idx];
}

export function createDaily({rest,clock,insertReward,applyPoints,secret}){
 const tid=p=>'eq.'+p.telegram_id;
 async function getStreak(p){return (await rest('/rest/v1/login_streaks',{params:{select:'*',telegram_id:tid(p),limit:1}}))?.[0]||null;}
 async function getCipher(p,day){return (await rest('/rest/v1/cipher_attempts',{params:{select:'*',telegram_id:tid(p),day:'eq.'+day,limit:1}}))?.[0]||null;}
 function streakView(row,today){
  const week=isoWeek(today);
  const alive=row&&row.last_day&&(dayNum(today)-dayNum(row.last_day)<=1||(dayNum(today)-dayNum(row.last_day)===2&&row.shield_week!==week));
  const cur=alive?row.streak:0,claimed=row?.last_day===today;
  return {streak:cur,claimed_today:claimed,best:row?.best||0,shield_available:(row?.shield_week||null)!==week,next_reward:streakReward(cur+1),scale:STREAK_SCALE};
 }
 async function status(p){
  const today=utcDay(clock());
  const word=await cipherWord(today,secret);
  const c=await getCipher(p,today);
  return {day:today,cipher:{morse:toMorse(word),length:word.length,attempts_left:Math.max(0,CIPHER_MAX_ATTEMPTS-(c?.attempts||0)),solved:!!c?.solved,points:CIPHER_POINTS},streak:streakView(await getStreak(p),today)};
 }
 async function solveCipher(p,answer){
  const today=utcDay(clock());
  const guess=normalizeCode(answer);
  if(!/^[A-Z]{2,16}$/.test(guess))throw Error('answer');
  const word=await cipherWord(today,secret);
  const result=await rest('/rest/v1/rpc/mkty_cipher',{method:'POST',body:JSON.stringify({p_id:p.telegram_id,p_day:today,p_correct:guess===word,p_max:CIPHER_MAX_ATTEMPTS,p_now:clock().toISOString()})});
  if(result?.error)throw Error(result.error);
  return result;
 }
 async function checkin(p){
  const today=utcDay(clock());
  const row=await getStreak(p);
  const t=nextStreak(row,today);
  if(t.already)return {awarded:false,duplicate:true,streak:streakView(row,today),player:p};
  const points=streakReward(t.streak);
  const next={telegram_id:p.telegram_id,streak:t.streak,last_day:today,shield_week:t.shield_week,best:Math.max(row?.best||0,t.streak),updated_at:clock().toISOString()};
  const {inserted}=await insertReward(p,'streak:'+today,'daily.streak',points,next);
  if(!inserted)return {awarded:false,duplicate:true,streak:streakView(await getStreak(p),today),player:p};
  const player=await applyPoints(p,points);
  return {awarded:true,points,shield_used:t.shieldUsed,streak:streakView(next,today),player};
 }
 async function redeemCode(p,code){
  const c=normalizeCode(code);
  if(!/^[A-Z0-9]{3,32}$/.test(c))throw Error('code');
  const result=await rest('/rest/v1/rpc/mkty_youtube',{method:'POST',body:JSON.stringify({p_id:p.telegram_id,p_code:c,p_now:clock().toISOString()})});
  if(result?.error)throw Error(result.error);return result;
 }
 return {status,solveCipher,checkin,redeemCode};
}
