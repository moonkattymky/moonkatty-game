const {execFileSync}=require('node:child_process'),path=require('node:path');
execFileSync(process.execPath,[path.join(__dirname,'../tools/build-server-models.cjs'),'--check'],{stdio:'inherit'});
console.log('PASS: Edge validation uses the exact browser rules');
