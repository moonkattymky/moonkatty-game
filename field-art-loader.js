/* Optional presentation only. The synchronous reviewed renderer is always the fallback. */
(()=>{
 'use strict';
 const art=window.FieldArt,base=art.scene,model=window.FieldRules;
 const catalog=Object.freeze({3:Object.freeze({file:'art-scenes/trajectory.js?v=20261010-flight-1',version:'20261010-flight-1'})});
 const root=new URL('.',document.currentScript?.src||document.baseURI),pending=new Map(),ready=new Map(),attempts=new Map(),states=new Map();
 const helpers=Object.freeze({
  escape:v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
  localize:v=>{const t=window.MKTYI18n?.t?.(v);return String(t==null?v:t).replace(/[&<>"']/g,'');},
  FieldRules:Object.freeze({condition:model.condition,flightPoint:model.flightPoint})
 });
 const known=n=>Number.isInteger(n)&&Object.hasOwn(catalog,n);
 window.MKTYFieldArtModules=Object.freeze({
  register(n,api,version,render){
   const p=pending.get(n);
   if(!known(n)||api!==1||version!==catalog[n].version||typeof render!=='function'||!p||p.script!==document.currentScript||p.render||ready.has(n))return false;
   p.render=render;return true;
  },
  status:n=>states.get(n)||'idle'
 });
 art.prepareScene=n=>{
  if(!known(n)||states.get(n)==='disabled')return Promise.resolve(false);
  if(ready.has(n))return Promise.resolve(true);
  if(pending.has(n))return pending.get(n).promise;
  if((attempts.get(n)||0)>=2)return Promise.resolve(false);
  let script;
  try{const url=new URL(catalog[n].file,root);if(url.origin!==location.origin)return Promise.resolve(false);script=document.createElement('script');script.async=true;script.src=url.href;}
  catch{attempts.set(n,(attempts.get(n)||0)+1);states.set(n,'failed');return Promise.resolve(false);}
  let resolve;const promise=new Promise(r=>resolve=r),p={script,promise,render:null,timer:null};
  pending.set(n,p);attempts.set(n,(attempts.get(n)||0)+1);states.set(n,'loading');
  const finish=ok=>{
   if(pending.get(n)!==p)return;
   clearTimeout(p.timer);pending.delete(n);
   if(ok&&p.render){ready.set(n,p.render);states.set(n,'ready');resolve(true);}
   else{states.set(n,'failed');script.remove();resolve(false);}
  };
  script.onload=()=>finish(!!p.render);script.onerror=()=>finish(false);
  p.timer=setTimeout(()=>finish(false),5000);
  try{document.head.append(script);}catch{finish(false);}
  return promise;
 };
 art.scene=(s,chapter=0)=>{
  const render=ready.get(s?.n);
  if(render&&states.get(s.n)!=='disabled'){
   const layout=model.layout(s);
   try{const svg=render(s,layout,helpers,chapter);if(typeof svg==='string'&&svg.startsWith('<svg ')&&svg.endsWith('</svg>'))return svg;}catch{}
   states.set(s.n,'disabled');
  }
  return base(s,chapter);
 };
})();
