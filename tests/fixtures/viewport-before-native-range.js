/* Telegram Mini App viewport: fullscreen, safe areas, no iOS rubber-band. */
(function(){
 var root=document.documentElement,tg=window.Telegram&&window.Telegram.WebApp;
 function px(v){return (Math.max(0,Number(v)||0))+'px';}
 function apply(){
  var h=tg&&(tg.viewportStableHeight||tg.viewportHeight);
  if(!h){root.style.removeProperty('--mk-full-h');root.style.removeProperty('--mk-vh');return;} // outside Telegram: CSS 100dvh fallback
  var s=(tg&&tg.safeAreaInset)||{},c=(tg&&tg.contentSafeAreaInset)||{};
  var top=tg&&tg.isFullscreen?Math.max(0,Number(c.top)||0):0;
  root.style.setProperty('--mk-full-h',h+'px');
  root.style.setProperty('--mk-vh',Math.max(0,h-top)+'px');
  ['top','bottom','left','right'].forEach(function(k){
   root.style.setProperty('--mk-safe-'+k,'max(env(safe-area-inset-'+k+'), '+px(s[k])+')');
   root.style.setProperty('--mk-content-'+k,px(c[k]));
  });
  root.classList.toggle('mk-tg-fullscreen',!!(tg&&tg.isFullscreen));
 }
 function ver(v){try{return !!(tg&&tg.isVersionAtLeast&&tg.isVersionAtLeast(v));}catch(e){return false;}}
 function call(fn){try{fn();}catch(e){}}
 root.classList.add('mk-viewport');
 if(tg){
  root.classList.add('mk-tg');
  call(function(){tg.ready();});
  call(function(){tg.expand();});
  if(ver('6.1')){call(function(){tg.setHeaderColor('#02050a');});call(function(){tg.setBackgroundColor('#02050a');});}
  if(ver('7.10'))call(function(){tg.setBottomBarColor('#02050a');});
  if(ver('7.7')&&tg.disableVerticalSwipes)call(function(){tg.disableVerticalSwipes();});
  var mobile=/android|ios/i.test(tg.platform||'');
  if(ver('8.0')&&tg.requestFullscreen&&mobile&&!tg.isFullscreen)call(function(){tg.requestFullscreen();});
  if(tg.onEvent)['viewportChanged','fullscreenChanged','fullscreenFailed','safeAreaChanged','contentSafeAreaChanged'].forEach(function(ev){call(function(){tg.onEvent(ev,apply);});});
 }
 apply();
 window.addEventListener('resize',apply);
 window.addEventListener('orientationchange',function(){setTimeout(apply,250);});
 // Block page-level pull/bounce: only allow touchmove inside a scroll container that can actually scroll.
 var startY=0;
 document.addEventListener('touchstart',function(e){if(e.touches.length===1)startY=e.touches[0].clientY;},{passive:true});
 document.addEventListener('touchmove',function(e){
  if(e.touches.length!==1)return;
  var t=e.target;
  if(t.closest&&t.closest('.l1-joystick,.exp-joystick,.exp-controls,canvas,[data-mk-no-scroll]')){if(e.cancelable)e.preventDefault();return;}
  var dy=e.touches[0].clientY-startY;
  for(var n=t;n&&n!==document.body&&n.nodeType===1;n=n.parentElement){
   var cs=getComputedStyle(n);
   if(/(auto|scroll)/.test(cs.overflowY)&&n.scrollHeight>n.clientHeight+1){
    var atTop=n.scrollTop<=0,atBottom=n.scrollTop+n.clientHeight>=n.scrollHeight-1;
    if((dy>0&&atTop)||(dy<0&&atBottom)){if(e.cancelable)e.preventDefault();}
    return;
   }
   if(/(auto|scroll)/.test(cs.overflowX)&&n.scrollWidth>n.clientWidth+1)return;
  }
  if(e.cancelable)e.preventDefault();
 },{passive:false});
 window.MKTYViewport={apply:apply};
})();
