# 3D chapter 1 in the Telegram Mini App (closed test)

URL: `https://moonkattymky.github.io/moonkatty-game/world3d/` (tester link: `https://t.me/MoonKattyGameBot?startapp=world3d`,
which opens the normal Mini App and `world3d-entry.js` forwards once per session; `?world3d=1` does the same in a browser).
Flags as in world-preview: `?fast=1`, `?reset=1` (local cache only), `?lang=en`, `?q=low`; new: `?local=1` (ignore the server in Telegram), `?sw=0` (no service worker).

## Build
`bash tools/world3d/build.sh` → `world3d/app.min.js`, stamps `index.html` and `sw.js` with a content hash. Commit the result.
`world3d/dev.html` loads the unbundled sources. The GLB is versioned by `ASSET_V` in `src/main.js` (`?v=39`): bump it (and the preload/`sw.js` list) whenever the model changes.

## Server (rewards function)
`world.state`, `world.save` (CAS on `mkty_world_saves`), `world.reward` (server-side amounts, `world3d:*` keys in `reward_events` through `mkty_reward`).
Migration: `supabase/migrations/20261018170000_world3d_saves.sql`. Deploy all of `server/rewards` (or the bundle from `tools/world3d/bundle-rewards.sh`).

## Rollback
- Client: revert the merge commit on main (Pages redeploys); the 2D game does not depend on world3d.
- Function: redeploy `server/rewards` from main before this PR (4d41cb5). The world actions then answer `400 action` and the 3D client falls back to localStorage + queued claims.
- Database (only if needed; loses 3D saves only): `drop function public.mkty_world_save(bigint,bigint,jsonb,timestamptz); drop table public.mkty_world_saves;`
  `world3d:*` rows in `reward_events` are ordinary ledger rows and stay valid.

## Tests
`node tests/world-server.cjs`, `node tests/world-sql.cjs`, `node tests/world3d-static.cjs` (in `npm test`), plus browser tools
(serve the repo root, e.g. `python3 -m http.server 47400`, `MK_BASE=http://127.0.0.1:47400/world3d/index.html`):
`node tools/world3d/game_test.mjs phone|desktop`, `node tools/world3d/collide_check.mjs phone|low`, `node tools/world3d/ch1_stats.mjs phone|low|desktop`,
`node tools/world3d/tg_webview_test.mjs` (mocked Telegram SDK + real rewards handler on a fake DB).

## Deferred (stubs in `world3d/src/tg/deferred.js`)
Friend help; bot notifications "robot returned" / "storage full". These need the bot webhook deployed, user opt-in (`requestWriteAccess`), a scheduler and throttling.
