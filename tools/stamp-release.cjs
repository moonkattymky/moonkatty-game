const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),dir=path.resolve(process.argv[2]||root);
const version=fs.readFileSync(path.join(root,'index.html'),'utf8').match(/name="mkty-release" content="([^"]+)"/)[1];
fs.writeFileSync(path.join(dir,'build.json'),JSON.stringify({version,sha:process.env.GITHUB_SHA||'local',builtAt:new Date().toISOString(),tests:'full'},null,2)+'\n');
