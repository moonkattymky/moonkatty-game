import * as T from './vendor/three-r170.module.min.js';

// MOONKATTY: fully dimensional, articulated hero. No image planes or billboards.
// Textures below are deterministic material maps, painted in mesh UV space.
const TAU = Math.PI * 2;
const clamp = (x,a=0,b=1) => Math.max(a, Math.min(b,x));
const smooth = (a,b,x) => { const t=clamp((x-a)/(b-a)); return t*t*(3-2*t); };
function random(seed=409){let s=seed;return()=>((s=Math.imul(1664525,s)+1013904223|0)>>>0)/4294967296;}
function canvas(w,h,paint){const c=document.createElement('canvas');c.width=w;c.height=h;paint(c.getContext('2d'),w,h);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=8;return t;}
function furMap(){return canvas(1024,512,(ctx,w,h)=>{
  const img=ctx.createImageData(w,h),d=img.data,rnd=random(3021);
  for(let j=0;j<h;j++)for(let i=0;i<w;i++){
    const phi=i/w*TAU,theta=j/h*Math.PI,x=-Math.cos(phi)*Math.sin(theta),y=Math.cos(theta),z=Math.sin(phi)*Math.sin(theta),ax=Math.abs(x);
    let stripe=0;
    // Fine, irregular tabby markings flow from crown to cheeks.
    if(z>.04){
      const crown=smooth(.12,.36,y),q=ax+.008*Math.sin(y*47)+.009*Math.sin(y*71+x*7);
      stripe=Math.max(stripe,(1-smooth(.028,.065,q))*crown);
      stripe=Math.max(stripe,(1-smooth(.022,.073,Math.abs(q-(.18+.10*(1-y)))))*smooth(.23,.42,y));
      stripe=Math.max(stripe,(1-smooth(.027,.080,Math.abs(q-(.43-.10*y))))*smooth(.4,.62,y));
      const mY=.24+ax*.78;
      stripe=Math.max(stripe,(1-smooth(.025,.060,Math.abs(y-mY)))*smooth(.1,.17,ax)*(1-smooth(.4,.49,ax))*smooth(.02,.25,z));
      for(let k=0;k<3;k++){
        const cheekY=.18-k*.20-.42*(ax-.50);
        stripe=Math.max(stripe,(1-smooth(.028,.065,Math.abs(y-cheekY)))*smooth(.46,.65,ax));
      }
    }
    const rear=1-smooth(-.1,.35,z);
    stripe=Math.max(stripe,rear*(1-smooth(.30,.55,Math.abs(Math.sin(phi*5+theta*2.7+Math.sin(theta*6)*.22)))));
    const warm=clamp(z*.5+.45),grain=(rnd()-.5)*17+Math.sin(i*2.2+j*1.6)*3;
    let c=[139+warm*42,91+warm*39,54+warm*31];
    const lightFace=smooth(.20,.65,z)*(1-smooth(.25,.70,ax))*(1-smooth(.0,.3,Math.abs(y+.02)));
    c=c.map((v,k)=>v+lightFace*[36,33,27][k]);
    c=c.map((v,k)=>v*(1-stripe*.88)+[44,28,20][k]*stripe*.88);
    const whiteMask=smooth(.25,.55,z)*(1-smooth(-.44+ax*.22,-.24+ax*.15,y));
    const blaze=smooth(.58,.78,z)*(1-smooth(.045,.12,ax))*(1-smooth(.0,.28,y));
    const white=Math.max(whiteMask,blaze*.84);
    c=c.map((v,k)=>v*(1-white)+[247,233,206][k]*white);
    const index=(j*w+i)*4;d[index]=c[0]+grain;d[index+1]=c[1]+grain;d[index+2]=c[2]+grain;d[index+3]=255;
  }
  ctx.putImageData(img,0,0);
  // Individual guard hairs make the close view tactile rather than flat paint.
  for(let i=0;i<38000;i++){const x=rnd()*w,y=rnd()*h;ctx.strokeStyle=rnd()>.48?'rgba(255,236,197,.12)':'rgba(33,20,10,.13)';ctx.lineWidth=.5+rnd()*.6;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+(x<w/2?1:-1)*(.2+rnd()),y+1+rnd()*4.5);ctx.stroke();}
});}
function fiberMap(){return canvas(128,128,(c,w,h)=>{c.fillStyle='#b8b8b8';c.fillRect(0,0,w,h);const r=random(417);for(let i=0;i<5000;i++){const v=80+r()*95;c.strokeStyle=`rgb(${v},${v},${v})`;c.lineWidth=.6;c.beginPath();const x=r()*w,y=r()*h;c.moveTo(x,y);c.lineTo(x+.1,y+1+r()*5);c.stroke();}});}
function irisMap(){return canvas(256,256,(c,w,h)=>{const g=c.createRadialGradient(128,128,14,128,128,124);g.addColorStop(0,'#ffcb64');g.addColorStop(.45,'#d99b2b');g.addColorStop(.8,'#bd6810');g.addColorStop(1,'#42210b');c.fillStyle=g;c.fillRect(0,0,w,h);const r=random(929);for(let i=0;i<540;i++){const a=r()*TAU,inner=26+r()*20,outer=90+r()*35;c.strokeStyle=r()>.5?'rgba(255,232,134,.47)':'rgba(65,34,7,.47)';c.lineWidth=.5+r()*1.6;c.beginPath();c.moveTo(128+Math.cos(a)*inner,128+Math.sin(a)*inner);c.lineTo(128+Math.cos(a+.015)*outer,128+Math.sin(a+.015)*outer);c.stroke();}});}
function insigniaMap(){return canvas(512,512,(c,w,h)=>{c.clearRect(0,0,w,h);c.fillStyle='#f2f2e9';c.fillRect(0,0,w,h);c.strokeStyle='#b58124';c.lineWidth=20;c.lineJoin='miter';c.beginPath();c.moveTo(140,295);c.lineTo(140,145);c.lineTo(256,251);c.lineTo(370,145);c.lineTo(370,295);c.stroke();c.lineWidth=13;c.beginPath();c.moveTo(173,207);c.lineTo(256,291);c.lineTo(340,207);c.stroke();c.fillStyle='#253947';c.font='600 35px Arial,sans-serif';c.textAlign='center';c.fillText('MOONKATTY',256,372);c.font='22px Arial,sans-serif';c.letterSpacing='5px';c.fillText('LUNAR EXPLORER',256,416);});}
function patchMap(){return canvas(256,256,(c,w,h)=>{c.fillStyle='#172634';c.fillRect(0,0,w,h);c.strokeStyle='#e9ba57';c.lineWidth=8;c.strokeRect(8,8,240,240);c.fillStyle='#e4ded2';c.beginPath();c.arc(128,85,48,0,TAU);c.fill();c.fillStyle='#a9adad';for(const [x,y,r]of[[112,69,10],[137,92,15],[111,99,6],[146,62,6]]){c.beginPath();c.arc(x,y,r,0,TAU);c.fill();}c.fillStyle='#f8f3df';c.textAlign='center';c.font='bold 23px Arial';c.fillText('EXPLORE',128,164);c.font='17px Arial';c.fillText('PLAY • EARN',128,191);c.fillText('TOGETHER',128,218);});}

