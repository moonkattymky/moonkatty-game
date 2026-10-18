// Static checks for the Telegram Mini App build of the 3D chapter 1 (world3d/). No browser needed.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const W=path.join(__dirname,'..','world3d'),read=f=>fs.readFileSync(path.join(W,f),'utf8');
const html=read('index.html'),sw=read('sw.js'),main=read('src/main.js');
const csp=/http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(html)?.[1];
assert.ok(csp,'CSP present');
assert.ok(/script-src 'self' https:\/\/telegram\.org;/.test(csp),'no inline scripts allowed');
assert.ok(csp.includes('connect-src')&&csp.includes('https://lswbmgoeinblzuqzakvi.supabase.co'),'API allowed');
assert.ok(!/<script>(?!<\/script>)/.test(html)&&!/type="importmap"/.test(html),'no inline script / importmap in the shipped page');
assert.ok(html.includes('https://telegram.org/js/telegram-web-app.js'),'Telegram SDK');
const v=/app\.min\.js\?v=([A-Za-z0-9]+)/.exec(html)?.[1];assert.ok(v&&v!=='init','bundle version stamped');
assert.ok(html.includes('boot.js?v='+v),'boot.js same version');
assert.ok(sw.includes(`const VERSION = '${v}';`),'service worker cache version matches the page');
assert.ok(fs.statSync(path.join(W,'app.min.js')).size<1500000,'bundle size budget (<1.5 MB raw)');
assert.ok(!/Date\.now\(\)\)?\.then\(gltf/.test(main)&&!main.includes("catURL + '?v=' + Date.now()"),'GLB is not cache-busted on every launch');
assert.ok(main.includes("initTelegram("),'Telegram shell initialised');
const deferred=read('src/tg/deferred.js');for(const k of ['friendHelp','notify','robotReturned','storageFull'])assert.ok(deferred.includes(k),'stub '+k);
assert.ok(!fs.readdirSync(W).includes('tools'),'dev tools are not published');
console.log('world3d-static: all checks passed (bundle v='+v+')');
