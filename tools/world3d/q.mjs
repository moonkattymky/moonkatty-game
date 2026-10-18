import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 576 } });
page.on('pageerror', e => console.log('ERR', e.message)); page.on('console', m => { if (m.type() !== 'warning') console.log('LOG', m.text()); });
await page.goto((process.env.MK_BASE || 'http://localhost:47321/index.html') + '?shot=1&pr=1&view=' + (process.argv[2] || 'concept'));
await page.waitForFunction(() => window.MK && window.MK.ready, null, { timeout: 150000 });
console.log(await page.evaluate(process.argv[3] || 'JSON.stringify(MK.stats())'));
await browser.close().catch(() => {}); process.exit(0);
