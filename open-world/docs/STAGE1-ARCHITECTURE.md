# Open-world stage 1

Main-game base: `00e391ffe0bb2ed663a7e3136cf382b0030857b4`.
Visual source: owned `moonkattymky/moonkatty-horizons-play` at `aefb189a133aefd5d28f5acf0a1292506687ebca`.

The test entry is `/open-world/index.html`. It uses the existing raw WebGL 1 renderer and the exact four-direction orange cat sprite atlases selected by the owner. The landscape, buildings, props and collisions are spatial 3D. The character is an explicitly accepted camera-facing animated sprite with four available viewing directions.

Only the renderer/model/texture scripts are reused. The Horizons `game.js`, economy, save controller, daily rewards and account systems are not loaded. Its `core.js` supplies terrain constants/functions, and a read-only visual adapter limits the exposed API used by rendering. The preview state is ephemeral and never commits task completion, balance changes or campaign saves.

The new input shell owns keyboard, left joystick, camera drag, sprint, jump, pause and a non-rewarding action preview. The next stage will bridge eight Life 1 POIs plus its finale into the original main game's guarded story controllers; it will not port Horizons' progression system.

Validation: original-main 77-suite baseline; static source/asset provenance; real WebGL screenshots and interaction video; keyboard and touch movement, camera orbit/collision, sprint/jump, pause/focus interruptions, request/storage isolation, portrait/landscape and RTL layout. Browser emulation is not physical iPhone/Android verification. First-load and 30+FPS goals remain unverified until measured on the target devices.

No main publish before explicit owner acceptance of screenshots and video. Requested style storyboard/trailer/mockup files were not present in either checkout during initial inspection; the provided IMG_6126 screenshot is the verified character reference.

## Current checkpoint status

Local source/identity checks and seven non-browser input/recovery probes pass. Eight applicable existing Life 1/account/save suites pass on the unchanged production source. Real WebGL browser captures, video, all 77 suites in CI, phone performance and physical-device acceptance are still pending. A 45-second loading failure now offers a translated retry; context loss and unexpected renderer failure require reload. Landing inside a low obstacle recovers to the last clear ground location.

The owner approved the one-time `contents:write` backup job at 21:28 UTC. The remote `pre-openworld-backup` tag was verified at `00e391ffe0bb2ed663a7e3136cf382b0030857b4`; run 38087833019 succeeded. The write-scoped workflow was removed from `open-world` by commit `149f35248289f6361b20e496daf77255346ac91b`. Its action was fixed to creating `refs/tags/pre-openworld-backup` at the verified base SHA and refuses an existing mismatched tag or changed main. It has no pull-request trigger, checkout, deployment, new secret, or tag overwrite. The normal visual-evidence workflow uses `contents:read` only.
