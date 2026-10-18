/* MOONKATTY concept UI (2026-10-18): loading splash, main-menu wiring (level ring, Moon Points, crystals, daily chest,
   round menu buttons, Home/Inventory/Settings tabs) and localized labels. Presentation only: every action reuses an
   existing screen or route (show(), MKTYHub.open(), campaign/#missionsBtn, world3d/); missing features answer "soon". */
window.MKTYConcept=(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 const lang=()=>{try{return (window.MKTYI18n&&MKTYI18n.getLanguage())||localStorage.getItem('mkty_lang')||'ru';}catch(e){return 'ru';}};
 const tr=(ru,en,uk)=>{const l=lang();if(l==='ru')return ru;if(l==='uk'&&uk)return uk;try{if(window.MKTYI18n&&MKTYI18n.tr)return MKTYI18n.tr(ru,en);}catch(e){}return en;};
 const PLAY={ru:'ИГРАТЬ',en:'PLAY',uk:'ГРАТИ',es:'JUGAR',pt:'JOGAR',de:'SPIELEN',fr:'JOUER',it:'GIOCA',tr:'OYNA',he:'שחק',ar:'العب',zh:'开始',ko:'플레이',ja:'プレイ',hi:'खेलें',id:'MAIN',vi:'CHƠI',pl:'GRAJ'};
 /* ---- loading splash ---- */
 const splash=$('mkSplash'),t0=performance.now();
 function hideSplash(){if(!splash||splash.classList.contains('done'))return;const wait=Math.max(0,650-(performance.now()-t0));setTimeout(()=>{splash.classList.add('done');setTimeout(()=>{splash.hidden=true;},500);},wait);}
 if(splash){const st=$('mkSplashText');let sl='ru';try{sl=localStorage.getItem('mkty_lang')||((Telegram.WebApp.initDataUnsafe.user||{}).language_code||'ru').slice(0,2);}catch(e){}if(st)st.textContent=sl==='uk'?'ЗАВАНТАЖЕННЯ…':['ru','be','kk'].includes(sl)?'ЗАГРУЗКА…':'LOADING…';if(document.readyState==='complete')hideSplash();else addEventListener('load',hideSplash,{once:true});setTimeout(hideSplash,3500);}
 /* ---- toast for "soon" ---- */
 let toastT=0;
 function toast(msg){let t=$('mkcToast');if(!t){t=document.createElement('div');t.id='mkcToast';t.className='mkc-toast';t.setAttribute('role','status');t.setAttribute('aria-live','polite');document.body.appendChild(t);}
  t.textContent=msg;t.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('on'),2200);try{Telegram.WebApp.HapticFeedback.notificationOccurred('warning');}catch(e){}}
 const SOON={inventory:['Инвентарь','Inventory','Інвентар'],shop:['Магазин','Shop','Магазин']};
 function soon(id){const n=SOON[id]||[id,id,id];toast(tr(n[0]+' — скоро','Coming soon: '+n[1],n[2]+' — незабаром'));}
 /* ---- 3D save (level, crystals) written by world3d/ on this origin ---- */
 function world(){let best=null;try{let uid=null;try{uid=Telegram.WebApp.initDataUnsafe.user.id;}catch(e){}
   const keys=uid?['mkty_world_v1_tg_'+uid]:[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.indexOf('mkty_world_v1')===0&&!keys.includes(k))keys.push(k);}
   for(const k of keys){let d=null;try{d=JSON.parse(localStorage.getItem(k)||'null');}catch(e){}if(d&&typeof d==='object'){if(uid&&k==='mkty_world_v1_tg_'+uid){best=d;break;}if(!best||(+d.xp||0)>(+best.xp||0))best=d;}}}catch(e){}
  return best;}
 const num=t=>{const m=String(t||'').replace(/[\s\u00a0,.]/g,'').match(/\d+/);return m?+m[0]:0;};
 const fmt=n=>{try{return new Intl.NumberFormat(lang()==='ru'?'ru-RU':'en-US').format(n);}catch(e){return String(n);}};
 function sync(){
  const w=world()||{},lvl=Math.max(1,Math.min(99,+w.level||1)),xp=+w.xp||0,cr=Math.max(0,+(w.stats&&w.stats.crystals)||0);
  const ln=$('mkcLevelNum');if(ln)ln.textContent=lvl;
  const ring=document.querySelector('#mkcLevel .mkc-ring');if(ring)ring.setAttribute('stroke-dasharray',Math.max(6,Math.min(100,(xp%100)))+' 100');
  const sp=$('mkcStarsNum'),pts=$('points');if(sp&&pts)sp.textContent=fmt(num(pts.textContent));
  const cn=$('mkcCrystalsNum');if(cn)cn.textContent=fmt(cr);
  const sk=$('mkcStreak'),sc=$('streakCount');if(sk)sk.textContent=tr('ДЕНЬ ','DAY ','ДЕНЬ ')+(sc?num(sc.textContent):0);
 }
 /* ---- labels ---- */
 function relabel(){
  const L={map:['Карта','Map','Мапа'],quests:['Задания','Quests','Завдання'],base:['База','Base','База'],friends:['Друзья','Friends','Друзі'],shop:['Магазин','Shop','Магазин']};
  document.querySelectorAll('#mkcIcons [data-mkc]').forEach(b=>{const l=L[b.dataset.mkc];const s=b.querySelector('span');if(l&&s)s.textContent=tr(...l);b.setAttribute('aria-label',tr(...l)+(b.dataset.mkc==='base'?' (3D)':''));});
  const set=(id,txt)=>{const e=$(id);if(e)e.setAttribute('aria-label',txt);};
  set('mkcLevel',tr('Уровень и личное дело','Level and personnel file','Рівень та особова справа'));set('mkcStars',tr('Лунные очки — рейтинг','Moon Points — standings','Місячні очки — рейтинг'));
  set('mkcCrystals',tr('Кристаллы','Crystals','Кристали'));set('mkcMore',tr('Ещё','More','Ще'));set('mkcChest',tr('Ежедневная награда','Daily reward','Щоденна нагорода'));
  const ll=$('mkcLevelLabel');if(ll)ll.textContent=tr('УР','LVL','РІВ');
  const eb=$('enterBtn');if(eb){const l=lang();eb.textContent=PLAY[l]||PLAY.en;}
  sync();
 }
 /* ---- wiring ---- */
 function open3d(){try{sessionStorage.setItem('mkty_world3d_opened','1');}catch(e){}location.href='world3d/';}
 function toDaily(sel){const el=document.querySelector(sel);if(!el)return;el.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'start'});el.classList.add('mkc-flash');setTimeout(()=>el.classList.remove('mkc-flash'),1600);}
 function wire(){
  document.querySelectorAll('#home [data-home-nav]').forEach(b=>{if(b.closest('.mk-bottom-nav')||b.id==='missionsBtn')return;b.addEventListener('click',()=>window.MKTYHub&&MKTYHub.open(b.dataset.homeNav));});
  const act={quests:()=>toDaily('#dailyMissions'),base:open3d,shop:()=>soon('shop')};
  document.querySelectorAll('#mkcIcons [data-mkc]').forEach(b=>{const f=act[b.dataset.mkc];if(f)b.addEventListener('click',f);});
  const ch=$('mkcChest');if(ch)ch.addEventListener('click',()=>toDaily('#dailyOps'));
  {const eb=$('enterBtn');if(eb)new MutationObserver(()=>{const want=PLAY[lang()]||PLAY.en;if(eb.textContent!==want)eb.textContent=want;}).observe(eb,{childList:true,characterData:true,subtree:true});}
  for(const id of ['points','streakCount']){const e=$(id);if(e)new MutationObserver(sync).observe(e,{childList:true,characterData:true,subtree:true});}
  new MutationObserver(relabel).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  addEventListener('storage',sync);addEventListener('pageshow',sync);document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync();});
  relabel();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
 return {soon,sync,relabel,toast,open3d};
})();
