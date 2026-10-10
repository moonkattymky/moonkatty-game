import * as T from './vendor/three-r170.module.min.js';
const bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
export function reflectionEnvironment(renderer){
 const s=new T.Scene();s.background=new T.Color(.045,.065,.085);
 const plane=(w,h,x,y,z,c,rx,ry)=>{const o=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({color:new T.Color(...c),side:T.DoubleSide}));o.position.set(x,y,z);o.rotation.set(rx,ry,0);s.add(o);};
 plane(15,22,12,10,0,[2.8,2.1,1.3],0,-Math.PI/2);plane(14,16,-15,8,-3,[.47,.79,1.35],0,Math.PI/2);plane(24,24,0,-7,0,[.32,.34,.37],-Math.PI/2,0);plane(9,17,2,10,-15,[1.2,1.6,2.2],0,0);
 const p=new T.PMREMGenerator(renderer),rt=p.fromScene(s,.1,.1,100);p.dispose();return rt;
}
function surfaceMaps(){
 const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d'),im=x.createImageData(256,256);let seed=971;
 for(let i=0;i<im.data.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const v=122+(seed>>>26);im.data.set([v,v,v,255],i);}x.putImageData(im,0,0);const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(5,5);return t;
}
export async function loadAuthoredObservatory(){
 const response=await fetch('./art/authored/observatory.mesh.json.gz');if(!response.ok)throw Error('Authored mesh unavailable');const stream=response.body.pipeThrough(new DecompressionStream('gzip'));const a=await new Response(stream).json(),root=new T.Group(),materials={},micro=surfaceMaps();
 for(const [k,d]of Object.entries(a.materials)){
  const common={color:new T.Color(...d.color),metalness:d.metalness,roughness:d.roughness,vertexColors:true,envMapIntensity:k==='gold'?1.2:.75};
  if(d.alpha<1){materials[k]=new T.MeshPhysicalMaterial({...common,color:'#759299',transparent:true,opacity:.24,depthWrite:false,side:T.DoubleSide,metalness:.38,roughness:.11});}
  else{materials[k]=new T.MeshStandardMaterial(common);if(d.emission){materials[k].emissive=new T.Color(...d.color);materials[k].emissiveIntensity=Math.min(d.emission,2.0);}if(['porcelain','edge','gold','inside','steel'].includes(k)){materials[k].bumpMap=micro;materials[k].bumpScale=k==='gold'?.005:.013;}}
 }
 let triangles=0;
 for(const m of a.meshes){
  const g=new T.BufferGeometry(),p=new Int16Array(bytes(m.position).buffer),pos=new Float32Array(p.length),n=new Int8Array(bytes(m.normal).buffer),ao=bytes(m.ao),colors=new Float32Array(ao.length*3);for(let i=0;i<p.length;i++)pos[i]=p[i]/1000;for(let i=0;i<ao.length;i++){const v=Math.pow(ao[i]/255,1.15);colors.set([v,v,v],i*3);}g.setAttribute('position',new T.BufferAttribute(pos,3));g.setAttribute('normal',new T.BufferAttribute(n,3,true));g.setAttribute('color',new T.BufferAttribute(colors,3));g.setAttribute('uv',new T.BufferAttribute(new Float32Array(bytes(m.uv).buffer),2));if(m.index)g.setIndex(new T.BufferAttribute(new Uint32Array(bytes(m.index).buffer),1));g.computeBoundingSphere();const mesh=new T.Mesh(g,materials[m.material]);mesh.castShadow=!['glass','light','cyan'].includes(m.material);mesh.receiveShadow=true;root.add(mesh);triangles+=(g.index?g.index.count:g.attributes.position.count)/3;
 }
 return {root,triangles,materials};
}
