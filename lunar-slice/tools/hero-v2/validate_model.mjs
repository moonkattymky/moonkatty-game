import fs from 'node:fs';
const dir='/workspace/scratch/d69cb29e406b/moonkatty-lunar-slice/lunar-slice/';
const THREE_URL='data:text/javascript;base64,'+Buffer.from(fs.readFileSync(dir+'vendor/three-r170.module.min.js','utf8')).toString('base64');
const T=await import(THREE_URL);T.TextureLoader.prototype.loadAsync=async()=>new T.Texture();
globalThis.document={createElement(){return{width:0,height:0,getContext(){return{createImageData(w,h){return{data:new Uint8ClampedArray(w*h*4)}},putImageData(){}}}}}};
globalThis.fetch=async url=>new Response(fs.readFileSync(new URL(url)));
let code=fs.readFileSync(dir+'hero-v2.js','utf8').replace("'./vendor/three-r170.module.min.js'",JSON.stringify(THREE_URL)).replace("new URL('./art/hero-v2/', import.meta.url)","new URL('file://"+dir+"art/hero-v2/')");
const {createHeroV2,createHeadProof}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
for(const create of [createHeadProof,createHeroV2]){
 const hero=await create();let meshes=0,triangles=0,vertices=0,invalid=0,badIndex=0;
 hero.root.traverse(o=>{if(!o.isMesh)return;meshes++;triangles+=o.geometry.index.count/3;vertices+=o.geometry.attributes.position.count;for(const name of ['position','normal','uv','color'])for(const v of o.geometry.attributes[name].array)if(!Number.isFinite(v))invalid++;for(const v of o.geometry.index.array)if(v>=o.geometry.attributes.position.count)badIndex++;});
 hero.root.updateMatrixWorld(true);const b=new T.Box3().setFromObject(hero.root);
 for(let i=0;i<80;i++){hero.update(i*.07,i<50?1:0);hero.root.updateMatrixWorld(true);}
 const report={model:create.name,meshes,triangles,vertices,invalid,badIndex,bounds:{min:b.min.toArray(),max:b.max.toArray()},compressedBytes:fs.statSync(dir+'art/hero-v2/'+(create===createHeadProof?'head':'hero')+'.bin.gz').size};console.log(JSON.stringify(report,null,2));if(invalid||badIndex||triangles!==hero.triangleCount)throw Error('Invalid geometry');
}
