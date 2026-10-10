/* Real Chromium/SwiftShader regression for the opt-in host, not a native-phone claim.
   One root document, one live iframe at a time, two successful scene initializations.
   Telegram and every remote API response are synthetic; no live auth or database.
   Run in CI: node tests/preview-entry-ui.cjs (CHROMIUM_PATH is optional). */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {chromium} = require('playwright');
const StoryPlan = require('../story-plan.js');
const {waitForCloud} = require('./cloud-save-helper.cjs');

const root = path.resolve(__dirname, '..');
// run-all.cjs supplies /tmp/mkty-preview-entry-ui-<suffix>; keep direct runs in the same artifact glob.
const out = process.env.MKTY_TEST_OUTPUT || '/tmp/mkty-preview-entry-ui-direct';
const previewKey = 'mkty_graphics_3d_preview_v1';
const types = {'.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.json':'application/json', '.webp':'image/webp', '.png':'image/png', '.svg':'image/svg+xml', '.mp4':'video/mp4'};
fs.mkdirSync(out, {recursive:true});
const report = {checks:[], layouts:[], requests:[], errors:[], fixtureCalls:[], device:'Chromium mobile emulation / SwiftShader, not a physical Telegram phone'};
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://fixture').pathname;
  const file = path.join(root, pathname.endsWith('/') ? pathname + 'index.html' : pathname);
  fs.readFile(file, (error, body) => {
    res.writeHead(error ? 404 : 200, {'Content-Type':types[path.extname(file)] || 'application/octet-stream'});
    res.end(error ? '' : body);
  });
});
let browser, context, page, base, baseline, mode = '', held, releaseHeld;
const unexpectedRemote = [], childRequests = [], childViolations = [];
const player = {telegram_id:101, moon_points:500, lives:9, story_life:1, next_life_at:null};
let cloud = {revision:0, snapshot:{}};
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const child = async () => {
  const handle = await page.locator('#preview3DFrame').elementHandle();
  assert(handle, 'preview iframe exists');
  const frame = await handle.contentFrame();
  assert(frame, 'preview iframe has a browsing context');
  return frame;
};
const snap = frame => frame.evaluate(() => MKTYOpenWorld.snapshot());
const check = label => report.checks.push(label);
const previewRequests = () => report.requests.filter(r => /\/graphics-preview\//.test(r.url));
async function waitForHeld(label) {
  const deadline = Date.now() + 15000;
  while (!held && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
  assert(held, label + ': the actual request reached the delay fixture');
}

function installFixture({seed, previewKey}) {
  if (window !== top) {
    let fixture;
    try { fixture = parent.__previewFixture; } catch { return; } // Chromium network-error documents are cross-origin.
    if (!fixture) return;
    // Audit the child without replacing the world, inputs, renderer or lifecycle API.
    for (const method of ['getItem', 'setItem', 'removeItem', 'clear', 'key']) {
      const original = Storage.prototype[method];
      Storage.prototype[method] = function (...args) {
        const area = this === window.localStorage ? 'local' : 'session';
        if (area === 'local' || String(args[0]) !== previewKey) {
          fixture.childStorage.push({area, method, key:String(args[0])});
        }
        return original.apply(this, args);
      };
    }
    if (fixture.noWebGL) {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
        if (/^webgl2?$|experimental-webgl/.test(kind)) return null;
        return getContext.call(this, kind, ...args);
      };
    }
    return;
  }
  const nativeStorage = localStorage;
  // Only the first root document is seeded. A real reload must recover its own saves.
  const seedMarker = '__preview_entry_fixture_seeded_v1';
  const seededThisDocument = sessionStorage.getItem(seedMarker) !== 'yes';
  if (seededThisDocument) {
    nativeStorage.setItem('mkty_lang', 'ru');
    for (const [key, value] of Object.entries(seed)) nativeStorage.setItem('mkty_account_v3_101:' + key, value);
    nativeStorage.setItem('mkty_account_v3_202:mkty_points', '9876');
    nativeStorage.setItem('mkty_campaign_sentinel', '{"owner":"guest","untouched":true}');
    sessionStorage.setItem(seedMarker, 'yes');
  }
  const events = new Map(), backs = new Set();
  const fixture = window.__previewFixture = {
    nativeStorage, events, backs, seededThisDocument, ready:0, expand:0, rootBackHits:0,
    rootDeactivatedHits:0, childStorage:[], noWebGL:false,
    emit(name) { for (const fn of [...(events.get(name) || [])]) fn(); },
    back() { for (const fn of [...backs]) fn(); }
  };
  fixture.rootBack = () => fixture.rootBackHits++;
  fixture.rootDeactivated = () => fixture.rootDeactivatedHits++;
  backs.add(fixture.rootBack);
  events.set('deactivated', new Set([fixture.rootDeactivated]));
  const user = {id:101, first_name:'Preview fixture', username:'synthetic_preview_fixture'};
  window.Telegram = {WebApp:{
    initData:'user=' + encodeURIComponent(JSON.stringify(user)), initDataUnsafe:{user}, platform:'android',
    ready() { fixture.ready++; }, expand() { fixture.expand++; },
    isVersionAtLeast:() => false,
    onEvent(name, fn) { if (!events.has(name)) events.set(name, new Set()); events.get(name).add(fn); },
    offEvent(name, fn) { events.get(name)?.delete(fn); },
    BackButton:{isVisible:false,
      show() { this.isVisible = true; }, hide() { this.isVisible = false; },
      onClick(fn) { backs.add(fn); }, offClick(fn) { backs.delete(fn); }
    }
  }};
}

async function preserved(label) {
  const actual = await page.evaluate(() => {
    const f = __previewFixture, r = f.root;
    const keys = Object.keys(MKTYStorage.snapshot()).filter(k => /^mkty_(story_|campaign_|life[1-9]|current_chapter|points$|global_lives$|proof_|pending_|legacy_|operations_|field_|reactor|liftoff|expeditions_)/.test(k));
    return {
      href:location.href, hash:location.hash, history:history.length,
      sameDocument:document === r.document, sameApp:document.getElementById('app') === r.app,
      sameHome:document.getElementById('home') === r.home,
      sameTelegram:Telegram === r.telegram && Telegram.WebApp === r.webApp,
      sameControllers:MKTYCampaign === r.campaign && MKTYRewards === r.rewards && MKTYStorage === r.storage,
      initData:Telegram.WebApp.initData, identity:MKTYStorage.identity(), account:MKTYRewards.accountScope(),
      user:Telegram.WebApp.initDataUnsafe.user, authSession:sessionStorage.getItem('mkty_session_v1_101'),
      sdkReady:f.ready, sdkExpand:f.expand,
      protected:Object.fromEntries(keys.sort().map(k => [k, localStorage.getItem(k)])),
      campaign:MKTYCloud.snapshot(),
      otherAccount:f.nativeStorage.getItem('mkty_account_v3_202:mkty_points'),
      guest:f.nativeStorage.getItem('mkty_campaign_sentinel')
    };
  });
  assert.deepEqual(actual, baseline, label + ': root document, route, identity and campaign remain unchanged');
  assert.deepEqual(await page.evaluate(() => __previewFixture.childStorage), [], label + ': child never reads/writes campaign or auth storage');
}

async function sdkRestored(visible = false) {
  assert.deepEqual(await page.evaluate(() => ({
    back:__previewFixture.backs.size, rootBack:__previewFixture.backs.has(__previewFixture.rootBack),
    events:__previewFixture.events.get('deactivated').size,
    rootEvent:__previewFixture.events.get('deactivated').has(__previewFixture.rootDeactivated),
    visible:Telegram.WebApp.BackButton.isVisible
  })), {back:1, rootBack:true, events:1, rootEvent:true, visible});
}

async function openIntro() {
  await page.locator('#preview3DEntry').click();
  await page.locator('#preview3DDialog').waitFor({state:'visible'});
  assert.equal(await page.locator('#preview3DDialog').evaluate(el => el.open), true);
  assert.equal(await page.locator('#preview3DFrame').count(), 0, 'introduction alone creates no frame');
}

async function closed(label, visible = false) {
  await page.locator('#preview3DDialog').waitFor({state:'detached'});
  assert.equal(await page.locator('#preview3DFrame').count(), 0, label + ': frame removed');
  assert.equal(page.frames().length, 1, label + ': only root frame remains');
  await sdkRestored(visible);
  await preserved(label);
}

async function layout(label, withFrame = true) {
  const boxes = await page.evaluate(() => {
    const rect = el => {const b = el.getBoundingClientRect(); return {x:b.x, y:b.y, width:b.width, height:b.height};};
    const button = document.getElementById('preview3DClose'), box = rect(button);
    const dialog = document.getElementById('preview3DDialog'), frame = document.getElementById('preview3DFrame');
    return {viewport:{width:innerWidth, height:innerHeight}, button:box,
      reachable:document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)?.closest('button') === button,
      dialog:rect(dialog), dialogOverflow:dialog.scrollWidth > dialog.clientWidth || dialog.scrollHeight > dialog.clientHeight,
      rootWidth:document.documentElement.scrollWidth, frame:frame && rect(frame),
      headerBottom:document.querySelector('.preview3d-header').getBoundingClientRect().bottom};
  });
  const {button:b, viewport:v, frame:f} = boxes;
  assert(b.width >= 44 && b.height >= 44, label + ': host return is at least 44 CSS px');
  assert(b.x >= 0 && b.y >= 0 && b.x + b.width <= v.width && b.y + b.height <= v.height, label + ': return stays in viewport');
  assert(boxes.reachable, label + ': host return is hit-test reachable');
  assert.equal(boxes.rootWidth, v.width, label + ': root has no horizontal overflow');
  assert.equal(boxes.dialogOverflow, false, label + ': host has no clipped/overflowing layout');
  if (withFrame) {
    assert(f && f.width > 0 && f.height > 0, label + ': iframe has usable positive dimensions');
    assert(f.x >= 0 && f.y >= boxes.headerBottom && f.x + f.width <= v.width && f.y + f.height <= v.height, label + ': frame fits below persistent host controls');
    const content = await (await child()).evaluate(() => ({
      width:innerWidth, height:innerHeight, scrollWidth:document.documentElement.scrollWidth,
      scrollHeight:document.documentElement.scrollHeight, worldWidth:document.getElementById('world')?.clientWidth,
      worldHeight:document.getElementById('world')?.clientHeight
    }));
    assert.equal(content.scrollWidth, content.width, label + ': iframe has no horizontal overflow');
    assert.equal(content.scrollHeight, content.height, label + ': iframe has no vertical overflow');
    assert.equal(content.worldWidth, content.width);
    assert.equal(content.worldHeight, content.height);
    boxes.content = content;
  }
  report.layouts.push({label, ...boxes});
}

