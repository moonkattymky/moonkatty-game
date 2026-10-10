/* CI-only real-document regression for a write whose receipt is lost on reload.
   All rewards requests are intercepted and all other nonlocal traffic is blocked.
   Automatically discovered by run-all.cjs; run only where browser/server use is permitted. */
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const Codec = require('../trace-codec.js');
const KEY = 'mkty_life1_memory_code', REVISION = 'mkty_cloud_revision', DIRTY = 'mkty_cloud_dirty';
const root = path.resolve(__dirname, '..');
const html = '<!doctype html><html><body><section class="screen active" id="home"></section>' +
  ['trace-codec.js', 'storage.js', 'rewards-client.js', 'cloud-save.js'].map(file => `<script src="/${file}"></script>`).join('') + '</body></html>';
const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, 'http://local').pathname;
  if (pathname === '/') {response.writeHead(200, {'Content-Type': 'text/html'}); return response.end(html);}
  const file = path.resolve(root, '.' + pathname);
  if (!file.startsWith(root + path.sep)) {response.writeHead(403); return response.end();}
  fs.readFile(file, (error, body) => {response.writeHead(error ? 404 : 200, {'Content-Type': 'application/javascript'}); response.end(error ? '' : body);});
});
const deferred = () => {let resolve; const promise = new Promise(done => {resolve = done;}); return {promise, resolve};};
async function bounded(promise) {
  let timer;
  try {return await Promise.race([promise, new Promise((_, reject) => {timer = setTimeout(() => reject(Error('Held cloud request did not reach its barrier')), 10000);})]);}
  finally {clearTimeout(timer);}
}
let browser;
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({headless: true, executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox']});
  for (const modern of [false, true]) for (const divergent of [false, true]) {
    const context = await browser.newContext(), page = await context.newPage();
    const errors = [], calls = [], cloud = {revision: 1, snapshot: {[KEY]: '1234567890'}};
    const committed = deferred(), receipt = deferred(), receiptSettled = deferred();
    let holdNextWrite = true;
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.Telegram = {WebApp: {initData: 'user=' + encodeURIComponent(JSON.stringify({id: 101}))}};
      if (!localStorage.getItem('exact-ack-seeded')) {
        localStorage.setItem('exact-ack-seeded', 'yes');
        for (const [key, value] of Object.entries({mkty_life1_memory_code: '1234567890', mkty_cloud_revision: '1', mkty_cloud_dirty: 'yes', mkty_cloud_recovery: 'keep original backup'}))
          localStorage.setItem('mkty_account_v3_101:' + key, value);
      }
    });
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === origin) return route.continue();
      if (url.pathname !== '/functions/v1/rewards') return route.abort();
      const body = route.request().postDataJSON(); calls.push(body);
      const caps = modern ? {capabilities: {trace_codec: Codec.PROTOCOL}} : {};
      let result;
      if (body.action === 'session') result = {ok: true, ...caps, session: {token: 'synthetic:101', expires_at: Date.now() + 43200000}};
      else if (body.action === 'player') result = {ok: true, ...caps, player: {telegram_id: 101, moon_points: 1000, lives: 9, story_life: 2}};
      else {
        assert.equal(body.action, modern ? 'campaign.cloud.v2' : 'campaign.cloud');
        if (body.snapshot) {
          if (body.revision !== cloud.revision) result = {ok: true, conflict: true, revision: cloud.revision, snapshot: structuredClone(cloud.snapshot)};
          else {cloud.snapshot = Codec.unpackSnapshot(body.snapshot); cloud.revision++; result = {ok: true, revision: cloud.revision};}
        } else result = {ok: true, revision: cloud.revision, snapshot: modern ? Codec.packSnapshot(cloud.snapshot) : structuredClone(cloud.snapshot)};
        if (modern) result.protocol = Codec.PROTOCOL;
        if (body.snapshot && holdNextWrite) {
          holdNextWrite = false; committed.resolve(); await receipt.promise;
          // The old document has navigated away; its aborted request may no longer accept a reply.
          try {await route.fulfill({contentType: 'application/json', body: JSON.stringify(result)});} catch { /* expected navigation cancellation */ }
          finally {receiptSettled.resolve();}
          return;
        }
      }
      await route.fulfill({contentType: 'application/json', body: JSON.stringify(result)});
    });
    try {
      await page.goto(origin); await page.evaluate(() => MKTYCloud.load());
      await page.evaluate(() => {void MKTYCloud.flush();}); await bounded(committed.promise);
      assert.equal(cloud.revision, 2);
      assert.deepEqual(await page.evaluate(() => [localStorage.getItem('mkty_cloud_revision'), localStorage.getItem('mkty_cloud_dirty')]), ['1', 'yes']);
      if (divergent) {cloud.snapshot[KEY] = '2222222222'; cloud.revision++;}
      // This is a real document replacement while the old write receipt is held.
      await page.reload(); receipt.resolve(); await bounded(receiptSettled.promise);
      await page.evaluate(() => MKTYCloud.load());
      const state = await page.evaluate(() => ({code: localStorage.getItem('mkty_life1_memory_code'), revision: localStorage.getItem('mkty_cloud_revision'), dirty: localStorage.getItem('mkty_cloud_dirty'),
        backup: localStorage.getItem('mkty_cloud_recovery'), pending: localStorage.getItem('mkty_cloud_restore_pending'), conflict: !!document.querySelector('#cloudSaveStatus button'), persistent: MKTYStorage.persistent}));
      assert.deepEqual(state, {code: '1234567890', revision: divergent ? '1' : '2', dirty: divergent ? 'yes' : null,
        backup: 'keep original backup', pending: null, conflict: divergent, persistent: true});
      await page.evaluate(() => MKTYCloud.flush());
      assert.equal(calls.filter(call => call.snapshot).length, 1, 'reload neither reuploads an exact checkpoint nor overwrites divergent cloud data');
      assert.equal(cloud.snapshot[KEY], divergent ? '2222222222' : '1234567890'); assert.equal(cloud.revision, divergent ? 3 : 2);
      assert.deepEqual(errors, []);
    } finally {receipt.resolve(); await context.close();}
  }
  console.log('PASS: real browser reload after held legacy/compact write receipts acknowledges exact snapshots and preserves genuinely divergent cloud choices');
})().catch(error => {console.error(error); process.exitCode = 1;}).finally(async () => {
  await browser?.close(); if (server.listening) await new Promise(resolve => server.close(resolve));
});
