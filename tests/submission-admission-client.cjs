/* Production response handlers with a minimal DOM. Exact-head browser CI remains required. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const translated={'ON REVIEW':'На проверке',APPROVED:'Одобрено',REJECTED:'Отклонено','This video has already been submitted.':'Это видео уже отправлено.','This link has already been submitted.':'Эта ссылка уже отправлена.'};
const t=s=>translated[s]||s;
const row=status=>({id:7,platform:'x',kind:'daily',url:'https://x.com/fixture/status/12345',proof:'https://x.com/fixture/status/12345',day:'2026-10-10',created_at:'2026-10-10T12:00Z',status,points:status==='approved'?5:0});
(async()=>{
 for(const status of ['pending','approved','rejected'])for(const duplicate of [true,false]){
  if(!duplicate&&status!=='pending')continue;
  const submission=row(status),response={ok:true,duplicate,submission,submissions:[submission],today:'2026-10-10'},snapshot=JSON.stringify(response);
  const calls=[],msg={textContent:''},fields={'#crUrl':{value:submission.url},'#crCaption':{value:'#moonkatty'},'#crOwn':{checked:true},'#crMsg':msg};
  const form={querySelector:s=>fields[s]},host={isConnected:true,innerHTML:'',querySelector:s=>s==='#crForm'?form:fields[s]};
  const window={Telegram:{WebApp:{initData:'fixture'}},MKTYI18n:{t,getLanguage:()=> 'ru'},MKTYRewards:{call:async(action)=>{calls.push(action);return action==='creator.status'?{ok:true,submissions:[]}:response;}}};
  vm.runInNewContext(src('creator.js'),{window},{filename:'creator.js'});
  await window.MKTYCreator.mount(host);await form.onsubmit({preventDefault(){}});
  assert.equal(msg.textContent,duplicate?t('This video has already been submitted.')+' '+t({pending:'ON REVIEW',approved:'APPROVED',rejected:'REJECTED'}[status]):'Sent! Your video is on review.');
  assert(host.innerHTML.includes(t({pending:'ON REVIEW',approved:'APPROVED',rejected:'REJECTED'}[status])));
  assert.deepEqual(calls,['creator.status','creator.submit']);assert.equal(JSON.stringify(response),snapshot,'creator presentation never mutates submission state/rewards');
  const handlers={},socialCalls=[],box={hidden:false,innerHTML:'',contains:()=>false};
  const document={readyState:'loading',activeElement:null,getElementById:id=>id==='dailyMissions'?box:null,addEventListener:(name,fn)=>{handlers[name]=fn;}};
  const socialWindow={Telegram:{WebApp:{initData:'fixture'}},MKTYI18n:{t,getLanguage:()=> 'ru'},MKTYRewards:{call:async action=>{socialCalls.push(action);return response;}},addEventListener(){}};
  vm.runInNewContext(src('social.js'),{window:socialWindow,document,localStorage:{setItem(){throw Error('submission cannot award client points');}}},{filename:'social.js'});
  const socialForm={dataset:{pl:'x',kind:'daily'},proof:{value:submission.proof}};
  await handlers.submit({target:{closest:()=>socialForm},preventDefault(){}});
  assert.equal(socialWindow.MKTYSocial._state.msg.x,duplicate?t('This link has already been submitted.')+' '+t({pending:'ON REVIEW',approved:'APPROVED',rejected:'REJECTED'}[status]):'Sent for review. Points arrive after approval.');
  assert(box.innerHTML.includes(t({pending:'ON REVIEW',approved:'APPROVED',rejected:'REJECTED'}[status])));
  assert.deepEqual(socialCalls,['social.submit']);assert.equal(JSON.stringify(response),snapshot,'social presentation never mutates submission state/rewards');
 }
 console.log('PASS: production creator/social clients distinguish pending, approved and rejected duplicate replies using existing translations; new submissions retain normal messages and no client reward/state mutation occurs');
})().catch(e=>{console.error(e);process.exit(1)});
