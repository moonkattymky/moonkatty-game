/* MOONKATTY Creator rewards (player side). Server: rewards Edge Function, creator.* actions. */
window.MKTYCreator=(()=>{
 'use strict';
 const ENDPOINT='https://lswbmgoeinblzuqzakvi.supabase.co/functions/v1/rewards';
 const t=en=>window.MKTYI18n?window.MKTYI18n.t(en):en;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const initData=()=>window.Telegram?.WebApp?.initData||'';
 let state={loading:false,data:null,error:''};
 const POINTS={base:250,tier_1k:250,tier_10k:500};
 const ICON={tiktok:'♪',youtube:'▶',x:'𝕏',instagram:'◎'};
 const ERR={hashtag:'Add #MOONKATTY to the caption you pasted.',weekly:'One submission per week. Try again after the date shown.',duplicate_url:'This video has already been submitted.',url:'Paste a direct link to a TikTok, YouTube, X or Instagram video.',own:'Confirm that this video is yours.',locked:'Your balance is locked after LIFE #9 — new rewards are closed.',auth:'Telegram sign-in expired. Reopen the game.',unavailable:'Server unavailable. Try again later.'};
 async function call(action,payload={}){
  const data=initData();if(!data)return {ok:false,error:'telegram'};
  return await window.MKTYRewards?.call?.(action,payload)||{ok:false,error:'unavailable'};
 }
 const fmt=iso=>{try{return new Date(iso).toLocaleDateString(window.MKTYI18n?.getLanguage?.()||undefined,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});}catch{return iso;}};
 const statusLabel=s=>({pending:t('ON REVIEW'),approved:t('APPROVED'),rejected:t('REJECTED')}[s]||s);
 function list(subs){
  if(!subs?.length)return `<p class="cr-empty">${t('No submissions yet.')}</p>`;
  return `<ul class="cr-list">${subs.map(s=>`<li class="cr-item cr-${esc(s.status)}"><span class="cr-ico" aria-hidden="true">${ICON[s.platform]||'▶'}</span><div><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.url.replace(/^https:\/\/(www\.)?/,''))}</a><small>${fmt(s.created_at)}${s.tier_1k?' · 1K ✓':''}${s.tier_10k?' · 10K ✓':''}${s.points?` · +${s.points} ⭐`:''}</small></div><b>${statusLabel(s.status)}</b></li>`).join('')}</ul>`;
 }
 function page(){
  const d=state.data,inTg=!!initData(),next=d?.next_submit_at;
  const p=d?.points||POINTS;
  return `<section class="cr-wrap" aria-labelledby="crTitle">
<div class="cr-hero"><span class="cr-kicker">${t('CREATOR REWARDS')}</span><h2 id="crTitle">${t('Make a video about MOONKATTY')}</h2><p>${t('Post your own video about the game on TikTok, YouTube, X or Instagram with the hashtag #MOONKATTY, then send us the link. Every video is reviewed by the team.')}</p>
<div class="cr-tiers"><div><b>+${p.base} ⭐</b><small>${t('Approved video')}</small></div><div><b>+${p.tier_1k} ⭐</b><small>${t('1,000+ views')}</small></div><div><b>+${p.tier_10k} ⭐</b><small>${t('10,000+ views')}</small></div></div></div>
<ol class="cr-steps"><li>${t('Record your own video about MOONKATTY.')}</li><li>${t('Add #MOONKATTY to the caption and publish it.')}</li><li>${t('Paste the link and the caption below.')}</li></ol>
${inTg?`<form id="crForm" class="cr-form" novalidate>
<label for="crUrl">${t('Video link')}</label><input id="crUrl" name="url" type="url" inputmode="url" autocomplete="off" maxlength="500" placeholder="https://www.tiktok.com/@you/video/…" required>
<label for="crCaption">${t('Video caption')}</label><textarea id="crCaption" name="caption" rows="3" maxlength="2000" placeholder="${t('Paste the caption — it must include #MOONKATTY')}" required></textarea>
<label class="cr-check"><input id="crOwn" type="checkbox"> <span>${t('This is my own video and I follow the fair-play rules.')}</span></label>
<button class="hub-primary" id="crSubmit" type="submit" ${next||state.loading?'disabled':''}>${state.loading?t('SENDING…'):t('SUBMIT FOR REVIEW')}</button>
${next?`<p class="cr-note">${t('Next submission available')}: <b>${fmt(next)}</b></p>`:`<p class="cr-note">${t('1 submission per week. Each video can be submitted only once.')}</p>`}
<p id="crMsg" class="cr-msg" role="status">${esc(state.error)}</p></form>`:`<p class="cr-note cr-warn">${t('Open the game inside Telegram to submit a video.')}</p>`}
<h3 class="hub-section-title">${t('My submissions')}</h3>${d?list(d.submissions):`<p class="cr-empty">${inTg?t('Loading…'):t('No submissions yet.')}</p>`}
<p class="cr-fine">${t('Creator points are added to your Moon Points and count toward your final balance. View tiers are checked manually by the team; each tier is granted once per video. Bought views, reuploads and other people’s videos are rejected.')}</p>
${d?.is_admin?`<a class="hub-secondary" href="admin.html">${t('Open admin review')}</a>`:''}
</section>`;
 }
 let host=null;
 function draw(){if(host&&host.isConnected)host.innerHTML=page();bind();}
 function bind(){
  const f=host?.querySelector('#crForm');if(!f)return;
  f.onsubmit=async e=>{e.preventDefault();
   const url=f.querySelector('#crUrl').value.trim(),caption=f.querySelector('#crCaption').value,own=f.querySelector('#crOwn').checked;
   const msg=f.querySelector('#crMsg');
   if(!/#moonkatty(?![a-z0-9_])/i.test(caption)){msg.textContent=t(ERR.hashtag);return;}
   if(!own){msg.textContent=t(ERR.own);return;}
   state.loading=true;state.error='';draw();
   const r=await call('creator.submit',{url,caption,own});
   state.loading=false;
   if(r.ok){state.data={...state.data,...r};state.error='';draw();const m=host.querySelector('#crMsg');if(m)m.textContent=t('Sent! Your video is on review.');}
   else{state.error=t(ERR[r.error]||ERR.unavailable);draw();const fu=host.querySelector('#crUrl');if(fu){fu.value=url;host.querySelector('#crCaption').value=caption;host.querySelector('#crOwn').checked=own;}}
  };
 }
 async function mount(el){host=el;bind();if(!initData())return;const r=await call('creator.status');if(r.ok){state.data=r;draw();}}
 return {page,mount};
})();
// Deep link https://t.me/<bot>?startapp=admin opens the admin review page (server still checks ADMIN_TG_IDS).
try{if(window.Telegram?.WebApp?.initDataUnsafe?.start_param==='admin'&&!sessionStorage.getItem('mkty_admin_redirected')){sessionStorage.setItem('mkty_admin_redirected','1');location.href='admin.html'+location.hash;}}catch{}
