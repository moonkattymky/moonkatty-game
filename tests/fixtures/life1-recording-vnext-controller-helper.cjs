'use strict';
/* Socket-free, test-only vNext integration. The production controller, experience,
 * and campaign statements are executed from their actual source excerpts. The
 * frozen source oracle is compiled in memory and never edited. Native-profile
 * rectangle math is shared solely to supply this synthetic VM DOM: these tests
 * do NOT certify native pixels, browser scheduling, or human timing. */
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const assert = require('node:assert/strict');
const M = require('../../prototypes/life1-capture/pr47/life1-model.js');
const root = path.resolve(__dirname, '../..');
const fixturePath = path.join(__dirname, 'life1-recording-source-controller.cjs');
const DEFAULT_CONTEXT = Object.freeze({life1_profile: M.NATIVE_PROFILE,
  route: '00000000-0000-4000-8000-000000000571', life: 1, edition: 2, challenge_version: 2, seed: 571});
const MEASURED_GEOMETRY = Object.freeze({width: 362, height: 483.96875,
  left: 14, top: 83.15625, statusResize: true});
let source = fs.readFileSync(fixturePath, 'utf8');
function replace(needle, replacement) {
  assert.equal(source.split(needle).length, 2, 'Frozen fixture seam changed: ' + needle.slice(0, 90));
  source = source.replace(needle, replacement);
}
source = "const NativeGeometry = require('../../prototypes/life1-capture/pr47/life1-native-geometry.js');\n" + source;
replace('function createController({width = 362, height = 360, random = () => .5} = {}) {', `function createController({width = 402, height = 402, left = 0, top = 0, random = () => .5,
  storageSeed = {}, recordingContext, limits, Recorder, instrument, adapterSource,
  initialNow = 0, performanceNow = [], performanceOffset = 0, statusResize = false,
  statusTextHook = null, restoreCampaign = true, captureEnabled = true} = {}) {`);
replace("const source = fs.readFileSync(path.join(root, 'app.js'), 'utf8');", "const source = instrument(fs.readFileSync(path.join(root, 'app.js'), 'utf8'), 'app.js');");
replace("const experience = fs.readFileSync(path.join(root, 'experience.js'), 'utf8');", "const experience = instrument(fs.readFileSync(path.join(root, 'experience.js'), 'utf8'), 'experience.js');");
replace('  dimensions(width, height);', `  NativeGeometry.validateEnvelope(width, height, left, top);
  dimensions(width, height);
  let statusHeight = statusResize ? 41.875 : 30;
  const statusMutations = [];
  function liveDimensions(w, h, originLeft = left, originTop = top) {
    NativeGeometry.validateEnvelope(w, h, originLeft, originTop);
    dimensions(w, h); left = originLeft; top = originTop;
  }`);
// Only the DOM's rectangle provider is substituted. Gameplay and cache math stay
// in app.js. Do not cite this shared geometry provider as independent evidence.
const rectangleStart = source.indexOf('  function rectangle(node) {');
const rectangleEnd = source.indexOf('\n\n  const nodes = new Map();', rectangleStart);
assert(rectangleStart >= 0 && rectangleEnd > rectangleStart, 'Frozen rectangle seam changed');
replace(source.slice(rectangleStart, rectangleEnd), `  function rectangle(node) {
    const g = NativeGeometry.layout(width, height, left, top);
    const withXY = r => ({x: r.left, y: r.top, ...r});
    if (node.id === 'life1World') return withXY(g.world);
    if (node.id === 'missionStatus') return rect(left, top - statusHeight, width, statusHeight);
    if (node.id === 'life1Player') return withXY(NativeGeometry.playerRect(g,
      parseFloat(node.style.left || '50%'), parseFloat(node.style.top || '68%')));
    const obstacle = ['rock-a', 'rock-b', 'crate-a'].findIndex(name => node.classList.contains(name));
    if (obstacle >= 0) return withXY(g.rawObstacles[obstacle]);
    const id = node.id === 'repairTerminal' ? 'repair' : node.id === 'antennaHotspot' ? 'antenna' :
      node.classList.contains('energy') ? node.dataset.energy : null;
    if (id) return withXY(NativeGeometry.spotRect(g, id, node.classList.contains('nearby') ? id : null,
      node.classList.contains('collected')));
    return rect(left, top, 76, 76);
  }`);
