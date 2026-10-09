/* Verify the entire target is visible through every clipping ancestor and accepts hits.
   Deliberately does not scroll: callers must exercise pointer or keyboard navigation first. */
const assert=require('node:assert/strict');
module.exports=async function assertFieldControlReachable(control,label){
 const state=await control.evaluate(e=>{
  const r=e.getBoundingClientRect(),rect=x=>({left:x.left,top:x.top,right:x.right,bottom:x.bottom,width:x.width,height:x.height});
  let clip={left:0,top:0,right:innerWidth,bottom:innerHeight};const ancestors=[];
  for(let a=e.parentElement;a;a=a.parentElement){const css=getComputedStyle(a),box=a.getBoundingClientRect(),x=/auto|scroll|hidden|clip/.test(css.overflowX),y=/auto|scroll|hidden|clip/.test(css.overflowY);if(!x&&!y)continue;
   const area={left:box.left+a.clientLeft,top:box.top+a.clientTop,right:box.left+a.clientLeft+a.clientWidth,bottom:box.top+a.clientTop+a.clientHeight};
   if(x){clip.left=Math.max(clip.left,area.left);clip.right=Math.min(clip.right,area.right);}if(y){clip.top=Math.max(clip.top,area.top);clip.bottom=Math.min(clip.bottom,area.bottom);}
   ancestors.push({id:a.id,className:a.className,overflow:css.overflow,scrollTop:a.scrollTop,scrollHeight:a.scrollHeight,clientHeight:a.clientHeight,area});
  }
  const points=[[r.left+r.width/2,r.top+2],[r.left+2,r.top+r.height/2],[r.left+r.width/2,r.top+r.height/2],[r.right-2,r.top+r.height/2],[r.left+r.width/2,r.bottom-2]],hits=points.map(([x,y])=>{const hit=document.elementFromPoint(x,y);return {x,y,ok:hit===e||e.contains(hit),hit:hit?.id||hit?.tagName||null};});
  return {rect:rect(r),clip,ancestors,hits,focused:document.activeElement===e,active:document.activeElement?.id||document.activeElement?.tagName,dialog:document.querySelector('dialog[open]')?.id||null};
 });
 const {rect:r,clip:c}=state,detail=label+' '+JSON.stringify(state);
 assert(r.width>=44&&r.height>=44,'44px target: '+detail);
 assert(r.left>=c.left-.5&&r.right<=c.right+.5&&r.top>=c.top-.5&&r.bottom<=c.bottom+.5,'full target must be inside its visible scroll panel: '+detail);
 assert(state.hits.every(x=>x.ok),'target must not be covered by a footer or another layer: '+detail);
 return state;
};
