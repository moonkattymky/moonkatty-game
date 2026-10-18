/* Closed-test entry to the 3D chapter 1 (world3d/). Opens it only when the Mini App was launched with
   start_param "world3d" (t.me/MoonKattyGameBot?startapp=world3d) or with ?world3d=1. Once per tab session,
   so the 3D world's Back button can return to this 2D game without bouncing back. Referral links are unaffected. */
(function(){try{
 var tg=window.Telegram&&window.Telegram.WebApp,sp=tg&&tg.initDataUnsafe&&tg.initDataUnsafe.start_param;
 var want=sp==='world3d'||new URLSearchParams(location.search).get('world3d')==='1';
 if(!want||sessionStorage.getItem('mkty_world3d_opened')==='1')return;
 sessionStorage.setItem('mkty_world3d_opened','1');location.replace('world3d/');
}catch(e){}})();
