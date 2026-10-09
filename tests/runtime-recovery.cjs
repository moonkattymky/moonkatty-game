/* Production save/pacing modules under deterministic lifecycle events. Browser integration is covered separately. */
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
function fixture(seed={}){
 const data=new Map(Object.entries(seed)),nodes=new Map(),events=new Map(),timers=[];
 const create=(tag='div')=>({tagName:tag.toUpperCase(),id:'',children:[],dataset:{},style:{cssText:'',setProperty(){}},hidden:false,open:false,classList:{add(){},remove(){},toggle(){},contains(){return false;}},setAttribute(){},getAttribute(){return null;},removeAttribute(){},append(...n){this.children.push(...n);for(const x of n)if(x.id)nodes.set(x.id,x);},appendChild(n){this.append(n);},replaceChildren(...n){this.children=n;},remove(){if(this.id)nodes.delete(this.id);},querySelector(){return create();},querySelectorAll(){return[];},before(){},addEventListener(){},focus(){},showModal(){this.open=true;},close(){this.open=false;}});
 const $=id=>{if(!nodes.has(id)){const n=create();n.id=id;nodes.set(id,n);}return nodes.get(id);};
 let activeScreen={id:'mission2'};
 const document={hidden:false,readyState:'loading',body:create('body'),createElement:create,createTextNode:t=>({textContent:t}),getElementById:$,querySelector:q=>q==='.screen.active'?activeScreen:create(),querySelectorAll:q=>q==='.mate.joined'?[{dataset:{mate:'Engineer'}}]:[],addEventListener(n,f){(events.get('document:'+n)||events.set('document:'+n,[]).get('document:'+n)).push(f);}};
 const localStorage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k),key:i=>[...data.keys()][i],get length(){return data.size;}};
 const c={console,document,localStorage,$,Date,JSON,Math,Number,Map,Set,URLSearchParams,queueMicrotask:f=>f(),setTimeout:(f,ms)=>(timers.push({f,ms}),timers.length),clearTimeout(){},setInterval(){return 1;},clearInterval(){},CustomEvent:class{constructor(type,o){this.type=type;this.detail=o?.detail;}},Telegram:{WebApp:{initData:'mock-test-only'}},addEventListener(n,f){(events.get(n)||events.set(n,[]).get(n)).push(f);},dispatchEvent(e){for(const f of events.get(e.type)||[])f(e);},engineerTiles2:[{base:[0,1],rotation:0}],remainingLife1CodeTime:()=>0};
 c.window=c;c.globalThis=c;c.MKTYStorage={identity:()=>101,keys:()=>[...data.keys()]};c.location={reload:()=>c.dispatchEvent({type:'pagehide'})};c.show=()=>{};
 for(const n of ['openMission','openMission2','openLife3MemoryGate','openMission4','openMission5','openMission6','openMission7','openMission8','openMission9','startLife1','startLife2','startLife3','startLife4','startLife5','startLife6','startLife7','startLife8','startLife9'])c[n]=()=>{};
 vm.createContext(c);return {c,data,nodes,timers,navigate:id=>activeScreen={id},run:f=>vm.runInContext(fs.readFileSync(root+'/'+f,'utf8'),c,{filename:f})};
}

