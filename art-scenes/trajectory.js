/* Reconstructed Chapter 3 artwork. FieldRules owns all flight and target geometry. */
(function(root){
 'use strict';
 root.MKTYFieldArtModules.register(3,1,'20261010-flight-1',function(s,b,{escape:esc,localize:L,FieldRules:R},chapter=0){
  const t=b.target,o=b.origin,r=t.radius,p=r+26;
  let a=`<defs><linearGradient id="fa-trajectory-metal" x2=".7" y2="1"><stop stop-color="#fff5cb"/><stop offset=".45" stop-color="#dce8dc"/><stop offset="1" stop-color="#52758a"/></linearGradient><linearGradient id="fa-trajectory-gold" x2="1" y2="1"><stop stop-color="#fff0b0"/><stop offset=".55" stop-color="#d4b66e"/><stop offset="1" stop-color="#917342"/></linearGradient><linearGradient id="fa-trajectory-panel" x2="1" y2="1"><stop stop-color="#214c70"/><stop offset=".5" stop-color="#417694"/><stop offset="1" stop-color="#173b56"/></linearGradient></defs><g pointer-events="none"><image href="art/life6-orbit-v2.webp" width="600" height="450" preserveAspectRatio="xMidYMid slice"/><path d="M14 45V14H45M555 14H586V45M586 405V436H555M45 436H14V405" fill="none" stroke="#b8d7de" stroke-opacity=".4"/>`;
  // Recorded burns retain their own environment; a completed assignment has no fourth preview.
  for(const trail of s.complete?s.trails:[...s.trails,{angle:s.angle,power:s.power,preview:true}]){
   const env=trail.preview?R.condition(s):{wind:trail.wind||0,gravity:trail.gravity||4};
   let d='';
   for(let i=0;i<=40;i++){const q=R.flightPoint(trail.angle,trail.power,i/10,env,trail.preview?s.trim||0:trail.trim||0);d+=(i?'L':'M')+q.x+' '+q.y;}
   a+=`<path class="trajectory-${trail.preview?'preview':'trail'}" d="${d}" fill="none" stroke="${trail.preview?'#ffe7a7':trail.hit?'#9cdbbf':'#d99177'}" stroke-width="${trail.preview?2.5:1}" opacity="${trail.preview?1:.45}" stroke-dasharray="${trail.preview?'6 6':'0'}"/>`;
  }
  if(t.relay){
   const q=t.relay,rr=14+((s.mods||{}).radius||0),label=L('RELAY'),w=Math.min(300,Math.max(90,Array.from(label).length*18+24));
   a+=`<g class="trajectory-relay" transform="translate(${q.x} ${q.y})"><circle r="${rr}" fill="#183e5066" stroke="#ffe1a0" stroke-width="2" stroke-dasharray="3 4"/><path d="M${-rr-5} ${-rr+3}v-8h8M${rr-3} ${-rr-5}h8v8M${rr+5} ${rr-3}v8h-8M${-rr+3} ${rr+5}h-8v-8" fill="none" stroke="url(#fa-trajectory-metal)" stroke-width="4"/><rect x="${-w/2}" y="${-rr-48}" width="${w}" height="40" rx="5" fill="#173f52" stroke="#7ba1b3" stroke-width=".7"/><text x="0" y="${-rr-20}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="21" font-weight="750" fill="#ffe8b1" stroke="none">${esc(label)}</text></g>`;
  }
  a+=`<g class="trajectory-receiver" transform="translate(${t.x} ${t.y})"><path d="M${-p} 0H${p}" stroke="#24465a" stroke-width="11"/><circle cx="3" cy="5" r="${r+9}" fill="#244b61"/><circle r="${r+8}" fill="url(#fa-trajectory-metal)" stroke="#d5e3da"/><circle class="trajectory-target" r="${r}" fill="#163f50" stroke="#fff0bf" stroke-width="2"/><path d="M-6 0H6M0-6V6" fill="none" stroke="#c9eee4" stroke-width="1.5"/><path d="M${-p-27} -22h27v44h-27Z M${p} -22h27v44h-27Z" fill="url(#fa-trajectory-panel)" stroke="url(#fa-trajectory-gold)" stroke-width="3"/><path d="M${-p-14} -21v42M${p+13} -21v42M${-p-26} -11h25m-25 11h25m-25 11h25M${p+1} -11h25m-25 11h25m-25 11h25" fill="none" stroke="#a7c9d6" stroke-opacity=".65" stroke-width=".65"/><path d="M-5 ${-r-10}h10v9H-5Z M-5 ${r+1}h10v9H-5Z M${-r-10} -5h9v10h-9Z M${r+1} -5h9v10h-9Z" fill="url(#fa-trajectory-gold)" stroke="#ffedb4" stroke-width=".7"/><path d="M-19 ${-r-19}h38" stroke="#ffe8a6" stroke-width="1.5"/></g><g class="field-vessel trajectory-player" transform="translate(${o.x} ${o.y}) rotate(${90-s.angle})"><image href="moonkatty-life4-ship.webp" x="-38" y="-25.065" width="76" height="50.13"/></g></g>`;
  return `<svg viewBox="0 0 600 450" xmlns="http://www.w3.org/2000/svg" aria-label="Mission 3 space" class="field-svg trajectory-space" data-renderer="launch-window-rebuilt-v1">${a}</svg>`;
 });
})(window);
