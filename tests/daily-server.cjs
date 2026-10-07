const {atomicFixture}=require('./atomic-rpc-fixture.cjs');
const assert=require('node:assert/strict'),{webcrypto}=require('node:crypto');
(async()=>{
 const {createHandler}=await import('../server/rewards/core.mjs');
 const D=await import('../server/rewards/daily.mjs');
 // pure streak logic
 assert.deepEqual(D.nextStreak(null,'2026-10-07').streak,1);
 assert.equal(D.nextStreak({streak:3,last_day:'2026-10-06'},'2026-10-07').streak,4);
 assert.equal(D.nextStreak({streak:3,last_day:'2026-10-07'},'2026-10-07').already,true);
 const sh=D.nextStreak({streak:5,last_day:'2026-10-05',shield_week:null},'2026-10-07');
 assert.equal(sh.streak,6);assert.equal(sh.shieldUsed,true);
 assert.equal(D.nextStreak({streak:5,last_day:'2026-10-05',shield_week:D.isoWeek('2026-10-07')},'2026-10-07').streak,1,'shield once per week');
 assert.equal(D.nextStreak({streak:5,last_day:'2026-10-04'},'2026-10-07').streak,1,'two missed days reset');
 assert.equal(D.streakReward(1),3);assert.equal(D.streakReward(7),25);assert.equal(D.streakReward(30),25);
 assert.equal(D.isoWeek('2026-10-07'),'2026-W41');assert.equal(D.isoWeek('2026-01-01'),'2026-W01');
 for(const w of D.CIPHER_WORDS)assert.match(w,/^[A-Z]{2,16}$/);

 const keys=await webcrypto.subtle.generateKey({name:'Ed25519'},true,['sign','verify']);
 const now=Date.now();
 const signed=async id=>{const p=new URLSearchParams({auth_date:String(Math.floor(now/1000)),user:JSON.stringify({id,first_name:'P'})});const f=[...p].sort(([a],[b])=>a<b?-1:1).map(([k,v])=>k+'='+v).join('\n');p.set('signature',Buffer.from(await crypto.subtle.sign('Ed25519',keys.privateKey,new TextEncoder().encode('8659740610:WebAppData\n'+f))).toString('base64url'));return p.toString();};
 const pub=Buffer.from(await crypto.subtle.exportKey('raw',keys.publicKey)).toString('hex');
 const {verifyTelegram}=await import('../server/rewards/core.mjs');
 const db={players:new Map(),rewards:[],cipher:new Map(),streaks:new Map(),codes:[
  {id:1,code:'MOONTEST',points:5,active:true,starts_at:'2026-01-01T00:00:00.000Z',expires_at:'2026-10-31T23:59:59.000Z'},
  {id:2,code:'OLDCODE',points:10,active:true,starts_at:'2026-01-01T00:00:00.000Z',expires_at:'2026-10-01T00:00:00.000Z'},
  {id:3,code:'GREEDY',points:9999,active:true,starts_at:'2026-01-01T00:00:00.000Z',expires_at:'2026-12-01T00:00:00.000Z'}]};
 const q=(u,k)=>u.searchParams.get(k)?.replace(/^eq\./,'');
 const res=x=>new Response(JSON.stringify(x));
 const fetcher=async(url,opts={})=>{
  const u=new URL(url),path=u.pathname,m=(opts.method||'GET').toUpperCase(),b=opts.body?JSON.parse(opts.body):null;
  if(path.endsWith('/players')){const id=Number(q(u,'telegram_id')??b?.telegram_id);
   if(m==='GET'){const r=db.players.get(id);return res(r?[r]:[]);}
   if(m==='POST'){const r={...b,moon_points:0,lives:9,story_life:0,balance_locked_at:null};db.players.set(r.telegram_id,r);return res([r]);}
   if(m==='PATCH'){Object.assign(db.players.get(id),b);return res([db.players.get(id)]);}}
  if(path.endsWith('/reward_events')){
   if(m==='GET')return res(db.rewards.filter(r=>r.telegram_id===Number(q(u,'telegram_id'))&&r.event_key===q(u,'event_key')));
   if(db.rewards.some(r=>r.telegram_id===b.telegram_id&&r.event_key===b.event_key))return new Response('{}',{status:409});
   db.rewards.push(b);return res([b]);}
  if(path.endsWith('/rpc/cipher_attempt')){const k=b.p_telegram_id+':'+b.p_day;const c=db.cipher.get(k)||{telegram_id:b.p_telegram_id,day:b.p_day,attempts:0,solved:false};
   if(c.attempts>=b.p_max||c.solved)return res(-1);c.attempts++;db.cipher.set(k,c);return res(c.attempts);}
  if(path.endsWith('/cipher_attempts')){const k=q(u,'telegram_id')+':'+q(u,'day');
   if(m==='GET'){const c=db.cipher.get(k);return res(c?[c]:[]);}
   if(m==='PATCH'){Object.assign(db.cipher.get(k),b);return res([db.cipher.get(k)]);}}
  if(path.endsWith('/login_streaks')){
   if(m==='GET'){const r=db.streaks.get(Number(q(u,'telegram_id')));return res(r?[{...r}]:[]);}
   if(m==='POST'){db.streaks.set(b.telegram_id,{...b});return res([b]);}}
  if(path.endsWith('/youtube_codes')){const c=db.codes.filter(r=>r.code===q(u,'code')&&r.active);return res(c);}
  return new Response('no',{status:404});
 };
 let t=new Date('2026-10-07T10:00:00Z');
 const h=createHandler({url:'https://db.test',key:'k',fetcher:atomicFixture(fetcher),verify:d=>verifyTelegram(d,now,pub),clock:()=>t,cipherSecret:'test-secret'});
 const A=await signed(42),B=await signed(43);
 const call=async(initData,action,extra={})=>{const r=await h(new Request('https://x',{method:'POST',body:JSON.stringify({initData,action,...extra})}));return {status:r.status,body:await r.json()};};
 const pts=id=>db.players.get(id).moon_points;

 // fake signature rejected
 assert.equal((await call(A.replace(/signature=[^&]+/,'signature=AAAA'),'daily.status')).status,401);

 // status exposes morse, never the word
 let s=await call(A,'daily.status');
 assert.equal(s.status,200);
 const word=await D.cipherWord('2026-10-07','test-secret');
 assert.deepEqual(s.body.cipher.morse,D.toMorse(word));
 assert.ok(!JSON.stringify(s.body).includes('"'+word+'"'),'plain word not exposed');
 assert.equal(s.body.cipher.attempts_left,5);

 // wrong cipher rejected, attempts decrease, no points
 let r=await call(A,'cipher.solve',{answer:word==='MOON'?'ORBIT':'MOON'});
 assert.equal(r.body.correct,false);assert.equal(r.body.attempts_left,4);assert.equal(pts(42),0);
 assert.equal((await call(A,'cipher.solve',{answer:'12'})).status,400);
 // correct (case-insensitive) pays once
 r=await call(A,'cipher.solve',{answer:word.toLowerCase()});
 assert.equal(r.body.correct,true);assert.equal(r.body.awarded,true);assert.equal(pts(42),15);
 r=await call(A,'cipher.solve',{answer:word});
 assert.equal(r.body.awarded,false);assert.equal(pts(42),15,'double cipher claim rejected');
 // attempts exhausted for player B
 for(let i=0;i<5;i++)assert.equal((await call(B,'cipher.solve',{answer:'ZZZZ'})).body.correct,false);
 r=await call(B,'cipher.solve',{answer:word});assert.equal(r.status,429);assert.equal(pts(43),0);

 // streak: day1 +3, double check-in rejected
 r=await call(A,'streak.checkin');assert.equal(r.body.points,3);assert.equal(pts(42),18);
 r=await call(A,'streak.checkin');assert.equal(r.body.awarded,false);assert.equal(pts(42),18);
 t=new Date('2026-10-08T01:00:00Z');r=await call(A,'streak.checkin');assert.equal(r.body.streak.streak,2);assert.equal(r.body.points,5);
 // miss 10-09 -> shield saves on 10-10
 t=new Date('2026-10-10T05:00:00Z');s=await call(A,'daily.status');assert.equal(s.body.streak.streak,2);assert.equal(s.body.streak.shield_available,true);
 r=await call(A,'streak.checkin');assert.equal(r.body.shield_used,true);assert.equal(r.body.streak.streak,3);assert.equal(r.body.streak.shield_available,false);
 // second miss same ISO week (W41) -> reset
 t=new Date('2026-10-12T05:00:00Z'); // Monday W42: shield available again
 r=await call(A,'streak.checkin');assert.equal(r.body.shield_used,true);assert.equal(r.body.streak.streak,4);
 t=new Date('2026-10-14T05:00:00Z');r=await call(A,'streak.checkin');assert.equal(r.body.streak.streak,1,'second miss in a week resets');assert.equal(r.body.points,3);
 // new day cipher is a separate claim
 // youtube codes
 const before=pts(42);
 r=await call(A,'youtube.redeem',{code:' moon-test '});assert.equal(r.body.valid,true);assert.equal(r.body.points,5);
 r=await call(A,'youtube.redeem',{code:'MOONTEST'});assert.equal(r.body.awarded,false);assert.equal(pts(42),before+5,'code pays once per player');
 r=await call(A,'youtube.redeem',{code:'OLDCODE'});assert.equal(r.body.valid,false);
 r=await call(A,'youtube.redeem',{code:'NOPE'});assert.equal(r.body.valid,false);
 r=await call(A,'youtube.redeem',{code:'GREEDY'});assert.equal(r.body.points,50,'server caps code points');
 assert.equal((await call(A,'youtube.redeem',{code:'<x>'})).status,400);
 r=await call(B,'youtube.redeem',{code:'MOONTEST'});assert.equal(r.body.awarded,true);
 // locked balance cannot grow
 db.players.get(43).balance_locked_at='2026-10-01T00:00:00Z';
 assert.equal((await call(B,'streak.checkin')).status,409);
 console.log('daily-server ok');
})().catch(e=>{console.error(e);process.exit(1);});
