const assert=require('node:assert/strict'),{webcrypto}=require('node:crypto');
(async()=>{
 const {createHandler,verifyTelegram}=await import('../server/rewards/core.mjs');
 const {channelFromUrl,normalizeProof,playerCode,TELEGRAM_CHANNEL_URL}=await import('../server/rewards/social.mjs');
 const {youtubeConfig}=await import('../server/rewards/youtube.mjs');
 const keys=await webcrypto.subtle.generateKey({name:'Ed25519'},true,['sign','verify']);
 const pub=Buffer.from(await crypto.subtle.exportKey('raw',keys.publicKey)).toString('hex');
 let now=Date.parse('2026-10-07T10:00:00Z');
 const signed=async id=>{const p=new URLSearchParams({auth_date:String(Math.floor(now/1000)),user:JSON.stringify({id,first_name:'P'+id})});
  const f=[...p].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>k+'='+v).join('\n');
  p.set('signature',Buffer.from(await crypto.subtle.sign('Ed25519',keys.privateKey,new TextEncoder().encode('8659740610:WebAppData\n'+f))).toString('base64url'));return p.toString();};
 assert.equal(channelFromUrl(TELEGRAM_CHANNEL_URL),'@moonkattymkty');
 assert.throws(()=>channelFromUrl('https://t.me/+abcdef'),/channel/);
 assert.match(await playerCode(7,'s'),/^MKTY-[0-9A-F]{4}$/);
 assert.notEqual(await playerCode(7,'s'),await playerCode(8,'s'));
 assert.equal(normalizeProof('x','follow','https://x.com/Cat_Fan?s=1').proof,'@Cat_Fan');
 assert.equal(normalizeProof('tiktok','follow','@cat.fan').proof_norm,'tiktok:follow:cat.fan');
 assert.equal(normalizeProof('x','daily','https://twitter.com/a/status/1840000000000000000').proof,'https://x.com/a/status/1840000000000000000');
 for(const [pl,k,v] of [['x','daily','https://evil.com/a/status/1'],['x','daily','javascript:1'],['tiktok','daily','https://tiktok.com/@a'],['x','follow','bad handle!']])assert.throws(()=>normalizeProof(pl,k,v),/proof/);
 assert.equal(youtubeConfig({YOUTUBE_OAUTH_ENABLED:'true'}).enabled,false,'flag without secrets stays off');

 const db={players:new Map(),rewards:[],subs:[]};
 const match=(row,u)=>{for(const [k,v] of u.searchParams){if(['select','limit','order'].includes(k))continue;const [op,...r]=v.split('.');const val=r.join('.');const c=row[k];
  if(op==='eq'&&String(c)!==val)return false;if(op==='like'&&!String(c).startsWith(val.replace(/\*$/,'')))return false;if(op==='in'&&!val.slice(1,-1).split(',').includes(String(c)))return false;}return true;};
 const res=(x,s=200)=>new Response(JSON.stringify(x),{status:s});
 const fetcher=async(url,opts={})=>{
  const u=new URL(url),path=u.pathname,method=(opts.method||'GET').toUpperCase(),body=opts.body?JSON.parse(opts.body):null;
  const table=path.endsWith('/players')?[...db.players.values()]:path.endsWith('/reward_events')?db.rewards:path.endsWith('/social_submissions')?db.subs:null;
  if(!table)return res('no',404);
  if(method==='GET')return res(table.filter(r=>match(r,u)));
  if(method==='PATCH'){const hit=table.filter(r=>match(r,u));hit.forEach(r=>Object.assign(r,body));return res(hit);}
  if(path.endsWith('/players')){const row={moon_points:0,lives:9,story_life:0,balance_locked_at:null,...body};db.players.set(row.telegram_id,row);return res([row]);}
  if(path.endsWith('/reward_events')){if(db.rewards.some(r=>r.telegram_id===body.telegram_id&&r.event_key===body.event_key))return res({},409);db.rewards.push(body);return res([body]);}
  if(db.subs.some(r=>r.proof_norm===body.proof_norm))return res({code:'23505'},409);
  const row={id:db.subs.length+1,created_at:new Date(now).toISOString(),points:0,...body};db.subs.push(row);return res([row]);
 };
 // Bot API mock: 1 = member, 2 = left, 3 = creator; channel @locked → bot not admin
 const tgCalls=[];
 const tgFetcher=async url=>{const u=new URL(url);tgCalls.push(u);assert.ok(u.pathname.startsWith('/botTEST:TOKEN/getChatMember'));
  if(u.searchParams.get('chat_id')==='@locked')return res({ok:false,error_code:400,description:'Bad Request: member list is inaccessible'},400);
  const st={1:'member',2:'left',3:'creator',4:'kicked'}[u.searchParams.get('user_id')]||'left';return res({ok:true,result:{status:st}});};
 const mk=(o={})=>createHandler({url:'https://e.supabase.co',key:'k',verify:x=>verifyTelegram(x,now,pub),fetcher,clock:()=>new Date(now),adminIds:'900',cipherSecret:'s',botToken:'TEST:TOKEN',tgFetcher,...o});
 const h=mk();
 const call=async(id,action,extra={},hh=h)=>{const r=await hh(new Request('https://x',{method:'POST',body:JSON.stringify({initData:await signed(id),action,...extra})}));return {status:r.status,body:await r.json()};};

 // open-link claims no longer pay via rewards.verify
 for(const t of ['daily.follow_x','daily.follow_telegram','daily.like','social.x_follow','creator.base']){const r=await call(1,'rewards.verify',{event_key:'daily:2026-10-07:'+t,event_type:t,points:5});assert.equal(r.status,400,t);assert.equal(r.body.error,'unverified');}
 assert.equal(db.players.get(1).moon_points,0);

 // Telegram: non-member rejected
 let r=await call(2,'social.telegram.verify');assert.equal(r.body.verified,false);assert.equal(r.body.status,'not_member');assert.equal(r.body.awarded,false);assert.equal(db.players.get(2).moon_points,0);
 r=await call(4,'social.telegram.verify');assert.equal(r.body.status,'not_member');
 assert.equal(tgCalls.at(-1).searchParams.get('chat_id'),'@moonkattymkty');
 // member awarded once
 r=await call(1,'social.telegram.verify');assert.equal(r.body.verified,true);assert.equal(r.body.awarded,true);assert.equal(r.body.points,5);
 r=await call(1,'social.telegram.verify');assert.equal(r.body.awarded,false);assert.equal(r.body.duplicate,true);
 now+=86400000;r=await call(1,'social.telegram.verify');assert.equal(r.body.awarded,false);
 assert.equal(db.players.get(1).moon_points,5);
 assert.equal((await call(3,'social.telegram.verify')).body.awarded,true,'creator status counts');
 // bot not admin → clear status, no award
 const hl=mk({telegramChannel:'@locked'});
 r=await call(5,'social.telegram.verify',{},hl);assert.equal(r.status,200);assert.equal(r.body.status,'bot_not_admin');assert.equal(r.body.awarded,false);assert.equal(db.players.get(5).moon_points,0);
 // no token configured
 r=await call(5,'social.telegram.verify',{},mk({botToken:''}));assert.equal(r.body.status,'not_configured');

 // X/TikTok personal code flow
 const st=await call(10,'social.status');assert.match(st.body.code,/^MKTY-[0-9A-F]{4}$/);assert.equal(st.body.channel,'@moonkattymkty');assert.equal(st.body.youtube.oauth_enabled,false);
 assert.equal((await call(10,'social.submit',{platform:'x',kind:'follow',proof:'bad handle!'})).body.error,'proof');
 assert.equal((await call(10,'social.submit',{platform:'instagram',kind:'follow',proof:'@a'})).body.error,'platform');
 const f=await call(10,'social.submit',{platform:'x',kind:'follow',proof:'@catfan'});assert.equal(f.status,200);assert.equal(f.body.submission.status,'pending');
 assert.equal(db.players.get(10).moon_points,0,'pending pays nothing');
 assert.equal((await call(10,'social.submit',{platform:'x',kind:'follow',proof:'@catfan2'})).status,409,'follow once');
 const d1=await call(10,'social.submit',{platform:'x',kind:'daily',proof:'https://x.com/catfan/status/1840000000000000001'});assert.equal(d1.status,200);
 assert.equal((await call(10,'social.submit',{platform:'x',kind:'daily',proof:'https://x.com/catfan/status/1840000000000000002'})).body.error,'daily_limit');
 assert.equal((await call(11,'social.submit',{platform:'x',kind:'daily',proof:'https://x.com/catfan/status/1840000000000000001'})).body.error,'duplicate_proof');
 const tk=await call(10,'social.submit',{platform:'tiktok',kind:'daily',proof:'https://www.tiktok.com/@moonkattymkty/video/7412345678901234567?comment_id=7420000000000000001'});assert.equal(tk.status,200);
 assert.equal((await call(10,'social.submit',{platform:'tiktok',kind:'follow',proof:'@cat.fan'})).body.error,'pending_limit');
 // non-admin 403
 for(const a of ['admin.social.list','admin.social.review']){const x=await call(10,a,{id:1,decision:'approve'});assert.equal(x.status,403,a);}
 assert.equal(db.subs[0].status,'pending');
 // admin approval flow
 const list=await call(900,'admin.social.list');assert.equal(list.status,200);assert.equal(list.body.submissions.length,3);assert.equal(list.body.submissions[0].code,st.body.code);
 r=await call(900,'admin.social.review',{id:1,decision:'approve'});assert.equal(r.body.reward.points,5);
 assert.equal((await call(900,'admin.social.review',{id:1,decision:'approve'})).body.error,'reviewed');
 r=await call(900,'admin.social.review',{id:2,decision:'approve'});assert.equal(r.body.reward.points,5);
 r=await call(900,'admin.social.review',{id:3,decision:'reject'});assert.equal(r.body.reward.points,0);
 assert.equal(db.players.get(10).moon_points,10);
 assert.ok(db.rewards.some(e=>e.event_key==='social:x:daily:2026-10-08'));
 const s2=await call(10,'social.status');assert.equal(s2.body.paid.x_follow,true);assert.equal(s2.body.paid.x_daily,true);assert.equal(s2.body.paid.tiktok_daily,false);
 // rejected follow may be resubmitted; next day daily allowed again
 now+=86400000;
 assert.equal((await call(10,'social.submit',{platform:'x',kind:'daily',proof:'https://x.com/catfan/status/1840000000000000009'})).status,200);
 // YouTube OAuth prepared but disabled
 assert.equal((await call(10,'social.youtube.verify')).body.error,'disabled');
 const he=mk({youtube:{enabled:true,clientId:'c',clientSecret:'s',channelId:'UC1',redirectUri:'https://g/cb'},ytFetcher:async u=>String(u).includes('token')?res({access_token:'a'}):res({items:[{id:'x'}]})});
 assert.match((await call(12,'social.youtube.verify',{},he)).body.auth_url,/youtube\.readonly/);
 r=await call(12,'social.youtube.verify',{code:'abc'},he);assert.equal(r.body.awarded,true);
 assert.equal((await call(12,'social.youtube.verify',{code:'abc'},he)).body.awarded,false);
 const probe=await (await h(new Request('https://x'))).json();assert.equal(probe.ok,true);assert.equal(probe.actions,undefined);
 assert.ok(!JSON.stringify(probe).includes('TEST:TOKEN'));
 console.log('PASS: social — open-link claims blocked, Telegram getChatMember (non-member rejected, member once, bot-not-admin status), X/TikTok code submissions, admin approve/reject, non-admin 403, daily limits, YouTube OAuth flag');
})().catch(e=>{console.error(e);process.exitCode=1;});
