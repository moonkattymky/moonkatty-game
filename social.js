/* MOONKATTY Daily social missions (verified). Server: rewards Edge Function social.* actions.
   Telegram: real channel membership check. X / TikTok: personal code + admin review.
   YouTube: link only (points come from code words). Opening links never pays. */
window.MKTYSocial=(()=>{
 'use strict';
 const ENDPOINT='https://lswbmgoeinblzuqzakvi.supabase.co/functions/v1/rewards';
 const LINKS={telegram:'https://t.me/moonkattymkty',youtube:'https://www.youtube.com/@moonkattymky',x:'https://x.com/moonkattymky',tiktok:'https://www.tiktok.com/@moonkattymky'};
 const t=(en,v={})=>{let s=window.MKTYI18n?window.MKTYI18n.t(en):en;for(const k in v)s=s.split('{'+k+'}').join(v[k]);return s;};
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const tg=()=>window.Telegram?.WebApp;
 const initData=()=>tg()?.initData||'';
 let st={data:null,loading:false,msg:{},open:null,busy:false,lastLang:null};
 const ERR={not_member:'Not subscribed yet. Join the channel, then check again.',bot_not_admin:'Check is temporarily unavailable: the channel has not connected the MOONKATTY bot yet. No points were lost — try later.',not_configured:'Check is temporarily unavailable. Try later.',telegram_unavailable:'Telegram did not answer. Try again.',proof:'Paste a link to your post / comment (or your @handle for follow).',already:'Already submitted — wait for review.',daily_limit:'One submission per platform per UTC day.',pending_limit:'Too many submissions on review. Wait for the team.',duplicate_proof:'This link has already been submitted.',locked:'Your balance is locked after LIFE #9 — new rewards are closed.',auth:'Telegram sign-in expired. Reopen the game.',unavailable:'Server unavailable. Try again later.',telegram:'Open the game in Telegram to verify.'};
 async function call(action,payload={}){
  const d=initData();if(!d)return {ok:false,error:'telegram'};
  return await window.MKTYRewards?.call?.(action,payload)||{ok:false,error:'unavailable'};
 }
 function openLink(url){if(url.startsWith('https://t.me/')&&tg()?.openTelegramLink)tg().openTelegramLink(url);else if(tg()?.openLink)tg().openLink(url);else window.open(url,'_blank','noopener');}
 const setPts=p=>{if(typeof p?.moon_points==='number'){localStorage.setItem('mkty_points',String(p.moon_points));const el=document.getElementById('points');if(el)el.textContent=p.moon_points+' ⭐';}};
 const subFor=(pl,kind)=>{const d=st.data,today=d?.today;return (d?.submissions||[]).find(s=>s.platform===pl&&s.kind===kind&&(kind==='follow'?s.status!=='rejected':s.day===today));};
 const badge=s=>s?`<em class="sv-badge sv-${esc(s.status)}">${s.status==='approved'?t('APPROVED')+' ✓':s.status==='pending'?t('ON REVIEW'):t('REJECTED')}</em>`:'';
 function codeCard(pl){
  const d=st.data,code=d?.code||'MKTY-····',p=d?.points||{x_follow:5,x_daily:5,tiktok_follow:5,tiktok_daily:5};
  const name=pl==='x'?'X':'TikTok',icon=pl==='x'?'𝕏':'♪';
  const how=pl==='x'?t('Post or reply on X with your code {code} and #MOONKATTY, then paste the link to the post.',{code}):t('Comment your code {code} under our pinned TikTok video, then paste the link to your comment.',{code});
  const fs=subFor(pl,'follow'),ds=subFor(pl,'daily'),m=st.msg[pl];
  const form=k=>`<form class="sv-form" data-pl="${pl}" data-kind="${k}"><input name="proof" autocomplete="off" maxlength="500" dir="ltr" placeholder="${k==='follow'?(pl==='x'?'@your_handle':'@your.handle'):(pl==='x'?'https://x.com/you/status/…':'https://www.tiktok.com/@moonkattymky/video/…')}" aria-label="${esc(k==='follow'?t('Your profile @handle'):t('Link to your post / comment'))}"><button class="sv-btn" ${st.busy?'disabled':''}>${t('SEND FOR REVIEW')}</button></form>`;
  return `<article class="sv-card" data-sv="${pl}"><header><span class="sv-ico">${icon}</span><div><strong>${name}</strong><small>${t('Checked by the team · points after approval')}</small></div><a class="sv-link" href="${LINKS[pl]}" data-open="${pl}">${t('OPEN')} ↗</a></header>
<p class="sv-how">${how}</p>
<div class="sv-row"><div><b>${t('Follow')} · +${p[pl+'_follow']} ⭐</b><small>${t('Once. Paste your @handle so we can find you among followers.')}</small></div>${badge(fs)}</div>${!fs&&!d?.paid?.[pl+'_follow']?form('follow'):''}
<div class="sv-row"><div><b>${pl==='x'?t('Post / reply with code'):t('Comment with code')} · +${p[pl+'_daily']} ⭐ ${t('/ day')}</b><small>${t('Once per UTC day.')}</small></div>${badge(ds)}</div>${!ds?form('daily'):''}
${m?`<p class="sv-msg" role="status">${esc(m)}</p>`:''}</article>`;
 }
 function html(){
  const d=st.data,inTg=!!initData(),tgDone=d?.telegram?.verified,ch=d?.channel||'@moonkattymkty';
  return `<div class="daily-head"><div><small>${t('SOCIAL · VERIFIED')}</small><strong>${t('Daily Missions')}</strong></div><span id="dailyProgress">${d?esc(d.code):'—'}</span></div>
<p class="daily-note">${t('Opening a link gives no points. Rewards are paid only after a real check: Telegram membership by the bot, X and TikTok by the team.')}</p>
${inTg?'':`<p class="sv-msg">${t('Open the game in Telegram to verify.')}</p>`}
<div class="sv-code"><span>${t('YOUR CODE')}</span><strong translate="no" dir="ltr">${esc(d?.code||'MKTY-····')}</strong><button class="sv-btn sv-copy" data-copy ${d?'':'disabled'}>${t('COPY')}</button></div>
<article class="sv-card" data-sv="telegram"><header><span class="sv-ico">✈</span><div><strong>Telegram ${esc(ch)}</strong><small>${t('Subscribe to the channel · +5 ⭐ once')}</small></div><a class="sv-link" href="${LINKS.telegram}" data-open="telegram">${t('OPEN')} ↗</a></header>
<div class="sv-row"><div><b>${t('Subscription check')}</b><small>${t('The bot checks that you are a channel member.')}</small></div>${tgDone?`<em class="sv-badge sv-approved">${t('VERIFIED')} ✓</em>`:`<button class="sv-btn" data-tgcheck ${st.busy||!inTg?'disabled':''}>${t('CHECK SUBSCRIPTION')}</button>`}</div>
${st.msg.telegram?`<p class="sv-msg" role="status">${esc(st.msg.telegram)}</p>`:''}</article>
${codeCard('x')}${codeCard('tiktok')}
<article class="sv-card" data-sv="youtube"><header><span class="sv-ico">▶</span><div><strong>YouTube</strong><small>${t('Subscribing gives no points yet. Earn points with code words from our videos (Daily signals).')}</small></div><a class="sv-link" href="${LINKS.youtube}" data-open="youtube">${t('OPEN')} ↗</a></header></article>
<article class="sv-card" data-sv="share"><header><span class="sv-ico">↗</span><div><strong>${t('Share in Telegram')}</strong><small>${t('No points — invite friends with your referral link to earn.')}</small></div><a class="sv-link" href="#" data-open="share">${t('SHARE')} ↗</a></header></article>`;
 }
 function render(){
  const box=document.getElementById('dailyMissions');if(!box)return;
  box.hidden=false;const lang=window.MKTYI18n?.getLanguage?.();
  if(box.contains(document.activeElement)&&document.activeElement.tagName==='INPUT'&&lang===st.lastLang)return;
  st.lastLang=lang;box.innerHTML=html();
 }
 async function load(){if(!initData()||st.loading)return render();st.loading=true;const r=await call('social.status');st.loading=false;if(r.ok){st.data=r;setPts(r.player);}render();}
 document.addEventListener('click',async e=>{
  const box=document.getElementById('dailyMissions');if(!box||!box.contains(e.target))return;
  const o=e.target.closest('[data-open]');
  if(o){e.preventDefault();const k=o.dataset.open;openLink(k==='share'?'https://t.me/share/url?url='+encodeURIComponent(LINKS.telegram)+'&text='+encodeURIComponent('Join MOONKATTY 🚀🌙'):LINKS[k]);return;}
  if(e.target.closest('[data-copy]')){try{await navigator.clipboard.writeText(st.data.code);st.msg.x=t('Code copied');}catch{}render();return;}
  if(e.target.closest('[data-tgcheck]')){
   st.busy=true;st.msg.telegram=t('Checking…');render();
   const r=await call('social.telegram.verify');st.busy=false;
   if(r.ok&&r.verified){st.msg.telegram=r.awarded?t('Subscription confirmed! +{n} ⭐',{n:r.points}):t('Subscription confirmed ✓');setPts(r.player);}
   else st.msg.telegram=t(ERR[r.status||r.error]||ERR.unavailable);
   await load();return;
  }
 });
 document.addEventListener('submit',async e=>{
  const f=e.target.closest?.('.sv-form');if(!f)return;e.preventDefault();
  const pl=f.dataset.pl,proof=f.proof.value.trim();if(!proof){st.msg[pl]=t(ERR.proof);render();return;}
  st.busy=true;render();const r=await call('social.submit',{platform:pl,kind:f.dataset.kind,proof});st.busy=false;
  if(r.ok){st.data={...st.data,...r};st.msg[pl]=r.duplicate?t(ERR.duplicate_proof)+' '+({pending:t('ON REVIEW'),approved:t('APPROVED'),rejected:t('REJECTED')}[r.submission?.status]||''):t('Sent for review. Points arrive after approval.');}else st.msg[pl]=t(ERR[r.error]||ERR.unavailable);
  render();
 });
 window.addEventListener('mkty:language',render);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);else load();
 return {render,load,_state:st};
})();
