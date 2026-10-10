/* Socket-free test of the real viewport listeners, not a native-drag substitute.
   antenna-native-touch.cjs separately exercises browser default actions in CI. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(process.env.MKTY_VIEWPORT_SOURCE || path.join(__dirname, '../viewport.js'), 'utf8');
function harness(version = '8.0') {
  const listeners = {}, calls = [], classes = new Set(), properties = {};
  const root = {style: {setProperty(k, v) {properties[k] = v;}, removeProperty(k) {delete properties[k];}},
    classList: {add(k) {classes.add(k);}, toggle(k, value) {value ? classes.add(k) : classes.delete(k);}}};
  const body = element();
  const document = {documentElement: root, body, addEventListener(type, fn, options) {listeners[type] = {fn, options};}};
  const tg = {version, platform: 'ios', viewportStableHeight: 844, isFullscreen: false,
    isVersionAtLeast(v) {const a = version.split('.').map(Number), b = v.split('.').map(Number); return a[0] > b[0] || a[0] === b[0] && a[1] >= b[1];},
    ready() {}, expand() {}, setHeaderColor() {}, setBackgroundColor() {}, setBottomBarColor() {},
    disableVerticalSwipes() {calls.push('disableVerticalSwipes');}, requestFullscreen() {calls.push('requestFullscreen');}, onEvent() {}};
  vm.runInNewContext(source, {document, window: {Telegram: {WebApp: tg}, addEventListener() {}},
    getComputedStyle: e => ({overflowY: e.overflowY || 'visible', overflowX: e.overflowX || 'visible'}), setTimeout() {}});
  function gesture(target, {dx = 0, dy = 0, cancelable = true, count = 1} = {}) {
    const touches = (x, y) => Array.from({length: count}, (_, id) => ({identifier: id, target, clientX: x, clientY: y}));
    listeners.touchstart.fn({target, touches: touches(100, 200)});
    const event = {target, touches: touches(100 + dx, 200 + dy), cancelable, defaultPrevented: false,
      preventDefault() {assert(this.cancelable); this.defaultPrevented = true;}};
    listeners.touchmove.fn(event);
    return event.defaultPrevented;
  }
  return {body, listeners, calls, gesture};
}
function element(options = {}) {
  return Object.assign({nodeType: 1, parentElement: null, scrollHeight: 100, clientHeight: 100,
    scrollWidth: 100, clientWidth: 100, scrollTop: 0,
    closest(selector) {
      for (let node = this; node; node = node.parentElement) {
        if (selector === 'input[type="range"]:enabled') {
          if (node.range && !node.disabled && !node.disabledFieldset) return node;
        } else if (selector === '.l1-joystick,.exp-joystick,.exp-controls,canvas,[data-mk-no-scroll]' && node.custom) return node;
      }
      return null;
    }}, options);
}
const h = harness(), panel = element({parentElement: h.body}), dial = element({range: true, parentElement: panel});
assert.equal(h.listeners.touchstart.options.passive, true);
assert.equal(h.listeners.touchmove.options.passive, false);
for (const [label, dx, dy] of [['horizontal right', 90, 0], ['horizontal left', -90, 0], ['diagonal', 80, 45], ['vertical down', 0, 70], ['vertical up', 0, -70]]) {
  assert.equal(h.gesture(dial, {dx, dy}), false, label + ': enabled native range must keep its default action');
}
// A scrollable panel at its boundary must not capture a native slider gesture either.
panel.overflowY = 'auto'; panel.scrollHeight = 300;
for (const top of [0, 200]) {panel.scrollTop = top; assert.equal(h.gesture(dial, {dy: top ? -50 : 50}), false);}
panel.overflowY = 'visible';
for (const blocked of [element({range: true, disabled: true, parentElement: panel}), element({range: true, disabledFieldset: true, parentElement: panel}), element({parentElement: panel})]) {
  assert.equal(h.gesture(blocked, {dy: 40}), true, 'disabled ranges and ordinary inputs do not bypass page-bounce protection');
}
for (const name of ['joystick', 'expedition joystick', 'expedition controls', 'canvas', 'no-scroll region']) {
  const custom = element({custom: name, parentElement: panel}), child = element({parentElement: custom});
  for (const target of [custom, child]) assert.equal(h.gesture(target, {dx: 30, dy: -40}), true, name + ' remains protected');
}
assert.equal(h.gesture(panel, {dy: 50}), true, 'unscrollable page remains protected');
assert.equal(h.gesture(panel, {dy: 50, cancelable: false}), false, 'noncancelable event is not canceled');
assert.equal(h.gesture(panel, {dy: 50, count: 2}), false, 'existing multitouch policy is unchanged');
const scroll = element({overflowY: 'auto', scrollHeight: 300, clientHeight: 100, parentElement: h.body});
const content = element({parentElement: scroll});
for (const [top, dy, prevented] of [[0, 50, true], [0, -50, false], [100, 50, false], [100, -50, false], [200, -50, true], [200, 50, false]]) {
  scroll.scrollTop = top; assert.equal(h.gesture(content, {dy}), prevented, `scroll boundary ${top}/${dy}`);
}
const horizontal = element({overflowX: 'auto', scrollWidth: 300, parentElement: h.body});
assert.equal(h.gesture(horizontal, {dx: 50}), false, 'existing horizontal scroll container remains usable');
for (const [version, expected] of [['7.0', []], ['7.7', ['disableVerticalSwipes']], ['8.0', ['disableVerticalSwipes', 'requestFullscreen']]]) {
  assert.deepEqual(harness(version).calls, expected, 'Telegram feature guards ' + version);
}
console.log('PASS: native-range exemption, disabled controls, custom controls, page bounce, scroll boundaries and Telegram feature guards');
