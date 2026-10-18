// Deferred features for the Telegram port — stubs only, intentionally NOT implemented in the closed test.
// They exist so the game code has stable call sites; each returns {ok:false, deferred:true} and never contacts the server.
//   friendHelp:   ask a Telegram friend to speed up a robot job / gift energy (needs referral graph + a 'world.help' action)
//   notify:       bot messages "robot returned" / "storage full" (needs the bot webhook deployed, user opt-in via
//                 WebApp.requestWriteAccess(), a scheduled job and per-player throttling; no unsolicited messages)
export const DEFERRED = Object.freeze({ friendHelp: true, notifyRobotReturned: true, notifyStorageFull: true });
const stub = (name) => async () => { if (typeof console !== 'undefined') console.info('[mkty] deferred feature:', name); return { ok: false, deferred: true, feature: name }; };
export const friendHelp = { request: stub('friendHelp.request'), list: stub('friendHelp.list'), accept: stub('friendHelp.accept') };
export const notify = { robotReturned: stub('notify.robotReturned'), storageFull: stub('notify.storageFull'), optIn: stub('notify.optIn') };
