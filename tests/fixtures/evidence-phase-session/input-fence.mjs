// TEST ONLY. Install once after field-missions.js creates its DOM, before opening
// an owned phase session. This fences event handlers, not controller/model APIs.
// Noncancelable input/touch events may already have changed a native control;
// suppressing their listeners cannot undo that value/default action.
const installed = new WeakSet();
const events = ['pointerdown','pointermove','pointerup','pointercancel','lostpointercapture',
  'touchstart','touchmove','touchend','touchcancel','mousedown','mousemove','mouseup',
  'click','auxclick','dblclick','keydown','keyup','keypress','beforeinput','input','change','cancel'];
const controllerKeys = new Set(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',
  'KeyW','KeyA','KeyS','KeyD','Space','w','a','s','d','W','A','S','D',' ']);

export function installPhaseInputFence({document, readView}) {
  const field = document?.getElementById('fieldMission');
  const dialog = document?.getElementById('fieldDialog');
  const window = document?.defaultView;
  if (!field || !dialog || !field.contains(dialog) || !window?.addEventListener ||
      !document.addEventListener || typeof readView !== 'function') throw Error('Invalid phase fence host');
  if (installed.has(document)) throw Error('Phase input fence already installed');
  const counts = {blocked:0, readFailures:0, nonCancelable:0, lastBlockedType:null};
  const increment = key => { counts[key] = Math.min(0xffffffff, counts[key] + 1); };
  function blockUnlessReady(event) {
    try { if (readView()?.playEnabled === true) return; }
    catch { increment('readFailures'); }
    increment('blocked');
    if (!event.cancelable) increment('nonCancelable');
    counts.lastBlockedType = event.type;
    event.preventDefault();
    event.stopImmediatePropagation();
  }
  function fieldEvent(event) {
    const path = event.composedPath?.();
    if (path ? path.includes(field) || path.includes(dialog) :
      event.target && (field.contains(event.target) || dialog.contains(event.target))) blockUnlessReady(event);
  }
  function globalKey(event) {
    // Leave external result Retry/Continue, risk and epilogue controls alone.
    const generic = [window, document, document.body, document.documentElement].includes(event.target);
    if (generic && field.classList.contains('active') &&
        (controllerKeys.has(event.code) || controllerKeys.has(event.key))) blockUnlessReady(event);
  }
  const options = {capture:true, passive:false};
  for (const type of events) document.addEventListener(type, fieldEvent, options);
  for (const type of ['keydown','keyup','keypress']) window.addEventListener(type, globalKey, options);
  installed.add(document);
  // Deliberately no uninstall, allow override, retained events, or state mutators.
  return Object.freeze({diagnostics:() => Object.freeze({...counts})});
}
