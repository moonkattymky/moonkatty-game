# MOONKATTY — first real 3D location

This is an independent, playable graphics prototype, not a replacement for the
nine published chapters. Open `graphics-preview/index.html` through an HTTP
server. From the repository root: `python3 -m http.server 8000`, then visit
`http://localhost:8000/graphics-preview/`.

The scene uses actual WebGL2 geometry throughout: walkable lunar terrain, reactor,
parabolic antenna, generator, an open airlock, a rover, solar arrays, and a rigged
tabby astronaut with a striped tail. Camera yaw is unrestricted. Station/character
contact shadows and terrain vertex AO avoid full-scene shadow-map sampling. Repeated
station parts are instanced; distant bolts use lighter geometry. Opaque mascot
surfaces are merged within each animated rig part, retaining their geometry and
materials. Rough terrain and rocks use vertex-lit shading with baked AO; station
metal, glass and the mascot keep their detailed surface materials. This is the first authored 3D model of the mascot;
its modeling/material fidelity is still below the cinematic reference.

## Controls

- Phone: left joystick for walking; another finger drags the world to look around;
  two fingers on the world zoom the camera. Both portrait and landscape work.
- Desktop: WASD/arrows walk, Q/E rotate, dragging looks around, wheel zooms.
- Approach each of the three modules and use Inspect. Scan points to the nearest
  uninspected module. Map and Tasks open pausing panels. The paw returns the camera
  behind the cat. Escape or Pause suspends input. Economy lowers rendering scale.

Preview position, camera and inspected modules are saved **only** under
`sessionStorage.mkty_graphics_3d_preview_v1`, for this browser tab. The page does
not load campaign controllers, read/write campaign localStorage, authenticate,
contact game APIs, or grant rewards. Returning to the published game follows a
plain relative link. Private account data is not needed to run the location.

Telegram presentation uses the official SDK only when opened as a Mini App:
ready/expand, stable viewport height, BackButton, deactivation pause and, for
supporting clients, disabling the conflicting vertical swipe. Automated browser
emulation cannot certify physical Android/iOS Telegram performance.

## Assets and sources

- `source/regolith-albedo.png`: original generated, seamless lunar albedo.
- `source/earth-albedo.png`: original generated equirectangular Earth-style albedo;
  an artistic texture, not a scientifically precise geographical map.
- `art/*.webp`: compressed production derivatives; source PNGs are not requested
  by the game. Image generation created textures, not a screenshot of gameplay.
- Fur, nebula, stars, contact shadows and label textures are authored procedurally
  in `scene.js`. The mascot and station geometry are editable code-native meshes.
- `vendor/three-r170.module.min.js`: pinned Three.js 0.170.0, MIT; complete upstream
  notice in `vendor/THREE-LICENSE.txt`. No runtime CDN engine dependency.

Source PNGs were generated with the provided lunar-base reference: overhead neutral
silver regolith without objects or a horizon, and a 2:1 unlit Earth-style surface
map without a spherical render, UI or labels. Production textures retain their
composition and are resized/re-encoded to WebP.

Run `node tests/open-world-graphics-ui.cjs` for real-render checks. Use
`CHROMIUM_PATH` if a non-default Playwright executable is needed. The full
repository regression suite remains `npm test`.

`tools/record-open-world-preview.cjs` records actual touch-operated mobile footage.
`tools/benchmark-open-world-preview.cjs` measures cold loading under a defined
network/CPU throttle and interaction afterward. Both report their software-GPU
environment explicitly; neither substitutes for physical Telegram device tests.

Production chapter integration is deliberately pending the decisions documented
in `docs/OPEN_WORLD_GRAPHICS_20261010.md`.
