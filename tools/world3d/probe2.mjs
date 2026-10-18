import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 576 } });
page.on('pageerror', e => console.log('ERR', e.message));
await page.goto((process.env.MK_BASE || 'http://localhost:47321/index.html') + '?shot=1&pr=1&view=' + (process.argv[2] || 'concept'));
await page.waitForFunction(() => window.MK && window.MK.ready, null, { timeout: 150000 });
const r = await page.evaluate(() => { const out = []; const { scene, camera } = MK; scene.traverse(o => { if ((o.isMesh || o.isPoints || o.isLine) && o.visible) { o.onAfterRender = function (rend) { out.push([o.name || o.type, o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3, o.isInstancedMesh ? o.count : 1]); }; } }); MK.renderer.shadowMap.autoUpdate = false; MK.renderOnce(); const first = out.splice(0); return first; });
const agg = {}; for (const [n, t, c] of r) { agg[n] = agg[n] || [0, 0]; agg[n][0] += t * c; agg[n][1]++; }
console.log(Object.entries(agg).sort((a, b) => b[1][0] - a[1][0]).map(([n, [t, c]]) => n + ' ' + Math.round(t) + ' x' + c).join('\n'));
await browser.close().catch(() => {}); process.exit(0);
