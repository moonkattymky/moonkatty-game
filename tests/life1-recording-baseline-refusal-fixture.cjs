'use strict';
/* Expected-refusal characterization of the FROZEN old native reload fixture.
 * Import is side-effect-free. --validate-only reads existing evidence only.
 * Native execution is CI-only, in a bounded child; it never changes the old
 * fixture or settles/refreshes geometry to turn its refusal into acceptance.
 * A passing wrapper does not mean the old reload gate or native vNext passed.
 */
const {isDeepStrictEqual} = require('node:util');
const FROZEN_HASHES = Object.freeze({
  'tests/life1-recording-browser-fixture.cjs': 'd3478392c664dd2c7ae26533b57262dd94f1e505d753f2e8c29a252c36fa0717',
  'tests/fixtures/life1-recording-browser-helper.cjs': '4b75d994d135a3edc6c3fcb39e37e9911499015e01fafb1788791887828e6852'
});
const PROFILE = 'life1-css-3b1f9f8b-chromium145-settled-v2';
const oldWorld = {left: 14, top: 83.15625, right: 376, bottom: 567.125, width: 362, height: 483.96875};
const newWorld = {left: 14, top: 83.15625, right: 376, bottom: 579, width: 362, height: 495.84375};
const oldObstacles = [
  {left: 26.95959944751381, right: 42.204765193370164, top: 55.54581261703364, bottom: 63.22399431781495},
  {left: 74.69354281767956, right: 86.95614640883977, top: 66.69141860915606, bottom: 72.94182217343578},
  {left: 56.79385359116023, right: 68.06370856353591, top: 44.51540001291406, bottom: 50.2905662813973}
];
const newObstacles = [
  {left: 26.95959944751381, right: 42.204765193370164, top: 55.43820507972521, bottom: 62.93250141803743},
  {left: 74.69354281767956, right: 86.95614640883977, top: 66.60364278061385, bottom: 72.70435495052625},
  {left: 56.79385359116023, right: 68.06370856353591, top: 44.43246990609441, bottom: 50.069326274658096}
];
const rawObstacles = [
  {left: 108.59375, top: 329.953125, right: 169.78125, bottom: 391.140625, width: 61.1875, height: 61.1875},
  {left: 281.390625, top: 387.78125, right: 331.78125, bottom: 438.171875, width: 50.390625, height: 50.390625},
  {left: 216.59375, top: 281.75, right: 263.390625, bottom: 328.546875, width: 46.796875, height: 46.796875}
];
const localSpots = [
  {id: '1', left: 37, top: 324.578125, width: 52, height: 62},
  {id: '2', left: 105.390625, top: 170.359375, width: 52, height: 62},
  {id: '3', left: 287.40625, top: 223.375, width: 52, height: 62},
  {id: 'repair', left: 243.8125, top: 378.703125, width: 74, height: 85},
  {id: 'antenna', left: 274.609375, top: 78.109375, width: 72, height: 94}
];
const oldGeometry = {id: PROFILE, width: 362, height: 483.96875, left: 14, top: 83.15625,
  innerWidth: 360, innerHeight: 481.96875, obstacles: oldObstacles,
  spots: localSpots.map(p => ({id: p.id, x: p.left + p.width / 2, y: p.top + p.height / 2})),
  native: {id: PROFILE, world: oldWorld, innerWidth: 360, innerHeight: 481.96875,
    rawObstacles, obstacles: oldObstacles, localSpots}};
const oldStatus = {text: 'Explore Moon Base Alpha. Use SCAN to reveal nearby energy signatures.',
  rect: {left: 14, top: 788.125, right: 376, bottom: 830, width: 362, height: 41.875}};
const newStatus = {text: 'Energy collected • 1/3',
  rect: {left: 14, top: 800, right: 376, bottom: 830, width: 362, height: 30}};