(async()=>{
 const old={version:1,joined:['Engineer'],pipes:[]},remote={version:1,joined:['Navigator','Scout'],pipes:[]};
 const f=fixture({mkty_cloud_revision:'1',mkty_cloud_dirty:'yes',mkty_campaign_checkpoint_2:JSON.stringify(old)});
 f.c.MKTYRewards={endpoint:'mock',authenticatedFetch:async()=>({ok:true,revision:2,snapshot:{mkty_campaign_checkpoint_2:JSON.stringify(remote)}})};
 f.run('cloud-save.js');f.run('campaign.js');f.c.MKTYCampaign.onScreen('mission2');await f.c.MKTYCloud.load();
 const button=f.nodes.get('cloudSaveStatus').children.find(n=>n.tagName==='BUTTON');assert(button);
 button.onclick();
 assert.deepEqual(JSON.parse(f.data.get('mkty_cloud_restore_pending')).snapshot,{mkty_campaign_checkpoint_2:JSON.stringify(remote)});
 assert.deepEqual(JSON.parse(f.data.get('mkty_campaign_checkpoint_2')).joined,['Engineer'],'pagehide still saves the outgoing controller');
 const reboot=fixture(Object.fromEntries(f.data));reboot.run('cloud-save.js');
 assert.deepEqual(JSON.parse(reboot.data.get('mkty_campaign_checkpoint_2')),remote,'cloud checkpoint is applied before the new controllers initialize');
 assert.deepEqual(JSON.parse(JSON.parse(reboot.data.get('mkty_cloud_recovery')).mkty_campaign_checkpoint_2).joined,['Engineer'],'last local run remains recoverable');
 assert.equal(reboot.data.get('mkty_cloud_restore_pending'),undefined);assert.equal(reboot.data.get('mkty_cloud_revision'),'2');assert.equal(reboot.data.get('mkty_cloud_dirty'),undefined);
 // Memory-only storage cannot safely transfer a selected save to a new document.
 f.c.MKTYStorage.persistent=false;let reloads=0;f.c.location.reload=()=>reloads++;f.data.delete('mkty_cloud_restore_pending');button.onclick();assert.equal(reloads,0);assert.equal(f.data.get('mkty_cloud_restore_pending'),undefined);
 for(const value of ['null','{}','"bad"','17','[]','[null,17,"older"]']){
  const p=fixture({mkty_pace_charged:value,mkty_life1:'complete',mkty_global_lives:'9'});
  p.c.getLifeBank=()=>Number(p.data.get('mkty_global_lives'));p.c.spendGlobalLife=()=>{p.data.set('mkty_global_lives',String(p.c.getLifeBank()-1));return true;};p.run('pacing.js');
  assert.equal(p.c.MKTYPace.fail(2,'phase','probe'),true,value);assert.equal(p.c.getLifeBank(),8);assert.equal(p.c.MKTYPace.fail(2,'phase','probe'),false);assert.equal(p.c.getLifeBank(),8);
 }
 // A delayed zero-life notice belongs to the failed scene, never a newer destination.
 for(const navigate of [false,true]){
  const p=fixture({mkty_life1:'complete',mkty_global_lives:'1'}),shows=[];
  p.c.getLifeBank=()=>Number(p.data.get('mkty_global_lives'));p.c.spendGlobalLife=()=>{p.data.set('mkty_global_lives','0');return true;};p.c.show=id=>shows.push(id);p.run('pacing.js');p.c.MKTYPace.fail(2,'phase','last');if(navigate)p.navigate('home');p.timers.find(t=>t.ms===1200).f();assert.equal(shows.length,navigate?0:1);
 }
 for(const value of ['null','[]','"wrong"','17','{}','{"attempts":"bad","streak":-3,"solved":"yes"}']){
  const d=fixture({mkty_daily_demo:value});d.run('daily-retention.js');const state=d.c.MKTYDaily._demoStatus();assert.equal(state.cipher.attempts_left,5,value);assert.equal(state.cipher.solved,false);assert.equal(state.streak.streak,0);assert.equal(state.streak.next_reward,3);
 }
 // Client protects progress even while talking to the legacy silently-truncating server.
 const large=fixture({mkty_cloud_revision:'1',mkty_cloud_dirty:'yes',mkty_story_plan_1_v1:'x'.repeat(180000)});let uploads=0;
 large.c.MKTYRewards={endpoint:'mock',authenticatedFetch:async(_url,body)=>{if(body.snapshot)uploads++;return {ok:true,revision:1,snapshot:{}};}};
 large.run('cloud-save.js');await large.c.MKTYCloud.flush();assert.equal(uploads,0);assert.equal(large.data.get('mkty_cloud_dirty'),'yes');assert.equal(large.data.get('mkty_story_plan_1_v1').length,180000);assert.match(large.nodes.get('cloudSaveStatus').children[0].textContent,/too large/);
 const {cleanSnapshot}=await import('../server/rewards/campaign.mjs');assert.throws(()=>cleanSnapshot({mkty_story_plan_1_v1:'x'.repeat(180000)}),/snapshot_too_large/);assert.throws(()=>cleanSnapshot({mkty_story_plan_1_v1:'x'.repeat(175000),mkty_story_plan_2_v1:'x'.repeat(175000)}),/snapshot_too_large/);assert.equal(cleanSnapshot({mkty_story_plan_1_v1:'x'.repeat(179999)}).mkty_story_plan_1_v1.length,179999);assert.throws(()=>cleanSnapshot({mkty_story_plan_1_v1:null}),/snapshot/);
 console.log('PASS: cloud selection survives outgoing pagehide, local recovery copy, quota-safe reload, malformed save recovery, single life debit and newer-navigation protection');
})().catch(e=>{console.error(e);process.exit(1);});
