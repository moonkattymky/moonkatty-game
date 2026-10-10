# Optional 3D test entry

Base game: `00e391ffe0bb2ed663a7e3136cf382b0030857b4`.
Reviewed standalone prototype: Work PR59, `5f72f520f21424ae46402eb8c08d7585f3916531`.

This release exposes that existing prototype through an experimental home-screen
entry. It does not replace any chapter or change campaign progression, rewards,
authentication, save formats, server functions, or compact-write activation.
The scene, textures, renderer, engine and movement rules are preserved.

## Entry and return

On Home, scroll below the hero to **3D TEST / 3D ТЕСТ**, read the limitations and
choose **Open 3D test / Открыть 3D тест**. The 3D files are requested only after
this explicit second action. No preview iframe or engine is fetched on ordinary
startup or while reading the warning.

The original game document stays mounted. A separate embedded page omits the
Telegram SDK, receives no identity or initData, and never calls campaign APIs.
The root keeps control of Telegram BackButton and safe areas. A permanent Return
button, Escape, Telegram BackButton, the preview pause-menu return and its failure
return close the frame instead of navigating to a second game document.
Returning saves only the existing per-tab preview position, stops its animation,
and removes the frame. Campaign progress is untouched. Backgrounding/deactivation
requests pause; delayed startup honors that request. Reopening may restore the
preview position. A full root reload returns to the regular game without
loading 3D again.

The only change to Work's world controller is a small pause/save/dispose lifecycle
hook and a closed-after-load guard. `embed.html` mirrors its original page, omits
the second Telegram SDK, redirects two return controls to the host, and describes
Escape correctly. Work PR59 is not modified by this integration branch.

## Failure and performance limits

The host Return button remains usable when WebGL2 is unavailable, module or
texture loading fails, or initialization is slow. A slow-load warning is
nonterminal: late success can still become usable. The preview is home-only;
opening over an active mission is intentionally disallowed.

The existing software-WebGL measurements in
`open-world-preview/VALIDATION.md` do not meet smooth-play targets. They are not
phone frame rates. This test entry warns about low frame rate, delay and heating.
It is one bounded location with Russian controls, not an integrated nine-chapter
3D campaign. Pause stops simulation/input but the inherited renderer can keep
painting; Return unloads the preview when the owner wants to stop GPU work.

Physical Telegram Android/iPhone acceptance still requires the owner to check
walking and camera together, pause/return, minimize/reopen, orientation changes,
heating and sustained performance. Browser fixtures cannot certify those devices.

## Validation and rollback

Run the complete repository suite on the exact integration commit. The existing
standalone 3D suite remains unchanged. Added source guards pin production logic and
artwork; embedded browser checks exercise lazy entry, real input, cleanup,
interruption, failures, storage/auth isolation, and reachable return controls.
`tools/verify-live.cjs` also verifies the shipped wrapper and 3D asset bytes.

Rollback is a targeted revert of this additive integration, retaining all later
Work and logic fixes. No database or save migration is needed. Do not reset main
or import older graphics draft ancestry. Production backend remains decoder-only.
