'use strict';
/* Independent local C++ float evaluation checks the numeric ABI only. This
 * is not a browser renderer, supplied-rectangle controller oracle, or native
 * parity evidence. No network or browser is opened. */
const assert=require('node:assert/strict'),cp=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const P=require('../life1-native-geometry.js');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'life1-native-arithmetic-')),exe=path.join(dir,'reference');
try{
 const compile=cp.spawnSync('c++',['-std=c++17','-O0','-ffp-contract=off','-fno-fast-math',path.join(__dirname,'fixtures/life1-native-percentage-reference.cc'),'-o',exe],{encoding:'utf8',timeout:30000});
 assert.equal(compile.status,0,'Independent arithmetic reference must compile: '+(compile.error||compile.stderr));
 let seed=0x71a5173;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/0x100000000;};
 const inputs=[[298,26],[229.21875,51],[357.375,10.961],[78,-85],[78,-50],[4094,100],[64,-.0001]];
 for(let i=0;i<10000;i++)inputs.push([Math.round((62+random()*4032)*64)/64,random()*200-100]);
 const output=cp.spawnSync(exe,[],{input:inputs.map(v=>v.map(n=>n.toPrecision(17)).join(' ')).join('\n')+'\n',encoding:'utf8',timeout:5000,maxBuffer:1024*1024});
 assert.equal(output.status,0,output.stderr);const rows=output.stdout.trim().split('\n');assert.equal(rows.length,inputs.length);
 const data=new DataView(new ArrayBuffer(4));
 for(let i=0;i<inputs.length;i++){
  const [bits,units]=rows[i].split(' ').map(Number),[basis,percent]=inputs[i];data.setFloat32(0,P.percentageFloat(basis,percent),true);
  assert.equal(data.getUint32(0,true),bits,'float bits at '+i);assert.equal(P.percentageLayout(basis,percent)*64,units,'layout units at '+i);
 }
 console.log(JSON.stringify({suite:'life1-native-independent-arithmetic',cases:inputs.length,floatBitsExact:true,layoutUnitsExact:true,browserRun:false,completeNativeParityCertified:false}));
}finally{fs.rmSync(dir,{recursive:true,force:true});}
