// Save schema v3 (chapter 2) migration + Telegram merge: existing v2 rows in mkty_world_saves load without losing ch1 progress.
const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const U=f=>pathToFileURL(path.join(__dirname,'..','world3d','src',f)).href;
(async()=>{
 const {migrate,createStore}=await import(U('game/storage.js'));const {mergeSaves,TelegramBackend}=await import(U('tg/backend.js'));
 const v2={v:2,points:120,xp:340,level:3,lives:7,daily:{day:'2026-10-18',earned:40},crystals:{day:'2026-10-18',taken:[1,4]},ch1:{idx:4,prog:0,done:['power','canyon','crystals','parts'],crossed:[],mined:[0,1],powered:[],parts:[0,1,2],sprint:0},secrets:['ledge'],base:{built:['depot']},stats:{crystals:12,quests:4,secrets:1,falls:2,hits:1}};
 const m=migrate(JSON.parse(JSON.stringify(v2)));
 assert.equal(m.v,3);assert.ok(m.ch2&&Array.isArray(m.ch2.robots)&&m.ch2.done.length===0,'ch2 defaults added');
 assert.deepEqual(m.ch1,v2.ch1,'ch1 progress untouched');assert.deepEqual(m.secrets,v2.secrets);assert.equal(m.level,3);assert.equal(m.xp,340);
 assert.equal(migrate(m),m,'v3 is stable');
 const v1=migrate({v:1,points:5,ch1:{done:['canyon','ledge']}});assert.equal(v1.v,3);assert.ok(v1.ch1.done.includes('canyon')&&v1.ch2,'v1 -> v3');
 // store.load over a backend returning the v2 row
 const st=createStore({backend:{load:async()=>JSON.parse(JSON.stringify(v2)),save:async()=>{},wipe:async()=>{}},now:()=>Date.parse('2026-10-18T12:00:00Z')});
 const d=await st.load();assert.equal(d.v,3);assert.deepEqual(d.ch1.done,v2.ch1.done);assert.ok(d.ch2.storage&&d.ch2.streak&&Array.isArray(d.ch2.jobs));
 // merge: remote v2 (server row) + local v3 with ch2 progress -> keeps both ch1 and ch2
 const local={...m,ch2:{...m.ch2,on:true,done:['c2_collect'],level:2}};
 const mm=mergeSaves(local,v2);assert.equal(mm.v,3);assert.deepEqual(mm.ch2.done,['c2_collect']);assert.equal(mm.ch2.level,2);assert.ok(mm.ch1.done.includes('parts'));
 const mm2=mergeSaves(v2,local);assert.deepEqual(mm2.ch2.done,['c2_collect'],'order independent');
 const both=mergeSaves({...local,ch2:{...local.ch2,done:['a']}},{...local,ch2:{...local.ch2,done:['a','b'],level:3}});assert.deepEqual(both.ch2.done.sort(),['a','b']);assert.equal(both.ch2.level,3);
 // a full v3 save stays well under the server snapshot limit (60000 chars)
 assert.ok(JSON.stringify(d).length<60000);
 // reasons the server does not know (error 'reason') are not paid and are not queued
 const ls=new Map(),mk=()=>({getItem:k=>ls.has(k)?ls.get(k):null,setItem:(k,v)=>ls.set(k,v),removeItem:k=>ls.delete(k)});
 const init='user='+encodeURIComponent(JSON.stringify({id:42}))+'&hash=x';
 const b=new TelegramBackend({initData:init,storage:mk(),session:mk(),fetcher:async(u,o)=>{const body=JSON.parse(o.body);return {status:body.action==='session'?200:400,json:async()=>body.action==='session'?{ok:true,session:{token:'t',expires_at:Date.now()+1e6}}:{ok:false,error:'reason'}};}});
 const r=await b.addPoints(10,'bogus:1');assert.equal(r.granted,0);assert.equal(b.pending().length,0);
 console.log('world3d-save-v3: all checks passed');
})().catch(e=>{console.error(e);process.exit(1);});
