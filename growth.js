/* MOONKATTY growth: Invite friends (server-verified referral bonus) + Share.
   Referral link: https://t.me/<BOT>?startapp=ref_<telegram_id>. Telegram signs start_param inside
   initData, the rewards function attaches the inviter once and pays both players only after the
   invitee's first LIFE #1 completion (self-invites rejected, daily cap). */
(() => {
 'use strict';
 const BOT_USERNAME = (document.querySelector('meta[name="mkty-bot"]')?.content || '').trim().replace(/^@/, '');
 const GAME_URL = 'https://moonkattymky.github.io/moonkatty-game/';
 const BONUS = 200;
 const tg = window.Telegram?.WebApp;
 const $ = id => document.getElementById(id);
 const t = (en, vars={}) => { let s = window.MKTYI18n?.t?.(en) ?? en; for (const [k,v] of Object.entries(vars)) s = s.replaceAll('{'+k+'}', v); return s; };
 const userId = () => tg?.initDataUnsafe?.user?.id || null;
 function inviteLink(){
  const id = userId();
  if (BOT_USERNAME) return 'https://t.me/' + BOT_USERNAME + (id ? '?startapp=ref_' + id : '');
  return GAME_URL + (id ? '?ref=' + id : '');
 }
 function share(text, url){
  const shareUrl = 'https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(text);
  if (tg?.initData && tg.openTelegramLink) { try { tg.openTelegramLink(shareUrl); return; } catch (_) {} }
  if (navigator.share) { navigator.share({ title: 'MOONKATTY: 9 LIVES', text, url }).catch(() => {}); return; }
  window.open(shareUrl, '_blank', 'noopener');
 }
 const inviteText = () => t('🌙 Join my crew in MOONKATTY: 9 LIVES! Complete LIFE #1 and we both get +{n} Moon Points ⭐', { n: BONUS });
 const shareGame = () => share(t('🚀 MOONKATTY: 9 LIVES — nine chapters of a lunar mission in Telegram. Play with me!'), inviteLink());
 const shareLife = n => share(t('🌙 I completed LIFE #{n} in MOONKATTY: 9 LIVES! Can you beat it? 🚀', { n }), inviteLink());

 function mountHome(){
  const enter = $('enterBtn');
  if (!enter) return;
  const row = $('mkGrowthRow') || document.createElement('div');
  row.id = 'mkGrowthRow'; row.className = 'mk-growth-row';
  if(!row.children.length)row.innerHTML = '<button id="mkInviteBtn" type="button" class="mk-invite-btn"><span class="mk-gi">👥</span><span class="mk-gt"><b>Invite friends</b><small>+' + BONUS + ' ⭐ each</small></span></button>' +
   '<button id="mkShareBtn" type="button" class="mk-share-btn" aria-label="Share"><span>↗</span><b>Share</b></button>';
  if(!row.isConnected)enter.insertAdjacentElement('afterend', row);
  $('mkInviteBtn').addEventListener('click', openInvite);
  $('mkShareBtn').addEventListener('click', shareGame);
 }

 function sheet(){
  let el = $('mkInviteSheet'); if (el) return el;
  el = document.createElement('div'); el.id = 'mkInviteSheet'; el.className = 'mk-invite-sheet'; el.hidden = true;
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Invite friends');
  el.innerHTML = '<div class="mk-invite-card"><button type="button" class="mk-invite-close" aria-label="Close">✕</button>' +
   '<img src="art/moonkatty-logo.webp" alt="" width="88" height="88" class="mk-invite-logo">' +
   '<p class="eyebrow">CREW RECRUITMENT</p><h2>Invite friends</h2>' +
   '<div class="mk-invite-bonus"><strong>+' + BONUS + ' ⭐</strong><span>for you and your friend</span></div>' +
   '<p class="mk-invite-rule">Both of you get Moon Points after your friend completes LIFE #1.</p>' +
   '<div class="mk-invite-stats"><article><b id="mkRefInvited">0</b><small>Invited</small></article><article><b id="mkRefActive">0</b><small>Completed LIFE #1</small></article><article><b id="mkRefEarned">0 ⭐</b><small>Earned</small></article></div>' +
   '<label class="mk-invite-label" for="mkInviteLink">Your invite link</label><input id="mkInviteLink" readonly dir="ltr" translate="no">' +
   '<p id="mkInviteHint" class="mk-invite-hint" hidden>Open the game in Telegram to get your personal invite link.</p>' +
   '<div class="mk-invite-actions"><button type="button" id="mkInviteSend" class="primary">Invite friends</button><button type="button" id="mkInviteCopy" class="ghost">Copy link</button></div>' +
   '<p class="mk-invite-final">Referral Moon Points count toward your FINAL MOON POINTS BALANCE, which may be used to determine the MKTY reward after launch. No fixed MKTY conversion rate, no guaranteed value.</p><p class="mk-invite-fine">Verified by the server. Self-invites don\'t count. Daily limit applies.</p></div>';
  ($('app') || document.body).appendChild(el);
  el.addEventListener('click', e => { if (e.target === el || e.target.closest('.mk-invite-close')) el.hidden = true; });
  $('mkInviteSend').addEventListener('click', () => share(inviteText(), inviteLink()));
  $('mkInviteCopy').addEventListener('click', async () => {
   const b = $('mkInviteCopy');
   try { await navigator.clipboard.writeText(inviteLink()); } catch (_) { $('mkInviteLink').select(); document.execCommand?.('copy'); }
   b.textContent = 'Copied ✓'; setTimeout(() => { b.textContent = 'Copy link'; }, 1500);
  });
  return el;
 }
 function renderStats(s){
  if (!s) return;
  $('mkRefInvited').textContent = String(Number(s.invited) || 0);
  $('mkRefActive').textContent = String(Number(s.activated) || 0);
  $('mkRefEarned').textContent = (Number(s.earned) || 0) + ' ⭐';
 }
 async function openInvite(){
  const el = sheet(); el.hidden = false;
  $('mkInviteLink').value = inviteLink();
  $('mkInviteHint').hidden = !!userId();
  try { renderStats(JSON.parse(localStorage.getItem('mkty_ref_stats') || 'null')); } catch (_) {}
  const body = await window.MKTYRewards?.call?.('referrals.stats');
  if (body?.ok && body.referrals) { localStorage.setItem('mkty_ref_stats', JSON.stringify(body.referrals)); renderStats(body.referrals); }
 }

 // "Share" on every LIFE completion card
 function decorateCompletions(){
  for (let n = 1; n <= 9; n++) {
   const card = $('life' + n + 'Complete');
   if (!card || card.querySelector('.mk-life-share')) continue;
   const b = document.createElement('button');
   b.type = 'button'; b.className = 'ghost mk-life-share'; b.textContent = '↗ Share';
   b.addEventListener('click', e => { e.stopPropagation(); shareLife(n); });
   card.appendChild(b);
  }
 }

 function init(){ mountHome(); decorateCompletions(); if (new URLSearchParams(location.search).get('invite') === '1') openInvite(); }
 if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
 window.MKTYGrowth = { inviteLink, openInvite, shareGame, shareLife };
})();
