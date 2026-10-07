/* MOONKATTY pacing: one new chapter per UTC day + every failed mission phase costs one global life.
   Server (rewards Edge Function) is authoritative in Telegram; this layer mirrors it and is the demo fallback.
   Test hook: localStorage.mkty_test_no_pacing='yes' disables calendar pacing and life costs (client only). */
(function(root){
 'use strict';
 const DAY=864e5;
 const Rules={
  nextUtcMidnight(ms){const d=new Date(ms);return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()+1);},
  /** 0 = open. n: chapter; done(k); completedAt(k) ms|0; skipped(n); server {next_life,unlock_at}|null */
  unlockAt({n,done,completedAt,skipped=()=>false,server=null}){
   if(n<=1||done(n)||!done(n-1)||skipped(n))return 0;
   if(server&&server.next_life===n){const t=Date.parse(server.unlock_at||'');return Number.isFinite(t)?t:0;}
   const t=Number(completedAt(n-1))||0;return t?Rules.nextUtcMidnight(t):0;
  },
  /** Does failing this phase cost a life? Training is free; LIFE #1 is a free tutorial on the first run. */
  costs({n,kind,done1}){return kind!=='training'&&!(n===1&&!done1);},
  clock(ms){const m=Math.max(0,Math.ceil(ms/60000));return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');}
 };
 root.PaceRules=Rules;
 if(typeof document==='undefined'){if(typeof module!=='undefined')module.exports=Rules;return;}

 const $=id=>document.getElementById(id),ls=localStorage;
 const T=(en,vars={})=>{let s=root.MKTYI18n?.t?root.MKTYI18n.t(en):en;for(const [k,v] of Object.entries(vars))s=s.split('{'+k+'}').join(v);return s;};
 const done=n=>ls.getItem('mkty_life'+n)==='complete';
 const bypass=()=>ls.getItem('mkty_test_no_pacing')==='yes';
 const server=()=>{try{return JSON.parse(ls.getItem('mkty_pace_server')||'null');}catch{return null;}};
 const completedAt=n=>Number(ls.getItem('mkty_life'+n+'_completed_at')||0);
 function lockedUntil(n){if(bypass())return 0;const at=Rules.unlockAt({n,done,completedAt,skipped:k=>ls.getItem('mkty_pace_skip_'+k)==='yes',server:server()});return at>Date.now()?at:0;}
 function nextLocked(){for(let n=2;n<=9;n++)if(!done(n)&&done(n-1)){const at=lockedUntil(n);return at?{n,at}:null;}return null;}
 const lives=()=>typeof getLifeBank==='function'?getLifeBank():Number(ls.getItem('mkty_global_lives')??9);
 const free=n=>bypass()||!Rules.costs({n,kind:'phase',done1:done(1)});
 function restoreIn(){const stamp=Number(ls.getItem('mkty_life_restore_at')||0);return stamp?Math.max(0,stamp+12*3600e3-Date.now()):0;}
 function onRecorded(n){if(!ls.getItem('mkty_life'+n+'_completed_at'))ls.setItem('mkty_life'+n+'_completed_at',String(Date.now()));}
 function setServer(p){if(p&&typeof p==='object'){ls.setItem('mkty_pace_server',JSON.stringify({next_life:p.next_life,unlock_at:p.unlock_at,skips:Number(p.skips)||0,locked:!!p.locked}));refresh();}}

 // ---------- dialog ----------
 const dlg=document.createElement('dialog');dlg.id='paceDialog';dlg.className='pace-dialog';dlg.setAttribute('aria-labelledby','paceTitle');
 dlg.innerHTML=`<div class="pace-moon" aria-hidden="true"><i></i></div><small id="paceKicker" class="pace-kicker"></small><h2 id="paceTitle"></h2><strong id="paceClock" class="pace-clock" translate="no">--:--</strong><p id="paceText"></p><p id="paceLives" class="pace-lives" translate="no"></p><div class="pace-actions"><button id="paceGo" class="primary" type="button"></button><button id="paceSkip" class="pace-skip" type="button" hidden></button><button id="paceInvite" class="ghost" type="button" hidden></button><button id="paceCancel" class="ghost" type="button"></button></div>`;
 document.body.append(dlg);
 let mode='',chapter=0,tick=null,onGo=null;
 function close(){if(dlg.open)dlg.close();clearInterval(tick);tick=null;onGo=null;}
 function paint(){
  const L=lives();$('paceLives').textContent='❤️ '+L+' / 9';
  if(mode==='chapter'){const at=lockedUntil(chapter);if(!at){close();return;}$('paceClock').textContent=Rules.clock(at-Date.now());}
  else if(mode==='lives'){if(L>0){close();return;}$('paceClock').textContent=Rules.clock(restoreIn());}
 }
 function open(kind,n,go){
  mode=kind;chapter=n;onGo=go||null;const sv=server(),skips=sv?.skips||0;
  $('paceSkip').hidden=$('paceInvite').hidden=true;
  if(kind==='chapter'){
   $('paceKicker').textContent=T('CHAPTER {n} / 09',{n:String(n).padStart(2,'0')});
   $('paceTitle').textContent=T('Next chapter in');
   $('paceText').textContent=T('A new chapter opens every day at 00:00 UTC. Meanwhile complete the Daily Missions, decode the Moon Signal and keep your streak.');
   $('paceGo').textContent=T('📡 DAILY MISSIONS');onGo=()=>{show('home');setTimeout(()=>$('dailyOps')?.scrollIntoView({behavior:'smooth',block:'start'}),60);};
   $('paceInvite').hidden=false;$('paceInvite').textContent=T('👥 Invite a friend — open chapters early');
   if(skips>0){$('paceSkip').hidden=false;$('paceSkip').textContent=T('🎟 Open now · referral passes: {n}',{n:skips});}
   $('paceCancel').textContent=T('GOT IT');
  }else if(kind==='lives'){
   $('paceKicker').textContent=T('LIVES');$('paceTitle').textContent=T('Out of lives. Next life in');
   $('paceText').textContent=T('Every failed board, flight or finale costs 1 life. Each life restores 12 hours after it was spent. Daily Missions stay open.');
   $('paceGo').textContent=T('📡 DAILY MISSIONS');onGo=()=>{show('home');setTimeout(()=>$('dailyOps')?.scrollIntoView({behavior:'smooth',block:'start'}),60);};
   $('paceCancel').textContent=T('GOT IT');
  }else{
   $('paceKicker').textContent=T('CHAPTER {n} / 09',{n:String(n).padStart(2,'0')});$('paceTitle').textContent=T('Risky attempt');
   $('paceClock').textContent='−1 ❤️';
   $('paceText').textContent=T('Failing a board, flight or chapter finale in this chapter costs 1 global life. Training and saved progress stay free. Lives restore 12 hours after they are spent.');
   $('paceGo').textContent=T('START ▶');$('paceCancel').textContent=T('CANCEL');
  }
  paint();clearInterval(tick);if(kind!=='risk')tick=setInterval(paint,1000);
  if(!dlg.open)dlg.showModal();$('paceGo').focus({preventScroll:true});
 }
 $('paceGo').onclick=()=>{const go=onGo;close();go?.();};
 $('paceCancel').onclick=close;dlg.addEventListener('cancel',e=>{e.preventDefault();close();});
 $('paceInvite').onclick=()=>{close();root.MKTYGrowth?.openInvite?.();};
 $('paceSkip').onclick=async()=>{const n=chapter;$('paceSkip').disabled=true;const r=await root.MKTYRewards?.call?.('chapter.skip',{life:n});$('paceSkip').disabled=false;if(r?.ok){if(r.pace)setServer(r.pace);ls.setItem('mkty_pace_skip_'+n,'yes');close();toast(T('Chapter unlocked with a referral pass 🎟'));refresh();}else toast(T('No referral passes yet'));};

 // ---------- toast ----------
 const note=document.createElement('div');note.id='paceToast';note.className='pace-toast';note.setAttribute('role','status');document.body.append(note);let noteTimer=0;
 function toast(text){note.textContent=text;note.classList.add('on');clearTimeout(noteTimer);noteTimer=setTimeout(()=>note.classList.remove('on'),2600);}

 // ---------- gates ----------
 /** May the player enter chapter n? Shows the countdown / no-lives dialog otherwise. */
 function gate(n){
  if(bypass())return true;
  if(!done(n)&&lockedUntil(n)){open('chapter',n);return false;}
  if(!done(n)&&!free(n)&&lives()<=0){open('lives',n);return false;}
  return true;
 }
 /** Before a risky (life-costing) phase: block at 0 lives, warn once per chapter. */
 function risky(n,go,kind='phase'){
  if(bypass()||kind==='training'||free(n)){go();return;}
  if(lives()<=0){open('lives',n);return;}
  if(ls.getItem('mkty_pace_ack_'+n)==='yes'){go();return;}
  open('risk',n,()=>{ls.setItem('mkty_pace_ack_'+n,'yes');go();});
 }
 /** A board/flight/finale attempt failed. key makes the charge idempotent (reloads never double-charge). */
 function fail(n,kind,key){
  if(bypass()||!n)return false;
  if(!Rules.costs({n,kind,done1:done(1)})){if(kind!=='training')toast(T('Tutorial: no life lost in your first LIFE #1'));return false;}
  let charged=[];try{charged=JSON.parse(ls.getItem('mkty_pace_charged')||'[]');}catch{}
  const id=String(key||Date.now());if(charged.includes(id))return false;charged.push(id);ls.setItem('mkty_pace_charged',JSON.stringify(charged.slice(-200)));
  if(typeof spendGlobalLife!=='function'||!spendGlobalLife('life:fail:'+id.replace(/[^A-Za-z0-9:._-]/g,'').slice(0,150)))return false;
  const L=lives();toast(T('−1 life · {n} / 9 left',{n:L}));refresh();
  if(L<=0)setTimeout(()=>{show('chapters');open('lives',n);},1200);
  return true;
 }

 // ---------- strip on chapters + home ----------
 const strip=document.createElement('button');strip.type='button';strip.id='paceStrip';strip.className='pace-strip';strip.hidden=true;
 function mountStrip(){const list=$('chapterList');if(list&&!strip.isConnected)list.before(strip);}
 strip.onclick=()=>{const l=nextLocked();if(l)open('chapter',l.n);else if(lives()<=0)open('lives',0);};
 function refresh(){
  mountStrip();const l=bypass()?null:nextLocked(),L=lives();
  if(l){strip.hidden=false;strip.innerHTML=`<b aria-hidden="true">🌙</b><span><strong>${T('Next chapter in {t}',{t:'<em translate="no">'+Rules.clock(l.at-Date.now())+'</em>'})}</strong><small>${T('Meanwhile: Daily Missions and the Moon Signal cipher')}</small></span><i translate="no">❤️ ${L}/9</i>`;}
  else if(!bypass()&&L<=0){strip.hidden=false;strip.innerHTML=`<b aria-hidden="true">❤️</b><span><strong>${T('Out of lives. Next life in {t}',{t:'<em translate="no">'+Rules.clock(restoreIn())+'</em>'})}</strong><small>${T('Meanwhile: Daily Missions and the Moon Signal cipher')}</small></span><i translate="no">❤️ 0/9</i>`;}
  else strip.hidden=true;
  document.querySelectorAll('#chapterList .chapter-card').forEach(card=>{const n=Number(card.dataset.chapter),at=lockedUntil(n);card.classList.toggle('pace-locked',!!at);const s=card.querySelector('small');if(at&&s)s.textContent=T('OPENS IN {t}',{t:Rules.clock(at-Date.now())});});
 }
 setInterval(()=>{if(!document.hidden)refresh();},15000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
 root.MKTYPace={gate,risky,fail,lockedUntil,nextLocked,onRecorded,setServer,refresh,open,toast,bypass,Rules};
})(typeof window!=='undefined'?window:globalThis);
