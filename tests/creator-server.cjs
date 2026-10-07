const {atomicFixture}=require('./atomic-rpc-fixture.cjs');
const assert=require('node:assert/strict'),{webcrypto}=require('node:crypto');
(async()=>{
 const {createHandler,verifyTelegram}=await import('../server/rewards/core.mjs');
 const {normalizeVideoUrl,parseAdminIds,CREATOR_POINTS}=await import('../server/rewards/creator.mjs');
 const keys=await webcrypto.subtle.generateKey({name:'Ed25519'},true,['sign','verify']);
 const pub=Buffer.from(await crypto.subtle.exportKey('raw',keys.publicKey)).toString('hex');
 let now=Date.parse('2026-10-07T10:00:00Z');
 const signed=async id=>{
  const p=new URLSearchParams({auth_date:String(Math.floor(now/1000)),user:JSON.stringify({id,first_name:'P'+id})});
  const fields=[...p].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>k+'='+v).join('\n');
  p.set('signature',Buffer.from(await crypto.subtle.sign('Ed25519',keys.privateKey,new TextEncoder().encode('8659740610:WebAppData\n'+fields))).toString('base64url'));
  return p.toString();
 };
 // URL rules
 assert.equal(normalizeVideoUrl('https://youtu.be/dQw4w9WgXcQ?si=x').url_norm,'youtube:dQw4w9WgXcQ');
 assert.equal(normalizeVideoUrl('https://m.youtube.com/shorts/dQw4w9WgXcQ').url_norm,'youtube:dQw4w9WgXcQ');
 assert.equal(normalizeVideoUrl('https://www.tiktok.com/@cat.fan/video/7412345678901234567?lang=en').url_norm,'tiktok:7412345678901234567');
 assert.equal(normalizeVideoUrl('https://twitter.com/catfan/status/1840000000000000000').url_norm,'x:1840000000000000000');
 assert.equal(normalizeVideoUrl('https://www.instagram.com/reel/C9abcDEF12/').url_norm,'instagram:C9abcDEF12');
 for(const bad of ['javascript:alert(1)','https://evil.com/watch?v=dQw4w9WgXcQ','https://youtube.com/@channel','https://x.com/home','ftp://youtu.be/dQw4w9WgXcQ','https://user:pw@youtu.be/dQw4w9WgXcQ','https://tiktok.com/@a'])assert.throws(()=>normalizeVideoUrl(bad),/url/,bad);
 assert.deepEqual([...parseAdminIds(' 7, abc;9 ')],[7,9]);

 const db={players:new Map(),rewards:[],subs:[]};
 const match=(row,u)=>{for(const [k,v] of u.searchParams){if(['select','limit','order'].includes(k))continue;const [op,...rest]=v.split('.');const val=rest.join('.');const cell=row[k];
  if(op==='eq'&&String(cell)!==val)return false;if(op==='gte'&&!(String(cell)>=val))return false;if(op==='is'&&cell!=null)return false;if(op==='in'&&!val.slice(1,-1).split(',').includes(String(cell)))return false;}return true;};
 const res=(x,s=200)=>new Response(JSON.stringify(x),{status:s});
 const fetcher=async(url,opts={})=>{
  const u=new URL(url),path=u.pathname,method=(opts.method||'GET').toUpperCase(),body=opts.body?JSON.parse(opts.body):null;
  const table=path.endsWith('/players')?[...db.players.values()]:path.endsWith('/reward_events')?db.rewards:path.endsWith('/creator_submissions')?db.subs:null;
  if(!table)return res('no',404);
  if(method==='GET')return res(table.filter(r=>match(r,u)));
  if(method==='PATCH'){const hit=table.filter(r=>match(r,u));hit.forEach(r=>Object.assign(r,body));return res(hit);}
  if(path.endsWith('/players')){const row={moon_points:0,lives:9,story_life:0,next_life_at:null,final_balance:null,balance_locked_at:null,...body};db.players.set(row.telegram_id,row);return res([row]);}
  if(path.endsWith('/reward_events')){if(db.rewards.some(r=>r.telegram_id===body.telegram_id&&r.event_key===body.event_key))return res({},409);db.rewards.push(body);return res([body]);}
  if(db.subs.some(r=>r.url_norm===body.url_norm))return res({code:'23505'},409);
  const row={id:db.subs.length+1,created_at:new Date(now).toISOString(),points:0,tier_1k_at:null,tier_10k_at:null,reviewed_at:null,...body};db.subs.push(row);return res([row]);
 };
 const handler=createHandler({url:'https://example.supabase.co',key:'k',verify:x=>verifyTelegram(x,now,pub),fetcher:atomicFixture(fetcher),clock:()=>new Date(now),adminIds:'900'});
 const call=async(id,action,extra={})=>{const r=await handler(new Request('https://x',{method:'POST',body:JSON.stringify({initData:await signed(id),action,...extra})}));return {status:r.status,body:await r.json()};};
 const ok={url:'https://www.youtube.com/watch?v=dQw4w9WgXcQ',caption:'My run #MOONKATTY',own:true};

 assert.equal((await handler(new Request('https://x'))).status,200);
 assert.equal((await handler(new Request('https://x',{method:'POST',body:JSON.stringify({initData:'user=%7B%22id%22%3A1%7D&auth_date=1&signature=AAAA',action:'creator.submit',...ok})}))).status,401);
 assert.equal((await call(1,'creator.submit',{...ok,caption:'no tag'})).body.error,'hashtag');
 assert.equal((await call(1,'creator.submit',{...ok,caption:'#MOONKATTYX'})).body.error,'hashtag');
 assert.equal((await call(1,'creator.submit',{...ok,own:false})).body.error,'own');
 assert.equal((await call(1,'creator.submit',{...ok,url:'https://evil.example/v'})).body.error,'url');
 const s1=await call(1,'creator.submit',ok);assert.equal(s1.status,200);assert.equal(s1.body.submission.status,'pending');assert.ok(s1.body.next_submit_at);
 assert.equal(db.players.get(1).moon_points,0,'pending pays nothing');
 // weekly limit
 const w=await call(1,'creator.submit',{...ok,url:'https://youtu.be/aaaaaaaaaaa'});assert.equal(w.status,429);assert.equal(w.body.error,'weekly');
 // dedupe: same video via different URL form, by another player
 const d=await call(2,'creator.submit',{...ok,url:'https://youtu.be/dQw4w9WgXcQ?t=3'});assert.equal(d.status,409);assert.equal(d.body.error,'duplicate_url');
 // after a week, a new one is allowed but still deduped
 now+=7*24*3600*1000+1000;
 assert.equal((await call(1,'creator.submit',ok)).body.error,'duplicate_url');
 assert.equal((await call(1,'creator.submit',{...ok,url:'https://x.com/catfan/status/1840000000000000000'})).status,200);
 // non-admin rejected
 for(const a of ['admin.creator.list','admin.creator.review','admin.creator.tier']){const r=await call(1,a,{id:1,decision:'approve',tier:'1k'});assert.equal(r.status,403,a);}
 assert.equal((await call(1,'creator.status')).body.is_admin,false);
 assert.equal((await call(900,'creator.status')).body.is_admin,true);
 const list=await call(900,'admin.creator.list');assert.equal(list.body.submissions.length,2);assert.equal(list.body.submissions[0].first_name,'P1');
 // tier before approval rejected
 assert.equal((await call(900,'admin.creator.tier',{id:1,tier:'1k'})).body.error,'not_approved');
 const ap=await call(900,'admin.creator.review',{id:1,decision:'approve'});assert.equal(ap.body.reward.points,CREATOR_POINTS.base);
 assert.equal(db.players.get(1).moon_points,CREATOR_POINTS.base);
 assert.equal((await call(900,'admin.creator.review',{id:1,decision:'reject'})).body.error,'reviewed');
 // tier once
 const t1=await call(900,'admin.creator.tier',{id:1,tier:'1k'});assert.equal(t1.body.reward.awarded,true);
 const t1b=await call(900,'admin.creator.tier',{id:1,tier:'1k'});assert.equal(t1b.body.reward.awarded,false);
 const t10=await call(900,'admin.creator.tier',{id:1,tier:'10k'});assert.equal(t10.body.reward.points,CREATOR_POINTS.tier_10k);
 assert.equal((await call(900,'admin.creator.tier',{id:1,tier:'10k'})).body.reward.awarded,false);
 assert.equal(db.players.get(1).moon_points,CREATOR_POINTS.base+CREATOR_POINTS.tier_1k+CREATOR_POINTS.tier_10k);
 assert.equal(db.subs[0].points,CREATOR_POINTS.base+CREATOR_POINTS.tier_1k+CREATOR_POINTS.tier_10k);
 // reject pays nothing
 const rj=await call(900,'admin.creator.review',{id:2,decision:'reject'});assert.equal(rj.body.submission.status,'rejected');assert.equal(rj.body.reward.points,0);
 assert.equal((await call(900,'admin.creator.tier',{id:2,tier:'1k'})).body.error,'not_approved');
 assert.equal(db.players.get(1).moon_points,1000);
 const mine=await call(1,'creator.status');assert.equal(mine.body.submissions.length,2);assert.equal(mine.body.submissions.find(s=>s.id===1).tier_10k,true);
 console.log('PASS: creator url validation, hashtag, weekly limit, dedupe, non-admin 403, approve once, tiers once, reject');
})().catch(e=>{console.error(e);process.exitCode=1;});
