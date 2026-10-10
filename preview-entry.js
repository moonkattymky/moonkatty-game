/* Lazy, home-only preview host. Keep the original Telegram document and campaign alive. */
(function(){
 'use strict';
 const entry=document.getElementById('preview3DEntry');if(!entry)return;
 const ru=()=>document.documentElement.lang==='ru',text=(a,b)=>ru()?a:b;
 let dialog=null,frame=null,timer=0,generation=0,priorFocus=null,priorScroll=0,back=null,backVisible=false,pauseWanted=false;
 const app=document.getElementById('app'),tg=window.Telegram?.WebApp;
 const safe=fn=>{try{fn();}catch{}};
 function label(){entry.textContent=text('3D ТЕСТ · ЭКСПЕРИМЕНТ','3D TEST · EXPERIMENTAL');}
 label();new MutationObserver(label).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 function pause(){pauseWanted=true;safe(()=>frame?.contentWindow?.MKTYOpenWorld?.pause());}
 function close(){
  if(!dialog)return;generation++;clearTimeout(timer);safe(()=>frame?.contentWindow?.MKTYOpenWorld?.dispose());
  frame?.remove();frame=null;const previous=dialog;dialog=null;safe(()=>previous.close());previous.remove();
  if(back){safe(()=>back.offClick(close));safe(()=>backVisible?back.show():back.hide());back=null;}
  if(tg?.offEvent)safe(()=>tg.offEvent('deactivated',pause));
  if(document.getElementById('home')?.classList.contains('active')){if(app)app.scrollTop=priorScroll;safe(()=>priorFocus?.focus({preventScroll:true}));}
 }
 function mount(){
  if(!dialog||frame||!document.getElementById('home')?.classList.contains('active'))return;
  const token=generation,status=dialog.querySelector('#preview3DStatus');
  dialog.querySelector('#preview3DIntro').hidden=true;status.hidden=false;status.textContent=text('Загрузка 3D… Можно вернуться в игру в любой момент.','Loading 3D… You can return to the game at any time.');
  frame=document.createElement('iframe');frame.id='preview3DFrame';frame.title=text('Экспериментальная лунная база 3D','Experimental 3D lunar base');frame.referrerPolicy='no-referrer';
  frame.src=new URL('graphics-preview/embed.html?v=20261010-3d-test-1',document.baseURI).href;
  frame.addEventListener('load',()=>{if(token!==generation||!dialog)return;if(pauseWanted||document.hidden)pause();});
  frame.addEventListener('error',()=>{if(token===generation&&dialog)status.textContent=text('Не удалось загрузить тест. Вернитесь в игру и попробуйте позже.','The preview could not load. Return to the game and try later.');});
  dialog.querySelector('.preview3d-layout').append(frame);
  timer=setTimeout(()=>{if(token===generation&&dialog)status.textContent=text('Загрузка затянулась. Тест может работать медленно; кнопка возврата доступна.','Loading is taking longer. The test may run slowly; Return remains available.');},30000);
 }
 function open(){
  if(dialog||!document.getElementById('home')?.classList.contains('active'))return;
  priorFocus=document.activeElement;priorScroll=app?.scrollTop||0;pauseWanted=document.hidden;generation++;
  dialog=document.createElement('dialog');dialog.id='preview3DDialog';dialog.setAttribute('aria-labelledby','preview3DTitle');dialog.setAttribute('translate','no');
  const wrap=document.createElement('div');wrap.className='preview3d-layout';
  const header=document.createElement('header');header.className='preview3d-header';
  const title=document.createElement('h2');title.id='preview3DTitle';title.textContent=text('3D · ЭКСПЕРИМЕНТ','3D · EXPERIMENTAL');
  const exit=document.createElement('button');exit.id='preview3DClose';exit.type='button';exit.className='ghost';exit.textContent=text('Вернуться в игру','Return to game');exit.addEventListener('click',close);header.append(title,exit);
  const intro=document.createElement('section');intro.id='preview3DIntro';
  const copy=document.createElement('p');copy.textContent=text('Отдельная тестовая 3D-локация с русским интерфейсом. Она не меняет прохождение и награды. На некоторых телефонах возможны низкая частота кадров, задержки и нагрев. Это проверка прототипа, а не замена основной игры.','A separate experimental 3D location with Russian controls. It does not change campaign progress or rewards. Some phones may have low frame rates, delays or heating. This tests a prototype; it does not replace the main game.');
  const launch=document.createElement('button');launch.id='preview3DLaunch';launch.type='button';launch.className='primary';launch.textContent=text('Открыть 3D тест','Open 3D test');launch.addEventListener('click',mount);intro.append(copy,launch);
  const status=document.createElement('p');status.id='preview3DStatus';status.setAttribute('role','status');status.hidden=true;
  wrap.append(header,intro,status);dialog.append(wrap);document.body.append(dialog);
  dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
  try{dialog.showModal();}catch{close();return;}
  back=tg?.BackButton||null;if(back){backVisible=!!back.isVisible;safe(()=>back.onClick(close));safe(()=>back.show());}
  if(tg?.onEvent)safe(()=>tg.onEvent('deactivated',pause));exit.focus();
 }
 entry.addEventListener('click',open);
 window.addEventListener('message',event=>{
  if(!dialog||!frame||event.origin!==location.origin||event.source!==frame.contentWindow)return;
  if(event.data?.type==='mkty-preview-return'){close();return;}
  if(event.data?.type==='mkty-preview-ready'){
   clearTimeout(timer);const status=dialog.querySelector('#preview3DStatus');status.textContent=text('Эксперимент. Если игра тормозит, вернитесь назад.','Experimental. Return if the preview runs slowly.');
   if(pauseWanted||document.hidden)pause();
  }
  if(event.data?.type==='mkty-preview-error'){clearTimeout(timer);dialog.querySelector('#preview3DStatus').textContent=text('3D недоступно. Вернитесь в основную игру.','3D is unavailable. Return to the main game.');}
 });
 document.addEventListener('visibilitychange',()=>{if(dialog&&document.hidden)pause();});
 window.addEventListener('pagehide',close);
 new MutationObserver(()=>{if(dialog&&!document.getElementById('home')?.classList.contains('active'))close();}).observe(document.getElementById('home'),{attributes:true,attributeFilter:['class']});
})();
