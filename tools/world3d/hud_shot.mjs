// HUD restyle check: phone portrait gameplay + open quests sheet -> renders/hud_phone.png, renders/hud_sheet.png. usage: node tools/hud_shot.mjs [baseURL]
import { chromium } from 'playwright-core';
const base = process.argv[2] || `http://localhost:${process.env.MKPORT || 47321}/index.html`;
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }); const logs = []; p.on('pageerror', e => logs.push(e.message)); p.on('console', m => { if (m.type() === 'error') logs.push(m.text()); });
await p.goto(base + (base.includes('?') ? '&' : '?') + 'view=play&reset=1' + (process.env.LANGQ || '')); await p.waitForFunction(() => window.MK && MK.ready && MK.game && MK.game.ready, null, { timeout: 90000 }).catch(e => { console.log(JSON.stringify({ fail: e.message.slice(0, 80), logs })); process.exit(1); });
await p.waitForTimeout(5000); await p.screenshot({ path: 'renders/hud_phone.png' });
await p.evaluate(() => document.querySelector('#mk-qbtn').click()); await p.waitForTimeout(900); await p.screenshot({ path: 'renders/hud_sheet.png' });
console.log(JSON.stringify({ logs })); await b.close();
