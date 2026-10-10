/* Optional review artifact only. Runtime remains plain no-library JS. */
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),out=process.argv[2]||'/tmp/moonkatty-open-world/MOONKATTY-open-world-playable.html';
const mime={'.jpg':'image/jpeg','.webp':'image/webp','.png':'image/png'};
function inlineAssets(text){return text.replace(/(['"])(assets\/[A-Za-z0-9._-]+)\1/g,(all,q,file)=>{const p=path.join(root,file);if(!fs.existsSync(p))throw Error('Missing asset '+file);return q+'data:'+mime[path.extname(file)]+';base64,'+fs.readFileSync(p).toString('base64')+q;});}
let html=fs.readFileSync(path.join(root,'index.html'),'utf8');html=html.replace('<link rel="stylesheet" href="preview.css">','<style>'+fs.readFileSync(path.join(root,'preview.css'),'utf8')+'</style>');
html=html.replace(/<script src="([^"]+)"><\/script>/g,(all,file)=>'<script>'+inlineAssets(fs.readFileSync(path.join(root,file),'utf8')).replace(/<\/script/gi,'<\\/script')+'</script>');
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,html);console.log(JSON.stringify({file:out,bytes:Buffer.byteLength(html),scope:'Isolated local preview; no campaign, account, rewards or backend connections.'}));