replace('    Object.defineProperties(node, {', `    Object.defineProperties(node, {
      textContent: {configurable: true, enumerable: true,
        get() {return this._textContent || '';},
        set(value) {
          const text = String(value), previousText = this._textContent || '';
          this._textContent = text;
          if (this.id !== 'missionStatus') return;
          const before = {width, height, left, top, statusHeight};
          if (statusResize && text.startsWith('Energy collected • ')) {
            liveDimensions(width, 495.84375); statusHeight = 30;
          }
          if (statusTextHook) {
            const next = statusTextHook({text, previousText, dispatchMs: now,
              world: {width, height, left, top}, resize: liveDimensions});
            if (next) {
              liveDimensions(next.width ?? width, next.height ?? height, next.left ?? left, next.top ?? top);
              if (next.statusHeight != null) {assert(Number.isFinite(next.statusHeight)); statusHeight = next.statusHeight;}
            }
          }
          statusMutations.push({text, previousText, dispatchMs: now, before,
            after: {width, height, left, top, statusHeight}});
        }
      },`);
replace('  let now = 0, nextId = 0, memoryCodeShows = 0;', `  assert(Number.isFinite(initialNow) && initialNow >= 0, 'initialNow must be finite and nonnegative');
  let now = initialNow, nextId = 0, memoryCodeShows = 0;
  let sampleQueue = [], sampleIndex = 0, sampleOffset = 0;
  const sampleLog = [], timerRegistrations = [], storageWrites = [];
  function configurePerformance(sequence = [], options = {}) {
    assert(Array.isArray(sequence) && sequence.every(Number.isFinite), 'performance samples must be finite');
    const offset = options.offset ?? sampleOffset;
    assert(Number.isFinite(offset), 'performance offset must be finite');
    sampleQueue = sequence.slice(); sampleIndex = 0; sampleOffset = offset;
  }
  configurePerformance(performanceNow, {offset: performanceOffset});
  function performanceSample() {
    const queued = sampleIndex < sampleQueue.length;
    const value = queued ? sampleQueue[sampleIndex++] : sampleOffset === 0 ? now : now + sampleOffset;
    assert(Number.isFinite(value), 'performance sample must be finite');
    sampleLog.push({index: sampleLog.length, dispatchMs: now, value, queued});
    return value;
  }`);
replace('  const timers = new Map(), frames = new Map(), storage = new Map();', `  const timers = new Map(), frames = new Map(), storage = new Map(Object.entries(storageSeed).map(([k, v]) => [k, String(v)]));
  const saveControl = {refuse: false, keys: null, all: false};`);
replace('    timers.set(id, {callback, delay: Number(delay), due: now + Number(delay), repeating}); return id;', `    const task = {callback, delay: Number(delay), due: now + Number(delay), repeating,
      registeredDispatchMs: now, lastPerformanceSample: sampleLog.length ? sampleLog[sampleLog.length - 1].value : null};
    timers.set(id, task);
    timerRegistrations.push({id, delay: task.delay, due: task.due, repeating,
      registeredDispatchMs: now, lastPerformanceSample: task.lastPerformanceSample});
    return id;`);
replace('performance: {now: () => now}', 'performance: {now: performanceSample}');
replace("localStorage: {getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value))}", `localStorage: {
      getItem: key => storage.get(String(key)) ?? null,
      setItem(key, value) {
        key = String(key); value = String(value);
        const refused = !!(saveControl.refuse && (saveControl.all || (saveControl.keys ?
          saveControl.keys.includes(key) : key === context.__C1VNext?.KEY)));
        storageWrites.push({key, value, dispatchMs: now, refused});
        if (refused) throw Error('fixture quota');
        storage.set(key, value);
      },
      removeItem: key => storage.delete(String(key)), clear: () => storage.clear(),
      key: index => [...storage.keys()][index] ?? null, get length() {return storage.size;}
    }`);
replace("  run('const $ = id => document.getElementById(id);');", `  run('const $ = id => document.getElementById(id);');
  context.LocalLife1VNextRecorder = Recorder;
  context.TextEncoder = TextEncoder;
  context.Life1NativeGeometry = NativeGeometry;
  run(adapterSource);
  assert(context.__C1VNext && typeof context.__C1VNext.armFresh === 'function', 'Missing vNext capture adapter');
  if (!storage.has(context.__C1VNext.KEY)) context.__C1VNext.armFresh(recordingContext, limits);`);
replace('  run("show(\'mission1\'); resetLife1Mission();");', `  run("show('mission1'); resetLife1Mission();");
  const campaign = instrument(fs.readFileSync(path.join(root, 'campaign.js'), 'utf8'), 'campaign.js');
  const campaignPart = excerpt(campaign, " const key=n=>'mkty_campaign_checkpoint_'+n;", ' function needsCode(){');
  run('window.MKTYCampaign=(()=>{' + campaignPart.code + 'current=1;return {save,restore,onScreen(){}};})();');
  if (restoreCampaign && storage.has('mkty_campaign_checkpoint_1')) run('MKTYCampaign.restore(1);');`);
