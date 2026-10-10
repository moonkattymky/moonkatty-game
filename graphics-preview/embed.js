/* Embedded lifecycle only: the host remains the sole Telegram bridge. No auth data is passed. */
(function(){
 'use strict';
 const send=type=>{if(parent!==window)parent.postMessage({type},location.origin);};
 document.addEventListener('click',event=>{if(event.target.closest('[data-preview-return]')){event.preventDefault();send('mkty-preview-return');}});
 window.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();send('mkty-preview-return');}},true);
 // Slow loading is not a terminal failure. Observe the existing loader so a
 // delayed successful scene can still replace the host's slow-load message.
 function status(){
  if(window.MKTYOpenWorld?.snapshot().ready&&document.getElementById('loading')?.hidden)send('mkty-preview-ready');
  else if(document.getElementById('fallback')?.hidden===false)send('mkty-preview-error');
 }
 const observer=new MutationObserver(status);
 observer.observe(document.getElementById('loading'),{attributes:true,childList:true,subtree:true});status();
 window.addEventListener('error',event=>{if(event.target===window||event.target instanceof HTMLScriptElement)send('mkty-preview-error');},true);
 window.addEventListener('pagehide',()=>observer.disconnect());
})();
