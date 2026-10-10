/* Reconstructed landing survey. FieldRules owns all footprints and readings. */
(function(root){
 'use strict';
 root.MKTYFieldArtModules.register(4,1,'20261010-landing-1',function(s,b,{escape:esc,FieldRules:R},chapter=0){
  const selected=s.version===2?b.footprint:[s.selected],sites=s.version===2?s.sites:(s.complete?[s.pad]:[]),cells=i=>s.version===2?R.footprint(i):[i],confirmed=sites.flatMap(cells);
  const text=(x,y,v,c='#fff3d6',z=21)=>`<text x="${x}" y="${y}" text-anchor="middle" font-size="${z}" fill="${c}" stroke="none" direction="ltr">${esc(v)}</text>`;
  let a='<defs><image id="fa-landing-atlas" href="art/lunar-worksite-atlas-v1.webp" width="1254" height="1254"/><clipPath id="fa-landing-sample"><rect x="650" y="644" width="257" height="287"/></clipPath></defs><g pointer-events="none" font-family="system-ui,sans-serif" font-weight="750"><image href="art/lunar-worksite-ground-v1.webp" width="600" height="600"/>';
  if(chapter===4&&s.mods?.site===1)a+='<rect width="600" height="600" fill="#d9b774" opacity=".09"/>';
  const outline=(list,done)=>{if(!list.length)return '';const x=Math.min(...list.map(i=>i%6))*100+4,y=Math.min(...list.map(i=>Math.floor(i/6)))*100+4,w=(Math.max(...list.map(i=>i%6))+1)*100-x-4,h=(Math.max(...list.map(i=>Math.floor(i/6)))+1)*100-y-4;return done?`<rect class="landing-confirmed" x="${x}" y="${y}" width="${w}" height="${h}" rx="13" fill="#75bea819" stroke="#2f7969" stroke-width="3"/>`:`<path class="landing-selection" d="M${x} ${y+24}v-24h24M${x+w-24} ${y}h24v24M${x+w} ${y+h-24}v24h-24M${x+24} ${y+h}h-24v-24" fill="none" stroke="#254f5b" stroke-width="7"/><path d="M${x} ${y+24}v-24h24M${x+w-24} ${y}h24v24M${x+w} ${y+h-24}v24h-24M${x+24} ${y+h}h-24v-24" fill="none" stroke="#ffe2a0" stroke-width="3"/>`;};
  for(const i of sites)a+=outline(cells(i),true);
  a+=outline(selected,false);
  for(let i=0;i<36;i++){
   const x=i%6*100,y=Math.floor(i/6)*100,seen=s.scans.includes(i),sample=seen&&s.samples.includes(i),t=b.tiles[i],bad=seen&&(t.slope>b.maxSlope||t.wind>b.maxWind||(sample&&t.strength<b.requiredStrength)),done=confirmed.includes(i),sel=selected.includes(i),color=bad?'#624b36':sample?'#174e50':'#284f65';
   a+=`<g class="landing-cell${sel?' selected':''}${done?' confirmed':''}" data-survey-cell="${i}"><path d="M${x+5} ${y+12}v-7h7" fill="none" stroke="#42677b" stroke-opacity=".35"/><rect x="${x+10}" y="${y+7}" width="35" height="34" rx="5" fill="${sel?'#245365':'#d9e6df'}" stroke="#789493" stroke-width=".5"/>${text(x+27.5,y+31,i+1,sel?'#ffe5a7':'#295365',23)}`;
   if(sample)a+=`<ellipse cx="${x+65}" cy="${y+40}" rx="13" ry="3" fill="#244653" opacity=".32"/><svg x="${x+47}" y="${y+2}" width="34" height="40" viewBox="650 644 257 287"><g clip-path="url(#fa-landing-sample)"><use href="#fa-landing-atlas"/></g></svg>`;
   if(seen){const label=sample?t.strength+' kPa':'? kPa';a+=`<rect x="${x+5}" y="${y+45}" width="91" height="50" rx="7" fill="${color}" stroke="#d8e4d1" stroke-width=".7"/>${text(x+50.5,y+67,t.slope+'°/'+t.wind)}${text(x+50.5,y+88,label,sample?'#ffe0a0':'#c7e1e4',21)}`;}
   if(done)a+=`<circle cx="${x+84}" cy="${y+25}" r="10" fill="#216353" stroke="#dcf2d2"/>${text(x+84,y+32,'✓','#eff8d6',20)}`;
   else if(bad)a+=`<path d="M${x+83} ${y+9}l11 23h-22Z" fill="#f5cc86" stroke="#6d502f"/>${text(x+83,y+28,'!','#513e2b',18)}`;
   a+='</g>';
  }
  a+='</g>';
  for(let i=0;i<36;i++)a+=`<g data-field-cell="${i}" role="button" tabindex="0" aria-label="Pad ${i+1}"><rect x="${i%6*100+4}" y="${Math.floor(i/6)*100+4}" width="92" height="92" rx="5" fill="transparent"/></g>`;
  return `<svg viewBox="0 0 600 600" xmlns="http://www.w3.org/2000/svg" aria-label="Mission 4 space" class="field-svg landing-survey" data-renderer="landing-survey-rebuilt-v1">${a}</svg>`;
 });
})(window);
