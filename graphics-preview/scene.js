import * as T from './vendor/three-r170.module.min.js';

// Presentation-only world. No campaign controller, reward, identity or save imports.
export const MODULES = [
  {id:'reactor',name:'РЕАКТОР',x:-9,z:-4,r:3.4,number:1,description:'Светящиеся кольца реактора, охлаждение и внешний контур питания.'},
  {id:'relay',name:'АНТЕННА',x:6,z:-8,r:3.0,number:2,description:'Параболическая антенна связывает лунную базу с Землёй.'},
  {id:'generator',name:'ГЕНЕРАТОР',x:-10,z:9,r:2.9,number:3,description:'Резервный генератор и защищённые магистрали станции.'}
];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function groundHeight(x,z){
  const d=Math.hypot(x,z), edge=clamp((d-22)/38,0,1);
  return (Math.sin(x*.16)*Math.cos(z*.13)*2.0+Math.sin(x*.37+z*.22)*.7)*edge + Math.sin(x*.5)*Math.cos(z*.4)*.065;
}
export function floorHeight(x,z){
  if(x>7.1&&x<12.9&&z>-3.2&&z<9.7){
    if(z<=3.3)return .7;
    return Math.max(groundHeight(x,z),.7*(9.7-z)/6.4);
  }
  return groundHeight(x,z);
}

