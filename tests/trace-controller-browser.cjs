/* CI browser coverage for packed saves restored by the real legacy controllers. This suite uses
   explicit RAF timestamps and real DOM input events, never sleeps or wall-clock tick estimates.
   It is automatically discovered by tests/run-all.cjs. Run where Chromium is permitted. */
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const codec = require('../trace-codec.js');
const {KEY, initial, verify, verifyRestore, tickRow, expectedTail, firstFrames, movingFrames} = require('./trace-controller-helper.cjs');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://local').pathname;
  const file = path.resolve(root, '.' + pathname);
  if (!file.startsWith(root + path.sep)) {res.writeHead(403); return res.end();}
  fs.readFile(file, (error, body) => {
    res.writeHead(error ? 404 : 200, {'Content-Type': ({'.html': 'text/html', '.js': 'application/javascript'})[path.extname(file)] || 'application/octet-stream'});
    res.end(error ? '' : body);
  });
});
let browser;
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({headless: true, executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox']});
  for (const kind of ['field', 'flight']) {
    const errors = [];
    const page = await browser.newPage({viewport: {width: 900, height: 900}, reducedMotion: 'reduce'});
    page.on('pageerror', error => errors.push(error.message));
    // The fixture is entirely local, even if a future asset accidentally gains a remote URL.
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const {saved, original, marker} = initial(kind, codec);
    await page.goto(origin + '/tests/fixtures/trace-controller-rollback.html?kind=' + kind);
    await page.evaluate(({key, saved}) => {
      localStorage.setItem(key, JSON.stringify(saved));
      traceRollback.open();
    }, {key: KEY, saved});
    const snapshot = () => page.evaluate(() => traceRollback.api.snapshot());
    const persisted = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
    const frame = now => page.evaluate(now => traceRollback.frame(now), now);
    const resume = () => page.locator(kind === 'flight' ? '[data-exp-dialog="resume"]' : '#fieldResume').dispatchEvent('click');
    assert.equal(await page.evaluate(() => typeof window.MKTYTraceCodec), 'undefined', 'old browser has no codec');
    verifyRestore(kind, await snapshot(), saved);
    verify(await snapshot(), marker, original, [], codec, kind + ' browser restore');
    await resume();
    for (const now of firstFrames) await frame(now);
    verify(await snapshot(), marker, original, [tickRow(kind, 3)], codec, kind + ' browser raw RLE');
    await page.keyboard.down('ArrowRight');
    if (kind === 'flight') await page.keyboard.down('ShiftLeft');
    for (const now of movingFrames) await frame(now);
    await page.keyboard.up('ArrowRight');
    if (kind === 'flight') await page.keyboard.up('ShiftLeft');
    await page.keyboard.press(kind === 'flight' ? 'KeyQ' : 'Space');
    await frame(220);
    const tail = expectedTail(kind);
    verify(await snapshot(), marker, original, tail, codec, kind + ' browser input');
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    verify(await persisted(), marker, original, tail, codec, kind + ' browser blur save');
    // Add an unsaved tick after blur so the following real navigation must persist through
    // pagehide itself; a test which only reloads an already-saved checkpoint can miss that bug.
    await resume();
    await frame(100);
    await frame(120);
    const beforeReload = structuredClone(tail);
    beforeReload.at(-1)[1]++;
    verify(await snapshot(), marker, original, beforeReload, codec, kind + ' browser unsaved continuation');
    verify(await persisted(), marker, original, tail, codec, kind + ' browser before pagehide');
    const checkpointBeforeReload = await snapshot();
    // A real navigation invokes the old pagehide handler and loads a new document/controller.
    await page.reload();
    assert.equal(await page.evaluate(() => typeof window.MKTYTraceCodec), 'undefined');
    verifyRestore(kind, await snapshot(), checkpointBeforeReload);
    verify(await snapshot(), marker, original, beforeReload, codec, kind + ' browser page reload');
    await resume();
    await frame(100);
    await frame(120);
    const afterReload = structuredClone(beforeReload);
    afterReload.at(-1)[1]++;
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    verify(await persisted(), marker, original, afterReload, codec, kind + ' browser resumed tail RLE');
    // Simulate the new bundle reading the old bundle's hybrid checkpoint in an actual browser.
    await page.addScriptTag({url: origin + '/trace-codec.js'});
    const decoded = await page.evaluate(key => MKTYTraceCodec.unpackTrace(JSON.parse(localStorage.getItem(key)).trace), KEY);
    assert.deepEqual(decoded, [...original, ...afterReload], kind + ' browser codec decodes exact history');
    assert.deepEqual(errors, [], kind + ' browser runtime errors');
    await page.close();
  }
  console.log('PASS: browser legacy field/flight packed-prefix restore, DOM input/RLE/action append, blur/pagehide persistence, real reload and browser decode');
})().catch(error => {console.error(error); process.exitCode = 1;}).finally(async () => {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
});
