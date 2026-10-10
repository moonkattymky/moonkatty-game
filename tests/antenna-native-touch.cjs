/* Chromium native touchscreen regression on the unmodified game DOM/CSS.
   Run only in an environment where browser execution is permitted (CI for this patch).
   Route fulfillment serves checkout assets without an HTTP listener. CDP emits real touch
   gestures; this test never assigns the range value or dispatches input/touch DOM events.
   A fresh guest context seeds an ordinary pre-antenna checkpoint, never a live player save.
   This is Chromium coverage, not a claim of physical iPhone / Telegram WebKit verification. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const root = path.resolve(__dirname, '..');
const origin = 'https://moonkatty-input.test';
const types = {'.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.ico': 'image/x-icon'};
async function main() {
  const {chromium} = require('playwright');
  const out = process.env.MKTY_TEST_OUTPUT || fs.mkdtempSync(path.join(os.tmpdir(), 'mkty-antenna-touch-'));
  fs.mkdirSync(out, {recursive: true});
  const report = {engine: 'Chromium touchscreen/CDP', physicalIOSVerified: false, cases: []};
  let browser, page;
  try {
    browser = await chromium.launch({headless: true, executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox']});
    for (const [width, height] of [[320, 568], [390, 844]]) for (const variant of ['baseline', 'candidate']) {
      const context = await browser.newContext({viewport: {width, height}, isMobile: true, hasTouch: true,
        deviceScaleFactor: 2, serviceWorkers: 'block'});
      page = await context.newPage(); page.setDefaultTimeout(8000); page.setDefaultNavigationTimeout(15000);
      const errors = [], record = {width, height, variant, gestures: [], errors}; report.cases.push(record);
      page.on('pageerror', error => errors.push(error.message));
      await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.href === 'https://telegram.org/js/telegram-web-app.js') return route.fulfill({status: 200, contentType: 'application/javascript', body: ''});
        if (url.origin !== origin) return route.abort();
        const pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
        if (!/^\/(?:[^/]+|(?:art|locales\/runtime)\/[^/]+)$/.test(pathname) || pathname.split('/').some(x => x.startsWith('.'))) return route.abort();
        if (pathname.endsWith('.mp4')) return route.fulfill({status: 204, body: ''});
        let file = path.resolve(root, '.' + pathname);
        if (variant === 'baseline' && pathname === '/viewport.js') file = path.join(__dirname, 'fixtures/viewport-before-native-range.js');
        try {const body = await fs.promises.readFile(file); return route.fulfill({status: 200, contentType: types[path.extname(file)] || 'application/octet-stream', body});}
        catch {return route.fulfill({status: 404, body: ''});}
      });
      await page.addInitScript(require('./story-finale-fixture.cjs'));
      await page.addInitScript(({height}) => {
        // No authenticated Telegram identity, CloudStorage, backend, or production save is used.
        const listeners = {}, calls = [];
        window.__telegramTouchCalls = calls;
        const webApp = {initData: '', initDataUnsafe: {}, version: '8.0', platform: 'ios',
          viewportHeight: height, viewportStableHeight: height, isFullscreen: true,
          safeAreaInset: {top: 0, bottom: 0, left: 0, right: 0}, contentSafeAreaInset: {top: 46, bottom: 0, left: 0, right: 0},
          isVersionAtLeast() {return true;}, ready() {}, expand() {}, setHeaderColor() {}, setBackgroundColor() {}, setBottomBarColor() {},
          disableVerticalSwipes() {calls.push('disableVerticalSwipes');}, onEvent(n, fn) {(listeners[n] ||= []).push(fn);},
          HapticFeedback: {impactOccurred() {}, notificationOccurred() {}, selectionChanged() {}}};
        window.Telegram = {WebApp: webApp};
        localStorage.setItem('mkty_lang', 'en'); localStorage.setItem('mkty_test_no_pacing', 'yes');
        if (!localStorage.getItem('antenna_native_touch_fixture')) {
          localStorage.setItem('antenna_native_touch_fixture', 'yes');
          localStorage.setItem('mkty_current_chapter', '1');
          localStorage.setItem('mkty_campaign_checkpoint_1', JSON.stringify({version: 1, stage: 2,
            x: 84, y: 44, energy: ['1', '2', '3'], frequency: 68, dial: 20}));
        }
        window.__nativeTouchTrace = [];
        for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel', 'input', 'change']) {
          window.addEventListener(type, event => {
            if (event.target.id === 'frequencyDial') window.__nativeTouchTrace.push({type, trusted: event.isTrusted,
              prevented: event.defaultPrevented, value: Number(event.target.value)});
          }, {passive: true});
        }
      }, {height});
      const session = await context.newCDPSession(page);
      async function snapshot() {
        return page.evaluate(() => ({value: Number(document.getElementById('frequencyDial').value),
          readout: document.getElementById('frequencyValue').textContent,
          scroll: [scrollX, scrollY, document.documentElement.scrollTop, document.body.scrollTop,
            document.getElementById('app').scrollLeft, document.getElementById('app').scrollTop],
          stage: life1Stage, hold: signalHoldProgress, activeStick: l1JoystickActive,
          player: [l1PX, l1PY], trace: window.__nativeTouchTrace.slice()}));
      }
      async function gesture(start, end, {steps = 14, interval = 20} = {}) {
        const touch = p => [{id: 1, x: p.x, y: p.y, radiusX: 2, radiusY: 2, force: 1}];
        await session.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: touch(start)});
        for (let step = 1; step <= steps; step++) {
          const f = step / steps;
          await session.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: touch({x: start.x + (end.x - start.x) * f, y: start.y + (end.y - start.y) * f})});
          await page.waitForTimeout(interval);
        }
        await session.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
        await page.waitForTimeout(120);
      }
      async function drag(value, dy = 0, label = 'range drag') {
        assert(await page.locator('#mission1.active').isVisible(), label + ': real mission is active and visible');
        assert(await page.locator('#antennaPanel').isVisible(), label + ': actual antenna panel is visible');
        const state = await page.locator('#frequencyDial').evaluate(e => {
          const b = e.getBoundingClientRect();
          return {x: b.x, y: b.y, width: b.width, height: b.height, value: Number(e.value),
            touchAction: getComputedStyle(e).touchAction, hit: document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)?.id};
        });
        assert.equal(state.hit, 'frequencyDial', label + ': actual modal range is hit-testable');
        assert.equal(state.touchAction, 'none', 'production antenna touch-action remains unchanged');
        const x = v => state.x + 8 + (state.width - 16) * v / 100, y = state.y + state.height / 2;
        const before = await snapshot(); await page.evaluate(() => {window.__nativeTouchTrace = [];});
        await gesture({x: x(state.value), y}, {x: x(value), y: y + dy});
        const after = await snapshot();
        record.gestures.push({label, before: before.value, after: after.value, trace: after.trace, scroll: after.scroll});
        assert.deepEqual(after.scroll, before.scroll, label + ': page/body/app must not pan');
        assert(after.trace.some(e => e.type === 'touchmove'), label + ': genuine touchmove was delivered');
        assert(after.trace.every(e => e.trusted), label + ': every observed event is browser-generated');
        if (variant === 'candidate') assert(after.trace.filter(e => e.type === 'touchmove').every(e => !e.prevented), label + ': native default action must not be canceled');
        return after;
      }
      async function resumeFinale() {
        // Some chapter-entry surfaces open the plan. Use its real enabled finale CTA.
        if (await page.locator('#storyPlan.active').isVisible()) {
          assert(await page.evaluate(() => MKTYStory.coreReady(1)), 'existing fixture has completed all eight stages');
          await page.locator('#storyNext').tap();
        }
        await page.waitForFunction(() => document.getElementById('mission1').classList.contains('active'));
        await page.locator('#mission1.active').waitFor({state: 'visible'});
        await page.waitForTimeout(500); // Let the real production entrance animation finish.
      }
      async function enter() {await page.locator('#enterBtn').tap(); await resumeFinale();}
      async function openPanel() {
        assert(await page.locator('#life1ActionBtn').isEnabled(), 'checkpoint leaves the real antenna within reach');
        await page.locator('#life1ActionBtn').tap();
        await page.locator('#antennaPanel').waitFor({state: 'visible'});
        await page.waitForTimeout(400); // Includes production scrollIntoView settling.
      }
      await page.goto(origin + '/', {waitUntil: 'load'});
      await page.waitForFunction(() => window.MKTYCampaign && window.MKTYExperience && window.MKTYStory);
      await enter();
      const initialPosition = await page.evaluate(() => ({x: l1PX, y: l1PY, blocked: life1Blocked(l1PX, l1PY), distance: l1DistanceTo(document.getElementById('antennaHotspot'))}));
      assert.deepEqual([initialPosition.x, initialPosition.y], [84, 44], 'production collision adjustment preserves the seeded walkable position');
      assert.equal(initialPosition.blocked, false); assert(initialPosition.distance < .24, 'seeded position is within the real antenna interaction radius');
      record.initialPosition = initialPosition;
      await openPanel();
      assert.equal((await snapshot()).value, 20, 'real restored checkpoint starts at reported 138.0 MHz');
      assert.equal((await snapshot()).readout, '138.0');
      assert((await page.evaluate(() => __telegramTouchCalls)).includes('disableVerticalSwipes'));
      const right = await drag(78, 0, 'horizontal 20 to 78');
      if (variant === 'baseline') {
        assert(right.trace.some(e => e.type === 'touchmove' && e.prevented), 'unchanged live listener cancels the native drag');
        record.baselineStayedAt20 = right.value === 20;
        record.baselineChangedBy = right.value - 20;
        console.log(`BASELINE ${width}: value ${right.value}; canceled touchmove; physical iOS outcome is not inferred`);
        assert.deepEqual(errors, []); await context.close(); continue;
      }
      assert(right.value >= 72 && right.value <= 84, 'native horizontal drag moves the value substantially right');
      assert(right.trace.some(e => e.type === 'input'), 'native default action emits input');
      assert.equal(right.readout, (136 + right.value / 10).toFixed(1), 'game readout follows the native value');
      const diagonal = await drag(35, 24, 'diagonal 78 to 35');
      assert(diagonal.value >= 29 && diagonal.value <= 41, 'diagonal native drag moves the value left');
      const vertical = await drag(diagonal.value, -55, 'vertical drag');
      assert(Math.abs(vertical.value - diagonal.value) <= 2, 'vertical gesture does not corrupt a horizontal range');
      const tuned = await drag(68, 0, 'acquire carrier');
      assert(Math.abs(tuned.value - 68) <= 3, 'native thumb reaches the actual carrier');
      await page.locator('#tuneBtn').tap();
      await page.waitForFunction(() => signalHoldProgress > 0 && signalHoldProgress < 100);
      await page.locator('#antennaPanel .panel-close').tap();
      assert.equal(await page.evaluate(() => signalHoldTimer), null, 'close cancels the pending signal hold');
      assert.equal(await page.locator('#antennaPanel').isVisible(), false);
      await page.waitForTimeout(400);
      // The custom joystick still owns its gesture, releases cleanly, and never pans the page.
      const beforeStick = await snapshot(), joy = await page.locator('#life1Joystick').boundingBox();
      await gesture({x: joy.x + joy.width / 2, y: joy.y + joy.height / 2},
        {x: joy.x + joy.width / 2 - 20, y: joy.y + joy.height / 2}, {steps: 4, interval: 8});
      const afterStick = await snapshot();
      assert.deepEqual(afterStick.scroll, beforeStick.scroll, 'custom joystick retains bounce/scroll protection');
      assert.equal(afterStick.activeStick, false, 'custom joystick releases');
      assert(afterStick.player[0] < beforeStick.player[0], 'custom joystick still moves the real player');
      // Return through the ordinary chapter UI and restore its saved exploration checkpoint.
      await page.locator('#mission1 .chapter-menu').tap();
      await page.locator('#guideMissions').tap();
      await page.locator('[data-chapter="1"]').tap();
      await resumeFinale();
      assert.equal((await snapshot()).value, tuned.value, 'return retains the tuned value');
      assert.equal((await snapshot()).activeStick, false, 'navigation does not leave joystick suppression armed');
      await openPanel();
      const saved = await drag(42, 12, 'drag after close and return');
      assert(saved.value >= 36 && saved.value <= 48);
      await page.reload({waitUntil: 'load'}); await enter();
      assert.equal((await snapshot()).value, saved.value, 'reload restores the value written by the real oninput handler');
      await openPanel();
      const reloaded = await drag(68, 0, 'drag after reload');
      assert(Math.abs(reloaded.value - 68) <= 3);
      await page.locator('#tuneBtn').tap();
      await page.waitForFunction(() => signalHoldProgress > 0 && signalHoldProgress < 100);
      await page.waitForFunction(() => life1Stage === 3 && !document.getElementById('life1Complete').hidden, null, {timeout: 8000});
      assert.equal(await page.locator('#antennaCount').textContent(), '1/1', 'carrier lock progresses the actual finale');
      assert.equal(await page.locator('#antennaPanel').isVisible(), false);
      await page.locator('#returnBtn').tap();
      assert(await page.locator('#home').evaluate(e => e.classList.contains('active')), 'completion return control works');
      assert.deepEqual(errors, [], 'full game has no runtime errors');
      await page.screenshot({path: path.join(out, `antenna-${width}-complete.png`)});
      record.completed = true; console.log(`PASS native antenna touch ${width}x${height}`);
      await context.close();
    }
  } catch (error) {
    report.failure = error.stack; process.exitCode = 1; console.error(error);
    await page?.screenshot({path: path.join(out, 'antenna-touch-failure.png')}).catch(() => {});
  } finally {
    fs.writeFileSync(path.join(out, 'antenna-native-touch.json'), JSON.stringify(report, null, 2));
    await browser?.close();
  }
}
module.exports = {main};
if (require.main === module) main();
