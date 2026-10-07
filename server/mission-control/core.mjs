/* Leaderboard. Telegram IDs never leave this service. Players appear under their verified Telegram
   display name/photo unless they chose to hide (then: HMAC callsign, no photo). */
import {profileFields} from './profile.mjs';
// PUBLIC_KEY is Telegram's published production Ed25519 key for third-party initData validation (public, not a secret).
// Bot id is taken from the TELEGRAM_BOT_TOKEN secret prefix when present.
const BOT_ID=(/^(\d{5,15}):/.exec((typeof Deno!=='undefined'&&Deno.env?.get?.('TELEGRAM_BOT_TOKEN'))||'')||[])[1]||'8659740610',PUBLIC_KEY='e7bf03a2fa4602af4580703d88dda5bb59f32ed8b02a56c187fe7d34caed242d';
const enc=new TextEncoder(),cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'GET, POST, OPTIONS'};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function verifyTelegram(initData,now=Date.now(),publicKey=PUBLIC_KEY){
 if(typeof initData!=='string'||initData.length>10000)throw Error('auth');const p=new URLSearchParams(initData);
 if(new Set(p.keys()).size!==[...p.keys()].length)throw Error('auth');
 const signature=p.get('signature'),raw=p.get('user'),date=Number(p.get('auth_date'));
 if(!signature||!raw||!Number.isInteger(date)||date>now/1000+60||now/1000-date>600)throw Error('auth');
 const fields=[...p].filter(([k])=>k!=='hash'&&k!=='signature').sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>k+'='+v).join('\n');
 const key=await crypto.subtle.importKey('raw',Uint8Array.from(publicKey.match(/../g),x=>parseInt(x,16)),{name:'Ed25519'},false,['verify']);
 const sig=signature.replace(/-/g,'+').replace(/_/g,'/');const bytes=Uint8Array.from(atob(sig+'='.repeat((4-sig.length%4)%4)),x=>x.charCodeAt(0));
 if(!await crypto.subtle.verify('Ed25519',key,bytes,enc.encode(BOT_ID+':WebAppData\n'+fields)))throw Error('auth');
 const user=JSON.parse(raw);if(!Number.isSafeInteger(user?.id)||user.id<=0)throw Error('auth');return user.id;
}
export async function verifyTelegramUser(initData,now=Date.now(),publicKey=PUBLIC_KEY){const id=await verifyTelegram(initData,now,publicKey);const u=JSON.parse(new URLSearchParams(initData).get('user'));return {...u,id};}
export function createHandler({url,key,fetcher=fetch,verify=verifyTelegramUser,clock=()=>new Date()}){
 async function query(params,count=false){const target=new URL('/rest/v1/players',url);for(const [k,v]of Object.entries(params))target.searchParams.set(k,String(v));
  const r=await fetcher(target,{headers:{apikey:key,Authorization:'Bearer '+key,...(count?{Prefer:'count=exact'}:{})},signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('database');const rows=await r.json();if(!Array.isArray(rows))throw Error('database');const total=Number(r.headers.get('Content-Range')?.split('/')[1]);return {rows,total:Number.isFinite(total)?total:rows.length};
 }
 async function patch(id,fields){const target=new URL('/rest/v1/players',url);target.searchParams.set('telegram_id','eq.'+id);const r=await fetcher(target,{method:'PATCH',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify(fields),signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('database');}
 async function entry(p,rank,userId){const cs=await callsign(p.telegram_id),hidden=p.leaderboard_hidden===true,name=!hidden&&typeof p.display_name==='string'&&p.display_name?p.display_name:cs;return {rank,callsign:cs,name,photo:hidden?null:(p.photo_url||null),hidden,points:p.moon_points,chapters:p.story_life,self:userId!==null&&String(userId)===String(p.telegram_id)};}
 async function callsign(id){const secret=await crypto.subtle.importKey('raw',enc.encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);const digest=new Uint8Array(await crypto.subtle.sign('HMAC',secret,enc.encode('moonkatty-callsign:'+id)));return 'PILOT-'+[...digest.slice(0,4)].map(x=>x.toString(16).padStart(2,'0')).join('').toUpperCase();}
 return async request=>{
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});if(!['GET','POST'].includes(request.method))return json({ok:false,error:'method'},405);
  let userId=null,user=null,body={};if(request.method==='POST'){try{if(Number(request.headers.get('Content-Length'))>12000)return json({ok:false,error:'body'},413);const raw=await request.text();if(raw.length>12000)return json({ok:false,error:'body'},413);body=JSON.parse(raw)||{};const v=await verify(body.initData);user=typeof v==='object'?v:null;userId=user?user.id:v;}catch{return json({ok:false,error:'auth'},401);}}
  if(!url||!key)return json({ok:false,error:'unavailable'},503);
  if(user){const fields=profileFields(user);if(body.action==='privacy'&&typeof body.hidden==='boolean')fields.leaderboard_hidden=body.hidden;try{await patch(user.id,fields);}catch{if(body.action==='privacy')return json({ok:false,error:'unavailable'},503);}}
  try{const {rows,total}=await query({select:'telegram_id,moon_points,story_life,display_name,photo_url,leaderboard_hidden',moon_points:'gt.0',order:'moon_points.desc,story_life.desc,telegram_id.asc',limit:50},true);let rank=0,previous=null;
   const entries=await Promise.all(rows.map(async(p,i)=>{if(!previous||previous.moon_points!==p.moon_points||previous.story_life!==p.story_life)rank=i+1;previous=p;return entry(p,rank,userId);}));
   let self=entries.find(p=>p.self)||null;
   if(userId&&!self){const {rows:own}=await query({select:'telegram_id,moon_points,story_life,display_name,photo_url,leaderboard_hidden',telegram_id:'eq.'+userId,limit:1});const p=own[0];if(p?.moon_points>0){const {total:ahead}=await query({select:'telegram_id',or:`(moon_points.gt.${Number(p.moon_points)},and(moon_points.eq.${Number(p.moon_points)},story_life.gt.${Number(p.story_life)}))`,limit:1},true);self=await entry(p,ahead+1,userId);}}
   let hidden=self?self.hidden:null;if(user&&hidden===null){const {rows:own}=await query({select:'leaderboard_hidden',telegram_id:'eq.'+userId,limit:1});hidden=own[0]?own[0].leaderboard_hidden===true:null;}
   return json({ok:true,entries,total,self,hidden,updatedAt:clock().toISOString()});
  }catch{return json({ok:false,error:'unavailable'},503);}
 };
}