replace('  const copy = value => JSON.parse(JSON.stringify(value));', `  // Preserve raw doubles and signed zero; JSON.stringify is not a clock clone.
  const copy = value => Array.isArray(value) ? Array.from(value, copy) : value && typeof value === 'object' ?
    Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, copy(entry)])) : value;`);
replace("      moveX:l1MoveX,moveY:l1MoveY,lastFrame:l1LastFrame,nearbyAt:l1NearbyAt,stage:life1Stage,", "      moveX:l1MoveX,moveY:l1MoveY,lastFrame:l1LastFrame,nearbyAt:l1NearbyAt,clockResumedAt:missionClockResumedAt,stage:life1Stage,");
replace('    return {...result, now, memoryCodeShows, panels:', `    return {...result, now, dispatchMs: now, memoryCodeShows,
      rawClocks: {dispatchMs: now, lastFrame: result.lastFrame, nearbyAt: result.nearbyAt,
        clockResumedAt: result.clockResumedAt, performanceLast: sampleLog.length ? sampleLog[sampleLog.length - 1].value : null,
        performanceSamples: sampleLog.length},
      liveGeometry: {width, height, left, top},
      panels:`);
replace("      rectangles: {player: rectangle($('life1Player')), energies: energies.map(rectangle), repair: rectangle($('repairTerminal')), antenna: rectangle($('antennaHotspot'))}};", `      rectangles: {world: rectangle($('life1World')), status: rectangle($('missionStatus')),
        player: rectangle($('life1Player')), energies: energies.map(rectangle),
        obstacles: document.querySelectorAll('#life1World .l1-obstacle').map(rectangle),
        repair: rectangle($('repairTerminal')), antenna: rectangle($('antennaHotspot'))}};`);
replace('    snapshot,\n    setClock(timestamp)', `    snapshot,
    capture: () => context.__C1VNext,
    source: () => ({...snapshot(),
      ...(typeof context.__C1VNext.source === 'function' ? copy(context.__C1VNext.source()) : {}),
      signalHoldTimer: run('signalHoldTimer'),
      missionDelayHandles: copy(run('[...(missionDelays.get(1) || [])]')),
      sourceClocks: copy(run('({lastFrame:l1LastFrame,nearbyAt:l1NearbyAt,clockResumedAt:missionClockResumedAt})'))}),
    storage: () => Object.fromEntries(storage),
    storageWrites: () => copy(storageWrites),
    save: () => {run('MKTYCampaign.save();'); return context.__C1VNext.status?.().lastSave;},
    restore: () => context.__C1VNext.restore(),
    refuseStorage(value, options = {}) {
      saveControl.refuse = !!value; saveControl.all = !!options.all;
      assert(options.keys == null || Array.isArray(options.keys), 'storage keys must be an array');
      saveControl.keys = options.keys ? options.keys.map(String) : null;
    },
    performanceSamples(sequence = [], options = {}) {configurePerformance(sequence, options); return snapshot();},
    clocks: () => ({...snapshot().rawClocks, samples: copy(sampleLog), remainingSamples: sampleQueue.length - sampleIndex, offset: sampleOffset}),
    timers: () => [...timers].map(([id, task]) => ({id, delay: task.delay, due: task.due, repeating: task.repeating,
      registeredDispatchMs: task.registeredDispatchMs, lastPerformanceSample: task.lastPerformanceSample})),
    timerRegistrations: () => copy(timerRegistrations),
    statusMutations: () => copy(statusMutations),
    liveResize(w, h, originLeft = left, originTop = top) {liveDimensions(w, h, originLeft, originTop); return snapshot();},
    refresh: () => invoke('refreshLife1Geometry();'),
    nearby: () => invoke('updateLife1Nearby();'),
    fixturePosition(x, y, {clearNearby = false} = {}) {
      assert(!captureEnabled, 'fixturePosition is allowed only in an explicitly capture-disabled source probe');
      assert(Number.isFinite(x) && x >= 7 && x <= 90 && Number.isFinite(y) && y >= 18 && y <= 88, 'fixture position bounds');
      context.fixtureX = x; context.fixtureY = y;
      run('l1PX=fixtureX;l1PY=fixtureY;renderLife1Player();');
      if (clearNearby) run("l1Near=null;document.querySelectorAll('.l1-hotspot').forEach(el=>el.classList.remove('nearby'));");
      return snapshot();
    },
    sourceDistance(id) {
      assert(!captureEnabled, 'sourceDistance is a capture-disabled source probe');
      assert(['1', '2', '3', 'repair', 'antenna'].includes(id), 'source distance target');
      context.fixtureTarget = id;
      return run("l1DistanceTo(fixtureTarget==='repair'?$('repairTerminal'):fixtureTarget==='antenna'?$('antennaHotspot'):[...document.querySelectorAll('.energy')].find(el=>el.dataset.energy===fixtureTarget));");
    },
    dualFrame(frameTime, dispatchTime, x, y) {
      assert(Number.isFinite(frameTime), 'RAF time must be finite'); time(dispatchTime);
      if (x != null) {assert(Number.isFinite(x)); context.fixtureX = x; run('l1MoveX=fixtureX;');}
      if (y != null) {assert(Number.isFinite(y)); context.fixtureY = y; run('l1MoveY=fixtureY;');}
      frames.clear(); context.fixtureNow = frameTime; return invoke('life1MoveLoop(fixtureNow);');
    },
    setClock(timestamp)`);
