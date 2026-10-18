// Telegram Mini App shell for the 3D world: SDK init, expand, safe areas, viewport, back button, haptics, pause on hide.
// Everything is a no-op outside Telegram (plain browser / tests), so the same build runs on GitHub Pages directly.
const W = typeof window !== 'undefined' ? window : {};
// Only treat it as Telegram when the SDK has real launch data; in a plain browser the SDK still loads (version 6.0)
// and would log 'not supported' warnings for every API call.
export const TG = W.Telegram && W.Telegram.WebApp && W.Telegram.WebApp.initData ? W.Telegram.WebApp : null;
export const inTelegram = () => !!(TG && TG.initData);
const ver = (v) => { try { return !!TG && TG.isVersionAtLeast(v); } catch (e) { return false; } };
const safe = (f) => { try { return f(); } catch (e) { return undefined; } };

const root = typeof document !== 'undefined' ? document.documentElement : null;
function applyInsets() {
  if (!root) return; const s = (TG && TG.safeAreaInset) || {}, c = (TG && TG.contentSafeAreaInset) || {};
  // top = device safe area + Telegram header controls (fullscreen); CSS falls back to env(safe-area-inset-*)
  for (const k of ['top', 'bottom', 'left', 'right']) root.style.setProperty('--tg-inset-' + k, ((s[k] || 0) + (c[k] || 0)) + 'px');
  const h = TG && (TG.viewportStableHeight || TG.viewportHeight); if (h) root.style.setProperty('--tg-vh', h + 'px');
}

// ---------- haptics (Bot API 6.1+) ----------
export const haptic = {
  impact(style = 'light') { if (ver('6.1')) safe(() => TG.HapticFeedback.impactOccurred(style)); },
  notify(type = 'success') { if (ver('6.1')) safe(() => TG.HapticFeedback.notificationOccurred(type)); },
  select() { if (ver('6.1')) safe(() => TG.HapticFeedback.selectionChanged()); },
};

// ---------- pause / resume ----------
const pauseHandlers = new Set(); let paused = false;
export function onPause(fn) { pauseHandlers.add(fn); return () => pauseHandlers.delete(fn); }
function setPaused(p) { if (p === paused) return; paused = p; for (const f of pauseHandlers) safe(() => f(p)); }
export const isPaused = () => paused;

// ---------- back button: a stack of "close the top thing" handlers; empty stack = leave the 3D world ----------
const backStack = [];
export function pushBack(closeFn) { backStack.push(closeFn); syncBack(); return () => { const i = backStack.lastIndexOf(closeFn); if (i >= 0) backStack.splice(i, 1); syncBack(); }; }
let backExit = null; // set by initTelegram: where the empty-stack back press goes
function syncBack() { if (!TG || !ver('6.1')) return; safe(() => (backStack.length || backExit) ? TG.BackButton.show() : TG.BackButton.hide()); }
let interceptor = null; export function setBackInterceptor(fn) { interceptor = fn; }
function onBack() { haptic.impact('light'); if (interceptor && safe(interceptor)) return; const top = backStack.pop(); if (top) { safe(top); syncBack(); return; } if (backExit) backExit(); }

export function initTelegram({ exitUrl = '../', onResize } = {}) {
  const api = { inTelegram: inTelegram(), haptic, onPause, pushBack, setBackInterceptor, isPaused, TG, back: () => onBack() };
  W.MKTYTG = api;
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => setPaused(document.hidden));
  if (!TG) { applyInsets(); return api; }
  if (root) root.classList.add('tg'); // Telegram-only presentation tweaks (index.html CSS)
  safe(() => TG.ready());
  safe(() => TG.expand());
  if (ver('7.7')) safe(() => TG.disableVerticalSwipes()); // joystick drags must not swipe the Mini App closed
  if (ver('6.1')) { safe(() => TG.setHeaderColor('#05070d')); safe(() => TG.setBackgroundColor('#05070d')); }
  if (ver('7.10')) safe(() => TG.setBottomBarColor('#05070d'));
  if (ver('6.2')) safe(() => TG.enableClosingConfirmation()); // progress is saved continuously; this only guards accidental swipes
  applyInsets();
  const resized = () => { applyInsets(); if (onResize) onResize(); else safe(() => W.dispatchEvent(new Event('resize'))); };
  safe(() => TG.onEvent('viewportChanged', (e) => { if (!e || e.isStateStable !== false) resized(); }));
  safe(() => TG.onEvent('safeAreaChanged', applyInsets)); safe(() => TG.onEvent('contentSafeAreaChanged', applyInsets));
  safe(() => TG.onEvent('fullscreenChanged', resized));
  safe(() => TG.onEvent('activated', () => setPaused(document.hidden))); safe(() => TG.onEvent('deactivated', () => setPaused(true)));
  backExit = () => { if (exitUrl) location.href = exitUrl; else safe(() => TG.close()); };
  safe(() => TG.BackButton.onClick(onBack)); syncBack();
  return api;
}