export function createHero(){
  const root=new T.Group();root.name='MOONKATTY • dimensional lunar explorer';
  const body=new T.Group();root.add(body);
  const fabric=fiberMap();fabric.wrapS=fabric.wrapT=T.RepeatWrapping;fabric.repeat.set(5,5);fabric.colorSpace=T.NoColorSpace;
  const furTexture=furMap();
  const mat={
    suit:new T.MeshStandardMaterial({color:'#e9ede9',roughness:.66,metalness:.09,bumpMap:fabric,bumpScale:.012}),
    armor:new T.MeshStandardMaterial({color:'#faf9e9',roughness:.27,metalness:.24}),
    shade:new T.MeshStandardMaterial({color:'#98a8ad',roughness:.55,metalness:.3}),
    gold:new T.MeshStandardMaterial({color:'#e7a82b',roughness:.22,metalness:.82}),
    goldDark:new T.MeshStandardMaterial({color:'#906323',roughness:.36,metalness:.72}),
    dark:new T.MeshStandardMaterial({color:'#12212c',roughness:.54,metalness:.28}),
    rubber:new T.MeshStandardMaterial({color:'#15212a',roughness:.84,bumpMap:fabric,bumpScale:.013}),
    seam:new T.MeshStandardMaterial({color:'#8d9b9d',roughness:.78}),
    fur:new T.MeshStandardMaterial({map:furTexture,roughness:.93,bumpMap:furTexture,bumpScale:.009}),
    cream:new T.MeshStandardMaterial({color:'#f1dec0',roughness:.94,bumpMap:fabric,bumpScale:.009}),
    whiteFur:new T.MeshStandardMaterial({color:'#fff6de',roughness:.98,bumpMap:fabric,bumpScale:.008}),
    brown:new T.MeshStandardMaterial({color:'#8f5b35',roughness:.95,bumpMap:fabric,bumpScale:.012}),
    stripe:new T.MeshStandardMaterial({color:'#40291f',roughness:.95}),
    innerEar:new T.MeshStandardMaterial({color:'#be786b',roughness:.85,bumpMap:fabric,bumpScale:.01}),
    nose:new T.MeshPhysicalMaterial({color:'#c87779',roughness:.39,clearcoat:.35}),
    mouth:new T.MeshStandardMaterial({color:'#452323',roughness:.8}),
    tongue:new T.MeshStandardMaterial({color:'#e99195',roughness:.4}),
    black:new T.MeshPhysicalMaterial({color:'#070e14',roughness:.15,clearcoat:1,clearcoatRoughness:.06}),
    glow:new T.MeshStandardMaterial({color:'#ffe5a0',emissive:'#ffc257',emissiveIntensity:3.4,roughness:.2}),
    cyan:new T.MeshStandardMaterial({color:'#99f8ff',emissive:'#57cce7',emissiveIntensity:1.4}),
  };
  const sphere=new T.SphereGeometry(1,28,18),smallSphere=new T.SphereGeometry(1,12,8);
  function mesh(geo,m,g,x=0,y=0,z=0,sx=1,sy=sx,sz=sx){const o=new T.Mesh(geo,m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=!m.transparent;o.receiveShadow=!m.transparent;g.add(o);return o;}
  const ell=(g,m,x,y,z,a,b=a,c=a)=>mesh(sphere,m,g,x,y,z,a,b,c);
  const bead=(g,m,x,y,z,a,b=a,c=a)=>mesh(smallSphere,m,g,x,y,z,a,b,c);
  function roundedGeometry(w,h,d,r=.06){r=Math.min(r,w/2-.001,h/2-.001);const s=new T.Shape(),x=-w/2,y=-h/2;s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);const b=Math.min(r*.4,d*.25);const geo=new T.ExtrudeGeometry(s,{depth:d-b*2,bevelEnabled:true,bevelThickness:b,bevelSize:b,bevelSegments:2,curveSegments:5,steps:1});geo.translate(0,0,-(d-b*2)/2);geo.computeVertexNormals();const uv=geo.attributes.uv,pp=geo.attributes.position;for(let i=0;i<uv.count;i++)uv.setXY(i,pp.getX(i)/w+.5,pp.getY(i)/h+.5);return geo;}
  const plate=(g,m,x,y,z,w,h,d,r=.06)=>mesh(roundedGeometry(w,h,d,r),m,g,x,y,z);
  function ring(g,m,x,y,z,r,t=.04,sx=1,sy=1){return mesh(new T.TorusGeometry(r,t,8,48),m,g,x,y,z,sx,sy,1);}
  function cylinder(g,m,x,y,z,r,h,rt=r){return mesh(new T.CylinderGeometry(rt,r,h,24,1),m,g,x,y,z);}
  function tube(g,m,pts,r=.012,segments=30,sides=8){return mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(p=>new T.Vector3(...p))),segments,r,sides,false),m,g);}
  function rod(g,m,a,b,r=.02){const start=new T.Vector3(...a),end=new T.Vector3(...b),o=cylinder(g,m,...start.clone().add(end).multiplyScalar(.5).toArray(),r,start.distanceTo(end));o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),end.sub(start).normalize());return o;}
  function fastener(g,x,y,z,r=.026,m=mat.gold){const o=cylinder(g,m,x,y,z,r,.018);o.rotation.x=Math.PI/2;plate(g,mat.dark,x,y,z+.014,r*.88,.006,.003,.002);return o;}
  function emblem(g,x,y,z,size=.49){const m=new T.MeshStandardMaterial({map:insigniaMap(),roughness:.38,metalness:.16});return plate(g,m,x,y,z,size,size,.019,.035);}
  function beltRing(g,y,rx,rz,m=mat.gold,t=.028){const o=ring(g,m,0,y,0,1,t);o.rotation.x=Math.PI/2;o.scale.set(rx,rz,1);return o;}

  // The torso is a tailored pressure garment with independent rigid chest plate.
  ell(body,mat.suit,0,1.57,0,.53,.67,.35);
  ell(body,mat.dark,0,1.97,-.01,.43,.23,.34);
  ell(body,mat.suit,0,1.22,.015,.48,.34,.35);
  for(const side of [-1,1]){
    tube(body,mat.seam,[[side*.12,1.10,.339],[side*.38,1.28,.333],[side*.48,1.61,.25],[side*.42,1.97,.19]],.012);
    tube(body,mat.armor,[[side*.19,1.05,.349],[side*.40,1.20,.329],[side*.48,1.42,.22]],.020);
    // Shoulder harness: full-volume textile webbing and bevelled buckles.
    const strap=plate(body,mat.dark,side*.335,1.81,.33,.10,.58,.055,.025);strap.rotation.z=side*-.12;
    plate(body,mat.gold,side*.322,1.70,.385,.145,.16,.047,.025);
    plate(body,mat.dark,side*.322,1.70,.416,.079,.087,.016,.012);
    plate(body,mat.gold,side*.34,1.99,.323,.12,.08,.055,.02);
    fastener(body,side*.30,2.028,.363,.019);
  }
  const breast=plate(body,mat.gold,0,1.68,.386,.62,.65,.125,.12);breast.rotation.x=.045;
  plate(body,mat.armor,0,1.69,.461,.558,.579,.075,.10);
  emblem(body,0,1.714,.504,.46);
  for(const s of [-1,1])for(const y of [1.435,1.91])fastener(body,s*.23,y,.514,.022);
  plate(body,mat.dark,0,1.34,.403,.30,.075,.043,.018);
  plate(body,mat.glow,0,1.343,.429,.20,.028,.012,.01);
  // Belt with padded rim, center emblem and mechanically readable hardware.
  beltRing(body,1.145,.493,.359,mat.dark,.058);
  beltRing(body,1.196,.49,.353,mat.armor,.024);
  beltRing(body,1.096,.49,.353,mat.armor,.024);
  plate(body,mat.gold,0,1.151,.378,.275,.204,.095,.03);
  plate(body,mat.dark,0,1.152,.433,.215,.149,.028,.025);
  const mm=new T.Group();body.add(mm);tube(mm,mat.gold,[[-.071,1.103,.45],[-.071,1.19,.45],[0,1.127,.45],[.071,1.19,.45],[.071,1.103,.45]],.009,12,6);
  for(const side of [-1,1]){
    const clasp=plate(body,mat.gold,side*.36,1.15,.268,.13,.19,.072,.026);clasp.rotation.y=side*.7;
    const center=plate(body,mat.dark,side*.378,1.15,.298,.064,.12,.02,.01);center.rotation.y=side*.7;
    const pocket=plate(body,mat.armor,side*.49,1.31,-.01,.13,.27,.24,.03);pocket.rotation.z=side*.09;
    plate(body,mat.gold,side*.508,1.322,.112,.125,.08,.022,.02);
  }

  // Boots and pressure trousers, modelled from sole through knee and hip.
  const legs=[],arms=[];
  for(const side of [-1,1]){
    const leg=new T.Group();leg.position.set(side*.268,1.035,0);body.add(leg);legs.push(leg);
    ell(leg,mat.suit,0,-.235,0,.242,.36,.249);
    for(let i=0;i<4;i++){const fold=ring(leg,i%2?mat.suit:mat.armor,0,-.085-i*.075,.01,.215,.012,1,.90);fold.rotation.x=Math.PI/2;}
    tube(leg,mat.seam,[[side*.185,-.05,.13],[side*.208,-.24,.14],[side*.173,-.48,.16]],.010);
    ell(leg,mat.dark,0,-.476,.017,.224,.16,.225);
    plate(leg,mat.gold,0,-.433,.210,.338,.241,.096,.07);
    plate(leg,mat.armor,0,-.420,.269,.275,.179,.031,.055);
    plate(leg,mat.gold,0,-.417,.288,.217,.113,.016,.042);
    fastener(leg,-.139,-.437,.27,.015);fastener(leg,.139,-.437,.27,.015);
    ell(leg,mat.suit,0,-.637,.038,.218,.205,.219);
    for(const y of [-.572,-.65,-.706]){const r=ring(leg,y===-.65?mat.gold:mat.armor,0,y,.05,.21,y===-.65?.035:.018,1,.98);r.rotation.x=Math.PI/2;}
    // Rounded boot envelope, articulated ankle and separately layered tread.
    ell(leg,mat.armor,0,-.826,.145,.25,.183,.365);
    plate(leg,mat.dark,0,-.977,.151,.494,.067,.653,.068);
    plate(leg,mat.goldDark,0,-.93,.151,.485,.047,.644,.065);
    plate(leg,mat.armor,0,-.892,.189,.48,.060,.660,.065);
    plate(leg,mat.gold,0,-.815,.451,.35,.072,.052,.018);
    plate(leg,mat.dark,0,-.765,.378,.30,.073,.047,.016).rotation.x=-.45;
    plate(leg,mat.glow,0,-.750,.394,.125,.021,.009,.006).rotation.x=-.45;
    for(let i=0;i<7;i++)plate(leg,mat.rubber,0,-1.008,-.101+i*.09,.464,.034,.049,.012);
    for(const s of [-1,1])plate(leg,mat.rubber,s*.246,-.95,.128,.025,.067,.34,.01);
  }
  // Sleeves keep real volume on the reverse view; elbows and cuffs articulate.
  for(const side of [-1,1]){
    const arm=new T.Group();arm.position.set(side*.505,1.91,0);arm.rotation.z=side*.17;body.add(arm);arms.push(arm);
    ell(arm,mat.dark,side*.01,-.02,0,.224,.232,.239);
    ell(arm,mat.armor,side*.048,-.052,.019,.241,.233,.25);
    const shoulderRing=ring(arm,mat.gold,side*.048,-.052,.019,.242,.021);shoulderRing.rotation.y=Math.PI/2;
    ell(arm,mat.suit,side*.066,-.306,.022,.193,.328,.197);
    for(let j=0;j<4;j++){const f=ring(arm,mat.armor,side*.074,-.23-j*.070,.027,.187,.012,1,.98);f.rotation.x=Math.PI/2;}
    tube(arm,mat.seam,[[side*.085,-.135,.19],[side*.095,-.39,.20],[side*.06,-.51,.17]],.008);
    // Moon mission shoulder patch is a curved physical plaque, not a plane.
    const patch=plate(arm,mat.gold,side*.157,-.178,.165,.203,.286,.030,.06);patch.rotation.y=side*.47;
    const pm=new T.MeshStandardMaterial({map:patchMap(),roughness:.69,metalness:.06});const p=plate(arm,pm,side*.166,-.176,.184,.181,.255,.02,.05);p.rotation.y=side*.47;
    ell(arm,mat.dark,side*.087,-.489,.015,.177,.151,.175);
    for(let j=0;j<4;j++){const f=ring(arm,mat.rubber,side*.087,-.455-j*.027,.014,.17,.013);f.rotation.x=Math.PI/2;}
    ell(arm,mat.suit,side*.085,-.630,.04,.187,.198,.191);
    for(const y of [-.589,-.666]){const cuff=ring(arm,mat.gold,side*.085,y,.04,.191,.037);cuff.rotation.x=Math.PI/2;}
    const cuff=ring(arm,mat.dark,side*.085,-.710,.04,.178,.022);cuff.rotation.x=Math.PI/2;
    plate(arm,mat.armor,side*.085,-.632,.223,.174,.106,.053,.022);
    plate(arm,mat.cyan,side*.085,-.631,.256,.113,.043,.015,.008);
    // Gloves: separated knuckles, curved finger pads, thumbs and fine seams.
    ell(arm,mat.armor,side*.071,-.806,.059,.175,.171,.179);
    ell(arm,mat.rubber,side*.058,-.836,.194,.133,.107,.047);
    for(let i=0;i<3;i++){
      const xx=side*.071+(i-1)*.084;
      ell(arm,mat.armor,xx,-.872,.094,.048,.103,.092);
      tube(arm,mat.seam,[[xx,-.810,.193],[xx,-.875,.187],[xx,-.924,.13]],.005,10,5);
    }
    ell(arm,mat.armor,side*-.085,-.789,.112,.082,.126,.087).rotation.z=side*-.50;
  }

  // Life-support pack. Heat exchanger, twin canisters, valves and foil hardware.
  const pack=new T.Group();pack.position.set(0,1.62,-.375);body.add(pack);
  plate(pack,mat.dark,0,0,-.06,.85,.95,.22,.13);
  plate(pack,mat.gold,0,.03,-.192,.88,.88,.27,.10);
  plate(pack,mat.armor,0,.064,-.335,.756,.73,.082,.08);
  emblem(pack,0,.112,-.385,.49).rotation.y=Math.PI;
  for(const side of [-1,1]){
    plate(pack,mat.dark,side*.277,-.272,-.386,.13,.125,.025,.015);
    plate(pack,mat.gold,side*.288,.347,-.376,.101,.101,.045,.02);
    for(const yy of [-.258,.348])fastener(pack,side*.299,yy,-.418,.024);
    const tank=cylinder(pack,mat.gold,side*.475,.01,-.14,.115,.52);ell(pack,mat.armor,side*.475,.29,-.14,.115,.10,.115);ell(pack,mat.armor,side*.475,-.27,-.14,.115,.10,.115);
    for(const yy of [-.17,.19]){const tr=ring(pack,mat.dark,side*.475,yy,-.14,.116,.021);tr.rotation.x=Math.PI/2;}
    plate(pack,mat.armor,side*.474,.016,-.267,.12,.29,.03,.025);
    plate(pack,mat.glow,side*.474,.014,-.289,.040,.18,.014,.01);
    tube(pack,mat.goldDark,[[side*.43,.3,-.06],[side*.56,.43,.02],[side*.37,.55,.17]],.036,18,8);
    plate(pack,mat.dark,side*.12,-.423,-.26,.11,.12,.12,.025);
    cylinder(pack,mat.goldDark,side*.12,-.50,-.26,.069,.07);
  }
  plate(pack,mat.dark,0,-.272,-.39,.30,.119,.036,.02);
  for(let i=0;i<6;i++)plate(pack,mat.shade,-.119+i*.048,-.274,-.416,.013,.082,.01,.003);
  plate(pack,mat.glow,0,-.154,-.395,.246,.028,.022,.012);
  rod(pack,mat.dark,[.32,.37,.03],[.36,.98,.03],.019);rod(pack,mat.gold,[.36,.78,.03],[.38,1.15,.03],.015);bead(pack,mat.glow,.38,1.15,.03,.027);
  tube(body,mat.goldDark,[[-.42,1.33,-.46],[-.62,1.13,-.38],[-.58,1.03,-.02],[-.42,1.18,.16]],.042,30,10);
  for(let i=0;i<11;i++){const a=i/10*Math.PI*.9;const rr=ring(body,mat.gold,-.53-.072*Math.sin(a),1.25-.15*Math.sin(a),-.37+i*.046,.056,.010);rr.rotation.y=Math.PI/2;}

  // Broad seal at the neck anchors the airy helmet bubble to the pressure suit.
  const collar=cylinder(body,mat.dark,0,2.107,0,.40,.134);const cr=ring(body,mat.gold,0,2.166,0,.40,.036);cr.rotation.x=Math.PI/2;
  const cr2=ring(body,mat.armor,0,2.069,0,.398,.029);cr2.rotation.x=Math.PI/2;

  const head=new T.Group();head.position.set(0,2.85,.028);body.add(head);
  // Sculpt the cranial envelope: broad temples, heart-shaped chin and plush cheeks.
  const headGeo=new T.SphereGeometry(1,80,52),pos=headGeo.attributes.position;
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);const cheek=Math.exp(-(((y+.20)/.32)**2))*smooth(.1,.7,z);
    let px=x*.633*(1+.12*cheek-.055*smooth(.43,.95,y));
    let py=y*.603;let pz=z*.526+cheek*.034;
    if(y<-.4)px*=1-.14*smooth(.4,1,-y);
    pos.setXYZ(i,px,py,pz);
  }headGeo.computeVertexNormals();mesh(headGeo,mat.fur,head);
  // Real, smoothly bevelled ear shells. The pink inset sits inside a raised fur rim.
  for(const side of [-1,1]){
    const ear=new T.Group();ear.position.set(side*.452,.414,-.049);ear.rotation.z=side*-.22;head.add(ear);
    const s=new T.Shape();s.moveTo(-.20,-.09);s.quadraticCurveTo(-.22,.15,-.10,.45);s.quadraticCurveTo(-.035,.52,.01,.49);s.quadraticCurveTo(.20,.32,.225,-.045);s.quadraticCurveTo(.0,-.15,-.20,-.09);
    const eg=new T.ExtrudeGeometry(s,{depth:.155,bevelEnabled:true,bevelSegments:5,bevelSize:.027,bevelThickness:.046,curveSegments:18});eg.translate(0,0,-.075);mesh(eg,mat.brown,ear);
    const inner=new T.Shape();inner.moveTo(-.135,-.021);inner.quadraticCurveTo(-.145,.16,-.072,.369);inner.quadraticCurveTo(-.039,.41,-.007,.357);inner.quadraticCurveTo(.11,.21,.145,-.026);inner.quadraticCurveTo(.0,-.092,-.135,-.021);
    const ig=new T.ExtrudeGeometry(inner,{depth:.013,bevelEnabled:true,bevelSegments:3,bevelSize:.016,bevelThickness:.015,curveSegments:16});mesh(ig,mat.innerEar,ear,0,0,.115);
    tube(ear,mat.cream,[[-.159,-.009,.148],[-.161,.13,.135],[-.094,.38,.114]],.010,22,6);
    tube(ear,mat.stripe,[[.116,-.055,.143],[.159,.08,.133],[.097,.26,.126]],.019,24,6);
    for(let j=0;j<8;j++){const yy=j*.028-.015;const xx=-.1+j*.008;tube(ear,mat.whiteFur,[[xx,yy,.146],[xx+.082,yy+.069,.154],[xx+.111,yy+.104,.139]],.003,6,4);}
  }
  // Soft cheek volumes blend into the cranium, with little sculpted fur points.
  for(const side of [-1,1]){
    ell(head,mat.cream,side*.382,-.243,.376,.233,.203,.15).rotation.z=side*-.26;
    for(let k=0;k<3;k++){
      const shape=new T.Shape();shape.moveTo(0,0);shape.quadraticCurveTo(side*.12,.035,side*.185,.018);shape.quadraticCurveTo(side*.10,-.042,0,-.085);shape.closePath();const geo=new T.ExtrudeGeometry(shape,{depth:.04,bevelEnabled:true,bevelThickness:.025,bevelSize:.020,bevelSegments:2,curveSegments:8});mesh(geo,mat.cream,head,side*.39,-.205-k*.076,.274-k*.014);
    }
  }
  ell(head,mat.whiteFur,0,-.364,.36,.334,.181,.194);
  // Warm eye sockets and separate glossy globes; iris detail remains actual UVs.
  const irisTex=irisMap(),irisMat=new T.MeshStandardMaterial({map:irisTex,roughness:.33,metalness:.06});
  const eyeGroups=[];
  for(const side of [-1,1]){
    const eyes=new T.Group();eyes.position.set(side*.261,.061,.474);eyes.rotation.y=side*.095;eyes.rotation.z=side*-.075;head.add(eyes);eyeGroups.push(eyes);
    ell(eyes,mat.cream,0,0,-.018,.237,.245,.066);
    ell(eyes,mat.dark,0,-.003,.014,.202,.209,.072);
    ell(eyes,mat.black,0,0,.043,.176,.185,.065);
    // The circle surface has radial UVs, keeping iris streaks centered.
    const iris=mesh(new T.CircleGeometry(.148,64),irisMat,eyes,0,.006,.104);iris.scale.y=1.06;
    ell(eyes,mat.black,-side*.006,.006,.111,.086,.129,.026);
    const cornea=new T.MeshPhysicalMaterial({color:'#fff8df',transparent:true,opacity:.08,roughness:.015,metalness:.1,clearcoat:1,depthWrite:false});ell(eyes,cornea,0,.003,.098,.169,.180,.045);
    // Deliberate catchlights, including a tiny secondary sparkle.
    const shine=new T.MeshBasicMaterial({color:'#ffffff'});bead(eyes,shine,-.052,.076,.140,.038,.047,.013);bead(eyes,shine,.066,-.048,.135,.017,.02,.010);
    tube(eyes,mat.stripe,[[-.177,.074,.052],[-.12,.174,.057],[.035,.194,.045],[.164,.094,.046]],.021,24,7);
    tube(eyes,mat.cream,[[-.15,-.122,.052],[0,-.179,.054],[.15,-.113,.052]],.013,20,6);
    // Eye-to-cheek tabby eyeliner is dimensional, but restrained.
    tube(head,mat.stripe,[[side*.399,-.075,.453],[side*.485,-.061,.397],[side*.555,-.031,.30]],.018,20,6);
  }
  // Mouth first, then the plush two-lobed white muzzle and heart-shaped nose.
  ell(head,mat.mouth,0,-.300,.539,.137,.143,.057);
  ell(head,mat.tongue,0,-.354,.587,.084,.059,.024);
  tube(head,mat.nose,[[0,-.323,.615],[0,-.363,.614]],.005,8,5);
  for(const side of [-1,1]){
    ell(head,mat.whiteFur,side*.126,-.216,.558,.183,.113,.103).rotation.z=side*.08;
    ell(head,mat.cream,side*.129,-.275,.535,.161,.079,.09);
    // Whisker roots and fine tapered curved whiskers are real geometry.
    for(let j=0;j<4;j++)bead(head,mat.stripe,side*(.119+(j%2)*.053),-.194-Math.floor(j/2)*.042,.654-j*.003,.009,.007,.006);
    for(let j=0;j<4;j++)tube(head,mat.whiteFur,[[side*.16,-.224+j*.021,.655],[side*.35,-.241+j*.054,.622],[side*(.61+j*.031),-.29+j*.086,.491]],.0036-j*.00025,22,5);
  }
  const ns=new T.Shape();ns.moveTo(-.081,0);ns.quadraticCurveTo(-.077,.045,-.025,.025);ns.quadraticCurveTo(0,.010,.025,.025);ns.quadraticCurveTo(.079,.045,.081,0);ns.quadraticCurveTo(.059,-.052,0,-.068);ns.quadraticCurveTo(-.055,-.050,-.081,0);
  const ng=new T.ExtrudeGeometry(ns,{depth:.037,bevelEnabled:true,bevelSegments:4,bevelSize:.009,bevelThickness:.011,curveSegments:16});mesh(ng,mat.nose,head,0,-.143,.647);
  tube(head,mat.mouth,[[0,-.204,.687],[0,-.254,.674],[-.035,-.272,.646]],.009,16,6);tube(head,mat.mouth,[[0,-.254,.674],[.035,-.272,.646]],.009,12,6);
  bead(head,mat.whiteFur,-.021,-.133,.695,.022,.008,.003);

  // Helmet shell wraps the rear; a clear convex front preserves the expression.
  const helmet=new T.Group();helmet.position.copy(head.position);body.add(helmet);
  const shellGeo=new T.SphereGeometry(.783,64,40,Math.PI,Math.PI,0,Math.PI*.87);
  const shell=mesh(shellGeo,mat.armor,helmet,0,.014,-.023,1,1.045,.90);
  // Visor rim: dark gasket, warm machined outer ring, ivory inset, tiny rivets.
  ring(helmet,mat.dark,0,0,.203,.723,.073,1,1.045);
  ring(helmet,mat.gold,0,0,.233,.744,.031,1,1.045);
  ring(helmet,mat.armor,0,0,.212,.783,.020,1,1.045);
  ring(helmet,mat.goldDark,0,0,.268,.694,.011,1,1.045);
  for(let i=0;i<16;i++){const a=i/16*TAU;bead(helmet,i%4===0?mat.glow:mat.gold,Math.cos(a)*.745,Math.sin(a)*.778,.263,.018,.018,.009);}
  // Upper brow segmented white plate with inset ID panel.
  const brow=plate(helmet,mat.armor,0,.731,.202,.50,.166,.19,.04);brow.rotation.x=-.22;
  const browLogo=emblem(helmet,0,.746,.318,.123);browLogo.scale.y=.88;
  for(const side of [-1,1]){
    const light=plate(helmet,mat.gold,side*.435,.616,.246,.204,.071,.038,.03);light.rotation.z=side*-.42;
    const li=plate(helmet,mat.glow,side*.435,.616,.269,.137,.028,.014,.013);li.rotation.z=side*-.42;
    const hinge=cylinder(helmet,mat.dark,side*.756,.009,-.011,.204,.176);hinge.rotation.z=Math.PI/2;
    const hp=cylinder(helmet,mat.gold,side*.853,.009,-.011,.187,.056);hp.rotation.z=Math.PI/2;
    const cap=cylinder(helmet,mat.armor,side*.887,.009,-.011,.151,.035);cap.rotation.z=Math.PI/2;
    const hr=ring(helmet,mat.gold,side*.909,.009,-.011,.130,.020);hr.rotation.y=Math.PI/2;
    const luminous=cylinder(helmet,mat.glow,side*.913,.009,-.011,.10,.016);luminous.rotation.z=Math.PI/2;
    const block=plate(helmet,mat.gold,side*.683,-.366,-.057,.136,.18,.23,.03);block.rotation.z=side*-.31;
    for(let i=0;i<4;i++){const rr=ring(helmet,mat.goldDark,side*.848,.009,-.011,.184+i*.009,.004);rr.rotation.y=Math.PI/2;}
  }
  plate(helmet,mat.gold,0,-.727,.213,.175,.094,.063,.025);
  plate(helmet,mat.dark,0,-.727,.254,.086,.035,.015,.008);
  // Bubble is a front spherical cap. Low-opacity physical glass has no dark face tint.
  const glassMat=new T.MeshPhysicalMaterial({color:'#b4e6f4',transparent:true,opacity:.075,roughness:.035,metalness:.14,clearcoat:1,clearcoatRoughness:.025,depthWrite:false,side:T.FrontSide});
  const glass=mesh(new T.SphereGeometry(.848,72,44,0,Math.PI,0,Math.PI),glassMat,helmet,0,0,.035,1,1.045,1);glass.renderOrder=4;glass.castShadow=false;
  // Geometric curved reflection strokes, deliberately away from eyes and muzzle.
  const glintMat=new T.MeshBasicMaterial({color:'#e8faff',transparent:true,opacity:.40,depthWrite:false});
  const glint=mesh(new T.SphereGeometry(.852,24,14,.32,.062,.58,.67),glintMat,helmet,0,0,.035,1,1.045,1);glint.renderOrder=5;
  const glint2=mesh(new T.SphereGeometry(.851,16,10,2.68,.027,.74,.47),new T.MeshBasicMaterial({color:'#d5efff',transparent:true,opacity:.22,depthWrite:false}),helmet,0,0,.035,1,1.045,1);glint2.renderOrder=5;

  // Plush, tapered, curled tail with alternating rings painted along the tube UV.
  const tail=new T.Group();tail.position.set(0,1.015,-.32);body.add(tail);
  const tc=new T.CatmullRomCurve3([new T.Vector3(0,0,0),new T.Vector3(-.23,-.12,-.31),new T.Vector3(-.60,-.07,-.54),new T.Vector3(-.95,.15,-.65),new T.Vector3(-1.12,.52,-.62),new T.Vector3(-1.03,.76,-.55)]);
  const tailGeo=new T.TubeGeometry(tc,70,1,28,false),tp=tailGeo.attributes.position,tn=tailGeo.attributes.normal,tu=tailGeo.attributes.uv;
  for(let i=0;i<tp.count;i++){const u=tu.getX(i),center=tc.getPointAt(u);const radius=(.115+.102*Math.sin(u*Math.PI*.91))*(1-smooth(.88,1,u)*.54);const micro=1+.019*Math.sin(i*2.17)+.010*Math.sin(i*.773);tp.setXYZ(i,center.x+tn.getX(i)*radius*micro,center.y+tn.getY(i)*radius*micro,center.z+tn.getZ(i)*radius*micro);}
  tailGeo.computeVertexNormals();
  const tailTex=canvas(1024,128,(c,w,h)=>{const im=c.createImageData(w,h),r=random(892);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const u=x/w;const stripe=1-smooth(.27,.43,Math.abs(Math.sin(u*Math.PI*6.2+.12*Math.sin(y*.10))));const tip=smooth(.94,1,u),s=Math.max(stripe,tip),grain=(r()-.5)*35;const k=(y*w+x)*4;im.data[k]=180*(1-s)+58*s+grain;im.data[k+1]=132*(1-s)+39*s+grain;im.data[k+2]=82*(1-s)+27*s+grain;im.data[k+3]=255;}c.putImageData(im,0,0);});
  mesh(tailGeo,new T.MeshStandardMaterial({map:tailTex,roughness:.99,bumpMap:tailTex,bumpScale:.011}),tail);
  const end=tc.getPoint(1);ell(tail,mat.stripe,...end.toArray(),.072,.082,.075);
  // Short fur fibers create a soft silhouette, particularly in rim lighting.
  const tr=random(541),furPositions=[],furColors=[],frames=tc.computeFrenetFrames(70,false);const lightColor=new T.Color('#b68a57'),darkColor=new T.Color('#4c3424');
  for(let i=0;i<3300;i++){
    const u=tr()*.96+.018,a=tr()*TAU,center=tc.getPointAt(u),n=frames.normals[Math.min(69,Math.floor(u*70))],b=frames.binormals[Math.min(69,Math.floor(u*70))];const rad=(.115+.102*Math.sin(u*Math.PI*.91))*(1-smooth(.88,1,u)*.54);const v=n.clone().multiplyScalar(Math.cos(a)).addScaledVector(b,Math.sin(a));const start=center.clone().addScaledVector(v,rad*.99),stop=start.clone().addScaledVector(v,.015+tr()*.030);stop.y+=.008;furPositions.push(...start.toArray(),...stop.toArray());const color=Math.abs(Math.sin(u*Math.PI*6.2))<.37?darkColor:lightColor;furColors.push(...color.toArray(),...color.toArray());
  }
  const fg=new T.BufferGeometry();fg.setAttribute('position',new T.Float32BufferAttribute(furPositions,3));fg.setAttribute('color',new T.Float32BufferAttribute(furColors,3));tail.add(new T.LineSegments(fg,new T.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.60})));

  // Merge rigid meshes by material within each rig part to keep mobile draw calls sane.
  function batch(group){
    for(const child of [...group.children])if(child.isGroup)batch(child);
    const map=new Map();for(const o of group.children){if(!o.isMesh||Array.isArray(o.material)||o.material.transparent)continue;const list=map.get(o.material)||[];list.push(o);map.set(o.material,list);}
    for(const [m,list]of map){if(list.length<2)continue;const chunks=list.map(o=>{o.updateMatrix();const g=o.geometry.clone();return g.applyMatrix4(o.matrix);});const out=new T.BufferGeometry();for(const key of ['position','normal','uv']){if(chunks.some(g=>!g.attributes[key]))continue;const len=chunks.reduce((n,g)=>n+g.attributes[key].array.length,0),data=new Float32Array(len);let offset=0;for(const g of chunks){data.set(g.attributes[key].array,offset);offset+=g.attributes[key].array.length;}out.setAttribute(key,new T.BufferAttribute(data,key==='uv'?2:3));}const indices=[];let vertexOffset=0;for(const g of chunks){const ix=g.index;if(ix){for(let i=0;i<ix.count;i++)indices.push(ix.getX(i)+vertexOffset);}else{for(let i=0;i<g.attributes.position.count;i++)indices.push(i+vertexOffset);}vertexOffset+=g.attributes.position.count;}out.setIndex(indices);out.computeBoundingSphere();const combined=new T.Mesh(out,m);combined.castShadow=true;combined.receiveShadow=true;group.add(combined);list.forEach(o=>o.removeFromParent());chunks.forEach(g=>g.dispose());}
  }
  batch(body);
  let triangleCount=0;root.traverse(o=>{if(o.isMesh)triangleCount+=(o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)/3;});
  root.userData={kind:'fully-3d-hero',height:3.84,triangleCount,forward:'+Z',rig:'procedural articulated limbs'};
  let walkBlend=0;
  function update(time,walking=0){
    const requested=typeof walking==='boolean'?(walking?1:0):clamp(walking);
    walkBlend+=(requested-walkBlend)*.10;const step=Math.sin(time*7.5),swing=step*.34*walkBlend;
    legs[0].rotation.x=swing;legs[1].rotation.x=-swing;
    arms[0].rotation.x=-swing*.72+.055;arms[1].rotation.x=swing*.72-.025;
    arms[0].rotation.z=-.17+Math.sin(time*1.4)*.012;arms[1].rotation.z=.17+Math.sin(time*1.4+1)*.012;
    body.position.y=.012*Math.sin(time*1.65)+Math.abs(step)*.046*walkBlend;
    head.rotation.y=Math.sin(time*.67)*.025*(1-walkBlend);head.rotation.z=Math.sin(time*1.1)*.012;helmet.rotation.copy(head.rotation);
    tail.rotation.z=Math.sin(time*1.8)*.042;tail.rotation.y=Math.sin(time*1.3)*.08;
  }
  update(0,0);
  return {root,update,triangleCount};
}