// Keep the old resize convenience, while ensuring it uses the same validated
// envelope as liveResize. refresh() alone never changes live dimensions.
replace("    resize(w, h) {dimensions(w, h); return invoke('refreshLife1Geometry();');},", "    resize(w, h, originLeft = left, originTop = top) {liveDimensions(w, h, originLeft, originTop); return invoke('refreshLife1Geometry();');},");
replace("    reset: () => invoke('resetLife1Mission();'), release: () => invoke('stopLife1Stick(null);'),", `    scan: () => invoke('life1Scan();'),
    stick(clientX, clientY) {assert(Number.isFinite(clientX) && Number.isFinite(clientY));context.fixtureStickX=clientX;context.fixtureStickY=clientY;return invoke('setLife1Stick(fixtureStickX,fixtureStickY);');},
    reset: () => invoke('resetLife1Mission();'), release: () => invoke('stopLife1Stick(null);'),`);
const compiled = new Module(fixturePath, module);
compiled.filename = fixturePath;
compiled.paths = Module._nodeModulePaths(__dirname);
compiled._compile(source, fixturePath);

/* create options:
 * - width/height/left/top; statusResize:true reproduces the measured first-collect
 *   layout change, or statusTextHook observes/changes a synthetic status layout.
 * - initialNow is this VM's dispatch-clock origin. performanceNow is a queue of
 *   exact performance.now samples; performanceOffset is the exhausted-queue
 *   fallback relative to dispatch time. Neither changes supplied RAF timestamps.
 * - context/limits/storageSeed; recorder/instrument/adapterSource may be injected.
 *   capture:false runs an uninstrumented source-only baseline.
 * fresh(options) copies storage into a new VM but never hydrates the recorder.
 * Pause the fresh source explicitly, then call capture().restore().
 * liveResize() only changes DOM rectangles; refresh() invokes the actual source
 * refresh; dualFrame(raf,dispatch,x,y) explicitly separates the two clocks.
 * fixturePosition()/sourceDistance() are isolated capture:false source probes,
 * never accepted recording input or a gameplay/hydration authority.
 * clocks(), timers(), timerRegistrations(), statusMutations(), storageWrites()
 * are read-only synthetic-harness diagnostics and never sample performance.now.
 */
function create(options = {}) {
  const recordingContext = options.context || DEFAULT_CONTEXT;
  // Imports are lazy so tests can inject a tiny adapter/instrument pair while the
  // new modules are under review. Default mode always uses the vNext modules.
  const disabled = options.capture === false;
  const Recorder = options.recorder || options.Recorder || (disabled ? {} : require('../../prototypes/life1-capture/vnext/recorder.cjs'));
  const instrument = options.instrument || (disabled ? value => value : require('./life1-recording-vnext-instrument.cjs').instrument);
  const adapterSource = options.adapterSource ?? (disabled ? `window.__C1VNext=Object.freeze({
    KEY:'mkty_test_life1_vnext_disabled',armFresh(){return {ok:true};},
    restore(){return {ok:false,error:'capture-disabled'};},save(){return {ok:false,error:'capture-disabled'};},
    state(){return null;},wire(){return null;},compare(){return {ok:false,error:'capture-disabled'};},
    status(){return {recording:false,fault:null,disabled:true};}
  });` : fs.readFileSync(path.join(root, 'prototypes/life1-capture/vnext/controller-adapter.js'), 'utf8'));
  assert.equal(typeof instrument, 'function', 'instrument must be a function');
  assert.equal(typeof adapterSource, 'string', 'adapterSource must be source text');
  const controller = compiled.exports.createController({...options, recordingContext,
    random: options.random || M.random(M.challengeSeed(recordingContext)), Recorder, instrument, adapterSource, captureEnabled: !disabled});
  // New VM, new timer handles and unrebased source clock registers. Hydration is
  // explicit through restore()/capture().restore(); this does not auto-resume.
  controller.fresh = (nextOptions = {}) => create({...options, ...nextOptions,
    storageSeed: nextOptions.storageSeed ?? controller.storage()});
  return controller;
}
module.exports = {create, DEFAULT_CONTEXT, MEASURED_GEOMETRY, measuredGeometry: MEASURED_GEOMETRY};
