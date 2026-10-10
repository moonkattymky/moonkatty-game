/* Presentation only: positions and actions remain in the unchanged controller/FieldRules. */
window.MKTYLunarArt=(()=>{
 let previous=null;
 function render(s){
  const key=`${s.seed}:${s.stage}:${s.attempt||0}`,walking=previous?.key===key&&previous.pos!==s.pos;
  const dx=walking?s.pos%6-previous.pos%6:0,facing=dx?Math.sign(dx):previous?.key===key?previous.facing:1;
  previous={key,pos:s.pos,facing};
  return FieldArt.lunarWorksite(s,FieldRules.layout(s),{facing,walking}).replace('class="field-svg lunar-worksite"','class="field-svg lunar-worksite lunar-expedition"');
 }
 return {render};
})();
