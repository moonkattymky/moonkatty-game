/* Socket-free regression of the actual movement loop, stop handler and document touch guard.
   This verifies the neutral-held modal transition without claiming physical multitouch coverage. */
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const source = fs.readFileSync(process.env.MKTY_APP_SOURCE || path.join(__dirname, '../app.js'), 'utf8');
function section(start, end) {const a = source.indexOf(start), b = source.indexOf(end, a); assert(a >= 0 && b > a); return source.slice(a, b);}
const production = section('function life1MoveLoop(now){', 'function setLife1Stick(') + section('function stopLife1Stick(pointerId){', 'if(l1Joy){');
function harness() {
  const panels = {repairPanel: {hidden: true}, antennaPanel: {hidden: true}, life1Complete: {hidden: true}};
  let touchmove, renders = 0, frames = 0;
  const context = vm.createContext({l1LastFrame: 0, l1MoveFrame: 0, l1MoveX: 0, l1MoveY: 0, l1Walking: false, l1WalkDistance: 0,
    l1Stick: {style: {transform: 'translate(0,0)'}}, document: {hidden: false, addEventListener(type, fn) {assert.equal(type, 'touchmove'); touchmove = fn;}},
    window: {MKTYExperience: {paused: false}}, $: id => id === 'mission1' ? {classList: {contains: () => true}} : panels[id],
    requestAnimationFrame() {frames++; return frames;}, renderLife1Player() {renders++;}});
  vm.runInContext(production, context);
  const run = code => vm.runInContext(code, context);
  function canceled() {let prevented = false; touchmove({target: {id: 'frequencyDial'}, preventDefault() {prevented = true;}, stopPropagation() {}}); return prevented;}
  return {panels, context, run, canceled, renders: () => renders, frames: () => frames};
}
for (const blocker of ['antennaPanel', 'repairPanel', 'life1Complete', 'hidden', 'paused']) {
  const h = harness();
  h.run('l1JoystickActive=true; l1PointerId=17;');
  assert(h.canceled(), 'held joystick initially suppresses page touchmove');
  if (blocker === 'hidden') h.context.document.hidden = true;
  else if (blocker === 'paused') h.context.window.MKTYExperience.paused = true;
  else h.panels[blocker].hidden = false;
  h.run('life1MoveLoop(100);');
  assert.equal(h.run('l1JoystickActive'), false, blocker + ': modal/inactive transition releases a neutral held stick');
  assert.equal(h.run('l1PointerId'), null);
  assert.equal(h.canceled(), false, blocker + ': range gesture is no longer globally intercepted');
  assert.equal(h.renders(), 1, 'release renders once');
  for (let i = 1; i <= 10; i++) h.run(`life1MoveLoop(${100 + i * 16});`);
  assert.equal(h.renders(), 1, 'inactive idle frames do not repeatedly stop/render');
}
const h = harness();
h.run('l1JoystickActive=true; l1PointerId=17; life1MoveLoop(100);');
assert.equal(h.run('l1JoystickActive'), true, 'neutral joystick stays held during active exploration');
h.run('stopLife1Stick(18);'); assert(h.canceled(), 'unrelated pointer release must not release a held joystick');
h.run('stopLife1Stick(17);'); assert.equal(h.canceled(), false, 'own pointer release clears suppression');
for (const state of ['l1MoveX=1', 'l1MoveY=-1', 'l1Walking=true']) {
  const old = harness(); old.panels.antennaPanel.hidden = false; old.run(state + '; life1MoveLoop(100);');
  assert.equal(old.run('l1MoveX || l1MoveY || l1Walking'), false, 'existing moving/walking release is retained');
}
console.log('PASS: neutral-held modal/hidden/pause release, no idle re-render, active joystick and pointer ownership');