const animation = {reducedMotion: true, name: 'none', transform: 'none', active: []};
const expectedFault = {error: 'unsettled-live-size', detail: null};
function snapshot(snapshotMs, world, cacheHeight, status, now, lastFrame) {
  return {snapshotMs, world, sourceCache: {width: 362, height: cacheHeight,
    obstacles: cacheHeight === 483.96875 ? oldObstacles : newObstacles},
    recorded: now === null ? null : {now, lastFrame, view: {left: 14, top: 83.15625},
      geometry: oldGeometry, liveWorld: oldWorld}, status, stage: 0, animation};
}
// Pure causal validator. Native geometry and payloads stay exact; the initial
// virtual-clock epoch can differ with startup. Unrelated failures stay failures.
function validateBaselineRefusal(report) {
  const mismatch = detail => ({ok: false, error: 'unexpected-baseline-refusal', detail});
  if (!report || typeof report !== 'object' || Array.isArray(report)) return mismatch('report-object');
  const keys = ['base', 'lane', 'cases', 'failures', 'nativeTimingIntervals', 'limits', 'runtimeReady',
    'authoritativeAdmission', 'geometryObservations', 'firstGeometryRefusal'];
  if (!isDeepStrictEqual(Object.keys(report).sort(), keys.sort())) return mismatch('report-fields');
  if (report.base !== 'eaa09304c773129d8b06ec4c85a542e123e13450') return mismatch('frozen-base');
  if (report.lane !== 'reload') return mismatch('reload-lane');
  for (const key of ['cases', 'nativeTimingIntervals', 'limits']) if (!isDeepStrictEqual(report[key], [])) return mismatch(key);
  for (const key of ['runtimeReady', 'authoritativeAdmission']) if (report[key] !== false) return mismatch(key);
  if (!Array.isArray(report.failures) || report.failures.length !== 1 || typeof report.failures[0] !== 'string') return mismatch('exactly-one-failure');
  const lines = report.failures[0].split('\n');
  const prefix = 'AssertionError [ERR_ASSERTION]: collect 1: ';
  if (!lines[0].startsWith(prefix)) return mismatch('collect-1-assertion');
  let status;
  try {status = JSON.parse(lines[0].slice(prefix.length));} catch {return mismatch('failure-status-json');}
  const observations = status?.observations, entries = status?.usage?.entries;
  if (!Number.isSafeInteger(observations) || observations < 6 || !Number.isSafeInteger(entries) || entries !== observations + 1 || entries > 4096) return mismatch('bounded-observation-entry-consistency');
  const bytes = status?.usage?.bytes, tailJSON = JSON.stringify(report.firstGeometryRefusal?.acceptedTail);
  if (typeof tailJSON !== 'string' || !Number.isSafeInteger(bytes) || bytes <= Buffer.byteLength(tailJSON) || bytes > 196608) return mismatch('bounded-reported-prefix-bytes');
  // Frozen fixture creates a381-byte epoch; each minimum event adds21 bytes.
  // Six visible tail entries tighten this lower bound without claiming the
  // absent complete journal has been reconstructed or byte-verified.
  const tail = report.firstGeometryRefusal?.acceptedTail;
  if (!Array.isArray(tail) || tail.length !== 6) return mismatch('six-entry-tail');
  const minimumBytes = 381 + 21 * (observations - 6) + tail.reduce((n,e)=>n+Buffer.byteLength(JSON.stringify(e))+1,0);
  if (bytes < minimumBytes) return mismatch('reported-prefix-byte-lower-bound');
  if (!isDeepStrictEqual(status, {recording: true, fault: expectedFault,
    lastSave: {ok: false, error: 'checkpoint-not-paused', oldCheckpointRetained: true},
    observations, refusedObservations: 3, usage: {entries, bytes}})) return mismatch('exact-old-recorder-fault');
  const expectedDiff = ['+ actual - expected', '', '+ {', '+   detail: null,', "+   error: 'unsettled-live-size'", '+ }', '- null', ''];
  if (!isDeepStrictEqual(lines.slice(1, 9), expectedDiff)) return mismatch('assertion-diff');
  if (lines.length !== 11) return mismatch('assertion-stack-shape');
  const checked = lines[9].match(/^    at checked \((.+\/tests\/life1-recording-browser-fixture\.cjs):55:11\)$/);
  if (!checked || lines[10] !== '    at async main (' + checked[1] + ':104:29)') return mismatch('frozen-assertion-callsite');
  const got = report.geometryObservations, refusal = report.firstGeometryRefusal;
  if (!Array.isArray(got) || got.length !== 5 || !refusal || !Array.isArray(refusal.acceptedTail)) return mismatch('observation-shape');
  const A = got[0]?.snapshot?.snapshotMs, P = got[2]?.snapshot?.recorded?.lastFrame;
  const T = got[2]?.snapshot?.snapshotMs, F = refusal.wrapperDispatchMs, G = got[4]?.snapshot?.snapshotMs;
  const M = refusal.acceptedTail[0]?.[1]?.[1], S = refusal.acceptedTail[2]?.[1]?.[1];
  if (![A,P,T,F,G,M,S].every(t => Number.isFinite(t) && t <= Number.MAX_SAFE_INTEGER) || !(0 <= A && A < M && M < S && S < P && P < T && T < F && F < G && G === T + 32)) return mismatch('causal-callback-clock-order');
  // Pinned Playwright 1.58.2 virtual cadence, not a claim about native RAF.
  // Two unchanged loops deliver twice at each16ms boundary within runFor(32):
  // the first syncView refusal is uncounted, then3 latched observations refuse.
  if (![M,P,F].every(t => t % 16 === 0) || P !== M + 16 || F !== P + 16) return mismatch('pinned-virtual-raf-cadence');
  const causalObservations = [
    {label: 'before armed show/reset', snapshot: snapshot(A, oldWorld, 483.96875, oldStatus, null, null)},
    {label: 'after armed show/reset', snapshot: snapshot(A, oldWorld, 483.96875, oldStatus, 0, 0)},
    {label: 'before collect 1', snapshot: snapshot(T, oldWorld, 483.96875, oldStatus, P, P)},
    {label: 'after collect 1 before clock advance', snapshot: snapshot(T, newWorld, 483.96875, newStatus, T, P)},
    {label: 'collect 1 fault', snapshot: snapshot(G, newWorld, 495.84375, newStatus, T, P)}
  ];
  const causalTail = [
    ['event', ['frame', M, -1, 0]], ['event', ['frame', M, -1, 0]], ['event', ['stop', S]],
    ['event', ['frame', P, 0, 0]], ['event', ['frame', P, 0, 0]], ['event', ['collect', T, '1']]
  ];
  const causalRefusal = {event: ['frame', F, 0, 0], wrapperDispatchMs: F, fault: expectedFault,
    snapshot: snapshot(F, newWorld, 483.96875, newStatus, T, P), acceptedTail: causalTail};
  if (!isDeepStrictEqual(got, causalObservations)) return mismatch('exact-ordered-geometry-observations');
  if (!isDeepStrictEqual(refusal, causalRefusal)) return mismatch('first-refused-frame-and-prefix');
  return {ok: true, evidence: {kind: 'characterized-frozen-reload-refusal', error: 'unsettled-live-size',
    initialSnapshotMs: A, collectMs: T, firstRefusedFrameMs: F, firstRefusedDispatchMs: F, refreshedCacheObservedMs: G,
    worldHeights: [483.96875, 495.84375], statusHeights: [41.875, 30], acceptedModelAndTailUnchanged: true,
    reportedObservations: observations, reportedEntries: entries, reportedPrefixBytes: bytes, wholePrefixByteEqualityVerified: false,
    noAnimationsOrTransforms: true, oldReloadGatePassed: false, runtimeReady: false, authoritativeAdmission: false}};
}

