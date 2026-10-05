/* Read-only leaderboard. No player identifiers or names leave this service. */
const BOT_ID='8659740610',PUBLIC_KEY='e7bf03a2fa4602af4580703d88dda5bb59f32ed8b02a56c187fe7d34caed242d';
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
export function createHandler({url,key,fetcher=fetch,verify=verifyTelegram,clock=()=>new Date()}){
 async function query(params,count=false){const target=new URL('/rest/v1/players',url);for(const [k,v]of Object.entries(params))target.searchParams.set(k,String(v));
  const r=await fetcher(target,{headers:{apikey:key,Authorization:'Bearer '+key,...(count?{Prefer:'count=exact'}:{})},signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('database');const rows=await r.json();if(!Array.isArray(rows))throw Error('database');const total=Number(r.headers.get('Content-Range')?.split('/')[1]);return {rows,total:Number.isFinite(total)?total:rows.length};
 }
 async function callsign(id){const secret=await crypto.subtle.importKey('raw',enc.encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);const digest=new Uint8Array(await crypto.subtle.sign('HMAC',secret,enc.encode('moonkatty-callsign:'+id)));return 'PILOT-'+[...digest.slice(0,4)].map(x=>x.toString(16).padStart(2,'0')).join('').toUpperCase();}
 return async request=>{
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});if(!['GET','POST'].includes(request.method))return json({ok:false,error:'method'},405);
  let userId=null;if(request.method==='POST'){try{if(Number(request.headers.get('Content-Length'))>12000)return json({ok:false,error:'body'},413);const raw=await request.text();if(raw.length>12000)return json({ok:false,error:'body'},413);userId=await verify(JSON.parse(raw).initData);}catch{return json({ok:false,error:'auth'},401);}}
  if(!url||!key)return json({ok:false,error:'unavailable'},503);
  try{const {rows,total}=await query({select:'telegram_id,moon_points,story_life',moon_points:'gt.0',order:'moon_points.desc,story_life.desc,telegram_id.asc',limit:50},true);let rank=0,previous=null;
   const entries=await Promise.all(rows.map(async(p,i)=>{if(!previous||previous.moon_points!==p.moon_points||previous.story_life!==p.story_life)rank=i+1;previous=p;const position=rank;return {rank:position,callsign:await callsign(p.telegram_id),points:p.moon_points,chapters:p.story_life,self:userId!==null&&String(userId)===String(p.telegram_id)};}));
   let self=entries.find(p=>p.self)||null;
   if(userId&&!self){const {rows:own}=await query({select:'moon_points,story_life',telegram_id:'eq.'+userId,limit:1});const p=own[0];if(p?.moon_points>0){const {total:ahead}=await query({select:'telegram_id',or:`(moon_points.gt.${Number(p.moon_points)},and(moon_points.eq.${Number(p.moon_points)},story_life.gt.${Number(p.story_life)}))`,limit:1},true);self={rank:ahead+1,callsign:await callsign(userId),points:p.moon_points,chapters:p.story_life,self:true};}}
   return json({ok:true,entries,total,self,updatedAt:clock().toISOString()});
  }catch{return json({ok:false,error:'unavailable'},503);}
 };
}
