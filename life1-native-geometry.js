/* PROTOTYPE ONLY. Explicit v2 geometry ABI; never loaded by the game.
 * Source snapshots and known native observations are tested independently.
 * Bounded envelope declarations establish consistency, not attested screens. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.Life1NativeGeometry=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
'use strict';
/* UNWIRED RESEARCH ONLY: no production imports, transport, or activation.
 * A candidate for Chromium 145.0.7632.6, pinned application CSS, settled
 * no-ancestor-transform, unit-zoom, no-scroll, reduced-motion geometry.
 * Existing native comparisons cover only the retained observations. More
 * native coverage is required before any complete parity or activation claim.
 */
const ID='life1-css-3b1f9f8b-chromium145-settled-v2';
const BOUNDS=Object.freeze({minimumSize:64,maximumSize:4096,minimumOrigin:-4096,maximumOrigin:4096,unitsPerPixel:64});
const fail=code=>{const error=new Error(code);error.code=code;throw error;};
const f=Math.fround;
function finite(n,min,max){return typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;}
function unit(n,min,max){return finite(n,min,max)&&Number.isInteger(n*64);}
// Blink Length stores percentage as float; multiplication and division are
// float operations. LayoutUnit then truncates toward zero on a 1/64px grid.
function percentageFloat(basis,percent){return f(f(f(basis)*f(percent))/100);}
function percentageLayout(basis,percent){const units=Math.trunc(percentageFloat(basis,percent)*64);return units===0?0:units/64;}
function rect(left,top,width,height){return Object.freeze({left,top,right:left+width,bottom:top+height,width,height});}
function collisionEdges(raw,world){
 // Preserve app.js expression order, including absolute origins. Do not
 // algebraically simplify top to a relative coordinate before multiplication.
 return Object.freeze({left:(raw.left+3-world.left)/world.width*100,
  right:(raw.right-3-world.left)/world.width*100,
  top:(raw.top+raw.height*.36-world.top)/world.height*100,
  bottom:(raw.bottom-2-world.top)/world.height*100});
}
function validateOrigin(left,top){
 if(arguments.length!==2||!unit(left,-4096,4096)||!unit(top,-4096,4096))fail('unsupported-view-origin');
}
function validateEnvelope(width,height,left,top){
 if(arguments.length!==4||!unit(width,64,4096)||!unit(height,64,4096)||!unit(left,-4096,4096)||!unit(top,-4096,4096))fail('unsupported-layout-envelope');
}
function layout(width,height,originX,originY){
 validateEnvelope(...arguments);
 const w=width-2,h=height-2,world=rect(originX,originY,width,height);
 const rawObstacles=[[26,51,17],[74,63,14],[56,41,13]].map(([x,y,size])=>{
  const side=percentageLayout(w,size);
  return rect(originX+1+percentageLayout(w,x),originY+1+percentageLayout(h,y),side,side);
 });
 // Right/bottom are resolved independently, not as complementary percentages.
 const localSpots=[
  ['1',1+percentageLayout(w,10),1+h-percentageLayout(h,20)-62,52,62],
  ['2',1+percentageLayout(w,29),1+h-percentageLayout(h,52)-62,52,62],
  ['3',1+w-percentageLayout(w,6)-52,1+h-percentageLayout(h,41)-62,52,62],
  ['repair',1+w-percentageLayout(w,12)-74,1+h-percentageLayout(h,4)-85,74,85],
  ['antenna',1+w-percentageLayout(w,4)-72,1+percentageLayout(h,16),72,94]
 ].map(([id,left,top,width,height])=>Object.freeze({id,left,top,width,height}));
 return Object.freeze({id:ID,world,innerWidth:w,innerHeight:h,
  rawObstacles:Object.freeze(rawObstacles),obstacles:Object.freeze(rawObstacles.map(r=>collisionEdges(r,world))),
  localSpots:Object.freeze(localSpots)});
}
// Candidate Blink quad -> float RectF -> double DOMRect pipeline. Native
// diagnostics must validate the flattening order before proximity adoption.
function transformedRect(g,left,top,width,height,scale,tx,ty){
 const sx=f(scale),sy=sx;
 // Apply the element transform, then its layout offset in its container.
 tx=f(tx+left);ty=f(ty+top);
 const x1=f(tx+g.world.left),x2=f(f(f(width*sx)+tx)+g.world.left);
 const y1=f(ty+g.world.top),y2=f(f(f(height*sy)+ty)+g.world.top);
 return rect(x1,y1,f(x2-x1),f(y2-y1));
}
function playerRect(g,x,y){
 if(!finite(x,7,90)||!finite(y,18,88))throw Error('invalid-player-position');
 return transformedRect(g,1+percentageLayout(g.innerWidth,x),1+percentageLayout(g.innerHeight,y),
  78,78,1,percentageFloat(78,-50),percentageFloat(78,-85));
}
function spotRect(g,id,near=null,collected=false){
 const p=g.localSpots.find(p=>p.id===id);if(!p)throw Error('invalid-hotspot');
 if(!collected&&id!==near)return rect(g.world.left+p.left,g.world.top+p.top,p.width,p.height);
 // Reduced motion disables transitions; .nearby applies scale(1.08) around
 // the center. The class is derived from controller state, not caller geometry.
 // The more-specific .mk-l1 .l1-hotspot.collected rule wins over .nearby.
 const s=f(collected ? 0.25 : 1.08),cx=p.width/2,cy=p.height/2;
 return transformedRect(g,p.left,p.top,p.width,p.height,s,f(cx+f(-cx*s)),f(cy+f(-cy*s)));
}
function distance(g,x,y,id,near=null,collected=false){
 const a=playerRect(g,x,y),b=spotRect(g,id,near,collected);
 return Math.hypot((a.left+a.width/2)-(b.left+b.width/2),
  (a.top+a.height/2)-(b.top+b.height/2))/Math.max(1,Math.min(g.world.width,g.world.height));
}
function blocked(g,x,y){return g.obstacles.some(r=>x>r.left&&x<r.right&&y>r.top&&y<r.bottom);}
return Object.freeze({ID,BOUNDS,validateOrigin,validateEnvelope,percentageFloat,percentageLayout,layout,playerRect,spotRect,distance,blocked});
});
