/* Execute the actual release verifier with a fake filesystem, fetch, process,
   clock and timers. No sockets, servers, browser or real API calls are used. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(process.env.MKTY_VERIFY_LIVE_SOURCE || path.join(__dirname, '../tools/verify-live.cjs'), 'utf8');
const viewport = fs.readFileSync(path.join(__dirname, '../viewport.js'));
const site = 'https://moonkattymky.github.io/moonkatty-game/';
const api = 'https://lswbmgoeinblzuqzakvi.supabase.co/functions/v1/';
const version = 'test-release', sha = '1'.repeat(40), root = '/release-fixture';

async function run(options = {}) {
  const requests = [], reads = [], sleeps = [], deadlines = [], logs = [], errors = [], nonces = new Set();
  const local = new Map([
    ['index.html', Buffer.from('<meta name="mkty-release" content="' + version + '">')],
    ['viewport.js', Buffer.from(viewport)]
  ]);
  const build = {version, sha, ...options.build};
  const fakeProcess = {env: {GITHUB_SHA: sha}, exitCode: undefined};
  let attempt = 0, random = 0, watchdog;
  function bytes(file) {
    // All other artifact bytes are deterministic binary fixtures, not network reads.
    if (!local.has(file)) local.set(file, Buffer.concat([Buffer.from(file), Buffer.from([0, 128, 255])]));
    return Buffer.from(local.get(file));
  }
  const fakeFS = {readFileSync(filename, encoding) {
    assert.equal(path.dirname(filename).startsWith(root), true, 'local reads stay in the fake checkout');
    const file = path.relative(root, filename);
    reads.push(file);
    if (options.readError && file === 'viewport.js') throw Error('fixture local read failure');
    return encoding ? bytes(file).toString(encoding) : bytes(file);
  }};
  const fakeFetch = async (url, init) => {
    assert(requests.length < 400, 'bounded request budget');
    const u = new URL(url), clean = u.origin + u.pathname;
    assert.equal(init.cache, 'no-store');
    assert.equal(init.headers['Cache-Control'], 'no-cache');
    assert.equal(init.signal, deadlines.at(-1));
    const nonce = u.searchParams.get('verify');
    assert.match(nonce, /^123456789-\w+$/);
    assert(!nonces.has(nonce), 'each fetch bypasses previously cached URLs');
    nonces.add(nonce);
    assert.equal(u.searchParams.size, 1);
    assert(clean.startsWith(site) || clean.startsWith(api), 'unexpected URL');
    const file = clean.startsWith(site) ? clean.slice(site.length) : 'api/' + clean.slice(api.length);
    requests.push(file);
    if (file === 'index.html') attempt++;
    let body;
    if (file === 'build.json') body = Buffer.from(options.badJSON ? '{' : JSON.stringify(build));
    else if (file.startsWith('api/')) {
      const name = file.slice(4);
      assert(['rewards', 'telegram-progress', 'mission-control'].includes(name));
      body = Buffer.from(JSON.stringify(name === 'mission-control' ? {ok: true, entries: []} : {ok: true, version}));
      if (options.badAPI && name === 'mission-control') body = Buffer.from('{"ok":true,"entries":null}');
    } else body = bytes(file);
    if (file === 'viewport.js') {
      if (options.fetchError) throw Error('fixture fetch failure');
      if (options.viewport) body = options.viewport(attempt);
    }
    const ok = !(options.httpError && file === 'viewport.js');
    return {ok, status: ok ? 200 : 503, async arrayBuffer() {
      if (options.bodyError && file === 'viewport.js') throw Error('fixture body failure');
      return body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength);
    }};
  };
  const context = {
    __dirname: path.join(root, 'tools'), Buffer, process: fakeProcess, fetch: fakeFetch,
    Date: {now: () => 123456789},
    AbortSignal: {timeout(ms) {assert.equal(ms, 30000); const signal = {ms}; deadlines.push(signal); return signal;}},
    setTimeout(fn, ms) {
      assert.equal(ms, 15000);
      assert(sleeps.length < 7, 'the verifier must stop after eight attempts');
      sleeps.push(ms); fn(); return sleeps.length;
    },
    console: {log: (...args) => logs.push(args.join(' ')), error: (...args) => errors.push(args.join(' '))},
    require(name) {
      if (name === 'node:fs') return fakeFS;
      if (name === 'node:path') return path;
      if (name === 'node:crypto') return {randomBytes(size) {assert.equal(size, 5); const b = Buffer.alloc(size); b.writeUInt32BE(++random, 1); return b;}};
      throw Error('Unexpected module (no network modules allowed): ' + name);
    }
  };
  try {
    const completion = vm.runInNewContext(source, context, {filename: 'tools/verify-live.cjs', timeout: 1000});
    assert(completion && typeof completion.then === 'function', 'await the real verifier entrypoint');
    await Promise.race([completion, new Promise((_, reject) => {
      watchdog = setTimeout(() => reject(Error('verifier fixture exceeded its 2s deadline')), 2000);
    })]);
  } finally {clearTimeout(watchdog);}
  assert.equal(deadlines.length, requests.length, 'every mocked fetch has a 30s abort deadline');
  return {requests, reads, sleeps, logs, errors, attempt, build, exitCode: fakeProcess.exitCode};
}

function accepted(result, attempts = 1) {
  assert.equal(result.exitCode, undefined, 'successful verification does not set a failure exit code');
  assert.deepEqual(result.errors, []);
  assert.equal(result.attempt, attempts);
  assert.equal(result.sleeps.length, attempts - 1);
  assert.equal(result.logs.filter(line => line.startsWith('PASS:')).length, 1);
  assert.match(result.logs.at(-1), /published SHA, 45 exact files/);
  assert.equal(result.requests.filter(file => file === 'viewport.js').length, attempts);
  assert.equal(result.reads.filter(file => file === 'viewport.js').length, attempts);
  assert.deepEqual(result.requests.slice(-4), ['build.json', 'api/rewards', 'api/telegram-progress', 'api/mission-control']);
}
function rejected(result, message) {
  assert.equal(result.exitCode, 1, 'terminal verification errors must fail the release process');
  assert.equal(result.attempt, 8, 'retry exactly eight times');
  assert.deepEqual(result.sleeps, Array(7).fill(15000), 'only seven fake backoff timers');
  assert.equal(result.logs.length, 7);
  result.logs.forEach((line, i) => assert.match(line, new RegExp('^Waiting for publication \\(' + (i + 1) + '/8\\):')));
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], message);
  assert(!result.logs.some(line => line.startsWith('PASS:')));
}

(async () => {
  const good = await run();
  accepted(good);
  const artifacts = good.requests.filter(file => file !== 'build.json' && !file.startsWith('api/'));
  assert.equal(artifacts.length, 45); // 40 2D files + world3d-entry.js and 4 world3d/ files
  assert.equal(new Set(artifacts).size, 45, 'each artifact is checked exactly once');
  for (const file of ['index.html', 'app.js', 'viewport.js']) assert(artifacts.includes(file));

  const stale = Buffer.from('// stale viewport bundle from before the native-range fix\n');
  const different = Buffer.from(viewport);
  different[different.length - 1] ^= 1; // Same length, only one byte differs.
  for (const body of [stale, different]) {
    const result = await run({viewport: () => body});
    assert.deepEqual(result.build, {version, sha}, 'even the expected build stamp cannot bless mismatched bytes');
    rejected(result, /^Published file differs: viewport\.js$/);
    assert.equal(result.requests.filter(file => file === 'viewport.js').length, 8);
    assert(!result.requests.some(file => file === 'build.json' || file.startsWith('api/')), 'mismatch fails before later checks');
  }
  accepted(await run({viewport: attempt => attempt < 8 ? stale : Buffer.from(viewport)}), 8);

  for (const [options, error] of [
    [{httpError: true}, /viewport\.js: HTTP 503$/],
    [{fetchError: true}, /^fixture fetch failure$/],
    [{bodyError: true}, /^fixture body failure$/],
    [{readError: true}, /^fixture local read failure$/],
    [{build: {sha: '2'.repeat(40)}}, /^Published version\/SHA differs$/],
    [{build: {version: 'old-release'}}, /^Published version\/SHA differs$/],
    [{badJSON: true}, /JSON/],
    [{badAPI: true}, /^API health\/version: mission-control$/]
  ]) rejected(await run(options), error);
  console.log('PASS: actual release verifier accepts matching viewport bytes, rejects stale/single-byte changes despite correct SHA, recovers on retry, and fails bounded file/HTTP/fetch/JSON/build/API errors (socket-free)');
})().catch(error => {console.error(error); process.exitCode = 1;});