function main(argv = process.argv.slice(2)) {
  const fs = require('node:fs'), path = require('node:path');
  const readReport = filename => {
    if (fs.statSync(filename).size > 2 * 1024 * 1024) throw Error('baseline-report-size');
    const bytes = fs.readFileSync(filename);
    if (bytes.length > 2 * 1024 * 1024) throw Error('baseline-report-size');
    return JSON.parse(bytes.toString('utf8'));
  };
  if (argv[0] === '--validate-only') {
    if (argv.length !== 2) throw Error('Usage: --validate-only <existing-report.json>');
    return {...validateBaselineRefusal(readReport(path.resolve(argv[1]))), validationOnly: true, browserExecuted: false};
  }
  if (argv.length) throw Error('Unknown baseline wrapper arguments');
  // This branch is intentionally never exercised by local source-only tests.
  if (!['true', '1'].includes(process.env.CI) || process.platform !== 'linux') throw Error('Native baseline execution is restricted to Linux CI');
  const crypto = require('node:crypto'), root = path.resolve(__dirname, '..');
  for (const [file, expected] of Object.entries(FROZEN_HASHES)) {
    const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
    if (actual !== expected) throw Error('Frozen baseline file changed: ' + file);
  }
  const out = process.env.MKTY_TEST_OUTPUT || fs.mkdtempSync('/tmp/mkty-life1-baseline-refusal-');
  fs.mkdirSync(out, {recursive: true});
  const childOut = fs.mkdtempSync(path.join(out, 'unchanged-reload-'));
  const fixture = path.join(root, 'tests/life1-recording-browser-fixture.cjs');
  const {spawnSync} = require('node:child_process');
  const child = spawnSync(process.execPath, [fixture], {cwd: root, encoding: 'utf8', detached: true,
    timeout: 200000, maxBuffer: 2 * 1024 * 1024, killSignal: 'SIGKILL',
    env: {...process.env, MKTY_C1_NATIVE_LANE: 'reload', MKTY_TEST_OUTPUT: childOut}});
  if (child.error || child.signal) {
    // Reap the child's process group too if its own 180s cleanup could not run.
    if (Number.isInteger(child.pid) && child.pid > 0) {try {process.kill(-child.pid, 'SIGKILL');} catch {}}
  }
  fs.writeFileSync(path.join(childOut, 'child.stdout.log'), child.stdout || '');
  fs.writeFileSync(path.join(childOut, 'child.stderr.log'), child.stderr || '');
  let result;
  if (child.error || child.signal) result = {ok: false, error: 'baseline-child-failed',
    detail: child.error?.code || child.signal};
  else if (child.status !== 1) result = {ok: false, error: child.status === 0 ? 'unexpected-baseline-success' : 'unexpected-baseline-exit', exitCode: child.status};
  else {
    try {result = validateBaselineRefusal(readReport(path.join(childOut, 'life1-recording-browser.json')));}
    catch (error) {result = {ok: false, error: 'baseline-report-unreadable', detail: error.message};}
  }
  const summary = {...result, childExitCode: child.status, childReportDirectory: childOut,
    frozenBaselineFiles: FROZEN_HASHES, nativeBaselineCharacterizationOnly: true,
    oldReloadGatePassed: false, runtimeReady: false, authoritativeAdmission: false};
  fs.writeFileSync(path.join(out, 'life1-recording-baseline-refusal.json'), JSON.stringify(summary, null, 2) + '\n');
  return summary;
}
module.exports = {validateBaselineRefusal, main, FROZEN_HASHES};
if (require.main === module) {
  try {const result = main(); console.log(JSON.stringify(result)); if (!result.ok) process.exitCode = 1;}
  catch (error) {console.error(error.stack || error.message); process.exitCode = 1;}
}
