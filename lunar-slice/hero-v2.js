import * as T from './vendor/three-r170.module.min.js';
// Authored, fully dimensional Blender sculpt. Never a character-image billboard.
// Independent from the preserved hero.js prototype. Load with await createHeroV2().
const assetRoot = new URL('./art/hero-v2/', import.meta.url);
function clothBump(){
  const c=document.createElement('canvas');c.width=c.height=96;const ctx=c.getContext('2d'),im=ctx.createImageData(96,96);
  for(let y=0;y<96;y++)for(let x=0;x<96;x++){const k=(y*96+x)*4,v=135+22*Math.sin(x*2.8)+12*Math.sin(y*2.8);im.data[k]=im.data[k+1]=im.data[k+2]=v;im.data[k+3]=255;}
  ctx.putImageData(im,0,0);const texture=new T.CanvasTexture(c);texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(10,10);return texture;
}
async function loadSculpt(prefix){
  const [metadata, buffer] = await Promise.all([
    fetch(new URL(prefix+'.json', assetRoot)).then(r => {if(!r.ok)throw new Error('Sculpt metadata unavailable');return r.json();}),
    fetch(new URL(prefix+'.bin.gz', assetRoot)).then(async r => {if(!r.ok)throw new Error('Sculpt geometry unavailable');return new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();})
  ]);
  const iris=await new T.TextureLoader().loadAsync(new URL('iris.png',assetRoot).href);iris.colorSpace=T.SRGBColorSpace;iris.anisotropy=8;
  const root=new T.Group();root.name='MOONKATTY • authored sculpt v2';
  const materials=new Map(),rigs=new Map(),weave=clothBump();
  for(const part of metadata.meshes){
    let rig=rigs.get(part.rig);if(!rig){rig=new T.Group();rig.name=part.rig;rig.position.fromArray(part.pivot);root.add(rig);rigs.set(part.rig,rig);}
    const g=new T.BufferGeometry(),q=new Int16Array(buffer,part.position.offset,part.position.count),p=new Float32Array(q.length);
    for(let i=0;i<q.length;i++)p[i]=part.center[i%3]+q[i]/32767*part.scale[i%3]-part.pivot[i%3];
    g.setAttribute('position',new T.BufferAttribute(p,3));
    g.setAttribute('normal',new T.BufferAttribute(new Int8Array(buffer,part.normal.offset,part.normal.count),3,true));
    g.setAttribute('color',new T.BufferAttribute(new Uint8Array(buffer,part.color.offset,part.color.count),3,true));
    g.setAttribute('uv',new T.BufferAttribute(new Uint16Array(buffer,part.uv.offset,part.uv.count),2,true));
    g.setIndex(new T.BufferAttribute(new (part.indexType==='H'?Uint16Array:Uint32Array)(buffer,part.index.offset,part.index.count),1));g.computeBoundingSphere();
    let m=materials.get(part.material);
    if(!m){
      const n=part.material,eye=n.startsWith('Amber'),glint=n==='Catchlight',nose=n==='Rose nose',gold=n.includes('gold'),cloth=n.includes('fabric'),enamel=n.includes('enamel'),fur=n.includes('tabby'),visor=n==='Clear helmet visor';
      if(visor)m=new T.MeshPhysicalMaterial({color:'#c8e8f5',transparent:true,opacity:.065,roughness:.055,metalness:.08,clearcoat:1,depthWrite:false,side:T.FrontSide});
      else{
        m=new T.MeshStandardMaterial({vertexColors:!eye,color:0xffffff,roughness:eye?.24:nose?.43:glint?.22:gold?.26:enamel?.28:.85,metalness:gold?.78:enamel?.15:0,map:eye?iris:null,side:fur?T.DoubleSide:T.FrontSide});
        if(cloth){m.bumpMap=weave;m.bumpScale=.009;}
        if(n==='Warm status lamps'){m.emissive=new T.Color('#ffb839');m.emissiveIntensity=2;}
        if(n==='Cyan telemetry'){m.emissive=new T.Color('#267d94');m.emissiveIntensity=1;}
      }
      materials.set(n,m);
    }
    const object=new T.Mesh(g,m);object.name=part.name;object.castShadow=!m.transparent;object.receiveShadow=!m.transparent;if(m.transparent)object.renderOrder=3;rig.add(object);
  }
  const swingAxis=new T.Vector3(Math.cos(Math.PI/6),0,Math.sin(Math.PI/6));let blend=0;
  function update(t,walking=0){
    blend+=((walking===true?1:Number(walking)||0)-blend)*.09;const s=Math.sin(t*7.1)*blend;
    rigs.get('legL')?.quaternion.setFromAxisAngle(swingAxis,s*.20);rigs.get('legR')?.quaternion.setFromAxisAngle(swingAxis,-s*.20);
    rigs.get('armL')?.quaternion.setFromAxisAngle(swingAxis,-s*.15);rigs.get('armR')?.quaternion.setFromAxisAngle(swingAxis,s*.15);
    const head=rigs.get('head');if(head)head.rotation.y=Math.sin(t*.8)*.015;
    const tail=rigs.get('tail');if(tail)tail.rotation.z=Math.sin(t*1.6)*.035;
  }
  root.userData={kind:'authored-3d-sculpt',triangleCount:metadata.triangles,geometry:'indexed quantized binary',pose:'three-quarter passing stride',bodyHeadingYaw:-Math.PI/6};
  return {root,update,triangleCount:metadata.triangles,rigs};
}
export async function createHeadProof(){return loadSculpt('head');}
export async function createHeroV2(){return loadSculpt('hero');}
