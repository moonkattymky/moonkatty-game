/* Whitelisted paths only; a single initial language instead of all 12 packs. */
(()=>{
 const codes=['ru','uk','es','pt','de','fr','it','tr','he','ar','ko','zh'],jobs={};
 const url=code=>'locales/runtime/'+code+'.js?v=20261008-integrity-1';
 function arabicFont(code){if(code!=='ar'||document.getElementById('arabicFont'))return;const link=document.createElement('link');link.id='arabicFont';link.rel='stylesheet';link.href='https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;600;700&display=swap';document.head.appendChild(link);}
 function load(code){arabicFont(code);
  if(!codes.includes(code)||window.MKTYLocales?.[code])return Promise.resolve();
  if(!jobs[code])jobs[code]=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=url(code);s.onload=resolve;s.onerror=()=>{delete jobs[code];reject(Error('locale'));};document.head.appendChild(s);});
  return jobs[code];
 }
 window.MKTYLocaleLoader={load};
 const selected=localStorage.getItem('mkty_lang')||'en';arabicFont(selected);
 // This parser-time script preserves synchronous initialization of the existing non-module app.
 if(codes.includes(selected))document.write('<script src="'+url(selected)+'"><\/script>');
})();