async function launch() {
  await page.locator('#preview3DLaunch').click();
  assert.equal(await page.locator('#preview3DFrame').count(), 1);
  return child();
}

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH, headless:true,
    args:['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
  context = await browser.newContext({viewport:{width:390, height:844}, hasTouch:true, deviceScaleFactor:1, serviceWorkers:'block'});
  await context.addInitScript(installFixture, {previewKey, seed:{
    mkty_points:'500', mkty_global_lives:'9', mkty_life1:'complete', mkty_life1_awarded:'yes',
    mkty_current_chapter:'2', mkty_life1_memory_code:'1234567890',
    mkty_campaign_checkpoint_2:JSON.stringify({version:1, joined:['Navigator'], pipes:null}),
    mkty_story_plan_2_v1:JSON.stringify(StoryPlan.fresh(2, 90210, 2))
  }});
  page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('request', request => {
    const isChild = request.frame() !== page.mainFrame();
    const record = {url:request.url(), type:request.resourceType(), child:isChild};
    report.requests.push(record);
    if (isChild) {
      childRequests.push(record);
      const u = new URL(request.url());
      if (u.origin !== base || (!u.pathname.startsWith('/graphics-preview/') && u.pathname !== '/favicon.png')) childViolations.push(record);
    }
  });
  await context.route('**/*', async route => {
    const request = route.request(), u = new URL(request.url());
    if (u.origin === base) {
      if (mode === 'abort-document' && u.pathname === '/graphics-preview/embed.html') return route.abort('failed');
      if (mode === 'block-module' && u.pathname === '/graphics-preview/world.js') return route.abort('failed');
      if ((mode === 'delay-module' && u.pathname === '/graphics-preview/world.js') || (mode === 'delay-document' && u.pathname === '/graphics-preview/embed.html')) {
        held = true;
        await new Promise(resolve => {releaseHeld = resolve;});
        try { await route.fulfill({contentType:types[path.extname(u.pathname)], body:fs.readFileSync(path.join(root, u.pathname))}); }
        catch (error) { if (!/closed|disposed|cancel|abort|Invalid InterceptionId/i.test(String(error))) throw error; }
        return;
      }
      return route.continue();
    }
    // Never continue an external request, including a newly introduced dependency.
    if (u.hostname === 'telegram.org' && u.pathname === '/js/telegram-web-app.js') return route.fulfill({contentType:'application/javascript', body:''});
    if (u.hostname === 'lswbmgoeinblzuqzakvi.supabase.co' && u.pathname.startsWith('/functions/v1/')) {
      const body = request.postDataJSON() || {}, action = body.action;
      report.fixtureCalls.push(action || u.pathname);
      let data = {ok:false, error:'fixture_unavailable'};
      if (action === 'session') data = {ok:true, session:{token:'synthetic-fixture-101', expires_at:Date.now() + 86400000}};
      if (action === 'player') data = {ok:true, player, pace:{next_life:2, locked:false, skips:0}};
      if (action === 'campaign.cloud') {
        if (body.snapshot) cloud = {revision:cloud.revision + 1, snapshot:body.snapshot};
        data = {ok:true, ...cloud};
      }
      return route.fulfill({contentType:'application/json', body:JSON.stringify(data)});
    }
    unexpectedRemote.push(request.url());
    return route.abort('blockedbyclient');
  });

  await page.goto(base + '/?entry-fixture=1#telegram-launch-fixture', {waitUntil:'load'});
  await page.waitForFunction(() => window.MKTYStory && window.MKTYHub && MKTYRewards.getLastPlayer()?.telegram_id === 101);
  await page.evaluate(() => mktyAuthPromise);
  await waitForCloud(page, 'saved', {label:'synthetic existing-account initial save'});
  await page.waitForLoadState('networkidle');
  assert.equal(await page.locator('.screen.active').getAttribute('id'), 'home');
  assert.equal(await page.evaluate(() => __previewFixture.seededThisDocument), true);
  assert.equal(await page.locator('#preview3DEntry').count(), 1);
  assert.equal(await page.locator('#preview3DEntry').evaluate(el => el.closest('.screen').id), 'home');
  assert.deepEqual(previewRequests(), [], 'cold root loads no preview document, Three, scene or preview art');
  assert.equal(await page.evaluate(() => typeof window.MKTYOpenWorld), 'undefined');
  assert.equal(await page.evaluate(key => sessionStorage.getItem(key), previewKey), null);
  await page.evaluate(() => {
    __previewFixture.root = {document, app:document.getElementById('app'), home:document.getElementById('home'),
      telegram:Telegram, webApp:Telegram.WebApp, campaign:MKTYCampaign, rewards:MKTYRewards, storage:MKTYStorage};
  });
  // Construct the baseline independently; all later comparisons are strict.
  baseline = await page.evaluate(() => {
    const keys = Object.keys(MKTYStorage.snapshot()).filter(k => /^mkty_(story_|campaign_|life[1-9]|current_chapter|points$|global_lives$|proof_|pending_|legacy_|operations_|field_|reactor|liftoff|expeditions_)/.test(k));
    return {href:location.href, hash:location.hash, history:history.length, sameDocument:true, sameApp:true, sameHome:true,
      sameTelegram:true, sameControllers:true, initData:Telegram.WebApp.initData, identity:MKTYStorage.identity(), account:MKTYRewards.accountScope(),
      user:Telegram.WebApp.initDataUnsafe.user, authSession:sessionStorage.getItem('mkty_session_v1_101'),
      sdkReady:__previewFixture.ready, sdkExpand:__previewFixture.expand,
      protected:Object.fromEntries(keys.sort().map(k => [k, localStorage.getItem(k)])), campaign:MKTYCloud.snapshot(),
      otherAccount:__previewFixture.nativeStorage.getItem('mkty_account_v3_202:mkty_points'),
      guest:__previewFixture.nativeStorage.getItem('mkty_campaign_sentinel')};
  });
  assert.equal(baseline.identity, '101');
  assert.equal(baseline.protected.mkty_current_chapter, '2');
  assert.equal(baseline.protected.mkty_campaign_checkpoint_2, JSON.stringify({version:1, joined:['Navigator'], pipes:null}));
  check('cold root has zero preview/Three/preview-asset requests and a preserved existing-account checkpoint');

  await openIntro();
  await page.evaluate(() => {for (let i = 0; i < 4; i++) document.getElementById('preview3DEntry').click();});
  assert.equal(await page.locator('#preview3DDialog').count(), 1, 'repeated entry activation keeps one dialog');
  assert.deepEqual(previewRequests(), [], 'opening/repeating the introduction still loads no preview resources');
  await layout('intro', false);
  await page.screenshot({path:path.join(out, 'host-intro.png')});
  await page.keyboard.press('Escape');
  await closed('intro cancellation');
  check('introduction stays lazy; repeated entry and native dialog cancellation are safe');

  await openIntro();
  const opening = await page.evaluate(() => ({scroll:document.getElementById('app').scrollTop}));
  let frame = await launch();
  await page.evaluate(() => {for (let i = 0; i < 5; i++) document.getElementById('preview3DLaunch').click();});
  assert.equal(await page.locator('#preview3DFrame').count(), 1, 'repeated launch keeps exactly one iframe');
  await frame.waitForFunction(() => window.MKTYOpenWorld?.snapshot().ready, null, {timeout:60000});
  await page.waitForFunction(() => /Эксперимент\.|Experimental\./.test(document.getElementById('preview3DStatus').textContent));
  assert.equal(previewRequests().filter(r => r.type === 'document').length, 1);
  assert(previewRequests().some(r => /three-r170/.test(r.url)), 'explicit launch loads real Three.js');
  assert(previewRequests().some(r => /\/art\/regolith\.webp/.test(r.url)), 'explicit launch loads real scene art');
  assert.equal(await frame.evaluate(() => typeof window.Telegram), 'undefined', 'child has no Telegram SDK instance');
  assert.equal(await frame.locator('script[src*="telegram"]').count(), 0);
  assert.equal(new URL(frame.url()).hash, '', 'Telegram launch hash never enters the child URL');
  assert.deepEqual([...new URL(frame.url()).searchParams.keys()], ['v'], 'child URL carries only a static version');
  await page.evaluate(() => {
    const child = document.getElementById('preview3DFrame').contentWindow;
    dispatchEvent(new MessageEvent('message', {origin:'https://untrusted.invalid', source:child, data:{type:'mkty-preview-return'}}));
    dispatchEvent(new MessageEvent('message', {origin:location.origin, source:window, data:{type:'mkty-preview-return'}}));
  });
  assert.equal(await page.locator('#preview3DFrame').count(), 1, 'wrong origin/source cannot close the current preview');
  await preserved('first scene ready');

  await frame.locator('#scene').focus();
  const start = await snap(frame);
  await page.keyboard.down('w');
  try { await frame.waitForFunction(z => MKTYOpenWorld.snapshot().position.z < z - 1.2, start.position.z, {timeout:15000}); }
  finally { await page.keyboard.up('w'); }
  await frame.waitForFunction(() => {const v = MKTYOpenWorld.snapshot().velocity; return Math.hypot(v.x, v.z) < .02;});
  assert((await snap(frame)).position.z < start.position.z - 1.2, 'ordinary held keyboard input moves the actual cat');
  await page.keyboard.down('e');
  try { await frame.waitForFunction(yaw => MKTYOpenWorld.snapshot().camera.yaw > yaw + .3, start.camera.yaw, {timeout:15000}); }
  finally { await page.keyboard.up('e'); }
  assert((await snap(frame)).camera.yaw > start.camera.yaw + .3, 'ordinary camera input produces a non-default saved angle');
  await frame.locator('#pause').click();
  const paused = await snap(frame);
  assert(paused.paused);
  await page.keyboard.down('w'); await page.waitForTimeout(250); await page.keyboard.up('w');
  assert.deepEqual((await snap(frame)).position, paused.position, 'paused world rejects real movement input');
  for (const [width, height] of [[320,568], [568,320]]) {
    await page.setViewportSize({width, height});
    await page.waitForTimeout(100);
    await layout('paused-' + width + 'x' + height);
    await page.screenshot({path:path.join(out, 'host-' + width + 'x' + height + '.png')});
  }
  await page.setViewportSize({width:390, height:844});
  await frame.locator('#resume').click();
  await frame.locator('#scene').focus();
  await page.keyboard.down('w');
  await page.evaluate(() => __previewFixture.emit('deactivated'));
  await page.keyboard.up('w');
  const deactivated = await snap(frame);
  assert(deactivated.paused, 'root Telegram deactivation pauses child');
  assert.equal(deactivated.inputPointers, 0);
  assert.deepEqual(deactivated.velocity, {x:0, z:0});
  await page.waitForTimeout(200);
  assert.deepEqual((await snap(frame)).position, deactivated.position);
  const saved = await snap(frame);
  await page.evaluate(() => {__previewFixture.disposedWorld = document.getElementById('preview3DFrame').contentWindow.MKTYOpenWorld;});
  await frame.locator('#panel [data-preview-return]').click();
  await closed('child return');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'preview3DEntry', 'return restores the invoking control');
  assert.equal(await page.evaluate(() => document.getElementById('app').scrollTop), opening.scroll, 'return restores home scroll');
  const stoppedFrames = await page.evaluate(() => __previewFixture.disposedWorld.snapshot().frames);
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => __previewFixture.disposedWorld.snapshot().frames), stoppedFrames, 'removed child animation loop is disposed');
  const savedJSON = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)), previewKey);
  assert(distance({x:savedJSON.x, z:savedJSON.z}, saved.position) < .001, 'return saves only the preview session position');
  check('real movement, pause, Telegram deactivation, child return, disposal and 320px/landscape host geometry');

  // Delay the second real initialization, advancing only the host watchdog while no GPU runs.
  await page.clock.install();
  mode = 'delay-module'; held = false;
  await openIntro(); frame = await launch();
  await waitForHeld('second module request');
  assert.equal(await frame.evaluate(() => typeof window.MKTYOpenWorld), 'undefined');
  await frame.waitForFunction(() => getComputedStyle(document.getElementById('world')).position === 'relative');
  await page.evaluate(() => __previewFixture.emit('deactivated'));
  await page.clock.fastForward(31000);
  assert.match(await page.locator('#preview3DStatus').innerText(), /Загрузка затянулась|Loading is taking longer/);
  await layout('delayed-module');
  mode = ''; releaseHeld(); releaseHeld = null;
  await frame.waitForFunction(() => window.MKTYOpenWorld?.snapshot().ready, null, {timeout:60000});
  await page.waitForFunction(() => /Эксперимент\.|Experimental\./.test(document.getElementById('preview3DStatus').textContent));
  const reopened = await snap(frame);
  assert(reopened.paused, 'deactivation before the child API exists is honored on eventual readiness');
  assert(distance(reopened.position, saved.position) < .001, 'reopen restores the actual walked position');
  assert.equal(reopened.camera.yaw, saved.camera.yaw);
  assert.equal(reopened.camera.distance, saved.camera.distance);
  assert.deepEqual(reopened.inspected, saved.inspected);
  await preserved('slow eventual readiness and reopen');
  await frame.locator('#resume').click();
  await page.keyboard.press('Escape');
  await closed('embedded Escape return');
  check('slow load remains recoverable after 30s; early deactivation, reopen persistence and embedded Escape work');

  await page.evaluate(() => Telegram.WebApp.BackButton.show());
  await openIntro();
  await page.evaluate(() => __previewFixture.back());
  await closed('Telegram BackButton', true);
  assert.equal(await page.evaluate(() => __previewFixture.rootBackHits), 1, 'preexisting BackButton callback still runs');
  await page.evaluate(() => {Telegram.WebApp.BackButton.hide(); __previewFixture.back();});
  assert.equal(await page.evaluate(() => __previewFixture.rootBackHits), 2, 'preexisting callback remains registered after close');
  await sdkRestored();
  check('Telegram BackButton callback and both prior visibility states are restored');

  mode = 'abort-document';
  await openIntro(); await launch();
  await page.clock.fastForward(31000);
  await layout('aborted-document', false);
  // Chromium often fires load, rather than error, for an aborted iframe document.
  // Exercise the host error-listener branch separately and label it honestly.
  await page.locator('#preview3DFrame').dispatchEvent('error');
  assert.match(await page.locator('#preview3DStatus').innerText(), /Не удалось загрузить тест|preview could not load/);
  await page.locator('#preview3DClose').click(); await closed('aborted document host close'); mode = '';
  check('aborted document keeps host return; synthetic iframe error event covers the host error branch');

  mode = 'block-module';
  await openIntro(); frame = await launch();
  await page.waitForFunction(() => /3D недоступно|3D is unavailable/.test(document.getElementById('preview3DStatus').textContent));
  assert.equal(await frame.evaluate(() => typeof window.MKTYOpenWorld), 'undefined', 'blocked module never creates a renderer');
  await layout('blocked-module');
  await page.locator('#preview3DClose').click(); await closed('blocked module host close'); mode = '';
  check('blocked world module announces failure and leaves the persistent host return usable');

  await page.evaluate(() => {__previewFixture.noWebGL = true;});
  await openIntro(); frame = await launch();
  await frame.locator('#fallback').waitFor({state:'visible'});
  await page.waitForFunction(() => /3D недоступно|3D is unavailable/.test(document.getElementById('preview3DStatus').textContent));
  assert.equal((await snap(frame)).ready, false);
  await layout('WebGL-unsupported');
  await frame.locator('#fallback').click(); await closed('unsupported WebGL child fallback');
  await page.evaluate(() => {__previewFixture.noWebGL = false;});
  check('actual WebGL2 creation failure exposes a working child fallback and host return');

  mode = 'delay-document'; held = false;
  await openIntro(); await launch();
  await waitForHeld('close-during-load document');
  await page.evaluate(() => {__previewFixture.staleWindow = document.getElementById('preview3DFrame').contentWindow;});
  await page.locator('#preview3DClose').click(); await closed('close during load');
  mode = ''; releaseHeld(); releaseHeld = null;
  await openIntro();
  await page.evaluate(() => {
    for (const type of ['mkty-preview-ready', 'mkty-preview-return', 'mkty-preview-error']) {
      dispatchEvent(new MessageEvent('message', {origin:location.origin, source:__previewFixture.staleWindow, data:{type}}));
    }
  });
  assert.equal(await page.locator('#preview3DDialog').count(), 1, 'late messages cannot dismiss the newer introduction');
  assert.equal(await page.locator('#preview3DFrame').count(), 0, 'late completion never remounts an iframe');
  assert.equal(await page.locator('#preview3DStatus').isVisible(), false);
  await page.clock.fastForward(31000);
  assert.equal(await page.locator('#preview3DStatus').isVisible(), false, 'closed generation watchdog cannot alter a new introduction');
  await page.locator('#preview3DClose').click(); await closed('after late load completion');
  check('close during load removes the frame and invalidates late work/messages/watchdogs');

  await page.locator('#missionsBtn').click();
  assert.equal(await page.locator('.screen.active').getAttribute('id'), 'chapters');
  assert.equal(await page.locator('#preview3DEntry').isVisible(), false);
  const beforeGuard = previewRequests().length;
  await page.evaluate(() => document.getElementById('preview3DEntry').click());
  assert.equal(await page.locator('#preview3DDialog').count(), 0, 'programmatic stale entry cannot open outside home');
  assert.equal(previewRequests().length, beforeGuard);
  await page.locator('#chaptersBack').click();
  await openIntro();
  mode = 'block-module'; await launch();
  await page.waitForFunction(() => /3D недоступно|3D is unavailable/.test(document.getElementById('preview3DStatus').textContent));
  await page.evaluate(() => show('chapters'));
  await closed('navigation-away auto close'); mode = '';
  assert.equal(await page.locator('.screen.active').getAttribute('id'), 'chapters', 'closing does not undo newer root navigation');
  assert.equal(await page.evaluate(() => document.getElementById('app').scrollTop), 0, 'new screen keeps its reset scroll position');
  assert.notEqual(await page.evaluate(() => document.activeElement.id), 'preview3DEntry', 'hidden home entry is not refocused');
  await page.locator('#chaptersBack').click();
  await preserved('root navigation remains operational');
  check('entry is home-only, leaving home closes the host without undoing the newer screen or scroll reset');

  assert.deepEqual(childViolations, [], 'child requests only preview resources and the static favicon, never root/API/Telegram');
  assert(childRequests.length > 0);
  assert.equal(report.requests.filter(r => r.type === 'document' && !r.child).length, 1, 'root document was loaded exactly once');
  assert.equal(report.requests.filter(r => /telegram-web-app\.js/.test(r.url)).length, 1, 'only root requests the mocked Telegram SDK');
  assert.deepEqual(unexpectedRemote, [], 'no unexpected dependency or external network request');
  assert.deepEqual(report.errors, [], 'no uncaught page errors in host or embedded lifecycle');
  assert.deepEqual(await page.evaluate(() => __previewFixture.childStorage), []);

  // Reload the real root after returning, without recreating its fixture saves.
  // The root's own pagehide handler may add an idle expedition checkpoint; every
  // already-existing campaign value must still match exactly after rehydration.
  const durableKeys = {protected:Object.keys(baseline.protected), campaign:Object.keys(baseline.campaign)};
  function durableState(keys) {
    const native = __previewFixture.nativeStorage;
    return {href:location.href, hash:location.hash, identity:MKTYStorage.identity(), account:MKTYRewards.accountScope(),
      initData:Telegram.WebApp.initData, user:Telegram.WebApp.initDataUnsafe.user,
      authSession:sessionStorage.getItem('mkty_session_v1_101'),
      previewSession:sessionStorage.getItem('mkty_graphics_3d_preview_v1'),
      protected:Object.fromEntries(keys.protected.map(k => [k, localStorage.getItem(k)])),
      campaign:Object.fromEntries(keys.campaign.map(k => [k, localStorage.getItem(k)])),
      otherAccount:native.getItem('mkty_account_v3_202:mkty_points'), guest:native.getItem('mkty_campaign_sentinel')};
  }
  const beforeReload = await page.evaluate(durableState, durableKeys);
  assert(beforeReload.previewSession, 'walked preview session exists before root reload');
  const previewCountBeforeReload = previewRequests().length;
  await page.reload({waitUntil:'load'});
  await page.waitForFunction(() => window.MKTYStory && window.MKTYHub && MKTYRewards.getLastPlayer()?.telegram_id === 101);
  await page.evaluate(() => mktyAuthPromise);
  await waitForCloud(page, 'saved', {label:'synthetic existing-account after root reload'});
  await page.waitForLoadState('networkidle');
  assert.equal(await page.evaluate(() => __previewFixture.seededThisDocument), false, 'reload cannot mask lost data by reseeding');
  assert.equal(await page.evaluate(() => performance.getEntriesByType('navigation')[0].type), 'reload', 'an actual root reload occurred');
  assert.equal(await page.locator('.screen.active').getAttribute('id'), 'home');
  assert.equal(await page.locator('#preview3DDialog, #preview3DFrame').count(), 0, 'root reload keeps the preview closed');
  assert.equal(await page.evaluate(() => typeof window.MKTYOpenWorld), 'undefined');
  assert.equal(previewRequests().length, previewCountBeforeReload, 'root reload makes zero new preview/Three/art requests');
  assert.deepEqual(await page.evaluate(durableState, durableKeys), beforeReload, 'real reload preserves campaign, checkpoint, auth account and preview session');
  assert.equal(report.requests.filter(r => r.type === 'document' && !r.child).length, 2, 'only the requested final root reload adds a root document');
  await sdkRestored();
  assert.deepEqual(unexpectedRemote, []);
  assert.deepEqual(childViolations, []);
  assert.deepEqual(report.errors, []);
  check('actual root reload remains closed/lazy and preserves existing campaign/account plus preview session without reseeding');
  report.previewDocuments = childRequests.filter(r => r.type === 'document').length;
  console.log(JSON.stringify({checks:report.checks, layouts:report.layouts.length, previewDocuments:report.previewDocuments, errors:report.errors, device:report.device}));
})().catch(async error => {
  report.failure = error.stack;
  console.error(error);
  process.exitCode = 1;
  await page?.screenshot({path:path.join(out, 'failure.png')}).catch(() => {});
}).finally(async () => {
  releaseHeld?.();
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  await browser?.close();
  server.close();
});
