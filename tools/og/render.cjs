// node tools/og/render.cjs -> art/og-preview-prelaunch.png (1200x630)
const {chromium}=require('playwright'),path=require('node:path');
(async()=>{const b=await chromium.launch({args:['--no-sandbox'],...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});const p=await b.newPage({viewport:{width:1200,height:630}});
await p.goto('file://'+path.join(__dirname,'og.html'));await p.waitForTimeout(500);await p.screenshot({path:path.join(__dirname,'../../art/og-preview-prelaunch.png')});await b.close();})();
