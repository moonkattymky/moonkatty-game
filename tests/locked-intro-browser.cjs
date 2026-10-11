/* Real index.html regression, with real pacing and Playwright's clock (no pace-hook).
   LIFE1 is a seeded completed legacy save, not an end-to-end playthrough. Telegram
   referral cases use synthetic identity/HTTP responses only; no live backend is used.
   run-all.cjs discovers this file. Run only where browser/server use is permitted. */
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const NOW = Date.parse('2026-10-10T23:59:50Z');
const UNLOCK = Date.parse('2026-10-11T00:00:00Z');
const COMPLETED = Date.parse('2026-10-10T23:00:00Z');
const types = {'.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp4': 'video/mp4'};
const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, 'http://local').pathname;
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep)) {response.writeHead(403); return response.end();}
  fs.readFile(file, (error, body) => {
    response.writeHead(error ? 404 : 200, {'Content-Type': types[path.extname(file)] || 'application/octet-stream'});
    response.end(error ? '' : body);
  });
});
let browser, origin, activePage;
const errors = [];
const report = {scenario: 'startup', step: 'server', errors};
async function bounded(promise, ms, label) {
  let timer;
  try {return await Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(label + ' timed out after ' + ms + 'ms')), ms);
  })]);} finally {clearTimeout(timer);}
}
async function diagnostics(error) {
  console.error(error); process.exitCode = 1;
  report.failure = {message: error.message, stack: error.stack};
  const out = process.env.MKTY_TEST_OUTPUT || fs.mkdtempSync(path.join(os.tmpdir(), 'mkty-locked-intro-'));
  fs.mkdirSync(out, {recursive: true});
  const file = path.join(out, 'locked-intro-failure.json');
  fs.writeFileSync(file, JSON.stringify(report, null, 2));
  if (activePage && !activePage.isClosed()) {
    try {report.screen = await bounded(active(activePage), 3000, 'failure screen inspection');}
    catch (inspectionError) {report.inspectionError = inspectionError.message;}
    try {
      await activePage.screenshot({path: path.join(out, 'locked-intro-failure.png'), timeout: 5000});
      report.screenshot = 'locked-intro-failure.png';
    } catch (captureError) {report.captureError = captureError.message;}
  } else report.captureError = 'No open browser page was available.';
  fs.writeFileSync(file, JSON.stringify(report, null, 2));
  console.error('Failure diagnostics: ' + file);
}
async function closeFixture(context) {
  assert.deepEqual(errors, []);
  await context.close();
}
async function fixture({scenario, now = NOW, completedAt = COMPLETED, lives = 9, referral = null} = {}) {
  report.scenario = scenario; report.step = 'fixture';
  const context = await browser.newContext({viewport: {width: 390, height: 844}, reducedMotion: 'reduce', serviceWorkers: 'block'});
  const page = await context.newPage(), calls = [];
  activePage = page;
  page.setDefaultTimeout(8000);
  page.setDefaultNavigationTimeout(20000);
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install({time: new Date(now - 1000)});
  await page.clock.pauseAt(new Date(now));
  await page.addInitScript(({completedAt, lives, now, referral, unlock}) => {
    const user = {id: 90102, first_name: 'Fixture'};
    if (referral) window.Telegram = {WebApp: {
      initData: 'user=' + encodeURIComponent(JSON.stringify(user)), initDataUnsafe: {user}, ready() {}, expand() {}
    }};
    const prefix = referral ? 'mkty_account_v3_90102:' : '';
    localStorage.setItem('mkty_lang', 'en');
    localStorage.setItem('mkty_light_fx', 'yes');
    const save = {
      mkty_life1: 'complete', mkty_life1_awarded: 'yes', mkty_life1_completed_at: String(completedAt),
      mkty_life1_code_presented: 'yes', mkty_life1_code_remaining_ms: '0',
      mkty_life1_memory_code: '1234567890', mkty_points: '500', mkty_global_lives: String(lives),
      mkty_story_plan_1_v1: JSON.stringify({version: 1, edition: 1, n: 1, seed: 1,
        phase: 'complete', done: [0, 1, 2, 3, 4, 5, 6, 7], tasks: {}, coreSeconds: 0, createdAt: completedAt})
    };
    if (!lives) save.mkty_life_restore_at = String(now);
    if (referral) save.mkty_pace_server = JSON.stringify({next_life: 2, unlock_at: new Date(unlock).toISOString(), skips: 1, locked: true});
    for (const [key, value] of Object.entries(save)) localStorage.setItem(prefix + key, value);
  }, {completedAt, lives, now, referral, unlock: UNLOCK});
  // Only the checkout may reach the network; every external request is fulfilled or blocked.
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === origin) return route.continue();
    if (url.hostname === 'telegram.org') return route.fulfill({contentType: 'application/javascript', body: ''});
    if (!referral || url.pathname !== '/functions/v1/rewards') return route.abort();
    const body = route.request().postDataJSON() || {}; calls.push(body);
    let result = {ok: false, error: 'fixture_offline'};
    if (body.action === 'session') result = {ok: true, session: {token: 'synthetic-session', expires_at: UNLOCK + 86400000}};
    if (body.action === 'player') result = {ok: true,
      player: {telegram_id: 90102, moon_points: 500, lives: 9, story_life: 1},
      pace: {next_life: 2, unlock_at: new Date(UNLOCK).toISOString(), skips: 1, locked: true}};
    if (body.action === 'chapter.skip') result = referral === 'success'
      ? {ok: true, pace: {next_life: 2, unlock_at: null, skips: 0, locked: false}}
      : {ok: false, error: 'no_skips'};
    await route.fulfill({contentType: 'application/json', body: JSON.stringify(result)});
  });
  await page.goto(origin, {waitUntil: 'domcontentloaded'});
  await page.evaluate(() => mktyAuthPromise);
  assert.equal(await page.evaluate(() => MKTYPace.bypass()), false, 'production pacing is enabled');
  assert.equal(await page.evaluate(() => localStorage.getItem('mkty_life2')), null, 'LIFE2 was not seeded');
  return {page, context, calls};
}
const active = page => page.locator('.screen.active').getAttribute('id');
async function reviewLife1(page) {
  report.step = 'review completed LIFE1';
  if (await active(page) === 'home') await page.locator('#missionsBtn').click();
  assert.equal(await active(page), 'chapters');
  await page.locator('#chapterList [data-chapter="1"]').click();
  assert.equal(await active(page), 'mission1');
  assert(await page.locator('#life1Complete').isVisible(), 'seeded completion is restored by the real controller');
  assert(await page.locator('#continueLife2Btn').isEnabled());
}
async function intro(page) {
  await reviewLife1(page);
  report.step = 'Continue to LIFE2 cinematic';
  await page.locator('#continueLife2Btn').click();
  assert.equal(await active(page), 'life2', 'the rendered Continue button starts the cinematic');
  assert(await page.locator('#life2SkipBtn').isVisible());
  assert.equal(await page.locator('#paceDialog').isVisible(), false, 'the gate is reached by cinematic completion');
}
async function lockedIntro(page, title = 'Next chapter in') {
  await intro(page);
  report.step = 'Skip into pacing gate';
  await page.locator('#life2SkipBtn').click();
  assert(await page.locator('#paceDialog').isVisible());
  assert.equal(await page.locator('#paceTitle').innerText(), title);
  assert.equal(await active(page), 'chapters', 'denied cinematic must leave a usable destination behind the modal');
  assert.equal(await page.evaluate(() => localStorage.getItem('mkty_story_plan_2_v1')), null, 'denial must not start LIFE2');
}
async function dismiss(page, escape = false) {
  report.step = escape ? 'dismiss with native Escape' : 'dismiss with Got it';
  if (escape) await page.keyboard.press('Escape');
  else await page.locator('#paceCancel').click();
  assert.equal(await page.locator('#paceDialog').isVisible(), false);
  assert.equal(await active(page), 'chapters');
  assert(await page.locator('#chapterList [data-chapter="1"]').isEnabled());
  assert(await page.locator('#chapterList [data-chapter="2"]').isEnabled());
  assert(await page.locator('#chaptersBack').isVisible());
}
async function staleCinematicEvents(page) {
  // Deliberately deliver stale DOM events after cleanup, without replacing any callback.
  await page.locator('#life2SkipBtn').dispatchEvent('click');
  await page.locator('#life2Video').dispatchEvent('ended');
  await page.locator('#life2Video').dispatchEvent('error');
}
async function run() {
  await bounded(new Promise(resolve => server.listen(0, '127.0.0.1', resolve)), 10000, 'test server startup');
  origin = 'http://127.0.0.1:' + server.address().port;
  report.step = 'browser startup';
  browser = await chromium.launch({headless: true, executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'], timeout: 20000});
  // Both native dismissal paths, repeat entry, and the rendered Daily shortcut.
  {
    const {page, context} = await fixture({scenario: 'Got it, native Escape, Daily and home gate'});
    await lockedIntro(page);
    assert.equal(await page.locator('#paceCancel').innerText(), 'GOT IT');
    await dismiss(page);
    await lockedIntro(page); await dismiss(page, true);
    await lockedIntro(page);
    await page.locator('#paceGo').click();
    assert.equal(await active(page), 'home');
    assert.equal(await page.locator('#paceDialog').isVisible(), false);
    await page.clock.runFor(100);
    assert(await page.locator('#dailyOps').isVisible());
    // Non-cinematic home entry retains its existing destination after dismissal.
    await page.locator('#enterBtn').click();
    assert(await page.locator('#paceDialog').isVisible());
    await page.keyboard.press('Escape');
    assert.equal(await active(page), 'home');
    await closeFixture(context);
  }
  // The chapter-list and invite-sheet exits are usable after the same locked intro.
  {
    const {page, context} = await fixture({scenario: 'invite sheet and chapter-list gate'});
    await lockedIntro(page); await page.locator('#paceInvite').click();
    assert(await page.locator('#mkInviteSheet').isVisible());
    assert.equal(await page.locator('#paceDialog').isVisible(), false);
    await page.locator('#mkInviteSheet .mk-invite-close').click();
    assert.equal(await active(page), 'chapters');
    await page.locator('#chapterList [data-chapter="2"]').click();
    assert(await page.locator('#paceDialog').isVisible());
    await dismiss(page);
    await page.locator('#chaptersBack').click(); assert.equal(await active(page), 'home');
    await closeFixture(context);
  }
  // No-lives gate is distinct from the day gate, and supports both dismissals.
  for (const escape of [false, true]) {
    const {page, context} = await fixture({scenario: 'no lives, ' + (escape ? 'Escape' : 'Got it'), completedAt: COMPLETED - 86400000, lives: 0});
    await lockedIntro(page, 'Out of lives. Next life in'); await dismiss(page, escape);
    await page.locator('#chaptersBack').click(); assert.equal(await active(page), 'home');
    await closeFixture(context);
  }
  // Advance the actual clock through midnight: production polling closes the modal.
  {
    const {page, context} = await fixture({scenario: 'UTC auto-unlock and reentry'});
    await lockedIntro(page);
    await page.clock.runFor(11000);
    assert.equal(await page.locator('#paceDialog').isVisible(), false, 'UTC unlock auto-dismisses');
    assert.equal(await active(page), 'chapters');
    assert.equal(await page.evaluate(() => MKTYPace.lockedUntil(2)), 0);
    await page.locator('#chapterList [data-chapter="2"]').click();
    assert.equal(await active(page), 'storyPlan', 'unlocked chapter is reachable after automatic dismissal');
    assert(await page.locator('#storyNext').isEnabled());
    await closeFixture(context);
  }
  // An already-unlocked Continue -> Skip still opens the normal chapter plan.
  {
    const {page, context} = await fixture({scenario: 'already-unlocked cinematic', completedAt: COMPLETED - 86400000});
    await intro(page); await page.locator('#life2SkipBtn').click();
    assert.equal(await active(page), 'storyPlan');
    assert.equal(await page.locator('#paceDialog').isVisible(), false);
    assert(await page.locator('#storyNext').isEnabled());
    await closeFixture(context);
  }
  // Repeated/stale completion and a newer navigation cannot resurrect the cinematic.
  for (const navigateAway of [false, true]) {
    const {page, context} = await fixture({scenario: navigateAway ? 'navigate away before cinematic completion' : 'stale events after Skip'});
    if (navigateAway) {
      await intro(page);
      // The intro has no Back control; invoke the real navigation entry point, unmodified.
      await page.evaluate(() => show('home'));
    } else {await lockedIntro(page); await dismiss(page);}
    await staleCinematicEvents(page); await page.clock.runFor(11000);
    assert.equal(await active(page), navigateAway ? 'home' : 'chapters');
    assert.equal(await page.locator('#paceDialog').isVisible(), false);
    assert.equal(await page.evaluate(() => localStorage.getItem('mkty_story_plan_2_v1')), null);
    assert.equal(await page.evaluate(() => localStorage.getItem('mkty_points')), '500');
    await closeFixture(context);
  }
  // Real reward-client transport with explicit success/failure response mocks.
  for (const referral of ['success', 'failure']) {
    const {page, context, calls} = await fixture({scenario: 'mocked referral ' + referral, referral});
    await lockedIntro(page);
    assert(await page.locator('#paceSkip').isVisible());
    const response = page.waitForResponse(r => r.url().endsWith('/functions/v1/rewards') && r.request().postDataJSON()?.action === 'chapter.skip');
    await page.locator('#paceSkip').click(); await response;
    await page.clock.runFor(100);
    await page.locator('#paceSkip:not([disabled])').waitFor({state: 'attached'});
    assert.equal(calls.filter(c => c.action === 'chapter.skip').length, 1);
    assert.equal(calls.find(c => c.action === 'chapter.skip').life, 2);
    if (referral === 'success') {
      await page.locator('#paceDialog').waitFor({state: 'hidden'});
      assert.equal(await active(page), 'chapters');
      assert.equal(await page.evaluate(() => localStorage.getItem('mkty_pace_skip_2')), 'yes');
      await page.locator('#chapterList [data-chapter="2"]').click();
      assert.equal(await active(page), 'storyPlan');
    } else {
      assert(await page.locator('#paceDialog').isVisible());
      assert(await page.locator('#paceSkip').isEnabled());
      assert.equal(await page.evaluate(() => localStorage.getItem('mkty_pace_skip_2')), null);
      await dismiss(page, true);
      await page.locator('#chaptersBack').click(); assert.equal(await active(page), 'home');
    }
    await closeFixture(context);
  }
  assert.deepEqual(errors, []);
  console.log('PASS: seeded LIFE1 Continue -> locked intro Skip, Got it/Escape, Daily, invite, no lives, UTC unlock/reentry, unlocked flow, stale events, and mocked referral outcomes');
}
let fail;
const fatal = new Promise((_, reject) => {fail = reject;});
server.on('error', error => {errors.push('server: ' + error.message); fail(error);});
const deadline = setTimeout(() => fail(new Error('Locked-intro browser regression exceeded 240 seconds')), 240000);
Promise.race([run(), fatal]).catch(diagnostics).finally(async () => {
  clearTimeout(deadline);
  await bounded(browser?.close() || Promise.resolve(), 5000, 'browser shutdown').catch(error => {
    console.error(error); process.exitCode = 1;
  });
  if (server.listening) await bounded(new Promise(resolve => {
    server.close(resolve); server.closeAllConnections();
  }), 5000, 'server shutdown').catch(error => {console.error(error); process.exitCode = 1;});
}).catch(error => {console.error(error); process.exitCode = 1;});