export async function buildScene(renderer){
  const scene=new T.Scene();scene.background=new T.Color('#071223');scene.fog=new T.FogExp2('#243343',.0034);
  const objects=new T.Group();scene.add(objects);
  const loader=new T.TextureLoader();
  const [regolith,earthTex]=await Promise.all([loader.loadAsync('./art/regolith.webp?v=20261010-world-1'),loader.loadAsync('./art/earth.webp?v=20261010-world-1')]);
  regolith.colorSpace=earthTex.colorSpace=T.SRGBColorSpace;regolith.wrapS=regolith.wrapT=T.RepeatWrapping;regolith.repeat.set(26,26);regolith.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
  const hemisphere=new T.HemisphereLight('#b9d7ff','#53402c',1.15);scene.add(hemisphere);
  const sun=new T.DirectionalLight('#ffe4b1',3.6);sun.position.set(-25,38,22);scene.add(sun);
  const rim=new T.DirectionalLight('#64cfff',1.1);rim.position.set(14,11,-22);scene.add(rim);

  // Small prefiltered studio environment supplies readable metallic edges without shadow maps.
  const envCanvas=document.createElement('canvas');envCanvas.width=256;envCanvas.height=128;
  const ec=envCanvas.getContext('2d'),grad=ec.createLinearGradient(0,0,0,128);
  grad.addColorStop(0,'#8fa7bf');grad.addColorStop(.45,'#26394f');grad.addColorStop(.58,'#d9d9ce');grad.addColorStop(1,'#52514a');ec.fillStyle=grad;ec.fillRect(0,0,256,128);ec.fillStyle='#fff1c9';ec.fillRect(20,25,22,45);ec.fillStyle='#c8eeff';ec.fillRect(150,20,14,48);
  const env=new T.CanvasTexture(envCanvas);env.mapping=T.EquirectangularReflectionMapping;env.colorSpace=T.SRGBColorSpace;
  const pmrem=new T.PMREMGenerator(renderer);const envTarget=pmrem.fromEquirectangular(env);scene.environment=envTarget.texture;pmrem.dispose();env.dispose();

  const mat={
    white:new T.MeshStandardMaterial({color:'#dbe3e7',metalness:.32,roughness:.36}),
    gold:new T.MeshStandardMaterial({color:'#d99c3e',metalness:.82,roughness:.26}),
    black:new T.MeshStandardMaterial({color:'#17202a',metalness:.35,roughness:.53}),
    steel:new T.MeshStandardMaterial({color:'#68717b',metalness:.7,roughness:.46}),
    rubber:new T.MeshStandardMaterial({color:'#141b21',roughness:.95}),
    amber:new T.MeshBasicMaterial({color:'#ffba40',toneMapped:false}),
    cyan:new T.MeshBasicMaterial({color:'#57f4ff',toneMapped:false}),
    solar:new T.MeshStandardMaterial({color:'#123357',metalness:.6,roughness:.32}),
    soil:new T.MeshStandardMaterial({color:'#abb2ba',map:regolith,roughness:1}),
    rock:new T.MeshStandardMaterial({color:'#687078',roughness:1,flatShading:true})
  };
  // Fine panel seams and wear belong to the surface, while bevels and hardware are geometry.
  const metalC=document.createElement('canvas');metalC.width=metalC.height=256;const mc=metalC.getContext('2d');mc.fillStyle='#e5e8e6';mc.fillRect(0,0,256,256);mc.strokeStyle='#99a3a5';mc.lineWidth=1;mc.strokeRect(5,5,246,246);mc.strokeStyle='#bdc6c5';mc.strokeRect(8,8,240,240);for(const x of [14,242])for(const y of [14,242]){mc.fillStyle='#737e80';mc.beginPath();mc.arc(x,y,1.6,0,Math.PI*2);mc.fill();}for(let i=0;i<70;i++){mc.strokeStyle=i%2?'#cad0cd':'#f2f4f0';mc.beginPath();const x=(i*37)%256,y=(i*71)%256;mc.moveTo(x,y);mc.lineTo(x+3+(i%9),y+.8);mc.stroke();}const metalTex=new T.CanvasTexture(metalC);metalTex.colorSpace=T.SRGBColorSpace;mat.white.map=metalTex;mat.white.envMapIntensity=1.4;mat.gold.envMapIntensity=1.6;
  const square=new T.Shape();square.moveTo(-.47,-.47);square.lineTo(.47,-.47);square.lineTo(.47,.47);square.lineTo(-.47,.47);square.closePath();
  const bevelBox=new T.ExtrudeGeometry(square,{depth:.94,bevelEnabled:true,bevelThickness:.03,bevelSize:.03,bevelSegments:2,steps:1});bevelBox.translate(0,0,-.47);
  const geo={box:bevelBox,ball:new T.SphereGeometry(1,12,8),catBall:new T.SphereGeometry(1,24,16),cyl:new T.CylinderGeometry(1,1,1,20),tube:new T.CylinderGeometry(1,1,1,12),rock:new T.DodecahedronGeometry(1,0),torus:new T.TorusGeometry(1,.075,8,40)};let characterParts=false;
  function mesh(g,m,group,x=0,y=0,z=0,sx=1,sy=sx,sz=sx){const o=new T.Mesh(g,m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);group.add(o);return o;}
  const box=(g,m,x,y,z,a,b,c)=>mesh(geo.box,m,g,x,y,z,a,b,c);
  const cyl=(g,m,x,y,z,r,h)=>mesh(geo.cyl,m,g,x,y,z,r,h,r);
  const ball=(g,m,x,y,z,a,b=a,c=a)=>mesh(characterParts?geo.catBall:geo.ball,m,g,x,y,z,a,b,c);
  const ring=(g,m,x,y,z,r)=>mesh(geo.torus,m,g,x,y,z,r,r,r);
  function rod(g,m,a,b,r=.07){const aa=new T.Vector3(...a),bb=new T.Vector3(...b),o=mesh(geo.tube,m,g,...aa.clone().add(bb).multiplyScalar(.5).toArray(),r,aa.distanceTo(bb),r);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),bb.sub(aa).normalize());return o;}
  function pipe(g,m,points,r=.11){const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));return mesh(new T.TubeGeometry(curve,Math.max(16,points.length*6),r,8,false),m,g);}
  function group(x=0,y=0,z=0){const g=new T.Group();g.position.set(x,y,z);objects.add(g);return g;}
  function panelText(text,w=2.1,h=.8){const c=document.createElement('canvas');c.width=512;c.height=192;const ctx=c.getContext('2d');ctx.fillStyle='#e1e7e7';ctx.fillRect(0,0,512,192);ctx.fillStyle='#273c48';ctx.font='bold 100px Arial';ctx.textAlign='center';ctx.fillText(text,256,140);const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;return new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshStandardMaterial({map:tex,roughness:.5,metalness:.15}));}
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=128;const sc=shadowCanvas.getContext('2d'),sg=sc.createRadialGradient(64,64,10,64,64,64);sg.addColorStop(0,'rgba(0,5,12,.7)');sg.addColorStop(.5,'rgba(0,5,12,.4)');sg.addColorStop(1,'rgba(0,5,12,0)');sc.fillStyle=sg;sc.fillRect(0,0,128,128);
  const shadowMat=new T.MeshBasicMaterial({map:new T.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});const shadowGeo=new T.PlaneGeometry(1,1);
  function contact(g,x,z,w,h=w){const s=mesh(shadowGeo,shadowMat,g,x,groundHeight(x,z)+.018,z,w,h,1);s.rotation.x=-Math.PI/2;return s;}

  const terrainGeo=new T.PlaneGeometry(190,190,120,120);terrainGeo.rotateX(-Math.PI/2);const pos=terrainGeo.attributes.position;
  const ao=new Float32Array(pos.count*3);
  for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i);pos.setY(i,groundHeight(x,z));let shade=1;for(const m of MODULES){const d=Math.hypot(x-m.x,z-m.z);shade=Math.min(shade,.43+.57*clamp((d-m.r*.35)/(m.r*1.2),0,1));}const lock=Math.hypot((x-10)/1.6,z/2);shade=Math.min(shade,.48+.52*clamp((lock-1.5)/3,0,1));ao[i*3]=ao[i*3+1]=ao[i*3+2]=shade;}terrainGeo.setAttribute('color',new T.BufferAttribute(ao,3));mat.soil.vertexColors=true;terrainGeo.computeVertexNormals();mesh(terrainGeo,mat.soil,objects);
  // A continuous ground plane and distant ridges, rather than a flat image with hit areas.
  const seeded=(seed=>()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;})(8419);
  const colliders=MODULES.map(m=>({type:'circle',x:m.x,z:m.z,r:m.r,height:m.id==='relay'?7:4.7}));
  for(let i=0;i<190;i++){
    const a=seeded()*Math.PI*2,r=17+seeded()*73,x=Math.cos(a)*r,z=Math.sin(a)*r;
    if(x>3&&x<20&&z>-14&&z<18)continue;
    const size=.25+seeded()*(r>45?3.8:1.3);const o=mesh(geo.rock,mat.rock,objects,x,groundHeight(x,z)+size*.42,z,size,size*(.4+seeded()*.55),size*(.7+seeded()*.5));o.rotation.set(seeded(),seeded()*6,seeded());
    if(r<65&&size>.6)colliders.push({type:'circle',x,z,r:size*.75,height:size});
  }
  // Regolith embankments form a real skyline in all camera directions.
  for(let i=0;i<24;i++){const a=i/24*Math.PI*2,r=83+seeded()*6;const x=Math.cos(a)*r,z=Math.sin(a)*r;const o=mesh(geo.rock,mat.rock,objects,x,groundHeight(x,z),z,9+seeded()*9,5+seeded()*8,8+seeded()*9);o.rotation.y=a;}

  function footing(g,r){cyl(g,mat.black,0,.13,0,r,.24);cyl(g,mat.steel,0,.34,0,r*.95,.18);const rr=ring(g,mat.gold,0,.45,0,r*.9);rr.rotation.x=Math.PI/2;for(let i=0;i<12;i++){const a=i/12*Math.PI*2;box(g,mat.gold,Math.cos(a)*r*.86,.51,Math.sin(a)*r*.86,.35,.12,.18);}}
  function housing(g,x,z,h=3,w=1.4){box(g,mat.black,x,h/2+.6,z,w+.12,h+.15,1.8);box(g,mat.white,x,h/2+.6,z+.07,w,h,1.72);box(g,mat.gold,x,h+.36,z+.96,w*.74,.13,.12);box(g,mat.black,x,h/2+.6,z+.95,w*.66,h*.5,.055);for(let i=0;i<5;i++)box(g,mat.steel,x,.95+i*.4,z+.998,w*.58,.095,.07);for(const dx of [-1,1])for(const dy of [-1,1])ball(g,mat.gold,x+dx*w*.38,h/2+.6+dy*h*.4,z+.96,.09);}
  const reactor=group(-9,groundHeight(-9,-4),-4);footing(reactor,3.4);
  cyl(reactor,mat.steel,0,2.1,0,1.4,3.2);cyl(reactor,mat.black,0,2.3,0,1.15,3.3);
  for(let i=0;i<6;i++){const y=.95+i*.48,rr=ring(reactor,mat.cyan,0,y,0,1.23);rr.rotation.x=Math.PI/2;}
  for(const x of [-2.1,2.1])housing(reactor,x,.25,3.4,1.35);
  for(let i=0;i<4;i++){const a=i/4*Math.PI*2+Math.PI/4;rod(reactor,mat.gold,[Math.cos(a)*1.48,.5,Math.sin(a)*1.48],[Math.cos(a)*1.48,4.1,Math.sin(a)*1.48],.14);}
  cyl(reactor,mat.white,0,4.18,0,2.65,.4);cyl(reactor,mat.black,0,4.43,0,1.5,.12);cyl(reactor,mat.gold,0,4.56,0,.65,.18);rod(reactor,mat.gold,[0,4.6,0],[0,7,0],.065);ball(reactor,mat.amber,0,7,0,.13);const lab=panelText('01',1.05,.7);lab.position.set(-2.1,2.95,1.19);reactor.add(lab);
  scene.add(new T.PointLight('#26edff',9,8,2).translateX(-9).translateY(2).translateZ(-1));contact(objects,-9,-4,10,8);

  const relay=group(6,groundHeight(6,-8),-8);footing(relay,2.9);cyl(relay,mat.white,0,1.8,0,2.05,2.5);cyl(relay,mat.gold,0,3.1,0,1.7,.24);
  for(let i=0;i<6;i++){const a=i/6*Math.PI*2;housing(relay,Math.cos(a)*1.78,Math.sin(a)*1.7,1.55,.57);}
  cyl(relay,mat.black,0,3.7,0,.65,1);const dish=new T.Group();dish.position.set(0,4.6,0);dish.rotation.x=-.62;relay.add(dish);
  const profile=[];for(let i=0;i<=18;i++){const r=i/18*3.3;profile.push(new T.Vector2(r,r*r/6.8));}
  const dishMat=new T.MeshStandardMaterial({color:'#e5e9e9',metalness:.55,roughness:.33,side:T.DoubleSide});mesh(new T.LatheGeometry(profile,40),dishMat,dish);
  const dr=ring(dish,mat.gold,0,1.6,0,3.3);dr.rotation.x=Math.PI/2;
  for(let i=0;i<8;i++){const a=i/8*Math.PI*2;rod(dish,mat.gold,[Math.cos(a)*3.18,1.55,Math.sin(a)*3.18],[0,3.3,0],.045);}
  cyl(dish,mat.gold,0,3.15,0,.22,.55);ball(dish,mat.amber,0,3.46,0,.16);rod(relay,mat.gold,[-1,3,0],[-1,8.6,0],.055);ball(relay,mat.amber,-1,8.6,0,.1);const label2=panelText('02',1.2,.7);label2.position.set(0,2.3,2.07);relay.add(label2);contact(objects,6,-8,8,7);

  const generator=group(-10,groundHeight(-10,9),9);footing(generator,2.9);housing(generator,0,0,3,3.8);
  for(let i=0;i<4;i++){const x=-1.45+i*.95;cyl(generator,mat.gold,x,2.1,-.8,.21,2.9);cyl(generator,mat.steel,x,2.1,-.8,.29,1.5);for(const y of [.8,3.5]){const r=ring(generator,mat.gold,x,y,-.8,.3);r.rotation.x=Math.PI/2;}pipe(generator,mat.gold,[[x,.65,-.8],[x,.5,1.3],[x,.65,1.9]],.12);ball(generator,mat.amber,x,3.65,-.8,.19);}
  box(generator,mat.white,0,3.85,0,4.1,.35,2.15);box(generator,mat.gold,0,4.08,0,1.4,.2,.7);const label3=panelText('03',1.3,.7);label3.position.set(0,3.1,1.01);generator.add(label3);contact(objects,-10,9,8,7);

  const airlock=group(10,0,0);const shellProfile=[new T.Vector2(3.15,-3.4),new T.Vector2(3.95,-3.4),new T.Vector2(3.95,3.4),new T.Vector2(3.15,3.4)];const shell=mesh(new T.LatheGeometry(shellProfile,48),mat.white,airlock,0,3.5,0);shell.rotation.x=Math.PI/2;
  for(const z of [-3.4,3.4]){ring(airlock,mat.gold,0,3.5,z,3.52);ring(airlock,mat.black,0,3.5,z+.12,3.28);ring(airlock,mat.amber,0,3.5,z+.18,3.18);}
  box(airlock,mat.black,0,.48,0,6,.5,6.8);box(airlock,mat.steel,0,.72,0,5.8,.1,6.7);
  box(airlock,mat.white,0,3.45,-3.6,6.5,5.9,.3);box(airlock,mat.gold,0,3,-3.41,2.8,4.2,.1);box(airlock,mat.black,0,2.9,-3.29,2.6,3.8,.13);box(airlock,mat.amber,0,4.45,-3.18,2,.12,.08);
  for(const x of [-2.95,2.95]){box(airlock,mat.steel,x,2.2,0,.32,3,4.8);for(const z of [-2,0,2])box(airlock,mat.amber,x*.96,3.5,z,.08,2.8,.22);box(airlock,mat.white,x*.89,1.5,-1,.8,1.5,1.1);box(airlock,mat.cyan,x*.83,2.24,-.65,.53,.05,.61);}
  const ramp=box(airlock,mat.steel,0,.27,6.5,5.8,.14,6.5);ramp.rotation.x=.107;
  for(let i=0;i<18;i++){const z=3.6+i*.33,y=.72-(z-3.3)*.107;box(airlock,mat.black,0,y,z,5.65,.045,.07);}
  for(const x of [-3.1,3.1]){rod(airlock,mat.gold,[x,.6,3.4],[x,.01,9.7],.12);for(let i=0;i<4;i++){const z=3.6+i*1.9,y=.75-(z-3.3)*.107;box(airlock,mat.amber,x,y,z,.12,.12,.7);}box(airlock,mat.white,x*1.17,1.8,0,1.2,3.5,5);}
  const title=panelText('MOONKATTY',3.4,.8);title.position.set(0,6.45,3.9);airlock.add(title);contact(objects,10,0,13,14);
  colliders.push({type:'box',x:6.1,z:0,hx:1.1,hz:4.1,height:7.5},{type:'box',x:13.9,z:0,hx:1.1,hz:4.1,height:7.5},{type:'box',x:10,z:-3.75,hx:4.7,hz:.45,height:7.5});
  const warm=new T.PointLight('#ffb33e',18,15,2);warm.position.set(10,3,1);scene.add(warm);

  // Cables and path beacons remain physical meshes viewed from either side.
  for(const points of [[[-7,.23,-1],[-6,.27,2],[-4,.25,5],[4,.25,4],[6,.3,2]],[[-9,.2,6],[-5,.21,8],[0,.2,6],[6,.22,7]],[[4,.2,-6],[1,.24,-3],[-4,.23,-3]]]){
    pipe(objects,mat.black,points,.2);pipe(objects,mat.gold,points.map(p=>[p[0],p[1]+.07,p[2]]),.055);
  }
  for(let i=0;i<26;i++){const z=12-i*.75,x=-2.8+Math.sin(i*.18)*3.1;const y=groundHeight(x,z);const o=box(objects,mat.amber,x,y+.025,z,.12,.04,.35);o.rotation.y=Math.sin(i*.18)*.25;}
  for(const [x,z]of [[-5,3],[-4,9],[3,-3],[5,9],[-13,1],[14,8]]){const g=group(x,groundHeight(x,z),z);cyl(g,mat.black,0,.5,0,.15,1);cyl(g,mat.gold,0,.9,0,.2,.25);ball(g,mat.amber,0,1.03,0,.2,.1,.2);}
  for(let i=0;i<7;i++){const x=15+(i%3)*1.5,z=-6+Math.floor(i/3)*1.5,g=group(x,groundHeight(x,z),z);box(g,mat.white,0,.5,0,1.2,.9,1.1);for(const dx of [-.43,.43])box(g,mat.gold,dx,.5,.59,.09,.93,.05);box(g,mat.black,0,.55,.6,.32,.23,.045);}
  // Solar wings and rover, consistent white/gold materials.
  for(const side of [-1,1]){const g=group(17,0,11);const wing=box(g,mat.solar,side*4,1.9,0,6,.08,3.5);wing.rotation.z=-side*.24;for(let i=0;i<6;i++){const x=side*4-2.8+i*1.1;rod(g,mat.steel,[x,1.7,-1.74],[x,1.7,1.74],.025);}rod(g,mat.steel,[0,0,0],[side*4,1.7,0],.11);}
  const rover=group(6,0,15);rover.rotation.y=-.6;box(rover,mat.black,0,.8,0,3.8,.7,5);box(rover,mat.white,0,1.4,0,3.2,.8,3.9);box(rover,mat.gold,0,1.9,-.7,2.7,.17,2);box(rover,mat.black,0,2,-1.5,2.1,.7,.08);
  for(const x of [-2,2])for(const z of [-1.7,1.7]){const wheel=cyl(rover,mat.rubber,x,.72,z,.85,.62);wheel.rotation.z=Math.PI/2;const hub=cyl(rover,mat.gold,x*1.1,.72,z,.45,.06);hub.rotation.z=Math.PI/2;for(let i=0;i<10;i++){const a=i/10*Math.PI*2;const tread=box(rover,mat.black,x,.72+Math.cos(a)*.86,z+Math.sin(a)*.86,.67,.16,.27);tread.rotation.x=a;}}
  for(const x of [-1.1,1.1])ball(rover,mat.amber,x,1.5,2.03,.21);colliders.push({type:'circle',x:6,z:15,r:3,height:2.5});contact(objects,6,15,6,7);

  // Combine repeated static parts, preserving world-space matrices and alpha ordering.
  objects.updateMatrixWorld(true);const batches=new Map(),remove=[];
  objects.traverse(o=>{if(!o.isMesh||Array.isArray(o.material)||o.material.transparent)return;o.castShadow=o.geometry!==terrainGeo;o.receiveShadow=true;const key=o.geometry.uuid+o.material.uuid;if(!batches.has(key))batches.set(key,[]);batches.get(key).push(o);});
  for(const list of batches.values()){if(list.length<3)continue;const batch=new T.InstancedMesh(list[0].geometry,list[0].material,list.length);batch.castShadow=true;batch.receiveShadow=true;list.forEach((o,i)=>{batch.setMatrixAt(i,o.matrixWorld);remove.push(o);});batch.computeBoundingSphere();scene.add(batch);}remove.forEach(o=>o.removeFromParent());

  // Stars and nebula are a sky sphere; the Earth itself is a lit 3D sphere.
  const skyC=document.createElement('canvas');skyC.width=1024;skyC.height=512;const sk=skyC.getContext('2d');sk.fillStyle='#040c1c';sk.fillRect(0,0,1024,512);
  for(let i=0;i<19;i++){const x=300+i*24,y=160+Math.sin(i*.43)*80;const g=sk.createRadialGradient(x,y,0,x,y,105);g.addColorStop(0,i%2?'rgba(48,87,152,.17)':'rgba(114,51,162,.16)');g.addColorStop(1,'rgba(8,17,35,0)');sk.fillStyle=g;sk.fillRect(x-105,y-105,210,210);}
  for(let i=0;i<1400;i++){const x=seeded()*1024,y=seeded()*512,s=seeded()*1.3+.2;sk.fillStyle=`rgba(190,224,255,${.22+seeded()*.65})`;sk.fillRect(x,y,s,s);}
  const skyTex=new T.CanvasTexture(skyC);skyTex.colorSpace=T.SRGBColorSpace;const sky=mesh(new T.SphereGeometry(400,32,16),new T.MeshBasicMaterial({map:skyTex,side:T.BackSide,fog:false}),scene);sky.rotation.y=1.5;
  const earth=mesh(new T.SphereGeometry(29,48,32),new T.MeshStandardMaterial({map:earthTex,roughness:.94,metalness:0,emissive:'#174470',emissiveIntensity:.42,fog:false}),scene,30,41,-149);earth.rotation.y=-1.8;earth.rotation.z=.13;
  const atmosphere=mesh(new T.SphereGeometry(29.55,40,24),new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.BackSide,uniforms:{glow:{value:new T.Color('#2d90ed')}},vertexShader:'varying vec3 n;varying vec3 v;void main(){vec4 p=modelViewMatrix*vec4(position,1.0);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',fragmentShader:'uniform vec3 glow;varying vec3 n;varying vec3 v;void main(){float a=pow(1.0-abs(dot(normalize(n),normalize(v))),3.5);gl_FragColor=vec4(glow,a*.65);}'}),scene,30,41,-149);

  characterParts=true;const cat=new T.Group();scene.add(cat);const suit=new T.Group();cat.add(suit);
  function furTexture(){const c=document.createElement('canvas');c.width=512;c.height=256;const ctx=c.getContext('2d');ctx.fillStyle='#966035';ctx.fillRect(0,0,512,256);for(let i=0;i<13;i++){ctx.fillStyle=i%2?'#51321ddc':'#c08b51c9';ctx.beginPath();ctx.moveTo(i*43,0);ctx.bezierCurveTo(i*43-17,50,i*43+31,115,i*43-12,256);ctx.lineTo(i*43+12,256);ctx.bezierCurveTo(i*43+44,115,i*43+8,50,i*43+23,0);ctx.fill();}for(let i=0;i<18000;i++){const x=seeded()*512,y=seeded()*256;ctx.strokeStyle=seeded()>.5?'#f2d1a332':'#2d1b1438';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+1,y+2+seeded()*3);ctx.stroke();}const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;return tex;}
  const fur=new T.MeshStandardMaterial({map:furTexture(),roughness:.97}),cream=new T.MeshStandardMaterial({color:'#f1ddbc',roughness:.95}),pink=new T.MeshStandardMaterial({color:'#ce937e',roughness:.8}),eye=new T.MeshStandardMaterial({color:'#a46927',roughness:.12,metalness:.08}),pupil=new T.MeshStandardMaterial({color:'#090c11',roughness:.12});
  ball(suit,mat.white,0,1.15,0,.64,.71,.46);box(suit,mat.gold,0,1.32,.448,.87,.9,.12);box(suit,mat.white,0,1.34,.532,.71,.7,.095);for(const x of [-.3,.3])box(suit,mat.gold,x,1.24,.599,.065,.28,.025);box(suit,mat.black,0,1.04,.604,.31,.07,.025);
  const emblem=panelText('M',.47,.23);emblem.position.set(0,1.45,.587);suit.add(emblem);
  box(suit,mat.black,0,1.37,-.5,.92,1.04,.43);box(suit,mat.white,0,1.42,-.73,.81,.87,.22);for(const x of [-.52,.52]){cyl(suit,mat.gold,x,1.39,-.5,.18,.78);ball(suit,mat.white,x,1.82,-.5,.18,.13,.18);}
  const limbs={legs:[],arms:[]};
  for(const side of [-1,1]){
    const leg=new T.Group();leg.position.set(side*.3,.72,0);suit.add(leg);limbs.legs.push(leg);ball(leg,mat.black,0,-.13,0,.23,.27,.23);ball(leg,mat.white,0,-.27,.04,.245,.32,.24);const r=ring(leg,mat.gold,0,-.36,0,.25);r.rotation.x=Math.PI/2;ball(leg,mat.white,0,-.51,.14,.28,.19,.39);box(leg,mat.black,0,-.66,.16,.5,.08,.61);box(leg,mat.gold,0,-.55,.44,.35,.07,.05);
    const arm=new T.Group();arm.position.set(side*.61,1.63,0);arm.rotation.z=side*.17;suit.add(arm);limbs.arms.push(arm);ball(arm,mat.gold,0,0,0,.23,.22,.24);ball(arm,mat.white,side*.08,-.31,0,.225,.36,.24);ball(arm,mat.black,side*.1,-.52,0,.19,.15,.2);ball(arm,mat.white,side*.12,-.67,.025,.22,.22,.25);const wr=ring(arm,mat.gold,side*.1,-.49,0,.205);wr.rotation.x=Math.PI/2;
  }
  const head=new T.Group();head.position.set(0,2.06,.04);suit.add(head);ball(head,fur,0,0,0,.6,.59,.54);
  for(const side of [-1,1]){
    // Extruded ears have real thickness, visible from every camera angle.
    const shape=new T.Shape();shape.moveTo(-.23,0);shape.quadraticCurveTo(-.18,.32,0,.53);shape.quadraticCurveTo(.17,.29,.23,0);shape.closePath();const ear=mesh(new T.ExtrudeGeometry(shape,{depth:.17,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.055,bevelThickness:.04}),fur,head,side*.38,.35,-.08);ear.rotation.z=side*-.25;
    const inner=mesh(new T.ShapeGeometry(shape),pink,head,side*.38,.40,.15,.68,.72,.68);inner.rotation.z=side*-.25;
    ball(head,cream,side*.28,-.19,.42,.255,.23,.16);ball(head,cream,side*.32,-.02,.47,.19,.20,.075);
    ball(head,mat.black,side*.255,.115,.45,.187,.218,.105);ball(head,eye,side*.255,.13,.525,.145,.175,.045);ball(head,pupil,side*.255,.14,.568,.060,.13,.028);ball(head,mat.white,side*.255-.025,.19,.588,.035,.045,.016);ball(head,mat.white,side*.255+.046,.095,.584,.017);
    ball(head,cream,side*.11,-.2,.56,.17,.11,.105);for(let i=0;i<3;i++)rod(head,cream,[side*.14,-.18-i*.045,.635],[side*(.57+i*.04),-.1-i*.075,.56],.006);
  }
  ball(head,pink,0,-.145,.66,.09,.058,.04);rod(head,mat.black,[0,-.18,.66],[0,-.27,.656],.008);ball(head,cream,0,-.32,.48,.22,.14,.13);
  const helmet=new T.Group();helmet.position.copy(head.position);suit.add(helmet);const glass=new T.MeshPhysicalMaterial({color:'#b6edff',transparent:true,opacity:.09,metalness:.12,roughness:.08,depthWrite:false,side:T.FrontSide});ball(helmet,glass,0,.025,0,.76,.76,.7);
  const trim=ring(helmet,mat.gold,0,0,.31,.72);trim.scale.y=.98;const collar=ring(suit,mat.gold,0,1.75,.02,.52);collar.rotation.x=Math.PI/2;
  for(const side of [-1,1]){const earpiece=cyl(helmet,mat.white,side*.69,.035,0,.23,.12);earpiece.rotation.z=Math.PI/2;const earring=ring(helmet,mat.gold,side*.764,.035,0,.18);earring.rotation.y=Math.PI/2;box(helmet,mat.gold,side*.72,-.14,-.14,.11,.16,.25);}
  const glint=new T.Mesh(new T.SphereGeometry(.766,16,8,.55,.19,.67,.48),new T.MeshBasicMaterial({color:'#d9f7ff',transparent:true,opacity:.25,depthWrite:false}));glint.scale.z=.925;helmet.add(glint);
  const tail=new T.Group();tail.position.set(0,.95,-.5);suit.add(tail);const tc=new T.CatmullRomCurve3([new T.Vector3(0,0,0),new T.Vector3(-.45,-.11,-.6),new T.Vector3(-.75,.05,-.86),new T.Vector3(-.88,.49,-.89)]);mesh(new T.TubeGeometry(tc,24,.18,10,false),fur,tail);ball(tail,fur,-.88,.49,-.89,.19);
  const catShadow=contact(scene,0,12,3.2,2.0);
  cat.traverse(o=>{if(o.isMesh&&!o.material.transparent)o.receiveShadow=true;});
  function animateCat(time,speed){const walk=clamp(speed/4.5,0,1),a=Math.sin(time*8.5)*.48*walk;limbs.legs[0].rotation.x=a;limbs.legs[1].rotation.x=-a;limbs.arms[0].rotation.x=-a*.65;limbs.arms[1].rotation.x=a*.65;suit.position.y=Math.abs(Math.sin(time*8.5))*.065*walk;tail.rotation.y=Math.sin(time*2.1)*.1;head.rotation.z=Math.sin(time*1.7)*.012;catShadow.position.set(cat.position.x,floorHeight(cat.position.x,cat.position.z)+.02,cat.position.z);}
  return {scene,cat,colliders,animateCat,resources:{envTarget,regolith,earthTex},earth,atmosphere};
}

// Continuous circle/box collision with separate axes: no grid, teleport or progression hook.
export function moveActor(position,dx,dz,colliders,radius=.47){
  const valid=(x,z)=>{
    if(Math.hypot(x,z)>73)return false;
    return !colliders.some(c=>c.type==='circle'?Math.hypot(x-c.x,z-c.z)<c.r+radius:Math.abs(x-c.x)<c.hx+radius&&Math.abs(z-c.z)<c.hz+radius);
  };
  const n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.18));let hit=false;
  for(let i=0;i<n;i++){const x=position.x+dx/n;if(valid(x,position.z))position.x=x;else hit=true;const z=position.z+dz/n;if(valid(position.x,z))position.z=z;else hit=true;}
  position.y=floorHeight(position.x,position.z);return hit;
}
export {T};
