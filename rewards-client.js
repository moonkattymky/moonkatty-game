/* MOONKATTY rewards client: localStorage is UI cache only.
   When the rewards Edge Function is deployed and Telegram initData is present,
   completions / spends / claims go through the server (idempotent event_key).
   Offline / undeployed / guest: provisional local cache (unchanged UX). */
(() => {
 const ENDPOINT = 'https://lswbmgoeinblzuqzakvi.supabase.co/functions/v1/rewards';
 const LIFE_REWARDS = {1:500,2:500,3:750,4:1000,5:1250,6:1500,7:1750,8:2000,9:3000};
 let lastPlayer = null;
 let serverReady = null; // null unknown, true/false

 function initData(){ return window.Telegram?.WebApp?.initData || ''; }

 async function call(action, payload={}){
  const data = initData();
  if(!data){ serverReady = false; return null; }
  try{
   const r = await fetch(ENDPOINT,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({initData:data, action, ...payload}),
    signal:AbortSignal.timeout(8000)
   });
   if(r.status===503){ serverReady = false; return null; }
   const body = await r.json().catch(()=>({}));
   if(!r.ok || !body?.ok){ console.warn('MOONKATTY rewards:', body?.error || r.status); return body; }
   serverReady = true;
   if(body.player){ lastPlayer = body.player; applyCache(body.player); }
   return body;
  }catch(e){
   console.info('MOONKATTY rewards offline/cache:', e?.message || e);
   serverReady = false;
   return null;
  }
 }

 function applyCache(p){
  if(!p) return;
  if(typeof p.moon_points === 'number') localStorage.setItem('mkty_points', String(p.moon_points));
  if(typeof p.lives === 'number') localStorage.setItem('mkty_global_lives', String(p.lives));
  if(p.next_life_at) localStorage.setItem('mkty_life_restore_at', String(Date.parse(p.next_life_at)||0));
  else if(p.lives >= 9) localStorage.removeItem('mkty_life_restore_at');
  if(typeof p.story_life === 'number'){
   for(let i=1;i<=p.story_life;i++) localStorage.setItem('mkty_life'+i, 'complete');
  }
  if(p.balance_locked_at){
   localStorage.setItem('mkty_points_locked_at', String(Date.parse(p.balance_locked_at)||Date.now()));
   if(p.final_balance != null) localStorage.setItem('mkty_final_moon_points', String(p.final_balance));
  }
  const pts = Number(localStorage.getItem('mkty_points')||0);
  const el = document.getElementById('points');
  if(el) el.textContent = (p.balance_locked_at ? (p.final_balance ?? pts) + ' ⭐ 🔒' : pts + ' ⭐');
 }

 async function syncPlayer(){
  const body = await call('player');
  return body?.player || lastPlayer;
 }

 /** Award chapter completion. Returns points balance (local or server). */
 async function completeLife(n, amount){
  const ptsExpected = amount ?? LIFE_REWARDS[n] ?? 0;
  const event_key = 'life:'+n+':complete';
  const body = await call('life.complete', {life:n, event_key});
  // Always mirror local completion UX
  const key = 'mkty_life'+n, awardKey = key+'_awarded';
  let pts = Number(localStorage.getItem('mkty_points')||0);
  if(body?.ok && body.player){
   localStorage.setItem(key,'complete');
   localStorage.setItem(awardKey,'yes');
   pts = body.player.moon_points;
   localStorage.setItem('mkty_points', String(pts));
   return {pts, source: body.awarded ? 'server' : 'server-idempotent', player: body.player};
  }
  // Provisional local cache (no live backend / guest)
  if(localStorage.getItem(awardKey)!=='yes'){
   pts += ptsExpected;
   localStorage.setItem('mkty_points', String(pts));
   localStorage.setItem(awardKey,'yes');
  }
  localStorage.setItem(key,'complete');
  return {pts, source: 'cache', player: null};
 }

 async function spendLife(event_key){
  const key = event_key || ('life:spend:'+Date.now());
  const body = await call('lives.spend', {event_key: key});
  if(body?.ok && body.player){
   return {ok: body.spent || body.duplicate, source: 'server', player: body.player, lives: body.player.lives};
  }
  if(body && body.error === 'no_lives') return {ok:false, source:'server', lives:0};
  // Local provisional
  let lives = Number(localStorage.getItem('mkty_global_lives') ?? 9);
  if(lives <= 0) return {ok:false, source:'cache', lives:0};
  lives--;
  localStorage.setItem('mkty_global_lives', String(lives));
  if(!localStorage.getItem('mkty_life_restore_at')) localStorage.setItem('mkty_life_restore_at', String(Date.now()));
  return {ok:true, source:'cache', lives};
 }

 window.MKTYRewards = {
  endpoint: ENDPOINT,
  syncPlayer,
  completeLife,
  spendLife,
  call,
  getLastPlayer: () => lastPlayer,
  isServerReady: () => serverReady,
  LIFE_REWARDS
 };
})();
