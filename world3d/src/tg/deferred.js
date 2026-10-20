// Telegram social features for the 3D world (file name kept for the stable call sites). Feature flags:
//   friendHelp: friends (the referral graph: who invited you / whom you invited) speed up each other's robots.
//               One help per friend per UTC day (server-enforced, <= 3 received/day); every received help makes the
//               receiver's running robot jobs 10% faster (remaining time / 1.1). No Moon Points involved.
//   notify:     opt-in only via Telegram WebApp.requestWriteAccess(); the game then reports when the next robot returns /
//               the storage fills up. The server-side sender is OFF until the operator activates it (server/notify).
// Outside Telegram (or with ?nosocial=1) everything returns {ok:false, deferred:true} and never contacts the server.
const W = typeof window !== 'undefined' ? window : {};
const Q = (() => { try { return new URLSearchParams(W.location ? W.location.search : ''); } catch (e) { return new URLSearchParams(''); } })();
export const FLAGS = Object.freeze({ friendHelp: Q.get('nosocial') !== '1', notify: Q.get('nosocial') !== '1' });
export const DEFERRED = Object.freeze({ friendHelp: !FLAGS.friendHelp, notifyRobotReturned: !FLAGS.notify, notifyStorageFull: !FLAGS.notify });
export const HELP_SPEED = 1.1, BOT = 'MoonKattyGameBot';
let be = null; export function bindSocial(backend) { be = backend && typeof backend.call === 'function' && backend.uid ? backend : null; return !!be; }
export const socialReady = () => !!be;
const off = (name) => ({ ok: false, deferred: true, feature: name });
const call = async (name, flag, action, extra) => { if (!flag || !be) return off(name); try { return await be.call(action, extra); } catch (e) { return { ok: false, error: 'offline' }; } };
export const friendHelp = {
  list: () => call('friendHelp.list', FLAGS.friendHelp, 'world.friends'),
  request: (friendId) => call('friendHelp.request', FLAGS.friendHelp, 'world.help', { friend_id: Number(friendId) }),
  accept: () => call('friendHelp.accept', FLAGS.friendHelp, 'world.help.claim'),
  inviteUrl: () => be ? `https://t.me/${BOT}?startapp=ref_${be.uid}` : null,
};
// Apply n received helps to the running jobs: each one shortens the remaining time to 1/1.1 (= +10% speed). Returns jobs touched.
export function applyFriendBoost(jobs, n, now) { if (!Array.isArray(jobs) || !(n > 0)) return 0; const k = Math.pow(HELP_SPEED, Math.min(n, 9)); let c = 0;
  for (const j of jobs) { if (j && j.end > now && j.start < now) { j.end = Math.round(now + (j.end - now) / k); c++; } } return c; }
const tg = () => (W.Telegram && W.Telegram.WebApp && W.Telegram.WebApp.initData ? W.Telegram.WebApp : null);
let lastSched = { robot: undefined, storage: undefined };
export const notify = {
  status: () => call('notify.status', FLAGS.notify, 'world.notify.status'),
  // on=true: ask Telegram for permission first; only a granted request is stored on the server.
  async optIn(on = true, lang = 'ru') {
    if (!FLAGS.notify || !be) return off('notify.optIn');
    if (on) { const T = tg(); if (!T || typeof T.requestWriteAccess !== 'function') return { ok: false, error: 'unsupported' };
      const allowed = await new Promise((res) => { try { T.requestWriteAccess((ok) => res(!!ok)); } catch (e) { res(false); } setTimeout(() => res(false), 60000); });
      if (!allowed) return { ok: false, error: 'denied' }; }
    lastSched = { robot: undefined, storage: undefined };
    return call('notify.optIn', true, 'world.notify.optin', { on: !!on, lang });
  },
  // seconds until the event (null = nothing pending). Only re-sent when it moves by more than a minute.
  robotReturned: (sec) => schedule('robot', sec), storageFull: (sec) => schedule('storage', sec),
};
async function schedule(kind, sec) {
  if (!FLAGS.notify || !be) return off('notify.' + kind);
  const v = sec == null || !(sec >= 0) ? null : Math.min(48 * 3600, Math.round(sec)); const at = v == null ? null : Date.now() + v * 1000, prev = lastSched[kind];
  if (prev !== undefined && (prev === at || (prev != null && at != null && Math.abs(prev - at) < 60000))) return { ok: true, skipped: true };
  lastSched[kind] = at; return call('notify.' + kind, true, 'world.notify.schedule', { [kind === 'robot' ? 'robot_in' : 'storage_in']: v });
}
