/* Native edition-1 range coverage. Run only in browser-authorized CI.
 * Reuses the already-green strict CDP driver, unchanged target tolerances and scroll checks.
 * Three independent guest contexts; actual campaign/story/operations/continuation routes.
 * Only pre-control prerequisites are seeded once. Later values come solely from native input.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {runCase} = require('./native-range-touch.cjs');
const {scenarios, profile, checkpoint} = require('./legacy-range-touch-fixture.cjs');
async function assertScene(page, spec) {
  assert.equal(await page.locator('#mission' + spec.chapter).getAttribute('data-stage'), spec.stage, 'actual edition-1 control stage remains active');
  assert.equal(await page.locator('#chapterGuide').isVisible(), false, 'range is not behind the pause dialog');
  assert.equal(await page.evaluate(() => MKTYExperience.paused), false, 'real legacy controller is resumed');
  assert.equal(await page.evaluate(n => MKTYStory.read(n).edition, spec.chapter), 1, 'edition-1 route remains selected');
  assert.equal(await page.evaluate(n => localStorage.getItem('mkty_field_finale_' + n + '_v1'), spec.chapter), null, 'no spatial finale substituted');
  assert.equal(await page.evaluate(n => localStorage.getItem('mkty_life' + n), spec.chapter), null, 'touch-only check never completes the chapter');
  const live = await page.evaluate(n => MKTYContinuation.save(n), spec.chapter), seeded = checkpoint(spec);
  for (const key of spec.chapter === 8 ? ['targetFrequency', 'targetPhase', 'round'] : ['target', 'latitude', 'longitude', 'round', 'health', 'power']) {
    assert.equal(live[key], seeded[key], 'real restore preserves prerequisite ' + key);
  }
  const inactiveKey = spec.stage === 'frequency' ? 'phase' : spec.stage === 'phase' ? 'frequency' : null;
  if (inactiveKey) assert.equal(live[inactiveKey], seeded[inactiveKey], 'dragging one range leaves the other phase intact');
}
async function assertModel(page, spec, control, value) {
  const state = await page.evaluate(({chapter, selector}) => ({
    model: MKTYContinuation.save(chapter), // Read-only live controller snapshot; does not write storage.
    value: Number(document.querySelector(selector).value),
    frequency: document.getElementById('freqRead8').textContent,
    strength: document.getElementById('strengthText8').textContent,
    strengthWidth: document.getElementById('strengthFill8').style.width,
    phaseNeedle: document.getElementById('phaseNeedle8').style.left,
    corridorNeedle: document.getElementById('corridorNeedle9').style.left
  }), {chapter: spec.chapter, selector: control.selector});
  assert.equal(state.value, value);
  assert.equal(state.model[control.key], value, 'real continuation model follows native input');
  assert.equal(state.model.stage, spec.stage, 'native drag does not advance a puzzle stage');
  if (control.key === 'frequency') {
    const strength = Math.max(0, 100 - Math.abs(value - state.model.targetFrequency) * 4);
    assert.equal(state.frequency, (140 + value / 10).toFixed(1) + ' MHz', 'real frequency readout follows the thumb');
    assert.equal(state.strength, 'SIGNAL ' + Math.round(strength) + '%', 'real signal readout follows the carrier distance');
    assert.equal(state.strengthWidth, strength + '%', 'real signal bar follows the carrier distance');
  } else assert.equal(control.key === 'phase' ? state.phaseNeedle : state.corridorNeedle, value + '%', 'real alignment needle follows native input');
  await page.waitForFunction(({chapter, key, value, stage}) => {
    const saved = JSON.parse(localStorage.getItem('mkty_campaign_checkpoint_' + chapter) || 'null');
    return saved?.stage === stage && saved[key] === value;
  }, {chapter: spec.chapter, key: control.key, value, stage: spec.stage}, {timeout: 4000});
  const saved = await page.evaluate(n => JSON.parse(localStorage.getItem('mkty_campaign_checkpoint_' + n)), spec.chapter);
  assert.deepEqual(saved, state.model, 'real campaign autosave matches the entire live continuation checkpoint');
}
async function lifecycle({page, spec, record, sceneReady, modelMatches, bothWays}) {
  const control = spec.controls[0], saved = () => page.evaluate(n => JSON.parse(localStorage.getItem('mkty_campaign_checkpoint_' + n)), spec.chapter);
  async function pause() {
    await page.locator('#mission' + spec.chapter + ' .chapter-menu').tap();
    assert(await page.locator('#chapterGuide').isVisible(), 'real pause dialog opens');
    assert.equal(await page.evaluate(() => MKTYExperience.paused), true);
  }
  async function resume() {
    assert(await page.locator('#chapterGuide').isVisible(), 'checkpoint restore presents the real pause dialog');
    await page.locator('#guideResume').tap();
    await page.waitForTimeout(450);
    await sceneReady();
  }
  async function preserve(before, boundary) {
    assert.equal(Number(await page.locator(control.selector).inputValue()), before[control.key], boundary + ': prior native value restored');
    assert.deepEqual(await saved(), before, boundary + ': complete checkpoint is preserved');
    await modelMatches(control, before[control.key]);
    await bothWays(control, boundary + ' ' + control.selector);
  }
  let before = await saved();
  await pause(); await page.waitForTimeout(150);
  assert.deepEqual(await saved(), before, 'pause does not corrupt the prior native checkpoint');
  await resume(); await preserve(before, 'after pause/resume');
  record.pauseResume = true;

  before = await saved();
  await pause(); await page.locator('#guideMissions').tap();
  assert.equal(await page.locator('.screen.active').getAttribute('id'), 'chapters');
  await page.locator('[data-chapter="' + spec.chapter + '"]').tap();
  await resume(); await preserve(before, 'after chapter reopen');
  record.chapterReopen = true;

  before = await saved();
  await page.reload({waitUntil: 'load'});
  await page.waitForFunction(() => window.MKTYCampaign && window.MKTYContinuation && window.MKTYStory);
  assert.deepEqual(await saved(), before, 'reload retains native progress before ordinary campaign entry');
  await page.locator('#enterBtn').tap();
  if (await page.locator('#storyPlan.active').isVisible()) {
    assert(await page.evaluate(n => MKTYStory.coreReady(n), spec.chapter));
    await page.locator('#storyNext').tap();
  }
  await resume(); await preserve(before, 'after reload');
  record.reload = true;
  assert.notEqual((await saved())[control.key], checkpoint(spec)[control.key], 'reload fixture never overwrites the native result');
}
async function main() {
  const {chromium} = require('playwright');
  const out = process.env.MKTY_TEST_OUTPUT || fs.mkdtempSync(path.join(os.tmpdir(), 'mkty-legacy-native-ranges-'));
  fs.mkdirSync(out, {recursive: true});
  const report = {engine: 'Chromium touchscreen/CDP', physicalIOSVerified: false, productionDOMAndCSS: true,
    plannedScenarios: 3, distinctLegacyRanges: 3, expectedNativeGestures: 24,
    limitations: ['390x844 Chromium touch only; physical iOS/Android and Telegram WebKit remain unverified'], cases: []};
  let browser, watchdog;
  try {
    browser = await chromium.launch({headless: true, executablePath: process.env.CHROMIUM_PATH, timeout: 30000, args: ['--no-sandbox']});
    watchdog = setTimeout(() => {report.deadlineExceeded = true; browser.close().catch(() => {});}, 90000);
    for (const spec of scenarios) {
      const record = {name: spec.name, width: spec.width, height: spec.height, lang: 'en', errors: [], gestures: [], controlPairs: 0, blockedExternalRequests: 0};
      report.cases.push(record);
      await runCase(browser, spec, record, out, {profile, onceKey: 'native_legacy_range_fixture_seeded',
        assertScene: async (page, active) => {
          await assertScene(page, active);
          if (!record.gestures.length) assert.equal(Number(await page.locator(active.controls[0].selector).inputValue()), active.controls[0].initial, 'ordinary route restores the pre-control fixture exactly');
        }, assertModel, afterInitial: lifecycle});
      assert.equal(record.controlPairs, 4, 'initial, pause/resume, reopen and reload each drag both ways');
      assert.equal(record.gestures.length, 8);
      assert(record.pauseResume && record.chapterReopen && record.reload);
    }
    assert.equal(report.cases.filter(c => c.passed).length, 3);
    assert.equal(report.cases.reduce((sum, c) => sum + c.controlPairs, 0), 12);
    assert.equal(report.cases.reduce((sum, c) => sum + c.gestures.length, 0), 24);
    console.log('PASS native legacy ranges: 3 scenarios, 3 controls, 24 genuine gestures; pause/reopen/reload preserved');
  } catch (error) {report.failure = error.stack; process.exitCode = 1; console.error(error);}
  finally {clearTimeout(watchdog); fs.writeFileSync(path.join(out, 'legacy-range-native-touch.json'), JSON.stringify(report, null, 2)); await browser?.close();}
}
module.exports = {main};
if (require.main === module) main();
