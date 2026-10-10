# Cinematic lunar perimeter — editable artwork, v1

This graphics branch follows the user's portrait lunar-base reference: a blue
Earth above silver regolith, ivory/gold industrial hardware, cyan energy, and
the retained upright tabby astronaut. It is a layered 2.5D playable scene, not a
prerendered screenshot presented as gameplay or a new 3D engine.

The three PNG files here are the original image-generation outputs, before
production resize/encoding. They can be edited and repacked independently.

| Source | Contents | Production use |
| --- | --- | --- |
| `background.png` | 941×1672, portrait lunar environment without UI or gameplay objects | `art/cinematic-perimeter-ground-v1.webp`, 840×1493 |
| `equipment.png` | 1254×1254, transparent 4×4 industrial prop sheet | Upper 1024×1024 of the shared production atlas |
| `cat-walk.png` | 2172×724, four transparent front/three-quarter walking poses | Lower 1024×341 of the shared production atlas |

Production atlas: `art/cinematic-perimeter-atlas-v1.webp`, 1024×1365.
Each equipment crop is 256×256; the four cat crops are 256×341 at y=1024.
The scene loads exactly two textures, 739,666 bytes combined. Source PNGs are
not loaded by the application. No artwork is preloaded on the home screen.

## Art direction used for generation

All three asset requests referenced the same user-provided portrait concept.
They used the built-in imagegen skill, with true transparency for the sheets.

- **Background:** portrait 9:16; silver detailed lunar regolith, midnight navy
  stars/violet nebula, large blue Earth at upper right; low elevated three-quarter
  camera; warm station light from offscreen right and cool blue fill. Clear
  central traversable terrain, distant rocky horizon, foreground rocks at the
  outside edges. No cat, vehicles, station modules, HUD, routes, text or logos.
- **Equipment:** transparent square 4×4 sheet with isolated full objects and
  uniform tile locations; ivory pressure housings, gold rails, dark titanium,
  amber lights and cyan reactor, consistent front-left three-quarter view.
  Rows: habitat/solar/tanks/cooling; dish/greenhouse/battery/miner;
  cyan reactor/gold dish node/amber generator/open ramp airlock;
  rover/fissure/rocks/crater. No UI, people, letters or baked objective markers.
- **Cat:** transparent one-row four-phase walk strip; the reference's brown and
  white tabby, fluffy striped tail, ivory suit, gold hardware/chest life support
  and transparent helmet; consistent full-body front/three-quarter view and
  baseline. Subtle alternating boots and arms, no exaggerated jump or glyphs.

## Integration boundary

`cinematic-perimeter.js` owns rendering and temporary camera/UI presentation.
The four-direction joystick forwards clicks to existing `data-field-cell`
elements. Map toggles camera framing; Tasks expands existing instructions or
scrolls to the existing completed-stage review. They never mutate FieldRules,
checkpoints, persistent storage, rewards, authentication or backend state.

All 36 original 94×94 cell rectangles and obstacle keyboard semantics remain.
Artwork is a noninteractive sibling, so tall buildings cannot enlarge or steal
a touch cell. A dotted route only describes existing safe cells; unscanned
fractures remain blocked by the unchanged controller/model. Native completion
stays disabled until the original objective is fulfilled; a decorative
"connect" button is not substituted for automatic collection.

Only `index.html` asset includes/cache versions and the chapter-1 hook in
`field-art.js` are changed in shared application files. Other chapters, daily
scenes, controllers and all existing tests use the main implementation.
Reduced motion skips both character frame cycling and the native move animation.

Browser evidence is produced by `tests/cinematic-perimeter-ui.cjs` and the
existing `tools/render-visual-preview.cjs`. It is local Chromium evidence;
physical-phone/Telegram WebView and live backend certification are separate.
