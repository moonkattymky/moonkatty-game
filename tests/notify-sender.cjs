// Notification sender: OFF by default (no DB, no Telegram), cron-secret auth, throttled queue rows, 403 opt-out.
const assert=require('node:assert/strict');
(async()=>{
 const {createNotifySender,messageFor}=await import('../server/notify/core.mjs');
 const calls=[];const fetcher=async(u,o={})=>{const s=String(u);calls.push(s.replace(/bot[^/]+\//,'bot<t>/'));
  if(s.includes('/rpc/mkty_notify_due'))return new Response(JSON.stringify([{telegram_id:2,kind:'robot',lang:'ru'},{telegram_id:3,kind:'storage',lang:'en'}]));
  if(s.includes('api.telegram.org'))return new Response('{}',{status:JSON.parse(o.body).chat_id===3?403:200});
  return new Response('',{status:204});};
 const req=(h={})=>new Request('https://x/notify',{method:'POST',headers:h,body:'{}'});
 let r=await (createNotifySender({fetcher}))(req());assert.deepEqual(await r.json(),{ok:true,enabled:false,sent:0});
 r=await (createNotifySender({enabled:false,token:'1:x',cronSecret:'c',url:'https://db',key:'k',fetcher}))(req());assert.equal((await r.json()).enabled,false);
 assert.equal(calls.length,0,'disabled sender touches nothing');
 const on=createNotifySender({enabled:true,token:'1:x',cronSecret:'c',url:'https://db',key:'k',fetcher});
 r=await on(req({'x-mkty-cron-secret':'nope'}));assert.equal(r.status,401);assert.equal(calls.length,0);
 r=await on(req({'x-mkty-cron-secret':'c'}));const j=await r.json();assert.deepEqual([j.due,j.sent,j.blocked],[2,1,1]);
 assert.ok(calls.some(c=>c.includes('mkty_notify_prefs?telegram_id=eq.3')),'blocked user is opted out');
 assert.ok(messageFor('robot','ru').text.includes('Робот'));assert.ok(messageFor('storage','de').text.includes('storage'));
 console.log('notify-sender: checks passed');
})().catch(e=>{console.error(e);process.exit(1);});
