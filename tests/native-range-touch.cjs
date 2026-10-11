/* Native touchscreen regression for 14 selected current-route ranges in seven scenes.
 * Run only where browser execution is authorized (GitHub CI for this change).
 * Uses the complete, unchanged checkout DOM/CSS and trusted Chromium CDP touch events.
 * No HTTP listener, production URL, player identity, synthetic input event, range .fill(),
 * range assignment or CSS override. Fixture checkpoints seed prerequisites, never outcomes.
 * This is Chromium coverage, not physical-device or Telegram WebKit certification.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {scenarios, profile} = require('./native-range-touch-fixture.cjs');
const assertFieldControlReachable = require('./field-control-helper.cjs');
const root = path.resolve(__dirname, '..');
const origin = 'https://moonkatty-ranges.test';
const types = {'.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.ico': 'image/x-icon'};

// Optional test-only extension keeps edition-1 scenarios separate from the original 13.
async function runCase(browser, spec, record, out, extension = {}) {
  const context = await browser.newContext({viewport: {width: spec.width, height: spec.height}, isMobile: true,
    hasTouch: true, deviceScaleFactor: 2, serviceWorkers: 'block'});
  const page = await context.newPage();
  page.setDefaultTimeout(8000); page.setDefaultNavigationTimeout(15000);
  page.on('pageerror', error => record.errors.push(error.message));
  try {
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      // Telegram's remote script is aborted too; only the guest init-script stub exists.
      if (url.origin !== origin) {record.blockedExternalRequests++; return route.abort();}
      if (!['GET', 'HEAD'].includes(route.request().method())) return route.abort();
      const name = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
      if (!/^\/(?:[^/]+|(?:art|locales\/runtime)\/[^/]+)$/.test(name) || name.split('/').some(x => x.startsWith('.'))) return route.abort();
      if (name.endsWith('.mp4')) return route.fulfill({status: 204, body: ''});
      const file = path.resolve(root, '.' + name);
      if (!file.startsWith(root + path.sep)) return route.abort();
      try {return route.fulfill({status: 200, contentType: types[path.extname(file)] || 'application/octet-stream', body: await fs.promises.readFile(file)});}
      catch {return route.fulfill({status: 404, body: ''});}
    });
    await page.addInitScript(({records, height, onceKey}) => {
      if (!onceKey || !localStorage.getItem(onceKey)) {
        for (const [key, value] of Object.entries(records)) localStorage.setItem(key, value);
        if (onceKey) localStorage.setItem(onceKey, 'yes');
      }
      window.Telegram = {WebApp: {initData: '', initDataUnsafe: {}, version: '8.0', platform: 'ios',
        viewportHeight: height, viewportStableHeight: height, isFullscreen: true,
        safeAreaInset: {top: 0, bottom: 0, left: 0, right: 0}, contentSafeAreaInset: {top: 46, bottom: 0, left: 0, right: 0},
        isVersionAtLeast() {return true;}, ready() {}, expand() {}, setHeaderColor() {}, setBackgroundColor() {}, setBottomBarColor() {},
        disableVerticalSwipes() {}, onEvent() {}, HapticFeedback: {impactOccurred() {}, notificationOccurred() {}, selectionChanged() {}}}};
      window.__nativeRangeTrace = [];
      // Window bubbling observes defaultPrevented after production document listeners.
      for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel', 'input', 'change']) {
        window.addEventListener(type, event => {
          if (!event.target.matches?.('input[type="range"]')) return;
          const touch = event.touches?.[0] || event.changedTouches?.[0];
          window.__nativeRangeTrace.push({type, trusted: event.isTrusted, prevented: event.defaultPrevented,
            id: event.target.id, field: event.target.dataset.fieldSlider, index: event.target.dataset.index,
            value: Number(event.target.value), x: touch?.clientX, y: touch?.clientY});
        }, {passive: true});
      }
    }, {records: extension.profile ? extension.profile(spec) : profile(spec), height: spec.height, onceKey: extension.onceKey || ''});
    const session = await context.newCDPSession(page);
    await page.goto(origin + '/', {waitUntil: 'load'});
    await page.waitForFunction(() => window.MKTYCampaign && window.MKTYField && window.MKTYStory && window.MKTYI18n);
    assert.equal(await page.evaluate(() => window.Telegram.WebApp.initData), '', 'fresh anonymous guest only');
    if (spec.mechanic && !spec.spatial) {
      // Same public field entry and model creation as the established field UI fixtures.
      await page.evaluate(({mechanic}) => {
        MKTYField.open({chapter: mechanic, id: 0, fieldStage: 3, seed: 21,
          title: ['Проверка сенсорного ввода', 'Native touch review'],
          save: state => {window.__nativeFieldSaved = structuredClone(state);},
          complete: () => {throw new Error('Touch-only fixture must never complete a mission');}, exit: () => show('chapters')}, null);
      }, spec);
    } else {
      await page.locator('#enterBtn').tap();
      if (await page.locator('#storyPlan.active').isVisible()) {
        assert(await page.evaluate(n => MKTYStory.coreReady(n), spec.chapter), 'fixture has all eight prerequisites');
        await page.locator('#storyNext').tap();
      }
    }
    if (spec.mechanic) {
      await page.locator('#fieldResume').tap();
      assert.equal(await page.locator('#fieldMission').getAttribute('data-chapter'), String(spec.mechanic));
      assert.equal(await page.evaluate(() => MKTYField.snapshot().version), 2, 'current field model, including trim');
      if (spec.spatial) {
        assert.equal(await page.locator('#fieldProgress').textContent(), '02 / 02', 'real chapter 8 second-phase route');
        assert.equal(await page.evaluate(() => MKTYSpatialFinale.read(8).phase), 1);
      }
    } else if (spec.chapter === 5) await page.locator('#reactorResume5').tap();
    else if (spec.chapter === 6) await page.locator('#lfResume6').tap();
    else if (await page.locator('#chapterGuide').isVisible()) await page.locator('#guideResume').tap();
    await page.waitForTimeout(450); // Real entrance animations, no replacement CSS.
    if (spec.lang === 'ar') {
      await page.waitForFunction(() => document.documentElement.lang === 'ar' && document.documentElement.dir === 'rtl');
      record.rtl = true;
    }

    async function sceneReady() {
      if (extension.assertScene) await extension.assertScene(page, spec);
      assert.equal(await page.locator('.screen.active').getAttribute('id'), spec.mechanic ? 'fieldMission' : 'mission' + spec.chapter);
      if (!spec.mechanic) {
        if (spec.chapter === 3) assert.equal(await page.locator('#mission3').getAttribute('data-phase'), 'fuel');
        if (spec.chapter === 4) assert(await page.evaluate(() => descentActive4 && alt4 > 0 && !MKTYExperience.paused));
        if (spec.chapter === 5) {
          assert.equal(await page.locator('#mission5').getAttribute('data-reactor-phase'), 'balance');
          assert.equal(await page.locator('#mission5').getAttribute('data-paused'), 'false');
        }
        if (spec.chapter === 6) assert.equal(await page.locator('#mission6').getAttribute('data-flight-phase'), spec.phase);
      } else assert.equal(await page.locator('#fieldDialog').isVisible(), false);
    }
    const scrollState = () => page.evaluate(() => ({outer: [scrollX, scrollY, document.documentElement.scrollLeft,
      document.documentElement.scrollTop, document.body.scrollLeft, document.body.scrollTop,
      document.getElementById('app').scrollLeft, document.getElementById('app').scrollTop],
      deck: document.querySelector('#fieldMission .field-deck')?.scrollTop || 0}));
    async function modelMatches(control, value) {
      if (extension.assertModel) return extension.assertModel(page, spec, control, value);
      const expectedReadout = ['reactor', 'liftoff', 'descent'].includes(control.kind) ? value + '%' : String(value);
      assert.equal(await page.locator(control.readout).textContent(), expectedReadout, control.selector + ': real readout follows native input');
      if (control.kind === 'field') {
        const result = await page.evaluate(({key, index, mechanic, spatial}) => {
          const state = MKTYField.snapshot(), saved = spatial ? MKTYSpatialFinale.read(8).checkpoint : window.__nativeFieldSaved;
          const get = s => key === 'valve' ? s.valves[Number(index)] : mechanic === 8 ? s.angles[s.station] : s[key];
          return {model: get(state), saved: get(saved), telemetry: [...document.querySelectorAll('#fieldTelemetry strong')].map(e => e.textContent),
            expectedTelemetry: mechanic === 5 ? FieldRules.readouts(state).map(v => v.toFixed(1) + ' ±' + FieldRules.layout(state).tolerance.toFixed(1)) : null};
        }, {...control, spatial: !!spec.spatial});
        assert.equal(result.model, value, 'field model receives the native event');
        assert.equal(result.saved, value, 'field save callback receives the same native value');
        if (result.expectedTelemetry) assert.deepEqual(result.telemetry, result.expectedTelemetry, 'thermal telemetry matches all three model loops');
      } else {
        const key = control.kind === 'reactor' ? 'mkty_reactor5_checkpoint_v2' : control.kind === 'liftoff' ? 'mkty_liftoff6_checkpoint_v1' : 'mkty_campaign_checkpoint_' + spec.chapter;
        // Observe real autosave; never invoke a save or assign model/DOM values to make it pass.
        await page.waitForFunction(({key, control, value}) => {
          const cp = JSON.parse(localStorage.getItem(key) || 'null');
          return cp && (control.kind === 'mix' ? cp.mix[control.index] : cp[control.key || 'power']) === value;
        }, {key, control, value}, {timeout: 4000});
        if (control.kind === 'mix') assert.equal(await page.locator('#mixTotal3').textContent(), await page.evaluate(() => String(['mixO2', 'mixFuel', 'mixCool'].reduce((sum, id) => sum + Number(document.getElementById(id).value), 0))));
      }
    }
    async function geometry(control) {
      await sceneReady();
      const locator = page.locator(control.selector);
      assert(await locator.isEnabled(), control.selector + ': enabled in its actual active phase');
      await locator.scrollIntoViewIfNeeded();
      // Center within the real scroll ancestor, including compact thermal decks.
      await locator.evaluate(e => e.scrollIntoView({block: 'center', inline: 'nearest', behavior: 'instant'}));
      await page.waitForTimeout(100);
      if (control.kind === 'field') await assertFieldControlReachable(locator, spec.name + ' ' + control.selector);
      const state = await locator.evaluate((e, thumb) => {
        const b = e.getBoundingClientRect(), css = getComputedStyle(e), min = Number(e.min), max = Number(e.max), value = Number(e.value);
        const left = b.x + parseFloat(css.borderLeftWidth) + parseFloat(css.paddingLeft);
        const width = b.width - parseFloat(css.borderLeftWidth) - parseFloat(css.borderRightWidth) - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight);
        const x = left + thumb / 2 + (width - thumb) * (value - min) / (max - min), y = b.y + b.height / 2;
        return {left, width, x, y, min, max, value, direction: css.direction, touchAction: css.touchAction,
          hit: document.elementFromPoint(x, y) === e, rect: b.toJSON()};
      }, control.thumb);
      assert(state.hit, control.selector + ': real thumb is hit-testable, not covered');
      assert(state.width > control.thumb + 24, control.selector + ': sufficient actual drag travel');
      assert.equal(state.direction, 'ltr', 'production numeric ranges stay left-to-right, including Arabic');
      assert.equal(state.touchAction, control.touchAction, 'test preserves production touch-action');
      return state;
    }
    async function drag(control, fraction, label, vertical = false) {
      const state = await geometry(control), beforeScroll = await scrollState();
      const target = state.min + fraction * (state.max - state.min);
      const end = vertical ? {x: state.x, y: state.y + (state.y > 100 ? -55 : 55)} :
        {x: state.left + control.thumb / 2 + (state.width - control.thumb) * fraction, y: state.y};
      assert(end.y > 0 && end.y < spec.height, 'bounded touch endpoint stays inside viewport');
      const traceStart = await page.evaluate(() => {window.__nativeRangeTrace = []; return performance.now();});
      const points = p => [{id: 1, x: p.x, y: p.y, radiusX: 2, radiusY: 2, force: 1}];
      await session.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: points(state)});
      const atStart = Number(await page.locator(control.selector).inputValue());
      assert(Math.abs(atStart - state.value) <= 1, label + ': touch begins on current thumb, not a track jump');
      for (let step = 1; step <= 12; step++) {
        const f = step / 12;
        await session.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: points({x: state.x + (end.x - state.x) * f, y: state.y + (end.y - state.y) * f})});
        await page.waitForTimeout(20);
      }
      await session.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
      await page.waitForTimeout(120);
      const after = Number(await page.locator(control.selector).inputValue()), trace = await page.evaluate(() => window.__nativeRangeTrace.slice()), afterScroll = await scrollState();
      record.gestures.push({label, selector: control.selector, from: state.value, to: after, target, vertical, traceStart,
        trace, beforeScroll, afterScroll, rect: state.rect});
      assert(trace.some(e => e.type === 'touchstart'), label + ': trusted touchstart observed');
      assert(trace.some(e => e.type === 'touchmove'), label + ': actual touchmove observed');
      assert(trace.some(e => ['touchend', 'touchcancel'].includes(e.type)), label + ': native gesture terminates');
      assert(trace.every(e => e.trusted), label + ': every observed touch/input/change event is trusted');
      assert(trace.filter(e => e.type.startsWith('touch')).every(e => !e.prevented), label + ': production never cancels native touch default');
      assert.deepEqual(afterScroll.outer, beforeScroll.outer, label + ': document/body/app must not pan');
      if (vertical) {
        // pan-y deliberately permits deck scrolling or browser touchcancel. Do not assert
        // a stationary deck, or require input events when its horizontal value is unchanged.
        assert(Math.abs(after - state.value) <= 1, label + ': vertical gesture preserves horizontal range');
      } else {
        assert.deepEqual(afterScroll.deck, beforeScroll.deck, label + ': horizontal range drag does not move its deck');
        const tolerance = Math.max(2, (state.max - state.min) * .06);
        assert(Math.abs(after - target) <= tolerance, label + ': thumb reaches requested fraction within 6% (at least two steps)');
        assert(Math.abs(after - state.value) >= (state.max - state.min) * .20, label + ': value changes by at least 20% of range');
        const input = trace.filter(e => e.type === 'input');
        assert(new Set(input.map(e => e.value)).size >= 2, label + ': genuine drag generates multiple distinct native inputs');
        assert(trace.some(e => e.type === 'change'), label + ': native drag commits a change');
        assert(!trace.some(e => e.type === 'touchcancel'), label + ': horizontal native drag is not canceled');
      }
      await modelMatches(control, after);
      await sceneReady();
      return after;
    }
    async function bothWays(control, prefix) {
      const fraction = await page.locator(control.selector).evaluate(e => (Number(e.value) - Number(e.min)) / (Number(e.max) - Number(e.min)));
      // A fresh valve C starts at 75: choose the farther endpoint first so both
      // movements remain substantial, without rewriting the initial model/DOM.
      const directions = fraction >= .5 ? [[.18, 'left'], [.82, 'right']] : [[.82, 'right'], [.18, 'left']];
      for (const [target, direction] of directions) await drag(control, target, prefix + ' ' + direction);
      record.controlPairs++;
    }
    for (const control of spec.controls) await bothWays(control, 'initial ' + control.selector);
    if (extension.afterInitial) await extension.afterInitial({page, spec, record, sceneReady, modelMatches, bothWays});
    if (spec.resume) {
      const reactor = spec.chapter === 5;
      await page.locator(reactor ? '#reactorHelp5' : '#liftoffHelp6').tap();
      assert(await page.locator(reactor ? '#reactorOverlay5' : '#liftoffGuide6').isVisible(), 'real pause surface opens');
      assert.equal(await page.locator('#mission' + spec.chapter).getAttribute('data-paused'), 'true');
      if (reactor) assert(await page.locator('#reactorWorkspace5').evaluate(e => e.inert), 'pause makes the real reactor workspace inert');
      else assert(await page.locator('#lfThrottle6').isDisabled(), 'pause disables the flight throttle');
      const paused = await page.locator(spec.controls[0].selector).inputValue();
      await page.waitForTimeout(150);
      assert.equal(await page.locator(spec.controls[0].selector).inputValue(), paused, 'pause preserves range setting');
      await page.locator(reactor ? '#reactorResume5' : '#lfResume6').tap();
      for (const control of spec.controls) await bothWays(control, 'after pause/resume ' + control.selector);
      record.pauseResume = true;
    }
    if (spec.mechanic === 8) {
      const before = await page.evaluate(() => MKTYField.snapshot().angles);
      const station = page.locator('[data-field-action="station"][data-value="1"]');
      await station.scrollIntoViewIfNeeded(); await station.tap();
      assert.equal(await page.evaluate(() => MKTYField.snapshot().station), 1, 'real station switch rebuilds controls');
      await bothWays(spec.controls[0], 'after station switch');
      assert.equal(await page.evaluate(() => MKTYField.snapshot().angles[0]), before[0], 'new array tuning preserves previous array');
      record.stationSwitch = true;
    }
    if (spec.mechanic) {
      const control = spec.controls.at(-1), state = await geometry(control);
      await drag(control, (state.value - state.min) / (state.max - state.min), 'vertical field gesture', true);
    }
    assert.deepEqual(record.errors, [], 'unchanged game emits no page errors');
    await page.screenshot({path: path.join(out, spec.name + '.png')});
    record.passed = true;
    console.log(`PASS ${spec.name}: ${record.controlPairs} bidirectional controls, ${record.gestures.length} trusted gestures`);
  } catch (error) {
    record.failure = error.stack;
    await page.screenshot({path: path.join(out, spec.name + '-failure.png')}).catch(() => {});
    throw error;
  } finally {await context.close();}
}
async function main() {
  const {chromium} = require('playwright');
  const out = process.env.MKTY_TEST_OUTPUT || fs.mkdtempSync(path.join(os.tmpdir(), 'mkty-native-ranges-'));
  fs.mkdirSync(out, {recursive: true});
  const report = {engine: 'Chromium touchscreen/CDP', physicalIOSVerified: false, productionDOMAndCSS: true,
    plannedScenarios: scenarios.length, uniqueCurrentRanges: 14, limitations: ['Physical iOS/Android and Telegram WebKit not verified',
      'Legacy-route freq8/phase8/navDial9 excluded', 'Finales use 390x844; compact 568x320 coverage is for field scenes'], cases: []};
  let browser, watchdog;
  try {
    browser = await chromium.launch({headless: true, executablePath: process.env.CHROMIUM_PATH, timeout: 30000, args: ['--no-sandbox']});
    watchdog = setTimeout(() => {
      report.deadlineExceeded = true;
      browser.close().catch(() => {});
    }, 180000); // One bounded 3-minute browser suite, not an open-ended solver.
    for (const spec of scenarios) {
      const record = {name: spec.name, width: spec.width, height: spec.height, lang: spec.lang || 'en',
        errors: [], gestures: [], controlPairs: 0, blockedExternalRequests: 0};
      report.cases.push(record);
      await runCase(browser, spec, record, out);
    }
    report.passedScenarios = report.cases.filter(c => c.passed).length;
    report.controlPairs = report.cases.reduce((n, c) => n + c.controlPairs, 0);
    report.gestures = report.cases.reduce((n, c) => n + c.gestures.length, 0);
    assert.equal(report.passedScenarios, 13); assert.equal(report.controlPairs, 34); assert.equal(report.gestures, 76);
    console.log(`PASS native ranges: ${report.passedScenarios} scenarios, 14 unique controls, ${report.gestures} native gestures`);
  } catch (error) {report.failure = error.stack; process.exitCode = 1; console.error(error);}
  finally {clearTimeout(watchdog); fs.writeFileSync(path.join(out, 'native-range-touch.json'), JSON.stringify(report, null, 2)); await browser?.close();}
}
module.exports = {main, runCase};
if (require.main === module) main();
