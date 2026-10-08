// Guards against unresolved git merge conflicts shipping to players (they once leaked into the More tab).
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');const bad=[];
const walk=d=>{for(const f of fs.readdirSync(d,{withFileTypes:true})){if(['.git','node_modules','runtime'].includes(f.name))continue;const p=path.join(d,f.name);
 if(f.isDirectory())walk(p);else if(/\.(js|cjs|html|css|json|ts|md)$/.test(f.name)){const t=fs.readFileSync(p,'utf8');if(/^(<{7} |={7}$|>{7} )/m.test(t))bad.push(path.relative(root,p));}}};
walk(root);
if(bad.length){console.error('Merge conflict markers in: '+bad.join(', '));process.exit(1);}
console.log('no merge conflict markers');
