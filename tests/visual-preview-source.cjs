/* Source-level presentation guards. Browser layout and screenshots are a separate CI task. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),css=fs.readFileSync(path.join(root,'visual-preview.css'),'utf8'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert(html.indexOf('visual-system.css')<html.indexOf('visual-preview.css'));
assert(html.indexOf('visual-preview.css')<html.indexOf('touch.css'),'shared touch floor remains last');
assert(Buffer.byteLength(css)<17000,'small stylesheet budget');
const gzip=zlib.gzipSync(css).byteLength;assert(gzip<5000,'less than 5 KB compressed visual treatment');
assert(!/@import|@font-face|https?:\/\//.test(css.replace(/data:image\/svg\+xml,[^"\n]*/g,'')),'no new third-party font or image requests');
assert(!/@keyframes|animation\s*:\s*(?!none)/.test(css),'no new repeating animation');
assert(css.includes('prefers-reduced-motion:reduce'));
assert(css.includes('direction:ltr')&&css.includes('[dir=rtl] #home :is(.mk-topbar,.mk-home-bottom) {direction:rtl}'));
assert(css.includes('[dir=rtl] #home .mk-share-btn>span {transform:none}'));
assert(css.includes('padding-block:calc(14px + env(safe-area-inset-top)) 13px'),'rover safe area preserved');
assert(css.includes('max(284px,calc(var(--mk-vh,100dvh)*.46))'),'short portrait cell hit area has 44px floor');
const plain=css.replace(/\/\*[\s\S]*?\*\//g,'');
for(const m of plain.matchAll(/([^{}]*)\{([^{}]*)\}/g))for(const d of m[2].matchAll(/(?:font-size|font)\s*:\s*([^;}]+)/g))for(const x of d[1].matchAll(/(\d+(?:\.\d+)?)px/g))assert(+x[1]===0||+x[1]>=11,'new HTML text >=11px: '+m[1]);
const rgb=h=>h.match(/\w\w/g).map(x=>parseInt(x,16));
const lum=h=>rgb(h).map(x=>x/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
const samples=[['stats label','3d5967','dcebef'],['stats detail','4a6674','dcebef'],['welcome','d0e0e6','0b2232'],['primary','102b3a','e4bb79'],['invite','eff6f7','173c52'],['invite bonus','f4d9a1','173c52'],['explore detail','c6dce5','1c455d'],['nav inactive','b7ceda','0b2638'],['chapter hint','d4e4e9','183343'],['telemetry label','3f606f','dceaf0'],['field hint','254b5d','e6eceb'],['field action','f0f3ec','315e77'],['field footer','36586b','e6eceb'],['EXIT label','fff7e7','196064']];
for(const [name,a,b]of samples)assert(contrast(a,b)>=4.5,name+' declared opaque color pair passes 4.5:1');
const R=require('../field-model.js'),P=require('../story-plan.js'),context={window:{},FieldRules:R};vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(root,'field-art.js'),'utf8'),context);
let rendered=0;
for(let n=1;n<=11;n++)for(let seed=1;seed<=8;seed++){
  const state=R.create(n,seed%4,seed),original=JSON.stringify(state),svg=context.window.FieldArt.scene(state,Math.min(n,9));
  assert.equal(JSON.stringify(state),original,'art rendering never mutates state');
  assert(svg.startsWith('<svg')&&svg.endsWith('</svg>'));
  if(n===1){
    assert.equal((svg.match(/data-field-cell=/g)||[]).length,36);
    assert.equal((svg.match(/lunar-cell/g)||[]).length,36);
    assert.equal((svg.match(/class="field-exit-label"/g)||[]).length,1);
    assert.equal((svg.match(/width="94" height="94"/g)||[]).length,36,'source hit rectangles retain dimensions');
  }else assert(!svg.includes('lunar-cell'),'new cell styling only applies to rover');
  rendered++;
}
for(let n=1;n<=9;n++){const p=P.plan(n,2),svg=context.window.FieldArt.map(n,p.steps,[],i=>i<2);assert.equal((svg.match(/data-map-step=/g)||[]).length,8);}
console.log(JSON.stringify({generatedSVGScenes:rendered,chapterMaps:9,declaredContrastPairs:samples.length,minDeclaredContrast:Math.min(...samples.map(([,a,b])=>contrast(a,b))).toFixed(2),cssBytes:Buffer.byteLength(css),gzipBytes:gzip,disclaimer:'Source checks only; browser geometry, screenshots, physical devices and image-background contrast remain unverified.'},null,2));
